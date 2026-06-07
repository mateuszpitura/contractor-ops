# Phase 83 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed; do not block this phase).

## Pre-existing lint failures (unrelated to Phase 83 changes)

Discovered while running per-wave lint guards for the Plan 83-01 enum edit. Both
pre-date Phase 83 and live in files this phase did not touch — out of scope per the
executor SCOPE BOUNDARY rule.

### 1. `db:audit-enum-casing` — lowercase enum values in `idp-deprovisioning.prisma`

- **File:** `packages/db/prisma/schema/idp-deprovisioning.prisma:117-121`
- **Enum:** `ManualOverrideCategory` — values `verified_via_vendor_console`,
  `user_already_inactive`, `provider_endpoint_deprecated`,
  `transient_provider_issue_resolved`, `other` (lowercase, fail UPPER_SNAKE_CASE).
- **Origin:** Phase 76/77 (IdP deprovisioning), not Phase 83.
- **Note:** Phase 83's `DataRegion` `US` value is UPPER and passes the audit; this
  failure is unrelated to the enum widen.

### 2. `lint:schema` — `UserPinnedView` missing `organizationId`

- **File:** `packages/db/prisma/schema/auth.prisma:114`
- **Model:** `UserPinnedView` — multi-tenant model missing `organizationId` (or an
  allowlist entry in `GLOBAL_LOOKUP_MODELS_ALLOWLIST`).
- **Origin:** pre-existing; unrelated to `organization.prisma`.

### 3. `check:no-process-env` — ~170 raw `process.env` hits (Plan 83-03)

- **Files:** `apps/landing/src/lib/posthog.tsx`, `apps/cron-worker/src/lib/sentry.ts`,
  `apps/public-api/src/{app.ts,lib/sentry.ts}`, +others (~170 total).
- **Discovered:** running the `check:no-process-env` env-edit gate for the Plan 83-03
  `R2_BUCKET_NAME_US` addition. None of the four plan-owned files
  (`regional-storage.ts`, `validators/src/env.ts`, `.env.example`, the regional-storage
  test) are offenders — verified by grep.
- **Origin:** pre-existing app-bootstrap/observability code; out of scope per SCOPE BOUNDARY.

### 4. `lint:logs` — unredacted `body` log in `csp-report.ts` (Plan 83-04)

- **File:** `apps/api/src/routes/csp-report.ts:86` —
  `log.warn({ body }, 'csp-report: unrecognised payload shape')`.
- **Discovered:** running the `lint:logs` gate for the Plan 83-04 retention work.
- **Origin:** last touched in `e320911b` (apps/api scaffold), long before Phase 83.
  None of the four plan-owned files (`retention-policy.ts`, `soft-delete.ts`,
  `data-purge.ts`, `gdpr.ts`) are offenders — `data-purge` keeps `ctx.log` (no
  console.*), `gdpr` uses `writeAuditLog`. Out of scope per SCOPE BOUNDARY.

## Phase 83-04 known limitations (recorded per plan success criterion)

- **EU-pinned `data-purge` cross-region gap (Pitfall 6).** `data-purge.ts` sweeps via
  the base (EU-pinned) `prisma`, so US/ME soft-deleted rows are not reached by the
  EU purge. This is a PRE-EXISTING cross-region correctness gap (already true for ME),
  NOT introduced by Plan 83-04, and D-05 (no in-window hard-delete) is satisfied
  trivially for US rows the EU purge cannot see. A true region-aware purge would fan
  out over `SUPPORTED_REGIONS` × `getRegionalClient(region)`. Deferred ops/correctness
  item; out of Phase 83 scope (threat T-83-04-05 = accept).
- **Statutory-citation copy needs legal/tax-adviser verification.** `RETENTION_YEARS`
  (4yr 1099-NEC / 7yr backup-withholding) and the `RETENTION_CITATIONS` 26 CFR refs in
  `gdpr.ts` are IRS values annotated LOCAL-ONLY; verify with a jurisdiction-specific
  adviser before production deploy (Standing Project Constraint; not hard-blocking).

## Deferred ops items (LOCAL-ONLY posture; recorded in 83-01-SUMMARY)

- **Per-region PRODUCTION enum apply** of `ALTER TYPE "DataRegion" ADD VALUE 'US'`
  (EU then ME, then US once provisioned). `migrate dev` is blocked by pre-existing
  migration-history drift (Phase 82 precedent); the additive ALTER was applied to
  the local dev DB only. Apply per region post-merge at US go-live.
- **Provision the US R2 bucket** and set `R2_BUCKET_NAME_US` (Plan 83-03 / US-INFRA-02).
  Optional + lazy-throw by design — the app boots and tests clean without it; only
  actual US-org file access fails until the operator provisions the bucket. Not
  hard-blocking (LOCAL-ONLY).
