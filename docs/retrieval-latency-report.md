# 검색 지연 시간 리포트

생성일: 2026-06-14.
retrieval eval case 20개, top 3.
Embedding model: `text-embedding-3-small` (1536 dimensions).

대상: public sample docs. 측정: embedding call과 PostgreSQL retrieval latency.

## 읽는 법

- embedding cost와 database retrieval cost가 분리되어 보이는지 본다.

| Mode | Samples | Min ms | P50 ms | P95 ms | Max ms | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| embedding | 20 | 114.06 | 251.80 | 299.77 | 344.47 | 4982.60 |
| lexical | 20 | 0.85 | 2.13 | 4.12 | 8.54 | 51.05 |
| vector | 20 | 0.79 | 0.98 | 1.51 | 2.67 | 22.30 |
| hybrid | 20 | 0.91 | 1.14 | 1.65 | 1.72 | 25.52 |

## 메모

- Embedding latency는 eval query당 OpenAI embeddings call 1회로 측정한다.
- Database retrieval latency는 embedding time을 제외해 lexical, vector, hybrid SQL trade-off가 보이게 한다.
