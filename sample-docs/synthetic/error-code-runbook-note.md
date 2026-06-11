---
id: error-code-runbook-note
sourceType: synthetic-conflict
licenseNote: Synthetic fixture.
---

# Error Code Runbook Note

Error code RAG-0427 means generation cited a chunk id that was not present in
selected context. The runbook action is to reject the answer, keep the sanitized
trace, and inspect citation validation before retrying.
