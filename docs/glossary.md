# 용어표

이 문서는 README와 portfolio 문서의 반복 용어를 줄이기 위한 기준이다. 코드 식별자,
환경 변수, API path, metric 이름은 원문을 유지한다.

## RAG

검색으로 근거 문서를 가져온 뒤, 그 근거를 바탕으로 답변을 생성하는 구조다. 이
프로젝트에서는 “답변 생성”보다 “근거 확인”을 더 중요한 설계 목표로 둔다.

## 청크

검색과 인용의 단위로 나눈 문서 조각이다. 너무 작으면 문맥이 사라지고, 너무 크면
검색 정밀도가 떨어진다.

## 하이브리드 검색

lexical 검색과 vector 검색을 함께 사용하는 방식이다. 이 프로젝트에서는 정확한
문자열을 보호하기 위해 lexical 검색을 쓰고, 의미적으로 가까운 표현을 찾기 위해
vector 검색을 쓴다.

## Lexical 검색

문자열과 토큰 중심의 검색이다. 설정 키, API field, 오류 코드, 약어처럼 정확한
표현이 중요한 경우에 유리하다.

## Vector 검색

embedding vector의 거리를 기준으로 의미적으로 가까운 문서를 찾는 검색이다. 표현이
달라도 의미가 비슷한 query를 처리하는 데 유리하다.

## Reciprocal Rank Fusion

여러 검색 결과의 순위를 합치는 방법이다. 서로 다른 점수 체계를 바로 비교하지 않고,
순위 기반으로 결과를 섞을 수 있어 MVP에서 설명하기 쉽다.

## Reranking

검색된 candidate를 생성에 넣기 전에 다시 정렬하는 단계다. 이 프로젝트는 먼저
deterministic reranker로 경계를 만들고, 나중에 model-based reranker와 비교할 수 있게
했다.

## Citation

답변의 각 claim이 어떤 chunk를 근거로 삼는지 나타내는 연결이다. provider가 citation을
반환하더라도 선택된 context에 없는 chunk를 가리키면 reject한다.

## Source trust

검색된 chunk가 얼마나 믿을 만한지 보는 점수다. source type, freshness, duplicate
penalty, retrieval agreement 같은 signal을 사용한다.

## Trace

query가 어떤 candidate를 찾았고, 어떤 점수로 선택 또는 거절했는지 남기는 기록이다.
이 프로젝트에서는 sanitized trace만 저장한다.

## Sanitized trace

debugging에 필요한 구조만 남기고 full provider prompt, raw context bundle, provider
raw response, secret을 제거한 trace다.

## Fixture

RAG 동작을 반복 검증하기 위한 테스트 입력과 기대 결과다. 일반적인 unit test처럼
pass/fail을 만들지만, 검색과 생성의 품질 경계를 검증한다는 점이 다르다.

## 동작 확인

완전한 benchmark가 아니라 특정 경로가 실제로 동작하는지 확인하는 작은 검증이다.
이 프로젝트의 live DB 동작 확인은 production 성능 claim이 아니다.

## Benchmark

대표 데이터, 충분한 규모, 반복 측정, error budget, cache 조건 등을 갖춘 성능 평가다.
현재 report들은 benchmark가 아니라 작은 동작 확인 또는 sizing math다.
