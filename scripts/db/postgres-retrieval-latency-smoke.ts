import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { Client } from "pg";
import {
  renderRetrievalLatencyReportMarkdown,
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
  buildPostgresHybridRetrievalSql,
  buildPostgresLexicalRetrievalSql,
  buildPostgresVectorRetrievalSql,
  type ParameterizedSql
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
    const targetPath = join(repoRoot, "docs", "retrieval-latency-report.md");
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
          "Small sample smoke over public sample docs; not a 10M-document benchmark.",
          "Embedding latency is measured as one OpenAI embeddings call per eval query.",
          "Database retrieval latency excludes embedding time so lexical, vector, and hybrid SQL trade-offs remain visible.",
          "Query text, provider payloads, and credentials are intentionally excluded from this report."
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
          reportPath: "docs/retrieval-latency-report.md"
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
    const retrievalSql = buildRetrievalSqlForMode({
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

function buildRetrievalSqlForMode(input: {
  mode: RetrievalDbMode;
  query: string;
  embedding: readonly number[] | undefined;
  topK: number;
}): ParameterizedSql {
  switch (input.mode) {
    case "lexical":
      return buildPostgresLexicalRetrievalSql({
        query: input.query,
        topK: input.topK
      });
    case "vector":
      return buildPostgresVectorRetrievalSql({
        embedding: requireEmbedding(input.embedding, input.mode),
        topK: input.topK
      });
    case "hybrid":
      return buildPostgresHybridRetrievalSql({
        query: input.query,
        embedding: requireEmbedding(input.embedding, input.mode),
        topK: input.topK
      });
  }
}

function summarizeLatency(mode: RetrievalLatencyMode, timings: readonly number[]): RetrievalLatencyObservation {
  if (timings.length === 0) {
    throw new Error(`cannot summarize empty latency timings for ${mode}`);
  }

  const sorted = timings.slice().sort((left, right) => left - right);
  return {
    mode,
    sampleCount: timings.length,
    minMs: roundMs(sorted[0] ?? 0),
    p50Ms: roundMs(percentileNearestRank(sorted, 0.5)),
    p95Ms: roundMs(percentileNearestRank(sorted, 0.95)),
    maxMs: roundMs(sorted[sorted.length - 1] ?? 0),
    totalMs: roundMs(timings.reduce((sum, timing) => sum + timing, 0))
  };
}

function percentileNearestRank(sortedValues: readonly number[], percentile: number): number {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * percentile) - 1));
  return sortedValues[index] ?? 0;
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireEmbedding(embedding: readonly number[] | undefined, mode: RetrievalDbMode): readonly number[] {
  if (!embedding) {
    throw new Error(`missing query embedding for ${mode} latency smoke`);
  }
  return embedding;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
