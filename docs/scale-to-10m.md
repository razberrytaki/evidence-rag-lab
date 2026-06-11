# Scale-to-10M Reasoning Note

## Scope and non-claims

This project does not claim to process 10M documents in production. It documents
the reliability boundaries and bottlenecks that would matter at that scale.
`docs/scale-budget-report.md` is a sizing estimate generated from explicit
assumptions, not a load test. `docs/vector-index-budget-report.md` extends that
math with one explicit HNSW memory-pressure scenario; it is not measured
PostgreSQL or pgvector index size.

## Assumed document and chunk volume

The MVP uses a small public document set. Scale analysis should estimate average
chunks per document, vector storage, metadata storage, and trace volume.
The current sizing report assumes `10,000,000` documents and `8` chunks per
document, yielding `80,000,000` chunks.

## Ingestion bottlenecks

Track normalization throughput, dedup cost, version history, embedding API
throughput, and retry behavior.

## Chunking and versioning strategy

Version chunk ids so citations remain stable after document updates.

## Lexical retrieval: PostgreSQL FTS vs OpenSearch BM25

PostgreSQL FTS is the MVP lexical baseline. OpenSearch BM25 is a scale
alternative when lexical quality and operations justify another component.

## Vector retrieval: pgvector HNSW vs IVF-PQ vs dedicated vector DB

pgvector HNSW keeps the MVP local and inspectable. IVF-PQ and dedicated vector
databases become relevant when memory and latency dominate.
With `1536` float32 dimensions, the current sizing report estimates `491.52 GB`
for raw vector payloads before HNSW graph overhead, WAL, replicas, backups, and
vacuum bloat.
The vector index budget report adds an explicit HNSW graph scenario: `m=16`,
layer multiplier `1.10`, `8` graph bytes per neighbor, and build memory
multiplier `2.00`. Under those assumptions, `80,000,000` chunks produce an HNSW
graph estimate of `11.26 GB`, vector + metadata + graph estimate of `584.70 GB`,
and a build working set planning estimate of `1169.41 GB`. These numbers are planning
inputs for memory-pressure discussion, not observed index size.

## Reranking latency budget

Reranking should be measured as a separate stage after candidate retrieval. The
MVP uses a deterministic query-evidence reranker so the API, trace schema, and
viewer already have a rerank boundary. At scale, compare that baseline against
cross-encoder, ColBERT late interaction, and LLM reranking with fixed candidate
counts, timeout budgets, and fallback behavior.

## Retrieval concurrency budget

`docs/retrieval-concurrency-report.md` is a small local smoke that precomputes
query embeddings, then measures PostgreSQL lexical, vector, and hybrid retrieval
at concurrency `1` and `4` over the public sample docs. It exists to show the
measurement boundary, not to claim production throughput. A production load test
would need larger indexes, representative query mixes, warm/cold cache splits,
connection pool limits, HNSW parameter sweeps, and explicit error-budget
reporting beyond this small-sample P99.

## Source trust and freshness at scale

Trust scoring must include version freshness, source type, duplicate penalty,
and retrieval agreement.

## Cache and invalidation strategy

Cache retrieval paths, embedding results, and rerank results before caching final
answers. Invalidate by document version and chunk hash.

## Observability and failure tracing

Record sanitized traces with score breakdown and rejection reasons. Avoid raw
provider response logs. Include fusion rank and rerank rank/score so ranking
changes can be debugged without replaying raw prompts or provider responses.
With `50,000` daily queries, `4096` bytes per sanitized trace, and `7` retention
days, the current sizing report estimates `1.43 GB` of retained sanitized trace
payloads before database overhead.

## What would change before production

Add access control, privacy review, document set governance, load testing, index
rebuild strategy, trace retention policy, and incident response.
