# EvidenceRAG Lab

EvidenceRAG Lab은 RAG 시스템에서 “답을 만들 수 있는가”보다 “근거를 확인할 수
있는가”를 먼저 보는 포트폴리오 프로젝트다.

작은 공개 문서 세트와 합성 실패 사례를 사용해 검색, 재순위화, 출처 신뢰도,
인용 검증, 실패 처리, 추적 가능성을 한 흐름으로 검증한다. 출발 질문은 “문서 수가
크게 늘어나면 RAG에서 무엇이 먼저 깨지는가”였다. 1천만 문서는 그 질문을 구체화하기
위한 scale scenario이며, 이 레포가 그 규모를 이미 처리한다는 뜻은 아니다. 목표는 큰
RAG 시스템을 설계할 때 어떤 질문을 먼저 던져야 하는지, 그 질문을 어떻게 작게 검증할
수 있는지를 보여주는 것이다.

## 먼저 읽을 문서

- [포트폴리오 개요](docs/portfolio.md): 문제의식, 설계 목표, 핵심 선택, 검증 결과
- [설계 결정 문서](docs/decisions/README.md): trade-off 기록과 읽는 순서
- [확장성 추론 노트](docs/scale-to-10m.md): scale scenario와 지금 구현 사이의 간극
- [용어표](docs/glossary.md): 반복되는 RAG 용어와 이 프로젝트에서의 의미
- [공개 전 체크리스트](docs/publication-checklist.md): 공개 저장소로 유지하기 위한 검증 절차

## 핵심 설계

- 검색은 벡터 검색만 사용하지 않고, 정확한 용어를 보호하기 위해 lexical 검색을 함께 사용한다.
- 생성은 검색된 문맥 안에서만 답하게 하고, 인용이 선택된 chunk를 가리키는지 검증한다.
- 신뢰도가 낮거나 근거가 부족하면 답을 만들지 않고 실패를 명시한다.
- query trace에는 redacted user query preview, 점수, 선택, 거절 이유만 남긴다. full provider prompt, raw context bundle, provider response, secret은 남기지 않는다.
- 모든 중요한 trade-off는 decision 문서와 generated report로 재현 가능하게 남긴다.

## 현재 구현 범위

- pnpm workspace 기반 monorepo
- NestJS API와 Vite 질의 실행 및 trace viewer
- PostgreSQL + pgvector 기반 sample retrieval path
- OpenAI `text-embedding-3-small` embedding path
- OpenAI-compatible generation adapter, Anthropic comparison adapter, deterministic fake provider
- 15개 eval fixture와 20개 retrieval quality case
- 검색 품질, 모드 비교, 지연 시간, 동시성, provider, scale budget, vector index budget report
- public repo hygiene와 publication gate

아직 운영 검증 단계는 아니다. 큰 데이터셋, 접근 제어, privacy review, index rebuild
strategy, 장애 대응, 실제 부하 테스트는 별도 단계로 남아 있다.

## 빠른 실행

```bash
pnpm install
pnpm build
pnpm test
pnpm public:check
```

PostgreSQL 동작 확인 경로:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm db:smoke
```

live OpenAI embedding 경로는 `.env.example`에서 local `.env`를 만들고
`OPENAI_API_KEY`를 설정한 뒤 실행한다.

```bash
pnpm db:live-smoke
pnpm db:quality-smoke
pnpm db:retrieval-compare-smoke
pnpm db:retrieval-latency-smoke
pnpm db:retrieval-concurrency-smoke
pnpm db:live-generation-smoke
```

## 레포 구조

```text
apps/
  api/                 NestJS API
  web/                 Query runner and trace viewer
packages/
  domain/              Document, chunk, citation, claim, trace types
  generation/          LLM provider adapters and fake provider
  eval/                Eval fixtures, report renderers, scale estimates
  ingest/              Markdown loading, normalization, embeddings
  retrieval/           PostgreSQL lexical/vector/hybrid retrieval
  scoring/             Source trust scoring
infra/
  docker-compose.yml   PostgreSQL + pgvector
sample-docs/           Public sample docs and synthetic failure fixtures
docs/
  decisions/           Trade-off decision notes
  *-report.md          Generated evidence reports
```

## 생성 리포트

`docs/*-report.md` 파일은 직접 편집하지 않는다. report renderer나 동작 확인 script를
수정한 뒤 command로 다시 생성한다.

```bash
pnpm eval:report
pnpm provider:report
pnpm scale:report
pnpm index:report
```

`pnpm eval:report`는 sample runtime observation이 stale `apps/api/dist`를 읽지
않도록 API package를 먼저 build한다.

live DB report는 PostgreSQL과 OpenAI embedding key가 필요하다.

```bash
pnpm db:quality-smoke
pnpm db:retrieval-compare-smoke
pnpm db:retrieval-latency-smoke
pnpm db:retrieval-concurrency-smoke
```

## 공개 데이터 원칙

허용:

- 합성 fixture
- 출처와 사용 이유가 있는 짧은 공개 문서 excerpt
- sanitized trace sample
- aggregate report

금지:

- 회사 문서, 고객 데이터, 개인 데이터
- `.env`, API key, token, provider secret
- full provider prompt, raw context bundle, provider raw response
- database dump, embedding cache

## 다음 비교 과제

현재 `sample-docs`는 영어 공개 문서와 합성 실패 사례로 유지한다. 다음 단계에서는
한국어 query와 영어 query를 같은 문서 세트에 실행해 검색 순위, 인용 범위, 거절
비율, trace shape가 어떻게 달라지는지 별도 report로 추적한다.
