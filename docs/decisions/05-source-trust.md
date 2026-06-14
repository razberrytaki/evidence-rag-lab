# 결정: Source Trust

## 맥락

검색된 chunk의 신뢰도는 동일하지 않다. 같은 top-K 안에 있어도 public reference,
synthetic conflict case, stale note는 답변에 미치는 영향이 달라야 한다. 검색 점수만
높은 stale source가 generation context에 들어오면, citation이 있더라도 잘못된 답변을
만들 수 있다.

## 권장 선택

freshness, source type, duplicate penalty, retrieval agreement를 deterministic하게
점수화한다. 최소 trust threshold는 현재 `0.5`다. PostgreSQL runtime은
`freshnessScore < 0.5` 후보를 `stale_source`로 reject하고, selected context에는
retrieval, rerank, trust threshold를 모두 통과한 후보만 넣는다.

## 검토한 대안

- source-type-only score
- LLM trust judge
- retrieval score만 사용

## 트레이드오프

현재 scoring package의 baseline formula는 단순하다.

```text
sourceTypeScore = public-doc ? 0.8 : 0.6
duplicatePenalty = min(duplicateCount * 0.1, 0.4)
trustScore = clamp(sourceTypeScore + retrievalAgreement * 0.2 - duplicatePenalty, 0, 1)
```

PostgreSQL row mapping은 `synthetic-stale` source를 freshness `0.3`, trust `0.3`으로
demote한다. 즉 freshness는 source type보다 강하게 적용되는 stop signal이다.

이 방식의 장점은 검사 가능성과 CI 친화성이다. score breakdown이 trace에 남기 때문에
왜 특정 chunk가 선택되거나 거절됐는지 사람이 재현할 수 있다. 단점은 false demotion
위험이다. 신뢰도 낮은 source에도 최신 correction이 있을 수 있고, duplicate penalty가
비슷한 공지 여러 개를 과하게 낮출 수 있다.

LLM trust judge는 더 유연할 수 있지만 비용, latency, 비결정성, prompt injection
공격면을 추가한다. 이 프로젝트에서는 provider output도 untrusted로 취급하므로,
trust 판단까지 LLM에 맡기면 "검증 가능한 실패"라는 목표가 약해진다.

## 평가 근거

- `packages/scoring/src/index.ts`는 source type, duplicate count, retrieval
  agreement 기반 score formula를 갖는다.
- `packages/retrieval/src/postgres.ts`는 `synthetic-stale` row를 freshness/trust
  `0.3`으로 demote한다.
- `apps/api/src/postgres-rag.pipeline.ts`는 retrieval, rerank, trust threshold
  `0.5`를 통과한 candidate만 selected context로 보낸다.
- `duplicate-doc-penalty`, `stale-source-demotion`, `low-trust-source` eval fixture가
  trust 계열 실패를 다룬다.
- retrieval quality case에는 `source-trust-score`, `duplicate-detection`,
  `version-history`, `deployment-policy-stale`이 포함된다.

## 확장 시 다시 볼 것

1천만 문서는 pressure scenario이며 measured production benchmark가 아니다. scale
단계에서는 source ownership, update frequency, per-document lineage, version
supersession, duplicate cluster size, appeal path를 score input에 추가한다. false
demotion을 찾기 위해 "낮은 trust지만 정답인 source"와 "높은 retrieval score지만 stale
source" adversarial case를 별도로 만든다.
