---
phase: 83-theme-a-us-region-infrastructure
plan: 04
subsystem: database
tags: [retention, soft-delete, gdpr, rodo, irs, cron, data-purge, prisma, us-region]

# Dependency graph
requires:
  - phase: 83-01
    provides: "retention-policy.test.ts RED scaffold (Wave 0); DataRegion enum widen"
provides:
  - "packages/db/src/retention-policy.ts — RETENTION_YEARS + MODEL_RETENTION_TYPE (EMPTY) + resolveRetentionYears + getRetentionCutoff (the single statutory-retention resolver)"
  - "soft-delete.ts retained-window guard (delete/deleteMany forced to soft-delete for retention-guarded models)"
  - "data-purge cron per-model retention cutoff on the base-prisma hard-delete path"
  - "gdpr requestErasure statutory-retention exemption (softDeleteByOrgAndCount + retainedUnderStatute citation + writeAuditLog)"
affects: [86-tin-match-1099, 87-1042s-classification, 89-worker-model, 90-employee-registry, 91-akta-osobowe, theme-b-akta-02, theme-b-akta-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single statutory-retention resolver (record-type -> years map + model -> type map) shared across three physically-separate deletion processes via packages/db"
    - "getRetentionCutoff(model, now, overrideMap?) — production map ships EMPTY (D-06); tests inject a fixture mapping without shipping a production entry"
    - "Statutory-hold exemption layer for RODO/GDPR erasure: soft-delete-with-citation + audit, never over-claim full deletion"

key-files:
  created:
    - packages/db/src/retention-policy.ts
  modified:
    - packages/db/src/index.ts
    - packages/db/src/soft-delete.ts
    - apps/cron-worker/src/jobs/handlers/data-purge.ts
    - packages/api/src/routers/compliance/gdpr.ts
    - packages/db/src/__tests__/soft-delete.test.ts
    - apps/cron-worker/src/__tests__/data-purge.test.ts
    - packages/api/src/routers/__tests__/gdpr.test.ts

key-decisions:
  - "Resolver lives in packages/db (reachable by cron-worker + api with no api->cron static edge); getRetentionCutoff returns null for unmapped models"
  - "getRetentionCutoff takes an optional overrideMap so the production MODEL_RETENTION_TYPE stays EMPTY (D-06) while tests prove the wiring against the Invoice fixture"
  - "A statutory-retention hold supersedes the user's retainFinancialRecords=false purge choice: a retained model is always soft-deleted-with-exemption, never hard-deleted"
  - "RETENTION_CITATIONS keyed by record type (26 CFR refs) annotated LOCAL-ONLY pending legal/tax-adviser verification"

patterns-established:
  - "Pattern: one retention resolver consumed by all three deletion chokepoints (soft-delete extension, data-purge cron, gdpr erasure)"
  - "Pattern: data-purge cutoffFor(model, now, flatCutoff) = getRetentionCutoff(model, now) ?? flatCutoff — retained models use 4y/7y window, others keep flat 90d"
  - "Pattern: retention-blocked erasure attempt audited via writeAuditLog action 'organization.erasure_retained_under_statute' with citation metadata"

requirements-completed: [US-INFRA-03]

# Metrics
duration: 9min
completed: 2026-06-07
---

# Phase 83 Plan 04: IRS Retention Mechanism + Centralized Hard-Delete Guard Summary

**One statutory-retention resolver in packages/db (4yr 1099-NEC / 7yr backup-withholding, EMPTY model map per D-06) consumed by all three deletion chokepoints — soft-delete extension, the load-bearing base-prisma data-purge cron, and gdpr RODO erasure — so no retained record can be hard-deleted in-window.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-07T23:46:00Z
- **Completed:** 2026-06-07T23:55:30Z
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- New `packages/db/src/retention-policy.ts`: `RETENTION_YEARS { '1099-NEC': 4, 'backup-withholding': 7 }`, `RetainedRecordType`, EMPTY `MODEL_RETENTION_TYPE` (D-06), `resolveRetentionYears`, and `getRetentionCutoff(model, now, overrideMap?)` returning the cutoff Date for a mapped model or `null`. Exported from `index.ts`. Turned the Plan-01 RED scaffold GREEN (5/5).
- `soft-delete.ts` retained-window guard: `withSoftDelete(prisma, retentionOverride?)` now forces a retention-guarded model's `delete`/`deleteMany` through the soft-delete conversion (never a raw hard-delete), via `getRetentionCutoff`. Non-retained models unchanged (Invoice fixture).
- `data-purge.ts` (THE load-bearing path — base prisma, no soft-delete extension, TRUE hard-delete): per-model `cutoffFor(model, now, flatCutoff) = getRetentionCutoff(model, now) ?? flatCutoff`. Retained models use the 4y/7y window; non-retained keep the flat 90-day sweep. `ctx.log` preserved (no console.*).
- `gdpr.ts` `requestErasure`: retained models are soft-deleted-with-exemption (never `deleteByOrgAndCount`), surfaced in a `retainedUnderStatute` summary section with a 26 CFR citation; the retention-blocked attempt is `writeAuditLog`-ged; the message no longer over-claims full erasure for held records. The statutory hold supersedes `retainFinancialRecords=false`.

## Task Commits

Each task was committed atomically (TDD; RED scaffold for Task 1 was committed in Plan 83-01):

1. **Task 1: retention-policy resolver + export** - `442ed581` (feat)
2. **Task 2: data-purge cron + soft-delete retention-aware** - `a9fcc1b6` (feat)
3. **Task 3: gdpr erasure statutory-retention exemption** - `278cfe1e` (feat)

**Plan metadata:** (final docs commit — SUMMARY + STATE + ROADMAP + REQUIREMENTS + deferred-items)

## Files Created/Modified

- `packages/db/src/retention-policy.ts` - NEW: the single statutory-retention resolver (map + resolvers + cutoff)
- `packages/db/src/index.ts` - re-export the resolver (mirrors region exports)
- `packages/db/src/soft-delete.ts` - retained-window hard-delete guard in the `$allModels` delete/deleteMany hooks
- `apps/cron-worker/src/jobs/handlers/data-purge.ts` - per-model retention cutoff on the base-prisma hard-delete sweep
- `packages/api/src/routers/compliance/gdpr.ts` - retention-exemption branch + `RETENTION_CITATIONS` + retention-blocked audit log
- `packages/db/src/__tests__/soft-delete.test.ts` - retained-in-window guard cases (Invoice fixture)
- `apps/cron-worker/src/__tests__/data-purge.test.ts` - cannot-delete-in-window + purges-after-window (fixture-mapped Invoice; mocked `getRetentionCutoff`)
- `packages/api/src/routers/__tests__/gdpr.test.ts` - retention-exemption branch + empty-map default (fixture `MODEL_RETENTION_TYPE`)

## Decisions Made

- Resolver placed in `packages/db` to avoid a static `api -> cron-worker` dependency edge while remaining reachable by all three chokepoints (A5; confirmed in-tree).
- `getRetentionCutoff` accepts an optional `overrideMap` (defaulting to the production `MODEL_RETENTION_TYPE`) so tests inject the Invoice fixture while the production map stays EMPTY (D-06). The Plan-01 RED scaffold's 3-arg call shape drove this signature.
- In `data-purge`, captured a single `now` and derived both the flat 90-day cutoff and the per-model retention cutoffs from it, so all four model sweeps (Document snapshot, Invoice, Contract, Contractor) consult `cutoffFor`.
- gdpr: a statutory-retention hold supersedes the user's `retainFinancialRecords=false` purge intent — a held model is always retained (count-only) and surfaced, never hard-deleted.

## Deviations from Plan

None - plan executed exactly as written. The three chokepoints, resolver shape, EMPTY production map, and fixture-verification approach all match the plan's `<interfaces>` and `<tasks>`.

(One test-tolerance adjustment during Task 2: the flat 90-day cutoff is computed via calendar `setDate(getDate() - 90)`, which differs from a fixed-ms subtraction by the DST hour. Loosened the data-purge cutoff assertions from a 60s tolerance to 3h to cover the calendar-vs-ms drift. This is a test-only fix within the planned task, not a scope deviation.)

## Issues Encountered

- **cron-worker typecheck:** the hoisted `mockGetRetentionCutoff` default `() => null` inferred a `null` return type, so `mockImplementation` returning `Date | null` failed tsc. Fixed by typing the hoisted mock as `vi.fn<(model: string, now: Date) => Date | null>(() => null)`. Resolved; both test + typecheck GREEN.

## Verification

- `pnpm --filter @contractor-ops/db test retention-policy soft-delete` — GREEN (24/24)
- `pnpm --filter @contractor-ops/cron-worker test data-purge` — GREEN (5/5: cannot-delete-in-window + purges-after-window + 3 baseline)
- `pnpm --filter @contractor-ops/api test gdpr` — GREEN (18/18: retention-exemption + empty-map default + baseline erasure/export)
- `pnpm typecheck` — GREEN across db / cron-worker / api
- `pnpm lint:audit-log` — PASS (no direct `auditLog.create`; gdpr routes through `writeAuditLog`)
- `pnpm lint:logs` — one PRE-EXISTING offender in `apps/api/src/routes/csp-report.ts:86` (last touched `e320911b`, not a plan-owned file). Out of scope per SCOPE BOUNDARY; recorded in `deferred-items.md`. None of the four plan-owned files are offenders.

## Known Limitations (recorded per plan success criterion)

- **EU-pinned `data-purge` cross-region gap (Pitfall 6):** the base-prisma purge is EU-pinned and cannot reach US/ME soft-deleted rows. PRE-EXISTING (already true for ME), NOT introduced here; D-05 (no in-window hard-delete) is satisfied trivially for rows the EU purge cannot see. Region fan-out deferred as an ops item (threat T-83-04-05 = accept). See `deferred-items.md`.
- **Statutory-citation copy** (`RETENTION_YEARS` values + `RETENTION_CITATIONS` 26 CFR refs) annotated LOCAL-ONLY; needs jurisdiction-specific legal/tax-adviser verification before production deploy (Standing Project Constraint; not hard-blocking).

## User Setup Required

None - no external service configuration required. The retention mechanism is in-tree code; `MODEL_RETENTION_TYPE` ships EMPTY so production behaviour is identical to today until Phase 86 registers the real tax models.

## Next Phase Readiness

- US-INFRA-03 complete — retention enforced (4yr 1099-NEC, 7yr backup-withholding) with no early hard-delete at any of the three chokepoints.
- Phase 86 tax models opt in by adding their entry to `MODEL_RETENTION_TYPE` (e.g. `Form1099Nec: '1099-NEC'`) and joining `softDeleteModels` — the guard, cron window, and gdpr exemption all inherit automatically.
- Theme B AKTA-02 (per-jurisdiction personnel-file retention) extends the SAME `RETENTION_YEARS`/`MODEL_RETENTION_TYPE` resolver (D-04); AKTA-03 extends `RETENTION_CITATIONS`.

## Self-Check: PASSED

- `packages/db/src/retention-policy.ts` — FOUND
- `83-04-SUMMARY.md` — FOUND
- Commit `442ed581` (Task 1) — FOUND
- Commit `a9fcc1b6` (Task 2) — FOUND
- Commit `278cfe1e` (Task 3) — FOUND

---
*Phase: 83-theme-a-us-region-infrastructure*
*Completed: 2026-06-07*
