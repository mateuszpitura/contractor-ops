# Phase 82: v7.0 Foundation — Add-On Billing + Flag Registry + US Region Enablement - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 18 (CREATE: 4 · MODIFY: 13 · ops-doc: 1)
**Analogs found:** 17 / 18 (only the IRIS TCC ops doc has no analog — by design, D-08)

> Every analog below was read in-tree this session. RESEARCH.md line-number anchors were
> verified; two minor corrections are flagged inline (`error-handler` branch is lines 51-57
> not 51-58; `feature-flag.ts` US-coercion target is lines 28-43 inside `buildLazyBag`
> 22-50). All other anchors confirmed exact.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/api/src/middleware/add-on.ts` (CREATE) | middleware | request-response (auth gate) | `packages/api/src/middleware/tier.ts` | exact (1:1 clone) |
| `packages/api/src/constants/add-ons.ts` (CREATE, suggested) | utility/const | — | `ADD_ON_KEYS` block inside `tier.ts`'s `TIER_RANK` style; or `flags-core.ts` `*_FLAG` consts | role-match |
| `packages/db/prisma/schema/billing.prisma` (MODIFY) | model | CRUD | `Subscription` model (same file, existing scalar/array fields) | exact (same model) |
| `apps/public-api/src/lib/error-handler.ts` (MODIFY) | utility (error translation) | request-response | `TIER_REQUIRED` branch in same file (lines 53-57) | exact (same file) |
| `packages/api/src/routers/finance/billing.ts` (MODIFY — `grantAddOn`) | route/controller | CRUD + event (audit) | `admin-boe-rate.ts` mutations + `adminProcedure` sites in same `billing.ts` | exact (same file + sibling) |
| `packages/db/scripts/seed-dev.ts` (MODIFY — seed grant) | script | batch/seed | `seedSubscription` (lines 5153-5199) | exact (same fn) |
| `packages/feature-flags/src/flags-core.ts` (MODIFY — 19 keys + `V7_FLAG_KEYS`) | config | — | existing `FLAGS` entries (`gulf.*`, `module.idp-deprovisioning-*`) | exact (same const) |
| `packages/feature-flags/src/signoff-registry-flags.json` (MODIFY — 19 PENDING) | config (data) | — | existing PENDING entries (e.g. `module.idp-deprovisioning-gws`) | exact (same file) |
| `packages/feature-flags/src/signoff-registry-flags.ts` (MODIFY — prefixes) | config | — | `GATED_FLAG_NAMESPACE_PREFIXES` array (lines 45-52) | exact (same const) |
| `packages/feature-flags/src/schemas.ts` (MODIFY — `'payroll'` + `regionSchema` US) | config (schema) | — | `flagCategorySchema` enum (6-15) + `regionSchema` (23) | exact (same enums) |
| `apps/api/src/index.ts` (MODIFY — wire gate) | config (boot) | — | env-load + adapter-register sequence in `main()` (lines 40-55) | role-match |
| `apps/public-api/src/index.ts` (MODIFY — wire gate) | config (boot) | — | `required` env-var loop + `preWarmRegionalClients` (lines 52-77) | role-match |
| `apps/cron-worker/src/index.ts` (MODIFY — wire gate) | config (boot) | — | `loadEnv()` + job-schedule sequence in `main()` (lines 36-51) | role-match |
| `packages/db/src/region.ts` (MODIFY — US) | config (infra) | — | `SUPPORTED_REGIONS` + `REGION_ENV_MAP` (8-18) | exact (same const) |
| `packages/db/src/replica.ts` (MODIFY — US) | config (infra) | — | `REPLICA_ENV_MAP` (72-75) | exact (same const) |
| `packages/api/src/middleware/feature-flag.ts` (MODIFY — `buildLazyBag` US) | middleware | request-response | `buildLazyBag` region branch (28-43) | exact (same fn) |
| `packages/validators/src/env.ts` (MODIFY — `DATABASE_URL_US` optional) | config (schema) | — | `DATABASE_URL_*_RO` optional vars (32-33) | exact (same schema) |
| `packages/db/scripts/migrate-all-regions.ts` (MODIFY — D-07 adjacent) | script | batch | `REGION_ENV_VARS` + `migrateRegion` skip-on-missing (40-68) | exact (same fn) |
| `IRIS-TCC-ENROLLMENT.md` (CREATE, this phase dir) | doc | — | **NO ANALOG (D-08, ops doc — intentional)** | none |

---

## Pattern Assignments

### `packages/api/src/middleware/add-on.ts` (middleware, request-response) — CREATE

**Analog:** `packages/api/src/middleware/tier.ts` (read in full; 82 lines). Clone 1:1.

**Imports pattern** (tier.ts lines 1-5):
```typescript
import type { SubscriptionTier } from '@contractor-ops/db/generated/prisma/client';
import { TRPCError } from '@trpc/server';
import { t } from '../init';
import { getSubscription } from '../services/billing-service';
import { tenantProcedure } from './tenant';
```
For `add-on.ts` add `import { requireTier } from './tier';` (D-11 chain) and import `ADD_ON_KEYS`
from the shared const (see `constants/add-ons.ts` below).

**Core pattern — structured-JSON FORBIDDEN factory** (tier.ts lines 31-65, the exact shape to mirror):
```typescript
export function requireTier(minimumTier: SubscriptionTier) {
  return t.middleware(async ({ ctx, next }) => {
    const sub = await getSubscription(
      (ctx as unknown as { organizationId: string }).organizationId,
    );
    if (!sub || (sub.status !== 'ACTIVE' && sub.status !== 'TRIALING')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: JSON.stringify({
          type: 'TIER_REQUIRED',
          requiredTier: minimumTier,
          currentTier: null,
        }),
      });
    }
    // … rank check …
    return next({ ctx: { subscription: sub } });
  });
}
```
`requireAddOn(addOn)` mirrors this verbatim — same `getSubscription(orgId)` read (D-01: `addOns`
rides along on the cached object, no second query), same `TRPCError FORBIDDEN`, but the JSON is
`{ type: 'ADD_ON_REQUIRED', requiredAddOn: addOn, currentAddOns: sub?.addOns ?? [] }` (D-02). The
deny condition is `!currentAddOns.includes(addOn)`.

**Convenience-procedure pattern** (tier.ts lines 75-81, the exact `.use()` composition to mirror):
```typescript
export const proProcedure = tenantProcedure.use(requireTier('PRO'));
export const enterpriseProcedure = tenantProcedure.use(requireTier('ENTERPRISE'));
```
Per **D-11**, the v7.0 convenience procedures compose `tenantProcedure → requireTier('STARTER') → requireAddOn(addOn)`
(STARTER floor = "any active subscription"; add-on is tier-independent):
```typescript
export const workforceProcedure = tenantProcedure
  .use(requireTier('STARTER'))
  .use(requireAddOn('workforce'));
export const usCrossBorderProcedure = tenantProcedure
  .use(requireTier('STARTER'))
  .use(requireAddOn('us-cross-border'));
```
> CORRECTION vs RESEARCH Pattern 1 / Assumption A2: RESEARCH illustrated `requireTier('PRO')`;
> CONTEXT D-11 **locks the base tier to `STARTER`**. Use `STARTER`.

**Anti-pattern (RESEARCH-confirmed):** do NOT add add-on logic into `tier.ts` — clone into a new file; `requireTier` stays single-responsibility.

---

### `packages/api/src/constants/add-ons.ts` (utility/const) — CREATE (suggested, Claude's Discretion)

**Analog:** the typed-const-with-derived-union idiom used across the repo, e.g. `flags-core.ts`
`FLAG_KEYS = Object.keys(FLAGS) as FlagKey[]` and the `*_FLAG` const aliases (lines 211-229), and
`SUPPORTED_REGIONS` / `DataRegion` (region.ts 8-9).

```typescript
export const ADD_ON_KEYS = ['workforce', 'us-cross-border'] as const;
export type AddOnKey = (typeof ADD_ON_KEYS)[number];
```
Single source of truth shared by `add-on.ts`, the grant mutation input (`z.enum(ADD_ON_KEYS)`), and
`seed-dev.ts`. Per **CONTEXT Claude's Discretion + RESEARCH Pitfall 7**: prefer this lowercase
TS string-literal-union over a Prisma enum (a 2-value set does not justify the
`UPPER_SNAKE_CASE` + display-map ceremony the `db:audit-enum-casing` gate would force). The
`Subscription.addOns String[]` element type stays the lowercase wire key.

---

### `packages/db/prisma/schema/billing.prisma` (model, CRUD) — MODIFY

**Analog:** the `Subscription` model itself (lines 3-24, same file). Existing scalar + default
patterns to mirror for an additive, non-breaking column:
```prisma
model Subscription {
  id                String  @id @default(cuid())
  organizationId    String  @unique
  …
  seatCount         Int     @default(1)
  cancelAtPeriodEnd Boolean @default(false)
}
```
Add `addOns String[] @default([])` (Postgres text array, defaults empty → existing rows safe; no
data migration). Element type = the lowercase wire key (`'workforce'`, `'us-cross-border'`). No
enum (see `constants/add-ons.ts` note + RESEARCH Pitfall 7). Migration:
`cd packages/db && pnpm prisma migrate dev --name add_subscription_addons`.

> NOTE (RESEARCH-confirmed): `getSubscription` uses bare `findUnique` with no `select`
> (billing-service.ts:80-86) so `addOns` rides along the cached object for free — confirming D-01.

---

### `apps/public-api/src/lib/error-handler.ts` (utility, request-response) — MODIFY

**Analog:** the `TIER_REQUIRED` branch inside `extractErrorDetails` (same file, lines 51-57).

> CORRECTION vs RESEARCH Pattern 2 (which cited "lines 51-58"): the actual JSON-parse +
> `TIER_REQUIRED` branch spans **lines 51-57**; the `catch` is 60-62. Insert the new branch
> immediately after the `TIER_REQUIRED` `if` (before the closing of the `try`).

**Pattern to mirror** (lines 51-57):
```typescript
try {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed.type === 'TIER_REQUIRED') {
    return {
      code: 'TIER_REQUIRED',
      message: `Subscription tier ${String(parsed.requiredTier)} is required.`,
    };
  }
  …
```
Add (D-02):
```typescript
if (parsed.type === 'ADD_ON_REQUIRED') {
  return {
    code: 'ADD_ON_REQUIRED',
    message: `Add-on '${String(parsed.requiredAddOn)}' is required for this resource.`,
  };
}
```
`ADD_ON_REQUIRED` rides the existing `FORBIDDEN → 403` map (TRPC_TO_HTTP, lines 13-27 — no new
status mapping needed; the `code` is surfaced in the JSON body via `formatErrorResponse`).

---

### `packages/api/src/routers/finance/billing.ts` (route/controller, CRUD + audit) — MODIFY: add `grantAddOn`

**Analogs:** (a) owner-gated `adminProcedure` mutations already in this file (lines 126, 202, 244,
280); (b) `admin-boe-rate.ts` for the permission-gate + cache-invalidate + log shape; (c)
`audit-writer.ts` `writeAuditLog`.

**Owner-gate pattern** — `billing.ts` already imports and uses `adminProcedure` (line 8); use it
directly (it IS `tenantProcedure.use(requirePermission({ organization: ['update'] }))`, rbac.ts:67):
```typescript
// billing.ts head (existing imports to reuse):
import { adminProcedure } from '../../middleware/rbac';
import { writeAuditLog } from '../../services/audit-writer';
import { getSubscription } from '../../services/billing-service';
```
> NOTE vs RESEARCH Pattern 3 (which spelled `tenantProcedure.use(requirePermission({organization:['update']}))`):
> prefer the existing `adminProcedure` alias — it is the exact same gate and is already the
> file's owner-gating convention (4 sibling mutations use it).

**Mutation + audit + cache-invalidate pattern** (compose: `admin-boe-rate.ts` insert mutation lines
43-86 for the input/log/invalidate skeleton + `audit-writer.ts` `writeAuditLog` call):
```typescript
grantAddOn: adminProcedure
  .input(z.object({ addOn: z.enum(ADD_ON_KEYS) }))
  .mutation(async ({ ctx, input }) => {
    const sub = await ctx.db.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    // … merge input.addOn into sub.addOns, dedupe → nextAddOns; update Subscription …
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'subscription.addon.granted',
      resourceType: 'ORGANIZATION',          // AuditEntityType has NO SUBSCRIPTION value
      resourceId: ctx.organizationId,
      oldValues: { addOns: sub?.addOns ?? [] },
      newValues: { addOns: nextAddOns },
      tx,                                     // pass tx when the update runs in a transaction
    });
    await invalidate(CacheKeys.subscription(ctx.organizationId)); // see Cache pitfall below
  }),
```

**Audit resourceType** (RESEARCH-confirmed, audit-writer.ts:28-44): `AuditEntityType` union has
**no `SUBSCRIPTION`/`BILLING`** member — use `resourceType: 'ORGANIZATION'` with
`resourceId = organizationId` (lowest-risk; A3). Adding a new `EntityType` enum value is the
alternative but unnecessary for this phase.

**CACHE INVALIDATION (RESEARCH Pitfall 3 — load-bearing):** `getSubscription` is Redis-cached 15
min (`cached(CacheKeys.subscription(orgId), CacheTTL.SUBSCRIPTION, …)`, billing-service.ts:80-86).
The grant is a non-Stripe write path, so it MUST call `invalidate(CacheKeys.subscription(orgId))`
after the DB write — analogs: `CacheKeys.subscription` (cache.ts:299), `invalidate(...keys)`
(cache.ts:243). Without this, `requireAddOn` denies for up to 15 min post-grant.

---

### `packages/db/scripts/seed-dev.ts` (script, seed) — MODIFY: seed an add-on grant

**Analog:** `seedSubscription` (lines 5153-5199) — the `prisma.subscription.create({ data: {…} })`
call. Add `addOns: [...]` to the seeded `data` for the org(s) that should carry the entitlement
(e.g. the QA-default / showcase org), using the same `ADD_ON_KEYS` const. The seed `data` block
already enumerates every Subscription field (lines 5179-5198) — `addOns` slots in alongside
`seatCount`.

> The `'EU' | 'ME'` region-loop unions in seed-dev (lines 210, 810, 900, 902, 916, 1009, 1077,
> 7477, 7762, 7873, 7889, 8090) are a SEPARATE concern (US region, FOUND7-03). Per **D-06 + RESEARCH
> Pitfall 6 / A5**, widening these to seed a US org is OPTIONAL for Phase 82 (the lockstep test
> needs no live US DB / US org). Defer the full US seed-org path unless a US seed org is explicitly
> wanted. The add-on seed touch above is independent of region.

---

### `packages/feature-flags/src/flags-core.ts` (config) — MODIFY: 19 v7.0 FLAGS + `V7_FLAG_KEYS`

**Analog:** existing `FLAGS` entries — the closest precedents are the **Phase 79 `gulf.*`**
(lines 189-206) and **Phase 77 `module.idp-deprovisioning-*`** (lines 163-180) blocks, which were
dot-namespaced precisely to satisfy the key regex.

**Entry shape to clone** (gulf.free-zone-tracking, lines 189-197):
```typescript
'gulf.free-zone-tracking': {
  key: 'gulf.free-zone-tracking',
  description: '…',
  default: false,
  category: 'module',
  jurisdiction: 'ME',
  owner: 'gulf-platform',
},
```
Each of the 19 v7.0 keys gets one entry with `default: false`, `jurisdiction: 'ANY'`
(RESEARCH Pitfall 4: US flags use `'ANY'`, NOT a US jurisdiction — `jurisdictionSchema` stays
EU/ME/ANY), and the dot-namespaced key (D-09). **Canonical 19-key mapping (D-09, locked):**

| FLAGS key | category | FLAGS key | category |
|-----------|----------|-----------|----------|
| `module.us-expansion` | module | `payroll.symfonia` | payroll |
| `module.workforce-employees` | module | `payroll.comarch` | payroll |
| `module.public-api` | module | `payroll.enova` | payroll |
| `module.outbound-webhooks` | module | `payroll.datev` | payroll |
| `module.iris-efile` | module | `payroll.sage-uk` | payroll |
| `integration.personio-sync` | integration | `payroll.gusto` | payroll |
| `integration.bamboohr-sync` | integration | `payroll.quickbooks` | payroll |
| `integration.marketplace-zapier` | integration | `payroll.adp` | payroll |
| `integration.marketplace-n8n` | integration | | |
| `integration.marketplace-make` | integration | `payments.ach-payouts` | payments |

> The 8 `payroll.*` keys require the **new `'payroll'` category** in `schemas.ts` (see next).
> `module.irs-fire-efile` (legacy FIRE fallback) is the optional 20th — include only if the planner
> wants FIRE-fallback gated. Bare wire names (`us-expansion`, etc.) are INVALID against the key
> regex `^[a-z0-9]+(\.[a-z0-9-]+)+$` (RESEARCH Pitfall 2) — must be dot-namespaced.

**`V7_FLAG_KEYS` cohort const** (D-10) — mirror `FLAG_KEYS` (line 211):
```typescript
export const V7_FLAG_KEYS = [
  'module.us-expansion', 'module.workforce-employees', /* … all 19 … */
] as const satisfies readonly FlagKey[];
```
This explicit cohort backs the SC#2 "all keys present" test (`getFlagSignoff(key) !== undefined`
for each) — namespace-agnostic, no behavior change for existing flags.

---

### `packages/feature-flags/src/signoff-registry-flags.json` (config data) — MODIFY: 19 PENDING entries

**Analog:** existing PENDING entries — e.g. `module.idp-deprovisioning-gws` (lines 6-8) and
`gulf.free-zone-tracking` (lines 90-92). The PENDING shape needs only `{status, notes}` (APPROVED
additionally needs `approvedBy`/`approvedAt`/`approverRole`/`legalTicketRef`, per
`signoff-registry-flags-schema.ts:33-42).

**Entry shape to clone** (lines 6-8):
```jsonc
"module.idp-deprovisioning-gws": {
  "status": "PENDING",
  "notes": "F2 Phase 77 — … Ship dark; flip to APPROVED post-deploy … FLAG_SIGNOFF_BYPASS=local."
}
```
Add one PENDING entry per v7.0 key, keyed identically to the `FLAGS` key, with a one-line note
("v7.0 Theme … gate. Ship dark; flip APPROVED post-deploy. Engineers dev with FLAG_SIGNOFF_BYPASS=local.").

> This is the **boot-gate signoff registry** (`packages/feature-flags/src/`) — NOT the Phase-64
> legal-disclaimer registry under `packages/validators/src/legal/signoff-registry.ts` (different
> system, different timing — see CONTEXT anchor correction + RESEARCH State-of-the-Art).

---

### `packages/feature-flags/src/signoff-registry-flags.ts` (config) — MODIFY: gated prefixes

**Analog:** `GATED_FLAG_NAMESPACE_PREFIXES` array + `isGatedFlag` (lines 45-56, same file).
```typescript
export const GATED_FLAG_NAMESPACE_PREFIXES = [
  'compliance-', 'idp-deprovisioning', 'module.idp-deprovisioning',
  'gulf-', 'gulf.', 'offboarding-ip-',
] as const satisfies readonly string[];
```
Per **D-10** (belt-and-suspenders) add the v7.0 prefixes so the existing prefix-based gate enforces
them (e.g. `'module.us-'`, `'module.workforce-'`, `'module.iris-'`, `'module.public-api'`,
`'module.outbound-'`, `'integration.personio-'`, `'integration.bamboohr-'`,
`'integration.marketplace-'`, `'payments.ach-'`, `'payroll.'`). Do **NOT** broaden the gate to all
declared flags — that would break boot for existing non-gated flags like `payments.bacs-enabled`
that have no registry entry (D-10, RESEARCH Open Q2 → Option a).

---

### `packages/feature-flags/src/schemas.ts` (config schema) — MODIFY: `'payroll'` + `regionSchema` US

**Two additive enum edits in one file.**

(1) **`flagCategorySchema`** (lines 6-15) — add `'payroll'` (D-09, one-line):
```typescript
export const flagCategorySchema = z.enum([
  'module', 'integration', 'experiment', 'kill-switch',
  'ops', 'ui', 'billing', 'payments', 'payroll',   // + 'payroll'
]);
```

(2) **`regionSchema`** (line 23) — the **hidden 5th place** of the US lockstep (RESEARCH Pitfall 4):
```typescript
export const regionSchema = z.enum(['EU', 'ME', 'US']);   // + 'US'
```
`evalContextSchema.region` (line 53) derives from this, so widening here is what lets
`buildLazyBag`'s US bag pass Zod validation downstream. Leave `jurisdictionSchema` (line 3) as
`['EU','ME','ANY']` — do NOT add 'US' there (US flags use `jurisdiction:'ANY'`).

---

### `apps/api/src/index.ts` · `apps/public-api/src/index.ts` · `apps/cron-worker/src/index.ts` (boot) — MODIFY: WIRE the gate

**Analog (the unwired gate):** `assertFlagSignoffsOrExit()` in
`packages/feature-flags/src/registry.ts` (lines 60-85). **VERIFIED UNWIRED** this session — zero
call sites in any of the three entrypoints (RESEARCH Pitfall 1 confirmed). It honors
`FLAG_SIGNOFF_BYPASS=local` (warn instead of `process.exit(1)`).

**Wire points (mirror each app's existing post-env boot sequence):**
- `apps/api/src/index.ts` — inside `main()`, after `const env = loadEnv();` (line 41), before
  `buildServer`. Analog sequence: lines 40-55 (env load → adapter register → buildServer).
- `apps/public-api/src/index.ts` — after the `required` env-var check loop (lines 52-57), before
  `await preWarmRegionalClients()` (line 77). Mirror the existing top-level `required`/`process.exit(1)`
  guard idiom (lines 52-72).
- `apps/cron-worker/src/index.ts` — inside `main()`, after `const env = loadEnv();` (line 37),
  before scheduling jobs. Analog: lines 36-47.

Call shape (all three): `import { assertFlagSignoffsOrExit } from '@contractor-ops/feature-flags';`
then `assertFlagSignoffsOrExit();` placed after env load, before serving. This is the
**load-bearing FOUND7-02 fix** — registry edits alone do NOT satisfy SC#2.

---

### `packages/db/src/region.ts` (config infra) — MODIFY: US

**Analog:** `SUPPORTED_REGIONS` + `DataRegion` + `REGION_ENV_MAP` (lines 8-18, same file).
```typescript
export const SUPPORTED_REGIONS = ['EU', 'ME'] as const;       // → ['EU','ME','US']
export type DataRegion = (typeof SUPPORTED_REGIONS)[number];   // TS union, NOT a Prisma enum
const REGION_ENV_MAP: Record<DataRegion, string> = {
  EU: 'DATABASE_URL_EU',
  ME: 'DATABASE_URL_ME',                                       // + US: 'DATABASE_URL_US'
};
```
Adding `'US'` to `SUPPORTED_REGIONS` propagates `DataRegion` everywhere and **force-fails tsc** at
`REGION_ENV_MAP` (and `REPLICA_ENV_MAP`, replica.ts) until each gains a `US` entry — this compile
error IS the lockstep (RESEARCH Pitfall 5). `getRegionalClient` (lines 42-63) needs NO change: it
lazy-throws on missing `DATABASE_URL_US` (D-06), and `preWarmRegionalClients` (69-77) already
skips-on-missing.

---

### `packages/db/src/replica.ts` (config infra) — MODIFY: US (D-07 adjacent)

**Analog:** `REPLICA_ENV_MAP` (lines 72-75, same file).
```typescript
const REPLICA_ENV_MAP: Record<DataRegion, string> = {
  EU: 'DATABASE_URL_EU_RO',
  ME: 'DATABASE_URL_ME_RO',                                    // + US: 'DATABASE_URL_US_RO'
};
```
`Record<DataRegion,string>` FORCES a `US` entry once region.ts gains US (RESEARCH Pitfall 6). The
env stays optional/unset (US replica deferred per CONTEXT Deferred Ideas) — harmless: `getReplicaClient`
/ `readReplica` fall back to the writer when the `_RO` var is absent (lines 234-237, 293-296).

---

### `packages/api/src/middleware/feature-flag.ts` (middleware, request-response) — MODIFY: `buildLazyBag` US

**Analog:** the region branch inside `buildLazyBag` (lines 28-43, same fn 22-50).

> CORRECTION vs RESEARCH "lines 33-43": the full coercion block is **lines 28-43** (the
> `let region: 'EU' | 'ME'` declaration is line 28; the unknown→EU `else` is 33-43).

```typescript
let region: 'EU' | 'ME';
if (ctx.region === 'ME') { region = 'ME'; }
else if (ctx.region === 'EU') { region = 'EU'; }
else { log.warn(…, 'unexpected ctx.region; coercing to EU …'); region = 'EU'; }
```
Widen the type to `'EU' | 'ME' | 'US'` and add an explicit `else if (ctx.region === 'US') region = 'US';`
branch BEFORE the unknown→EU `else` (D-05; RESEARCH "buildLazyBag — accept US" example). The
genuinely-unknown `else` stays as fail-closed EU. Depends on `regionSchema` US widening (schemas.ts)
to pass downstream Zod validation in `lazyFlagBag` (RESEARCH Pitfall 4).

---

### `packages/validators/src/env.ts` (config schema) — MODIFY: `DATABASE_URL_US` optional

**Analog:** the optional `_RO` replica URLs in `databaseSchema` (lines 32-33).
```typescript
const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_EU: z.string().min(1, 'DATABASE_URL_EU is required'),
  DATABASE_URL_ME: z.string().min(1, 'DATABASE_URL_ME is required'),
  DATABASE_URL_EU_RO: z.string().min(1).optional(),            // ← optional template
  DATABASE_URL_ME_RO: z.string().min(1).optional(),
});
```
Add `DATABASE_URL_US: z.string().min(1).optional()` (D-06 — OPTIONAL, mirrors the `_RO` optional
pattern, NOT the required `_EU`/`_ME`). Also add `DATABASE_URL_US` (+ optionally `DATABASE_URL_US_RO`)
to `.env.example` per CLAUDE.md env-var rule. `getServerEnv()` (lines 408-416) is the boot-time
validator that consumes this.

---

### `packages/db/scripts/migrate-all-regions.ts` (script, batch) — MODIFY: US (D-07 adjacent)

**Analog:** `REGION_ENV_VARS` array + `migrateRegion` (lines 40-68, same file).
```typescript
const REGION_ENV_VARS = ['DATABASE_URL_EU', 'DATABASE_URL_ME'] as const;  // + 'DATABASE_URL_US'
// migrateRegion already skip-on-missing:
function migrateRegion(envVar: string): RegionResult {
  const url = process.env[envVar];
  if (!url) return { region, status: 'skipped' };   // lines 49-54
  …
}
```
This is a PLAIN array (NOT `Record<DataRegion>`), so tsc will NOT force it — add `'DATABASE_URL_US'`
manually for consistency (D-07). Safe: `migrateRegion` already skips when the URL is unset
(lines 52-54), so an unset US DB locally is a no-op.

---

### `IRIS-TCC-ENROLLMENT.md` (doc) — CREATE — **NO ANALOG (by design)**

Per **D-08**: pure planning/ops doc in this phase dir. Records the ~45-day IRIS TCC lead +
start-date as a "started calendar dependency", cross-linked to **Phase 86 (US-FORM-05, IRIS XML
A2A e-file)**. No app code, no code analog — the planner authors content from CONTEXT D-08 +
RESEARCH State-of-the-Art (FIRE decommissions 2026-12-31 → IRIS-primary). Use the Write tool.

---

## Shared Patterns

### Structured tRPC error as JSON-in-`message` with a `type` discriminator
**Source:** `packages/api/src/middleware/tier.ts:41-46` (`TIER_REQUIRED`) — also
`require-classification-flag.ts` (`CLASSIFICATION_ENGINE_DISABLED`).
**Apply to:** `add-on.ts` (`ADD_ON_REQUIRED`), and its consumer
`apps/public-api/src/lib/error-handler.ts:47-70` (`extractErrorDetails` parses the JSON and maps
`type` → HTTP code/message). Repo-wide convention — do NOT invent a new error class.

### Owner-gated + audit-logged mutation
**Source:** `adminProcedure` (rbac.ts:67 = `tenantProcedure.use(requirePermission({ organization: ['update'] }))`)
+ `writeAuditLog` (audit-writer.ts:118-137) + `admin-boe-rate.ts` mutation skeleton (43-86).
**Apply to:** the `grantAddOn` mutation in `billing.ts`. `tenantProcedure` provides the
session-derived `organizationId` (never client-trusted, per CLAUDE.md). Pass `tx` to `writeAuditLog`
when the audit row must commit atomically with the Subscription update.

### Redis-cache invalidation on non-Stripe billing writes
**Source:** `CacheKeys.subscription(orgId)` (cache.ts:299) + `invalidate(...keys)` (cache.ts:243);
`getSubscription` cache read (billing-service.ts:80-86).
**Apply to:** `grantAddOn` — MUST invalidate after the write (RESEARCH Pitfall 3). Today only Stripe
webhooks invalidate this key; the admin grant is a new write path.

### `Record<DataRegion,string>` as a compile-time lockstep
**Source:** `REGION_ENV_MAP` (region.ts:15) + `REPLICA_ENV_MAP` (replica.ts:72) — both keyed by the
`DataRegion` union.
**Apply to:** the FOUND7-03 5-place change. Adding `'US'` to `SUPPORTED_REGIONS` force-fails tsc at
both maps; the SC#3 lockstep test should additionally assert `SUPPORTED_REGIONS`,
`regionSchema.options`, `REGION_ENV_MAP` keys, and `REPLICA_ENV_MAP` keys all hold identical region
sets (a plain array like `REGION_ENV_VARS` does NOT auto-fail — must be asserted in the test).

### Dot-namespaced flag key + PENDING signoff + gated prefix
**Source:** Phase 79 `gulf.*` (flags-core.ts:189-206 + signoff JSON 90-97 + prefix `'gulf.'` in
GATED_FLAG_NAMESPACE_PREFIXES:50) — the exact three-file pattern.
**Apply to:** every v7.0 flag — a `FLAGS` entry (regex-valid key) + a `signoff-registry-flags.json`
PENDING entry + a `GATED_FLAG_NAMESPACE_PREFIXES` prefix, all three in lockstep.

### Optional regional env var (graceful local degradation)
**Source:** `DATABASE_URL_*_RO` optional (env.ts:32-33) + skip-on-missing consumers
(migrate-all-regions.ts:52-54, region.ts:69-77 preWarm).
**Apply to:** `DATABASE_URL_US` — optional in schema, lazy-throw only on actual access (D-06).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `IRIS-TCC-ENROLLMENT.md` | doc | — | Pure real-world IRS ops artifact (D-08); intentionally no app code. Planner authors content from CONTEXT D-08 + RESEARCH State-of-the-Art (IRIS-primary, FIRE decommission 2026-12-31). |

---

## Metadata

**Analog search scope:** `packages/api/src/{middleware,services,routers,constants}`,
`packages/feature-flags/src`, `packages/db/{src,prisma/schema,scripts}`, `packages/validators/src`,
`apps/{api,public-api,cron-worker}/src`.
**Files scanned (read in full or targeted):** 18 in-tree files.
**RESEARCH anchor verification:** all line-number anchors checked; 3 minor corrections flagged
inline (error-handler 51-57 not 51-58; feature-flag.ts coercion block 28-43; D-11 base tier is
STARTER not the PRO that RESEARCH Pattern 1 illustrated). No analog was materially wrong — RESEARCH
§ Sources was accurate.
**Pattern extraction date:** 2026-06-07
