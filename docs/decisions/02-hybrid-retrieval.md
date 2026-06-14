# 결정: 하이브리드 검색

## 맥락

벡터 검색은 의미적으로 가까운 표현을 처리한다. lexical 검색은 정확한 용어를
보호한다.

## 권장 선택

PostgreSQL full-text search, 식별자 인식 exact-token matching, pgvector를 함께
사용하고 reciprocal rank fusion으로 결합한다.

## 검토한 대안

- vector-only retrieval
- lexical-only retrieval
- weighted score fusion

## 트레이드오프

reciprocal rank fusion은 초기 score calibration 부담을 줄이고, trace viewer에서
ranking을 설명하기 쉽게 만든다. 식별자 인식 lexical matching은 PostgreSQL
full-text search만으로 놓칠 수 있는 config key, API field, error code,
acronym, runbook ID를 처리한다. 현재 결과는 여전히 sample-doc 기준이므로
production 적용 전 재평가가 필요하다.

## 평가 근거

- `exact-term-retrieval`, `semantic-paraphrase`, `hybrid-rescue`를 사용한다.
- `apps/api/src/postgres-rag.pipeline.ts`는 `RAG_QUERY_MODE=postgres`일 때
  `/query`를 PostgreSQL retrieval 경로로 보낸다.
- `pnpm db:live-smoke`는 sample chunk에 대해 OpenAI embedding + PostgreSQL
  retrieval 경로를 검증한다.
- `pnpm db:quality-smoke`는 저장된 sample-doc embedding 위에서 20개의 live
  ranked retrieval case를 실행하고 `docs/retrieval-quality-report.md`를 쓴다.
- 현재 sample-doc 결과: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke`는 같은 20개 ranked case를 lexical-only,
  vector-only, hybrid retrieval로 실행하고
  `docs/retrieval-mode-comparison-report.md`를 쓴다.
- 현재 mode 비교 결과: lexical-only recall@3 `15/20`, MRR `0.750`;
  vector-only recall@3 `20/20`, MRR `0.975`; hybrid recall@3 `20/20`, MRR
  `1.000`.
- `pnpm db:retrieval-latency-smoke`는 같은 20개 case를 측정하고 embedding,
  lexical SQL, vector SQL, hybrid SQL의 aggregate timing을 분리해
  `docs/retrieval-latency-report.md`에 쓴다. sanitized report만으로 품질과
  latency trade-off를 볼 수 있게 한다.
- 현재 latency 결과: embedding P50 `273.99ms`, P95 `416.82ms`;
  lexical SQL P50 `1.97ms`; vector SQL P50 `0.81ms`; hybrid SQL P50 `3.80ms`.
  현재 실행에서는 embedding이 지배 비용이며, SQL retrieval cost와 embedding cost가
  분리되어 보인다.
- `pnpm db:retrieval-concurrency-smoke`는 embedding을 미리 계산한 뒤,
  concurrency `1`과 `4`에서 PostgreSQL lexical, vector, hybrid retrieval을
  측정하고 `docs/retrieval-concurrency-report.md`를 쓴다.
- 현재 concurrency 결과, concurrency `4`: lexical P50 `0.93ms`, P95
  `7.94ms`, P99 `8.89ms`; vector P50 `2.06ms`, P95 `9.29ms`, P99 `9.88ms`;
  hybrid P50 `2.48ms`, P95 `10.53ms`, P99 `12.99ms`; 모든 row error `0`.
- 해석: 식별자 인식 lexical retrieval은 exact-token category `5/5`를 통과한다.
  하지만 answer-guard, retrieval-design, version-conflict 일부는 여전히 놓친다.
  Hybrid는 vector 수준의 recall을 유지하면서 놓친 vector rank position을 회복한다.
  Hybrid를 기본값으로 유지하는 이유는 exact-term과 semantic rank signal이 같은
  trace에 남아, acronym, rare term, ID, embedding drift로 확장할 때 판단 근거가
  보이기 때문이다.
- PostgreSQL RRF는 작은 raw rank-fusion 값을 반환하므로 API 경로는 현재 단순한
  rank 기반 0..1 answer confidence calibration을 적용한다.
- 측정 범위: 위 결과는 public sample docs 기반 local observation이다. production
  benchmark나 scoring claim이 아니라 선택 근거를 남기기 위한 evidence다.

## 확장 시 다시 볼 것

PostgreSQL full-text search와 OpenSearch BM25를 비교하고 recall, latency,
운영 비용을 측정한다.
