# Phase 43: DPD/UPS Notification Dispatch Wiring — Research

**Researched:** 2026-04-11
**Status:** Complete

## Summary

Phase 43 wires SHIPMENT_STATUS_CHANGE notification dispatch into all three polling services (DPD, UPS, InPost) to match the pattern already implemented in the InPost webhook handler. The gap is identical in all three files — notification dispatch is missing between the `db.shipment.update()` call and the `checkShipmentTaskCompletion()` call.

## Reference Implementation Analysis

### InPost Webhook Handler (lines 178-215)

The InPost webhook handler (`inpost-webhook-handler.ts`) dispatches notifications as follows:

1. **Terminal status check:** `(NOTIFICATION_STATUSES as readonly string[]).includes(mappedStatus)` — where `NOTIFICATION_STATUSES = ["DELIVERED", "FAILED", "RETURNED"]` from `inpost-status-mapper.ts`
2. **Recipient query:** `db.member.findMany({ where: { organizationId, role: { in: ["owner", "admin"] } }, select: { userId: true } })`
3. **Fire-and-forget dispatch:** `void dispatch({ organizationId, type: "SHIPMENT_STATUS_CHANGE", recipientUserIds, title, body, entityType: "SHIPMENT", entityId: shipment.id, metadata: { shipmentId, trackingNumber, carrier, previousStatus, newStatus } })`
4. **Error handling:** `try/catch` with `console.error("[inpost-webhook] Failed to dispatch notification:", err)`

### Key Implementation Details

- `dispatch()` is imported from `../notification-service.js` — signature: `dispatch(event: NotificationEvent): Promise<void>`
- `NOTIFICATION_STATUSES` is exported from `inpost-status-mapper.ts` — reusable across all carriers
- The `carrier` field in metadata distinguishes the source: `"INPOST"`, `"DPD"`, `"UPS"`
- Notification title: `` `Shipment ${statusLabel}` `` where `statusLabel = mappedStatus.toLowerCase().replace("_", " ")`
- Notification body: `` `Shipment ${shipment.trackingNumber ?? shipment.id} status changed to ${statusLabel}.` ``

## Gap Analysis

### Polling Services — Current State

All three polling services (`dpd-polling-service.ts`, `ups-polling-service.ts`, `inpost-polling-service.ts`) have identical structure:

1. Load courier config
2. Find active shipments
3. For each shipment: poll API, deduplicate, create event, **update shipment** -> **[GAP: no notification dispatch]** -> check task completion -> advance equipment

### Insertion Point

Notification dispatch should be inserted immediately after `db.shipment.update()` (line ~141 in each file) and before `checkShipmentTaskCompletion()`. This matches the InPost webhook handler where notification dispatch (step 6a) comes before task completion check (step 6b).

## Shared Helper Design

### Decision D-02: Extract `dispatchShipmentNotification`

Per CONTEXT.md D-02/D-03, a shared helper function consolidates the notification dispatch logic:

```typescript
async function dispatchShipmentNotification(
  db: PrismaClient,
  organizationId: string,
  shipment: { id: string; trackingNumber: string | null; currentStatus: string },
  mappedStatus: string,
  carrier: string,
): Promise<void>
```

**Encapsulates:**
- Admin member query
- Status label formatting
- `dispatch()` call with SHIPMENT_STATUS_CHANGE type and shipment metadata
- try/catch error logging

**Does NOT include:**
- Terminal status check — callers handle this since each service has its own flow control
- The `NOTIFICATION_STATUSES` import — callers check before calling the helper

### File Location Options

1. **New file `packages/api/src/services/courier/shipment-notification.ts`** — Clean separation, single responsibility
2. **Add to `notification-service.ts`** — Keeps notification logic together but couples to courier domain
3. **Add to existing courier util** — No existing util file exists

**Recommendation:** Option 1 (new file) — it is courier-domain-specific but not carrier-specific, so it belongs in the courier directory.

## Import Dependencies

Each polling service needs two new imports:

1. `dispatch` from `../notification-service.js` (or the shared helper)
2. `NOTIFICATION_STATUSES` from `./inpost-status-mapper.js` (already exported, carrier-agnostic name)

For the shared helper approach (D-02), polling services only need:
1. `dispatchShipmentNotification` from `./shipment-notification.js`
2. `NOTIFICATION_STATUSES` from `./inpost-status-mapper.js`

## Testing Strategy

### Existing Test Files

- `dpd-polling-service.test.ts` — Tests DPD polling; needs notification dispatch assertions
- `ups-polling-service.test.ts` — Tests UPS polling; needs notification dispatch assertions
- `inpost-polling-service.test.ts` — Tests InPost polling; needs notification dispatch assertions
- `inpost-webhook-handler.test.ts` — Reference for notification dispatch test patterns

### Test Approach

Mock `dispatch` from `notification-service.js` and verify:
1. `dispatch` is called when `mappedStatus` is in `NOTIFICATION_STATUSES`
2. `dispatch` is NOT called for non-terminal statuses
3. `dispatch` failure does not break the polling loop (fire-and-forget)
4. Correct `carrier` field in metadata (`"DPD"`, `"UPS"`, `"InPost"`)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Duplicate notifications (webhook + polling) | User sees same notification twice | Already mitigated — InPost uses webhooks as primary, polling as fallback. DPD/UPS use polling only (no webhooks). The deduplication at ShipmentEvent level prevents duplicate status updates, so notification dispatch only fires on actual status changes. |
| Notification failure blocks polling | Polling stops mid-batch | Fire-and-forget pattern (`void dispatch(...)`) with try/catch prevents this |
| `NOTIFICATION_STATUSES` from inpost-status-mapper | Coupling to InPost module | Acceptable — the constant is carrier-agnostic (DELIVERED/FAILED/RETURNED are universal). Could be moved to a shared constants file later if needed. |

## Validation Architecture

### Coverage Requirements

| Requirement | Test Type | Verification |
|-------------|-----------|-------------|
| EQUIP-06: DPD notification dispatch | Unit | Mock `dispatch`, assert called with correct args on DELIVERED/FAILED/RETURNED |
| EQUIP-07: UPS notification dispatch | Unit | Mock `dispatch`, assert called with correct args on DELIVERED/FAILED/RETURNED |
| InPost polling notification dispatch | Unit | Mock `dispatch`, assert called with correct args on DELIVERED/FAILED/RETURNED |
| Shared helper correctness | Unit | Test `dispatchShipmentNotification` in isolation |
| Non-terminal status skip | Unit | Assert `dispatch` NOT called for IN_TRANSIT, SENT, etc. |
| Error isolation | Unit | Assert polling continues after `dispatch` throws |

### Test Infrastructure

- **Framework:** Vitest (already used in existing polling tests)
- **Test runner:** `npx vitest run packages/api/src/services/courier/__tests__/{file}`
- **Mocking:** `vi.mock("../notification-service.js")` pattern from existing tests

---

## RESEARCH COMPLETE
