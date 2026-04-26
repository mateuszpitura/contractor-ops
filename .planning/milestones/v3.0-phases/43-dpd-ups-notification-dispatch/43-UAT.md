---
status: complete
phase: 43-dpd-ups-notification-dispatch
source: [43-01-SUMMARY.md]
started: 2026-04-11T22:20:00Z
updated: 2026-04-11T22:22:00Z
---

## Current Test

[testing complete]

## Tests

### 1. DPD Polling Notification Dispatch
expected: DPD polling service dispatches SHIPMENT_STATUS_CHANGE notification when shipment reaches terminal status (DELIVERED/FAILED/RETURNED). Admin members receive notification with carrier=DPD metadata.
result: pass

### 2. UPS Polling Notification Dispatch
expected: UPS polling service dispatches SHIPMENT_STATUS_CHANGE notification when shipment reaches terminal status (DELIVERED/FAILED/RETURNED). Admin members receive notification with carrier=UPS metadata.
result: pass

### 3. InPost Polling Notification Dispatch
expected: InPost polling service dispatches SHIPMENT_STATUS_CHANGE notification when shipment reaches terminal status (DELIVERED/FAILED/RETURNED). Admin members receive notification with carrier=INPOST metadata.
result: pass

### 4. InPost Webhook Handler Still Works
expected: InPost webhook handler still processes webhook payloads correctly after refactoring to use shared helper. Notification dispatch, event creation, equipment status advancement all function as before.
result: pass

### 5. Shared Helper Consistency
expected: All notification dispatches (3 polling services + 1 webhook handler) use the same shared dispatchShipmentNotification helper. Notification format (title, body, metadata) is identical across all carriers — only the carrier field differs.
result: pass

### 6. Test Suite Passes
expected: All courier test files pass with no failures. Run: `npx vitest run src/services/courier/` in packages/api — all 106+ tests should pass including new notification dispatch tests.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
