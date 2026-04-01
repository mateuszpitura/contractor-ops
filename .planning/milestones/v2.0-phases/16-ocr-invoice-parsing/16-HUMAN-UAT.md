---
status: partial
phase: 16-ocr-invoice-parsing
source: [16-VERIFICATION.md]
started: 2026-03-27T17:05:00Z
updated: 2026-03-27T17:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Admin OCR flow
expected: Upload PDF → processing overlay appears → fields pre-fill with confidence badges → split panel with PDF viewer works
result: [pending]

### 2. Portal OCR flow
expected: Contractor uploads PDF → OCR triggers → form fields pre-fill → "We've pre-filled some fields" banner shows → inline confidence badges visible
result: [pending]

### 3. PARTIAL/FAILED extraction handling
expected: Non-invoice PDF shows PARTIAL or FAILED status → helpful error message → manual entry still works
result: [pending]

### 4. Re-run and discard actions
expected: AlertDialog for re-run and discard → actions trigger correctly → UI updates
result: [pending]

### 5. NIP confidence cap visible in UI
expected: Invalid NIP in extracted data shows confidence capped to 40 → NipValidationBadge shows invalid state
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
