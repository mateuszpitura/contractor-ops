---
title: Equipment logistics
type: domain
tags: [equipment, shipments, couriers]
source_commit: b618a39e5
verify_with:
  - packages/api/src/routers/equipment/
  - packages/api/src/services/courier/
updated: 2026-06-10
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
- Return notifications (APPROVED/REJECTED/REQUESTED, `equipment-returns.ts` + `portal-equipment-router.ts`) are enqueued through the outbox INSIDE that same txn (`enqueueNotificationOutboxEvent`, dedupKey `equipment-return-*:<id>`) — exactly-once, not post-commit fire-and-forget. See [[notifications-and-reminders]]
- Return approve / reject — DB writes + audit in one txn (InPost label call stays pre-txn); the `EQUIPMENT_RETURN_APPROVED` / `_REJECTED` contractor notification is now enqueued into the transactional outbox **inside** that `auditedMutation` tx (`enqueueNotificationDispatch({ tx })`, dedupKey `EQUIPMENT_RETURN_APPROVED|_REJECTED:${returnRequestId}`) — delivered exactly-once by the drain, not post-commit fire-and-forget. See [[patterns/transactional-outbox]].
- Courier shipment creates (`equipment-couriers`) — same pattern

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
