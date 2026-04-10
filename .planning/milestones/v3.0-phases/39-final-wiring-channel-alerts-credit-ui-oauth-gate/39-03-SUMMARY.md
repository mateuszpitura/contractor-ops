---
phase: 39-final-wiring-channel-alerts-credit-ui-oauth-gate
plan: 03
subsystem: ui
tags: [react, feature-gate, billing, oauth, vitest]

# Dependency graph
requires:
  - phase: 35-feature-gating-dpd-ups-billing-polish
    provides: FeatureGate component and UpgradeInlineBanner
provides:
  - FeatureGate wrapping on Linear, Google Workspace, and Teams provider sections
  - Vitest component test infrastructure for web app
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FeatureGate wraps at component return level for dedicated OAuth provider sections"
    - "Vitest + jsdom + @testing-library/react for web app component tests"

key-files:
  created:
    - apps/web/vitest.config.ts
    - apps/web/src/test/setup.ts
    - apps/web/src/components/integrations/__tests__/linear-provider-section.test.tsx
    - apps/web/src/components/integrations/__tests__/google-workspace-provider-section.test.tsx
    - apps/web/src/components/integrations/__tests__/teams-provider-section.test.tsx
  modified:
    - apps/web/src/components/integrations/linear-provider-section.tsx
    - apps/web/src/components/integrations/google-workspace-provider-section.tsx
    - apps/web/src/components/integrations/teams-provider-section.tsx

key-decisions:
  - "Vitest config for web app uses @vitejs/plugin-react for JSX transform with jsdom environment"

patterns-established:
  - "FeatureGate wrapping pattern: import FeatureGate, wrap entire component return JSX with requiredTier='Pro' and descriptive featureName"

requirements-completed: [BILL-09]

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 39 Plan 03: OAuth Provider FeatureGate Summary

**FeatureGate wrapping on Linear, Google Workspace, and Teams OAuth sections — STARTER users see upgrade prompt instead of connect buttons**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T22:34:39Z
- **Completed:** 2026-04-05T22:43:11Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- All three OAuth provider sections (Linear, Google Workspace, Teams) wrapped with FeatureGate requiring Pro tier
- STARTER-tier users now see UpgradeInlineBanner with upgrade CTA instead of OAuth connect buttons
- PRO/ENTERPRISE users see normal provider section with connect functionality
- Added vitest component test infrastructure (vitest.config.ts, test setup, 6 test cases)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap provider sections with FeatureGate** - `163501e` (feat)
2. **Task 2: Add FeatureGate wrapping tests** - `2a0af89` (test)

## Files Created/Modified
- `apps/web/src/components/integrations/linear-provider-section.tsx` - Added FeatureGate wrapping with featureName="Linear integration"
- `apps/web/src/components/integrations/google-workspace-provider-section.tsx` - Added FeatureGate wrapping with featureName="Google Workspace integration"
- `apps/web/src/components/integrations/teams-provider-section.tsx` - Added FeatureGate wrapping with featureName="Microsoft Teams integration"
- `apps/web/vitest.config.ts` - Vitest configuration for web app component tests
- `apps/web/src/test/setup.ts` - Test setup with jest-dom matchers and ScrollArea mock
- `apps/web/src/components/integrations/__tests__/linear-provider-section.test.tsx` - STARTER/PRO tier tests
- `apps/web/src/components/integrations/__tests__/google-workspace-provider-section.test.tsx` - STARTER/PRO tier tests
- `apps/web/src/components/integrations/__tests__/teams-provider-section.test.tsx` - STARTER/PRO tier tests

## Decisions Made
- Vitest config for web app uses @vitejs/plugin-react for JSX transform, jsdom environment, with pool forks for isolation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created vitest config and test setup for web app**
- **Found during:** Task 2
- **Issue:** Web app had no vitest.config.ts or test setup file, preventing component test execution
- **Fix:** Created vitest.config.ts with @vitejs/plugin-react and jsdom environment, created src/test/setup.ts with jest-dom/vitest matchers and ScrollArea mock
- **Files modified:** apps/web/vitest.config.ts, apps/web/src/test/setup.ts
- **Verification:** All 6 tests pass
- **Committed in:** 2a0af89

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary test infrastructure for component testing. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three OAuth provider sections are gated behind Pro tier
- Closes MISSING-06 from v3.0 audit
- Component test infrastructure ready for future web app tests

---
*Phase: 39-final-wiring-channel-alerts-credit-ui-oauth-gate*
*Completed: 2026-04-06*

## Self-Check: PASSED

- All 8 files FOUND
- Commit 163501e FOUND
- Commit 2a0af89 FOUND
- All 6 tests pass (verified in main repo)
