# 검색 지연 시간 리포트

생성일: 2026-06-14.
retrieval eval case 20개, top 3.
Embedding model: `text-embedding-3-small` (1536 dimensions).

public sample docs 위의 live PostgreSQL + pgvector retrieval observation에서 생성된다.
작은 지연 시간 동작 확인이며 production scale benchmark가 아니다.

## 읽는 법

- absolute latency보다 embedding cost와 database retrieval cost가 분리되어 보이는지 본다.

| Mode | Samples | Min ms | P50 ms | P95 ms | Max ms | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| embedding | 20 | 114.06 | 251.80 | 299.77 | 344.47 | 4982.60 |
| lexical | 20 | 0.85 | 2.13 | 4.12 | 8.54 | 51.05 |
| vector | 20 | 0.79 | 0.98 | 1.51 | 2.67 | 22.30 |
| hybrid | 20 | 0.91 | 1.14 | 1.65 | 1.72 | 25.52 |

## 메모

- public sample docs 위의 작은 sample 동작 확인이며 10M-document benchmark가 아니다.
- Embedding latency는 eval query당 OpenAI embeddings call 1회로 측정한다.
- Database retrieval latency는 embedding time을 제외해 lexical, vector, hybrid SQL trade-off가 보이게 한다.
- Query text, provider payload, credential은 이 report에서 의도적으로 제외한다.
