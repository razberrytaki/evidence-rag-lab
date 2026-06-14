# Scale Budget 리포트

생성일: 2026-06-12.
이는 sizing math이며 production benchmark가 아니다.
이 report를 위해 10M-document load를 실행하지 않았다.

| Assumption | 값 |
|---|---:|
| documents | 10,000,000 |
| average chunks per document | 8 |
| embedding dimensions | 1,536 |
| embedding bytes per dimension | 4 |
| metadata bytes per chunk | 1,024 |
| average sanitized trace bytes | 4,096 |
| daily queries | 50,000 |
| trace retention days | 7 |

| Estimate | 값 |
|---|---:|
| documents | 10,000,000 |
| chunks | 80,000,000 |
| vector storage | 491.52 GB |
| chunk metadata | 81.92 GB |
| vector + chunk metadata | 573.44 GB |
| retained sanitized traces | 1.43 GB |

## 메모

- Sizing math only. 10M-document load는 실행하지 않았다.
- Vector storage는 float32 embedding을 가정하며 HNSW graph overhead, WAL, replica, backup, vacuum bloat를 제외한다.
- Trace volume은 full provider prompt, raw context bundle, provider response가 아니라 sanitized aggregate trace payload를 가정한다.
- 포트폴리오에서 중요한 signal은 assumption을 명시하고, pressure point를 계산하고, production 전에 무엇을 측정해야 하는지 이름 붙이는 능력이다.
