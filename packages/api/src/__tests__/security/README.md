# Security regression suite

Committed `*.security.test.ts` specs — the repeatable half of the authorized red-team effort
(the live attack harness lives in the gitignored `security/harness/` at repo root).

- **What lives here:** permission/auth denial matrices, API-key tier/scope/revocation, webhook
  signature forgery/replay, SSRF/OAuth guards, rate-limit over-limit + fail-closed assertions.
  These reuse the mocked-Prisma oracle pattern from `../tenant-isolation.test.ts`
  (`createCaller` from `init.ts`, in-memory org-scoped mock).
- **What does NOT live here:** real cross-org *leak* detection that depends on the live Prisma
  `$extends` running against real Postgres (relation-traversal IDOR, raw-SQL bypass). A mocked
  client only echoes the `where` you passed, so it can't catch a missing org injection — that
  detection runs in `security/harness/idor-sweep.ts` against the seeded local DB.

Run scoped (never the full unscoped suite):
`pnpm --filter @contractor-ops/api test packages/api/src/__tests__/security`
