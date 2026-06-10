---
title: RBAC permissions
type: pattern
tags: [rbac, permissions, auth]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/middleware/rbac.ts
  - packages/api/src/routers/core/auth-permissions.ts
  - packages/api/src/routers/workflow/workflow-roles.ts
updated: 2026-06-09
---

# RBAC permissions

## Purpose

Staff UI gating and API enforcement via permission strings on `tenantProcedure` + client introspection.

## Entry points

| Piece | Path |
|-------|------|
| requirePermission | `packages/api/src/middleware/rbac.ts` |
| Current user permissions | `authPermissions` router |
| Workflow role templates | `workflowRoles` router |
| Client hook | `apps/web-vite/src/hooks/use-permissions.ts` |

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
