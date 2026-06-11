# Provider Comparison Report

Generated on 2026-06-11.

This report compares generation provider boundaries for the public portfolio.
It is not a quality benchmark unless a live smoke row says `pass`.

| Provider | Role | Request surface | Setup | Live smoke | Model | Claims | Citations | Trace persisted | Reason |
|---|---|---|---|---|---|---:|---:|---|---|
| openai-compatible | default-live | POST /chat/completions | OPENAI_API_KEY | pass | gpt-5.4-mini | 4 | 4 | yes | - |
| anthropic | comparison-adapter | POST /messages | OPENAI_API_KEY + ANTHROPIC_API_KEY | not-run | - | - | - | - | ANTHROPIC_API_KEY is not configured |
| fake | test-double | in-process | none | not-run | - | - | - | - | FakeLLMProvider is deterministic CI/test only |

| Provider | Deterministic checks | Trade-offs |
|---|---|---|
| openai-compatible | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction | portable across OpenAI-compatible providers; less OpenAI-native than Responses API |
| anthropic | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction, env-config-loading | explicit provider selection; no automatic fallback |
| fake | citation-shape, empty-context-rejection | stable eval output; not a model-quality signal |

## Notes

- OpenAI remains required for embeddings because retrieval query embedding uses text-embedding-3-small.
- Provider comparison is explicit so setup errors are not hidden by fallback.
- Only OpenAI-compatible live generation has been smoke-tested in this environment; Anthropic live smoke requires ANTHROPIC_API_KEY.
