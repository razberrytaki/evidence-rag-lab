# Decision: Chunking

## Context

Small chunks improve retrieval precision, but large chunks preserve context.

## Recommended choice

Use heading-aware recursive chunking for MVP.

## Alternatives considered

- fixed-size chunking
- semantic chunking

## Trade-off

Heading-aware recursive chunking is simple enough to inspect and good enough for
public technical docs. Semantic chunking remains a later comparison because it
adds model dependency and harder-to-debug boundaries.

## Evaluation evidence

Use the `parent-child-context` fixture and chunk preview traces.

## Follow-up if scaling to 10M

Measure chunk count growth, index update cost, and parent-context fetch latency.
