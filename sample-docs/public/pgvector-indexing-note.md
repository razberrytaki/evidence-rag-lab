---
id: pgvector-indexing-note
sourceType: public-doc
sourceUrl: https://github.com/pgvector/pgvector
accessed: 2026-06-11
licenseNote: Short paraphrased note derived from public documentation; no upstream prose copied.
---

# pgvector Indexing Note

The MVP stores document metadata, chunks, traces, and vectors in PostgreSQL.
pgvector supports exact nearest-neighbor search and approximate indexes. The lab
uses HNSW as the first index path because it keeps the runtime local and makes
the speed-recall trade-off visible. IVFFlat, quantization, and dedicated vector
databases remain scale alternatives rather than first-runtime dependencies.
