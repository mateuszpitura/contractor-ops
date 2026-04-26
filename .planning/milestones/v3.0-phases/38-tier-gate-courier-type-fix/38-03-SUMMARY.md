---
phase: 38-tier-gate-courier-type-fix
plan: 03
subsystem: ui
tags: [react, feature-gate, tier-gating, upgrade-banner]

requires:
  - phase: 35-feature-gating-dpd-ups-billing
    provides: FeatureGate component and UpgradeInlineBanner
provides:
  - FeatureGate wrapping on Teams channel mapping, GWS directory import, and onboarding import wizard
affects: [billing, integrations, onboarding]

tech-stack:
  added: []
  patterns: [FeatureGate component-level wrapping for defense-in-depth tier gating]

key-files:
  created: []
  modified:
    - apps/web/src/components/integrations/teams-channel-mapping-card.tsx
    - apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx
    - apps/web/src/components/onboarding/import-wizard.tsx

key-decisions:
  - "Wrap at component return level (not route level) to keep navigation visible while replacing content with upgrade banner"

patterns-established:
  - "FeatureGate wraps entire component return JSX for dedicated feature components"

requirements-completed: [BILL-09]

duration: 1min
completed: 2026-04-05
---

# Phase 38 Plan 03: UI Feature Gates Summary

**FeatureGate wrapping on 3 PRO-only components (Teams mapping, GWS import, onboarding wizard) for defense-in-depth tier gating**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-05T20:58:42Z
- **Completed:** 2026-04-05T20:59:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Teams channel mapping card wrapped with FeatureGate requiredTier="Pro"
- Google Workspace directory import wizard wrapped with FeatureGate requiredTier="Pro"
- Onboarding import wizard wrapped with FeatureGate requiredTier="Pro"
- STARTER-tier users now see UpgradeInlineBanner instead of PRO-only UI in all 3 components

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap Teams channel mapping card with FeatureGate** - `c9e3c7b` (feat)
2. **Task 2: Wrap GWS directory import and onboarding import with FeatureGate** - `ce81173` (feat)

## Files Created/Modified
- `apps/web/src/components/integrations/teams-channel-mapping-card.tsx` - Added FeatureGate wrapping around Card
- `apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx` - Added FeatureGate wrapping around Dialog
- `apps/web/src/components/onboarding/import-wizard.tsx` - Added FeatureGate wrapping around wizard container

## Decisions Made
- Wrapped at component return level (entire JSX tree) rather than route level, keeping navigation/breadcrumbs visible while replacing feature content with upgrade banner for insufficient tiers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 UI gates in place complementing API-level requireTier middleware
- Defense-in-depth tier gating complete for Teams, GWS, and onboarding features

---
*Phase: 38-tier-gate-courier-type-fix*
*Completed: 2026-04-05*
