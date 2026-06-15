# 공개 전 체크리스트

저장소를 공개로 전환하거나 포트폴리오 산출물로 공유하기 전에 이 체크리스트를
사용한다.

## 로컬 검증 절차

```bash
pnpm public:check
```

이 명령은 다음을 실행한다:

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm eval:report` (API 실행 파일 빌드 후 보고서 생성)
- `pnpm provider:report`
- `pnpm scale:report`
- `pnpm index:report`
- `pnpm security:public`

보안 검증 절차는 결정적 보고서 생성 이후 실행된다. 공개 전에 새로 작성된 공개 산출물까지
검사하기 위해서다.

## 보안 검증 절차

`pnpm security:public`은 다음을 결합한다:

- 공개 샘플 문서와 평가 사례 위생 검사
- 예상하지 않은 루트 파일, 비밀값, 원문 추적 기록, LLM 응답, dump, `.npmrc` 인증
  토큰, 임베딩/벡터 캐시를 찾는 공개 대상 파일 검사
- `LICENSE`, CI 검증 절차 일치, 로컬 `public:check` 스크립트, `eval:report` API
  빌드 최신성, supply-chain main push trigger를 확인하는 공개 준비 검사
- 필요한 공개 파일이 `.gitignore` 규칙에 숨겨지면 안 됨

첫 커밋 이후 `pnpm security:gitleaks`를 실행한다. 첫 커밋 전에는 gitleaks가
`0 commits`를 검사할 수 있으므로 작업 트리 검사를 대체하지 못한다.

## CI 검증 절차

GitHub Actions CI는 다음을 실행해야 한다:

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm security:public`

준비 검사기는 `run:` 명령을 실행 가능한 단계로 확인한다. 출력 문자열 안에
명령 이름이 들어 있는 것은 검증 절차를 만족하지 않는다.

별도 supply-chain workflow는 main push, pull request, manual dispatch에서 Socket
Firewall을 `sfw pnpm install --frozen-lockfile`로 실행한다.

## 수동 검토

- `.env`가 ignored 상태이며 staged 상태가 아닌지 확인한다.
- `docs/submission/`이 ignored 상태이며 staged 상태가 아닌지 확인한다.
- 생성 보고서가 집계 데이터만 포함하는지 확인한다.
- docs가 과장된 표현을 사용하지 않는지 확인한다.
- 샘플 문서가 합성이거나 사용 메모가 있는 짧은 공개 발췌인지 확인한다.
- 실제 LLM 응답, 프롬프트, 토큰 과금 값, 원문 질의 추적 기록, 데이터베이스
  dump, 임베딩 캐시가 없는지 확인한다.
