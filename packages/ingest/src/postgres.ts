import type { DocumentChunk, SourceDocument } from "@evidencerag/domain";

export interface ParameterizedSql {
  text: string;
  values: unknown[];
}

export interface PostgresChunkInput {
  chunk: DocumentChunk;
  embedding?: readonly number[] | null;
}

export interface PostgresDocumentInput {
  source: SourceDocument;
  chunks: PostgresChunkInput[];
}

export interface PostgresIngestPlanInput {
  documents: PostgresDocumentInput[];
}

export interface PostgresIngestPlan {
  statements: ParameterizedSql[];
}

export interface SqlExecutor {
  query(text: string, values: unknown[]): Promise<unknown>;
}

export interface ExecutePostgresIngestSummary {
  statementCount: number;
}

export function buildPostgresIngestPlan(input: PostgresIngestPlanInput): PostgresIngestPlan {
  return {
    statements: input.documents.flatMap((document) => [
      buildSourceDocumentUpsertSql(document.source),
      ...document.chunks.map((chunk) => buildDocumentChunkUpsertSql(chunk))
    ])
  };
}

export async function executePostgresIngestPlan(
  executor: SqlExecutor,
  plan: PostgresIngestPlan
): Promise<ExecutePostgresIngestSummary> {
  for (const statement of plan.statements) {
    await executor.query(statement.text, statement.values);
  }

  return {
    statementCount: plan.statements.length
  };
}

export function buildSourceDocumentUpsertSql(source: SourceDocument): ParameterizedSql {
  return {
    text: `
INSERT INTO source_documents (
  id,
  title,
  source_type,
  source_url,
  version,
  published_at,
  license_note
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6::timestamptz,
  $7
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  source_type = EXCLUDED.source_type,
  source_url = EXCLUDED.source_url,
  version = EXCLUDED.version,
  published_at = EXCLUDED.published_at,
  license_note = EXCLUDED.license_note,
  updated_at = now()
`.trim(),
    values: [
      source.id,
      source.title,
      source.sourceType,
      source.sourceUrl ?? null,
      source.version ?? "v1",
      source.publishedAt ?? null,
      source.licenseNote
    ]
  };
}

export function buildDocumentChunkUpsertSql(input: PostgresChunkInput): ParameterizedSql {
  const chunk = input.chunk;

  return {
    text: `
INSERT INTO document_chunks (
  id,
  document_id,
  parent_id,
  heading_path,
  normalized_text,
  content_hash,
  embedding,
  search_vector,
  version
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7::vector,
  to_tsvector('english', array_to_string($4::text[], ' ') || ' ' || $5),
  $8
)
ON CONFLICT (id) DO UPDATE SET
  document_id = EXCLUDED.document_id,
  parent_id = EXCLUDED.parent_id,
  heading_path = EXCLUDED.heading_path,
  normalized_text = EXCLUDED.normalized_text,
  content_hash = EXCLUDED.content_hash,
  embedding = EXCLUDED.embedding,
  search_vector = EXCLUDED.search_vector,
  version = EXCLUDED.version,
  updated_at = now()
`.trim(),
    values: [
      chunk.id,
      chunk.documentId,
      chunk.parentId ?? null,
      chunk.headingPath,
      chunk.text,
      chunk.contentHash,
      formatNullablePgVector(input.embedding),
      chunk.version
    ]
  };
}

export function formatNullablePgVector(embedding: readonly number[] | null | undefined): string | null {
  if (!embedding) {
    return null;
  }
  if (embedding.length === 0) {
    throw new Error("embedding must contain at least one dimension");
  }
  return `[${embedding.map(formatVectorDimension).join(",")}]`;
}

function formatVectorDimension(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("embedding contains a non-finite value");
  }
  return String(value);
}
