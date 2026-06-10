---
title: Workflows and roles
type: domain
tags: [workflows, kt-roles, calendar]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/workflow/
  - packages/api/src/routers/workflow/workflow-roles.ts
updated: 2026-06-09
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

- Hardcoding approver users instead of role templates
