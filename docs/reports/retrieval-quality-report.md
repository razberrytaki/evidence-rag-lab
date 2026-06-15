# 검색 품질 리포트

대상: 공개 샘플 문서. 경로: 실제 PostgreSQL + pgvector 순위 검색.

요약: 20/20 순위 검색 사례 통과.

## 주요 결과

- hybrid 검색 recall@3 20/20, MRR 1.000.
- 사례 표는 통과 여부보다 어떤 문서가 몇 번째 순위에 들어왔는지 확인하는 근거다.

## 읽는 법

- 절대 점수보다 기대 문서가 top 3 안에 들어왔는지와 순위 위치를 본다.

| 지표 | 결과 | 비율 |
|---|---:|---:|
| recall@3 | 20/20 | 100% |
| MRR | 1.000 | |

| 사례 | 상태 | 매칭 문서 | 역순위 | 메모 |
|---|---|---|---:|---|
| hybrid-retrieval | 통과 | hybrid-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |
| pgvector-hnsw | 통과 | pgvector-indexing-note | 1.000 | 첫 관련 문서 순위 1 |
| deployment-policy-current | 통과 | deployment-policy-v2 | 1.000 | 첫 관련 문서 순위 1 |
| prompt-injection-document-text | 통과 | prompt-injection-note | 1.000 | 첫 관련 문서 순위 1 |
| deployment-policy-stale | 통과 | deployment-policy-v1 | 1.000 | 첫 관련 문서 순위 1 |
| chunking-boundary | 통과 | chunking-strategy-note | 1.000 | 첫 관련 문서 순위 1 |
| parent-child-retrieval | 통과 | parent-child-retrieval-note | 1.000 | 첫 관련 문서 순위 1 |
| reranker-latency-budget | 통과 | reranker-latency-note | 1.000 | 첫 관련 문서 순위 1 |
| source-trust-score | 통과 | source-trust-note | 1.000 | 첫 관련 문서 순위 1 |
| citation-validation | 통과 | citation-validation-note | 1.000 | 첫 관련 문서 순위 1 |
| insufficient-evidence-rejection | 통과 | insufficient-evidence-note | 1.000 | 첫 관련 문서 순위 1 |
| trace-observability | 통과 | trace-observability-note | 1.000 | 첫 관련 문서 순위 1 |
| retrieval-cache-invalidation | 통과 | retrieval-cache-note | 1.000 | 첫 관련 문서 순위 1 |
| version-history | 통과 | version-history-note | 1.000 | 첫 관련 문서 순위 1 |
| duplicate-detection | 통과 | duplicate-detection-note | 1.000 | 첫 관련 문서 순위 1 |
| rag-query-mode-config-key | 통과 | config-key-routing-note | 1.000 | 첫 관련 문서 순위 1 |
| unknown-chunk-error-code | 통과 | error-code-runbook-note | 1.000 | 첫 관련 문서 순위 1 |
| selected-chunk-ids-field | 통과 | api-field-contract-note | 1.000 | 첫 관련 문서 순위 1 |
| rrf-acronym-collision | 통과 | acronym-collision-note | 1.000 | 첫 관련 문서 순위 1 |
| runbook-id-rollback | 통과 | runbook-id-rollback-note | 1.000 | 첫 관련 문서 순위 1 |
