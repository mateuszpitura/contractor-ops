---
status: partial
phase: 48-zatca-fatoorah-integration
source: [48-01-SUMMARY.md, 48-02-SUMMARY.md, 48-03-SUMMARY.md, 48-04-SUMMARY.md, 48-05-SUMMARY.md, 48-06-SUMMARY.md]
started: 2026-04-11T01:21:00Z
updated: 2026-04-12T02:55:00Z
---

## Current Test

[testing paused — 11 items outstanding, awaiting manual UAT]

## Tests

### 1. ZatcaProfile Engine Registration
expected: ZatcaProfile has profileId "zatca", country "SA", and implements EInvoiceProfile with generate/parse/validate/getComplianceStatus methods
result: pass

### 2. UBL 2.1 XML Generation — ProfileID Selection
expected: Simplified invoices produce XML with ProfileID "reporting:1.0"; standard invoices use "clearance:1.0" per ZATCA spec
result: pass

### 3. UBL 2.1 XML Generation — ZATCA Extensions
expected: Generated XML contains UUID element, AdditionalDocumentReference for ICV and PIH, and InvoiceTypeCode 388 with subtype @name attribute
result: pass

### 4. Zod Schema Validation — Saudi VAT Number
expected: zatcaTaxDetailsSchema rejects invalid VAT numbers and accepts valid 15-digit Saudi VAT numbers
result: pass

### 5. ZatcaInvoiceChain Prisma Model
expected: Model has all required fields (organizationId, icv, pih, invoiceId, status), @@unique([organizationId, icv]) constraint, ZatcaSubmissionStatus enum with all values, ZATCA in IntegrationProvider enum
result: pass

### 6. XAdES-BES Signature Generation
expected: sign() produces XML containing ds:Signature inside UBLExtensions with SignedProperties (SigningTime, SigningCertificateV2), Exclusive XML Canonicalization, SHA-256 digest, and ECDSA-SHA256 signature algorithm
result: pass

### 7. Sign/Verify Roundtrip
expected: verify() returns valid=true for correctly signed XML; returns valid=false for tampered XML (tamper detection confirmed)
result: pass

### 8. Private Key Security
expected: Private key does not appear anywhere in signed XML output; sign() throws when privateKey is missing
result: pass

### 9. Cold Start Smoke Test
expected: Kill any running dev server. Clear ephemeral state. Run `pnpm dev` (or equivalent). Server boots without errors, Prisma migrations/schema-push completes, and loading the dashboard returns a live response. No startup errors related to Infisical SDK, ZATCA router registration, or zatca-trpc.ts import.
result: [pending]

### 10. ZATCA Settings Page Navigation
expected: Navigate to /settings/integrations/zatca. Page loads without errors. Not-connected state shows empty state with "Start ZATCA Onboarding" CTA. Breadcrumbs/navigation link from Settings > Integrations works.
result: [pending]

### 11. ZATCA Status Card in Integrations Grid
expected: Open Settings > Integrations. ZATCA status card appears in the provider grid alongside existing integrations (Peppol, KSeF). Card shows "Not connected" empty state with appropriate icon and description. Clicking card navigates to /settings/integrations/zatca.
result: [pending]

### 12. ZATCA Onboarding Wizard — Stepper Navigation
expected: Launch onboarding wizard from ZATCA settings page. 5-step stepper shows steps 1-5 (Tax Details, CSR Generation, Compliance CSID, Compliance Checks, Production Certificate). Current step highlighted, upcoming steps disabled. Keyboard navigation (Tab, Arrow keys) moves focus correctly. Aria roles announce step progress to screen reader.
result: [pending]

### 13. Onboarding Step 1 — Tax Details Form Validation
expected: Tax Details form enforces 15-digit Saudi VAT number, accepts Arabic name (arbitrary Unicode), requires address fields, and lets user select invoice types (standard/simplified). Invalid VAT shows inline error. Valid submission advances to step 2.
result: [pending]

### 14. Onboarding Step 2 — CSR Generation
expected: CSR Generation step shows "Generate CSR" button. Clicking it calls the backend, displays a code preview of the generated CSR with ECDSA P-256 key. Private key is NOT shown anywhere in the UI (stored in Infisical). Success state advances to step 3.
result: [pending]

### 15. Onboarding Steps 3–5 — CSID, Checks, Production Cert
expected: Step 3 requests Compliance CSID from ZATCA sandbox (animated status list while pending). Step 4 runs 6 compliance test invoices and displays each with a status badge + progress bar. Step 5 exchanges production certificate with a warning alert about irreversibility, then shows cert info card on success.
result: [pending]

### 16. Environment Toggle — Sandbox/Production
expected: Environment toggle renders as RadioGroup cards (sandbox vs production). Switching from Sandbox to Production opens an AlertDialog confirmation. Canceling keeps current env. Confirming switches env and updates the status badge on the settings page.
result: [pending]

### 17. ZATCA Compliance Widget
expected: On ZATCA settings page (connected state), Compliance Widget shows: status dot (green/amber/red), cert expiry date, submission stats for current period (sent/cleared/rejected counts), and a health progress bar with color-coded percentage. All values match data from getComplianceStats tRPC query.
result: [pending]

### 18. Invoice Detail — QR Code & Hash Chain Display
expected: Open a ZATCA-cleared invoice. Status badge shows "CLEARED" (green). Submission detail panel is collapsible, shows UUID, ICV, previous/current PIH, embedded QR code image (scannable TLV-encoded data), a "View signed XML" dialog button, and — for failed submissions — a "Resubmit" button.
result: [pending]

### 19. ZATCA Status Badge — All 6 Variants
expected: Across different invoices, badges render correctly for each submission status: PENDING (gray/clock), SUBMITTED (blue), CLEARED (green check), REPORTED (green alt), REJECTED (red/error), WARNING (amber). Colors meet WCAG AA contrast. Text is localized.
result: [pending]

## Summary

total: 19
passed: 8
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

[none]
