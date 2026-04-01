---
status: partial
phase: 13-contractor-portal-auth-core-views
source: [13-VERIFICATION.md]
started: 2026-03-23T16:30:00Z
updated: 2026-03-23T16:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Magic link login — anti-enumeration
expected: Navigate to /portal/login, enter email, submit → "Check your inbox" confirmation shown regardless of whether email matches a contractor
result: [pending]

### 2. Single-org magic link flow
expected: Click magic link in email → portal session cookie set, redirect to /portal with top bar visible
result: [pending]

### 3. Multi-org magic link flow
expected: Click magic link for multi-org contractor → org picker cards shown; selecting one sets cookie and redirects to /portal
result: [pending]

### 4. Mobile responsive layout
expected: Mobile viewport (<768px) → top bar shows hamburger icon; clicking opens Sheet with nav links
result: [pending]

### 5. Invoice submission end-to-end
expected: Submit invoice via portal form → invoice created with RECEIVED status + PORTAL source; appears in org admin intake pipeline
result: [pending]

### 6. Sign out flow
expected: Sign out via profile dropdown → cookie cleared, DB session deleted, redirected to /portal/login
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
