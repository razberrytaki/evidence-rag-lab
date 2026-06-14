# 확장성 추론 노트

## 왜 10M을 가정했나

이 프로젝트의 출발 질문은 “문서 수가 1천만 단위로 커지면 RAG에서 무엇이 먼저
깨지는가”였다. 이 숫자는 구현 완료 기준이 아니라 pressure scenario다. 검색 품질,
index memory, trace 보존, load, 운영 경계를 같은 기준에서 보기 위해 큰 숫자를 하나
고정했다.

이 문서는 그 scale scenario에서 중요해질 reliability boundary와 bottleneck을 정리한다.
`docs/scale-budget-report.md`는 명시적 assumption에서 생성한 sizing estimate다.
`docs/vector-index-budget-report.md`는 그 수학에 explicit HNSW memory-pressure scenario
하나를 더한 것이다. 둘 다 measured PostgreSQL 또는 pgvector index size는 아니다.

## 문서/청크 가정

MVP는 작은 public document set을 사용한다. scale analysis는 document당 평균 chunk
수, vector storage, metadata storage, trace volume을 추정해야 한다. 현재 sizing
report는 `10,000,000` documents와 document당 `8` chunks를 가정해 `80,000,000`
chunks를 산출한다.

## Ingestion bottleneck

normalization throughput, dedup cost, version history, embedding API throughput,
retry behavior를 추적한다.

## Chunking과 versioning strategy

document update 이후에도 citation이 안정적으로 유지되도록 chunk id에 version을
포함한다.

## Lexical retrieval: PostgreSQL FTS vs OpenSearch BM25

PostgreSQL FTS는 MVP lexical baseline이다. OpenSearch BM25는 lexical quality와
운영 비용이 추가 component를 정당화할 때의 scale alternative다.

## Vector retrieval: pgvector HNSW vs IVF-PQ vs dedicated vector DB

pgvector HNSW는 MVP를 local하고 inspectable하게 유지한다. memory와 latency가
지배적이 되면 IVF-PQ와 dedicated vector database가 검토 대상이 된다.

`1536` float32 dimensions 기준 현재 sizing report는 HNSW graph overhead, WAL,
replica, backup, vacuum bloat를 제외하고 raw vector payload를 `491.52 GB`로
추정한다.

vector index budget report는 explicit HNSW graph scenario를 추가한다: `m=16`, layer
multiplier `1.10`, neighbor당 graph bytes `8`, build memory multiplier `2.00`.
이 assumption 아래 `80,000,000` chunks는 HNSW graph estimate `11.26 GB`, vector +
metadata + graph estimate `584.70 GB`, build working set planning estimate
`1169.41 GB`를 만든다. 이 숫자는 memory-pressure discussion을 위한 planning input이며
observed index size가 아니다.

## Reranking latency budget

reranking은 candidate retrieval 이후 별도 stage로 측정해야 한다. MVP는 deterministic
query-evidence reranker를 사용하므로 API, trace schema, viewer에 이미 rerank boundary가
있다. scale 단계에서는 고정된 candidate count, timeout budget, fallback behavior 아래
이 baseline을 cross-encoder, ColBERT late interaction, LLM reranking과 비교한다.

## Retrieval concurrency budget

`docs/retrieval-concurrency-report.md`는 query embedding을 미리 계산한 뒤 public
sample docs 위에서 concurrency `1`과 `4`로 PostgreSQL lexical, vector, hybrid
retrieval 구간만 측정한다. production load test에는 larger index, representative
query mix, warm/cold cache split, connection pool limit, HNSW parameter sweep,
sample P99를 넘어서는 explicit error-budget reporting이 필요하다.

## Source trust와 freshness at scale

trust scoring에는 version freshness, source type, duplicate penalty, retrieval
agreement를 포함해야 한다.

## Cache와 invalidation strategy

final answer를 cache하기 전에 retrieval path, embedding result, rerank result를 먼저
cache한다. invalidation은 document version과 chunk hash 기준으로 수행한다.

## Observability와 failure tracing

score breakdown과 rejection reason을 포함한 sanitized trace를 기록한다. raw provider
response log는 피한다. full provider prompt나 provider response를 replay하지 않고도
ranking change를 debug할 수 있도록 fusion rank와 rerank rank/score를 포함한다.

daily queries `50,000`, sanitized trace당 `4096` bytes, retention `7` days 기준 현재
sizing report는 database overhead 전 retained sanitized trace payload를 `1.43 GB`로
추정한다.

## Production 전 바뀌어야 할 것

access control, privacy review, document set governance, load testing, index rebuild
strategy, trace retention policy, incident response를 추가한다.
