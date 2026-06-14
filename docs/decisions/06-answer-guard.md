# 결정: Answer Guard

## 맥락

generation이 근거 없는 claim을 추가하면 RAG 품질은 실패한다.

## 권장 선택

context-bound prompt, citation validation, unsupported-claim rejection을 사용한다.

## 검토한 대안

- prompt-only guard
- extractive-only answer

## 트레이드오프

post-generation validation은 실패를 명시적으로 만든다. citation coverage가
불완전하면 유용한 답변도 reject할 수 있지만, 이 lab에서는 그 편이 허용 가능한
trade-off다.

## 평가 근거

`insufficient-evidence`, `citation-per-claim`, `unsupported-claim-detection`,
prompt injection fixture를 사용한다.

- `OpenAICompatibleLLMProvider`는 live call 전에 empty selected context를
  reject한다.
- provider citation은 `documentId`와 `chunkId`가 selected context와 일치할 때만
  accept된다.
- malformed provider JSON은 raw provider content를 노출하지 않고 sanitized
  `citation_validation_failed` rejection이 된다.

## 확장 시 다시 볼 것

rejection reason과 false reject를 first-class metric으로 추적한다.
