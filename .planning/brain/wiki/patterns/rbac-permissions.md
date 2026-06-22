---
title: RBAC permissions
type: pattern
tags: [rbac, permissions, auth]
source_commit: 633db8f2e1bd44099c309be2566f879c37125bcf
verify_with:
  - packages/api/src/middleware/rbac.ts
  - packages/api/src/routers/core/auth-permissions.ts
  - packages/api/src/routers/workflow/workflow-roles.ts
  - packages/auth/src/permissions.ts
  - packages/auth/src/roles.ts
updated: 2026-06-22
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
