# 검색 동시성 리포트

생성일: 2026-06-12.
retrieval eval case 20개, top 3.

public sample docs 위의 live PostgreSQL + pgvector retrieval observation에서 생성된다.
작은 local 동시성 동작 확인이며 production load benchmark가 아니다.
database retrieval concurrency가 보이도록 측정 구간 전에 embedding을 미리 계산한다.

| Mode | Concurrency | Query 수 | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | Error 수 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lexical | 1 | 20 | 0.52 | 0.83 | 2.79 | 17.70 | 17.70 | 39.78 | 0 |
| vector | 1 | 20 | 0.79 | 0.87 | 1.81 | 7.75 | 7.75 | 26.79 | 0 |
| hybrid | 1 | 20 | 0.91 | 1.07 | 2.17 | 7.14 | 7.14 | 30.50 | 0 |
| lexical | 4 | 20 | 0.56 | 0.95 | 7.71 | 7.77 | 7.77 | 42.96 | 0 |
| vector | 4 | 20 | 0.74 | 2.27 | 7.69 | 8.08 | 8.08 | 63.66 | 0 |
| hybrid | 4 | 20 | 0.99 | 1.58 | 8.50 | 9.02 | 9.02 | 60.36 | 0 |

## 메모

- PostgreSQL retrieval concurrency만 분리하기 위해 timing 전에 embedding을 의도적으로 미리 계산한다.
- public sample query 위의 작은 local 동작 확인이며 production load benchmark가 아니다.
- 각 concurrency level은 같은 retrieval eval case를 실행한다.
- Query text, provider payload, credential은 이 report에서 의도적으로 제외한다.
