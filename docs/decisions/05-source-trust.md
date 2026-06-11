# Decision: Source Trust

## Context

Retrieved chunks are not equally reliable.

## Recommended choice

Score freshness, source type, duplicate penalty, and retrieval agreement.

## Alternatives considered

- source-type-only score
- LLM trust judge

## Trade-off

Deterministic trust scoring is inspectable and CI-friendly. It is less flexible
than a model judge but easier to defend in a portfolio walkthrough.

## Evaluation evidence

Use `duplicate-doc-penalty`, `stale-source-demotion`, and `low-trust-source`.

## Follow-up if scaling to 10M

Add source ownership, update frequency, and per-document lineage.
