CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS source_documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('public-doc', 'synthetic-conflict', 'synthetic-stale')),
  source_url text,
  version text NOT NULL DEFAULT 'v1',
  published_at timestamptz,
  license_note text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  parent_id text,
  heading_path text[] NOT NULL DEFAULT ARRAY[]::text[],
  normalized_text text NOT NULL,
  content_hash text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  embedding vector(1536),
  search_vector tsvector NOT NULL DEFAULT ''::tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_chunks_document_hash_version_idx
  ON document_chunks(document_id, content_hash, version);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx
  ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS document_chunks_search_vector_gin_idx
  ON document_chunks USING gin(search_vector);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS query_traces (
  id text PRIMARY KEY,
  query text NOT NULL,
  normalized_query text NOT NULL,
  selected_chunk_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  rejected jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  generation jsonb NOT NULL,
  sanitized boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
