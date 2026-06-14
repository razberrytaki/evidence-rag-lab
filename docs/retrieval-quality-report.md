# 검색 품질 리포트

public sample docs 위의 live PostgreSQL + pgvector retrieval observation에서 생성된다.
작은 품질 동작 확인이며 scale benchmark가 아니다.

요약: 20/20 ranked retrieval case 통과.

| Metric | 결과 | 비율 |
|---|---:|---:|
| recall@3 | 20/20 | 100% |
| mean reciprocal rank | 1.000 | |

| Case | 상태 | Matched doc | Reciprocal rank | 메모 |
|---|---|---|---:|---|
| hybrid-retrieval | 통과 | hybrid-retrieval-note | 1.000 | 첫 relevant doc rank 1 |
| pgvector-hnsw | 통과 | pgvector-indexing-note | 1.000 | 첫 relevant doc rank 1 |
| deployment-policy-current | 통과 | deployment-policy-v2 | 1.000 | 첫 relevant doc rank 1 |
| prompt-injection-document-text | 통과 | prompt-injection-note | 1.000 | 첫 relevant doc rank 1 |
| deployment-policy-stale | 통과 | deployment-policy-v1 | 1.000 | 첫 relevant doc rank 1 |
| chunking-boundary | 통과 | chunking-strategy-note | 1.000 | 첫 relevant doc rank 1 |
| parent-child-retrieval | 통과 | parent-child-retrieval-note | 1.000 | 첫 relevant doc rank 1 |
| reranker-latency-budget | 통과 | reranker-latency-note | 1.000 | 첫 relevant doc rank 1 |
| source-trust-score | 통과 | source-trust-note | 1.000 | 첫 relevant doc rank 1 |
| citation-validation | 통과 | citation-validation-note | 1.000 | 첫 relevant doc rank 1 |
| insufficient-evidence-rejection | 통과 | insufficient-evidence-note | 1.000 | 첫 relevant doc rank 1 |
| trace-observability | 통과 | trace-observability-note | 1.000 | 첫 relevant doc rank 1 |
| retrieval-cache-invalidation | 통과 | retrieval-cache-note | 1.000 | 첫 relevant doc rank 1 |
| version-history | 통과 | version-history-note | 1.000 | 첫 relevant doc rank 1 |
| duplicate-detection | 통과 | duplicate-detection-note | 1.000 | 첫 relevant doc rank 1 |
| rag-query-mode-config-key | 통과 | config-key-routing-note | 1.000 | 첫 relevant doc rank 1 |
| unknown-chunk-error-code | 통과 | error-code-runbook-note | 1.000 | 첫 relevant doc rank 1 |
| selected-chunk-ids-field | 통과 | api-field-contract-note | 1.000 | 첫 relevant doc rank 1 |
| rrf-acronym-collision | 통과 | acronym-collision-note | 1.000 | 첫 relevant doc rank 1 |
| runbook-id-rollback | 통과 | runbook-id-rollback-note | 1.000 | 첫 relevant doc rank 1 |
