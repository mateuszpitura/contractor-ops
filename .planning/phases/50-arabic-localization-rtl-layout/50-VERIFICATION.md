---
phase: 50-arabic-localization-rtl-layout
verified: 2026-04-12T00:24:54Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "Mixed Arabic/English content renders correctly with proper bidi isolation"
    status: failed
    reason: "Bdi component was created (apps/web/src/components/ui/bdi.tsx) but is never imported or used in any application component. Zero occurrences of <Bdi> or <bdi> outside the component definition itself. Plan 03 was supposed to add Bdi wrapping to user-generated content fields (contractor names, invoice numbers, entity names in notifications/payments) but the summary only records CSS property conversions."
    artifacts:
      - path: "apps/web/src/components/ui/bdi.tsx"
        issue: "Component exists but is ORPHANED — never imported or used anywhere in the application"
      - path: "apps/web/src/components/layout/user-menu.tsx"
        issue: "No Bdi wrapping on user name or email displays"
      - path: "apps/web/src/components/payments/payment-run-side-panel.tsx"
        issue: "No Bdi wrapping on entity names in financial data display"
      - path: "apps/web/src/components/notifications/notification-item.tsx"
        issue: "No Bdi wrapping on entity references in notification messages"
    missing:
      - "Import and apply <Bdi> to user-generated content fields: contractor names, invoice numbers, entity references in notifications, payment run names, organization names"
      - "Specifically: user-menu.tsx (user name/email), payment-run-side-panel.tsx (entity names), notification-item.tsx (entity references), activity-feed.tsx (entity names)"

  - truth: "Charts and data visualizations render with mirrored axes and correct reading direction in RTL mode"
    status: failed
    reason: "useRtlChartConfig hook was created at apps/web/src/hooks/use-rtl-chart-config.ts with correct RTL logic (reversed X-axis, right-side Y-axis, RTL chart direction) but is never imported or used in any chart component. Both spend-chart.tsx and report-chart.tsx use hardcoded Recharts props with no locale awareness."
    artifacts:
      - path: "apps/web/src/hooks/use-rtl-chart-config.ts"
        issue: "Hook exists but is ORPHANED — never imported or used in any component"
      - path: "apps/web/src/components/dashboard/spend-chart.tsx"
        issue: "Uses hardcoded pl-PL Intl.NumberFormat and Recharts props with no RTL awareness. Does not import or use useRtlChartConfig."
      - path: "apps/web/src/components/reports/report-chart.tsx"
        issue: "No RTL awareness — hardcoded formatCurrency uses pl-PL locale, no useRtlChartConfig import"
    missing:
      - "Wire useRtlChartConfig into spend-chart.tsx: apply xAxisProps, yAxisProps, chartStyle to BarChart/AreaChart"
      - "Wire useRtlChartConfig into report-chart.tsx: apply to all chart types (bar-horizontal, bar-grouped, pie)"
      - "Fix hardcoded Intl.NumberFormat('pl-PL') in both chart files to use locale-aware formatting"

  - truth: "Users can select Arabic as their locale from the application UI"
    status: partial
    reason: "Arabic locale is supported in next-intl routing and accessible via direct URL (/ar/). However, the locale switcher in user-menu.tsx only cycles between 'pl' and 'en' — Arabic cannot be selected from the UI. The UAT test 1 passed because the /ar/ route is accessible by URL, but no UI affordance exists for switching to Arabic."
    artifacts:
      - path: "apps/web/src/components/layout/user-menu.tsx"
        issue: "handleLocaleSwitch only toggles between 'pl' and 'en' (line 111). Arabic locale ('ar') is never offered as a selection target. The button label only shows 'EN' or 'PL'."
    missing:
      - "Update handleLocaleSwitch to cycle through all 3 locales: pl -> en -> ar -> pl"
      - "Update button label to show current locale and next target (or use a 3-way selector)"

human_verification:
  - test: "Visual RTL chart rendering in Arabic locale"
    expected: "Under /ar locale, bar charts in the dashboard and reports pages should render with mirrored X-axis (reading right-to-left) and Y-axis on the right side. Currently the hook is unwired so charts will NOT mirror."
    why_human: "Visual rendering of Recharts components in RTL mode requires browser verification"
  - test: "Bidi text rendering with mixed Arabic/English content"
    expected: "Contractor names in English (e.g., 'John Smith') displayed within Arabic UI should render as isolated LTR segments. Without Bdi wrapping, embedded Latin text may display with garbled ordering in RTL context."
    why_human: "Unicode BiDi rendering edge cases require visual browser testing"
  - test: "Arabic locale switcher accessibility"
    expected: "A user on the dashboard should be able to switch to Arabic locale through the UI language control without typing a URL manually."
    why_human: "UI interaction flow requires human testing"
---

# Phase 50: Arabic Localization & RTL Layout Verification Report

**Phase Goal:** Arabic-speaking users can use the entire platform in Arabic with correct right-to-left layout, bidirectional text, and locale-appropriate formatting
**Verified:** 2026-04-12T00:24:54Z
**Status:** gaps_found
**Re-verification:** No — initial verification (plan 50-06 gap closure, no prior VERIFICATION.md)

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Users can select Arabic as their locale and all UI strings display in Arabic | PARTIAL | ar.json exists with 4261 lines/~45% coverage; `ar` in routing; but locale switcher only toggles pl<->en |
| 2  | Entire app renders in RTL mode when Arabic is selected — CSS logical properties | VERIFIED | Zero physical directional CSS in entire apps/web/src tree; `dir="rtl"` set in layout.tsx for `ar` locale |
| 3  | Mixed Arabic/English content renders with proper bidi isolation | FAILED | Bdi component is ORPHANED — never imported or used in any application component |
| 4  | Charts and data visualizations render with mirrored axes in RTL mode | FAILED | useRtlChartConfig hook is ORPHANED — never used in spend-chart.tsx or report-chart.tsx |
| 5  | Dates, numbers, and currency follow Arabic locale conventions | PARTIAL | i18n request.ts correctly configures AED/Asia/Dubai/latn for `ar`; but many components bypass this with hardcoded `pl-PL` formatters |

**Score:** 1 fully verified, 2 partial, 2 failed — 3/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/i18n/routing.ts` | `ar` locale in routing | VERIFIED | `locales: ["en", "pl", "ar"]` |
| `apps/web/src/i18n/request.ts` | Locale-aware config for `ar` | VERIFIED | AED, Asia/Dubai, latn for Arabic |
| `apps/web/src/app/[locale]/layout.tsx` | `dir="rtl"` for `ar`, Noto Sans Arabic | VERIFIED | Sets `dir`, `lang`, loads NotoSansArabic font |
| `apps/web/messages/ar.json` | Arabic translations | VERIFIED | 4261 lines, ~45% coverage, Gulf Arabic terminology |
| `apps/web/src/components/ui/bdi.tsx` | Bdi isolation component | ORPHANED | Component exists but is never imported or used |
| `apps/web/src/hooks/use-rtl-chart-config.ts` | RTL chart config hook | ORPHANED | Hook exists but is never imported or used |
| `apps/web/src/app/[locale]/(dashboard)/layout.tsx` | `start-4` in skip-to-content | VERIFIED | `start-4` confirmed (plan 06 fix applied) |
| `apps/web/src/app/[locale]/(portal)/layout.tsx` | `start-4` in skip-to-content | VERIFIED | `start-4` confirmed (plan 06 fix applied) |
| `apps/web/src/components/ui/alert.tsx` | Logical CSS properties | VERIFIED | `ps-7` and `start-4` confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routing.ts` 'ar' locale | `request.ts` messages | `import(\`../../messages/ar.json\`)` | WIRED | Dynamic import resolves ar.json |
| `request.ts` 'ar' config | `layout.tsx` dir=rtl | `locale === "ar"` condition | WIRED | Layout reads locale param and sets dir |
| `Bdi` component | entity name displays | `import { Bdi }` in components | NOT_WIRED | Zero imports of Bdi outside its definition |
| `useRtlChartConfig` hook | chart components | `import { useRtlChartConfig }` | NOT_WIRED | Zero imports of the hook in any component |
| Locale switcher | Arabic locale | `nextLocale === "ar"` | NOT_WIRED | Switcher only offers pl/en, never ar |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `spend-chart.tsx` | `currencyFormatter` | `new Intl.NumberFormat("pl-PL", ...)` hardcoded | No — always uses pl-PL regardless of locale | HOLLOW — formatting bypasses locale config |
| `report-chart.tsx` | `formatCurrency()` | `new Intl.NumberFormat("pl-PL", ...)` hardcoded | No — always uses pl-PL regardless of locale | HOLLOW — formatting bypasses locale config |
| `format-relative-date.ts` | date string | `date.toLocaleDateString("pl-PL")` hardcoded | No — always uses pl-PL | HOLLOW — used in payment-run-side-panel.tsx |
| `format-currency.ts` | amount string | `new Intl.NumberFormat("pl-PL", ...)` | No — always uses pl-PL | HOLLOW — used in wht-certificate-preview-dialog.tsx |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Zero physical directional CSS | `grep -rE '\bpl-|\bpr-|\bml-|\bmr-|\btext-left\b|\btext-right\b' apps/web/src/components/ apps/web/src/app/ --include="*.tsx" \| grep -v 'left-1/2' \| grep -v 'data-\[side=' \| grep -v 'slide-in-from' \| grep -v 'pl-PL' \| grep -v '__tests__'` | Empty output | PASS |
| Arabic locale in routing | `node -e "const r = require('./apps/web/src/i18n/routing.ts')"` | routing.ts defines `["en", "pl", "ar"]` confirmed by direct file read | PASS |
| ar.json has substantive content | `wc -l apps/web/messages/ar.json` | 4261 lines | PASS |
| useRtlChartConfig used in charts | `grep -r 'useRtlChartConfig' apps/web/src/components/` | Empty output — not used | FAIL |
| Bdi component used in app | `grep -r 'from.*ui/bdi\|<Bdi' apps/web/src/components/` | Empty output — not used | FAIL |
| Locale switcher supports Arabic | `grep 'nextLocale.*ar\|ar.*nextLocale' apps/web/src/components/layout/user-menu.tsx` | Empty output — Arabic not wired | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| L10N-01 | 50-02 | Full Arabic translation of all UI strings | PARTIAL | ar.json exists with ~45% coverage; route accessible via URL; UI switcher only offers pl/en |
| L10N-02 | 50-01, 50-03–06 | RTL layout — all CSS converted to logical properties | SATISFIED | Zero physical CSS properties in entire apps/web/src tree confirmed by grep sweep |
| L10N-03 | 50-03 | Bidirectional text handling with `<bdi>` isolation | BLOCKED | Bdi component orphaned — never wired into any application component |
| L10N-04 | 50-04 | Charts and data visualizations render correctly in RTL | BLOCKED | useRtlChartConfig hook orphaned — never applied to spend-chart.tsx or report-chart.tsx |
| L10N-05 | 50-01, 50-02 | Arabic locale date/number/currency conventions | PARTIAL | i18n config correctly sets up AED/Asia/Dubai/latn for `ar`; but chart components and format-currency/format-relative-date utilities bypass this with hardcoded pl-PL |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/components/dashboard/spend-chart.tsx` | 35 | `new Intl.NumberFormat("pl-PL", ...)` hardcoded | Warning | Currency display will show PLN formatting under all locales including Arabic |
| `apps/web/src/components/reports/report-chart.tsx` | 41 | `new Intl.NumberFormat("pl-PL", ...)` hardcoded | Warning | Currency display bypasses locale config |
| `apps/web/src/components/layout/user-menu.tsx` | 111 | `locale === "pl" ? "en" : "pl"` — no Arabic path | Blocker | Arabic locale not selectable from UI |
| `apps/web/src/lib/format-currency.ts` | 15, 27 | `new Intl.NumberFormat("pl-PL", ...)` hardcoded | Warning | All components using this lib will render pl-PL formatting in Arabic locale |
| `apps/web/src/lib/format-relative-date.ts` | 17 | `toLocaleDateString("pl-PL")` hardcoded | Warning | Relative dates fallback to pl-PL under Arabic locale |

### Human Verification Required

#### 1. Visual RTL Chart Rendering

**Test:** Navigate to `/ar/v2` (dashboard) and to `/ar/reports`. View bar charts in both pages.
**Expected:** Bar charts should render with reversed X-axis (reading right-to-left), Y-axis positioned on the right side. Currently the `useRtlChartConfig` hook is not wired, so charts will NOT render RTL-correct — this is a known gap.
**Why human:** Visual rendering of chart layout direction requires browser inspection.

#### 2. Bidi Text Correctness

**Test:** View a contractor profile with a Latin/English name while in `/ar` locale. Check the display of the contractor name within Arabic surrounding text.
**Expected:** The English name should render as a coherent LTR segment. Without `<bdi>` isolation, bidirectional text may appear garbled. This is a known gap.
**Why human:** Unicode BiDi rendering edge cases require visual browser testing.

#### 3. Arabic Locale UI Selection

**Test:** Open the dashboard in `/en` locale. Click the language control in the user menu.
**Expected:** The control should offer Arabic (`عربي` / AR) as a third option. Currently only EN/PL are offered — Arabic requires direct URL navigation to `/ar/`.
**Why human:** Interactive locale switching flow requires human testing.

### Gaps Summary

Three gaps block full phase goal achievement:

**Gap 1 — Bidi isolation not wired (L10N-03):** The `Bdi` component was created in plan 03 but zero application components import or use it. Plan 03's SUMMARY only records CSS class conversions and omits mention of Bdi wrapping work. This means mixed Arabic/English content (contractor names in notifications, payment run names, entity references) renders without proper bidirectional isolation — a correctness issue for Arabic users.

**Gap 2 — Chart RTL not wired (L10N-04):** The `useRtlChartConfig` hook was created in plan 04 but is never imported or used by any chart component. Both `spend-chart.tsx` and `report-chart.tsx` have no RTL awareness. Plan 04's SUMMARY records only CSS conversions and marks requirements-completed as `[L10N-02]` only (not L10N-04), confirming the chart RTL work was not completed. Charts will render LTR in Arabic locale.

**Gap 3 — Arabic locale not selectable from UI (L10N-01 partial):** The locale switcher in `user-menu.tsx` cycles only between Polish and English. Arabic is accessible via direct URL `/ar/` navigation but not through the application UI. The UAT test 13 ("locale switcher round-trip") passed likely because the tester navigated via URL. This is a UX gap that prevents casual users from discovering or switching to Arabic.

Additionally, several formatting utilities (`format-currency.ts`, `format-relative-date.ts`, `spend-chart.tsx`, `report-chart.tsx`) hardcode `pl-PL` locale in `Intl.NumberFormat`/`toLocaleDateString` calls, bypassing the locale-aware configuration correctly established in `i18n/request.ts`. This is a partial gap for L10N-05.

**Root cause pattern:** Plans 03 and 04 both have sparse summaries recording only CSS class conversions. Both plans had tasks beyond CSS conversion (Bdi wiring in plan 03, chart RTL wiring in plan 04) that appear to have been skipped. The infrastructure was created but not connected.

---

_Verified: 2026-04-12T00:24:54Z_
_Verifier: Claude (gsd-verifier)_
