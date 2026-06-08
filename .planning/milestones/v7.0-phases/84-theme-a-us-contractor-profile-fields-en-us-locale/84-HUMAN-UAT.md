---
status: partial
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
source: [84-VERIFICATION.md]
started: 2026-06-08
updated: 2026-06-08
---

## Current Test

[awaiting human testing]

## Tests

### 1. en-US locale switcher + American formatting
expected: The locale switcher lists "English (US)"; selecting it renders American-English copy, MM/DD/YYYY dates, and `$`/USD currency formatting (Intl en-US). Unchanged keys fall back to `en`.
result: [pending]

### 2. Arabic RTL non-regression
expected: After adding en-US, switching to `ar` still renders full RTL layout with no regression (logical properties intact).
result: [pending]

### 3. US contractor profile section renders (live US org)
expected: For a contractor with `countryCode='US'`, the CountryComplianceSection renders `UsComplianceFields` in UI-SPEC §A order: US entity-type dropdown, EIN input, masked SSN control, US address block, and the advisory USPS status pill. Loading/empty/error states behave.
result: [pending]

### 4. SSN reveal RBAC by role
expected: The "Reveal SSN" control is visible for owner / admin / finance_admin; for external_accountant (and the other non-granted roles) the reveal control is ABSENT (not merely disabled). Revealing shows the full SSN transiently + writes an audit row; default display is masked last-4 with no full value in the DOM.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
