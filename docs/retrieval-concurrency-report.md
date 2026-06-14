# 검색 동시성 리포트

생성일: 2026-06-14.
retrieval eval case 20개, top 3.

대상: public sample docs. 측정: precomputed embedding 이후 PostgreSQL retrieval concurrency.
embedding을 미리 계산한 뒤 database retrieval 구간만 측정한다.

## 읽는 법

- precomputed embedding 이후 database retrieval path의 pressure를 본다.

| Mode | Concurrency | Query 수 | Min ms | P50 ms | P95 ms | P99 ms | Max ms | Total ms | Error 수 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lexical | 1 | 20 | 0.52 | 0.70 | 2.48 | 21.17 | 21.17 | 39.36 | 0 |
| vector | 1 | 20 | 0.78 | 0.91 | 1.68 | 7.18 | 7.18 | 25.62 | 0 |
| hybrid | 1 | 20 | 0.89 | 1.11 | 1.71 | 7.40 | 7.40 | 29.33 | 0 |
| lexical | 4 | 20 | 0.53 | 0.89 | 8.20 | 8.60 | 8.60 | 46.62 | 0 |
| vector | 4 | 20 | 0.90 | 1.42 | 7.43 | 7.65 | 7.65 | 51.97 | 0 |
| hybrid | 4 | 20 | 1.68 | 3.68 | 8.90 | 9.07 | 9.07 | 90.97 | 0 |

## 메모

- PostgreSQL retrieval concurrency만 분리하기 위해 timing 전에 embedding을 의도적으로 미리 계산한다.
- 각 concurrency level은 같은 retrieval eval case를 실행한다.
