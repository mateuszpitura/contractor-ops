---
status: complete
phase: 53-peppol-qr-persistence-consent-onboarding-gate
source: [53-01-SUMMARY.md, 53-02-SUMMARY.md]
started: 2026-04-12T11:30:00Z
updated: 2026-04-12T11:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Invoice Model Has qrCodeBase64 Field
expected: The Invoice Prisma model includes a nullable `qrCodeBase64` String field with @db.Text annotation.
result: pass

### 2. QR Generation Wired in Peppol Submission
expected: PeppolOrchestrator.submitOutboundInvoice() calls PeppolAEQRCode.generateQR(), encodes as data URI, and persists qrCodeBase64 on the invoice record.
result: pass

### 3. PeppolQRDisplay Renders with Persisted Data
expected: Invoice detail page renders PeppolQRDisplay when invoice.qrCodeBase64 is present. The component shows a 200x200 QR image with "UAE FTA QR Code — Scan to verify" label.
result: pass

### 4. Consent Step Hidden for Non-Gulf Orgs
expected: Onboarding checklist for a Polish or EU org does NOT show the "Privacy & Consent" step. Step count adjusts accordingly.
result: pass

### 5. Consent Step Shown for Gulf Orgs
expected: Onboarding checklist for a UAE or Saudi org shows the "Privacy & Consent" step with inline OnboardingConsentStep rendering consent toggles directly in the checklist card.
result: pass

### 6. Server-Side Consent Gating
expected: The hasRequiredConsents query gates consent step completion. A user cannot mark the privacy-consent step complete without actually granting required consents via the server-validated bulkGrant mutation.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
