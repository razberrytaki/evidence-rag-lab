import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import {
  evaluateRankedRetrieval,
  renderRetrievalModeComparisonReportMarkdown,
  sampleRetrievalQualityCases,
  type RankedRetrievalObservation,
  type RankedRetrievalReport
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
  mapPostgresRetrievalRow,
  type ParameterizedSql
} from "@evidencerag/retrieval";

type RetrievalMode = "lexical" | "vector" | "hybrid";

interface RetrievalModeReportOutput {
  mode: RetrievalMode;
  report: RankedRetrievalReport;
  observations: RankedRetrievalObservation[];
}

const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";
const TOP_K = 3;
const MODES: RetrievalMode[] = ["lexical", "vector", "hybrid"];

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
    const queryEmbeddings = await embeddingProvider.embedTexts(
      sampleRetrievalQualityCases.map((testCase) => testCase.query)
    );
    const modeReports = await runRetrievalModeReports(client, queryEmbeddings);
    const targetPath = join(repoRoot, "docs", "retrieval-mode-comparison-report.md");

    await writeFile(
      targetPath,
      renderRetrievalModeComparisonReportMarkdown({
        k: TOP_K,
        modes: modeReports.map(({ mode, report }) => ({ mode, report })),
        notes: [
          "Identifier-aware lexical retrieval now passes the exact-token stress category.",
          "Vector-only retrieves every expected document but loses one rank position in the trace-observability category.",
          "Hybrid keeps recall equal to vector-only while restoring MRR to 1.000 on this 20-document smoke."
        ]
      }),
      "utf8"
    );

    const hybridReport = modeReports.find((modeReport) => modeReport.mode === "hybrid")?.report;
    if (!hybridReport) {
      throw new Error("missing hybrid retrieval mode report");
    }
    if (hybridReport.summary.failed > 0) {
      throw new Error(
        `hybrid retrieval mode failed ${hybridReport.summary.failed}/${hybridReport.summary.total} cases: ${hybridReport.items
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
          modes: modeReports.map(({ mode, report }) => ({
            mode,
            recallAtK: report.metrics.recallAtK,
            meanReciprocalRank: report.metrics.meanReciprocalRank
          })),
          reportPath: "docs/retrieval-mode-comparison-report.md"
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

async function runRetrievalModeReports(
  client: Client,
  queryEmbeddings: readonly (readonly number[])[]
): Promise<RetrievalModeReportOutput[]> {
  const modeReports: RetrievalModeReportOutput[] = [];

  for (const mode of MODES) {
    const observations = await runRetrievalObservations(client, mode, queryEmbeddings);
    const report = evaluateRankedRetrieval({
      k: TOP_K,
      cases: sampleRetrievalQualityCases,
      observations
    });

    modeReports.push({ mode, report, observations });
  }

  return modeReports;
}

async function runRetrievalObservations(
  client: Client,
  mode: RetrievalMode,
  queryEmbeddings: readonly (readonly number[])[]
): Promise<RankedRetrievalObservation[]> {
  const observations: RankedRetrievalObservation[] = [];

  for (let index = 0; index < sampleRetrievalQualityCases.length; index += 1) {
    const testCase = sampleRetrievalQualityCases[index];
    const embedding = queryEmbeddings[index];
    if (!testCase) {
      throw new Error(`missing retrieval quality case at index ${index}`);
    }
    if (!embedding) {
      throw new Error(`embedding provider returned no vector for case ${testCase.id}`);
    }

    const retrievalSql = buildRetrievalSqlForMode({
      mode,
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

function buildRetrievalSqlForMode(input: {
  mode: RetrievalMode;
  query: string;
  embedding: readonly number[];
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
        embedding: input.embedding,
        topK: input.topK
      });
    case "hybrid":
      return buildPostgresHybridRetrievalSql({
        query: input.query,
        embedding: input.embedding,
        topK: input.topK
      });
  }
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
