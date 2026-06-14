# 평가 리포트

deterministic eval fixture와 sample-runtime pipeline observation에서 생성된다.
현재 runtime observation은 insufficient-evidence 계열 negative guard를 우선 검증한다.

요약: 15/15 fixture 통과.

## 읽는 법

- fixture 통과 수보다 어떤 guard가 runtime observation으로 확인됐는지 먼저 본다.

| Metric | 결과 | 비율 |
|---|---:|---:|
| recall@k | 12/12 | 100% |
| citation coverage | 12/12 | 100% |
| unsupported-claim rejection | 4/4 | 100% |
| trace completeness | 15/15 | 100% |

| Observation source | Count |
|---|---:|
| static-fixture | 13 |
| sample-runtime | 2 |

| Fixture | 상태 | 메모 |
|---|---|---|
| exact-term-retrieval | 통과 | 정상 |
| semantic-paraphrase | 통과 | 정상 |
| hybrid-rescue | 통과 | 정상 |
| lexical-false-positive | 통과 | 정상 |
| parent-child-context | 통과 | 정상 |
| duplicate-doc-penalty | 통과 | 정상 |
| stale-source-demotion | 통과 | 정상 |
| conflicting-source | 통과 | 정상 |
| low-trust-source | 통과 | 정상 |
| insufficient-evidence | 통과 | 정상 |
| citation-per-claim | 통과 | 정상 |
| unsupported-claim-detection | 통과 | 정상 |
| document-prompt-injection | 통과 | 정상 |
| user-prompt-injection | 통과 | 정상 |
| trace-completeness | 통과 | 정상 |
