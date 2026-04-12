# Phase 55: Verification & Documentation Fixes — Research

**Researched:** 2026-04-12
**Scope:** Documentation artifact fixes, SUMMARY frontmatter, locale-aware formatters

## 1. Locale Formatters — Current State

### `format-currency.ts`
- `formatMinorUnits(minor, currency?)` — hardcoded `"pl-PL"` locale in `Intl.NumberFormat`
- `formatAmount(minor, currency)` — same hardcoded `"pl-PL"` locale
- Both use `Intl.NumberFormat` which natively supports a locale parameter

### `format-relative-date.ts`
- `formatRelativeDate(dateStr)` — hardcoded `"pl-PL"` in `date.toLocaleDateString("pl-PL")` for dates 30+ days old
- Uses standard `Date.toLocaleDateString()` which natively supports a locale parameter

### Call Sites (30 files)
All call sites are React components under `apps/web/src/components/` and `apps/web/src/app/`. They can access the current locale via next-intl's `useLocale()` hook (already available in the project).

Key call site categories:
- Invoice tables/details (columns.tsx, invoice-side-panel.tsx, match-card.tsx)
- Payment components (payment-run-side-panel.tsx, step-review.tsx, step-confirmation.tsx, columns.tsx, wht-summary-card.tsx, wht-certificate-preview-dialog.tsx)
- Portal pages (invoices, payments, contracts)
- Dashboard widgets (approval-queue-widget.tsx)
- OCR components (ocr-review-panel.tsx, line-items-table.tsx)
- Time tracking (reconciliation-table.tsx, reconciliation-card.tsx, deviation-flag.tsx)
- Contractor profile (tab-payments.tsx)

### Approach
Add optional `locale?: string` parameter (default `"en"`) to all three functions. Update call sites to pass `useLocale()`. Update tests to cover `en`, `pl`, `ar` locales.

## 2. Verification Artifacts — Current State

### Phase 45 — Missing VERIFICATION.md
Phase 45 has 5 plans, 5 summaries, and a UAT file, but NO VERIFICATION.md. Needs creation covering EINV-01 through EINV-06. The existing Phase 48 and 49 verification files provide a template to follow.

### Phase 48 — Needs Minor Update
48-VERIFICATION.md exists and is comprehensive (230 lines). Status is `human_needed` with 18/18 truths verified. The gaps section already documents that ZATCA-05 and ZATCA-07 are SATISFIED. The frontmatter already marks `gaps_remaining: []`. 

**Observation:** The Phase 48 VERIFICATION.md already reflects the gap closure from plans 48-07/48-08. The ZATCA-05 and ZATCA-07 requirements are already marked as SATISFIED in the Requirements Coverage table. The `status` is `human_needed` (not `gaps_found`). This file appears to already be current — the phase 55 CONTEXT.md may be referencing a state that has since been resolved.

### Phase 49 — Hooks Violation Status
49-VERIFICATION.md exists (160 lines). Status is `gaps_found` with score 15/16. The gap is a React Rules of Hooks violation in `compliance-widget.tsx`.

**Critical finding:** Reading the actual `compliance-widget.tsx` code, both `useQuery` calls are now at lines 73-74 (BEFORE the `isLoading` check at line 76). This means the hooks violation has ALREADY been fixed in the code. The verification file just needs its status updated to reflect this fix.

## 3. SUMMARY Frontmatter — Current State

Phase 46 has 5 SUMMARY files (46-01 through 46-05). All have basic frontmatter (phase, plan, status, started, completed, duration_minutes) but are missing `requirements_completed` fields.

Requirements mapping for Phase 46:
- **46-01** (Dinero.js Money Utility): CURR-01 (multi-currency support), CURR-03 (correct minor unit precision)
- **46-02** (ExchangeRate Model & SWIFT_XML Enum): CURR-04 (exchange rates for reporting), PAY-01 (SWIFT payment files)
- **46-03** (Exchange Rate Service): CURR-04 (exchange rates fetched daily), CURR-05 (amounts in home currency)
- **46-04** (SWIFT pain.001 Generator & Purpose Codes): PAY-01 (SWIFT pain.001 files), PAY-02 (purpose codes auto-assigned)
- **46-05** (Payment Format Auto-Detection & Report Conversion): PAY-03 (multi-currency batching), CURR-02 (home currency setting), CURR-05 (home currency reports)

## 4. Work Decomposition

The phase naturally splits into:
1. **Locale formatter changes** (code changes + test updates) — Wave 1
2. **Documentation/verification artifacts** (VERIFICATION.md creation/updates + SUMMARY frontmatter) — Wave 1 (independent, can run in parallel)

The two workstreams have no dependencies on each other.

## 5. Risk Assessment

- **Low risk** — All changes are either documentation-only or well-contained function signature additions
- **Phase 48 VERIFICATION.md** may already be current — needs verification before updating
- **Phase 49 hooks violation** appears already fixed in code — verification file needs status update only
- **30 call sites** for formatter changes — but the change is mechanical (add locale parameter)
