---
id: citation-validation-note
sourceType: synthetic-conflict
licenseNote: Synthetic fixture.
---

# Citation Validation Note

Citation validation checks that every generated claim points back to a selected
document chunk. If a model cites an unknown chunk id, EvidenceRAG rejects the
answer instead of trusting the citation. This fixture tests the post-generation
guard, not prompt wording alone.
