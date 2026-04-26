---
status: partial
phase: 36-wiring-fixes-webhook-ui-featuregate
source: [36-VERIFICATION.md]
started: 2026-04-05T13:25:00.000Z
updated: 2026-04-05T13:25:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Linear webhook round-trip
expected: Trigger a Linear issue status change → verify QStash processes inbound webhook → Linear issue state reflects in app
result: [pending]

### 2. DPD/UPS credential form UX
expected: Navigate to Settings > Integrations → DPD and UPS cards visible → Configure opens dialog with CarrierCredentialForm → credentials save successfully
result: [pending]

### 3. TIER_REQUIRED toast behavior
expected: As STARTER user, trigger a PRO-gated mutation → see upgrade toast with link to billing settings (not raw tRPC error)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
