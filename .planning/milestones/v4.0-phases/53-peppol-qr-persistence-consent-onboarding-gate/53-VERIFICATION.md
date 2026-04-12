---
status: passed
phase: 53-peppol-qr-persistence-consent-onboarding-gate
verifier: inline
verified: 2026-04-12
requirements: [PEPPOL-04, PDPL-03, PDPL-04]
---

# Phase 53 Verification: Peppol QR Persistence & Consent Onboarding Gate

## Goal
Peppol QR codes display on invoice detail and PDPL consent is enforced during onboarding for Gulf jurisdictions.

## Must-Haves Verification

### 1. Invoice Prisma model has qrCodeBase64 field and PeppolQRDisplay renders QR on Peppol invoices
**Status: PASS**
- `packages/db/prisma/schema/invoice.prisma` contains `qrCodeBase64 String? @db.Text` field (line 45)
- `packages/api/src/services/peppol-orchestrator.ts` imports `PeppolAEQRCode`, calls `generateQR()`, persists as data URI
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` renders `<PeppolQRDisplay>` when `invoice.qrCodeBase64` is populated

### 2. OnboardingConsentStep is rendered in the onboarding checklist for PDPL jurisdictions (UAE, Saudi)
**Status: PASS**
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` imports `OnboardingConsentStep` and `isPdplJurisdiction`
- `visibleSteps` filters out privacy-consent step for non-PDPL orgs
- `OnboardingConsentStep` renders inline when privacy-consent step is current and not completed

### 3. Consent step completion is gated on hasRequiredConsents returning true
**Status: PASS**
- `trpc.consent.hasRequiredConsents` query is enabled only for PDPL jurisdictions
- `completeStep` function gates privacy-consent completion on `hasConsents` (unless `skipValidation` is true)
- `skipValidation: true` only passed from `OnboardingConsentStep.onComplete` which fires after server-side `bulkGrant` mutation

## Requirement Traceability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PEPPOL-04 | PASS | QR generation wired into PeppolOrchestrator, persisted on Invoice, rendered by PeppolQRDisplay |
| PDPL-03 | PASS | OnboardingConsentStep renders in checklist for PDPL jurisdictions with server-side gating |
| PDPL-04 | PASS | Consent step completion gated on hasRequiredConsents, dual gating pattern implemented |

## Regression Check

- 94 tests passed across 10 test files (packages/auth, packages/shared, packages/einvoice)
- No new TypeScript errors introduced (only pre-existing errors in unrelated files)
- Peppol AE tests: 22/22 passed
- ZATCA QR code tests: 15/15 passed

## Test Suite
- `packages/einvoice/src/__tests__/peppol-ae.test.ts` — 22 tests passed
- `packages/einvoice/src/profiles/zatca/__tests__/qr-code.test.ts` — 15 tests passed

## Human Verification
None required — all criteria verified via automated checks and code inspection.
