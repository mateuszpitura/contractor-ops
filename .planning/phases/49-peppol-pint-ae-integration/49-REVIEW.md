---
phase: 49
phase_name: peppol-pint-ae-integration
status: issues_found
depth: standard
files_reviewed: 34
findings:
  critical: 2
  warning: 9
  info: 5
  total: 16
reviewed: 2026-04-12T14:30:00Z
---

# Code Review: Phase 49 -- Peppol PINT-AE Integration

## Summary

The Peppol PINT-AE integration is well-structured with clean separation between the ASP adapter layer, the e-invoicing profile engine, and the tRPC router. Two critical security issues were found: the Storecove adapter hardcodes `senderLegalEntityId: 0` which will cause all outbound transmissions to fail or route to the wrong entity, and the inbound route does not verify that the `deliveryId` belongs to the claimed `organizationId`, enabling cross-tenant data access. Several warning-level issues include missing retry queue for the `retryTransmission` mutation, potential `timingSafeEqual` crash on malformed signatures, and the poll endpoint iterating all active participants without concurrency limits.

## Findings

### CR-01: Cross-tenant data access in inbound route -- deliveryId not scoped to organizationId
- **Severity**: critical
- **File**: `apps/web/src/app/api/peppol/inbound/route.ts`:35
- **Description**: The handler accepts `deliveryId` and `organizationId` from the request body and fetches the `WebhookDelivery` by `id` alone (`findUniqueOrThrow`). It never verifies that `delivery.organizationId === organizationId`. A caller (or compromised QStash message) could supply a `deliveryId` belonging to org A with `organizationId` of org B, causing org B to process org A's webhook data and potentially create an invoice in the wrong tenant.
- **Recommendation**: Add `organizationId` to the `findUniqueOrThrow` where clause: `where: { id: deliveryId, organizationId }`, or validate after fetch that `delivery.organizationId === organizationId`.

### CR-02: Hardcoded senderLegalEntityId: 0 in StorecoveAdapter.transmitInvoice
- **Severity**: critical
- **File**: `packages/einvoice/src/asp/storecove/adapter.ts`:79
- **Description**: The `transmitInvoice` method passes `senderLegalEntityId: 0` to the Storecove client. This is a placeholder value (with a comment "Caller should resolve this from participant data") that was never wired up. Storecove requires the actual legal entity ID obtained during registration. All outbound transmissions will either fail with a 404/422 or be sent from the wrong entity.
- **Recommendation**: Add `senderLegalEntityId` to the `TransmitInvoiceParams` interface and pass the value from `PeppolParticipant.aspRegistrationId` (stored during registration) through the orchestrator. The orchestrator already loads the participant; pass `parseInt(participant.aspRegistrationId)` to the adapter.

### WR-01: timingSafeEqual crash on malformed hex signature
- **Severity**: warning
- **File**: `packages/einvoice/src/asp/storecove/adapter.ts`:158-160
- **Description**: `timingSafeEqual` requires both buffers to be the same length. If the `storecove-signature` header contains a non-hex string or a hex string of different length than SHA-256 output (64 hex chars), `Buffer.from(signature, "hex")` will produce a buffer of different length, causing `timingSafeEqual` to throw a `RangeError` instead of returning `false`.
- **Recommendation**: Guard with a length check: `if (computed.length !== Buffer.from(signature, "hex").length) return { valid: false };` or wrap in try/catch and return `{ valid: false }` on `RangeError`.

### WR-02: retryTransmission only resets status without re-queuing
- **Severity**: warning
- **File**: `packages/api/src/routers/peppol.ts`:412-418
- **Description**: The `retryTransmission` mutation sets the transmission status back to `PENDING` but does not enqueue a new QStash job to actually process the retry. There is no background worker polling for `PENDING` transmissions. The transmission will remain in `PENDING` state indefinitely unless manually triggered.
- **Recommendation**: After resetting status to PENDING, publish a QStash message to `/api/peppol/outbound` with the relevant `organizationId`, `invoiceId`, and `receiverParticipantId` to trigger actual reprocessing.

### WR-03: Poll endpoint processes all organizations sequentially without concurrency limit
- **Severity**: warning
- **File**: `apps/web/src/app/api/peppol/poll/route.ts`:39-113
- **Description**: The poll handler iterates all active `PeppolParticipant` records sequentially. With many organizations, this could exceed the serverless function timeout (typically 10-60s). Each iteration makes multiple DB queries plus an external API call to Storecove.
- **Recommendation**: Either limit the number of participants processed per invocation (batch + cursor), use `Promise.allSettled` with a concurrency pool (e.g., p-limit), or schedule individual per-org poll jobs via QStash instead of a single global poll.

### WR-04: Missing organizationId scope in processInboundInvoice duplicate check
- **Severity**: warning
- **File**: `packages/api/src/services/peppol-orchestrator.ts`:176-178
- **Description**: The idempotency check queries `PeppolTransmission` by `aspTransmissionId` without scoping to the organization. If two different organizations somehow receive the same `aspTransmissionId` (unlikely but possible with ASP bugs or test environments), the second org's invoice would be silently skipped.
- **Recommendation**: Add `organizationId: params.organizationId` to the `findFirst` where clause for defense in depth.

### WR-05: Outbound route returns 200 on all business errors, masking infrastructure failures
- **Severity**: warning
- **File**: `apps/web/src/app/api/peppol/outbound/route.ts`:83-88
- **Description**: The catch block always returns 200 to "prevent QStash retry on business errors." However, this also prevents retries for transient infrastructure errors (network timeouts, DB connection failures, Storecove 500s). The comment says "transmission record is already marked FAILED in the orchestrator" but infrastructure errors may occur before the orchestrator can update the record.
- **Recommendation**: Differentiate between business errors (validation failures from Storecove 422) and infrastructure errors (network failures, 500s). Return 500 for infrastructure errors to allow QStash retries, and 200 only for non-retryable business errors.

### WR-06: No invoice line creation for inbound Peppol invoices
- **Severity**: warning
- **File**: `packages/api/src/services/peppol-orchestrator.ts`:213-237
- **Description**: The `processInboundInvoice` method parses the XML into an `EInvoice` (which includes `lines`), but only creates the `Invoice` header record. The parsed `lines` are discarded -- no `InvoiceLine` records are created. This means inbound Peppol invoices will have no line items visible in the UI.
- **Recommendation**: After creating the invoice, also create `InvoiceLine` records from `parsed.lines` using `prisma.invoiceLine.createMany`.

### WR-07: Missing aspRegistrationId storage during participant registration
- **Severity**: warning
- **File**: `packages/api/src/routers/peppol.ts`:110-119
- **Description**: The `connect` mutation creates a `PeppolParticipant` record but never calls `aspAdapter.registerParticipant()` to actually register with Storecove. The `aspRegistrationId` field remains null. This means the participant is never registered on the Peppol network through the ASP, and the legal entity ID needed for outbound transmission (see CR-02) is never obtained.
- **Recommendation**: After storing credentials, instantiate the StorecoveAdapter and call `registerParticipant()`. Store the returned `registrationId` as `aspRegistrationId` on the participant record. Update participant status based on the registration result.

### WR-08: QR code XSS via base64 src attribute
- **Severity**: warning
- **File**: `apps/web/src/components/peppol/peppol-qr-display.tsx`:29-34
- **Description**: The `qrCodeBase64` prop is rendered directly into an `<img src>` attribute. If an attacker controls this value, they could inject a `javascript:` URI or other malicious content. While modern browsers block `javascript:` in img src, this is still a defense-in-depth concern.
- **Recommendation**: Validate that `qrCodeBase64` starts with `data:image/png;base64,` before rendering. Reject any value that doesn't match this prefix.

### IR-01: Duplicated text() helper function across parser and validator
- **Severity**: info
- **File**: `packages/einvoice/src/profiles/peppol-ae/parser.ts`:22-30, `packages/einvoice/src/profiles/peppol-ae/validator.ts`:22-30
- **Description**: The `text()` utility function is identically duplicated in both `parser.ts` and `validator.ts`. This violates DRY.
- **Recommendation**: Extract the shared `text()` function into a shared utility module (e.g., the existing `xml-utils.ts`) and import it in both files.

### IR-02: Duplicated peppolParticipantIdSchema in two packages
- **Severity**: info
- **File**: `packages/einvoice/src/profiles/peppol-ae/schemas.ts`:11-16, `packages/validators/src/peppol.ts`:11-16
- **Description**: The `peppolParticipantIdSchema` Zod schema is defined identically in both `@contractor-ops/einvoice` and `@contractor-ops/validators`. Changes to the format in one place may not be reflected in the other.
- **Recommendation**: Define the schema in one canonical location (validators package) and import it in the einvoice package, or re-export from a shared schemas package.

### IR-03: XMLParser instance created at module level in multiple files
- **Severity**: info
- **File**: `packages/einvoice/src/profiles/peppol-ae/parser.ts`:10-17, `packages/einvoice/src/profiles/peppol-ae/validator.ts`:10-17
- **Description**: Two identical `XMLParser` instances with the same configuration are created at module scope. This is a minor DRY violation and increases the memory footprint.
- **Recommendation**: Share a single configured parser instance via a shared module.

### IR-04: PeppolStatusCard uses non-standard AlertDialogTrigger render prop
- **Severity**: info
- **File**: `apps/web/src/components/peppol/peppol-status-card.tsx`:188-195
- **Description**: `AlertDialogTrigger` is used with a `render` prop, which is not part of the standard shadcn/ui API. This may be a custom extension or may break with library updates. Standard pattern is to use `asChild` with a child component.
- **Recommendation**: Verify this matches the project's UI library API. If using Radix primitives directly, consider using the `asChild` pattern for consistency.

### IR-05: Wizard step 4 allows navigating back during pending registration
- **Severity**: info
- **File**: `apps/web/src/components/peppol/peppol-wizard.tsx`:362-370
- **Description**: While the Back button is disabled during `connectMutation.isPending` at step 4, a user could close the dialog entirely via the X button or clicking outside, leaving the registration in an indeterminate state. The `resetAndClose` function resets local state but doesn't cancel the in-flight mutation.
- **Recommendation**: Consider disabling dialog close during the pending mutation, or handle the case where the mutation completes after the dialog is closed (the `onSuccess` handler already invalidates queries, so this is low-risk but could show a stale state).
