# 검색 지연 시간 리포트

생성일: 2026-06-14.
retrieval eval case 20개, top 3.
Embedding model: `text-embedding-3-small` (1536 dimensions).

public sample docs 위의 live PostgreSQL + pgvector retrieval observation에서 생성된다.
작은 지연 시간 동작 확인이며 production scale benchmark가 아니다.

| Mode | Samples | Min ms | P50 ms | P95 ms | Max ms | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| embedding | 20 | 157.96 | 263.45 | 351.96 | 427.41 | 5422.50 |
| lexical | 20 | 0.53 | 0.71 | 1.53 | 4.78 | 20.00 |
| vector | 20 | 0.75 | 0.88 | 1.18 | 1.22 | 18.43 |
| hybrid | 20 | 0.90 | 1.17 | 1.49 | 1.49 | 23.87 |

## 메모

- public sample docs 위의 작은 sample 동작 확인이며 10M-document benchmark가 아니다.
- Embedding latency는 eval query당 OpenAI embeddings call 1회로 측정한다.
- Database retrieval latency는 embedding time을 제외해 lexical, vector, hybrid SQL trade-off가 보이게 한다.
- Query text, provider payload, credential은 이 report에서 의도적으로 제외한다.
