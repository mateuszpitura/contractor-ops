---
phase: 34-intelligent-onboarding-wizard
plan: 02
subsystem: ui
tags: [react, next.js, tRPC, wizard, onboarding, import, i18n, conflict-resolution, progress-tracker]

# Dependency graph
requires:
  - phase: 34-intelligent-onboarding-wizard
    provides: onboardingImportRouter with 6 tRPC endpoints (Plan 01)
  - phase: 31-google-workspace
    provides: DirectoryImportWizard pattern, brand icons, Google Workspace logo
  - phase: 29-linear-integration
    provides: LinearBrandIcon for source cards
provides:
  - 4-step full-page wizard at /onboarding/import
  - 9 new UI components for onboarding import flow
  - Modified onboarding checklist routing to wizard
  - Settings > Integrations re-import link
  - OnboardingImport i18n namespace (en + pl)
affects: [onboarding-checklist, settings-integrations]

# Tech tracking
tech-stack:
  added: []
  patterns: [4-step wizard with step indicator and progress bar, conflict resolution via popover with radio selection, async import progress with refetchInterval polling and per-item retry, project step editing with add/remove/reorder]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/onboarding/import/page.tsx
    - apps/web/src/components/onboarding/import-wizard.tsx
    - apps/web/src/components/onboarding/source-selection-step.tsx
    - apps/web/src/components/onboarding/source-card.tsx
    - apps/web/src/components/onboarding/people-review-step.tsx
    - apps/web/src/components/onboarding/conflict-resolution-popover.tsx
    - apps/web/src/components/onboarding/project-import-step.tsx
    - apps/web/src/components/onboarding/confirm-import-step.tsx
    - apps/web/src/components/onboarding/import-progress-tracker.tsx
  modified:
    - apps/web/src/components/onboarding/onboarding-checklist.tsx
    - apps/web/src/components/settings/integrations-tab.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
    - packages/api/src/routers/onboarding-import.ts

key-decisions:
  - "Reused brand icons from integrations package (JiraBrandIcon, LinearBrandIcon, SlackBrandIcon, GoogleWorkspaceLogo) instead of importing raw SiXxx icons"
  - "Used PersonSelection/ProjectSelection types lifted to import-wizard.tsx for state management across steps"
  - "base-ui Select onValueChange typed as unknown -- cast to string for role assignment handlers"

patterns-established:
  - "Multi-step wizard pattern: useState<1|2|3|4> with step indicator, progress bar, and sticky footer nav"
  - "Conflict resolution: Popover with radio selection per field, custom value option, resolution tracking in parent state"
  - "Async import progress: refetchInterval with conditional stop, per-item retry via separate mutation"

requirements-completed: [ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05]

# Metrics
duration: 11min
completed: 2026-04-05
---

# Phase 34 Plan 02: Onboarding Import Wizard UI Summary

**4-step full-page wizard with source selection, merged people review with conflict resolution, project import with editable steps, and async progress tracker with per-item retry**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-04T23:32:56Z
- **Completed:** 2026-04-04T23:44:34Z
- **Tasks:** 2 completed + 1 checkpoint (awaiting human verification)
- **Files modified:** 14

## Accomplishments
- Full-page wizard at /onboarding/import with 4 interactive steps and step indicator with progress bar
- Source selection with 4 provider cards (Jira, Linear, GWS, Slack), OAuth popup for unconnected tools, toggle switches for connected tools
- People review with merged preview table, source badges, status badges (New/Conflict/Exists), role dropdown, batch toolbar (Import/Skip/Assign Role), filter tabs, and conflict resolution popover
- Project import with editable workflow steps (add/remove/rename/reorder) per project card, skip option, and sync note
- Async import progress tracker with refetchInterval polling, per-item status display, retry for failed items, and completion state with Go to Dashboard CTA
- Onboarding checklist step 2 now routes to /onboarding/import instead of /settings?tab=members
- Settings > Integrations page has "Re-import from tools" button linking to wizard
- Full i18n in English and Polish (OnboardingImport namespace)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wizard page route + all 4 step components + shared components** - `5f2b15c` (feat)
2. **Task 2: Onboarding checklist modification + Settings entry point + i18n** - `59abc45` (feat)
3. **Task 3: Visual verification** - awaiting human verification (checkpoint)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/onboarding/import/page.tsx` - Server component page route rendering ImportWizard
- `apps/web/src/components/onboarding/import-wizard.tsx` - 4-step wizard container with step indicator, progress bar, state management, sticky footer nav
- `apps/web/src/components/onboarding/source-selection-step.tsx` - Step 1: source cards grid with OAuth popup and skip link
- `apps/web/src/components/onboarding/source-card.tsx` - Provider card with toggle switch, connect button, ARIA checkbox role
- `apps/web/src/components/onboarding/people-review-step.tsx` - Step 2: merged preview table with filters, batch actions, conflict resolution
- `apps/web/src/components/onboarding/conflict-resolution-popover.tsx` - Popover with per-field radio selection and custom value option
- `apps/web/src/components/onboarding/project-import-step.tsx` - Step 3: project cards with editable steps (add/remove/rename/reorder)
- `apps/web/src/components/onboarding/confirm-import-step.tsx` - Step 4: summary cards + start import CTA
- `apps/web/src/components/onboarding/import-progress-tracker.tsx` - Async progress with refetchInterval, per-item retry, completion state
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` - Changed step 2 ctaHref to /onboarding/import
- `apps/web/src/components/settings/integrations-tab.tsx` - Added re-import link button (D-03)
- `apps/web/messages/en.json` - OnboardingImport i18n namespace (English)
- `apps/web/messages/pl.json` - OnboardingImport i18n namespace (Polish)
- `packages/api/src/routers/onboarding-import.ts` - Fixed build errors (InputJsonValue cast, role type, nullable user, exported ImportJob)

## Decisions Made
- Reused existing brand icons from integrations package rather than importing raw react-icons -- consistent with codebase patterns
- State management with Map<email, PersonSelection> and Map<key, ProjectSelection> for O(1) lookups in table rendering
- base-ui Select onValueChange receives nullable/unknown value -- explicit cast to string following existing codebase pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed API package build errors from Plan 01**
- **Found during:** Task 1
- **Issue:** API package failed to build due to 3 TypeScript errors: InputJsonValue cast too narrow, role string not assignable to union, ctx.user possibly null, ImportJob not exported
- **Fix:** Added `as unknown` intermediary cast, typed role as explicit union, non-null assertion on ctx.user, exported ImportJob interface
- **Files modified:** packages/api/src/routers/onboarding-import.ts
- **Committed in:** 5f2b15c

---

**Total deviations:** 1 auto-fixed (blocking -- API build needed for tRPC type inference)
**Impact on plan:** Required to unblock frontend TypeScript compilation. No scope creep.

## Issues Encountered
- API package dist types were stale from Plan 01 parallel execution -- had to rebuild after fixing build errors

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to tRPC endpoints from Plan 01.

## Checkpoint Status
**Task 3 (human-verify):** Awaiting human verification of complete wizard flow. Visual verification of all 4 steps, OAuth popup, conflict resolution, batch actions, progress tracking, and responsive layout.

## Next Phase Readiness
- Complete onboarding wizard UI ready for visual verification
- All 9 components created with full interactivity and accessibility
- i18n complete for English and Polish
- Wizard accessible from onboarding checklist and Settings > Integrations

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (5f2b15c, 59abc45) found in git log.

---
*Phase: 34-intelligent-onboarding-wizard*
*Completed: 2026-04-05*
