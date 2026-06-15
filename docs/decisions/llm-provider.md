# 결정: LLM 제공자

## 맥락

이 프로젝트에는 생성이 필요하지만, CI가 실제 모델 호출에 의존하면 안 된다.

## 결정

기본 생성은 OpenAI 호환 LLM 제공자를 사용한다. Anthropic은 비교용 어댑터로 둔다. CI의 기본 RAG 회귀 검증에는 `FakeLLMProvider`를 사용한다.

실제 OpenAI 호환 어댑터는 더 새로운 OpenAI 전용 Responses API 대신 `POST /chat/completions`를 사용한다.

OpenAI 우선 애플리케이션에서는 2026-06-14 기준 OpenAI가 Responses API를 권장하지만, 많은 OpenAI 호환 LLM 제공자는 여전히 Chat Completions 계약을 노출한다.

참고:
[Chat Completions API](https://developers.openai.com/api/reference/resources/chat),
[OpenAI text generation guide](https://developers.openai.com/api/docs/guides/text).


Anthropic 어댑터는 Messages API 요청 형태를 사용한다: `model`, `max_tokens`,
`messages` 배열. 공식 TypeScript SDK도 같은
`client.messages.create({ max_tokens, messages, model })` 호출 형태를 사용한다:
[Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript).

## 검토한 대안

- 자동 LLM 제공자 대체
- LLM 제공자 하나만 사용
- OpenAI Responses API를 유일한 생성 경로로 사용
- 작은 HTTP 어댑터 대신 Anthropic SDK 의존성 추가

## 트레이드오프

LLM 제공자 비교는 명시적으로 남긴다. 자동 대체는 설정 오류를 숨기고 평가를 혼동시킬 수 있다.

Chat Completions는 Responses API보다 OpenAI 전용 성격이 약하지만 어댑터를 옮겨 쓰기
쉽게 만든다. LLM 출력은 여전히 신뢰하지 않는 값으로 취급한다. 어댑터는 구조화된 JSON을
요청하고, 인용을 선택 문맥 기준으로 검증하고, 형식이 깨진 LLM JSON을 응답 원문 반환 없이
거절한다.

Anthropic은 대체 경로가 아니라 비교 어댑터로 유지한다. `LLM_PROVIDER`는 명시적으로
설정해야 하고, LLM 제공자 설정이 빠지면 초기에 실패한다. 어댑터에는 Messages API 호출
형태 하나만 필요하고 주입된 `fetch`로 테스트를 결정적으로 유지할 수 있으므로 Anthropic
SDK 의존성은 추가하지 않는다.

## 평가 근거

- LLM 제공자 설정 테스트와 fake 생성 계약 테스트를 사용한다.
- `OpenAICompatibleLLMProvider` 테스트는 주입된 `fetch`로 요청 형태,
  인용 검증, 빈 문맥 거절, 깨진 JSON 거절을 검증한다.
- `AnthropicLLMProvider` 테스트는 주입된 `fetch`로 Messages API 요청 형태,
  인용 검증, 빈 문맥 거절, 깨진 JSON 거절, 환경 설정 로딩을 검증한다.
- `createLiveLLMProvider` test는 `LLM_PROVIDER=anthropic`일 때 Anthropic
  어댑터가 선택되는지 검증한다.
- `pnpm db:live-generation-smoke`는 DB 기반 검색 경로에서 실제
  LLM 제공자 선택 생성이 동작하는지 검증하고 정리된 추적 기록을 저장한다.
- 검색 평가는 LLM 호출 없이 검색 결과만 검증한다. CI의 기본 RAG 회귀 검증은
  `FakeLLMProvider`로 근거 제한, 인용 검증, 답변 거절, provider 계약을
  결정적으로 확인한다. 실제 LLM 제공자를 쓰는 생성 품질 확인은 비용, 비결정성,
  secret 관리 문제 때문에 로컬 live 검증 경로로 분리한다.

## 확장 시 다시 볼 것

LLM 제공자별 지연 시간, 비용, 인용 준수율을 분리 측정한다.
