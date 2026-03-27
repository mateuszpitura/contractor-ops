---
phase: 15-e-sign-integration
verified: 2026-03-27T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Send for Signature flow - admin"
    expected: "Clicking 'Send for Signature' on a DRAFT/ACTIVE contract opens the setup dialog. Provider picker shows connected DocuSign/Autenti connections. Signer list is pre-populated and drag-reorderable. Submitting sends the document and transitions contract to PENDING_SIGNATURE."
    why_human: "Full tRPC mutation + real provider connection + DB state cannot be asserted programmatically"
  - test: "Embedded signing modal - DocuSign iframe"
    expected: "For a DocuSign envelope, clicking Sign Now loads the signing modal with a full-viewport DocuSign iframe. Completing signing fires 'signing_complete' postMessage, closes modal, and triggers toast."
    why_human: "Requires live DocuSign sandbox credentials and iframe interaction"
  - test: "Redirect fallback - Autenti"
    expected: "For an Autenti envelope, the embedded signing modal shows 'Continue to Autenti' button (no iframe). Clicking it opens the Autenti signing URL in a new tab."
    why_human: "Requires live Autenti connection and visual inspection of the redirect card"
  - test: "Webhook completion - signed PDF saved"
    expected: "When DocuSign/Autenti sends ENVELOPE_COMPLETED webhook, the signed PDF is auto-downloaded, stored in R2, and appears as a SIGNED_COPY document linked to the contract."
    why_human: "Requires end-to-end webhook delivery from provider and R2 storage confirmation"
  - test: "Signing progress bar step indicators"
    expected: "After sending for signature, SigningProgressBar appears between header and tabs. Each signer has a step circle. Current signer pulses. Signed signer shows green checkmark. Declined shows red X."
    why_human: "Visual rendering and animation cannot be verified programmatically"
  - test: "Portal pending signatures"
    expected: "A contractor with a pending signing envelope sees 'Pending Signatures' section on portal dashboard with contract title, org name, sent date, and 'Sign Now' button."
    why_human: "Requires live contractor portal session with an active signing envelope"
---

# Phase 15: E-Sign Integration Verification Report

**Phase Goal:** Contracts and NDAs can be sent for signature and signed electronically without leaving the platform
**Verified:** 2026-03-27
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can send a contract or NDA for signature via DocuSign or Autenti from the contract detail page | VERIFIED | `SendForSignatureButton` renders in `detail-header.tsx` (line 189). `SendForSignatureDialog` calls `trpc.esign.sendForSignature.mutationOptions` (line 219). Documents tab also has per-document "Send for Signature" item via `PenLine` icon and `SendForSignatureDialog` (documents-tab.tsx). |
| 2 | Signer can sign through embedded or redirect flow without leaving the Contractor Ops context | VERIFIED | `embedded-signing-modal.tsx` renders DocuSign iframe (line 162) with `postMessage` listener for `signing_complete`. Autenti redirect fallback renders "redirectMessage" card (line 178). Modal is full-viewport (`fixed inset-0 z-50`). |
| 3 | Multi-party signing works in defined order (contractor first, then org representative) | VERIFIED | `routingOrder` flows from `SigningEnvelopeRequest` through `DocuSignAdapter.createEnvelope` (line 225 sets SDK `routingOrder`). Autenti creates participants with per-signer order. `SigningProgressBar` sorts by `routingOrder` and identifies the current signer. `SendForSignatureDialog` uses `@dnd-kit/sortable` for drag reorder. |
| 4 | Signed PDF is automatically saved to document management with a complete signature audit trail | VERIFIED | `handleSigningCompletion` in `esign-orchestrator.ts` creates a `Document` with `source: "ESIGN"` and a `DocumentLink` with `linkRole: "SIGNED_COPY"` (lines 382, 395). `SIGNED_PDF_SAVED` `SigningEvent` is created (lines 400–405). `SigningAuditTrail` fetches events via `trpc.esign.getEnvelopeDetail` (line 106). Idempotency guard on `providerEventId` (lines 80–85 in webhook handler). |

**Score:** 4/4 truths verified

---

## Required Artifacts

### Plan 01 — Schema and Type Contracts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/db/prisma/schema/esign.prisma` | VERIFIED | Contains `model SigningEnvelope`, `model SigningRecipient`, `model SigningEvent`, all 4 enums including `SigningEventType.SIGNED_PDF_SAVED` |
| `packages/integrations/src/types/esign.ts` | VERIFIED | Exports `ESignAdapter`, `SigningEnvelopeRequest`, `SignerInfo`, `SigningEnvelopeResult`, `EmbeddedSigningUrlResult`, `SignedDocumentResult`, `NormalizedSigningEvent`. All 8 interface methods present. |
| `packages/integrations/src/adapters/__tests__/docusign-adapter.test.ts` | VERIFIED | File exists, contains `describe("DocuSignAdapter")` |
| `packages/integrations/src/adapters/__tests__/autenti-adapter.test.ts` | VERIFIED | File exists, contains `describe("AutentiAdapter")` |
| `packages/api/src/routers/__tests__/esign.test.ts` | VERIFIED | File exists |
| `packages/integrations/src/services/__tests__/signing-webhook.test.ts` | VERIFIED | File exists |

ContractStatus enum additions: `SIGNATURE_DECLINED` and `SIGNATURE_EXPIRED` confirmed in `contract.prisma` (lines 164–165). `CONTRACT_TRANSITIONS` in `contract.ts` extended correctly (lines 22–25 include `DRAFT -> PENDING_SIGNATURE` and bidirectional transitions for declined/expired).

### Plan 02 — Provider Adapters

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/integrations/src/adapters/docusign-adapter.ts` | VERIFIED | `DocuSignAdapter extends BaseAdapter implements ESignAdapter`. `slug = "docusign"`, `supportsEmbeddedSigning = true`. All 7 interface methods implemented. |
| `packages/integrations/src/adapters/autenti-adapter.ts` | VERIFIED | `AutentiAdapter extends BaseAdapter implements ESignAdapter`. `slug = "autenti"`, `supportsEmbeddedSigning = false`. All methods implemented; `getEmbeddedSigningUrl` throws as specified. |
| `packages/integrations/src/adapters/register-all.ts` | VERIFIED | Imports and registers both `DocuSignAdapter` and `AutentiAdapter` (lines 4–5, 22–23). |
| `packages/integrations/src/services/esign-service.ts` | VERIFIED | Exports all 6 functions: `getESignAdapter`, `createSigningEnvelope`, `getEmbeddedSigningUrl`, `downloadSignedDocument`, `voidSigningEnvelope`, `resendSigningNotification`, `normalizeSigningEvent`. `supportsEmbeddedSigning` null-guard at line 72. |
| `packages/integrations/package.json` | VERIFIED | `docusign-esign: 8.6.0` listed as dependency |

### Plan 03 — API and Webhooks

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/api/src/routers/esign.ts` | VERIFIED | Exports `esignRouter`. All 7 procedures present: `sendForSignature`, `getSigningUrl`, `voidEnvelope`, `resendToRecipient`, `getEnvelopeDetail`, `listEnvelopes`, `listPendingForContractor` (uses `portalProcedure` at line 249). |
| `packages/api/src/services/esign-orchestrator.ts` | VERIFIED | Exports `sendForSignature`, `handleSigningCompletion`. Creates `PENDING_SIGNATURE` status (line 222), `source: "ESIGN"` document (line 382), `SIGNED_COPY` link (line 395), `SIGNED_PDF_SAVED` event (lines 400–405). |
| `packages/integrations/src/services/esign-webhook-handler.ts` | VERIFIED | Exports `handleSigningWebhook` returning `{ envelopeId, completed }`. Idempotency on `providerEventId`. `prisma.$transaction` used. Maps `COMPLETED -> ACTIVE`, `DECLINED -> SIGNATURE_DECLINED`, `EXPIRED -> SIGNATURE_EXPIRED`. No imports from `packages/api`. |
| `apps/web/src/app/api/webhooks/_process/route.ts` | VERIFIED | Imports `handleSigningCompletion` from `@contractor-ops/api/services/esign-orchestrator` (line 7). Calls it when `webhookResult?.completed === true` (lines 82–88). |
| `apps/web/next.config.ts` | VERIFIED | CSP `frame-src` includes `https://*.docusign.com`, `https://*.docusign.net`, `https://apps-d.docusign.com` (lines 50). |

Router registration: `esignRouter` added to root router in `packages/api/src/root.ts` at line 65. No circular dependency confirmed — `packages/integrations` does not import from `packages/api`.

### Plan 04 — UI Components

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `apps/web/src/components/contracts/contract-detail/send-for-signature-dialog.tsx` | 100 | 472 | VERIFIED | Provider Select, `@dnd-kit/sortable` drag-reorder, message Textarea, document preview, expiry/reminders selects, `trpc.esign.sendForSignature` mutation |
| `apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx` | 50 | 213 | VERIFIED | iframe + `postMessage` listener for DocuSign; redirect card fallback for Autenti; `trpc.esign.getSigningUrl` query |
| `apps/web/src/components/contracts/contract-detail/signing-progress-bar.tsx` | 40 | 250 | VERIFIED | Per-signer step indicators sorted by `routingOrder`, `animate-pulse` for current signer, green/red status mapping, "View Signing History" button |
| `apps/web/src/components/portal/portal-pending-signatures.tsx` | 40 | 179 | VERIFIED | "Pending Signatures" heading, "Sign Now" button, `trpc.esign.listPendingForContractor` query |
| `apps/web/src/components/contracts/contract-detail/send-for-signature-button.tsx` | - | exists | VERIFIED | `PenLine` icon, "Send for Signature" text, visible on DRAFT/ACTIVE |
| `apps/web/src/components/contracts/contract-detail/signing-status-badge.tsx` | - | exists | VERIFIED | Status-to-variant mapping |
| `apps/web/src/components/contracts/contract-detail/signing-audit-trail.tsx` | - | exists | VERIFIED | `trpc.esign.getEnvelopeDetail` query, Sheet component |
| `apps/web/src/components/contracts/contract-detail/void-envelope-dialog.tsx` | - | exists | VERIFIED | AlertDialog pattern, "Void Signing Envelope" title |

Wiring into existing pages:
- `detail-header.tsx` imports and renders `SendForSignatureButton` (line 46, 189)
- `documents-tab.tsx` has "Send for Signature" `DropdownMenuItem` with `PenLine` icon (lines 6, 12, 51–74)
- `apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx` imports `SigningProgressBar` and renders it conditionally via `trpc.esign.listEnvelopes` (lines 16, 80, 145)
- `apps/web/src/app/[locale]/(portal)/portal/page.tsx` imports and renders `PortalPendingSignatures` (lines 20, 100)
- `apps/web/package.json` has `@dnd-kit/core: 6.3.1`, `@dnd-kit/sortable: 10.0.0`, `@dnd-kit/utilities: 3.2.2`

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `docusign-adapter.ts` | `esign.ts` | `implements ESignAdapter` | WIRED | Line 7 import, line 72 class declaration |
| `autenti-adapter.ts` | `esign.ts` | `implements ESignAdapter` | WIRED | Line 7 import, line 43 class declaration |
| `register-all.ts` | `docusign-adapter.ts`, `autenti-adapter.ts` | `registerAdapter` calls | WIRED | Lines 4–5 imports, 22–23 registrations |
| `esign.ts (router)` | `esign-orchestrator.ts` | procedure handlers call orchestrator | WIRED | Lines 8–11 imports, line 105 `sendForSignature` call |
| `esign-webhook-handler.ts` | `esign-service.ts` | `normalizeSigningEvent` call | WIRED | Same package; confirmed no cross-package import to `api` |
| `webhooks/_process/route.ts` | `esign-orchestrator.ts` | `handleSigningCompletion` on `completed === true` | WIRED | Lines 7, 82–88 |
| `esign-orchestrator.ts` | `r2.ts` | `createPresignedUploadUrl`, `generateStorageKey` | WIRED | Confirmed in orchestrator service |
| `send-for-signature-dialog.tsx` | `esign.ts (router)` | `trpc.esign.sendForSignature` | WIRED | Line 219 `mutationOptions` |
| `embedded-signing-modal.tsx` | `esign.ts (router)` | `trpc.esign.getSigningUrl` | WIRED | Line 56 `queryOptions` |
| `portal-pending-signatures.tsx` | `esign.ts (router)` | `trpc.esign.listPendingForContractor` | WIRED | Line 78 `queryOptions` |

---

## Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|---------|
| SIGN-01 | 01, 02, 03, 04 | User can send a contract or NDA for signature via DocuSign or Autenti | SATISFIED | `sendForSignature` orchestrator + tRPC procedure + `SendForSignatureButton` in contract detail header and documents tab |
| SIGN-02 | 02, 03, 04 | Signer can sign documents within Contractor Ops (embedded/redirect flow) | SATISFIED | `getEmbeddedSigningUrl` returns iframe URL for DocuSign; redirect fallback for Autenti. `EmbeddedSigningModal` handles both paths with postMessage listener. |
| SIGN-03 | 01, 02, 03, 04 | Contracts support multi-party signing (contractor + org rep) in defined order | SATISFIED | `routingOrder` in `SigningRecipient` schema, `SigningProgressBar` sorts by it, DocuSign SDK `routingOrder` field set per signer, drag reorder in dialog |
| SIGN-04 | 01, 03, 04 | Signed PDF is auto-saved to document management with signature audit trail | SATISFIED | `handleSigningCompletion` creates Document (ESIGN source), DocumentLink (SIGNED_COPY), and SIGNED_PDF_SAVED SigningEvent. Audit trail sheet reads chronological events. |

No orphaned requirements found. All four SIGN-0x IDs are claimed by at least one plan and have implementation evidence.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `docusign-adapter.ts` (line 652) | `_lastWebhookResult` is a public instance field set during `handleWebhook`. Adapters are registered as singletons; concurrent webhook calls could overwrite each other's result before `_process/route.ts` reads it. | Warning | In low-traffic environments this is unlikely to cause data loss (the completion signal at worst triggers an extra PDF download or is missed, with no data corruption). In high-concurrency scenarios this is a race condition. |
| `apps/web/src/app/api/webhooks/_process/route.ts` | The completion signal is read via `adapterWithResult._lastWebhookResult` — an implicit side-channel through the singleton rather than a return value from `handleWebhook`. | Warning | Architecturally fragile. If a future refactor changes how `handleWebhook` is called (e.g., stateless), the signal silently disappears. No blocker for current usage. |

No TODO/FIXME/placeholder markers found in any production files. No empty handler stubs. No hardcoded empty arrays flowing to rendered output.

---

## Human Verification Required

### 1. Send for Signature — Admin Flow

**Test:** On a DRAFT contract with a document attached and a DocuSign/Autenti connection active, click "Send for Signature" in the contract detail header.
**Expected:** Dialog opens with provider picker (showing connected providers), pre-populated signer list with drag handles, message textarea, document preview card, expiry and reminder selects. Submitting transitions contract status to PENDING_SIGNATURE and renders the SigningProgressBar.
**Why human:** Requires live provider connections; DB status transition and component render can only be confirmed visually.

### 2. Embedded Signing — DocuSign Iframe

**Test:** With a sent DocuSign envelope, click "Sign Now" in the portal or signing progress bar.
**Expected:** Full-viewport modal opens with a DocuSign iframe loaded (not a blank page). Completing signing in the iframe closes the modal and shows a success toast.
**Why human:** Requires live DocuSign sandbox credentials and iframe interaction.

### 3. Redirect Fallback — Autenti

**Test:** With a sent Autenti envelope, open the signing modal.
**Expected:** Modal shows a card (no iframe) with "Continue to Autenti" primary button. Clicking it opens the Autenti signing URL in a new tab.
**Why human:** Requires live Autenti credentials; visual inspection of card layout.

### 4. Webhook Completion — Signed PDF Auto-Save

**Test:** Complete signing via DocuSign/Autenti (or simulate via webhook POST). Confirm in the Documents tab that a new signed PDF document appears with SIGNED_COPY role.
**Expected:** Document is visible under contract documents. SigningAuditTrail shows SIGNED_PDF_SAVED event.
**Why human:** Requires end-to-end webhook delivery and R2 storage confirmation.

### 5. Signing Progress Bar Visual States

**Test:** View a contract with a two-signer envelope (contractor + countersigner). After contractor signs, verify progress bar updates.
**Expected:** Signed step shows green checkmark circle. Current (waiting) step pulses with `animate-pulse`. Connector line between signed steps is green.
**Why human:** CSS animation and visual state styling cannot be asserted programmatically.

### 6. Portal Pending Signatures

**Test:** Log in as a contractor who is a pending signer on an envelope. Navigate to portal dashboard.
**Expected:** "Pending Signatures" section is visible above other content with the contract name, org name, sent date, and "Sign Now" button. Count badge shows correct number.
**Why human:** Requires portal session with live contractor identity matching a `SigningRecipient.email`.

---

## Summary

All four SIGN-0x requirements are fully implemented and wired across all four plans. The data layer (Plan 01), provider adapters (Plan 02), API/webhooks (Plan 03), and UI (Plan 04) are each substantive, non-stub implementations. All key links between layers are verified via grep.

Two architectural warnings are noted around the `_lastWebhookResult` singleton side-channel, but neither blocks the phase goal.

Six human verification items remain to confirm end-to-end behaviour with live provider credentials and visual rendering quality.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
