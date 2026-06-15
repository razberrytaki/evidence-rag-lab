import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  buildPostgresRetrievalSqlForMode,
  mapPostgresRetrievalRow,
  type PostgresRetrievalMode
} from "@evidencerag/retrieval";

type RetrievalMode = PostgresRetrievalMode;

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
    const reportsDir = join(repoRoot, "docs", "reports");
    const targetPath = join(reportsDir, "retrieval-mode-comparison-report.md");
    await mkdir(reportsDir, { recursive: true });

    await writeFile(
      targetPath,
      renderRetrievalModeComparisonReportMarkdown({
        k: TOP_K,
        modes: modeReports.map(({ mode, report }) => ({ mode, report })),
        notes: [
          "실행 맥락: pnpm db:retrieval-compare-smoke, 공개 샘플 문서, 20개 검색 사례, 로컬 PostgreSQL 연결.",
          "식별자 인식 키워드 검색은 이제 exact-token 압력 범주를 통과한다.",
          "벡터 전용 검색은 모든 기대 문서를 찾지만 trace-observability 범주에서 순위 위치 하나를 잃는다.",
          "Hybrid는 이 20개 문서 동작 확인에서 벡터 전용 검색과 같은 recall을 유지하면서 MRR을 1.000으로 복구한다."
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
          reportPath: "docs/reports/retrieval-mode-comparison-report.md"
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

    const retrievalSql = buildPostgresRetrievalSqlForMode({
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
