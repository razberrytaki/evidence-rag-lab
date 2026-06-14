# 검색 동시성 리포트

생성일: 2026-06-14.
retrieval eval case 20개, top 3.

대상: public sample docs. 측정: precomputed embedding 이후 PostgreSQL retrieval concurrency.
embedding을 미리 계산한 뒤 database retrieval 구간만 측정한다.
Run context: `pnpm db:retrieval-concurrency-smoke`, public sample docs, 20 retrieval cases, local PostgreSQL connection, concurrency 1/4.

## 읽는 법

- precomputed embedding 이후 database retrieval path의 pressure를 본다.

| Mode | Concurrency | Query 수 | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | Error 수 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lexical | 1 | 20 | 0.50 | 0.91 | 3.89 | 26.98 | 26.98 | 50.48 | 0 |
| vector | 1 | 20 | 0.70 | 0.94 | 1.59 | 8.57 | 8.57 | 28.13 | 0 |
| hybrid | 1 | 20 | 0.91 | 1.14 | 2.01 | 10.62 | 10.62 | 35.19 | 0 |
| lexical | 4 | 20 | 0.50 | 0.93 | 7.94 | 8.89 | 8.89 | 49.16 | 0 |
| vector | 4 | 20 | 0.92 | 2.06 | 9.29 | 9.88 | 9.88 | 65.59 | 0 |
| hybrid | 4 | 20 | 1.18 | 2.48 | 10.53 | 12.99 | 12.99 | 83.60 | 0 |

## 메모

- PostgreSQL retrieval concurrency만 분리하기 위해 timing 전에 embedding을 의도적으로 미리 계산한다.
- 각 concurrency level은 같은 retrieval eval case를 실행한다.
- Warm/cold cache split은 하지 않는다. concurrency 1/4에서 DB retrieval 구간만 비교한다.
