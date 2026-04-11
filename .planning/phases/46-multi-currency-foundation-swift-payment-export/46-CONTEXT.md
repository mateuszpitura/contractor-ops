# Phase 46: Multi-Currency Foundation & SWIFT Payment Export - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add multi-currency support (AED, SAR, GBP alongside existing PLN/EUR) with correct minor-unit precision using Dinero.js v2, daily exchange rates for reporting, and SWIFT pain.001.001.09 payment file generation for international transfers. Organization home currency setting with per-record currency on invoices, contracts, and payment runs.

</domain>

<decisions>
## Implementation Decisions

### Money Utility
- **D-01:** Use Dinero.js v2 (2.0.2, stable) as the Money utility across the platform. It provides ISO 4217 minor-unit metadata, safe arithmetic, and formatting out of the box.
- **D-02:** Full Dinero adoption — refactor all monetary operations to pass Dinero objects instead of raw integers. Integers only at DB and API boundaries (serialization/deserialization). All hardcoded `*100` / `/100` replaced with Dinero's currency-aware operations.

### SWIFT Payment Generation
- **D-03:** New `generateSwiftXml()` function alongside existing SEPA generator in `payment-export.ts`. SEPA (pain.001.001.03) stays for EU transfers, SWIFT (pain.001.001.09) added for international. Payment run picks format based on currency/destination.
- **D-04:** Purpose codes auto-assigned via service category mapping — configurable lookup table mapping contract service categories (e.g., "software development" → SCVE, "consulting" → CONS). Auto-assigned on payment creation, manual override available per payment item.

### Exchange Rate Handling
- **D-05:** ECB as primary rate source (free, no API key). For AED and SAR, derive via USD cross-rates since both are pegged currencies (AED = 3.6725 USD, SAR = 3.75 USD). Pegged currencies make cross-rate derivation reliable.
- **D-06:** `ExchangeRate` Prisma table with date/base/target/rate columns. QStash daily cron fetches and stores rates. Reports query by date for historical conversions. Auditable and works offline.

### Currency on Records
- **D-07:** `homeCurrency` field on Organization model. Admin can set it in settings or during org setup wizard. No migration needed (no existing orgs in DB). Defaults to PLN for new Polish orgs.
- **D-08:** Per-record currency field on invoices, contracts, and payment runs. Each record stores its own currency, defaulting to the org's homeCurrency but overridable. Allows orgs to deal in multiple currencies simultaneously.

### Claude's Discretion
- Payment format auto-detection logic (SEPA vs SWIFT based on IBAN country/currency)
- ExchangeRate table schema details (indexes, retention policy)
- Dinero.js integration patterns (shared utility module location, serialization helpers)
- Purpose code lookup table structure and seed data
- `paymentExportFormatEnum` extension (adding SWIFT_XML to existing CSV/BANK_FILE/SEPA_XML)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing payment infrastructure (to be extended)
- `packages/api/src/services/payment-export.ts` — CSV, Elixir, SEPA XML generators. ExportItem type. minorToDecimal() needs replacement.
- `packages/validators/src/payment.ts` — Payment run schemas, paymentExportFormatEnum, paymentRunCreateSchema (has groupByCurrency)
- `packages/api/src/routers/payment.ts` — Payment tRPC router

### Money/currency patterns to refactor
- `packages/integrations/src/services/ksef-xml-parser.ts` — toMinorUnits() hardcoded to PLN (*100)
- `packages/api/src/services/report-export.ts` — Report generation with currency display

### Requirements
- `.planning/REQUIREMENTS.md` — CURR-01 through CURR-05 (multi-currency), PAY-01 through PAY-03 (SWIFT payments)

### Prior phase context
- `.planning/phases/45-pluggable-e-invoicing-engine-core/45-CONTEXT.md` — D-06: Core invoice model includes currency field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `payment-export.ts` — generateSepaXml() as reference for SWIFT generator structure
- `ExportItem` type — already has `currency` and `swiftBic` fields
- `paymentRunCreateSchema` — already has `groupByCurrency` boolean
- `escapeXml()`, `stripDiacritics()`, `formatMultiline()` — reusable helpers
- QStash integration — reusable for daily exchange rate cron

### Established Patterns
- Integer minor units (grosze) for all monetary values — will be wrapped by Dinero.js
- Zod schema validation at API boundaries
- `xlsx` library for CSV export with UTF-8 BOM
- Transfer title template resolution (`resolveTransferTitle`)

### Integration Points
- `packages/api/src/routers/payment.ts` — needs SWIFT_XML export format option
- `packages/api/src/services/report-export.ts` — needs home currency conversion for reports
- Organization settings page — needs homeCurrency selector
- Org setup wizard — needs currency selection step
- All monetary displays — need currency-aware formatting via Dinero.js

</code_context>

<specifics>
## Specific Ideas

- User confirmed Dinero.js v2 is at 2.0.2 (stable, not alpha) — use as a normal dependency, not a risk
- No orgs exist in DB currently — no data migration needed, just add the schema fields

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 46-multi-currency-foundation-swift-payment-export*
*Context gathered: 2026-04-11*
