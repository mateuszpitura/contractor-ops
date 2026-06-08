---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
plan: 00
subsystem: testing
tags: [vitest, tdd, red-scaffold, ssn, ein, usps, rbac, audit-log, web-vite, gov-api]

# Dependency graph
requires:
  - phase: 84-RESEARCH
    provides: EIN/SSN validator vectors, bank-account-crypto mirror, HMRC-VAT client template, UI-SPEC §B SSN states, 10-role RBAC matrix (D-09)
provides:
  - Six Wave-0 RED test scaffolds locking the behavioural contracts for EIN/SSN validators, SSN crypto, revealSsn RBAC+audit+updateUsProfile, the USPS adapter, and the two web-vite component surfaces
  - A concrete automated target for every downstream Wave 1-4 implementation task (Nyquist continuity)
affects: [84-01 validators, 84-02 ssn-crypto, 84-03 contractor router (revealSsn/updateUsProfile), 84-04 usps-client, 84-05 web-vite us-compliance-fields/ssn-masked-reveal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED test scaffold references a not-yet-existing target import/component so the suite fails on the missing module (cross-plan TDD)"
    - "Staff-router-only invariant asserted via appRouter._def.procedures presence + portalAppRouter absence"
    - "USPS adapter contract uses injected fetch + injected rate-limiter/cache (no MSW) for fail-open assertions"

key-files:
  created:
    - packages/validators/src/__tests__/us-validators.test.ts
    - packages/api/src/services/__tests__/ssn-crypto.test.ts
    - packages/api/src/routers/core/__tests__/contractor-reveal-ssn.test.ts
    - packages/gov-api/src/clients/__tests__/usps-client.test.ts
    - apps/web-vite/src/components/contractors/__tests__/country-compliance-us.test.tsx
    - apps/web-vite/src/components/contractors/compliance/__tests__/ssn-masked-reveal.test.tsx
  modified: []

key-decisions:
  - "RED is the accepted terminal state for all six scaffolds — Waves 1-4 turn them GREEN"
  - "reveal test imports the full appRouter (createCallerFactory) so the failure is driven by the missing revealSsn/updateUsProfile procedures, not by an incidental mock gap"
  - "web-vite scaffolds import the not-yet-existing component directly (RED on missing module), path-scoped only per RAM constraint"

patterns-established:
  - "RED scaffold pattern: assert the behavioural contract against a not-yet-existing target; the unresolved import makes the suite fail until implementation lands"
  - "Synthetic-only PII fixtures (078-05-1120 historic Woolworth number, 12-3456789 EIN) — never a live identity (T-84-00-01)"

requirements-completed: []  # Wave-0 scaffolds only — requirements US-FIELD-01..04 / US-LOC-01 are satisfied GREEN by Waves 1-4, not this plan

# Metrics
duration: ~25min
completed: 2026-06-08
---

# Phase 84 Plan 00: US Wave-0 RED Test Scaffolds Summary

**Six RED test scaffolds locking the EIN/SSN validator, SSN AES-256-GCM crypto, revealSsn RBAC+audit + updateUsProfile storage invariants, USPS fail-open adapter, and the two web-vite SSN/US-compliance component contracts — every downstream task now has a concrete automated target.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-08T15:30Z (approx)
- **Completed:** 2026-06-08
- **Tasks:** 3
- **Files modified:** 6 (created)

## Accomplishments
- Locked the EIN (format + IRS-prefix) and SSN (format + invalid-range 000/666/900-999, group 00, serial 0000) validator vectors plus the SSN crypto round-trip / random-IV / `iv:authTag:ciphertext` / last-4 contract.
- Locked the highest-sensitivity surface: `revealSsn` RBAC (FORBIDDEN without `contractorPii:read`), audit row `action=contractor.ssn.revealed` with NO SSN in the row, tenant scoping (NOT_FOUND cross-tenant), and staff-router-only (present on `appRouter`, absent from `portalAppRouter`).
- Locked `updateUsProfile` storage invariants: SSN → `ssnEncrypted`/`ssnLast4` dedicated columns and NEVER the `countryFields` JSONB; invalid EIN → BAD_REQUEST; USPS failure non-blocking (mutation still resolves).
- Locked the USPS adapter fail-open contract: token cache reuse, 60/hr global self-throttle → unverified (no throw, no upstream spend), Redis-down fail-open, address-cache hit, `safeParse` on malformed/5xx → unverified.
- Locked all five UI-SPEC §B SSN states (masked / reveal-absent / reveal-available / revealed-with-loading / error) including the no-full-value-in-DOM and control-absent (not disabled) invariants, plus the US dispatch render.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold validators + crypto RED tests** - `47899971` (test)
2. **Task 2: Scaffold reveal-RBAC + USPS adapter RED tests** - `3b409c5a` (test)
3. **Task 3: Scaffold web-vite component RED tests (path-scoped)** - `d89ff725` (test)

**Plan metadata:** (docs commit — this SUMMARY + STATE/ROADMAP)

## Files Created/Modified
- `packages/validators/src/__tests__/us-validators.test.ts` - EIN/SSN vectors (US-FIELD-01/02); RED on missing `../us-validators.js`.
- `packages/api/src/services/__tests__/ssn-crypto.test.ts` - encrypt/decrypt round-trip + random-IV + 3-part format + last-4 derivation (US-FIELD-02); RED on missing `../ssn-crypto.js`.
- `packages/api/src/routers/core/__tests__/contractor-reveal-ssn.test.ts` - revealSsn RBAC/audit/tenant/staff-only + updateUsProfile storage/EIN/USPS-non-blocking (US-FIELD-01/02, D-01/D-02/D-09); RED on missing `contractor.revealSsn`/`updateUsProfile`.
- `packages/gov-api/src/clients/__tests__/usps-client.test.ts` - token cache / global throttle fail-open / Redis-down fail-open / cache hit / safeParse (US-FIELD-03, D-03); RED on missing `../usps-client.js`.
- `apps/web-vite/src/components/contractors/__tests__/country-compliance-us.test.tsx` - US dispatch renders `UsComplianceFields` (US-FIELD-04, D-06); RED on missing `../compliance/us-compliance-fields.js`.
- `apps/web-vite/src/components/contractors/compliance/__tests__/ssn-masked-reveal.test.tsx` - five UI-SPEC §B states (US-FIELD-02/04); RED on missing `../ssn-masked-reveal.js`.

## Decisions Made
- The reveal scaffold imports the full `appRouter` via `createCallerFactory` (mirroring economic-dependency-alert.test.ts) so the FORBIDDEN / tenant / staff-only paths exercise the real middleware stack and the failure is driven by the genuinely-missing procedures (`No procedure found on path "contractor,...`).
- Web-vite scaffolds reference the not-yet-existing component directly and stay path-scoped (never the unscoped suite) per the RAM constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `getIdpAuditLogger` to the reveal test's `@contractor-ops/logger` mock**
- **Found during:** Task 2 (contractor-reveal-ssn.test.ts)
- **Issue:** Importing the full `appRouter` pulls in `routers/integrations/deprovisioning.ts`, which calls `getIdpAuditLogger()` at module load; the mirrored logger mock omitted that export, so the suite failed on the mock gap instead of on the missing reveal procedure.
- **Fix:** Added a `getIdpAuditLogger` factory to the logger mock so the router graph resolves and the RED failure is correctly driven by the absent `contractor.revealSsn`/`updateUsProfile` procedures.
- **Files modified:** packages/api/src/routers/core/__tests__/contractor-reveal-ssn.test.ts
- **Verification:** Suite now reports `No procedure found on path "contractor,updateUsProfile"` / NOT_FOUND on revealSsn — RED for the intended reason.
- **Committed in:** `3b409c5a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Necessary so the scaffold is RED on the real missing target, not an incidental mock omission. No scope creep — only the test's own mock surface changed.

## Issues Encountered
- biome (lint-staged) reordered imports in the reveal scaffold on commit (`portal-root` before `root`) — cosmetic, intentional, no behavioural change.
- The shared working tree carries pre-existing `lint-staged automatic backup` stashes and uncommitted `.planning/campaigns/` GTM work from a parallel session; left untouched. All three task commits contain only this plan's own test files (verified — no campaign-file leakage).

## User Setup Required
None - Wave-0 adds only test files; no external service configuration. (Plan 02 will add the `SSN_ENCRYPTION_KEY` env var; Plan 04 the optional USPS creds.)

## Next Phase Readiness
- All six RED scaffolds exist and fail on a missing target import/component — the Nyquist continuity contract (no three consecutive tasks without an automated verify) is satisfied for Waves 1-4.
- Wave 1 (validators) and Wave 2 (ssn-crypto) can begin immediately; each turns its scaffold GREEN.
- No blockers.

## Self-Check: PASSED

- All 6 RED scaffold files exist on disk.
- All 3 task commits present in git log (`47899971`, `3b409c5a`, `d89ff725`).
- Each of the 6 files runs RED on its missing target import/component (verified per-file).
- No campaign-file leakage in any task commit.

---
*Phase: 84-theme-a-us-contractor-profile-fields-en-us-locale*
*Completed: 2026-06-08*
