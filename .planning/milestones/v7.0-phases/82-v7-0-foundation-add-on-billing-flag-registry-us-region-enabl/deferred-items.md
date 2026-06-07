# Phase 82 — Deferred / Out-of-Scope Items (logged during execution)

These are pre-existing issues discovered during plan execution that are OUT OF SCOPE
(not caused by the current plan's changes). Logged per the SCOPE BOUNDARY rule.

## 82-02 (US region enablement)

- **`packages/api/src/routers/__tests__/feature-flags.test.ts` fails to collect (0 tests).**
  Error: `[vitest] No "prismaRaw" export is defined on the "@contractor-ops/db" mock.`
  The test's `vi.mock("@contractor-ops/db")` is stale — it does not return `prismaRaw`,
  which `compliance-reminder-scan.ts` (transitively imported) now requires.
  Pre-existing (last touched by commit `ac66ff76`, before this plan); imports none of the
  files 82-02 modified (region.ts / replica.ts / schemas.ts / feature-flag.ts middleware / env.ts).
  Fix = add `prismaRaw` to that test's db mock. Not done here (out of scope; would be a
  separate test-debt fix).

- **`pnpm check:no-process-env` reports ~25 offender lines (158+ total occurrences)** across
  `apps/public-api/**`, etc. All pre-existing; none in files 82-02 modified. 82-02's env access
  is via the Zod schema (`packages/validators/src/env.ts`) — correct, not flagged.

## 82-04 (add-on entitlement primitive)

- **Pre-existing migration-history drift blocks `prisma migrate dev` (Task 1, BLOCKING).**
  `pnpm --filter @contractor-ops/db db:migrate:dev` fails on a fresh shadow DB:
  1. `20260428000000_phase_73_compliance_dashboard_overrides_pending_review` →
     `42P01 relation "ContractorComplianceItem" does not exist` (broken historical ordering for a
     clean shadow replay).
  2. `prisma db push` reports unrelated `WaivedReasonCategory` enum drift requiring
     `--accept-data-loss` (out of scope — not touched).
  3. `prisma migrate status` lists 9 historical migrations (phases 72/73/75/76/77) as "not yet
     applied" against the dev DB even though the schema already exists live (migration-table vs
     live-DB drift, applied historically via `db push`).
  **82-04 handling:** applied ONLY the additive `Subscription.addOns` column to the live dev DB via
  idempotent `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "addOns" TEXT[] NOT NULL DEFAULT
  ARRAY[]::TEXT[]` (equivalent to a scoped `prisma db push` — the plan sanctioned `db push` as the
  fallback), then `prisma generate`. Live dev DB + generated client both carry `addOns`.
  **Owner action (deferred):** reconcile migration history vs live DBs (`prisma migrate resolve` for
  already-applied migrations, fix phase-73 ordering, reconcile `WaivedReasonCategory`). Long-standing
  repo-wide concern, not introduced by Phase 82.

- **`pnpm lint:schema` fails on `UserPinnedView` (`packages/db/prisma/schema/auth.prisma:114`)** —
  "multi-tenant model missing organizationId". Pre-existing, unrelated to 82-04's
  `Subscription.addOns` addition (additive scalar array on an already-tenant-scoped model). Not fixed
  here (out of scope).

- **Deferred production migration apply (Task 1):** apply the additive `addOns` column per-region in
  PRODUCTION post-merge via `pnpm db:migrate:all` (EU then ME) once a proper migration file is
  generated. Additive + `@default([])` → existing rows safe, no data migration. Mirrors prior-phase
  deferred `migration_apply` items in STATE.md.

- **`pnpm lint:logs` fails on `apps/api/src/routes/csp-report.ts:86`** — `log.warn({ body }, ...)`
  logs an unredacted body. Pre-existing, unrelated to 82-04 (which touches no log sites). Not fixed
  here (out of scope).

- **billing.test.ts collection was already RED on the committed baseline (Task 3).** Importing the
  full `appRouter` from `root.ts` pulls unrelated routers whose module-load side-effects the test's
  mocks did not satisfy: (a) `compliance-reminder-scan.ts` captures `prismaRaw` into a module-level
  `__deps` const at import time (db mock lacked `prismaRaw`), and (b)
  `integrations/deprovisioning` calls `getIdpAuditLogger()` at module load. 82-04 fixed the billing
  tests by (1) adding `prismaRaw`/`SUPPORTED_REGIONS` to the db mock and (2) mounting `billingRouter`
  on a minimal standalone `router({ billing: billingRouter })` instead of importing `appRouter` —
  isolating billing from the unrelated chain so all 24 billing tests (18 pre-existing + 6 new
  grantAddOn) now run GREEN. The broader `appRouter`-import test-harness coupling (other router test
  files that import `root.ts`, e.g. `feature-flags.test.ts`) remains pre-existing test debt.
