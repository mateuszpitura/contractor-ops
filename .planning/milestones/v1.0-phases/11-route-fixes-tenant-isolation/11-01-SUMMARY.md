---
phase: 11-route-fixes-tenant-isolation
plan: 01
subsystem: ui
tags: [navigation, onboarding, command-palette, nuqs, searchParams]

requires:
  - phase: 10-onboarding-polish
    provides: "Onboarding checklist, command palette, empty states"
provides:
  - "Corrected sidebar navigation hrefs (dashboard -> /, integrations -> /settings?tab=integrations)"
  - "Fixed onboarding checklist CTA hrefs (4 broken links)"
  - "?action= searchParam wiring on 4 list pages for Cmd+K quick actions"
affects: []

tech-stack:
  added: []
  patterns:
    - "useQueryState + useEffect for URL-driven dialog triggers"

key-files:
  created: []
  modified:
    - apps/web/src/lib/navigation.ts
    - apps/web/src/components/onboarding/onboarding-checklist.tsx
    - apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx

key-decisions:
  - "None - followed plan as specified"

patterns-established:
  - "URL action param pattern: useQueryState('action') + useEffect to auto-open dialogs then clear param"

requirements-completed: [DASH-01, SLCK-03, ONBD-01, SRCH-02]

duration: 2min
completed: 2026-03-23
---

# Phase 11 Plan 01: Route Fixes Summary

**Fixed sidebar navigation hrefs, onboarding CTA links, and wired Cmd+K quick actions to open dialogs via ?action= URL params on 4 list pages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T10:16:00Z
- **Completed:** 2026-03-23T10:18:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Dashboard sidebar link corrected from /dashboard to / (the actual root route)
- Integrations sidebar link corrected from /integrations to /settings?tab=integrations
- All 4 broken onboarding checklist CTA hrefs fixed to use correct tab params and action params
- All 4 list pages (contractors, contracts, invoices, workflows) now read ?action= URL param and auto-open the corresponding wizard/dialog/upload area

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix sidebar navigation hrefs and onboarding checklist CTAs** - `251af8a` (fix)
2. **Task 2: Wire ?action= searchParam to wizard/dialog triggers on 4 list pages** - `44f7a7f` (feat)

## Files Created/Modified
- `apps/web/src/lib/navigation.ts` - Corrected dashboard and integrations hrefs
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` - Fixed 4 CTA hrefs
- `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` - Added ?action=new -> wizard open
- `apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx` - Added ?action=new -> contract wizard open, rendered ContractWizardDialog
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` - Added ?action=upload -> upload area open
- `apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx` - Added ?action=start -> template picker open

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All navigation links and quick actions now reach valid pages and trigger correct UI dialogs
- Ready for Plan 02 (tenant isolation) execution

## Self-Check: PASSED

All 6 modified files verified present. Both task commits (251af8a, 44f7a7f) verified in git log.

---
*Phase: 11-route-fixes-tenant-isolation*
*Completed: 2026-03-23*
