# Phase 79 — Deferred / Out-of-Scope Items

Logged during execution. NOT fixed here (scope-boundary rule: only auto-fix issues
directly caused by the current task's changes).

## Pre-existing test failure (not caused by 79-02)

- **File:** `packages/validators/src/__tests__/locked-phrases-guard.test.ts:588`
- **Test:** `Phase 64 — Signoff registry CI guard › getAllPending() returns all registry keys while every entry is PENDING (12 Phase 64 disclaimers + 17 Phase 75 IP clauses)`
- **Assertion:** `expect(pending).toHaveLength(29)` — actual is now **48**.
- **Cause:** `packages/validators/src/legal/signoff-registry.json` has grown to 48 PENDING
  entries across later phases (last touched in `73-04`), but the Phase 64 count assertion
  was never updated. Pre-dates Phase 79; no 79-02 file touches the validators signoff registry.
- **Repro:** `pnpm --filter @contractor-ops/validators test -- locked-phrases-guard`
  → `1 failed | 894 passed`. The single failure is this drifted count; all Phase 79
  AE/SA locked-phrase tests pass.
- **Suggested fix (separate change):** update the hardcoded `29` to the live registry
  PENDING count, or make the assertion derive the expected count from the registry instead
  of a magic number.

## Pre-existing lint:schema offence (not caused by 79-02)

- **Model:** `UserPinnedView` — `packages/db/prisma/schema/auth.prisma:114`
- **Offence:** missing `organizationId` (FOUND6-01 multi-tenant guard).
- **Cause:** committed in `76-02` (`feat(76-02): add IdP deprovisioning saga schema + endedAt cooldown column`);
  exists on HEAD with no uncommitted change. Pre-dates Phase 79.
- **Repro:** `pnpm lint:schema` → `FAIL: 1 multi-tenant model(s) missing organizationId` (only UserPinnedView).
  The Phase 79 `UaeFreeZone` global-lookup model is correctly allowlisted and is NOT flagged; the
  3 org-scoped Gulf models carry `organizationId`.
- **Suggested fix (separate change):** add `organizationId` to `UserPinnedView` (if tenant-scoped),
  or allowlist it in `GLOBAL_LOOKUP_MODELS_ALLOWLIST` if it is genuinely a per-user global record.

## Pre-existing feature-flags boot-gate test failure (not caused by 79-02)

- **File:** `packages/feature-flags/src/__tests__/boot-gate.test.ts:80-82`
- **Test:** `synthetic gated key without registry entry is identifiably ungated by helpers`
- **Assertion:** uses `'compliance-portal-self-service'` as a "SYNTHETIC" gated key and asserts
  `getFlagSignoff(SYNTHETIC)).toBeUndefined()`.
- **Cause:** that key was later given a real PENDING entry in `signoff-registry-flags.json`
  (Phase 73, present on HEAD before Phase 79). My JSON diff only adds the two `gulf.*` entries.
  The test's stale "no entry" assumption is the failure — unrelated to Phase 79.
- **Repro:** `pnpm --filter @contractor-ops/feature-flags test` → `1 failed | 76 passed`.
  The Gulf flags are gated + PENDING + ME-jurisdiction (verified independently).
- **Suggested fix (separate change):** pick a synthetic key that genuinely has no registry
  entry, or stop using a real registry key as the "synthetic" example.

## Pre-existing db:audit-enum-casing offenders (not caused by 79-02)

- **File:** `packages/db/prisma/schema/idp-deprovisioning.prisma:117-121`
- **Enum:** `ManualOverrideCategory` — 5 lower_snake values
  (`verified_via_vendor_console`, `user_already_inactive`, `provider_endpoint_deprecated`,
  `transient_provider_issue_resolved`, `other`).
- **Cause:** present on HEAD (Phase 76-78 IdP work); not UPPER_SNAKE. Pre-dates Phase 79.
- **Repro:** `pnpm --filter @contractor-ops/db db:audit-enum-casing` → `5 offender(s) found`,
  all in `idp-deprovisioning.prisma`. The Phase 79 `NitaqatBand` + `UaeFreeZoneCode` enums are
  UPPER_SNAKE and do NOT appear in the offender list.
- **Impact on 79-02 Task 4:** the enum-casing audit gate is RED solely due to these foreign
  pre-existing values. The Phase 79 new enums pass. Fixing `ManualOverrideCategory` would be a
  cross-phase enum rename with a data migration — out of scope for 79-02.
- **Suggested fix (separate change):** rename to UPPER_SNAKE
  (`VERIFIED_VIA_VENDOR_CONSOLE`, …) with a migration mapping existing rows, owned by the F2 IdP track.

## Migrate apply — DEFERRED post-deploy (GENERATE-ONLY decision, LOCAL-ONLY)

**Decision (Task 4, user-confirmed):** GENERATE ONLY, DEFER APPLY. Ran only
`pnpm --filter @contractor-ops/db db:generate` (regenerates the Prisma client from the
schema — NO database mutation) so downstream waves type-check against the new Gulf models.
NO DB-mutating migrate/push command was run. Both the single-region and the multi-region
apply are recorded below as deferred post-deploy items.

- **Migration name (intended):** `phase79_gulf_free_zone_saudization`
- **Additive-only DDL summary:** CREATE TABLE x4 (FreeZoneAssignment, SaudizationConfig,
  SaudiHeadcount, UaeFreeZone) + CREATE TYPE x2 (NitaqatBand, UaeFreeZoneCode) + ADD COLUMN x4
  (ContractorAssignment.isSaudi/nationality/qiwaContractAuthenticated, Contract.activityIsicCodes).
  Zero DROP/RENAME — purely additive, safe to apply against existing rows.

### Deferred item (a) — single-region migration generate + apply

- **Command:** `pnpm --filter @contractor-ops/db db:migrate:dev` (name the migration
  `phase79_gulf_free_zone_saudization`).
- **Status:** NOT run. This DB-mutating command generates the migration SQL file AND applies it
  to the local single-region dev DB. The migration SQL file was therefore NOT generated either —
  only the Prisma client was regenerated via `db:generate` for type resolution.
- **Local note:** `prisma db push`/`migrate dev` against the local dev DB is also blocked by the
  pre-existing `Contractor.search_vector` GENERATED column (STATE.md Phase 73 precedent); the
  generate-only fallback sidesteps that block.

### Deferred item (b) — multi-region apply (EU + ME)

- **Command:** `pnpm --filter @contractor-ops/db db:migrate:all` (applies against
  `$DATABASE_URL_EU` then `$DATABASE_URL_ME` — NOT `push-all-regions.ts`).
- **Status:** NOT run. Per LOCAL-ONLY Standing Constraint (Phase 70/73/74/76 precedent), the
  multi-region apply is a deferred post-deploy item — not a phase blocker.
- **Sequencing note:** the shared dev DB also needs the deferred Phase 72/75/76 migrations applied
  first; coordinate the full additive-migration apply order at deploy time.
