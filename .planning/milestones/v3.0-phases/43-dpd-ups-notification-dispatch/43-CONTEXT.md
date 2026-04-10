# Phase 43: DPD/UPS Notification Dispatch Wiring - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire SHIPMENT_STATUS_CHANGE notification dispatch into DPD and UPS polling services on terminal statuses (DELIVERED, FAILED, RETURNED), matching the pattern already implemented in the InPost webhook handler. Also fix the same gap in the InPost polling service.

</domain>

<decisions>
## Implementation Decisions

### Notification Scope
- **D-01:** Fix all three polling services (DPD, UPS, and InPost) — not just DPD/UPS. The InPost polling service has the identical missing notification dispatch gap and fixing it here avoids a separate phase for one copy-paste.

### Code Sharing Approach
- **D-02:** Extract a shared `dispatchShipmentNotification(db, organizationId, shipment, mappedStatus, carrier)` helper function. All 4 call sites (InPost webhook handler + 3 polling services) use it. Single place to change notification format, recipient logic, or metadata shape.
- **D-03:** The shared helper encapsulates: querying admin members, formatting title/body, calling `dispatch()` with SHIPMENT_STATUS_CHANGE type and shipment metadata. Terminal status check (DELIVERED/FAILED/RETURNED) stays at the call site since each service already has its own flow control.

### Notification Content
- **D-04:** Polling-triggered notifications are identical to webhook-triggered ones — same title, body, and metadata structure. Users don't care how the status was detected. The `carrier` field in metadata (INPOST/DPD/UPS) already distinguishes the source carrier.

### Claude's Discretion
- Shared helper file location (new file vs add to existing notification-service.ts or a courier-notification.ts)
- Whether to refactor the InPost webhook handler to also use the shared helper (recommended for consistency, but optional)
- Error handling approach in the helper (try/catch with console.error, matching InPost webhook pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Notification dispatch pattern (InPost webhook — the reference implementation)
- `packages/api/src/services/courier/inpost-webhook-handler.ts` lines 178-215 — The exact notification dispatch block to replicate: queries admin members, calls `dispatch()` with SHIPMENT_STATUS_CHANGE type
- `packages/api/src/services/notification-service.ts` — `dispatch()` function signature and parameters

### DPD/UPS polling services (files to modify)
- `packages/api/src/services/courier/dpd-polling-service.ts` — DPD polling, missing notification dispatch after status update
- `packages/api/src/services/courier/ups-polling-service.ts` — UPS polling, missing notification dispatch after status update
- `packages/api/src/services/courier/inpost-polling-service.ts` — InPost polling, same missing notification dispatch gap

### Terminal notification statuses
- `packages/api/src/services/courier/inpost-status-mapper.ts` lines 55-59 — `NOTIFICATION_STATUSES` constant: DELIVERED, FAILED, RETURNED

### Requirements
- `.planning/REQUIREMENTS.md` — EQUIP-06 (DPD integration), EQUIP-07 (UPS integration)
- `.planning/ROADMAP.md` §Phase 43 — Success criteria, gap closure context

### Prior phase decisions
- `.planning/phases/33-inpost-courier-integration/33-CONTEXT.md` — D-06: notifications on DELIVERED, FAILED, RETURNED only
- `.planning/phases/35-feature-gating-dpd-ups-billing-polish/35-CONTEXT.md` — D-07: polling only for DPD/UPS status tracking

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dispatch()` from `notification-service.ts` — already used by InPost webhook handler, ready to import
- `NOTIFICATION_STATUSES` from `inpost-status-mapper.ts` — defines terminal statuses that trigger notifications (DELIVERED, FAILED, RETURNED)
- Admin member query pattern — `db.member.findMany({ where: { organizationId, role: { in: ["owner", "admin"] } } })` used in InPost webhook handler

### Established Patterns
- All three polling services follow identical structure: load config -> find active shipments -> poll each -> deduplicate -> create event -> update status -> check task completion -> advance equipment
- InPost webhook handler adds notification dispatch between "update status" and "check task completion" steps
- Notification dispatch is fire-and-forget (`void dispatch(...)`) with try/catch error logging

### Integration Points
- Notification dispatch inserts after the `db.shipment.update()` call in each polling service's update loop
- The `carrier` metadata field must match the carrier string used in each service (DPD, UPS, InPost)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the implementation closely follows the existing InPost webhook handler pattern. The shared helper extraction is the main architectural decision.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-dpd-ups-notification-dispatch*
*Context gathered: 2026-04-11*
