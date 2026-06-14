# 공개 레포 위생

## Commit 금지

- `.env`, `.env.local`, `.env.*.local`
- API key, access token, OAuth secret, provider secret
- `.npmrc` registry auth token
- company document, private operating note, customer/personal data
- local database dump, pgvector index dump, embedding cache
- live provider raw response log
- full provider prompt, full context, API response, token billing을 포함한 raw query trace
- license 또는 usage review 없이 복사한 큰 public docs

## Commit 허용

- `.env.example`
- synthetic fixture
- source URL과 license note가 있는 짧은 public-doc excerpt
- sanitized query trace sample
- aggregate eval report
- decision docs와 architecture docs

## Sanitized trace 저장

- 저장되는 query는 redacted user query preview다. query와 rejection text에서 email
  address와 API-key-like secret을 redact한다.
- stored candidate는 raw chunk text와 parent context text를 생략한다.
- stored generation은 answer text와 citation quote를 생략한다.
- full provider prompt, provider response, token billing, unsanitized trace는 계속 금지한다.

## Gate 목록

- `pnpm security:fixtures`
- `pnpm security:claims`
- `pnpm security:tree`
- `pnpm security:readiness`
- `pnpm security:public`
- `pnpm public:check`
- `gitleaks git --redact --verbose .`
- `sfw pnpm install --frozen-lockfile`

`security:fixtures`는 public sample docs와 eval fixture를 확인한다.
`security:claims`는 README, docs, sample docs에서 production, zero-hallucination,
10M-throughput, shipped-BM25에 대한 affirmative claim을 확인한다. explicit non-claim과
scale alternative는 허용한다. line wrap으로 나뉜 claim도 잡기 위해 adjacent markdown
line도 확인한다.

`security:tree`는 publishable tree allowlist를 확인하고 `.env`, `.git`,
`node_modules` 같은 local-only root entry는 건너뛴다. unexpected root entry, raw trace
path, provider response artifact, dump/cache path, `.npmrc` registry auth token, common
secret pattern이 있으면 fail한다.

`security:readiness`는 root publication metadata, package metadata와 일치하는
`LICENSE`, CI의 `pnpm security:public` 실행, local `public:check` script의 expected
publication gate 포함 여부를 확인한다. `pnpm eval:report`가 API runtime module을 먼저
build하는지와 supply-chain workflow가 main push에서 실행되는지도 확인한다. loose
string match가 아니라 executable command segment를 검증하므로 echoed command text는
gate를 만족하지 않는다. 또한 `infra/postgres/init/001_schema.sql` 같은
publish-critical file이 `.gitignore` rule에 숨겨져 있지 않은지도 확인한다.

`security:public`은 모든 check를 실행한다.

`pnpm public:check`는 local pre-publication command다. build, test, typecheck,
eval/provider comparison/scale budget/vector index budget artifact의 deterministic
report generation을 실행하고, 그 뒤 public security/readiness check를 실행한다. generated
artifact가 scanner를 우회하지 못하게 final security pass는 report generation 이후에
실행되어야 한다.

commit-history scanning을 위해 gitleaks는 gate에 유지한다. commit이 없는 brand-new
public repo에서는 gitleaks가 `0 commits scanned`를 보고할 수 있다. 그 gap은
publication 전에 working tree를 직접 scan하는 `security:tree`가 막는다.
