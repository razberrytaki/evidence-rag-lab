import type { RetrievalResult } from "@evidencerag/domain";
export * from "./postgres";

export interface HybridRetrievalOptions {
  topK: number;
  reciprocalRankK: number;
}

export interface QueryEvidenceRerankInput {
  query: string;
  candidates: RetrievalResult[];
  topK: number;
}

export interface TokenizeTextOptions {
  stopWords?: ReadonlySet<string> | readonly string[];
}

const RERANK_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "by",
  "can",
  "describe",
  "describes",
  "does",
  "for",
  "how",
  "is",
  "it",
  "note",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "which",
  "why",
  "with"
]);

export function reciprocalRankFusion(results: RetrievalResult[], options: HybridRetrievalOptions): RetrievalResult[] {
  const k = options.reciprocalRankK;
  return [...results]
    .map((result) => ({
      ...result,
      score: {
        ...result.score,
        retrievalScore:
          1 / (k + (result.score.lexicalRank ?? options.topK + 1)) +
          1 / (k + (result.score.vectorRank ?? options.topK + 1))
      }
    }))
    .sort((left, right) => right.score.retrievalScore - left.score.retrievalScore)
    .slice(0, options.topK);
}

export function rerankByQueryEvidence(input: QueryEvidenceRerankInput): RetrievalResult[] {
  const topK = requirePositiveInteger(input.topK, "topK");
  const queryTokens = tokenizeForRerank(input.query);

  return input.candidates
    .map((candidate) => {
      const rerankScore = computeRerankScore(queryTokens, candidate);
      return {
        ...candidate,
        score: {
          ...candidate.score,
          rerankScore
        }
      };
    })
    .sort(compareRerankedCandidates)
    .slice(0, topK)
    .map((candidate, index) => ({
      ...candidate,
      score: {
        ...candidate.score,
        rerankRank: index + 1
      }
    }));
}

function computeRerankScore(queryTokens: readonly string[], candidate: RetrievalResult): number {
  if (queryTokens.length === 0) {
    return roundScore(candidate.score.retrievalScore * candidate.score.trustScore);
  }

  const candidateTokens = new Set(
    tokenizeForRerank(
      `${candidate.chunk.documentId} ${candidate.chunk.headingPath.join(" ")} ${candidate.chunk.text} ${
        candidate.parentContext?.text ?? ""
      }`
    )
  );
  const matched = queryTokens.filter((token) => candidateTokens.has(token)).length;
  const evidenceCoverage = matched / queryTokens.length;
  const rankPrior = Math.min(Math.max(candidate.score.retrievalScore, 0), 1);

  return roundScore((evidenceCoverage * 0.85 + rankPrior * 0.15) * candidate.score.trustScore);
}

function compareRerankedCandidates(left: RetrievalResult, right: RetrievalResult): number {
  return (
    (right.score.rerankScore ?? 0) - (left.score.rerankScore ?? 0) ||
    right.score.trustScore - left.score.trustScore ||
    right.score.retrievalScore - left.score.retrievalScore ||
    left.chunk.id.localeCompare(right.chunk.id)
  );
}

function tokenizeForRerank(input: string): string[] {
  return tokenizeText(input, { stopWords: RERANK_STOP_WORDS });
}

export function tokenizeText(input: string, options: TokenizeTextOptions = {}): string[] {
  const stopWords = options.stopWords ? new Set(options.stopWords) : undefined;
  return (input.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((token) => (token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token))
    .filter((token) => token.length > 1)
    .filter((token) => !stopWords?.has(token));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function requirePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}
