# Decision: PostgreSQL + pgvector

## Context

The MVP needs metadata, chunks, vectors, traces, and evaluation output.

## Recommended choice

Use PostgreSQL with pgvector and HNSW indexes for the lab runtime.

## Alternatives considered

- Qdrant
- OpenSearch vector search
- separate vector database

## Trade-off

One datastore keeps local reproduction simple. A dedicated vector database may
be better at larger scale but would dilute the MVP focus.

## Evaluation evidence

- The [pgvector README](https://github.com/pgvector/pgvector) documents exact
  and approximate nearest neighbor search, cosine distance, and HNSW indexes.
- `pnpm db:quality-smoke` runs live OpenAI query embeddings against stored
  sample-doc embeddings through PostgreSQL + pgvector.
- Current sample-doc result: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke` also measures vector-only retrieval against
  lexical-only and hybrid. Current sample-doc vector-only result: recall@3
  `20/20`, MRR `0.975`.
- `pnpm db:retrieval-latency-smoke` measures aggregate latency for one OpenAI
  embedding call per query plus PostgreSQL lexical, vector, and hybrid SQL over
  the same 20 cases.
- Current local latency smoke result: embedding P50 `147.91ms`, P95 `164.35ms`;
  lexical SQL P50 `2.59ms`; vector SQL P50 `2.08ms`; hybrid SQL P50 `1.32ms`.
  The useful signal is boundary separation: embedding cost is visible apart from
  SQL retrieval cost.
- `pnpm db:retrieval-concurrency-smoke` precomputes query embeddings and then
  runs PostgreSQL lexical, vector, and hybrid retrieval at concurrency `1` and
  `4`.
- Current local concurrency smoke at concurrency `4`: lexical P50 `1.01ms`, P95
  `9.18ms`, P99 `9.35ms`; vector P50 `1.75ms`, P95 `9.12ms`, P99 `9.92ms`;
  hybrid P50 `2.28ms`, P95 `10.08ms`, P99 `11.10ms`; all rows had `0` errors.
  This only checks the small local DB retrieval path under light concurrent
  pressure.
- `pnpm scale:report` writes `docs/scale-budget-report.md`. Current sizing math
  estimates `80,000,000` chunks and `491.52 GB` raw vector payloads for
  `10,000,000` documents at `8` chunks per document and `1536` float32
  dimensions.
- `pnpm index:report` writes `docs/vector-index-budget-report.md`. Current HNSW
  scenario assumes `m=16`, layer multiplier `1.10`, `8` graph bytes per
  neighbor, and build memory multiplier `2.00`; it estimates `11.26 GB` HNSW
  graph bytes, `584.70 GB` vector + metadata + graph serving bytes, and
  `1169.41 GB` build working set planning estimate.
- These are small quality, latency, and concurrency smokes, not a production
  scale benchmark.

## Follow-up if scaling to 10M

Revisit measured index memory, partitioning, backfill strategy, build memory,
p99 latency under load, and re-embedding cost.
