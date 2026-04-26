---
phase: 68-skonto-bg20-xrechnung-fix
plan: 01
subsystem: einvoice
tags: [typescript, einvoice, profile-interface, type-widening]

requires:
  - phase: 61-xrechnung-e-invoicing
    provides: EInvoiceProfile interface + per-profile classes (XRechnungDEProfile, ZugferdDEProfile, KSeF, ZATCA, Peppol-AE)
provides:
  - Widened EInvoiceProfile.generate signature accepting optional opts: unknown
  - Per-profile narrowing of generate options without forcing every profile to acknowledge Skonto
affects: [68-02, 68-04]

tech-stack:
  added: []
  patterns:
    - Profile-interface options widening to unknown with per-profile narrowed signatures

key-files:
  created: []
  modified:
    - packages/einvoice/src/types/profile.ts

key-decisions:
  - "D-07: Widen shared interface to opts?: unknown; each profile narrows at impl signature"

patterns-established:
  - "Profile contract widening via unknown enables per-profile opts narrowing without cross-profile leakage"

requirements-completed:
  - EINV-01
  - EINV-02

duration: 1 min
completed: 2026-04-26
---

# Phase 68 Plan 01: Widen EInvoiceProfile.generate Signature Summary

**Type-only contract widening of `EInvoiceProfile.generate(invoice)` to `generate(invoice, opts?: unknown)`, unblocking Plans 02 and 04 to add per-profile narrowed Skonto options without polluting jurisdiction-neutral profiles (KSeF / ZATCA / Peppol-AE).**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-26T13:00:00Z
- **Completed:** 2026-04-26T13:01:03Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Widened `EInvoiceProfile.generate` from `(invoice) => Promise<string>` to `(invoice, opts?: unknown) => Promise<string>`
- Documented intentional `unknown` typing with reference to D-07 and downstream consumer pattern
- Verified zero new TypeScript errors introduced (baseline `tsc --noEmit` errors in `api` package are pre-existing and unrelated)
- Verified no runtime regressions: all 497 einvoice tests pass

## Task Commits

1. **Task 1 + Task 2 (atomic): Widen signature + commit** - `f0876a2a` (fix)

## Files Created/Modified
- `packages/einvoice/src/types/profile.ts` - Added widened signature with multi-line JSDoc explaining D-07 rationale

## Decisions Made
- Followed D-07 verbatim (plain `unknown`, no type parameter — minimal blast radius).
- Did NOT modify any of the 5 profile-class files; structural assignability of 1-arg signatures to 2-arg interface confirmed via `tsc --noEmit` (clean in einvoice).

## Deviations from Plan

**1. [Rule 1 - Bug / Pre-existing scope-out] api package has pre-existing tsc errors unrelated to this plan**
- **Found during:** Task 2 acceptance criteria (`cd packages/api && npx tsc --noEmit` exits 0)
- **Issue:** Plan acceptance criterion required `tsc --noEmit` exits 0 in `packages/api`. Baseline check (with edit stashed) showed identical errors in `late-payment-interest.ts:321,504`, `onboarding-import.ts:5,246`, and `auth/src/roles.ts:42,53,66,133`. None reference `EInvoiceProfile`, `generate`, `XRechnung`, or `ZugferdDE` — they pertain to the auth permission DSL and the late-payment/onboarding routers.
- **Fix:** No code change. Per scope-boundary rule (do not auto-fix pre-existing issues unrelated to current task). Plan 68-01's widening introduces ZERO new TS errors.
- **Files modified:** None
- **Verification:** Stashed edit, ran tsc baseline (errors present), restored edit, ran tsc again (identical errors). Diff is empty.
- **Committed in:** N/A — documented only

---

**Total deviations:** 1 documented (pre-existing baseline noise, scope-out per Rule 1)
**Impact on plan:** None — the contract widening itself is structurally clean and unblocks Plans 02 and 04 as intended. The api-package baseline noise is a separate hardening backlog item.

## Issues Encountered
None — plan executed exactly as written for the widening itself.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Profile interface widening complete; Plans 68-02 and 68-04 unblocked.
- Ready to proceed with Wave 1's parallel plan 68-02 (XRechnung Skonto wiring + Layer A test).

---
*Phase: 68-skonto-bg20-xrechnung-fix*
*Completed: 2026-04-26*
