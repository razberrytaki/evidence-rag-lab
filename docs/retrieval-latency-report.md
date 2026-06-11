# Retrieval Latency Report

Generated on 2026-06-11.
20 retrieval eval cases at top 3.
Embedding model: `text-embedding-3-small` (1536 dimensions).

Generated from live PostgreSQL + pgvector retrieval observations over public sample docs.
This is a small latency smoke, not a production scale benchmark.

| Mode | Samples | Min ms | P50 ms | P95 ms | Max ms | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| embedding | 20 | 111.38 | 147.91 | 164.35 | 166.30 | 2961.80 |
| lexical | 20 | 1.91 | 2.59 | 5.07 | 7.64 | 59.20 |
| vector | 20 | 0.93 | 2.08 | 2.73 | 3.75 | 39.36 |
| hybrid | 20 | 1.01 | 1.32 | 1.88 | 2.14 | 28.96 |

## Notes

- Small sample smoke over public sample docs; not a 10M-document benchmark.
- Embedding latency is measured as one OpenAI embeddings call per eval query.
- Database retrieval latency excludes embedding time so lexical, vector, and hybrid SQL trade-offs remain visible.
- Query text, provider payloads, and credentials are intentionally excluded from this report.
