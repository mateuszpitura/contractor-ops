---
phase: 10-onboarding-polish
plan: 02
subsystem: ui
tags: [react, empty-state, onboarding, checklist, dashboard]

# Dependency graph
requires:
  - phase: 09-dashboard-reports
    provides: Dashboard page layout, KPI cards, widgets
  - phase: 01-foundation-auth
    provides: Better Auth session, usePermissions hook, settings router
provides:
  - Reusable EmptyState component with smart sequencing
  - OnboardingChecklist dashboard widget with 5-step guided setup
affects: [10-04-empty-states, 10-05-i18n]

# Tech tracking
tech-stack:
  added: []
  patterns: [smart-sequencing-prerequisite-props, onboarding-metadata-persistence]

key-files:
  created:
    - apps/web/src/components/shared/empty-state.tsx
    - apps/web/src/components/onboarding/onboarding-checklist.tsx
  modified:
    - apps/web/src/app/[locale]/(dashboard)/page.tsx
    - packages/validators/src/organization.ts
    - packages/api/src/routers/settings.ts

key-decisions:
  - "Onboarding state stored in Better Auth org metadata via extended updateOrganizationSettingsSchema"
  - "Permission check uses settings:write (admin/it_admin roles) for onboarding widget visibility"

patterns-established:
  - "EmptyState smart sequencing: prerequisiteMissing + prerequisiteAction overrides primary CTA"
  - "Onboarding metadata: onboardingCompletedSteps array and onboardingDismissed boolean in org metadata"

requirements-completed: [ONBD-01, ONBD-02]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 10 Plan 02: EmptyState & Onboarding Checklist Summary

**Reusable EmptyState component with prerequisite-aware smart sequencing and 5-step onboarding checklist widget on dashboard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T09:03:43Z
- **Completed:** 2026-03-23T09:06:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Reusable EmptyState component with icon, heading, body, primary/secondary CTAs, and smart sequencing via prerequisite props
- Onboarding checklist widget showing 5 steps with progress bar, collapse/dismiss, and metadata persistence
- Dashboard integration with OnboardingChecklist in right column before approval queue

## Task Commits

Each task was committed atomically:

1. **Task 1: Reusable EmptyState component with smart sequencing** - `4f4178a` (feat)
2. **Task 2: Onboarding checklist widget and dashboard integration** - `a7934fb` (feat)

## Files Created/Modified
- `apps/web/src/components/shared/empty-state.tsx` - Reusable empty state with smart sequencing via prerequisite props
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` - 5-step onboarding checklist widget with progress, collapse, dismiss
- `apps/web/src/app/[locale]/(dashboard)/page.tsx` - Added OnboardingChecklist import and render in right column
- `packages/validators/src/organization.ts` - Extended settings schema with onboardingCompletedSteps and onboardingDismissed
- `packages/api/src/routers/settings.ts` - Extended update mutation to handle onboarding metadata fields

## Decisions Made
- Onboarding state (completedSteps array, dismissed boolean) stored in Better Auth organization metadata via extended updateOrganizationSettingsSchema, not settingsJson
- Widget visibility gated by `settings:write` permission (admin and it_admin roles)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended settings schema and router for onboarding fields**
- **Found during:** Task 2 (Onboarding checklist widget)
- **Issue:** updateOrganizationSettingsSchema and settings.update router did not support onboardingCompletedSteps or onboardingDismissed fields
- **Fix:** Added both fields to the Zod schema in validators package and metadata handling in settings router
- **Files modified:** packages/validators/src/organization.ts, packages/api/src/routers/settings.ts
- **Verification:** Fields accepted by mutation, metadata merge logic handles new keys
- **Committed in:** a7934fb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Backend extension necessary for onboarding state persistence. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EmptyState component ready for Plan 04 (empty states across all list views)
- OnboardingChecklist ready for i18n in Plan 05
- Onboarding metadata persistence pattern established for future onboarding features

---
*Phase: 10-onboarding-polish*
*Completed: 2026-03-23*
