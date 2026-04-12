# Phase 47: VAT Engine, WHT Calculator & Country Fields - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a configurable per-country VAT engine with database-driven rates, automatic reverse charge detection, Saudi WHT calculation with branded certificate PDF generation, and country-specific contractor profile fields (UAE freelance permits/trade licenses, Saudi Freelance.sa/commercial registration) activated by organization country setting.

</domain>

<decisions>
## Implementation Decisions

### VAT Rate Engine
- **D-01:** DB-driven `TaxRate` Prisma table with country, rate percentage, code, description, effective date range. Seeded with PL rates (23%, 8%, 5%, 0%, ZW, NP), UAE (5%), and Saudi (15%). Admins can view but not edit (regulatory data). New countries = new seed data.
- **D-02:** Replace the current hardcoded `vatRate` enum (`"23" | "8" | "5" | "0" | "ZW" | "NP"` in `packages/validators/src/invoice.ts`) with a dynamic lookup from the TaxRate table based on organization country.
- **D-03:** Reverse charge auto-detected from parties — engine checks seller country vs buyer country + VAT registration status. If cross-border B2B within applicable rules, auto-flags reverse charge on the invoice. Overridable per invoice.

### WHT Calculator & Certificates
- **D-04:** `WithholdingTaxRate` DB table seeded with Saudi DTA (double taxation agreement) treaty data. Columns: source_country, contractor_residency, service_type, treaty_rate, standard_rate. Engine looks up rate by (org country, contractor country, service type).
- **D-05:** WHT certificate PDF includes standard fields (withholding amount, gross amount, net paid, rate applied, treaty reference, contractor details, payment date, org details) plus org branding (logo, colors from existing branding system). Generated via React-PDF or similar.

### Country-Specific Profile Fields
- **D-06:** `countryFields` JSONB column on Contractor model. Zod schema per country validates the shape:
  - UAE: `{ freelancePermitNumber, tradeLicenseNumber, freeZone: boolean, tradeLicenseExpiry }`
  - Saudi: `{ freelanceSaLicense, commercialRegistration, commercialRegistrationExpiry }`
  - Per-country TIN format validation (TAX-04 requirement)
- **D-07:** Conditional "Country Compliance" section within the existing contractor profile tabs. Shows/hides fields based on the organization's country setting. No new tab — uses the existing 8-tab layout.

### Compliance Dashboard
- **D-08:** Extend Phase 45's compliance dashboard widget (D-08) with VAT/WHT summary. Show VAT collected/owed per period, WHT withheld totals, upcoming obligations. Single compliance surface covering e-invoicing status + tax obligations — avoids fragmenting compliance info across multiple pages.

### Claude's Discretion
- TaxRate seed data structure and initial rates
- WHT certificate PDF layout and React-PDF template design
- Reverse charge detection rules per country pair
- countryFields Zod schema details and validation messages
- Compliance widget layout for combined e-invoicing + tax view

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing tax/invoice infrastructure
- `packages/validators/src/invoice.ts` — Current hardcoded vatRate enum to replace, withholdingMinor field already exists
- `packages/validators/src/contractor.ts` — Contractor type enum, profile schemas
- `packages/api/src/routers/invoice.ts` — Invoice tRPC router
- `packages/api/src/routers/contractor.ts` — Contractor tRPC router with profile management

### Prior phase context
- `.planning/phases/45-pluggable-e-invoicing-engine-core/45-CONTEXT.md` — D-06: Core invoice model with tax fields, D-08: Compliance dashboard widget
- `.planning/phases/46-multi-currency-foundation-swift-payment-export/46-CONTEXT.md` — D-01/D-02: Dinero.js v2, D-07: homeCurrency on org, D-08: Per-record currency

### Requirements
- `.planning/REQUIREMENTS.md` — TAX-01 through TAX-05 (VAT/WHT), PROF-01 through PROF-04 (country fields)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withholdingMinor` field on invoice schema — WHT calculator can populate this
- Invoice amount validation refine (subtotal + VAT - withholding = total) — already handles WHT
- Existing org branding system — reusable for WHT certificate PDF
- `packages/einvoice` — e-invoicing engine from Phase 45 with tax field abstractions

### Established Patterns
- Zod schema validation at boundaries
- Dinero.js v2 for monetary calculations (Phase 46)
- DB-driven configuration (integration connections, exchange rates)
- QStash for async processing
- React-PDF pattern may exist from report export

### Integration Points
- Invoice creation flow — needs VAT rate lookup + reverse charge check
- Payment run flow — needs WHT calculation before export
- Contractor profile UI — needs conditional country fields section
- Dashboard — compliance widget needs VAT/WHT summary data
- Settings page — compliance detail drill-down (Phase 45 D-08)

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

*Phase: 47-vat-engine-wht-calculator-country-fields*
*Context gathered: 2026-04-11*
