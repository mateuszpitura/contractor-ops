---
status: partial
phase: 60-classification-polish
source: [60-VERIFICATION.md]
started: 2026-04-14T00:00:00Z
updated: 2026-04-14T16:56:00Z
---

## Current Test

[testing paused — 4 items outstanding]

## Tests

### 1. Economic-dependency threshold end-to-end
expected: classification.economic_dependency_warning dispatched when billing share crosses 0.70; classification.economic_dependency_critical dispatched when share reaches or exceeds 5/6. No notification when share < 0.70.
result: [pending]

### 2. Classification dashboard renders real data
expected: Both market cards (GB and DE) render all 4 tiles with non-empty data. Risk-distribution stacked bar shows coloured segments with tooltips. CSV download produces a file with UTF-8 BOM; cells starting with =/+/-/@ are prefixed with a single quote.
result: [pending]

### 3. DRV clearance panel form validation
expected: On a DE engagement page, the StatusfeststellungsverfahrenPanel renders. The "File new clearance" CTA opens the DrvClearanceForm dialog. Submitting with outcome=SELBSTANDIG and empty validFrom/validTo shows a visible validation error. Once fields are filled, submission succeeds and the panel list updates.
result: [pending]

### 4. Reassessment trigger creation on material change
expected: After amending a UK contractor's rate on an active engagement and triggering the reassessment-triggers cron, an AuditLog row is written (resourceType=CONTRACT, action=UPDATE_CONTRACT); cron scan creates a ReassessmentTrigger row with status=OPEN; classification.reassessment_trigger notification dispatched to contractor:read-permissioned users; submitting a new IR35 assessment auto-resolves the trigger.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
