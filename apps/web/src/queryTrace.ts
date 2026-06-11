export interface PublicScoreBreakdown {
  lexicalRank?: number;
  vectorRank?: number;
  fusedRank?: number;
  rerankRank?: number;
  rerankScore?: number;
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

export interface LoadedTrace {
  source: "api" | "sample";
  trace: PublicQueryTrace;
}

type TraceFetch = (input: string) => Promise<{
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
        retrievalScore: 0.99,
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
        retrievalScore: 0.89,
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
        retrievalScore: 0.79,
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

    const trace = (await response.json()) as PublicQueryTrace | null;
    if (!trace) {
      return { source: "sample", trace: sampleTrace };
    }
    return { source: "api", trace };
  } catch {
    return { source: "sample", trace: sampleTrace };
  }
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
        ? `Rerank ${candidate.score.rerankRank}`
        : `Rank ${candidate.score.fusedRank ?? index + 1}`,
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
      citationCoverage: "0/0 cited",
      unsupportedClaimPolicy: trace.generation.reason,
      traceSanitize: String(trace.sanitized)
    };
  }

  const claimCount = trace.generation.claims.length;
  const citedClaimCount = trace.generation.claims.filter((claim) => claim.citations.length > 0).length;

  return {
    citationCoverage: `${citedClaimCount}/${claimCount} cited`,
    unsupportedClaimPolicy: "reject",
    traceSanitize: String(trace.sanitized)
  };
}

export function getConfiguredApiBaseUrl(): string {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return trimApiBaseUrl(viteEnv?.VITE_API_BASE_URL ?? "http://127.0.0.1:3000");
}

function trimApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

function formatRank(rank: number | undefined): string {
  return rank === undefined ? "-" : String(rank);
}

function buildScoreLabel(score: PublicScoreBreakdown): string {
  const rerank = score.rerankScore === undefined ? "" : ` / rerank ${score.rerankScore.toFixed(3)}`;
  return `lex ${formatRank(score.lexicalRank)} / vec ${formatRank(score.vectorRank)}${rerank} / trust ${score.trustScore.toFixed(2)}`;
}
