---
status: partial
phase: 85-theme-a-w-form-intake-tax-treaty-engine
source: [85-VERIFICATION.md]
started: 2026-06-16
updated: 2026-06-16
---

## Current Test

[awaiting human browser testing]

## Tests

### 1. Portal W-9 wizard end-to-end
expected: Determination step routes to W-9 for a US contractor; the attestation gate stays disabled until all perjury checkboxes are ticked AND the typed legal name matches; receipt renders on submit. (Requires `FLAG_SIGNOFF_BYPASS=local` or `QA_DEFAULT_ORG_ID` set so `module.us-expansion` resolves on.)
result: [pending]

### 2. W-8BEN treaty auto-populate (PL contractor)
expected: For a PL-resident contractor, the W-8BEN step shows "Article 7 — 0%" pre-filled, announced via an `aria-live` region. (Requires a PL contractor profile + the seeded US treaty rows on the live DB.)
result: [pending]

### 3. Re-certification supersede flow
expected: Submitting a second W-9 for the same contractor flips the first record to SUPERSEDED with `supersededById` pointing at the new ACTIVE row (append-only — no mutation of the signed record).
result: [pending]

### 4. Staff status-card PII gating
expected: Logged in WITHOUT `contractorPii:read`, the SSN reveal control is ABSENT from the DOM (not merely hidden) on the tax-form status card.
result: [pending]

### 5. RTL rendering (Arabic locale)
expected: In `ar`, the stepper arrow flips, labels flow right-to-left, no layout breakage. (Grep confirmed zero physical `ml-`/`mr-`/`text-left` and zero `font-medium`; logical RTL is only confirmable visually.)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
