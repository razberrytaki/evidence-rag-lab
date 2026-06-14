# 결정: Embedding Model

## 맥락

embedding model 선택은 vector dimension, index shape, latency, cost에 영향을 준다.

## 권장 선택

1536 dimension을 사용하는 OpenAI `text-embedding-3-small`을 사용한다.

## 검토한 대안

- `text-embedding-3-large`
- `dimensions` parameter를 사용한 down-projection

## 트레이드오프

small model은 비용과 저장 공간을 낮추면서 MVP의 초점을 reliability behavior에
유지한다. 나중에 dimension을 바꾸면 re-embedding과 index rebuild가 필요하다.

## 평가 근거

- `OpenAIEmbeddingClient`는 injected `fetch` implementation으로 테스트한다. CI는
  provider를 호출하지 않고 request shape를 검증한다.
- `loadEmbeddedMarkdownDocumentSet`는 PostgreSQL upsert 전에 sample chunk에
  embedding을 붙일 수 있는지 검증한다.
- `pnpm db:live-smoke`는 real-key path를 검증한다. sample docs가
  `text-embedding-3-small`로 embed되고, sample chunk가 non-null vector로 저장되며,
  DB-backed query path가 answered result를 반환한다.
- `pnpm db:quality-smoke`는 저장된 sample-doc embedding 위에서 20개의 live ranked
  retrieval case를 실행한다. 현재 sample 결과: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke`는 같은 sample set에서 vector-only recall@3
  `20/20`, MRR `0.975`를 보여준다. MVP에는 충분히 강한 signal이지만, 더 큰
  embedding model 비교를 대체하지 않는다.

## 확장 시 다시 볼 것

re-embedding run당 cost, index memory, quality delta를 평가한다.
