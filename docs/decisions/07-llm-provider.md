# Decision: LLM Provider

## Context

The project needs generation, but CI must not depend on live model calls.

## Recommended choice

Use OpenAI-compatible generation by default, Anthropic as a comparison adapter,
and `FakeLLMProvider` for deterministic CI.

The live OpenAI-compatible adapter uses `POST /chat/completions` instead of the
newer OpenAI-only Responses API because compatibility is the point of this
boundary. OpenAI currently recommends the Responses API for OpenAI-first
applications, but many OpenAI-compatible providers still expose the Chat
Completions contract. Source references:
[Chat Completions API](https://developers.openai.com/api/reference/resources/chat)
and [OpenAI text generation guide](https://developers.openai.com/api/docs/guides/text).

The Anthropic adapter uses the Messages API request shape: `model`,
`max_tokens`, and a `messages` array. The official TypeScript SDK documents the
same `client.messages.create({ max_tokens, messages, model })` call shape:
[Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript).

## Alternatives considered

- automatic provider fallback
- one provider only
- OpenAI Responses API as the only generation surface
- Anthropic SDK dependency instead of a small HTTP adapter

## Trade-off

Provider comparison stays explicit. Automatic fallback would hide setup errors
and confuse evaluation.

Chat Completions is less OpenAI-native than Responses API, but it keeps the
adapter portable. Provider output is still treated as untrusted: the adapter
asks for structured JSON, validates citations against selected context, and
rejects malformed provider JSON without returning raw provider content.

Anthropic stays a comparison adapter, not a fallback path. `LLM_PROVIDER` must be
set explicitly, and missing provider setup fails early. The project does not add
the Anthropic SDK dependency because the adapter only needs one Messages API
call shape and injected `fetch` keeps tests deterministic.

## Evaluation evidence

- Use provider config tests and fake generation contract tests.
- `OpenAICompatibleLLMProvider` tests use injected `fetch` to verify request
  shape, citation validation, empty-context rejection, and malformed JSON
  rejection.
- `AnthropicLLMProvider` tests use injected `fetch` to verify Messages API
  request shape, citation validation, empty-context rejection, malformed JSON
  rejection, and env config loading.
- `createLiveLLMProvider` tests verify `LLM_PROVIDER=anthropic` selects the
  Anthropic adapter.
- `pnpm db:live-generation-smoke` verifies live provider-selected generation over
  the DB-backed retrieval path and persists a sanitized trace.
- CI and eval still use `FakeLLMProvider`; live generation remains an explicit
  local smoke path.

## Follow-up if scaling to 10M

Measure provider latency, cost, and citation adherence separately.
