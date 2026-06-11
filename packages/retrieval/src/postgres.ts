import type { QueryTrace, RetrievalResult, ScoreBreakdown, SourceType } from "@evidencerag/domain";
import { sanitizeQueryTraceForStorage } from "./trace-safety";
export * from "./trace-safety";

export interface PostgresHybridRetrievalInput {
  query: string;
  embedding: readonly number[];
  topK: number;
  reciprocalRankK?: number;
  textSearchConfig?: string;
}

export interface PostgresLexicalRetrievalInput {
  query: string;
  topK: number;
  textSearchConfig?: string;
}

export interface PostgresVectorRetrievalInput {
  embedding: readonly number[];
  topK: number;
  reciprocalRankK?: number;
}

export interface ParameterizedSql {
  text: string;
  values: unknown[];
}

export interface PostgresRetrievalRow {
  document_id: string;
  document_title: string;
  source_type: SourceType;
  source_url?: string | null;
  document_version?: string | null;
  chunk_id: string;
  heading_path: string[];
  normalized_text: string;
  content_hash: string;
  chunk_version: string;
  lexical_rank?: number | string | null;
  vector_rank?: number | string | null;
  retrieval_score: number | string;
  trust_score?: number | string | null;
  freshness_score?: number | string | null;
  duplicate_penalty?: number | string | null;
}

export interface PostgresQueryTraceRow {
  id: string;
  query: string;
  normalized_query: string;
  selected_chunk_ids: string[];
  rejected: unknown;
  candidates: unknown;
  generation: unknown;
  sanitized: boolean;
  created_at: Date | string;
}

export interface StoredQueryTraceCandidate {
  chunkId: string;
  documentId: string;
  headingPath: string[];
  score: ScoreBreakdown;
}

export interface StoredQueryTraceGenerationAnswered {
  status: "answered" | "conflict";
  claims: Array<{
    id: string;
    citations: Array<{
      documentId: string;
      chunkId: string;
    }>;
  }>;
}

export interface StoredQueryTraceGenerationRejected {
  status: "rejected";
  reason: string;
  message: string;
}

export type StoredQueryTraceGeneration =
  | StoredQueryTraceGenerationAnswered
  | StoredQueryTraceGenerationRejected;

export interface StoredQueryTrace {
  id: string;
  query: string;
  normalizedQuery: string;
  selectedChunkIds: string[];
  rejected: Array<{
    chunkId: string;
    reason: string;
  }>;
  candidates: StoredQueryTraceCandidate[];
  generation: StoredQueryTraceGeneration;
  sanitized: boolean;
  createdAt: string;
}

export const DEFAULT_RECIPROCAL_RANK_K = 60;
export const DEFAULT_TEXT_SEARCH_CONFIG = "english";

export function extractLexicalExactTerms(query: string): string[] {
  if (query.includes(";") || query.includes("--")) {
    return [];
  }

  const candidates = query.match(/[A-Za-z0-9_=.:-]+/g) ?? [];
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const candidate of candidates) {
    const term = candidate.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    if (!isIdentifierLikeTerm(term) || seen.has(term)) {
      continue;
    }
    seen.add(term);
    terms.push(term);
  }

  return terms;
}

export function buildPostgresLexicalRetrievalSql(input: PostgresLexicalRetrievalInput): ParameterizedSql {
  const topK = requirePositiveInteger(input.topK, "topK");
  const textSearchConfig = input.textSearchConfig ?? DEFAULT_TEXT_SEARCH_CONFIG;
  const exactTerms = extractLexicalExactTerms(input.query);

  return {
    text: `
WITH lexical_candidates AS (
  SELECT
    document_chunks.id AS chunk_id,
    row_number() OVER (
      ORDER BY
        exact_matches.exact_match_count DESC,
        ts_rank_cd(search_vector, websearch_to_tsquery($3::regconfig, $1)) DESC,
        document_chunks.id ASC
    ) AS lexical_rank
  FROM document_chunks
  CROSS JOIN LATERAL (
    SELECT count(*)::double precision AS exact_match_count
    FROM unnest($4::text[]) AS exact_terms(term)
    WHERE strpos(lower(document_chunks.normalized_text), lower(exact_terms.term)) > 0
  ) AS exact_matches
  WHERE
    search_vector @@ websearch_to_tsquery($3::regconfig, $1)
    OR exact_matches.exact_match_count > 0
  ORDER BY
    exact_matches.exact_match_count DESC,
    ts_rank_cd(search_vector, websearch_to_tsquery($3::regconfig, $1)) DESC,
    document_chunks.id ASC
  LIMIT $2
)
SELECT
  source_documents.id AS document_id,
  source_documents.title AS document_title,
  source_documents.source_type,
  source_documents.source_url,
  source_documents.version AS document_version,
  document_chunks.id AS chunk_id,
  document_chunks.heading_path,
  document_chunks.normalized_text,
  document_chunks.content_hash,
  document_chunks.version AS chunk_version,
  lexical_candidates.lexical_rank,
  NULL::bigint AS vector_rank,
  1.0 / (${DEFAULT_RECIPROCAL_RANK_K} + lexical_candidates.lexical_rank) AS retrieval_score
FROM lexical_candidates
JOIN document_chunks ON document_chunks.id = lexical_candidates.chunk_id
JOIN source_documents ON source_documents.id = document_chunks.document_id
ORDER BY retrieval_score DESC, document_chunks.id ASC
LIMIT $2
`.trim(),
    values: [input.query, topK, textSearchConfig, exactTerms]
  };
}

export function buildPostgresVectorRetrievalSql(input: PostgresVectorRetrievalInput): ParameterizedSql {
  const topK = requirePositiveInteger(input.topK, "topK");
  const reciprocalRankK = requirePositiveInteger(
    input.reciprocalRankK ?? DEFAULT_RECIPROCAL_RANK_K,
    "reciprocalRankK"
  );

  return {
    text: `
WITH vector_candidates AS (
  SELECT
    id AS chunk_id,
    row_number() OVER (ORDER BY embedding <=> $1::vector, id ASC) AS vector_rank
  FROM document_chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> $1::vector, id ASC
  LIMIT $2
)
SELECT
  source_documents.id AS document_id,
  source_documents.title AS document_title,
  source_documents.source_type,
  source_documents.source_url,
  source_documents.version AS document_version,
  document_chunks.id AS chunk_id,
  document_chunks.heading_path,
  document_chunks.normalized_text,
  document_chunks.content_hash,
  document_chunks.version AS chunk_version,
  NULL::bigint AS lexical_rank,
  vector_candidates.vector_rank,
  1.0 / ($3 + vector_candidates.vector_rank) AS retrieval_score
FROM vector_candidates
JOIN document_chunks ON document_chunks.id = vector_candidates.chunk_id
JOIN source_documents ON source_documents.id = document_chunks.document_id
ORDER BY retrieval_score DESC, document_chunks.id ASC
LIMIT $2
`.trim(),
    values: [formatPgVector(input.embedding), topK, reciprocalRankK]
  };
}

export function buildPostgresHybridRetrievalSql(input: PostgresHybridRetrievalInput): ParameterizedSql {
  const topK = requirePositiveInteger(input.topK, "topK");
  const reciprocalRankK = requirePositiveInteger(
    input.reciprocalRankK ?? DEFAULT_RECIPROCAL_RANK_K,
    "reciprocalRankK"
  );
  const textSearchConfig = input.textSearchConfig ?? DEFAULT_TEXT_SEARCH_CONFIG;
  const exactTerms = extractLexicalExactTerms(input.query);

  return {
    text: `
WITH lexical_candidates AS (
  SELECT
    document_chunks.id AS chunk_id,
    row_number() OVER (
      ORDER BY
        exact_matches.exact_match_count DESC,
        ts_rank_cd(search_vector, websearch_to_tsquery($5::regconfig, $1)) DESC,
        document_chunks.id ASC
    ) AS lexical_rank
  FROM document_chunks
  CROSS JOIN LATERAL (
    SELECT count(*)::double precision AS exact_match_count
    FROM unnest($6::text[]) AS exact_terms(term)
    WHERE strpos(lower(document_chunks.normalized_text), lower(exact_terms.term)) > 0
  ) AS exact_matches
  WHERE
    search_vector @@ websearch_to_tsquery($5::regconfig, $1)
    OR exact_matches.exact_match_count > 0
  ORDER BY
    exact_matches.exact_match_count DESC,
    ts_rank_cd(search_vector, websearch_to_tsquery($5::regconfig, $1)) DESC,
    document_chunks.id ASC
  LIMIT $3
),
vector_candidates AS (
  SELECT
    id AS chunk_id,
    row_number() OVER (ORDER BY embedding <=> $2::vector, id ASC) AS vector_rank
  FROM document_chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> $2::vector, id ASC
  LIMIT $3
),
fused_candidates AS (
  SELECT
    COALESCE(lexical_candidates.chunk_id, vector_candidates.chunk_id) AS chunk_id,
    lexical_candidates.lexical_rank,
    vector_candidates.vector_rank,
    (
      CASE
        WHEN lexical_candidates.lexical_rank IS NULL THEN 0
        ELSE 1.0 / ($4 + lexical_candidates.lexical_rank)
      END
      +
      CASE
        WHEN vector_candidates.vector_rank IS NULL THEN 0
        ELSE 1.0 / ($4 + vector_candidates.vector_rank)
      END
    ) AS retrieval_score
  FROM lexical_candidates
  FULL OUTER JOIN vector_candidates USING (chunk_id)
)
SELECT
  source_documents.id AS document_id,
  source_documents.title AS document_title,
  source_documents.source_type,
  source_documents.source_url,
  source_documents.version AS document_version,
  document_chunks.id AS chunk_id,
  document_chunks.heading_path,
  document_chunks.normalized_text,
  document_chunks.content_hash,
  document_chunks.version AS chunk_version,
  fused_candidates.lexical_rank,
  fused_candidates.vector_rank,
  fused_candidates.retrieval_score
FROM fused_candidates
JOIN document_chunks ON document_chunks.id = fused_candidates.chunk_id
JOIN source_documents ON source_documents.id = document_chunks.document_id
ORDER BY fused_candidates.retrieval_score DESC, document_chunks.id ASC
LIMIT $3
`.trim(),
    values: [input.query, formatPgVector(input.embedding), topK, reciprocalRankK, textSearchConfig, exactTerms]
  };
}

export function formatPgVector(embedding: readonly number[]): string {
  if (embedding.length === 0) {
    throw new Error("embedding must contain at least one dimension");
  }

  return `[${embedding.map(formatVectorDimension).join(",")}]`;
}

export function mapPostgresRetrievalRow(row: PostgresRetrievalRow): RetrievalResult {
  const freshnessScore = optionalNumber(row.freshness_score) ?? defaultFreshnessScore(row.source_type);
  const trustScore = optionalNumber(row.trust_score) ?? Math.min(defaultTrustScore(row.source_type), freshnessScore);

  return {
    chunk: {
      id: row.chunk_id,
      documentId: row.document_id,
      headingPath: row.heading_path,
      text: row.normalized_text,
      contentHash: row.content_hash,
      version: row.chunk_version
    },
    parentContext: {
      documentId: row.document_id,
      headingPath: row.heading_path,
      text: row.normalized_text
    },
    score: {
      lexicalRank: optionalNumber(row.lexical_rank),
      vectorRank: optionalNumber(row.vector_rank),
      retrievalScore: requiredNumber(row.retrieval_score, "retrieval_score"),
      trustScore,
      freshnessScore,
      duplicatePenalty: optionalNumber(row.duplicate_penalty) ?? 0
    }
  };
}

export function buildQueryTraceUpsertSql(trace: QueryTrace): ParameterizedSql {
  const sanitizedTrace = sanitizeQueryTraceForStorage(trace);

  return {
    text: `
INSERT INTO query_traces (
  id,
  query,
  normalized_query,
  selected_chunk_ids,
  rejected,
  candidates,
  generation,
  sanitized
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5::jsonb,
  $6::jsonb,
  $7::jsonb,
  $8
)
ON CONFLICT (id) DO UPDATE SET
  query = EXCLUDED.query,
  normalized_query = EXCLUDED.normalized_query,
  selected_chunk_ids = EXCLUDED.selected_chunk_ids,
  rejected = EXCLUDED.rejected,
  candidates = EXCLUDED.candidates,
  generation = EXCLUDED.generation,
  sanitized = EXCLUDED.sanitized
`.trim(),
    values: [
      sanitizedTrace.id,
      sanitizedTrace.query,
      sanitizedTrace.normalizedQuery,
      sanitizedTrace.selectedChunkIds,
      JSON.stringify(sanitizedTrace.rejected),
      JSON.stringify(sanitizedTrace.candidates),
      JSON.stringify(sanitizedTrace.generation),
      sanitizedTrace.sanitized
    ]
  };
}

export function buildLatestQueryTraceSql(): ParameterizedSql {
  return {
    text: `
SELECT
  id,
  query,
  normalized_query,
  selected_chunk_ids,
  rejected,
  candidates,
  generation,
  sanitized,
  created_at
FROM query_traces
WHERE sanitized = true
ORDER BY created_at DESC, id DESC
LIMIT 1
`.trim(),
    values: []
  };
}

export function mapPostgresQueryTraceRow(row: PostgresQueryTraceRow): StoredQueryTrace {
  return {
    id: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query,
    selectedChunkIds: row.selected_chunk_ids,
    rejected: parseJsonArray<{ chunkId: string; reason: string }>(row.rejected, "rejected"),
    candidates: parseJsonArray<StoredQueryTraceCandidate>(row.candidates, "candidates"),
    generation: parseJsonValue<StoredQueryTraceGeneration>(row.generation, "generation"),
    sanitized: row.sanitized,
    createdAt: normalizeTimestamp(row.created_at)
  };
}

function formatVectorDimension(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("embedding contains a non-finite value");
  }
  return String(value);
}

function isIdentifierLikeTerm(term: string): boolean {
  if (term.length < 2) {
    return false;
  }
  if (/[=_-]/.test(term)) {
    return true;
  }
  if (/[a-z][A-Z]/.test(term)) {
    return true;
  }
  return /^[A-Z0-9]{2,8}$/.test(term) && /[A-Z]/.test(term);
}

function requirePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

function optionalNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return requiredNumber(value, "numeric field");
}

function requiredNumber(value: number | string, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be finite`);
  }
  return parsed;
}

function defaultFreshnessScore(sourceType: SourceType): number {
  return sourceType === "synthetic-stale" ? 0.3 : 1;
}

function defaultTrustScore(sourceType: SourceType): number {
  if (sourceType === "public-doc") {
    return 0.8;
  }
  if (sourceType === "synthetic-stale") {
    return 0.3;
  }
  return 0.6;
}

function parseJsonArray<T>(value: unknown, fieldName: string): T[] {
  const parsed = parseJsonValue<unknown>(value, fieldName);
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return parsed as T[];
}

function parseJsonValue<T>(value: unknown, fieldName: string): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} must not be empty`);
  }
  return value as T;
}

function normalizeTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("created_at must be a valid timestamp");
  }
  return date.toISOString();
}
