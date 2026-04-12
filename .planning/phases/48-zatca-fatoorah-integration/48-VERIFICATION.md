---
phase: 48-zatca-fatoorah-integration
verified: 2026-04-12T10:15:00Z
status: human_needed
score: 18/18 must-haves verified
re_verification: true
previous_status: gaps_found
previous_score: 16/18
gaps_closed:
  - "B2B invoices submitted to clearance endpoint, B2C to reporting — submitToZatca() now calls ZatcaProfile.generate(), profile.sign.sign(), and profile.qrCode.generateQR() with a real EInvoice built from Prisma data; no placeholder XML remains"
  - "ZATCA status badge shows on invoice detail for Saudi org invoices — ZatcaStatusBadge and ZatcaSubmissionDetail are now imported and rendered in the invoice detail page"
gaps_remaining: []
regressions: []
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
  - test: "ZATCA Status Badge on Invoice Detail"
    expected: "For a Saudi org invoice that has been submitted to ZATCA, the badge appears in the header next to the invoice status badge; badge text matches zatcaStatus value (e.g. Cleared, Reported, Rejected)"
    why_human: "Requires an actual ZatcaInvoiceChain record in DB to test conditional rendering"
  - test: "ZatcaSubmissionDetail Panel on Invoice Detail"
    expected: "For a Saudi org invoice with a ZATCA chain entry, the collapsible panel renders below content sections showing UUID, ICV, hash chain display, QR code image, and resubmit action button"
    why_human: "Requires actual submission data in DB and visual verification of panel layout"
---

# Phase 48: ZATCA Fatoorah Integration Verification Report

**Phase Goal:** Saudi organizations can submit e-invoices to ZATCA for clearance (B2B) and reporting (B2C) with full cryptographic compliance
**Verified:** 2026-04-12T10:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure via plans 48-07 and 48-08

## Re-verification Summary

Previous status: `gaps_found` (16/18)
Current status: `human_needed` (18/18)

Both gaps from the initial verification are now closed:

| Gap | Previous Status | Current Status | Closed By |
|-----|-----------------|----------------|-----------|
| Submission pipeline used placeholder XML | BLOCKER | RESOLVED | Plan 48-07 (commits a95a71d, 49c9c2d) |
| ZatcaStatusBadge / ZatcaSubmissionDetail orphaned | WARNING | RESOLVED | Plan 48-08 (commits bf2179e, 49e2109) |

No regressions detected in the 16 previously-passing truths.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ZATCA profile generates valid UBL 2.1 XML with ICV, PIH, UUID, and ProfileID extensions | VERIFIED | `generator.ts` generates full XML with all extensions; ZatcaProfile.generate() calls generateZatcaXml() |
| 2 | ZatcaInvoiceChain Prisma model tracks per-org sequential invoice chain with submission status | VERIFIED | `zatca.prisma` has complete model with @@unique([organizationId, icv]), 6-status enum |
| 3 | ZATCA profile plugs into the e-invoicing engine without modifying engine core | VERIFIED | ZatcaProfile implements EInvoiceProfile; registered via registerZatcaProfile() |
| 4 | Zod schemas validate all ZATCA-specific input (VAT number, CSR attributes, invoice fields) | VERIFIED | `schemas.ts` has zatcaTaxDetailsSchema, zatcaCsrAttributesSchema, zatcaInvoiceFieldsSchema, zatcaEnvironmentSchema |
| 5 | XAdES-BES enveloped signatures are generated using xml-crypto with ECDSA-SHA256 | VERIFIED | `signer.ts`: ZatcaXAdESSigner implements Signable; uses EXC_C14N, ECDSA_SHA256, xades:SignedProperties |
| 6 | SignedProperties contain signing time, certificate digest, and issuer serial | VERIFIED | signer.ts lines 188-204 build complete SignedProperties with all three elements |
| 7 | Private key never appears in logs, error messages, or XML output | VERIFIED | grep confirms no console.log/warn/error line exposes privateKey variable; error messages use generic strings; certInfo is local scope only |
| 8 | TLV binary encoding produces correct byte sequence with tags 1-8 | VERIFIED | `qr-code.ts` exports encodeTLV/decodeTLV; 16 tests covering TLV roundtrip |
| 9 | QR code contains seller name, VAT number, timestamp, total, and VAT amount (tags 1-5) | VERIFIED | ZatcaTLVQRCode.generateQR builds all 5 mandatory tags from EInvoice fields |
| 10 | B2B invoices include tags 6-8 (hash, signature, public key) | VERIFIED | Tags 6-8 conditionally included when extensions.invoiceHash, signatureValue, publicKey present |
| 11 | Hash chain enforces sequential processing per org via advisory lock | VERIFIED | `zatca-hash-chain.ts`: pg_advisory_xact_lock(hashtext(orgId)), @@unique([orgId, icv]) |
| 12 | Each invoice references the hash of the previous invoice | VERIFIED | getNextChainEntry returns lastHash as pih for subsequent invoices |
| 13 | First invoice PIH is SHA-256 of literal string '0' | VERIFIED | `const GENESIS_PIH = crypto.createHash("sha256").update("0").digest("hex")` |
| 14 | B2B invoices submitted to clearance endpoint, B2C to reporting | VERIFIED (GAP CLOSED) | submitToZatca() calls profile.generate(eInvoice) at line 141, profile.sign.sign() at line 145, profile.qrCode.generateQR() at line 160; B2B vs B2C routing via isStandardInvoice(); no placeholder XML |
| 15 | CSR generation produces ECDSA P-256 key pair with ZATCA-required X.509 attributes | VERIFIED | `onboarding.ts`: generateZatcaCsr uses prime256v1, builds ASN.1 CSR with all ZATCA subject attributes |
| 16 | Private key stored in Infisical immediately after generation, never returned to client | VERIFIED | zatca-onboarding.ts: key stored via createZatcaSecretStore, generateAndStoreCsr returns only csrPem |
| 17 | Organization walks through 5-step ZATCA onboarding wizard in Settings > Integrations | VERIFIED | Page at /settings/integrations/zatca, onboarding-wizard.tsx with 5 step components |
| 18 | ZATCA status badge shows on invoice detail for Saudi org invoices | VERIFIED (GAP CLOSED) | ZatcaStatusBadge imported at line 27, rendered at line 274; ZatcaSubmissionDetail imported at line 28, rendered at line 338; zatcaTrpc.getStatus query wired at line 165 |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/einvoice/src/profiles/zatca/index.ts` | ZatcaProfile class implementing EInvoiceProfile | VERIFIED | Exports ZatcaProfile; profileId="zatca", country="SA"; sign+qrCode wired |
| `packages/einvoice/src/profiles/zatca/generator.ts` | UBL 2.1 XML generator with ZATCA extensions | VERIFIED | generateZatcaXml() produces complete UBL XML with ICV, PIH, UUID, ProfileID |
| `packages/einvoice/src/profiles/zatca/signer.ts` | ZatcaXAdESSigner implementing Signable | VERIFIED | Full XAdES-BES implementation with ECDSA-SHA256 and 2-pass signing |
| `packages/einvoice/src/profiles/zatca/qr-code.ts` | ZatcaTLVQRCode implementing QRCodeable | VERIFIED | encodeTLV, decodeTLV, ZatcaTLVQRCode all present; PNG output verified |
| `packages/einvoice/src/profiles/zatca/schemas.ts` | Zod schemas for ZATCA validation | VERIFIED | zatcaTaxDetailsSchema, zatcaEnvironmentSchema, zatcaCsrAttributesSchema present |
| `packages/einvoice/src/profiles/zatca/types.ts` | TypeScript types including ZatcaTlvTag | VERIFIED | ZatcaTlvTag enum, ZatcaInvoiceType, ZatcaInvoiceSubtype all present |
| `packages/einvoice/src/profiles/zatca/onboarding.ts` | CSR generation and compliance test invoices | VERIFIED | generateZatcaCsr with prime256v1; buildComplianceTestInvoices returns 6 invoices |
| `packages/einvoice/src/profiles/zatca/api-client.ts` | ZatcaApiClient for Fatoora Portal API | VERIFIED | submitForClearance, submitForReporting, CSID methods; Base64 Auth |
| `packages/db/prisma/schema/zatca.prisma` | ZatcaInvoiceChain model and ZatcaSubmissionStatus enum | VERIFIED | Model with @@unique([organizationId, icv]); 6-value enum |
| `packages/integrations/src/services/secret-store.ts` | SecretStore interface | VERIFIED | export interface SecretStore with get, set, delete, list |
| `packages/integrations/src/services/infisical-client.ts` | InfisicalSecretStore with createZatcaSecretStore | VERIFIED | Both present; factory scopes to /zatca/{orgId} |
| `packages/api/src/services/zatca-hash-chain.ts` | Hash chain with advisory lock | VERIFIED | acquireChainLock, getNextChainEntry, recordChainEntry all present |
| `packages/api/src/services/zatca-submission.ts` | Full ZATCA submission pipeline | VERIFIED (GAP CLOSED) | ZatcaProfile imported (line 27); new ZatcaProfile() at line 140; profile.generate() at line 141; profile.sign.sign() at line 145; profile.qrCode.generateQR() at line 160; buildEInvoiceFromPrisma() at line 328; no placeholder XML present |
| `packages/api/src/services/zatca-onboarding.ts` | 5-step onboarding orchestrator | VERIFIED | All 5 functions present and wired to Infisical and ZatcaApiClient |
| `packages/api/src/routers/zatca.ts` | zatcaRouter tRPC router | VERIFIED | 11 procedures present; getStatus select includes invoiceHash: true and previousHash: true (lines 123-124) |
| `apps/web/src/app/[locale]/(dashboard)/settings/integrations/zatca/page.tsx` | ZATCA settings page | VERIFIED | Page exists at correct locale-aware path |
| `apps/web/src/components/zatca/onboarding-wizard.tsx` | 5-step wizard with stepper and persistence | VERIFIED | Wired to zatcaTrpc.getOnboardingState, 5 step components |
| `apps/web/src/components/zatca/zatca-status-badge.tsx` | ZATCA submission status badge | VERIFIED (GAP CLOSED) | 6 variants implemented; imported at line 27 and rendered at line 274 of invoice detail page |
| `apps/web/src/components/zatca/zatca-compliance-widget.tsx` | Compliance card for integrations page | VERIFIED | Health bar, period stats, wired to zatcaTrpc.getComplianceStats |
| `apps/web/src/components/zatca/zatca-submission-detail.tsx` | Submission detail with QR and hash | VERIFIED (GAP CLOSED) | Imported at line 28 and rendered at line 338 of invoice detail page |
| `apps/web/src/components/zatca/zatca-trpc.ts` | Typed zatcaTrpc accessor | VERIFIED (GAP CLOSED) | ZatcaSubmissionResult interface exported with invoiceHash: string and previousHash: string at lines 37-51 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `zatca-submission.ts` | `zatca/index.ts` (ZatcaProfile) | `new ZatcaProfile()` + `profile.generate(eInvoice)` | WIRED | Lines 27-28 import; lines 140-141 instantiate and generate |
| `zatca-submission.ts` | `zatca/signer.ts` (ZatcaXAdESSigner) | `profile.sign.sign(unsignedXml, certInfo)` | WIRED | Line 145; certInfo.privateKey retrieved from Infisical |
| `zatca-submission.ts` | `zatca/qr-code.ts` (ZatcaTLVQRCode) | `profile.qrCode.generateQR(qrEInvoice)` | WIRED | Line 160; qrEInvoice enriched with invoiceHash, signatureValue, publicKey |
| `invoices/[id]/page.tsx` | `zatca-status-badge.tsx` | `import { ZatcaStatusBadge }` | WIRED | Line 27 import; line 274 JSX guarded by `hasZatcaSubmission` |
| `invoices/[id]/page.tsx` | `zatca-submission-detail.tsx` | `import { ZatcaSubmissionDetail }` | WIRED | Line 28 import; line 338 JSX guarded by `hasZatcaSubmission` |
| `invoices/[id]/page.tsx` | `zatca.ts` router (getStatus) | `zatcaTrpc.getStatus.queryOptions({ invoiceId })` | WIRED | Line 165; query enabled when `!!invoice` |
| `zatca.ts` router (getStatus) | ZatcaInvoiceChain model | Prisma select with invoiceHash and previousHash | WIRED | Lines 123-124 of zatca.ts |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `zatca-submission.ts` | invoiceXml (signed XML) | `ZatcaProfile().generate()` then `profile.sign.sign()` | Yes — generated from Prisma invoice via buildEInvoiceFromPrisma | FLOWING |
| `zatca-submission.ts` | invoiceHash | `createHash("sha256").update(signedXml).digest("hex")` | Yes — SHA-256 of real signed XML | FLOWING |
| `zatca-submission.ts` | qrBase64 | `profile.qrCode.generateQR(qrEInvoice)` | Yes — TLV-encoded from EInvoice fields | FLOWING |
| `invoices/[id]/page.tsx` | zatcaSubmission | `zatcaTrpc.getStatus.queryOptions({ invoiceId })` -> Prisma ZatcaInvoiceChain | Yes — DB query with full select including hash fields | FLOWING |
| `ZatcaSubmissionDetail` | submission prop | zatcaSubmission passed from parent | Yes — flows from getStatus query result | FLOWING |
| `ZatcaStatusBadge` | status prop | `zatcaSubmission.zatcaStatus` | Yes — from ZatcaInvoiceChain.zatcaStatus field | FLOWING |
| `zatca-compliance-widget.tsx` | stats | zatcaTrpc.getComplianceStats -> prisma.zatcaInvoiceChain.groupBy | Yes — real DB aggregation | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Network-dependent behaviors (ZATCA API calls) cannot be tested without a running server. Static checks run below.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| No placeholder XML in submission pipeline | `grep "placeholder\|<Invoice>.*invoiceId" zatca-submission.ts` | No matches | PASS |
| ZatcaProfile imported and called in submission | `grep "ZatcaProfile\|profile\.generate" zatca-submission.ts` | 4 matches (import, class comment, instantiation, generate call) | PASS |
| profile.sign.sign() called in submission | `grep "profile\.sign\.sign" zatca-submission.ts` | Confirmed at line 145 | PASS |
| profile.qrCode.generateQR() called in submission | `grep "qrCode\.generateQR" zatca-submission.ts` | Confirmed at line 160 | PASS |
| ZATCA components in invoice detail page | `grep -c "ZatcaStatusBadge\|ZatcaSubmissionDetail\|zatcaTrpc" page.tsx` | 7 matches | PASS |
| getStatus select includes hash fields | `grep "invoiceHash\|previousHash" zatca.ts` | Lines 123-124 confirmed | PASS |
| ZatcaSubmissionResult type with hash fields | `grep -c "ZatcaSubmissionResult\|invoiceHash.*string\|previousHash.*string" zatca-trpc.ts` | 3 matches | PASS |
| Gap-closure commits exist in git | `git log --oneline a95a71d 49c9c2d bf2179e 49e2109` | All 4 commits confirmed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| ZATCA-01 | 48-01, 48-07, 48-08 | Platform generates ZATCA-compliant UBL 2.1 XML invoices with all mandatory fields | SATISFIED | generator.ts produces full UBL 2.1; now called via real pipeline in submitToZatca() |
| ZATCA-02 | 48-02, 48-07 | Invoices cryptographically signed using X.509 certificates (XAdES enveloped signatures) | SATISFIED | signer.ts ZatcaXAdESSigner; profile.sign.sign() called at submission time with Infisical-retrieved private key |
| ZATCA-03 | 48-03, 48-07 | Each invoice includes TLV-encoded QR code | SATISFIED | qr-code.ts ZatcaTLVQRCode; profile.qrCode.generateQR() called at submission time |
| ZATCA-04 | 48-01, 48-04 | Invoice hash chain maintained per organization | SATISFIED | zatca-hash-chain.ts with advisory lock; PIH flows from SHA-256 of previous signed XML; GENESIS_PIH for first invoice |
| ZATCA-05 | 48-04, 48-07 | Invoices submitted to ZATCA Fatoora Portal for clearance (B2B tax invoices) | SATISFIED | submitForClearance() called when isStandardInvoice(); real signed XML submitted as Base64; ZATCA-compliant payload structure |
| ZATCA-06 | 48-05 | Platform supports ZATCA device onboarding — CSR generation, CSID request, production certificate exchange | SATISFIED | Full 5-step flow: CSR generation, compliance CSID, 6 compliance test invoices, production cert exchange |
| ZATCA-07 | 48-04, 48-07 | Platform handles ZATCA reporting for simplified invoices (B2C) | SATISFIED | submitForReporting() called when !isStandardInvoice(); real signed XML submitted; same pipeline as clearance |

No orphaned requirements. All 7 ZATCA requirement IDs are covered by at least one plan and have verifiable implementation evidence. REQUIREMENTS.md marks all 7 as [x] complete and maps them to Phase 48.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No stub patterns, placeholder comments, or empty implementations detected in gap-closure files. The `as any` cast at line 170 of the invoice detail page is an intentional, documented workaround for TypeScript depth limits with 40+ sub-routers (same pattern established for Peppol). Does not affect runtime correctness.

---

### Human Verification Required

#### 1. ZATCA Settings Wizard Visual Verification

**Test:** Navigate to Settings > Integrations > ZATCA in a browser
**Expected:** 5-step onboarding wizard renders correctly; stepper shows horizontal on desktop and vertical on mobile; all step forms validate before allowing Next; copy matches 48-UI-SPEC.md
**Why human:** Visual appearance, responsive behavior, and exact copy cannot be verified programmatically

#### 2. Onboarding Wizard Keyboard Navigation

**Test:** Focus the stepper in the ZATCA onboarding wizard and use keyboard navigation
**Expected:** Arrow keys navigate between stepper steps, Enter selects, aria-current='step' is correct, screen reader announces step changes
**Why human:** Keyboard navigation and screen reader behavior requires manual testing

#### 3. Environment Toggle Confirmation Flow

**Test:** Toggle between Production and Sandbox environments in ZATCA settings
**Expected:** Production -> Sandbox shows confirmation dialog; Sandbox -> Production requires completed onboarding; selected environment shows ring-2 ring-primary styling
**Why human:** Dialog behavior and visual ring styling requires manual testing

#### 4. ZATCA Status Badge on Invoice Detail

**Test:** Open an invoice detail page for an invoice belonging to a Saudi organization that has been through the ZATCA submission pipeline
**Expected:** ZatcaStatusBadge appears in the header next to the invoice status badge; badge text matches zatcaStatus value (e.g. Cleared, Reported, Rejected)
**Why human:** Requires an actual ZatcaInvoiceChain record in DB to test conditional rendering

#### 5. ZatcaSubmissionDetail Panel on Invoice Detail

**Test:** Open the same invoice detail page as item 4
**Expected:** Collapsible ZATCA submission panel renders below content sections showing UUID, ICV counter, hash chain display, QR code image, and resubmit action button
**Why human:** Requires actual submission data in DB and visual verification of panel layout and content

---

### Gaps Summary

No gaps remain. Both blockers from the initial verification have been closed.

**Gap 1 (Blocker) — CLOSED:** `packages/api/src/services/zatca-submission.ts` previously contained `<Invoice>${invoiceId}</Invoice>` placeholder XML at line 122. Plan 48-07 replaced this with a full pipeline: `buildEInvoiceFromPrisma()` converts Prisma invoice data to `EInvoice`, `ZatcaProfile().generate(eInvoice)` produces UBL 2.1 XML, `profile.sign.sign()` applies XAdES-BES signature with the Infisical-retrieved private key, `profile.qrCode.generateQR()` generates TLV QR code, and `createHash("sha256")` computes the real invoice hash. The invoice query now includes `lines` relation. Private key is scoped locally and never logged.

**Gap 2 (Warning) — CLOSED:** `ZatcaStatusBadge` and `ZatcaSubmissionDetail` were orphaned components. Plan 48-08 wired them into `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` following the established Peppol integration pattern. Components render conditionally when `zatcaSubmissionQuery.data` is truthy. `zatca-trpc.ts` was updated to export `ZatcaSubmissionResult` with `invoiceHash` and `previousHash` fields matching the updated router select from Plan 48-07. The `getStatus` tRPC select now returns both hash fields (lines 123-124 of zatca.ts).

All 18 observable truths are now verified. The phase goal is achieved at the code level. 5 items require human (visual/behavioral) verification before the phase can be considered fully production-ready.

---

_Verified: 2026-04-12T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — closing 2 gaps from initial verification (2026-04-12T01:30:00Z)_
