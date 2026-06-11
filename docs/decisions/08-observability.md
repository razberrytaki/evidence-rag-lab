# Decision: Observability

## Context

RAG failures are hard to debug without retrieval and scoring traces.

## Recommended choice

Store sanitized query traces with candidate chunks, score breakdown, selected
context, rejected reasons, and final decision.

Retention, redaction, and sampling details are tracked separately in
`docs/decisions/10-trace-retention-and-privacy.md`.

## Alternatives considered

- raw prompt logs
- aggregate-only metrics

## Trade-off

Sanitized traces are safer for a public repo and still useful for debugging.
Raw logs would expose prompts, context, and provider responses.

## Evaluation evidence

- Use `trace-completeness`.
- `buildQueryTraceUpsertSql` persists sanitized traces to `query_traces` without
  raw chunk text or citation quotes.
- `buildLatestQueryTraceSql` reads only `sanitized = true` rows and orders by the
  newest trace first.
- `GET /query-traces/latest` returns the latest sanitized trace for local
  inspection.
- The Vite trace viewer loads that endpoint and falls back to a bundled
  sanitized sample when the API has no trace yet.
- Trace candidates can include `fusedRank`, `rerankRank`, and `rerankScore`, so
  retrieval fusion and reranking decisions stay visible without raw context
  text.
- `pnpm db:live-smoke` verifies the DB-backed query path persists a sanitized
  trace row (`tracePersisted: true`).
- `pnpm db:live-generation-smoke` verifies the live generation path persists a
  sanitized trace and prints only aggregate generation status, claim count,
  citation count, and selected chunk IDs.
- `sanitizeQueryTraceForStorage` redacts email addresses and API-key-like
  secrets before storage.
- `pnpm db:trace-retention-smoke` verifies expired sanitized traces can be
  deleted without deleting fresh traces.

## Follow-up if scaling to 10M

Move trace cleanup to a scheduled job and export aggregate metrics before
deleting trace rows.
