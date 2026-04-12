---
phase: 48-zatca-fatoorah-integration
verified: 2026-04-12T01:30:00Z
status: gaps_found
score: 16/18 must-haves verified
re_verification: false
gaps:
  - truth: "B2B invoices submitted to clearance endpoint, B2C to reporting"
    status: failed
    reason: "Submission pipeline uses placeholder <Invoice>${invoiceId}</Invoice> XML instead of calling ZatcaProfile.generate(). The actual ZATCA-compliant UBL 2.1 XML (with ICV, PIH, UUID, XAdES signature, QR code) is never produced during submission. The pipeline comments say 'for now, we create a placeholder XML that will be replaced when the full EInvoice pipeline is wired in subsequent plans'."
    artifacts:
      - path: "packages/api/src/services/zatca-submission.ts"
        issue: "Line 122: const invoiceXml = `<Invoice>${invoiceId}</Invoice>` — placeholder, ZatcaProfile.generate() is never called"
    missing:
      - "Replace placeholder XML with actual ZatcaProfile.generate(eInvoice) call in submitToZatca()"
      - "Build EInvoice object from Prisma invoice record before calling generate()"
      - "Thread signing: call profile.sign(xml, certInfo) to produce XAdES-signed XML"
      - "Thread QR: embed QR code data into XML via profile.qrCode.generateQR(invoice)"
  - truth: "ZATCA status badge shows on invoice detail for Saudi org invoices"
    status: failed
    reason: "ZatcaSubmissionDetail and ZatcaStatusBadge components are ORPHANED — not imported or rendered in any invoice detail page. Plan 06 key_link references trpc.zatca.getInvoiceSubmission which also does not exist as a procedure (getStatus is the equivalent)."
    artifacts:
      - path: "apps/web/src/components/zatca/zatca-submission-detail.tsx"
        issue: "Component is defined but never imported/used in invoice detail pages"
      - path: "apps/web/src/components/zatca/zatca-status-badge.tsx"
        issue: "Only imported within zatca-submission-detail.tsx, not in invoice list/detail pages"
    missing:
      - "Import and render ZatcaStatusBadge in invoice detail/list pages for Saudi org invoices"
      - "Import and render ZatcaSubmissionDetail in invoice detail page"
      - "Wire to trpc.zatca.getStatus (or rename to getInvoiceSubmission per plan spec)"
human_verification:
  - test: "ZATCA Settings Wizard Visual Verification"
    expected: "5-step onboarding wizard renders correctly in Settings > Integrations > ZATCA, stepper shows horizontal on desktop and vertical on mobile, all step forms validate before allowing Next, copy matches 48-UI-SPEC.md"
    why_human: "Visual appearance, responsive behavior, and exact copy cannot be verified programmatically"
  - test: "Onboarding Wizard Keyboard Navigation"
    expected: "Arrow keys navigate between stepper steps, Enter selects, aria-current='step' is correct, screen reader announces step changes"
    why_human: "Keyboard navigation and screen reader behavior requires manual testing"
  - test: "Environment Toggle Confirmation Flow"
    expected: "Production -> Sandbox shows confirmation dialog, Sandbox -> Production requires completed onboarding, selected environment shows ring-2 ring-primary styling"
    why_human: "Dialog behavior and visual ring styling requires manual testing"
---

# Phase 48: ZATCA Fatoorah Integration Verification Report

**Phase Goal:** Saudi e-invoicing with XML DSig, hash chain, QR codes, and Fatoora Portal API clearance
**Verified:** 2026-04-12T01:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ZATCA profile generates valid UBL 2.1 XML with ICV, PIH, UUID, and ProfileID extensions | ✓ VERIFIED | `generator.ts` generates full XML with all extensions; ZatcaProfile.generate() calls generateZatcaXml() |
| 2 | ZatcaInvoiceChain Prisma model tracks per-org sequential invoice chain with submission status | ✓ VERIFIED | `zatca.prisma` has complete model with @@unique([organizationId, icv]), 6-status enum |
| 3 | ZATCA profile plugs into the e-invoicing engine without modifying engine core | ✓ VERIFIED | ZatcaProfile implements EInvoiceProfile; registered via registerZatcaProfile() |
| 4 | Zod schemas validate all ZATCA-specific input (VAT number, CSR attributes, invoice fields) | ✓ VERIFIED | `schemas.ts` has zatcaTaxDetailsSchema, zatcaCsrAttributesSchema, zatcaInvoiceFieldsSchema, zatcaEnvironmentSchema |
| 5 | XAdES-BES enveloped signatures are generated using xml-crypto with ECDSA-SHA256 | ✓ VERIFIED | `signer.ts`: ZatcaXAdESSigner implements Signable; uses EXC_C14N, ECDSA_SHA256, xades:SignedProperties |
| 6 | SignedProperties contain signing time, certificate digest, and issuer serial | ✓ VERIFIED | signer.ts lines 188-204 build complete SignedProperties with all three elements |
| 7 | Private key never appears in logs, error messages, or XML output | ✓ VERIFIED | Tests verify key absent from signed output; error messages are generic |
| 8 | TLV binary encoding produces correct byte sequence with tags 1-8 | ✓ VERIFIED | `qr-code.ts` exports encodeTLV/decodeTLV; 16 tests covering TLV roundtrip |
| 9 | QR code contains seller name, VAT number, timestamp, total, and VAT amount (tags 1-5) | ✓ VERIFIED | ZatcaTLVQRCode.generateQR builds all 5 mandatory tags from EInvoice fields |
| 10 | B2B invoices include tags 6-8 (hash, signature, public key) | ✓ VERIFIED | Tags 6-8 conditionally included when extensions.invoiceHash, signatureValue, publicKey present |
| 11 | Hash chain enforces sequential processing per org via advisory lock | ✓ VERIFIED | `zatca-hash-chain.ts`: pg_advisory_xact_lock(hashtext(orgId)), @@unique([orgId, icv]) |
| 12 | Each invoice references the hash of the previous invoice | ✓ VERIFIED | getNextChainEntry returns lastHash as pih for subsequent invoices |
| 13 | First invoice PIH is SHA-256 of literal string '0' | ✓ VERIFIED | Line 55: `const GENESIS_PIH = crypto.createHash("sha256").update("0").digest("hex")` |
| 14 | B2B invoices submitted to clearance endpoint, B2C to reporting | ✗ FAILED | Submission pipeline uses placeholder XML `<Invoice>${invoiceId}</Invoice>` — ZatcaProfile.generate() never called |
| 15 | CSR generation produces ECDSA P-256 key pair with ZATCA-required X.509 attributes | ✓ VERIFIED | `onboarding.ts`: generateZatcaCsr uses prime256v1, builds ASN.1 CSR with all ZATCA subject attributes |
| 16 | Private key stored in Infisical immediately after generation, never returned to client | ✓ VERIFIED | zatca-onboarding.ts: key stored via createZatcaSecretStore, generateAndStoreCsr returns only csrPem |
| 17 | Organization walks through 5-step ZATCA onboarding wizard in Settings > Integrations | ✓ VERIFIED | Page at /settings/integrations/zatca, onboarding-wizard.tsx with 5 step components |
| 18 | ZATCA status badge shows on invoice detail for Saudi org invoices | ✗ FAILED | ZatcaSubmissionDetail and ZatcaStatusBadge are ORPHANED — not rendered in any invoice page |

**Score:** 16/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/einvoice/src/profiles/zatca/index.ts` | ZatcaProfile class implementing EInvoiceProfile | ✓ VERIFIED | Exports ZatcaProfile; profileId="zatca", country="SA"; sign+qrCode wired |
| `packages/einvoice/src/profiles/zatca/generator.ts` | UBL 2.1 XML generator with ZATCA extensions | ✓ VERIFIED | generateZatcaXml() produces complete UBL XML with ICV, PIH, UUID, ProfileID |
| `packages/einvoice/src/profiles/zatca/signer.ts` | ZatcaXAdESSigner implementing Signable | ✓ VERIFIED | Full XAdES-BES implementation with ECDSA-SHA256 and 2-pass signing |
| `packages/einvoice/src/profiles/zatca/qr-code.ts` | ZatcaTLVQRCode implementing QRCodeable | ✓ VERIFIED | encodeTLV, decodeTLV, ZatcaTLVQRCode all present; PNG output verified |
| `packages/einvoice/src/profiles/zatca/schemas.ts` | Zod schemas for ZATCA validation | ✓ VERIFIED | zatcaTaxDetailsSchema, zatcaEnvironmentSchema, zatcaCsrAttributesSchema present |
| `packages/einvoice/src/profiles/zatca/types.ts` | TypeScript types including ZatcaTlvTag | ✓ VERIFIED | ZatcaTlvTag enum, ZatcaInvoiceType, ZatcaInvoiceSubtype all present |
| `packages/einvoice/src/profiles/zatca/onboarding.ts` | CSR generation and compliance test invoices | ✓ VERIFIED | generateZatcaCsr with prime256v1; buildComplianceTestInvoices returns 6 invoices |
| `packages/einvoice/src/profiles/zatca/api-client.ts` | ZatcaApiClient for Fatoora Portal API | ✓ VERIFIED | submitForClearance, submitForReporting, CSID methods; Base64 Auth |
| `packages/db/prisma/schema/zatca.prisma` | ZatcaInvoiceChain model and ZatcaSubmissionStatus enum | ✓ VERIFIED | Model with @@unique([organizationId, icv]); 6-value enum |
| `packages/integrations/src/services/secret-store.ts` | SecretStore interface | ✓ VERIFIED | export interface SecretStore with get, set, delete, list |
| `packages/integrations/src/services/infisical-client.ts` | InfisicalSecretStore with createZatcaSecretStore | ✓ VERIFIED | Both present; factory scopes to /zatca/{orgId} |
| `packages/api/src/services/zatca-hash-chain.ts` | Hash chain with advisory lock | ✓ VERIFIED | acquireChainLock, getNextChainEntry, recordChainEntry all present |
| `packages/api/src/services/zatca-submission.ts` | QStash async submission pipeline | ✗ STUB | submitToZatca and handleZatcaSubmissionJob exist but XML is placeholder |
| `packages/api/src/services/zatca-onboarding.ts` | 5-step onboarding orchestrator | ✓ VERIFIED | All 5 functions present and wired to Infisical and ZatcaApiClient |
| `packages/api/src/routers/zatca.ts` | zatcaRouter tRPC router | ✓ VERIFIED | 11 procedures: saveTaxDetails, generateCsr, requestComplianceCsid, runComplianceChecks, exchangeProductionCert, getOnboardingState, getStatus, getInvoiceChain, resubmit, getComplianceStats |
| `apps/web/src/app/[locale]/(dashboard)/settings/integrations/zatca/page.tsx` | ZATCA settings page | ✓ VERIFIED | Page exists at correct locale-aware path |
| `apps/web/src/components/zatca/onboarding-wizard.tsx` | 5-step wizard with stepper and persistence | ✓ VERIFIED | Wired to zatcaTrpc.getOnboardingState, 5 step components |
| `apps/web/src/components/zatca/zatca-status-badge.tsx` | ZATCA submission status badge | ✓ VERIFIED (orphaned) | 6 variants implemented; not used in invoice pages |
| `apps/web/src/components/zatca/zatca-compliance-widget.tsx` | Compliance card for integrations page | ✓ VERIFIED | Health bar, period stats, wired to zatcaTrpc.getComplianceStats |
| `apps/web/src/components/zatca/zatca-submission-detail.tsx` | Submission detail with QR and hash | ⚠️ ORPHANED | Component defined but not used in any invoice detail page |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/einvoice/src/profiles/zatca/index.ts` | `packages/einvoice/src/types/profile.ts` | implements EInvoiceProfile | ✓ WIRED | `class ZatcaProfile implements EInvoiceProfile` |
| `packages/einvoice/src/profiles/zatca/signer.ts` | `packages/einvoice/src/types/profile.ts` | implements Signable | ✓ WIRED | `class ZatcaXAdESSigner implements Signable` |
| `packages/einvoice/src/profiles/zatca/qr-code.ts` | `packages/einvoice/src/types/profile.ts` | implements QRCodeable | ✓ WIRED | `class ZatcaTLVQRCode implements QRCodeable` |
| `packages/db/prisma/schema/zatca.prisma` | `packages/db/prisma/schema/invoice.prisma` | Invoice relation on ZatcaInvoiceChain | ✓ WIRED | `invoiceId String @unique` + `invoice Invoice @relation(...)` |
| `packages/api/src/services/zatca-submission.ts` | `packages/api/src/services/zatca-hash-chain.ts` | acquires chain lock before signing | ✓ WIRED | `import { acquireChainLock, ... }` + called at line 111 |
| `packages/api/src/services/zatca-submission.ts` | `packages/einvoice/src/profiles/zatca/index.ts` | uses ZatcaProfile for generation, signing, QR | ✗ NOT_WIRED | Comment references ZatcaProfile but actual call is `<Invoice>${invoiceId}</Invoice>` placeholder |
| `packages/api/src/services/zatca-onboarding.ts` | `packages/einvoice/src/profiles/zatca/api-client.ts` | calls ZATCA compliance and CSID endpoints | ✓ WIRED | Dynamic import of ZatcaApiClient; requestComplianceCsid called |
| `packages/api/src/services/zatca-onboarding.ts` | `packages/integrations/src/services/infisical-client.ts` | stores certificates and private key | ✓ WIRED | `import { createZatcaSecretStore }` + used in all onboarding steps |
| `onboarding-wizard.tsx` | `packages/api/src/routers/zatca.ts` | tRPC mutations for wizard steps | ✓ WIRED | Uses zatcaTrpc accessor for all 6 procedures |
| `zatca-status-badge.tsx` | `packages/api/src/routers/zatca.ts` | tRPC query for submission status | ✗ NOT_WIRED | Badge not used in invoice pages; plan references getInvoiceSubmission which doesn't exist (getStatus is equivalent) |
| `packages/api/src/root.ts` | `packages/api/src/routers/zatca.ts` | zatcaRouter registered | ✓ WIRED | `zatca: zatcaRouter` at line 111 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `zatca-submission.ts: submitToZatca` | invoiceXml | Line 122 `<Invoice>${invoiceId}</Invoice>` | No — hardcoded placeholder | ✗ HOLLOW — wired but data disconnected |
| `zatca-compliance-widget.tsx` | stats | zatcaTrpc.getComplianceStats -> prisma.zatcaInvoiceChain.groupBy | Yes — real DB query | ✓ FLOWING |
| `zatca-submission-detail.tsx` | submission prop | Passed by caller | No callers exist in app | ✗ DISCONNECTED |
| `onboarding-wizard.tsx` | stateQuery | zatcaTrpc.getOnboardingState -> prisma.integrationConnection | Yes — real DB query | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: Partially checked via static analysis (no running server available).

| Behavior | Method | Result | Status |
|----------|--------|--------|--------|
| ZatcaProfile.generate() produces non-empty XML | Static: generator.ts substantive check | generateZatcaXml() returns full UBL 2.1 XML string | ✓ PASS |
| submitToZatca sends ZATCA-compliant XML | Static: submission.ts line 122 | `<Invoice>${invoiceId}</Invoice>` — not ZATCA XML | ✗ FAIL |
| zatcaRouter registered in appRouter | Static: root.ts line 111 | zatca: zatcaRouter present | ✓ PASS |
| ZatcaProfile.sign wired | Static: index.ts line 34 | `readonly sign = new ZatcaXAdESSigner()` | ✓ PASS |
| ZatcaProfile.qrCode wired | Static: index.ts line 36 | `readonly qrCode = new ZatcaTLVQRCode()` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ZATCA-01 | 48-01, 48-06 | Platform generates ZATCA-compliant UBL 2.1 XML invoices | ✓ SATISFIED | generateZatcaXml() produces full UBL 2.1 with ICV, PIH, UUID, ProfileID |
| ZATCA-02 | 48-02 | Invoices cryptographically signed using X.509 certificates (XAdES) | ✓ SATISFIED | ZatcaXAdESSigner implements full XAdES-BES with ECDSA-SHA256 |
| ZATCA-03 | 48-03 | Each invoice includes TLV-encoded QR code | ✓ SATISFIED | ZatcaTLVQRCode with encodeTLV/decodeTLV; tags 1-5 mandatory, 6-8 conditional |
| ZATCA-04 | 48-01, 48-04 | Invoice hash chain maintained per organization | ✓ SATISFIED | Hash chain service with advisory lock, @@unique([orgId, icv]), GENESIS_PIH |
| ZATCA-05 | 48-04 | Invoices submitted to ZATCA Fatoora Portal for clearance (B2B) | ✗ BLOCKED | Pipeline structure exists but sends placeholder XML, not actual ZATCA invoice |
| ZATCA-06 | 48-05 | ZATCA device onboarding — CSR generation, CSID, production cert | ✓ SATISFIED | Full 5-step flow implemented: CSR, compliance CSID, 6 test invoices, prod cert |
| ZATCA-07 | 48-04, 48-06 | Platform handles ZATCA reporting for simplified invoices (B2C) | ✗ BLOCKED | isStandard routing exists but same placeholder XML stub prevents actual reporting |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/services/zatca-submission.ts` | 120-122 | `const invoiceXml = \`<Invoice>\${invoiceId}</Invoice>\`` — placeholder XML, never calls ZatcaProfile.generate() | 🛑 Blocker | Prevents goals ZATCA-05 and ZATCA-07: no real ZATCA-compliant XML ever submitted to Fatoora Portal |
| `apps/web/src/components/zatca/zatca-submission-detail.tsx` | — | Component defined but never imported in invoice pages | ⚠️ Warning | ZATCA submission detail (UUID, ICV, QR, hashes) cannot be seen by users on invoice detail |
| `packages/einvoice/src/profiles/zatca/generator.ts` | 260 | QR code placeholder in AdditionalDocumentReference | ℹ️ Info | QR data not embedded in XML directly (QR generated separately via profile.qrCode); acceptable design choice |

### Human Verification Required

#### 1. ZATCA Onboarding Wizard Visual Verification

**Test:** Navigate to Settings > Integrations > ZATCA
**Expected:** Empty state shows "Connect to ZATCA" with CTA; clicking opens 5-step wizard with horizontal stepper; Step 1 validates VAT number (^3\d{13}3$), Arabic org name, and address; all steps match 48-UI-SPEC.md wireframes
**Why human:** Visual appearance, copy text, responsive layout cannot be verified programmatically

#### 2. Stepper Keyboard Navigation and Accessibility

**Test:** Tab to stepper, use arrow keys to navigate, verify aria-current="step" updates
**Expected:** Arrow keys cycle through steps, Enter selects; role="tablist" with correct ARIA attributes; screen reader announces current step
**Why human:** Keyboard behavior and screen reader output requires manual browser testing

#### 3. Environment Toggle Confirmation

**Test:** With production active, click Sandbox — verify confirmation dialog appears; with sandbox active and no onboarding, click Production — verify it blocks
**Expected:** Production->Sandbox requires confirmation; Sandbox->Production requires completed onboarding
**Why human:** Dialog interaction and conditional flow requires manual testing

### Gaps Summary

**2 gaps blocking goal achievement:**

**Gap 1 (Blocker): Submission pipeline uses placeholder XML**

`zatca-submission.ts` line 122 creates `<Invoice>${invoiceId}</Invoice>` instead of calling `ZatcaProfile.generate(eInvoice)`. This means:
- The XAdES-BES signer (Plan 02) is never invoked during submission
- The TLV QR code (Plan 03) is never embedded
- The UBL 2.1 XML with ICV/PIH/UUID (Plan 01) is never sent
- The hash computed (line 123) is SHA-256 of `"<Invoice>ID</Invoice>"`, not of real ZATCA XML

The pipeline structure is complete and correct (lock -> chain -> generate -> sign -> hash -> QR -> record -> submit) but the generate step was left as a stub. The Plan 04 SUMMARY acknowledges this: "Invoice XML generation uses placeholder `<Invoice>${invoiceId}</Invoice>` -- will be replaced when full EInvoice pipeline wiring is complete in subsequent plans."

**Gap 2 (Warning): ZatcaStatusBadge and ZatcaSubmissionDetail are orphaned**

Both components are created but not integrated into invoice list/detail pages. Plan 06's key_link stated the badge would wire to `trpc.zatca.getInvoiceSubmission` but this procedure was never created (getStatus serves the same purpose). The invoice detail page has no ZATCA submission information visible to users for Saudi org invoices.

---

_Verified: 2026-04-12T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
