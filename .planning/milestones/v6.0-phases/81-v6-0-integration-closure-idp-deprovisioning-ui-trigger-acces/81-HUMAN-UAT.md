---
status: partial
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
source: [81-VERIFICATION.md]
started: 2026-06-06T17:44:48Z
updated: 2026-06-06T17:44:48Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ACCESS_REVOKE trigger layout
expected: On a workflow run with an ACCESS_REVOKE task, the IdP-deprovisioning trigger renders inside the collapsible task **body** (block-level region), not crammed into the compact `shrink-0` header action toolbar. The full run-view panel (block + step list) does not break the toolbar layout. (WR-03 fixed in code at task-card-run.tsx; visual confirm only.)
result: [pending]

### 2. it_admin end-to-end reachability
expected: Signed in as an `it_admin` user, the deprovisioning trigger button is visible and functional on an ACCESS_REVOKE task (server grant + client `use-permissions.ts` mirror now both include `idp:start_run` for it_admin). The run starts successfully. (WR-01 fixed; reachability confirm only.)
result: [pending]

### 3. Localized tooltip for non-cooldown edge
expected: In a German or Polish session, when the trigger is disabled for a non-cooldown edge case (e.g. assignment not ENDED / no resolvable assignment), the disabled-button tooltip shows the localized generic message (`Idp.trigger.cooldownTooltipGeneric`), NOT a raw English server string. (WR-02 fixed; localized-render confirm only.)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
