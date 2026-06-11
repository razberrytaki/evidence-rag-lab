# Public Repo Hygiene

## Commit forbidden

- `.env`, `.env.local`, `.env.*.local`
- API keys, access tokens, OAuth secrets, provider secrets
- `.npmrc` registry auth tokens
- company documents, private operating notes, customer or personal data
- local database dumps, pgvector index dumps, embedding caches
- live provider raw response logs
- raw query traces with prompts, full context, API responses, or token billing
- large public docs copied without license or usage review

## Commit allowed

- `.env.example`
- synthetic fixtures
- short public-doc excerpts with source URL and license note
- sanitized query trace samples
- aggregate eval reports
- decision docs and architecture docs

## Sanitized trace storage

- query and rejection text are redacted for email addresses and API-key-like secrets
- stored candidates omit raw chunk text and parent context text
- stored generation omits answer text and citation quotes
- raw prompts, provider responses, token billing, and unsanitized traces remain forbidden

## Gates

- `pnpm security:fixtures`
- `pnpm security:claims`
- `pnpm security:tree`
- `pnpm security:readiness`
- `pnpm security:public`
- `pnpm public:check`
- `gitleaks git --redact --verbose .`
- `sfw pnpm install --frozen-lockfile`

`security:fixtures` checks the public sample docs and eval fixtures.
`security:claims` checks README, docs, and sample docs for affirmative
production, zero-hallucination, 10M-throughput, and shipped-BM25 claims while
allowing explicit non-claims and scale alternatives. It also checks adjacent
markdown lines so a claim split across a line wrap is still caught. `security:tree`
checks the publishable tree allowlist, skips local-only root entries such as
`.env`, `.git`, and `node_modules`, fails on unexpected root entries, and fails
on raw trace paths, provider response artifacts, dump/cache paths, `.npmrc`
registry auth tokens, and common secret patterns. `security:readiness` checks
that root publication
metadata exists, `LICENSE` matches package metadata, CI runs `pnpm
security:public`, and the local `public:check` script includes the expected
publication gates. It validates executable command segments rather than loose
string matches, so echoed command text does not satisfy the gate. It also checks
that publish-critical files such as `infra/postgres/init/001_schema.sql` are not
hidden by `.gitignore` rules.
`security:public` runs all checks.

`pnpm public:check` is the local pre-publication command. It runs build, tests,
typecheck, deterministic report generation for eval, provider comparison, scale
budget, and vector index budget artifacts, then public security/readiness checks.
The final security pass must run after report generation so generated artifacts
cannot bypass the scanner.

Keep gitleaks in the gate for commit-history scanning. On a brand-new public repo
with no commits, gitleaks can report `0 commits scanned`; `security:tree` covers
that gap by scanning the working tree directly before publication.
