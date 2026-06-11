# Sample Docs

`sample-docs` is a 20-document set for retrieval and generation evaluation. It
is not production data and does not include company material or private
operating notes.

Allowed content:

- short public-doc excerpts with source URL and usage note
- synthetic stale documents
- synthetic conflict documents
- out-of-scope query notes for insufficient-evidence tests

Each public excerpt must include:

- source URL
- accessed date
- license or usage note
- reason it is included in eval

Current themes:

- hybrid retrieval and pgvector HNSW
- chunking and parent-child retrieval
- reranker latency and retrieval cache invalidation
- source trust, duplicate detection, and version history
- citation validation, prompt-injection text, and insufficient-evidence rejection
- sanitized trace observability
- exact identifier stress cases for config keys, API fields, error codes,
  acronyms, and runbook IDs
