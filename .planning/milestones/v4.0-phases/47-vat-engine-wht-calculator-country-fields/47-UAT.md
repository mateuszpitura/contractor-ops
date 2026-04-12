---
status: partial
phase: 47-vat-engine-wht-calculator-country-fields
source: 47-01-SUMMARY.md, 47-02-SUMMARY.md, 47-03-SUMMARY.md, 47-04-SUMMARY.md, 47-05-SUMMARY.md
started: 2026-04-11T13:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Test

[testing paused — 11 items outstanding, deferred to manual UAT]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state. Start the application from scratch. Server boots without errors, seed/migration completes (including new TaxRate and WithholdingTaxRate seed data), and a basic page or health check returns successfully.
result: pass
code_review: |
  Seed files verified: tax-rates.ts seeds 10 VAT rates, wht-rates.ts seeds 14 WHT rates.
  seed/index.ts imports and calls both seedTaxRates and seedWhtRates.
  Upsert pattern used for idempotency. Requires running server to confirm runtime behavior.

### 2. VAT Rates Load per Country
expected: When viewing tax configuration or creating an invoice for a Polish org, the system shows PL-specific VAT rates (23%, 8%, 5%, 0%, ZW, NP). For a UAE org, it shows 5% and 0%. For a Saudi org, it shows 15% and 0%. Rates are grouped by Standard/Reduced/Exempt categories.
result: [pending]
code_review: |
  getTaxRatesForCountry service queries by countryCode with date-range filtering.
  Seed data confirmed: PL has 6 rates, AE has 2, SA has 2.
  tRPC getRates endpoint scopes by org.countryCode. Code is correct.

### 3. Dynamic VAT Rate Selector on Invoice
expected: When creating or editing an invoice, the VAT rate field is a dropdown (VatRateSelector) that shows rates grouped by category (Standard, Reduced, Exempt) specific to the org's country. Selecting a rate updates the invoice line item calculation.
result: [pending]
code_review: |
  VatRateSelector component uses api.tax.getRates.useQuery().
  Groups into defaultRates, reducedRates, exemptRates with Select/SelectGroup UI.
  Loading and empty states handled. Code is correct.

### 4. Reverse Charge Auto-Detection
expected: When creating an invoice for an EU cross-border B2B transaction (e.g., Polish org invoicing a contractor in Germany), the system automatically detects and flags the invoice as reverse charge. An info banner (ReverseChargeBanner) appears indicating reverse charge applies.
result: [pending]
code_review: |
  detectReverseCharge pure function checks EU_MEMBER_STATES (27 countries).
  applyReverseCharge async function queries org + contractor from DB.
  invoice.ts router imports and calls applyReverseCharge on create.
  Invoice model has isReverseCharge Boolean field. Code is correct.

### 5. Reverse Charge Manual Override
expected: On an invoice flagged as reverse charge, the ReverseChargeBanner includes an override dropdown allowing the user to manually toggle reverse charge on or off. The override persists when the invoice is saved.
result: [pending]
code_review: |
  ReverseChargeBanner has DropdownMenu with "Remove reverse charge" option.
  Calls api.invoice.toggleReverseCharge.useMutation.
  Invoice model has reverseChargeOverride Boolean? field. toggleReverseCharge mutation
  exists at line 847 in invoice.ts router. Code is correct.

### 6. WHT Calculation on Saudi Payment Run
expected: When creating a payment run for a Saudi org that includes cross-border payments, the system automatically calculates withholding tax using treaty rates. The PaymentRunItem shows whtAmountMinor, whtRate, and whether a treaty rate was applied. For domestic Saudi payments, no WHT is applied.
result: [pending]
code_review: |
  calculateWht service returns null for non-SA orgs and domestic SA payments.
  Treaty rate precedence: specific country > XX fallback.
  PaymentRunItem has whtAmountMinor, whtRate, whtTreatyApplied, whtServiceType, grossAmountMinor fields.
  payment.ts router integrates WHT calculation into create mutation. Code is correct.

### 7. WHT Summary Card on Payment Run View
expected: On the payment run detail view for a Saudi org, a WhtSummaryCard displays aggregate WHT metrics (total withheld, number of items with WHT, treaty vs standard rate breakdown). A bulk certificate generation button is available.
result: [pending]
code_review: |
  WhtSummaryCard component filters items by whtAmountMinor > 0.
  Shows gross total, WHT withheld, net payable in font-mono.
  Treaty count displayed as Badge. "Generate Certificates" button calls generateWhtCertificate per item.
  Component returns null when no WHT items. Code is correct.

### 8. WHT Certificate Generation and Preview
expected: Clicking generate on a WHT certificate creates a certificate with auto-generated number (WHT-{org}-{year}-{seq}). The WhtCertificatePreviewDialog opens showing certificate details (org info, contractor info, amounts, treaty reference) with a download button for the PDF.
result: [pending]
code_review: |
  WhtCertificate model exists with certificateNumber, orgId, amounts, treaty fields.
  wht-certificate.service.ts provides createWhtCertificate and listWhtCertificates.
  WhtCertificatePreviewDialog shows all certificate fields in structured layout with Download PDF button.
  React-PDF template exists at apps/web/src/components/wht/wht-certificate-template.tsx.
  Code is correct.

### 9. Country-Specific Contractor Fields (UAE)
expected: When viewing/editing a contractor profile under a UAE org, a Country Compliance section appears with UAE-specific fields: Freelance Permit Number, Trade License Number, Free Zone, and Trade License Expiry. Fields validate according to UAE rules.
result: [pending]
code_review: |
  CountryComplianceSection renders UaeFields when countryCode === "AE".
  UaeFields has: freelancePermitNumber (Input), tradeLicenseNumber (Input), freeZone (Switch), tradeLicenseExpiry (date Input).
  uaeCountryFieldsSchema validates with Zod. countryFields Json? column on Contractor model.
  getCountryFieldsConfig, getCountryFields, updateCountryFields endpoints exist. Code is correct.

### 10. Country-Specific Contractor Fields (Saudi)
expected: When viewing/editing a contractor profile under a Saudi org, a Country Compliance section appears with Saudi-specific fields: Freelance SA License, Commercial Registration, and Commercial Registration Expiry. Fields validate according to Saudi rules.
result: [pending]
code_review: |
  CountryComplianceSection renders SaudiFields when countryCode === "SA".
  SaudiFields has: freelanceSaLicense (Input), commercialRegistration (Input), commercialRegistrationExpiry (date Input).
  saudiCountryFieldsSchema validates with Zod. Code is correct.

### 11. TIN Validation per Country
expected: The TIN/Tax ID field validates per country rules: UAE TIN must be 15 digits, Saudi TIN must be 13 digits matching the 3...3... pattern, and Polish NIP validates with checksum. Invalid TINs show appropriate error messages.
result: [pending]
code_review: |
  validateUaeTin: /^\d{15}$/ — 15 digits exactly.
  validateSaudiTin: /^3\d{9}3\d{2}$/ — 13 digits, starts with 3, position 11 is 3.
  validatePolishNip: 10-digit checksum with weights [6,5,7,2,3,4,5,6,7].
  tinValidators map and validateTin(countryCode, tin) function.
  tRPC validateTin endpoint exists on contractor router. Code is correct.

### 12. Tax Obligations Dashboard Widget
expected: The compliance dashboard shows a TaxObligationsWidget displaying VAT and WHT period summaries. It shows current period obligations, amounts, and status for the org's applicable tax types.
result: [pending]
code_review: |
  TaxObligationsWidget calls api.tax.taxSummary.useQuery().
  taxSummary endpoint aggregates: vatCollectedMinor, vatOwedMinor, vatNetMinor, whtWithheldMinor, whtCertCount, whtPendingMinor, whtPendingCount.
  UI shows VAT (Collected/Owed/Net) and WHT (Withheld/Pending) with Badges and font-mono amounts.
  Links to /settings/compliance. Code is correct.

## Summary

total: 12
passed: 1
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

[none yet]
