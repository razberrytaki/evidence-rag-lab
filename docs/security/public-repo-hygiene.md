# 공개 레포 위생

## 커밋 금지

- `.env`, `.env.local`, `.env.*.local`
- `docs/submission/` 아래 제출용 초안
- API key, 접근 토큰, OAuth 비밀값, LLM 제공자 비밀값
- `.npmrc` registry 인증 토큰
- 회사 문서, 비공개 운영 노트, 고객/개인 데이터
- 로컬 데이터베이스 dump, pgvector 색인 dump, 임베딩 캐시
- 실제 LLM 응답 원문 로그
- 전체 LLM 요청, 전체 문맥, API 응답, 토큰 과금 값을 포함한 원문 질의 추적 기록
- 라이선스 또는 사용 검토 없이 복사한 큰 공개 문서

## 커밋 허용

- `.env.example`
- 합성 평가 사례
- 출처 URL과 라이선스 메모가 있는 짧은 공개 문서 발췌
- 정리된 질의 추적 기록 샘플
- 집계 평가 보고서
- 설계 결정 문서와 구조 문서

## 정리된 추적 기록 저장

- 저장되는 질의는 가린 사용자 질의 미리보기다. 질의와 거절 문구에서 이메일 주소와
  API key 형태 비밀값을 가린다.
- 저장된 후보는 청크 원문과 부모 문맥 원문을 생략한다.
- 저장된 생성 결과는 답변 문구와 인용 문구를 생략한다.
- 전체 LLM 요청, LLM 응답, 토큰 과금 값, 정리되지 않은 추적 기록은 계속 금지한다.

## 로컬 공개 검증 절차

- `pnpm security:fixtures`
- `pnpm security:tree`
- `pnpm security:readiness`
- `pnpm security:public`
- `pnpm public:check`

`security:fixtures`는 공개 샘플 문서와 평가 사례를 확인한다.
`security:tree`는 공개 대상 파일 허용 목록을 확인하고 `.env`, `.git`,
`node_modules` 같은 로컬 전용 루트 항목은 건너뛴다. 예상하지 않은 루트 파일, 원문 추적
기록 경로, LLM 응답 산출물, dump/cache 경로, `.npmrc` registry 인증 토큰, 흔한
비밀값 패턴이 있으면 실패한다.
`docs/submission/`은 제출용 초안 작업 공간으로 취급해 공개 스캔 대상에서 제외한다.
대신 `security:readiness`가 이 경로가 `.gitignore`에 남아 있는지 확인한다.

`security:readiness`는 루트 공개 메타데이터, package metadata와 일치하는
`LICENSE`, CI의 `pnpm security:public` 실행, 로컬 `public:check` 스크립트의 필수
공개 검증 절차 포함 여부를 확인한다. `pnpm eval:report`가 API 실행 모듈을 먼저
빌드하는지와 supply-chain workflow가 main push에서 실행되는지도 확인한다. 느슨한
문자열 매칭이 아니라 실행 가능한 명령 구간을 검증하므로 출력 문자열에 적힌 명령은
검증 절차를 만족하지 않는다. 또한 `infra/postgres/init/001_schema.sql` 같은
공개 필수 파일이 `.gitignore` 규칙에 숨겨져 있지 않은지, 제출용 초안 경로가
계속 `.gitignore`에 남아 있는지도 확인한다.

`security:public`은 로컬 공개 파일/준비 검사를 실행한다. 커밋 이력 비밀값 검사와
supply-chain 검사는 별도 검증 절차다.

`pnpm public:check`는 로컬 공개 전 명령이다. build, test, typecheck,
평가/LLM 제공자 비교/확장성 예산/벡터 색인 예산 산출물의 결정적 보고서 생성을
실행하고, 그 뒤 공개 보안/준비 검사를 실행한다. 생성 산출물이 검사기를 우회하지 못하게
최종 보안 검사는 보고서 생성 이후에
실행되어야 한다.

## CI와 수동 검증 절차

- `gitleaks git --redact --verbose .`: 커밋 이력 비밀값 검사. GitHub Actions
  `secrets.yml`에서 실행한다.
- `sfw pnpm install --frozen-lockfile`: supply-chain 설치 검증 절차. GitHub Actions
  `supply-chain-security.yml`에서 pull request와 main push에 실행한다.

커밋 이력 검사를 위해 gitleaks는 검증 절차에 유지한다. 커밋이 없는 새 공개 저장소에서는
gitleaks가 `0 commits scanned`를 보고할 수 있다. 그 간극은 공개 전에 작업 트리를 직접
검사하는 `security:tree`가 막는다.
