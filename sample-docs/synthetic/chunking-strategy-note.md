---
id: chunking-strategy-note
sourceType: synthetic-conflict
licenseNote: Synthetic fixture.
---

# Chunking Strategy Note

Chunking strategy should preserve headings and stable boundaries before token
length alone is considered. EvidenceRAG starts with heading-aware recursive
chunking because reviewers can inspect why a claim belongs to one chunk and not
another. Semantic chunking remains a later comparison target, not the first
runtime dependency.
