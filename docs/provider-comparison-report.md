# Provider 비교 리포트

생성일: 2026-06-14.

public portfolio를 위해 generation provider boundary를 비교한다.
이 report는 provider adapter boundary를 정적으로 비교한다. live model call은 실행하지 않는다.
live generation 검증은 `pnpm db:live-generation-smoke` 같은 별도 command에서 수행한다.

## 읽는 법

- adapter contract와 live 검증 경계를 분리해서 본다. 이 report의 row는 live 품질 benchmark가 아니다.

| Provider | Role | Request surface | Setup | Live 검증 | Command | Reason |
|---|---|---|---|---|---|---|
| openai-compatible | default-live | POST /chat/completions | OPENAI_API_KEY | 별도 실행 필요 | pnpm db:live-generation-smoke | - |
| anthropic | comparison-adapter | POST /messages | OPENAI_API_KEY + ANTHROPIC_API_KEY | 미실행 | pnpm db:live-generation-smoke | ANTHROPIC_API_KEY가 설정되지 않음 |
| fake | test-double | in-process | none | 해당 없음 | none | FakeLLMProvider는 deterministic CI/test 전용 |

| Provider | Deterministic checks | Trade-offs |
|---|---|---|
| openai-compatible | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction | OpenAI-compatible provider 전반에 portable; Responses API보다 OpenAI-native 성격은 약함 |
| anthropic | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction, env-config-loading | 명시적 provider selection; automatic fallback 없음 |
| fake | citation-shape, empty-context-rejection | stable eval output; model-quality signal 아님 |

## 메모

- retrieval query embedding이 text-embedding-3-small을 사용하므로 embedding에는 OpenAI가 계속 필요하다.
- Provider comparison은 explicit하므로 setup error가 fallback 뒤에 숨지 않는다.
- 이 report는 live model call을 실행하지 않는다. live generation은 pnpm db:live-generation-smoke로 별도 확인한다.
