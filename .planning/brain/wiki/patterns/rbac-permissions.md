---
title: RBAC permissions
type: pattern
tags: [rbac, permissions, auth]
source_commit: 105a8ccf64b34c611493215eb3519e8922343839
verify_with:
  - packages/api/src/middleware/rbac.ts
  - packages/api/src/routers/core/auth-permissions.ts
  - packages/api/src/routers/workflow/workflow-roles.ts
  - packages/auth/src/permissions.ts
  - packages/auth/src/roles.ts
  - packages/api/src/routers/core/personnel-file/section-access.ts
updated: 2026-07-01
---

# RBAC permissions

## Purpose

Staff UI gating and API enforcement via permission strings on `tenantProcedure` + client introspection.

## Entry points

| Piece | Path |
|-------|------|
| requirePermission | `packages/api/src/middleware/rbac.ts` |
| Resource-action statement | `packages/auth/src/permissions.ts` (`accessControlStatement`) |
| Role grants | `packages/auth/src/roles.ts` (`roles`, `RoleName`) |
| Current user permissions | `authPermissions` router |
| Workflow role templates | `workflowRoles` router |
| Client hook | `apps/web-vite/src/hooks/use-permissions.ts` |

## Resources and roles

`accessControlStatement` maps each resource to its action set; `roles` selects a
subset per role. There are 14 platform roles: the 10 core roles
(`owner`, `admin`, `finance_admin`, `ops_manager`, `team_manager`,
`legal_compliance_viewer`, `it_admin`, `external_accountant`, `readonly`,
`platform_operator`) plus 4 worker-model HR roles
(`hr_admin`, `hr_manager`, `payroll_officer`, `leave_approver`).

The `employee` resource (`create`, `read`, `update`, `delete`, `approve_leave`)
is the per-type RBAC surface for the worker-model employee abstraction, kept
separate from `contractor` so HR-only fields are gated independently. The HR
roles grant only `employee` (plus a narrow `contractor:read` where they need
shared worker context) and never any contractor mutation — an HR role cannot
create, update, delete, or bulk-mutate contractors. `owner` is sourced from a
duplicated `allPermissions` const that intentionally does not carry `employee`,
so `owner` does not hold the HR-only resource.

> `owner`'s grants live in a hand-maintained `allPermissions` duplicate; a new
> resource added to `accessControlStatement` is NOT auto-granted to `owner`.

`packages/auth/src/__tests__/role-permission-matrix.test.ts` freezes the exact
grant for every role; `roles.test.ts` proves the existing role set is unchanged
and that the HR roles respect the contractor-mutation fence.

### Per-section personnel-file grain (resource-per-section)

The personnel file ([[domains/personnel-file]]) introduces a **finer grain than
resource-level**: four resources `employeeFileA`, `employeeFileB`, `employeeFileC`,
`employeeFileD` (each `[read, write]`) on `accessControlStatement` — one per akta
section. This is resource-per-section, **not** an attribute layer, so it drops into the
existing `Permission` / `Resource` / `requirePermission` / `permissionToScopes` flow for
free (they all derive from the statement). The section→role matrix on the 4 HR roles:
`hr_admin` A/B/C/D r+w; `hr_manager` A/B/D r+w + C read-only; `payroll_officer` C
read-only; `leave_approver` A read-only — so a payroll role reaches section C (pay)
without section B (discipline). The `employeeFileA..D` resources are deliberately kept
**out of the owner `allPermissions` duplicate** (BFLA fence — owner holds no section),
mirroring the `employee` carve-out. The personnel-file router enforces this at the
permission layer via `hasSectionPermission(ctx, section)` (`routers/core/personnel-file/
section-access.ts`) — the lock is decided **before** any document query, and a locked
section returns its retention posture with **no document payload or count** (never
fetch-all-then-filter).

## Flow

Server: `tenantProcedure` → `requirePermission('domain:action')` → handler.

Client: container checks `usePermissions()` → variant or `<Navigate to="/forbidden" />`.

## Related

- [[trpc-procedure-stack]]
- [[domains/workflows-and-roles]]
- [[web-vite-data-layer]]

## Verify live

```bash
semble search "requirePermission"
semble search "authPermissions"
```

## Agent mistakes

- UI-only permission checks without server `requirePermission`
- Hardcoding role names instead of permission strings
