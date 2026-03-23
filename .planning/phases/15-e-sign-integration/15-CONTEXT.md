# Phase 15: E-Sign Integration - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Contracts and NDAs can be sent for electronic signature via DocuSign or Autenti without leaving the platform. Signers complete the process through embedded or redirect flows. Multi-party sequential signing is supported. Signed PDFs are auto-saved to document management with a complete audit trail.

</domain>

<decisions>
## Implementation Decisions

### Provider Strategy
- **D-01:** Build DocuSign and Autenti adapters simultaneously using a provider-agnostic abstraction layer. Both providers ship in Phase 15.
- **D-02:** Per-contract provider choice — admin connects both providers via IntegrationConnection (Phase 12 infrastructure), then picks DocuSign or Autenti when sending each contract for signature. No org-wide default required.

### Signing Experience
- **D-03:** Embedded signing with redirect fallback — try embedded (iframe/modal) first. If the provider or plan doesn't support embedded, fall back to redirect flow. Applies to both admin and portal signing views.
- **D-04:** Portal + email signing — contractors can sign from the contractor portal (pending signatures on dashboard) OR from the email link sent by the provider. Email serves as fallback for contractors not using the portal.
- **D-05:** Full-page modal for embedded signing on admin side — document fills the screen for readability. Close button returns to contract detail. Portal uses similar full-page approach.

### Send-for-Signature Trigger
- **D-06:** Dual trigger points — "Send for Signature" button on contract detail header (sends main contract PDF) AND per-document action in the Documents tab (sends any attached document like NDAs, amendments individually).
- **D-07:** Full setup dialog with preview — provider picker (DocuSign/Autenti), signer list auto-populated from contract parties, custom message field, document preview with signature placement markers, expiry date, and reminder settings.
- **D-08:** Contract status update on signing — contract moves to "Pending Signature" status when sent. Returns to "Active" when all parties sign. Shows signing progress on contract list and detail. Integrates with existing workflow engine.

### Multi-Party Signing Order
- **D-09:** Sequential with default order — contractor signs first, then org representative countersigns. Admin can reorder signers in the setup dialog.
- **D-10:** Admin picks countersigner from org members — signing setup dialog shows dropdown of org members. Admin selects who countersigns. Different contracts can have different countersigners.
- **D-11:** Decline/expiry handling — contract status moves to "Signature Declined" or "Signature Expired". Admin gets notified (in-app + email) and can re-send or cancel. No auto-void.

### Claude's Discretion
- Provider-agnostic abstraction layer design (adapter pattern, interface shape)
- Webhook event processing for signing status updates (using Phase 12 webhook infrastructure)
- Signature field placement strategy (auto-detect vs manual placement in preview)
- Signing audit trail storage schema
- Portal pending signatures UI design (badge count, list vs cards)
- Notification templates for signing events (sent, completed, declined, expired)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Integration Infrastructure (Phase 12)
- `packages/db/prisma/schema/integration.prisma` — IntegrationConnection model, IntegrationProvider enum (DOCUSIGN, AUTENTI already present), WebhookDelivery, ExternalLink
- `packages/integrations/src/services/webhook-dispatcher.ts` — Webhook dispatch and processing pattern
- `packages/integrations/src/services/token-refresh.ts` — OAuth token refresh with distributed locking
- `packages/integrations/src/services/health-service.ts` — Integration health monitoring
- `packages/api/src/routers/integration.ts` — Integration connection CRUD, OAuth flow pattern, adapter registration
- `apps/web/src/app/api/webhooks/[provider]/route.ts` — Webhook ingestion endpoint pattern

### Contract Detail (Phase 3)
- `apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx` — Contract detail page with DetailHeader + ContractDetailTabs
- `apps/web/src/components/contracts/contract-detail/contract-detail-tabs.tsx` — Existing tabs: overview, documents, amendments, activity
- `apps/web/src/components/contracts/contract-detail/documents-tab.tsx` — Documents tab where per-document signing action will live
- `apps/web/src/components/contracts/contract-detail/detail-header.tsx` — Header where "Send for Signature" button will be added

### Portal (Phase 13)
- `apps/web/src/app/[locale]/(portal)/contracts/[id]/page.tsx` — Portal contract detail (where contractor signing view would integrate)
- `packages/api/src/routers/portal.ts` — Portal router pattern for contractor-facing endpoints

### File Storage
- `packages/api/src/services/r2.ts` — R2 presigned URL pattern for file upload/download (used for signed PDF storage)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IntegrationConnection` model with DOCUSIGN and AUTENTI providers — no schema changes needed for provider registration
- `ExternalLink` model — can link Contract entity to DocuSign envelope ID / Autenti document ID
- `WebhookDelivery` model — tracks incoming webhook events with signature validation
- Phase 12 adapter pattern (`getAdapter`, `registerAllAdapters`) — extend for DocuSign/Autenti signing adapters
- `generateOAuthState` utility — CSRF-safe OAuth state for provider connection flow
- R2 presigned URL service — reuse for uploading/downloading signed PDFs

### Established Patterns
- Provider adapters registered via `registerAllAdapters()` in integration router
- OAuth flow: generate state → redirect to provider → callback stores credentials in IntegrationConnection
- Webhook processing: receive → validate signature → dispatch to handler → log delivery
- Contract detail uses tabbed layout with `ContractDetailTabs` — add signing status to existing tabs
- Portal uses `portalProcedure` for authenticated contractor endpoints

### Integration Points
- Contract detail header (`detail-header.tsx`) — "Send for Signature" action button
- Documents tab (`documents-tab.tsx`) — per-document signing action
- Portal dashboard — pending signatures section
- Workflow engine — contract status transitions (Pending Signature, Active, Signature Declined, Signature Expired)
- Notification system (Phase 7) — signing event notifications

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the provider abstraction layer and signing UI.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-e-sign-integration*
*Context gathered: 2026-03-23*
