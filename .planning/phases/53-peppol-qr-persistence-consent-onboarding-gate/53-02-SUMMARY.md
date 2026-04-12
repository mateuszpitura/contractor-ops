---
phase: 53-peppol-qr-persistence-consent-onboarding-gate
plan: 02
subsystem: ui
tags: [react, onboarding, consent, pdpl, uae, saudi]

requires:
  - phase: 51-pdpl-compliance
    provides: OnboardingConsentStep, hasRequiredConsents service, isPdplJurisdiction validator
provides:
  - Conditional consent step in onboarding checklist for PDPL jurisdictions
  - Server-side consent gating via hasRequiredConsents
affects: [onboarding, consent, pdpl]

tech-stack:
  added: []
  patterns: [jurisdiction-conditional onboarding steps with server-side validation gating]

key-files:
  created: []
  modified:
    - apps/web/src/components/onboarding/onboarding-checklist.tsx

key-decisions:
  - "Skip validation parameter in completeStep for OnboardingConsentStep.onComplete path (already server-validated via bulkGrant)"
  - "visibleSteps derived from ONBOARDING_STEPS filtered by isPdplJurisdiction — non-Gulf orgs never see consent step"

patterns-established:
  - "Jurisdiction-conditional onboarding: filter ONBOARDING_STEPS based on org countryCode"
  - "Dual gating: metadata tracks UX progress, server validates consent truth"

requirements-completed: [PDPL-03, PDPL-04]

duration: 3min
completed: 2026-04-12
---

# Plan 53-02: Consent Onboarding Gate Summary

**Wired OnboardingConsentStep into onboarding checklist with jurisdiction filtering and server-side hasRequiredConsents gating**

## Performance

- **Duration:** 3 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added isPdplJurisdiction filtering to hide privacy-consent step for non-Gulf orgs
- Rendered OnboardingConsentStep inline within onboarding checklist when consent step is current
- Added server-side hasRequiredConsents query to gate consent step completion
- Implemented dual gating: skipValidation for OnboardingConsentStep.onComplete path, hasConsents check for other code paths

## Task Commits

1. **Task 1: Wire conditional consent step rendering and server-side gating** - `88fbe9c` (feat)

## Files Created/Modified
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` - Added imports (isPdplJurisdiction, OnboardingConsentStep), jurisdiction filtering, hasRequiredConsents query, inline consent rendering, completeStep validation gating

## Decisions Made
- None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PDPL-03 and PDPL-04 requirements satisfied
- Consent onboarding gate fully operational for UAE/Saudi organizations

---
*Phase: 53-peppol-qr-persistence-consent-onboarding-gate*
*Completed: 2026-04-12*
