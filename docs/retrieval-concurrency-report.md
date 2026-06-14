# 검색 동시성 리포트

생성일: 2026-06-14.
retrieval eval case 20개, top 3.

public sample docs 위의 live PostgreSQL + pgvector retrieval observation에서 생성된다.
작은 local 동시성 동작 확인이며 production load benchmark가 아니다.
database retrieval concurrency가 보이도록 측정 구간 전에 embedding을 미리 계산한다.

| Mode | Concurrency | Query 수 | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | Error 수 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lexical | 1 | 20 | 0.70 | 0.89 | 2.09 | 15.69 | 15.69 | 35.16 | 0 |
| vector | 1 | 20 | 0.65 | 1.05 | 1.77 | 8.17 | 8.17 | 29.09 | 0 |
| hybrid | 1 | 20 | 1.07 | 1.29 | 2.13 | 8.49 | 8.49 | 34.03 | 0 |
| lexical | 4 | 20 | 0.59 | 0.93 | 9.26 | 10.49 | 10.49 | 53.46 | 0 |
| vector | 4 | 20 | 0.99 | 1.83 | 8.65 | 9.69 | 9.69 | 60.31 | 0 |
| hybrid | 4 | 20 | 1.43 | 2.39 | 11.84 | 11.90 | 11.90 | 90.38 | 0 |

## 메모

- PostgreSQL retrieval concurrency만 분리하기 위해 timing 전에 embedding을 의도적으로 미리 계산한다.
- public sample query 위의 작은 local 동작 확인이며 production load benchmark가 아니다.
- 각 concurrency level은 같은 retrieval eval case를 실행한다.
- Query text, provider payload, credential은 이 report에서 의도적으로 제외한다.
