# Retrieval Quality Report

Generated from live PostgreSQL + pgvector retrieval observations on public sample docs.
This is a small quality smoke, not a scale benchmark.

Summary: 20/20 ranked retrieval cases passed.

| Metric | Result | Rate |
|---|---:|---:|
| recall@3 | 20/20 | 100% |
| mean reciprocal rank | 1.000 | |

| Case | Status | Matched doc | Reciprocal rank | Notes |
|---|---|---|---:|---|
| hybrid-retrieval | pass | hybrid-retrieval-note | 1.000 | first relevant doc at rank 1 |
| pgvector-hnsw | pass | pgvector-indexing-note | 1.000 | first relevant doc at rank 1 |
| deployment-policy-current | pass | deployment-policy-v2 | 1.000 | first relevant doc at rank 1 |
| prompt-injection-document-text | pass | prompt-injection-note | 1.000 | first relevant doc at rank 1 |
| deployment-policy-stale | pass | deployment-policy-v1 | 1.000 | first relevant doc at rank 1 |
| chunking-boundary | pass | chunking-strategy-note | 1.000 | first relevant doc at rank 1 |
| parent-child-retrieval | pass | parent-child-retrieval-note | 1.000 | first relevant doc at rank 1 |
| reranker-latency-budget | pass | reranker-latency-note | 1.000 | first relevant doc at rank 1 |
| source-trust-score | pass | source-trust-note | 1.000 | first relevant doc at rank 1 |
| citation-validation | pass | citation-validation-note | 1.000 | first relevant doc at rank 1 |
| insufficient-evidence-rejection | pass | insufficient-evidence-note | 1.000 | first relevant doc at rank 1 |
| trace-observability | pass | trace-observability-note | 1.000 | first relevant doc at rank 1 |
| retrieval-cache-invalidation | pass | retrieval-cache-note | 1.000 | first relevant doc at rank 1 |
| version-history | pass | version-history-note | 1.000 | first relevant doc at rank 1 |
| duplicate-detection | pass | duplicate-detection-note | 1.000 | first relevant doc at rank 1 |
| rag-query-mode-config-key | pass | config-key-routing-note | 1.000 | first relevant doc at rank 1 |
| unknown-chunk-error-code | pass | error-code-runbook-note | 1.000 | first relevant doc at rank 1 |
| selected-chunk-ids-field | pass | api-field-contract-note | 1.000 | first relevant doc at rank 1 |
| rrf-acronym-collision | pass | acronym-collision-note | 1.000 | first relevant doc at rank 1 |
| runbook-id-rollback | pass | runbook-id-rollback-note | 1.000 | first relevant doc at rank 1 |
