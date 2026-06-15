# 결정: 답변 보호 장치

## 맥락

생성이 근거 없는 주장을 추가하면 RAG 품질은 실패한다.

## 권장 선택

문맥에 묶인 프롬프트, 인용 검증, 지원되지 않는 주장 거절을 사용한다.

## 검토한 대안

- 프롬프트만 사용하는 보호 장치
- 추출식 답변만 사용

## 트레이드오프

생성 후 검증은 실패를 명시적으로 만든다. 인용 범위가 불완전하면 유용한 답변도
거절할 수 있지만, 이 프로젝트에서는 그 편이 허용 가능한 절충이다.

## 평가 근거

`insufficient-evidence`, `citation-per-claim`, `unsupported-claim-detection`,
프롬프트 주입 평가 사례를 사용한다.

- `OpenAICompatibleLLMProvider`는 실제 호출 전에 선택 문맥이 비어 있으면 거절한다.
- LLM 제공자 인용은 `documentId`와 `chunkId`가 선택 문맥과 일치할 때만 허용된다.
- 형식이 깨진 LLM JSON은 LLM 응답 원문을 노출하지 않고 정리된
  `citation_validation_failed` 거절이 된다.

## 확장 시 다시 볼 것

거절 사유와 잘못된 거절을 주요 지표로 추적한다.
