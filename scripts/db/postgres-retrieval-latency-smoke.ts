import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { Client } from "pg";
import {
  nearestRankPercentile,
  renderRetrievalLatencyReportMarkdown,
  roundMilliseconds,
  sampleRetrievalQualityCases,
  type RetrievalLatencyMode,
  type RetrievalLatencyObservation
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

type RetrievalDbMode = Exclude<RetrievalLatencyMode, "embedding">;

interface TimedQueryEmbedding {
  caseId: string;
  embedding: readonly number[];
}

interface EmbeddingLatencyResult {
  observation: RetrievalLatencyObservation;
  embeddingsByCaseId: Map<string, readonly number[]>;
}

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";
const TOP_K = 3;
const DB_MODES: RetrievalDbMode[] = ["lexical", "vector", "hybrid"];

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  await loadEnvFile(join(repoRoot, ".env"));

  const embeddingConfig = loadOpenAIEmbeddingConfigFromEnv(process.env);
  const embeddingProvider = new OpenAIEmbeddingClient(embeddingConfig);
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  });

  await client.connect();

  try {
    const schema = await readFile(join(repoRoot, "infra/postgres/init/001_schema.sql"), "utf8");
    await client.query(schema);

    const documents = await loadEmbeddedMarkdownDocumentSet(join(repoRoot, "sample-docs"), embeddingProvider);
    const plan = buildPostgresIngestPlan({ documents });
    const ingestSummary = await executePostgresIngestPlan(client, plan);
    const embeddingLatency = await measureEmbeddingLatency(embeddingProvider);
    const dbLatencyObservations: RetrievalLatencyObservation[] = [];

    for (const mode of DB_MODES) {
      dbLatencyObservations.push(await measureDatabaseRetrievalLatency(client, mode, embeddingLatency.embeddingsByCaseId));
    }

    const observations = [embeddingLatency.observation, ...dbLatencyObservations];
    const reportsDir = join(repoRoot, "docs", "reports");
    const targetPath = join(reportsDir, "retrieval-latency-report.md");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      targetPath,
      renderRetrievalLatencyReportMarkdown({
        generatedAt: new Date().toISOString().slice(0, 10),
        caseCount: sampleRetrievalQualityCases.length,
        topK: TOP_K,
        embeddingModel: embeddingConfig.model,
        embeddingDimensions: embeddingConfig.dimensions,
        observations,
        notes: [
          "임베딩 지연 시간은 평가 질의당 OpenAI embeddings 호출 1회로 측정한다.",
          "데이터베이스 검색 지연 시간은 임베딩 시간을 제외해 키워드, 벡터, hybrid SQL 절충이 보이게 한다.",
          "Warm/cold 캐시 분리는 하지 않는다. 같은 실행 안에서 모드 간 비용 분리만 본다."
        ]
      }),
      "utf8"
    );

    console.log(
      JSON.stringify(
        {
          status: "ok",
          embeddingModel: embeddingConfig.model,
          embeddingDimensions: embeddingConfig.dimensions,
          topK: TOP_K,
          caseCount: sampleRetrievalQualityCases.length,
          statementCount: ingestSummary.statementCount,
          modes: observations.map((observation) => ({
            mode: observation.mode,
            samples: observation.sampleCount,
            p50Ms: observation.p50Ms,
            p95Ms: observation.p95Ms,
            totalMs: observation.totalMs
          })),
          reportPath: "docs/reports/retrieval-latency-report.md"
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

async function measureEmbeddingLatency(embeddingProvider: OpenAIEmbeddingClient): Promise<EmbeddingLatencyResult> {
  const timings: number[] = [];
  const embeddings: TimedQueryEmbedding[] = [];

  for (const testCase of sampleRetrievalQualityCases) {
    const startedAt = performance.now();
    const embedding = (await embeddingProvider.embedTexts([testCase.query]))[0];
    timings.push(performance.now() - startedAt);

    if (!embedding) {
      throw new Error(`embedding provider returned no vector for case ${testCase.id}`);
    }
    embeddings.push({ caseId: testCase.id, embedding });
  }

  return {
    observation: summarizeLatency("embedding", timings),
    embeddingsByCaseId: new Map(embeddings.map((embedding) => [embedding.caseId, embedding.embedding]))
  };
}

async function measureDatabaseRetrievalLatency(
  client: Client,
  mode: RetrievalDbMode,
  embeddingsByCaseId: ReadonlyMap<string, readonly number[]>
): Promise<RetrievalLatencyObservation> {
  const timings: number[] = [];

  for (const testCase of sampleRetrievalQualityCases) {
    const retrievalSql = buildPostgresRetrievalSqlForMode({
      mode,
      query: testCase.query,
      embedding: embeddingsByCaseId.get(testCase.id),
      topK: TOP_K
    });

    const startedAt = performance.now();
    await client.query(retrievalSql.text, retrievalSql.values);
    timings.push(performance.now() - startedAt);
  }

  return summarizeLatency(mode, timings);
}

function summarizeLatency(mode: RetrievalLatencyMode, timings: readonly number[]): RetrievalLatencyObservation {
  if (timings.length === 0) {
    throw new Error(`cannot summarize empty latency timings for ${mode}`);
  }

  const sorted = timings.slice().sort((left, right) => left - right);
  return {
    mode,
    sampleCount: timings.length,
    minMs: roundMilliseconds(sorted[0] ?? 0),
    p50Ms: roundMilliseconds(nearestRankPercentile(sorted, 0.5)),
    p95Ms: roundMilliseconds(nearestRankPercentile(sorted, 0.95)),
    maxMs: roundMilliseconds(sorted[sorted.length - 1] ?? 0),
    totalMs: roundMilliseconds(timings.reduce((sum, timing) => sum + timing, 0))
  };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
