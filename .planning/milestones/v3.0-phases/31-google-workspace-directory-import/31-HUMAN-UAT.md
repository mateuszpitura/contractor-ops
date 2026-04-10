---
status: partial
phase: 31-google-workspace-directory-import
source: [31-VERIFICATION.md]
started: 2026-04-02T16:15:00Z
updated: 2026-04-02T16:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. OAuth Connect Flow
expected: Google OAuth consent screen opens with Admin SDK scopes visible. After granting access, page redirects back showing connected state and import wizard auto-opens.
result: [pending]

### 2. Disconnect and Token Revocation
expected: Section reverts to disconnected state. Stored credentials cleared from database.
result: [pending]

### 3. Import Wizard — Directory Preview
expected: Paginated table loads with real directory users showing name, email, department, org unit. Already-imported users greyed out with "Already exists" badge.
result: [pending]

### 4. Import Wizard — Roles Step and Confirm
expected: Groups from selected users appear with role dropdowns. Confirm step shows role breakdown. Import button creates invitations with success/partial-failure toast.
result: [pending]

### 5. Periodic Sync — New Hire and Departure Detection
expected: New team member notification appears after directory addition. Departure notification appears after removal. No auto-create or auto-delete.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
