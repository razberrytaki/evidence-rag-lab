# Scale Budget Report

Generated on 2026-06-11.
This is sizing math, not a production benchmark.
No 10M-document load was executed for this report.

| Assumption | Value |
|---|---:|
| documents | 10,000,000 |
| average chunks per document | 8 |
| embedding dimensions | 1,536 |
| embedding bytes per dimension | 4 |
| metadata bytes per chunk | 1,024 |
| average sanitized trace bytes | 4,096 |
| daily queries | 50,000 |
| trace retention days | 7 |

| Estimate | Value |
|---|---:|
| documents | 10,000,000 |
| chunks | 80,000,000 |
| vector storage | 491.52 GB |
| chunk metadata | 81.92 GB |
| vector + chunk metadata | 573.44 GB |
| retained sanitized traces | 1.43 GB |

## Notes

- Sizing math only. No 10M-document load was executed.
- Vector storage assumes float32 embeddings and excludes HNSW graph overhead, WAL, replicas, backups, and vacuum bloat.
- Trace volume assumes sanitized aggregate trace payloads, not raw prompts, raw context, or provider responses.
- The useful portfolio signal is the ability to state assumptions, calculate pressure points, and name what must be measured before production.
