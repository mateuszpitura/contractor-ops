# Phase 83: Theme A — US Region Infrastructure - Research

**Researched:** 2026-06-07
**Domain:** Multi-region DB routing + region-aware R2 storage + soft-delete/retention enforcement on a mature pnpm+Turbo monorepo (Prisma 7, tRPC v11, Better Auth, Fastify cron-worker)
**Confidence:** HIGH — every in-tree anchor was read directly this session. ONE load-bearing correction to a Phase 82 claim is documented below (the `DataRegion` Prisma enum was NEVER widened to US — Phase 82 only widened the TypeScript union; writing `dataRegion: 'US'` to Postgres throws today).

## Summary

Phase 83 is three surgical extensions of already-shipped primitives, plus ONE genuinely-missing migration that Phase 82 left behind. (1) US DB routing: Phase 82 widened the TypeScript `SUPPORTED_REGIONS`/`DataRegion` union to include `US`, but **the Prisma enum `DataRegion { EU, ME }` (`organization.prisma:350`) was NOT widened** — `Organization.dataRegion` is a Postgres enum column (`@default(EU)`), so persisting a US org fails today. This phase must add `US` to the Prisma enum (additive `ALTER TYPE`), widen the ~7 `as 'EU' | 'ME'` / `?? 'EU'` cast sites to the shared `DataRegion` type, and add the creation-time US assignment (a new Better Auth `organizationCreation.beforeCreate` hook — org-create no longer flows through a tRPC mutation). (2) US R2 bucket: widen `REGION_BUCKET_MAP` from `Record<'EU'|'ME'>` to `Record<DataRegion>`, add an OPTIONAL `R2_BUCKET_NAME_US` to the env schema + `.env.example`, mirroring the existing `DATABASE_URL_US` lazy pattern. (3) IRS retention: a light typed `record-type → years` map + resolver (new file), consumed by THREE deletion chokepoints — the `soft-delete.ts` extension, the `data-purge.ts` cron (today a flat `RETENTION_DAYS=90` hard-delete on the base, un-extended `prisma`), and `gdpr.ts` erasure (`deleteByOrgAndCount` hard-deletes ~40 models).

The retention guard's load-bearing finding: **`data-purge.ts` imports the BASE `prisma` (no soft-delete extension), so its `deleteMany({ deletedAt: { lt: cutoff } })` is a TRUE Postgres hard-delete** — this is the one path that can permanently destroy a retained record past 90 days, and it is the primary target of D-05. The other two paths (`soft-delete.ts` extension, `gdpr.ts` via `ctx.db`) run through the soft-delete-extended client, so a model added to `softDeleteModels` is auto-converted from hard-delete to soft-delete there — but D-05 wants an explicit retention-exemption WITH statutory citation, not a silent conversion. A whole-codebase grep confirms **no 4th hard-delete leak**: there are zero other `prisma.<softDeleteModel>.delete/deleteMany` base-client call sites and zero `prismaRaw` deletes.

**Primary recommendation:** (a) ADD `US` to the Prisma `DataRegion` enum via additive `ALTER TYPE` (db-push fallback — `migrate dev` is blocked by pre-existing drift, per Phase 82); (b) widen the 7 cast sites + `org-cache.OrgMeta.dataRegion` + `seed-dev` region union to `DataRegion`; (c) add a Better Auth `organizationCreation.beforeCreate` hook to set US at creation (D-01); (d) widen `REGION_BUCKET_MAP` to `Record<DataRegion>` + optional `R2_BUCKET_NAME_US`; (e) build one retention-policy module (`packages/db/src/retention-policy.ts`) and wire all THREE deletion chokepoints to consult it; (f) verify against the existing `Invoice` soft-delete fixture (D-06). Back each success criterion with scoped vitest extending the existing `region-lockstep`, `regional-storage`, `soft-delete`, `data-purge`, and `gdpr` test files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**US Region Assignment (US-INFRA-01)**
- **D-01:** `organization.dataRegion` is set **at org creation** (from a billing country/region selection) and is **IMMUTABLE** afterward — no cross-regional-DB migration path. `US` is for **new US-billing orgs only** (matches US-INFRA-01 "a NEW org with US billing"). The `us-cross-border` add-on (Phase 82) is **ORTHOGONAL**: it unlocks US tax features for an org but does NOT move data residency — an EU/ME org that buys it keeps its data in its home region.
- **D-02:** Cross-region read replicas remain **off by default** for US (US-INFRA-01) — do not wire `DATABASE_URL_US_RO` into an active replica path this phase (the `REPLICA_ENV_MAP['US']` slot from Phase 82 exists but stays inert until a US replica is provisioned).
- **(planner/research, not a user decision):** widen the scattered `(org.dataRegion ?? 'EU') as 'EU' | 'ME'` casts to the shared `DataRegion` type (`packages/db/src/region.ts`) at every site — tenant middleware, `org-cache.ts` (5-min meta cache), `oauth.ts`, `org-definition-sync.ts`, `seed-dev.ts` `pickRegion`, and `buildLazyBag` (already US-aware from Phase 82). Confirm whether `dataRegion` is a Prisma enum (→ additive `US` enum migration) or a plain string column.

**US Tax-Archive R2 Bucket (US-INFRA-02)**
- **D-03:** Extend `packages/api/src/services/regional-storage.ts` `REGION_BUCKET_MAP` with `US: env => env.R2_BUCKET_NAME_US`. `R2_BUCKET_NAME_US` is **OPTIONAL** in `packages/validators/src/env.ts` (+ `.env.example`) — resolved lazily by `getRegionalBucket`, which already throws on an unsupported region, so a missing US bucket only fails on actual US-org file access (mirrors the `DATABASE_URL_US` optional/lazy pattern from Phase 82). **One US regional bucket** holds all US-org files incl. tax archives — NOT a separate dedicated tax bucket.

**IRS Retention (US-INFRA-03)**
- **D-04:** Retention periods live in a **light, reusable retention-policy primitive** — a typed `record-type → retention-years` map + a resolver function (mirrors the tax-year threshold-config pattern; can graduate to a DB table later). Seed: **1099-NEC = 4 years**, **backup-withholding records = 7 years**. Built reusable so Theme B **AKTA-02** (per-jurisdiction personnel-file retention) extends the **same resolver**. Keep it LIGHT (map + resolver), not a framework.
- **D-05:** "No early hard-delete of a retained record" is guaranteed by a **centralized guard at the deletion chokepoints**, not a callable helper:
  1. Extend `packages/db/src/soft-delete.ts` so a retained record (model + within its policy window) cannot be hard-deleted.
  2. Make `apps/cron-worker/src/jobs/handlers/data-purge.ts` **retention-policy-aware** — it currently hard-deletes soft-deleted rows past a flat `RETENTION_DAYS=90`; retained models must consult the D-04 policy instead (non-retained models keep the 90-day sweep).
  3. `packages/api/src/routers/compliance/gdpr.ts` RODO erasure must **soft-delete-with-exemption** for retained tax records (flag with statutory citation rather than hard-delete via `deleteByOrgAndCount`) — prefigures Theme B **AKTA-03**'s statutory-retention-exemption layer.
  The scheduled archive/sweep stays in `apps/cron-worker`. Build the guard now; Phase 86 tax models opt in by registering their window in the D-04 policy and joining `softDeleteModels`.

**Sequencing**
- **D-06:** Phase 83 ships region routing + US bucket + retention **mechanism** only. The 1099/W-form tables (Phases 85–86) attach to it later. Do NOT create tax-form tables here; the retention guard/policy is verified against a representative model (or a test fixture model) until the real tables land.

### Claude's Discretion
- `dataRegion` representation (Prisma enum migration vs string) — planner's call per the current schema definition. **RESOLVED BY RESEARCH: it is a Prisma enum — additive `US` enum migration required (see Pitfall 1).**
- Retention-policy storage shape (typed const map vs DB table) — start as a typed const map; DB table only if a runtime-edit requirement appears.
- Where the create-org region selection surfaces in the UI — minimal; en-US copy is NOT required here (that's Phase 84).

### Deferred Ideas (OUT OF SCOPE)
- **EU/ME-org-serving-US-contractor tax-data residency** — legal/tax-adviser question; not resolved by D-01's creation-time model.
- **Admin region switch / cross-regional-DB move** — out of scope per D-01 (immutable region).
- **US read replica** (`DATABASE_URL_US_RO` active path) — off by default (D-02).
- **Retention policy as an editable DB table** — start as a typed const map (D-04).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| US-INFRA-01 | A new org with US billing is routed to `us-east-1` DB per the per-org region-routing pattern; cross-region read replicas stay off by default | Prisma `DataRegion` enum widen (`organization.prisma:350`); 7 cast sites widen to `DataRegion`; new Better Auth `organizationCreation.beforeCreate` hook (`packages/auth/src/config.ts:457`); `getRegionalClient('US')` already resolves (Phase 82, `region.ts:8`); `REPLICA_ENV_MAP['US']` already exists + stays inert (D-02) |
| US-INFRA-02 | US-specific R2 storage bucket for tax-form archives (data residency) | `REGION_BUCKET_MAP` widen `Record<'EU'\|'ME'>` → `Record<DataRegion>` (`regional-storage.ts:28`); `getRegionalBucket` throw-on-unsupported is the lazy gate (`:38`); optional `R2_BUCKET_NAME_US` in `env.ts:82-101` + `.env.example:131-134` |
| US-INFRA-03 | IRS retention via soft-delete + scheduled archive (4-yr 1099-NEC, 7-yr backup-withholding); no early hard-delete of a retained record | NEW `retention-policy.ts` (map + resolver, D-04); 3 chokepoints — `soft-delete.ts:24` `softDeleteModels`+extension, `data-purge.ts:29` flat `RETENTION_DAYS=90` (base prisma hard-delete), `gdpr.ts:17` `deleteByOrgAndCount`; verified against `Invoice` fixture (D-06) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Region→DB-client routing | DB package (`packages/db/src/region.ts`) | env schema (`packages/validators`) | Region→client mapping is DB infra; lazy-throw keeps US optional. Already US-ready (Phase 82). |
| `dataRegion` persistence shape | DB schema (`packages/db/prisma/schema/organization.prisma`) | migration | `dataRegion` is a Postgres ENUM column; widening the enum is a DB-tier additive migration. |
| Creation-time US assignment | Auth package (`packages/auth/src/config.ts` org plugin hook) | DB write | Org creation flows through Better Auth's `organization.create`, not a tRPC mutation — the `beforeCreate` hook is the single origin of `dataRegion` (D-01). |
| `dataRegion` type widening (casts) | API + DB (`tenant.ts`, `org-cache.ts`, `oauth.ts`, `org-definition-sync.ts`, `seed-dev.ts`) | — | Each consumer narrows to `'EU'\|'ME'`; widen to the shared `DataRegion` union so `'US'` is type-legal end-to-end. |
| Region→R2-bucket routing | API service (`regional-storage.ts`) | env schema | Storage residency is resolved from tenant region; `getRegionalBucket` throw is the lazy gate. |
| Retention policy (record-type→years) | DB package (`packages/db/src/retention-policy.ts`, NEW) | — | Lowest shared tier reachable by both the cron-worker (`data-purge`) and api (`gdpr`, `soft-delete`); avoids an api→cron dependency edge. |
| Hard-delete guard (3 chokepoints) | DB (`soft-delete.ts`) + cron (`data-purge.ts`) + API (`gdpr.ts`) | retention-policy module | Deletion happens in three physically-separate processes; each must consult the same resolver. |
| Scheduled archive/sweep | cron-worker (`data-purge.ts`) | — | Stays in cron per D-05; the sweep just becomes per-model-window-aware. |

## Standard Stack

No new runtime dependencies. Phase 83 is entirely in-tree edits + an additive Prisma enum migration on the existing stack. `[VERIFIED: in-tree]` for every entry (read directly this session).

### Core (existing, reused)
| Library / Module | Location | Purpose | Why Standard |
|---------|----------|---------|--------------|
| Prisma 7 (`prisma-client`) | `packages/db` | additive `ALTER TYPE "DataRegion" ADD VALUE 'US'` | repo standard; enum already exists EU/ME |
| `@aws-sdk/client-s3` + `s3-request-presigner` | already present in `regional-storage.ts` / `r2.ts` | R2 (S3-compatible) bucket operations | existing region-aware storage layer |
| `better-auth` (organization plugin) | `packages/auth/src/config.ts` | `organizationCreation.beforeCreate` hook for D-01 US assignment | org-create already runs through this plugin (tRPC create/update were removed) |
| `@trpc/server` v11 | already present | `gdpr.ts` erasure mutation surface | retention-exemption lands in the existing `requestErasure` mutation |
| `@contractor-ops/logger` (Pino) / `createCronLogger` | `packages/logger` | structured logging in cron + services | repo standard; cron uses `createCronLogger` (CLAUDE.md) |
| `zod` | already present | `R2_BUCKET_NAME_US` env schema + any input validation | boundaries are Zod-validated per CLAUDE.md |
| `vitest` | `packages/{db,api}` + `apps/cron-worker` configs | extend region-lockstep / regional-storage / soft-delete / data-purge / gdpr tests | each package already has a vitest config |

### Supporting (existing, reused)
| Module | Location | Purpose | When to Use |
|--------|----------|---------|-------------|
| `getRegionalClient` | `packages/db/src/region.ts:45` | region→writer client (US already resolves) | tenant middleware (no change needed for US) |
| `getRegionalBucket` | `packages/api/src/services/regional-storage.ts:38` | region→bucket name; throw-on-unsupported = lazy gate | widen its map to include US |
| `withSoftDelete` / `createTenantClientFrom` | `packages/db/src/soft-delete.ts` + `index.ts` | the delete→update(deletedAt) chokepoint; `ctx.db` is built from it | retention-aware extension lands here |
| `writeAuditLog` | `packages/api/src/services/audit-writer.ts` | audit retention-blocked erasure attempts | D-05 #3 gdpr exemption path |
| `getOrgMeta` (5-min cache) | `packages/api/src/services/org-cache.ts:75` | tenant middleware reads `dataRegion` from here | widen `OrgMeta.dataRegion: string` → `DataRegion` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Retention map in `packages/db/src/retention-policy.ts` | put it in `packages/api/src/...` | `data-purge.ts` (cron-worker) already imports `@contractor-ops/db` but NOT `@contractor-ops/api` services at top level (it dynamic-imports `@contractor-ops/api/services/r2`). Placing the resolver in `packages/db` avoids forcing a static api→cron edge and is reachable by all three chokepoints. **Recommend `packages/db`.** |
| Typed const map (D-04) | DB table | Const map is simpler + legally-specified (not tenant-configurable), mirrors the existing `DE13bServiceType` / `EU_MEMBER_STATES` const pattern in `reverse-charge.service.ts`. DB table deferred per D-04. |
| Additive `ALTER TYPE` (db-push fallback) | `prisma migrate dev` | `migrate dev` is BLOCKED by pre-existing migration-history drift (Phase 82 deviation). Use the same idempotent ALTER / db-push fallback Phase 82 used; record per-region prod apply as deferred. |

**Installation:** None. No new packages. Schema change is an additive enum migration:
```bash
# packages/db/prisma/schema/organization.prisma — add `US` under enum DataRegion { EU ME US }
# migrate dev is blocked by pre-existing drift → use the Phase-82-sanctioned db-push fallback:
cd packages/db && psql "$DATABASE_URL_EU" -c "ALTER TYPE \"DataRegion\" ADD VALUE IF NOT EXISTS 'US';"
pnpm --filter @contractor-ops/db prisma generate
# Per-region PRODUCTION apply (EU then ME then US) is DEFERRED (record in deferred-items).
# Note: Postgres ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older PG;
# PG17 supports it, but it cannot be used in the SAME tx that then references the new value.
```

**Version verification:** N/A — no new packages introduced this phase.

## Package Legitimacy Audit

**Not applicable.** Phase 83 installs zero external packages. All work is in-tree edits + an additive Prisma enum migration. No npm/PyPI/crates surface to slopcheck.

## Architecture Patterns

### System Architecture Diagram

```
                 US-INFRA-01 — US DB routing (creation → resolution)
  Better Auth organization.create
        │  (NEW) organizationCreation.beforeCreate hook
        │  billing country → dataRegion: 'US'   ◀── D-01 single origin
        ▼
  Organization row  dataRegion: DataRegion ENUM  ◀── MUST add 'US' to Postgres enum (Pitfall 1)
        │
        ▼  authenticated request
  tenant.ts → getOrgMeta(orgId)  (5-min cache; OrgMeta.dataRegion widen string→DataRegion)
        │   region = meta.dataRegion ?? 'EU'
        ▼
  getRegionalClient(region)  ── 'US' already resolves (Phase 82); lazy-throw if DATABASE_URL_US unset
        │
        ▼  ctx.db = withRlsTransactions(withRlsReads(withOrgCacheInvalidation(
                       createTenantClientFrom(regionalPrisma))))   = withSoftDelete(withTenantScope(...))


                 US-INFRA-02 — US R2 bucket (data residency)
  file op (presign / put / delete)
        │  resolveRegion(ctx) → region
        ▼
  getRegionalBucket(region)  ── REGION_BUCKET_MAP widen Record<'EU'|'ME'> → Record<DataRegion>
        │                        throw-on-unsupported = lazy gate (D-03)
        ▼  env.R2_BUCKET_NAME_US (OPTIONAL in validators/env.ts; lazy default like DATABASE_URL_US)


                 US-INFRA-03 — IRS retention (3 deletion chokepoints, ONE resolver)
                          packages/db/src/retention-policy.ts  (NEW)
                          { '1099-NEC': 4y, 'backup-withholding': 7y }  + resolveRetention(recordType)
                                 ▲             ▲              ▲
        ┌────────────────────────┘             │              └────────────────────────┐
  (1) soft-delete.ts extension        (2) data-purge.ts cron          (3) gdpr.ts erasure
  ctx.db delete→update(deletedAt);    BASE prisma (NO ext!) =          ctx.db (HAS ext);
  retained model in-window:           TRUE hard-delete past            deleteByOrgAndCount hard-deletes
  block real hard-delete              flat RETENTION_DAYS=90.          ~40 non-soft models. For retained
  (extension already converts to      Retained models: consult        models: soft-delete + statutory-
  soft-delete; guard the explicit     policy window, NOT 90d.          citation exemption (NOT hard).
  retained-window case)               *** THE load-bearing path ***
```

### Pattern 1: Prisma enum widening (additive, db-push fallback)
**What:** Add `US` to `enum DataRegion { EU ME }` in `organization.prisma`, apply via idempotent `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'US'` (Phase 82's sanctioned fallback because `migrate dev` is drift-blocked), regenerate the client.
**When to use:** This is the one genuinely-missing piece; without it, the Better Auth `beforeCreate` hook writing `dataRegion: 'US'` throws a Postgres `invalid input value for enum`.
```prisma
// packages/db/prisma/schema/organization.prisma:350 — Source: in-tree (read 2026-06-07)
enum DataRegion {
  EU
  ME
  US  // Phase 83 US-INFRA-01 — values are UPPER (passes db:audit-enum-casing)
}
```

### Pattern 2: Creation-time US assignment via Better Auth org hook (D-01)
**What:** The org-create tRPC `create`/`update` procedures were intentionally removed (`organization.ts:16-17`) — org creation runs through Better Auth's `authClient.organization.create`. Today NO code sets `dataRegion`, so all orgs default to `EU` (schema `@default(EU)`). D-01 requires setting US at creation from a billing-country selection.
**When to use:** Add an `organizationCreation: { beforeCreate }` hook to the `organization()` plugin block (`config.ts:457`), mirroring the existing `databaseHooks.session.create.before` pattern (`config.ts:252`). The billing-country input arrives via the create payload's metadata; map US billing → `dataRegion: 'US'`.
```typescript
// packages/auth/src/config.ts — inside organization({ ... }) plugin block
// Source: in-tree pattern (Better Auth organizationCreation hook); mirrors databaseHooks.session.create.before
organization({
  ac,
  // ... existing roles ...
  organizationCreation: {
    beforeCreate: async ({ organization }) => {
      // billing-country/region selection arrives in the create payload (metadata or a
      // dedicated field the SPA passes). Map a US billing selection → US data residency.
      // dataRegion is IMMUTABLE after creation (D-01); never set in afterCreate/update.
      const dataRegion = resolveDataRegionFromBilling(organization); // 'EU' | 'ME' | 'US'
      return { data: { ...organization, dataRegion } };
    },
  },
  // ...
})
```
**[ASSUMED]** the exact create-payload field carrying the billing-country selection — Better Auth's `additionalFields` on the organization schema or a metadata field. The planner must confirm how the SPA passes billing country into `authClient.organization.create` (and add it as an `additionalFields` entry on the org plugin schema if not present). See Assumptions A1 + Open Q1.

### Pattern 3: Widen `REGION_BUCKET_MAP` to `Record<DataRegion>` (D-03)
```typescript
// packages/api/src/services/regional-storage.ts:28 — Source: in-tree (read 2026-06-07)
import type { DataRegion } from '@contractor-ops/db';

const REGION_BUCKET_MAP: Record<DataRegion, (env: ServerEnv) => string> = {
  EU: env => env.R2_BUCKET_NAME_EU,
  ME: env => env.R2_BUCKET_NAME_ME,
  US: env => {
    if (!env.R2_BUCKET_NAME_US) {
      throw new Error('R2_BUCKET_NAME_US is not configured for US-region storage');
    }
    return env.R2_BUCKET_NAME_US;
  },
};

export function getRegionalBucket(region: string): string {
  const pick = REGION_BUCKET_MAP[region as DataRegion];  // widen cast EU|ME → DataRegion (line 39)
  if (!pick) {
    throw new Error(`Unsupported storage region: ${region}. ...`);
  }
  return pick(getServerEnv());
}
```
Using `Record<DataRegion>` forces a compile error until `US` is added — the same structural-lockstep mechanism Phase 82 used for `REGION_ENV_MAP`. (`R2_BUCKET_NAME_EU/_ME` have non-empty `.default(...)` so they never throw; `R2_BUCKET_NAME_US` is optional with no default, hence the explicit lazy throw, matching the `DATABASE_URL_US` posture.)

### Pattern 4: Retention-policy primitive (D-04) — `packages/db/src/retention-policy.ts` (NEW)
**What:** A typed `record-type → retention-years` const map + a `resolveRetentionDays(recordType)` resolver, plus a `getRetentionCutoff(recordType, now)` helper. Mirrors the `reverse-charge.service.ts` const-map style. Built so Theme B AKTA-02 registers per-jurisdiction personnel-file windows on the SAME map.
```typescript
// packages/db/src/retention-policy.ts (NEW) — Source: shape mirrors reverse-charge.service.ts const maps
/**
 * Statutory record-retention windows. Keyed by a stable record-type token so
 * Phase 86 tax models and Theme B AKTA-02 personnel-file rules register on the
 * SAME map (no parallel retention engines, D-04). Years, not days, because all
 * statutory windows are expressed in years; the cron converts to a cutoff date.
 *
 * Legal note: 4-yr 1099-NEC / 7-yr backup-withholding are IRS values — needs
 * jurisdiction-specific legal/tax-adviser verification before production deploy
 * (Standing Project Constraint; LOCAL-ONLY).
 */
export const RETENTION_YEARS = {
  '1099-NEC': 4,
  'backup-withholding': 7,
  // Phase 86 / Theme B register additional record types here.
} as const;

export type RetainedRecordType = keyof typeof RETENTION_YEARS;

/** Maps a soft-delete MODEL name → its retention record type (Phase 86 extends). */
export const MODEL_RETENTION_TYPE: Partial<Record<string, RetainedRecordType>> = {
  // Phase 83 ships EMPTY (D-06: no tax tables yet). Phase 86 adds e.g.
  // Form1099Nec: '1099-NEC'. Verified against a fixture in tests.
};

export function resolveRetentionYears(recordType: RetainedRecordType): number {
  return RETENTION_YEARS[recordType];
}

/** Returns the purge cutoff for a model, or null if the model has no retention rule. */
export function getRetentionCutoff(model: string, now: Date): Date | null {
  const recordType = MODEL_RETENTION_TYPE[model];
  if (!recordType) return null;
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS[recordType]);
  return cutoff;
}
```
Export from `packages/db/src/index.ts`. **Key insight:** the policy is keyed by both a record-type token (for product-facing windows) AND a model→type map (so the deletion chokepoints, which only know the Prisma model name, can look up the window).

### Pattern 5: Make `data-purge.ts` retention-aware (D-05 #2 — THE load-bearing edit)
**What:** Today `data-purge.ts` imports the BASE `prisma` (no soft-delete extension, confirmed via `index.ts` — `createTenantClient` is what adds the extension), and hard-deletes via `tx.<model>.deleteMany({ where: { deletedAt: { lt: cutoff } } })` past a flat `RETENTION_DAYS=90`. For a model with a retention rule, the cutoff must come from `getRetentionCutoff(model, now)` (4yr/7yr), NOT the flat 90 days. Non-retained models keep the 90-day sweep.
```typescript
// apps/cron-worker/src/jobs/handlers/data-purge.ts — Source: in-tree (read 2026-06-07), lines 29 + 119-132
import { getRetentionCutoff } from '@contractor-ops/db';

const RETENTION_DAYS = 90; // default sweep for non-retained models (unchanged)

// inside the tx, per soft-delete model — compute a per-model cutoff:
function cutoffFor(model: string, now: Date, flatCutoff: Date): Date {
  return getRetentionCutoff(model, now) ?? flatCutoff;   // retained → 4y/7y; else → 90d
}
// e.g. invoices:
const invCutoff = cutoffFor('Invoice', now, flatCutoff);
const invResult = await tx.invoice.deleteMany({ where: { deletedAt: { not: null, lt: invCutoff } } });
```
**Critical:** for Phase 83 the `MODEL_RETENTION_TYPE` map is EMPTY (no tax models yet, D-06), so behavior is identical to today for all current models — the test asserts the wiring against a FIXTURE entry (see Validation Architecture). Phase 86 just registers the real tax model and inherits the guard.

### Pattern 6: `gdpr.ts` retention-exemption (D-05 #3)
**What:** `requestErasure` runs on `ctx.db` (HAS the soft-delete extension — confirmed). `deleteByOrgAndCount` (`gdpr.ts:17`) calls `model.deleteMany`, which for a model in `softDeleteModels` is auto-converted to a soft-delete by the extension. But D-05 wants an EXPLICIT exemption: for a retained model, soft-delete (not hard-delete) AND record a statutory-citation flag, never claiming full erasure. The clean implementation is to route retained models through `softDeleteByOrgAndCount` (already exists, `gdpr.ts:33`) instead of `deleteByOrgAndCount`, and append the statutory citation to the audit log + the returned summary message.
```typescript
// packages/api/src/routers/compliance/gdpr.ts — Source: in-tree (read 2026-06-07)
// For a model with a retention rule (resolved via MODEL_RETENTION_TYPE), use
// softDeleteByOrgAndCount + add to a `retainedUnderStatute` summary section with
// the citation (e.g. "IRS 1099-NEC: 4-year retention, 26 CFR 1.6001-1"); never
// deleteByOrgAndCount. Phase 83 ships the BRANCH; the model list is empty until
// Phase 86, verified against a fixture model in gdpr.test.ts.
```
**Legal note:** the statutory-citation copy needs jurisdiction-specific legal/tax-adviser verification before production deploy (Standing Constraint; ship annotated).

### Anti-Patterns to Avoid
- **Treating `dataRegion` as a plain string column** — it is a Postgres ENUM (`organization.prisma:350`). Writing `'US'` without the additive `ALTER TYPE` throws `invalid input value for enum "DataRegion": "US"`. (Phase 82's RESEARCH claim that it is a string is WRONG — see Pitfall 1.)
- **Adding tax/retained models to `globalModels`** — IDOR landmine. `globalModels` (`tenant.ts:41`) is for non-tenant-scoped models only; any tenant-owning tax model stays OUT.
- **Putting the retention resolver in `packages/api`** — forces a static `@contractor-ops/api` import into the cron-worker's `data-purge.ts` (today it only dynamic-imports api SERVICES). Put it in `packages/db`.
- **Relying on the soft-delete extension to protect `data-purge`** — `data-purge.ts` uses the BASE `prisma`, which has NO extension; its `deleteMany` is a true hard-delete. The retention-window logic MUST be explicit in the cron.
- **Setting `dataRegion` in `afterCreate`/`update`** — it is IMMUTABLE (D-01); set ONLY in `beforeCreate`.
- **Creating a separate US tax bucket** — D-03 mandates ONE US regional bucket for all US-org files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Region→client routing | New US client pool | `getRegionalClient('US')` (`region.ts:45`) | Already US-ready (Phase 82); lazy-throw on missing env is the designed local-dev posture |
| Region→bucket lockstep | Manual region check | `Record<DataRegion, ...>` map (`regional-storage.ts:28`) | TS forces a `US` entry once the type widens — structural lockstep, free |
| delete→soft-delete conversion | New per-model guard | the existing `withSoftDelete` `$allModels.delete/deleteMany` hook (`soft-delete.ts:57`) | Already converts delete→update(deletedAt) for `softDeleteModels`; extend, don't replace |
| Org soft-delete-through-retention in erasure | New erasure helper | existing `softDeleteByOrgAndCount` (`gdpr.ts:33`) | Already used for contractors/contracts/documents; route retained models through it |
| Retention map | A retention "engine"/framework | typed const map + resolver (D-04) | Mirrors `reverse-charge.service.ts` const maps; legally-specified, not tenant-config |
| Creation-time region | New tRPC org-create mutation | Better Auth `organizationCreation.beforeCreate` hook | org-create tRPC procedures were removed; Better Auth owns creation |

**Key insight:** Phase 83 is "wire/widen existing primitives + one missing enum migration," not "build." The single genuinely-new FILE is `retention-policy.ts` (a const map + 3 small functions). Everything else extends a file that already exists.

## Runtime State Inventory

Phase 83 adds a region enum value, an optional bucket env, a new retention module, and widens deletion logic. Inventory per the 5 categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `Organization.dataRegion` is a Postgres ENUM (`DataRegion` type) — EXISTING rows are all `EU`/`ME`; no US rows exist yet (verified: seed-dev region union is `'EU'\|'ME'` only, `seed-dev.ts:900`). Adding `US` is an additive `ALTER TYPE ... ADD VALUE` — NO data migration of existing rows. No US org data exists, so no retention records to back-fill. | additive enum migration only (db-push fallback); NO data migration |
| **Live service config** | R2 buckets are provisioned out-of-band (Cloudflare dashboard / `render.yaml`), NOT in git. The US bucket need not exist for Phase 83 to boot/test (optional env, lazy-throw on access). Unleash flags (`module.us-expansion`) live in Unleash UI — irrelevant here (Phase 83 ships infra, flag gating is Phase 82/later). | none for local-only Phase 83; operator provisions US R2 bucket at US go-live (record as deferred ops item) |
| **OS-registered state** | The `data-purge` cron is registered in-code (`apps/cron-worker/src/jobs/registry.ts:49`), schedule from `env.CRON_DATA_PURGE_SCHEDULE` — no OS scheduler. Changing the handler's retention logic needs no re-registration. | None |
| **Secrets/env vars** | `DATABASE_URL_US` + `DATABASE_URL_US_RO` already in `env.ts:38-39` + `.env.example:72,84` (Phase 82). `R2_BUCKET_NAME_US` is NEW (optional, no default) — add to `env.ts` r2Schema + `.env.example` (after line 134). No secret rotation. | add ONE optional env var (`R2_BUCKET_NAME_US`) to schema + `.env.example` |
| **Build artifacts** | Prisma client regenerates from the additive `DataRegion` enum change (`prisma generate`). The generated `enums.ts` currently has `DataRegion = { EU, ME }` (`enums.ts:1010`); after the migration + generate it gains `US`. No stale egg-info / compiled-binary concern. | `prisma generate` after the enum migration |

**Canonical question — after every file is updated, what runtime state still holds the old shape?** The Postgres `DataRegion` enum type (`CREATE TYPE "DataRegion" AS ENUM ('EU', 'ME')`, baseline migration line 349) — it MUST receive the `ALTER TYPE ... ADD VALUE 'US'` or the new `beforeCreate` hook's write fails at the database. This is the one piece of stored-schema state the file edits alone do not change.

## Common Pitfalls

### Pitfall 1: `DataRegion` IS a Prisma enum — Phase 82 widened only the TS union, NOT the Postgres enum (HIGHEST VALUE)
**What goes wrong:** Phase 82's RESEARCH/SUMMARY asserted "`DataRegion` is a pure TypeScript union, NOT a Prisma enum" and "`Organization.dataRegion` is stored as a string." **Both are wrong.** `organization.prisma:350` defines `enum DataRegion { EU ME }`, `Organization.dataRegion DataRegion @default(EU)` (`:15`), and the baseline migration created `CREATE TYPE "DataRegion" AS ENUM ('EU', 'ME')`. The generated client types `dataRegion: $Enums.DataRegion` (an enum, not `string`) and `enums.ts:1010` lists `{ EU, ME }` only. Phase 82 widened `SUPPORTED_REGIONS` (a separate TS tuple in `region.ts`) but never touched the Prisma enum. **Consequence: `prisma.organization.create({ data: { dataRegion: 'US' } })` throws `invalid input value for enum "DataRegion": "US"` at the database.** The Phase 82 region-lockstep test explicitly scopes itself to TS-reachable sources and does NOT assert the Prisma enum (`region-lockstep.test.ts:10-14`), so the gap is unguarded.
**Why it happens:** Two `DataRegion` definitions exist and were never reconciled: the TS union (`region.ts:9`, US-aware) and the Postgres enum (`organization.prisma:350`, EU/ME only). They share a name but not a source of truth.
**How to avoid:** Add `US` to the Prisma `enum DataRegion`, apply the additive `ALTER TYPE "DataRegion" ADD VALUE IF NOT EXISTS 'US'` (db-push fallback; `migrate dev` is drift-blocked per Phase 82), regenerate the client. ADD a lockstep assertion that the Prisma `$Enums.DataRegion` keys match `SUPPORTED_REGIONS` so this can never silently drift again.
**Warning signs:** A plan that says "dataRegion is a string, no migration needed" — that is the Phase 82 error propagating forward.

### Pitfall 2: `data-purge.ts` runs on the BASE prisma — its deleteMany is a TRUE hard-delete
**What goes wrong:** `data-purge.ts:24` imports `{ prisma }` from `@contractor-ops/db`. That export is the RAW client (`index.ts` exports `prisma` from `client.ts`); the soft-delete extension is only applied by `createTenantClient`/`createTenantClientFrom` (`index.ts`). So `tx.invoice.deleteMany({ where: { deletedAt: { lt: cutoff } } })` in the cron is a genuine Postgres `DELETE` — there is no extension to intercept it. A retained record whose `deletedAt` is older than 90 days WILL be permanently destroyed by the daily sweep unless the cron itself respects the per-model retention window.
**Why it happens:** The cron deliberately uses the base client to purge soft-deleted rows (the whole point is to finalize deletion); the soft-delete extension would defeat that.
**How to avoid:** Make the cron consult `getRetentionCutoff(model, now)` per soft-delete model — retained models use the 4yr/7yr cutoff, all others keep the flat 90-day cutoff. This is the load-bearing D-05 #2 edit.
**Warning signs:** A plan that "protects" retention only in `soft-delete.ts` and assumes the cron inherits it — the cron does NOT have the extension.

### Pitfall 3: `gdpr.ts` erasure already soft-deletes some models via the extension — but silently
**What goes wrong:** `requestErasure` runs on `ctx.db` (soft-delete-extended). `deleteByOrgAndCount` (`gdpr.ts:17`) calls `model.deleteMany`; for a model in `softDeleteModels` the extension converts it to soft-delete. So a future tax model added to `softDeleteModels` and run through `deleteByOrgAndCount` would be silently soft-deleted — which LOOKS safe, but D-05 #3 requires an EXPLICIT exemption with a statutory citation in the audit log + the response (never claiming full erasure during a hold). A silent soft-delete with a "data has been deleted" message is an RODO-honesty defect.
**Why it happens:** The extension makes the wrong thing look right; the requirement is about the user-facing claim + audit citation, not just the physical operation.
**How to avoid:** Route retained models through the existing `softDeleteByOrgAndCount` and add a `retainedUnderStatute` section to the summary + a statutory citation to the audit log. The current erasure message ("Permanent deletion will occur after the retention period (90 days)") already hard-codes 90 days — update it to reflect that retained records are held for their statutory window.
**Warning signs:** Erasure summary that says "deleted" for a model under an active retention hold.

### Pitfall 4: 7 cast sites narrow `dataRegion` to `'EU' | 'ME'` — each must widen to `DataRegion`
**What goes wrong:** `org.dataRegion` is typed `$Enums.DataRegion`. Today, before the enum is widened, that is `'EU' | 'ME'`. After widening it becomes `'EU' | 'ME' | 'US'`, and these sites that hard-cast `as 'EU' | 'ME'` or default `?? 'EU'` into a narrow type will either drop US silently or fail to typecheck. Enumerated sites (verified by grep):
  - `packages/api/src/middleware/tenant.ts:106` — `region = meta?.dataRegion ?? 'EU'` (the hot path; `region` then feeds `getRegionalClient`).
  - `packages/api/src/services/org-cache.ts:38` — `OrgMeta.dataRegion: string` (widen to `DataRegion`; it's read at `tenant.ts:106`).
  - `packages/api/src/services/org-definition-sync.ts:398` — `(c.organization.dataRegion ?? 'EU') as 'EU' | 'ME'`.
  - `apps/api/src/routes/oauth.ts:377` — `(org.dataRegion ?? 'EU') as 'EU' | 'ME'`.
  - `packages/api/src/services/regional-storage.ts:39` — `region as 'EU' | 'ME'` (widen with the map, Pattern 3).
  - `packages/db/scripts/seed-dev.ts:900,910` — `pickRegion` / `buildOrgs` region union typed `('EU'|'ME')[]` and `as 'EU' | 'ME'`.
  - `packages/api/src/routers/portal/portal-shared.ts:23`, `packages/api/src/middleware/portal-auth.ts:69`, `packages/api/src/services/ksef-sync-orchestrator.ts:507`, `apps/api/src/routes/idp-deprovisioning.ts:58` — `?? 'EU'` (no explicit cast; will accept the wider type but should pass `DataRegion`-typed values to `getRegionalClient`).
  - `packages/api/src/middleware/api-key-auth.ts:63` — `keyRecord.organization.dataRegion ?? undefined` (already `DataRegion`-typed via the enum; benign).
**How to avoid:** Replace the narrow `'EU' | 'ME'` casts with the shared `DataRegion` import from `@contractor-ops/db`. Keep `?? 'EU'` as the safe fallback (US must be explicitly assigned at creation, never defaulted). `getRegionalClient` already accepts `string` and validates against `SUPPORTED_REGIONS`, so runtime is safe; the widening is about type-correctness and not silently dropping US.
**Warning signs:** Any remaining `as 'EU' | 'ME'` after the phase.

### Pitfall 5: `DATA_HOSTING_REGION` env enum is still `z.enum(['EU', 'ME'])`
**What goes wrong:** `validators/src/env.ts:301` defines `DATA_HOSTING_REGION: z.enum(['EU', 'ME']).default('EU')` — used for "generated legal PDFs and similar." This is a deployment-level (not per-org) region knob and is NOT the per-org routing path, so it is NOT strictly required for US-INFRA-01. But it is an EU/ME-only region enum that a planner might assume covers US.
**How to avoid:** Leave it as-is for Phase 83 (it does not gate per-org US routing) OR widen to `['EU', 'ME', 'US']` for consistency — planner's call. Document the decision so it is not mistaken for the routing path. **[ASSUMED]** it is out of scope for US-INFRA-01 (per-org `dataRegion` is the routing source, not this deployment knob).

### Pitfall 6: `data-purge` cron uses the EU-pinned base prisma (pre-existing US/ME region-leakage)
**What goes wrong:** `data-purge.ts` sweeps via the base `prisma`, which is EU-pinned (the `lint-region-leakage.ts` script exists precisely because base `prisma` serves the EU DB). For US/ME orgs, soft-deleted rows live in the US/ME physical DB and would NOT be reached by the EU-pinned purge. This is a PRE-EXISTING cross-region correctness gap (already true for ME), not introduced by Phase 83.
**How to avoid:** Out of scope for Phase 83's retention guard (D-05 is about NOT hard-deleting in-window, which the EU-pinned purge satisfies trivially for US rows it can't see). Flag as a known limitation: a true US/ME-aware purge would fan out over `SUPPORTED_REGIONS` × `getRegionalClient(region)`. Record as a deferred ops/correctness item; do NOT expand Phase 83 scope to fix it unless the planner explicitly wants the region fan-out now.

## Code Examples

### Lockstep guard: Prisma enum ↔ SUPPORTED_REGIONS (NEW assertion, closes the Pitfall-1 gap)
```typescript
// packages/db/src/__tests__/region-lockstep.test.ts (EXTEND) — Source: in-tree pattern
import { DataRegion as PrismaDataRegion } from '../generated/prisma/client/enums.js';
import { SUPPORTED_REGIONS } from '../region.js';

it('Prisma DataRegion enum matches SUPPORTED_REGIONS (no TS/DB drift — Pitfall 1)', () => {
  expect(new Set(Object.values(PrismaDataRegion))).toEqual(new Set(SUPPORTED_REGIONS));
});
```

### US R2 bucket env (optional, lazy — mirrors DATABASE_URL_US)
```typescript
// packages/validators/src/env.ts r2Schema (after line 88) — Source: in-tree (read 2026-06-07)
R2_BUCKET_NAME_EU: z.string().default('contractor-ops-documents-eu'),
R2_BUCKET_NAME_ME: z.string().default('contractor-ops-documents-me'),
// Phase 83 US-INFRA-02 — OPTIONAL (no default): the app boots clean locally with
// no US bucket; getRegionalBucket lazy-throws only on actual US-org file access
// (mirrors DATABASE_URL_US, D-03).
R2_BUCKET_NAME_US: z.string().optional(),
```
```bash
# .env.example (after line 134) — Source: in-tree (read 2026-06-07)
R2_BUCKET_NAME_US=
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `DataRegion` assumed to be a TS-only union / string column (Phase 82 RESEARCH) | `DataRegion` is a Postgres ENUM (EU/ME) — Phase 82 widened ONLY the TS tuple | Phase 83 research (this doc) | Phase 83 MUST add the missing `US` enum value or US org creation fails at the DB |
| Org-create via tRPC `create`/`update` mutation | Better Auth `organization.create` (tRPC procedures removed) | pre-v7.0 (`organization.ts:16`) | D-01 US assignment goes in a Better Auth `organizationCreation.beforeCreate` hook, not a tRPC mutation |
| Flat 90-day purge for all soft-deleted models | Per-model retention window (retained models 4yr/7yr; rest 90d) | Phase 83 (D-05) | `data-purge.ts` becomes policy-aware; non-retained behavior unchanged |

**Deprecated/outdated:** The Phase 82 RESEARCH claims "`DataRegion` is a pure TypeScript union, NOT a Prisma enum" and "`Organization.dataRegion` is stored as a string" are **incorrect** (Pitfall 1) — do not carry them forward.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The billing-country/region selection reaches Better Auth `organization.create` via an `additionalFields` org-plugin field or `metadata`, and maps US→`dataRegion:'US'` in `beforeCreate` | Pattern 2 / Open Q1 | If the SPA does not pass a billing-country signal into org-create, US orgs default to EU and US-INFRA-01 silently fails. Planner must wire the create-payload field + `additionalFields` on the org schema. |
| A2 | `Form1099Nec` / tax-model retention windows are registered in Phase 86, NOT Phase 83 (D-06) | Pattern 4/5/6 | If a representative model is wanted live now, `MODEL_RETENTION_TYPE` needs a real entry; D-06 supports the empty-map + fixture-verification approach. |
| A3 | `DATA_HOSTING_REGION` (`env.ts:301`) is out of scope for US-INFRA-01 (deployment knob, not per-org routing) | Pitfall 5 | If generated US legal PDFs must route by this knob, it needs widening to include US. Low risk for Phase 83 (no US PDFs until Phase 84+). |
| A4 | The retention statutory citations (4yr 1099-NEC / 7yr backup-withholding + CFR refs) are LOCAL-ONLY annotated and need legal/tax-adviser sign-off pre-prod (Standing Constraint) | Pattern 4/6 | If a citation is materially wrong it is a compliance defect — but the LOCAL-ONLY posture defers verification; ship annotated, not hard-blocked. |
| A5 | The retention resolver belongs in `packages/db` (reachable by cron + api without an api→cron edge) | Architectural Responsibility Map / Alternatives | If a planner puts it in `packages/api`, `data-purge.ts` gains a static `@contractor-ops/api` import (today only dynamic-imports api services). Low risk; recommendation is clear. |

**If A1/A3 are confirmed by discuss-phase, they become locked decisions.**

## Open Questions (RESOLVED)

All three resolved at plan time (CONTEXT.md D-06/D-08 + plan 83-02); no open items remain.

1. **How does the billing-country/region selection reach `organization.create`?** (A1)
   - **RESOLVED** (plan 83-02 Task 1): org-create runs through Better Auth (`organization.ts:16`); add a `billingCountry`/`region` `additionalFields` entry on the org plugin schema (Zod-validated) and map it → `dataRegion` in `organizationCreation.beforeCreate`. Today NO code sets `dataRegion` (all orgs default EU); default stays EU.

2. **Does the empty `MODEL_RETENTION_TYPE` map (D-06) need a fixture entry shipped, or is a test-only fixture sufficient?**
   - **RESOLVED** (D-06): ship the map EMPTY; verify the 3 chokepoints against a test-only fixture (e.g. map `'Invoice' → '1099-NEC'` inside a test) so production behavior is unchanged but the wiring is proven. Phase 86 adds the real entries.

3. **Widen `DATA_HOSTING_REGION` to include US now, or defer?** (A3)
   - **RESOLVED** (D-08): defer — it is not the per-org request-time routing path (routing keys off `organization.dataRegion`). Revisit when US is actually deployed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (EU dev) | additive `DataRegion` enum migration | ✓ (`DATABASE_URL_EU` local) | Postgres 17 / Prisma 7 | — |
| `DATABASE_URL_US` | US region DB resolution | ✗ (intentionally unset, Phase 82) | — | optional; `getRegionalClient('US')` lazy-throws on access; tests need no live US DB |
| `R2_BUCKET_NAME_US` | US-org file storage | ✗ (NEW, intentionally unset) | — | optional, no default; `getRegionalBucket('US')` lazy-throws on access |
| R2 / MinIO (S3) | regional-storage tests | ✓ (mocked in `regional-storage.test.ts`) | — | tests mock `@aws-sdk/client-s3` |
| vitest | all SC tests | ✓ | per-package configs present | — |
| `migrate dev` | enum migration | ✗ (BLOCKED by pre-existing drift, Phase 82) | — | idempotent `ALTER TYPE ... ADD VALUE` / db-push fallback; per-region prod apply deferred |

**Missing dependencies with no fallback:** None — Phase 83 boots and tests clean locally without a US DB or US bucket.
**Missing dependencies with fallback:** `DATABASE_URL_US` + `R2_BUCKET_NAME_US` — both unset is the designed local-dev state (lazy-throw on actual US access). `migrate dev` blocked → db-push/ALTER fallback.

## Validation Architecture

> nyquist_validation: `true` (verified in `.planning/config.json`). Section REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (per-package) |
| Config files | `packages/db/vitest.config.ts`, `packages/api/vitest.config.ts`, `apps/cron-worker/vitest.config.ts` |
| Quick run command | scoped per touched package (below) |
| Full suite command | `pnpm test` (turbo → vitest) — **NEVER run the full unscoped web-vite suite (RAM constraint, MEMORY.md)** |
| Typecheck (lockstep enforcer) | `pnpm typecheck` (tsc, CI-canonical) — `Record<DataRegion,...>` maps make the bucket/region change a compile-time lockstep |

### Success Criteria → Test Map
| SC | Behavior | Test Type | Automated Command (scoped) | File Exists? |
|----|----------|-----------|----------------------------|-------------|
| SC#1 | Prisma `DataRegion` enum includes `US` and matches `SUPPORTED_REGIONS` (closes Pitfall 1 drift) | unit | `pnpm --filter @contractor-ops/db test region-lockstep` | ⚠️ extend `packages/db/src/__tests__/region-lockstep.test.ts` |
| SC#1 | A US-billing org create writes `dataRegion: 'US'` via the `beforeCreate` hook; EU/ME default unchanged; immutable on update | unit | `pnpm --filter @contractor-ops/auth test org-creation` (or wherever the hook is tested) | ❌ Wave 0 — new test for the `organizationCreation.beforeCreate` hook |
| SC#1 | `getRegionalClient('US')` resolves (no "Unsupported region"); replicas stay off by default (`getReplicaClient('US')` falls back to writer) | unit | `pnpm --filter @contractor-ops/db test region` | ✅ `region.test.ts` + `region-lockstep.test.ts` (Phase 82 — extend if needed) |
| SC#1 | tenant middleware routes a US org to the US client; `OrgMeta.dataRegion` is `DataRegion`-typed | unit | `pnpm --filter @contractor-ops/api test tenant-region` | ⚠️ extend `packages/api/src/__tests__/tenant-region.test.ts` |
| SC#2 | `getRegionalBucket('US')` returns `R2_BUCKET_NAME_US` when set; throws lazily when unset; `getRegionalBucket('XX')` still throws unsupported | unit | `pnpm --filter @contractor-ops/api test regional-storage` | ⚠️ extend `packages/api/src/services/__tests__/regional-storage.test.ts` (add `R2_BUCKET_NAME_US` to the mocked bucketEnv) |
| SC#2 | `REGION_BUCKET_MAP` is `Record<DataRegion>` (compile-time: missing US fails tsc) | typecheck | `pnpm typecheck --filter @contractor-ops/api` | n/a (compile-time) |
| SC#3 | retention-policy resolver: `resolveRetentionYears('1099-NEC')===4`, `'backup-withholding'===7`; `getRetentionCutoff(model,now)` returns 4y/7y for a mapped model, `null` for unmapped | unit | `pnpm --filter @contractor-ops/db test retention-policy` | ❌ Wave 0 — new `packages/db/src/__tests__/retention-policy.test.ts` |
| SC#3 | **CANNOT hard-delete in-window:** with a FIXTURE model mapped to a retention type, `data-purge` does NOT delete a row whose `deletedAt` is older than 90d but inside the 4yr/7yr window | unit | `pnpm --filter @contractor-ops/cron-worker test data-purge` | ⚠️ extend `apps/cron-worker/src/__tests__/data-purge.test.ts` |
| SC#3 | **PURGES after window:** a retained row past its 4yr/7yr window IS swept; a non-retained row past 90d IS swept (default behavior preserved) | unit | `pnpm --filter @contractor-ops/cron-worker test data-purge` | ⚠️ extend `data-purge.test.ts` |
| SC#3 | soft-delete extension: a retained model in-window cannot be hard-deleted (delete→soft-delete + guard); a non-retained model behaves as today (`Invoice` fixture) | unit | `pnpm --filter @contractor-ops/db test soft-delete` | ⚠️ extend `packages/db/src/__tests__/soft-delete.test.ts` |
| SC#3 | gdpr erasure: a retained (fixture) model is soft-deleted-with-exemption (statutory citation in summary + audit), NOT hard-deleted via `deleteByOrgAndCount` | unit | `pnpm --filter @contractor-ops/api test gdpr` | ⚠️ extend `packages/api/src/routers/__tests__/gdpr.test.ts` |

### Sampling Rate
- **Per task commit:** scoped quick run for the touched package (e.g. `pnpm --filter @contractor-ops/db test retention-policy`).
- **Per wave merge:** `pnpm typecheck` (the `Record<DataRegion>` maps are compile-time lockstep) + scoped tests for db / api / cron-worker / auth.
- **Phase gate:** full scoped suite green + `pnpm lint:schema lint:audit-log lint:logs lint:region-leakage i18n:parity` (Standing Constraint) before `/gsd:verify-work`. **Never** the unscoped web-vite suite.

### Wave 0 Gaps
- [ ] `packages/db/src/__tests__/retention-policy.test.ts` — covers SC#3 resolver (NEW)
- [ ] auth test for the `organizationCreation.beforeCreate` US-assignment hook — covers SC#1 creation (NEW; location per where the hook is unit-testable)
- [ ] extend `packages/db/src/__tests__/region-lockstep.test.ts` — add Prisma-enum ↔ SUPPORTED_REGIONS assertion (Pitfall 1)
- [ ] extend `apps/cron-worker/src/__tests__/data-purge.test.ts` — covers SC#3 cannot-delete-in-window + purges-after-window (with a fixture-mapped model)
- [ ] extend `packages/db/src/__tests__/soft-delete.test.ts` — covers SC#3 retained-in-window guard (Invoice fixture)
- [ ] extend `packages/api/src/routers/__tests__/gdpr.test.ts` — covers SC#3 retention-exemption branch
- [ ] extend `packages/api/src/services/__tests__/regional-storage.test.ts` — add `R2_BUCKET_NAME_US` to mocked env + US bucket resolution/lazy-throw (SC#2)
- [ ] extend `packages/api/src/__tests__/tenant-region.test.ts` — US org → US client routing (SC#1)

*(No fixture/conftest gaps — every package already has a vitest config and the relevant test files exist except the two NEW ones above.)*

## Security Domain

> `security_enforcement` absent in config = enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no new auth surface; org-create already authenticated) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | gdpr erasure already gated by `requirePermission({ organization: ['delete'] })`; tenant scope from session (`ctx.organizationId`), never client input; tax/retained models MUST stay out of `globalModels` (IDOR landmine, `tenant.ts:41`) |
| V5 Input Validation | yes | `R2_BUCKET_NAME_US` Zod-validated in `env.ts`; billing-country create input Zod/`additionalFields`-validated at the Better Auth boundary |
| V6 Cryptography | no (no new crypto) | — |
| V8 Data Protection / Residency | yes | US data → US DB + US R2 bucket (residency); retention guard prevents premature destruction of records under statutory hold |

### Known Threat Patterns for {Prisma + multi-region + soft-delete}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-region data leak (US org served from EU client) | Information Disclosure | `getRegionalClient(org.dataRegion)` at the tenant boundary; `lint:region-leakage` gate forbids base-`prisma`/`prismaRaw` access to region-scoped models |
| Premature hard-delete of a retained tax record | Tampering / Repudiation | retention-window guard at all 3 chokepoints; `data-purge` per-model cutoff; gdpr soft-delete-with-exemption + audit citation |
| IDOR via adding a tenant model to `globalModels` | Elevation of Privilege | NEVER add tenant-owning models to `globalModels`; two-org cross-leak test per future tax model (Phase 86) |
| RODO over-claim (says "erased" during a statutory hold) | Repudiation | gdpr summary surfaces `retainedUnderStatute` + citation; never claims full erasure for held records |
| Mass-assignment of `dataRegion` post-create (region tamper) | Tampering | `dataRegion` set ONLY in `beforeCreate` (D-01 immutable); soft-delete extension already blocks writes to soft-deleted rows; no update path exposes `dataRegion` |

## Project Constraints (from CLAUDE.md)

- `@contractor-ops/logger` / `createCronLogger` — no `console.*`. `data-purge.ts` uses `ctx.log` (cron logger); `gdpr.ts`/services use `createLogger`. Keep it.
- Zod at all boundaries — `R2_BUCKET_NAME_US` env + any billing-country create input.
- `writeAuditLog` on sensitive mutations — retention-blocked erasure attempts must be audit-logged (D-05 #3); the gdpr erasure already writes an audit log (`gdpr.ts:247`).
- New env → `.env.example` + package env schema — `R2_BUCKET_NAME_US` in BOTH (`validators/src/env.ts` + `.env.example`).
- Prisma enum values `UPPER_SNAKE_CASE` (`db:audit-enum-casing` gate) — `US` is already uppercase; passes.
- NEVER add tenant-owning models to `globalModels` (IDOR) — applies to Phase 86 tax models; none added in Phase 83.
- No hardcoded user-facing strings; i18n parity en/de/pl/ar (+ en-US for v7.0 US surfaces) — Phase 83 ships NO new user-facing UI copy (infra + the gdpr erasure summary, which is server-side; the existing confirm-phrase copy lives in `apps/web-vite`). If the create-org UI gains a billing-country selector (Claude's Discretion, minimal), its copy must be i18n'd; en-US copy is Phase 84, not here.
- `.planning/phases` is a symlink → commits stage via the real `.planning/milestones/v7.0-phases/` path (planner/executor concern).
- `semble search` before grep; Read-before-Edit; Edit > Write; minimal diff; no `sed`/bulk-replace scripts.
- 7-day release age for deps — N/A (no new deps).
- Pre-existing Prisma migration-history drift blocks `migrate dev` — use the db-push/`ALTER TYPE` fallback (Phase 82 precedent); record per-region prod apply as deferred.

## Sources

### Primary (HIGH confidence) — all read in-tree 2026-06-07
- `packages/db/src/region.ts` — `SUPPORTED_REGIONS=['EU','ME','US']` (Phase 82), `DataRegion` TS union, `REGION_ENV_MAP`, `getRegionalClient` lazy-throw, `preWarmRegionalClients` skip-on-missing
- `packages/db/prisma/schema/organization.prisma:15,350` — `Organization.dataRegion DataRegion @default(EU)` + `enum DataRegion { EU ME }` (the Pitfall-1 finding)
- `packages/db/prisma/schema/migrations/20260512000000_baseline/migration.sql:349,1905` — `CREATE TYPE "DataRegion" AS ENUM ('EU', 'ME')` + column default (US never added in any migration)
- `packages/db/src/generated/prisma/client/enums.ts:1010` + `models/Organization.ts:46,331` — generated `DataRegion = { EU, ME }`, `dataRegion: $Enums.DataRegion` (enum, not string)
- `packages/db/src/soft-delete.ts` — `softDeleteModels` Set (`Organization, Contractor, Contract, Invoice, Document`), `withSoftDelete` `$allModels.delete/deleteMany`→update(deletedAt) hook + read/write filters
- `packages/db/src/index.ts` — `prisma` = base client; `createTenantClient(From)` = `withSoftDelete(withTenantScope(...))` (the proof that base prisma has NO soft-delete extension)
- `packages/db/src/tenant.ts:41-67` — `globalModels` set (IDOR landmine; Organization is global, tenant-owning models are not)
- `apps/cron-worker/src/jobs/handlers/data-purge.ts` — base `prisma` import, flat `RETENTION_DAYS=90`, per-model `deleteMany({ deletedAt: { lt: cutoff } })`, R2 purge order
- `apps/cron-worker/src/jobs/registry.ts:49` — `data-purge` registration (`CRON_DATA_PURGE_SCHEDULE`)
- `apps/cron-worker/src/__tests__/data-purge.test.ts` — mocks base `prisma` (confirms hard-delete path)
- `packages/api/src/routers/compliance/gdpr.ts` — `deleteByOrgAndCount` (hard-delete ~40 models), `softDeleteByOrgAndCount`, `requestErasure` mutation, R2 cleanup, audit log
- `packages/api/src/services/regional-storage.ts` — `REGION_BUCKET_MAP Record<'EU'|'ME'>`, `getRegionalBucket` throw-on-unsupported, presign/put/delete, `resolveRegion`
- `packages/api/src/services/r2.ts` — legacy single-bucket fallback (`getR2BucketName` → `R2_BUCKET_NAME ?? R2_BUCKET_NAME_EU`), `generateStorageKey`
- `packages/api/src/services/org-cache.ts` — `OrgMeta.dataRegion: string` (widen target), 5-min TTL, invalidation
- `packages/api/src/middleware/tenant.ts:106,137` — `region = meta?.dataRegion ?? 'EU'`, `ctx.db = withRlsTransactions(withRlsReads(withOrgCacheInvalidation(createTenantClientFrom(regionalPrisma))))`
- `packages/validators/src/env.ts` — `DATABASE_URL_US`/`_RO` optional (Phase 82, lines 38-39); r2Schema EU/ME only (lines 87-88, no US); `DATA_HOSTING_REGION z.enum(['EU','ME'])` (line 301)
- `packages/auth/src/config.ts:252,457` — `databaseHooks.session.create.before` pattern; `organization()` plugin block (NO `organizationCreation` hook today)
- `packages/api/src/routers/core/organization.ts:16` — tRPC org create/update removed (creation flows through Better Auth)
- `packages/db/scripts/seed-dev.ts:900,910,1639` — `buildOrgs`/`pickRegion` `('EU'|'ME')[]` union + `as 'EU' | 'ME'`; only `dataRegion` write-site (`org.region`)
- `packages/api/src/services/org-definition-sync.ts:398`, `apps/api/src/routes/oauth.ts:377`, `portal-shared.ts:23`, `portal-auth.ts:69`, `ksef-sync-orchestrator.ts:507`, `idp-deprovisioning.ts:58`, `api-key-auth.ts:63` — `dataRegion` narrow casts / `?? 'EU'` sites
- `packages/api/src/services/reverse-charge.service.ts` — const-map pattern (`EU_MEMBER_STATES`, `DE13bServiceType`) for the retention map shape
- `packages/db/src/__tests__/region-lockstep.test.ts` — Phase 82 lockstep (TS-only; does NOT assert Prisma enum — the Pitfall-1 gap)
- `packages/db/src/__tests__/soft-delete.test.ts` — uses `Invoice` as the representative fixture model (D-06)
- `packages/api/src/services/__tests__/regional-storage.test.ts` — mocked bucket env (EU/ME) to extend
- `packages/db/scripts/lint-region-leakage.ts` — region-leakage gate (base prisma is EU-pinned; Pitfall 6 context)

### Secondary (MEDIUM confidence)
- `.planning/milestones/v7.0-phases/82-.../82-RESEARCH.md` + `82-04-SUMMARY.md` — Phase 82 region primitives + the db-push/ALTER migration-drift fallback; CONTAINS the incorrect "DataRegion is a TS union/string" claim corrected here
- `.planning/REQUIREMENTS.md` — US-INFRA-01/02/03 verbatim + v7.0 Scope Decisions
- `.planning/research/SUMMARY.md` / `FEATURES.md` / `PITFALLS.md` — IRS retention framing (4yr/7yr), reuse posture

### Tertiary (LOW confidence)
- None — every Phase-83 claim is grounded in a direct in-tree read this session.

## Metadata

**Confidence breakdown:**
- US DB routing (US-INFRA-01): HIGH — `region.ts` US-ready confirmed; Prisma enum gap confirmed via schema + baseline migration + generated client; all 7 cast sites located by grep; org-create-via-Better-Auth confirmed (`organization.ts:16`). The ONE open item is the create-payload billing-country wiring (A1/Open Q1).
- US R2 bucket (US-INFRA-02): HIGH — `REGION_BUCKET_MAP`/`getRegionalBucket` read directly; `R2_BUCKET_NAME_US` confirmed absent everywhere; `DATABASE_URL_US` optional pattern is the proven template.
- IRS retention (US-INFRA-03): HIGH — all 3 chokepoints read directly; the base-prisma-no-extension finding for `data-purge` confirmed via `index.ts`; `ctx.db`-has-extension for gdpr confirmed via `tenant.ts`; whole-repo grep confirms NO 4th hard-delete leak. The map+resolver shape is a clear const pattern (reverse-charge precedent). Open item is empty-map-vs-fixture (Open Q2, D-06 resolves it).

**Research date:** 2026-06-07
**Valid until:** ~2026-07-07 (stable in-tree patterns; re-verify only if `region.ts`, `organization.prisma`, `soft-delete.ts`, `data-purge.ts`, `gdpr.ts`, or the Better Auth org plugin is refactored before planning).

## RESEARCH COMPLETE
