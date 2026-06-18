# Phase 89: Theme B — Worker Model Abstraction (serial gate) - Research

**Researched:** 2026-06-18
**Domain:** Prisma 7 normalized model migration (base-table + 1:1 link + backfill), Prisma client query-extension authoring, tRPC v11 router split + contract snapshotting, Better-Auth RBAC, Unleash flag-off — all under a **zero contractor-path-regression** constraint
**Confidence:** HIGH on the in-tree patterns (verified by reading the source); MEDIUM on two Prisma behaviors flagged for execution-time re-verify (findUnique non-unique where injection; nested-relation interception)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-14 — research WITHIN these, do not re-litigate)

- **D-01 (AMENDS WORKER-01):** Dedicated `Worker` base table; `Contractor` and a future P90 `Employee` link to it; `workerType` discriminator (default `CONTRACTOR`). Shared identity/worker fields live on `Worker`; contractor-specific data stays on `Contractor` (+ `ContractorBillingProfile`); employee-specific data → P90 `EmployeeProfile`. This is the normalized model the user chose over additive-`workerType`-on-Contractor; it supersedes WORKER-01's original "zero data migration / extend Contractor in place" phrasing.
- **D-02:** The migration is a ONE-TIME, additive, idempotent, per-region (EU/ME/US), reversible backfill — create `Worker`, backfill one `Worker` row per existing v1–v6 contractor and link it; NO contractor row destroyed or lossily relinked. `[BLOCKING]` multi-region migration at a human gate (P83–88 convention) with an explicit down/rollback path. **Highest-risk operation in the milestone.**
- **D-03:** Zero contractor-path regression is the gate's pass condition. Parity (lists, dashboards, payment-runs, classification-scans, exports, portal) MUST be verified on a staging snapshot of the largest org before the backfill is accepted. A Wave-0 regression suite locks behavior before any model change.
- **D-04:** Central Prisma extension `withWorkerTypeDefault`, chained after `withTenantScope` / `withSoftDelete` in `packages/db/src/index.ts createTenantClient`. Auto-injects `workerType='CONTRACTOR'` on `contractor.*` (and worker-base) reads. Can't-forget across all sites.
- **D-05:** Explicit-where-wins opt-out — inject the `CONTRACTOR` default ONLY when the query's `where` does not already specify `workerType`, so `workerRouter` (cross-type) + `employeeRouter` (`workerType='EMPLOYEE'`) pass an explicit `workerType` and are not force-filtered. Lint/grep guard + regression suite back it.
- **D-06:** Shared `workerRouter` (cross-type) + existing `contractorRouter` (shapes preserved) + skeleton `employeeRouter`. `contractorRouter` composition (`core + country + tax + engagements + bulk`) and its `contractor` mount in `root.ts` unchanged in shape.
- **D-07:** Wave-0 RED contract/snapshot test captures existing `contractor.*` procedure names + input/output shapes BEFORE the split; shape drift fails CI (no snapshot exists today — greenfield).
- **D-08:** Add a new `employee` resource + 4 roles (`HR_ADMIN`, `HR_MANAGER`, `PAYROLL_OFFICER`, `LEAVE_APPROVER`) in `packages/auth/src/{roles.ts,permissions.ts}`; existing roles unchanged. HR-only fields gated by per-type RBAC. Do NOT touch the pre-existing duplicated `allPermissions` const on `owner`.
- **D-09:** `organizationId` tenant invariant on `Worker` — tenant-owning, NOT in `globalModels`; cross-org leak test; inherits `withTenantScope`.
- **D-10:** Reuse the existing `module.workforce-employees` flag (registered PENDING in P82 — do NOT re-register). Flag-off = `root.ts` conditional-spread (METHOD_NOT_FOUND/FORBIDDEN) + per-request guard middleware + web-vite `useFlag` render-tree removal.
- **D-11:** `Worker`/`Employee` tenant-owning, never in `globalModels`; cross-org leak test per new model.
- **D-12:** Store against the new `Worker`/`Contractor` model now; abstraction lets Theme A re-point its `Contractor` FKs to `Worker` later if ever needed (out of scope here).
- **D-13:** `writeAuditLog` on the backfill (system-actor row recording the one-time backfill) + on any new worker/employee mutation; migration idempotent + reversible.
- **D-14:** i18n parity en/en-US/de/pl/ar for any new user-facing strings (minimal this phase).

### Claude's Discretion (research options, recommend)

- Exact `Worker` base-table columns vs what stays on `Contractor`; the `Contractor`→`Worker` FK/relation shape (whether `Contractor.id` becomes `workerId` or a 1:1 relation) — preserving zero contractor-row loss.
- Backfill mechanics (raw SQL vs Prisma script), batching, per-region ordering, down/rollback script — idempotent + re-runnable.
- The extension's exact model-targeting and the explicit-where-wins detection.
- The route-shape snapshot format (Vitest snapshot of the router def vs a generated contract artifact).
- The `employee` permission action set + per-role grants.
- Regression suite against a seeded fixture vs a documented staging-snapshot procedure.

### Deferred Ideas (OUT OF SCOPE)

- Employee profile fields / per-market statutory identifiers → P90 (this gate ships only the `Employee` table skeleton + abstraction).
- Populating `employeeRouter` (registry/leave/time/etc.) → P90–97.
- Re-pointing Theme A `Contractor` FKs to `Worker` → out of scope.
- Fixing the pre-existing duplicated `allPermissions` on `owner` → noted, not in scope.
- Live `module.workforce-employees` enablement → stays PENDING/dark.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORKER-01 | `Worker` discriminated-union base table; `Contractor`/`Employee` link to it; `workerType` default `CONTRACTOR`; one-time additive idempotent per-region reversible backfill | Migration ordering + idempotency + reversibility (§ Migration Safety); backfill mechanics modeled on `backfill-free-zone-assignment.ts` (`planX` pure transform + `$transaction` apply, dry-run, per-region invocation) + `migrate-all-regions.ts` |
| WORKER-02 | tRPC namespace split — shared `workerRouter` + existing `contractorRouter` (shapes preserved) + new `employeeRouter`; central contractor filtering across ~84 reads | `withWorkerTypeDefault` extension (§ Pattern 1) + the raw-SQL bypass sites that need manual filters (§ Common Pitfalls); contract snapshot via `appRouter._def.procedures` (§ Pattern 3) |
| WORKER-03 | `organizationId` invariant preserved on `Worker`; HR-only fields gated by per-type RBAC | `Worker` inherits `withTenantScope` (omit from `globalModels`); per-type RBAC via the new `employee` resource; cross-org leak test idiom (`tenant-isolation.test.ts`) |
| WORKER-04 | New roles `HR_ADMIN`, `HR_MANAGER`, `PAYROLL_OFFICER`, `LEAVE_APPROVER`; existing 8/9 roles unchanged | Additive `ac.newRole(...)` in `roles.ts` + new `employee` resource in `permissions.ts accessControlStatement` (§ RBAC) |
| WORKER-05 | `module.workforce-employees` gates all Theme B routes; flag-off = render-tree removal + tRPC FORBIDDEN | Reuse PENDING flag (P82); mirror `module.us-expansion` conditional-spread + `assertUsExpansionEnabled` guard + web-vite `useFlag` (§ Pattern 4) |
</phase_requirements>

## Summary

Phase 89 is a **gate, not a feature**: it introduces a normalized `Worker` base table that `Contractor` (and a P90 `Employee`) link to, with a `workerType` discriminator defaulting to `CONTRACTOR`, and must prove **zero regression** to every existing contractor read path on a real staging snapshot. The deliverable is the abstraction + a can't-forget filter + a contract lock — all behind the dark `module.workforce-employees` flag.

The repo already has the three load-bearing patterns this phase reuses: (1) a **two-link Prisma client-extension chain** (`withTenantScope` → `withSoftDelete`, both `$extends({ query: ... })`) where `withWorkerTypeDefault` becomes the third link `[VERIFIED: packages/db/src/index.ts:70-72]`; (2) **additive + idempotent + reversible + per-region migrations** run via `prisma migrate deploy` across `DATABASE_URL_{EU,ME,US}` (`migrate-all-regions.ts`) plus standalone backfill scripts (`backfill-free-zone-assignment.ts`, `backfill-scope-capabilities.ts`) that are the proven shape for data backfills `[VERIFIED: packages/db/scripts/*]`; (3) **flag-off = conditional router-spread + per-request guard + web-vite `useFlag` render removal** (`module.us-expansion` is the most recent, exact mirror) `[VERIFIED: packages/api/src/root.ts:151-163, middleware/require-us-expansion-flag.ts]`.

The central risk is twofold and both legs need explicit task coverage. **Leg 1 — the backfill** is the milestone's first *data* backfill over existing rows (not just additive columns); it must run after `Worker` + the nullable FK exist and **before** contractor reads are re-scoped, be re-runnable (`WHERE workerId IS NULL`), and ship a down/rollback. **Leg 2 — the filter coverage gap**: the `withWorkerTypeDefault` extension covers the ~84 Prisma-client contractor reads, but it **cannot** see the **4 confirmed `$queryRaw` sites** that hit the `Contractor` table directly (`dashboard.ts`, `search.ts`, `contractor-shared.ts` ×2) — Prisma query extensions receive `model: undefined` for raw queries and never touch them. Those 4 sites must be hand-edited to add `AND "workerType" = 'CONTRACTOR'`, and a grep guard must prevent new raw `FROM "Contractor"` without the predicate.

**Primary recommendation:** Model `Worker` as the identity root with `Contractor` holding a **nullable-then-required `workerId @unique` FK 1:1 relation** (NOT collapsing `Contractor.id` into `workerId` — that would lossily relink every Theme-A FK that already points at `Contractor.id`, violating D-02). Sequence: (Wave 0) RED contract snapshot + regression suite → (migration A) additive `Worker` table + `Contractor.workerId` nullable FK + `workerType` on `Worker` → (backfill) one idempotent `Worker` row per contractor, link, audit-log → (migration B, after backfill verified) enforce `workerId NOT NULL` → (extension) `withWorkerTypeDefault` + hand-edit the 4 raw sites → (router split + RBAC + flag-off). Keep the whole surface dark behind `module.workforce-employees`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `Worker` base table + `workerType` discriminator | Database / Storage | — | Identity root; tenant-owning (`organizationId`); FK target for `Contractor`/`Employee` |
| One-time backfill (Worker row per contractor) | Database / Storage (script) | API (audit-log call) | Data migration over existing rows; per-region; writes a system-actor `writeAuditLog` row (D-13) |
| `workerType='CONTRACTOR'` default injection | Database / Storage (Prisma client extension) | — | Can't-forget filter at the data-access boundary; mirrors `withSoftDelete`/`withTenantScope` |
| Raw-SQL contractor filters (dashboard/search/list) | API (router source) | — | Extension cannot see `$queryRaw`; predicate must be inline in the SQL |
| Router split (worker/contractor/employee) | API / Backend | — | tRPC namespaces; `contractorRouter` shape frozen by snapshot |
| Contract snapshot test | API (test) | — | `appRouter._def.procedures` introspection locks the contractor surface |
| `employee` resource + 4 roles | API / Backend (Better-Auth ac) | Browser (UI permission gating) | RBAC statement is server-authoritative; web-vite reads it for gating |
| Flag-off gating | API (conditional-spread + guard) | Frontend Server / Browser (`useFlag` render removal) | Defense-in-depth: absent-at-runtime + per-request + render-tree |

## Standard Stack

### Core (all already in-tree — this phase adds NO new external packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `prisma` / `@prisma/client` | `^7.8.0` | Schema, migrations, client extensions | `[VERIFIED: packages/db/package.json]` repo-pinned; `prisma-client` generator (modern, Prisma 7) per MEMORY |
| `@prisma/adapter-pg` | `^7.8.0` | Postgres driver adapter | `[VERIFIED: packages/db/package.json]` |
| `@trpc/server` | v11 | Router split + `_def.procedures` introspection | `[VERIFIED: CLAUDE.md stack table — tRPC v11]` |
| `better-auth` | `^1.6.9` | `createAccessControl` / `ac.newRole` for the `employee` resource + 4 roles | `[VERIFIED: packages/db/package.json devDeps; packages/auth/src/permissions.ts]` |
| `@contractor-ops/feature-flags` | workspace | `evaluate` / `useFlag` / `buildFlagBag` flag-off | `[VERIFIED: packages/api/src/root.ts:1; CLAUDE.md — flags via wrapper only]` |
| `vitest` | repo-pinned | Wave-0 contract snapshot + regression suite | `[VERIFIED: turbo test → vitest; packages/api/vitest.config.ts]` |
| `pino` / `@contractor-ops/logger` | `^10.x` | Backfill-script structured logging (no `console.*`) | `[VERIFIED: backfill-free-zone-assignment.ts uses pino + getBaseLoggerOptions]` |

### Supporting (optional, for the contract snapshot)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod-to-json-schema` | latest 3.x line (zod v3) **or** zod v4 native `z.toJSONSchema` | Serialize each `contractor.*` procedure's input/output zod schema into a stable JSON snapshot | Only if the snapshot must capture full input/output *shapes*, not just procedure names. The repo is on **zod `^4.4.3`** `[VERIFIED: packages/db/package.json]` — prefer zod v4's built-in `z.toJSONSchema()` over the third-party package to avoid a new dependency. `[ASSUMED]` — confirm zod v4 `toJSONSchema` is exported in the pinned version before relying on it. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Contractor.workerId @unique` 1:1 FK | Collapse `Contractor.id` → become `workerId` (Contractor PK = Worker PK) | REJECTED: every existing Theme-A/B FK (`Invoice.contractorId`, `Contract.contractorId`, `ContractorBillingProfile.contractorId`, `PaymentRunItem`, `TaxFormSubmission`, `Form1099Nec`, 20+ relations) points at `Contractor.id`. Re-keying lossily relinks them — violates D-02 ("no contractor row lossily relinked"). Keep `Contractor.id` stable; add a sidecar `workerId`. |
| Prisma client extension for the default | A DB-level Postgres VIEW or RLS policy | Extension matches the existing `withSoftDelete`/`withTenantScope` idiom (D-04), is testable in vitest with a mock client, and is greppable. A view/RLS would split the filtering logic across two layers and not cover the explicit-where-wins opt-out cleanly. |
| `appRouter._def.procedures` snapshot | `@trpc-studio/introspection` package | Native `_def.procedures` (a flat `Record<string, AnyProcedure>` in v11) needs no new dependency `[CITED: github.com/trpc/trpc discussions/5521]`. |

**Installation:**
```bash
# No external installs. If zod v4 toJSONSchema is unavailable in the pinned version
# (verify first), the only candidate add would be:
#   pnpm --filter @contractor-ops/api add -D zod-to-json-schema
# Subject to the 7-day release-age rule + pnpm audit + typosquat check (CLAUDE.md).
```

**Version verification:**
```bash
# already pinned in packages/db/package.json — confirmed by Read, not registry guess:
#   prisma ^7.8.0, @prisma/client ^7.8.0, @prisma/adapter-pg ^7.8.0,
#   better-auth ^1.6.9, zod ^4.4.3
```

## Package Legitimacy Audit

This phase installs **no external packages**. All libraries are already in the workspace and were verified by reading `packages/db/package.json` and `packages/auth` source — not by registry lookup. slopcheck was unavailable at research time; since nothing new is being added, there is nothing to gate.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none — all in-tree) | — | No new installs |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*If the planner decides to add `zod-to-json-schema` (only if zod v4 native `toJSONSchema` is unavailable), gate it behind a `checkpoint:human-verify` task: verify on npm, confirm 7-day release age, run `pnpm audit` + `pnpm security:scan`, typosquat-check the exact name.*

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────── module.workforce-employees (PENDING, dark) ───────────────────┐
                    │                                                                                    │
 web-vite client ──useFlag()──► render /employee/* surfaces?  ──no──► tree removed (no fetch)            │
       │                                                                                                  │
       ▼ tRPC                                                                                             │
 root.ts ──conditional-spread──► { ...conditionalWorkforceRouters }  ──flag off──► absent (METHOD_NOT_FOUND)
       │                                                                                                  │
       ├─ contractor.*  (shape FROZEN by Wave-0 snapshot) ─┐                                              │
       ├─ worker.*      (cross-type; passes explicit workerType) ─┐                                       │
       └─ employee.*    (skeleton; passes workerType='EMPLOYEE') ─┤  ◄─ requireWorkforceFlag guard ───────┘
                                                                   │      (FORBIDDEN if flag off, per-request)
                                                                   ▼
        ctx.db  =  createTenantClient()
                 =  withWorkerTypeDefault( withSoftDelete( withTenantScope( basePrisma ) ) )
                                  │              │                  │
   read on Contractor/Worker ────┤              │                  └─ inject organizationId  (tenant)
   inject workerType='CONTRACTOR'│              └─ inject deletedAt: null                     (soft-delete)
   ONLY when where.workerType     │
   absent (explicit-where-wins)   ▼
                          ┌──────────────────────────────────────────────┐
                          │ Postgres (per region EU / ME / US)            │
                          │   Worker (id, organizationId, workerType…)    │◄── one-time backfill (idempotent)
                          │   Contractor (id stable, workerId @unique FK) │      one Worker per contractor
                          │   Employee  (P90 skeleton)                    │
                          └──────────────────────────────────────────────┘
                                  ▲
   ⚠ $queryRaw bypass ───────────┘  dashboard.ts / search.ts / contractor-shared.ts ×2
       extension does NOT touch raw SQL → MUST add  AND "workerType" = 'CONTRACTOR'  inline
```

### Recommended Project Structure

```
packages/db/
├── prisma/schema/
│   ├── contractor.prisma           # + Contractor.workerId @unique + worker relation
│   └── worker.prisma  (NEW)        # Worker base model + WorkerType enum + Employee skeleton
│   └── migrations/
│       ├── XXXX_worker_base_additive/        # Worker table + nullable Contractor.workerId
│       └── XXXX_worker_id_required/          # (after backfill verified) NOT NULL enforce
├── src/
│   ├── worker-type.ts (NEW)        # withWorkerTypeDefault extension
│   └── index.ts                    # createTenantClient: add the third $extends link
└── scripts/
    └── backfill-worker.ts (NEW)    # planWorkerBackfill (pure) + $transaction apply + --dry-run

packages/api/src/
├── routers/core/
│   ├── worker.ts (NEW)             # shared workerRouter (cross-type)
│   ├── employee.ts (NEW)           # skeleton employeeRouter
│   └── contractor.ts               # UNCHANGED shape (snapshot-locked)
├── middleware/
│   └── require-workforce-flag.ts (NEW)   # mirror require-us-expansion-flag.ts
├── root.ts                         # conditionalWorkforceRouters spread
└── __tests__/
    ├── contractor-contract-snapshot.test.ts (NEW, Wave-0 RED)
    └── worker-regression.test.ts (NEW, Wave-0)

packages/auth/src/
├── permissions.ts                  # + employee resource in accessControlStatement
└── roles.ts                        # + 4 roles; existing roles + owner allPermissions UNCHANGED

apps/web-vite/src/components/...    # useFlag('module.workforce-employees') render removal of /employee/*
```

### Pattern 1: `withWorkerTypeDefault` query extension (explicit-where-wins)

**What:** A third Prisma `$extends({ query: ... })` link injecting `workerType: 'CONTRACTOR'` into reads on the worker-base / contractor surface, only when the caller has not already specified `workerType`.
**When to use:** Wrapped around the base client in `createTenantClient`, ordered AFTER `withTenantScope` and `withSoftDelete`.

The existing soft-delete extension uses the `$allModels` + per-operation-method shape and injects a scalar (`deletedAt: null`) into the `where` of every read op including `findUnique` `[VERIFIED: packages/db/src/soft-delete.ts:117-180]`. The worker-type extension follows the same shape but adds the explicit-where-wins guard (which soft-delete does NOT have — soft-delete always injects).

```typescript
// Source: in-tree pattern derived from packages/db/src/soft-delete.ts (VERIFIED)
//         + Prisma query-extension API (CITED: prisma.io/docs/.../client-extensions/query)
//
// Models the default applies to. The worker-base read surface is the entry point;
// if Contractor reads route through the relation they still hit Contractor's where.
const WORKER_TYPE_DEFAULTED_MODELS = new Set(['Worker', 'Contractor']);
const WORKER_TYPE_READ_OPS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy',
]);

function injectWorkerTypeDefault(args: unknown): unknown {
  if (args == null || typeof args !== 'object') return args;
  const argsObj = args as Record<string, unknown>;
  const where = (argsObj.where ?? {}) as Record<string, unknown>;
  // EXPLICIT-WHERE-WINS (D-05): only inject when workerType is absent. A
  // workerRouter (cross-type) or employeeRouter ('EMPLOYEE') query passes its
  // own workerType and is left untouched.
  if ('workerType' in where) return argsObj;
  argsObj.where = { ...where, workerType: 'CONTRACTOR' };
  return argsObj;
}

export function withWorkerTypeDefault<T extends PrismaExtensible>(prisma: T) {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || !WORKER_TYPE_DEFAULTED_MODELS.has(model)) return query(args);
        if (!WORKER_TYPE_READ_OPS.has(operation)) return query(args);
        return query(injectWorkerTypeDefault(args));
      },
    },
  });
}
```

```typescript
// packages/db/src/index.ts — add the third link (ORDER MATTERS)
export function createTenantClient() {
  return withWorkerTypeDefault(withSoftDelete(withTenantScope(basePrisma)));
}
```

**Note on `Contractor` in the model set:** `Contractor` is a separate table from `Worker`. If `workerType` lives on `Worker` (D-01: discriminator on the base table), then a *direct* `Contractor` read has no `workerType` column to filter — the default would throw `PrismaClientValidationError`. Two valid designs the planner must choose between (Claude's-discretion column placement):
- **(A) discriminator only on `Worker`:** the extension targets only `Worker` reads; `Contractor.*` reads are inherently contractor-only (a Contractor row IS a contractor) and need NO injection. This is the cleaner model and likely what D-01 implies. The "67 contractor query sites" then become a *regression-test* concern (they must still return the same rows) rather than an injection concern — and the extension's real job is guarding cross-type reads on `Worker`.
- **(B) denormalized `workerType` mirror on `Contractor`:** if a `Contractor.workerType` column is added for query ergonomics, the extension can target `Contractor` directly. Adds a denormalization-sync burden; not recommended unless a concrete read needs it.

**Execution-time re-verify (HIGH-value):** confirm in a scratch test whether Prisma 7 accepts `findUnique({ where: { id, workerType: 'CONTRACTOR' } })` on a model where `workerType` is non-unique. The reference docs say "when you filter for a single record based on a unique field, you can check additional non-unique and unique fields at the same time" `[CITED: prisma.io/docs/.../prisma-client-reference]` — which matches how soft-delete already injects `deletedAt` into findUnique in-tree and works. But older Prisma rejected this `[CITED: github.com/prisma/prisma issues 7290 / 10376]`. If design (A) is chosen this is moot (no Contractor-by-id + workerType injection happens). If design (B), verify before relying on it; the conservative fallback is converting `findUnique`→`findFirst` inside the extension (the `prisma-extension-soft-delete` approach `[CITED: github.com/olivierwilkinson/prisma-extension-soft-delete]`).

### Pattern 2: Additive → backfill → enforce migration (idempotent + reversible + per-region)

**What:** Three ordered steps so no contractor row is ever destroyed or lossily relinked.
**When to use:** This is the D-02 backfill.

```
Step 1 (migration A, additive — fully reversible):
  CREATE TABLE "Worker" (id, organizationId, workerType DEFAULT 'CONTRACTOR', name, email, status, createdAt, updatedAt, deletedAt);
  ALTER TABLE "Contractor" ADD COLUMN "workerId" TEXT;          -- nullable initially
  CREATE UNIQUE INDEX "Contractor_workerId_key" ON "Contractor"("workerId");
  -- down: DROP the column + table

Step 2 (backfill script, idempotent, per region):
  -- re-runnable guard: only contractors with no Worker yet
  SELECT ... FROM "Contractor" WHERE "workerId" IS NULL;
  for each: INSERT Worker (copy organizationId + shared identity), SET Contractor.workerId = newWorker.id
  -- one $transaction (or batched transactions for the largest org); writeAuditLog system-actor row (D-13)
  -- dry-run flag prints plan with zero writes (mirror backfill-free-zone-assignment.ts --dry-run)

Step 3 (migration B, AFTER backfill verified on staging snapshot):
  ALTER TABLE "Contractor" ALTER COLUMN "workerId" SET NOT NULL;
  ALTER TABLE "Contractor" ADD CONSTRAINT fk_worker FOREIGN KEY ("workerId") REFERENCES "Worker"(id);
  -- down: drop NOT NULL + FK
```

**Run per region** (the proven shape):
```bash
# schema migrations across all configured regions (fails fast):
cd packages/db && pnpm run db:migrate:all            # → migrate-all-regions.ts, iterates DATABASE_URL_{EU,ME,US}

# backfill, once per region (VERIFIED pattern from backfill-free-zone-assignment.ts):
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-worker.ts --dry-run
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-worker.ts
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-worker.ts
DATABASE_URL=$DATABASE_URL_US tsx packages/db/scripts/backfill-worker.ts   # no-op if DATABASE_URL_US unset
```

The backfill script structure mirrors `backfill-free-zone-assignment.ts` exactly `[VERIFIED]`: a pure exported `planWorkerBackfill(contractors)` transform (unit-testable without Prisma), a `--dry-run` path, `createPrismaClientForUrl(dbUrl)` (NOT the legacy `@prisma/client` default entry), a single `$transaction` of `create`s, `pino` logging with masked DB URL, and `prisma.$disconnect()` in `finally`. **Batch** the largest-org case (the free-zone backfill did a single transaction; a 50k-contractor org needs chunked transactions to avoid lock/timeout — Claude's-discretion).

**Reversibility:** because every step is additive (new table, nullable column, then NOT-NULL), the down path is mechanical (drop FK → drop NOT NULL → optionally null out workerId → drop column/table). The `Contractor` rows are never touched destructively, so a rollback restores the exact pre-migration contractor state. The `Worker` rows are orphaned-then-dropped.

### Pattern 3: tRPC contract snapshot (Wave-0 RED, before the split)

**What:** Lock the existing `contractor.*` procedure names + input/output shapes so the split is provably non-breaking.
**When to use:** Wave 0, before touching `root.ts` or the router composition.

```typescript
// Source: tRPC v11 _def.procedures is a flat Record<string, AnyProcedure>
//         keyed by dotted path (CITED: github.com/trpc/trpc discussions/5521)
import { appRouter } from '../root';

it('contractor.* procedure surface is frozen', () => {
  const names = Object.keys(appRouter._def.procedures)
    .filter((p) => p.startsWith('contractor.'))
    .sort();
  expect(names).toMatchSnapshot();   // RED before split is taken; locks names
});

// Optional, fuller contract — input/output shapes (Claude's-discretion format):
it('contractor.* input/output shapes are frozen', () => {
  const shapes: Record<string, unknown> = {};
  for (const [path, proc] of Object.entries(appRouter._def.procedures)) {
    if (!path.startsWith('contractor.')) continue;
    // proc._def carries inputs / output zod schemas; serialize via zod v4
    // z.toJSONSchema (verify availability) or zod-to-json-schema.
    shapes[path] = serializeProcShape(proc);
  }
  expect(shapes).toMatchSnapshot();
});
```

The snapshot is written from the *current* router (so it is GREEN at capture), then the split must keep it GREEN. Frame it as "RED if drift" — any rename, removed procedure, or input/output change fails CI. `appRouter._def.procedures` keys are the full dotted path (`contractor.list`, `contractor.create`, …) in v11.

### Pattern 4: Flag-off — conditional-spread + per-request guard + render removal

**What:** Three-layer dark-ship, the exact `module.us-expansion` mirror.
**When to use:** WORKER-05.

```typescript
// root.ts (mirror conditionalUsExpansionRouters, VERIFIED: root.ts:151-163,227-228)
const workforceRouters = {
  worker: workerRouter,
  employee: employeeRouter,   // skeleton
} as const;
const conditionalWorkforceRouters = isWorkforceRegistered()
  ? workforceRouters
  : ({} as typeof workforceRouters);
// ... appRouter: { ..., ...conditionalWorkforceRouters }
```

```typescript
// middleware/require-workforce-flag.ts (mirror require-us-expansion-flag.ts, VERIFIED)
export function assertWorkforceEnabled(organizationId: string, region: string): void {
  const evalRegion = region === 'ME' ? 'ME' as const : 'EU' as const;
  const result = evaluate('module.workforce-employees', { organizationId, region: evalRegion });
  if (!result.enabled) {
    throw new TRPCError({ code: 'FORBIDDEN', message: WORKFORCE_DISABLED, cause: { flag: 'module.workforce-employees', reason: result.reason } });
  }
}
export function isWorkforceRegistered(): boolean {
  const base = evaluate('module.workforce-employees', { organizationId: 'ROOT', region: 'EU' });
  return base.enabled || Boolean(process.env.QA_DEFAULT_ORG_ID);
}
```

`contractor.*` is NOT flag-gated (it is the existing always-on surface). Only `worker.*` + `employee.*` go behind the flag. The `contractor` mount stays exactly as-is in `root.ts` (D-06).

web-vite: `useFlag('module.workforce-employees')` removes `/employee/*` from the render tree (mirror `useFlag('module.classification-engine')` in `dashboard-home.tsx` `[VERIFIED: dashboard-home.tsx:83]`). Add a new error message `WORKFORCE_DISABLED` to the i18n errors with en/en-US/de/pl/ar parity (D-14).

### Anti-Patterns to Avoid

- **Re-keying `Contractor.id` to `Worker.id`:** lossily relinks 20+ existing FKs. Use a sidecar `workerId`.
- **Trusting the extension to cover `$queryRaw`:** it does NOT (`model: undefined` for raw queries `[CITED: prisma.io/docs/.../client-extensions/query]`). The 4 raw sites need inline predicates.
- **Enforcing `workerId NOT NULL` in the same migration that creates it:** breaks before backfill. Split into migration A (nullable) → backfill → migration B (enforce).
- **Single mega-transaction backfill on the largest org:** lock/timeout risk. Batch.
- **Adding `workerType` to a `findUnique` where on a non-unique column without verifying Prisma 7 accepts it:** verify or convert to `findFirst`.
- **Putting `Worker` in `globalModels`:** it is tenant-owning (`organizationId`) — it MUST stay out of `globalModels` so `withTenantScope` injects org scope (D-09).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Default `workerType` filter across all reads | A `where.workerType='CONTRACTOR'` added by hand in every router | `withWorkerTypeDefault` extension | The `withSoftDelete`/`withTenantScope` precedent — can't-forget; one place; testable; D-04 |
| Per-region migration deploy | A bash loop over DB URLs | `migrate-all-regions.ts` (`pnpm db:migrate:all`) | Already fails-fast on first region error `[VERIFIED]` |
| Backfill script scaffolding | New logging/connection/dry-run plumbing | Copy `backfill-free-zone-assignment.ts` structure | Proven: pure transform + `$transaction` + `--dry-run` + masked-URL pino |
| Contractor route-shape diffing | A hand-maintained list of procedure names | `appRouter._def.procedures` + Vitest `toMatchSnapshot` | v11 gives a flat keyed record `[CITED]`; snapshot diffs automatically |
| Flag-off plumbing | New flag eval / guard from scratch | Mirror `require-us-expansion-flag.ts` + `conditionalUsExpansionRouters` | Exact, recent, in-tree precedent `[VERIFIED]` |
| RBAC resource/role wiring | New permission framework | `ac.newRole(...)` + extend `accessControlStatement` | Better-Auth access-control already drives all 9 roles `[VERIFIED]` |

**Key insight:** Every leg of this phase has a *recent, verified, in-tree* precedent (soft-delete extension, free-zone backfill, us-expansion flag-off, tenant-isolation test). The risk is not "how to build it" but "ordering + the raw-SQL coverage gap + verifying on real data."

## Runtime State Inventory

> This is a schema/data migration phase, not a string-rename. The runtime-state risk is the backfill's effect on live data and the filter-coverage gap, not OS-registered strings.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Every existing v1–v6 `Contractor` row across EU/ME/US Postgres needs one linked `Worker` row. No string is being renamed; a new FK is being populated. | Data migration (backfill) — idempotent (`WHERE workerId IS NULL`), per-region, audit-logged (D-13) |
| Live service config | None — no n8n/Datadog/Tailscale/Cloudflare config embeds `workerType` or `Worker`. The `module.workforce-employees` flag lives in Unleash UI but is already registered PENDING (P82) and stays PENDING. | None |
| OS-registered state | None — no Task Scheduler / pm2 / launchd / systemd unit references a contractor/worker string. The backfill is a manually-invoked `tsx` script at the `[BLOCKING]` human gate, not a registered job. | None |
| Secrets/env vars | `DATABASE_URL_{EU,ME,US}` already exist and route the backfill per region `[VERIFIED: region.ts, .env wiring]`. No new secret. | None |
| Build artifacts / installed packages | `packages/db/src/generated/prisma/client/**` is regenerated by `prisma generate` after the schema change. Stale generated client until regenerated. The `prisma-client` generator output (modern) — `db:generate` must run; `db:check-drift` guards it `[VERIFIED: package.json scripts]`. | `pnpm --filter @contractor-ops/db db:generate`; CI `db:check-drift` |

**The canonical question — after every file + schema is updated, what runtime state still has the old shape?** Answer: the *live contractor rows* until the backfill runs and links them, and the *4 raw-SQL sites* until hand-edited. Both are explicit tasks. Nothing else (no OS/secret/service state) is affected.

## Common Pitfalls

### Pitfall 1: `$queryRaw` sites silently include Employee rows after backfill
**What goes wrong:** The `withWorkerTypeDefault` extension covers Prisma-client reads but NOT raw SQL. Four confirmed sites hit `FROM "Contractor"` directly — and once Employees exist (P90), or even now if a Worker-base join is introduced, these can leak cross-type rows or miscount.
**Why it happens:** Prisma query extensions receive `model: undefined` for `$queryRaw`/`$executeRaw` and never intercept them `[CITED: prisma.io/docs/.../client-extensions/query: "model argument passed to the callback will be undefined" for raw queries]`.
**Confirmed sites `[VERIFIED: grep]`:**
- `packages/api/src/routers/core/dashboard.ts:72-80` — `fetchKpis` activeContractors COUNT (already comments "bypass the soft-delete + tenant scope extensions, so all predicates are spelled out explicitly")
- `packages/api/src/routers/core/search.ts:73-80` — global command-palette contractor tsvector search
- `packages/api/src/routers/core/contractor-shared.ts:304-312` — `billingModel` JSONB facet id-set
- `packages/api/src/routers/core/contractor-shared.ts:323-331` — FTS `search` facet id-set
**How to avoid:** In design (A) (discriminator only on `Worker`), these `FROM "Contractor"` sites are inherently contractor-only and need NO change — but add a regression test asserting their counts/results match the pre-migration baseline. If the schema denormalizes `workerType` onto `Contractor` (design B), add `AND "workerType" = 'CONTRACTOR'` to each. **Either way:** add a grep/lint guard (`packages/db/scripts/check-*` style) flagging any new `FROM "Contractor"` raw SQL so future raw reads are reviewed.
**Warning signs:** dashboard contractor count changes after P90 employees land; search returns employees.

### Pitfall 2: `findUnique` rejects the injected `workerType`
**What goes wrong:** `findUnique({ where: { id, workerType } })` throws `PrismaClientValidationError` on older Prisma.
**Why it happens:** historically `findUnique` accepted only unique fields in `where` `[CITED: github.com/prisma/prisma issues 7290, 10376]`. Prisma 4.5+ relaxed this to allow additional non-unique filters alongside a unique field `[CITED: prisma.io/docs/.../prisma-client-reference]`, which is why the in-tree soft-delete extension injects `deletedAt: null` into `findUnique` and works `[VERIFIED: soft-delete.ts:124-136]`.
**How to avoid:** Prefer design (A) (no Contractor-by-id injection needed). If injecting on a model carrying `workerType`, write a scratch test confirming Prisma 7.8 accepts it (MEDIUM confidence it does, given soft-delete works). Conservative fallback: convert `findUnique`→`findFirst` / `findUniqueOrThrow`→`findFirstOrThrow` inside the extension.
**Warning signs:** validation errors on any `findUnique`/`findUniqueOrThrow` after the extension is added.

### Pitfall 3: Backfill not idempotent → duplicate Worker rows on re-run
**What goes wrong:** a re-run (after a partial failure, or a second region pass) creates a second `Worker` per contractor.
**Why it happens:** missing the `WHERE workerId IS NULL` guard.
**How to avoid:** the candidate query selects only `Contractor WHERE workerId IS NULL` (mirrors free-zone backfill's `freeZoneAssignment: { is: null }` guard `[VERIFIED]`). The `Contractor.workerId @unique` index makes a double-link a DB-enforced conflict.
**Warning signs:** more `Worker` rows than `Contractor` rows in a region.

### Pitfall 4: Migration ordering inverts → NOT NULL before data exists
**What goes wrong:** enforcing `workerId NOT NULL` (or the FK) in the same migration that adds the column fails because existing rows are null.
**How to avoid:** strict three-step ordering (Pattern 2). Migration B (enforce) runs only after the backfill is verified on the staging snapshot.

### Pitfall 5: `Worker` accidentally added to `globalModels`
**What goes wrong:** a tenant-owning model skips org scoping → cross-org leak.
**How to avoid:** `Worker` has `organizationId` and is NOT in `globalModels` (D-09); add a cross-org leak test on `Worker` mirroring `tenant-isolation.test.ts` `[VERIFIED]`.

### Pitfall 6: Snapshot captured AFTER the split (locks the wrong shape)
**What goes wrong:** writing the contract snapshot after refactoring locks the new shape, defeating the regression check.
**How to avoid:** Wave-0 ordering — snapshot first (D-07), against the current `contractorRouter`, then split.

## Code Examples

### Worker schema (design A — discriminator on the base table)
```prisma
// Source: derived from contractor.prisma conventions (VERIFIED) + D-01
enum WorkerType {
  CONTRACTOR
  EMPLOYEE
}

model Worker {
  id             String     @id @default(cuid())
  organizationId String
  workerType     WorkerType @default(CONTRACTOR)
  // shared identity (Claude's-discretion exact columns):
  displayName    String
  email          String?
  status         String?    // or a shared enum
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  deletedAt      DateTime?

  organization Organization @relation(fields: [organizationId], references: [id])
  contractor   Contractor?  // 1:1 back-relation
  // employee  Employee?     // P90 skeleton

  @@index([organizationId])
  @@index([organizationId, workerType])
}

// contractor.prisma — ADD (id stays the stable PK; new sidecar FK):
//   workerId String? @unique          // nullable in migration A, NOT NULL in migration B
//   worker   Worker? @relation(fields: [workerId], references: [id])
```

### Backfill plan transform (pure, unit-testable — mirrors free-zone)
```typescript
// Source: structure VERIFIED from backfill-free-zone-assignment.ts
export interface ContractorForWorker {
  id: string; organizationId: string; displayName: string; email: string | null; workerId: string | null;
}
export interface WorkerInsert { organizationId: string; displayName: string; email: string | null; }
/** Idempotent: only contractors without a worker link. Never mutates source. */
export function planWorkerBackfill(rows: readonly ContractorForWorker[]): Array<{ contractorId: string; worker: WorkerInsert }> {
  const out: Array<{ contractorId: string; worker: WorkerInsert }> = [];
  for (const c of rows) {
    if (c.workerId) continue; // already linked — idempotency guard
    out.push({ contractorId: c.id, worker: { organizationId: c.organizationId, displayName: c.displayName, email: c.email } });
  }
  return out;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma middleware (`$use`) for soft-delete/tenant defaults | Prisma client `$extends({ query })` extensions | Prisma 4.16+ (middleware deprecated) | This repo is already on extensions `[VERIFIED]` — no migration needed |
| `findUnique` where = unique fields only | `findUnique` where accepts non-unique filters alongside a unique field | Prisma ~4.5 | Lets the extension inject scalars into findUnique (verify on 7.8) |
| tRPC v10 `_def.procedures` typing quirks | v11 flat `Record<string, AnyProcedure>` | tRPC v11 | Clean `Object.keys` introspection for the snapshot |
| zod v3 + `zod-to-json-schema` | zod v4 native `z.toJSONSchema()` | zod v4 | Avoid a new dep for the shape snapshot (verify export in `^4.4.3`) |

**Deprecated/outdated:**
- Prisma `$use` middleware — do not use; this repo uses `$extends` `[VERIFIED]`.
- Re-keying a PK to merge tables — anti-pattern here; sidecar FK preferred.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | zod `^4.4.3` exports a native `z.toJSONSchema()` usable for procedure-shape snapshots | Supporting stack / Pattern 3 | Falls back to adding `zod-to-json-schema` (gated install) or snapshotting names-only |
| A2 | Prisma 7.8 accepts a non-unique `workerType` filter in `findUnique.where` alongside the unique `id` (matching how soft-delete injects `deletedAt`) | Pattern 1 / Pitfall 2 | Convert `findUnique`→`findFirst` in the extension; verify in a scratch test before relying on it |
| A3 | Design (A) — discriminator on `Worker` only, no `workerType` mirror on `Contractor` — is what D-01 intends | Pattern 1 | If a denormalized `Contractor.workerType` is preferred (design B), the extension targets `Contractor` too and the raw-SQL sites need inline predicates; the planner picks |
| A4 | The "67 files / ~252 reads" figure in CONTEXT counts test files + child-model reads; the *non-test, Contractor-only* read surface is ~84 occurrences across 47 files, + 4 raw-SQL sites | § Common Pitfalls / count below | If the real injection surface is larger, more regression cases needed — the grep guard + full-suite gate catch drift |
| A5 | Prisma query extensions do NOT intercept nested-relation reads (e.g. `org.findFirst({ include: { contractors: true } })` does not run the Contractor-level injection) | Pattern 1 / Open Questions | Cross-type leak via relation include; verify at execution time and prefer design (A) where Worker-level scoping covers it |

**Empty?** No — five assumptions flagged; A2 and A5 are the execution-time re-verify items the orchestrator should surface to discuss-phase if the planner picks design B.

## Open Questions

1. **Discriminator placement (design A vs B).**
   - What we know: D-01 says `workerType` is the discriminator on the base table; `Contractor` links via FK.
   - What's unclear: whether to also denormalize `workerType` onto `Contractor` for query ergonomics.
   - Recommendation: design (A) — discriminator on `Worker` only. The extension scopes `Worker` reads; `Contractor` reads are inherently contractor-only; the raw-SQL sites need NO predicate change (only a regression assertion). Simplest, no sync burden. Planner confirms.
2. **Nested-relation read interception (A5).**
   - What we know: query extensions fire per top-level operation+model.
   - What's unclear: whether a `Worker`-level injection covers `Contractor` reached through an `include`/`select` on another model.
   - Recommendation: verify at execution time with a scratch query; design (A) (Worker-level scoping) is more robust here.
3. **Backfill batching for the largest org.**
   - What we know: free-zone backfill used a single `$transaction`.
   - What's unclear: row count of the largest org (the staging snapshot will reveal it).
   - Recommendation: chunk the `create` batch (e.g. 1k/transaction) for the largest-org pass; measure on the snapshot.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (EU) | backfill + migrations | ✓ (DATABASE_URL_EU) | 17 | — |
| PostgreSQL (ME) | backfill + migrations | ✓ (DATABASE_URL_ME) | 17 | — |
| PostgreSQL (US) | backfill + migrations | optional (DATABASE_URL_US may be unset locally) | 17 | `migrate-all-regions` / region.ts skip-on-missing `[VERIFIED]` |
| `prisma` CLI (workspace-pinned) | migrate deploy + generate | ✓ | 7.8.0 | — |
| `tsx` | run backfill script | ✓ | 4.21 | — |
| Staging snapshot of largest org | D-03 parity gate | ✗ (operational, must be provisioned) | — | **No fallback — this is the gate's pass condition; planner must include a "provision largest-org staging snapshot" prerequisite task at the `[BLOCKING]` human gate** |
| Unleash (workforce flag) | flag-off | ✓ flag already PENDING (P82) | — | — |

**Missing dependencies with no fallback:** the largest-org staging snapshot (a `[BLOCKING]` operational prerequisite, not a code dependency).
**Missing dependencies with fallback:** `DATABASE_URL_US` may be unset locally — region tooling skips it.

## Validation Architecture

> `workflow.nyquist_validation: true` `[VERIFIED: .planning/config.json]` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via Turborepo) `[VERIFIED: package.json "test": "turbo test"; packages/api/vitest.config.ts]` |
| Config file | `packages/api/vitest.config.ts`, `packages/db/vitest.config.ts`, root `vitest.monorepo` |
| Quick run command | `pnpm --filter @contractor-ops/api test <path>` / `pnpm --filter @contractor-ops/db test <path>` |
| Full suite command | `pnpm test` (turbo → vitest). **NEVER** run an unscoped `web-vite` suite (kills RAM — MEMORY). |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORKER-02 | `contractor.*` procedure names + shapes frozen | contract/snapshot | `pnpm --filter @contractor-ops/api test contractor-contract-snapshot` | ❌ Wave 0 |
| WORKER-01 | `planWorkerBackfill` idempotent (no dup on re-run; skips linked) | unit | `pnpm --filter @contractor-ops/db test backfill-worker` | ❌ Wave 0 |
| WORKER-01/02 | contractor list/dashboard/payment-run/classification-scan/export/portal return same rows post-migration | regression | `pnpm --filter @contractor-ops/api test worker-regression` | ❌ Wave 0 |
| WORKER-02 | `withWorkerTypeDefault` injects on Worker reads, respects explicit `workerType` (explicit-where-wins), covers findMany/findFirst/findUnique/count/aggregate/groupBy | unit | `pnpm --filter @contractor-ops/db test worker-type` | ❌ Wave 0 |
| WORKER-02 | the 4 raw-SQL sites return contractor-only counts/results (no cross-type) | regression | `pnpm --filter @contractor-ops/api test worker-regression` | ❌ Wave 0 |
| WORKER-03/09 | `Worker` is org-scoped; cross-org read returns no foreign rows | isolation | `pnpm --filter @contractor-ops/api test worker-tenant-isolation` | ❌ Wave 0 (clone `tenant-isolation.test.ts`) |
| WORKER-04 | 4 new roles exist; existing 9 roles' permission sets unchanged; `employee` resource present | unit | `pnpm --filter @contractor-ops/auth test roles` | ❌ Wave 0 (check existing auth tests) |
| WORKER-05 | flag-off → `worker`/`employee` absent (METHOD_NOT_FOUND) + guard FORBIDDEN; flag-on → present | integration | `pnpm --filter @contractor-ops/api test workforce-flag` | ❌ Wave 0 (mirror us-expansion flag test) |

### Sampling Rate
- **Per task commit:** the scoped quick-run for the package touched.
- **Per wave merge:** `pnpm --filter @contractor-ops/{db,api,auth} test` (the three affected packages).
- **Phase gate:** full `pnpm test` green + the **operational staging-snapshot parity** verified (D-03) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/api/src/__tests__/contractor-contract-snapshot.test.ts` — covers WORKER-02 (capture BEFORE split)
- [ ] `packages/db/src/__tests__/backfill-worker.test.ts` — covers WORKER-01 (idempotency on pure transform)
- [ ] `packages/db/src/__tests__/worker-type.test.ts` — covers WORKER-02 (extension; all read ops + explicit-where-wins)
- [ ] `packages/api/src/__tests__/worker-regression.test.ts` — covers WORKER-01/02 (contractor read-path parity incl. raw-SQL sites)
- [ ] `packages/api/src/__tests__/worker-tenant-isolation.test.ts` — covers WORKER-03/09 (clone `tenant-isolation.test.ts`)
- [ ] `packages/api/src/__tests__/workforce-flag.test.ts` — covers WORKER-05 (mirror us-expansion flag test)
- [ ] Auth role test extension — covers WORKER-04 (confirm framework; likely existing `permissions`/`roles` test to extend)
- [ ] **Operational (not a unit test):** documented largest-org staging-snapshot parity procedure (D-03) — a verify checklist, not automatable in CI

## Security Domain

> `security_enforcement` absent in config → treated as enabled. Section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change this phase |
| V3 Session Management | no | Tenant context from session (existing `tenantStore`) unchanged |
| V4 Access Control | **yes** | New `employee` resource + 4 roles via Better-Auth `ac.newRole` (D-08); per-type RBAC for HR-only fields; `requirePermission` middleware. Tenant scope on `Worker` via `withTenantScope` (D-09) — cross-org leak test mandatory |
| V5 Input Validation | **yes** | Zod on every new `worker`/`employee` procedure (tRPC convention); `.strict()` to block mass-assignment of `organizationId`/`workerType` (INTEG-API-01 already flags `workerType` as a mass-assignment target) |
| V6 Cryptography | no | No new crypto; backfill copies existing fields (SSN stays in its dedicated encrypted columns, never moved to `Worker`) |

### Known Threat Patterns for {Prisma multi-tenant + RBAC}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org read of `Worker` rows | Information disclosure | `Worker` tenant-owning, NOT in `globalModels`; `withTenantScope` injects `organizationId`; cross-org leak test (D-09/D-11) |
| Cross-type leak (contractor read returns employee) | Information disclosure | `withWorkerTypeDefault` default + regression suite + the 4 raw-SQL sites handled; grep guard on new raw `FROM "Contractor"` |
| Mass-assignment of `workerType`/`organizationId` via worker/employee create | Tampering / EoP | `.strict()` Zod DTOs; never accept `organizationId` from client (session-derived); `workerType` set server-side |
| Flag-bypass to reach dark employee surface | EoP | Three-layer flag-off: absent-at-runtime + per-request guard (FORBIDDEN) + render removal (WORKER-05) |
| Backfill corrupts/loses contractor data | Tampering / DoS to business | Additive-only steps, idempotent (`WHERE workerId IS NULL`), reversible down path, dry-run, staging-snapshot parity gate, system-actor audit row (D-13) |
| BFLA — HR role reaches non-HR contractor mutations | EoP | Per-type RBAC; the 4 new roles grant only `employee` (+ minimal read) actions, NOT contractor mutations; assert existing roles' grants are unchanged |

## The 67 Contractor Query Sites — measured

CONTEXT cites "67 files / ~252 reads." Measured in-tree (excluding `__tests__`/`*.test.ts` and child models like `contractorBillingProfile`/`contractorContact`):

| Read kind | Non-test occurrences | Covered by extension? |
|-----------|----------------------|------------------------|
| findMany | 25 | ✓ |
| findFirst | 24 | ✓ |
| findUnique | 14 | ✓ (verify Prisma 7 accepts injected scalar — Pitfall 2) |
| findUniqueOrThrow | 4 | ✓ (same caveat) |
| findFirstOrThrow | 3 | ✓ |
| count | 11 | ✓ |
| aggregate | 0 | ✓ (extension handles it; none currently) |
| groupBy | 3 | ✓ |
| **`$queryRaw FROM "Contractor"`** | **4** | **✗ — NOT covered; hand-edit or regression-assert (Pitfall 1)** |

~84 Prisma-client reads across 47 files (the CONTEXT "67/252" likely includes tests + child-model reads). The **4 raw sites** are the load-bearing gap. None of the Prisma-client reads were found to legitimately need cross-type today (no current `workerType` usage exists — the column is new), so the default is safe; cross-type reads arrive only with `workerRouter`/`employeeRouter` which pass explicit `workerType`.

## Project Constraints (from CLAUDE.md)

- **pnpm + Turborepo only;** `packages/*` change → check `apps/*` + filtered typecheck (`pnpm typecheck --filter=@contractor-ops/api`).
- **Prisma 7 `prisma-client` generator** (not legacy `@prisma/client` default entry); regional `DATABASE_URL_*`; `prisma migrate` SQL files under `prisma/schema/migrations`.
- **tRPC v11;** Zod on every procedure; webhooks/cron `safeParse`; no unsafe `as` on external payloads.
- **No `console.*`** — `@contractor-ops/logger` / raw `pino` with `getBaseLoggerOptions` (backfill scripts).
- **Flags via `@contractor-ops/feature-flags` only** (`evaluate`/`useFlag`/`buildFlagBag`); do NOT re-register `module.workforce-employees`.
- **Tenant from session;** `writeAuditLog` on sensitive mutations + the backfill (D-13); pass `tx` in transactions.
- **7-day release-age** on any dep; this phase adds none (preferred).
- **No breadcrumb IDs in source comments** (`Phase 89`, `WORKER-01`, `D-04`) — keep WHY, drop the ID; traceability → commits + `.planning/`. Enforced by `pnpm lint:no-breadcrumbs`.
- **semble before grep;** **Read before Edit;** Edit > Write; no `sed`/bulk-replace scripts.
- **Documentation-follows-code (GATED):** same change set must update `wiki/structure/{prisma-schema-areas,api-routers-catalog,key-services}.md`, a `wiki/domains/` worker-foundation page, `wiki/patterns/` (worker-type extension + per-type RBAC + flag-off), `wiki/log.md` + `hot.md`, `.planning/MEMORY.md` (the two new invariants), and the graphify graph; run `pnpm check:wiki-brain` before done.
- **UI touches** (`/employee/*` flag-gated skeleton, web-vite): `frontend-design` + `semble` + WCAG loading/empty/error states; i18n parity en/en-US/de/pl/ar (D-14).

## Sources

### Primary (HIGH confidence — read in-tree this session)
- `packages/db/src/index.ts` — `createTenantClient = withSoftDelete(withTenantScope(base))`; the chain to extend
- `packages/db/src/tenant.ts` — `$allOperations` shape, `globalModels` set, `READ_OPERATIONS`
- `packages/db/src/soft-delete.ts` — `$allModels` per-op injection incl. `findUnique` `deletedAt` injection (precedent for Pitfall 2)
- `packages/db/scripts/backfill-free-zone-assignment.ts` — backfill script structure (pure transform + `$transaction` + `--dry-run` + idempotency guard)
- `packages/db/scripts/migrate-all-regions.ts` — per-region `prisma migrate deploy`
- `packages/db/src/region.ts`, `prisma.config.ts`, `package.json` — region wiring, Prisma 7.8 pins, migrate-based workflow
- `packages/api/src/root.ts` — `conditionalUsExpansionRouters` / `conditionalClassificationRouters` spread
- `packages/api/src/middleware/require-us-expansion-flag.ts` — `assertUsExpansionEnabled` + `isUsExpansionRegistered`
- `packages/auth/src/{roles.ts,permissions.ts}` — `accessControlStatement` + `ac.newRole` (9 roles)
- `packages/feature-flags/src/flags-core.ts:220-228` — `module.workforce-employees` PENDING (P82, do not re-register)
- `packages/api/src/routers/core/{dashboard.ts,search.ts,contractor-shared.ts}` — the 4 raw-SQL bypass sites
- `packages/api/src/__tests__/tenant-isolation.test.ts` — cross-org leak test idiom
- grep counts of contractor reads by operation kind

### Secondary (MEDIUM — official docs)
- [Prisma Client query extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) — `$allOperations` signature; raw queries get `model: undefined`; mutate `args.where`
- [Prisma Client API reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference) — findUnique allows additional non-unique where fields alongside a unique field; aggregate/groupBy/count all accept `where`
- [tRPC discussion #5521](https://github.com/trpc/trpc/discussions/5521) — v11 `_def.procedures` is a flat `Record<string, AnyProcedure>`

### Tertiary (LOW — community, flagged for execution-time verify)
- [github.com/prisma/prisma #7290](https://github.com/prisma/prisma/issues/7290), [#10376](https://github.com/prisma/prisma/issues/10376) — historical findUnique unique-only constraint
- [prisma-extension-soft-delete](https://github.com/olivierwilkinson/prisma-extension-soft-delete) — findUnique→findFirst conservative fallback

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all in-tree, versions read from `package.json`, no new deps
- Architecture (extension chain, migration ordering, flag-off, router split): HIGH — each leg has a verified in-tree precedent
- Pitfalls: HIGH on the raw-SQL gap (grep-confirmed 4 sites) and ordering; MEDIUM on findUnique-where injection (A2) and nested-relation interception (A5) — both flagged for execution-time verify
- The 67→84+4 read count: MEDIUM — measured by grep; full-suite + regression gate catches any undercount

**Research date:** 2026-06-18
**Valid until:** ~2026-07-18 (stable in-tree patterns; Prisma 7.8 behavior verify-on-execution for A2/A5)

## RESEARCH COMPLETE

**Phase:** 89 - Theme B — Worker Model Abstraction (serial gate)
**Confidence:** HIGH (in-tree patterns) / MEDIUM (two Prisma behaviors flagged for execution-time verify)

### Key Findings
- All four legs (Prisma extension chain, additive→backfill→enforce migration, flag-off, RBAC) have recent, verified in-tree precedents (`withSoftDelete`/`withTenantScope`, `backfill-free-zone-assignment.ts` + `migrate-all-regions.ts`, `module.us-expansion` conditional-spread + guard, `ac.newRole`). The risk is ordering + the raw-SQL coverage gap, not "how to build it."
- **The load-bearing gap:** the `withWorkerTypeDefault` extension covers ~84 Prisma-client contractor reads but CANNOT see the **4 confirmed `$queryRaw FROM "Contractor"` sites** (`dashboard.ts`, `search.ts`, `contractor-shared.ts` ×2) — Prisma gives `model: undefined` for raw queries. These need inline predicates or a regression assertion + a grep guard.
- **Migration ordering is load-bearing:** create `Worker` + nullable `Contractor.workerId @unique` → idempotent backfill (`WHERE workerId IS NULL`) → enforce `NOT NULL`/FK only after staging-snapshot parity verified. Reversible because every step is additive; `Contractor.id` stays stable (no lossy re-keying of 20+ existing FKs).
- Recommend **design (A): discriminator on `Worker` only** — `Contractor` reads are inherently contractor-only, simplifying the extension to Worker-level scoping and avoiding a denormalization-sync burden.
- Two execution-time re-verify items: (A2) Prisma 7.8 accepting an injected `workerType` in `findUnique.where`; (A5) whether extensions intercept nested-relation reads. Conservative fallbacks documented.

### File Created
`.planning/phases/89-theme-b-worker-model-abstraction-serial-gate/89-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All in-tree; versions read from package.json; zero new deps |
| Architecture | HIGH | Every leg has a verified in-tree precedent |
| Pitfalls | HIGH / MEDIUM | Raw-SQL gap grep-confirmed; findUnique + nested-relation flagged for execution-time verify |

### Open Questions
- Discriminator placement (design A vs B) — recommend A; planner confirms.
- Nested-relation read interception (A5) — verify at execution time.
- Backfill batching for the largest org — measure on the staging snapshot.

### Ready for Planning
Research complete. Planner can create PLAN.md files. Wave 0 must capture the contractor contract snapshot + regression suite BEFORE any model change; the largest-org staging-snapshot parity is a `[BLOCKING]` operational prerequisite to accepting the backfill.
