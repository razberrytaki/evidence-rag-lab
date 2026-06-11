import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import {
  evaluateRankedRetrieval,
  renderRankedRetrievalReportMarkdown,
  sampleRetrievalQualityCases,
  type RankedRetrievalObservation
} from "@evidencerag/eval";
import {
  buildPostgresIngestPlan,
  executePostgresIngestPlan,
  loadEmbeddedMarkdownDocumentSet,
  loadEnvFile,
  loadOpenAIEmbeddingConfigFromEnv,
  OpenAIEmbeddingClient
} from "@evidencerag/ingest";
import { buildPostgresHybridRetrievalSql, mapPostgresRetrievalRow } from "@evidencerag/retrieval";

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";
const TOP_K = 3;

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
    const observations = await runRetrievalObservations(client, embeddingProvider);
    const report = evaluateRankedRetrieval({
      k: TOP_K,
      cases: sampleRetrievalQualityCases,
      observations
    });
    const targetPath = join(repoRoot, "docs", "retrieval-quality-report.md");
    await writeFile(targetPath, renderRankedRetrievalReportMarkdown(report), "utf8");

    if (report.summary.failed > 0) {
      throw new Error(
        `retrieval quality smoke failed ${report.summary.failed}/${report.summary.total} cases: ${report.items
          .filter((item) => !item.passed)
          .map((item) => `${item.id}(${item.notes.join("; ")})`)
          .join(", ")}`
      );
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          embeddingModel: embeddingConfig.model,
          embeddingDimensions: embeddingConfig.dimensions,
          topK: TOP_K,
          statementCount: ingestSummary.statementCount,
          recallAtK: report.metrics.recallAtK,
          meanReciprocalRank: report.metrics.meanReciprocalRank,
          observations,
          reportPath: "docs/retrieval-quality-report.md"
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

async function runRetrievalObservations(
  client: Client,
  embeddingProvider: OpenAIEmbeddingClient
): Promise<RankedRetrievalObservation[]> {
  const embeddings = await embeddingProvider.embedTexts(sampleRetrievalQualityCases.map((testCase) => testCase.query));
  const observations: RankedRetrievalObservation[] = [];

  for (let index = 0; index < sampleRetrievalQualityCases.length; index += 1) {
    const testCase = sampleRetrievalQualityCases[index];
    const embedding = embeddings[index];
    if (!testCase) {
      throw new Error(`missing retrieval quality case at index ${index}`);
    }
    if (!embedding) {
      throw new Error(`embedding provider returned no vector for case ${testCase.id}`);
    }

    const retrievalSql = buildPostgresHybridRetrievalSql({
      query: testCase.query,
      embedding,
      topK: TOP_K
    });
    const retrievalRows = await client.query(retrievalSql.text, retrievalSql.values);
    const rankedDocIds = deduplicatePreservingOrder(
      retrievalRows.rows.map((row) => mapPostgresRetrievalRow(row).chunk.documentId)
    );

    observations.push({
      caseId: testCase.id,
      rankedDocIds
    });
  }

  return observations;
}

function deduplicatePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
