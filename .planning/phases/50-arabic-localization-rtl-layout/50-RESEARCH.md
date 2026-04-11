# Phase 50: Arabic Localization & RTL Layout — Research

**Researched:** 2026-04-11
**Status:** Complete

## 1. Current i18n Architecture

### Web App (apps/web)
- **Library:** `next-intl` (routing, request config, useTranslations, getTranslations)
- **Locales defined:** `["en", "pl"]` in `apps/web/src/i18n/routing.ts`
- **Messages:** `apps/web/messages/en.json` (~4261 lines), `apps/web/messages/pl.json`
- **Request config:** `apps/web/src/i18n/request.ts` — hardcoded `timeZone: "Europe/Warsaw"`, `currency: "PLN"`
- **Navigation:** `apps/web/src/i18n/navigation.ts` — locale-aware Link/redirect/usePathname
- **Route structure:** `apps/web/src/app/[locale]/...` — locale is a dynamic segment
- **Translation usage:** ~632 occurrences of `useTranslations`/`getTranslations` across ~250 files

### Landing App (apps/landing)
- **Custom i18n:** `apps/landing/src/i18n/config.ts` — already defines 4 locales including `ar` with RTL config
- **Arabic locale already exists:** `apps/landing/src/i18n/locales/ar.json` — landing page has Arabic strings
- **RTL helper:** `isRtl(locale)` function already available
- **LocaleConfig type:** Includes `dir: "ltr" | "rtl"`, `font`, `currency`, `intlLocale` fields

### Key Observation
The landing app (`apps/landing`) is **already Arabic-ready** with locale config, RTL direction flag, and Arabic strings. The web app (`apps/web`) only supports `en` and `pl` — this is the primary target for Phase 50.

## 2. RTL Conversion — CSS Logical Properties

### Current State
- **~550 occurrences** of physical directional CSS classes across ~210 files in `apps/web/src/`
- Physical properties found: `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`
- These span components (UI primitives, dashboard, invoices, contracts, payments, settings, portal, etc.)

### Tailwind CSS Logical Properties (v3.3+)
Tailwind v3.3+ supports logical property variants natively:

| Physical | Logical |
|----------|---------|
| `pl-*` | `ps-*` (padding-inline-start) |
| `pr-*` | `pe-*` (padding-inline-end) |
| `ml-*` | `ms-*` (margin-inline-start) |
| `mr-*` | `me-*` (margin-inline-end) |
| `left-*` | `start-*` |
| `right-*` | `end-*` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `rounded-l-*` | `rounded-s-*` |
| `rounded-r-*` | `rounded-e-*` |
| `border-l-*` | `border-s-*` |
| `border-r-*` | `border-e-*` |
| `float-left` | `float-start` |
| `float-right` | `float-end` |
| `scroll-ml-*` | `scroll-ms-*` |
| `scroll-mr-*` | `scroll-me-*` |

### Conversion Strategy
- **Automated regex/codemod approach** for bulk conversion — safe for most utilities
- **Manual audit needed** for cases where physical direction is intentional (e.g., decorative borders, specific icon positioning)
- **shadcn/ui components** (`apps/web/src/components/ui/`) have ~45 occurrences — these are the primitives and MUST be converted first since all other components inherit from them

### HTML dir Attribute
- Set `dir="rtl"` on `<html>` element when Arabic locale is active
- Located in `apps/web/src/app/[locale]/layout.tsx` — already has locale access
- Tailwind's `rtl:` variant can be used for RTL-specific overrides where logical properties aren't sufficient

## 3. Arabic Translation Strategy

### String Extraction
- `apps/web/messages/en.json` has ~4261 lines — this is the source for translation
- Flat key structure used by `next-intl` (namespace.key pattern)
- Need to create `apps/web/messages/ar.json` mirroring the same structure

### Translation Approach (per D-03)
1. AI-generate initial Arabic strings from English source
2. Professional Arabic financial domain translator reviews
3. Western/Latin numerals for financial data (per D-04) — ICU MessageFormat handles this via `numberingSystem: 'latn'`

### Financial Domain Terminology
Key terms that need domain-expert review:
- Invoice / فاتورة
- Payment / دفعة
- Contract / عقد
- Approval / موافقة
- Tax / ضريبة
- VAT / ضريبة القيمة المضافة
- Credit note / إشعار دائن
- Bank transfer / تحويل بنكي

### Numeral System
- `next-intl` uses `Intl.NumberFormat` under the hood
- For Arabic locale, default `numberingSystem` is `arab` (Eastern Arabic: ١٢٣)
- Override with `numberingSystem: 'latn'` for financial data to display Western numerals (123)
- Can set this in the `next-intl` request config for the `ar` locale

## 4. Bidirectional Text Handling

### Problem
When RTL text (Arabic) contains embedded LTR text (English names, invoice numbers, codes), the Unicode Bidirectional Algorithm (UBA) may produce incorrect visual order.

### Solution — `<bdi>` Element (per D-05)
- Create a `<Bdi>` React component that wraps content in `<bdi>` HTML element
- `<bdi>` isolates text direction from surrounding context
- Apply to: user-generated content, contractor names, invoice numbers, codes, free-text fields
- All data display components need audit for `<Bdi>` wrapping

### Components Needing `<Bdi>` Wrapping
- Invoice tables and detail views — invoice numbers, vendor names
- Contractor tables and profiles — names, company names
- Contract tables and detail views — contract titles, party names
- Payment run tables — reference numbers, beneficiary names
- Dashboard widgets — entity names in activity feeds
- Portal pages — all user-facing data
- Reports — drill-down labels, entity names

### Implementation
```tsx
// packages/ui/src/bdi.tsx or apps/web/src/components/ui/bdi.tsx
interface BdiProps {
  children: React.ReactNode;
  className?: string;
}
export function Bdi({ children, className }: BdiProps) {
  return <bdi className={className}>{children}</bdi>;
}
```

## 5. Charts & Data Visualization RTL

### Current Chart Components
- `apps/web/src/components/dashboard/spend-chart.tsx` — Recharts BarChart/AreaChart
- `apps/web/src/components/reports/report-chart.tsx` — Recharts for reports
- `apps/web/src/app/[locale]/(dashboard)/v2/page.tsx` — dashboard charts

### Recharts RTL Support
- Recharts does NOT have native RTL support
- **X-axis reversal:** Set `reversed={true}` on `<XAxis>` to flip reading direction
- **Legend placement:** Mirror legend from right to left
- **Tooltip positioning:** Adjust tooltip anchor for RTL
- **Y-axis:** Move to right side (set `orientation="right"` on `<YAxis>`)

### RTL Chart Wrapper (per D-06)
```tsx
// Detect locale, apply RTL config automatically
function useRtlChartConfig() {
  const locale = useLocale();
  const isRtl = locale === 'ar';
  return {
    xAxisProps: isRtl ? { reversed: true } : {},
    yAxisProps: isRtl ? { orientation: 'right' as const } : {},
    legendProps: isRtl ? { align: 'right' as const } : {},
  };
}
```

## 6. TanStack Table RTL

### Current Usage
- Multiple data tables throughout the app using TanStack Table
- Column alignment is set via CSS classes (`text-left`, `text-right`)

### RTL Adjustments
- Converting `text-left`/`text-right` to `text-start`/`text-end` (part of CSS logical property conversion) handles most cases
- Numeric/currency columns that are `text-right` should become `text-end`
- Action columns with icons need RTL icon mirroring consideration

## 7. Font Selection

### Arabic Font
- Landing app config already specifies `font: "Noto Sans Arabic"` for Arabic locale
- **Noto Sans Arabic** — Google Font, excellent Arabic support, pairs well with Inter
- Load conditionally only when Arabic locale is active (performance)
- Set via Next.js `next/font/google` — variable font for optimal loading

## 8. Date/Time Formatting

### Current State
- `apps/web/src/i18n/request.ts` hardcodes `timeZone: "Europe/Warsaw"`
- `dateTime` formats use `Intl.DateTimeFormat` options

### Arabic Locale
- Use Gregorian calendar (not Hijri) — per CONTEXT.md "Claude's Discretion" item
- Gulf business software standard: Gregorian dates with Arabic month names
- Set `calendar: 'gregory'` explicitly in Arabic locale config
- Date format: `day month year` (same visual order in Arabic)
- `Intl.DateTimeFormat('ar-AE', { calendar: 'gregory' })` produces correct output

## 9. next-intl Configuration Changes

### routing.ts Changes
```ts
export const routing = defineRouting({
  locales: ["en", "pl", "ar"] as const,
  defaultLocale: "pl",
});
```

### request.ts Changes
- Add locale-aware timezone (or keep Europe/Warsaw as default, add Gulf timezone for `ar`)
- Add locale-aware currency format
- Add `numberingSystem: 'latn'` for Arabic number formatting
- Dynamic message loading already supports `ar` via `import(`../../messages/${locale}.json`)`

### Layout Changes (apps/web/src/app/[locale]/layout.tsx)
- Set `dir` attribute on `<html>` based on locale
- Conditionally load Noto Sans Arabic font
- Set `lang` attribute to locale code

## 10. Middleware Changes

### apps/web/src/middleware.ts
- Already uses `next-intl` middleware
- Need to add `"ar"` to accepted locales
- Locale detection from `Accept-Language` header will work automatically

## 11. Risk Assessment

### High Risk
- **Big-bang CSS conversion** (D-02): ~550 occurrences across ~210 files. Automated conversion reduces risk but manual verification needed for edge cases.
- **shadcn/ui component conversion**: These are UI primitives — any regression cascades to all components.

### Medium Risk
- **Arabic translation quality**: AI-generated translations need professional review. Financial terminology errors could cause compliance issues.
- **Bidi text edge cases**: Unicode BiDi algorithm has known edge cases with numbers adjacent to Arabic text.

### Low Risk
- **next-intl config changes**: Well-understood, additive changes.
- **Chart RTL**: Limited to 3-5 chart components. Contained scope.

## 12. Validation Architecture

### Testing Strategy
- Visual regression tests for RTL layout (Playwright screenshots)
- Unit tests for `<Bdi>` component isolation behavior
- Integration tests for locale switching (en -> ar -> en roundtrip)
- Chart RTL tests for axis direction and legend placement
- Number formatting tests: verify Western numerals in Arabic locale for financial data
- Date formatting tests: verify Gregorian calendar in Arabic locale

### Key Validation Points
1. `dir="rtl"` set on `<html>` when locale is `ar`
2. All physical CSS properties converted to logical equivalents
3. `messages/ar.json` exists with same key count as `messages/en.json`
4. `<Bdi>` wrapping on all user-generated content in data display components
5. Charts render with reversed X-axis and right-side Y-axis in Arabic
6. Financial numbers display Western numerals (1,2,3) not Eastern Arabic (١,٢,٣)
7. Dates display Gregorian calendar with Arabic month names

## RESEARCH COMPLETE
