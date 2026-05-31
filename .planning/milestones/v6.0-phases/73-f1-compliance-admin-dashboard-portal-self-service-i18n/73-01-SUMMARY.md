---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 01
subsystem: testing
tags: [vitest, nyquist, red-baseline, compliance, web-vite, trpc]

requires:
  - phase: 71-72
    provides: classification router, assertContractorPaymentEligibility, compliance-policy registry, recompute-compliance-dialog (web-vite port)
provides:
  - 10 failing Nyquist scaffold test files mapping COMPL-01/04/11
  - deterministic RED baseline for Plans 73-02..08 to flip GREEN incrementally
affects: [73-02, 73-03, 73-04, 73-05, 73-06, 73-07, 73-08]

tech-stack:
  added: []
  patterns:
    - "web-vite Nyquist scaffolds indirect dynamic imports via a variable specifier + /* @vite-ignore */ so a not-yet-existing module fails at runtime (assertion) instead of Vite transform-time (whole-suite collection failure)"
    - "registry-coverage tests import the package barrel (../index.js) to trigger side-effect rule registration, then assert a non-empty registry before per-rule field checks (avoids vacuous-truth GREEN)"

key-files:
  created:
    - packages/api/src/services/__tests__/compliance-dashboard.test.ts
    - packages/api/src/__tests__/compliance-override-mutation.test.ts
    - packages/api/src/__tests__/compliance-portal-upload.test.ts
    - packages/api/src/__tests__/compliance-upload-review.test.ts
    - packages/compliance-policy/src/__tests__/expiry-from-upload-date.test.ts
    - packages/validators/src/__tests__/compl-doc-names-parity.test.ts
    - apps/web-vite/src/components/contractors/compliance/__tests__/override-compliance-item-dialog.test.tsx
    - apps/web-vite/src/components/compliance/dashboard/__tests__/compliance-dashboard-container.test.tsx
    - apps/web-vite/src/components/portal/compliance/__tests__/portal-upload-replacement-form.test.tsx
    - packages/auth/src/__tests__/compliance-permission.test.ts
  modified: []

key-decisions:
  - "web-vite dynamic-import indirection (@vite-ignore + variable specifier) is required because Vite statically resolves literal dynamic-import specifiers at transform time — unlike the api package's esbuild/tsx runner which tolerates them"
  - "expiry-semantic-coverage imports ../index.js for side-effect rule registration and asserts registry non-empty, so the missing-expirySemantic check is meaningful rather than a vacuous pass over an empty REGISTRY"

patterns-established:
  - "Vite-safe Nyquist RED: const PATH = '...'; await import(/* @vite-ignore */ PATH)"

requirements-completed: [COMPL-01, COMPL-04, COMPL-11]

duration: 18 min
completed: 2026-05-31
---

# Phase 73 Plan 01: Wave 0 Nyquist Failing Scaffolds Summary

**10 deterministic RED test files across api, compliance-policy, validators, auth, and web-vite that pin every Phase 73 production module (COMPL-01/04/11) before any implementation lands.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-31T21:45:28Z
- **Completed:** 2026-05-31T21:55:00Z
- **Tasks:** 10
- **Files modified:** 10 (all created)

## Accomplishments
- API scaffolds: dashboard query helpers, overrideItem mutation, portal submitUploadReplacement, admin approve/reject upload-review (28 failing test cases)
- compliance-policy: defaultExpiryFromUploadDate + expirySemantic coverage (5 failing)
- validators: COMPL doc-name parity guard D-17 (3 failing)
- auth: compliance:read / compliance:override permission + role grants (6 failing)
- web-vite RTL scaffolds: override modal (7), admin dashboard container (7), portal upload form + home banner (7) — all run-and-fail at runtime, not collection
- `pnpm typecheck` exits 0 across api / compliance-policy / validators / auth / web-vite

## Task Commits

All 10 scaffolds form one cohesive RED baseline, committed together:

1. **Tasks 73-01-01..10: 10 Nyquist scaffolds** - `4d9310d9` (test)

## Files Created/Modified
- See `key-files.created` — 10 test files at the exact `files_modified` paths.

## Decisions Made
- See `key-decisions` frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] expiry-semantic-coverage passed vacuously over an empty registry**
- **Found during:** Task 73-01-05 (compliance-policy scaffold verification)
- **Issue:** The scaffold imported `../registry.js` directly. Because policy rules register via side-effect imports of `./policies/*` (driven by `../index.js`), `listPolicyRules()` returned `[]`, the per-rule loop never executed, and the test passed — only 4/5 required failures, non-deterministic GREEN.
- **Fix:** Added `await import('../index.js')` for side-effect registration and an `expect(rules.length).toBeGreaterThan(0)` guard before the loop, matching the existing `registry.test.ts` convention.
- **Files modified:** packages/compliance-policy/src/__tests__/expiry-from-upload-date.test.ts
- **Verification:** pattern `expiry-from-upload-date|expiry-semantic-coverage` now exits non-zero with 5 failing cases (meets "at least 5").
- **Committed in:** `4d9310d9`

**2. [Rule 1 - Bug] web-vite scaffolds failed as suite-collection errors, not assertions**
- **Found during:** Tasks 73-01-07/08/09 (web-vite scaffold verification)
- **Issue:** Vite resolves a static `await import('../literal-path')` at transform time. With the target modules absent (created in Plans 73-06/07/08), all 3 suites failed to collect (`Failed to resolve import`), yielding "3 failed test files / 0 tests run" instead of the required per-test-case failures.
- **Fix:** Indirected each specifier through a `const PATH = '...'` variable and added `/* @vite-ignore */`, so resolution defers to runtime. Suites now collect and each named test fails with `Cannot find module` / `not yet implemented`.
- **Files modified:** override-compliance-item-dialog.test.tsx, compliance-dashboard-container.test.tsx, portal-upload-replacement-form.test.tsx
- **Verification:** combined web-vite pattern now exits non-zero with 21 failing test cases (7+7+7); typecheck stays 0.
- **Committed in:** `4d9310d9`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs).
**Impact on plan:** Both fixes were necessary to produce the deterministic RED baseline the plan's `must_haves.truths` demand. No scope creep — only the scaffold test files changed; no production code touched.

## Issues Encountered
- Biome auto-formatted import ordering (`describe, expect, it`) on commit — cosmetic, re-staged automatically by lint-staged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RED baseline is live and deterministic. Wave 1 (Plans 73-02 schema, 73-04 legal registry) can proceed.
- Plans 73-02..08 EVOLVE these scaffolds to GREEN; the `// Phase 73 Wave 0 — Nyquist failing scaffold` header marks intent so they are not deleted.

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-05-31*
