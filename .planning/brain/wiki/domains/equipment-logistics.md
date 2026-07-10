---
title: Equipment logistics
type: domain
tags: [equipment, shipments, couriers]
source_commit: e0d533fa5
verify_with:
  - packages/api/src/routers/equipment/
  - packages/api/src/services/courier/shipment-processing.ts
  - packages/api/src/services/equipment-workflow.ts
  - packages/db/prisma/schema/equipment.prisma
updated: 2026-07-10
---

# Equipment logistics

## Purpose

Equipment CRUD, contractor assignment, shipment tracking (InPost/DPD/UPS), return approvals, portal equipment view.

## Entry points

| Piece | Path |
|-------|------|
| Router | `equipment` — `packages/api/src/routers/equipment/` |
| Couriers | `packages/api/src/services/courier/` |
| Portal equipment | `routers/portal/portal-equipment-router.ts` |
| UI | `apps/web-vite/src/components/equipment/` |

## Invariants

- Shipment create / status event / delete — `auditedMutation` + `auditMutationCtx` (same txn as audit row)
- Return approve / reject — DB writes + audit in one txn (InPost label call stays pre-txn)
- **`ReturnRequestStatus.RECEIVED`** — terminal state after courier delivery (migration `20260708120000_equipment_return_received`); portal return flow can complete past `SHIPMENT_CREATED`
- Return notifications (APPROVED/REJECTED/REQUESTED, `equipment-returns.ts` + `portal-equipment-router.ts`) are enqueued through the outbox INSIDE that same txn (`enqueueNotificationOutboxEvent`, dedupKey `equipment-return-*:<id>`) — exactly-once, not post-commit fire-and-forget. See [[notifications-and-reminders]]
- Return approve / reject — DB writes + audit in one txn (InPost label call stays pre-txn); the `EQUIPMENT_RETURN_APPROVED` / `_REJECTED` contractor notification is now enqueued into the transactional outbox **inside** that `auditedMutation` tx (`enqueueNotificationDispatch({ tx })`, dedupKey `EQUIPMENT_RETURN_APPROVED|_REJECTED:${returnRequestId}`) — delivered exactly-once by the drain, not post-commit fire-and-forget. See [[patterns/transactional-outbox]].
- Courier shipment creates (`equipment-couriers`) — same pattern; **`createInPostShipment` filters equipment through `EQUIPMENT_STATUS_TRANSITIONS` before `updateMany`** (DPD/UPS parity).
- **Offboarding auto-InPost (`equipment-workflow.ts`):** ShipX `createShipment` runs **after** the workflow-start tx commits; DB shipment rows + `ReturnRequest` persist in a nested tx — HTTP latency never holds workflow row locks. **`shipment.createInPostAuto`** audit in tx; shipment-driven task auto-complete writes **`workflow.equipment_task.auto_completed`** audit.
- **`processShipmentStatusChange` (poll/webhook):** event + shipment status + equipment transition + **`shipment.updateStatus` SYSTEM audit** in one `$transaction`; notifications and workflow auto-complete stay post-tx.
- **Shipment status is rank-guarded (`shouldApplyShipmentStatusUpdate`):** DELIVERED/RETURNED are immutable; out-of-order webhooks can't regress a non-terminal status; FAILED may still progress to OUT_FOR_DELIVERY/DELIVERED/RETURNED (couriers retry failed deliveries — InPost `not_delivered` → `returned_to_sender`). All four entry points (InPost webhook + DPD/InPost/UPS pollers) route through it.
- **`createShipment` (manual):** links `assignmentId` from the active equipment assignment when present.

## Related

- [[portal-external]]
- [[contractors-engagements]]
- [[decisions/tech-debt-hotspots]] (InPost webhook fail-open)

## Verify live

```bash
semble search "equipmentRouter"
semble search "inpost-webhook"
```

## Agent mistakes

- Webhook verify fail-open when copying InPost pattern
- Post-commit `writeAuditLog` after shipment/return `$transaction` (use `auditedMutation`)
