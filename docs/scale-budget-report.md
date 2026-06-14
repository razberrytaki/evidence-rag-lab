# Scale Budget 리포트

생성일: 2026-06-12.
Scale scenario를 explicit assumption으로 계산한 sizing math다.

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

- 문서 수, 평균 chunk 수, embedding dimension 가정에서 storage pressure를 계산한다.
- Vector storage는 float32 embedding을 가정하며 HNSW graph overhead, WAL, replica, backup, vacuum bloat를 제외한다.
- Trace volume은 full provider prompt, raw context bundle, provider response가 아니라 sanitized aggregate trace payload를 가정한다.
- 이 계산은 assumptions, pressure points, production validation targets를 산출한다.
