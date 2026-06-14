# 검색 지연 시간 리포트

생성일: 2026-06-14.
retrieval eval case 20개, top 3.
Embedding model: `text-embedding-3-small` (1536 dimensions).

대상: public sample docs. 측정: embedding call과 PostgreSQL retrieval latency.
Run context: `pnpm db:retrieval-latency-smoke`, public sample docs, 20 retrieval cases, local PostgreSQL connection, warm/cold cache split 없음.

## 읽는 법

- embedding cost와 database retrieval cost가 분리되어 보이는지 본다.

| Mode | Samples | Min ms | P50 ms | P95 ms | Max ms | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| embedding | 20 | 124.06 | 273.99 | 416.82 | 424.15 | 5953.87 |
| lexical | 20 | 0.56 | 1.97 | 3.48 | 7.93 | 43.65 |
| vector | 20 | 0.65 | 0.81 | 1.47 | 1.81 | 18.74 |
| hybrid | 20 | 0.96 | 3.80 | 6.66 | 9.92 | 78.28 |

## 메모

- Embedding latency는 eval query당 OpenAI embeddings call 1회로 측정한다.
- Database retrieval latency는 embedding time을 제외해 lexical, vector, hybrid SQL trade-off가 보이게 한다.
- Warm/cold cache split은 하지 않는다. 같은 실행 안에서 mode 간 비용 분리만 본다.
