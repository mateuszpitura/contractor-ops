---
phase: 49-peppol-pint-ae-integration
verified: 2026-04-12T01:45:00Z
status: gaps_found
score: 12/16 must-haves verified
gaps:
  - truth: "Invoice detail view shows Peppol transmission status with timeline for outbound invoices"
    status: failed
    reason: "PeppolTransmissionStatus component exists in components/peppol/ but is never imported or used by any invoice detail view. It is orphaned."
    artifacts:
      - path: "apps/web/src/components/peppol/peppol-transmission-status.tsx"
        issue: "Exported but no consuming page or component imports it"
    missing:
      - "Import and render <PeppolTransmissionStatus> in the invoice detail page/component when peppol transmission data is present"
  - truth: "Inbound Peppol invoices display origin banner with sender participant ID"
    status: failed
    reason: "PeppolInboundBanner component exists but is never imported or rendered anywhere in the app."
    artifacts:
      - path: "apps/web/src/components/peppol/peppol-inbound-banner.tsx"
        issue: "Exported but no consuming page or component imports it"
    missing:
      - "Import and conditionally render <PeppolInboundBanner> in the invoice detail view when invoice.source === 'PEPPOL'"
  - truth: "UAE QR code is displayed on invoice detail for Peppol-AE invoices"
    status: failed
    reason: "PeppolQRDisplay component exists but is never imported or rendered anywhere in the app."
    artifacts:
      - path: "apps/web/src/components/peppol/peppol-qr-display.tsx"
        issue: "Exported but no consuming page or component imports it"
    missing:
      - "Import and conditionally render <PeppolQRDisplay> in the invoice detail view when QR data is present for Peppol-AE invoices"
  - truth: "Dashboard compliance widget shows Peppol profile status alongside other e-invoicing profiles"
    status: failed
    reason: "PeppolComplianceWidget component exists but is never imported or rendered in the dashboard or any compliance section."
    artifacts:
      - path: "apps/web/src/components/peppol/peppol-compliance-widget.tsx"
        issue: "Exported but no consuming page or component imports it"
    missing:
      - "Import and render <PeppolComplianceWidget> in the existing dashboard compliance section (alongside KSeF/ZATCA compliance rows)"
human_verification:
  - test: "Complete 5-step Peppol wizard in the browser"
    expected: "All 5 steps render with correct copy, TRN validation, ASP selection, API key field, progress indicator, and success confirmation"
    why_human: "Visual/interactive wizard flow cannot be verified programmatically"
  - test: "Verify PeppolStatusCard renders correctly in Settings > Integrations for disconnected state"
    expected: "Empty state shows 'Connect to Peppol' CTA that opens the wizard dialog"
    why_human: "UI rendering and dialog interaction requires browser"
---

# Phase 49: Peppol PINT-AE Integration Verification Report

**Phase Goal:** UAE organizations can send and receive e-invoices through the Peppol network via a certified ASP
**Verified:** 2026-04-12T01:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PeppolAEProfile is registered in the engine registry under profileId 'peppol-ae' | ✓ VERIFIED | `PeppolAEProfile` implements `EInvoiceProfile`, `registerProfile()` tested in 22 passing tests; `registerPeppolAEProfile()` exported from index. PeppolOrchestrator instantiates profile directly (consistent with KSeF pattern). |
| 2 | PeppolAEProfile.generate() produces valid PINT-AE UBL 2.1 XML with correct CustomizationID and ProfileID | ✓ VERIFIED | generator.ts uses `PINT_AE_CUSTOMIZATION_ID` and builds correct UBL 2.1 structure; 5 generator tests pass |
| 3 | PeppolAEProfile.parse() correctly converts PINT-AE UBL 2.1 XML to canonical EInvoice | ✓ VERIFIED | parser.ts implemented; roundtrip tests pass (5 parser tests) |
| 4 | PeppolAEProfile.validate() enforces UAE-specific PINT-AE business rules | ✓ VERIFIED | validator.ts checks CustomizationID, BuyerReference, supplier TRN (0192), tax subtotals, line amounts; 5 validator tests pass |
| 5 | QR code generation produces PNG buffer containing seller name, TRN, date, total, VAT | ✓ VERIFIED | qr-code.ts uses `QRCode.toBuffer()` with pipe-delimited format; 2 QR tests pass |
| 6 | ASPAdapter interface is defined for vendor-agnostic ASP communication | ✓ VERIFIED | `packages/einvoice/src/asp/types.ts` exports full `ASPAdapter` interface with 8 methods |
| 7 | PeppolParticipant model exists with organizationId, participantId, schemeId, identifierValue, aspProvider, status | ✓ VERIFIED | `packages/db/prisma/schema/peppol.prisma` contains all required fields + relations |
| 8 | PeppolTransmission model exists with organizationId, invoiceId, direction, aspTransmissionId, status, xmlPayload | ✓ VERIFIED | `peppol.prisma` — all fields present with proper indexing |
| 9 | IntegrationProvider enum includes PEPPOL | ✓ VERIFIED | Line 122 in `integration.prisma` |
| 10 | InvoiceSource enum includes PEPPOL | ✓ VERIFIED | Line 143 in `invoice.prisma` |
| 11 | tRPC peppol router exposes connect, disconnect, getStatus, getParticipant, getTransmissions endpoints | ✓ VERIFIED | All 6 endpoints confirmed in `packages/api/src/routers/peppol.ts`; registered in `root.ts` line 108 |
| 12 | StorecoveAdapter implements ASPAdapter interface and can transmit invoices via REST API | ✓ VERIFIED | `adapter.ts` — `class StorecoveAdapter implements ASPAdapter`; 8 adapter tests pass including HMAC verification |
| 13 | Organization admin can complete 5-step Peppol connection wizard and register their Participant ID | ✓ VERIFIED | `peppol-wizard.tsx` — all 5 step conditions present (step === 1..5); `peppol.connect` mutation wired; PeppolStatusCard imported in integrations-tab.tsx |
| 14 | Invoice detail view shows Peppol transmission status with timeline for outbound invoices | ✗ FAILED | `PeppolTransmissionStatus` exists but is not imported or rendered in any invoice detail page |
| 15 | Inbound Peppol invoices display origin banner with sender participant ID | ✗ FAILED | `PeppolInboundBanner` exists but is not imported or rendered anywhere in the app |
| 16 | UAE QR code is displayed on invoice detail for Peppol-AE invoices | ✗ FAILED | `PeppolQRDisplay` exists but is not imported or rendered anywhere in the app |
| 17 | Dashboard compliance widget shows Peppol profile status alongside other e-invoicing profiles | ✗ FAILED | `PeppolComplianceWidget` exists but is not imported or rendered in any dashboard or compliance section |

**Score:** 12/16 truths verified (truths 14, 15, 16, 17 failed — Plan 04 wiring gaps)

Note: Truth 13 "Connected organizations see Peppol status card with connection details and transmission counts" is partially satisfied — `PeppolStatusCard` is imported and rendered in `integrations-tab.tsx` — but the dedicated settings page at `app/(dashboard)/settings/integrations/peppol/page.tsx` was not created (components live in `components/peppol/` instead).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/einvoice/src/profiles/peppol-ae/index.ts` | PeppolAEProfile class | ✓ VERIFIED | Implements EInvoiceProfile; profileId="peppol-ae", country="AE", sign=undefined, qrCode=PeppolAEQRCode |
| `packages/einvoice/src/asp/types.ts` | Abstract ASP adapter interface | ✓ VERIFIED | 8-method ASPAdapter interface + all required types |
| `packages/einvoice/src/__tests__/peppol-ae.test.ts` | Unit tests | ✓ VERIFIED | 22 tests, all passing |
| `packages/db/prisma/schema/peppol.prisma` | PeppolParticipant + PeppolTransmission models | ✓ VERIFIED | Both models + 2 enums, proper indexing |
| `packages/api/src/routers/peppol.ts` | tRPC peppol router | ✓ VERIFIED | 6 endpoints, all use tenantProcedure, credentials encrypted via storeCredentials |
| `packages/validators/src/peppol.ts` | Zod validation schemas | ✓ VERIFIED | connectPeppolSchema, peppolParticipantIdSchema, and others exported |
| `packages/einvoice/src/asp/storecove/adapter.ts` | StorecoveAdapter implementing ASPAdapter | ✓ VERIFIED | class StorecoveAdapter implements ASPAdapter with HMAC-SHA256 |
| `packages/api/src/services/peppol-orchestrator.ts` | PeppolOrchestrator | ✓ VERIFIED | submitOutboundInvoice, processInboundInvoice, pollAndProcessInbound; sets source="PEPPOL" |
| `apps/web/src/app/api/peppol/outbound/route.ts` | QStash outbound route | ✓ VERIFIED | export const POST = verifySignatureAppRouter(handler) |
| `apps/web/src/app/api/peppol/inbound/route.ts` | QStash inbound route | ✓ VERIFIED | export const POST = verifySignatureAppRouter(handler) |
| `apps/web/src/app/api/peppol/poll/route.ts` | QStash poll route | ✓ VERIFIED | export const POST = verifySignatureAppRouter(handler) |
| `apps/web/src/components/peppol/peppol-wizard.tsx` | 5-step connection wizard | ✓ VERIFIED | All 5 steps present; peppol.connect wired |
| `apps/web/src/components/peppol/peppol-status-card.tsx` | Status card | ✓ VERIFIED | peppol.getStatus + peppol.disconnect wired; imported in integrations-tab.tsx |
| `apps/web/src/components/peppol/peppol-transmission-status.tsx` | Transmission status component | ⚠️ ORPHANED | Component exists and is substantive, but no parent imports it |
| `apps/web/src/components/peppol/peppol-inbound-banner.tsx` | Inbound banner component | ⚠️ ORPHANED | Component exists and is substantive, but no parent imports it |
| `apps/web/src/components/peppol/peppol-qr-display.tsx` | QR display component | ⚠️ ORPHANED | Component exists and is substantive, but no parent imports it |
| `apps/web/src/components/peppol/peppol-compliance-widget.tsx` | Compliance widget | ⚠️ ORPHANED | Component exists and is substantive, but no parent imports it |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `peppol-ae/index.ts` | `types/profile.ts` | implements EInvoiceProfile | ✓ WIRED | `class PeppolAEProfile implements EInvoiceProfile` |
| `asp/storecove/adapter.ts` | `asp/types.ts` | implements ASPAdapter | ✓ WIRED | `class StorecoveAdapter implements ASPAdapter` |
| `api/src/services/peppol-orchestrator.ts` | `asp/storecove/adapter.ts` | uses adapter for transmission | ✓ WIRED | Constructor accepts `ASPAdapter`; routes instantiate `StorecoveAdapter` |
| `apps/web/src/app/api/peppol/outbound/route.ts` | `peppol-orchestrator.ts` | QStash job handler | ✓ WIRED | Imports `PeppolOrchestrator` from `@contractor-ops/api/services/peppol-orchestrator` |
| `packages/api/src/routers/peppol.ts` | `packages/db/prisma/schema/peppol.prisma` | prisma.peppolParticipant | ✓ WIRED | `prisma.peppolParticipant.findFirst/create/update` used |
| `packages/api/src/routers/_app.ts` (root.ts) | `packages/api/src/routers/peppol.ts` | router merge | ✓ WIRED | `peppol: peppolRouter` at line 108 in root.ts |
| `peppol-wizard.tsx` | `packages/api/src/routers/peppol.ts` | tRPC peppol.connect mutation | ✓ WIRED | `trpc.peppol.connect.mutationOptions(...)` |
| `peppol-status-card.tsx` | `packages/api/src/routers/peppol.ts` | tRPC peppol.getStatus/disconnect | ✓ WIRED | Both queries/mutations present |
| `peppol-transmission-status.tsx` | `packages/api/src/routers/peppol.ts` | tRPC peppol.getTransmissions | ⚠️ PARTIAL | References `getTransmissions` for cache invalidation; component itself is orphaned |
| `peppol-compliance-widget.tsx` | dashboard compliance section | component render | ✗ NOT_WIRED | Widget not imported by any dashboard or compliance page |
| `peppol-inbound-banner.tsx` | invoice detail view | conditional render | ✗ NOT_WIRED | Banner not imported by any invoice detail component |
| `peppol-qr-display.tsx` | invoice detail view | conditional render | ✗ NOT_WIRED | QR display not imported by any invoice detail component |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `peppol-status-card.tsx` | `statusQuery.data` | `trpc.peppol.getStatus.queryOptions()` | Yes — queries `prisma.peppolParticipant.findFirst` + `prisma.integrationConnection.findFirst` | ✓ FLOWING |
| `peppol-wizard.tsx` | mutation result | `trpc.peppol.connect.mutationOptions()` | Yes — creates PeppolParticipant + IntegrationConnection in DB | ✓ FLOWING |
| `peppol-orchestrator.ts` | `invoice` | `prisma.invoice.findUniqueOrThrow()` | Yes — loads from DB | ✓ FLOWING |
| `peppol-orchestrator.ts` | created Invoice (inbound) | `prisma.invoice.create()` with `source: "PEPPOL"` | Yes — writes real DB record | ✓ FLOWING |
| `peppol-compliance-widget.tsx` | `status` prop | Not connected — no caller | No | ✗ HOLLOW_PROP |
| `peppol-transmission-status.tsx` | `transmission` prop | Not connected — no caller | No | ✗ HOLLOW_PROP |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| PeppolAE profile — 22 unit tests | `npx vitest run peppol-ae` in packages/einvoice | 22 passed, 0 failed | ✓ PASS |
| StorecoveAdapter — 8 unit tests | `npx vitest run storecove-adapter` in packages/einvoice | 8 passed, 0 failed | ✓ PASS |
| PeppolAE constants present | grep PINT_AE_CUSTOMIZATION_ID in constants.ts | `"urn:peppol:pint:billing-1@uae-1.0"` found | ✓ PASS |
| peppol router registered in root | grep peppolRouter in root.ts | `peppol: peppolRouter` at line 108 | ✓ PASS |
| QStash routes export POST | grep "export const POST" in all 3 route files | All 3 export `verifySignatureAppRouter(handler)` | ✓ PASS |
| Orphaned UI components | grep -rn "PeppolComplianceWidget\|PeppolInboundBanner\|PeppolQRDisplay\|PeppolTransmissionStatus" | No imports outside own files | ✗ FAIL (4 components orphaned) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| PEPPOL-01 | 49-01, 49-02, 49-04 | Platform generates Peppol PINT-AE compliant UBL 2.1 XML invoices | ✓ SATISFIED | generator.ts produces PINT-AE UBL 2.1 with correct CustomizationID, ProfileID, scheme 0192; 5 generator tests pass |
| PEPPOL-02 | 49-01, 49-02, 49-03, 49-04 | Invoices are transmitted via a certified ASP integration | ✓ SATISFIED | StorecoveAdapter implements ASPAdapter; PeppolOrchestrator.submitOutboundInvoice(); 3 QStash routes wired; however UI transmission status display is orphaned |
| PEPPOL-03 | 49-02, 49-03, 49-04 | Platform receives and parses inbound Peppol invoices from ASP | ✓ SATISFIED (backend only) | processInboundInvoice creates Invoice with source=PEPPOL; webhook route and poll route functional; inbound banner UI is orphaned |
| PEPPOL-04 | 49-01, 49-04 | QR codes are generated on invoices per UAE e-invoicing requirements | ✓ SATISFIED (generation only) | PeppolAEQRCode.generateQR() produces PNG buffer; PeppolQRDisplay component exists but not wired into invoice detail view |

All 4 PEPPOL requirements are mapped correctly — none are orphaned in REQUIREMENTS.md. All map to Phase 49.

**Orphaned requirements check:** No PEPPOL requirements exist in REQUIREMENTS.md that are mapped to Phase 49 but unclaimed by any plan.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/web/src/components/peppol/peppol-transmission-status.tsx` | Component exported, never imported | ⚠️ Warning | Transmission timeline not visible in invoice detail — user cannot see outbound transmission progress |
| `apps/web/src/components/peppol/peppol-inbound-banner.tsx` | Component exported, never imported | ⚠️ Warning | Inbound Peppol invoice origin is not surfaced to users |
| `apps/web/src/components/peppol/peppol-qr-display.tsx` | Component exported, never imported | ⚠️ Warning | UAE FTA QR code not displayed on invoice detail |
| `apps/web/src/components/peppol/peppol-compliance-widget.tsx` | Component exported, never imported | ⚠️ Warning | Peppol compliance status absent from dashboard |

Note: These are classified as Warning (not Blocker) because the underlying backend pipeline works end-to-end. The core goal of sending/receiving invoices through Peppol is achievable. The gaps prevent users from *seeing* the status, but do not break the transmission.

### Human Verification Required

#### 1. 5-step Peppol Connection Wizard

**Test:** Navigate to Settings > Integrations, find the Peppol card, click "Connect to Peppol"
**Expected:** 5-step wizard opens; Step 1 shows TRN input with live participant ID preview; Step 2 shows Storecove ASP option; Step 3 shows password-masked API key field with show/hide toggle and environment radio; Step 4 triggers `peppol.connect` mutation with progress indicator; Step 5 shows success state
**Why human:** Multi-step interactive dialog flow, visual rendering, form validation behavior

#### 2. PeppolStatusCard Empty State

**Test:** View Settings > Integrations while Peppol is disconnected
**Expected:** PeppolStatusCard renders in the integrations grid with "Connect to Peppol" CTA button
**Why human:** React component conditional rendering, visual layout verification

### Gaps Summary

Four of the seven UI components created in Plan 49-04 are orphaned. The `PeppolTransmissionStatus`, `PeppolInboundBanner`, `PeppolQRDisplay`, and `PeppolComplianceWidget` components were built to spec but never wired into their target pages:

- `PeppolTransmissionStatus` should appear in the invoice detail view when an outbound Peppol transmission exists
- `PeppolInboundBanner` should appear in the invoice detail view when `invoice.source === "PEPPOL"`
- `PeppolQRDisplay` should appear in the invoice detail view for Peppol-AE invoices with QR data
- `PeppolComplianceWidget` should appear in the dashboard compliance section

The root cause is that Plan 49-04 called for wiring these into "existing pages" (invoice detail view, dashboard compliance section) but the wiring step was not executed. The components themselves are substantive and correct; they simply need to be imported and rendered in their target locations.

The backend pipeline (Plans 49-01, 49-02, 49-03) is fully functional: PINT-AE XML generation, ASP transmission via Storecove, inbound webhook processing, QStash async routes, and the DB schema are all working and tested.

---

_Verified: 2026-04-12T01:45:00Z_
_Verifier: Claude (gsd-verifier)_
