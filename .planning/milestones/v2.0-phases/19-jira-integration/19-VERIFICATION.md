---
phase: 19-jira-integration
verified: 2026-03-29T10:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - "JiraTaskConfig is now imported and rendered in task-card.tsx (line 43 import, line 489 render)"
    - "siteUrl 'your-site' hardcoded fallback removed — null-safe resolution: config.siteUrl ?? (config.siteName ? `https://${config.siteName}.atlassian.net` : null)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "OAuth connect flow for Jira Cloud"
    expected: "Clicking Connect in Jira provider card initiates OAuth 2.0 3LO flow, redirects to Atlassian, then back; connection status shows CONNECTED"
    why_human: "OAuth redirect flow cannot be verified programmatically without a live Atlassian account"
  - test: "Status mapping dialog — project selector loads Jira projects"
    expected: "Opening Configure Status Mapping dialog populates project dropdown from Jira API; selecting a project populates status dropdown per row"
    why_human: "Requires live Jira connection with real data"
  - test: "Outbound sync — completing a task transitions Jira issue"
    expected: "Marking a workflow task DONE triggers the linked Jira issue transition within seconds; IntegrationSyncLog shows direction=OUTBOUND status=SUCCESS"
    why_human: "Requires live Jira connection and a linked issue (externalRefType=JIRA_ISSUE)"
  - test: "Inbound sync — changing Jira issue status updates workflow task"
    expected: "Changing a Jira issue status updates the linked WorkflowTaskRun status; loop prevention prevents infinite bounce"
    why_human: "Requires live Jira webhook delivery; loop prevention timing cannot be verified statically"
  - test: "Scope expansion detection — Phase 18 connection shows re-auth banner"
    expected: "Connection with only read:jira-work scope shows AlertTriangle warning; re-auth clears banner and shows Configure Status Mapping button"
    why_human: "Requires a database record with the specific Phase 18 credential scope string"
  - test: "JiraTaskConfig render gate — only appears for saved task templates"
    expected: "New unsaved task card shows no Jira section (task.id undefined); saved task card shows JiraTaskConfig with switch and Configure Jira button"
    why_human: "task?.id guard is correct in code but whether the template builder surfaces a persisted id coherently requires UI interaction to confirm"
---

# Phase 19: Jira Integration Verification Report

**Phase Goal:** Users can connect their Jira Cloud instance to Contractor Ops and keep workflow task statuses in bidirectional sync with Jira issues
**Verified:** 2026-03-29T10:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 19-05)

---

## Re-Verification Summary

The single blocker gap from initial verification is confirmed closed. No regressions detected on any of the 11 previously-passing truths.

**Gap closed: JiraTaskConfig mounted in task-card.tsx**

`task-card.tsx` line 43: `import { JiraTaskConfig } from "@/components/integrations/jira-task-config";`

Lines 487-490:
```tsx
{/* Jira integration — only for saved task templates */}
{task?.id && (
  <JiraTaskConfig taskTemplateId={task.id} />
)}
```

The component is gated on `task?.id` being truthy, so it only appears for task templates that have already been persisted. This is correct product behaviour — a brand-new unsaved task has no ID to bind `saveTaskConfig` to.

**Warning closed: "your-site" fallback hardened**

`jira-issue-sync.ts` lines 148-152:
```typescript
// siteUrl is set during OAuth discovery...
// Fall back to cloudId-based browsable URL if siteUrl/siteName missing (e.g., Phase 18 connections).
const siteUrl = config.siteUrl
  ?? (config.siteName ? `https://${config.siteName}.atlassian.net` : null);
```

The literal string `"your-site"` is gone. If neither `siteUrl` nor `siteName` is present, `siteUrl` is `null` and `issueUrl` (line 221) is set to `null`, so the chip renders without a broken URL.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test stubs exist for all Jira backend services | VERIFIED | 19/20/9/12 it.todo entries across 4 test files |
| 2 | JiraAdapter has expanded OAuth scopes and supports webhook verification | VERIFIED | `supportsWebhooks = true`, scopes include `write:jira-work` and `manage:jira-webhook`, HMAC-SHA256 `verifyWebhookSignature` |
| 3 | Issue sync service can create Jira issues and execute transitions | VERIFIED | `createJiraIssue` (ADF format, ExternalLink creation, sync log), `transitionJiraIssue` (loop prevention marker, mapping lookup) |
| 4 | Webhook handler processes inbound status changes with loop prevention | VERIFIED | `processJiraWebhook` with 30s loop prevention window; `registerJiraWebhooks`, `deregisterJiraWebhooks`, `refreshJiraWebhooks` |
| 5 | Status mapping service provides CRUD and bidirectional lookup | VERIFIED | `saveStatusMapping`, `getStatusMapping`, `lookupJiraTransitionId`, `lookupWorkflowStatus` |
| 6 | Admin can list Jira projects and issue types via tRPC | VERIFIED | 8 queries in jiraRouter mounted on root.ts at line 77 |
| 7 | Admin can save and retrieve status mappings via tRPC | VERIFIED | `saveStatusMapping`, `saveTaskConfig`, `disconnect` mutations; `saveStatusMapping` also calls `registerJiraWebhooks` |
| 8 | Jira webhooks are received and routed through unified pipeline | VERIFIED | `_process/route.ts` `if (provider === "jira")` block at line 74 calls `processJiraWebhook` |
| 9 | Completing or skipping a workflow task triggers outbound Jira transition | VERIFIED | `completeTask` and `skipTask` both contain fire-and-forget `void (async () => { ... })()` blocks with `transitionJiraIssue` |
| 10 | Admin can see Jira provider card in integration settings | VERIFIED | `JiraProviderSection` imported at line 15 and rendered at line 227 of `integrations-tab.tsx` |
| 11 | Admin can configure status mapping per Jira project | VERIFIED | `JiraStatusMappingDialog` substantive: project selector, 6-row table, `trpc.jira.saveStatusMapping` mutation, AlertTriangle for unmapped rows |
| 12 | Task template editor has inline Jira configuration toggle | VERIFIED | `JiraTaskConfig` imported at line 43 and rendered at lines 488-490 of `task-card.tsx`, gated on `task?.id` |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/services/__tests__/jira-issue-sync.test.ts` | Wave 0 test stubs | VERIFIED | 19 it.todo entries |
| `packages/api/src/services/__tests__/jira-webhook-handler.test.ts` | Wave 0 test stubs | VERIFIED | 20 it.todo entries |
| `packages/api/src/services/__tests__/jira-status-mapping.test.ts` | Wave 0 test stubs | VERIFIED | 9 it.todo entries |
| `packages/integrations/src/__tests__/jira-adapter-webhooks.test.ts` | Wave 0 test stubs | VERIFIED | 12 it.todo entries |
| `packages/integrations/src/adapters/jira-adapter.ts` | Extended JiraAdapter with write scopes + webhook support | VERIFIED | `supportsWebhooks = true`, all four OAuth scopes |
| `packages/api/src/services/jira-issue-sync.ts` | Issue creation and outbound transition service | VERIFIED | `createJiraIssue`, `transitionJiraIssue`, `detectScopeExpansionNeeded`; null-safe `siteUrl` |
| `packages/api/src/services/jira-webhook-handler.ts` | Inbound webhook processing with loop prevention | VERIFIED | All four exports confirmed |
| `packages/api/src/services/jira-status-mapping.ts` | Status mapping CRUD and bidirectional lookup | VERIFIED | All four exports confirmed |
| `packages/validators/src/jira.ts` | Zod schemas for all Jira data shapes | VERIFIED | 6+ schemas including webhook payload and task config |
| `packages/api/src/routers/jira.ts` | tRPC router with 11 procedures | VERIFIED | 8 queries + 3 mutations |
| `packages/api/src/root.ts` | App router with jira namespace | VERIFIED | `jira: jiraRouter` at line 77 |
| `apps/web/src/app/api/webhooks/_process/route.ts` | Jira provider dispatch block | VERIFIED | `if (provider === "jira")` block at line 74 |
| `apps/web/src/components/integrations/jira-task-config.tsx` | Inline task template toggle | VERIFIED | Was ORPHANED; now imported and rendered in task-card.tsx |
| `apps/web/src/components/integrations/jira-provider-section.tsx` | Jira provider card | VERIFIED | Rendered in integrations-tab.tsx line 227 |
| `apps/web/src/components/integrations/jira-status-mapping-dialog.tsx` | Status mapping dialog | VERIFIED | Substantive: 6 workflow statuses, project selector, mutation |
| `apps/web/src/components/integrations/jira-project-mapping-dialog.tsx` | Project/issue type mapping dialog | VERIFIED | `trpc.jira.listIssueTypes`, `trpc.jira.saveTaskConfig`, auto-create Switch |
| `apps/web/src/components/integrations/jira-issue-chip.tsx` | Reusable issue chip | VERIFIED | `target="_blank"`, `aria-label`, status category colour branches |
| `apps/web/src/components/integrations/jira-activity-summary.tsx` | Recent Jira activity card | VERIFIED | `trpc.jira.recentActivity`, skeleton rows, null guard |
| `apps/web/src/components/settings/integrations-tab.tsx` | JiraProviderSection in grid | VERIFIED | Imported line 15, rendered line 227 |
| `apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx` | JiraActivitySummary + inline chips | VERIFIED | Both imported and rendered |
| `apps/web/src/components/workflows/workflow-side-panel.tsx` | Linked Issues section | VERIFIED | `JiraIssueChip` in `LinkedIssuesSection`, `trpc.jira.linkedIssues` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `jira-issue-sync.ts` | `jira-status-mapping.ts` | `lookupJiraTransitionId` | WIRED | Imported and called in `transitionJiraIssue` |
| `jira-webhook-handler.ts` | `jira-status-mapping.ts` | `lookupWorkflowStatus` | WIRED | Imported and called in `processJiraWebhook` |
| `jira.ts` (router) | `jira-issue-sync.ts` | `createJiraIssue`, `detectScopeExpansionNeeded` | WIRED | Static imports; used in query and mutation procedures |
| `jira.ts` (router) | `jira-status-mapping.ts` | `saveStatusMapping`, `getStatusMapping` | WIRED | Static imports; used in respective procedures |
| `_process/route.ts` | `jira-webhook-handler.ts` | `processJiraWebhook` | WIRED | Dynamic import inside `if (provider === "jira")` block |
| `workflow.ts` | `jira-issue-sync.ts` | `transitionJiraIssue` | WIRED | Dynamic import in `completeTask` and `skipTask` fire-and-forget blocks |
| `jira-status-mapping-dialog.tsx` | `trpc.jira.saveStatusMapping` | tRPC mutation | WIRED | `mutationOptions()` called; `listProjects` and `listProjectStatuses` loaded |
| `integrations-tab.tsx` | `jira-provider-section.tsx` | JSX rendering | WIRED | Imported line 15; rendered line 227 |
| `workflows-tab.tsx` | `jira-activity-summary.tsx` | JSX rendering | WIRED | Imported and rendered with `contractorId` prop |
| `workflow-side-panel.tsx` | `jira-issue-chip.tsx` | JSX rendering in LinkedIssuesSection | WIRED | Imported and rendered inside `LinkedIssuesSection` |
| `task-card.tsx` | `jira-task-config.tsx` | JSX rendering (gated on task.id) | WIRED | Imported line 43; rendered lines 488-490 with `taskTemplateId={task.id}` |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| JIRA-01 | 00, 01, 02, 03 | Admin can connect Jira Cloud workspace via OAuth 2.0 | VERIFIED | JiraAdapter OAuth 2.0 3LO with all four required scopes; JiraProviderSection with scope expansion detection |
| JIRA-02 | 00, 01, 02, 03, 04, 05 | Workflow steps can auto-create Jira issues with configurable project/type mapping | VERIFIED | Backend fully implemented; `JiraTaskConfig` now mounted in task-card.tsx — blocker from initial verification is closed |
| JIRA-03 | 00, 01, 02, 03 | Jira issue status changes auto-update linked workflow tasks (configurable mapping) | VERIFIED | Full bidirectional sync: `transitionJiraIssue` (outbound) + `processJiraWebhook` with loop prevention (inbound); `JiraStatusMappingDialog` for configuration |
| JIRA-04 | 00, 02, 04 | Linked Jira issues display on contractor and workflow views as clickable chips | VERIFIED | `JiraIssueChip` in `workflows-tab.tsx` and `workflow-side-panel.tsx`; `JiraActivitySummary` on contractor Workflows tab |

---

## Anti-Patterns Found

None. The "your-site" warning from the initial verification is resolved. No new anti-patterns detected in modified files.

---

## Human Verification Required

### 1. OAuth Connect Flow

**Test:** Navigate to Settings > Integrations > Jira. Click "Connect". Complete Atlassian OAuth authorization.
**Expected:** Returns to app with CONNECTED status; ProviderConnectionCard shows connected state; "Configure Status Mapping" button becomes visible with no scope expansion warning.
**Why human:** OAuth redirect flow requires a live Atlassian account.

### 2. Status Mapping Dialog — Live Jira Data

**Test:** With Jira connected, click "Configure Status Mapping". Select a project from the dropdown. Inspect the Jira Transition column dropdowns.
**Expected:** Project dropdown lists real Jira projects; selecting a project populates transition options from `listProjectStatuses`; saving calls `saveStatusMapping` and triggers `registerJiraWebhooks`.
**Why human:** Requires live Jira instance with real projects.

### 3. Outbound Sync — Task Completion Triggers Jira Transition

**Test:** With a task template configured for Jira (project + issue type saved, status mapping saved), complete a workflow task run that has a linked Jira issue.
**Expected:** Jira issue transitions to mapped status within seconds. IntegrationSyncLog shows `direction=OUTBOUND, syncType=issue-transition, status=SUCCESS`.
**Why human:** Requires live Jira, mapped task template, and a linked issue.

### 4. Inbound Sync — Jira Status Change Updates Workflow Task

**Test:** Manually change a Jira issue status that has a reverse mapping configured. Wait for webhook delivery.
**Expected:** Linked WorkflowTaskRun updates to the mapped status. IntegrationSyncLog shows `direction=INBOUND, syncType=issue-status-change`. Completing the task in the app immediately after does NOT cause a bounce (loop prevention).
**Why human:** Requires live Jira webhook; loop prevention timing requires real event ordering.

### 5. Scope Expansion Detection — Phase 18 Connection

**Test:** With a Phase 18 Jira connection (credential scope `"read:jira-work offline_access"` only), view integration settings.
**Expected:** AlertTriangle re-auth banner is visible. "Configure Status Mapping" button is hidden. After re-authenticating with all scopes, banner disappears and button appears.
**Why human:** Requires a database record with the Phase 18 scope string.

### 6. JiraTaskConfig Render Gate

**Test:** Open the workflow template builder. Add a new task (not yet saved). Expand the task card. Confirm no Jira section appears. Save the template. Reopen the task card. Confirm the Jira integration section appears with its switch and "Configure Jira" button.
**Expected:** New unsaved tasks show no Jira section (`task.id` is undefined). Saved tasks show the JiraTaskConfig section.
**Why human:** The `task?.id` guard is correct in code but whether the template builder surfaces a persisted `task.id` coherently (before vs. after a save round-trip) requires UI interaction to confirm.

---

_Verified: 2026-03-29T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
