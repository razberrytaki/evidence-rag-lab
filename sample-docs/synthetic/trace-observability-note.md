---
id: trace-observability-note
sourceType: synthetic-conflict
licenseNote: Synthetic fixture.
---

# Trace Observability Note

Trace observability records normalized query text, candidate ranks, selected
chunk ids, rejected reasons, and final generation status. It intentionally omits
raw chunk text and citation quotes so debugging remains useful without turning
the trace table into a sensitive text store.
