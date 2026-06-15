# 결정: PostgreSQL + pgvector

## 맥락

MVP에는 메타데이터, 청크, 벡터, 추적 기록, 평가 결과가 필요하다.

## 결정

실행 환경에는 pgvector와 HNSW 색인을 포함한 PostgreSQL을 사용한다.

## 검토한 대안

- Qdrant
- OpenSearch 벡터 검색
- 별도 벡터 데이터베이스

## 트레이드오프

하나의 데이터 저장소를 사용하면 로컬 재현이 단순해진다. `docker compose`로 PostgreSQL
하나만 올리면 메타데이터, 청크, 벡터, 정리된 추적 기록을 같은 트랜잭션 경계에서
확인할 수 있다. SQL로 검색 행과 추적 기록 행을 함께 검사할 수 있어 시스템을 따라가기 쉽다.

Qdrant 같은 전용 벡터 데이터베이스는 벡터 검색 운영에는 더 직접적일 수 있다. 하지만
MVP 단계에서 메타데이터 저장소, 추적 기록 저장소, 벡터 저장소를 나누면 장애 지점과
설정 면적이 늘어난다. OpenSearch는 BM25와 벡터를 한 컴포넌트에서 다룰 수 있지만,
이 프로젝트의 목적은 검색 제품 운영이 아니라 RAG 신뢰성 경계를 작게 검증하는 것이다.

전용 벡터 데이터베이스로 넘어갈 기준은 명확히 둔다. pgvector HNSW 빌드 메모리,
파티셔닝, vacuum/색인 유지보수, p99 지연 시간, recall 저하가 로컬 MVP의 설명 가능성을
넘어서는 순간 별도 데이터 저장소를 검토한다.

## 평가 근거

- [pgvector Querying 문서](https://github.com/pgvector/pgvector#querying)는 cosine
  distance를 포함한 벡터 거리 연산 문서이다.
- [pgvector Indexing 문서](https://github.com/pgvector/pgvector#indexing)는 정확 검색과
  근사 최근접 이웃 검색, HNSW 색인 문서이다.
- `pnpm db:quality-smoke`는 PostgreSQL + pgvector를 통해 저장된 샘플 문서
  임베딩에 실제 OpenAI 질의 임베딩을 실행한다.
- `pnpm db:retrieval-compare-smoke`는 키워드 전용, hybrid와 함께 벡터 전용
  검색도 측정한다.
- `pnpm db:retrieval-latency-smoke`는 같은 20개 사례에 대해 질의당 OpenAI
  임베딩 호출 1회와 PostgreSQL 키워드, 벡터, hybrid SQL의 집계
  지연 시간을 측정한다. 결과는 `docs/reports/retrieval-latency-report.md`에 둔다.
- `pnpm db:retrieval-concurrency-smoke`는 질의 임베딩을 미리 계산한 뒤
  동시성 `1`과 `4`에서 PostgreSQL 키워드, 벡터, hybrid 검색을
  실행한다. 결과는 `docs/reports/retrieval-concurrency-report.md`에 둔다.
- `pnpm scale:report`는 `docs/reports/scale-budget-report.md`를 쓴다. 현재 용량 계산은
  문서 수, 평균 청크 수, 임베딩 차원 가정에서 저장 공간 압력을 계산한다.
- `pnpm index:report`는 `docs/reports/vector-index-budget-report.md`를 쓴다. 현재 HNSW
  가정은 `m=16`, 계층 배수 `1.10`, 이웃당 그래프 바이트 `8`,
  빌드 메모리 배수 `2.00`이다. 추정치는 HNSW 그래프 바이트
  `11.26 GB`, 벡터 + 메타데이터 + 그래프 제공 용량 `584.70 GB`, 빌드
  작업 메모리 계획치 `1169.41 GB`다.
- 측정 범위: 품질, 지연 시간, 동시성 결과는 공개 샘플 문서 기반 관측이고
  확장성 보고서는 가정 기반 용량 계산이다. PostgreSQL 선택의 초기
  근거로만 사용한다.

## 확장 시 다시 볼 것

확장 시에는 측정된 색인 메모리, 파티셔닝, 보정 전략, 빌드 메모리, 부하 하의 p99
지연 시간, recall 저하, 재임베딩 비용을 다시 검토한다. HNSW 메모리와 지연 시간이
지배적인 문제가 되면 IVF-PQ와 전용 벡터 데이터베이스를 비교한다. 전용 벡터 DB 전환은
운영 복잡도 증가보다 recall/지연 시간/색인 유지보수 이득이 커질 때만 선택한다.
