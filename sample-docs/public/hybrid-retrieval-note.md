---
id: hybrid-retrieval-note
sourceType: public-doc
sourceUrl: https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking
accessed: 2026-06-11
licenseNote: Short paraphrased note derived from public documentation; no upstream prose copied.
---

# Hybrid Retrieval Note

Hybrid retrieval keeps separate candidate lists from keyword-oriented retrieval
and vector retrieval, then merges ranked results. EvidenceRAG uses this sample
note to test why exact terminology and semantic similarity should both influence
the selected context. This note demonstrates why a grounded answer should not
rely only on semantic vectors when exact terminology also matters. Reciprocal
rank fusion is the first merge strategy because it can combine ranks without
assuming the two systems produce calibrated scores.
