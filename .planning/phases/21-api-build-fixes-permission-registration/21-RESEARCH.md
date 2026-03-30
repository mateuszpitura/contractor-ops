# Phase 21: API Build Fixes & Permission Registration - Research

**Researched:** 2026-03-30
**Domain:** TypeScript compilation, tRPC context types, Prisma transaction types, package.json exports
**Confidence:** HIGH

## Summary

Phase 21 is a targeted bug-fix phase that resolves TypeScript compilation failures preventing the `packages/api` package from building. The root causes are: (1) stale `packages/validators` dist missing `calendar.ts` and `docs.ts` modules, (2) missing subpath exports in `packages/integrations/package.json` for 4 adapters, (3) `time` resource not registered in the permission statement, (4) `ctx.userId` used instead of `ctx.user!.id` in the calendar router, (5) `contract.name` used instead of `contract.title`, (6) `CredentialBlob` cast without `as unknown` intermediate, (7) `$transaction` callback typed as `PrismaClient` instead of the Omit-based transaction client, and (8) `ctx.prisma` used in the docs router where it should use the top-level imported `prisma`.

Live compilation (`npx tsc --noEmit`) reveals 44+ TypeScript errors across `calendar.ts`, `docs.ts`, `time.ts`, `time-entry.ts`, `doc-link-service.ts`, `calendar-event-service.ts`, and `calendar-deadline-sync.ts`. All errors trace to 8 discrete root causes with known fixes following existing codebase patterns.

**Primary recommendation:** Fix all 8 root causes in dependency order -- validators build first, then integrations exports, then permissions, then individual file fixes. Verify with `npx tsc --noEmit` after each group.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIME-02 | Manager can review and approve/reject submitted time entries | `time` resource missing from `permissions.ts` statement -- all 11 admin time router procedures fail type-check. Fix: add `time: ["read", "approve"]` to statement and role assignments. |
| DOCS-01 | User can attach Notion or Confluence page links to workflow steps | Blocked by: (a) stale validators dist missing `attachDocInputSchema`/`docSearchInputSchema`, (b) missing notion-adapter/confluence-adapter subpath exports, (c) `ctx.prisma` bug in docs router, (d) `CredentialBlob` cast error in doc-link-service. |
| DOCS-02 | User can search and link Notion/Confluence pages from within Cmd+K | Same blockers as DOCS-01 -- docs router `search` procedure fails compilation. |
| CAL-01 | System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar | Blocked by: (a) stale validators dist missing `CalendarTaskConfig`/`CalendarEventMetadata`, (b) missing google-calendar-adapter/outlook-calendar-adapter subpath exports, (c) `ctx.userId` should be `ctx.user!.id` (5 occurrences), (d) `contract.name` should be `contract.title`, (e) `contractor` relation not reachable due to invalid `name` select field. |
| CAL-02 | Workflow steps can create calendar events | Same build blockers as CAL-01 for calendar router and calendar-event-service. |
</phase_requirements>

## Standard Stack

This phase modifies existing code only. No new libraries required.

### Core (Already in Project)
| Library | Version | Purpose | Relevant to Phase |
|---------|---------|---------|-------------------|
| TypeScript | ^5.7.0 | Type-checking | All fixes verified via `tsc --noEmit` |
| Prisma | workspace | DB client, transaction types | `$transaction` callback type fix |
| better-auth | workspace | Permission system via `createAccessControl` | `time` resource registration |
| tRPC | workspace | Router context types | `ctx.user!.id` pattern |
| Zod | ^3.23.0 | Validators package schemas | Stale dist rebuild |

## Architecture Patterns

### Pattern 1: Permission Registration
**What:** Add a resource to the access control statement in `permissions.ts`, then grant it to appropriate roles in `roles.ts`.
**Source:** `packages/auth/src/permissions.ts` lines 1-42, `packages/auth/src/roles.ts`

The `statement` object in `permissions.ts` defines all resource-action pairs. The `Permission` type is derived from it. Adding `time: ["read", "approve"]` to the statement makes `{ time: ["read"] }` and `{ time: ["approve"] }` valid in `requirePermission()`.

Roles that need `time` permissions:
- `owner` / `admin`: full access (`allPermissions` constant must also be updated)
- `ops_manager`: `time: ["read", "approve"]` (manages contractors)
- `team_manager`: `time: ["read", "approve"]` (reviews team time)
- `finance_admin`: `time: ["read"]` (views for reconciliation)

```typescript
// permissions.ts -- add to statement:
time: ["read", "approve"],

// roles.ts -- add to allPermissions AND individual roles:
time: ["read", "approve"],  // owner, admin, ops_manager, team_manager
time: ["read"],              // finance_admin
```

### Pattern 2: tRPC Context User Access
**What:** Access the authenticated user's ID from tRPC context.
**Source:** Every existing router in the codebase (e.g., `approval.ts`, `esign.ts`)

The correct pattern is `ctx.user!.id` (with non-null assertion). The `user` property is guaranteed non-null by `tenantProcedure` middleware chain (auth middleware throws UNAUTHORIZED if null), but TypeScript's type system doesn't narrow it automatically.

```typescript
// WRONG (calendar.ts current):
ctx.userId        // Property 'userId' does not exist

// CORRECT (codebase pattern):
ctx.user!.id      // Non-null assertion, safe after auth middleware
```

5 occurrences in `calendar.ts`: lines 51, 75, 120, 197, 243.

### Pattern 3: Prisma Transaction Client Type
**What:** Type the callback parameter for `prisma.$transaction()`.
**Source:** `packages/api/src/services/approval-engine.ts` line 9

Prisma's interactive transaction callback receives an `Omit<PrismaClient, "$connect" | "$disconnect" | ...>`, not a full `PrismaClient`. The codebase has an established pattern:

```typescript
// CORRECT pattern (approval-engine.ts):
type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Then use:
const result = await prisma.$transaction(async (tx: TxClient) => { ... });

// WRONG (time-entry.ts current):
const result = await prisma.$transaction(async (tx: PrismaClient) => { ... });
```

### Pattern 4: Package Subpath Exports
**What:** Expose adapter modules from `packages/integrations/package.json` so other packages can import them.
**Source:** Existing exports in `package.json` (e.g., `./adapters/clockify-adapter`, `./adapters/jira-adapter`)

```json
"./adapters/notion-adapter": {
  "types": "./dist/adapters/notion-adapter.d.ts",
  "import": "./dist/adapters/notion-adapter.js",
  "default": "./dist/adapters/notion-adapter.js"
}
```

4 missing exports: `notion-adapter`, `confluence-adapter`, `google-calendar-adapter`, `outlook-calendar-adapter`.

### Pattern 5: CredentialBlob Property Access
**What:** Access provider-specific `extra` field on decrypted credentials.
**Source:** `packages/integrations/src/types/credentials.ts`

`CredentialBlob` already has `extra?: Record<string, unknown>`. The code unnecessarily casts `credentials as Record<string, unknown>` to access `.extra`, but TypeScript rejects the cast because the types don't overlap. Fix: use `credentials.extra` directly.

```typescript
// WRONG (doc-link-service.ts current):
(credentials as Record<string, unknown>).extra

// CORRECT:
credentials.extra
  ? (credentials.extra as Record<string, string>).workspaceName ?? "Notion"
  : "Notion"
```

### Pattern 6: Docs Router -- Prisma Import vs Context
**What:** The docs router uses `ctx.prisma` which doesn't exist on the tRPC context.
**Source:** `packages/api/src/routers/docs.ts` lines 67, 86, 100, 121, 137

The file already imports `prisma` from `@contractor-ops/db` at line 2. The service functions accept a prisma client as parameter. The fix is to pass the top-level `prisma` import instead of `ctx.prisma`.

```typescript
// WRONG:
await attachDocLink(ctx.prisma, { ... });

// CORRECT:
await attachDocLink(prisma, { ... });
```

5 occurrences in `docs.ts`: lines 67, 86, 100, 121, 137.

### Pattern 7: Enum String Literal for Provider Filter
**What:** `docs.ts` line 53 passes a plain string `"NOTION"` to a Prisma `provider` filter that expects the `IntegrationProvider` enum type.
**Source:** `packages/api/src/routers/docs.ts` line 53

The `providerFromExternalType` function returns `string`, but Prisma's `where.provider` expects `IntegrationProvider`. Fix: change return type to match the enum, or cast.

```typescript
// WRONG:
function providerFromExternalType(...): string {

// CORRECT:
function providerFromExternalType(
  externalType: "NOTION_PAGE" | "CONFLUENCE_PAGE",
): "NOTION" | "CONFLUENCE" {
```

### Anti-Patterns to Avoid
- **Casting to `Record<string, unknown>` from a known interface:** Use the interface's own properties. If extra fields exist, add them to the interface definition.
- **Using `PrismaClient` as transaction callback type:** Always derive the transaction client type from Prisma's own generics.
- **Assuming `ctx` has arbitrary properties:** Only use properties defined by the middleware chain. Check tenant middleware and auth middleware for available fields.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction client type | Manual `Omit<PrismaClient, ...>` | `Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]` | Follows codebase pattern, stays in sync with Prisma version |
| Permission system | Manual role checks | `requirePermission()` middleware + `permissions.ts` statement | Already built, type-safe, declarative |

## Common Pitfalls

### Pitfall 1: Stale Validator Dist
**What goes wrong:** `packages/validators/dist/` is missing `calendar.js`, `calendar.d.ts`, `docs.js`, `docs.d.ts` because the package wasn't rebuilt after Phase 20 added these modules.
**Why it happens:** Turborepo may not rebuild dependencies when source files are added in parallel execution.
**How to avoid:** Run `turbo build --filter=@contractor-ops/validators` before touching API package, or `turbo build` for the full monorepo.
**Warning signs:** `Module '"@contractor-ops/validators"' has no exported member 'X'` errors for items that clearly exist in source.

### Pitfall 2: Forgetting allPermissions in roles.ts
**What goes wrong:** Adding `time` to `permissions.ts` statement but not to the `allPermissions` constant in `roles.ts` means owner/admin roles silently lack time permissions.
**Why it happens:** `allPermissions` is a hand-maintained copy of the statement, not derived from it.
**How to avoid:** Update both `statement` in `permissions.ts` AND `allPermissions` in `roles.ts` simultaneously. Add `time` to individual role objects as appropriate.
**Warning signs:** Admin users get 403 on time endpoints despite being admin.

### Pitfall 3: Contract Model Field Names
**What goes wrong:** `contract.name` doesn't exist -- the field is `contract.title` per the Prisma schema.
**Why it happens:** Convention inconsistency -- many models use `name`, but Contract uses `title`.
**How to avoid:** Always check the Prisma schema for exact field names. The Prisma select at line 171 also lists `name: true` which needs to become `title: true`.
**Warning signs:** TypeScript error `'name' does not exist in type 'ContractSelect'`.

### Pitfall 4: Select Must Include Relations
**What goes wrong:** `syncContractDeadline` selects `contractor: { select: { displayName } }` which is correct, but the `name` field error masks this.
**Why it happens:** When one field in a select is invalid, TypeScript errors cascade to other properties.
**How to avoid:** Fix all select fields first, then verify relation includes work.

### Pitfall 5: Nullable Contractor Relation
**What goes wrong:** `invoice.contractor` could be null (TypeScript error at calendar.ts line 241).
**Why it happens:** Invoice may not have a contractor relation depending on the select/schema.
**How to avoid:** Add null check or use non-null assertion if the business logic guarantees the relation exists.

## Code Examples

### Fix 1: Integrations package.json Subpath Exports

```json
"./adapters/notion-adapter": {
  "types": "./dist/adapters/notion-adapter.d.ts",
  "import": "./dist/adapters/notion-adapter.js",
  "default": "./dist/adapters/notion-adapter.js"
},
"./adapters/confluence-adapter": {
  "types": "./dist/adapters/confluence-adapter.d.ts",
  "import": "./dist/adapters/confluence-adapter.js",
  "default": "./dist/adapters/confluence-adapter.js"
},
"./adapters/google-calendar-adapter": {
  "types": "./dist/adapters/google-calendar-adapter.d.ts",
  "import": "./dist/adapters/google-calendar-adapter.js",
  "default": "./dist/adapters/google-calendar-adapter.js"
},
"./adapters/outlook-calendar-adapter": {
  "types": "./dist/adapters/outlook-calendar-adapter.d.ts",
  "import": "./dist/adapters/outlook-calendar-adapter.js",
  "default": "./dist/adapters/outlook-calendar-adapter.js"
}
```

### Fix 2: time-entry.ts Transaction Type

```typescript
// Add at top of file (after imports):
type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Change line 101:
const result = await prisma.$transaction(async (tx: TxClient) => {
```

### Fix 3: permissions.ts and roles.ts

```typescript
// permissions.ts -- add to statement object:
time: ["read", "approve"],

// roles.ts -- add to allPermissions:
time: ["read", "approve"],

// roles.ts -- add to individual roles:
// admin: time: ["read", "approve"]
// ops_manager: time: ["read", "approve"]
// team_manager: time: ["read", "approve"]
// finance_admin: time: ["read"]
```

### Fix 4: calendar.ts ctx.userId -> ctx.user!.id

5 replacements at lines 51, 75, 120, 197, 243:
```typescript
// Before:
ctx.userId
// After:
ctx.user!.id
```

### Fix 5: calendar.ts contract.name -> contract.title

Line 171 select and line 194 access:
```typescript
// Select (line 171):
title: true,   // was: name: true

// Access (line 194):
contractName: contract.title,  // was: contract.name
```

### Fix 6: doc-link-service.ts CredentialBlob

Lines 241-242:
```typescript
// Before:
subtitle: (credentials as Record<string, unknown>).extra
  ? ((credentials as Record<string, unknown>).extra as Record<string, string>).workspaceName ?? "Notion"
  : "Notion",

// After:
subtitle: credentials.extra
  ? (credentials.extra as Record<string, string>).workspaceName ?? "Notion"
  : "Notion",
```

### Fix 7: docs.ts ctx.prisma -> prisma

5 replacements at lines 67, 86, 100, 121, 137:
```typescript
// Before:
await attachDocLink(ctx.prisma, { ... });
// After:
await attachDocLink(prisma, { ... });
```

### Fix 8: docs.ts provider return type

```typescript
// Before:
function providerFromExternalType(
  externalType: "NOTION_PAGE" | "CONFLUENCE_PAGE",
): string {

// After:
function providerFromExternalType(
  externalType: "NOTION_PAGE" | "CONFLUENCE_PAGE",
): "NOTION" | "CONFLUENCE" {
```

## Complete Error Inventory (44+ errors from tsc --noEmit)

| File | Error Count | Root Cause(s) |
|------|-------------|---------------|
| `routers/calendar.ts` | 16 | `calendarTaskConfigSchema` not in dist (stale validators), `ctx.userId`, `contract.name`, `contractor` nullable, `input.config` unknown |
| `routers/docs.ts` | 8 | `attachDocInputSchema`/`docSearchInputSchema` not in dist, `ctx.prisma` not on context, provider string type |
| `routers/time.ts` | 11 | `time` not in permission statement |
| `services/time-entry.ts` | 1 | `$transaction` callback typed as `PrismaClient` |
| `services/calendar-event-service.ts` | 3 | Missing adapter subpath exports, `CalendarEventMetadata` not in dist |
| `services/calendar-deadline-sync.ts` | 1 | `CalendarTaskConfig` not in dist |
| `services/doc-link-service.ts` | 3 | Missing adapter subpath exports, `DocSearchResult` not in dist, `CredentialBlob` cast |

## Dependency Order for Fixes

```
1. Rebuild validators:  turbo build --filter=@contractor-ops/validators
   (Unblocks: calendarTaskConfigSchema, CalendarEventMetadata, CalendarTaskConfig,
    DocSearchResult, attachDocInputSchema, docSearchInputSchema imports)

2. Add 4 adapter subpath exports to integrations package.json
   + Rebuild integrations: turbo build --filter=@contractor-ops/integrations
   (Unblocks: notion-adapter, confluence-adapter, google-calendar-adapter,
    outlook-calendar-adapter imports)

3. Fix permissions.ts + roles.ts (time resource)
   + Rebuild auth: turbo build --filter=@contractor-ops/auth
   (Unblocks: all 11 time router procedures)

4. Fix calendar.ts (ctx.userId, contract.name/title, contractor select, nullable)
5. Fix docs.ts (ctx.prisma, provider return type)
6. Fix doc-link-service.ts (CredentialBlob cast)
7. Fix time-entry.ts ($transaction type)

8. Final verify: npx tsc --noEmit -p packages/api/tsconfig.json
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `packages/api/vitest.config.ts` (if exists) or root `vitest.config.ts` |
| Quick run command | `npx vitest run --filter time-entry --passWithNoTests` |
| Full suite command | `npx tsc --noEmit -p packages/api/tsconfig.json` (primary validation is compilation) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIME-02 | `time` permission registered, time router compiles | compilation | `npx tsc --noEmit -p packages/api/tsconfig.json 2>&1 \| grep time.ts` | N/A (type-check) |
| DOCS-01 | docs router compiles, doc-link-service compiles | compilation | `npx tsc --noEmit -p packages/api/tsconfig.json 2>&1 \| grep docs` | N/A (type-check) |
| DOCS-02 | docs search procedure type-checks | compilation | same as DOCS-01 | N/A (type-check) |
| CAL-01 | calendar router compiles, deadline sync compiles | compilation | `npx tsc --noEmit -p packages/api/tsconfig.json 2>&1 \| grep calendar` | N/A (type-check) |
| CAL-02 | calendar event service compiles, task config procedures compile | compilation | same as CAL-01 | N/A (type-check) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit -p packages/api/tsconfig.json` (zero errors)
- **Per wave merge:** Full `turbo build` across monorepo
- **Phase gate:** `packages/api` compiles with zero TypeScript errors

### Wave 0 Gaps
None -- this phase's primary validation is TypeScript compilation, not unit tests. The existing test stubs from Phase 18 Wave 0 and Phase 20 Wave 0 cover the behavioral requirements.

## Sources

### Primary (HIGH confidence)
- Direct TypeScript compilation output: `npx tsc --noEmit -p packages/api/tsconfig.json` -- 44+ errors catalogued
- Source file inspection: `permissions.ts`, `roles.ts`, `calendar.ts`, `docs.ts`, `time.ts`, `time-entry.ts`, `doc-link-service.ts`, `calendar-event-service.ts`, `calendar-deadline-sync.ts`
- Prisma schema: `packages/db/prisma/schema/contract.prisma` -- confirms `title` not `name`
- `CredentialBlob` interface: `packages/integrations/src/types/credentials.ts` -- confirms `extra` property exists
- Validators source: `packages/validators/src/index.ts` -- confirms exports exist in source but dist is stale
- Codebase patterns: `approval-engine.ts` (TxClient), `esign.ts`/`approval.ts` (ctx.user!.id)

### Secondary (MEDIUM confidence)
- Milestone audit: `.planning/v2.0-MILESTONE-AUDIT.md` -- identified 6 of 8 root causes (missed stale validators dist and ctx.prisma bug)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all fixes use existing patterns
- Architecture: HIGH - all patterns verified against actual codebase usage
- Pitfalls: HIGH - complete error inventory from live tsc output

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- fixing existing code, no external API changes)
