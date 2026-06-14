# Vector Index Budget 리포트

생성일: 2026-06-12.
이는 sizing math이며 measured PostgreSQL 또는 pgvector index size가 아니다.
이 report를 위해 large index build를 실행하지 않았다.

| Assumption | 값 |
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

| Estimate | 값 |
|---|---:|
| chunks | 80,000,000 |
| raw vector payload | 491.52 GB |
| chunk metadata | 81.92 GB |
| HNSW graph estimate | 11.26 GB |
| vector + metadata + HNSW graph | 584.70 GB |
| HNSW build working set estimate | 1169.41 GB |
| graph overhead vs vector payload | 2.3% |

## 메모

- HNSW graph math는 explicit scenario이며 measured pgvector index size가 아니다.
- graph estimate는 PostgreSQL page overhead, index tuple overhead, WAL, replica, backup, vacuum bloat, cache effect를 제외한다.
- build working set estimate는 memory pressure 논의용 planning estimate이며 observed maintenance_work_mem requirement가 아니다.
- Production validation에는 여전히 larger index, warm/cold cache split, p99 latency, recall check, failure-rate reporting이 필요하다.
