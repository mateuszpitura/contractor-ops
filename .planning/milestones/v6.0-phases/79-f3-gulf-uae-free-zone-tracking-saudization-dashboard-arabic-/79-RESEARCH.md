# Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL — Research

**Researched:** 2026-06-03
**Domain:** Multi-region (ME) compliance data registration + manual Saudization dashboard + Arabic/RTL UI, composing on F1 (Phase 71/72) `ContractorComplianceItem` engine
**Confidence:** HIGH on codebase integration mechanics (read directly from tree); MEDIUM on external regulatory facts (verified via web, but legal review DEFERRED per Standing Constraint)

## Summary

Phase 79 is overwhelmingly a **data-registration + UI phase**, not an engine-building phase. The F1 compliance engine (Phase 71/72) already does the hard work: the reminder cron (`compliance-reminder-scan.ts`) and the payment gate (`compliance-payment-gate.ts`) both query `ContractorComplianceItem WHERE severity='BLOCKING' AND status IN ('EXPIRED'/'PENDING')`. Bumping `uae.free_zone_license` to `BLOCKING` and materialising a row with `expiresAt = licenseExpiresAt` makes free-zone license expiry flow into the 90/60/30/15/7 cascade and the EXPIRED payment hard-block **for free** — no engine changes. The Saudization dashboard is entirely manual-entry (the system never auto-computes the band — locked anti-feature) with platform-derived contractor counts shown side-by-side for sanity check. Arabic/RTL reuses the v4.0 infra verbatim.

The phase carries **four genuine landmines** the planner must get exactly right: (1) the existing `uae.free_zone_license@v1` is `WARNING` + `appliesIf: () => true` and must become `BLOCKING @v2` narrowed to free-zone zones (excluding Mainland) — but `EngagementContext` has **no zone field**, and the free-zone item is **not** materialised by the classification path that the supersession helper drives, so the planner must choose a materialisation strategy carefully or `supersedeAndMaterialise` will WAIVE the free-zone row. (2) The reminder cron uses the **default `prismaRaw` (= `DATABASE_URL`, EU only)** and does **not** iterate `SUPPORTED_REGIONS` — so ME-region compliance items are invisible to the cascade today; a region fan-out is required (template exists: `exchange-rates.ts`). (3) `Severity` is `BLOCKING/WARNING/INFO` — never add `CRITICAL`. (4) "Regional-routing annotation" is a **runtime + doc-comment convention**, not a Prisma feature — the same schema deploys to both EU+ME physical DBs; `ctx.db` is already region-aware via `org.dataRegion`, but cron and direct-`prisma` callers are not.

**Primary recommendation:** Register free-zone license expiry as a `ContractorComplianceItem` (severity `BLOCKING`, `policyRuleId='uae.free_zone_license@v2'`, `expiresAt=licenseExpiresAt`, `expiryJurisdictionTz='Asia/Dubai'`) written from the `FreeZoneAssignment` service path (NOT the classification path), narrowed to free-zone zones; bump the policy rule to `BLOCKING @v2` for severity/label/legal-text correctness; add region fan-out to the reminder cron so ME items are scanned. Build the Saudization dashboard as a manual-entry surface mirroring `computeComplianceHealth`. Reuse RTL + locked-phrase patterns verbatim.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Free-zone data model + severity (Area 1)**
- **D-01:** `FreeZoneAssignment` is **per-contractor** (license belongs to the contractor's legal entity, not a single engagement). The permitted-activity scope check runs whenever ANY contract is created for that contractor.
- **D-02:** **Migrate + supersede** the existing freeform `contractor.countryFields` UAE fields (`tradeLicenseNumber`, `freeZone` bool, `tradeLicenseExpiry`). Backfill into `FreeZoneAssignment`, make it the single source of truth, hide the old freeform UAE inputs in `country-compliance-section.tsx`. No double-entry/drift. (Saudi `countryFields` — `freelanceSaLicense`, `commercialRegistration*` — are out of this migration; only UAE free-zone fields move.)
- **D-03:** **Bump `uae.free_zone_license@v1` (currently `WARNING`) → `BLOCKING @v2`** via the Phase 71 policy-supersession rotation. Expired free-zone license hard-blocks payment per GULF-02. ROADMAP/REQUIREMENTS say "severity CRITICAL" — the `Severity` enum has **no `CRITICAL`**; it is `BLOCKING/WARNING/INFO`. "CRITICAL" maps to **`BLOCKING`**. Do NOT add a `CRITICAL` enum value.
- **D-04:** **Mainland contractors get NO free-zone expiry item and NO payment-block.** `appliesIf` narrows the rule to actual free-zone zones only (DED-licensed Mainland is a different regime). Mainland is still a recordable enum option; it just doesn't arm the BLOCKING gate.

**Permitted-activity matching (Area 2)**
- **D-05:** Store permitted-activities as **human-readable text + an optional list of admin-tagged ISIC-style codes**. Text satisfies SC#1; codes drive matching (SC#2).
- **D-06:** Match a contract's activity descriptor by **ISIC-code overlap** — if the contract's code is not in the contractor's permitted code set, fire the advisory. Deterministic, low false-positive. No fuzzy text matching.
- **D-07:** The advisory is **non-blocking**: show a scope-mismatch banner on the engagement AND **auto-create an NOC required-document item** for that engagement. Contract creation still proceeds. (NOC item severity = `WARNING` unless researcher finds a regulatory reason to escalate.)
- **D-08:** When the contract activity is **uncoded/uncertain (no ISIC tag) → skip the check**. No code, no advisory. No MANUAL_REVIEW tristate.

**Saudization data + trajectory (Area 3)**
- **D-09:** Per-engagement Saudi fields (`isSaudi`, `nationality`, `qiwaContractAuthenticated`, GULF-04) live as **new columns on the existing `ContractorAssignment` model** — not a separate 1:1 model. ME-org rows route to the ME db via existing region routing. Add explicit regional-routing annotation consistent with GULF-11.
- **D-10:** Headcount is **manual `SaudiHeadcount` entry** (admin enters org-wide total + Saudi-national headcount) **plus a platform-derived contractor breakdown shown side-by-side** for sanity-check. Nationalisation rate computed from the manual numbers. Never derive the rate from platform contractors alone.
- **D-11:** Qiwa-auth coverage gap is **visibility-only**: dashboard shows the count of contracts where `qiwaContractAuthenticated = false`. No block/warn gate, no per-engagement compliance item.
- **D-12:** Offboarding band-trajectory banner (GULF-07) is a **live, ephemeral recompute, advisory-only**. Project the rate from current `SaudiHeadcount` minus one Saudi national; render rate delta + **non-authoritative** wording. Not stored, not gating. Respects never-auto-compute-band lock.

**Arabic / RTL + locked phrases (Area 4)**
- **D-13:** **Reuse the v4.0 RTL infra** verbatim — CSS logical properties (`ms-`/`me-`/`ps-`/`pe-` only), `ar.json`, `use-rtl-chart-config.ts`, `isRtl`. The ESLint `ml-`/`mr-` ban enforces it on v6.0 surfaces (GULF-08). No new RTL machinery.
- **D-14:** **Lock statutory identifiers only** (GULF-09): free-zone authority legal names, Nitaqat band labels (PLATINUM/HIGH_GREEN/MID_GREEN/LOW_GREEN/YELLOW/RED), and Qiwa-auth status terms become locked code constants. All other Gulf UI copy stays normal translatable `ar.json` keys.
- **D-15:** Locked-phrase registries are **separate `legal/ae.ts` + `legal/sa.ts`** mirroring `LOCKED_GB_PHRASES` / `LOCKED_DE_PHRASES`: add `LOCKED_AE_PHRASES` + `LOCKED_SA_PHRASES` with literal-union key types, exported from `packages/validators/src/index.ts`.
- **D-16:** **Full real translations in all 4 locales** (en/de/pl/ar) for Gulf keys — NOT English placeholders for de/pl. `pnpm i18n:parity` must pass with genuine de + pl values.

**Standing engineering mandate**
- **D-17:** Conform to codebase coding standards over plan-template sketches: Prisma enum values `UPPER_SNAKE_CASE` (`db:audit-enum-casing`); no hardcoded user-facing strings (`useTranslations` + 4-locale parity); `writeAuditLog` on sensitive mutations (GULF-10 overrides, band edits, headcount edits, free-zone migration writes); tenant-scoped raw SQL only; Pino logging, no silent catch; web-vite container/hook/presentational layering + dialog/table pattern checks. DRY/SOLID, reuse existing assets, minimal careful diffs — do NOT touch pre-existing unrelated offenders.

### Claude's Discretion
- Exact `FreeZoneAssignment` field set, indexes, `UaeFreeZone` global-lookup seed (10 zones + Mainland) — values `UPPER_SNAKE_CASE`.
- NOC item severity (default `WARNING` per D-07) — researcher may escalate if a regulatory source requires it.
- ISIC-style code set / catalogue depth and where the contract's activity code is captured.
- `SaudizationConfig` / `SaudiHeadcount` schema shape, quarterly re-entry prompt, last-updated timestamp surfacing.
- Region-routing annotation mechanics for the 4 new models + the schema-lint cross-region-leakage assertion (GULF-11).
- Drift-override storage + audit shape for GULF-10 (mirror F1 Phase 71 override + "Custom — verify with adviser" badge).
- Dashboard data-layer wiring in web-vite (container + hook + presentational), loading/empty/error states, charts via `use-rtl-chart-config`.
- Exact locked Arabic statutory strings (PENDING legal review).
- Iqama expiry roll-up reuse of F1 expiry data — which existing query/service to extend.

### Deferred Ideas (OUT OF SCOPE)
- Auto-computed Saudization band — locked anti-feature (GULF-FUTURE-02), intentionally never built. System never auto-computes the band.
- New RTL machinery — reuse v4.0.
- F1 reminder-cron / payment-block engine itself (Phase 71/72) — Phase 79 only registers data INTO it.
- Cross-feature integration tests + manual UAT (Phase 80).
- UAE NOC drafting/submission flow (GULF-FUTURE-01) — Phase 79 only auto-adds the NOC *required-document item*, not a drafting flow.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GULF-01 | Record UAE free-zone assignment (10-zone enum + Mainland) with license number/category/expiry/permitted-activities | New `FreeZoneAssignment` + `UaeFreeZone` lookup models; 10 zones verified (web); enum values UPPER_SNAKE. ISIC-aligned permitted-activities. |
| GULF-02 | Track license expiry as `ContractorComplianceItem` (CRITICAL=BLOCKING) in F1 cascade + payment-block | `compliance-reminder-scan.ts` + `compliance-payment-gate.ts` both read `severity='BLOCKING' AND status='EXPIRED'`. Materialise row at `uae.free_zone_license@v2`. **Cron region fan-out required** (Pitfall 18). |
| GULF-03 | Scope-mismatch advisory + auto-add NOC required-document | ISIC-code overlap check (Rev.4 verified); auto-create `ContractorComplianceItem` documentType `NOC_*`, severity WARNING; non-blocking. |
| GULF-04 | Per-engagement `isSaudi` + `nationality` + `qiwaContractAuthenticated` | 3 new columns on `ContractorAssignment` (model at contractor.prisma:160). Qiwa-auth = 2026-04-15 requirement (verified). |
| GULF-05 | Manual Nitaqat band entry + industry-segment + last-updated + quarterly prompt; NEVER auto-compute | New `SaudizationConfig` (per-org). Band enum 6 values UPPER_SNAKE. Anti-feature lock honoured. |
| GULF-06 | Saudization dashboard: headcount, Saudi count, rate, band, Qiwa gap, Iqama roll-up | `SaudiHeadcount` manual + platform-derived side-by-side; mirror `computeComplianceHealth` derivation; Iqama roll-up reuses `ContractorComplianceItem` (ksa.iqama). |
| GULF-07 | Offboarding band-trajectory banner (advisory) | Live ephemeral recompute at offboarding-open; reads `SaudiHeadcount` minus 1; non-authoritative wording. Offboarding hook in `workflow-shared.ts`. |
| GULF-08 | Full Arabic + RTL (logical props only); ESLint `ml-`/`mr-` ban | Reuse `use-rtl-chart-config.ts` + `isRtl` + `ar.json`; web-vite container/hook layering. **`ml-`/`mr-` guard not located in tree — verify/build (Pitfall 20).** |
| GULF-09 | Locked-phrase registry: UAE/KSA Arabic statutory terms | New `legal/ae.ts` + `legal/sa.ts` mirroring `gb.ts`/`de.ts`; locked-phrases-guard test extension; signoff PENDING. |
| GULF-10 | Per-org override of Nitaqat thresholds / permitted-activity catalogues; audit-logged + "Custom — verify with adviser" badge | Mirror Phase 71 drift override; `writeAuditLog`; UI badge. |
| GULF-11 | ME-region routing + regional-routing annotations + schema-lint no-leakage test | Same schema → both EU+ME DBs; `ctx.db` region-aware via `org.dataRegion`. **No existing leakage-lint harness — net-new (Pitfall 19).** |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Free-zone license expiry → payment-block | API / Backend (compliance engine) | Cron worker (reminder fan-out) | Severity/status gate is server-authoritative; cron drives the cascade. Never client-trusted. |
| Free-zone assignment CRUD + migration | API / Backend | Database (ME region) | Tenant-scoped tRPC; region routing via `ctx.db`. |
| Permitted-activity ISIC scope check | API / Backend (contract-create path) | — | Deterministic code-overlap on the server at contract create; advisory only. |
| Saudization manual entry (config/headcount/band) | API / Backend | Database (ME region) | Audit-logged mutations; band never computed. |
| Saudization dashboard read model | API / Backend (derivation) | Frontend (web-vite container/hook) | Mirror `computeComplianceHealth`; rate from manual numbers, contractor breakdown side-by-side. |
| Offboarding trajectory banner | API / Backend (ephemeral query) | Frontend (presentational banner) | Live recompute, not persisted, not gating. |
| Arabic/RTL rendering | Frontend (web-vite) | — | Reuse v4.0 RTL infra; logical properties only. |
| Locked statutory phrases | Shared package (`packages/validators`) | Frontend (consume) | Code constants, not translation keys; CI-guarded. |
| Region routing + no-leakage | Database + API (runtime convention) | CI (schema-lint test) | Not a Prisma feature — `org.dataRegion` + `getRegionalClient`; lint asserts ME models never read via default client. |

## Standard Stack

This phase adds **no new runtime dependencies**. Every capability is built on existing in-tree packages and patterns.

### Core (existing — reuse)
| Library / Module | Location | Purpose | Why Standard |
|------------------|----------|---------|--------------|
| `@contractor-ops/compliance-policy` | `packages/compliance-policy` | Policy rule registry + `registerPolicyRule` + `resolvePolicyRules` + `parsePolicyRuleId` | Owns the `uae.free_zone_license` rule (Pitfall 1 rotation) `[VERIFIED: codebase]` |
| `compliance-supersession.ts` | `packages/api/src/services` | `materialiseFromPolicy` / `supersedeAndMaterialise` row rotation | The @v1→@v2 supersession mechanism `[VERIFIED: codebase]` |
| `compliance-payment-gate.ts` | `packages/api/src/services` | `assertContractorPaymentEligibility` — reads `BLOCKING`+`EXPIRED` | EXPIRED hard-block gate; region-correct via `tx`=`ctx.db` `[VERIFIED: codebase]` |
| `compliance-reminder-scan.ts` | `packages/api/src/services` | `runComplianceReminderScan` 90/60/30/15/7 cascade | Reads `BLOCKING`+`PENDING/EXPIRED`; **EU-only today** (Pitfall 18) `[VERIFIED: codebase]` |
| `@contractor-ops/db` `region.ts` | `packages/db/src/region.ts` | `getRegionalClient` / `SUPPORTED_REGIONS=['EU','ME']` / `preWarmRegionalClients` | The ME routing primitive `[VERIFIED: codebase]` |
| `@contractor-ops/validators` legal | `packages/validators/src/legal` | Locked-phrase pattern (`gb.ts`/`de.ts`) + signoff-registry | D-15 mirror target `[VERIFIED: codebase]` |
| `use-rtl-chart-config.ts` + `isRtl` | `apps/web-vite/src/hooks` | RTL Recharts config | D-13 reuse `[VERIFIED: codebase]` |
| `@contractor-ops/feature-flags` | `packages/feature-flags` | `evaluate`/`useFlag` + signoff-registry-flags.json PENDING gate | Gulf flags land PENDING `[VERIFIED: codebase]` |
| `audit-writer.ts` `writeAuditLog` | `packages/api/src/services` | Audit on sensitive mutations (D-17) | Structural-client `tx` pattern `[VERIFIED: codebase]` |
| `@contractor-ops/logger` (Pino) | `packages/logger` | `createLogger({ service })` / `createCronLogger` | No `console.*` (D-17) `[VERIFIED: codebase]` |

### Supporting (existing — reuse)
| Module | Location | Purpose | When to Use |
|--------|----------|---------|-------------|
| `exchange-rates.ts` region fan-out | `apps/cron-worker/src/jobs/handlers` | `fetchDaily` fans across `SUPPORTED_REGIONS` | **Template for the reminder-cron ME fan-out** (Pitfall 18) `[VERIFIED: codebase]` |
| `org-definition-sync.ts` | `packages/api/src/services` + cron handler | `getRegionalClient(dataRegion ?? 'EU')` + `createTenantClientFrom` | Region-aware cron write pattern `[VERIFIED: codebase]` |
| `regional-storage.ts` | `packages/api/src/services` | `REGION_BUCKET_MAP` region→resource resolution | Annotation/doc-comment precedent for GULF-11 `[VERIFIED: codebase]` |
| `computeComplianceHealth` | `packages/api/src/routers/core/contractor.ts:56` | Dashboard-derivation pattern | Mirror for Saudization live cross-check counts `[VERIFIED: codebase]` |
| `audit-enum-casing.ts` | `packages/db/scripts` | Walks `enum` blocks, asserts UPPER_SNAKE | Template for the GULF-11 schema-lint script `[VERIFIED: codebase]` |
| `country-fields.ts` validators | `packages/validators/src` | `UaeCountryFields` / `countryFieldsSchemaMap` | D-02 migration source-of-truth shape `[VERIFIED: codebase]` |
| `tenant.ts` middleware | `packages/api/src/middleware/tenant.ts` | `loadAndAssertActive` → `region` → `getRegionalClient` | Confirms `ctx.db` IS region-aware `[VERIFIED: codebase]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `ContractorComplianceItem` write from FreeZoneAssignment service | Route free-zone through `resolvePolicyRules`/`materialiseFromPolicy` | The policy path is driven by classification outcome; free-zone is keyed off `FreeZoneAssignment` not a classification. Routing it through `resolvePolicyRules` requires adding `zone` to `EngagementContext` AND ensuring `supersedeAndMaterialise` (which WAIVES rows not in the resolved set) does not orphan the free-zone item. **Direct service write is safer** (see Pitfall 2). |
| New `packages/gulf-regulatory` package (ROADMAP line 93 mention) | Inline into `packages/api` + `packages/compliance-policy` + `packages/validators` | A new package adds boundary/build cost. Given D-17's "reuse existing assets, minimal diffs" mandate and that nothing here is reusable cross-app, prefer extending existing packages. Flag as Open Question — confirm with planner. |
| `recharts` for the band donut | existing chart components in web-vite | Already standard; `use-rtl-chart-config` is built for recharts. No new lib. |

**Installation:** No `npm install` required — zero new packages. (If the planner elects a new `packages/gulf-regulatory` workspace, that is a workspace-internal package, not an external dependency — no registry/supply-chain gate applies.)

## Package Legitimacy Audit

> Not applicable — this phase installs **no external packages**. Every module referenced is an existing in-tree workspace package (`@contractor-ops/*`) or a standard-library import. No npm/PyPI/crates registry interaction, no slopcheck surface. If the planner introduces a new external dependency (none anticipated), the 7-day release-age gate (`pnpm-workspace.yaml minimumReleaseAge`) + `pnpm audit` + `pnpm security:scan` + typosquat check from CLAUDE.md apply.

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────────────────────┐
   Admin (UAE/KSA org) ───► │  web-vite UI (Arabic/RTL surfaces)           │
                            │  Page → Container → Hook(useTRPC) → Component │
                            └───────────────┬─────────────────────────────┘
                                            │ tRPC (region-aware ctx.db)
                                            ▼
        ┌───────────────────────────────────────────────────────────────────────┐
        │  packages/api  — Gulf tRPC router(s): Zod inputs, writeAuditLog         │
        │                                                                         │
        │  ┌─ FreeZoneAssignment CRUD ──┐   ┌─ Saudization config/headcount ──┐   │
        │  │ on create/update/expiry:   │   │ manual band/headcount entry     │   │
        │  │  write ContractorCompliance│   │  + drift overrides (audit-log)  │   │
        │  │  Item(severity=BLOCKING,   │   └────────────┬────────────────────┘   │
        │  │   policyRuleId=@v2,        │                │ derivation             │
        │  │   expiresAt=licenseExpires)│                ▼                        │
        │  │  IF zone != MAINLAND       │      Saudization dashboard read model    │
        │  └─────────┬──────────────────┘      (rate from manual #s; contractor    │
        │            │                          breakdown side-by-side)            │
        │  ┌─ Contract create path ─────┐                                         │
        │  │ ISIC-code overlap check →  │      Offboarding open (Saudi national):  │
        │  │ advisory banner + auto-NOC │      ephemeral band-trajectory banner    │
        │  │ ContractorComplianceItem   │      (SaudiHeadcount minus 1; advisory)   │
        │  └────────────────────────────┘                                         │
        └───────────────┬─────────────────────────────────────────┬──────────────┘
                        │ ctx.db = getRegionalClient(org.dataRegion)│
                        ▼                                           ▼
              ┌──────────────────┐                       ┌──────────────────┐
              │ EU Postgres DB   │                       │ ME Postgres DB   │ ◄── UAE/KSA orgs land HERE
              │ (DATABASE_URL_EU)│                       │ (DATABASE_URL_ME)│     (FreeZoneAssignment,
              └──────────────────┘                       └──────────────────┘      Saudization*, compliance
                        ▲                                           ▲              items, assignments)
                        │                                           │
        ┌───────────────┴───────────────────────────────────────────┴──────────────┐
        │  cron-worker: reminders job → runComplianceReminderScan()                 │
        │  ★ TODAY: uses default prismaRaw (DATABASE_URL = EU ONLY)                  │
        │  ★ REQUIRED: fan out across SUPPORTED_REGIONS so ME items are scanned      │
        │    (template: exchange-rates.ts fetchDaily region fan-out)                │
        └───────────────────────────────────────────────────────────────────────────┘
```

**Trace the primary use case (free-zone license expires):** Admin records `FreeZoneAssignment` (zone=DMCC, licenseExpiresAt) → service writes `ContractorComplianceItem(BLOCKING, expiresAt)` into ME DB → reminder cron (region fan-out) scans ME DB, fires 90/60/30/15/7 digests → on expiry the item's `status` becomes `EXPIRED` → next payment run calls `assertContractorPaymentEligibility` on `ctx.db` (ME) → finds `BLOCKING+EXPIRED` → hard-blocks. Mainland contractor: no item written (D-04), no block.

### Recommended Project Structure
```
packages/db/prisma/schema/
└── gulf.prisma                      # NEW — FreeZoneAssignment, SaudizationConfig,
                                     #       SaudiHeadcount, UaeFreeZone + enums
                                     #       (+ 3 cols added to ContractorAssignment in contractor.prisma)
packages/db/scripts/
└── lint-region-leakage.ts          # NEW — GULF-11 schema-lint (template: audit-enum-casing.ts)
packages/compliance-policy/src/policies/
└── uae.ts                          # EDIT — bump free_zone_license → @v2 BLOCKING, narrow appliesIf
packages/api/src/
├── services/
│   ├── free-zone-compliance.ts     # NEW — write/supersede free-zone ContractorComplianceItem
│   ├── saudization-dashboard.ts    # NEW — derivation (mirror computeComplianceHealth)
│   └── permitted-activity-check.ts # NEW — ISIC overlap + auto-NOC
└── routers/
    └── gulf/                       # NEW namespace — free-zone CRUD, saudization, overrides
packages/validators/src/legal/
├── ae.ts                           # NEW — LOCKED_AE_PHRASES (mirror gb.ts)
└── sa.ts                           # NEW — LOCKED_SA_PHRASES (mirror gb.ts)
apps/web-vite/src/components/
├── contractors/.../free-zone-*     # free-zone form (hide old UAE freeform inputs)
└── saudization/                    # dashboard container/hook/presentational + override UI
apps/web-vite/messages/{en,de,pl,ar}.json  # Gulf keys, real values all 4 (D-16)
```

### Pattern 1: Bump a policy rule to a new version (D-03)
**What:** Edit the existing `uae.free_zone_license@v1` registration in-place to `@v2` with `severity: 'BLOCKING'` and a narrowed `appliesIf`. The registry is keyed by `policyRuleId` and `parsePolicyRuleId` splits stableNamespace (`uae.free_zone_license`) from version. The reminder/gate label resolution uses the stableNamespace, so the i18n key path (`Compliance.documentType.compliance-policy-engine.uae.free_zone_license`) is **unchanged** across the version bump.
**When to use:** Any time a rule's severity/legal-text/predicate changes and existing materialised rows must be rotated.
```typescript
// Source: packages/compliance-policy/src/policies/uae.ts [VERIFIED: codebase]
// EDIT the existing registration:
registerPolicyRule({
  policyRuleId: 'uae.free_zone_license@v2',   // was @v1
  jurisdiction: 'UAE',
  documentType: 'UAE_FREE_ZONE_LICENSE',
  displayName: 'UAE Free-Zone Trade License',
  severity: 'BLOCKING',                        // was WARNING (D-03)
  expiryJurisdictionTz: 'Asia/Dubai',
  appliesIf: (ctx) => /* free-zone, not Mainland — see Pitfall 2 for the zone-source problem */ true,
  draftLegalText: '... (PENDING legal review)',
  expirySemantic: 'fixed_months',
  expiryMonths: 12,
});
// NOTE: parsePolicyRuleId enforces /^[a-z]+\.[a-z][a-z_0-9]*@v\d+$/ — '@v2' is valid.
// POLICY_RULE_SET_VERSION must bump so existing assessments' policyRuleSetVersion < current
// triggers the recompute/supersession path (see classification.ts recompute mutation).
```

### Pattern 2: Materialise a compliance item that the cascade + gate read (GULF-02)
**What:** The free-zone item must carry `severity='BLOCKING'`, `status` transitioning to `EXPIRED`, `expiresAt`, `expiryJurisdictionTz`, `policyRuleId='uae.free_zone_license@v2'` — exactly the columns the cron + gate select on.
```typescript
// Source: shape derived from compliance-reminder-scan.ts + compliance-payment-gate.ts [VERIFIED: codebase]
// Both consumers query:
//   reminder cron: WHERE severity='BLOCKING' AND status IN ('PENDING','EXPIRED')
//                  AND expiresAt != null AND expiryJurisdictionTz != null
//   payment gate:  WHERE severity='BLOCKING' AND status='EXPIRED'
await tx.contractorComplianceItem.create({
  data: {
    organizationId, contractorId, contractId: null,
    documentType: 'UAE_FREE_ZONE_LICENSE',
    name: 'UAE Free-Zone Trade License',
    severity: 'BLOCKING',
    policyRuleId: 'uae.free_zone_license@v2',
    expiryJurisdictionTz: 'Asia/Dubai',
    expiresAt: freeZoneAssignment.licenseExpiresAt,   // drives the cascade band math
    status: 'PENDING',                                 // cron flips to EXPIRED via daysUntilExpiry < 0
  },
});
// Status semantics: the cron computes band from daysUntilExpiryInTz; the EXPIRED *gate* needs
// status='EXPIRED'. Confirm which actor flips PENDING→EXPIRED (a cron job, a query-time
// derivation, or a listener) — see Open Question 2.
```

### Pattern 3: Region fan-out for a cron scan (Pitfall 18 fix)
**What:** Wrap the scan so it runs once per configured region against that region's client.
```typescript
// Source: pattern from apps/cron-worker/src/jobs/handlers/exchange-rates.ts (fetchDaily fans
// across SUPPORTED_REGIONS) + packages/db/src/region.ts getRegionalClient [VERIFIED: codebase]
import { SUPPORTED_REGIONS, getRegionalClient } from '@contractor-ops/db';
for (const region of SUPPORTED_REGIONS) {
  let client;
  try { client = getRegionalClient(region); } catch { continue; } // skip unconfigured regions
  await runComplianceReminderScanForClient(client, now); // refactor scan to accept a client
}
// CAVEAT: runComplianceReminderScan currently closes over module-level prismaRaw. The refactor
// must thread the regional client through processItem/persistBandFire/dispatchDigest. dedup keys
// (claimCronNotificationDedup) are global today — confirm they don't collide cross-region
// (prefix with region if the dedup store is shared). See Open Question 3.
```

### Pattern 4: Locked statutory phrase registry (D-15)
**What:** Mirror `gb.ts` exactly — `export const` literals, a `LOCKED_*_PHRASES` record, a `RESERVED_*_LEGAL_KEYS` array, a `Locked*PhraseKey` type, re-exported from `packages/validators/src/index.ts`, and added to the `locked-phrases-guard.test.ts` reserved-key iteration.
```typescript
// Source: packages/validators/src/legal/gb.ts [VERIFIED: codebase]
export const NITAQAT_BAND_PLATINUM = 'PLATINUM' as const;          // statutory band labels
export const DMCC_AUTHORITY_LEGAL_NAME = 'Dubai Multi Commodities Centre Authority' as const;
// ... (PENDING legal review per Standing Constraint)
export const RESERVED_AE_LEGAL_KEYS = ['DMCC_AUTHORITY_LEGAL_NAME', /* ... */] as const;
export const LOCKED_AE_PHRASES = { DMCC_AUTHORITY_LEGAL_NAME, /* ... */ } as const;
export type LockedAePhraseKey = keyof typeof LOCKED_AE_PHRASES;
// Guard (__tests__/locked-phrases-guard.test.ts): no RESERVED_AE_LEGAL_KEYS key may appear in
// any messages/*.json. Distinct from the per-jurisdiction doc-name map in compliance-uae.ts.
```

### Anti-Patterns to Avoid
- **Adding a `CRITICAL` Severity enum value.** Breaks `db:audit-enum-casing` expectations and the F1 tri-tier contract. "CRITICAL" in ROADMAP/REQUIREMENTS == `BLOCKING`.
- **Routing free-zone items through `supersedeAndMaterialise` without including them in `resolvePolicyRules`.** `supersedeAndMaterialise` WAIVES every non-WAIVED row not re-emitted by `resolvePolicyRules(engagement)` — it would orphan/waive a free-zone item written out-of-band on the next classification recompute (Pitfall 2).
- **Reading ME-region models via the default `prisma`/`prismaRaw` client.** That client is `DATABASE_URL` = EU only. Use `ctx.db` (region-aware) in routers and `getRegionalClient(region)` in cron/services (Pitfall 18/19).
- **Auto-computing the Nitaqat band.** Locked anti-feature. The trajectory banner (D-12) may only *suggest* in advisory language.
- **Deriving the nationalisation rate from platform contractors alone.** Nitaqat counts the whole workforce; rate must come from manual `SaudiHeadcount` (D-10).
- **`ml-`/`mr-` Tailwind classes on Gulf surfaces.** Logical properties only (`ms-`/`me-`/`ps-`/`pe-`).
- **English placeholders for de/pl Gulf keys.** D-16 requires real translations (the `i18n:parity` guard only checks key *existence*, not value distinctness — discipline + review, not a gate).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Free-zone expiry reminders | A bespoke free-zone reminder cron | Materialise `ContractorComplianceItem(BLOCKING)` → existing `runComplianceReminderScan` cascade | The 90/60/30/15/7 band logic, per-recipient digest throttle, dedup, optimistic concurrency already exist `[VERIFIED: codebase]` |
| Payment hard-block on expiry | A new payment guard | Existing `assertContractorPaymentEligibility` (reads BLOCKING+EXPIRED) | Already wired into `payment.create` + `payment.lockAndExport` + `approval.resumeFromCompliance` with TOCTOU re-assert `[VERIFIED: codebase]` |
| Policy version rotation | Custom migration to flip severity on existing rows | `supersedeAndMaterialise` + `POLICY_RULE_SET_VERSION` bump + recompute mutation | Carry-forward of `satisfiedByDocumentId`/`expiresAt` + WAIVED audit already handled `[VERIFIED: codebase]` |
| Region routing | Manual env-var switching | `getRegionalClient(region)` + `ctx.db` (already region-aware) | HMR-safe client pool; tenant middleware resolves `org.dataRegion` `[VERIFIED: codebase]` |
| Enum-casing enforcement | Manual review | `db:audit-enum-casing` (run after schema edits) | Walks all enum blocks `[VERIFIED: codebase]` |
| Locked-phrase CI guard | New guard | Extend `locked-phrases-guard.test.ts` reserved-key iteration | Already iterates en/pl/ar/de against `RESERVED_*_LEGAL_KEYS` `[VERIFIED: codebase]` |
| i18n key parity | Manual diff | `pnpm i18n:parity` (en→de/pl/ar key coverage) | Baseline-aware; NEW drift fails `[VERIFIED: codebase]` |
| Dashboard count derivation | Ad-hoc queries scattered in router | Mirror `computeComplianceHealth` shape | Established dashboard-derivation pattern `[VERIFIED: codebase]` |
| RTL charts | New RTL logic | `use-rtl-chart-config()` | `xAxis reversed`, `yAxis orientation`, `direction:rtl` already encoded `[VERIFIED: codebase]` |

**Key insight:** GULF-02 is the highest-leverage requirement and requires almost no new code — the entire reminder + payment-block machinery already keys off `severity='BLOCKING' AND status='EXPIRED'`. The only genuinely new backend work for GULF-02 is (a) writing the row from the FreeZoneAssignment path and (b) making the cron region-aware. Everything downstream is reuse.

## Runtime State Inventory

> This phase includes a **rename/migration** sub-task (D-02: migrate freeform `contractor.countryFields` UAE fields → `FreeZoneAssignment`). Inventory below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `Contractor.countryFields` JSONB holds UAE freeform values for existing AE-org contractors: `tradeLicenseNumber`, `freeZone` (bool), `tradeLicenseExpiry`, `freelancePermitNumber`. These are the **D-02 backfill source**. Located via `contractor.ts:1322` AE field list + `country-fields.ts UaeCountryFields`. | **Data migration**: idempotent backfill script reading `countryFields` → inserting `FreeZoneAssignment` rows (per-contractor). Must run **per region** (EU + ME) — UAE orgs are in ME. Mirror the Phase 70/74/76 multi-region backfill pattern (deferred post-deploy apply under LOCAL-ONLY). Saudi `countryFields` are explicitly NOT migrated (D-02). |
| **Live service config** | None — no external UI/SaaS (n8n/Datadog/Tailscale) stores these UAE fields. The freeform values live only in the app DB. | None — verified: `countryFields` is app-DB-only (Prisma JSONB on `Contractor`). |
| **OS-registered state** | None — no OS-level registration embeds free-zone or Saudization strings. | None — verified: no Task Scheduler / pm2 / systemd references. |
| **Secrets/env vars** | `DATABASE_URL_EU` / `DATABASE_URL_ME` already exist (region routing). No new secret. Free-zone/Saudization carry no credentials. | None new. Confirm `DATABASE_URL_ME` is configured wherever the reminder cron runs (else the fan-out silently skips ME — Pitfall 18 caveat). |
| **Build artifacts / installed packages** | If a new `packages/gulf-regulatory` workspace is created (ROADMAP mention), it produces `dist/` + workspace symlinks; otherwise none. New Prisma models require `prisma generate` (client regen) before API typecheck resolves. | Run `prisma generate` after schema edit (per STATE.md note, `prisma db push` is blocked by the pre-existing `Contractor.search_vector` GENERATED column — use `prisma generate` for type resolution; multi-region apply via `pnpm db:migrate:all` is a deferred post-deploy item). |

**The canonical question — after every file is updated, what runtime systems still have the old string?** Existing AE contractors' `countryFields` JSONB retains the freeform values until the backfill runs AND the old inputs are hidden (D-02). The plan must (1) hide the old UAE freeform inputs in `country-compliance-section.tsx`, (2) ship the backfill script, (3) NOT delete `countryFields` data (keep as audit trail / rollback). Double-entry/drift is the failure mode D-02 explicitly forbids.

## Common Pitfalls

### Pitfall 1: Orphaning existing free-zone compliance rows on the @v1→@v2 bump
**What goes wrong:** Bumping `policyRuleId` to `@v2` without rotating existing `ContractorComplianceItem` rows that still carry `policyRuleId='uae.free_zone_license@v1'`. The gate/cron read by `severity`+`status` (not by version), so old `@v1` `WARNING` rows would neither block nor be recognised as the new BLOCKING rule.
**Why it happens:** The registry is code; existing materialised rows are data. They drift unless rotated.
**How to avoid:** Bump `POLICY_RULE_SET_VERSION`; the existing recompute/supersession path (`recreateComplianceAssessment` / `supersedeAndMaterialise`) rotates rows when `assessment.policyRuleSetVersion < current`. BUT free-zone rows are written out-of-band (Pitfall 2), so the rotation must also cover free-zone items written by the new service path. Plan an explicit one-time backfill that upgrades existing `@v1` free-zone rows (re-severity to BLOCKING or re-materialise from FreeZoneAssignment).
**Warning signs:** Expired free-zone license does not block payment; reminder cron skips it; `policyRuleId` mismatch in the items table.

### Pitfall 2: `appliesIf` has no zone field, and the free-zone item isn't on the classification path
**What goes wrong:** D-04 requires `appliesIf` to narrow to free-zone zones (exclude Mainland). But `EngagementContext` (types.ts:21) has only `jurisdiction/outcome/sector/contractorNationality/requiresRegulatedEquipment` — **no zone**. AND `resolvePolicyRules`/`materialiseFromPolicy` is driven by the **classification** path (classification.ts submit/recompute), which materialises classification-outcome rules — NOT free-zone-license rows keyed off `FreeZoneAssignment`.
**Why it happens:** Two different data sources (classification outcome vs. FreeZoneAssignment) trying to flow through one policy resolver designed for the former.
**How to avoid:** **Recommended** — write/supersede the free-zone `ContractorComplianceItem` **directly from the FreeZoneAssignment service** (not via `resolvePolicyRules`). Gate the write in that service on `zone !== 'MAINLAND'` (the D-04 narrowing lives in the service, not in `appliesIf`). Keep `appliesIf: () => false` or a conservative predicate on `@v2` so the classification path never materialises it (avoiding double-write). If the planner instead wants `appliesIf` to do the narrowing, `EngagementContext` must gain a `zone` field AND the FreeZoneAssignment service must build the context — a larger change. **Critically:** `supersedeAndMaterialise` WAIVES every non-WAIVED row not re-emitted by `resolvePolicyRules`; if a free-zone row is written out-of-band but `resolvePolicyRules` doesn't include it, the next classification recompute will WAIVE the free-zone item. Either (a) include free-zone in `resolvePolicyRules` output, or (b) exclude free-zone rows from the supersession scope (filter `findMany` by `policyRuleId NOT LIKE 'uae.free_zone%'` or by a `source` discriminator). This interaction MUST be tested (see Validation Architecture).
**Warning signs:** Free-zone compliance item silently flips to WAIVED after an unrelated classification change.

### Pitfall 3: Materialising a free-zone item for Mainland contractors
**What goes wrong:** Recording a Mainland contractor still writes a BLOCKING expiry item → wrongly payment-blocks a regime that has no free-zone license.
**How to avoid:** D-04 — the service gates the `ContractorComplianceItem` write on `zone !== 'MAINLAND'`. Mainland remains a recordable `UaeFreeZone`/enum value but arms no gate.
**Warning signs:** Mainland contractor blocked from payment; expiry item exists for a Mainland row.

### Pitfall 4: Treating "CRITICAL" as an enum value
**What goes wrong:** Adding `CRITICAL` to `Severity` to match ROADMAP wording → breaks `db:audit-enum-casing` expectations and the tri-tier F1 contract.
**How to avoid:** `Severity = BLOCKING | WARNING | INFO`. "CRITICAL" maps to `BLOCKING`. (D-03.)

### Pitfall 5: ME-region data invisible to EU-only cron/gate
**What goes wrong:** See Pitfall 18 (primary). The reminder cron uses default `prismaRaw` = EU. ME free-zone items never fire reminders.

### Pitfall 6: ISIC over-flagging on uncoded contracts
**What goes wrong:** Firing a scope-mismatch advisory when the contract activity has no ISIC code to compare → noise on ambiguous catalogues.
**How to avoid:** D-08 — no code on the contract → skip the check entirely. No code, no advisory. No MANUAL_REVIEW tristate.
**Warning signs:** Advisory banners on contracts whose activity wasn't coded.

### Pitfall 7: Deriving nationalisation rate from platform contractors
**What goes wrong:** The platform only sees contractors; Nitaqat counts the whole workforce (employees included). Deriving the rate from contractors understates it.
**How to avoid:** D-10 — rate is computed from manual `SaudiHeadcount` (admin-entered org-wide total + Saudi count). Show the platform-derived contractor breakdown side-by-side for sanity-check only.

### Pitfall 8: Auto-computing or authoritatively asserting the band
**What goes wrong:** The trajectory banner (D-12) computing/asserting a band → legal-liability anti-feature breach.
**How to avoid:** Advisory language only ("may drop to LOW_GREEN — verify in Qiwa"); ephemeral, not stored, not gating. System suggests, never sets, the band.

### Pitfall 18 (HIGH PRIORITY): Reminder cron is EU-only — ME free-zone items never enter the cascade
**What goes wrong:** `runComplianceReminderScan` (compliance-reminder-scan.ts) runs on the module-level `prismaRaw` (= `DATABASE_URL` = EU), and the reminders cron handler (`apps/cron-worker/.../reminders/index.ts:385`) calls it once with no region iteration. **UAE/KSA orgs live in the ME DB**, so their free-zone (and Iqama) BLOCKING items are never scanned → no 90/60/30/15/7 reminders fire for Gulf contractors. GULF-02 ("participating in the F1 reminder cascade") is **not satisfied by data registration alone** — the cron must fan out across regions.
**Why it happens:** Phase 72 shipped the cascade against the EU default client before any ME-region BLOCKING items existed; the EU-only assumption was invisible until Gulf data lands.
**How to avoid:** Refactor `runComplianceReminderScan` to accept a Prisma client (thread it through `processItem`/`persistBandFire`/`dispatchDigest` instead of closing over `prismaRaw`), then loop `SUPPORTED_REGIONS` calling `getRegionalClient(region)`. Template: `exchange-rates.ts fetchDaily` already fans across `SUPPORTED_REGIONS`. Confirm `DATABASE_URL_ME` is configured in the cron-worker env (else `getRegionalClient('ME')` throws and the fan-out must skip gracefully). Confirm `claimCronNotificationDedup` keys don't collide across regions (prefix with region if the dedup store is shared). **The payment gate is already region-correct** (it receives `tx`=`ctx.db` which is region-aware) — only the cron needs fixing.
**Warning signs:** Gulf contractors get payment-blocked on expiry (gate works) but never received any 90/60/30-day reminder (cron didn't scan ME).

### Pitfall 19 (HIGH PRIORITY): "Regional-routing annotation" + no-leakage lint must be designed — Prisma has no region attribute
**What goes wrong:** Expecting a Prisma model-level `@region` attribute or a built-in leakage guard. There is none. The **same** schema deploys to BOTH the EU and ME physical DBs (`migrate-all-regions.ts` runs `migrate deploy` against each `DATABASE_URL_*`). "Region" is a **runtime routing** concern: `ctx.db = getRegionalClient(org.dataRegion)`. A "leak" = code that reads an ME-only model via the default `prisma`/`prismaRaw` (EU) client instead of a region-aware client.
**Why it happens:** The phrase "regional-routing annotation" suggests a schema feature; it's actually a doc-comment convention + a discipline that the new schema-lint must assert.
**How to avoid:** (1) Annotate the 4 new models with a doc comment declaring ME-region intent (precedent: `regional-storage.ts REGION_BUCKET_MAP` comments, `org-definition-sync.ts` region usage). (2) Write the GULF-11 schema-lint as a **net-new** script (no existing harness — template: `audit-enum-casing.ts` walks schema files; here you grep API/service source for default-client reads of the 4 new models). The realistic assertion: "no `prisma.freeZoneAssignment` / `prismaRaw.freeZoneAssignment` (etc.) call outside an explicitly region-aware path" — i.e., these models are only ever reached via `ctx.db` or `getRegionalClient`. Decide the exact lint shape with the planner (static grep vs. a runtime test that asserts the models aren't on the EU schema — they ARE on both schemas, so a pure "not on EU" assertion is wrong).
**Warning signs:** A Saudization query returns empty for an ME org because it ran against the EU client.

### Pitfall 20: The `ml-`/`mr-` ESLint ban guard could not be located in the current tree
**What goes wrong:** GULF-08/D-13/canonical_refs assert an existing "Phase 70 v6.0-surface guard" banning `ml-`/`mr-`. Research could not find it: web-vite has no `eslint.config.*`/`.eslintrc` (uses Biome — `biome check`), and no script greps for `ml-`/`mr-`. (The `lint:ci` script chains many `check:web-vite-*` guards but none target Tailwind margin classes.)
**Why it happens:** Either the guard lives in a Biome rule not yet present, was planned-but-not-shipped, or is named differently.
**How to avoid:** The planner must **verify or build** the guard. If absent, ship it as part of GULF-08 (a small script grepping Gulf surfaces for `\bm[lr]-` and failing, or a Biome `noRestrictedSyntax`-style rule). Do not assume it exists. Confirm against `package.json lint:ci` chain.
**Warning signs:** `ml-`/`mr-` classes pass CI on Gulf surfaces (RTL breaks in Arabic).

### Pitfall 21: `i18n:parity` does NOT enforce real (non-placeholder) de/pl values
**What goes wrong:** Assuming `pnpm i18n:parity` will catch English-placeholder de/pl values for D-16. It only asserts **key existence** (every en key exists in de/pl/ar) — not that the value differs from en.
**How to avoid:** D-16 (real translations) is a **plan + review discipline**, not a gate. The planner should add a review checkpoint / human-verify for genuine de+pl Gulf translations. (`scripts/audit-translations-quality.ts` exists and flags some quality issues like RTL marks, but is not a placeholder-equality gate.)
**Warning signs:** de.json Gulf values identical to en.json; parity passes anyway.

## Code Examples

### Reading the region-aware client in a router (GULF-11)
```typescript
// Source: packages/api/src/middleware/tenant.ts (loadAndAssertActive → getRegionalClient)
//         + every existing tenantProcedure [VERIFIED: codebase]
// ctx.db is ALREADY region-aware (resolves org.dataRegion → getRegionalClient → tenant-scoped).
// Gulf routers just use ctx.db like any other router; ME orgs transparently hit the ME DB.
getFreeZoneAssignment: tenantProcedure
  .input(z.object({ contractorId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db.freeZoneAssignment.findUnique({
      where: { contractorId: input.contractorId }, // org scope enforced by tenant client
    });
  });
```

### Audit-logged drift override (GULF-10)
```typescript
// Source: writeAuditLog signature in audit-writer.ts + Phase 71 drift-override pattern [VERIFIED: codebase]
await writeAuditLog({
  organizationId: ctx.organizationId,
  actorType: 'USER',
  action: 'gulf.nitaqat_threshold.override',
  resourceType: 'CONTRACTOR',       // or an org-scoped resource type
  resourceId: input.configId,
  metadata: { before, after, custom: true }, // drives "Custom — verify with adviser" badge
  tx,                                // pass tx inside transactions (D-17)
});
```

### Adding the 3 ContractorAssignment columns (GULF-04)
```prisma
// Source: contractor.prisma model ContractorAssignment (line 160) [VERIFIED: codebase]
// Additive columns — nullable to keep the migration additive-only (mirrors Phase 73/74/76).
model ContractorAssignment {
  // ... existing fields ...
  isSaudi                   Boolean? // GULF-04 — per-engagement nationality flag
  nationality               String?  // ISO-3166-1 alpha-2
  qiwaContractAuthenticated Boolean? @default(false) // 2026-04-15 Qiwa requirement
}
// Enums for the new Gulf models MUST be UPPER_SNAKE (db:audit-enum-casing):
//   enum NitaqatBand { PLATINUM HIGH_GREEN MID_GREEN LOW_GREEN YELLOW RED }
//   enum UaeFreeZoneCode { DIFC DMCC IFZA DUBAI_INTERNET_CITY DUBAI_MEDIA_CITY
//                          MEYDAN_FZ JAFZA SHAMS RAKEZ ADGM MAINLAND }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Freeform `countryFields` JSONB for UAE license | Structured `FreeZoneAssignment` model | This phase (D-02) | Single source of truth; feeds compliance engine + payment-block |
| Saudization rate from manual labor-office filings | Qiwa-authenticated contracts only count toward Nitaqat | **2026-04-15** (verified) | Undocumented Saudi contracts are "invisible" to Nitaqat; `qiwaContractAuthenticated` gap is a real coverage risk |
| Nitaqat Yellow tier | **Yellow tier eliminated (2025)** — former Yellow → Red | 2025 (verified) | Enum keeps YELLOW as a recordable historical/manual value; system never auto-computes, so retaining the label is safe |
| Fragmented Dubai contractor rules | Dubai Law No. 7/2025 — Emirate-wide Contractors' Register (construction/contracting) | Published 2025-07-08, effective 2026-01-08, transition to 2027-01-08 (verified) | Advisory "verify with legal" note only — it targets construction/contracting registration, NOT generic freelancer free-zone licenses; do NOT code a register-integration |

**Deprecated/outdated:**
- The freeform UAE `countryFields` inputs in `country-compliance-section.tsx` — hidden after D-02 migration (data retained for audit/rollback).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | UAE activity classification mirrors **ISIC Rev.4** (sections A–U → divisions → groups → classes); each free zone maintains its own permitted-activity subset | Permitted-activity / D-05/D-06 | If a zone uses a non-ISIC code scheme, admin-tagged codes still work (codes are admin-curated per-contractor; platform ships no authoritative catalogue), so risk is low. `[ASSUMED]` from web search — verify per-authority before relying on cross-authority code comparability. |
| A2 | Nitaqat 2026 band thresholds are **sector-specific and changed in the Nov-2025→Apr-2026 cycle**; Yellow eliminated 2025 | State of the Art / GULF-05 | Band is **manual-entry only** (system never computes), so exact thresholds don't drive code — only seed/override defaults + display. Low risk. `[ASSUMED]` exact per-sector rates need legal verification (DEFERRED). |
| A3 | The 2026-04-15 Qiwa-auth requirement means uncertified Saudi contracts don't count toward Nitaqat | GULF-04/GULF-06 | Drives only the visibility-only `qiwaContractAuthenticated` gap count (D-11) — no gating. Low risk. `[VERIFIED: multiple sources]` (KPMG, Arabian Business, Qiwa) — but legal sign-off DEFERRED. |
| A4 | Dubai Law No. 7/2025 is construction/contracting-register scoped, NOT generic freelancer free-zone licensing | State of the Art | If it DID govern freelancer licenses, a register integration might be in scope — but it does not; it's an advisory legal note. `[VERIFIED: Al Tamimi, Kennedys, Mondaq]` |
| A5 | The `ml-`/`mr-` ESLint ban guard referenced in CONTEXT/ROADMAP **does not currently exist** in the tree | Pitfall 20 / GULF-08 | If it actually exists under a name I missed, building a duplicate is wasted work; if it truly doesn't, assuming it exists leaves GULF-08 unenforced. **Planner must verify.** `[ASSUMED]` from grep — could not find via config/script search. |
| A6 | A new `packages/gulf-regulatory` workspace is optional; extending existing packages is preferred per D-17 | Standard Stack alternatives | If the milestone architecture mandates the package (ROADMAP line 93 names it), inlining diverges from roadmap. `[ASSUMED]` — confirm with planner. |
| A7 | The free-zone `ContractorComplianceItem` should be written **directly from the FreeZoneAssignment service** (not via `resolvePolicyRules`) | Pitfall 2 / Pattern 2 | If the planner prefers the policy-resolver path, `EngagementContext` needs a `zone` field + supersession-scope handling. Either is workable; direct-write is lower-risk. `[ASSUMED]` recommendation. |

**If this table is empty:** N/A — see assumptions above; all require planner/legal confirmation per the DEFERRED legal-review Standing Constraint.

## Open Questions

1. **New `packages/gulf-regulatory` workspace vs. inline?**
   - What we know: ROADMAP line 93 names `packages/gulf-regulatory`; D-17 mandates reuse + minimal diffs.
   - What's unclear: whether a separate package earns its boundary cost (nothing is reused cross-app).
   - Recommendation: inline into `packages/api` + `packages/compliance-policy` + `packages/validators` unless the planner wants the package for milestone consistency. Decide early (affects every file path).

2. **Who flips free-zone item `status` PENDING→EXPIRED?**
   - What we know: the payment gate reads `status='EXPIRED'`; the reminder cron computes bands from `daysUntilExpiryInTz` but writes to `ContractorComplianceReminderState`, not the item's `status`.
   - What's unclear: which actor transitions the item's own `status` to `EXPIRED` (a cron, a query-time derivation, a listener). This must be confirmed against how Phase 72 handles EXPIRED for OTHER BLOCKING items (e.g., Emirates ID) — Phase 79 must use the same mechanism, not invent one.
   - Recommendation: trace the existing EXPIRED-flip for `uae.emirates_id@v1` (also BLOCKING) and reuse it verbatim for free-zone.

3. **Cron region fan-out: dedup key collisions + ME env availability.**
   - What we know: `claimCronNotificationDedup` keys (`compl:band:...`, `compl:digest:...`) are not region-prefixed; `getRegionalClient('ME')` throws if `DATABASE_URL_ME` is unset.
   - What's unclear: whether the dedup store is shared across regions (collision risk) and whether the cron-worker env has `DATABASE_URL_ME`.
   - Recommendation: region-prefix dedup keys defensively; skip-on-missing-env gracefully (try/catch around `getRegionalClient`). Verify cron-worker env config.

4. **Exact GULF-11 schema-lint assertion shape.**
   - What we know: the 4 models live on BOTH EU+ME schemas (same `migrate deploy`); a "leak" is a default-client read.
   - What's unclear: whether the lint is a static source grep ("no default-client reads of these models") or a runtime test.
   - Recommendation: static grep over `packages/api`/`apps` for `prisma.<model>` / `prismaRaw.<model>` outside region-aware paths; pair with a runtime test asserting an ME-org query routes to `getRegionalClient('ME')`.

5. **Where is the contract's activity code captured?** (Claude's discretion per CONTEXT.)
   - What we know: ISIC-style codes drive matching (D-06); the contractor's permitted codes live on `FreeZoneAssignment`.
   - What's unclear: whether `Contract` has an activity-descriptor/code field today or one must be added.
   - Recommendation: planner inspects `contract.prisma` for an existing activity field; if absent, add an optional `activityIsicCodes String[]` to the contract (uncoded → skip per D-08).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `DATABASE_URL_EU` | EU region routing | ✓ (existing) | — | — |
| `DATABASE_URL_ME` | ME region routing (Gulf data) + cron fan-out | ✓ schema-supported; **verify cron-worker has it set** | — | Fan-out skips ME gracefully if unset (but then GULF-02 reminders don't fire for Gulf — must be set) |
| Prisma client regen | New models → API typecheck | ✓ (`prisma generate`) | Prisma 7 | `prisma db push` blocked by `Contractor.search_vector` GENERATED column — use `prisma generate` for types (per STATE.md) |
| Multi-region migrate | Schema apply to both DBs | ✓ `pnpm db:migrate:all` (`migrate-all-regions.ts`) | — | Deferred post-deploy apply under LOCAL-ONLY (Phase 70/73/74/76 precedent) |
| `pnpm i18n:parity` | D-16 key parity | ✓ | — | — (does not check value distinctness — Pitfall 21) |
| `pnpm --filter @contractor-ops/db db:audit-enum-casing` | Enum casing (D-17) | ✓ | — | — |
| No external/network deps | — | ✓ | — | Phase is local DB + UI only |

**Missing dependencies with no fallback:** None blocking — but `DATABASE_URL_ME` MUST be present in the cron-worker runtime for GULF-02 reminders to reach Gulf orgs (otherwise the cascade silently skips ME).
**Missing dependencies with fallback:** Multi-region migrate apply is deferred post-deploy (LOCAL-ONLY).

## Validation Architecture

> `nyquist_validation` enabled (not `false` in config — treat as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (turbo `pnpm test`) |
| Config file | per-package `vitest.config.ts` (e.g. `packages/api`, `packages/compliance-policy`, `packages/validators`) |
| Quick run command | `pnpm --filter @contractor-ops/api test <path>` (scope to the new test files) |
| Full suite command | `pnpm test` (turbo) — **NEVER** run the full web-vite suite unscoped (eats RAM per project memory; scope with a path arg) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GULF-02 | Expired free-zone license (BLOCKING+EXPIRED) hard-blocks payment | integration | `pnpm --filter @contractor-ops/api test free-zone-payment-block` | ❌ Wave 0 |
| GULF-02/D-04 | **Mainland** contractor gets NO item and is NOT blocked | unit | `pnpm --filter @contractor-ops/api test free-zone-mainland-exclusion` | ❌ Wave 0 |
| GULF-02 | @v1→@v2 supersession preserves/rotates rows (no orphan) | integration | `pnpm --filter @contractor-ops/api test free-zone-supersession` | ❌ Wave 0 |
| GULF-02 | **Free-zone item survives an unrelated classification recompute** (not wrongly WAIVED — Pitfall 2) | integration | `pnpm --filter @contractor-ops/api test free-zone-supersession-isolation` | ❌ Wave 0 |
| GULF-02 | Reminder cron scans ME region (fan-out) | integration | `pnpm --filter @contractor-ops/api test reminder-region-fanout` | ❌ Wave 0 |
| GULF-03 | ISIC scope-mismatch fires advisory + auto-adds NOC item | integration | `pnpm --filter @contractor-ops/api test permitted-activity-noc` | ❌ Wave 0 |
| GULF-03/D-08 | Uncoded contract activity → check SKIPPED (no advisory) | unit | `pnpm --filter @contractor-ops/api test permitted-activity-uncoded-skip` | ❌ Wave 0 |
| GULF-05 | Manual band entry; system never auto-computes | unit | `pnpm --filter @contractor-ops/api test saudization-band-manual` | ❌ Wave 0 |
| GULF-06 | Rate computed from manual SaudiHeadcount, NOT platform contractors | unit | `pnpm --filter @contractor-ops/api test saudization-rate-source` | ❌ Wave 0 |
| GULF-07 | Trajectory banner = ephemeral, advisory wording, not stored/gating | unit | `pnpm --filter @contractor-ops/api test offboarding-trajectory` | ❌ Wave 0 |
| GULF-10 | Override is audit-logged + sets "custom" flag | integration | `pnpm --filter @contractor-ops/api test gulf-override-audit` | ❌ Wave 0 |
| GULF-11 | Region routing — no cross-region leakage (ME query hits ME client) | integration + lint | `pnpm --filter @contractor-ops/db lint:region-leakage` + api test | ❌ Wave 0 (net-new lint) |
| GULF-08 | `ml-`/`mr-` banned on Gulf surfaces | lint | `pnpm lint:ci` (verify/build guard — Pitfall 20) | ❌ verify |
| GULF-09 | Locked AE/SA phrases absent from messages/*.json | unit | `pnpm --filter @contractor-ops/validators test locked-phrases-guard` | ⚠️ extend existing |
| GULF-01/04/05 | Enum values UPPER_SNAKE | lint | `pnpm --filter @contractor-ops/db db:audit-enum-casing` | ✅ existing gate |
| GULF-08/D-16 | i18n key parity en→de/pl/ar | lint | `pnpm i18n:parity` | ✅ existing gate |

### Sampling Rate
- **Per task commit:** scoped `pnpm --filter <pkg> test <path>` for the touched area + relevant lint guard (`db:audit-enum-casing` after schema, `i18n:parity` after messages, `lint:audit-log` after mutations).
- **Per wave merge:** `pnpm --filter @contractor-ops/api test` + `pnpm --filter @contractor-ops/validators test` + `pnpm --filter @contractor-ops/db db:audit-enum-casing` + `pnpm i18n:parity`.
- **Phase gate:** full lint:ci chain green + the new region-leakage lint + scoped web-vite checks (`check:web-vite-{data-layer,page-shells,presentational,table-pattern,dialog-pattern}`) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/api/src/__tests__/free-zone-*.test.ts` — GULF-02 block/Mainland/supersession/isolation/region-fanout
- [ ] `packages/api/src/__tests__/permitted-activity-*.test.ts` — GULF-03 advisory + NOC + uncoded-skip
- [ ] `packages/api/src/__tests__/saudization-*.test.ts` — GULF-05/06/07 manual band, rate source, trajectory
- [ ] `packages/api/src/__tests__/gulf-override-audit.test.ts` — GULF-10
- [ ] `packages/db/scripts/lint-region-leakage.ts` + test — GULF-11 (net-new)
- [ ] Extend `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — AE/SA reserved keys
- [ ] Verify/build `ml-`/`mr-` Gulf-surface guard — GULF-08 (Pitfall 20)
- [ ] Shared fixtures: ME-region org + UAE/KSA contractor + FreeZoneAssignment factory

## Security Domain

> `security_enforcement` enabled (absent = enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Reuses Better Auth session; no new auth surface |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | Tenant scope from session (`ctx.organizationId`, `org.dataRegion`) — never client; `requirePermission({ contractor: [...] })` on mutations; ME-region isolation (GULF-11) is an access-control boundary (an EU org must never read ME data and vice-versa) |
| V5 Input Validation | **yes** | Zod on every tRPC procedure (free-zone fields, band enum, headcount numbers, ISIC codes); enum-constrained band/zone; no unsafe `as` on inputs |
| V6 Cryptography | no | No new secrets/crypto; free-zone/Saudization carry no credentials |
| V7 Error/Logging | **yes** | Pino structured logs; `writeAuditLog` on overrides/band/headcount/migration writes (D-17); no silent catch |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-region data leakage (ME data via EU client) | Information Disclosure | `ctx.db` region-aware; GULF-11 no-leakage lint; never default-`prisma` for the 4 new models (Pitfall 19) |
| Cross-tenant read of free-zone/Saudization data | Information Disclosure / IDOR | Tenant-scoped client (`organizationId` from session); `findUnique` with org scope |
| Spoofed `qiwaContractAuthenticated` / `isSaudi` from client | Tampering | Server-side Zod validation; audit-log on writes; values are admin-asserted (advisory, non-gating per D-11) — low blast radius |
| Wrongful payment-block on Mainland (DoS-by-policy) | Denial of Service | D-04 Mainland exclusion gate (Pitfall 3) tested |
| Mistranslated/drifted statutory phrase | Tampering / Repudiation | Locked-phrase registry (D-14/15) + CI guard; legal sign-off PENDING |
| Stale band asserted as authoritative | Repudiation | Manual band + last-updated timestamp + quarterly re-prompt; trajectory banner non-authoritative (D-08/D-12) |

## Sources

### Primary (HIGH confidence)
- Codebase (read directly): `packages/compliance-policy/src/{policies/uae.ts,registry.ts,types.ts}`; `packages/api/src/services/{compliance-supersession.ts,compliance-payment-gate.ts,compliance-reminder-scan.ts}`; `packages/db/src/region.ts`; `packages/db/src/raw.ts`; `packages/api/src/middleware/tenant.ts`; `packages/api/src/routers/{core/contractor.ts,compliance/classification.ts}`; `packages/validators/src/legal/{gb.ts,index.ts,compliance-uae.ts}`; `packages/validators/src/__tests__/locked-phrases-guard.test.ts`; `packages/feature-flags/src/{registry.ts,signoff-registry-flags.json}`; `apps/web-vite/{ARCHITECTURE.md,src/hooks/use-rtl-chart-config.ts}`; `apps/cron-worker/src/jobs/handlers/{reminders/index.ts,exchange-rates.ts}`; `packages/db/scripts/{audit-enum-casing.ts,migrate-all-regions.ts}`; `scripts/i18n-parity.mjs`; `.planning/{ROADMAP.md,REQUIREMENTS.md,STATE.md,79-CONTEXT.md}`.

### Secondary (MEDIUM confidence — verified across multiple credible sources, legal review DEFERRED)
- Qiwa contract authentication mandate (2026-04-15): https://kpmg.com/xx/en/our-insights/gms-flash-alert/2026/flash-alert-2026-116.html ; https://www.arabianbusiness.com/abnews/saudi-arabia-raises-qiwa-contract-compliance-to-85-in-april-90-by-june-2026 ; https://www.qiwa.sa/en/business-owners/manage-current-employees/how-authenticate-contracts
- Nitaqat 2026 bands / Yellow elimination / sector quotas: https://www.middleeastbriefing.com/news/saudi-arabias-nitaqat-2026-update-latest-quotas-by-sector-and-what-foreign-employers-need-to-comply-now/ ; https://mercans.com/glossary/saudization-nitaqat/
- Dubai Law No. 7/2025 (construction/contracting register): https://www.tamimi.com/law-update-articles/a-new-era-for-contractors-in-dubai-an-overview-of-law-no-7-of-2025/ ; https://www.kennedyslaw.com/en/thought-leadership/article/2025/dubai-law-no-7-of-2025-a-new-era-for-the-construction-sector/
- UAE free zones + ISIC Rev.4 activity classification: https://ifza.com/en/industry-analysis/uae-business-activity-license-mapping-guide-dubai/ ; https://www.rizmona.com/blog/list-of-free-zones-in-uae/

### Tertiary (LOW confidence — single source / needs validation)
- Exact per-sector Nitaqat thresholds (band is manual-entry only; not code-driving) — DEFERRED legal verification.
- Per-authority permitted-activity code comparability (codes are admin-curated per-contractor; no cross-authority catalogue shipped).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module read directly from the tree; zero new external deps.
- Architecture / integration mechanics: HIGH — cron/gate/supersession/region-routing read directly; the two HIGH-priority pitfalls (cron EU-only, leakage-lint net-new) confirmed against source.
- External regulatory facts: MEDIUM — Qiwa-2026-04-15 + ISIC Rev.4 + Nitaqat-Yellow-eliminated cross-verified; exact thresholds DEFERRED (and band is manual-only anyway, so not code-critical).
- Pitfalls: HIGH for codebase-derived (1-8, 18-21); MEDIUM for the `ml-`/`mr-` guard existence (could not locate — flagged for verification).

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 for codebase mechanics (stable); 2026-06-17 for regulatory facts (Saudization cycle is actively changing Nov-2025→Apr-2026).
