# 결정: 출처 신뢰도

## 맥락

검색된 청크의 신뢰도는 동일하지 않다. 같은 top-K 안에 있어도 공개 참고 문서,
합성 충돌 사례, 오래된 노트는 답변에 미치는 영향이 달라야 한다. 검색 점수만 높은
오래된 출처가 생성 문맥에 들어오면, 인용이 있더라도 잘못된 답변을 만들 수 있다.

## 결정

최신성, 출처 유형, 중복 페널티, 검색 신호 일치도를 결정적으로 점수화한다. 최소 신뢰도
기준은 현재 `0.5`다. PostgreSQL 실행 경로는 `freshnessScore < 0.5` 후보를
`stale_source`로 거절하고, 선택 문맥에는 검색, 재순위화, 신뢰도 기준을 모두 통과한
후보만 넣는다.

## 검토한 대안

- 출처 유형만 보는 점수
- LLM trust judge
- 검색 점수만 사용

## 트레이드오프

현재 점수 패키지의 기준 공식은 단순하다.

```text
sourceTypeScore = public-doc ? 0.8 : 0.6
duplicatePenalty = min(duplicateCount * 0.1, 0.4)
trustScore = clamp(sourceTypeScore + retrievalAgreement * 0.2 - duplicatePenalty, 0, 1)
```

PostgreSQL 행 매핑은 `synthetic-stale` 출처를 최신성 `0.3`, 신뢰도 `0.3`으로 낮춘다. 즉 최신성은 출처 유형보다 강하게 적용되는 중단 신호다.

이 방식의 장점은 검사 가능성과 CI 친화성이다. 점수 분해가 추적 기록에 남기 때문에
왜 특정 청크가 선택되거나 거절됐는지 사람이 재현할 수 있다. 단점은 잘못 낮출
위험이다. 신뢰도 낮은 출처에도 최신 정정이 있을 수 있고, 중복 페널티가 비슷한
공지 여러 개를 과하게 낮출 수 있다.

LLM 신뢰도 판정은 더 유연할 수 있지만 비용, 지연 시간, 비결정성, 프롬프트 주입
공격면을 추가한다. 이 프로젝트에서는 LLM 출력도 신뢰하지 않는 값으로 취급하므로,
신뢰도 판단까지 LLM에 맡기면 "검증 가능한 실패"라는 목표가 약해진다.

## 평가 근거

- `packages/scoring/src/index.ts`는 출처 유형, 중복 수, 검색 신호 일치도 기반 점수 공식을 갖는다.
- `packages/retrieval/src/postgres.ts`는 `synthetic-stale` 행을 최신성/신뢰도
  `0.3`으로 낮춘다.
- `apps/api/src/rag/postgres/postgres-rag.pipeline.ts`는 검색, 재순위화, 신뢰도 기준
  `0.5`를 통과한 후보만 선택 문맥으로 보낸다.
- `duplicate-doc-penalty`, `stale-source-demotion`, `low-trust-source` 평가 사례가
  trust 계열 실패를 다룬다.
- 검색 품질 사례에는 `source-trust-score`, `duplicate-detection`,
  `version-history`, `deployment-policy-stale`이 포함된다.

## 확장 시 다시 볼 것

확장 단계에서는 출처 소유자, 갱신 주기, 문서별 계보, 버전 대체 관계, 중복 묶음 크기,
이의 제기 경로를 점수 입력에 추가한다. 잘못 낮추는 사례를 찾기 위해
"신뢰도는 낮지만 정답인 출처"와 "검색 점수는 높지만 오래된 출처" 적대 사례를
별도로 만든다.
