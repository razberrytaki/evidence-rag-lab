# 결정: Observability

## 맥락

retrieval trace와 scoring trace가 없으면 RAG failure를 디버깅하기 어렵다.

## 권장 선택

runtime query trace는 retrieval/generation debugging에 필요한 raw context를 포함할 수
있다. 저장 단계에서는 candidate chunk id, score breakdown, selected context id,
rejected reason, final decision만 남긴 sanitized query trace로 변환한다.

retention, redaction, sampling 세부 사항은
`docs/decisions/10-trace-retention-and-privacy.md`에서 따로 추적한다.

## 검토한 대안

- full provider prompt log
- aggregate-only metric

## 트레이드오프

sanitized trace는 public repo에 더 안전하면서도 debugging에 유용하다. raw log는
full provider prompt, context, provider response를 노출한다.

## 평가 근거

- `trace-completeness`를 사용한다.
- runtime `QueryTrace`에는 storage-safe 의미의 `sanitized` flag를 두지 않는다.
- `buildQueryTraceUpsertSql`는 raw chunk text나 citation quote 없이 sanitized
  trace를 `query_traces`에 저장한다.
- `buildLatestQueryTraceSql`는 `sanitized = true` row만 읽고 newest trace를
  먼저 정렬한다.
- `GET /query-traces/latest`는 local inspection용 latest sanitized trace를
  반환한다.
- Vite web app은 `/query` 실행 결과와 latest sanitized trace를 보여준다. API에
  trace가 아직 없으면 bundled sanitized sample로 fallback한다.
- trace candidate는 `fusedRank`, `rerankRank`, `rerankScore`를 포함할 수 있다.
  따라서 raw context text 없이도 retrieval fusion과 reranking decision이 보인다.
- `pnpm db:live-smoke`는 DB-backed query path가 sanitized trace row를 저장하는지
  검증한다(`tracePersisted: true`).
- `pnpm db:live-generation-smoke`는 live generation path가 sanitized trace를
  저장하는지 검증하고, aggregate generation status, claim count, citation count,
  selected chunk ID만 출력한다.
- `sanitizeQueryTraceForStorage`는 저장 전에 email address와 API-key-like secret을
  redact한다.
- `pnpm db:trace-retention-smoke`는 expired sanitized trace를 삭제하되 fresh trace는
  삭제하지 않는지 검증한다.

## 10M 규모 확장 시 후속 작업

trace cleanup을 scheduled job으로 옮기고, trace row 삭제 전에 aggregate metric을
export한다.
