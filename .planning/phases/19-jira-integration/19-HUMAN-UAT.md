---
status: partial
phase: 19-jira-integration
source: [19-VERIFICATION.md]
started: 2026-03-29T10:00:00Z
updated: 2026-03-29T10:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. OAuth connect flow for Jira Cloud
expected: Clicking Connect in Jira provider card initiates OAuth 2.0 3LO flow, redirects to Atlassian, then back; connection status shows CONNECTED
result: [pending]

### 2. Status mapping dialog — project selector loads Jira projects
expected: Opening Configure Status Mapping dialog populates project dropdown from Jira API; selecting a project populates status dropdown per row
result: [pending]

### 3. Outbound sync — completing a task transitions Jira issue
expected: Marking a workflow task DONE triggers the linked Jira issue transition within seconds; IntegrationSyncLog shows direction=OUTBOUND status=SUCCESS
result: [pending]

### 4. Inbound sync — changing Jira issue status updates workflow task
expected: Changing a Jira issue status updates the linked WorkflowTaskRun status; loop prevention prevents infinite bounce
result: [pending]

### 5. Scope expansion detection — Phase 18 connection shows re-auth banner
expected: Connection with only read:jira-work scope shows AlertTriangle warning; re-auth clears banner and shows Configure Status Mapping button
result: [pending]

### 6. JiraTaskConfig render gate — only appears for saved task templates
expected: Newly added (unsaved) tasks do not show JiraTaskConfig; after saving a task template, the Jira configuration toggle appears in the expanded settings
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
