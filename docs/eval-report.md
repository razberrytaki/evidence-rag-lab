# 평가 리포트

정적 eval fixture와 sample-runtime observation을 합쳐 생성한다.
현재 runtime observation은 insufficient-evidence 계열 negative guard를 우선 검증한다.

요약: 15/15 fixture 통과. sample-runtime observation 2건, static fixture 13건.

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

| Fixture | Observation source | 상태 | 메모 |
|---|---|---|---|
| exact-term-retrieval | static-fixture | 통과 | 정상 |
| semantic-paraphrase | static-fixture | 통과 | 정상 |
| hybrid-rescue | static-fixture | 통과 | 정상 |
| lexical-false-positive | static-fixture | 통과 | 정상 |
| parent-child-context | static-fixture | 통과 | 정상 |
| duplicate-doc-penalty | static-fixture | 통과 | 정상 |
| stale-source-demotion | static-fixture | 통과 | 정상 |
| conflicting-source | static-fixture | 통과 | 정상 |
| low-trust-source | static-fixture | 통과 | 정상 |
| insufficient-evidence | sample-runtime | 통과 | 정상 |
| citation-per-claim | static-fixture | 통과 | 정상 |
| unsupported-claim-detection | static-fixture | 통과 | 정상 |
| document-prompt-injection | static-fixture | 통과 | 정상 |
| user-prompt-injection | sample-runtime | 통과 | 정상 |
| trace-completeness | static-fixture | 통과 | 정상 |
