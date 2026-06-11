---
id: retrieval-cache-note
sourceType: synthetic-conflict
licenseNote: Synthetic fixture.
---

# Retrieval Cache Note

Retrieval cache entries should be keyed by normalized query, index version, and
retrieval configuration. Caching final answers is riskier because source
freshness and citation policy can change. EvidenceRAG starts by caching retrieval
paths, not generated prose.
