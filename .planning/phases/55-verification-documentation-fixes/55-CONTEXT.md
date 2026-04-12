# Phase 55: Verification & Documentation Fixes - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Close verification and documentation gaps identified in the v4.0 audit: create missing VERIFICATION.md for Phase 45, update existing verification artifacts for Phases 48 and 49, populate SUMMARY frontmatter for Phase 46, and fix hardcoded pl-PL locale in formatting utilities.

</domain>

<decisions>
## Implementation Decisions

### Locale Formatting
- **D-01:** Add an optional `locale` parameter to `formatMinorUnits()`, `formatAmount()`, and `formatRelativeDate()`. Callers pass the locale from next-intl's `useLocale()`. Falls back to `'en'` if not provided. This makes the formatters locale-aware without coupling them to the i18n framework.
- **D-02:** Update all call sites across the app to pass the current locale. Update corresponding tests to test with multiple locales (at minimum `en`, `pl`, `ar`).

### Verification Artifacts
- **D-03:** VERIFICATION.md files use a requirement-level checklist format. Each requirement (e.g., EINV-01, ZATCA-05) gets a pass/fail status with a one-line evidence reference (file path or test name). Enough for compliance audit trail without excessive detail.
- **D-04:** Create new VERIFICATION.md for Phase 45 covering all 6 EINV requirements.
- **D-05:** Update Phase 48 VERIFICATION.md to reflect gap closure plans 48-07/48-08 (ZATCA-05 and ZATCA-07 satisfied).
- **D-06:** Update Phase 49 VERIFICATION.md to reflect resolved hooks violation.

### SUMMARY Frontmatter
- **D-07:** Populate `requirements_completed` frontmatter in all 5 Phase 46 SUMMARY files (46-01 through 46-05). Map each plan's work to the CURR and PAY requirements it satisfies.

### Claude's Discretion
- Exact VERIFICATION.md template structure
- Which file paths/test names to cite as evidence per requirement
- Order of work (docs first vs code first)
- Whether to update tests in the same plan as formatter changes or separate plan

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locale formatters to fix
- `apps/web/src/lib/format-currency.ts` — formatMinorUnits() and formatAmount() with hardcoded pl-PL
- `apps/web/src/lib/format-relative-date.ts` — formatRelativeDate() with hardcoded pl-PL fallback
- `apps/web/src/lib/__tests__/format-currency.test.ts` — Tests asserting pl-PL format patterns
- `apps/web/src/lib/__tests__/format-relative-date.test.ts` — Tests asserting pl-PL format patterns

### Verification artifacts
- `.planning/phases/48-zatca-fatoorah-integration/48-VERIFICATION.md` — Exists, needs ZATCA-05/07 update
- `.planning/phases/49-peppol-pint-ae-integration/49-VERIFICATION.md` — Exists, needs hooks violation update
- Phase 45 has no VERIFICATION.md — needs creation

### SUMMARY files to update
- `.planning/phases/46-multi-currency-foundation-swift-payment-export/46-01-SUMMARY.md`
- `.planning/phases/46-multi-currency-foundation-swift-payment-export/46-02-SUMMARY.md`
- `.planning/phases/46-multi-currency-foundation-swift-payment-export/46-03-SUMMARY.md`
- `.planning/phases/46-multi-currency-foundation-swift-payment-export/46-04-SUMMARY.md`
- `.planning/phases/46-multi-currency-foundation-swift-payment-export/46-05-SUMMARY.md`

### Requirements to verify
- `.planning/REQUIREMENTS.md` — EINV-01 through EINV-06, ZATCA-05, ZATCA-07, CURR-01 through CURR-05, PAY-01 through PAY-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- next-intl `useLocale()` hook — provides current locale to React components
- Existing VERIFICATION.md in Phases 48 and 49 — template to follow for Phase 45
- SUMMARY files in Phase 46 — structure exists, just needs frontmatter populated

### Established Patterns
- `Intl.NumberFormat` and `Date.toLocaleDateString()` — standard locale-aware JS APIs already used, just with wrong locale
- VERIFICATION.md format from prior phases — requirement checklist with evidence

### Integration Points
- All components calling formatMinorUnits/formatAmount/formatRelativeDate — need locale parameter added
- Reports, payments, dashboard, contracts, approvals components all use these formatters

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 55-verification-documentation-fixes*
*Context gathered: 2026-04-12*
