---
phase: 55
plan: 1
status: complete
started: 2026-04-12T13:12:00Z
completed: 2026-04-12T13:18:00Z
duration_minutes: 6
---

# Summary: Locale-aware formatters and call-site updates

## What was built
Added optional `locale` parameter (default `"en"`) to `formatMinorUnits()`, `formatAmount()`, and `formatRelativeDate()` in the shared formatting library. Removed all hardcoded `"pl-PL"` locale strings. Updated all 5 components that import from `@/lib/format-currency` or `@/lib/format-relative-date` to pass the current locale via `useLocale()`. Updated the `getColumns` factory in approval-queue columns to accept locale, and updated its call site in the approvals page.

## Key files

### Modified
- `apps/web/src/lib/format-currency.ts` — Added `locale: string = "en"` parameter to both functions
- `apps/web/src/lib/format-relative-date.ts` — Added `locale: string = "en"` parameter
- `apps/web/src/lib/__tests__/format-currency.test.ts` — 20 tests covering en, pl, ar locales
- `apps/web/src/lib/__tests__/format-relative-date.test.ts` — 9 tests covering en, pl, ar locales
- `apps/web/src/components/payments/payment-run-side-panel.tsx` — Passes locale to formatMinorUnits and formatRelativeDate
- `apps/web/src/components/payments/wht-summary-card.tsx` — Passes locale to formatMinorUnits
- `apps/web/src/components/payments/wht-certificate-preview-dialog.tsx` — Passes locale to formatMinorUnits
- `apps/web/src/components/approvals/approval-queue/side-panel.tsx` — Passes locale to formatAmount
- `apps/web/src/components/approvals/approval-queue/columns.tsx` — Added locale parameter to getColumns factory
- `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` — Passes locale to getColumns

## Test results
29/29 tests pass (format-currency: 20, format-relative-date: 9)

## Decisions made
- Default locale is `"en"` (not `"pl-PL"`) to align with the international expansion
- Used `useLocale()` from next-intl for React component call sites
- For non-component column definitions (getColumns), added locale as a function parameter passed from the parent component
