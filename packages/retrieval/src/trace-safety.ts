import { createHash } from "node:crypto";
import type { GenerationResult, QueryTrace, RetrievalResult } from "@evidencerag/domain";
import type { ParameterizedSql } from "./postgres";

export const DEFAULT_TRACE_RETENTION_DAYS = 7;
export const MAX_TRACE_RETENTION_DAYS = 3650;
export const DEFAULT_TRACE_SAMPLE_RATE = 1;
export const DEFAULT_MAX_STORED_QUERY_LENGTH = 500;

export interface TraceSafetyPolicy {
  retainForDays: number;
  sampleRate: number;
  maxStoredQueryLength: number;
}

export interface StoredQueryTracePayload {
  id: string;
  query: string;
  normalizedQuery: string;
  selectedChunkIds: string[];
  rejected: Array<{
    chunkId: string;
    reason: string;
  }>;
  candidates: Array<Record<string, unknown>>;
  generation: Record<string, unknown>;
  sanitized: true;
}

export interface ExpiredQueryTraceDeleteInput {
  now?: Date;
  retainForDays?: number;
}

export interface TraceCleanupQueryExecutor {
  query(text: string, values: unknown[]): Promise<{
    rows: unknown[];
  }>;
}

export interface ExpiredQueryTraceCleanupInput extends ExpiredQueryTraceDeleteInput {
  queryExecutor: TraceCleanupQueryExecutor;
}

export interface ExpiredQueryTraceCleanupSummary {
  retentionDays: number;
  cutoff: string;
  deletedCount: number;
  deletedTraceIds: string[];
}

export function defaultTraceSafetyPolicy(): TraceSafetyPolicy {
  return {
    retainForDays: DEFAULT_TRACE_RETENTION_DAYS,
    sampleRate: DEFAULT_TRACE_SAMPLE_RATE,
    maxStoredQueryLength: DEFAULT_MAX_STORED_QUERY_LENGTH
  };
}

export function sanitizeQueryTraceForStorage(
  trace: QueryTrace,
  policy: Partial<TraceSafetyPolicy> = {}
): StoredQueryTracePayload {
  const resolved = {
    ...defaultTraceSafetyPolicy(),
    ...policy
  };

  return {
    id: trace.id,
    query: redactAndLimit(trace.query, resolved.maxStoredQueryLength),
    normalizedQuery: redactAndLimit(trace.normalizedQuery, resolved.maxStoredQueryLength),
    selectedChunkIds: trace.selectedChunkIds,
    rejected: trace.rejected.map((rejection) => ({
      chunkId: rejection.chunkId,
      reason: redactAndLimit(rejection.reason, resolved.maxStoredQueryLength)
    })),
    candidates: trace.candidates.map(sanitizeCandidateForTraceStorage),
    generation: sanitizeGenerationForTraceStorage(trace.generation, resolved),
    sanitized: true
  };
}

export function buildExpiredQueryTraceDeleteSql(
  input: ExpiredQueryTraceDeleteInput = {}
): ParameterizedSql {
  const retainForDays = requireRetentionDays(
    input.retainForDays ?? DEFAULT_TRACE_RETENTION_DAYS,
    "retainForDays"
  );
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - retainForDays * 24 * 60 * 60 * 1000);

  return {
    text: `
DELETE FROM query_traces
WHERE created_at < $1::timestamptz
RETURNING id
`.trim(),
    values: [cutoff.toISOString()]
  };
}

export async function runExpiredQueryTraceCleanup(
  input: ExpiredQueryTraceCleanupInput
): Promise<ExpiredQueryTraceCleanupSummary> {
  const retentionDays = requireRetentionDays(
    input.retainForDays ?? DEFAULT_TRACE_RETENTION_DAYS,
    "retainForDays"
  );
  const sql = buildExpiredQueryTraceDeleteSql({
    now: input.now,
    retainForDays: retentionDays
  });
  const result = await input.queryExecutor.query(sql.text, sql.values);
  const deletedTraceIds = result.rows.map(readDeletedTraceId);

  return {
    retentionDays,
    cutoff: String(sql.values[0]),
    deletedCount: deletedTraceIds.length,
    deletedTraceIds
  };
}

export function shouldPersistTraceSample(traceId: string, sampleRate: number): boolean {
  if (sampleRate < 0 || sampleRate > 1 || !Number.isFinite(sampleRate)) {
    throw new Error("sampleRate must be between 0 and 1");
  }
  if (sampleRate === 0) {
    return false;
  }
  if (sampleRate === 1) {
    return true;
  }

  const digest = createHash("sha256").update(traceId).digest();
  const bucket = digest.readUInt32BE(0) / 0xffffffff;
  return bucket < sampleRate;
}

function sanitizeCandidateForTraceStorage(result: RetrievalResult): Record<string, unknown> {
  return {
    chunkId: result.chunk.id,
    documentId: result.chunk.documentId,
    headingPath: result.chunk.headingPath,
    score: result.score
  };
}

function sanitizeGenerationForTraceStorage(
  generation: GenerationResult,
  policy: TraceSafetyPolicy
): Record<string, unknown> {
  if (generation.status === "rejected") {
    return {
      status: generation.status,
      reason: generation.reason,
      message: redactAndLimit(generation.message, policy.maxStoredQueryLength)
    };
  }

  return {
    status: generation.status,
    claims: generation.claims.map((claim) => ({
      id: claim.id,
      citations: claim.citations.map((citation) => ({
        documentId: citation.documentId,
        chunkId: citation.chunkId
      }))
    }))
  };
}

function redactAndLimit(value: string, maxLength: number): string {
  const redacted = redactSensitiveText(value);
  if (redacted.length <= maxLength) {
    return redacted;
  }
  return `${redacted.slice(0, Math.max(0, maxLength - 1))}…`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\bBearer\s+sk-[A-Za-z0-9_-]+/g, "Bearer [redacted-secret]")
    .replace(/\b(openai_api_key|OPENAI_API_KEY)=sk-[A-Za-z0-9_-]+/g, "$1=[redacted-secret]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted-secret]");
}

function requirePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

function requireRetentionDays(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_TRACE_RETENTION_DAYS) {
    throw new Error(`${fieldName} must be between 1 and ${MAX_TRACE_RETENTION_DAYS}`);
  }
  return value;
}

function readDeletedTraceId(row: unknown): string {
  if (typeof row !== "object" || row === null || !("id" in row) || typeof row.id !== "string") {
    throw new Error("trace cleanup result row is missing id");
  }
  return row.id;
}
