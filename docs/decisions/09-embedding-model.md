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
유지한다. 나중에 model이나 dimension을 바꾸면 re-embedding과 index rebuild가 필요하다.

| 선택지 | Dimension | 장점 | 비용 |
|---|---:|---|---|
| `text-embedding-3-small` | 1536 | 현재 구현값. 저장 공간과 query latency가 작고 public sample set에서 충분한 retrieval signal을 준다. | larger model 대비 quality headroom은 검증하지 않았다. |
| `text-embedding-3-large` | 3072 | 더 큰 embedding capacity와 quality 비교 후보. | raw vector payload가 같은 chunk 수에서 2배가 되고, index build/rebuild cost도 커진다. |
| `dimensions` down-projection | configurable | storage와 vector DB 제한에 맞춰 dimension을 낮출 수 있다. | dimension별 quality delta를 따로 측정해야 하며, 기존 index와 혼용할 수 없다. |

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
- `docs/vector-index-budget-report.md`는 1536 dimension, 80M chunks 기준 raw vector
  payload를 `491.52 GB`로 추정한다. 같은 float32 가정에서 3072 dimension은 raw vector
  payload와 vector scan/build working set의 기본 단위가 2배가 된다.

## 확장 시 다시 볼 것

1천만 문서는 pressure scenario이며 measured production benchmark가 아니다. 확장 시에는
small, large, down-projected large를 같은 document set과 query set으로 비교한다. 비교 항목은
recall/MRR, exact-token category 영향, multilingual query 차이, re-embedding run당
cost, index memory, build time, rollback plan이다.
