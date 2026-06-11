# Retrieval Concurrency Report

Generated on 2026-06-11.
20 retrieval eval cases at top 3.

Generated from live PostgreSQL + pgvector retrieval observations over public sample docs.
This is a small local concurrency smoke, not a production load benchmark.
Embeddings are precomputed before the measured section so database retrieval concurrency stays visible.

| Mode | Concurrency | Queries | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lexical | 1 | 20 | 0.61 | 0.76 | 3.74 | 21.76 | 21.76 | 43.79 | 0 |
| vector | 1 | 20 | 0.79 | 1.02 | 1.56 | 7.48 | 7.48 | 28.16 | 0 |
| hybrid | 1 | 20 | 0.99 | 1.24 | 2.36 | 8.58 | 8.58 | 33.47 | 0 |
| lexical | 4 | 20 | 0.54 | 1.01 | 9.18 | 9.35 | 9.35 | 52.19 | 0 |
| vector | 4 | 20 | 1.09 | 1.75 | 9.12 | 9.92 | 9.92 | 61.85 | 0 |
| hybrid | 4 | 20 | 1.42 | 2.28 | 10.08 | 11.10 | 11.10 | 77.11 | 0 |

## Notes

- Embedding is intentionally precomputed before timing so this isolates PostgreSQL retrieval concurrency.
- Small local smoke over public sample queries; not a production load benchmark.
- Each concurrency level runs the same retrieval eval cases.
- Query text, provider payloads, and credentials are intentionally excluded from this report.
