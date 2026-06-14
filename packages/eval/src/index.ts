export interface EvalFixture {
  id: string;
  query: string;
  expectedBehavior:
    | "retrieve"
    | "demote"
    | "conflict"
    | "reject"
    | "cite"
    | "validate"
    | "trace";
  expectedRelevantDocs: string[];
  expectedRejectedDocs: string[];
  requiredCitations: string[];
}

export interface EvalObservation {
  fixtureId: string;
  retrievedDocIds: string[];
  rejectedDocIds: string[];
  citationChunkIds: string[];
  finalStatus: "answered" | "conflict" | "rejected";
  unsupportedClaimRejected: boolean;
  traceComplete: boolean;
  observationSource?: "static-fixture" | "sample-runtime" | "postgres-runtime";
}

export interface EvalReportItem {
  id: string;
  source: NonNullable<EvalObservation["observationSource"]> | "missing";
  passed: boolean;
  notes: string[];
}

export interface RateMetric {
  passed: number;
  total: number;
  rate: number;
}

export interface EvalReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  observationSources: Array<{
    source: NonNullable<EvalObservation["observationSource"]>;
    count: number;
  }>;
  metrics: {
    recallAtK: RateMetric;
    citationCoverage: RateMetric;
    unsupportedClaimRejection: RateMetric;
    traceCompleteness: RateMetric;
  };
  items: EvalReportItem[];
}

export interface RankedRetrievalCase {
  id: string;
  query: string;
  expectedRelevantDocIds: string[];
  category?: string;
}

export interface RankedRetrievalObservation {
  caseId: string;
  rankedDocIds: string[];
}

export interface RankedRetrievalReportItem {
  id: string;
  passed: boolean;
  reciprocalRank: number;
  category?: string;
  matchedDocId?: string;
  notes: string[];
}

export interface RankedRetrievalReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  metrics: {
    recallAtK: RateMetric;
    meanReciprocalRank: number;
  };
  items: RankedRetrievalReportItem[];
}

export interface RetrievalModeReport {
  mode: string;
  report: RankedRetrievalReport;
}

export interface RetrievalModeComparisonReportInput {
  k: number;
  modes: RetrievalModeReport[];
  notes?: string[];
}

export type RetrievalLatencyMode = "embedding" | "lexical" | "vector" | "hybrid";

export interface RetrievalLatencyObservation {
  mode: RetrievalLatencyMode;
  sampleCount: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  totalMs: number;
}

export interface RetrievalLatencyReportInput {
  generatedAt: string;
  caseCount: number;
  topK: number;
  embeddingModel: string;
  embeddingDimensions: number;
  observations: RetrievalLatencyObservation[];
  notes?: string[];
}

export type RetrievalConcurrencyMode = "lexical" | "vector" | "hybrid";

export interface RetrievalConcurrencyObservation {
  mode: RetrievalConcurrencyMode;
  concurrency: number;
  queryCount: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  totalMs: number;
  errorCount: number;
}

export interface RetrievalConcurrencyReportInput {
  generatedAt: string;
  caseCount: number;
  topK: number;
  observations: RetrievalConcurrencyObservation[];
  notes?: string[];
}

export type ProviderComparisonRole = "default-live" | "comparison-adapter" | "test-double";
export type ProviderLiveVerification =
  | {
      status: "separate-command";
      command: string;
    }
  | {
      status: "not-run" | "not-applicable";
      command: string;
      reason: string;
    };

export interface ProviderComparisonItem {
  provider: "openai-compatible" | "anthropic" | "fake";
  role: ProviderComparisonRole;
  requestSurface: string;
  setup: string;
  liveVerification: ProviderLiveVerification;
  deterministicChecks: string[];
  tradeOffs: string[];
}

export interface ProviderComparisonReportInput {
  generatedAt: string;
  providers: ProviderComparisonItem[];
  notes?: string[];
}

export interface ScaleBudgetAssumptions {
  documentCount: number;
  averageChunksPerDocument: number;
  embeddingDimensions: number;
  embeddingBytesPerDimension: number;
  metadataBytesPerChunk: number;
  averageTraceBytes: number;
  dailyQueryCount: number;
  traceRetentionDays: number;
}

export interface ScaleBudgetEstimate {
  documentCount: number;
  chunkCount: number;
  vectorBytes: number;
  metadataBytes: number;
  vectorAndMetadataBytes: number;
  retainedTraceBytes: number;
}

export interface ScaleBudgetReportInput {
  generatedAt: string;
  assumptions: ScaleBudgetAssumptions;
  notes?: string[];
}

export interface VectorIndexBudgetAssumptions {
  documentCount: number;
  averageChunksPerDocument: number;
  embeddingDimensions: number;
  embeddingBytesPerDimension: number;
  metadataBytesPerChunk: number;
  hnswM: number;
  hnswLayerMultiplier: number;
  hnswGraphBytesPerNeighbor: number;
  hnswBuildMemoryMultiplier: number;
}

export interface VectorIndexBudgetEstimate {
  documentCount: number;
  chunkCount: number;
  vectorBytes: number;
  metadataBytes: number;
  hnswGraphBytes: number;
  hnswServingBytes: number;
  hnswBuildWorkingSetBytes: number;
  graphOverVectorRate: number;
}

export interface VectorIndexBudgetReportInput {
  generatedAt: string;
  assumptions: VectorIndexBudgetAssumptions;
  notes?: string[];
}

export * from "./sample-retrieval-quality-cases";

export function evaluateFixtures(fixtures: EvalFixture[], observations: EvalObservation[]): EvalReport {
  const observationByFixtureId = new Map(observations.map((observation) => [observation.fixtureId, observation]));
  const items = fixtures.map((fixture) => evaluateFixture(fixture, observationByFixtureId.get(fixture.id)));

  const passed = items.filter((item) => item.passed).length;
  return {
    summary: {
      total: fixtures.length,
      passed,
      failed: fixtures.length - passed
    },
    observationSources: summarizeObservationSources(observations),
    metrics: {
      recallAtK: buildMetric(fixtures, observations, shouldMeasureRecall, hasExpectedRelevantDocs),
      citationCoverage: buildMetric(fixtures, observations, shouldMeasureCitationCoverage, hasRequiredCitations),
      unsupportedClaimRejection: buildMetric(
        fixtures,
        observations,
        shouldMeasureUnsupportedClaimRejection,
        hasExpectedUnsupportedClaimRejection
      ),
      traceCompleteness: buildMetric(
        fixtures,
        observations,
        () => true,
        (_fixture, observation) => observation.traceComplete
      )
    },
    items
  };
}

export function renderEvalReportMarkdown(report: EvalReport): string {
  const sampleRuntimeCount =
    report.observationSources.find((item) => item.source === "sample-runtime")?.count ?? 0;
  const staticFixtureCount =
    report.observationSources.find((item) => item.source === "static-fixture")?.count ?? 0;
  const lines = [
    "# 평가 리포트",
    "",
    "정적 eval fixture와 sample-runtime observation을 합쳐 생성한다.",
    "현재 runtime observation은 insufficient-evidence 계열 negative guard를 우선 검증한다.",
    "",
    `요약: ${report.summary.passed}/${report.summary.total} fixture 통과. sample-runtime observation ${sampleRuntimeCount}건, static fixture ${staticFixtureCount}건.`,
    "",
    "## 읽는 법",
    "",
    "- fixture 통과 수보다 어떤 guard가 runtime observation으로 확인됐는지 먼저 본다.",
    "",
    "| Metric | 결과 | 비율 |",
    "|---|---:|---:|",
    metricRow("recall@k", report.metrics.recallAtK),
    metricRow("citation coverage", report.metrics.citationCoverage),
    metricRow("unsupported-claim rejection", report.metrics.unsupportedClaimRejection),
    metricRow("trace completeness", report.metrics.traceCompleteness),
    "",
    "| Observation source | Count |",
    "|---|---:|",
    ...report.observationSources.map((item) => `| ${item.source} | ${item.count} |`),
    "",
    "| Fixture | Observation source | 상태 | 메모 |",
    "|---|---|---|---|",
    ...report.items.map(
      (item) => `| ${item.id} | ${item.source} | ${formatPassFail(item.passed)} | ${item.notes.join("; ")} |`
    ),
    ""
  ];

  return lines.join("\n");
}

function summarizeObservationSources(
  observations: EvalObservation[]
): Array<{ source: NonNullable<EvalObservation["observationSource"]>; count: number }> {
  const counts = new Map<NonNullable<EvalObservation["observationSource"]>, number>();
  for (const observation of observations) {
    const source = observation.observationSource ?? "static-fixture";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return [...counts].map(([source, count]) => ({ source, count }));
}

export function evaluateRankedRetrieval(input: {
  k: number;
  cases: RankedRetrievalCase[];
  observations: RankedRetrievalObservation[];
}): RankedRetrievalReport {
  const k = requirePositiveInteger(input.k, "k");
  const observationByCaseId = new Map(input.observations.map((observation) => [observation.caseId, observation]));
  const items = input.cases.map((testCase) =>
    evaluateRankedRetrievalCase(k, testCase, observationByCaseId.get(testCase.id))
  );
  const passed = items.filter((item) => item.passed).length;
  const reciprocalRankSum = items.reduce((sum, item) => sum + item.reciprocalRank, 0);

  return {
    summary: {
      total: input.cases.length,
      passed,
      failed: input.cases.length - passed
    },
    metrics: {
      recallAtK: {
        passed,
        total: input.cases.length,
        rate: input.cases.length === 0 ? 1 : roundRate(passed / input.cases.length)
      },
      meanReciprocalRank: input.cases.length === 0 ? 0 : roundRate(reciprocalRankSum / input.cases.length)
    },
    items
  };
}

export function renderRankedRetrievalReportMarkdown(report: RankedRetrievalReport): string {
  const lines = [
    "# 검색 품질 리포트",
    "",
    "대상: public sample docs. 경로: live PostgreSQL + pgvector ranked retrieval.",
    "",
    `요약: ${report.summary.passed}/${report.summary.total} ranked retrieval case 통과.`,
    "",
    "## 주요 결과",
    "",
    `- hybrid retrieval recall@3 ${report.metrics.recallAtK.passed}/${report.metrics.recallAtK.total}, MRR ${report.metrics.meanReciprocalRank.toFixed(3)}.`,
    "- case table은 통과 여부보다 어떤 document가 몇 번째 rank에 들어왔는지 확인하는 evidence다.",
    "",
    "## 읽는 법",
    "",
    "- absolute score보다 expected document가 top 3 안에 들어왔는지와 rank position을 본다.",
    "",
    "| Metric | 결과 | 비율 |",
    "|---|---:|---:|",
    metricRow("recall@3", report.metrics.recallAtK),
    `| mean reciprocal rank | ${report.metrics.meanReciprocalRank.toFixed(3)} | |`,
    "",
    "| Case | 상태 | Matched doc | Reciprocal rank | 메모 |",
    "|---|---|---|---:|---|",
    ...report.items.map(
      (item) =>
        `| ${item.id} | ${formatPassFail(item.passed)} | ${item.matchedDocId ?? "-"} | ${item.reciprocalRank.toFixed(
          3
        )} | ${item.notes.join("; ")} |`
    ),
    ""
  ];

  return lines.join("\n");
}

export function renderRetrievalModeComparisonReportMarkdown(input: RetrievalModeComparisonReportInput): string {
  const k = requirePositiveInteger(input.k, "k");
  const categoryRows = buildRetrievalModeCategoryRows(input.modes);
  const notableOutcomes = buildRetrievalModeNotableOutcomes(input.modes);
  const lines = [
    "# 검색 모드 비교 리포트",
    "",
    "대상: public sample docs. 경로: live PostgreSQL retrieval mode comparison.",
    "목적: lexical, vector, hybrid retrieval mode의 trade-off 확인.",
    "",
    "## 읽는 법",
    "",
    "- mode별 승패보다 lexical, vector, hybrid가 어느 category에서 차이 나는지 본다.",
    "",
    ...(notableOutcomes.length > 0 ? ["## 주요 결과", "", ...notableOutcomes.map((note) => `- ${note}`), ""] : []),
    "| Mode | Recall | 비율 | Mean reciprocal rank |",
    "|---|---:|---:|---:|",
    ...input.modes.map(
      ({ mode, report }) =>
        `| ${mode} | ${report.metrics.recallAtK.passed}/${report.metrics.recallAtK.total} | ${formatPercent(
          report.metrics.recallAtK.rate
        )} | ${report.metrics.meanReciprocalRank.toFixed(3)} |`
    ),
    "",
    ...(categoryRows.length > 0
      ? [
          "| Category | Mode | Recall | 비율 | Mean reciprocal rank |",
          "|---|---|---:|---:|---:|",
          ...categoryRows,
          ""
        ]
      : []),
    "| Case | Mode | Category | 상태 | Matched doc | Reciprocal rank | 메모 |",
    "|---|---|---|---|---|---:|---|",
    ...input.modes.flatMap(({ mode, report }) =>
      report.items.map(
        (item) =>
          `| ${item.id} | ${mode} | ${item.category ?? "-"} | ${formatPassFail(item.passed)} | ${item.matchedDocId ?? "-"} | ${item.reciprocalRank.toFixed(
            3
          )} | ${item.notes.join("; ")} |`
      )
    ),
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [`- Recall은 top ${k} 기준으로 측정한다.`, "- Hybrid는 측정된 retrieval behavior로 계속 정당화되어야 한다."]),
    ""
  ];

  return lines.join("\n");
}

export function renderProviderComparisonReportMarkdown(input: ProviderComparisonReportInput): string {
  const lines = [
    "# Provider 비교 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    "",
    "검증 범위: deterministic adapter contract. Live generation smoke는 별도 command 결과로 추적한다.",
    "",
    "## 읽는 법",
    "",
    "- adapter contract와 live 검증 경계를 분리해서 본다.",
    "",
    "| Provider | Role | Request surface | Generation env | Live 검증 | Command | Reason |",
    "|---|---|---|---|---|---|---|",
    ...input.providers.map(providerLiveVerificationRow),
    "",
    "| Provider | Deterministic checks | Trade-offs |",
    "|---|---|---|",
    ...input.providers.map(
      (provider) =>
        `| ${provider.provider} | ${provider.deterministicChecks.join(", ")} | ${provider.tradeOffs.join("; ")} |`
    ),
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [
          "- embedding에는 OpenAI가 계속 필요하다.",
          "- Provider comparison은 explicit하므로 setup error가 fallback 뒤에 숨지 않는다."
        ]),
    ""
  ];

  return lines.join("\n");
}

export function renderRetrievalLatencyReportMarkdown(input: RetrievalLatencyReportInput): string {
  const topK = requirePositiveInteger(input.topK, "topK");
  const caseCount = requirePositiveInteger(input.caseCount, "caseCount");
  const lines = [
    "# 검색 지연 시간 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    `retrieval eval case ${caseCount}개, top ${topK}.`,
    `Embedding model: \`${input.embeddingModel}\` (${input.embeddingDimensions} dimensions).`,
    "",
    "대상: public sample docs. 측정: embedding call과 PostgreSQL retrieval latency.",
    "Run context: `pnpm db:retrieval-latency-smoke`, public sample docs, 20 retrieval cases, local PostgreSQL connection, warm/cold cache split 없음.",
    "",
    "## 읽는 법",
    "",
    "- embedding cost와 database retrieval cost가 분리되어 보이는지 본다.",
    "",
    "| Mode | Samples | Min ms | P50 ms | P95 ms | Max ms | Total ms |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...input.observations.map(
      (observation) =>
        `| ${observation.mode} | ${observation.sampleCount} | ${formatMs(observation.minMs)} | ${formatMs(
          observation.p50Ms
        )} | ${formatMs(observation.p95Ms)} | ${formatMs(observation.maxMs)} | ${formatMs(
          observation.totalMs
        )} |`
    ),
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [
          "- 원문 입력은 latency table에 포함하지 않는다.",
          "- 현재 실행 환경의 변화 비교용 결과로 사용한다."
        ]),
    ""
  ];

  return lines.join("\n");
}

export function renderRetrievalConcurrencyReportMarkdown(input: RetrievalConcurrencyReportInput): string {
  const topK = requirePositiveInteger(input.topK, "topK");
  const caseCount = requirePositiveInteger(input.caseCount, "caseCount");
  const lines = [
    "# 검색 동시성 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    `retrieval eval case ${caseCount}개, top ${topK}.`,
    "",
    "대상: public sample docs. 측정: precomputed embedding 이후 PostgreSQL retrieval concurrency.",
    "embedding을 미리 계산한 뒤 database retrieval 구간만 측정한다.",
    "Run context: `pnpm db:retrieval-concurrency-smoke`, public sample docs, 20 retrieval cases, local PostgreSQL connection, concurrency 1/4.",
    "",
    "## 읽는 법",
    "",
    "- precomputed embedding 이후 database retrieval path의 pressure를 본다.",
    "",
    "| Mode | Concurrency | Query 수 | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | Error 수 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...input.observations.map(
      (observation) =>
        `| ${observation.mode} | ${observation.concurrency} | ${observation.queryCount} | ${formatMs(
          observation.minMs
        )} | ${formatMs(observation.p50Ms)} | ${formatMs(observation.p95Ms)} | ${formatMs(
          observation.p99Ms
        )} | ${formatMs(
          observation.maxMs
        )} | ${formatMs(observation.totalMs)} | ${observation.errorCount} |`
    ),
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [
          "- 원문 입력은 concurrency table에 포함하지 않는다.",
          "- 현재 실행 환경의 변화 비교용 결과로 사용한다."
        ]),
    ""
  ];

  return lines.join("\n");
}

export function nearestRankPercentile(sortedValues: readonly number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * percentile) - 1));
  return sortedValues[index] ?? 0;
}

export function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateScaleBudget(assumptions: ScaleBudgetAssumptions): ScaleBudgetEstimate {
  const documentCount = requirePositiveInteger(assumptions.documentCount, "documentCount");
  const averageChunksPerDocument = requirePositiveInteger(
    assumptions.averageChunksPerDocument,
    "averageChunksPerDocument"
  );
  const embeddingDimensions = requirePositiveInteger(assumptions.embeddingDimensions, "embeddingDimensions");
  const embeddingBytesPerDimension = requirePositiveInteger(
    assumptions.embeddingBytesPerDimension,
    "embeddingBytesPerDimension"
  );
  const metadataBytesPerChunk = requirePositiveInteger(assumptions.metadataBytesPerChunk, "metadataBytesPerChunk");
  const averageTraceBytes = requirePositiveInteger(assumptions.averageTraceBytes, "averageTraceBytes");
  const dailyQueryCount = requirePositiveInteger(assumptions.dailyQueryCount, "dailyQueryCount");
  const traceRetentionDays = requirePositiveInteger(assumptions.traceRetentionDays, "traceRetentionDays");
  const chunkCount = documentCount * averageChunksPerDocument;
  const vectorBytes = chunkCount * embeddingDimensions * embeddingBytesPerDimension;
  const metadataBytes = chunkCount * metadataBytesPerChunk;

  return {
    documentCount,
    chunkCount,
    vectorBytes,
    metadataBytes,
    vectorAndMetadataBytes: vectorBytes + metadataBytes,
    retainedTraceBytes: dailyQueryCount * averageTraceBytes * traceRetentionDays
  };
}

export function renderScaleBudgetReportMarkdown(input: ScaleBudgetReportInput): string {
  const estimate = estimateScaleBudget(input.assumptions);
  const lines = [
    "# Scale Budget 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    "Scale scenario를 explicit assumption으로 계산한 sizing math다.",
    "",
    "| Assumption | 값 |",
    "|---|---:|",
    `| documents | ${formatInteger(input.assumptions.documentCount)} |`,
    `| average chunks per document | ${formatInteger(input.assumptions.averageChunksPerDocument)} |`,
    `| embedding dimensions | ${formatInteger(input.assumptions.embeddingDimensions)} |`,
    `| embedding bytes per dimension | ${formatInteger(input.assumptions.embeddingBytesPerDimension)} |`,
    `| metadata bytes per chunk | ${formatInteger(input.assumptions.metadataBytesPerChunk)} |`,
    `| average sanitized trace bytes | ${formatInteger(input.assumptions.averageTraceBytes)} |`,
    `| daily queries | ${formatInteger(input.assumptions.dailyQueryCount)} |`,
    `| trace retention days | ${formatInteger(input.assumptions.traceRetentionDays)} |`,
    "",
    "| Estimate | 값 |",
    "|---|---:|",
    `| documents | ${formatInteger(estimate.documentCount)} |`,
    `| chunks | ${formatInteger(estimate.chunkCount)} |`,
    `| vector storage | ${formatBytesAsGb(estimate.vectorBytes)} |`,
    `| chunk metadata | ${formatBytesAsGb(estimate.metadataBytes)} |`,
    `| vector + chunk metadata | ${formatBytesAsGb(estimate.vectorAndMetadataBytes)} |`,
    `| retained sanitized traces | ${formatBytesAsGb(estimate.retainedTraceBytes)} |`,
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [
          "- 이 추정치는 decimal GB이며 index overhead, WAL, replica, backup, vacuum bloat를 제외한다.",
          "- bottleneck 논의와 후속 측정 범위를 정하기 위한 값이다."
        ]),
    ""
  ];

  return lines.join("\n");
}

export function estimateVectorIndexBudget(assumptions: VectorIndexBudgetAssumptions): VectorIndexBudgetEstimate {
  const documentCount = requirePositiveInteger(assumptions.documentCount, "documentCount");
  const averageChunksPerDocument = requirePositiveInteger(
    assumptions.averageChunksPerDocument,
    "averageChunksPerDocument"
  );
  const embeddingDimensions = requirePositiveInteger(assumptions.embeddingDimensions, "embeddingDimensions");
  const embeddingBytesPerDimension = requirePositiveInteger(
    assumptions.embeddingBytesPerDimension,
    "embeddingBytesPerDimension"
  );
  const metadataBytesPerChunk = requirePositiveInteger(assumptions.metadataBytesPerChunk, "metadataBytesPerChunk");
  const hnswM = requirePositiveInteger(assumptions.hnswM, "hnswM");
  const hnswLayerMultiplier = requirePositiveNumber(assumptions.hnswLayerMultiplier, "hnswLayerMultiplier");
  const hnswGraphBytesPerNeighbor = requirePositiveInteger(
    assumptions.hnswGraphBytesPerNeighbor,
    "hnswGraphBytesPerNeighbor"
  );
  const hnswBuildMemoryMultiplier = requirePositiveNumber(
    assumptions.hnswBuildMemoryMultiplier,
    "hnswBuildMemoryMultiplier"
  );
  const chunkCount = documentCount * averageChunksPerDocument;
  const vectorBytes = chunkCount * embeddingDimensions * embeddingBytesPerDimension;
  const metadataBytes = chunkCount * metadataBytesPerChunk;
  const hnswGraphBytes = chunkCount * hnswM * hnswLayerMultiplier * hnswGraphBytesPerNeighbor;
  const hnswServingBytes = vectorBytes + metadataBytes + hnswGraphBytes;

  return {
    documentCount,
    chunkCount,
    vectorBytes,
    metadataBytes,
    hnswGraphBytes,
    hnswServingBytes,
    hnswBuildWorkingSetBytes: hnswServingBytes * hnswBuildMemoryMultiplier,
    graphOverVectorRate: roundRate(hnswGraphBytes / vectorBytes)
  };
}

export function renderVectorIndexBudgetReportMarkdown(input: VectorIndexBudgetReportInput): string {
  const estimate = estimateVectorIndexBudget(input.assumptions);
  const lines = [
    "# Vector Index Budget 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    `요약: ${formatInteger(estimate.documentCount)} docs / ${formatInteger(estimate.chunkCount)} chunks 기준 serving set ${formatBytesAsGb(
      estimate.hnswServingBytes
    )}, build working set ${formatBytesAsGb(estimate.hnswBuildWorkingSetBytes)} 추정.`,
    "Scope: sizing math다. measured PostgreSQL 또는 pgvector index size가 아니며 large index build는 실행하지 않았다.",
    "",
    "| Assumption | 값 |",
    "|---|---:|",
    `| documents | ${formatInteger(input.assumptions.documentCount)} |`,
    `| average chunks per document | ${formatInteger(input.assumptions.averageChunksPerDocument)} |`,
    `| embedding dimensions | ${formatInteger(input.assumptions.embeddingDimensions)} |`,
    `| embedding bytes per dimension | ${formatInteger(input.assumptions.embeddingBytesPerDimension)} |`,
    `| metadata bytes per chunk | ${formatInteger(input.assumptions.metadataBytesPerChunk)} |`,
    `| HNSW m | ${formatInteger(input.assumptions.hnswM)} |`,
    `| HNSW layer multiplier | ${input.assumptions.hnswLayerMultiplier.toFixed(2)} |`,
    `| HNSW graph bytes per neighbor | ${formatInteger(input.assumptions.hnswGraphBytesPerNeighbor)} |`,
    `| HNSW build memory multiplier | ${input.assumptions.hnswBuildMemoryMultiplier.toFixed(2)} |`,
    "",
    "| Estimate | 값 |",
    "|---|---:|",
    `| chunks | ${formatInteger(estimate.chunkCount)} |`,
    `| raw vector payload | ${formatBytesAsGb(estimate.vectorBytes)} |`,
    `| chunk metadata | ${formatBytesAsGb(estimate.metadataBytes)} |`,
    `| HNSW graph estimate | ${formatBytesAsGb(estimate.hnswGraphBytes)} |`,
    `| vector + metadata + HNSW graph | ${formatBytesAsGb(estimate.hnswServingBytes)} |`,
    `| HNSW build working set estimate | ${formatBytesAsGb(estimate.hnswBuildWorkingSetBytes)} |`,
    `| graph overhead vs vector payload | ${formatRatioPercent(estimate.graphOverVectorRate)} |`,
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [
          "- HNSW graph math는 explicit scenario이며 measured pgvector index size가 아니다.",
          "- 이 report는 memory pressure와 필요한 production load testing 논의용이다."
        ]),
    ""
  ];

  return lines.join("\n");
}

function evaluateFixture(fixture: EvalFixture, observation: EvalObservation | undefined): EvalReportItem {
  if (!observation) {
    return {
      id: fixture.id,
      source: "missing",
      passed: false,
      notes: ["관측값 없음"]
    };
  }

  const checks = [
    checkExpectedRelevantDocs(fixture, observation),
    checkExpectedRejectedDocs(fixture, observation),
    checkRequiredCitations(fixture, observation),
    checkExpectedBehavior(fixture, observation)
  ].filter((note): note is string => Boolean(note));

  return {
    id: fixture.id,
    source: observation.observationSource ?? "static-fixture",
    passed: checks.length === 0,
    notes: checks.length === 0 ? ["정상"] : checks
  };
}

function evaluateRankedRetrievalCase(
  k: number,
  testCase: RankedRetrievalCase,
  observation: RankedRetrievalObservation | undefined
): RankedRetrievalReportItem {
  if (!observation) {
    return {
      id: testCase.id,
      passed: false,
      reciprocalRank: 0,
      ...(testCase.category ? { category: testCase.category } : {}),
      notes: ["관측값 없음"]
    };
  }

  const topKDocIds = observation.rankedDocIds.slice(0, k);
  const firstRelevantIndex = topKDocIds.findIndex((docId) => testCase.expectedRelevantDocIds.includes(docId));

  if (firstRelevantIndex === -1) {
    return {
      id: testCase.id,
      passed: false,
      reciprocalRank: 0,
      ...(testCase.category ? { category: testCase.category } : {}),
      notes: [`top ${k} 안에 relevant doc 없음: ${testCase.expectedRelevantDocIds.join(", ")}`]
    };
  }

  const rank = firstRelevantIndex + 1;
  const matchedDocId = topKDocIds[firstRelevantIndex];
  return {
    id: testCase.id,
    passed: true,
    reciprocalRank: roundRate(1 / rank),
    ...(testCase.category ? { category: testCase.category } : {}),
    matchedDocId,
    notes: [`첫 relevant doc rank ${rank}`]
  };
}

function buildRetrievalModeCategoryRows(modes: RetrievalModeReport[]): string[] {
  return modes.flatMap(({ mode, report }) => {
    const itemsByCategory = new Map<string, RankedRetrievalReportItem[]>();
    for (const item of report.items) {
      if (!item.category) {
        continue;
      }
      const items = itemsByCategory.get(item.category) ?? [];
      items.push(item);
      itemsByCategory.set(item.category, items);
    }

    return [...itemsByCategory.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, items]) => {
        const passed = items.filter((item) => item.passed).length;
        const total = items.length;
        const rate = total === 0 ? 1 : roundRate(passed / total);
        const mrr = total === 0 ? 0 : roundRate(items.reduce((sum, item) => sum + item.reciprocalRank, 0) / total);
        return `| ${category} | ${mode} | ${passed}/${total} | ${formatPercent(rate)} | ${mrr.toFixed(3)} |`;
      });
  });
}

function buildRetrievalModeNotableOutcomes(modes: RetrievalModeReport[]): string[] {
  const byMode = new Map(modes.map((item) => [item.mode, item.report]));
  const lexical = byMode.get("lexical");
  const vector = byMode.get("vector");
  const hybrid = byMode.get("hybrid");
  const outcomes: string[] = [];

  if (lexical) {
    outcomes.push(
      `lexical은 recall@3 ${lexical.metrics.recallAtK.passed}/${lexical.metrics.recallAtK.total}, MRR ${lexical.metrics.meanReciprocalRank.toFixed(
        3
      )}로 exact-token signal을 확인한다.`
    );
  }
  if (vector) {
    outcomes.push(
      `vector는 recall@3 ${vector.metrics.recallAtK.passed}/${vector.metrics.recallAtK.total}, MRR ${vector.metrics.meanReciprocalRank.toFixed(
        3
      )}로 semantic baseline을 확인한다.`
    );
  }
  if (hybrid) {
    outcomes.push(
      `hybrid는 recall@3 ${hybrid.metrics.recallAtK.passed}/${hybrid.metrics.recallAtK.total}, MRR ${hybrid.metrics.meanReciprocalRank.toFixed(
        3
      )}로 rank fusion 결과를 확인한다.`
    );
  }

  return outcomes;
}

function checkExpectedRelevantDocs(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  const missing = fixture.expectedRelevantDocs.filter((docId) => !observation.retrievedDocIds.includes(docId));
  return missing.length > 0 ? `relevant doc 누락: ${missing.join(", ")}` : undefined;
}

function checkExpectedRejectedDocs(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  const missing = fixture.expectedRejectedDocs.filter((docId) => !observation.rejectedDocIds.includes(docId));
  return missing.length > 0 ? `rejected doc 누락: ${missing.join(", ")}` : undefined;
}

function checkRequiredCitations(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  const missing = fixture.requiredCitations.filter((chunkId) => !observation.citationChunkIds.includes(chunkId));
  return missing.length > 0 ? `citation 누락: ${missing.join(", ")}` : undefined;
}

function checkExpectedBehavior(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  switch (fixture.expectedBehavior) {
    case "conflict":
      return observation.finalStatus === "conflict" ? undefined : "conflict status 필요";
    case "reject":
      return observation.finalStatus === "rejected" ? undefined : "rejected status 필요";
    case "trace":
      return observation.traceComplete ? undefined : "complete trace 필요";
    case "validate":
      return observation.unsupportedClaimRejected || fixture.expectedRejectedDocs.length === 0
        ? undefined
        : "unsupported claim rejection 필요";
    case "cite":
      return fixture.requiredCitations.length === 0 || observation.citationChunkIds.length > 0
        ? undefined
        : "citation coverage 필요";
    case "demote":
    case "retrieve":
      return undefined;
  }
}

function buildMetric(
  fixtures: EvalFixture[],
  observations: EvalObservation[],
  include: (fixture: EvalFixture) => boolean,
  pass: (fixture: EvalFixture, observation: EvalObservation) => boolean
): RateMetric {
  const observationByFixtureId = new Map(observations.map((observation) => [observation.fixtureId, observation]));
  const measuredFixtures = fixtures.filter(include);
  const passed = measuredFixtures.filter((fixture) => {
    const observation = observationByFixtureId.get(fixture.id);
    return observation ? pass(fixture, observation) : false;
  }).length;

  return {
    passed,
    total: measuredFixtures.length,
    rate: measuredFixtures.length === 0 ? 1 : roundRate(passed / measuredFixtures.length)
  };
}

function shouldMeasureRecall(fixture: EvalFixture): boolean {
  return fixture.expectedRelevantDocs.length > 0;
}

function hasExpectedRelevantDocs(fixture: EvalFixture, observation: EvalObservation): boolean {
  return fixture.expectedRelevantDocs.every((docId) => observation.retrievedDocIds.includes(docId));
}

function shouldMeasureCitationCoverage(fixture: EvalFixture): boolean {
  return fixture.requiredCitations.length > 0;
}

function hasRequiredCitations(fixture: EvalFixture, observation: EvalObservation): boolean {
  return fixture.requiredCitations.every((chunkId) => observation.citationChunkIds.includes(chunkId));
}

function shouldMeasureUnsupportedClaimRejection(fixture: EvalFixture): boolean {
  return (
    fixture.expectedBehavior === "reject" ||
    fixture.expectedRejectedDocs.some((docId) => docId.includes("unsupported"))
  );
}

function hasExpectedUnsupportedClaimRejection(fixture: EvalFixture, observation: EvalObservation): boolean {
  if (fixture.expectedBehavior === "reject") {
    return observation.finalStatus === "rejected";
  }
  return observation.unsupportedClaimRejected;
}

function metricRow(label: string, metric: RateMetric): string {
  return `| ${label} | ${metric.passed}/${metric.total} | ${formatPercent(metric.rate)} |`;
}

function providerLiveVerificationRow(provider: ProviderComparisonItem): string {
  const verification = provider.liveVerification;
  return `| ${provider.provider} | ${provider.role} | ${provider.requestSurface} | ${provider.setup} | ${formatProviderLiveVerificationStatus(
    verification.status
  )} | ${verification.command} | ${"reason" in verification ? verification.reason : "-"} |`;
}

function formatProviderLiveVerificationStatus(status: ProviderLiveVerification["status"]): string {
  switch (status) {
    case "separate-command":
      return "별도 실행 필요";
    case "not-run":
      return "미실행";
    case "not-applicable":
      return "해당 없음";
  }
}

function formatPassFail(passed: boolean): string {
  return passed ? "통과" : "실패";
}

function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatRatioPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatMs(value: number): string {
  return roundMilliseconds(value).toFixed(2);
}

function formatInteger(value: number): string {
  return value.toLocaleString("en-US");
}

function formatBytesAsGb(value: number): string {
  return `${(value / 1_000_000_000).toFixed(2)} GB`;
}

function requirePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

function requirePositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return value;
}
