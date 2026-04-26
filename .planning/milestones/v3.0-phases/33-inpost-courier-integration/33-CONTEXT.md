# Phase 33: InPost Courier Integration - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

InPost ShipX API integration for automated shipment creation with Parcel Locker (Paczkomat) selection, auto-status tracking via webhooks with polling fallback, and contractor portal equipment return flow with label/QR delivery. Builds on Phase 30's manual shipment foundation — replaces manual status updates with API-driven automation for InPost carrier. DPD and UPS integrations are Phase 35.

</domain>

<decisions>
## Implementation Decisions

### Parcel Locker Selection
- **D-01:** Paczkomat picker uses InPost Geowidget in a modal overlay — admin clicks "Select Paczkomat" button on shipment form, modal opens with embedded map, picks locker, modal closes and populates the form
- **D-02:** InPost = Paczkomat only, no door-to-door courier option. Door delivery uses DPD/UPS in Phase 35
- **D-03:** Store contractor's preferred Paczkomat on their profile. Pre-fill on future shipments, admin can override
- **D-04:** Paczkomat picker (Geowidget modal) available on both admin panel and contractor portal (for returns)

### Status Tracking
- **D-05:** Primary: webhook endpoint receives status pushes from ShipX in real-time. Fallback: QStash-scheduled hourly polling catches missed webhook events
- **D-06:** Notifications sent on key statuses only: DELIVERED, FAILED, and RETURNED. Intermediate statuses (PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY) update silently
- **D-07:** Webhook endpoint follows existing integration webhook pipeline pattern. Polling uses QStash scheduled task (consistent with KSeF sync pattern)

### Contractor Return Flow
- **D-08:** Portal gets a new "Equipment" tab showing assigned items with a "Return" button per item that opens the return flow (Paczkomat picker -> confirm -> get label/QR)
- **D-09:** Offboarding-triggered returns also send email/notification with direct link to the return page
- **D-10:** Contractor can request return anytime (self-service) but self-initiated returns require admin approval first. Offboarding-triggered returns skip approval (already authorized by workflow)
- **D-11:** Return is all-or-nothing for the equipment set — contractor returns all assigned items in one shipment, no partial returns

### Label Delivery
- **D-12:** Admin panel shipment detail page shows label/QR code with download/print button, accessible anytime after shipment creation
- **D-13:** Contractor receives return label/QR via portal Equipment tab and email notification after return is approved

### Claude's Discretion
- Label format (QR code for Paczkomat drop-off vs PDF label) — based on ShipX API capabilities for Paczkomat shipments
- CourierClient interface design (as noted in STATE.md: separate bounded context, not BaseAdapter)
- ShipX API authentication and credential storage approach
- Webhook signature verification implementation
- Polling batch size and error retry logic
- Return approval notification template design
- Preferred Paczkomat storage field on Contractor model vs separate table
- Shipment creation form layout and field ordering
- Portal Equipment tab layout and responsive behavior

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Equipment & shipment requirements
- `.planning/REQUIREMENTS.md` — EQUIP-05 (ShipX API integration, Parcel Locker selection, auto-status tracking) and EQUIP-11 (contractor portal return with shipping label)
- `.planning/ROADMAP.md` §Phase 33 — Success criteria, Phase 30 dependency, Phase 35 dependency on this phase's CourierClient pattern

### Equipment foundation (Phase 30)
- `packages/db/prisma/schema/equipment.prisma` — Equipment, Shipment, ShipmentEvent models, ShipmentStatus/ShipmentDirection enums, EquipmentStatus lifecycle
- `packages/api/src/routers/equipment.ts` — Equipment/shipment CRUD, status transition map, SHIPMENT_TO_EQUIPMENT_STATUS mapping
- `packages/api/src/services/equipment-workflow.ts` — Workflow auto-completion on shipment delivery, EQUIPMENT task handler
- `packages/validators/src/equipment.ts` — Zod schemas for equipment/shipment validation

### Phase 30 context (decisions to carry forward)
- `.planning/phases/30-equipment-tracking-foundation/30-CONTEXT.md` — Equipment status model (D-05/D-06), shipment timeline (D-09/D-10), workflow auto-triggers (D-13-D-16), unified ShipmentStatus enum designed for courier API compatibility (D-12)

### Portal (extension point)
- `packages/api/src/routers/portal.ts` — Portal tRPC router
- `packages/api/src/middleware/portal-auth.ts` — portalProcedure authentication middleware
- `apps/web/src/app/[locale]/(portal)/portal/` — Portal route group structure

### Integration patterns
- `packages/integrations/src/adapters/base-adapter.ts` — BaseAdapter pattern (reference only — CourierClient is separate bounded context per STATE.md decision)

### Project context
- `.planning/PROJECT.md` — Architecture principles, QStash for async processing, multi-tenant patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ShipmentStatus` enum: CREATED, LABEL_GENERATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED — designed for courier API compatibility
- `SHIPMENT_TO_EQUIPMENT_STATUS` mapping in equipment.ts — auto-advances equipment status on shipment events
- `checkShipmentTaskCompletion` in equipment-workflow.ts — auto-completes workflow tasks on delivery
- `shipmentCreateSchema` / `shipmentEventCreateSchema` — Zod validators for shipment operations
- Portal route group with portalProcedure middleware — ready to extend with Equipment tab
- QStash infrastructure for scheduled tasks (KSeF sync, OCR processing patterns)
- Webhook pipeline from integration framework (signature verification, event routing)

### Established Patterns
- Multi-tenant: All queries scoped by organizationId via AsyncLocalStorage + Prisma extension
- Fire-and-forget: Integration side-effects never block user mutations (void + .catch() pattern)
- Audit trail: All state changes logged with immutable audit entries
- i18n: All UI strings through next-intl with pl/en translations
- Webhook endpoint: API routes at `apps/web/src/app/api/` with signature verification

### Integration Points
- Shipment model: `carrier` field is already a string (not enum) — supports adding InPost as a carrier value
- Equipment router: `addShipmentEvent` mutation triggers equipment status auto-advancement and workflow task completion
- Portal router: Extend with equipment list and return request endpoints
- Portal UI: New Equipment tab alongside existing Contracts, Invoices, Documents, Payments, Time, Settings tabs
- Notification service: MessagingProvider abstraction (Phase 32) for multi-channel notifications on key status changes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-inpost-courier-integration*
*Context gathered: 2026-04-04*
