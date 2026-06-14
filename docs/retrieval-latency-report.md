# 검색 지연 시간 리포트

생성일: 2026-06-12.
retrieval eval case 20개, top 3.
Embedding model: `text-embedding-3-small` (1536 dimensions).

public sample docs 위의 live PostgreSQL + pgvector retrieval observation에서 생성된다.
작은 지연 시간 동작 확인이며 production scale benchmark가 아니다.

| Mode | Samples | Min ms | P50 ms | P95 ms | Max ms | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| embedding | 20 | 136.02 | 272.34 | 330.39 | 363.15 | 5401.87 |
| lexical | 20 | 1.03 | 1.60 | 3.08 | 4.07 | 37.56 |
| vector | 20 | 0.71 | 0.85 | 1.52 | 1.68 | 19.61 |
| hybrid | 20 | 0.96 | 1.12 | 1.87 | 2.11 | 24.66 |

## 메모

- public sample docs 위의 작은 sample 동작 확인이며 10M-document benchmark가 아니다.
- Embedding latency는 eval query당 OpenAI embeddings call 1회로 측정한다.
- Database retrieval latency는 embedding time을 제외해 lexical, vector, hybrid SQL trade-off가 보이게 한다.
- Query text, provider payload, credential은 이 report에서 의도적으로 제외한다.
