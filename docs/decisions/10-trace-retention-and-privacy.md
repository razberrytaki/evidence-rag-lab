# Decision: Trace Retention and Privacy

## Context

RAG observability needs traces, but traces can accidentally become a second
store of prompts, context, provider output, or personal data.

## Recommended choice

Store only sanitized trace summaries, sample trace persistence deterministically,
and delete expired trace rows with a retention cleanup command that can be
scheduled by the hosting environment.

Defaults:

- retain sanitized traces for 7 days
- sample rate `1` in local lab mode
- redact email addresses and API-key-like secrets from stored query and rejection
  text
- never store raw chunk text, parent context text, citation quotes, answer text,
  raw prompts, raw provider responses, or token billing payloads

## Alternatives considered

- store full raw traces for easier debugging
- aggregate-only metrics with no per-query trace
- random sampling at write time
- indefinite sanitized trace retention

## Trade-off

Sanitized trace summaries lose some replay/debugging detail, but they are safer
for a public portfolio and closer to production privacy boundaries. Deterministic
sampling by trace id makes local tests reproducible and avoids hiding failures
behind randomness. Short retention limits stale observability data, but long-term
trend analysis must come from aggregate eval reports rather than raw traces.

## Evaluation evidence

- `sanitizeQueryTraceForStorage` redacts email addresses and API-key-like secrets
  from query, normalized query, rejected reasons, and rejected generation
  messages.
- `buildQueryTraceUpsertSql` stores sanitized payloads only.
- `shouldPersistTraceSample` makes deterministic trace-id-based sampling
  decisions.
- `buildExpiredQueryTraceDeleteSql` deletes traces older than a cutoff and
  returns deleted ids for audit.
- `runExpiredQueryTraceCleanup` wraps the delete SQL behind an executor and
  returns an aggregate audit summary.
- `pnpm db:trace-retention-smoke` verifies an expired trace is deleted while a
  fresh trace remains.
- `pnpm db:trace-cleanup` is the idempotent operations command intended for cron,
  GitHub Actions, or a hosted scheduler.

## Follow-up if scaling to 10M

Attach `pnpm db:trace-cleanup` to the production scheduler, export aggregate
metrics before deletion, and add a stricter PII redaction pass before any trace
leaves a private network boundary.
