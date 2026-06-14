# 결정: Reranking

## 맥락

approximate retrieval은 noisy candidate를 반환할 수 있다.

## 권장 선택

reranker interface를 정의하고, 가벼운 deterministic reranker로 시작한다.

## 검토한 대안

- cross-encoder reranker
- ColBERT late interaction
- LLM reranking

## 트레이드오프

가벼운 reranker는 테스트하고 설명하기 쉽다. model-based reranker는 relevance를
개선할 수 있지만 비용, latency, provider dependency를 추가한다.

현재 구현은 deterministic query-token evidence coverage, 기존 calibrated
retrieval prior, trust score를 사용한다. `rerankScore`와 `rerankRank`를 기록하되
`retrievalScore`를 덮어쓰지 않는다. API selection gate는 generation 전에
retrieval confidence, query-evidence rerank score, source trust threshold를 모두
적용한다.

이 선택은 MVP를 과장하지 않게 한다. model-grade relevance를 암시하지 않고도
reranking boundary와 trace shape를 증명한다. Cross-encoder, ColBERT, LLM
reranker는 나중에 generation이나 trace storage contract를 바꾸지 않고 scoring
function만 대체할 수 있다.

## 평가 근거

- `rerankByQueryEvidence`는 original lexical/vector rank를 보존하면서 query
  evidence 기준으로 candidate를 rerank한다.
- `apps/api/src/postgres-rag.pipeline.ts`는 generation context를 선택하기 전에
  PostgreSQL candidate를 rerank하고 low query-evidence candidate를 제외한다.
- `apps/web/src/queryTrace.ts`는 persisted sanitized trace에 `rerankRank`와
  `rerankScore`가 있으면 이를 표시한다.
- test는 generic vector-first candidate가 더 query-specific한 reranker latency
  candidate 뒤로 내려가는 경우를 다룬다.
- 현재 단계는 deterministic reranking 검증이다. model-quality 비교는 후속 과제다.

## 10M 규모 확장 시 후속 작업

reranking latency budget을 retrieval latency와 분리해 benchmark한다. 고정된
candidate count와 timeout budget 아래에서 deterministic baseline을 cross-encoder,
ColBERT late interaction, LLM reranking과 비교한다.
