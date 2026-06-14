# Provider 비교 리포트

생성일: 2026-06-14.

검증 범위: deterministic adapter contract. Live generation smoke는 별도 command 결과로 추적한다.

## 읽는 법

- adapter contract와 live 검증 경계를 분리해서 본다.

| Provider | Role | Request surface | Generation env | Live 검증 | Command | Reason |
|---|---|---|---|---|---|---|
| openai-compatible | default-live | POST /chat/completions | OPENAI_API_KEY | 별도 실행 필요 | pnpm db:live-generation-smoke | - |
| anthropic | comparison-adapter | POST /messages | ANTHROPIC_API_KEY | 미실행 | pnpm db:live-generation-smoke | ANTHROPIC_API_KEY가 설정되지 않음 |
| fake | test-double | in-process | none | 해당 없음 | none | FakeLLMProvider는 deterministic CI/test 전용 |

| Provider | Deterministic checks | Trade-offs |
|---|---|---|
| openai-compatible | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction | OpenAI-compatible provider 전반에 portable; Responses API보다 OpenAI-native 성격은 약함 |
| anthropic | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction, env-config-loading | 명시적 provider selection; automatic fallback 없음 |
| fake | citation-shape, empty-context-rejection | stable eval output; model-quality signal 아님 |

## 메모

- Generation env와 embedding env는 분리해서 읽는다. retrieval query embedding이 text-embedding-3-small을 사용하므로 DB-backed smoke에는 OPENAI_API_KEY가 계속 필요하다.
- Provider comparison은 explicit하므로 setup error가 fallback 뒤에 숨지 않는다.
- Live generation은 pnpm db:live-generation-smoke로 별도 확인한다.
