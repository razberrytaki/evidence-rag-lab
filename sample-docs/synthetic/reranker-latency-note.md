---
id: reranker-latency-note
sourceType: synthetic-conflict
licenseNote: Synthetic fixture.
---

# Reranker Latency Note

Reranker latency must fit a fixed budget. EvidenceRAG keeps a reranker boundary
separate from first-stage retrieval so cross-encoder, ColBERT-style, or LLM
reranking can be compared later without rewriting ingestion or trace storage.
