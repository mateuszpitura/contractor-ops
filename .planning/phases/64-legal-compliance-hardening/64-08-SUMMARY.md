---
plan: 64-08
phase: 64-legal-compliance-hardening
status: complete
commit: 817c3eeb
completed_at: 2026-04-26
---

# Plan 64-08: ToS Page Extension + Non-Dismissible Modal + Dashboard Layout Wiring

## What Was Built

Extended `terms/page.tsx` to async RSC with `getLocale()`, adds `softwareNotLegalAdvice` blockquote section using `SOFTWARE_NOT_LEGAL_ADVICE_EN/DE` locked phrase. Created `TosReacceptanceModal` client component: non-dismissible (ESC disabled via `onEscapeKeyDown={e => e.preventDefault()}`, click-outside disabled, `showCloseButton={false}`), scrollable locked phrase preview, calls `trpc.consent.recordToS` with `TOS_CURRENT_VERSION` on "I accept". Wired `TosReacceptanceModal` into dashboard layout: `consentEvent.findFirst` query checks for current ToS version acceptance, renders modal when missing/stale. Added `Legal.terms.sections.softwareNotLegalAdvice` + `Legal.TermsModal` i18n keys to en.json + de.json.

## Key Files Created

- `apps/web/src/components/tos-reacceptance-modal.tsx`

## Key Files Modified

- `apps/web/src/app/[locale]/(legal)/terms/page.tsx` — softwareNotLegalAdvice section
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx` — ToS consent check + modal rendering
- `apps/web/messages/en.json` + `apps/web/messages/de.json` — Legal.TermsModal/terms.sections

## Manual-Only Verifications

- Legal sign-off for ToS content is DEFERRED per Standing Project Constraints
- Post-deploy: bump `TOS_CURRENT_VERSION` in `tos.ts` to trigger re-acceptance on next login

## Self-Check: PASSED

- SOFTWARE_NOT_LEGAL_ADVICE blockquote section in terms page ✓
- TosReacceptanceModal: ESC disabled, click-outside disabled, no close button ✓
- recordToS mutation called with TOS_CURRENT_VERSION ✓
- Dashboard layout checks consentEvent.findFirst with current version ✓
- TosReacceptanceModal renders only when needsTosAcceptance is true ✓
- i18n keys present in both en.json and de.json ✓
