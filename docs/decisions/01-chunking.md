# 결정: 청킹

## 맥락

작은 청크는 검색 정밀도를 높이지만, 큰 청크는 문맥 보존에 유리하다. chunk 경계가
흔들리면 citation도 흔들린다. 같은 문장이 다른 chunk id로 이동하면 이전 trace와
eval fixture가 설명력을 잃는다.

현재 sample runtime은 문서가 작기 때문에 source document당 chunk 1개를 만든다. 이
선택은 청킹 품질을 이미 검증했다는 뜻이 아니다. 작은 공개 문서 세트에서는 retrieval,
citation, trust, trace boundary를 먼저 검증하고, 청킹 전략은 scale 단계에서 독립
실험으로 키운다.

## 권장 선택

MVP 문서에는 source document 단위 chunk를 사용한다. 다음 단계의 기본 후보는 제목
구조를 인식하는 재귀적 청킹이다. 목표는 fixed-size split보다 heading path와 stable
chunk id를 더 잘 보존하는 것이다.

## 검토한 대안

- 고정 크기 청킹
- 시맨틱 청킹
- parent-child retrieval

## 트레이드오프

source document 단위 chunk는 단순하고 citation을 검사하기 쉽다. 대신 긴 문서에서는
noise가 늘고, 한 문서 안의 서로 다른 주장들이 같은 retrieval unit에 묶인다.

고정 크기 청킹은 구현이 쉽지만 heading, code block, table 경계를 끊을 수 있다. 그
경우 citation quote가 같은 claim을 안정적으로 가리키기 어렵다.

제목 기반 재귀 청킹은 사람이 검사하기 충분히 단순하고, 공개 기술 문서의 heading
구조와 잘 맞는다. parent context를 함께 두면 child chunk는 검색 정밀도를 맡고,
parent context는 generation grounding을 보강할 수 있다.

시맨틱 청킹은 문장 의미를 더 잘 보존할 가능성이 있지만 model 의존성, 재현성 저하,
boundary debugging 비용을 추가한다. 이 프로젝트의 우선순위는 먼저 deterministic
retrieval/eval/trace boundary를 세우는 것이다.

## 평가 근거

- `packages/ingest/src/sample-docs.ts`는 현재 sample docs를 source document당 chunk
  1개로 load한다.
- `packages/ingest/test/sample-docs.test.ts`는 20개 sample docs와 `#chunk-001`
  contract를 검증한다.
- retrieval quality case에는 `chunking-boundary`와 `parent-child-retrieval`이 있다.
  현재 검증은 청킹 알고리즘 자체가 아니라, 청킹/parent-child retrieval decision을
  설명하는 문서가 검색되는지에 가깝다.
- `DocumentChunk`는 `headingPath`, `contentHash`, `version`, optional `parentId`를
  갖는다. 이후 recursive chunking과 parent-child retrieval로 확장할 수 있는 schema
  자리는 마련되어 있다.

## 확장 시 다시 볼 것

1천만 문서는 pressure scenario이며 measured production benchmark가 아니다. 이 규모로
갈 때는 average chunks per document, overlap, heading depth, parent context payload,
chunk id migration, index backfill cost, citation stability를 함께 측정한다.
