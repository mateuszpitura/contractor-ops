# Phase 49: Peppol PINT-AE Integration - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement Peppol PINT-AE (UAE) as the third country profile in the e-invoicing engine. Covers ASP connection with abstract adapter pattern, outbound PINT-AE UBL 2.1 XML generation and transmission, inbound invoice reception (webhook + polling), and QR code generation per UAE FTA requirements.

</domain>

<decisions>
## Implementation Decisions

### ASP Selection & Connection
- **D-01:** Abstract ASP adapter interface so the specific provider (Storecove/Pagero/EDICOM) can be swapped. Implement one concrete adapter first — research phase evaluates vendors and recommends one. Vendor selection is still pending (STATE.md procurement blocker).
- **D-02:** ASP credentials stored in the same external secret store as ZATCA certificates (Infisical/Doppler from Phase 48 D-02). One unified secret management pattern for all government API credentials.

### Outbound Invoice Flow
- **D-03:** Async via QStash (consistent with ZATCA pattern). Invoice creation triggers QStash job: generate PINT-AE UBL 2.1 XML → transmit to ASP → record delivery confirmation. Per-invoice Peppol status tracking (pending → transmitted → delivered / failed).

### Inbound Invoice Reception
- **D-04:** Webhook from ASP as primary + polling as fallback catch-up mechanism. Webhook uses existing integration framework webhook pipeline. Polling via QStash cron as safety net. Inbound invoices parsed from PINT-AE XML and created in the invoice intake queue.

### UAE QR Code
- **D-05:** Shared QRCodeable interface from Phase 45, with Peppol-AE profile providing its own encoding implementation per UAE FTA requirements. Same hook pattern, different data encoding than ZATCA's TLV. Engine calls the hook, profile provides the implementation.

### Claude's Discretion
- Peppol Participant ID registration flow UX
- PINT-AE XML schema specifics and mandatory fields
- ASP adapter interface design (methods, error handling)
- Webhook endpoint structure for ASP callbacks
- Polling frequency and catch-up logic
- UAE QR code data format (research during planning)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### E-invoicing engine (from Phase 45)
- `packages/einvoice/src/types/profile.ts` — EInvoiceProfile interface, QRCodeable capability hook
- `packages/einvoice/src/types/invoice.ts` — Core EInvoice model

### Integration framework
- `apps/web/src/app/api/webhooks/[provider]/route.ts` — Existing webhook endpoint pattern
- `packages/integrations/src/types/health.ts` — ProviderHealthStatus for connection monitoring

### Prior phase context
- `.planning/phases/45-pluggable-e-invoicing-engine-core/45-CONTEXT.md` — D-01: Engine in packages/einvoice, D-07: QRCodeable hooks
- `.planning/phases/48-zatca-fatoorah-integration/48-CONTEXT.md` — D-02: External secret store, D-05: Async QStash submission pattern

### Requirements
- `.planning/REQUIREMENTS.md` — PEPPOL-01 through PEPPOL-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/einvoice` — Engine package with profile interface and ZATCA profile as reference
- QStash integration — reusable for async invoice submission and polling cron
- Webhook pipeline — existing `[provider]/route.ts` pattern for ASP callbacks
- IntegrationConnection + IntegrationSyncLog — reusable for ASP connection state and audit

### Established Patterns
- Fire-and-forget async processing via QStash
- Webhook signature verification and processing pipeline
- Per-provider credential management (moving to Infisical/Doppler)
- EInvoiceProfile capability hooks (Signable, QRCodeable)

### Integration Points
- `packages/einvoice` — Peppol-AE profile implements EInvoiceProfile + QRCodeable
- Settings > Integrations page — ASP connection setup
- Invoice intake queue — inbound Peppol invoices feed into existing queue
- Invoice detail view — Peppol delivery status display
- Compliance dashboard widget — Peppol transmission status

</code_context>

<specifics>
## Specific Ideas

- ASP vendor selection is a procurement blocker (STATE.md) — research phase must evaluate Storecove/Pagero/EDICOM and recommend one
- The abstract ASP adapter means we can start implementation before vendor selection is finalized

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 49-peppol-pint-ae-integration*
*Context gathered: 2026-04-11*
