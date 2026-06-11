# Decision: Reranking

## Context

Approximate retrieval can return noisy candidates.

## Recommended choice

Define a reranker interface and begin with a lightweight deterministic reranker.

## Alternatives considered

- cross-encoder reranker
- ColBERT late interaction
- LLM reranking

## Trade-off

A lightweight reranker is easy to test and explain. Model-based rerankers can
improve relevance but add cost, latency, and provider dependency.

The current implementation uses deterministic query-token evidence coverage,
the existing calibrated retrieval prior, and trust score. It annotates
`rerankScore` and `rerankRank`, then the API selection gate still applies
retrieval confidence and source trust thresholds before generation.

This keeps the MVP honest: it proves the reranking boundary and trace shape
without implying model-grade relevance. Cross-encoder, ColBERT, or LLM rerankers
can replace the scoring function later without changing generation or trace
storage contracts.

## Evaluation evidence

- `rerankByQueryEvidence` reranks candidates by query evidence while preserving
  original lexical and vector ranks.
- `apps/api/src/postgres-rag.pipeline.ts` reranks PostgreSQL candidates before
  selecting generation context.
- `apps/web/src/queryTrace.ts` displays `rerankRank` and `rerankScore` when a
  persisted sanitized trace includes them.
- Tests cover a generic vector-first candidate being demoted behind a more
  query-specific reranker latency candidate.
- This is still deterministic reranking, not a model-quality benchmark.

## Follow-up if scaling to 10M

Benchmark reranking latency budget separately from retrieval latency. Compare
the deterministic baseline against cross-encoder, ColBERT late interaction, and
LLM reranking under fixed candidate counts and timeout budgets.
