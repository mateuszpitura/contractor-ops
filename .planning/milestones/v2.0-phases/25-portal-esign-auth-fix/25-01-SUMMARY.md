---
phase: 25-portal-esign-auth-fix
plan: 01
subsystem: api, ui
tags: [trpc, portal-auth, esign, docusign, embedded-signing]

# Dependency graph
requires:
  - phase: 15-esign-integration
    provides: EmbeddedSigningModal, getSigningUrl endpoint, esign router
  - phase: 13-contractor-portal
    provides: portalProcedure middleware, portal session auth
provides:
  - getPortalSigningUrl portalProcedure endpoint with recipient verification
  - EmbeddedSigningModal usePortalAuth prop for portal/admin auth switching
affects: [portal, esign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portal auth switching via usePortalAuth prop on shared components"
    - "Case-insensitive email comparison for recipient verification"

key-files:
  created: []
  modified:
    - packages/api/src/routers/esign.ts
    - packages/api/src/routers/__tests__/esign.test.ts
    - apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx
    - apps/web/src/components/portal/portal-pending-signatures.tsx

key-decisions:
  - "Reuse existing getSigningUrl orchestrator from getPortalSigningUrl after authorization check"

patterns-established:
  - "Portal auth switching: shared components accept usePortalAuth prop to conditionally call portal vs admin tRPC procedures"

requirements-completed: [SIGN-02]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 25 Plan 01: Portal E-Sign Auth Fix Summary

**Portal signing URL endpoint via portalProcedure with recipient verification and conditional auth switching in EmbeddedSigningModal**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T15:44:04Z
- **Completed:** 2026-03-30T15:45:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added getPortalSigningUrl portalProcedure endpoint with envelope lookup, case-insensitive recipient email verification, and delegation to existing getSigningUrl orchestrator
- Wired EmbeddedSigningModal to conditionally use portal or admin tRPC procedure via usePortalAuth prop
- PortalPendingSignatures now passes usePortalAuth to signing modal, fixing UNAUTHORIZED errors for portal contractors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getPortalSigningUrl endpoint and test stubs** - `a5cf05f` (feat)
2. **Task 2: Wire EmbeddedSigningModal portal auth and pass from PortalPendingSignatures** - `6836c91` (feat)

## Files Created/Modified
- `packages/api/src/routers/esign.ts` - Added getPortalSigningUrl portalProcedure with recipient verification
- `packages/api/src/routers/__tests__/esign.test.ts` - Added two test stubs for portal signing URL
- `apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx` - Added usePortalAuth prop and conditional tRPC procedure switching
- `apps/web/src/components/portal/portal-pending-signatures.tsx` - Pass usePortalAuth to EmbeddedSigningModal

## Decisions Made
- Reuse existing getSigningUrl orchestrator from getPortalSigningUrl after authorization -- avoids code duplication, single signing URL generation path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Portal signing flow complete -- contractors can click Sign Now and get embedded signing modal via portal auth
- Admin signing flow unchanged (no regression)

---
*Phase: 25-portal-esign-auth-fix*
*Completed: 2026-03-30*

## Self-Check: PASSED
