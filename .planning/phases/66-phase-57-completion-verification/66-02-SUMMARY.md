---
phase: 66-phase-57-completion-verification
plan: 02
subsystem: testing
tags: [vitest, contractor-router, organization-router, kleinunternehmer, hmrc, vat]

requires:
  - phase: 57-government-api-clients
    provides: validateVat / setKleinunternehmer router procedures, validateTaxId orchestrator
  - phase: 66-phase-57-completion-verification
    provides: Plan 66-01 vitest alias repair so test suites can load
provides:
  - Router-layer assertion that validateVat surfaces responseStatus='invalid' (HMRC 404 sad path) — closes Plan 57-04 Task 3 §2 PAY-03 truth
  - Router-layer assertion that setKleinunternehmer flips the flag for DE orgs and rejects non-DE orgs with FORBIDDEN — closes Plan 57-04 Task 3 §6 PAY-04 truth
  - Extended @contractor-ops/logger mock in organization.test.ts (createIntegrationLogger / createCronLogger / createWebhookLogger / logger) — fixes pre-existing infrastructure gap surfaced during Plan 66-01 verification
affects: [66-04, 67]

tech-stack:
  added: []
  patterns:
    - "Router-layer deterministic substitute for manual UI sandbox steps — assert orchestrator return shape surfaces to caller"
    - "Sparse Prisma method augmentation via beforeEach (cast to Record<string, unknown>) — preserves hoisted factory minimalism"

key-files:
  created: []
  modified:
    - packages/api/src/routers/__tests__/contractor.test.ts
    - packages/api/src/routers/__tests__/organization.test.ts

key-decisions:
  - "New contractor.test case placed inside the existing Phase 57 describe block — inherits the validateTaxIdMock reset"
  - "New organization.test setKleinunternehmer block uses inline-mock-augmentation pattern (not hoisted reshape) to avoid contamination of pre-existing tests"
  - "Logger mock extension is in scope for Plan 66-02 — without it the suite cannot load and 66-02's own tests cannot run; documented in commit body as Rule 2 (Missing Critical) deviation"

patterns-established:
  - "Router-layer substitute pattern for manual sandbox UI scenarios: assert orchestrator return shape surfaces to caller without throwing"

requirements-completed:
  - PAY-03
  - PAY-04

duration: 8 min
completed: 2026-04-26
---

# Phase 66 Plan 02: Router-Layer Coverage Fills Summary

**Closes the two router-layer Phase 57 gaps (§2 HMRC 404→invalid surface and §6 setKleinunternehmer DE-only gate) with 4 new tests across contractor.test and organization.test, plus an in-scope logger mock repair so the suite loads.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-26T03:13:00Z
- **Completed:** 2026-04-26T03:18:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- contractor.test.ts: Added `validateVat surfaces responseStatus=invalid to the caller (HMRC 404 sad path) — §2` inside the existing Phase 57 describe block. Mocks `validateTaxIdMock` to return `{ responseStatus: 'invalid', confirmationRef: null, source: 'api', … }`, asserts the caller receives the result without throwing, asserts `result.confirmationRef === null`. Inherits the existing `beforeEach(() => { validateTaxIdMock.mockClear(); … })` reset.
- organization.test.ts: Added `describe('organization.setKleinunternehmer (Phase 57 · Plan 04 / Phase 66)')` block with 3 tests (DE happy path / GB FORBIDDEN / PL FORBIDDEN). Uses inline-mock-augmentation pattern to attach `findUniqueOrThrow` and `update` methods inside `beforeEach` without reshaping the hoisted mockPrisma factory.
- organization.test.ts: Extended the `vi.mock('@contractor-ops/logger', …)` block to include `createIntegrationLogger`, `createCronLogger`, `createWebhookLogger`, and the bare `logger` export — required because `appRouter` loads google-workspace router → integrations → autenti-adapter, which calls `createIntegrationLogger` at module-load time. Without this, the suite could not even start.
- All targeted suites green: 65/65 tests across contractor.test (44 = 43 pre-existing + 1 new), invoice.test (14), organization.test (7 = 4 pre-existing + 3 new).

## Task Commits

1. **Tasks 1 + 2 + 3 atomic:** test additions + logger mock fix, single commit — `c232b907` (test)

The plan authorized Tasks 1-3 as one atomic commit (Task 3's atomic-commit instruction).

## Files Created/Modified

- `packages/api/src/routers/__tests__/contractor.test.ts` — +40 lines (1 new test inside existing Phase 57 describe block)
- `packages/api/src/routers/__tests__/organization.test.ts` — +89 lines (logger mock extension + new describe block with 3 tests)

## Decisions Made

- **Logger mock extension in scope:** Per CONTEXT.md D-08 spirit ("If the harness change ripples into other suites, scope broadens minimally to make those green too"), and Plan 66-01's surfaced finding that organization.test couldn't load. Without the logger mock fix, this plan's own setKleinunternehmer tests could not run — making this a Rule 2 (Missing Critical) prerequisite, not a scope expansion.
- **Inline mock augmentation, not hoisted reshape:** Per Plan 66-02 threat model T-66-02-04 — adding `findUniqueOrThrow`/`update` to `mockPrisma.organization` at module load via the hoisted factory could pollute the pre-existing tests via state leakage. The `beforeEach(() => { ... attach methods … })` pattern keeps test isolation clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Extended @contractor-ops/logger mock in organization.test.ts**

- **Found during:** Task 2 (verification re-run)
- **Issue:** Pre-existing organization.test.ts logger mock only stubbed `createLogger` and `createTrpcLogger`. Loading `appRouter` invokes `autenti-adapter` which calls `createIntegrationLogger` at module init → vitest reports "No 'createIntegrationLogger' export is defined on the '@contractor-ops/logger' mock". Without this fix, Plan 66-02's own tests could not run. Surfaced (but not fixed) in Plan 66-01 SUMMARY.
- **Fix:** Mirrored the contractor.test.ts logger mock shape — added `createIntegrationLogger`, `createCronLogger`, `createWebhookLogger`, and the bare `logger` export, all returning the standard noop `info/warn/error/debug` quad.
- **Files modified:** packages/api/src/routers/__tests__/organization.test.ts
- **Verification:** organization.test loads and 7/7 tests pass.
- **Committed in:** c232b907 (Task 2 atomic commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary infrastructure repair to make this plan's own assertions runnable. No scope creep.

## Issues Encountered

- einvoice.test.ts has the same incomplete logger mock and continues to fail to load. Out of scope for Plan 66-02 (Plan 66-04's verification commands target organization.test specifically; einvoice.test repair is a separate maintenance item).

## User Setup Required

None.

## Next Phase Readiness

- Plan 66-03 can run independently (touches gov-api MSW integration test, orthogonal to api package).
- Plan 66-04 can now cite passing test IDs for PAY-03 (HMRC 404 sad path) and PAY-04 (Kleinunternehmer DE-only gate) in 57-VERIFICATION.md.

---
*Phase: 66-phase-57-completion-verification*
*Completed: 2026-04-26*
