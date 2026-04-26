---
phase: 50-arabic-localization-rtl-layout
plan: 01
subsystem: ui
tags: [next-intl, tailwind, rtl, css-logical-properties, arabic, i18n]

requires:
  - phase: 46-multi-currency-vat-engine
    provides: i18n routing with en/pl locales
provides:
  - Arabic locale registered in next-intl routing
  - RTL direction attribute on HTML element for Arabic
  - Noto Sans Arabic font loaded conditionally
  - Locale-aware request config (timezone, currency, numberingSystem)
  - All 18 shadcn/ui primitives using CSS logical properties
affects: [50-03, 50-04, 50-05, all-future-ui-components]

tech-stack:
  added: [noto-sans-arabic-font]
  patterns: [css-logical-properties, locale-aware-config-map]

key-files:
  created: []
  modified:
    - apps/web/src/i18n/routing.ts
    - apps/web/src/i18n/request.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/components/ui/sidebar.tsx
    - apps/web/src/components/ui/dropdown-menu.tsx
    - apps/web/src/components/ui/sheet.tsx
    - apps/web/src/components/ui/dialog.tsx
    - apps/web/src/components/ui/select.tsx
    - apps/web/src/components/ui/input-group.tsx
    - apps/web/src/components/ui/command.tsx
    - apps/web/src/components/ui/alert-dialog.tsx
    - apps/web/src/components/ui/button.tsx
    - apps/web/src/components/ui/table.tsx
    - apps/web/src/components/ui/tabs.tsx
    - apps/web/src/components/ui/tooltip.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/components/ui/calendar.tsx
    - apps/web/src/components/ui/progress.tsx
    - apps/web/src/components/ui/avatar.tsx

key-decisions:
  - "Centering patterns (left-1/2 + -translate-x-1/2) preserved as-is — these are axis-based transforms not affected by reading direction"
  - "data-[side=left/right] attribute selectors kept — they reference prop values, not layout direction; the CSS properties they apply (start/end) are now logical"
  - "Toaster position flipped to bottom-left in RTL for correct visual placement"

patterns-established:
  - "CSS logical properties: always use ps/pe/ms/me/start/end instead of pl/pr/ml/mr/left/right in Tailwind classes"
  - "Locale config map: per-locale settings (timezone, currency, numberingSystem) in request.ts"
  - "RTL detection: locale === 'ar' check in layout.tsx for dir attribute"

requirements-completed: [L10N-02]

duration: 12min
completed: 2026-04-11
---

# Phase 50-01: RTL Infrastructure & UI Primitive Conversion Summary

**Arabic locale with RTL direction, Noto Sans Arabic font, Western numerals, and all 18 shadcn/ui primitives converted to CSS logical properties**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-11T12:23:28Z
- **Completed:** 2026-04-11T12:35:00Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Arabic locale ("ar") registered in next-intl routing with locale-aware timezone (Asia/Dubai), currency (AED), and Western numerals (numberingSystem: latn)
- HTML element gets dir="rtl" and Noto Sans Arabic font when locale is Arabic
- All 18 shadcn/ui primitive components converted from physical CSS properties to logical equivalents — zero remaining pl/pr/ml/mr/text-left/text-right in UI primitives

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Arabic locale to next-intl and configure RTL layout** - `d259923` (feat)
2. **Task 2: Convert all shadcn/ui primitive components to CSS logical properties** - `8e94199` (feat)

## Files Created/Modified
- `apps/web/src/i18n/routing.ts` - Added "ar" to locales array
- `apps/web/src/i18n/request.ts` - Locale-aware config map with per-locale timezone/currency/numberingSystem
- `apps/web/src/app/[locale]/layout.tsx` - dir="rtl", lang attribute, Noto Sans Arabic font
- `apps/web/src/components/ui/*.tsx` (16 files) - Physical to logical CSS property conversion

## Decisions Made
- Centering patterns (left-1/2 + -translate-x-1/2) preserved — axis transforms unaffected by reading direction
- data-[side=left/right] attribute selectors kept as-is since they reference component prop values
- Toaster position flipped to bottom-left in RTL mode

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RTL infrastructure complete — Wave 2 plans (50-03, 50-04, 50-05) can now build on logical properties foundation
- Arabic translation file (50-02) can load via the configured request handler

---
*Phase: 50-arabic-localization-rtl-layout*
*Completed: 2026-04-11*
