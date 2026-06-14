import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  DocumentChunk,
  GenerationResult,
  QueryTrace,
  RetrievalResult,
  SourceDocument
} from "@evidencerag/domain";
import { FakeLLMProvider } from "@evidencerag/generation";
import { loadMarkdownDocumentSet, normalizeText } from "@evidencerag/ingest";
import { reciprocalRankFusion, tokenizeText } from "@evidencerag/retrieval";
import { computeTrustScore } from "@evidencerag/scoring";
import { makeDeterministicTraceId } from "./trace-id";

const STOP_WORDS = new Set([
  "a",
  "all",
  "an",
  "and",
  "be",
  "can",
  "do",
  "does",
  "for",
  "how",
  "is",
  "it",
  "not",
  "of",
  "on",
  "only",
  "or",
  "rely",
  "the",
  "to",
  "was",
  "what",
  "which",
  "why",
  "with"
]);

export interface RunSampleRagPipelineInput {
  question: string;
  sampleDocsDir: string;
}

export interface SampleRagPipelineResult {
  query: string;
  selectedContext: RetrievalResult[];
  generation: GenerationResult;
  trace: QueryTrace;
}

interface LoadedDocument {
  source: SourceDocument;
  chunk: DocumentChunk;
}

interface RankedCandidate {
  document: LoadedDocument;
  lexicalScore: number;
  vectorScore: number;
  lexicalRank?: number;
  vectorRank?: number;
}

export async function runSampleRagPipeline(input: RunSampleRagPipelineInput): Promise<SampleRagPipelineResult> {
  const normalizedQuery = normalizeText(input.question).toLowerCase();
  const documents = await loadSampleDocuments(input.sampleDocsDir);
  const candidates = rankCandidates(documents, normalizedQuery);
  const rejected = candidates
    .filter((candidate) => candidate.chunk.documentId === "deployment-policy-v1")
    .map((candidate) => ({
      chunkId: candidate.chunk.id,
      reason: "stale_source"
    }));
  const selectedContext = isContextBypassAttempt(normalizedQuery)
    ? []
    : candidates
        .filter((candidate) => candidate.score.retrievalScore >= 0.5)
        .filter((candidate) => candidate.score.trustScore >= 0.5)
        .filter((candidate) => !rejected.some((rejection) => rejection.chunkId === candidate.chunk.id))
        .slice(0, 3);

  const provider = new FakeLLMProvider();
  const generation = await provider.generateAnswer({
    question: input.question,
    selectedContext,
    citationPolicy: {
      requireCitationPerClaim: true,
      rejectUnsupportedClaims: true
    },
    modelConfig: {
      provider: "fake",
      model: "fake"
    }
  });
  const trace: QueryTrace = {
    id: makeDeterministicTraceId("trace", input.question),
    query: input.question,
    normalizedQuery,
    candidates,
    selectedChunkIds: selectedContext.map((result) => result.chunk.id),
    rejected,
    generation,
    sanitized: true
  };

  return {
    query: input.question,
    selectedContext,
    generation,
    trace
  };
}

export function findSampleDocsDir(startDir = process.cwd()): string {
  let current = startDir;

  while (true) {
    const candidate = join(current, "sample-docs");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`sample-docs directory was not found from ${startDir}`);
    }
    current = parent;
  }
}

async function loadSampleDocuments(sampleDocsDir: string): Promise<LoadedDocument[]> {
  return (await loadMarkdownDocumentSet(sampleDocsDir)).flatMap((document) =>
    document.chunks.map((chunk) => ({
      source: document.source,
      chunk: chunk.chunk
    }))
  );
}

function rankCandidates(documents: LoadedDocument[], normalizedQuery: string): RetrievalResult[] {
  const ranked = documents.map((document) => ({
    document,
    lexicalScore: lexicalScore(document, normalizedQuery),
    vectorScore: vectorScore(document, normalizedQuery)
  }));
  const lexicalRanks = makeRankMap(ranked, "lexicalScore");
  const vectorRanks = makeRankMap(ranked, "vectorScore");
  const candidateInputs = ranked
    .map((candidate) => ({
      ...candidate,
      lexicalRank: lexicalRanks.get(candidate.document.chunk.id),
      vectorRank: vectorRanks.get(candidate.document.chunk.id)
    }))
    .filter((candidate) => candidate.lexicalScore > 0 || candidate.vectorScore > 0);

  const retrievalResults = candidateInputs.map(toRetrievalResult);
  return reciprocalRankFusion(retrievalResults, {
    topK: 5,
    reciprocalRankK: 60
  }).map((result, index) => ({
    ...result,
    score: {
      ...result.score,
      fusedRank: index + 1,
      retrievalScore: calibratedRetrievalScore(candidateInputs, result.chunk.id)
    }
  }));
}

function makeRankMap(candidates: Array<Pick<RankedCandidate, "document" | "lexicalScore" | "vectorScore">>, key: "lexicalScore" | "vectorScore"): Map<string, number> {
  return new Map(
    candidates
      .filter((candidate) => candidate[key] > 0)
      .sort((left, right) => right[key] - left[key] || left.document.source.id.localeCompare(right.document.source.id))
      .map((candidate, index) => [candidate.document.chunk.id, index + 1])
  );
}

function toRetrievalResult(candidate: RankedCandidate): RetrievalResult {
  const retrievalAgreement = candidate.lexicalRank && candidate.vectorRank ? 1 : 0.4;
  const freshnessScore = candidate.document.source.sourceType === "synthetic-stale" ? 0.3 : 1;
  const baseTrustScore = computeTrustScore({
    source: candidate.document.source,
    duplicateCount: 0,
    retrievalAgreement
  });

  return {
    chunk: candidate.document.chunk,
    parentContext: {
      documentId: candidate.document.source.id,
      headingPath: candidate.document.chunk.headingPath,
      text: candidate.document.chunk.text
    },
    score: {
      lexicalRank: candidate.lexicalRank,
      vectorRank: candidate.vectorRank,
      retrievalScore: 0,
      trustScore: Math.min(baseTrustScore, freshnessScore),
      freshnessScore,
      duplicatePenalty: 0
    }
  };
}

function lexicalScore(document: LoadedDocument, normalizedQuery: string): number {
  const tokens = queryTokens(normalizedQuery);
  const text = searchableText(document);
  return tokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
}

function vectorScore(document: LoadedDocument, normalizedQuery: string): number {
  const tokens = queryTokens(normalizedQuery);
  const text = searchableText(document);
  const overlap = tokens.reduce((score, token) => score + (text.includes(token) ? 0.5 : 0), 0);
  return overlap + intentBoost(document.source.id, tokens);
}

function calibratedRetrievalScore(candidates: RankedCandidate[], chunkId: string): number {
  const candidate = candidates.find((item) => item.document.chunk.id === chunkId);
  if (!candidate) {
    return 0;
  }
  return clamp(Math.max(candidate.lexicalScore, candidate.vectorScore) / 5, 0, 0.99);
}

function searchableText(document: LoadedDocument): string {
  return queryTokens(`${document.source.title}\n${document.chunk.text}`).join(" ");
}

function queryTokens(input: string): string[] {
  return tokenizeText(normalizeText(input), { stopWords: STOP_WORDS });
}

function isContextBypassAttempt(normalizedQuery: string): boolean {
  const tokens = new Set(queryTokens(normalizedQuery));
  return (
    tokens.has("ignore") &&
    (tokens.has("context") || tokens.has("retrieved")) &&
    (tokens.has("memory") || tokens.has("answer") || tokens.has("citation"))
  );
}

function intentBoost(documentId: string, tokens: string[]): number {
  const tokenSet = new Set(tokens);
  if (documentId === "hybrid-retrieval-note" && hasAny(tokenSet, ["semantic", "vector", "meaning", "similarity"])) {
    return 3;
  }
  if (documentId === "pgvector-indexing-note" && hasAny(tokenSet, ["hnsw", "index", "ivfflat", "pgvector", "vector"])) {
    return 3;
  }
  if (documentId === "deployment-policy-v2" && hasAny(tokenSet, ["current", "deployment", "policy"])) {
    return 3;
  }
  if (documentId === "deployment-policy-v1" && hasAny(tokenSet, ["deployment", "policy"])) {
    return 1.5;
  }
  return 0;
}

function hasAny(values: Set<string>, expected: string[]): boolean {
  return expected.some((value) => values.has(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
