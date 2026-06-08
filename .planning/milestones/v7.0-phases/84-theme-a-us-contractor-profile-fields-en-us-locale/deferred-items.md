# Phase 84 — Deferred Items

Out-of-scope discoveries logged during execution. NOT fixed in their discovering plan
(scope-boundary rule: only auto-fix issues directly caused by the current task's changes).

## 84-03

- **`pnpm lint:logs` pre-existing failure** — `apps/api/src/routes/csp-report.ts:86`
  logs `log.warn({ body }, 'csp-report: unrecognised payload shape')`. The lint-guard
  flags an unredacted-body log site. Pre-existing (commit `e320911b`, ~13 days old);
  NOT introduced by 84-03 (this plan touches only `packages/{auth,logger,db,api/services}`).
  The `body`/`*.body` redact paths already censor the value at runtime, so this is a
  guard-heuristic flag, not a live PII leak. Remediation per
  `docs/lint-remediation/lint-logs.md#unredacted-body-log`: either omit `body` from the
  payload or add a `LOG_BODY_INCLUDE_PREFIXES` entry with a `// reason:` comment. Belongs
  to the apps/api owner, not this security plan.

## 84-04

- **Pre-existing `biome check` findings in untouched gov-api files** — surfaced by
  `pnpm --filter @contractor-ops/gov-api lint` while verifying Plan 04:
  - `src/client.ts:288` `lint/complexity/noExcessiveCognitiveComplexity` (error) — the
    base-class `fetch()` retry loop. Not touched by 84-04 (this plan adds `usps-client.ts`,
    `usps-address.schema.ts`, and export lines only).
  - `src/schemas/vies.schema.ts:42` `suppressions/unused` (warning) — a stale biome-ignore
    suppression in the Phase 57 VIES schema. Not touched by 84-04.
  Both belong to the gov-api base/VIES owners (Phase 57 surface), not this USPS-adapter plan.
  84-04's own new files are lint-clean (export ordering auto-fixed on the two index barrels).
