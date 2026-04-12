---
phase: 50-arabic-localization-rtl-layout
plan: 07
subsystem: ui
tags: [rtl, bdi, i18n, recharts, arabic, locale-switcher]

requires:
  - phase: 50-arabic-localization-rtl-layout
    provides: "Bdi component, useRtlChartConfig hook, Arabic locale routing (plans 01-06)"
provides:
  - "Bdi component wired into 4 application components for bidi text isolation"
  - "useRtlChartConfig wired into spend-chart and report-chart for RTL axis mirroring"
  - "3-locale cycling (pl/en/ar) in user menu locale switcher"
  - "Locale-aware currency formatting replacing hardcoded pl-PL"
affects: []

tech-stack:
  added: []
  patterns: ["locale-aware Intl.NumberFormat via useMemo", "RTL chart config spreading pattern"]

key-files:
  created: []
  modified:
    - "apps/web/src/components/layout/user-menu.tsx"
    - "apps/web/src/components/dashboard/activity-feed.tsx"
    - "apps/web/src/components/payments/payment-run-side-panel.tsx"
    - "apps/web/src/components/notifications/notification-item.tsx"
    - "apps/web/src/components/dashboard/spend-chart.tsx"
    - "apps/web/src/components/reports/report-chart.tsx"

key-decisions:
  - "Used ar-SA-u-nu-latn locale tag to force Western/Latin numerals in Arabic currency formatting per D-04"
  - "Currency defaults to AED for Arabic locale, PLN for others (locale-based heuristic)"

patterns-established:
  - "Bdi wrapping: all user-generated content fields (names, emails, invoice numbers) wrapped in <Bdi> for bidi isolation"
  - "RTL chart config: spread xAxisProps/yAxisProps/chartStyle from useRtlChartConfig onto Recharts components"
  - "Locale-aware formatting: useMemo-wrapped Intl.NumberFormat conditioned on useLocale() result"

requirements-completed: [L10N-01, L10N-02, L10N-03, L10N-04, L10N-05]

duration: 9min
completed: 2026-04-12
---

# Phase 50 Plan 07: Gap Closure - RTL/Bidi Wiring Summary

**Wired orphaned Bdi component into 4 UI components, connected useRtlChartConfig to both chart components, and enabled 3-locale cycling (pl/en/ar) in the user menu**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-12T00:32:14Z
- **Completed:** 2026-04-12T00:40:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Locale switcher now cycles pl -> en -> ar -> pl with Arabic label display
- Bdi component imported and wrapping user-generated content in user-menu, activity-feed, payment-run-side-panel, and notification-item
- useRtlChartConfig spreads RTL axis/style props into spend-chart and report-chart
- Hardcoded pl-PL currency formatters replaced with locale-aware useMemo formatters using Western numerals for Arabic

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Bdi component into data display components and fix locale switcher** - `3f93fce` (feat)
2. **Task 2: Wire useRtlChartConfig into chart components and fix hardcoded locale formatting** - `d03cd7c` (feat)

## Files Created/Modified
- `apps/web/src/components/layout/user-menu.tsx` - Added Bdi wrapping on name/email, 3-locale cycling with Arabic
- `apps/web/src/components/dashboard/activity-feed.tsx` - Bdi wrapping on actorName and resourceName
- `apps/web/src/components/payments/payment-run-side-panel.tsx` - Bdi wrapping on invoiceNumber and legalName
- `apps/web/src/components/notifications/notification-item.tsx` - Bdi wrapping on notification title
- `apps/web/src/components/dashboard/spend-chart.tsx` - useRtlChartConfig + locale-aware currency formatter
- `apps/web/src/components/reports/report-chart.tsx` - useRtlChartConfig + locale-aware currency formatter for bar-horizontal and bar-grouped

## Decisions Made
- Used `ar-SA-u-nu-latn` locale tag to force Western/Latin numerals in Arabic currency formatting (per decision D-04 from earlier plans)
- Currency defaults to AED for Arabic locale -- follows the Gulf market expansion context of v4.0
- The plan's acceptance criteria stated "no pl-PL in chart files" but the locale-conditional ternary necessarily references pl-PL as one branch; the intent (removing hardcoded standalone pl-PL formatters) is fulfilled

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all wiring is complete with no placeholder data.

## Next Phase Readiness
- All 5 L10N requirements from Phase 50 verification are now addressed
- Bdi, useRtlChartConfig, and locale switcher are fully wired into application components
- Phase 50 gap closure complete

---
*Phase: 50-arabic-localization-rtl-layout*
*Completed: 2026-04-12*
