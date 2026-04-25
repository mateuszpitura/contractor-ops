---
plan: 64-06
phase: 64-legal-compliance-hardening
status: complete
commit: 000ce829
completed_at: 2026-04-26
---

# Plan 64-06: Advisory Banner + Expert Help Page + Escalation Event

## What Was Built

Replaced advisory-banner.tsx stub with full `ClassificationAdvisoryBanner` component: amber palette (bg-amber-50/border-amber-400/text-amber-900), `role="note"`, non-dismissible (no close button), jurisdiction-aware (GB→BANNER_IR35_ADVISORY_EN, DE/AT→BANNER_SCHEIN_ADVISORY_DE). Created advisory-banner.test.tsx with 6 tests. Created `classification/expert-help/page.tsx`: jurisdiction-aware adviser directory links (CIOT/HMRC for GB, Steuerberaterkammer/DRV for DE), optional org `expertReferralEmail` card with mailto link, `SOFTWARE_NOT_LEGAL_ADVICE` locked phrase disclaimer. Added `onAmberVerdictMounted` callback + `useRef` escalation guard to `VerdictBanner` — fires once per mount on amber/indeterminate tone. Created `escalation-event.test.tsx` with 4 tests. Added `Classification.AdvisoryBanner` and `Classification.ExpertHelp` i18n keys to en.json + de.json.

## Key Files Created

- `apps/web/src/app/[locale]/(dashboard)/classification/expert-help/page.tsx`
- `apps/web/src/components/classification/__tests__/advisory-banner.test.tsx`
- `apps/web/src/components/contractors/classification/outcome/__tests__/escalation-event.test.tsx`

## Key Files Modified

- `apps/web/src/components/classification/advisory-banner.tsx` — replaced stub
- `apps/web/src/components/contractors/classification/outcome/verdict-banner.tsx` — onAmberVerdictMounted
- `apps/web/messages/en.json` + `apps/web/messages/de.json` — Classification.AdvisoryBanner/ExpertHelp

## Self-Check: PASSED

- BANNER_IR35_ADVISORY_EN and BANNER_SCHEIN_ADVISORY_DE imported from validators ✓
- Banner has role="note" + amber palette + no close button ✓
- Expert-help page has bstbk.de + tax.org.uk links + expertReferralEmail card ✓
- All external links have rel="noopener noreferrer" ✓
- logEscalation fires once per amber/indeterminate verdict mount (ref guard) ✓
- i18n keys present in both en.json and de.json ✓
