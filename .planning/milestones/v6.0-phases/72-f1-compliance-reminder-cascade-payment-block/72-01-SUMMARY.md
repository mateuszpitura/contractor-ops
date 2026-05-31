---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 01
subsystem: testing
tags: [vitest, nyquist, compliance, payments, approval-engine, feature-flags, lint-guards]

requires:
  - phase: 71-f1-compliance-policy-package-schema-classification-reconcile
    provides: ContractorComplianceItem severity/status/expiryJurisdictionTz fields the scaffolds assert against
provides:
  - 8 failing-test scaffolds establishing the Phase 72 RED baseline (COMPL-03/05/06/07)
  - Deterministic per-pattern failing counts wired to VALIDATION.md testNamePatterns
affects: [72-02, 72-03, 72-04, 72-05, 72-06, 72-07, 72-08]

tech-stack:
  added: []
  patterns:
    - "Dynamic await-import scaffolds: tests reference absent production modules via runtime import so typecheck stays green while the suite fails RED"
    - "Indirect import specifier (/* @vite-ignore */) in web-vite scaffold so Vite static analysis does not abort collection — all it() cases run and fail individually"

key-files:
  created:
    - packages/api/src/services/__tests__/compliance-reminder-scan.test.ts
    - packages/api/src/services/__tests__/compliance-payment-gate.test.ts
    - packages/api/src/services/__tests__/approval-engine-operator-registry.test.ts
    - packages/api/src/services/__tests__/payment-run-compliance-check.test.ts
    - packages/api/src/services/__tests__/compliance-recovery.test.ts
    - apps/web-vite/src/components/payments/__tests__/payment-block-modal.test.tsx
    - packages/lint-guards/src/__tests__/payment-gate-guard.test.ts
    - packages/feature-flags/src/__tests__/compliance-payment-block-entry.test.ts
  modified: []

key-decisions:
  - "web-vite block-modal scaffold uses an indirect import specifier with /* @vite-ignore */ so the suite collects and yields 4 distinct failing cases instead of a single failed-suite collection error (satisfies the >=3 per-task acceptance criterion)"
  - "Dropped the unused render/screen import from the web-vite scaffold to keep it biome-clean; the real RTL imports return in Plan 72-07 when the component exists"

patterns-established:
  - "Nyquist Wave 0 RED baseline: every Phase 72 production module gets a header-stamped failing scaffold downstream plans EVOLVE rather than replace"

requirements-completed: [COMPL-03, COMPL-05, COMPL-06, COMPL-07]

duration: ~15 min
completed: 2026-05-31
---

# Phase 72 Plan 01: Wave 0 Nyquist Failing Scaffolds Summary

**Eight header-stamped failing-test files establishing a deterministic RED baseline for the reminder cron orchestrator, payment-block helper, approval operator registry, atomic PaymentRunComplianceCheck audit row, recovery hook, block-modal UI, CI lint guard, and the compliance-payment-block signoff-registry entry.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-05-31
- **Tasks:** 8 (committed as one cohesive scaffold deliverable)
- **Files created:** 8

## Accomplishments
- API package: 21 failing test cases across 5 new files (`compliance-reminder-scan`, `compliance-payment-gate`, `approval-engine-operator-registry`, `payment-run-compliance-check`, `compliance-recovery`)
- web-vite: 4 failing cases (`payment-block-modal` x3 + `payment-wizard error-handling` x1)
- lint-guards: 3 failing cases (`payment-gate-guard`)
- feature-flags: 1 failing case (registry-presence) + 1 passing regression-guard (namespace prefix), as the plan documents
- `pnpm typecheck` exits 0 across all 43 workspace tasks — the await-import pattern keeps types clean while tests fail at runtime on absent modules
- No production code modified

## Task Commits

1. **All 8 scaffolds (Tasks 72-01-01..08)** - `75b86720` (test)

## Files Created/Modified
- `packages/api/src/services/__tests__/compliance-reminder-scan.test.ts` - COMPL-03 cron orchestrator RED stubs
- `packages/api/src/services/__tests__/compliance-payment-gate.test.ts` - COMPL-05 payment-block helper RED stubs
- `packages/api/src/services/__tests__/approval-engine-operator-registry.test.ts` - COMPL-06 operator registry RED stubs
- `packages/api/src/services/__tests__/payment-run-compliance-check.test.ts` - COMPL-07 atomic audit-row RED stubs
- `packages/api/src/services/__tests__/compliance-recovery.test.ts` - COMPL-06 recovery hook RED stubs
- `apps/web-vite/src/components/payments/__tests__/payment-block-modal.test.tsx` - COMPL-05 block-modal RTL RED stubs
- `packages/lint-guards/src/__tests__/payment-gate-guard.test.ts` - COMPL-05 CI lint-guard RED stub
- `packages/feature-flags/src/__tests__/compliance-payment-block-entry.test.ts` - COMPL-05 signoff-registry presence assertion

## Decisions Made
- Indirect import specifier in the web-vite scaffold (see key-decisions) so the suite collects and produces individually-counted failing cases.
- Removed the unused `render, screen` import to keep the scaffold lint-clean; it returns in 72-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] web-vite scaffold collected as a failed suite instead of failing test cases**
- **Found during:** Task 72-01-06 (block-modal RTL scaffold)
- **Issue:** Vite's static import-analysis pre-resolved the literal `import('../payment-block-modal')` at transform time and aborted suite collection (0 cases ran), so the file failed as a suite rather than yielding the required >=3 failing test cases.
- **Fix:** Assigned the specifier to a variable and added `/* @vite-ignore */` so the import is a true runtime import; also removed the unused `render, screen` import to keep biome clean.
- **Files modified:** apps/web-vite/src/components/payments/__tests__/payment-block-modal.test.tsx
- **Verification:** `pnpm --filter @contractor-ops/web-vite test --run --testNamePattern='payment-block-modal|payment-wizard error-handling'` now reports 4 failed test cases, exit 1.
- **Committed in:** `75b86720` (part of the scaffold commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to satisfy the per-task acceptance criterion (>=3 failing cases). No scope creep — still pure test scaffolding, no production code.

## Issues Encountered
None — biome reordered import members on commit (cosmetic), all RED baselines and typecheck verified.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RED baseline locked. Ready for Plan 72-02 (Prisma migrations + schema edits) which is the only Wave 1 plan and unblocks all production-code plans.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
