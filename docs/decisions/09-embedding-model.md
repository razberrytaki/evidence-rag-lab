# Decision: Embedding Model

## Context

Embedding model choice affects vector dimension, index shape, latency, and cost.

## Recommended choice

Use OpenAI `text-embedding-3-small` with 1536 dimensions.

## Alternatives considered

- `text-embedding-3-large`
- down-projection with the `dimensions` parameter

## Trade-off

The small model lowers cost and storage while keeping the MVP focused on
reliability behavior. Changing the dimension later requires re-embedding and
index rebuild.

## Evaluation evidence

- `OpenAIEmbeddingClient` is tested with an injected `fetch` implementation, so
  CI verifies request shape without calling the provider.
- `loadEmbeddedMarkdownDocumentSet` verifies sample chunks can be enriched with
  embeddings before PostgreSQL upsert.
- `pnpm db:live-smoke` verifies a real-key path: sample docs are embedded with
  `text-embedding-3-small`, sample chunks are stored with non-null vectors, and the
  DB-backed query path returns an answered result.
- `pnpm db:quality-smoke` runs 20 live ranked retrieval cases over stored
  sample-doc embeddings. Current sample result: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke` shows vector-only recall@3 `20/20`, MRR
  `0.975` on the same sample set. This is strong enough for the MVP, but not a
  replacement for larger embedding model comparison.

## Follow-up if scaling to 10M

Evaluate cost per re-embedding run, index memory, and quality delta.
