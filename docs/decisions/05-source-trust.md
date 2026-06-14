# 결정: Source Trust

## 맥락

검색된 chunk의 신뢰도는 동일하지 않다.

## 권장 선택

freshness, source type, duplicate penalty, retrieval agreement를 점수화한다.

## 검토한 대안

- source-type-only score
- LLM trust judge

## 트레이드오프

deterministic trust scoring은 검사 가능하고 CI 친화적이다. model judge보다
유연성은 낮지만, 포트폴리오 walkthrough에서 방어하기 쉽다.

## 평가 근거

`duplicate-doc-penalty`, `stale-source-demotion`, `low-trust-source`를 사용한다.

## 확장 시 다시 볼 것

source ownership, update frequency, per-document lineage를 추가한다.
