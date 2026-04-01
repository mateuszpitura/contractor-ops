# Phase 17: KSeF Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-fetch invoices issued to the org's NIP from Poland's national KSeF e-invoicing system (Krajowy System e-Faktur). Parse FA(3) XML into the invoice data model with all standard fields and line items. Display KSeF reference number and UPO receipt on invoice views. Detect and flag duplicates between KSeF-pulled and manually uploaded invoices. KSeF invoice validation against structured data is out of scope (v3). KSeF invoice sending/issuing is out of scope (contractors issue their own invoices).

</domain>

<decisions>
## Implementation Decisions

### KSeF Authentication
- **D-01:** Support both token-based and certificate-based authentication. Token is the primary path (admin generates in KSeF portal, pastes into settings). Certificate upload (.p12/.pem) as advanced option for orgs with qualified e-seals.
- **D-02:** KSeF connection lives in the existing Integration Settings tab as another provider card, consistent with Slack/DocuSign/Autenti pattern. Provider card shows connection status and last sync time.
- **D-03:** Org NIP for KSeF queries is pulled from existing organization settings, not re-entered during KSeF setup. Reduces duplication.
- **D-04:** Verify credentials on save — test API call to KSeF before persisting the connection. Shows success/error immediately, prevents silent auth failures.

### Polling & Sync Strategy
- **D-05:** Hourly cron via Upstash QStash to poll KSeF for new invoices. Balances freshness with API rate limits. Uses IntegrationSyncLog for tracking.
- **D-06:** Manual "Sync now" button on the KSeF provider card for on-demand pulls without waiting for next cron cycle.
- **D-07:** Sync history displayed in expandable section on the KSeF integration card — last 10 syncs with timestamp, invoice count pulled, and status. Reuses Phase 12 IntegrationSyncLog model.

### Invoice Intake Flow
- **D-08:** KSeF invoices enter the pipeline as RECEIVED and immediately run through the auto-matching engine (same as manual uploads). Reuses existing Phase 5 matching pipeline.
- **D-09:** Full auto-fill — all FA(3) XML fields mapped to Invoice model including line items, bank account, dates, NIPs, amounts. User reviews but rarely needs to edit since data is government-validated.
- **D-10:** Batch notification after each sync — one notification: "N new invoices from KSeF" with link to invoice list filtered by source=KSEF. Uses existing Phase 7 notification system.

### Duplicate Detection
- **D-11:** Cross-source duplicate detection by invoiceNumber + sellerTaxId (seller NIP) combination — the natural business key for Polish invoices. More reliable than hash-based approach across different sources.
- **D-12:** When duplicate found between KSeF and manual upload: flag both invoices, link them together, prefer KSeF as authoritative (government-validated data). Manual version gets "KSeF duplicate found" badge. User decides to void or keep.
- **D-13:** KSeF reference number and UPO receipt shown in both places — small KSeF badge/icon on KSeF-sourced rows in invoice list table, full KSeF reference number + UPO receipt + link to KSeF portal on invoice detail page in a dedicated metadata section.

### Claude's Discretion
- KSeF API client implementation details (session management, pagination)
- FA(3) XML parsing approach (DOM vs streaming, Zod schema for parsed output)
- KSeF-specific fields on Invoice model (ksefReferenceNumber, upoNumber, etc.) vs reusing externalInvoiceId/sourceReference
- Cron job scheduling details within QStash
- "Sync now" button loading/progress UI
- Error handling for KSeF API downtime or rate limiting
- Certificate validation and storage encryption approach
- KSeF connection setup dialog layout and form design
- Duplicate linking UI on invoice detail page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### KSeF Requirements
- `.planning/REQUIREMENTS.md` — KSEF-01 through KSEF-04 requirements
- `.planning/ROADMAP.md` Phase 17 — Success criteria, dependencies

### Invoice Data Model
- `packages/db/prisma/schema/invoice.prisma` — Invoice model with InvoiceSource.KSEF enum, InvoiceLine model, InvoiceMatchResult, all status enums. Note: externalInvoiceId and sourceReference fields available for KSeF metadata
- `packages/db/prisma/schema/integration.prisma` — IntegrationConnection, IntegrationSyncLog, WebhookDelivery models. IntegrationProvider.KSEF already defined

### Integration Infrastructure (Phase 12)
- `packages/api/src/routers/integration.ts` — Integration router with connection management, sync log patterns
- Phase 12 CONTEXT.md decisions D-01 through D-13 — credential store, webhook processing, health monitoring, adapter pattern

### Invoice Pipeline (Phase 5)
- `packages/api/src/routers/invoice.ts` — Invoice CRUD, auto-matching logic
- `apps/web/src/components/invoices/` — Invoice table, detail page, metadata form

### OCR Pipeline (Phase 16)
- Phase 16 CONTEXT.md — Async invoice processing pattern, provider-agnostic adapter, confidence scoring

### Prior Context
- `.planning/phases/12-integration-foundation/12-CONTEXT.md` — Integration adapter pattern, credential encryption, provider cards
- `.planning/phases/05-invoice-intake-matching/05-CONTEXT.md` — Invoice intake pipeline, duplicate detection, auto-matching
- `.planning/phases/16-ocr-invoice-parsing/16-CONTEXT.md` — Async processing, adapter abstraction

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IntegrationProvider.KSEF` enum: Already defined in schema, ready to use
- `InvoiceSource.KSEF` enum: Already defined, sets source tracking for KSeF-pulled invoices
- `IntegrationConnection` model: Full credential storage with encrypted JSON blob, token expiry tracking, last sync timestamps
- `IntegrationSyncLog` model: Sync history with direction, status, request/response payloads, timestamps
- Phase 12 adapter pattern: TypeScript interface + adapter for provider abstraction (proven with DocuSign/Autenti)
- Phase 5 auto-matching engine: NIP-based contractor matching, contract matching, deviation detection
- Phase 7 notification system: In-app + email notifications with templated messages
- `externalInvoiceId` field on Invoice: Can store KSeF reference number
- `sourceReference` field on Invoice: Can store UPO receipt number
- `duplicateCheckHash` field on Invoice: Existing hash-based duplicate detection

### Established Patterns
- Integration provider cards in Settings > Integrations tab with status badge, last sync, expand for details
- Upstash QStash for background job scheduling (Phase 12 token refresh cron)
- tRPC routers with tenant-scoped procedures and RBAC middleware
- Zod validation schemas in `packages/validators`
- AsyncLocalStorage for multi-tenant context scoping
- Integer grosze for all monetary values

### Integration Points
- Settings > Integrations tab: Add KSeF provider card alongside Slack/DocuSign/Autenti
- Invoice router: Extend with KSeF-specific endpoints (sync trigger, KSeF metadata display)
- Invoice list table: Add KSeF badge/icon column or source indicator
- Invoice detail page: Add KSeF metadata section (reference number, UPO, link to KSeF portal)
- Organization settings: Read NIP for KSeF queries
- Notification system: New "ksef_sync_complete" notification type

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- KSeF invoice validation against structured data — explicitly v3 (KSEF-05, KSEF-06 in REQUIREMENTS.md)
- KSeF invoice sending/issuing — out of scope, contractors issue their own
- KSeF push notifications / real-time webhooks — if KSeF adds webhook support in the future, could replace polling
- Auto-void of manual duplicate when KSeF version exists — too aggressive for v2, user should decide

</deferred>

---

*Phase: 17-ksef-integration*
*Context gathered: 2026-03-27*
