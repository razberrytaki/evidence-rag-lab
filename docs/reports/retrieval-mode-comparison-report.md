# 검색 모드 비교 리포트

대상: 공개 샘플 문서. 경로: 실제 PostgreSQL 검색 모드 비교.
목적: 키워드, 벡터, hybrid 검색 모드의 절충 확인.

## 읽는 법

- 모드별 승패보다 키워드, 벡터, hybrid가 어느 범주에서 차이 나는지 본다.

## 주요 결과

- 키워드 검색은 recall@3 8/20, MRR 0.400로 정확 토큰 신호를 확인한다.
- 벡터 검색은 recall@3 20/20, MRR 0.975로 의미 검색 기준선을 확인한다.
- hybrid는 recall@3 20/20, MRR 1.000로 순위 결합 결과를 확인한다.

| 모드 | Recall | 비율 | MRR |
|---|---:|---:|---:|
| lexical | 8/20 | 40% | 0.400 |
| vector | 20/20 | 100% | 0.975 |
| hybrid | 20/20 | 100% | 1.000 |

| 범주 | 모드 | Recall | 비율 | MRR |
|---|---|---:|---:|---:|
| answer-guard | lexical | 1/3 | 33% | 0.333 |
| exact-token | lexical | 0/5 | 0% | 0.000 |
| retrieval-design | lexical | 1/4 | 25% | 0.250 |
| semantic | lexical | 1/2 | 50% | 0.500 |
| trust-observability | lexical | 3/3 | 100% | 1.000 |
| version-conflict | lexical | 2/3 | 67% | 0.667 |
| answer-guard | vector | 3/3 | 100% | 1.000 |
| exact-token | vector | 5/5 | 100% | 1.000 |
| retrieval-design | vector | 4/4 | 100% | 1.000 |
| semantic | vector | 2/2 | 100% | 1.000 |
| trust-observability | vector | 3/3 | 100% | 0.833 |
| version-conflict | vector | 3/3 | 100% | 1.000 |
| answer-guard | hybrid | 3/3 | 100% | 1.000 |
| exact-token | hybrid | 5/5 | 100% | 1.000 |
| retrieval-design | hybrid | 4/4 | 100% | 1.000 |
| semantic | hybrid | 2/2 | 100% | 1.000 |
| trust-observability | hybrid | 3/3 | 100% | 1.000 |
| version-conflict | hybrid | 3/3 | 100% | 1.000 |

| 사례 | 모드 | 범주 | 상태 | 매칭 문서 | 역순위 | 메모 |
|---|---|---|---|---|---:|---|
| hybrid-retrieval | lexical | semantic | 통과 | hybrid-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |
| pgvector-hnsw | lexical | semantic | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: pgvector-indexing-note |
| deployment-policy-current | lexical | version-conflict | 통과 | deployment-policy-v2 | 1.000 | 첫 관련 문서 순위 1 |
| prompt-injection-document-text | lexical | answer-guard | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: prompt-injection-note |
| deployment-policy-stale | lexical | version-conflict | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: deployment-policy-v1 |
| chunking-boundary | lexical | retrieval-design | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: chunking-strategy-note |
| parent-child-retrieval | lexical | retrieval-design | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: parent-child-retrieval-note |
| reranker-latency-budget | lexical | retrieval-design | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: reranker-latency-note |
| source-trust-score | lexical | trust-observability | 통과 | source-trust-note | 1.000 | 첫 관련 문서 순위 1 |
| citation-validation | lexical | answer-guard | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: citation-validation-note |
| insufficient-evidence-rejection | lexical | answer-guard | 통과 | insufficient-evidence-note | 1.000 | 첫 관련 문서 순위 1 |
| trace-observability | lexical | trust-observability | 통과 | trace-observability-note | 1.000 | 첫 관련 문서 순위 1 |
| retrieval-cache-invalidation | lexical | retrieval-design | 통과 | retrieval-cache-note | 1.000 | 첫 관련 문서 순위 1 |
| version-history | lexical | version-conflict | 통과 | version-history-note | 1.000 | 첫 관련 문서 순위 1 |
| duplicate-detection | lexical | trust-observability | 통과 | duplicate-detection-note | 1.000 | 첫 관련 문서 순위 1 |
| rag-query-mode-config-key | lexical | exact-token | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: config-key-routing-note |
| unknown-chunk-error-code | lexical | exact-token | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: error-code-runbook-note |
| selected-chunk-ids-field | lexical | exact-token | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: api-field-contract-note |
| rrf-acronym-collision | lexical | exact-token | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: acronym-collision-note |
| runbook-id-rollback | lexical | exact-token | 실패 | - | 0.000 | top 3 안에 관련 문서 없음: runbook-id-rollback-note |
| hybrid-retrieval | vector | semantic | 통과 | hybrid-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |
| pgvector-hnsw | vector | semantic | 통과 | pgvector-indexing-note | 1.000 | 첫 관련 문서 순위 1 |
| deployment-policy-current | vector | version-conflict | 통과 | deployment-policy-v2 | 1.000 | 첫 관련 문서 순위 1 |
| prompt-injection-document-text | vector | answer-guard | 통과 | prompt-injection-note | 1.000 | 첫 관련 문서 순위 1 |
| deployment-policy-stale | vector | version-conflict | 통과 | deployment-policy-v1 | 1.000 | 첫 관련 문서 순위 1 |
| chunking-boundary | vector | retrieval-design | 통과 | chunking-strategy-note | 1.000 | 첫 관련 문서 순위 1 |
| parent-child-retrieval | vector | retrieval-design | 통과 | parent-child-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |
| reranker-latency-budget | vector | retrieval-design | 통과 | reranker-latency-note | 1.000 | 첫 관련 문서 순위 1 |
| source-trust-score | vector | trust-observability | 통과 | source-trust-note | 1.000 | 첫 관련 문서 순위 1 |
| citation-validation | vector | answer-guard | 통과 | citation-validation-note | 1.000 | 첫 관련 문서 순위 1 |
| insufficient-evidence-rejection | vector | answer-guard | 통과 | insufficient-evidence-note | 1.000 | 첫 관련 문서 순위 1 |
| trace-observability | vector | trust-observability | 통과 | trace-observability-note | 0.500 | 첫 관련 문서 순위 2 |
| retrieval-cache-invalidation | vector | retrieval-design | 통과 | retrieval-cache-note | 1.000 | 첫 관련 문서 순위 1 |
| version-history | vector | version-conflict | 통과 | version-history-note | 1.000 | 첫 관련 문서 순위 1 |
| duplicate-detection | vector | trust-observability | 통과 | duplicate-detection-note | 1.000 | 첫 관련 문서 순위 1 |
| rag-query-mode-config-key | vector | exact-token | 통과 | config-key-routing-note | 1.000 | 첫 관련 문서 순위 1 |
| unknown-chunk-error-code | vector | exact-token | 통과 | error-code-runbook-note | 1.000 | 첫 관련 문서 순위 1 |
| selected-chunk-ids-field | vector | exact-token | 통과 | api-field-contract-note | 1.000 | 첫 관련 문서 순위 1 |
| rrf-acronym-collision | vector | exact-token | 통과 | acronym-collision-note | 1.000 | 첫 관련 문서 순위 1 |
| runbook-id-rollback | vector | exact-token | 통과 | runbook-id-rollback-note | 1.000 | 첫 관련 문서 순위 1 |
| hybrid-retrieval | hybrid | semantic | 통과 | hybrid-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |
| pgvector-hnsw | hybrid | semantic | 통과 | pgvector-indexing-note | 1.000 | 첫 관련 문서 순위 1 |
| deployment-policy-current | hybrid | version-conflict | 통과 | deployment-policy-v2 | 1.000 | 첫 관련 문서 순위 1 |
| prompt-injection-document-text | hybrid | answer-guard | 통과 | prompt-injection-note | 1.000 | 첫 관련 문서 순위 1 |
| deployment-policy-stale | hybrid | version-conflict | 통과 | deployment-policy-v1 | 1.000 | 첫 관련 문서 순위 1 |
| chunking-boundary | hybrid | retrieval-design | 통과 | chunking-strategy-note | 1.000 | 첫 관련 문서 순위 1 |
| parent-child-retrieval | hybrid | retrieval-design | 통과 | parent-child-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |
| reranker-latency-budget | hybrid | retrieval-design | 통과 | reranker-latency-note | 1.000 | 첫 관련 문서 순위 1 |
| source-trust-score | hybrid | trust-observability | 통과 | source-trust-note | 1.000 | 첫 관련 문서 순위 1 |
| citation-validation | hybrid | answer-guard | 통과 | citation-validation-note | 1.000 | 첫 관련 문서 순위 1 |
| insufficient-evidence-rejection | hybrid | answer-guard | 통과 | insufficient-evidence-note | 1.000 | 첫 관련 문서 순위 1 |
| trace-observability | hybrid | trust-observability | 통과 | trace-observability-note | 1.000 | 첫 관련 문서 순위 1 |
| retrieval-cache-invalidation | hybrid | retrieval-design | 통과 | retrieval-cache-note | 1.000 | 첫 관련 문서 순위 1 |
| version-history | hybrid | version-conflict | 통과 | version-history-note | 1.000 | 첫 관련 문서 순위 1 |
| duplicate-detection | hybrid | trust-observability | 통과 | duplicate-detection-note | 1.000 | 첫 관련 문서 순위 1 |
| rag-query-mode-config-key | hybrid | exact-token | 통과 | config-key-routing-note | 1.000 | 첫 관련 문서 순위 1 |
| unknown-chunk-error-code | hybrid | exact-token | 통과 | error-code-runbook-note | 1.000 | 첫 관련 문서 순위 1 |
| selected-chunk-ids-field | hybrid | exact-token | 통과 | api-field-contract-note | 1.000 | 첫 관련 문서 순위 1 |
| rrf-acronym-collision | hybrid | exact-token | 통과 | acronym-collision-note | 1.000 | 첫 관련 문서 순위 1 |
| runbook-id-rollback | hybrid | exact-token | 통과 | runbook-id-rollback-note | 1.000 | 첫 관련 문서 순위 1 |

## 메모

- 실행 맥락: pnpm db:retrieval-compare-smoke, 공개 샘플 문서, 20개 검색 사례, 로컬 PostgreSQL 연결.
- 식별자 인식 키워드 검색은 이제 exact-token 압력 범주를 통과한다.
- 벡터 전용 검색은 모든 기대 문서를 찾지만 trace-observability 범주에서 순위 위치 하나를 잃는다.
- Hybrid는 이 20개 문서 동작 확인에서 벡터 전용 검색과 같은 recall을 유지하면서 MRR을 1.000으로 복구한다.
