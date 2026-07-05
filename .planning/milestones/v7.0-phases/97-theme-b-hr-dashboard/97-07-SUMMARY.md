# 97-07 SUMMARY — doc-expiry + probation + Gulf nationalisation UI; full HR screen composed

**Wave:** 4 · **Status:** done · completes the `dashboard/hr` surface on the 97-04 + 97-05 procedures.

## What landed
- **Document expiry** (HR-DASH-03, `hr-doc-expiry-section.tsx`) — wired over `use-hr-doc-expiry`
  (`getDocumentExpiry`). Renders the expired / 30 / 60 / 90 band summary chips (severity-toned) + a per-document
  `WorkbenchDataTable` (worker, category, expiry date, days-until with severity, band badge). The category axis is
  translated from `EmployeeDocCategory`; the band from the derived `DocExpiryBand`. **Section grain honored:** the view
  is a dumb renderer of exactly the rows the server returns — the server already drops any document whose section the
  caller cannot read (payroll_officer → section C only, etc.), and the UI has NO client-side section logic. A
  `sectionNote` line states the caller sees only their accessible sections. Empty card when no readable expiry docs.
- **Probation watchlist** (HR-DASH-04, `hr-probation-section.tsx`) — wired over `use-hr-probation`
  (`getProbationWatchlist`). Three severity buckets (due today = most urgent / within 7 / within 14) as counted chips,
  plus a combined `WorkbenchDataTable` (most-urgent first) with worker, probation-end date, days-remaining, and a
  severity badge. `dueToday` is destructive-toned. Empty card when nothing is due within 14 days.
- **Gulf nationalisation** (HR-DASH-05, `hr-nationalisation-section.tsx`) — wired over `use-hr-nationalisation`
  (`getNationalisationRollup`). KSA + UAE rendered side-by-side. Each present country shows the manual
  nationalisation rate (hero, `text-primary`), a NEUTRAL read-through band badge (never colorized to assert a
  judgement — the locked anti-feature), total + national manual headcount, and the Iqama/permit rollup. **F3 posture
  upheld at the presentation layer:** when a country's rollup is absent (no manual headcount recorded) the column
  renders the "record manual headcount" prompt — NEVER a platform-derived rate. UAE currently surfaces the prompt
  (no UAE manual-headcount store at HEAD, per 97-05); the KSA + UAE presentation are identical by construction.
- **Page composition** — `HrDashboardPageContent` now composes all five widget groups behind `AnimateIn`:
  KPI header + headcount + utilization (97-06) and doc-expiry + probation + nationalisation (this plan).

## Verification
- `pnpm --filter @contractor-ops/web-vite typecheck` — green (0 errors).
- `pnpm check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-presentational` /
  `check:web-vite-dialog-pattern` — OK; no hr-dashboard file flagged by `check:web-vite-table-pattern`.
- All watchlists use the canonical `WorkbenchDataTable` (client pagination — the full section-filtered set is loaded);
  date formatting is threaded from the wired layer (`useDateFormatter`) so the views stay presentational.

## Notes / deviations
- Date formatters (`useDateFormatter`) are called in the wired sections and passed to the views as `formatDate`,
  keeping the presentational check green (no data boundary in a view).
- i18n JSON authored in 97-08; every string is a `HrDashboard.*` key.
