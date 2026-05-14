---
phase: db-review
reviewed: 2026-05-12T14:30:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/db/package.json
  - packages/db/prisma.config.ts
  - packages/db/src/index.ts
  - packages/db/src/client.ts
  - packages/db/src/region.ts
  - packages/db/src/replica.ts
  - packages/db/src/rls.ts
  - packages/db/src/tenant.ts
  - packages/db/src/raw.ts
  - packages/db/src/soft-delete.ts
  - packages/db/src/scope-capabilities-schema.ts
  - packages/db/src/types/scope-capabilities.ts
  - packages/db/scripts/migrate-all-regions.ts
  - packages/db/scripts/check-generated-drift.ts
  - packages/db/prisma/schema/migrations/20260512000000_baseline/migration.sql
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# packages/db: Code Review Report

**Reviewed:** 2026-05-12T14:30:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The packages/db directory was reviewed after the migration squash (17 migrations into a single baseline) and the switch from `db push` to `prisma migrate`. The codebase is generally well-structured with thoughtful defensive patterns (circuit breaker on replicas, RLS session injection, PII query redaction). However, there are three critical issues: soft-delete bypasses on `findUnique`/`findUniqueOrThrow`, missing RLS policies on tenant-scoped tables added in later migrations, and a contradiction between the tenant.ts globalModels list and the RLS policies for `PortalSession`. There are also warnings around the migration script using `npx` instead of a pinned binary, and missing `IF NOT EXISTS` guards in the baseline migration.

## Critical Issues

### CR-01: Soft-delete extension does not wrap `findUnique` or `findUniqueOrThrow`

**File:** `packages/db/src/soft-delete.ts:53-146`
**Issue:** The `withSoftDelete` extension hooks `findMany`, `findFirst`, `findFirstOrThrow`, `count`, `update`, `updateMany`, and `upsert` -- but omits `findUnique` and `findUniqueOrThrow`. Any code calling `prisma.contractor.findUnique({ where: { id } })` (or `invoice`, `contract`, `document`, `organization`) will return soft-deleted records as if they were active. This is a data integrity bug: deleted entities silently reappear in detail views, relation lookups, and any code that resolves by primary key. Given that `findUnique` is the most common pattern for loading a single record by ID, this affects a large surface area.

**Fix:** Add `findUnique` and `findUniqueOrThrow` hooks identical to the existing `findFirst` hook:
```typescript
async findUnique({ model, args, query }: ModelQueryHookParams) {
  if (!softDeleteModels.has(model)) {
    return await query(args);
  }
  return await query(injectDeletedAtNull(args));
},

async findUniqueOrThrow({ model, args, query }: ModelQueryHookParams) {
  if (!softDeleteModels.has(model)) {
    return await query(args);
  }
  return await query(injectDeletedAtNull(args));
},
```

### CR-02: Missing RLS policies on tenant-scoped tables (InvoiceIntakeRequest, WorkflowRoleTemplate, WorkflowRoleTaskTemplate)

**File:** `packages/db/prisma/schema/migrations/20260512000000_baseline/migration.sql`
**Issue:** Three tables with `organizationId NOT NULL` columns have no RLS policies defined in the baseline migration:
- `InvoiceIntakeRequest` (line ~1548, from squashed migration 20260414120000)
- `WorkflowRoleTemplate` (line ~2298, from squashed migration 20260427105536)
- `WorkflowRoleTaskTemplate` (line ~2320, from squashed migration 20260427105536)

These tables are not in tenant.ts `globalModels` so they ARE tenant-scoped at the application layer, but they lack the database-level RLS defense-in-depth that every other tenant-scoped table has. When RLS enforcement activates (`RLS_POLICIES_ENFORCED=true`), these tables will be unprotected at the Postgres level. `InvoiceIntakeRequest` is particularly sensitive as it contains uploaded invoice data.

**Fix:** Add RLS policies for all three tables following the existing pattern:
```sql
alter table "InvoiceIntakeRequest" enable row level security;
alter table "InvoiceIntakeRequest" force row level security;
drop policy if exists invoiceintakerequest_select on "InvoiceIntakeRequest";
create policy invoiceintakerequest_select on "InvoiceIntakeRequest"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoiceintakerequest_write on "InvoiceIntakeRequest";
create policy invoiceintakerequest_write on "InvoiceIntakeRequest"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- Repeat for WorkflowRoleTemplate and WorkflowRoleTaskTemplate (ops write domain)
```
This should be a new migration (not editing the baseline), since the baseline is already applied.

### CR-03: PortalSession in globalModels bypasses tenant scoping but has RLS policies requiring org context

**File:** `packages/db/src/tenant.ts:46` and `migration.sql:5044-5054`
**Issue:** `PortalSession` is listed in `globalModels` (line 46 of tenant.ts), which means the `withTenantScope` extension skips it entirely -- no `organizationId` is injected into queries. However, the baseline migration (lines 5044-5054) enables RLS on `PortalSession` with policies that check `app.org_match("organizationId") and app.is_org_member()`. When RLS activates, any query to `PortalSession` without `SET LOCAL app.org_id` will be denied because `current_setting('app.org_id', true)` returns NULL, and `NULL = organizationId` is falsy. This will break portal authentication flows that need to look up sessions across orgs or without a tenant context (exactly the reason it was put in globalModels).

**Fix:** Either:
1. Remove `PortalSession` from `globalModels` and add tenant scoping (if it should always be org-scoped), OR
2. Remove the RLS policies from `PortalSession` in the migration (if it legitimately needs cross-org access for auth flows), OR
3. Add a `PortalSession`-specific RLS policy that allows access without `app.org_id` for the portal auth role.

The current state is contradictory and will cause hard failures when RLS is enforced.

## Warnings

### WR-01: migrate-all-regions.ts uses `npx prisma` instead of workspace-pinned binary

**File:** `packages/db/scripts/migrate-all-regions.ts:52`
**Issue:** The script uses `npx prisma migrate deploy --schema=...` which can resolve to a globally cached or newer version of Prisma. The drift check script (`check-generated-drift.ts:115`) explicitly avoids this by resolving the local `node_modules/.bin/prisma` binary. Using an inconsistent Prisma version between regions or between migration and generation could produce schema drift.

**Fix:**
```typescript
const prismaBin = resolve(__dirname, '..', 'node_modules', '.bin', 'prisma');
execSync(`${prismaBin} migrate deploy --schema=${SCHEMA_PATH}`, {
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'inherit',
  cwd: resolve(__dirname, '..'),
});
```

### WR-02: Baseline migration lacks IF NOT EXISTS guards on CREATE TABLE and CREATE TYPE statements

**File:** `packages/db/prisma/schema/migrations/20260512000000_baseline/migration.sql`
**Issue:** 115 `CREATE TABLE` statements and 102 `CREATE TYPE` statements use bare `CREATE TABLE` / `CREATE TYPE` without `IF NOT EXISTS`. The custom SQL section (tsvector columns, indexes, unique constraints from line 5080 onward) correctly uses `IF NOT EXISTS` / `CREATE OR REPLACE`, but the Prisma-generated section does not. If this baseline is ever applied to a database that already has some of these objects (e.g., a partially migrated database, or using `prisma migrate resolve` to mark it as applied on an existing DB), it will fail. Since this is a squashed baseline intended to replace `db push`, the `resolve --applied` workflow is the likely path for existing databases, so this is somewhat mitigated. But new environments will succeed, and existing ones need the `resolve` workaround.

**Fix:** This is a known Prisma limitation (generated SQL doesn't use IF NOT EXISTS). Document the `prisma migrate resolve --applied 20260512000000_baseline` step in the migration README for existing environments. No code change needed if the resolve workflow is standard.

### WR-03: migrate-all-regions.ts has dead code after process.exit(1)

**File:** `packages/db/scripts/migrate-all-regions.ts:73-83`
**Issue:** On line 73-75, when a region fails, the script calls `process.exit(1)`. Lines 78-83 check `hasFailed` but this code is unreachable when a failure occurs because the exit already happened inside the loop. The `hasFailed` check on line 80 is dead code. The `!hasMigrated` check on line 80 correctly handles the case where all regions are skipped (no env vars set), but this logic is partially dead and misleading.

**Fix:** Remove the `hasFailed` check since it's unreachable:
```typescript
const hasMigrated = results.some(r => r.status === 'ok');
if (!hasMigrated) {
  log.error({}, 'no regions were migrated — check DATABASE_URL_* env vars');
  process.exit(1);
}
```

### WR-04: soft-delete `delete` hook uses the unwrapped prisma client for the update call

**File:** `packages/db/src/soft-delete.ts:63-70`
**Issue:** When a `delete` is converted to a soft-delete, the hook accesses the model delegate via `(prisma as unknown as Record<string, unknown>)[lowerFirst(model)]` -- using the `prisma` parameter from the `withSoftDelete` closure, NOT the `query` function from the hook. This means the update call bypasses any extensions stacked AFTER `withSoftDelete` (e.g., if `withTenantScope` is applied after `withSoftDelete`). In `index.ts:61`, `createTenantClient()` calls `withSoftDelete(withTenantScope(basePrisma))` -- tenant scope is applied first (inner), then soft-delete wraps it. The soft-delete `delete` hook's `delegate.update()` call goes to the base `prisma` (pre-extension), bypassing tenant scoping on the replacement update. This means a soft-delete could theoretically update a record in another tenant if the `where` clause only uses `id`.

**Fix:** The delete-to-update conversion should route through the extended client or at minimum through the `query` function. Consider restructuring to use the model delegate from `this` (the extended client) rather than from the base `prisma` argument.

### WR-05: Contract search vector in migration uses "description" but the squash header says "description B"

**File:** `packages/db/prisma/schema/migrations/20260512000000_baseline/migration.sql:5096-5101`
**Issue:** The squash comment header (line 35-36) says the Contract search vector uses `title A, description B`. But the actual generated column (lines 5096-5101) uses `title A, contractNumber B, notes C`. There is no `description` field. The comment is misleading and could cause confusion during future maintenance. This is a documentation-code mismatch, not a runtime bug.

**Fix:** Update the header comment to match reality:
```sql
--   20260320140000_add_contract_search_vector
--     -> Generated tsvector column "searchVector" on Contract
--       (title A, contractNumber B, notes C) + GIN index
```

## Info

### IN-01: Duplicate unique index on PortalSession.token

**File:** `packages/db/prisma/schema/migrations/20260512000000_baseline/migration.sql:3258-3261`
**Issue:** Lines 3258-3261 create both a `UNIQUE INDEX "PortalSession_token_key"` and a regular `INDEX "PortalSession_token_idx"` on the same column (`token`). The unique index already provides the B-tree lookup capability, making the regular index redundant. It wastes storage and slows down writes.

**Fix:** Remove the redundant non-unique index. This should be done in a new migration:
```sql
DROP INDEX IF EXISTS "PortalSession_token_idx";
```

### IN-02: Package.json lists @types/cli-progress in devDependencies but cli-progress in dependencies is missing -- it is in devDependencies

**File:** `packages/db/package.json:59-60`
**Issue:** `@types/cli-progress` (line 56) and `cli-progress` (line 59) are both in `devDependencies`, which is correct for a script-only dependency. However, `@types/opossum` (line 57) is in `devDependencies` while `opossum` (line 48) is in `dependencies`. This is the correct pattern -- just noting that the types/runtime split is consistent.

No action needed -- this is informational only.

---

_Reviewed: 2026-05-12T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
