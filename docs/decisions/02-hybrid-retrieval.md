# Decision: Hybrid Retrieval

## Context

Vector search handles semantic matches. Lexical search protects exact terms.

## Recommended choice

Use PostgreSQL full-text search plus identifier-aware exact-token matching plus
pgvector, combined by reciprocal rank fusion.

## Alternatives considered

- vector-only retrieval
- lexical-only retrieval
- weighted score fusion

## Trade-off

Reciprocal rank fusion avoids early score calibration work and makes ranking
easier to explain in the trace viewer. Identifier-aware lexical matching handles
config keys, API fields, error codes, acronyms, and runbook IDs that PostgreSQL
full-text search alone can miss. The result is still sample-doc specific and
must be re-evaluated before production.

## Evaluation evidence

- Use `exact-term-retrieval`, `semantic-paraphrase`, and `hybrid-rescue`.
- `apps/api/src/postgres-rag.pipeline.ts` routes `/query` through PostgreSQL
  retrieval when `RAG_QUERY_MODE=postgres`.
- `pnpm db:live-smoke` verifies the OpenAI embedding + PostgreSQL retrieval
  path over the sample chunks, but this remains a smoke check rather than a
  quality benchmark.
- `pnpm db:quality-smoke` runs 20 live ranked retrieval cases over stored
  sample-doc embeddings and writes `docs/retrieval-quality-report.md`.
- Current sample-doc result: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke` runs the same 20 ranked cases through
  lexical-only, vector-only, and hybrid retrieval and writes
  `docs/retrieval-mode-comparison-report.md`.
- Current mode comparison result: lexical-only recall@3 `14/20`, MRR `0.700`;
  vector-only recall@3 `20/20`, MRR `0.975`; hybrid recall@3 `20/20`, MRR
  `1.000`.
- `pnpm db:retrieval-latency-smoke` measures the same 20 cases and writes
  `docs/retrieval-latency-report.md` with separate aggregate timings for
  embedding, lexical SQL, vector SQL, and hybrid SQL. This keeps quality and
  latency trade-offs visible without logging raw queries or provider payloads.
- Current local latency smoke result: embedding P50 `147.91ms`, P95 `164.35ms`;
  lexical SQL P50 `2.59ms`; vector SQL P50 `2.08ms`; hybrid SQL P50 `1.32ms`.
  This says embedding dominates the current tiny sample run. It does not imply
  hybrid SQL will stay fastest at larger scale.
- `pnpm db:retrieval-concurrency-smoke` precomputes embeddings, then measures
  PostgreSQL lexical, vector, and hybrid retrieval at concurrency `1` and `4`.
  It writes `docs/retrieval-concurrency-report.md` without query text, provider
  payloads, prompts, or credentials.
- Current local concurrency smoke at concurrency `4`: lexical P50 `1.01ms`, P95
  `9.18ms`, P99 `9.35ms`; vector P50 `1.75ms`, P95 `9.12ms`, P99 `9.92ms`;
  hybrid P50 `2.28ms`, P95 `10.08ms`, P99 `11.10ms`; all rows had `0` errors.
  This is a small local smoke, not a load benchmark.
- Interpretation: identifier-aware lexical retrieval now passes the exact-token
  category `5/5`, but still misses semantic and answer-guard cases. Hybrid
  preserves vector-level recall while recovering the missed vector rank position.
  It is still a small smoke, not a production benchmark. Hybrid remains the
  default because exact-term and semantic rank signals stay visible in the same
  trace, which is useful when scaling into acronyms, rare terms, IDs, and
  embedding drift.
- PostgreSQL RRF returns small raw rank-fusion values, so the API path currently
  applies a simple rank-based 0..1 answer confidence calibration. This is an MVP
  gate, not a production scoring claim.

## Follow-up if scaling to 10M

Compare PostgreSQL full-text search against OpenSearch BM25 and measure recall,
latency, and operational cost.
