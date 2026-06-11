# Eval Report

Generated from deterministic eval fixtures. Live retrieval metrics are added as the runtime pipeline replaces fake observations.

Summary: 15/15 fixtures passed.

| Metric | Result | Rate |
|---|---:|---:|
| recall@k | 12/12 | 100% |
| citation coverage | 12/12 | 100% |
| unsupported-claim rejection | 4/4 | 100% |
| trace completeness | 15/15 | 100% |

| Fixture | Status | Notes |
|---|---|---|
| exact-term-retrieval | pass | ok |
| semantic-paraphrase | pass | ok |
| hybrid-rescue | pass | ok |
| lexical-false-positive | pass | ok |
| parent-child-context | pass | ok |
| duplicate-doc-penalty | pass | ok |
| stale-source-demotion | pass | ok |
| conflicting-source | pass | ok |
| low-trust-source | pass | ok |
| insufficient-evidence | pass | ok |
| citation-per-claim | pass | ok |
| unsupported-claim-detection | pass | ok |
| document-prompt-injection | pass | ok |
| user-prompt-injection | pass | ok |
| trace-completeness | pass | ok |
