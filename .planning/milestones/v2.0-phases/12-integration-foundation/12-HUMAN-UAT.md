---
status: partial
phase: 12-integration-foundation
source: [12-VERIFICATION.md]
started: 2026-03-23T14:00:00Z
updated: 2026-03-23T14:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Provider card grid renders in Settings > Integrations tab
expected: Slack card appears with correct status badge (Connected/Disconnected), status data polls every 30 seconds
result: [pending]

### 2. Manage Connection opens the detail sheet
expected: Sheet slides in from the right at 480px, showing connection metadata, Sync Log section, and Webhook Deliveries section
result: [pending]

### 3. Connect flow redirects and returns connected status
expected: Clicking Connect on a disconnected card triggers OAuth URL fetch, browser is redirected, returns with ?slack=connected, toast appears
result: [pending]

### 4. Token-refresh cron runs correctly on Vercel
expected: Every 15 minutes, connections expiring within 30 minutes are refreshed; failed ones are marked REAUTH_REQUIRED
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
