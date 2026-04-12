---
status: partial
phase: 48-zatca-fatoorah-integration
source: [48-VERIFICATION.md]
started: 2026-04-12T10:15:00Z
updated: 2026-04-12T10:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ZATCA Settings Wizard Visual Verification
expected: 5-step onboarding wizard renders correctly in Settings > Integrations > ZATCA; stepper shows horizontal on desktop and vertical on mobile; all step forms validate before allowing Next; copy matches 48-UI-SPEC.md
result: [pending]

### 2. Onboarding Wizard Keyboard Navigation
expected: Arrow keys navigate between stepper steps, Enter selects, aria-current='step' is correct, screen reader announces step changes
result: [pending]

### 3. Environment Toggle Confirmation Flow
expected: Production -> Sandbox shows confirmation dialog; Sandbox -> Production requires completed onboarding; selected environment shows ring-2 ring-primary styling
result: [pending]

### 4. ZATCA Status Badge on Invoice Detail
expected: ZatcaStatusBadge appears in invoice header next to invoice status badge for Saudi org invoices; badge text matches zatcaStatus value (Cleared, Reported, Rejected)
result: [pending]

### 5. ZatcaSubmissionDetail Panel on Invoice Detail
expected: Collapsible ZATCA submission panel renders below content sections showing UUID, ICV counter, hash chain display, QR code image, and resubmit action button
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

[none]
