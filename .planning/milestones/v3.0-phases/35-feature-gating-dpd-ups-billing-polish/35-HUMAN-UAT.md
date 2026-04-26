---
status: partial
phase: 35-feature-gating-dpd-ups-billing-polish
source: [35-VERIFICATION.md]
started: 2026-04-05T12:00:00Z
updated: 2026-04-05T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Test connection button (Settings > Integrations)
expected: Button shows loading spinner, then a success or failure toast ('Connection verified' or 'Connection failed') — no tRPC error
result: [pending]

### 2. DPD/UPS shipment creation end-to-end
expected: Shipment is created, tracking number appears, equipment status changes to IN_TRANSIT
result: [pending]

### 3. FeatureGate visual behavior (STARTER plan)
expected: UpgradeInlineBanner renders with Gem icon, feature name, and 'Upgrade Plan' CTA linking to /settings?tab=billing
result: [pending]

### 4. UsageDashboard live rendering (PRO subscription)
expected: UsageDashboard renders 4 KPI cards with real data: current plan name, active contractor count, OCR credits progress bar in correct color, and next billing date
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
