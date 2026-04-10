---
phase: 42
plan: 2
subsystem: courier-notifications
tags: [tech-debt, inpost, notifications, webhook]
key-files:
  modified:
    - packages/validators/src/notification.ts
    - packages/api/src/services/courier/inpost-webhook-handler.ts
    - packages/api/src/services/notification-service.ts
metrics:
  tasks: 2
  files_modified: 3
  commits: 1
---

# Plan 42-02 Summary: Wire InPost notification dispatch for terminal statuses

## What was built

Added `SHIPMENT_STATUS_CHANGE` to the `NOTIFICATION_TYPES` array in validators and `SHIPMENT` to the `EntityType` union in notification-service. The InPost webhook handler now checks if a mapped status is in `NOTIFICATION_STATUSES` (DELIVERED, FAILED, RETURNED) and dispatches a notification to org admin/owner users following the established `billing-webhook.ts` pattern.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1-2 | 766e4ed | Add notification type, entity type, and dispatch logic in webhook handler |

## Deviations

None — implementation matched the plan exactly.

## Self-Check: PASSED

- [x] `SHIPMENT_STATUS_CHANGE` added to NOTIFICATION_TYPES in validators
- [x] `SHIPMENT` added to EntityType in notification-service
- [x] `dispatch` imported from notification-service in webhook handler
- [x] `NOTIFICATION_STATUSES` used in `.includes()` check
- [x] Admin/owner lookup via `db.member.findMany` with `role: { in: ["owner", "admin"] }`
- [x] Fire-and-forget `void dispatch()` pattern
- [x] Error isolation via try/catch
- [x] TypeScript compilation passes for both packages
