---
title: Workflows and roles
type: domain
tags: [workflows, kt-roles, calendar]
source_commit: e0d533fa5
verify_with:
  - packages/api/src/routers/workflow/
  - packages/api/src/routers/workflow/workflow-roles.ts
  - packages/api/src/routers/workflow/workflow-execution-tasks.ts
  - packages/api/src/services/jira-webhook-handler.ts
  - packages/api/src/services/linear-webhook-handler.ts
  - packages/auth/src/config.ts
  - packages/api/src/services/post-org-create-hook.ts
  - packages/offboarding-templates/src/upsert-on-boot.ts
  - packages/api/scripts/backfill-workflow-role-templates.ts
updated: 2026-07-10
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
| KT seed-template hook | `packages/auth/src/config.ts` (`seedOrganizationDefaults`) |
| Seed upsert | `packages/offboarding-templates/src/upsert-on-boot.ts` (`upsertSeedTemplates`) |
| Backfill entry | `packages/api/src/services/post-org-create-hook.ts` (`runPostOrganizationCreateHooks`) |
| Backfill script | `packages/api/scripts/backfill-workflow-role-templates.ts` |
| UI template builder | `apps/web-vite/src/components/workflows/template-builder/` — task types include `IP_VERIFICATION` and `CONTRACT_HEALTH_CHECK`; selecting template type `OFFBOARDING` auto-injects a default IP verification task when missing |

## KT role-template seeding

Every organization gets the 4 offboarding KT `WorkflowRoleTemplate` rows (+ their `WorkflowRoleTaskTemplate` children, from `OFFBOARDING_TEMPLATE_SEEDS`) so `selectForContractor` can resolve a real role instead of the degraded NULL-`workflowRoleId` fallback.

- **New orgs:** the Better Auth organization plugin's `afterCreateOrganization` hook (`packages/auth/src/config.ts`) calls `seedOrganizationDefaults(org.id)` → `upsertSeedTemplates`. It is **non-fatal** (Better Auth does not roll the org back on an `afterCreate` throw — a failed seed is logged, org still created) and **idempotent** (upserts keyed on `@@unique([organizationId, role])` / `@@unique([workflowRoleTemplateId, sortOrder])`). Uses the un-scoped base `prisma` (the `@contractor-ops/db` barrel is not tenant-wrapped) so the cross-org bootstrap write for the just-created org is not rejected by the tenant-frame guard.
- **Existing orgs:** one-shot idempotent backfill — `runPostOrganizationCreateHooks` for every org via `packages/api/scripts/backfill-workflow-role-templates.ts`. Run once per regional DB URL:
  `DATABASE_URL=$DATABASE_URL_EU tsx packages/api/scripts/backfill-workflow-role-templates.ts` (`--dry-run` to enumerate without writing).
- **Dev orgs** are additionally seeded inline by `seed-dev.ts` (`seedWorkflowTemplates`, `displayNameEn/Pl/De` columns); the hook/upsert path writes the `displayNameI18nKey` columns.

## Invariants

- Starting a run enqueues each active assignee's `TASK_ASSIGNED` notification into the transactional outbox **inside** the run-creation tx (`enqueueNotificationDispatch({ tx })`, dedupKey `TASK_ASSIGNED:${taskRunId}`) — delivered exactly-once by the drain, not post-commit fire-and-forget. `reassignTask` wraps assignee update + outbox enqueue + **`workflow.task.reassigned` audit** in one `$transaction` and asserts the parent run is `IN_PROGRESS`. See [[patterns/transactional-outbox]].
- `workflowRoles.list` and `selectForContractor` require `workflow:read` (parity with other workflow reads).
- `forceCompleteRunWithPendingCredentials` requires `workflow:override_blocking_task` (not plain `execute`).
- `WorkflowRoleTemplate` seeds are the source of truth for role auto-selection; a missing seed silently degrades a contractor to the NULL-`workflowRoleId` fallback. The seed hook fires at org creation (auth config), **not** from any tRPC router.

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
- Jira/Linear task linking is **bidirectional**: outbound pushes issue + status, and inbound webhooks write back to `WorkflowTaskRun` (`jira-webhook-handler.ts`, `linear-webhook-handler.ts` — load task, `validateTransition`, patch status + `completedAt` on DONE, unblock dependents; loop-suppress + dedup). Notion is read-only (search/picker), **not** bi-di — do not pitch or assume Notion status sync.
- `forceCompleteRunWithPendingCredentials` blocks when **any** open non-terminal task remains (not only `ACCESS_REVOKE`); IP verification override is still enforced separately before that check. Permission: **`workflow:override_blocking_task`**.
- A completing OFFBOARDING run does **not** trigger deprovisioning — the access-revoke task is a marker only. See [[idp-deprovisioning]].
- The KT `WorkflowRoleTemplate` seeds are materialised by the auth `afterCreateOrganization` hook, **not** by any workflow router or app boot. If an org shows the NULL-role fallback, run the backfill script (above) rather than hand-inserting rows.
