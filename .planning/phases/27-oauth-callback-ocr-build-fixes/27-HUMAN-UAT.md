---
status: partial
phase: 27-oauth-callback-ocr-build-fixes
source: [27-VERIFICATION.md]
started: 2026-04-01T17:15:00Z
updated: 2026-04-01T17:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live OAuth connect flow
expected: Trigger a real OAuth redirect for any provider — browser lands on `/settings?tab=integrations&{provider}=connected` and `IntegrationConnection` row is created with `status=CONNECTED` and encrypted `credentialsRef`
result: [pending]

### 2. Next.js production build
expected: Run `npx turbo build --filter=@contractor-ops/web` — exits 0 with no react-pdf CSS errors in output
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
