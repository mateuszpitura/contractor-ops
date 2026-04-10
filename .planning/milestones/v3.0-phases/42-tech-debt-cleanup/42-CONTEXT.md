# Phase 42: Tech Debt Cleanup - Context

**Gathered:** 2026-04-10 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate tech debt items identified in the v3.0 milestone audit: fix hardcoded retry role in onboarding wizard, wire unused InPost notification dispatch for terminal shipment statuses.

**Scope reduction:** Success criteria 1-3 (test scaffolds for billing, Linear, Google Workspace) are already satisfied — all 11 test files contain real assertions with zero `it.todo()` stubs remaining. Only SC 4 (retry role) and SC 5 (notification dispatch) require implementation.

</domain>

<decisions>
## Implementation Decisions

### Hardcoded Retry Role Fix (SC 4)
- **D-01:** Add `role` field to `failedItems` array type in `ImportJob` interface (`packages/api/src/routers/onboarding-import.ts` line 46)
- **D-02:** Update Zod schema `importProgressOutputSchema` in `packages/validators/src/onboarding-import.ts` to include `role` in failedItems
- **D-03:** Persist `person.role` when pushing to `failedItems` during `startImport` (line 368), and use stored role in `retryFailedItem` (line 465) instead of hardcoded `'readonly'`

### InPost Notification Dispatch (SC 5)
- **D-04:** Add `SHIPMENT_STATUS_CHANGE` to `NOTIFICATION_TYPES` array in `packages/validators/src/notification.ts` — no Prisma migration needed (it's a Zod string enum)
- **D-05:** In `inpost-webhook-handler.ts`, after status mapping, check if mapped status is in `NOTIFICATION_STATUSES` (DELIVERED, FAILED, RETURNED) and call `dispatch()` with the new notification type
- **D-06:** Resolve admin/owner user IDs from the organization for dispatch recipients, following the existing pattern in `billing-webhook.ts` and `google-workspace-sync-orchestrator.ts`

### Claude's Discretion
- Exact notification message template for shipment status changes
- Whether to include shipment details (tracking number, carrier) in notification metadata
- Test structure for new notification dispatch logic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Retry role fix
- `packages/api/src/routers/onboarding-import.ts` — ImportJob interface (line 46), startImport failedItems push (line 368), retryFailedItem hardcoded role (line 465)
- `packages/validators/src/onboarding-import.ts` — importProgressOutputSchema failedItems schema (lines 153-158)

### InPost notification dispatch
- `packages/api/src/services/courier/inpost-webhook-handler.ts` — Webhook handler with unused NOTIFICATION_STATUSES import (line 5)
- `packages/api/src/services/courier/inpost-status-mapper.ts` — NOTIFICATION_STATUSES constant (lines 55-59): DELIVERED, FAILED, RETURNED
- `packages/validators/src/notification.ts` — NOTIFICATION_TYPES array and NotificationType Zod enum (lines 7-28)
- `packages/api/src/services/notification-service.ts` — dispatch() function requiring recipientUserIds (line 28-36)

### Patterns to follow
- `packages/api/src/services/billing-webhook.ts` — Example of admin user lookup + dispatch() in webhook context
- `packages/api/src/services/google-workspace-sync-orchestrator.ts` — Example of admin/owner user ID resolution for dispatch

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dispatch()` from `notification-service.ts` — ready to use, takes type + recipientUserIds + metadata
- Admin user lookup pattern in `billing-webhook.ts` — query org admins/owners for recipient resolution
- `NOTIFICATION_STATUSES` already defined in `inpost-status-mapper.ts` — just needs to be referenced in the handler

### Established Patterns
- Notification dispatch: import `dispatch`, resolve recipient user IDs from org, call with type + metadata
- Zod enum extension: add string to `NOTIFICATION_TYPES` array, type updates automatically
- Webhook handlers check status conditions before dispatching side effects

### Integration Points
- `inpost-webhook-handler.ts` → `notification-service.ts` (new dispatch call)
- `onboarding-import.ts` → `onboarding-import` validators (failedItems schema sync)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard patterns apply. Follow existing billing webhook dispatch pattern for notification wiring.

</specifics>

<deferred>
## Deferred Ideas

- `workflow.test.ts` has 5 remaining `it.todo()` stubs (not in phase scope — different domain)
- DPD/UPS webhook handlers could also dispatch notifications on terminal status — future enhancement

</deferred>

---

*Phase: 42-tech-debt-cleanup*
*Context gathered: 2026-04-10*
