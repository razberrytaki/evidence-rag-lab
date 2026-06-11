---
id: config-key-routing-note
sourceType: synthetic-conflict
licenseNote: Synthetic fixture.
---

# Config Key Routing Note

The exact config key RAG_QUERY_MODE=postgres routes API queries through
PostgreSQL retrieval. When the value is not postgres, the API keeps the
deterministic sample pipeline for local tests and CI.
