# Provider 비교 리포트

생성일: 2026-06-12.

public portfolio를 위해 generation provider boundary를 비교한다.
live 동작 확인 row가 `통과`라고 표시하지 않는 한 quality benchmark가 아니다.

| Provider | Role | Request surface | Setup | Live 동작 확인 | Model | Claims | Citations | Trace persisted | Reason |
|---|---|---|---|---|---|---:|---:|---|---|
| openai-compatible | default-live | POST /chat/completions | OPENAI_API_KEY | 통과 | gpt-5.4-mini | 3 | 3 | 예 | - |
| anthropic | comparison-adapter | POST /messages | OPENAI_API_KEY + ANTHROPIC_API_KEY | 미실행 | - | - | - | - | ANTHROPIC_API_KEY가 설정되지 않음 |
| fake | test-double | in-process | none | 미실행 | - | - | - | - | FakeLLMProvider는 deterministic CI/test 전용 |

| Provider | Deterministic checks | Trade-offs |
|---|---|---|
| openai-compatible | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction | OpenAI-compatible provider 전반에 portable; Responses API보다 OpenAI-native 성격은 약함 |
| anthropic | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction, env-config-loading | 명시적 provider selection; automatic fallback 없음 |
| fake | citation-shape, empty-context-rejection | stable eval output; model-quality signal 아님 |

## 메모

- retrieval query embedding이 text-embedding-3-small을 사용하므로 embedding에는 OpenAI가 계속 필요하다.
- Provider comparison은 explicit하므로 setup error가 fallback 뒤에 숨지 않는다.
- 이 환경에서는 OpenAI-compatible live generation만 동작 확인된 상태다. Anthropic live 동작 확인에는 ANTHROPIC_API_KEY가 필요하다.
