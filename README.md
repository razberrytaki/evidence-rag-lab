# EvidenceRAG Lab

EvidenceRAG Lab is a small, reproducible RAG reliability lab. It demonstrates
hybrid retrieval, evidence-bound generation, citation coverage, unsupported-claim
rejection, and query traceability on public sample docs and synthetic failure
fixtures.

It does not claim to process 10M documents in production or guarantee zero
hallucination. The goal is to make retrieval quality, source trust, and failure
handling visible enough to reason about larger-scale RAG systems.

> Reliable RAG is not made by a stronger model alone. It is made by traceable
> evidence, measurable retrieval quality, and explainable failure.

## Current Scope

- pnpm workspace monorepo
- NestJS API with deterministic sample RAG pipeline
- Vite trace viewer for sanitized query traces
- Domain model and provider interfaces
- Deterministic `FakeLLMProvider` for CI and eval
- Initial 15-case eval fixture runner and report
- 20-document sample-docs set for retrieval quality smoke
- PostgreSQL + pgvector schema and Docker smoke path
- OpenAI-compatible embedding adapter contract
- Live OpenAI embedding smoke for sample-docs ingest and DB-backed query
- OpenAI-compatible and Anthropic live generation adapters with citation validation
- Live retrieval quality smoke for recall@3 and MRR on stored sample-doc embeddings
- Live retrieval mode comparison across lexical-only, vector-only, and hybrid retrieval
- Live retrieval latency smoke for embedding, lexical SQL, vector SQL, and hybrid SQL
- Live retrieval concurrency smoke for PostgreSQL lexical, vector, and hybrid retrieval
- Deterministic lightweight reranker before generation context selection
- 10M-document scale budget report with explicit sizing assumptions
- Vector index budget report with explicit HNSW graph assumptions
- Trace privacy policy with deterministic sampling and retention cleanup
- Public repo hygiene and readiness gates
- MIT license file aligned with package metadata

## Implementation Status

This repo is still an MVP lab, not a production RAG service. It intentionally
keeps each runtime boundary small enough to test and explain.

Implemented now:

- deterministic fake generation for CI
- domain types for documents, chunks, citations, claims, and traces
- sample-docs parsing and chunk creation
- OpenAI-compatible embedding client with injected fetch for tests
- OpenAI-compatible and Anthropic generation clients with injected fetch for tests
- context-bound generation validation that rejects unknown cited chunks
- embedding-aware sample-docs loader
- PostgreSQL source/chunk upsert SQL
- PostgreSQL lexical + vector hybrid retrieval SQL contract
- identifier-aware lexical exact-token matching for config keys, fields, error codes, acronyms, and runbook IDs
- deterministic query-evidence reranker with rerank rank/score trace fields
- Docker PostgreSQL smoke for sample-docs ingest and lexical retrieval
- live OpenAI embedding smoke for storing sample-doc embeddings
- API sample pipeline with deterministic retrieval, trust scoring, rejection, and trace
- API `/query` PostgreSQL retrieval mode behind `RAG_QUERY_MODE=postgres`
- sanitized PostgreSQL query trace persistence for DB-backed query mode
- live PostgreSQL generation smoke with provider-selected adapter and sanitized trace persistence
- deterministic trace sampling and expired trace cleanup command
- API `/query-traces/latest` endpoint for the latest sanitized trace
- web trace viewer that loads the latest persisted trace and falls back to a bundled sample
- web trace viewer display for fused rank, rerank rank, rerank score, trust, selection, and rejection
- eval fixture contracts and deterministic eval report
- live PostgreSQL + pgvector retrieval quality report for sample docs
- live retrieval mode comparison report for hybrid retrieval trade-off evidence
- live retrieval latency report for separating embedding cost from retrieval SQL cost
- live retrieval concurrency report for DB retrieval under small local concurrent load
- provider comparison report for explicit generation provider trade-offs
- scale budget report for 10M-document sizing assumptions and non-claims
- vector index budget report for HNSW memory-pressure assumptions and non-claims
- public repo hygiene and readiness checks

Not implemented yet:

- production retrieval benchmark with larger data volume and measured load

## Repository Layout

```text
apps/
  api/                 NestJS API
  web/                 Query trace viewer
packages/
  domain/              SourceDocument, DocumentChunk, Citation, Claim, QueryTrace
  generation/          LLMProvider interface, FakeLLMProvider, OpenAI-compatible and Anthropic adapters
  eval/                Fixture contracts and deterministic eval tests
  ingest/              Normalize and document-id helpers
  retrieval/           Retrieval result contracts
  scoring/             Trust score contracts
infra/
  docker-compose.yml   PostgreSQL + pgvector
sample-docs/           Public sample docs and synthetic failure fixtures
docs/
  decisions/           Trade-off notes
  security/            Public repo hygiene policy
  publication-checklist.md
  scale-to-10m.md      Scale reasoning note
  vector-index-budget-report.md
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
pnpm eval:report
pnpm scale:report
pnpm index:report
pnpm security:public
pnpm public:check
docker compose -f infra/docker-compose.yml up -d
pnpm db:smoke
```

For the live OpenAI embedding + PostgreSQL path, create a local `.env` from
`.env.example`, set `OPENAI_API_KEY`, then run:

```bash
pnpm db:live-smoke
pnpm db:live-generation-smoke
pnpm db:trace-retention-smoke
pnpm db:trace-cleanup
pnpm db:quality-smoke
pnpm db:retrieval-compare-smoke
pnpm db:retrieval-latency-smoke
pnpm db:retrieval-concurrency-smoke
```

The API uses the deterministic sample pipeline by default. To route `/query`
through PostgreSQL retrieval, start the database, ingest sample docs, and set:

```bash
RAG_QUERY_MODE=postgres
DATABASE_URL=postgres://evidence:rag@localhost:5432/evidence_rag_lab
OPENAI_API_KEY=...
```

PostgreSQL mode embeds the user query with OpenAI, retrieves stored chunks from
PostgreSQL, and persists a sanitized query trace. `runPostgresRagPipelineFromEnv`
uses the OpenAI-compatible generation adapter by default. Tests and eval still
use `FakeLLMProvider` for deterministic generation.

To compare Anthropic generation, keep `OPENAI_API_KEY` for embeddings and set:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

There is no automatic provider fallback. Missing OpenAI or Anthropic setup fails
explicitly so eval output is not mixed across providers.

The trace viewer reads `GET /query-traces/latest` from the API. If no persisted
trace is available, the viewer renders a bundled sanitized sample trace instead.

Live embeddings require `OPENAI_API_KEY`. Live generation uses
`OPENAI_API_KEY` by default and `ANTHROPIC_API_KEY` only when
`LLM_PROVIDER=anthropic`. CI uses `FakeLLMProvider` and injected embedding
providers, so it does not call external LLM APIs.

`pnpm eval:report` reads the deterministic fixture observations and regenerates
`docs/eval-report.md`.

`pnpm provider:report` regenerates `docs/provider-comparison-report.md`. It
keeps OpenAI-compatible, Anthropic, and fake generation roles explicit so
provider setup mistakes do not look like model-quality results.

`pnpm scale:report` regenerates `docs/scale-budget-report.md`. It calculates a
10M-document sizing estimate from explicit assumptions: `10,000,000` documents,
`8` chunks per document, `1536` float32 embedding dimensions, `1024` metadata
bytes per chunk, `50,000` daily queries, and `7` trace retention days. Current
estimate: `80,000,000` chunks, `491.52 GB` vector storage, `573.44 GB` vector +
chunk metadata, and `1.43 GB` retained sanitized traces. This is sizing math,
not a production benchmark.

`pnpm index:report` regenerates `docs/vector-index-budget-report.md`. It models
one explicit HNSW memory-pressure scenario for the same `80,000,000` chunk
estimate: raw vector payload `491.52 GB`, chunk metadata `81.92 GB`, HNSW graph
estimate `11.26 GB`, vector + metadata + graph `584.70 GB`, and build working
set planning estimate `1169.41 GB`. This is sizing math, not measured PostgreSQL or
pgvector index size.

`pnpm security:public` checks public fixtures and the publishable repository tree
for local env files, raw traces, provider responses, database dumps, embedding
caches, common secret patterns, and affirmative over-claims such as production
10M throughput or zero-hallucination guarantees. It is intentionally separate
from gitleaks so a new public repo can be checked before it has commit history.
It also runs a public-readiness scan that requires root license metadata, the
documented CI gate, and the local publication script to stay aligned.

`pnpm public:check` is the local pre-publication gate. It runs build, tests,
typecheck, regenerates deterministic eval, provider, scale, and vector index
reports, then runs public security/readiness checks after the generated reports
exist. Run gitleaks again after the first commit because a brand-new untracked
repo has no commit history to scan.

`pnpm db:quality-smoke` embeds 20 live retrieval quality queries, runs
PostgreSQL + pgvector retrieval over stored sample-doc embeddings, and
regenerates `docs/retrieval-quality-report.md` with recall@3 and MRR. This is a
sample quality smoke, not a production benchmark.

`pnpm db:retrieval-compare-smoke` runs the same 20 ranked retrieval cases through
lexical-only, vector-only, and hybrid retrieval and regenerates
`docs/retrieval-mode-comparison-report.md`. Current sample result: lexical-only
recall@3 `14/20` with exact-token category `5/5`, vector-only `20/20` with MRR
`0.975`, hybrid `20/20` with MRR `1.000`. The interpretation is deliberately
narrow: identifier-aware lexical retrieval now protects exact tokens, while
hybrid keeps vector-level recall and restores the missed vector rank position.

`pnpm db:retrieval-latency-smoke` measures the same 20 ranked retrieval cases and
regenerates `docs/retrieval-latency-report.md`. It reports aggregate timing for
one OpenAI embedding call per query plus PostgreSQL lexical, vector, and hybrid
SQL latency. It intentionally excludes query text, provider payloads, prompts,
and credentials from the report. Current local sample result: embedding P50
`147.91ms`, P95 `164.35ms`; lexical SQL P50 `2.59ms`; vector SQL P50 `2.08ms`;
hybrid SQL P50 `1.32ms`. This only shows that embedding dominates this tiny
sample run. It does not predict 10M-document latency.

`pnpm db:retrieval-concurrency-smoke` precomputes embeddings for the same 20
ranked retrieval cases, then runs PostgreSQL lexical, vector, and hybrid
retrieval at concurrency `1` and `4`. It regenerates
`docs/retrieval-concurrency-report.md` with aggregate timings and error counts
only. Current local sample result at concurrency `4`: lexical P50 `1.01ms`, P95
`9.18ms`, P99 `9.35ms`; vector P50 `1.75ms`, P95 `9.12ms`, P99 `9.92ms`; hybrid
P50 `2.28ms`, P95 `10.08ms`, P99 `11.10ms`; all rows had `0` errors. This
isolates DB retrieval concurrency after embedding is done. It is not a
production load benchmark.

The PostgreSQL `/query` path reranks retrieved candidates with a deterministic
query-evidence reranker before selecting generation context. This is not a
cross-encoder or ColBERT replacement. It creates a tested reranking boundary,
keeps provider-dependent rerankers out of CI, and exposes `rerankRank` /
`rerankScore` in sanitized traces so ranking changes are inspectable.

`pnpm db:live-generation-smoke` runs the DB-backed query path with the selected
live generation provider. It verifies every returned citation points to a
selected chunk and prints only aggregate status, not raw provider responses.

`pnpm db:trace-retention-smoke` inserts one expired and one fresh sanitized trace,
runs the retention cleanup SQL, and verifies only the expired trace is deleted.

`pnpm db:trace-cleanup` is the idempotent operations command for scheduled trace
retention. It deletes rows older than `TRACE_RETENTION_DAYS` and prints only an
aggregate audit summary with deleted ids, never raw trace payloads.

## Public Data Policy

This repository accepts only:

- synthetic fixtures
- short public-doc excerpts with source URL and usage note
- sanitized query trace samples
- aggregate eval reports

Do not commit API keys, `.env`, company documents, private operating notes,
database dumps, embedding caches, raw provider responses, unsanitized traces, or
large copied public docs without license review.

Sanitized trace storage still redacts email addresses and API-key-like secrets
from query/rejection text and omits raw chunk text, citation quotes, answer text,
prompts, provider responses, and token billing payloads.

## License

MIT. See `LICENSE`.

## Sample Queries

- Normal answer: "How does EvidenceRAG combine lexical and vector retrieval?"
- Conflicting source: "Which deployment policy is current?"
- Insufficient evidence: "What was the internal incident root cause last week?"
