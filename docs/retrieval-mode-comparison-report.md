# Retrieval Mode Comparison Report

Generated from live PostgreSQL retrieval observations over the public sample docs.
This compares retrieval modes for portfolio trade-off evidence, not production scale.

| Mode | Recall | Rate | Mean reciprocal rank |
|---|---:|---:|---:|
| lexical | 14/20 | 70% | 0.700 |
| vector | 20/20 | 100% | 0.975 |
| hybrid | 20/20 | 100% | 1.000 |

| Category | Mode | Recall | Rate | Mean reciprocal rank |
|---|---|---:|---:|---:|
| answer-guard | lexical | 1/3 | 33% | 0.333 |
| exact-token | lexical | 5/5 | 100% | 1.000 |
| retrieval-design | lexical | 2/4 | 50% | 0.500 |
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

| Case | Mode | Category | Status | Matched doc | Reciprocal rank | Notes |
|---|---|---|---|---|---:|---|
| hybrid-retrieval | lexical | semantic | fail | - | 0.000 | missing relevant docs in top 3: hybrid-retrieval-note |
| pgvector-hnsw | lexical | semantic | pass | pgvector-indexing-note | 1.000 | first relevant doc at rank 1 |
| deployment-policy-current | lexical | version-conflict | pass | deployment-policy-v2 | 1.000 | first relevant doc at rank 1 |
| prompt-injection-document-text | lexical | answer-guard | fail | - | 0.000 | missing relevant docs in top 3: prompt-injection-note |
| deployment-policy-stale | lexical | version-conflict | fail | - | 0.000 | missing relevant docs in top 3: deployment-policy-v1 |
| chunking-boundary | lexical | retrieval-design | pass | chunking-strategy-note | 1.000 | first relevant doc at rank 1 |
| parent-child-retrieval | lexical | retrieval-design | fail | - | 0.000 | missing relevant docs in top 3: parent-child-retrieval-note |
| reranker-latency-budget | lexical | retrieval-design | fail | - | 0.000 | missing relevant docs in top 3: reranker-latency-note |
| source-trust-score | lexical | trust-observability | pass | source-trust-note | 1.000 | first relevant doc at rank 1 |
| citation-validation | lexical | answer-guard | fail | - | 0.000 | missing relevant docs in top 3: citation-validation-note |
| insufficient-evidence-rejection | lexical | answer-guard | pass | insufficient-evidence-note | 1.000 | first relevant doc at rank 1 |
| trace-observability | lexical | trust-observability | pass | trace-observability-note | 1.000 | first relevant doc at rank 1 |
| retrieval-cache-invalidation | lexical | retrieval-design | pass | retrieval-cache-note | 1.000 | first relevant doc at rank 1 |
| version-history | lexical | version-conflict | pass | version-history-note | 1.000 | first relevant doc at rank 1 |
| duplicate-detection | lexical | trust-observability | pass | duplicate-detection-note | 1.000 | first relevant doc at rank 1 |
| rag-query-mode-config-key | lexical | exact-token | pass | config-key-routing-note | 1.000 | first relevant doc at rank 1 |
| unknown-chunk-error-code | lexical | exact-token | pass | error-code-runbook-note | 1.000 | first relevant doc at rank 1 |
| selected-chunk-ids-field | lexical | exact-token | pass | api-field-contract-note | 1.000 | first relevant doc at rank 1 |
| rrf-acronym-collision | lexical | exact-token | pass | acronym-collision-note | 1.000 | first relevant doc at rank 1 |
| runbook-id-rollback | lexical | exact-token | pass | runbook-id-rollback-note | 1.000 | first relevant doc at rank 1 |
| hybrid-retrieval | vector | semantic | pass | hybrid-retrieval-note | 1.000 | first relevant doc at rank 1 |
| pgvector-hnsw | vector | semantic | pass | pgvector-indexing-note | 1.000 | first relevant doc at rank 1 |
| deployment-policy-current | vector | version-conflict | pass | deployment-policy-v2 | 1.000 | first relevant doc at rank 1 |
| prompt-injection-document-text | vector | answer-guard | pass | prompt-injection-note | 1.000 | first relevant doc at rank 1 |
| deployment-policy-stale | vector | version-conflict | pass | deployment-policy-v1 | 1.000 | first relevant doc at rank 1 |
| chunking-boundary | vector | retrieval-design | pass | chunking-strategy-note | 1.000 | first relevant doc at rank 1 |
| parent-child-retrieval | vector | retrieval-design | pass | parent-child-retrieval-note | 1.000 | first relevant doc at rank 1 |
| reranker-latency-budget | vector | retrieval-design | pass | reranker-latency-note | 1.000 | first relevant doc at rank 1 |
| source-trust-score | vector | trust-observability | pass | source-trust-note | 1.000 | first relevant doc at rank 1 |
| citation-validation | vector | answer-guard | pass | citation-validation-note | 1.000 | first relevant doc at rank 1 |
| insufficient-evidence-rejection | vector | answer-guard | pass | insufficient-evidence-note | 1.000 | first relevant doc at rank 1 |
| trace-observability | vector | trust-observability | pass | trace-observability-note | 0.500 | first relevant doc at rank 2 |
| retrieval-cache-invalidation | vector | retrieval-design | pass | retrieval-cache-note | 1.000 | first relevant doc at rank 1 |
| version-history | vector | version-conflict | pass | version-history-note | 1.000 | first relevant doc at rank 1 |
| duplicate-detection | vector | trust-observability | pass | duplicate-detection-note | 1.000 | first relevant doc at rank 1 |
| rag-query-mode-config-key | vector | exact-token | pass | config-key-routing-note | 1.000 | first relevant doc at rank 1 |
| unknown-chunk-error-code | vector | exact-token | pass | error-code-runbook-note | 1.000 | first relevant doc at rank 1 |
| selected-chunk-ids-field | vector | exact-token | pass | api-field-contract-note | 1.000 | first relevant doc at rank 1 |
| rrf-acronym-collision | vector | exact-token | pass | acronym-collision-note | 1.000 | first relevant doc at rank 1 |
| runbook-id-rollback | vector | exact-token | pass | runbook-id-rollback-note | 1.000 | first relevant doc at rank 1 |
| hybrid-retrieval | hybrid | semantic | pass | hybrid-retrieval-note | 1.000 | first relevant doc at rank 1 |
| pgvector-hnsw | hybrid | semantic | pass | pgvector-indexing-note | 1.000 | first relevant doc at rank 1 |
| deployment-policy-current | hybrid | version-conflict | pass | deployment-policy-v2 | 1.000 | first relevant doc at rank 1 |
| prompt-injection-document-text | hybrid | answer-guard | pass | prompt-injection-note | 1.000 | first relevant doc at rank 1 |
| deployment-policy-stale | hybrid | version-conflict | pass | deployment-policy-v1 | 1.000 | first relevant doc at rank 1 |
| chunking-boundary | hybrid | retrieval-design | pass | chunking-strategy-note | 1.000 | first relevant doc at rank 1 |
| parent-child-retrieval | hybrid | retrieval-design | pass | parent-child-retrieval-note | 1.000 | first relevant doc at rank 1 |
| reranker-latency-budget | hybrid | retrieval-design | pass | reranker-latency-note | 1.000 | first relevant doc at rank 1 |
| source-trust-score | hybrid | trust-observability | pass | source-trust-note | 1.000 | first relevant doc at rank 1 |
| citation-validation | hybrid | answer-guard | pass | citation-validation-note | 1.000 | first relevant doc at rank 1 |
| insufficient-evidence-rejection | hybrid | answer-guard | pass | insufficient-evidence-note | 1.000 | first relevant doc at rank 1 |
| trace-observability | hybrid | trust-observability | pass | trace-observability-note | 1.000 | first relevant doc at rank 1 |
| retrieval-cache-invalidation | hybrid | retrieval-design | pass | retrieval-cache-note | 1.000 | first relevant doc at rank 1 |
| version-history | hybrid | version-conflict | pass | version-history-note | 1.000 | first relevant doc at rank 1 |
| duplicate-detection | hybrid | trust-observability | pass | duplicate-detection-note | 1.000 | first relevant doc at rank 1 |
| rag-query-mode-config-key | hybrid | exact-token | pass | config-key-routing-note | 1.000 | first relevant doc at rank 1 |
| unknown-chunk-error-code | hybrid | exact-token | pass | error-code-runbook-note | 1.000 | first relevant doc at rank 1 |
| selected-chunk-ids-field | hybrid | exact-token | pass | api-field-contract-note | 1.000 | first relevant doc at rank 1 |
| rrf-acronym-collision | hybrid | exact-token | pass | acronym-collision-note | 1.000 | first relevant doc at rank 1 |
| runbook-id-rollback | hybrid | exact-token | pass | runbook-id-rollback-note | 1.000 | first relevant doc at rank 1 |

## Notes

- Identifier-aware lexical retrieval now passes the exact-token stress category.
- Vector-only retrieves every expected document but loses one rank position in the trace-observability category.
- Hybrid keeps recall equal to vector-only while restoring MRR to 1.000 on this 20-document smoke.
