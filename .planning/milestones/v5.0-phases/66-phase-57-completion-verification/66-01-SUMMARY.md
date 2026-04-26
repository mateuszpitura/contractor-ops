---
phase: 66-phase-57-completion-verification
plan: 01
subsystem: testing
tags: [vitest, vite-alias, monorepo, einvoice, validators]

requires:
  - phase: 57-government-api-clients
    provides: contractor / invoice / organization router suites whose load path traverses validators → einvoice
provides:
  - Subpath-aware vitest alias for `@contractor-ops/einvoice` (array-of-aliases form, most-specific-first ordering)
  - Self-documenting comment block referencing 66-RESEARCH.md `<vitest_alias_diagnosis>` and the ENOTDIR failure mode
  - Functional test infrastructure for the contractor / invoice / gov-api-clients suites — prerequisite for Plans 66-02..66-04
affects: [66-02, 66-03, 66-04, 67]

tech-stack:
  added: []
  patterns:
    - "Vite alias array form for multi-export packages — list subpath aliases BEFORE bare-package alias"

key-files:
  created: []
  modified:
    - packages/api/vitest.config.ts

key-decisions:
  - "Kept pre-existing imports / test block untouched — minimal-scope edit per CONTEXT.md D-19"
  - "Added inline comment block linking to 66-RESEARCH.md so future contributors don't revert the array form"
  - "Mirrored package.json `exports` shape with three subpath aliases (zatca/schemas, zatca/types, compliance) plus bare-package fallback"

patterns-established:
  - "Vitest alias entries for multi-export packages: most-specific-first array form"

requirements-completed:
  - PAY-02
  - PAY-03
  - PAY-04
  - PAY-05

duration: 12 min
completed: 2026-04-26
---

# Phase 66 Plan 01: Vitest Alias Repair Summary

**Replaced the single-file `@contractor-ops/einvoice` vitest alias in `packages/api/vitest.config.ts` with a subpath-aware array form so tests no longer ENOTDIR through the validators barrel — restores the test-loading prerequisite for Plans 66-02..66-04.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-26T03:08:00Z
- **Completed:** 2026-04-26T03:11:30Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Replaced object-form alias (`{key: value}`) with array form (`[{find, replacement}, …]`) per Vite docs
- Listed subpath aliases (`@contractor-ops/einvoice/zatca/schemas`, `/zatca/types`, `/compliance`) BEFORE bare `@contractor-ops/einvoice` entry — Vite matches array entries in declaration order
- Added inline comment block documenting the ENOTDIR failure mode and pointing to 66-RESEARCH.md `<vitest_alias_diagnosis>` (anti-revert defense per threat model T-66-01-01)
- Verified `contractor.test.ts`, `invoice.test.ts`, `gov-api-clients.test.ts` all load and run green (63/63 tests pass)
- Confirmed collateral suites (`ksef.test.ts`, `zatca.test.ts`) still pass (25/25)

## Task Commits

1. **Task 1 + 2 + 3 atomic:** alias edit, verification, single commit — `2a52cf4e` (fix)

The plan authorized Tasks 1-3 to land as one atomic commit (Task 3's "atomic commit" instruction), so a single hash covers the alias edit, the inline ENOTDIR-documentation comment, and the verification re-runs.

**Plan metadata:** to be added by orchestrator (no separate commit since this SUMMARY rolls up alongside 66-02/03/04 documentation per the phase plan).

## Files Created/Modified

- `packages/api/vitest.config.ts` — alias block converted from object to array form with 3 subpath entries + bare-package entry + comment block

## Decisions Made

None beyond the plan as written. Followed CONTEXT.md D-04 (re-validation acceptance) and D-08 (minimal-scope broadening) as documented.

## Deviations from Plan

### Surfaced (not auto-fixed) Pre-existing Failures

**1. [Rule 2 — Missing Critical, surfaced not silently fixed] organization.test.ts and einvoice.test.ts cannot load due to incomplete `@contractor-ops/logger` mock**

- **Found during:** Task 2 (verification re-run)
- **Issue:** `vi.mock('@contractor-ops/logger', …)` in both files only stubs `createLogger` and `createTrpcLogger`; missing `createIntegrationLogger`. `appRouter` imports `google-workspace` → `integrations/index` → `autenti-adapter`, which calls `createIntegrationLogger` at module-load time. Vitest treats missing mock exports as load-time errors → both suites fail with "No 'createIntegrationLogger' export is defined on the '@contractor-ops/logger' mock".
- **Decision:** Per Plan 66-01 Task 2 STOP directive ("If ANY OTHER pre-existing test fails, also RECORD and STOP — surface the failure as new intel rather than amplifying scope mid-plan"), this is NOT fixed in 66-01. Plan 66-02 already touches `organization.test.ts` to add `setKleinunternehmer` cases — extending the logger mock there is in scope. `einvoice.test.ts` is unrelated to Phase 57 / 66 and stays as-is for a separate maintenance pass.
- **Verification:** `contractor.test`, `invoice.test`, `gov-api-clients` (the three D-04 mandate suites) all load and pass. organization.test will be repaired by Plan 66-02 as a prerequisite to its own test additions.

**2. [Rule 1 — Bug, surfaced not auto-fixed] `cd packages/api && npx tsc --noEmit` returns 109 errors (audit.ts, consent.ts, etc. — Prisma deep generic mismatches)**

- **Found during:** Task 2 (type-check verification)
- **Issue:** Pre-existing TS errors in `packages/api/src/routers/{audit,consent,…}.ts` and various services (Prisma `Exact<>` generic depth issues, EntityType enum widening, optional-property mismatches). Existed before Plan 66-01 began (verified by stashing the alias edit and re-running `tsc --noEmit` → still 109 errors). Tracked in untracked `api-tsc-errors.txt` baseline file.
- **Decision:** Plan 66-01's verification expects `tsc --noEmit` exit 0, but the baseline already had 109 errors. None of them involve `vitest.config.ts` or the alias change — the alias edit introduced ZERO new TS errors. Per the plan's STOP directive on pre-existing failures, surfaced as new intel rather than amplifying scope. Phase 66 verification proceeds because all four PAY-02..05 truths are tested via vitest, not tsc.
- **Verification:** With and without the alias edit, the same 109 errors appear in the same files. Edit is type-neutral.

---

**Total deviations:** 0 auto-fixed (2 surfaced as new intel per plan instructions)
**Impact on plan:** Alias repair is correct and self-contained. The two surfaced issues are pre-existing and routed: organization.test logger mock → Plan 66-02; tsc baseline → out of Phase 66 scope (separate maintenance phase).

## Issues Encountered

- Stashing the alias edit during baseline verification revealed an unexpectedly large set of pre-existing dirty files in the working tree (31 modified files from prior Phase 65/67 sessions). Used `git reset HEAD` to clear spurious staged changes from `git stash pop`, then staged ONLY `packages/api/vitest.config.ts` for the atomic commit. Verified via `git diff --cached --stat` that exactly 1 file with 48/-11 lines was staged before commit.

## User Setup Required

None.

## Next Phase Readiness

- Plan 66-02 can now run its `setKleinunternehmer` additions in `organization.test.ts` IF it first repairs the logger mock there (extends `createIntegrationLogger` to the mock). Plan 66-02 should treat that as a Rule 2 prerequisite.
- Plan 66-03 is fully unblocked (touches MSW gov-api integration test, doesn't go through the api package's test loader).
- Plan 66-04 can re-run the verification commands once 66-02 / 66-03 land.

---
*Phase: 66-phase-57-completion-verification*
*Completed: 2026-04-26*
