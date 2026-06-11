# Publication Checklist

Use this checklist before making the repository public or sharing it as a
portfolio artifact.

## Local gate

```bash
pnpm public:check
```

This command runs:

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm eval:report`
- `pnpm provider:report`
- `pnpm scale:report`
- `pnpm index:report`
- `pnpm security:public`

The security gate intentionally runs after deterministic report generation so
newly written public artifacts are scanned before publication.

## Security gate

`pnpm security:public` combines:

- fixture hygiene checks for public sample docs and eval fixtures
- claim safety checks for affirmative production, zero-hallucination,
  10M-throughput, and shipped-BM25 claims, including adjacent-line claims
- publishable tree scanning for unexpected root entries, secrets, raw traces,
  provider responses, dumps, `.npmrc` auth tokens, and embedding/vector caches
- public readiness checks for `LICENSE`, CI gate alignment, and the local
  `public:check` script
- required publish files must not be hidden by `.gitignore` rules

Run `pnpm security:gitleaks` after the first commit. Before the first commit,
gitleaks can scan `0 commits`, so it does not replace the working-tree scanner.

## CI gate

GitHub Actions CI must run:

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm security:public`

The readiness scanner checks `run:` commands as executable steps. A command name
inside echoed text does not satisfy the gate.

The separate supply-chain workflow runs Socket Firewall through `sfw pnpm
install --frozen-lockfile`.

## Manual review

- Confirm `.env` is ignored and not staged.
- Confirm generated reports contain aggregate data only.
- Confirm docs do not claim production 10M-document throughput or guaranteed
  zero hallucination.
- Confirm sample docs are synthetic or short public excerpts with usage notes.
- Confirm live provider responses, prompts, token billing payloads, raw query
  traces, database dumps, and embedding caches are absent.
