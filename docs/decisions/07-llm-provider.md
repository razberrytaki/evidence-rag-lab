# 결정: LLM Provider

## 맥락

이 프로젝트에는 generation이 필요하지만, CI가 live model call에 의존하면 안 된다.

## 권장 선택

기본 generation은 OpenAI-compatible provider를 사용한다. Anthropic은 비교용
adapter로 둔다. deterministic CI에는 `FakeLLMProvider`를 사용한다.

live OpenAI-compatible adapter는 newer OpenAI-only Responses API 대신
`POST /chat/completions`를 사용한다. 이 boundary의 목적이 compatibility이기
때문이다. OpenAI-first application에서는 2026-06-14 기준 OpenAI가 Responses API를 권장하지만,
많은 OpenAI-compatible provider는 여전히 Chat Completions contract를 노출한다.
참고:
[Chat Completions API](https://developers.openai.com/api/reference/resources/chat),
[OpenAI text generation guide](https://developers.openai.com/api/docs/guides/text).

Anthropic adapter는 Messages API request shape를 사용한다: `model`, `max_tokens`,
`messages` array. 공식 TypeScript SDK도 같은
`client.messages.create({ max_tokens, messages, model })` call shape를 문서화한다:
[Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript).

## 검토한 대안

- automatic provider fallback
- one provider only
- OpenAI Responses API를 유일한 generation surface로 사용
- 작은 HTTP adapter 대신 Anthropic SDK dependency 추가

## 트레이드오프

provider 비교는 명시적으로 남긴다. automatic fallback은 setup error를 숨기고
evaluation을 혼동시킬 수 있다.

Chat Completions는 Responses API보다 OpenAI-native 성격이 약하지만 adapter를
portable하게 만든다. provider output은 여전히 untrusted로 취급한다. adapter는
structured JSON을 요청하고, citation을 selected context 기준으로 검증하고,
malformed provider JSON을 raw provider content 반환 없이 reject한다.

Anthropic은 fallback path가 아니라 comparison adapter로 유지한다. `LLM_PROVIDER`는
명시적으로 설정해야 하고, provider setup이 빠지면 early fail한다. adapter에는
Messages API call shape 하나만 필요하고 injected `fetch`로 test deterministic을
유지할 수 있으므로 Anthropic SDK dependency는 추가하지 않는다.

## 평가 근거

- provider config test와 fake generation contract test를 사용한다.
- `OpenAICompatibleLLMProvider` test는 injected `fetch`로 request shape,
  citation validation, empty-context rejection, malformed JSON rejection을
  검증한다.
- `AnthropicLLMProvider` test는 injected `fetch`로 Messages API request shape,
  citation validation, empty-context rejection, malformed JSON rejection, env
  config loading을 검증한다.
- `createLiveLLMProvider` test는 `LLM_PROVIDER=anthropic`일 때 Anthropic
  adapter가 선택되는지 검증한다.
- `pnpm db:live-generation-smoke`는 DB-backed retrieval path에서 live
  provider-selected generation을 검증하고 sanitized trace를 저장한다.
- CI와 eval은 여전히 `FakeLLMProvider`를 사용한다. live generation은 명시적인
  local 검증 경로로 남긴다.

## 확장 시 다시 볼 것

provider latency, cost, citation adherence를 분리 측정한다.
