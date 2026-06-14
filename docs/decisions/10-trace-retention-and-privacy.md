# 결정: Trace Retention and Privacy

## 맥락

RAG observability에는 trace가 필요하다. 하지만 trace는 실수로 prompt, context,
provider output, personal data의 두 번째 저장소가 될 수 있다.

## 권장 선택

sanitized trace summary만 저장한다. trace persistence는 deterministic하게 sample한다.
expired trace row는 hosting environment에서 schedule할 수 있는 retention cleanup
command로 삭제한다.

기본값:

- sanitized trace는 7일 보관
- local lab mode sample rate `1`
- 저장된 query는 redacted user query preview로 제한하고, query/rejection text에서
  email address, API-key-like secret redact
- raw chunk text, parent context text, citation quote, answer text, full provider prompt,
  raw context bundle, raw provider response, token billing payload는 절대 저장하지 않음

## 검토한 대안

- 더 쉬운 debugging을 위해 full raw trace 저장
- per-query trace 없이 aggregate-only metric만 저장
- write time random sampling
- sanitized trace 무기한 보관

## 트레이드오프

sanitized trace summary는 replay/debugging detail 일부를 잃는다. 하지만 public
portfolio에 더 안전하고 production privacy boundary에 더 가깝다. trace id 기반
deterministic sampling은 local test를 reproducible하게 만들고, failure가 randomness
뒤에 숨는 것을 피한다. 짧은 retention은 stale observability data를 제한한다. 대신
장기 trend analysis는 raw trace가 아니라 aggregate eval report에서 나와야 한다.

## 평가 근거

- `sanitizeQueryTraceForStorage`는 query preview, normalized query preview,
  rejected reason, rejected generation message에서 email address와 API-key-like secret을
  redact한다.
- `buildQueryTraceUpsertSql`는 sanitized payload만 저장한다.
- `shouldPersistTraceSample`은 trace-id 기반 deterministic sampling decision을
  만든다.
- `buildExpiredQueryTraceDeleteSql`는 cutoff보다 오래된 trace를 삭제하고 audit용
  deleted id를 반환한다.
- `runExpiredQueryTraceCleanup`은 delete SQL을 executor 뒤로 감싸고 aggregate audit
  summary를 반환한다.
- `pnpm db:trace-retention-smoke`는 expired trace가 삭제되고 fresh trace가 남는지
  검증한다.
- `pnpm db:trace-cleanup`은 cron, GitHub Actions, hosted scheduler용 idempotent
  operations command다.

## 확장 시 다시 볼 것

`pnpm db:trace-cleanup`을 production scheduler에 연결한다. 삭제 전 aggregate metric을
export한다. trace가 private network boundary 밖으로 나가기 전에 더 엄격한 PII
redaction pass를 추가한다.
