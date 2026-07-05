---
title: Workflows and roles
type: domain
tags: [workflows, kt-roles, calendar]
source_commit: d839f52eb98d86236bd6d0018bdff84de49427b8
verify_with:
  - packages/api/src/routers/workflow/
  - packages/api/src/routers/workflow/workflow-roles.ts
  - packages/api/src/services/jira-webhook-handler.ts
  - packages/api/src/services/linear-webhook-handler.ts
updated: 2026-06-18
---

# Workflows and roles

## Purpose

Workflow template CRUD, run lifecycle, task actions, KT role templates for auto-selection, calendar deadline sync, Jira/Linear task linking.

## Entry points

| Piece | Path |
|-------|------|
| Workflow router | `packages/api/src/routers/workflow/workflow.ts` |
| Roles | `workflowRoles` router |
| Calendar router | `packages/api/src/routers/core/calendar.ts` |
| Calendar sync | `packages/api/src/services/calendar-deadline-sync.ts` |
| UI | `apps/web-vite/src/components/workflows/`, `workflow/` |

## Related

- [[approvals-engine]]
- [[integrations/jira]]
- [[integrations/linear]]
- [[patterns/rbac-permissions]]

## Verify live

```bash
semble search "workflowRouter"
semble search "workflowRoles"
```

## Agent mistakes

- `startRun` TASK_ASSIGNED notifications are enqueued through the outbox INSIDE the run-create tx (`enqueueNotificationOutboxEvent`, dedupKey `task-assigned:<taskRunId>`) — exactly-once. Don't reintroduce a post-commit `dispatch().catch()` loop. See [[notifications-and-reminders]]
- Hardcoding approver users instead of role templates
- Jira/Linear task linking is **bidirectional**: outbound pushes issue + status, and inbound webhooks write back to `WorkflowTaskRun` (`jira-webhook-handler.ts`, `linear-webhook-handler.ts` — `workflowTaskRun.update` with loop-suppress + dedup). Notion is read-only (search/picker), **not** bi-di — do not pitch or assume Notion status sync.
- A completing OFFBOARDING run does **not** trigger deprovisioning — the access-revoke task is a marker only. See [[idp-deprovisioning]].
