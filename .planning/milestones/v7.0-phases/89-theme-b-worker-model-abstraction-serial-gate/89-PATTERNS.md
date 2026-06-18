# Phase 89: Theme B — Worker Model Abstraction (serial gate) - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 17 new/modified surfaces
**Analogs found:** 17 / 17 (every leg has a verified in-tree precedent)

> **Scope:** backend gate + flag-dark skeleton. **No UI-SPEC** — the only frontend touch is a `useFlag` render-tree removal of `/employee/*` (one-line mirror of `dashboard-home.tsx`).
>
> **Honor RESEARCH as authoritative.** Recommended design (A): the `workerType` discriminator lives on `Worker` only; `Contractor` reads are inherently contractor-only. Two highest-risk items flagged in **Highest-Risk Items** below.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/db/prisma/schema/worker.prisma` (NEW) | model | CRUD | `prisma/schema/contractor.prisma` (`Contractor` model) | role-match (tenant-owning model conventions) |
| `packages/db/prisma/schema/contractor.prisma` (MODIFY: `+workerId @unique` + relation) | model | CRUD | self (additive nullable column precedent: `ssnEncrypted` line 43) | exact |
| `packages/db/prisma/.../migrations/XXXX_worker_base_additive` (NEW) | migration | batch/transform | additive-nullable column pattern (`ssnEncrypted` migration) | role-match |
| `packages/db/prisma/.../migrations/XXXX_worker_id_required` (NEW) | migration | batch/transform | NOT-NULL-after-backfill ordering (RESEARCH Pattern 2) | role-match |
| `packages/db/scripts/backfill-worker.ts` (NEW) | utility (script) | batch/transform | `scripts/backfill-free-zone-assignment.ts` | **exact** |
| `packages/db/src/worker-type.ts` (NEW: `withWorkerTypeDefault`) | utility (Prisma extension) | transform | `src/soft-delete.ts` (`withSoftDelete`) | **exact** |
| `packages/db/src/index.ts` (MODIFY: chain 3rd link) | config | transform | self (`createTenantClient` lines 70-72) | exact |
| `packages/api/src/routers/core/dashboard.ts:72-80` (MODIFY/assert) | controller (raw site) | request-response | self (raw `FROM "Contractor"` block) | exact ⚠ |
| `packages/api/src/routers/core/search.ts:73-80` (MODIFY/assert) | controller (raw site) | request-response | self | exact ⚠ |
| `packages/api/src/routers/core/contractor-shared.ts:304-312` (MODIFY/assert) | utility (raw site) | request-response | self | exact ⚠ |
| `packages/api/src/routers/core/contractor-shared.ts:323-331` (MODIFY/assert) | utility (raw site) | request-response | self | exact ⚠ |
| `scripts/check-contractor-rawsql-workertype.ts` (NEW CI guard) | utility (CI lint) | transform | `scripts/check-raw-sql-tenant-scoped.ts` | **exact** |
| `packages/api/src/routers/core/worker.ts` (NEW: `workerRouter`) | route (tRPC) | CRUD/request-response | `routers/core/contractor.ts` (composition) | role-match |
| `packages/api/src/routers/core/employee.ts` (NEW skeleton) | route (tRPC) | request-response | `routers/core/contractor.ts` | role-match |
| `packages/api/src/middleware/require-workforce-flag.ts` (NEW) | middleware | request-response | `middleware/require-us-expansion-flag.ts` | **exact** |
| `packages/api/src/root.ts` (MODIFY: conditional-spread) | config | request-response | self (`conditionalUsExpansionRouters` lines 157-163, 228) | **exact** |
| `packages/auth/src/{permissions.ts,roles.ts}` (MODIFY: `employee` resource + 4 roles) | config (RBAC) | event-driven | self (`accessControlStatement` + `ac.newRole`) | exact |
| `packages/api/src/errors.ts` (MODIFY: `+WORKFORCE_DISABLED`) | config | — | self (`US_EXPANSION_DISABLED` line 339) | exact |
| `apps/web-vite/.../employee` render-removal (MODIFY) | component | request-response | `dashboard-home.tsx:83` (`useFlag`) | exact |
| **Wave-0 tests** (snapshot / backfill / extension / parity / leak / roles / flag) | test | — | per-test analogs below | mixed |

---

## Pattern Assignments

### `packages/db/src/worker-type.ts` — `withWorkerTypeDefault` (utility, transform)

**Analog:** `packages/db/src/soft-delete.ts` (`withSoftDelete`) — the proven `$extends({ query })` injection pattern. Also reference `src/tenant.ts` for the `$allOperations` shape + `READ_OPERATIONS` set.

**Extensible type + `$extends` shape** (`soft-delete.ts:5-7,77-78`; `tenant.ts:18-20,141-143`):
```typescript
// reuse the SAME PrismaExtensible type already exported from tenant.ts
type PrismaExtensible = { $extends: Prisma.DefaultPrismaClient['$extends'] };

export function withWorkerTypeDefault<T extends PrismaExtensible>(prisma: T) {
  return prisma.$extends({ query: { /* ... */ } });
}
```

**Scalar-injection idiom — COPY, then ADD explicit-where-wins** (`soft-delete.ts:45-53`):
```typescript
// soft-delete ALWAYS injects (no opt-out):
function injectDeletedAtNull(args: unknown): unknown {
  if (args == null || typeof args !== 'object') return args;
  const argsObj = args as Record<string, unknown>;
  const where = (argsObj.where ?? {}) as Record<string, unknown>;
  argsObj.where = { ...where, deletedAt: null };
  return argsObj;
}
```
**What DIFFERS (D-05):** worker-type injects ONLY when `where.workerType` is absent — mirror RESEARCH §Pattern-1 `injectWorkerTypeDefault` (the `if ('workerType' in where) return argsObj;` guard). This is the one behavior soft-delete does NOT have.

**Model-set + read-op gating** — soft-delete uses an explicit per-method `$allModels` block keyed off `softDeleteModels` (`soft-delete.ts:26-33,117-157`). RESEARCH recommends the terser `$allOperations` form with two `Set`s (`WORKER_TYPE_DEFAULTED_MODELS`, `WORKER_TYPE_READ_OPS`). **Design (A) ⇒ the model set is `{'Worker'}` only** (Contractor reads need no `workerType` injection — a Contractor row IS a contractor). Read ops to cover: `findMany, findFirst, findFirstOrThrow, findUnique, findUniqueOrThrow, count, aggregate, groupBy` (matches `tenant.ts:71-80 READ_OPERATIONS`).

**findUnique caveat (Highest-Risk #2 / A2):** soft-delete already injects `deletedAt: null` into `findUnique` and works (`soft-delete.ts:124-129`), so injecting a scalar into `findUnique.where` is in-tree-proven. If design (B) is ever chosen, verify Prisma 7.8 accepts a non-unique `workerType` alongside the unique `id`; conservative fallback = convert `findUnique`→`findFirst` inside the extension.

---

### `packages/db/src/index.ts` — chain the third link (config, transform)

**Analog:** self, `createTenantClient` (lines 70-72).

**Current** (lines 70-72):
```typescript
export function createTenantClient() {
  return withSoftDelete(withTenantScope(basePrisma));
}
```
**Change (ORDER MATTERS — outermost):**
```typescript
export function createTenantClient() {
  return withWorkerTypeDefault(withSoftDelete(withTenantScope(basePrisma)));
}
```
**Also update** `createTenantClientFrom<T>` (lines 78-80, used for `$transaction` tx clients) the same way, and add `export { withWorkerTypeDefault } from './worker-type.js';` next to the existing `withSoftDelete` export (line 56).

---

### `packages/db/scripts/backfill-worker.ts` (NEW — utility/script, batch/transform)

**Analog:** `packages/db/scripts/backfill-free-zone-assignment.ts` — **copy the structure verbatim**, swap the domain.

**Pure unit-testable transform (idempotency guard)** (`backfill-free-zone-assignment.ts:85-124`):
```typescript
export function planFreeZoneBackfill(contractors: readonly ContractorRow[]): FreeZoneAssignmentInsert[] {
  const inserts: FreeZoneAssignmentInsert[] = [];
  for (const c of contractors) {
    if (c.countryCode !== 'AE') continue;
    if (c.hasAssignment) continue; // idempotency — never overwrite an existing row.
    // ...
  }
  return inserts;
}
```
**Worker version:** `planWorkerBackfill(rows)` skips `if (c.workerId) continue;` (the `WHERE workerId IS NULL` idempotency guard — RESEARCH §Code-Examples). Never mutates source.

**pino + masked URL + dry-run + lazy client import + `$transaction` + `$disconnect`** (`backfill-free-zone-assignment.ts:38-48,126-187`):
```typescript
const log = pino({ ...getBaseLoggerOptions(), name: 'backfill-free-zone-assignment' });
// ...
log.info({ dbUrl: dbUrl.replace(/:[^:@/]+@/, ':***@'), dryRun }, 'connecting');
const { createPrismaClientForUrl } = await import('../src/client.js'); // NOT legacy @prisma/client
const prisma = createPrismaClientForUrl(dbUrl);
try {
  const candidates = await prisma.contractor.findMany({ where: { /* workerId: null */ }, select: {...} });
  if (dryRun) { log.info('dry-run — no writes'); return; }
  await prisma.$transaction(inserts.map(row => prisma.worker.create({ data: {...} })));
} finally { await prisma.$disconnect(); }
```
**What DIFFERS / ADD (D-02, D-13):**
- **Two writes per contractor in ONE tx step:** create `Worker`, then `contractor.update({ where:{id}, data:{ workerId } })` — link must be atomic with the insert.
- **`writeAuditLog`** system-actor row recording the one-time backfill (D-13) — see `packages/api/src/services/audit-writer.ts`; the free-zone backfill predates that requirement so it has none.
- **Batch the largest org** (chunk ~1k creates/tx) — free-zone used a single `$transaction`; a 50k-contractor org needs chunking to avoid lock/timeout (RESEARCH Open-Q #3).
- **Down/rollback path** (D-02) — a `--rollback` branch or sibling script that nulls `workerId` + drops orphaned `Worker` rows; `Contractor` rows never touched destructively.

**Per-region invocation** (`backfill-free-zone-assignment.ts:29-33` usage block): `DATABASE_URL=$DATABASE_URL_{EU,ME,US} tsx packages/db/scripts/backfill-worker.ts [--dry-run]`.

---

### Migration ordering (NEW migrations — batch/transform)

**Analog:** additive-nullable column precedent on `Contractor` (`ssnEncrypted String?` line 43 — "Additive-nullable, existing rows default NULL, zero data migration") + `scripts/migrate-all-regions.ts` for per-region deploy.

**Three-step ordering is load-bearing (RESEARCH Pattern 2 / Pitfall 4):**
1. **Migration A (additive, reversible):** `CREATE TABLE "Worker"` (+`workerType` default `'CONTRACTOR'`, `organizationId`, `@@index([organizationId])`, `@@index([organizationId, workerType])`, `deletedAt`); `ALTER TABLE "Contractor" ADD COLUMN "workerId" TEXT` (**nullable**); `CREATE UNIQUE INDEX "Contractor_workerId_key"`.
2. **Backfill script** (above) — after A, before reads re-scoped.
3. **Migration B (enforce, AFTER staging-snapshot parity):** `SET NOT NULL` + add FK `REFERENCES "Worker"(id)`.

**Per-region deploy** — `pnpm --filter @contractor-ops/db db:migrate:all` → `migrate-all-regions.ts` iterates `DATABASE_URL_{EU,ME,US}`, fails-fast, skips-on-missing-US (`migrate-all-regions.ts:43,51-71`). Do NOT hand-roll a bash loop.

---

### The 4 raw-SQL sites (controllers/utility, request-response) — ⚠ EXTENSION BLIND SPOT

**Analog:** each site is its own analog — the inline tenant predicate is the template for the worker-type predicate.

| Site | Lines | Current predicate | Action (design A) |
|------|-------|-------------------|-------------------|
| `dashboard.ts` `fetchKpis` activeContractors COUNT | 72-80 | `WHERE "organizationId" = … AND "status" = 'ACTIVE' AND "deletedAt" IS NULL` | regression-assert count parity; (design B → add `AND "workerType" = 'CONTRACTOR'`) |
| `search.ts` command-palette contractor FTS | 73-80 | `WHERE "organizationId" = … AND "deletedAt" IS NULL AND "search_vector" @@ …` | regression-assert; (design B → add predicate) |
| `contractor-shared.ts` billingModel JSONB facet | 304-312 | `WHERE "organizationId" = … AND "deletedAt" IS NULL AND "customFieldsJson"->>'billingModel' = ANY(…)` | regression-assert; (design B → add predicate) |
| `contractor-shared.ts` FTS facet | 323-331 | `WHERE "organizationId" = … AND "deletedAt" IS NULL AND "search_vector" @@ …` | regression-assert; (design B → add predicate) |

`dashboard.ts:58-59` already documents the bypass: *"The `db.$queryRaw` calls bypass the soft-delete + tenant scope extensions, so all predicates are spelled out explicitly."* The `withWorkerTypeDefault` extension receives `model: undefined` for raw queries (RESEARCH Pitfall 1) and will NEVER touch these. **In design (A) they query `FROM "Contractor"` directly — inherently contractor-only — so they need NO predicate change, ONLY a regression assertion that counts/results match the pre-migration baseline.** In design (B) (denormalized `Contractor.workerType`) add `AND "workerType" = 'CONTRACTOR'` to each.

---

### `scripts/check-contractor-rawsql-workertype.ts` (NEW CI guard — utility/lint, transform)

**Analog:** `scripts/check-raw-sql-tenant-scoped.ts` — **exact structural twin**. It already walks every `$queryRaw` body and flags any lacking an `organizationId` predicate; the new guard flags any `$queryRaw … FROM "Contractor"` lacking a `workerType` predicate (or annotated `// safe-raw-sql:`-style opt-out).

**Reusable scaffolding to copy** (`check-raw-sql-tenant-scoped.ts`):
- `SOURCE_GLOBS` / `EXCLUDE_GLOBS` (lines 39-52) — same scan surface.
- `captureBody` (89-185), `stripComments` (230-308), `lineNumberAt` (187-193), `previousNonBlankLines` (202-219) — copy verbatim; they correctly skip JSDoc/string references.
- Pattern swap: `TENANT_PREDICATE_PATTERN = /organization[_]?id/i` → a `FROM "Contractor"`-detector + a `workerType` predicate check; offence iff body matches the FROM-Contractor pattern AND lacks the workerType token AND no annotation.
- Exit-code + reporting shape (lines 389-406).

**Wiring** (root `package.json`): add `"check:contractor-rawsql-workertype": "tsx scripts/check-contractor-rawsql-workertype.ts"` and append it to the `lint:ci` chain next to `pnpm lint:raw-sql` (line with `lint:raw-sql`). VALIDATION.md names the command `check:contractor-rawsql-workertype`.

---

### `packages/api/src/routers/core/worker.ts` + `employee.ts` (NEW — route, CRUD / request-response)

**Analog:** `routers/core/contractor.ts` (composition) — but the new routers are smaller.

**`contractorRouter` composition stays UNCHANGED in shape** (D-06, `contractor.ts:12-18`):
```typescript
export const contractorRouter = mergeRouters(
  contractorCoreRouter, contractorCountryRouter, contractorTaxRouter,
  contractorEngagementsRouter, contractorBulkRouter,
);
```
**`workerRouter`** = cross-type ops; every procedure passes an **explicit `workerType`** in its `where` (so `withWorkerTypeDefault` does NOT force-filter — D-05). **`employeeRouter`** = skeleton, minimal/empty procedures, queries pass `workerType: 'EMPLOYEE'`. Both: Zod `.strict()` DTOs (block `organizationId`/`workerType` mass-assignment — RESEARCH Security V5), `writeAuditLog` on mutations (D-13).

---

### `packages/api/src/middleware/require-workforce-flag.ts` (NEW — middleware, request-response)

**Analog:** `middleware/require-us-expansion-flag.ts` — **exact mirror, rename only**.

**`assertWorkforceEnabled`** (mirror `assertUsExpansionEnabled` lines 29-47):
```typescript
export function assertUsExpansionEnabled(organizationId: string, region: string): void {
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);
  const result = evaluate('module.us-expansion', { organizationId, region: evalRegion });
  if (!result.enabled) {
    throw new TRPCError({ code: 'FORBIDDEN', message: US_EXPANSION_DISABLED, cause: {...} });
  }
}
```
Swap flag key → `'module.workforce-employees'`, message → `WORKFORCE_DISABLED`, logger `service: 'workforce-flag-guard'`.

**`isWorkforceRegistered`** (mirror `isUsExpansionRegistered` lines 55-58): `evaluate('module.workforce-employees', { organizationId: 'ROOT', region: 'EU' }).enabled || Boolean(process.env.QA_DEFAULT_ORG_ID)`.

---

### `packages/api/src/root.ts` (MODIFY — config, request-response)

**Analog:** self — `conditionalUsExpansionRouters` (lines 157-163, spread at 228).

**Pattern** (lines 157-163):
```typescript
const usExpansionRouters = { taxForm: taxFormRouter } as const;
const conditionalUsExpansionRouters = isUsExpansionRegistered()
  ? usExpansionRouters
  : ({} as typeof usExpansionRouters);
// ... appRouter: { ..., ...conditionalUsExpansionRouters }
```
**Worker version:**
```typescript
const workforceRouters = { worker: workerRouter, employee: employeeRouter } as const;
const conditionalWorkforceRouters = isWorkforceRegistered()
  ? workforceRouters
  : ({} as typeof workforceRouters);
// appRouter: { ..., ...conditionalWorkforceRouters }
```
**CRITICAL:** the `contractor: contractorRouter` mount (line 179) is NOT flag-gated and is UNCHANGED (D-06). Only `worker.*` + `employee.*` go behind the flag. The const-lifting note (lines 131-135) explains why the empty branch is cast to the same type — preserve that idiom so client typing stays stable.

---

### `packages/auth/src/{permissions.ts,roles.ts}` (MODIFY — RBAC config)

**Analog:** self — `accessControlStatement` (`permissions.ts:12-46`) + `ac.newRole` (`roles.ts:44-180`).

**Add `employee` resource** to `accessControlStatement` (after `contractorPii` line 44; mirror existing resource-action arrays like `contractor: ['create','read','update','delete','bulk']`). Action set = Claude's-discretion (D-08) — e.g. `['create','read','update','delete']` (+ HR-only actions).

**Add 4 roles** via `ac.newRole({...})` (mirror `finance_admin` lines 75-88 — narrow grants):
```typescript
finance_admin: ac.newRole({
  contractor: ['read'], invoice: ['create','read','update','delete','approve'], /* ... */
}),
```
`HR_ADMIN / HR_MANAGER / PAYROLL_OFFICER / LEAVE_APPROVER` grant only `employee` (+ minimal read) actions — **NOT** contractor mutations (RESEARCH Security BFLA). Existing 9 roles must stay **byte-identical** (regression test asserts this).

**Naming note:** existing roles are snake_case (`finance_admin`, `it_admin`). CONTEXT names the new roles UPPER_SNAKE (`HR_ADMIN`). Planner reconciles casing against the `RoleName` union (`roles.ts:183`) — match the existing convention unless a deliberate deviation is documented.

**DO NOT TOUCH** the duplicated `allPermissions` const on `owner` (`roles.ts:18-42`) — out of scope (D-08); it is the sole source for `owner` and the inline comment (lines 38-41) already documents the duplication.

---

### `packages/api/src/errors.ts` (MODIFY — config)

**Analog:** self — `US_EXPANSION_DISABLED` (line 339).
```typescript
export const US_EXPANSION_DISABLED = 'usExpansionDisabled';
```
**Add:** `export const WORKFORCE_DISABLED = 'workforceDisabled';` + i18n parity en/en-US/de/pl/ar (D-14) wherever `usExpansionDisabled` is keyed.

---

### `apps/web-vite/.../employee` render-removal (MODIFY — component, request-response)

**Analog:** `dashboard-home.tsx:83`:
```typescript
const classificationEnabled = useFlag('module.classification-engine');
```
Use `useFlag('module.workforce-employees')` to remove `/employee/*` surfaces from the render tree when off. Follow web-vite layers (Page→Container→Hook→Component) + WCAG loading/empty/error if any skeleton renders. Minimal this phase (flag-dark skeleton).

---

## Wave-0 Test Pattern Assignments

| Test (NEW) | Covers | Analog | What to copy |
|------------|--------|--------|--------------|
| `packages/api/src/__tests__/contractor-contract-snapshot.test.ts` | WORKER-02 (D-07) | greenfield (no tRPC introspection test exists) | `Object.keys(appRouter._def.procedures).filter(p=>p.startsWith('contractor.')).sort()` → `toMatchSnapshot()` (RESEARCH Pattern 3). Capture BEFORE the split (Pitfall 6). |
| `packages/db/src/__tests__/backfill-worker.test.ts` | WORKER-01 | free-zone backfill is unit-testable via its pure export | unit-test `planWorkerBackfill` (no Prisma) — idempotency: linked rows skipped, re-run = no-op |
| `packages/db/src/__tests__/worker-type.test.ts` | WORKER-02 | soft-delete extension tests (if any) + mock client | inject on Worker reads across all 8 read ops; explicit-where-wins (caller `workerType` untouched) |
| `packages/api/src/__tests__/worker-regression.test.ts` (parity) | WORKER-01/02 (D-03) | `__tests__/tenant-isolation.test.ts` mock-Prisma + `createCallerFactory` idiom (lines 1-60) | contractor list/dashboard/payment-run/classification-scan/export/portal + the 4 raw sites return same rows pre/post |
| `packages/api/src/__tests__/worker-tenant-isolation.test.ts` | WORKER-03/09 | `__tests__/tenant-isolation.test.ts` (clone) — `ORG_A`/`ORG_B` callers, assert no cross-org leak | clone the two-org seed + cross-org NOT_FOUND assertions for `Worker` |
| `packages/auth/.../roles.test.ts` (extend) | WORKER-04 | existing auth roles/permissions test | assert 4 new roles present + `employee` resource + existing 9 roles' grants unchanged |
| `packages/api/src/__tests__/workforce-flag.test.ts` | WORKER-05 | mirror a us-expansion flag test (none found by name — mirror the `isUsExpansionRegistered`/conditional-spread behavior) | flag-off → `worker`/`employee` absent (METHOD_NOT_FOUND) + guard FORBIDDEN; flag-on → present |

---

## Shared Patterns

### Prisma client-extension chain (can't-forget filter)
**Source:** `packages/db/src/index.ts:70-72` + `soft-delete.ts` + `tenant.ts`
**Apply to:** the new `withWorkerTypeDefault` — chained outermost in `createTenantClient` + `createTenantClientFrom`. The injection idiom (clone `where`, spread scalar) and the `PrismaExtensible` type are reused directly.

### Tenant scoping (cross-org safety)
**Source:** `packages/db/src/tenant.ts` — `globalModels` set (lines 42-68), `READ_OPERATIONS` (71-80)
**Apply to:** `Worker` is tenant-owning — **MUST NOT** be added to `globalModels` (D-09/D-11). It inherits `withTenantScope` automatically (has `organizationId`). Cross-org leak test mandatory.

### Flag-off (three-layer dark ship)
**Source:** `root.ts:157-163,228` (conditional-spread) + `middleware/require-us-expansion-flag.ts` (per-request guard) + `dashboard-home.tsx:83` (render removal) + `errors.ts:339`
**Apply to:** all of WORKER-05 — exact mirror, rename `us-expansion`→`workforce-employees` / `usExpansion`→`workforce` / `US_EXPANSION_DISABLED`→`WORKFORCE_DISABLED`. Flag already registered PENDING (`flags-core.ts:220-228`) — **do NOT re-register** (D-10).

### Backfill script scaffolding
**Source:** `packages/db/scripts/backfill-free-zone-assignment.ts` + `migrate-all-regions.ts`
**Apply to:** `backfill-worker.ts` — pure transform export + `--dry-run` + masked-URL pino + lazy `createPrismaClientForUrl` + `$transaction` + `$disconnect`. ADD: audit-log row, link-update, batching, rollback path.

### RBAC additive
**Source:** `packages/auth/src/permissions.ts:12-46` + `roles.ts:44-180`
**Apply to:** `employee` resource + 4 roles — additive only; existing roles byte-identical; do not touch `owner` `allPermissions`.

### Raw-SQL CI guard
**Source:** `scripts/check-raw-sql-tenant-scoped.ts` (full file) + root `package.json` `lint:ci` / `lint:raw-sql` wiring
**Apply to:** `check-contractor-rawsql-workertype.ts` — copy the scanner machinery, swap the predicate, wire into `lint:ci`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `contractor-contract-snapshot.test.ts` | test | — | No tRPC `_def.procedures` introspection test exists today (RESEARCH D-07 — greenfield). Pattern fully specified in RESEARCH §Pattern-3; the dependency-free `Object.keys(appRouter._def.procedures)` approach needs no new package. |
| `workforce-flag.test.ts` | test | — | No us-expansion flag integration test was found by name; mirror the `isUsExpansionRegistered` + conditional-spread behavior rather than copy a file. |

(Both are test-only scaffolds — the planner uses the RESEARCH-specified pattern; no production analog needed.)

---

## Highest-Risk Items (flag to planner)

### 1. ⚠ The 4 raw-SQL sites — the central extension's blind spot
`withWorkerTypeDefault` covers ~84 Prisma-client reads but is **structurally incapable** of touching the 4 `$queryRaw FROM "Contractor"` sites (`dashboard.ts:72-80`, `search.ts:73-80`, `contractor-shared.ts:304-312` + `:323-331`) — Prisma passes `model: undefined` for raw queries. In **design (A)** these are inherently contractor-only and need only a regression assertion; in **design (B)** they need a hand-edited inline `workerType` predicate. **Either way the new `check-contractor-rawsql-workertype` CI guard is mandatory** so future raw `FROM "Contractor"` reads cannot silently bypass the discriminator. `dashboard.ts:58-59` already documents the bypass-by-design — that comment is the warning sign.

### 2. ⚠ Keep `Contractor.id` STABLE — do NOT re-key to `workerId`
20+ Theme-A/B FKs already point at `Contractor.id` (`Invoice.contractorId`, `Contract.contractorId`, `ContractorBillingProfile`, `PaymentRunItem`, `TaxFormSubmission`, `Form1099Nec`, … — visible in `contractor.prisma:70-90` relation block). Collapsing `Contractor.id`→`workerId` lossily relinks every one of them, violating D-02 ("no contractor row lossily relinked"). The model is a **sidecar nullable-then-required `Contractor.workerId @unique` 1:1 FK** — additive, reversible, `Contractor` rows never touched destructively. The migration ordering (additive A → backfill → enforce B) is what keeps it reversible; inverting it (NOT NULL before backfill) is Pitfall 4.

**Secondary (verify-at-execution):** A2 — `findUnique` accepting an injected non-unique scalar (in-tree-proven by soft-delete for design A; verify for design B). A5 — nested-relation read interception (design A's Worker-level scoping is more robust).

---

## Metadata

**Analog search scope:** `packages/db/{src,scripts,prisma/schema}`, `packages/api/src/{routers/core,middleware,__tests__}`, `packages/auth/src`, `packages/feature-flags/src`, `apps/web-vite/src/components/dashboard`, `scripts/`, root `package.json`
**Files scanned:** ~20 source files read (every analog verified, not inferred)
**Pattern extraction date:** 2026-06-18
**Recommended design:** (A) — `workerType` discriminator on `Worker` only (RESEARCH Open-Q #1; planner confirms)
