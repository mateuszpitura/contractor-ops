# Phase 82: v7.0 Foundation — Add-On Billing + Flag Registry + US Region Enablement - Research

**Researched:** 2026-06-07
**Domain:** Cross-cutting platform primitives (tRPC entitlement middleware, feature-flag boot-gate, multi-region DB routing) on a mature pnpm+Turbo monorepo
**Confidence:** HIGH — every in-tree anchor was read directly; all four success criteria map to verified code seams. Two load-bearing CORRECTIONS to the known anchors are documented below (boot-gate is not wired; flag-key shape constraint).

## Summary

Phase 82 is pure gating infrastructure. All three primitives mirror existing, verified patterns: `requireAddOn` clones `requireTier` (`packages/api/src/middleware/tier.ts`); the flag-signoff machinery already exists (`packages/feature-flags/src/registry.ts` + `signoff-registry-flags.json`); and US region enablement is the named 4-place change in `packages/db/src/region.ts` + `feature-flag.ts` coercion. The reuse posture is correct — no new architecture is needed.

Two findings DIVERGE from the brief's stated anchors and are the highest-value output of this research. **(1) The boot-time flag-signoff gate `assertFlagSignoffsOrExit()` is DEFINED and TESTED but is NOT CALLED by any app boot path** (verified: not in `apps/api/src/{index,server}.ts`, `apps/public-api/src/index.ts`, or cron-worker boot). FOUND7-02 SC#2 ("boot-time gate exits if any listed flag is missing") therefore requires the planner to (a) wire `assertFlagSignoffsOrExit()` into app boot, and (b) make the v7.0 flags actually *gated* so the existing prefix-based gate enforces them. **(2) `FLAGS` keys are constrained by a Zod regex `^[a-z0-9]+(\.[a-z0-9-]+)+$`** — they MUST be dot-namespaced (e.g. `module.us-expansion`), so the bare keys listed in FOUND7-02 (`us-expansion`, `workforce-employees`, `personio-sync`, …) cannot be added to `FLAGS` verbatim. The planner must decide the canonical dot-namespaced form and the gating mechanism (see Open Questions Q1/Q2).

A third clarification: `DataRegion` is a **pure TypeScript union** (`(typeof SUPPORTED_REGIONS)[number]`), **NOT a Prisma enum**. Region does not exist in `packages/db/prisma/schema/`. This is good news — adding `'US'` to `SUPPORTED_REGIONS` makes TypeScript force-fail compilation at both `REGION_ENV_MAP` and `REPLICA_ENV_MAP` (both `Record<DataRegion, string>`), giving structural lockstep "for free." The 4-place change is really a 5-place change once the feature-flags `regionSchema` enum is counted.

**Primary recommendation:** Treat this as four small, surgical edits with a strong test harness. Add `addOns String[]` to `Subscription` (additive migration); clone `tier.ts` into `add-on.ts` with an `ADD_ON_REQUIRED` JSON error + a centralized add-on-key const; add `'US'`/`DATABASE_URL_US` across the 5 region sites + widen `buildLazyBag`/`regionSchema` to accept US without EU coercion; register all ~20 v7.0 flags in `FLAGS` + `signoff-registry-flags.json` PENDING and WIRE the boot gate; write the IRIS TCC ops doc. Back each SC with a dedicated test (lockstep, boot-gate, allow/deny, doc-exists).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Add-On Billing (FOUND7-01)**
- **D-01:** Entitlement stored as a denormalized `addOns` array on the existing `Subscription` model (NOT a normalized `OrgAddOn` table). `requireAddOn(addOn)` reads from the **same Redis-cached `getSubscription(organizationId)`** that `requireTier` already uses — zero extra query, zero new cache key. Valid add-on keys centralized in one const: `'workforce'`, `'us-cross-border'`.
- **D-02:** `requireAddOn` composes **after** `requireTier` (chain: `auth → tenant → requireTier → requireAddOn → handler`). Throws `TRPCError` `FORBIDDEN` with JSON message `{ type: 'ADD_ON_REQUIRED', requiredAddOn, currentAddOns }`, mirroring `TIER_REQUIRED` exactly. `apps/public-api/src/lib/error-handler.ts` MUST gain an `ADD_ON_REQUIRED` branch alongside the `TIER_REQUIRED` parse.
- **D-03:** Grant mechanism is **admin + seed only**. Entitlement set via `seed-dev.ts` + an owner-gated, audit-logged admin mutation. Real Stripe add-on SKU / price-ID / checkout / webhook-entitlement-sync is **DEFERRED**. Phase 82 ships the entitlement *primitive*, not the purchase flow.

**Feature-Flag Registry + Boot Gate (FOUND7-02)**
- **D-04:** Register **all ~20** v7.0 Unleash flags PENDING in the signoff registry now — the full FOUND7-02 list, including far-future marketplace and per-adapter flags. Boot-time gate exits if any listed flag is missing from the registry.

**US Region Enablement (FOUND7-03)**
- **D-05:** `us-east-1` enabled via the named **4-place atomic change** — `SUPPORTED_REGIONS`, the `DataRegion` enum, `DATABASE_URL_US` env (+ schema), and `buildLazyBag` flag coercion — with a **lockstep test** asserting all four stay in sync. `buildLazyBag` (`packages/api/src/middleware/feature-flag.ts`) must accept `US` **without** coercing to EU.
- **D-06:** `DATABASE_URL_US` is **OPTIONAL** in the env schema. `getRegionalClient('US')` throws only on actual access (existing lazy-throw); seed/migrate scripts **skip-on-missing** (existing pattern). The app boots clean locally with no US DB. The SC#3 lockstep test needs **no live US database**.
- **D-07:** Planner must evaluate whether the **adjacent** region touch points also need a US entry for true lockstep: `packages/db/src/replica.ts` (`REPLICA_ENV_MAP`), `packages/db/scripts/migrate-all-regions.ts` (`REGION_ENV_VARS`), `packages/db/scripts/seed-dev.ts` (region loop). Replica likely needs the entry for consistency; migrate/seed already tolerate missing env via skip-on-missing.

**IRIS TCC Enrollment (SC#4)**
- **D-08:** Artifact = a **planning/ops doc** (e.g. `IRIS-TCC-ENROLLMENT.md` in this phase dir) recording the ~45-day lead + the start-date as a "started calendar dependency", cross-linked to **Phase 86 (US-FORM-05, IRIS XML A2A e-file)**. No app code.

### Claude's Discretion
- Exact add-on key type (string-literal union `const` vs Prisma enum) — planner's call, but it MUST be centralized in one place and shared by middleware + seed + admin mutation.
- Naming of the admin grant mutation and which existing admin/billing router it lands in.
- Whether the lockstep test lives in `packages/db` or `packages/api` — wherever it can assert all four registrations together.

### Deferred Ideas (OUT OF SCOPE)
- **Real Stripe add-on SKU purchase flow** — price IDs, checkout line items, webhook-driven entitlement sync. → billing-go-live work.
- **US read-replica (`DATABASE_URL_US_RO`)** — cross-region read replicas remain off by default per US-INFRA-01; wire only if/when US replicas are provisioned.
- **Normalized `OrgAddOn` table** with per-add-on billing metadata — revisit if add-ons later need independent grant dates / seat counts / billing references.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND7-01 | `requireAddOn(addOn)` tRPC middleware composing after `requireTier`, returns structured `ADD_ON_REQUIRED` error, reads entitlement from `Subscription.addOns`; gates Workforce + US Cross-Border surfaces | `tier.ts` (clone target, lines 31-65), `billing-service.ts` `getSubscription` (returns all Subscription columns via `findUnique` — `addOns` rides along), `billing.prisma` Subscription model (add `addOns String[]`), `error-handler.ts` `extractErrorDetails` (add `ADD_ON_REQUIRED` branch), `audit-writer.ts` + `adminBoeRateRouter` (grant-mutation template) |
| FOUND7-02 | All ~20 v7.0 Unleash flags registered PENDING in the signoff registry with boot-time gate | `flags-core.ts` `FLAGS` (declarations + regex constraint), `signoff-registry-flags.json` (PENDING entries), `registry.ts` `assertFlagSignoffsOrExit` (the gate — currently UNWIRED), `signoff-registry-flags.ts` `GATED_FLAG_NAMESPACE_PREFIXES` + `isGatedFlag` (gating mechanism) |
| FOUND7-03 | `us-east-1` as third region across `SUPPORTED_REGIONS`, `DataRegion`, `DATABASE_URL_US` env+schema, `feature-flag.ts` coercion — all accept `US` without runtime throw (4-place atomic change) | `region.ts` (SUPPORTED_REGIONS + REGION_ENV_MAP + getRegionalClient lazy-throw), `feature-flag.ts` `buildLazyBag` (EU/ME hardcode), `schemas.ts` `regionSchema` (5th place — z.enum), `validators/src/env.ts` (DATABASE_URL_US optional), `replica.ts` + `migrate-all-regions.ts` + `seed-dev.ts` (D-07 adjacents) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Add-on entitlement check (`requireAddOn`) | API / Backend (`packages/api/src/middleware`) | DB (`Subscription.addOns`) | Authorization is a server concern; entitlement source is a tenant-scoped DB column read via the existing Redis-cached service |
| Add-on grant mutation | API / Backend (`packages/api/src/routers/finance/billing.ts`) | DB (Subscription write) + Audit | Owner-gated mutation with `writeAuditLog`; never client-trusted |
| REST error translation (`ADD_ON_REQUIRED`) | API / Backend (`apps/public-api`) | — | The public REST surface translates structured tRPC errors to HTTP JSON |
| Feature-flag declarations + signoff | Shared package (`packages/feature-flags`) | — | Single source of truth; browser-safe core + Node-only boot gate split |
| Boot-time flag gate | App boot (`apps/api`, `apps/public-api`, cron-worker) | feature-flags package | The gate must run in the process entrypoint(s) — currently UNWIRED |
| Region resolution + DB routing | DB package (`packages/db/src/region.ts`) | env schema (`packages/validators`) | Region→client mapping is a DB infrastructure concern; lazy-throw keeps US optional |
| Region→flag-bag coercion | API / Backend (`packages/api/src/middleware/feature-flag.ts`) | feature-flags `regionSchema` | Per-request flag bag is built in tRPC middleware; the Unleash partition enum lives in the flags package |
| IRIS TCC ops doc | Planning artifact (`.planning/phases/82-…/`) | — | Real-world IRS ops action; no app code (D-08) |

## Standard Stack

No new runtime dependencies. Phase 82 is entirely in-tree edits on the existing stack. `[VERIFIED: in-tree]` for every entry below (read directly this session).

### Core (existing, reused)
| Library / Module | Location | Purpose | Why Standard |
|---------|----------|---------|--------------|
| `@trpc/server` v11 | already present | `TRPCError`, `t.middleware` for `requireAddOn` | `requireTier` already uses it; clone 1:1 |
| Prisma 7 (`prisma-client`) | `packages/db` | additive `Subscription.addOns String[]` migration | repo standard; multi-file schema under `prisma/schema/` |
| `@contractor-ops/feature-flags` | `packages/feature-flags` | flag declarations + signoff registry + boot gate | mandated wrapper (no direct Unleash SDK per CLAUDE.md) |
| `@contractor-ops/logger` (Pino) | `packages/logger` | structured logging (no `console.*`) | repo standard |
| `zod` | already present | env schema + add-on input validation | boundaries are Zod-validated per CLAUDE.md |
| `vitest` | `packages/{db,api,feature-flags}/vitest.config.ts` | lockstep + boot-gate + allow/deny tests | each package already has a vitest config |

### Supporting (existing, reused)
| Module | Location | Purpose | When to Use |
|--------|----------|---------|-------------|
| `writeAuditLog` | `packages/api/src/services/audit-writer.ts` | audit the add-on grant mutation | D-03 owner-gated grant |
| `requirePermission` / `adminProcedure` | `packages/api/src/middleware/rbac.ts` | owner-gate the grant mutation | `adminProcedure = requirePermission({ organization: ['update'] })` is the closest template |
| `getSubscription` | `packages/api/src/services/billing-service.ts` | Redis-cached Subscription read | `requireAddOn` reuses verbatim |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `addOns String[]` on Subscription (D-01 LOCKED) | normalized `OrgAddOn` table | Cleaner for per-add-on grant dates / billing refs, but rejected per D-01 + deferred-ideas; revisit only if independent metadata needed |
| String-literal union const for add-on keys | Prisma enum (UPPER_SNAKE_CASE) | Prisma enum gives DB-level validation + audit-enum-casing gate coverage, but a TS const is simpler for a 2-value set; planner's discretion (D Claude's Discretion). NOTE: if a Prisma enum is chosen, values MUST be `UPPER_SNAKE_CASE` (`WORKFORCE`, `US_CROSS_BORDER`) per repo `db:audit-enum-casing` gate, with a display↔storage map. Array element type stays the lowercase wire key per D-01 unless enum chosen. |

**Installation:** None. `pnpm install` not required (no new deps). Schema change requires a migration:
```bash
# after editing packages/db/prisma/schema/billing.prisma
cd packages/db && pnpm prisma migrate dev --name add_subscription_addons
# multi-region apply post-merge: pnpm db:migrate:all (EU then ME) — additive, safe
```

**Version verification:** N/A — no new packages introduced this phase. The Package Legitimacy Audit is therefore not applicable (see below).

## Package Legitimacy Audit

**Not applicable.** Phase 82 installs zero external packages. All work is in-tree edits + an additive Prisma migration. No npm/PyPI/crates surface to slopcheck.

## Architecture Patterns

### System Architecture Diagram

```
                    FOUND7-01 — Add-On Entitlement
  ┌──────────────┐   ┌────────────┐   ┌──────────────┐   ┌──────────────┐
  │ tRPC request │──▶│ auth → tenant│──▶│ requireTier  │──▶│ requireAddOn │──▶ handler
  └──────────────┘   └────────────┘   └──────────────┘   └──────┬───────┘
                                              │                  │ reads ctx.subscription.addOns
                                              ▼                  │ (from requireTier's getSubscription)
                                    getSubscription(orgId)◀──────┘
                                    Redis-cached Subscription
                                              │ on miss → ADD_ON_REQUIRED FORBIDDEN
                                              ▼
                              apps/public-api error-handler
                              extractErrorDetails → parse JSON
                              type==='ADD_ON_REQUIRED' → 403 JSON


                    FOUND7-02 — Flag Registry + Boot Gate
  ┌────────────┐   ┌──────────────────┐   ┌───────────────────────────┐
  │ app boot   │──▶│ assertFlagSignoffs│──▶│ for key in FLAG_KEYS:     │
  │ (UNWIRED!) │   │ OrExit()          │   │   if isGatedFlag(key) &&  │
  └────────────┘   └──────────────────┘   │   no registry entry →     │
                                          │   stderr + process.exit(1)│
                                          └───────────┬───────────────┘
                                     reads ▼          │ reads
                              FLAGS (flags-core.ts)   signoff-registry-flags.json
                              ~20 v7.0 keys PENDING   ~20 PENDING entries


                    FOUND7-03 — US Region (5-place change)
  region=US request
       │
       ▼
  buildLazyBag(ctx.region)  ── must accept 'US' (today: EU/ME hardcode → unknown coerces to EU)
       │                        ALSO widen regionSchema z.enum (feature-flags/schemas.ts) ─┐
       ▼                                                                                    │
  getRegionalClient('US')  ── SUPPORTED_REGIONS must include 'US' (today ['EU','ME'])       │
       │                       REGION_ENV_MAP['US']='DATABASE_URL_US' (Record forces this)  │
       ▼                       lazy-throw if env unset (D-06: optional, safe)               │
  DATABASE_URL_US (optional in validators/env.ts) ─────────────────────────────────────────┘
```

### Recommended Project Structure (files touched)
```
packages/
├── api/src/
│   ├── middleware/
│   │   ├── tier.ts                 # CLONE → add-on.ts (do not modify tier.ts)
│   │   ├── add-on.ts               # NEW — requireAddOn + workforceProcedure/usCrossBorderProcedure
│   │   └── feature-flag.ts         # MODIFY — buildLazyBag accept 'US'
│   ├── routers/finance/billing.ts  # MODIFY — owner-gated grantAddOn mutation (or new admin-add-on router)
│   └── constants/add-ons.ts        # NEW (suggested) — ADD_ON_KEYS const, single source of truth
├── feature-flags/src/
│   ├── flags-core.ts               # MODIFY — add ~20 v7.0 FLAGS entries (dot-namespaced)
│   ├── schemas.ts                  # MODIFY — regionSchema z.enum(['EU','ME','US'])
│   ├── signoff-registry-flags.json # MODIFY — ~20 PENDING entries
│   └── signoff-registry-flags.ts   # MODIFY — add v7.0 gated namespace prefix(es) to GATED_FLAG_NAMESPACE_PREFIXES
├── db/
│   ├── prisma/schema/billing.prisma# MODIFY — Subscription.addOns String[]
│   ├── src/region.ts               # MODIFY — SUPPORTED_REGIONS + REGION_ENV_MAP gain 'US'
│   ├── src/replica.ts              # MODIFY (D-07) — REPLICA_ENV_MAP gains 'US' (Record forces it)
│   └── scripts/{migrate-all-regions,seed-dev}.ts  # EVALUATE (D-07) — REGION_ENV_VARS / region loop
├── validators/src/env.ts           # MODIFY — DATABASE_URL_US optional
apps/
├── api/src/index.ts                # MODIFY — call assertFlagSignoffsOrExit() at boot (UNWIRED today)
└── public-api/src/
    ├── index.ts                    # MODIFY — call assertFlagSignoffsOrExit() at boot
    └── lib/error-handler.ts        # MODIFY — ADD_ON_REQUIRED branch in extractErrorDetails
.planning/phases/82-…/
└── IRIS-TCC-ENROLLMENT.md          # NEW — D-08 ops doc
```

### Pattern 1: `requireAddOn` mirrors `requireTier` exactly
**What:** A `t.middleware` factory that reads the already-attached subscription (or re-reads `getSubscription`) and throws a structured JSON `FORBIDDEN` on miss.
**When to use:** After `requireTier` in the chain. `requireTier` already returns `next({ ctx: { subscription: sub } })`, so `requireAddOn` can read `ctx.subscription.addOns` from the upstream middleware without a second fetch — OR re-call `getSubscription(orgId)` (Redis-cached, cheap) to stay decoupled. Planner's call; reading `ctx.subscription` is the zero-cost option and aligns with D-01 "rides along."
**Example:**
```typescript
// packages/api/src/middleware/add-on.ts  (CLONE of tier.ts lines 31-65)
// Source: in-tree pattern packages/api/src/middleware/tier.ts (read 2026-06-07)
import { TRPCError } from '@trpc/server';
import { t } from '../init';
import { getSubscription } from '../services/billing-service';
import { tenantProcedure } from './tenant';
import { requireTier } from './tier';

export const ADD_ON_KEYS = ['workforce', 'us-cross-border'] as const;
export type AddOnKey = (typeof ADD_ON_KEYS)[number];

export function requireAddOn(addOn: AddOnKey) {
  return t.middleware(async ({ ctx, next }) => {
    const sub = await getSubscription((ctx as { organizationId: string }).organizationId);
    const currentAddOns = sub?.addOns ?? [];
    if (!currentAddOns.includes(addOn)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: JSON.stringify({
          type: 'ADD_ON_REQUIRED',
          requiredAddOn: addOn,
          currentAddOns,
        }),
      });
    }
    return next({ ctx: { subscription: sub } });
  });
}

// Convenience procedures — compose AFTER requireTier (D-02 chain).
// Decide the base tier per add-on with the planner; PRO shown as illustration.
export const workforceProcedure = tenantProcedure
  .use(requireTier('PRO'))
  .use(requireAddOn('workforce'));
export const usCrossBorderProcedure = tenantProcedure
  .use(requireTier('PRO'))
  .use(requireAddOn('us-cross-border'));
```

### Pattern 2: REST error-handler branch (mirror TIER_REQUIRED)
```typescript
// apps/public-api/src/lib/error-handler.ts — extractErrorDetails, after the TIER_REQUIRED branch
// Source: in-tree (read 2026-06-07), lines 51-58
if (parsed.type === 'ADD_ON_REQUIRED') {
  return {
    code: 'ADD_ON_REQUIRED',
    message: `Add-on '${String(parsed.requiredAddOn)}' is required for this resource.`,
  };
}
```

### Pattern 3: Owner-gated, audit-logged grant mutation (D-03)
**What:** A tRPC mutation on `billingRouter` (or a new admin-add-on router) gated by `requirePermission({ organization: ['update'] })` (= the `adminProcedure` template), writes `Subscription.addOns`, calls `writeAuditLog`.
**Audit caveat:** `AuditEntityType` (audit-writer.ts) / `EntityType` enum (contract.prisma:280) has NO `SUBSCRIPTION`/`BILLING` value. Use `resourceType: 'ORGANIZATION'` with `resourceId = organizationId`, OR add a new `EntityType` value (additive enum change — UPPER_SNAKE_CASE). `'ORGANIZATION'` is the lower-risk choice for this phase.
```typescript
// Source: in-tree pattern packages/api/src/routers/core/admin-boe-rate.ts + audit-writer.ts (read 2026-06-07)
grantAddOn: tenantProcedure
  .use(requirePermission({ organization: ['update'] }))
  .input(z.object({ addOn: z.enum(ADD_ON_KEYS) }))
  .mutation(async ({ ctx, input }) => {
    const sub = await ctx.db.subscription.findUnique({ where: { organizationId: ctx.organizationId } });
    // ... merge input.addOn into sub.addOns (dedupe), update, then:
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'subscription.addon.granted',
      resourceType: 'ORGANIZATION',
      resourceId: ctx.organizationId,
      oldValues: { addOns: sub?.addOns ?? [] },
      newValues: { addOns: nextAddOns },
    });
    // Stripe webhook invalidates the subscription cache today; here we should
    // explicitly invalidate CacheKeys.subscription(orgId) so requireAddOn sees
    // the grant immediately (see Pitfall 3).
  }),
```

### Anti-Patterns to Avoid
- **Modifying `tier.ts` to add add-on logic** — clone into `add-on.ts`; `requireTier` stays single-responsibility.
- **Adding bare flag keys to `FLAGS`** — the `flagDefinitionSchema` regex rejects `us-expansion` (no dot). Use dot-namespaced keys.
- **Adding `Subscription` to `globalModels`** — Subscription is correctly tenant-scoped (verified: NOT in `globalModels` set, tenant.ts:41-67). Do not touch globalModels (IDOR landmine).
- **Coercing US→EU in `buildLazyBag`** — the explicit SC#3 failure mode. The `else` branch (feature-flag.ts:33-43) currently warn-coerces unknown→EU; US must get its own branch.
- **Relying on the boot gate without wiring it** — it is currently never called at boot (see Pitfall 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Add-on entitlement read | New Redis cache key + query | `getSubscription(orgId)` (billing-service.ts) | Already Redis-cached; `findUnique` returns all columns so `addOns` rides along (D-01) |
| Structured tRPC→HTTP error | New error class | JSON-in-`message` discriminator (`{type, …}`) parsed in `extractErrorDetails` | Repo convention: `TIER_REQUIRED`, `CLASSIFICATION_ENGINE_DISABLED` all do this |
| Region→env lockstep | Manual assertion list | `Record<DataRegion, string>` types (REGION_ENV_MAP, REPLICA_ENV_MAP) | TS forces every region to have an entry — adding `US` to the union breaks compile until both maps gain `US` |
| Flag signoff schema | New JSON validator | `FlagSignoffRegistrySchema` (signoff-registry-flags-schema.ts) | Zod-validated at module load; PENDING entries need only `{status:'PENDING', notes}` |
| Boot gate | New process.exit guard | `assertFlagSignoffsOrExit()` (registry.ts) | Exists + tested; just needs wiring + gated keys |
| Owner-gate + audit | New permission check | `requirePermission({organization:['update']})` + `writeAuditLog` | Both are repo standards |

**Key insight:** The entire phase is "wire/extend existing primitives," not "build." The single genuinely-new file is `add-on.ts` (a near-verbatim clone of `tier.ts`).

## Runtime State Inventory

Phase 82 touches a rename-adjacent surface (adding a region string `US`, adding flag keys). Inventory per the 5 categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `Subscription.addOns` is NEW (no existing rows carry it) — additive column defaults to empty array. No US org rows exist (verified: seed-dev region union is `'EU'\|'ME'` only). No data migration. | code edit + additive migration only |
| Live service config | Unleash flag toggles live in the Unleash UI, NOT git. Registering ~20 flags in `FLAGS` + signoff JSON is the code half; an operator must also create the toggles in Unleash UI for them to evaluate non-default. For Phase 82 this is irrelevant — all flags ship `default:false` PENDING and no v7.0 feature reads them yet. | none for Phase 82 (operator creates toggles when later phases ship) |
| OS-registered state | None — no OS-level registrations involve region strings or flag keys. Verified: no Task Scheduler / pm2 / systemd references to region or flags. | None |
| Secrets/env vars | `DATABASE_URL_US` is a NEW optional env var (added to `.env.example` + `validators/src/env.ts`). No secret rotation; absent value is the local-dev default (D-06). | add OPTIONAL env entry only |
| Build artifacts | Prisma client regenerates from the additive `Subscription.addOns` change (`prisma generate` runs in the migrate step). No stale egg-info / compiled-binary concern in this monorepo. | `prisma generate` (automatic in migrate) |

**Canonical question — after every file is updated, what runtime state still holds the old shape?** Nothing blocking. The only out-of-git state is Unleash toggles, which are intentionally absent for v7.0 flags until later phases enable them; the `default:false` PENDING posture means a missing toggle evaluates safely OFF.

## Common Pitfalls

### Pitfall 1: The boot-time flag gate is NOT wired into any app (HIGHEST VALUE)
**What goes wrong:** Registering ~20 flags PENDING satisfies the "registry" half of FOUND7-02, but SC#2's "boot-time gate exits if any listed flag is missing" will silently never fire — because `assertFlagSignoffsOrExit()` is exported, re-exported, and unit-tested, but **never called** in `apps/api/src/index.ts`, `apps/api/src/server.ts`, `apps/public-api/src/index.ts`, or cron-worker boot (all verified by grep this session — zero call sites in app code).
**Why it happens:** Phase 72 deliberately changed the gate from a module-load side-effect to an explicit function "the consuming app must call during boot" (registry.ts comment lines 30-40 + boot-gate.test.ts lines 6-11), but no app was ever updated to call it.
**How to avoid:** Phase 82 MUST add `assertFlagSignoffsOrExit()` to the boot path of at least `apps/api` (and ideally public-api + cron-worker). Place it after env load, before serving. Pair with a test that mocks `process.exit` and asserts the gate fires on a missing entry.
**Warning signs:** A plan that only edits `signoff-registry-flags.json` and `flags-core.ts` without touching an app entrypoint has NOT satisfied SC#2.

### Pitfall 2: FLAGS keys must be dot-namespaced — bare FOUND7-02 keys are invalid
**What goes wrong:** Adding `'us-expansion'` to `FLAGS` throws at module load — `flagDefinitionSchema.key` regex is `^[a-z0-9]+(\.[a-z0-9-]+)+$` (schemas.ts:27), requiring at least one dot with an alphanumeric first segment. The existing precedent: Phase 79 used `gulf.free-zone-tracking` (not `gulf-free-zone-tracking`) and Phase 77 used `module.idp-deprovisioning-gws` for exactly this reason (flags-core.ts:157-162).
**Why it happens:** FOUND7-02 lists wire/Unleash-toggle names (`us-expansion`, `workforce-employees`, `personio-sync`, …) which are the human-facing toggle names, not necessarily the `FLAGS`-key form.
**How to avoid:** The planner must choose the canonical dot-namespaced `FLAGS` key for each (e.g. `module.us-expansion`, `module.workforce-employees`, `integration.personio-sync`, `payments.ach-payouts`, `payroll.gusto`, …). Map each FOUND7-02 wire name → a regex-valid `FLAGS` key. See "Full v7.0 flag list" below for a proposed mapping (ASSUMED — needs planner confirmation).
**Warning signs:** Any `FLAGS` entry whose key lacks a dot.

### Pitfall 3: Add-on grant must invalidate the subscription cache
**What goes wrong:** `getSubscription` caches the Subscription in Redis for 15 min (CacheTTL.SUBSCRIPTION). A grant mutation that writes `addOns` without invalidating the cache leaves `requireAddOn` denying access for up to 15 min.
**Why it happens:** Today only Stripe webhooks invalidate the subscription cache; the new admin mutation is a non-Stripe write path.
**How to avoid:** Call the cache-invalidation helper (same one Stripe webhooks use — find via `CacheKeys.subscription(orgId)` consumers) inside the grant mutation after the DB write. Verify with a test: grant → immediately call a `requireAddOn`-gated procedure → succeeds.
**Warning signs:** Grant test passes only after a delay/cache-clear.

### Pitfall 4: `regionSchema` is the hidden 5th place (the "4-place change" is really 5)
**What goes wrong:** `buildLazyBag` builds an `EvalContext` whose `region` is validated by `regionSchema = z.enum(['EU','ME'])` (feature-flags schemas.ts:23). Even if `buildLazyBag` adds a `US` branch, passing `region: 'US'` into `lazyFlagBag`→`evaluate` will fail Zod validation unless `regionSchema` (and the derived `Region` type + `evalContextSchema.region`) also gains `'US'`.
**Why it happens:** The brief names 4 places; the feature-flags `regionSchema` enum is a separate source of truth that `buildLazyBag` feeds into.
**How to avoid:** Widen `regionSchema` to `z.enum(['EU','ME','US'])` as part of the atomic change. The lockstep test should assert `regionSchema.options` and `SUPPORTED_REGIONS` stay in sync too. NOTE: flag `jurisdiction` is still `'EU'|'ME'|'ANY'` (jurisdictionSchema) — US flags should use `jurisdiction:'ANY'` (the jurisdiction field is about flag-visibility partitioning, distinct from the eval-context region; do not add 'US' to jurisdictionSchema unless US-only flag partitioning is wanted — it is not for Phase 82).

### Pitfall 5: `DataRegion` is a TS union, not a Prisma enum (don't look for it in schema/)
**What goes wrong:** A plan that says "add US to the DataRegion Prisma enum" will fail to find one — there is no region in `packages/db/prisma/schema/`. `DataRegion = (typeof SUPPORTED_REGIONS)[number]` (region.ts:9).
**Why it happens:** Region routing is application-level (env-var-driven), not a DB column. `Organization.dataRegion` is stored as a string, not a Prisma enum (verified: seed-dev sets `dataRegion: org.region` as a plain string).
**How to avoid:** Adding `'US'` to the `SUPPORTED_REGIONS` const tuple IS the "enum" change — TypeScript propagates it everywhere `DataRegion` is used and force-fails `REGION_ENV_MAP`/`REPLICA_ENV_MAP` (both `Record<DataRegion,string>`) until they gain a `US` entry. This is the lockstep mechanism.

### Pitfall 6: D-07 adjacents — replica needs US, scripts already tolerate missing
**What goes wrong:** Forgetting `REPLICA_ENV_MAP['US']` is a compile error (it's `Record<DataRegion,string>`, replica.ts:72) — so it CANNOT be forgotten once `SUPPORTED_REGIONS` gains US. But `migrate-all-regions.ts` `REGION_ENV_VARS` (a plain `['DATABASE_URL_EU','DATABASE_URL_ME']` array, line 40) and `seed-dev.ts` region loop (typed `('EU'|'ME')[]`, lines 210/809/900) are NOT `Record<DataRegion>`-typed, so they will NOT compile-fail and US will be silently absent.
**How to avoid:** (a) `replica.ts` REPLICA_ENV_MAP gains `US: 'DATABASE_URL_US_RO'` — forced by the type, harmless (US replica deferred per deferred-ideas, env stays optional/unset). (b) Add `DATABASE_URL_US` to `migrate-all-regions.ts` REGION_ENV_VARS — its `migrateRegion` already skips-on-missing URL (lines 51-53), so this is safe and consistent. (c) `seed-dev.ts` region-loop union → planner's call; D-06 says seed tolerates missing US DB, but the hard-coded `'EU'|'ME'` union types (lines 210, 809, 900, 916, 1009, 1077) would each need widening to seed a US org — for Phase 82 this is optional (no US org needed for the lockstep test). Recommend: widen replica + migrate (low-risk, consistency); defer the full seed-dev US org path to Phase 83 (US-INFRA) unless a US seed org is wanted now.

### Pitfall 7: Add-on key casing if a Prisma enum is chosen
**What goes wrong:** If the planner picks a Prisma enum for add-on keys (Claude's Discretion), values must be `UPPER_SNAKE_CASE` (`WORKFORCE`, `US_CROSS_BORDER`) per the repo `db:audit-enum-casing` gate — but D-01 specifies the wire keys as lowercase (`'workforce'`, `'us-cross-border'`). A storage-vs-display mismatch results.
**How to avoid:** Either (preferred for a 2-value set) use a TS string-literal-union const (lowercase wire keys, no enum gate involvement), OR use a Prisma enum with UPPER_SNAKE values + an explicit `ADD_ON_DISPLAY` map. The error JSON (`requiredAddOn`) and `Subscription.addOns` array elements must agree on one representation end-to-end.

## Code Examples

### Region 4(+1)-place change — region.ts
```typescript
// packages/db/src/region.ts — Source: in-tree (read 2026-06-07)
export const SUPPORTED_REGIONS = ['EU', 'ME', 'US'] as const;   // + 'US'
export type DataRegion = (typeof SUPPORTED_REGIONS)[number];     // auto-propagates

const REGION_ENV_MAP: Record<DataRegion, string> = {
  EU: 'DATABASE_URL_EU',
  ME: 'DATABASE_URL_ME',
  US: 'DATABASE_URL_US',  // TS FORCES this once 'US' is in the union
};
// getRegionalClient + preWarmRegionalClients need NO change — lazy-throw on
// missing DATABASE_URL_US is exactly D-06's desired behavior.
```

### buildLazyBag — accept US without EU coercion
```typescript
// packages/api/src/middleware/feature-flag.ts — Source: in-tree (read 2026-06-07), lines 28-43
let region: 'EU' | 'ME' | 'US';
if (ctx.region === 'ME') region = 'ME';
else if (ctx.region === 'US') region = 'US';   // NEW — no longer falls into the EU else
else if (ctx.region === 'EU') region = 'EU';
else { log.warn(...); region = 'EU'; }          // genuinely-unknown still fails closed
// requires regionSchema = z.enum(['EU','ME','US']) in feature-flags/schemas.ts (Pitfall 4)
```

### Signoff JSON PENDING entry shape
```jsonc
// packages/feature-flags/src/signoff-registry-flags.json — Source: in-tree (read 2026-06-07)
"module.us-expansion": {
  "status": "PENDING",
  "notes": "v7.0 Theme A US cross-border surface gate. Ship dark; flip to APPROVED post-deploy. Engineers develop with FLAG_SIGNOFF_BYPASS=local."
}
// PENDING needs only {status, notes}. APPROVED additionally requires
// approvedBy + approvedAt + approverRole + legalTicketRef (schema refine).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Boot gate as module-load side-effect | Explicit `assertFlagSignoffsOrExit()` the app calls | Phase 72 | App boot must call it — and currently DOES NOT (Pitfall 1) |
| FIRE-primary e-file framing | IRIS-primary (FIRE decommissions 2026-12-31) | v7.0 research | SC#4 IRIS TCC ~45-day clock starts in Phase 82 (D-08) |

**Deprecated/outdated:** Nothing in Phase 82's surface is deprecated. The `signoff-registry.ts` under `packages/validators/src/legal/` is a SEPARATE, unrelated system (Phase 64 legal-disclaimer signoff with `production-deploy` gate timing) — FOUND7-02 targets `packages/feature-flags/src/signoff-registry-flags.{ts,json}` (boot-gate timing). Do not confuse the two (schema comment signoff-registry-flags-schema.ts:1-11 documents the distinction).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dot-namespaced `FLAGS`-key mapping for FOUND7-02 wire names (e.g. `us-expansion` → `module.us-expansion`) is a proposal, not a locked decision | Full v7.0 flag list, Pitfall 2 | Wrong namespace prefix → boot gate doesn't enforce them, or key collides with an existing namespace. Planner/discuss-phase must confirm the canonical form. |
| A2 | The convenience procedures (`workforceProcedure` etc.) should require `PRO` as the base tier before the add-on | Pattern 1 | If the intended base tier differs (STARTER/ENTERPRISE), the composition is wrong. CONTEXT.md does not pin the base tier per add-on — needs confirmation. |
| A3 | Using `resourceType: 'ORGANIZATION'` for the grant audit log (no SUBSCRIPTION EntityType exists) is acceptable | Pattern 3 | If audit consumers expect a dedicated SUBSCRIPTION resourceType, a new `EntityType` enum value is needed (additive). Low risk — ORGANIZATION+orgId is unambiguous. |
| A4 | A new gated namespace prefix (e.g. covering all v7.0 flags) is the mechanism to make the boot gate enforce them | Pitfall 1/2, Open Q2 | If the planner instead extends the gate to enforce ALL declared flags (not just gated-prefix ones), the design differs. Two valid approaches — see Open Q2. |
| A5 | seed-dev.ts does NOT need a US org for Phase 82 (lockstep test needs no live US DB per D-06) | Pitfall 6 | If a US seed org is wanted now, the `'EU'\|'ME'` union widening across ~6 seed-dev sites is in scope. CONTEXT.md D-06 supports deferring. |

**If A1/A2/A4 are confirmed by discuss-phase, they become locked decisions.**

## Open Questions

1. **Canonical `FLAGS`-key namespace for each FOUND7-02 wire name?**
   - What we know: keys must match `^[a-z0-9]+(\.[a-z0-9-]+)+$`; existing namespaces are `module.`, `integration.`, `payments.`, `killswitch.`, `einvoice.`, `gulf.`.
   - What's unclear: whether v7.0 wants `module.us-expansion` / `integration.personio-sync` / `payments.ach-payouts` / `payroll.gusto`, or a single new `v7.` / `gtm.` namespace.
   - Recommendation: propose the mapping in "Full v7.0 flag list" below; confirm in discuss-phase before locking.

2. **Boot-gate enforcement mechanism for v7.0 flags?**
   - What we know: `assertFlagSignoffsOrExit` only enforces flags matching `GATED_FLAG_NAMESPACE_PREFIXES` (signoff-registry-flags.ts:45-56). v7.0 flags are not legal-sensitive in the same way the gulf/compliance/idp ones are.
   - What's unclear: D-04 says "boot-gate exits if any listed flag is missing." Two designs: (a) add v7.0 prefix(es) to `GATED_FLAG_NAMESPACE_PREFIXES` so the existing gate enforces them; or (b) broaden the gate to require a registry entry for EVERY declared flag (stronger, but changes baseline behavior for ALL existing non-gated flags like `payments.bacs-enabled` which today have no registry entry — would break boot unless those are also registered).
   - Recommendation: Option (a) — add a v7.0 gated prefix. It satisfies D-04 for the v7.0 flags without forcing retroactive registry entries on pre-v7.0 flags. Confirm in discuss-phase.

3. **Base tier per add-on?** (see A2) — `requireAddOn` composes after `requireTier`, but which tier? Recommendation: confirm in discuss-phase; default to `PRO`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (EU dev) | additive Subscription migration | ✓ (DATABASE_URL_EU local) | Postgres 17 / Prisma 7 | — |
| `DATABASE_URL_US` | US region resolution | ✗ (intentionally unset) | — | D-06: optional; lazy-throw on access; lockstep test needs no live US DB |
| vitest | all four SC tests | ✓ | per-package configs present | — |
| Unleash (self-hosted) | flag *evaluation* (later phases) | n/a for Phase 82 | — | All v7.0 flags `default:false` PENDING; no feature reads them yet |

**Missing dependencies with no fallback:** None — Phase 82 boots and tests clean locally without a US database.
**Missing dependencies with fallback:** `DATABASE_URL_US` — fallback is "unset," which is the designed local-dev state.

## Validation Architecture

> nyquist_validation: treated as ENABLED (no `.planning/config.json` override read; absent key = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (per-package) |
| Config files | `packages/db/vitest.config.ts`, `packages/api/vitest.config.ts`, `packages/feature-flags/vitest.config.ts` |
| Quick run command | `pnpm --filter @contractor-ops/feature-flags test` (and `--filter @contractor-ops/db`, `--filter @contractor-ops/api` scoped to the new test files) |
| Full suite command | `pnpm test` (turbo → vitest) — note MEMORY.md: NEVER run the full web-vite suite unscoped |
| Typecheck (lockstep enforcer) | `pnpm typecheck` (tsc, CI-canonical) — the `Record<DataRegion,string>` types make the region change a compile-time lockstep |

### Phase Requirements → Test Map
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC#1 | `requireAddOn('workforce')` denies org without add-on (ADD_ON_REQUIRED FORBIDDEN), allows org with it; composes after requireTier | unit | `pnpm --filter @contractor-ops/api test add-on` | ❌ Wave 0 — `packages/api/src/middleware/__tests__/add-on.test.ts` |
| SC#1 | REST error-handler maps ADD_ON_REQUIRED → 403 JSON | unit | `pnpm --filter @contractor-ops/public-api test error-handler` (or wherever public-api tests live) | ❌ Wave 0 |
| SC#1 | grant mutation is owner-gated, audit-logged, cache-invalidating | unit | `pnpm --filter @contractor-ops/api test billing` (extend existing `billing.test.ts`) | ⚠️ extend existing `packages/api/src/routers/__tests__/billing.test.ts` |
| SC#2 | boot gate `process.exit(1)` on a missing required v7.0 flag entry; passes when all present; `FLAG_SIGNOFF_BYPASS=local` downgrades | unit | `pnpm --filter @contractor-ops/feature-flags test boot-gate` (extend existing) | ⚠️ extend `packages/feature-flags/src/__tests__/boot-gate.test.ts` |
| SC#2 | all ~20 v7.0 keys present in BOTH `FLAGS` and `signoff-registry-flags.json` | unit | `pnpm --filter @contractor-ops/feature-flags test signoff` | ❌ Wave 0 — assert each v7.0 key resolves `getFlagSignoff(key) !== undefined` |
| SC#2 | the gate is actually CALLED at app boot | unit/integration | test that boots `apps/api` (or asserts the entrypoint imports+calls `assertFlagSignoffsOrExit`) | ❌ Wave 0 (Pitfall 1) |
| SC#3 | `SUPPORTED_REGIONS`, `regionSchema.options`, `REGION_ENV_MAP` keys, `REPLICA_ENV_MAP` keys all contain identical region sets (lockstep) | unit | `pnpm --filter @contractor-ops/db test region-lockstep` + `pnpm --filter @contractor-ops/api test feature-flag` | ❌ Wave 0 |
| SC#3 | `region=US` → `buildLazyBag` returns a US bag, no EU coercion, no throw | unit | `pnpm --filter @contractor-ops/api test feature-flag` | ❌ Wave 0 |
| SC#3 | `getRegionalClient('US')` does NOT throw "Unsupported data region" (throws only on missing env, lazily) | unit | `pnpm --filter @contractor-ops/db test region` | ❌ Wave 0 |
| SC#4 | `IRIS-TCC-ENROLLMENT.md` exists, records ~45-day lead + start date, cross-links Phase 86 | doc-exists / lint | `test -f .planning/phases/82-…/IRIS-TCC-ENROLLMENT.md && grep -q '45' …` (or a tiny doc-presence test) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** scoped quick run for the touched package (e.g. `pnpm --filter @contractor-ops/feature-flags test`).
- **Per wave merge:** `pnpm typecheck` (the region lockstep is a compile-time gate) + scoped tests for db/api/feature-flags/public-api.
- **Phase gate:** full scoped suite green + `pnpm lint:schema lint:audit-log lint:logs i18n:parity` (per Standing Constraint) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/api/src/middleware/__tests__/add-on.test.ts` — covers SC#1 allow/deny + chain order
- [ ] `packages/db/src/__tests__/region-lockstep.test.ts` (or in api) — covers SC#3 four-way lockstep
- [ ] extend `packages/feature-flags/src/__tests__/boot-gate.test.ts` — covers SC#2 exit-on-missing for a v7.0 gated key
- [ ] `packages/feature-flags/src/__tests__/v7-flags-registered.test.ts` — covers SC#2 all-keys-present
- [ ] public-api error-handler test for ADD_ON_REQUIRED branch — covers SC#1 REST mapping
- [ ] doc-presence check for IRIS-TCC-ENROLLMENT.md — covers SC#4

*(No fixture/conftest gaps — vitest configs already exist per package.)*

## Project Constraints (from CLAUDE.md)

- `semble search` before grep (used for discovery; grep used only for exhaustive literal scans this session).
- No `console.*` in app source → `@contractor-ops/logger` (the existing `tier.ts`/`feature-flag.ts` use `createLogger`).
- Feature flags ONLY via `@contractor-ops/feature-flags` wrapper — keys declared in `flags-core.ts`, never direct Unleash SDK in apps.
- Zod at all boundaries — add-on grant input + env schema must be Zod-validated.
- `writeAuditLog` on sensitive mutations — the add-on grant qualifies (D-03 "audit-logged").
- Prisma enum values `UPPER_SNAKE_CASE` (`db:audit-enum-casing` gate) — relevant ONLY if add-on keys become a Prisma enum (Pitfall 7).
- No hardcoded user-facing strings; i18n parity en/de/pl/ar (+ en-US for v7.0 US surfaces). NOTE: Phase 82 ships NO user-facing UI strings (pure middleware/infra); `en-US.json` does not yet exist (it's a Phase 84 deliverable). If the SPA gains an ADD_ON_REQUIRED upgrade-prompt, its copy must be i18n'd — but per CONTEXT.md integration-points note, the SPA client handling can mirror `useFeatureGate`; confirm scope with planner (likely Phase 82 ships the primitive + REST handling, SPA prompt is consumed by later revenue-gated phases).
- 7-day release age for deps — N/A (no new deps).
- NEVER add tenant-owning models to `globalModels` (IDOR) — Subscription is already correctly tenant-scoped; no change.
- `.planning/phases` is a symlink → commits stage via real `.planning/milestones/v7.0-phases/` path (planner/executor concern).
- Read-before-Edit on existing files; Edit > Write; minimal diff.

## Sources

### Primary (HIGH confidence) — all read in-tree 2026-06-07
- `packages/api/src/middleware/tier.ts` — `requireTier` factory, TIER_REQUIRED shape, `proProcedure`/`enterpriseProcedure`
- `packages/api/src/services/billing-service.ts` — `getSubscription` (findUnique, no select → addOns rides along; Redis cache via `cached(CacheKeys.subscription, CacheTTL.SUBSCRIPTION)`)
- `packages/db/prisma/schema/billing.prisma` — Subscription model (NO addOns today), SubscriptionTier/Status enums
- `apps/public-api/src/lib/error-handler.ts` — `extractErrorDetails` TIER_REQUIRED branch (lines 51-58)
- `packages/db/src/region.ts` — SUPPORTED_REGIONS (`['EU','ME']`), DataRegion (TS union), REGION_ENV_MAP, getRegionalClient (lazy-throw), preWarmRegionalClients (skip-on-missing)
- `packages/db/src/replica.ts` — REPLICA_ENV_MAP (`Record<DataRegion,string>`, lines 72-75)
- `packages/api/src/middleware/feature-flag.ts` — `buildLazyBag` (EU/ME hardcode + unknown→EU coercion, lines 22-50), tenantFlaggedProcedure
- `packages/feature-flags/src/registry.ts` — `assertFlagSignoffsOrExit` (the gate; lines 60-85)
- `packages/feature-flags/src/flags-core.ts` — FLAGS const, FLAG_KEYS, deepFreeze, key precedents (gulf./module.idp-)
- `packages/feature-flags/src/schemas.ts` — flagDefinitionSchema key regex (line 27), regionSchema (line 23), evalContextSchema
- `packages/feature-flags/src/signoff-registry-flags.{json,ts}` + `-schema.ts` — PENDING entry shape, GATED_FLAG_NAMESPACE_PREFIXES, isGatedFlag, getFlagSignoff
- `packages/feature-flags/src/flag-bag.ts` — lazyFlagBag / buildFlagBag (EvalContext consumer)
- `packages/feature-flags/src/__tests__/boot-gate.test.ts` — confirms gate is explicit-call + currently no gated FLAGS fire
- `apps/api/src/{index,server}.ts`, `apps/public-api/src/index.ts` — confirmed NO assertFlagSignoffsOrExit call (boot-gate UNWIRED finding)
- `packages/validators/src/env.ts` — DATABASE_URL_{EU,ME} required; _RO optional (template for DATABASE_URL_US optional)
- `packages/db/scripts/migrate-all-regions.ts` — REGION_ENV_VARS array + skip-on-missing
- `packages/db/scripts/seed-dev.ts` — region union `'EU'|'ME'`, seedSubscription (line 5153), subscription.create
- `packages/api/src/services/audit-writer.ts` — writeAuditLog signature, AuditEntityType (no SUBSCRIPTION)
- `packages/db/prisma/schema/contract.prisma:280` — EntityType enum values
- `packages/api/src/middleware/rbac.ts` — requirePermission, adminProcedure (= organization:update)
- `packages/api/src/routers/core/admin-boe-rate.ts` — owner-gated mutation + logging template
- `packages/db/src/tenant.ts:41-67` — globalModels set (Subscription NOT present → correctly tenant-scoped)
- `packages/api/src/middleware/require-classification-flag.ts` — flag-off FORBIDDEN pattern (v5.0)

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — IRIS-PRIMARY correction, reuse map, 4-place finding, "decide addOns vs OrgAddOn in Phase 0"

### Tertiary (LOW confidence)
- None — every Phase-82 claim is grounded in a direct in-tree read.

## Metadata

**Confidence breakdown:**
- Add-on billing (FOUND7-01): HIGH — `tier.ts` clone is verbatim; getSubscription/Subscription/error-handler/audit/rbac all read directly. Only open item is base-tier-per-add-on (A2).
- Flag registry + boot gate (FOUND7-02): HIGH on the facts; the load-bearing CORRECTIONS (gate unwired, key-regex constraint, gated-prefix mechanism) are verified. The exact key-namespace mapping is ASSUMED (A1) pending discuss-phase.
- US region (FOUND7-03): HIGH — all 5 places located; the `Record<DataRegion>` lockstep mechanism + lazy-throw + D-07 adjacents fully traced.
- IRIS TCC (SC#4): HIGH — pure doc artifact per D-08; content requirements clear.

**Research date:** 2026-06-07
**Valid until:** ~2026-07-07 (stable in-tree patterns; re-verify only if `tier.ts`, `region.ts`, or the feature-flags signoff machinery is refactored before planning).

---

## Appendix: Full v7.0 flag list (FOUND7-02 verbatim + proposed FLAGS-key mapping)

The ~20 flags from REQUIREMENTS.md FOUND7-02, verbatim, with a PROPOSED dot-namespaced `FLAGS`-key (ASSUMED — A1; confirm in discuss-phase). All register `default:false`, `jurisdiction:'ANY'` (US flags do NOT use a US jurisdiction — see Pitfall 4), `status:'PENDING'`.

| # | FOUND7-02 wire name | Proposed FLAGS key (regex-valid) | Theme |
|---|----------------------|----------------------------------|-------|
| 1 | `us-expansion` | `module.us-expansion` | A |
| 2 | `workforce-employees` | `module.workforce-employees` | B |
| 3 | `personio-sync` | `integration.personio-sync` | B |
| 4 | `bamboohr-sync` | `integration.bamboohr-sync` | B |
| 5 | `ach-payouts` | `payments.ach-payouts` | A |
| 6 | `iris-efile` | `module.iris-efile` | A |
| 7 | `public-api` | `module.public-api` | C |
| 8 | `outbound-webhooks` | `module.outbound-webhooks` | C |
| 9 | `integration-marketplace-zapier` | `integration.marketplace-zapier` | C |
| 10 | `integration-marketplace-n8n` | `integration.marketplace-n8n` | C |
| 11 | `integration-marketplace-make` | `integration.marketplace-make` | C |
| 12 | `payroll-symfonia` | `payroll.symfonia` | B |
| 13 | `payroll-comarch` | `payroll.comarch` | B |
| 14 | `payroll-enova` | `payroll.enova` | B |
| 15 | `payroll-datev` | `payroll.datev` | B |
| 16 | `payroll-sage-uk` | `payroll.sage-uk` | B |
| 17 | `payroll-gusto` | `payroll.gusto` | B |
| 18 | `payroll-quickbooks` | `payroll.quickbooks` | B |
| 19 | `payroll-adp` | `payroll.adp` | B |

**= 19 flags.** (CONTEXT.md/ROADMAP say "~20"; the FOUND7-02 enumeration yields 19 distinct keys: 8 named module/integration + 3 marketplace + 8 payroll adapters = 19.) The BACKLOG Standing-Constraints list additionally mentions `irs-fire-efile` as a legacy fallback flag — if the planner wants FIRE-fallback gated too, that is a 20th (`module.irs-fire-efile`). Confirm count + the `payroll.*` namespace (new — `flagCategorySchema` has no `payroll` category; either add `'payroll'` to `flagCategorySchema` in schemas.ts, OR namespace payroll adapters under an existing category like `integration.payroll-gusto`). This category gap is an ADDITIONAL edit the planner must account for. RECOMMENDATION: use `integration.payroll-<adapter>` to avoid adding a new flag category, OR add `'payroll'` to `flagCategorySchema` — planner's call (lean to the latter for clarity; it's a one-line additive enum change).

Each gets a one-line `signoff-registry-flags.json` PENDING entry and a `FLAGS` declaration. To make the boot gate enforce them (Open Q2 / A4), add a v7.0 gated prefix (e.g. `'module.us-'`, `'module.workforce-'`, `'module.iris-'`, `'module.public-api'`, `'module.outbound-'`, `'integration.personio-'`, `'integration.bamboohr-'`, `'integration.marketplace-'`, `'payments.ach-'`, `'payroll.'`) — OR, cleaner, a single sentinel prefix if the keys are restructured under one namespace. The simplest robust design: add a dedicated test asserting `getFlagSignoff(key) !== undefined` for every key in an explicit `V7_FLAG_KEYS` array, AND wire `assertFlagSignoffsOrExit()` at boot with the v7.0 prefixes added to `GATED_FLAG_NAMESPACE_PREFIXES`.

## RESEARCH COMPLETE
