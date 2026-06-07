# Phase 83: Theme A — US Region Infrastructure - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Durable US data-residency infrastructure so US tax data can be created safely in
Phases 85–86:

1. **US region routing** (US-INFRA-01) — a US-billing org's requests resolve a
   `us-east-1` Prisma client; cross-region read replicas stay off by default.
2. **US tax-archive R2 bucket** (US-INFRA-02) — US-org file storage (incl. tax
   archives) lands in a US-region R2 bucket for data residency.
3. **IRS retention enforcement** (US-INFRA-03) — soft-delete + scheduled archive
   with per-record-type retention (4-yr 1099-NEC, 7-yr backup-withholding) and a
   hard guarantee of no early hard-delete of a retained record.

Builds on Phase 82's region primitives. The actual tax-form tables (1099, W-forms)
land in Phases 85–86 and **attach** to the mechanisms built here — Phase 83 ships
the routing + bucket + retention primitive, not the tax records themselves.
</domain>

<decisions>
## Implementation Decisions

### US Region Assignment (US-INFRA-01)
- **D-01:** `organization.dataRegion` is set **at org creation** (from a billing
  country/region selection) and is **IMMUTABLE** afterward — no cross-regional-DB
  migration path. `US` is for **new US-billing orgs only** (matches US-INFRA-01
  "a NEW org with US billing"). The `us-cross-border` add-on (Phase 82) is
  **ORTHOGONAL**: it unlocks US tax features for an org but does NOT move data
  residency — an EU/ME org that buys it keeps its data in its home region.
- **D-02:** Cross-region read replicas remain **off by default** for US
  (US-INFRA-01) — do not wire `DATABASE_URL_US_RO` into an active replica path
  this phase (the `REPLICA_ENV_MAP['US']` slot from Phase 82 exists but stays
  inert until a US replica is provisioned).
- **(planner/research, not a user decision):** widen the scattered
  `(org.dataRegion ?? 'EU') as 'EU' | 'ME'` casts to the shared `DataRegion` type
  (`packages/db/src/region.ts`) at every site — tenant middleware, `org-cache.ts`
  (5-min meta cache), `oauth.ts`, `org-definition-sync.ts`, `seed-dev.ts`
  `pickRegion`, and `buildLazyBag` (already US-aware from Phase 82). Confirm whether
  `dataRegion` is a Prisma enum (→ additive `US` enum migration) or a plain string
  column.

### US Tax-Archive R2 Bucket (US-INFRA-02)
- **D-03:** Extend `packages/api/src/services/regional-storage.ts`
  `REGION_BUCKET_MAP` with `US: env => env.R2_BUCKET_NAME_US`. `R2_BUCKET_NAME_US`
  is **OPTIONAL** in `packages/validators/src/env.ts` (+ `.env.example`) — resolved
  lazily by `getRegionalBucket`, which already throws on an unsupported region, so
  a missing US bucket only fails on actual US-org file access (mirrors the
  `DATABASE_URL_US` optional/lazy pattern from Phase 82). **One US regional bucket**
  holds all US-org files incl. tax archives — NOT a separate dedicated tax bucket
  (avoids a second bucket + routing branch for marginal benefit while LOCAL-ONLY).

### IRS Retention (US-INFRA-03)
- **D-04:** Retention periods live in a **light, reusable retention-policy
  primitive** — a typed `record-type → retention-years` map + a resolver function
  (mirrors the tax-year threshold-config pattern; can graduate to a DB table later
  if config-edit need emerges). Seed with the IRS values: **1099-NEC = 4 years**,
  **backup-withholding records = 7 years**. Built reusable so Theme B **AKTA-02**
  (per-jurisdiction personnel-file retention) extends the **same resolver** rather
  than a parallel retention engine. Keep it LIGHT (map + resolver), not a framework.
- **D-05:** "No early hard-delete of a retained record" is guaranteed by a
  **centralized guard at the deletion chokepoints**, not a callable helper:
  1. Extend `packages/db/src/soft-delete.ts` so a retained record (model + within
     its policy window) cannot be hard-deleted.
  2. Make `apps/cron-worker/src/jobs/handlers/data-purge.ts` **retention-policy-aware**
     — it currently hard-deletes soft-deleted rows past a flat `RETENTION_DAYS=90`;
     retained models must consult the D-04 policy instead (non-retained models keep
     the 90-day sweep).
  3. `packages/api/src/routers/compliance/gdpr.ts` RODO erasure must
     **soft-delete-with-exemption** for retained tax records (flag with statutory
     citation rather than hard-delete via `deleteByOrgAndCount`) — prefigures
     Theme B **AKTA-03**'s statutory-retention-exemption layer.
  The scheduled archive/sweep stays in `apps/cron-worker`. Build the guard now;
  Phase 86 tax models opt in by registering their window in the D-04 policy and
  joining `softDeleteModels`.

### Sequencing
- **D-06:** Phase 83 ships region routing + US bucket + retention **mechanism**
  only. The 1099/W-form tables (Phases 85–86) attach to it later. Do NOT create
  tax-form tables here; the retention guard/policy is verified against a
  representative model (or a test fixture model) until the real tables land.

### Resolved from Research (2026-06-07)
- **D-07 (retention primitive home):** the D-04 policy lives in a NEW
  `packages/db/src/retention-policy.ts` (NOT in `packages/api` — keeps `data-purge.ts`
  in cron-worker from needing a static api→cron edge). Exports `RETENTION_YEARS`
  (`{ '1099-NEC': 4, 'backup-withholding': 7 }`), a `MODEL_RETENTION_TYPE` map that
  ships **EMPTY** per D-06 (Phase 86 tax models register here), and a
  `getRetentionCutoff(model, now)` resolver consumed by all three deletion chokepoints
  (D-05). Verify against the existing `Invoice` soft-delete fixture in `soft-delete.test.ts`.
- **D-08 (DATA_HOSTING_REGION env):** DEFERRED — widening the `DATA_HOSTING_REGION`
  env enum to US is not required for request-time routing this phase (routing keys off
  `organization.dataRegion`, not the deploy env). Revisit when US is actually deployed.

### Research-surfaced anchor corrections (planner MUST honor — see 83-RESEARCH.md)
- **`DataRegion` is a Prisma enum, not a TS union.** `organization.prisma` defines
  `enum DataRegion { EU ME }` (Postgres `CREATE TYPE "DataRegion" AS ENUM ('EU','ME')`).
  Phase 82 widened only the `SUPPORTED_REGIONS` TS tuple — it **never added `US` to the
  Postgres enum**, and the 82 region-lockstep test skipped the Prisma enum. So
  `dataRegion = 'US'` throws `invalid input value for enum` at the DB **today**. Phase 83
  MUST add `US` via an **additive `ALTER TYPE "DataRegion" ADD VALUE 'US'`** migration
  (use the db-push / direct-ALTER fallback — `prisma migrate dev` is blocked by the
  pre-existing migration-history drift documented under Phase 82; record per-region
  production apply as deferred) AND add a lockstep assertion that covers the Prisma enum
  (the missing 6th place). This is the true origin point of US region routing.
- **Org creation goes through Better Auth's `organization()` plugin** — the tRPC
  org create/update mutations were removed; everything defaults `dataRegion='EU'` today.
  D-01's creation-time US assignment plugs into a NEW `organizationCreation.beforeCreate`
  hook + Better Auth `additionalFields` carrying the billing country/region selection →
  mapped to `dataRegion`. Default stays EU.
- **`data-purge.ts` uses the BASE `prisma` client (no soft-delete extension)** → its
  `deleteMany` is a TRUE hard-delete with a flat `RETENTION_DAYS=90`. This is THE
  load-bearing D-05 path. `gdpr.ts` `deleteByOrgAndCount` runs on `ctx.db` (extension
  present → softDeleteModels auto-convert), but D-05 still wants an EXPLICIT retention
  exemption + statutory citation there. Grep confirmed **no 4th hard-delete leak** on
  soft-delete models — the three chokepoints are complete coverage.
- **Cast sites to widen to the shared `DataRegion` type:** `tenant.ts`, `org-cache.ts`
  (`OrgMeta.dataRegion: string`), `org-definition-sync.ts`, `oauth.ts`,
  `regional-storage.ts`, `seed-dev.ts`, plus `?? 'EU'` sites in portal-shared /
  portal-auth / ksef / idp-deprovisioning.

### Claude's Discretion
- `dataRegion` representation — RESOLVED: it is a Prisma enum; add `US` additively
  (see anchor corrections). No longer open.
- Retention-policy storage shape (typed const map vs DB table) — start as a typed
  const map; DB table only if a runtime-edit requirement appears.
- Where the create-org region selection surfaces in the UI — minimal; en-US copy
  is NOT required here (that's Phase 84).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — US-INFRA-01/02/03 verbatim + v7.0 Scope Decisions.
- `.planning/ROADMAP.md` (Phase 83 entry) — goal + 3 success criteria.
- `.planning/milestones/v7.0-phases/82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl/82-CONTEXT.md` — Phase 82 region primitives (D-05/D-06) + `us-cross-border` add-on; **82-RESEARCH.md** for the region 5-place map.

### Region routing
- `packages/db/src/region.ts` — `SUPPORTED_REGIONS` (incl US, Phase 82), `DataRegion`, `REGION_ENV_MAP`, `getRegionalClient` (lazy-throw).
- `packages/api/src/services/org-cache.ts` — Organization meta cache (`dataRegion`, 5-min TTL, invalidation on org update).
- `packages/api/src/middleware/feature-flag.ts` — `buildLazyBag` (already US-aware).
- `packages/api/src/routes/oauth.ts`, `packages/api/src/services/org-definition-sync.ts`, `packages/db/scripts/seed-dev.ts` — sites casting `dataRegion as 'EU'|'ME'` that must widen to `DataRegion`.

### US R2 bucket
- `packages/api/src/services/regional-storage.ts` — `REGION_BUCKET_MAP`, `getRegionalBucket` (throws on unsupported region).
- `packages/api/src/services/r2.ts` — R2 client + key generation (legacy single-bucket fallback).
- `packages/validators/src/env.ts` — `R2_BUCKET_NAME_EU/_ME` (add optional `R2_BUCKET_NAME_US`, analog: optional vars).

### Retention
- `packages/db/src/soft-delete.ts` — Prisma client extension, `softDeleteModels` set (extend retention-aware).
- `apps/cron-worker/src/jobs/handlers/data-purge.ts` — daily sweep, flat `RETENTION_DAYS=90` (make policy-aware).
- `packages/api/src/routers/compliance/gdpr.ts` — RODO erasure (`deleteByOrgAndCount` hard-delete + soft-delete-through-retention helpers) — add retention exemption.
- `packages/api/src/routers/core/contract.ts` — example soft-delete + `writeAuditLog` call site (delete pattern to follow).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `regional-storage.ts` `REGION_BUCKET_MAP` / `getRegionalBucket` — add US 1:1 (same shape as Phase 82's region change).
- `soft-delete.ts` client extension — the single chokepoint to make retention-aware; `softDeleteModels` is the opt-in set.
- `data-purge.ts` cron — the existing scheduled archive; extend it to consult the retention policy instead of a flat 90 days.
- `gdpr.ts` — already separates hard-delete vs soft-delete-through-retention; the retention-exemption hook lands here.
- `org-cache.ts` — region read-through cache; widening `dataRegion` typing must keep this consistent.

### Established Patterns
- **Region resolved from `org.dataRegion`** at the tenant boundary → `getRegionalClient(region)` (DB) + `getRegionalBucket(region)` (storage). US plugs into both.
- **Optional regional env + lazy-throw** (Phase 82 `DATABASE_URL_US`) — reuse for `R2_BUCKET_NAME_US`.
- **Soft-delete = `deletedAt` set; reads/writes filter it; cron purges past window** — retention extends the "window" from flat 90d to per-type.
- **`writeAuditLog` on sensitive mutations** — retention-blocked erasure attempts should be audit-logged.

### Integration Points
- Org-create flow sets `dataRegion` (immutable) — the single place US routing originates.
- The retention policy is consumed by THREE deletion paths (soft-delete extension, data-purge cron, gdpr erasure) — all must read the same resolver (D-04/D-05).
- Phase 86 tax-form models register windows + join `softDeleteModels` to inherit the guard.
</code_context>

<specifics>
## Specific Ideas

- **Build the mechanism, attach later** — Phase 83 is honest infra: it does not invent
  fake tax tables to "use" retention; it ships the policy + guard + bucket and proves
  them against a representative/fixture model, and Phase 86 opts the real tables in.
  (Same "no product theater" preference carried from Phase 82.)
- Reuse-don't-rebuild: one retention resolver shared with Theme B AKTA-02; one
  regional-bucket map; one region resolution path — no parallel US-only engines.
</specifics>

<deferred>
## Deferred Ideas

- **EU/ME-org-serving-US-contractor tax-data residency** — where a non-US org's
  1099/1042-S data must legally reside. Legal/tax-adviser question (LOCAL-ONLY,
  legal-deferred posture); not resolved by D-01's creation-time model.
- **Admin region switch / cross-regional-DB move** — explicitly out of scope per
  D-01 (immutable region); would need a dual-write migration path.
- **US read replica** (`DATABASE_URL_US_RO` active path) — off by default (D-02);
  wire only when a US replica is provisioned.
- **Retention policy as an editable DB table** — start as a typed const map (D-04);
  graduate only on a real runtime-edit need.

Discussion stayed within phase scope.
</deferred>

---

*Phase: 83-theme-a-us-region-infrastructure*
*Context gathered: 2026-06-07*
