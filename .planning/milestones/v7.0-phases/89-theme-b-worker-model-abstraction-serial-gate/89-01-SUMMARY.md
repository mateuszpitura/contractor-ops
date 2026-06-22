---
phase: 89-theme-b-worker-model-abstraction-serial-gate
plan: 01
subsystem: testing
tags: [trpc, prisma, zod, vitest, snapshot, regression, worker-model]

# Dependency graph
requires:
  - phase: 84-85 (contractor surface, US profile/SSN)
    provides: the contractor.* tRPC surface + buildContractorListWhere + the 4 raw-SQL contractor sites that this plan snapshots and baselines
provides:
  - contractor.* route-shape snapshot (procedure names + input/output JSON-Schema shapes) captured GREEN on the current pre-Worker router — CI fails on any later drop/rename/reshape
  - contractor-parity regression BASELINE captured GREEN on the current schema (list / getById / buildContractorListWhere list-payment-run-export predicate / dashboard activeContractors raw count / search FTS raw site / portal contractor read + the 4 raw-SQL FROM Contractor sites)
  - planWorkerBackfill idempotency RED scaffold (terminal until Plan 03)
  - withWorkerTypeDefault extension RED scaffold across all 8 read ops + explicit-where-wins (terminal until Plan 02)
affects: [89-02 (extension), 89-03 (backfill + migration), 89-04 (router split — snapshot guards it), worker-model-abstraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tRPC contract snapshot via appRouter._def.procedures introspection (read-only, no procedure invoked) + zod 4 native z.toJSONSchema for input/output shapes — no new dependency"
    - "Parity baseline captured GREEN on the unmodified codebase so post-Worker regression is provable (lock the contract before you move it)"
    - "Terminal-RED scaffold idiom: import a not-yet-existing module so the suite fails at module resolution, not on assertion logic; db tsconfig excludes __tests__ so typecheck stays green"

key-files:
  created:
    - packages/api/src/__tests__/contractor-contract-snapshot.test.ts
    - packages/api/src/__tests__/__snapshots__/contractor-contract-snapshot.test.ts.snap
    - packages/api/src/__tests__/worker-regression.test.ts
    - packages/db/src/__tests__/backfill-worker.test.ts
    - packages/db/src/__tests__/worker-type.test.ts
  modified: []

key-decisions:
  - "Route-shape snapshot captures BOTH the sorted contractor.* procedure name list AND each procedure's input/output JSON-Schema shape via z.toJSONSchema (zod 4.4.3 exports it — A1 confirmed at runtime); no zod-to-json-schema dependency added (gated install avoided)"
  - "Parity baseline exercises the read paths through the cloned tenant-isolation mock-Prisma + createCallerFactory harness (list / getById / dashboard.kpis / search.global) PLUS direct buildContractorListWhere assertions for the list/payment-run/export shared predicate and the 2 facet raw sites; the portal read path is locked via the contractor-scoped id+org+deletedAt where idiom (portal runs on a separate portalAppRouter)"
  - "Dashboard.kpis raw contractor-count is reached by collapsing its Redis singleflight (mock ../services/cache) and routing readReplica to the mock client, so the FROM Contractor + org + status ACTIVE + deletedAt predicate is asserted against the real source SQL"
  - "RED scaffolds fail at module resolution (Cannot find module), the correct RED reason — terminal until Plans 02/03 create withWorkerTypeDefault and backfill-worker.ts"

patterns-established:
  - "contractor.* surface is frozen at 19 procedures (archive, bulkArchive, bulkAssignOwner, companyLookup, create, export, financialPulse, getById, getCountryFields, getCountryFieldsConfig, insights, list, listEngagements, revalidateVat, revealSsn, update, updateCountryFields, updateLifecycleStage, updateUsProfile)"
  - "The 4 raw-SQL FROM Contractor sites (dashboard activeContractors, search FTS, billingModel facet, FTS facet) are inherently contractor-only under design A and are baselined by predicate-token assertions, NOT inline workerType predicates"

requirements-completed: []

# Metrics
duration: ~22min
completed: 2026-06-22
---

# Phase 89 Plan 01: Worker-Gate Wave-0 Baselines + RED Scaffolds Summary

**contractor.* route-shape snapshot + contractor-parity regression captured GREEN on the current pre-Worker schema (the provable regression net), plus terminal-RED scaffolds for the backfill idempotency and the withWorkerTypeDefault extension.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-22T01:46Z
- **Completed:** 2026-06-22T02:00Z
- **Tasks:** 2
- **Files modified:** 5 created (2 GREEN baseline tests + 1 snapshot file + 2 RED scaffolds)

## Accomplishments

- **Route-shape contract lock:** `contractor-contract-snapshot.test.ts` introspects `appRouter._def.procedures`, freezes the sorted `contractor.*` name list (19 procedures) and each procedure's input/output JSON-Schema shape via zod 4's native `z.toJSONSchema`. Captured GREEN against the current router; any later split that drops, renames, or reshapes a contractor procedure fails CI on a snapshot diff. No new dependency (A1: `z.toJSONSchema` confirmed exported in the pinned zod 4.4.3).
- **Contractor-parity BASELINE:** `worker-regression.test.ts` (describe block `contractor-parity baseline (pre-Worker schema)`) clones the tenant-isolation mock-Prisma + `createCallerFactory` harness and locks all six contractor read paths + the 4 raw-SQL `FROM "Contractor"` sites the central extension is structurally blind to. GREEN on the current schema — this is the provable baseline for post-backfill parity (D-03).
- **Backfill idempotency RED scaffold:** `backfill-worker.test.ts` pins `planWorkerBackfill` — one Worker insert per unlinked contractor, skip an already-linked contractor, zero new inserts on re-run over its own output, never mutate the source. Terminal RED until Plan 03.
- **Extension RED scaffold:** `worker-type.test.ts` pins `withWorkerTypeDefault` — inject `workerType='CONTRACTOR'` on Worker reads across all 8 read ops (findMany/findFirst/findFirstOrThrow/findUnique/findUniqueOrThrow/count/aggregate/groupBy), explicit-where-wins (an explicit `workerType` left untouched), and a non-Worker read unmodified. Terminal RED until Plan 02.

## Task Commits

Each task was committed atomically:

1. **Task 1: GREEN baselines — route-shape snapshot + contractor-parity regression** - `850fc7468` (test)
2. **Task 2: RED scaffolds — backfill idempotency + withWorkerTypeDefault extension** - `98c93a5e3` (test)

_TDD note: this plan is test-only (Wave-0), so all commits are `test(...)`._

## Files Created/Modified

- `packages/api/src/__tests__/contractor-contract-snapshot.test.ts` - tRPC contract lock via `appRouter._def.procedures` + `z.toJSONSchema` shapes
- `packages/api/src/__tests__/__snapshots__/contractor-contract-snapshot.test.ts.snap` - frozen contractor.* names + input/output JSON-Schema shapes (GREEN at capture)
- `packages/api/src/__tests__/worker-regression.test.ts` - contractor-parity baseline (6 read paths + 4 raw-SQL sites), GREEN pre-Worker
- `packages/db/src/__tests__/backfill-worker.test.ts` - planWorkerBackfill idempotency RED scaffold (terminal until Plan 03)
- `packages/db/src/__tests__/worker-type.test.ts` - withWorkerTypeDefault extension RED scaffold, all 8 read ops + explicit-where-wins (terminal until Plan 02)

## Verification

- `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/worker-regression.test.ts` → **11 passed** (GREEN baseline)
- `contractor-contract-snapshot.test.ts` → **2 snapshots written, 3 tests passed** (GREEN; snapshot file committed)
- `pnpm --filter @contractor-ops/db exec vitest run src/__tests__/backfill-worker.test.ts src/__tests__/worker-type.test.ts` → **2 suites failed at module resolution** (`Cannot find module '../../scripts/backfill-worker.js'` / `Cannot find module '../worker-type.js'`) — the correct terminal-RED reason
- `pnpm typecheck --filter=@contractor-ops/api` and `--filter=@contractor-ops/db` → **green** (db tsconfig excludes `src/**/__tests__/**`, so the RED imports do not brick typecheck)
- `pnpm lint:no-breadcrumbs` → **OK** for all four new files (no Phase/WORKER/D-NN IDs in comments)

## Decisions Made

- **Names + shapes in the snapshot, not names only.** A1 (zod 4 `z.toJSONSchema`) was confirmed exported at runtime in the pinned zod 4.4.3, so the snapshot captures full input/output JSON-Schema shapes — a stronger drift guard than the names-only fallback, with no `zod-to-json-schema` install (gated install avoided per the threat register T-89-01-SC).
- **Parity through the harness + the pure where-builder.** The list/getById/dashboard/search paths run through the cloned tenant-isolation caller harness; `buildContractorListWhere` (the list/payment-run/export shared predicate) and the 2 facet raw sites are asserted directly on the exported pure function. The portal read path runs on a separate `portalAppRouter`, so it is locked via the contractor-scoped `id + organizationId + deletedAt` where idiom rather than spinning up a second caller context.
- **Design A baselining for the raw-SQL sites.** Under design A (discriminator on `Worker` only), the 4 `FROM "Contractor"` raw sites are inherently contractor-only, so the baseline asserts their existing org + deletedAt (+ status / search_vector) predicate tokens rather than expecting an inline `workerType` predicate — matching the plan and RESEARCH Pitfall 1 resolution.

## Deviations from Plan

None - plan executed exactly as written. The route-shape snapshot includes input/output shapes (not the names-only fallback) because `z.toJSONSchema` is available in the pinned zod 4.4.3, exactly as the plan's primary path specified.

## Issues Encountered

- **dashboard.kpis hung the parity test on first run.** The KPI procedure wraps its read in a Redis-backed `cachedSingleflight` and routes through `readReplica`; the trimmed mock did not satisfy either, so the test timed out at 5s. Resolved by mocking `../services/cache` (collapse singleflight to a direct call) and adding `readReplica` to the `@contractor-ops/db` mock (route to the mock client) — the contractor raw-count SQL is then issued synchronously and asserted. Not a deviation: the same mock idiom is used by tenant-isolation.test.ts.

## Known Stubs

None. The two GREEN baselines are fully wired against real source (the live `appRouter`, the exported `buildContractorListWhere`, and the real raw-SQL predicates). The two RED scaffolds are intentional terminal-RED placeholders, documented above as terminal until Plans 02 (`withWorkerTypeDefault`) and 03 (`planWorkerBackfill`) create the imported modules — by design, not stubs to be wired in this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The contract lock + parity baseline are in place, so Plan 04's router split has a CI guard against contractor.* drift and Plans 02/03 have a provable zero-regression target.
- The two RED scaffolds are the GREEN target for Plans 02 (extension) and 03 (backfill); they fail at module resolution today and flip GREEN once those modules land.
- No WORKER-* requirement is marked complete — Phase 89 is 1/6 plans; the Worker table / extension / backfill / router / RBAC / flag land in later waves, several behind a [BLOCKING] human migration gate.

## Self-Check: PASSED

- All 5 created files verified present on disk (2 GREEN baseline tests + snapshot file + 2 RED scaffolds + SUMMARY).
- Both task commits verified in git log: `850fc7468` (Task 1), `98c93a5e3` (Task 2).

---
*Phase: 89-theme-b-worker-model-abstraction-serial-gate*
*Completed: 2026-06-22*
