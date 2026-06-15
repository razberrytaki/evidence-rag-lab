export interface PublicScoreBreakdown {
  lexicalRank?: number;
  vectorRank?: number;
  fusedRank?: number;
  rerankRank?: number;
  rerankScore?: number;
  answerGateScore?: number;
  retrievalScore: number;
  trustScore: number;
  freshnessScore: number;
  duplicatePenalty: number;
}

export interface PublicQueryTraceCandidate {
  chunkId: string;
  documentId: string;
  headingPath: string[];
  score: PublicScoreBreakdown;
}

export interface PublicQueryTrace {
  id: string;
  query: string;
  normalizedQuery: string;
  selectedChunkIds: string[];
  rejected: Array<{
    chunkId: string;
    reason: string;
  }>;
  candidates: PublicQueryTraceCandidate[];
  generation:
    | {
        status: "answered" | "conflict";
        claims: Array<{
          id: string;
          citations: Array<{
            documentId: string;
            chunkId: string;
          }>;
        }>;
      }
    | {
        status: "rejected";
        reason: string;
        message: string;
      };
  sanitized: boolean;
  createdAt: string;
}

export interface TraceRow {
  stage: string;
  candidate: string;
  score: string;
  decision: "selected" | "rejected" | "candidate";
}

export interface TraceSummary {
  citationCoverage: string;
  unsupportedClaimPolicy: string;
  traceSanitize: string;
}

export type QueryRunSummary =
  | {
      status: "answered" | "conflict";
      responseText: string;
      claimCount: number;
      citationCount: number;
      selectedChunkIds: string[];
    }
  | {
      status: "rejected";
      responseText: string;
      rejectionReason: string;
      claimCount: 0;
      citationCount: 0;
      selectedChunkIds: string[];
    };

export interface LoadedTrace {
  source: "api" | "sample";
  trace: PublicQueryTrace;
}

type TraceFetch = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

const inFlightLatestTraceRequests = new WeakMap<TraceFetch, Map<string, Promise<LoadedTrace>>>();

export const sampleTrace: PublicQueryTrace = {
  id: "sample-trace",
  query: "Why not rely only on semantic vectors?",
  normalizedQuery: "why not rely only on semantic vectors?",
  selectedChunkIds: ["hybrid-retrieval-note#chunk-001", "hybrid-retrieval-note#chunk-002"],
  rejected: [{ chunkId: "deployment-policy-v1#chunk-001", reason: "stale_source" }],
  candidates: [
    {
      chunkId: "hybrid-retrieval-note#chunk-001",
      documentId: "hybrid-retrieval-note",
      headingPath: ["Hybrid Retrieval Note"],
      score: {
        lexicalRank: 1,
        vectorRank: 2,
        fusedRank: 1,
        rerankRank: 1,
        rerankScore: 0.787,
        answerGateScore: 0.99,
        retrievalScore: 0.032,
        trustScore: 0.8,
        freshnessScore: 1,
        duplicatePenalty: 0
      }
    },
    {
      chunkId: "hybrid-retrieval-note#chunk-002",
      documentId: "hybrid-retrieval-note",
      headingPath: ["Hybrid Retrieval Note"],
      score: {
        lexicalRank: 3,
        vectorRank: 1,
        fusedRank: 2,
        rerankRank: 2,
        rerankScore: 0.672,
        answerGateScore: 0.89,
        retrievalScore: 0.031,
        trustScore: 0.8,
        freshnessScore: 1,
        duplicatePenalty: 0
      }
    },
    {
      chunkId: "deployment-policy-v1#chunk-001",
      documentId: "deployment-policy-v1",
      headingPath: ["Deployment Policy v1"],
      score: {
        lexicalRank: 2,
        fusedRank: 3,
        rerankRank: 3,
        rerankScore: 0.291,
        answerGateScore: 0.79,
        retrievalScore: 0.016,
        trustScore: 0.3,
        freshnessScore: 0.3,
        duplicatePenalty: 0
      }
    }
  ],
  generation: {
    status: "answered",
    claims: [
      {
        id: "claim-1",
        citations: [
          {
            documentId: "hybrid-retrieval-note",
            chunkId: "hybrid-retrieval-note#chunk-001"
          }
        ]
      }
    ]
  },
  sanitized: true,
  createdAt: "2026-06-11T00:00:00.000Z"
};

export async function fetchLatestTrace(
  apiBaseUrl: string,
  fetcher: TraceFetch = globalThis.fetch
): Promise<LoadedTrace> {
  try {
    const response = await fetcher(`${trimApiBaseUrl(apiBaseUrl)}/query-traces/latest`);
    if (!response.ok) {
      return { source: "sample", trace: sampleTrace };
    }

    const trace = await response.json();
    if (!isPublicQueryTrace(trace)) {
      return { source: "sample", trace: sampleTrace };
    }
    return { source: "api", trace };
  } catch {
    return { source: "sample", trace: sampleTrace };
  }
}

export async function runQuery(
  apiBaseUrl: string,
  question: string,
  fetcher: TraceFetch = globalThis.fetch
): Promise<QueryRunSummary> {
  const trimmedQuestion = question.trim();
  if (trimmedQuestion === "") {
    throw new Error("질의를 입력해야 합니다");
  }

  const response = await fetcher(`${trimApiBaseUrl(apiBaseUrl)}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: trimmedQuestion })
  });
  if (!response.ok) {
    throw new Error("질의 요청 실패");
  }

  const summary = toQueryRunSummary(await response.json());
  if (!summary) {
    throw new Error("질의 응답 형식이 올바르지 않습니다");
  }

  return summary;
}

export function fetchLatestTraceDeduped(
  apiBaseUrl: string,
  fetcher: TraceFetch = globalThis.fetch
): Promise<LoadedTrace> {
  const normalizedApiBaseUrl = trimApiBaseUrl(apiBaseUrl);
  let requestsByBaseUrl = inFlightLatestTraceRequests.get(fetcher);

  if (!requestsByBaseUrl) {
    requestsByBaseUrl = new Map<string, Promise<LoadedTrace>>();
    inFlightLatestTraceRequests.set(fetcher, requestsByBaseUrl);
  }

  const inFlightRequest = requestsByBaseUrl.get(normalizedApiBaseUrl);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = fetchLatestTrace(normalizedApiBaseUrl, fetcher).finally(() => {
    requestsByBaseUrl.delete(normalizedApiBaseUrl);
    if (requestsByBaseUrl.size === 0) {
      inFlightLatestTraceRequests.delete(fetcher);
    }
  });

  requestsByBaseUrl.set(normalizedApiBaseUrl, request);
  return request;
}

export function buildTraceRows(trace: PublicQueryTrace): TraceRow[] {
  const selectedChunkIds = new Set(trace.selectedChunkIds);
  const rejectedChunkIds = new Set(trace.rejected.map((rejection) => rejection.chunkId));

  return trace.candidates.map((candidate, index) => ({
    stage:
      candidate.score.rerankRank !== undefined
        ? `재순위 ${candidate.score.rerankRank}`
        : `순위 ${candidate.score.fusedRank ?? index + 1}`,
    candidate: candidate.chunkId,
    score: buildScoreLabel(candidate.score),
    decision: rejectedChunkIds.has(candidate.chunkId)
      ? "rejected"
      : selectedChunkIds.has(candidate.chunkId)
        ? "selected"
        : "candidate"
  }));
}

export function summarizeTrace(trace: PublicQueryTrace): TraceSummary {
  if (trace.generation.status === "rejected") {
    return {
      citationCoverage: "0/0 인용",
      unsupportedClaimPolicy: formatPolicyLabel(trace.generation.reason),
      traceSanitize: formatSanitizedLabel(trace.sanitized)
    };
  }

  const claimCount = trace.generation.claims.length;
  const citedClaimCount = trace.generation.claims.filter((claim) => claim.citations.length > 0).length;

  return {
    citationCoverage: `${citedClaimCount}/${claimCount} 인용`,
    unsupportedClaimPolicy: "거절",
    traceSanitize: formatSanitizedLabel(trace.sanitized)
  };
}

export function getConfiguredApiBaseUrl(): string {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return trimApiBaseUrl(viteEnv?.VITE_API_BASE_URL ?? "http://127.0.0.1:3000");
}

function trimApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

function isPublicQueryTrace(value: unknown): value is PublicQueryTrace {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.query === "string" &&
    typeof value.normalizedQuery === "string" &&
    isStringArray(value.selectedChunkIds) &&
    Array.isArray(value.rejected) &&
    value.rejected.every(isTraceRejection) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isTraceCandidate) &&
    isTraceGeneration(value.generation) &&
    typeof value.sanitized === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function isTraceCandidate(value: unknown): value is PublicQueryTraceCandidate {
  return (
    isRecord(value) &&
    typeof value.chunkId === "string" &&
    typeof value.documentId === "string" &&
    isStringArray(value.headingPath) &&
    isScoreBreakdown(value.score)
  );
}

function isScoreBreakdown(value: unknown): value is PublicScoreBreakdown {
  return (
    isRecord(value) &&
    isOptionalNumber(value.lexicalRank) &&
    isOptionalNumber(value.vectorRank) &&
    isOptionalNumber(value.fusedRank) &&
    isOptionalNumber(value.rerankRank) &&
    isOptionalNumber(value.rerankScore) &&
    isOptionalNumber(value.answerGateScore) &&
    typeof value.retrievalScore === "number" &&
    typeof value.trustScore === "number" &&
    typeof value.freshnessScore === "number" &&
    typeof value.duplicatePenalty === "number"
  );
}

function isTraceRejection(value: unknown): value is PublicQueryTrace["rejected"][number] {
  return isRecord(value) && typeof value.chunkId === "string" && typeof value.reason === "string";
}

function isTraceGeneration(value: unknown): value is PublicQueryTrace["generation"] {
  if (!isRecord(value) || typeof value.status !== "string") {
    return false;
  }
  if (value.status === "rejected") {
    return typeof value.reason === "string" && typeof value.message === "string";
  }
  if (value.status === "answered" || value.status === "conflict") {
    return Array.isArray(value.claims);
  }
  return false;
}

function toQueryRunSummary(value: unknown): QueryRunSummary | null {
  if (!isRecord(value) || !isRecord(value.generation)) {
    return null;
  }

  const selectedChunkIds = readSelectedChunkIds(value);
  const generation = value.generation;

  if (generation.status === "rejected") {
    if (typeof generation.reason !== "string" || typeof generation.message !== "string") {
      return null;
    }
    return {
      status: "rejected",
      responseText: generation.message,
      rejectionReason: generation.reason,
      claimCount: 0,
      citationCount: 0,
      selectedChunkIds
    };
  }

  if ((generation.status === "answered" || generation.status === "conflict") && typeof generation.answer === "string" && Array.isArray(generation.claims)) {
    return {
      status: generation.status,
      responseText: generation.answer,
      claimCount: generation.claims.length,
      citationCount: generation.claims.reduce((count, claim) => count + citationCountForClaim(claim), 0),
      selectedChunkIds
    };
  }

  return null;
}

function readSelectedChunkIds(value: Record<string, unknown>): string[] {
  if (isRecord(value.trace) && isStringArray(value.trace.selectedChunkIds)) {
    return value.trace.selectedChunkIds;
  }

  if (!Array.isArray(value.selectedContext)) {
    return [];
  }

  return value.selectedContext
    .map((context) => (isRecord(context) && isRecord(context.chunk) && typeof context.chunk.id === "string" ? context.chunk.id : null))
    .filter((chunkId): chunkId is string => chunkId !== null);
}

function citationCountForClaim(value: unknown): number {
  if (!isRecord(value) || !Array.isArray(value.citations)) {
    return 0;
  }
  return value.citations.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

function formatRank(rank: number | undefined): string {
  return rank === undefined ? "-" : String(rank);
}

function buildScoreLabel(score: PublicScoreBreakdown): string {
  const rerank = score.rerankScore === undefined ? "" : ` / 재순위 ${score.rerankScore.toFixed(3)}`;
  const gate = score.answerGateScore === undefined ? "" : ` / 답변 ${score.answerGateScore.toFixed(2)}`;
  return `키워드 ${formatRank(score.lexicalRank)} / 벡터 ${formatRank(score.vectorRank)}${rerank}${gate} / 신뢰 ${score.trustScore.toFixed(2)}`;
}

function formatPolicyLabel(reason: string): string {
  if (reason === "insufficient_evidence") {
    return "근거 부족";
  }
  if (reason === "unsupported_claim") {
    return "주장 근거 없음";
  }
  return reason;
}

function formatSanitizedLabel(sanitized: boolean): string {
  return sanitized ? "정리됨" : "원문 포함";
}
