export type SourceType = "public-doc" | "synthetic-conflict" | "synthetic-stale";

export type RejectReason =
  | "insufficient_evidence"
  | "low_retrieval_confidence"
  | "citation_validation_failed"
  | "unsupported_claim"
  | "provider_setup_required";

export interface SourceDocument {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
  version?: string;
  publishedAt?: string;
  licenseNote: string;
}

export interface ParentContext {
  documentId: string;
  headingPath: string[];
  text: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  parentId?: string;
  headingPath: string[];
  text: string;
  contentHash: string;
  version: string;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  sourceUrl?: string;
  quote: string;
}

export interface Claim {
  id: string;
  text: string;
  citations: Citation[];
}

export interface ScoreBreakdown {
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

export interface RetrievalResult {
  chunk: DocumentChunk;
  parentContext?: ParentContext;
  score: ScoreBreakdown;
}

export interface GeneratedAnswer {
  status: "answered" | "conflict";
  answer: string;
  claims: Claim[];
}

export interface GenerationRejected {
  status: "rejected";
  reason: RejectReason;
  message: string;
}

export type GenerationResult = GeneratedAnswer | GenerationRejected;

export interface InsufficientEvidence {
  reason: "insufficient_evidence";
  minimumRequiredConfidence: number;
  observedConfidence: number;
}

export interface QueryTrace {
  id: string;
  query: string;
  normalizedQuery: string;
  candidates: RetrievalResult[];
  selectedChunkIds: string[];
  rejected: Array<{
    chunkId: string;
    reason: string;
  }>;
  generation: GenerationResult;
}

export function isGenerationRejected(result: GenerationResult): result is GenerationRejected {
  return result.status === "rejected";
}

export function hasCitationCoverage(answer: GeneratedAnswer): boolean {
  return answer.claims.every((claim) => claim.citations.length > 0);
}
