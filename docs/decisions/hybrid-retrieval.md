# 결정: 하이브리드 검색

## 맥락

벡터 검색은 의미적으로 가까운 표현을 처리한다. 키워드 검색은 정확한 용어를 보호한다.

## 결정

PostgreSQL full-text search, 식별자 인식 정확 토큰 매칭, pgvector를 함께 사용하고 reciprocal rank fusion으로 결합한다.

## 검토한 대안

- 벡터 전용 검색
- 키워드 전용 검색
- 가중 점수 결합

## 트레이드오프

reciprocal rank fusion은 초기 점수 보정 부담을 줄이고, 추적 기록 화면에서 순위를 설명하기
쉽게 만든다. 식별자 인식 키워드 매칭은 PostgreSQL full-text search만으로 놓칠 수 있는
설정 키, API 필드, 오류 코드, 약어, 실행 문서 id를 처리한다. 현재 결과는 여전히 샘플
문서 기준이므로 운영 적용 전 재평가가 필요하다.

## 평가 근거

- `exact-term-retrieval`, `semantic-paraphrase`, `hybrid-rescue`를 사용한다.
- `apps/api/src/rag/postgres/postgres-rag.pipeline.ts`는 `RAG_QUERY_MODE=postgres`일 때
  `/query`를 PostgreSQL 검색 경로로 보낸다.
- `pnpm db:live-smoke`는 샘플 청크에 대해 OpenAI 임베딩 + PostgreSQL
  검색 경로를 검증한다.
- `pnpm db:quality-smoke`는 저장된 샘플 문서 임베딩 위에서 20개의 실제
  순위 검색 사례를 실행하고 `docs/reports/retrieval-quality-report.md`를 쓴다.
- 현재 샘플 문서 결과: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke`는 같은 20개 순위 사례를 키워드 전용,
  벡터 전용, hybrid 검색으로 실행하고
  `docs/reports/retrieval-mode-comparison-report.md`를 쓴다.
- 현재 모드 비교 결과: lexical-only recall@3 `8/20`, MRR `0.400`;
  vector-only recall@3 `20/20`, MRR `0.975`; hybrid recall@3 `20/20`, MRR
  `1.000`.
- `pnpm db:retrieval-latency-smoke`는 같은 20개 사례를 측정하고 임베딩,
  키워드 SQL, 벡터 SQL, hybrid SQL의 집계 시간을 분리해
  `docs/reports/retrieval-latency-report.md`에 쓴다. 정리된 보고서만으로 품질과
  지연 시간 절충을 볼 수 있게 한다.
- 현재 지연 시간 결과: 임베딩 P50 `250.31ms`, P95 `399.79ms`;
  키워드 SQL P50 `2.47ms`; 벡터 SQL P50 `1.58ms`; hybrid SQL P50 `1.79ms`.
  현재 실행에서는 임베딩이 지배 비용이며, SQL 검색 비용과 임베딩 비용이
  분리되어 보인다.
- `pnpm db:retrieval-concurrency-smoke`는 임베딩을 미리 계산한 뒤,
  동시성 `1`과 `4`에서 PostgreSQL 키워드, 벡터, hybrid 검색을
  측정하고 `docs/reports/retrieval-concurrency-report.md`를 쓴다.
- 현재 동시성 결과, 동시성 `4`: 키워드 P50 `1.00ms`, P95
  `8.98ms`, P99 `10.05ms`; 벡터 P50 `1.78ms`, P95 `8.66ms`, P99 `8.90ms`;
  hybrid P50 `2.45ms`, P95 `10.65ms`, P99 `11.88ms`; 모든 행 오류 `0`.
- 모드 비교의 lexical-only는 일반 키워드 기준선이라 exact-token 사례와
  answer-guard, retrieval-design, version-conflict 일부를 놓친다.
  Hybrid는 벡터 수준의 recall을 유지하면서 놓친 벡터 순위 위치를 회복한다.
  Hybrid를 기본값으로 유지하는 이유는 정확 용어와 의미 순위 신호가 같은
  추적 기록에 남아, 약어, 희귀 용어, ID, 임베딩 변화로 확장할 때 판단 근거가
  보이기 때문이다.
- PostgreSQL RRF 점수는 보정된 신뢰도가 아니라 순위 결합 점수이므로 API 경로에서
  답변 gate에 바로 쓰지 않는다. 현재는 순위 기반 `answerGateScore` proxy를
  별도 계산해 gate에만 사용하며, eval 기반 confidence calibration은 후속 과제로 남긴다.

## 확장 시 다시 볼 것

PostgreSQL full-text search와 OpenSearch BM25를 비교하고 recall, 지연 시간, 운영 비용을
측정한다. 운영 부하 시험에서는 더 큰 색인, 대표 질의 조합, warm/cold 캐시 분리,
연결 풀 제한, HNSW 매개변수, 명시적 오류 예산을 함께 본다.
