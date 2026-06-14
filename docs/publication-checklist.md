# 공개 전 체크리스트

repository를 public으로 전환하거나 portfolio artifact로 공유하기 전에 이 checklist를
사용한다.

## 로컬 gate

```bash
pnpm public:check
```

이 command는 다음을 실행한다:

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm eval:report` (API runtime build 후 report 생성)
- `pnpm provider:report`
- `pnpm scale:report`
- `pnpm index:report`
- `pnpm security:public`

security gate는 deterministic report generation 이후 실행된다. publication 전에 새로
작성된 public artifact까지 scan하기 위해서다.

## 보안 gate

`pnpm security:public`은 다음을 결합한다:

- public sample docs와 eval fixture hygiene check
- unexpected root entry, secret, raw trace, provider response, dump, `.npmrc` auth
  token, embedding/vector cache를 찾는 publishable tree scan
- `LICENSE`, CI gate alignment, local `public:check` script, `eval:report` API
  build freshness, supply-chain main push trigger를 확인하는 public readiness check
- 필요한 publish file이 `.gitignore` rule에 숨겨지면 안 됨

첫 commit 이후 `pnpm security:gitleaks`를 실행한다. 첫 commit 전에는 gitleaks가
`0 commits`를 scan할 수 있으므로 working-tree scanner를 대체하지 못한다.

## CI gate

GitHub Actions CI는 다음을 실행해야 한다:

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm security:public`

readiness scanner는 `run:` command를 executable step으로 확인한다. echoed text 안에
command name이 들어 있는 것은 gate를 만족하지 않는다.

별도 supply-chain workflow는 main push, pull request, manual dispatch에서 Socket
Firewall을 `sfw pnpm install --frozen-lockfile`로 실행한다.

## 수동 검토

- `.env`가 ignored 상태이며 staged 상태가 아닌지 확인한다.
- generated report가 aggregate data만 포함하는지 확인한다.
- docs가 과장된 표현을 사용하지 않는지 확인한다.
- sample docs가 synthetic이거나 usage note가 있는 짧은 public excerpt인지 확인한다.
- live provider response, prompt, token billing payload, raw query trace, database
  dump, embedding cache가 없는지 확인한다.
