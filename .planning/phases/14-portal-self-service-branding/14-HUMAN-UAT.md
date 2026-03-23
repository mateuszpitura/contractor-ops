---
status: partial
phase: 14-portal-self-service-branding
source: [14-VERIFICATION.md]
started: 2026-03-23T21:00:00Z
updated: 2026-03-23T21:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Brand color CSS custom property in browser
expected: Navigating to portal as a contractor of an org with a brand color set should show --brand-accent property on the root portal div. Buttons and links in the portal should visually reflect the accent color.
result: [pending]

### 2. No CSS injection when brand color is not set
expected: Portal should use the default theme (no --brand-accent CSS custom property present on root div) when org has no brand color configured.
result: [pending]

### 3. Optimistic notification toggle rollback
expected: Toggling a notification preference while the network request fails should roll back the toggle to its previous state and display a toast error.
result: [pending]

### 4. Financial change request pending banner
expected: After a contractor submits a financial change request, the Financial Details section should show the PendingChangeBanner with the submission date. Expanding 'View submitted changes' should list the changed fields.
result: [pending]

### 5. Subdomain portal routing in browser
expected: Navigating to acme.portal.localhost:3000 (with PORTAL_BASE_DOMAIN=portal.localhost:3000) should serve the portal with Acme's branding (logo and brand color) on the unauthenticated login shell. The x-portal-org-subdomain header should be visible in network requests.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
