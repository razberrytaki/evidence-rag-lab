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
    "정적 평가 사례와 샘플 실행 관측을 합쳐 생성한다.",
    "현재 샘플 실행 관측은 근거 부족 계열의 거절 동작을 우선 검증한다.",
    "",
    `요약: ${report.summary.passed}/${report.summary.total} 평가 사례 통과. 샘플 실행 관측 ${sampleRuntimeCount}건, 정적 평가 사례 ${staticFixtureCount}건.`,
    "",
    "## 읽는 법",
    "",
    "- 통과 수보다 어떤 보호 장치가 샘플 실행 관측으로 확인됐는지 먼저 본다.",
    "",
    "| 지표 | 결과 | 비율 |",
    "|---|---:|---:|",
    metricRow("recall@k", report.metrics.recallAtK),
    metricRow("인용 범위", report.metrics.citationCoverage),
    metricRow("지원되지 않는 주장 거절", report.metrics.unsupportedClaimRejection),
    metricRow("추적 기록 완성도", report.metrics.traceCompleteness),
    "",
    "| 관측 출처 | 개수 |",
    "|---|---:|",
    ...report.observationSources.map((item) => `| ${item.source} | ${item.count} |`),
    "",
    "| 평가 사례 | 관측 출처 | 상태 | 메모 |",
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
    "대상: 공개 샘플 문서. 경로: 실제 PostgreSQL + pgvector 순위 검색.",
    "",
    `요약: ${report.summary.passed}/${report.summary.total} 순위 검색 사례 통과.`,
    "",
    "## 주요 결과",
    "",
    `- hybrid 검색 recall@3 ${report.metrics.recallAtK.passed}/${report.metrics.recallAtK.total}, MRR ${report.metrics.meanReciprocalRank.toFixed(3)}.`,
    "- 사례 표는 통과 여부보다 어떤 문서가 몇 번째 순위에 들어왔는지 확인하는 근거다.",
    "",
    "## 읽는 법",
    "",
    "- 절대 점수보다 기대 문서가 top 3 안에 들어왔는지와 순위 위치를 본다.",
    "",
    "| 지표 | 결과 | 비율 |",
    "|---|---:|---:|",
    metricRow("recall@3", report.metrics.recallAtK),
    `| MRR | ${report.metrics.meanReciprocalRank.toFixed(3)} | |`,
    "",
    "| 사례 | 상태 | 매칭 문서 | 역순위 | 메모 |",
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
    "대상: 공개 샘플 문서. 경로: 실제 PostgreSQL 검색 모드 비교.",
    "목적: 키워드, 벡터, hybrid 검색 모드의 절충 확인.",
    "",
    "## 읽는 법",
    "",
    "- 모드별 승패보다 키워드, 벡터, hybrid가 어느 범주에서 차이 나는지 본다.",
    "",
    ...(notableOutcomes.length > 0 ? ["## 주요 결과", "", ...notableOutcomes.map((note) => `- ${note}`), ""] : []),
    "| 모드 | Recall | 비율 | MRR |",
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
          "| 범주 | 모드 | Recall | 비율 | MRR |",
          "|---|---|---:|---:|---:|",
          ...categoryRows,
          ""
        ]
      : []),
    "| 사례 | 모드 | 범주 | 상태 | 매칭 문서 | 역순위 | 메모 |",
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
      : [`- Recall은 top ${k} 기준으로 측정한다.`, "- Hybrid는 측정된 검색 동작으로 계속 정당화되어야 한다."]),
    ""
  ];

  return lines.join("\n");
}

export function renderProviderComparisonReportMarkdown(input: ProviderComparisonReportInput): string {
  const lines = [
    "# LLM 제공자 비교 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    "",
    "검증 범위: 결정적 어댑터 계약. 실제 생성 확인은 별도 명령 결과로 추적한다.",
    "",
    "## 읽는 법",
    "",
    "- 어댑터 계약과 실제 검증 경계를 분리해서 본다.",
    "",
    "| LLM 제공자 | 역할 | 요청 경로 | 생성 환경값 | 실제 검증 | 명령 | 이유 |",
    "|---|---|---|---|---|---|---|",
    ...input.providers.map(providerLiveVerificationRow),
    "",
    "| LLM 제공자 | 결정적 확인 | 절충 |",
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
          "- LLM 제공자 비교는 명시적이므로 설정 오류가 자동 대체 뒤에 숨지 않는다."
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
    `검색 평가 사례 ${caseCount}개, top ${topK}.`,
    `임베딩 모델: \`${input.embeddingModel}\` (${input.embeddingDimensions}차원).`,
    "",
    "대상: 공개 샘플 문서. 측정: 임베딩 호출과 PostgreSQL 검색 지연 시간.",
    "실행 맥락: `pnpm db:retrieval-latency-smoke`, 공개 샘플 문서, 20개 검색 사례, 로컬 PostgreSQL 연결, warm/cold 캐시 분리 없음.",
    "",
    "## 읽는 법",
    "",
    "- 임베딩 비용과 데이터베이스 검색 비용이 분리되어 보이는지 본다.",
    "",
    "| 모드 | 샘플 | Min ms | P50 ms | P95 ms | Max ms | Total ms |",
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
          "- 원문 입력은 지연 시간 표에 포함하지 않는다.",
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
    `검색 평가 사례 ${caseCount}개, top ${topK}.`,
    "",
    "대상: 공개 샘플 문서. 측정: 미리 계산한 임베딩 이후 PostgreSQL 검색 동시성.",
    "임베딩을 미리 계산한 뒤 데이터베이스 검색 구간만 측정한다.",
    "실행 맥락: `pnpm db:retrieval-concurrency-smoke`, 공개 샘플 문서, 20개 검색 사례, 로컬 PostgreSQL 연결, 동시성 1/4.",
    "",
    "## 읽는 법",
    "",
    "- 미리 계산한 임베딩 이후 데이터베이스 검색 경로의 압력을 본다.",
    "",
    "| 모드 | 동시성 | 질의 수 | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | 오류 수 |",
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
          "- 원문 입력은 동시성 표에 포함하지 않는다.",
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
    "# 확장성 예산 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    "확장성 검토 기준을 명시한 가정으로 계산한 용량 추정이다.",
    "",
    "| 가정 | 값 |",
    "|---|---:|",
    `| 문서 수 | ${formatInteger(input.assumptions.documentCount)} |`,
    `| 문서당 평균 청크 수 | ${formatInteger(input.assumptions.averageChunksPerDocument)} |`,
    `| 임베딩 차원 | ${formatInteger(input.assumptions.embeddingDimensions)} |`,
    `| 임베딩 차원당 바이트 | ${formatInteger(input.assumptions.embeddingBytesPerDimension)} |`,
    `| 청크 메타데이터 바이트 | ${formatInteger(input.assumptions.metadataBytesPerChunk)} |`,
    `| 정리된 추적 기록 평균 바이트 | ${formatInteger(input.assumptions.averageTraceBytes)} |`,
    `| 일일 질의 수 | ${formatInteger(input.assumptions.dailyQueryCount)} |`,
    `| 추적 기록 보관 일수 | ${formatInteger(input.assumptions.traceRetentionDays)} |`,
    "",
    "| 추정 | 값 |",
    "|---|---:|",
    `| 문서 수 | ${formatInteger(estimate.documentCount)} |`,
    `| 청크 수 | ${formatInteger(estimate.chunkCount)} |`,
    `| 벡터 저장량 | ${formatBytesAsGb(estimate.vectorBytes)} |`,
    `| 청크 메타데이터 | ${formatBytesAsGb(estimate.metadataBytes)} |`,
    `| 벡터 + 청크 메타데이터 | ${formatBytesAsGb(estimate.vectorAndMetadataBytes)} |`,
    `| 보관되는 정리 추적 기록 | ${formatBytesAsGb(estimate.retainedTraceBytes)} |`,
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [
          "- 이 추정치는 decimal GB이며 색인 부가 비용, WAL, 복제본, 백업, vacuum 팽창을 제외한다.",
          "- 병목 논의와 후속 측정 범위를 정하기 위한 값이다."
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
    "# 벡터 색인 예산 리포트",
    "",
    `생성일: ${input.generatedAt}.`,
    `요약: 문서 ${formatInteger(estimate.documentCount)}개 / 청크 ${formatInteger(estimate.chunkCount)}개 기준 제공 세트 ${formatBytesAsGb(
      estimate.hnswServingBytes
    )}, 빌드 작업 메모리 ${formatBytesAsGb(estimate.hnswBuildWorkingSetBytes)} 추정.`,
    "범위: 용량 추정이다. PostgreSQL 또는 pgvector 색인을 실측한 크기가 아니며 큰 색인 빌드는 실행하지 않았다.",
    "",
    "| 가정 | 값 |",
    "|---|---:|",
    `| 문서 수 | ${formatInteger(input.assumptions.documentCount)} |`,
    `| 문서당 평균 청크 수 | ${formatInteger(input.assumptions.averageChunksPerDocument)} |`,
    `| 임베딩 차원 | ${formatInteger(input.assumptions.embeddingDimensions)} |`,
    `| 임베딩 차원당 바이트 | ${formatInteger(input.assumptions.embeddingBytesPerDimension)} |`,
    `| 청크 메타데이터 바이트 | ${formatInteger(input.assumptions.metadataBytesPerChunk)} |`,
    `| HNSW m | ${formatInteger(input.assumptions.hnswM)} |`,
    `| HNSW 계층 배수 | ${input.assumptions.hnswLayerMultiplier.toFixed(2)} |`,
    `| HNSW 이웃당 그래프 바이트 | ${formatInteger(input.assumptions.hnswGraphBytesPerNeighbor)} |`,
    `| HNSW 빌드 메모리 배수 | ${input.assumptions.hnswBuildMemoryMultiplier.toFixed(2)} |`,
    "",
    "| 추정 | 값 |",
    "|---|---:|",
    `| 청크 수 | ${formatInteger(estimate.chunkCount)} |`,
    `| 원본 벡터 용량 | ${formatBytesAsGb(estimate.vectorBytes)} |`,
    `| 청크 메타데이터 | ${formatBytesAsGb(estimate.metadataBytes)} |`,
    `| HNSW 그래프 추정치 | ${formatBytesAsGb(estimate.hnswGraphBytes)} |`,
    `| 벡터 + 메타데이터 + HNSW 그래프 | ${formatBytesAsGb(estimate.hnswServingBytes)} |`,
    `| HNSW 빌드 작업 메모리 추정치 | ${formatBytesAsGb(estimate.hnswBuildWorkingSetBytes)} |`,
    `| 벡터 용량 대비 그래프 부가 비용 | ${formatRatioPercent(estimate.graphOverVectorRate)} |`,
    "",
    "## 메모",
    "",
    ...(input.notes && input.notes.length > 0
      ? input.notes.map((note) => `- ${note}`)
      : [
          "- HNSW 그래프 계산은 명시적 가정이며 pgvector 색인을 실측한 크기가 아니다.",
          "- 이 보고서는 메모리 압력과 필요한 운영 부하 시험 논의용이다."
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
      notes: [`top ${k} 안에 관련 문서 없음: ${testCase.expectedRelevantDocIds.join(", ")}`]
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
    notes: [`첫 관련 문서 순위 ${rank}`]
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
      `키워드 검색은 recall@3 ${lexical.metrics.recallAtK.passed}/${lexical.metrics.recallAtK.total}, MRR ${lexical.metrics.meanReciprocalRank.toFixed(
        3
      )}로 정확 토큰 신호를 확인한다.`
    );
  }
  if (vector) {
    outcomes.push(
      `벡터 검색은 recall@3 ${vector.metrics.recallAtK.passed}/${vector.metrics.recallAtK.total}, MRR ${vector.metrics.meanReciprocalRank.toFixed(
        3
      )}로 의미 검색 기준선을 확인한다.`
    );
  }
  if (hybrid) {
    outcomes.push(
      `hybrid는 recall@3 ${hybrid.metrics.recallAtK.passed}/${hybrid.metrics.recallAtK.total}, MRR ${hybrid.metrics.meanReciprocalRank.toFixed(
        3
      )}로 순위 결합 결과를 확인한다.`
    );
  }

  return outcomes;
}

function checkExpectedRelevantDocs(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  const missing = fixture.expectedRelevantDocs.filter((docId) => !observation.retrievedDocIds.includes(docId));
  return missing.length > 0 ? `관련 문서 누락: ${missing.join(", ")}` : undefined;
}

function checkExpectedRejectedDocs(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  const missing = fixture.expectedRejectedDocs.filter((docId) => !observation.rejectedDocIds.includes(docId));
  return missing.length > 0 ? `거절 문서 누락: ${missing.join(", ")}` : undefined;
}

function checkRequiredCitations(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  const missing = fixture.requiredCitations.filter((chunkId) => !observation.citationChunkIds.includes(chunkId));
  return missing.length > 0 ? `인용 누락: ${missing.join(", ")}` : undefined;
}

function checkExpectedBehavior(fixture: EvalFixture, observation: EvalObservation): string | undefined {
  switch (fixture.expectedBehavior) {
    case "conflict":
      return observation.finalStatus === "conflict" ? undefined : "conflict 상태 필요";
    case "reject":
      return observation.finalStatus === "rejected" ? undefined : "rejected 상태 필요";
    case "trace":
      return observation.traceComplete ? undefined : "완전한 추적 기록 필요";
    case "validate":
      return observation.unsupportedClaimRejected || fixture.expectedRejectedDocs.length === 0
        ? undefined
        : "지원되지 않는 주장 거절 필요";
    case "cite":
      return fixture.requiredCitations.length === 0 || observation.citationChunkIds.length > 0
        ? undefined
        : "인용 범위 필요";
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
