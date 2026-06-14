# Sample Docs

`sample-docs`는 retrieval과 generation evaluation을 위한 20-document set이다. 이는
production data가 아니며 company material이나 private operating note를 포함하지 않는다.
문서 metadata는 full YAML parser가 아니라 `key: value` 한 줄 형식의 frontmatter subset만 사용한다.

허용 content:

- source URL과 usage note가 있는 짧은 public-doc excerpt
- synthetic stale document
- synthetic conflict document
- insufficient-evidence test를 위한 out-of-scope query note

각 public excerpt는 다음을 포함해야 한다:

- source URL
- accessed date
- license 또는 usage note
- eval에 포함한 이유

현재 theme:

- hybrid retrieval과 pgvector HNSW
- chunking과 parent-child retrieval
- reranker latency와 retrieval cache invalidation
- source trust, duplicate detection, version history
- citation validation, prompt-injection text, insufficient-evidence rejection
- sanitized trace observability
- config key, API field, error code, acronym, runbook ID를 위한 exact identifier stress case
