import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { Client, Pool } from "pg";
import {
  nearestRankPercentile,
  renderRetrievalConcurrencyReportMarkdown,
  roundMilliseconds,
  sampleRetrievalQualityCases,
  type RetrievalConcurrencyMode,
  type RetrievalConcurrencyObservation
} from "@evidencerag/eval";
import {
  buildPostgresIngestPlan,
  executePostgresIngestPlan,
  loadEmbeddedMarkdownDocumentSet,
  loadEnvFile,
  loadOpenAIEmbeddingConfigFromEnv,
  OpenAIEmbeddingClient
} from "@evidencerag/ingest";
import {
  buildPostgresRetrievalSqlForMode
} from "@evidencerag/retrieval";

interface QueryEmbedding {
  caseId: string;
  embedding: readonly number[];
}

interface TimedRetrieval {
  elapsedMs: number;
  ok: boolean;
}

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";
const TOP_K = 3;
const MODES: RetrievalConcurrencyMode[] = ["lexical", "vector", "hybrid"];
const CONCURRENCY_LEVELS = [1, 4] as const;

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  await loadEnvFile(join(repoRoot, ".env"));

  const connectionString = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const embeddingConfig = loadOpenAIEmbeddingConfigFromEnv(process.env);
  const embeddingProvider = new OpenAIEmbeddingClient(embeddingConfig);
  const client = new Client({ connectionString });

  await client.connect();

  try {
    const schema = await readFile(join(repoRoot, "infra/postgres/init/001_schema.sql"), "utf8");
    await client.query(schema);

    const documents = await loadEmbeddedMarkdownDocumentSet(join(repoRoot, "sample-docs"), embeddingProvider);
    const plan = buildPostgresIngestPlan({ documents });
    const ingestSummary = await executePostgresIngestPlan(client, plan);
    const embeddingsByCaseId = await embedQueries(embeddingProvider);
    const observations: RetrievalConcurrencyObservation[] = [];

    for (const concurrency of CONCURRENCY_LEVELS) {
      for (const mode of MODES) {
        observations.push(
          await measureRetrievalConcurrency({
            connectionString,
            mode,
            concurrency,
            embeddingsByCaseId
          })
        );
      }
    }

    const reportsDir = join(repoRoot, "docs", "reports");
    const targetPath = join(reportsDir, "retrieval-concurrency-report.md");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      targetPath,
      renderRetrievalConcurrencyReportMarkdown({
        generatedAt: new Date().toISOString().slice(0, 10),
        caseCount: sampleRetrievalQualityCases.length,
        topK: TOP_K,
        observations,
        notes: [
          "PostgreSQL 검색 동시성만 분리하기 위해 시간 측정 전에 임베딩을 의도적으로 미리 계산한다.",
          "각 동시성 수준은 같은 검색 평가 사례를 실행한다.",
          "Warm/cold 캐시 분리는 하지 않는다. 동시성 1/4에서 DB 검색 구간만 비교한다."
        ]
      }),
      "utf8"
    );

    const errorCount = observations.reduce((sum, observation) => sum + observation.errorCount, 0);
    console.log(
      JSON.stringify(
        {
          status: errorCount === 0 ? "ok" : "failed",
          embeddingModel: embeddingConfig.model,
          embeddingDimensions: embeddingConfig.dimensions,
          topK: TOP_K,
          caseCount: sampleRetrievalQualityCases.length,
          statementCount: ingestSummary.statementCount,
          observations: observations.map((observation) => ({
            mode: observation.mode,
            concurrency: observation.concurrency,
            queries: observation.queryCount,
            p50Ms: observation.p50Ms,
            p95Ms: observation.p95Ms,
            p99Ms: observation.p99Ms,
            totalMs: observation.totalMs,
            errors: observation.errorCount
          })),
          reportPath: "docs/reports/retrieval-concurrency-report.md"
        },
        null,
        2
      )
    );

    if (errorCount > 0) {
      throw new Error(`retrieval concurrency smoke failed with ${errorCount} query errors`);
    }
  } finally {
    await client.end();
  }
}

async function embedQueries(embeddingProvider: OpenAIEmbeddingClient): Promise<ReadonlyMap<string, readonly number[]>> {
  const queryEmbeddings = await embeddingProvider.embedTexts(sampleRetrievalQualityCases.map((testCase) => testCase.query));
  const embeddings: QueryEmbedding[] = [];

  for (let index = 0; index < sampleRetrievalQualityCases.length; index += 1) {
    const testCase = sampleRetrievalQualityCases[index];
    const embedding = queryEmbeddings[index];
    if (!testCase) {
      throw new Error(`missing retrieval quality case at index ${index}`);
    }
    if (!embedding) {
      throw new Error(`embedding provider returned no vector for case ${testCase.id}`);
    }
    embeddings.push({ caseId: testCase.id, embedding });
  }

  return new Map(embeddings.map((embedding) => [embedding.caseId, embedding.embedding]));
}

async function measureRetrievalConcurrency(input: {
  connectionString: string;
  mode: RetrievalConcurrencyMode;
  concurrency: number;
  embeddingsByCaseId: ReadonlyMap<string, readonly number[]>;
}): Promise<RetrievalConcurrencyObservation> {
  const pool = new Pool({
    connectionString: input.connectionString,
    max: input.concurrency
  });

  try {
    const timings = await mapWithConcurrency(sampleRetrievalQualityCases, input.concurrency, async (testCase) => {
      const retrievalSql = buildPostgresRetrievalSqlForMode({
        mode: input.mode,
        query: testCase.query,
        embedding: input.embeddingsByCaseId.get(testCase.id),
        topK: TOP_K
      });

      const startedAt = performance.now();
      try {
        await pool.query(retrievalSql.text, retrievalSql.values);
        return { elapsedMs: performance.now() - startedAt, ok: true };
      } catch {
        return { elapsedMs: performance.now() - startedAt, ok: false };
      }
    });

    return summarizeConcurrency(input.mode, input.concurrency, timings);
  } finally {
    await pool.end();
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) {
        throw new Error(`missing work item at index ${index}`);
      }
      results[index] = await task(item);
    }
  });

  await Promise.all(workers);
  return results;
}

function summarizeConcurrency(
  mode: RetrievalConcurrencyMode,
  concurrency: number,
  timings: readonly TimedRetrieval[]
): RetrievalConcurrencyObservation {
  const successfulTimings = timings.filter((timing) => timing.ok).map((timing) => timing.elapsedMs);
  const sorted = successfulTimings.slice().sort((left, right) => left - right);

  return {
    mode,
    concurrency,
    queryCount: timings.length,
    minMs: roundMilliseconds(sorted[0] ?? 0),
    p50Ms: roundMilliseconds(nearestRankPercentile(sorted, 0.5)),
    p95Ms: roundMilliseconds(nearestRankPercentile(sorted, 0.95)),
    p99Ms: roundMilliseconds(nearestRankPercentile(sorted, 0.99)),
    maxMs: roundMilliseconds(sorted[sorted.length - 1] ?? 0),
    totalMs: roundMilliseconds(successfulTimings.reduce((sum, timing) => sum + timing, 0)),
    errorCount: timings.filter((timing) => !timing.ok).length
  };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
