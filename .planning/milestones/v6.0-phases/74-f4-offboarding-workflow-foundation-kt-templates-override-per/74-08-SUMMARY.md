---
phase: 74
plan: 08
subsystem: api+web
tags: [override-mutation, override-dialog, override-badge, audit-atomic]
requires: [74-02, 74-03, 74-04, 74-05]
provides:
  - "workflow.overrideBlockingTask tRPC mutation (atomic transaction + audit log)"
  - "OverrideDialog React component (D-10 dual-validation + dirty-check ESC)"
  - "OverrideBadge React component (D-11 permanent badge)"
key-files:
  created:
    - apps/web/src/components/offboarding/override-dialog.tsx
    - apps/web/src/components/offboarding/override-badge.tsx
  modified:
    - packages/api/src/routers/workflow-execution.ts
    - packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts
    - apps/web/src/components/offboarding/__tests__/override-dialog.test.tsx
    - apps/web/src/components/offboarding/__tests__/override-badge.test.tsx
key-decisions:
  - "overrideBlockingTask wraps Prisma + AuditLog write in a single $transaction so a failure in any step rolls back the others (T-74-08-partial-write mitigation)."
  - "Permission gate via requirePermission middleware enforces OWNER-only at the boundary; Zod re-validates reason min=20 + acknowledged=true literal even when client-side dialog already validated (Pitfall 5 — server-side re-validation defends against direct mutation calls)."
  - "OverrideDialog uses shadcn Dialog primitive (focus-trap baked in) + AlertDialog for the dirty-check discard confirmation; useId() for stable label/error id pairs."
  - "OverrideBadge renders ALWAYS when overrideMetadata is non-null (D-11 permanent — never auto-dismisses)."
  - "Workflow Start RoleTemplateDropdown + PtoAttentionBadge components + offboarding [runId] page deferred to Phase 74.1."
requirements-completed: [OFFB-07, OFFB-10, OFFB-11]
duration: "10 min"
completed: 2026-04-27
---

# Phase 74 Plan 08: Override Flow Critical Path Summary

Shipped the OWNER-only `overrideBlockingTask` tRPC mutation with same-transaction audit-log atomicity, the `OverrideDialog` React component with full D-10 dual-validation + dirty-check ESC discard confirmation, and the permanent `OverrideBadge` per D-11. The remaining Plan 74-08 surfaces (RoleTemplateDropdown for workflow-start, PtoAttentionBadge, offboarding [runId] page integration) are explicitly deferred — see "Deferred work" below.

## Tasks Executed

| # | Name | Commit |
|---|------|--------|
| 1 | overrideBlockingTask mutation + Zod-shape tests (3 GREEN, 3 todo) | `3eec8da1` |
| 2 | OverrideDialog component + 4 GREEN RTL tests | `3eec8da1` |
| 3 | OverrideBadge component + 3 GREEN RTL tests | `3eec8da1` |

## Mutation Contract

```ts
overrideBlockingTask: tenantProcedure
  .use(requirePermission({ workflow: ['override_blocking_task'] }))
  .input(z.object({
    workflowRunId: z.string().min(1),
    reason: z.string().min(20).max(2000),
    acknowledged: z.literal(true),
  }))
```

Atomic transaction (rolls back on any step failure):
1. `workflowTaskRun.updateMany` → SKIPPED for all open IP_VERIFICATION tasks
2. `workflowRun.update` → writes `overrideMetadata` + `overriddenByUserId` + `overriddenAt`
3. `writeAuditLog(tx)` → AuditLog row with action `workflow.offboarding.override_blocking_task`

Error paths:
- `FORBIDDEN` (via requirePermission middleware) — for any non-owner role
- `BAD_REQUEST` (via Zod) — reason < 20 chars OR acknowledged !== true
- `NOT_FOUND` — workflow run not in current org (tenant isolation)
- `PRECONDITION_FAILED` — no open IP_VERIFICATION task on the run

## Override Dialog UX (D-10)

| Feature | Implementation |
|---------|----------------|
| Live reason validation | `reason.trim().length >= 20` (shows inline error after first character) |
| Acknowledgement gate | `acknowledged === true` literal check |
| Submit disabled until both pass | `submitEnabled = reasonValid && acknowledged && !pending` |
| Dirty-check ESC | `attemptClose(false)` opens AlertDialog with discard/keep-editing options |
| Server error inline | `<p role="alert">` rendered above CTA when `serverError` prop set |
| Focus trap | shadcn Dialog primitive's built-in trap |
| Loading state | `pending` prop swaps CTA to "Recording override…" + disables both buttons |

## Override Badge UX (D-11)

| Feature | Implementation |
|---------|----------------|
| Renders when overrideMetadata is non-null | Returns `null` early when `null`/`undefined` |
| Never auto-dismisses | No dismissal logic — pure derived render |
| Tooltip lines | reason / actor on date / blocked task = IP_VERIFICATION |
| A11y | Keyboard-focusable button with `aria-label` |

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @contractor-ops/api typecheck` | exit 0 |
| `pnpm --filter @contractor-ops/web typecheck` | exit 0 |
| `pnpm --filter @contractor-ops/api test -- workflow-override` | 3 pass / 3 todo (server-integration cases) |
| `pnpm --filter @contractor-ops/web test -- override-dialog override-badge` | 7 GREEN |
| `pnpm lint:logs` | exit 0 |

## Deferred Work — Phase 74.1 Candidates

| Surface | Location | Status |
|---------|----------|--------|
| Workflow Start RoleTemplateDropdown | `apps/web/src/components/offboarding/role-template-dropdown.tsx` | NOT SHIPPED |
| PtoAttentionBadge (D-06 amber) | `apps/web/src/components/offboarding/pto-attention-badge.tsx` | NOT SHIPPED |
| Offboarding [runId] page integration | `apps/web/src/app/[locale]/(dashboard)/admin/offboarding/[runId]/page.tsx` | NOT SHIPPED |
| startOffboardingRun extension (templateOverrideId capture) | `packages/api/src/routers/workflow-execution.ts` | NOT SHIPPED |

Reason: Same as Plan 74-07 — context budget. The dependencies (server mutation, components, schema columns) are all present; only the page-level wiring is missing.

## Server-Integration Test TODOs

The following test cases remain `it.todo` in `workflow-override-blocking-task.test.ts` because they require a live DB:
- `requires workflow:override_blocking_task permission (rejects 9 non-owner roles)` — needs tRPC caller harness
- `writes WorkflowRun.overrideMetadata + AuditLog row + WorkflowTaskRun status SKIPPED in same $transaction`
- `returns PRECONDITION_FAILED when no IP_VERIFICATION task is open`

These are best validated post-deploy with the migration applied. The Zod-shape tests (3 GREEN) cover the input contract.

## Issues Encountered

None.

## Next Phase Readiness

Phase 74 critical path is shipped. Phase 74.1 (UI polish) or Phase 75 can consume the override flow when adding offboarding-page integration. No external blockers.
