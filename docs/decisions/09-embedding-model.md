# 결정: 임베딩 모델

## 맥락

임베딩 모델 선택은 벡터 차원, 색인 형태, 지연 시간, 비용에 영향을 준다.

## 권장 선택

1536차원을 사용하는 OpenAI `text-embedding-3-small`을 사용한다.

## 검토한 대안

- `text-embedding-3-large`
- `dimensions` 매개변수를 사용한 차원 축소

## 트레이드오프

small 모델은 비용과 저장 공간을 낮추면서 MVP의 초점을 신뢰성 동작에
유지한다. 나중에 모델이나 차원을 바꾸면 재임베딩과 색인 재생성이 필요하다.

| 선택지 | Dimension | 장점 | 비용 |
|---|---:|---|---|
| `text-embedding-3-small` | 1536 | 현재 구현값. 저장 공간과 질의 지연 시간이 작고 공개 샘플 문서에서 충분한 검색 신호를 준다. | larger 모델 대비 품질 여지는 검증하지 않았다. |
| `text-embedding-3-large` | 3072 | 더 큰 임베딩 용량과 품질 비교 후보. | 원본 벡터 용량이 같은 청크 수에서 2배가 되고, 색인 생성/재생성 비용도 커진다. |
| `dimensions` 차원 축소 | 설정 가능 | 저장 공간과 벡터 DB 제한에 맞춰 차원을 낮출 수 있다. | 차원별 품질 차이를 따로 측정해야 하며, 기존 색인과 혼용할 수 없다. |

## 평가 근거

- `OpenAIEmbeddingClient`는 주입된 `fetch` 구현으로 테스트한다. CI는
  LLM 제공자를 호출하지 않고 요청 형태를 검증한다.
- `loadEmbeddedMarkdownDocumentSet`는 PostgreSQL upsert 전에 샘플 청크에
  임베딩을 붙일 수 있는지 검증한다.
- `pnpm db:live-smoke`는 실제 키 경로를 검증한다. 샘플 문서가
  `text-embedding-3-small`로 임베딩되고, 샘플 청크가 null이 아닌 벡터로 저장되며,
  DB 기반 질의 경로가 답변 결과를 반환한다.
- `pnpm db:quality-smoke`는 저장된 샘플 문서 임베딩 위에서 20개의 실제 순위
  검색 사례를 실행한다. 현재 샘플 결과: recall@3 `20/20`, MRR `1.000`.
- `pnpm db:retrieval-compare-smoke`는 같은 샘플 문서 세트에서 벡터 전용 recall@3
  `20/20`, MRR `0.975`를 보여준다. MVP에는 충분히 강한 신호지만, 더 큰
  임베딩 모델 비교를 대체하지 않는다.
- `docs/vector-index-budget-report.md`는 1536차원, 80M 청크 기준 원본 벡터
  용량을 `491.52 GB`로 추정한다. 같은 float32 가정에서 3072차원은 원본 벡터
  용량과 벡터 스캔/빌드 작업 메모리의 기본 단위가 2배가 된다.

## 확장 시 다시 볼 것

확장 시에는 small, large, 차원 축소 large를 같은 문서 세트와 질의 세트로 비교한다.
비교 항목은 recall/MRR, exact-token 범주 영향, 다국어 질의 차이, 재임베딩 실행당
비용, 색인 메모리, 빌드 시간, 되돌림 계획이다.
