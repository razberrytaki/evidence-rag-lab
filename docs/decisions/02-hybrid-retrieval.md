# 결정: 하이브리드 검색

## 맥락

벡터 검색은 의미적으로 가까운 표현을 처리한다. 키워드 검색은 정확한 용어를
보호한다.

## 권장 선택

PostgreSQL full-text search, 식별자 인식 정확 토큰 매칭, pgvector를 함께
사용하고 reciprocal rank fusion으로 결합한다.

## 검토한 대안

- 벡터 전용 검색
- 키워드 전용 검색
- 가중 점수 결합

## 트레이드오프

reciprocal rank fusion은 초기 점수 보정 부담을 줄이고, 추적 기록 화면에서
순위를 설명하기 쉽게 만든다. 식별자 인식 키워드 매칭은 PostgreSQL
full-text search만으로 놓칠 수 있는 설정 키, API 필드, 오류 코드,
약어, 실행 문서 id를 처리한다. 현재 결과는 여전히 샘플 문서 기준이므로
운영 적용 전 재평가가 필요하다.

## 평가 근거

- `exact-term-retrieval`, `semantic-paraphrase`, `hybrid-rescue`를 사용한다.
- `apps/api/src/rag/postgres/postgres-rag.pipeline.ts`는 `RAG_QUERY_MODE=postgres`일 때
  `/query`를 PostgreSQL 검색 경로로 보낸다.
- `pnpm db:live-smoke`는 샘플 청크에 대해 OpenAI 임베딩 + PostgreSQL
  검색 경로를 검증한다.
- `pnpm db:quality-smoke`는 저장된 샘플 문서 임베딩 위에서 20개의 실제
  순위 검색 사례를 실행하고 `docs/retrieval-quality-report.md`를 쓴다.
- 현재 샘플 문서 결과: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke`는 같은 20개 순위 사례를 키워드 전용,
  벡터 전용, hybrid 검색으로 실행하고
  `docs/retrieval-mode-comparison-report.md`를 쓴다.
- 현재 모드 비교 결과: lexical-only recall@3 `15/20`, MRR `0.750`;
  vector-only recall@3 `20/20`, MRR `0.975`; hybrid recall@3 `20/20`, MRR
  `1.000`.
- `pnpm db:retrieval-latency-smoke`는 같은 20개 사례를 측정하고 임베딩,
  키워드 SQL, 벡터 SQL, hybrid SQL의 집계 시간을 분리해
  `docs/retrieval-latency-report.md`에 쓴다. 정리된 보고서만으로 품질과
  지연 시간 절충을 볼 수 있게 한다.
- 현재 지연 시간 결과: 임베딩 P50 `273.99ms`, P95 `416.82ms`;
  키워드 SQL P50 `1.97ms`; 벡터 SQL P50 `0.81ms`; hybrid SQL P50 `3.80ms`.
  현재 실행에서는 임베딩이 지배 비용이며, SQL 검색 비용과 임베딩 비용이
  분리되어 보인다.
- `pnpm db:retrieval-concurrency-smoke`는 임베딩을 미리 계산한 뒤,
  동시성 `1`과 `4`에서 PostgreSQL 키워드, 벡터, hybrid 검색을
  측정하고 `docs/retrieval-concurrency-report.md`를 쓴다.
- 현재 동시성 결과, 동시성 `4`: 키워드 P50 `0.93ms`, P95
  `7.94ms`, P99 `8.89ms`; 벡터 P50 `2.06ms`, P95 `9.29ms`, P99 `9.88ms`;
  hybrid P50 `2.48ms`, P95 `10.53ms`, P99 `12.99ms`; 모든 행 오류 `0`.
- 해석: 식별자 인식 키워드 검색은 exact-token 범주 `5/5`를 통과한다.
  하지만 answer-guard, retrieval-design, version-conflict 일부는 여전히 놓친다.
  Hybrid는 벡터 수준의 recall을 유지하면서 놓친 벡터 순위 위치를 회복한다.
  Hybrid를 기본값으로 유지하는 이유는 정확 용어와 의미 순위 신호가 같은
  추적 기록에 남아, 약어, 희귀 용어, ID, 임베딩 변화로 확장할 때 판단 근거가
  보이기 때문이다.
- PostgreSQL RRF는 작은 원본 rank-fusion 값을 반환하므로 API 경로는 현재 단순한
  rank 기반 0..1 answer confidence calibration을 적용한다.
- 측정 범위: 위 결과는 공개 샘플 문서 기반 관측이다. 운영 성능이나 점수 우위를
  주장하기 위한 값이 아니라 선택 근거를 남기기 위한 기록이다.

## 확장 시 다시 볼 것

PostgreSQL full-text search와 OpenSearch BM25를 비교하고 recall, 지연 시간,
운영 비용을 측정한다.
