# 포트폴리오 개요

## 문제의식

RAG 프로젝트는 종종 “좋은 모델을 붙이면 답이 좋아진다”는 식으로 설명된다. 하지만
실제 문제는 모델보다 앞단에 있다. 어떤 문서를 가져왔는지, 그 문서가 믿을 만한지,
답이 그 문서 안에서만 나왔는지, 근거가 부족할 때 멈출 수 있는지가 더 중요하다.

EvidenceRAG Lab은 이 지점을 포트폴리오로 보여주기 위한 프로젝트다. 큰 시스템을
흉내 내기보다, 대규모 RAG 설계에서 필요한 판단을 실행 가능한 단위로 나눴다.

## 설계 목표

- 근거 없는 답변보다 명시적 실패를 선호한다.
- 검색 품질과 생성 품질을 섞어 보지 않는다.
- 수치가 작더라도 어떤 경계에서 측정했는지 분리한다.
- 공개 저장소에 올릴 수 없는 데이터와 로그는 구조적으로 남기지 않는다.
- “나중에 대규모로 바꿀 부분”과 “지금 검증한 부분”을 문서에서 구분한다.

## 핵심 선택

### 1. 벡터 검색만 사용하지 않는다

의미가 비슷한 문장을 찾는 데는 벡터 검색이 유리하다. 하지만 설정 키, API field,
오류 코드, 약어, runbook ID처럼 정확한 문자열이 중요한 경우에는 lexical 검색이
필요하다.

그래서 PostgreSQL full-text search, exact-token matching, pgvector 검색을 함께
사용하고 reciprocal rank fusion으로 결과를 합친다.

관련 문서: [하이브리드 검색 결정](decisions/02-hybrid-retrieval.md)

### 2. 생성은 검색 결과 안에 묶는다

답변 생성은 선택된 context 안에서만 허용한다. provider가 citation을 반환하더라도
그 citation이 실제 선택된 chunk를 가리키지 않으면 reject한다.

이 방식은 유용한 답변을 일부 놓칠 수 있다. 하지만 이 프로젝트의 목적은 그럴듯한
답변보다 검증 가능한 답변이다.

관련 문서: [Answer Guard 결정](decisions/06-answer-guard.md)

### 3. 실패를 제품 동작으로 취급한다

근거가 부족하거나 citation이 깨지면 “충분한 근거 없음”으로 끝난다. 이는 예외 상황이
아니라 RAG 시스템이 가져야 할 정상 동작이다.

eval fixture에는 insufficient evidence, unsupported claim, prompt injection 같은 실패
case를 포함했다.

관련 리포트: [평가 리포트](eval-report.md)

### 4. trace는 남기되 raw data는 남기지 않는다

debugging에는 trace가 필요하다. 하지만 full provider prompt, raw context bundle,
provider response를 그대로 저장하면 공개 저장소와 production privacy boundary 모두에서
위험하다.

이 프로젝트는 sanitized trace만 저장한다. candidate score, 선택 여부, 거절 이유,
rerank 결과, redacted user query preview는 남기고 원문 chunk와 provider raw response는
남기지 않는다.

관련 문서: [Trace Retention and Privacy 결정](decisions/10-trace-retention-and-privacy.md)

### 5. 대규모 주장은 하지 않고, 대규모 질문을 계산한다

1천만 문서 처리는 실제 load test 없이 주장할 수 없다. 대신 document 수, chunk 수,
embedding dimension, trace retention 같은 assumption을 명시하고 저장 공간과 index
pressure를 계산한다.

이 숫자는 성능 claim이 아니라 설계 대화를 위한 출발점이다.

관련 문서: [10M 규모 확장 추론 노트](scale-to-10m.md)

## 검증한 것

- 15개 deterministic eval fixture가 모두 통과한다.
- 20개 retrieval quality case에서 현재 sample set 기준 recall@3와 MRR을 측정한다.
- lexical-only, vector-only, hybrid retrieval을 같은 case로 비교한다.
- embedding latency와 PostgreSQL retrieval latency를 분리해 본다.
- concurrency `1`과 `4`에서 DB retrieval 구간을 분리해 측정한다.
- web에서 `/query`를 실행하고 normalized Provider Response, claim/citation count,
  selected chunk ids를 표시한다.
- public repo scanner가 secret, raw trace, 과장 claim, publication gate 누락을 잡는다.

자세한 수치는 generated report에 남긴다. README에는 결론만 두고, 증거는 report로
분리한다.

## 읽는 순서

1. 이 문서에서 문제의식과 설계 목표를 본다.
2. 관심 있는 trade-off만 `docs/decisions/`에서 확인한다.
3. 수치 근거가 필요하면 `docs/*-report.md`를 본다.
4. 공개 가능성은 `docs/publication-checklist.md`와 `docs/security/public-repo-hygiene.md`를 본다.

## 다음 단계

- 한국어 query와 영어 query의 검색 결과 차이를 별도 report로 만든다.
- deterministic reranker를 cross-encoder 또는 ColBERT 계열 reranker와 비교한다.
- 더 큰 synthetic document set으로 index size, latency, recall 변화를 측정한다.
- trace retention cleanup을 scheduled job 형태로 옮긴다.
