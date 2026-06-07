# Phase 82: v7.0 Foundation — Add-On Billing + Flag Registry + US Region Enablement - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Delivers the three cross-cutting platform primitives that gate every revenue-bearing
(Theme A/B) and US-data surface in v7.0 — built before any theme work begins:

1. **`requireAddOn(addOn)` entitlement middleware** (FOUND7-01) — composes after
   `requireTier`; returns a structured `ADD_ON_REQUIRED` error; gates `Workforce`
   (Theme B) and `US Cross-Border` (Theme A) surfaces.
2. **v7.0 Unleash flag signoff-registration + boot gate** (FOUND7-02) — all ~20
   v7.0 flags registered PENDING; boot-time gate exits if any listed flag is missing.
3. **`us-east-1` region enablement** (FOUND7-03) — the 4-place atomic change so a
   `region=US` request resolves without runtime throw or silent EU-coercion.

Plus the only non-code success criterion: an **IRIS TCC enrollment ops doc** recording
the ~45-day lead as a started calendar dependency (SC#4).

Pure gating infrastructure — no user-facing feature ships in this phase.
</domain>

<decisions>
## Implementation Decisions

### Add-On Billing (FOUND7-01)
- **D-01:** Entitlement stored as a denormalized `addOns` array on the existing
  `Subscription` model (not a normalized `OrgAddOn` table). `requireAddOn(addOn)`
  reads from the **same Redis-cached `getSubscription(organizationId)`** that
  `requireTier` already uses (`packages/api/src/middleware/tier.ts`) — zero extra
  query, zero new cache key. Resolves the ROADMAP-deferred `Subscription.addOns
  String[]` vs `OrgAddOn` question in favor of the array. Valid add-on keys
  centralized in one const: `'workforce'`, `'us-cross-border'`.
- **D-02:** `requireAddOn` composes **after** `requireTier`
  (chain: `auth → tenant → requireTier → requireAddOn → handler`). Throws
  `TRPCError` `FORBIDDEN` with JSON message
  `{ type: 'ADD_ON_REQUIRED', requiredAddOn, currentAddOns }`, mirroring the
  `TIER_REQUIRED` shape exactly. **`apps/public-api/src/lib/error-handler.ts` must
  gain an `ADD_ON_REQUIRED` branch** alongside the existing `TIER_REQUIRED` parse.
- **D-03:** Grant mechanism is **admin + seed only**. Entitlement set via
  `seed-dev.ts` + an owner-gated, audit-logged admin mutation. Real Stripe add-on
  SKU / price-ID / checkout-line-item / webhook-entitlement-sync wiring is
  **DEFERRED** until billing goes live (LOCAL-ONLY posture). Phase 82 ships the
  entitlement *primitive*, not the purchase flow — v3.0 Stripe checkout is untouched.

### Feature-Flag Registry + Boot Gate (FOUND7-02)
- **D-04:** Register **all ~20** v7.0 Unleash flags PENDING in the signoff registry
  now — the full FOUND7-02 list, including far-future marketplace and per-adapter
  flags. Registering everything up front keeps the boot-gate stable as later phases
  land (no boot break when a flag is first referenced). Boot-time gate exits if any
  listed flag is missing from the registry.

### US Region Enablement (FOUND7-03)
- **D-05:** `us-east-1` enabled via the named **4-place atomic change** —
  `SUPPORTED_REGIONS`, the `DataRegion` enum, `DATABASE_URL_US` env (+ schema), and
  `buildLazyBag` flag coercion — with a **lockstep test** asserting all four stay in
  sync. `buildLazyBag` (`packages/api/src/middleware/feature-flag.ts`) must accept
  `US` **without** coercing to EU (today it warns + coerces unknown→EU).
- **D-06:** `DATABASE_URL_US` is **OPTIONAL** in the env schema. `getRegionalClient('US')`
  throws only on actual access (existing lazy-throw behavior in
  `packages/db/src/region.ts`); seed/migrate scripts **skip-on-missing** (existing
  pattern in `seed-dev.ts` / `migrate-all-regions.ts`). The app boots clean locally
  with no US DB; no US org exists, so no US client instantiates. The SC#3 lockstep
  test needs **no live US database**. *(Optional dev convenience, documented not
  default: a developer MAY point `DATABASE_URL_US` at the EU dev URL to exercise US
  org flows locally.)*
- **D-07:** Planner must evaluate whether the **adjacent** region touch points also
  need a US entry for true lockstep, beyond the canonical 4 places:
  `packages/db/src/replica.ts` (`REPLICA_ENV_MAP`),
  `packages/db/scripts/migrate-all-regions.ts` (`REGION_ENV_VARS`),
  `packages/db/scripts/seed-dev.ts` (region loop). Replica likely needs the entry for
  consistency; migrate/seed already tolerate missing env via skip-on-missing.

### IRIS TCC Enrollment (SC#4)
- **D-08:** Artifact = a **planning/ops doc** (e.g. `IRIS-TCC-ENROLLMENT.md` in this
  phase dir) recording the ~45-day lead + the start-date as a "started calendar
  dependency", cross-linked to **Phase 86 (US-FORM-05, IRIS XML A2A e-file)**. No app
  code — TCC enrollment is a real-world IRS ops action the founder takes; nothing
  files until Phase 86. Honest artifact for LOCAL-ONLY; avoids product theater
  (rejected: seeding a fake in-app onboarding task that "starts the clock").

### Resolved from Research (2026-06-07 — confirms researcher assumptions A1/A2/A4)
- **D-09 (flag-key namespacing):** v7.0 flags use **domain namespaces** consistent
  with the existing taxonomy — `module.us-expansion`, `module.workforce-employees`,
  `module.public-api`, `module.outbound-webhooks`, `integration.personio-sync`,
  `integration.bamboohr-sync`, `payments.ach-payouts`, `integration.marketplace-{zapier,n8n,make}`,
  and the 8 payroll adapters under a **new `payroll.*` category** (`payroll.symfonia`,
  `payroll.comarch`, `payroll.enova`, `payroll.datev`, `payroll.sage-uk`, `payroll.gusto`,
  `payroll.quickbooks`, `payroll.adp`). Adding `'payroll'` to `flagCategorySchema`
  (`packages/feature-flags/src/.../schemas.ts`) is a one-line additive enum change.
  Bare FOUND7-02 wire names are invalid against `flagDefinitionSchema`
  (`^[a-z0-9]+(\.[a-z0-9-]+)+$`) — every key MUST be dot-namespaced. Confirm final
  count (research found **19** distinct keys from the FOUND7-02 enumeration; the
  BACKLOG-mentioned `module.irs-fire-efile` legacy-fallback flag is optional → 20).
- **D-10 (boot-gate enforcement):** Define an explicit **`V7_FLAG_KEYS`** cohort array;
  **wire the currently-UNWIRED `assertFlagSignoffsOrExit()`** into app boot
  (`apps/api`, `apps/public-api`, `apps/cron-worker`) and assert every cohort key has
  a signoff entry — this is namespace-agnostic and changes behavior for NO existing
  flag. Also add the v7.0 namespace prefixes to `GATED_FLAG_NAMESPACE_PREFIXES`
  (belt-and-suspenders). Do **NOT** broaden the gate to all declared flags (would
  break boot for existing non-gated flags like `payments.bacs-enabled`). This is the
  load-bearing FOUND7-02 fix: the registry edit alone does NOT satisfy SC#2 because
  the gate is defined+tested but never called at boot today (Phase 72 made it an
  explicit-call gate; no app was updated to call it).
- **D-11 (add-on base tier):** A/B add-ons are tier-independent. Convenience procedures
  compose `tenantProcedure → requireTier('STARTER') → requireAddOn(addOn)` — the
  `STARTER` floor only enforces "has an active subscription (any tier)", satisfying
  SC#1's "composes after requireTier" while keeping add-on sales open to any paying
  tier (BACKLOG: "add-on on top of base tier", no minimum stated). Only Theme C is
  tier-gated within base; Themes A/B gate on the add-on, not the tier.

### Research-surfaced anchor corrections (planner MUST honor — see 82-RESEARCH.md)
- The "4-place" US region change is really **5**: `SUPPORTED_REGIONS` +
  `DataRegion` (a TS union in `packages/db/src/region.ts`, **not** a Prisma enum) +
  `DATABASE_URL_US` (optional env) + `buildLazyBag` coercion + the feature-flags
  `regionSchema = z.enum(['EU','ME'])`. `REGION_ENV_MAP` and `REPLICA_ENV_MAP`
  (`Record<DataRegion,string>`) force-fail `tsc` until US is added — that compile
  error IS the lockstep (D-07 replica/migrate/seed adjacents confirmed needed).
- `Subscription.addOns` does not exist yet (additive migration); `getSubscription`
  uses bare `findUnique` (no `select`) so `addOns` rides along free — but the grant
  mutation MUST invalidate the ~15-min Redis subscription cache.
- `AuditEntityType` has no SUBSCRIPTION/BILLING value — audit the grant mutation with
  `resourceType:'ORGANIZATION'` (resourceId = orgId), or add an additive enum value.
- The relevant signoff registry is `packages/feature-flags/src/signoff-registry-flags.{ts,json}`
  (boot-gate timing) — NOT `packages/validators/src/legal/signoff-registry.ts` (Phase 64
  legal-disclaimer, production-deploy timing). Do not confuse them.

### Claude's Discretion
- Exact add-on key type (string-literal union `const` vs Prisma enum) — planner's
  call, but it MUST be centralized in one place and shared by middleware + seed + admin mutation.
- Naming of the admin grant mutation and which existing admin/billing router it lands in.
- Whether the lockstep test lives in `packages/db` or `packages/api` — wherever it can
  assert all four registrations together.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning (scope + locked decisions)
- `.planning/REQUIREMENTS.md` — FOUND7-01/02/03 verbatim + the v7.0 "Scope Decisions"
  table (add-on SKUs, IRIS-PRIMARY, $2,000 / $20,000+200 thresholds, API-key HMAC-SHA256).
- `.planning/ROADMAP.md` (Phase 82 entry) — goal, the 4 success criteria, and the
  research note that defers the `Subscription.addOns String[]` vs `OrgAddOn` decision
  to this discussion (resolved → D-01).
- `.planning/milestones/v7.0-BACKLOG.md` — full strategic spec; locked decisions
  #1 (add-on SKUs / `requireAddOn`), #2/#9 (parallel themes; `WORKER-01` / `INTEG-API-01`
  serialization), #4 (3 US payroll adapters), #8 (10 states).
- `.planning/research/SUMMARY.md` (+ STACK/FEATURES/ARCHITECTURE/PITFALLS) — IRIS-PRIMARY
  correction (FIRE decommissions 2026-12-31; new IRIS TCC ~45-day lead → SC#4), threshold
  corrections, reuse-don't-rebuild map, and the `us-east-1` 4-place atomic-change finding.

### Add-on billing pattern to mirror
- `packages/api/src/middleware/tier.ts` — `requireTier` factory + `TIER_REQUIRED`
  structured-error shape + `getSubscription(orgId)` Redis-cached read. `requireAddOn`
  mirrors this 1:1.
- `apps/public-api/src/lib/error-handler.ts` — parses `TIER_REQUIRED` JSON; add an
  `ADD_ON_REQUIRED` branch.
- `packages/api/src/services/billing-service.ts` — `getSubscription` source (Subscription read/cache).

### Feature-flag registry + boot gate
- `packages/feature-flags/src/registry.ts` — flag-key registry (per CLAUDE.md, keys land
  here before Unleash UI).
- `signoff-registry.ts` (confirm exact path — referenced in `.planning/STATE.md`; PENDING
  signoff registration + boot-time gate live here).
- `packages/api/src/middleware/require-classification-flag.ts` — v5.0 flag-off pattern
  (render-tree removal + tRPC FORBIDDEN) for how flag-gated routes behave OFF.

### US region enablement
- `packages/db/src/region.ts` — `SUPPORTED_REGIONS`, `DataRegion`, `REGION_ENV_MAP`,
  `getRegionalClient` (lazy-throw on missing env).
- `packages/api/src/middleware/feature-flag.ts` — `buildLazyBag` region coercion (must accept US).
- `packages/db/src/replica.ts`, `packages/db/scripts/migrate-all-regions.ts`,
  `packages/db/scripts/seed-dev.ts` — adjacent region touch points (D-07).

### IDOR landmine (carried from research, applies to any new tenant-owning model)
- Never add v7.0 tenant-owning models to `globalModels`; add a two-org cross-leak test
  per new model (per STATE.md Accumulated Context).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`requireTier` middleware** (`tier.ts`): exact template for `requireAddOn` — same
  factory shape, same structured-JSON `FORBIDDEN` error, same `getSubscription` read.
- **`getSubscription` (billing-service)**: Redis-cached Subscription fetch; `addOns`
  rides along on the same object → no second query for `requireAddOn`.
- **`buildLazyBag` / `tenantFlaggedProcedure`** (`feature-flag.ts`): region→flag-bag
  plumbing; the place US must be accepted without EU coercion.
- **`getRegionalClient` + `REGION_ENV_MAP`** (`region.ts`): the canonical region→client
  resolver; lazy-throw means optional `DATABASE_URL_US` is safe locally.
- **`public-api/error-handler.ts`**: structured-error translation layer for the REST surface.

### Established Patterns
- **Structured tRPC errors as JSON in `message`** with a `type` discriminator
  (`TIER_REQUIRED`, `CLASSIFICATION_ENGINE_DISABLED`) — `ADD_ON_REQUIRED` follows suit.
- **Flag-off = conditional router registration + per-request middleware FORBIDDEN**
  (v5.0 classification, D-05/D-06 of Phase 64).
- **Region env vars are skip-on-missing in scripts** (`seed-dev.ts`, `migrate-all-regions.ts`)
  — US enablement does not force a US DB to exist.
- **Money as integer minor units; enums `UPPER_SNAKE_CASE`** (repo standard; relevant if
  add-on keys become a Prisma enum).

### Integration Points
- New `requireAddOn` slots into the procedure chain after `requireTier` in
  `packages/api/src/middleware/`.
- `ADD_ON_REQUIRED` must be handled in both the SPA client (billing upgrade-prompt path,
  mirroring `useFeatureGate`) and `apps/public-api` error-handler.
- US region registration spans `packages/db` + `packages/api` — the lockstep test must
  import from both.
</code_context>

<specifics>
## Specific Ideas

- **No product theater** — a recurring preference confirmed this session: ship honest
  artifacts for the LOCAL-ONLY build rather than fake in-app state (IRIS TCC = ops doc,
  not a seeded UI task; add-on grant = admin/seed, not a fake Stripe checkout).
- `co_live_xxx`-style display + HMAC-SHA256 storage is the repo convention for high-entropy
  keys (Theme C), noted here only so add-on/flag work stays consistent — not in this phase's scope.
</specifics>

<deferred>
## Deferred Ideas

- **Real Stripe add-on SKU purchase flow** — price IDs, checkout line items, webhook-driven
  entitlement sync. Belongs in the billing-go-live work, not the v7.0 foundation primitive.
- **US read-replica (`DATABASE_URL_US_RO`)** — cross-region read replicas remain off by
  default per US-INFRA-01; wire only if/when US replicas are provisioned.
- **Normalized `OrgAddOn` table with per-add-on billing metadata** — revisit if add-ons
  later need independent grant dates / seat counts / billing references.

None of these block Phase 82 — discussion stayed within phase scope.
</deferred>

---

*Phase: 82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl*
*Context gathered: 2026-06-07*
