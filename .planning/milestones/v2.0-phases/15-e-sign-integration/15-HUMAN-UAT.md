---
status: partial
phase: 15-e-sign-integration
source: [15-VERIFICATION.md]
started: 2026-03-27T00:00:00Z
updated: 2026-03-27T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Send for Signature flow - admin
expected: Clicking 'Send for Signature' on a DRAFT/ACTIVE contract opens the setup dialog. Provider picker shows connected DocuSign/Autenti connections. Signer list is pre-populated and drag-reorderable. Submitting sends the document and transitions contract to PENDING_SIGNATURE.
result: [pending]

### 2. Embedded signing modal - DocuSign iframe
expected: For a DocuSign envelope, clicking Sign Now loads the signing modal with a full-viewport DocuSign iframe. Completing signing fires 'signing_complete' postMessage, closes modal, and triggers toast.
result: [pending]

### 3. Redirect fallback - Autenti
expected: For an Autenti envelope, the embedded signing modal shows 'Continue to Autenti' button (no iframe). Clicking it opens the Autenti signing URL in a new tab.
result: [pending]

### 4. Webhook completion - signed PDF saved
expected: When DocuSign/Autenti sends ENVELOPE_COMPLETED webhook, the signed PDF is auto-downloaded, stored in R2, and appears as a SIGNED_COPY document linked to the contract.
result: [pending]

### 5. Signing progress bar step indicators
expected: After sending for signature, SigningProgressBar appears between header and tabs. Each signer has a step circle. Current signer pulses. Signed signer shows green checkmark. Declined shows red X.
result: [pending]

### 6. Portal pending signatures
expected: A contractor with a pending signing envelope sees 'Pending Signatures' section on portal dashboard with contract title, org name, sent date, and 'Sign Now' button.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
