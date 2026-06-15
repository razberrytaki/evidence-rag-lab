# 결정: 관측 가능성

## 맥락

검색 추적 기록과 점수 추적 기록이 없으면 RAG 실패를 디버깅하기 어렵다.

## 권장 선택

실행 중 질의 추적 기록은 검색/생성 디버깅에 필요한 원문 문맥을 포함할 수 있다.
저장 단계에서는 후보 청크 id, 점수 분해, 선택 문맥 id, 거절 사유, 최종 판단만 남긴
정리된 질의 추적 기록으로 변환한다.

보관, 가림 처리, 샘플링 세부 사항은
`docs/decisions/trace-retention-and-privacy.md`에서 따로 추적한다.

## 검토한 대안

- 전체 LLM 요청 로그
- 집계 지표만 저장

## 트레이드오프

정리된 추적 기록은 공개 저장소에 더 안전하면서도 디버깅에 유용하다. 원문 로그는
전체 LLM 요청, 문맥, LLM 응답을 노출한다.

## 평가 근거

- `trace-completeness`를 사용한다.
- 실행 중 `QueryTrace`에는 저장 안전성을 뜻하는 `sanitized` 플래그를 두지 않는다.
- `buildQueryTraceUpsertSql`는 청크 원문이나 인용 문구 없이 정리된
  추적 기록을 `query_traces`에 저장한다.
- `buildLatestQueryTraceSql`는 `sanitized = true` 행만 읽고 최신 추적 기록을
  먼저 정렬한다.
- `GET /query-traces/latest`는 로컬 확인용 최신 정리 추적 기록을
  반환한다.
- Vite 웹 앱은 `/query` 실행 결과와 최신 정리 추적 기록을 보여준다. API에
  추적 기록이 아직 없으면 포함된 정리 샘플로 대체한다.
- 추적 기록 후보는 `fusedRank`, `rerankRank`, `rerankScore`를 포함할 수 있다.
  따라서 원문 문맥 없이도 검색 결합과 재순위화 판단이 보인다.
- `pnpm db:live-smoke`는 DB 기반 질의 경로가 정리 추적 기록 행을 저장하는지
  검증한다(`tracePersisted: true`).
- `pnpm db:live-generation-smoke`는 실제 생성 경로가 정리 추적 기록을
  저장하는지 검증하고, 집계 생성 상태, 주장 수, 인용 수, 선택 청크 ID만 출력한다.
- `sanitizeQueryTraceForStorage`는 저장 전에 이메일 주소와 API key 형태 비밀값을
  가린다.
- `pnpm db:trace-retention-smoke`는 만료된 정리 추적 기록을 삭제하되 새 추적 기록은
  삭제하지 않는지 검증한다.

## 확장 시 다시 볼 것

추적 기록 정리를 예약 작업으로 옮기고, 추적 기록 행 삭제 전에 집계 지표를
내보낸다.
