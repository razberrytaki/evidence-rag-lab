# 결정: PostgreSQL + pgvector

## 맥락

MVP에는 metadata, chunk, vector, trace, evaluation output이 필요하다.

## 권장 선택

lab runtime에는 pgvector와 HNSW index를 포함한 PostgreSQL을 사용한다.

## 검토한 대안

- Qdrant
- OpenSearch vector search
- 별도 vector database

## 트레이드오프

하나의 datastore를 사용하면 local reproduction이 단순해진다. `docker compose`로
PostgreSQL 하나만 올리면 metadata, chunk, vector, sanitized trace를 같은 transaction
boundary에서 확인할 수 있다. SQL로 retrieval row와 trace row를 함께 검사할 수 있어
portfolio reviewer가 시스템을 따라가기 쉽다.

Qdrant 같은 전용 vector database는 vector search 운영에는 더 직접적일 수 있다. 하지만
MVP 단계에서 metadata store, trace store, vector store를 나누면 장애 지점과 setup
surface가 늘어난다. OpenSearch는 BM25와 vector를 한 컴포넌트에서 다룰 수 있지만,
이 프로젝트의 현재 질문은 search product 운영이 아니라 RAG reliability boundary를
작게 검증하는 것이다.

전용 vector database로 넘어갈 기준은 명확히 둔다. pgvector HNSW build memory,
partitioning, vacuum/index maintenance, p99 latency, recall degradation이 local MVP의
설명 가능성을 넘어서는 순간 별도 datastore를 검토한다.

## 평가 근거

- [pgvector README](https://github.com/pgvector/pgvector)는 exact/approximate
  nearest neighbor search, cosine distance, HNSW index를 문서화한다.
- `pnpm db:quality-smoke`는 PostgreSQL + pgvector를 통해 저장된 sample-doc
  embedding에 live OpenAI query embedding을 실행한다.
- 현재 sample-doc 결과는 hybrid retrieval decision을 지지한다. PostgreSQL + pgvector
  선택에는 "같은 datastore에서 vector, lexical, trace를 함께 검사할 수 있다"는 의미로
  사용한다.
- `pnpm db:retrieval-compare-smoke`는 lexical-only, hybrid와 함께 vector-only
  retrieval도 측정한다. 현재 sample-doc vector-only 결과: recall@3 `20/20`,
  MRR `0.975`.
- `pnpm db:retrieval-latency-smoke`는 같은 20개 case에 대해 query당 OpenAI
  embedding call 1회와 PostgreSQL lexical, vector, hybrid SQL의 aggregate
  latency를 측정한다. 결과는 `docs/retrieval-latency-report.md`에 둔다.
- `pnpm db:retrieval-concurrency-smoke`는 query embedding을 미리 계산한 뒤
  concurrency `1`과 `4`에서 PostgreSQL lexical, vector, hybrid retrieval을
  실행한다. 결과는 `docs/retrieval-concurrency-report.md`에 둔다.
- `pnpm scale:report`는 `docs/scale-budget-report.md`를 쓴다. 현재 sizing math는
  문서 수, 평균 chunk 수, embedding dimension 가정에서 storage pressure를 계산한다.
- `pnpm index:report`는 `docs/vector-index-budget-report.md`를 쓴다. 현재 HNSW
  scenario는 `m=16`, layer multiplier `1.10`, neighbor당 graph bytes `8`,
  build memory multiplier `2.00`을 가정한다. 추정치는 HNSW graph bytes
  `11.26 GB`, vector + metadata + graph serving bytes `584.70 GB`, build
  working set planning estimate `1169.41 GB`다.
- 측정 범위: quality, latency, concurrency 결과는 public sample docs 기반
  observation이고 scale report는 가정 기반 sizing math다. PostgreSQL 선택의 초기
  근거로만 사용한다.

## 확장 시 다시 볼 것

1천만 문서는 pressure scenario이며 measured production benchmark가 아니다. 확장 시에는
측정된 index memory, partitioning, backfill strategy, build memory, load 하의 p99
latency, recall degradation, re-embedding cost를 다시 검토한다. 전용 vector DB 전환은
운영 복잡도 증가보다 recall/latency/index maintenance 이득이 커질 때만 선택한다.
