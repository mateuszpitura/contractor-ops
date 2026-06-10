# RBAC Permission Add Checklist

Adding a permission touches Better Auth access control, role grants, API middleware, API-key scopes, and optionally web-vite UI gates. **No codegen today** — follow this list to avoid silent owner-role drift.

## 1. Declare resource + actions

**File:** `packages/auth/src/permissions.ts`

```typescript
export const accessControlStatement = {
  // ...
  myResource: ['read', 'update'],  // add here
} as const;
```

- Resource names are camelCase keys (`costCenter`, `contractorPii`, `admin:boe-rate`)
- Actions are verb strings consumed by Better Auth `hasPermission`

## 2. Sync owner `allPermissions` duplicate

**File:** `packages/auth/src/roles.ts`

The `owner` role uses a **duplicate** `allPermissions` const (Better Auth v1.5.5 bug workaround). **Must mirror** `permissions.ts` or owner silently loses the new permission.

```typescript
const allPermissions = {
  // ...
  myResource: ['read', 'update'],
} as const;
```

## 3. Grant to roles

**Same file:** `packages/auth/src/roles.ts`

Update each role in `export const roles = { admin, finance_admin, … }` with the minimal action subset. Deny-by-default for roles not listed.

| Role file section | Typical pattern |
|-------------------|-----------------|
| `owner` / `admin` | Full mutating set |
| `finance_admin` | Read + domain-specific writes |
| `external_accountant` | Read-only where applicable |
| `it_admin` | IdP / integration permissions |

**Verify:** `packages/auth/src/__tests__/` (permission matrix tests if present)

## 4. API-key scope bridge

**File:** `packages/api/src/lib/scope-utils.ts`

`permissionToScopes({ myResource: ['read'] })` → `['myResource:read']` automatically if resource exists in `accessControlStatement`.

**File:** `packages/validators/src/scope-capabilities.ts` (if public API exposes scope)

Add capability documentation for Enterprise API key UI.

## 5. Protect tRPC procedures

**Pattern:** `packages/api/src/middleware/rbac.ts`

```typescript
import { requirePermission } from '../../middleware/rbac';

someProcedure
  .use(requirePermission({ myResource: ['read'] }))
```

**Search for similar procedures:**

```bash
rg "requirePermission\\(\\{ <resource>" packages/api/src/routers/
```

Apply to every new or existing procedure touching the resource (~30 router files today).

**Portal / cron / public-api:** Same middleware; `apiKeyTenantProcedure` uses `ctx.apiKeyScopes` via `permissionToScopes`.

## 6. web-vite UI gates (optional)

| Layer | Action |
|-------|--------|
| Page | Permission check via session — thin composer only |
| Container | `authClient` / permissions hook — hide section or show read-only |
| Component | Props only — no permission logic |

Search: `apps/web-vite` for existing resource pattern (e.g. `contractorPii:read` in SSN reveal).

Staff permissions router: `packages/api/src/routers/core/auth-permissions.ts` (if exposing permission list to UI).

## 7. Audit sensitive mutations

If the new permission gates a **write** on sensitive data:

**File:** `packages/api/src/services/audit-writer.ts` via `writeAuditLog` in the mutating procedure.

## 8. Tests

| Target | Test |
|--------|------|
| Role matrix | Owner/admin has action; restricted role denied |
| Procedure | Integration test with `hasPermission` mock |
| API key | Scope `resource:action` grants access |

## 9. Verification commands

```bash
pnpm typecheck --filter=@contractor-ops/auth --filter=@contractor-ops/api
pnpm test --filter=@contractor-ops/auth
```

## Common mistakes

| Mistake | Symptom |
|---------|---------|
| Updated `permissions.ts` but not `roles.ts` `allPermissions` | Owner cannot perform action |
| UI shows button but API returns 403 | Container gate missing |
| API key works in tRPC but not public-api | Scope not granted on key record |
| New resource uses kebab-case | Breaks `permissionToScopes` convention |

## File touch estimate

~15–20 files for a typical new resource (down from 30+ with checklist discipline). No new auth framework planned — registry doc only (Wave G G1).
