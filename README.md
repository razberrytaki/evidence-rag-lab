# EvidenceRAG Lab

EvidenceRAG Lab은 RAG 답변이 검색 근거와 인용으로 검증되지 않으면 답하지 않는
신뢰성 검증 프로젝트다.

## 문제의식

RAG 프로젝트는 종종 “좋은 모델을 붙이면 답이 좋아진다”는 식으로 설명된다. 하지만
실제 문제는 모델보다 앞단에 있다. 어떤 문서를 가져왔는지, 그 문서가 믿을 만한지,
답이 그 문서 안에서만 나왔는지, 근거가 부족할 때 멈출 수 있는지가 더 중요하다.

EvidenceRAG Lab은 이 지점을 작은 공개 문서 세트에서 재현 가능한 방식으로 검증한다.
큰 시스템을 흉내 내기보다, 대규모 RAG 설계에서 필요한 판단을 실행 가능한 단위로
나눴다.

이 프로젝트의 초기 질문은 “1천만 문서까지 늘어나는 RAG라면 무엇을 먼저 설계해야
하는가”였다. 여기서 1천만 문서는 구현 완료 범위가 아니라 검색 품질, 색인 메모리,
추적 기록 보존, 장애 대응 같은 압력을 한꺼번에 드러내기 위한 확장성 검토 기준이다.
그래서 구현은 작은 공개 문서 세트로 재현성을 유지하고, 확장성 논의는 명시한 가정과
계산으로 분리한다.

## 설계 목표

- 근거 없는 답변보다 명시적 실패를 선호한다.
- 검색 품질과 생성 품질을 섞어 보지 않는다.
- 수치가 작더라도 어떤 경계에서 측정했는지 분리한다.
- 공개 저장소에 올릴 수 없는 데이터와 로그는 구조적으로 남기지 않는다.
- “나중에 대규모로 바꿀 부분”과 “지금 검증한 부분”을 문서에서 구분한다.

## 핵심 선택

### 1. 벡터 검색만 사용하지 않는다

의미가 비슷한 문장을 찾는 데는 벡터 검색이 유리하다. 하지만 설정 키, API 필드,
오류 코드, 약어, 실행 문서 ID처럼 정확한 문자열이 중요한 경우에는 키워드 검색이
필요하다.

그래서 PostgreSQL full-text search, 정확한 토큰 매칭, pgvector 검색을 함께
사용하고 reciprocal rank fusion으로 결과를 합친다.

관련 문서: [하이브리드 검색 결정](docs/decisions/02-hybrid-retrieval.md)

### 2. 생성은 검색 결과 안에 묶는다

답변 생성은 선택된 문맥 안에서만 허용한다. LLM 제공자가 인용을 반환하더라도
그 인용이 실제 선택된 청크를 가리키지 않으면 거절한다.

이 방식은 유용한 답변을 일부 놓칠 수 있다. 하지만 이 프로젝트의 목적은 그럴듯한
답변보다 검증 가능한 답변이다.

관련 문서: [답변 보호 장치 결정](docs/decisions/06-answer-guard.md)

### 3. 실패를 제품 동작으로 취급한다

근거가 부족하거나 인용이 깨지면 “충분한 근거 없음”으로 끝난다. 이는 예외 상황이
아니라 RAG 시스템이 가져야 할 정상 동작이다.

평가 사례에는 근거 부족, 지원되지 않는 주장, 프롬프트 주입 같은 실패 사례를 포함했다.

관련 리포트: [평가 리포트](docs/eval-report.md)

### 4. 추적 기록은 남기되 원문 데이터는 남기지 않는다

디버깅에는 추적 기록이 필요하다. 하지만 전체 LLM 요청, 원문 문맥 묶음,
LLM 응답 원문을 그대로 저장하면 공개 저장소와 운영 개인정보 경계 모두에서
위험하다.

이 프로젝트는 정리된 추적 기록만 저장한다. 후보 점수, 선택 여부, 거절 이유,
재순위화 결과, 가린 질의 미리보기는 남기고 원문 청크와 LLM 응답 원문은 남기지 않는다.

관련 문서: [추적 기록 보관과 개인정보 결정](docs/decisions/10-trace-retention-and-privacy.md)

### 5. 확장성 주장이 아니라 확장성 질문을 계산한다

확장성은 실제 부하 테스트 없이 주장할 수 없다. 대신 문서 수, 청크 수,
임베딩 차원, 추적 기록 보존 같은 가정을 명시하고 저장 공간과 색인 병목을 계산한다.

이 숫자는 성능 주장이 아니라 설계 대화를 위한 출발점이다.

관련 문서: [확장성 추론 노트](docs/scale-to-10m.md)

## 구현 범위

- pnpm workspace 기반 단일 저장소
- NestJS API와 Vite 질의 실행 및 추적 기록 화면
- PostgreSQL + pgvector 기반 샘플 검색 경로
- OpenAI `text-embedding-3-small` 임베딩 경로
- OpenAI 호환 생성 어댑터, Anthropic 비교 어댑터, 결정적 fake LLM 제공자
- 평가 사례, 검색 품질 사례, 검색 모드 비교, 지연 시간, 동시성, 확장성 예산 보고서
- 공개 저장소 위생과 공개 전 검증 절차

아직 운영 검증 단계는 아니다. 큰 데이터셋, 접근 제어, 개인정보 검토, 색인 재생성
전략, 장애 대응, 실제 부하 테스트는 별도 단계로 남아 있다.

## 검증한 것

- 15개 결정적 평가 사례가 모두 통과한다.
- 이 중 샘플 실행 관측은 2건이며, 근거 부족 계열의 거절 동작을 우선 검증한다.
- 공개 샘플 문서 20개 검색 품질 사례에서 hybrid recall@3 `20/20`, MRR `1.000`을 측정한다.
- 키워드 전용, 벡터 전용, hybrid 검색을 같은 사례로 비교한다.
- 임베딩 지연 시간과 PostgreSQL 검색 지연 시간을 분리해 본다.
- 동시성 `1`과 `4`에서 DB 검색 구간을 분리해 측정한다.
- web에서 `/query`를 실행하고 정리된 LLM 응답, 주장/인용 수, 선택된 청크 id를 표시한다.
- 문서 `10,000,000`개, 청크 `80,000,000`개 기준 원본 벡터 용량을 `491.52 GB`로 추정한다.
- 공개 저장소 검사기가 비밀값, 원문 추적 기록, 공개 전 검증 절차 누락을 잡는다.

## 빠른 실행

```bash
pnpm install
pnpm public:check
```

개발 중 빠른 확인:

```bash
pnpm build
pnpm test
```

PostgreSQL 동작 확인 경로:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm db:smoke
```

실제 OpenAI 임베딩 경로는 `.env.example`에서 로컬 `.env`를 만들고
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
  web/                 질의 실행 화면과 추적 기록 화면
packages/
  domain/              문서, 청크, 인용, 주장, 추적 기록 타입
  generation/          LLM 제공자 어댑터와 fake LLM 제공자
  eval/                평가 사례, 보고서 생성기, 확장성 추정
  ingest/              Markdown 로딩, 정규화, 임베딩
  retrieval/           PostgreSQL 키워드/벡터/hybrid 검색
  scoring/             출처 신뢰도 점수화
infra/
  docker-compose.yml   PostgreSQL + pgvector
sample-docs/           공개 샘플 문서와 합성 실패 사례
docs/
  decisions/           절충 판단 기록
  *-report.md          생성된 근거 보고서
```

## 생성 리포트

`docs/*-report.md` 파일은 직접 편집하지 않는다. 보고서 생성기나 동작 확인 스크립트를
수정한 뒤 명령으로 다시 생성한다.

```bash
pnpm eval:report
pnpm provider:report
pnpm scale:report
pnpm index:report
```

`pnpm eval:report`는 샘플 실행 관측이 오래된 `apps/api/dist`를 읽지
않도록 API package를 먼저 build한다.

실제 DB 보고서는 PostgreSQL과 OpenAI 임베딩 키가 필요하다.

```bash
pnpm db:quality-smoke
pnpm db:retrieval-compare-smoke
pnpm db:retrieval-latency-smoke
pnpm db:retrieval-concurrency-smoke
```

## 공개 데이터 원칙

허용:

- 합성 평가 사례
- 출처와 사용 이유가 있는 짧은 공개 문서 excerpt
- 정리된 추적 기록 샘플
- 집계 보고서

금지:

- 회사 문서, 고객 데이터, 개인 데이터
- `.env`, API key, token, LLM 제공자 비밀값
- license 또는 usage review 없이 복사한 큰 public docs
- 전체 LLM 요청, 원문 문맥 묶음, LLM 응답 원문
- 데이터베이스 dump, 임베딩 캐시

## 더 읽을 문서

- [설계 결정 문서](docs/decisions/README.md): 절충 판단 기록과 읽는 순서
- [확장성 추론 노트](docs/scale-to-10m.md): 확장성 검토 기준과 지금 구현 사이의 간극
- [용어표](docs/glossary.md): 반복되는 RAG 용어와 이 프로젝트에서의 의미
- [공개 전 체크리스트](docs/publication-checklist.md): 공개 저장소로 유지하기 위한 검증 절차

## 다음 비교 과제

현재 `sample-docs`는 영어 공개 문서와 합성 실패 사례로 유지한다. 다음 단계에서는
한국어 질의와 영어 질의를 같은 문서 세트에 실행해 검색 순위, 인용 범위, 거절
비율, 추적 기록 형태가 어떻게 달라지는지 별도 보고서로 추적한다.
