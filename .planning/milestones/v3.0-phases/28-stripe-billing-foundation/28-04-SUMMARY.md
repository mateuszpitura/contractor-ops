---
phase: 28-stripe-billing-foundation
plan: 04
subsystem: api, ui
tags: [trpc, billing, ocr-credits, tanstack-query]

requires:
  - phase: 28-stripe-billing-foundation (plan 01)
    provides: credit-service.ts with getCreditBalance function
  - phase: 28-stripe-billing-foundation (plan 02)
    provides: OCR credit metering and ledger entries
  - phase: 28-stripe-billing-foundation (plan 03)
    provides: CreditUsageCard component and billing tab UI

provides:
  - getCreditBalance tRPC procedure in billing router
  - Real credit usage display in CreditUsageCard from OCR ledger

affects: []

tech-stack:
  added: []
  patterns:
    - "Backend-as-source-of-truth for credit calculations (no frontend duplication)"

key-files:
  created: []
  modified:
    - packages/api/src/routers/billing.ts
    - apps/web/src/components/billing/credit-usage-card.tsx

key-decisions:
  - "tenantProcedure (not adminProcedure) for getCreditBalance -- any org member can view credit usage"

patterns-established:
  - "Credit balance sourced exclusively from backend ledger aggregation, no client-side tier mapping"

requirements-completed: [BILL-05]

duration: 2min
completed: 2026-04-01
---

# Phase 28 Plan 04: Credit Usage Visibility Summary

**Wire getCreditBalance through tRPC so CreditUsageCard displays real OCR credit consumption from the ledger**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T21:32:45Z
- **Completed:** 2026-04-01T21:34:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Exposed existing `getCreditBalance` from credit-service as a tRPC tenantProcedure query
- Replaced hardcoded `used = 0` placeholder in CreditUsageCard with real tRPC query
- Removed duplicated TIER_ALLOWANCES map from frontend (backend is single source of truth)
- Progress bar and remaining credits now reflect actual OCR ledger data

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getCreditBalance procedure to billing tRPC router** - `b98da10` (feat)
2. **Task 2: Replace hardcoded used=0 with real tRPC query in CreditUsageCard** - `b9b6cfc` (feat)

## Files Created/Modified
- `packages/api/src/routers/billing.ts` - Added getCreditBalance import and tenantProcedure query
- `apps/web/src/components/billing/credit-usage-card.tsx` - Replaced hardcoded values with tRPC credit balance query

## Decisions Made
- Used `tenantProcedure` (not `adminProcedure`) for getCreditBalance so any authenticated org member can see credit usage, consistent with getSubscription and getPlanConfig access level

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `timesheet-header.tsx` (unrelated `asChild` prop issue) and pre-existing `trpc.billing` type resolution issue across all billing components. Both are out of scope -- not caused by this plan's changes. All billing components use the same `trpc.billing.*` pattern successfully at runtime. The API package compiles cleanly with `tsc --noEmit`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- BILL-05 gap from 28-VERIFICATION.md is fully closed
- Phase 28 (stripe-billing-foundation) is complete -- all 4 plans executed
- Ready for Phase 29+ execution

## Self-Check: PASSED

- All files exist on disk
- All commit hashes verified in git log
- No stubs detected

---
*Phase: 28-stripe-billing-foundation*
*Completed: 2026-04-01*
