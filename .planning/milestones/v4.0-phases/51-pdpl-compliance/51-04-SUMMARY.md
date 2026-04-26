---
phase: 51-pdpl-compliance
plan: 04
subsystem: ui
tags: react, consent, onboarding, settings, privacy, next-intl

requires:
  - phase: 51
    provides: consent router, privacy notice API, consent CRUD API, legal document download APIs
provides:
  - ConsentPurposeToggle component (reusable consent toggle with required/optional badges)
  - PrivacyNoticeDisplay component (collapsible jurisdiction-specific privacy notice)
  - OnboardingConsentStep component (blocking consent step for PDPL jurisdictions)
  - ConsentManagementSection component (full consent management for settings page)
  - Privacy tab in settings page
  - Privacy-consent step in onboarding checklist
affects: []

tech-stack:
  added: []
  patterns: [jurisdiction-conditional rendering, PDPL jurisdiction detection in frontend]

key-files:
  created:
    - apps/web/src/components/consent/consent-purpose-toggle.tsx
    - apps/web/src/components/consent/privacy-notice-display.tsx
    - apps/web/src/components/consent/onboarding-consent-step.tsx
    - apps/web/src/components/consent/consent-management-section.tsx
  modified:
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/src/components/onboarding/onboarding-checklist.tsx

key-decisions:
  - "OnboardingConsentStep returns null for non-PDPL jurisdictions (skip entirely)"
  - "Required consent switches cannot be toggled off (disabled in off state)"
  - "Consent history shown as table with badge indicators for granted/revoked"
  - "Legal documents downloaded as HTML files using Blob + URL.createObjectURL"

patterns-established:
  - "Jurisdiction-conditional UI: isPdplJurisdiction() guards rendering"
  - "Consent toggle with required/optional Badge distinction"

requirements-completed: [PDPL-01, PDPL-02, PDPL-03, PDPL-04]

duration: 12min
completed: 2026-04-11
---

# Phase 51 Plan 04: Frontend — Onboarding Consent Step & Settings Privacy Tab

**Built consent UI components for onboarding flow and settings page, providing PDPL-compliant privacy controls for UAE and Saudi organizations.**

## What was built

1. **ConsentPurposeToggle**: Reusable switch component with Shield icon, required/optional Badge, purpose label/description from i18n, and accessible aria attributes.

2. **PrivacyNoticeDisplay**: Card with jurisdiction badge (UAE PDPL / Saudi PDPL), legal reference, controller info, and collapsible notice sections.

3. **OnboardingConsentStep**: Blocking consent step that skips non-PDPL jurisdictions. Shows privacy notice, required purpose toggles (must accept all 3), optional toggles, and "Accept & Continue" button that calls bulkGrant mutation.

4. **ConsentManagementSection**: Full settings tab with privacy notice display, consent toggles with live grant/revoke mutations, consent history table, DPA/SCC download buttons, and cross-border transfer status card.

5. **Settings integration**: Privacy tab added to settings page with TabsTrigger and TabsContent.

6. **Onboarding integration**: Privacy-consent step added to ONBOARDING_STEPS array after org-details, with Shield icon and link to settings?tab=privacy.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
