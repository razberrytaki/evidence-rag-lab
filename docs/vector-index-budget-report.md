# Vector Index Budget Report

Generated on 2026-06-11.
This is sizing math, not measured PostgreSQL or pgvector index size.
No large index build was executed for this report.

| Assumption | Value |
|---|---:|
| documents | 10,000,000 |
| average chunks per document | 8 |
| embedding dimensions | 1,536 |
| embedding bytes per dimension | 4 |
| metadata bytes per chunk | 1,024 |
| HNSW m | 16 |
| HNSW layer multiplier | 1.10 |
| HNSW graph bytes per neighbor | 8 |
| HNSW build memory multiplier | 2.00 |

| Estimate | Value |
|---|---:|
| chunks | 80,000,000 |
| raw vector payload | 491.52 GB |
| chunk metadata | 81.92 GB |
| HNSW graph estimate | 11.26 GB |
| vector + metadata + HNSW graph | 584.70 GB |
| HNSW build working set estimate | 1169.41 GB |
| graph overhead vs vector payload | 2.3% |

## Notes

- HNSW graph math is an explicit scenario, not measured pgvector index size.
- The graph estimate excludes PostgreSQL page overhead, index tuple overhead, WAL, replicas, backups, vacuum bloat, and cache effects.
- The build working set estimate is a planning estimate for memory pressure discussion, not an observed maintenance_work_mem requirement.
- Production validation still needs larger indexes, warm/cold cache splits, p99 latency, recall checks, and failure-rate reporting.
