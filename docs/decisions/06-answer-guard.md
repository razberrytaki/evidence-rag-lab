# Decision: Answer Guard

## Context

RAG quality fails when generation adds unsupported claims.

## Recommended choice

Use a context-bound prompt, citation validation, and unsupported-claim rejection.

## Alternatives considered

- prompt-only guard
- extractive-only answer

## Trade-off

Post-generation validation makes failure explicit. It can reject useful answers
when citation coverage is incomplete, but that is acceptable for this lab.

## Evaluation evidence

Use `insufficient-evidence`, `citation-per-claim`,
`unsupported-claim-detection`, and prompt injection fixtures.

- `OpenAICompatibleLLMProvider` rejects empty selected context before any live
  call.
- Provider citations are accepted only when `documentId` and `chunkId` match the
  selected context.
- Malformed provider JSON becomes a sanitized
  `citation_validation_failed` rejection instead of exposing raw provider
  content.

## Follow-up if scaling to 10M

Track rejection reasons and false rejects as first-class metrics.
