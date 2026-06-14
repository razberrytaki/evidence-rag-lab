# 설계 결정 문서

이 폴더는 EvidenceRAG Lab을 만들며 남긴 trade-off 기록이다. 각 문서는 같은 질문을
다룬다.

- 어떤 문제가 있었나
- 어떤 선택을 했나
- 무엇을 포기했나
- 어떤 근거로 확인했나
- 규모가 커지면 무엇을 다시 봐야 하나

초기 질문은 “문서 수가 1천만 단위로 커지는 RAG라면 무엇이 먼저 문제가 되는가”였다.
각 결정 문서의 `확장 시 다시 볼 것` 섹션은 이 숫자를 구현 완료 범위로 삼는 대신,
작은 구현에서 확인한 선택이 큰 scale scenario로 갈 때 어디서 다시 검증되어야 하는지
기록한다.

## 대표 trade-off

- vector-only 검색은 포기했다. sample set에서는 강하게 동작했지만, exact token,
  acronym, config key, runbook ID가 중요해질 때 lexical signal을 trace에 남겨야 한다.
- raw trace 저장은 포기했다. debugging에는 편하지만 공개 repo와 production privacy
  boundary 모두에서 위험하므로 sanitized score, rank, rejection reason만 남긴다.
- 모호한 답변은 포기했다. citation coverage나 trust threshold가 부족하면 유용한 답변을
  일부 놓치더라도 reject를 선택한다.

## 먼저 읽을 문서

1. [하이브리드 검색](02-hybrid-retrieval.md)
2. [Answer Guard](06-answer-guard.md)
3. [Observability](08-observability.md)
4. [Trace Retention and Privacy](10-trace-retention-and-privacy.md)
5. [Embedding Model](09-embedding-model.md)

## 전체 목록

- [청킹](01-chunking.md)
- [하이브리드 검색](02-hybrid-retrieval.md)
- [PostgreSQL + pgvector](03-postgres-pgvector.md)
- [Reranking](04-reranking.md)
- [Source Trust](05-source-trust.md)
- [Answer Guard](06-answer-guard.md)
- [LLM Provider](07-llm-provider.md)
- [Observability](08-observability.md)
- [Embedding Model](09-embedding-model.md)
- [Trace Retention and Privacy](10-trace-retention-and-privacy.md)

## 읽는 방법

처음부터 끝까지 읽을 필요는 없다. README와 [포트폴리오 개요](../portfolio.md)를 먼저
읽고, 궁금한 선택만 이 폴더에서 확인한다. 수치 근거는 각 결정 문서가 가리키는
generated report에서 확인한다.
