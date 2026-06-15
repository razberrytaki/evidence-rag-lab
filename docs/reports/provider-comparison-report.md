# LLM 제공자 비교 리포트

생성일: 2026-06-14.

검증 범위: 결정적 어댑터 계약. 실제 생성 확인은 별도 명령 결과로 추적한다.

## 읽는 법

- 어댑터 계약과 실제 검증 경계를 분리해서 본다.

| LLM 제공자 | 역할 | 요청 경로 | 생성 환경값 | 실제 검증 | 명령 | 이유 |
|---|---|---|---|---|---|---|
| openai-compatible | default-live | POST /chat/completions | OPENAI_API_KEY | 별도 실행 필요 | pnpm db:live-generation-smoke | - |
| anthropic | comparison-adapter | POST /messages | ANTHROPIC_API_KEY | 미실행 | pnpm db:live-generation-smoke | ANTHROPIC_API_KEY가 설정되지 않음 |
| fake | test-double | in-process | none | 해당 없음 | none | FakeLLMProvider는 결정적 CI/test 전용 |

| LLM 제공자 | 결정적 확인 | 절충 |
|---|---|---|
| openai-compatible | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction | OpenAI 호환 LLM 제공자 전반에 옮겨 쓰기 쉬움; Responses API보다 OpenAI 전용 성격은 약함 |
| anthropic | request-shape, citation-validation, empty-context-rejection, malformed-json-redaction, env-config-loading | 명시적 LLM 제공자 선택; 자동 대체 없음 |
| fake | citation-shape, empty-context-rejection | 안정적인 평가 출력; 모델 품질 신호 아님 |

## 메모

- 생성 환경값과 임베딩 환경값은 분리해서 읽는다. 검색 질의 임베딩이 text-embedding-3-small을 사용하므로 DB 기반 동작 확인에는 OPENAI_API_KEY가 계속 필요하다.
- LLM 제공자 비교는 명시적이므로 설정 오류가 자동 대체 뒤에 숨지 않는다.
- 실제 생성은 pnpm db:live-generation-smoke로 별도 확인한다.
