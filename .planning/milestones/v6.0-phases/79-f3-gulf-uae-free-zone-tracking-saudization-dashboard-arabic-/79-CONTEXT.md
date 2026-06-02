# Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The Gulf operational layer for UAE/KSA orgs, composing on F1's `ContractorComplianceItem` + reminder cron + payment-block (Phase 71/72) and the v4.0 Arabic/RTL + multi-region foundations. Six capability clusters:

1. **UAE free-zone tracking** — a new structured `FreeZoneAssignment` (10-zone seed enum + Mainland, license number/category/expiry, permitted-activities) replacing today's freeform `contractor.countryFields`. License expiry plugs into the F1 reminder cascade (90/60/30/15/7) and **hard-blocks payment when EXPIRED**.
2. **Permitted-activity scope-mismatch advisory** — when a contract's activity descriptor falls outside the contractor's free-zone permitted set, surface a non-gating banner and auto-add an NOC required-document item for the affected engagement.
3. **Saudization dashboard** — manual-entry Nitaqat band (`SaudizationConfig`), org-wide headcount (`SaudiHeadcount`), nationalisation rate, Qiwa-auth coverage gap, Iqama expiry roll-up (reusing F1 expiry data). System **NEVER auto-computes the band** (legal-liability anti-feature, locked at requirements).
4. **Offboarding band-trajectory banner** — advisory-only pre-offboarding projection for Saudi-national contractors.
5. **Arabic + RTL across every Gulf surface** — reuse v4.0 RTL infra; extend the locked-phrase registry with UAE/KSA statutory terms.
6. **Per-org drift overrides** (GULF-10) — audit-logged override of seed Nitaqat thresholds / UAE permitted-activity catalogues with "Custom — verify with adviser" badge.

New ME-region Prisma models (`FreeZoneAssignment`, `SaudizationConfig`, `SaudiHeadcount`, `UaeFreeZone` global lookup) carry explicit regional-routing annotations; schema-lint asserts no cross-region leakage (GULF-11, Pitfall 19).

**Out of scope:** auto-computed Saudization band (locked anti-feature — manual only forever, GULF-FUTURE-02); new RTL machinery (reuse v4.0); F1 reminder-cron / payment-block engine itself (Phase 71/72 — Phase 79 only registers data into it); cross-feature integration tests + manual UAT (Phase 80).

</domain>

<decisions>
## Implementation Decisions

### Free-zone data model + severity (Area 1)
- **D-01:** `FreeZoneAssignment` is **per-contractor** (one license belongs to the contractor's legal entity, not a single engagement). The permitted-activity scope check runs whenever ANY contract is created for that contractor.
- **D-02:** **Migrate + supersede** the existing freeform `contractor.countryFields` UAE fields (`tradeLicenseNumber`, `freeZone` bool, `tradeLicenseExpiry`). Backfill into `FreeZoneAssignment`, make it the single source of truth, hide the old freeform UAE inputs in `country-compliance-section.tsx`. No double-entry / drift. (Saudi `countryFields` — `freelanceSaLicense`, `commercialRegistration*` — are out of this migration; only UAE free-zone fields move.)
- **D-03:** **Bump `uae.free_zone_license@v1` (currently `WARNING`) → `BLOCKING @v2`** via the Phase 71 policy-supersession rotation. Expired free-zone license hard-blocks payment per GULF-02. NOTE: ROADMAP/REQUIREMENTS say "severity CRITICAL" — the `Severity` enum has **no `CRITICAL`**; it is `BLOCKING / WARNING / INFO`. "CRITICAL" maps to **`BLOCKING`**. Do NOT add a `CRITICAL` enum value.
- **D-04:** **Mainland contractors get NO free-zone expiry item and NO payment-block.** `appliesIf` narrows the rule to actual free-zone zones only (DED-licensed Mainland is a different regime). Mainland is still a recordable enum option; it just doesn't arm the CRITICAL/BLOCKING gate.

### Permitted-activity matching (Area 2)
- **D-05:** Store permitted-activities as **human-readable text + an optional list of admin-tagged ISIC-style codes**. Text satisfies SC#1 ("permitted-activities text persist") and is for display/audit; the codes drive matching (SC#2 "ISIC-style codes"). Resolves the text-vs-codes tension in the ROADMAP success criteria.
- **D-06:** Match a contract's activity descriptor by **ISIC-code overlap** — if the contract's code is not in the contractor's permitted code set, fire the advisory. Deterministic, low false-positive (Pitfall 15 intent). No fuzzy text matching.
- **D-07:** The advisory is **non-blocking**: show a scope-mismatch banner on the engagement AND **auto-create an NOC (No-Objection Certificate) required-document item** for that engagement so it appears in compliance and can be fulfilled. Contract creation still proceeds. (NOC item severity = `WARNING` — surfaced, not payment-blocking — unless researcher finds a regulatory reason to escalate.)
- **D-08:** When the contract activity is **uncoded/uncertain (no ISIC tag to compare) → skip the check**. No code, no advisory. Avoids over-flagging on ambiguous catalogues (Pitfall 15). No MANUAL_REVIEW tristate for this surface.

### Saudization data + trajectory (Area 3)
- **D-09:** Per-engagement Saudi fields (`isSaudi`, `nationality`, `qiwaContractAuthenticated`, GULF-04) live as **new columns on the existing `ContractorAssignment` model** — not a separate 1:1 model. ME-org rows route to the ME db via existing region routing. Add explicit regional-routing annotation consistent with GULF-11.
- **D-10:** Headcount is **manual `SaudiHeadcount` entry** (admin enters org-wide total + Saudi-national headcount — Nitaqat counts the whole workforce including employees the platform does not track) **plus a platform-derived contractor breakdown shown side-by-side** for sanity-check. Nationalisation rate computed from the manual numbers. Never derive the rate from platform contractors alone (would understate the workforce).
- **D-11:** Qiwa-auth coverage gap is **visibility-only**: dashboard shows the count of contracts where `qiwaContractAuthenticated = false`. No block/warn gate, no per-engagement compliance item (ROADMAP scopes only the count).
- **D-12:** Offboarding band-trajectory banner (GULF-07) is a **live, ephemeral recompute, advisory-only**. On opening offboarding for a Saudi-national, project the nationalisation rate from current `SaudiHeadcount` minus one Saudi national, render rate delta + **non-authoritative** wording ("may drop to LOW_GREEN — verify in Qiwa"). Not stored, not gating. Respects the never-auto-compute-band lock (D — system suggests, never sets, the band).

### Arabic / RTL + locked phrases (Area 4)
- **D-13:** **Reuse the v4.0 RTL infra** verbatim — CSS logical properties (`ms-`/`me-`/`ps-`/`pe-` only), `ar.json`, `use-rtl-chart-config.ts`, `isRtl`. The existing ESLint `ml-`/`mr-` ban enforces it on v6.0 surfaces (GULF-08). No new RTL machinery.
- **D-14:** **Lock statutory identifiers only** (GULF-09): free-zone authority legal names, Nitaqat band labels (PLATINUM/HIGH_GREEN/MID_GREEN/LOW_GREEN/YELLOW/RED), and Qiwa-auth status terms become locked code constants (no drift/mistranslation). All other Gulf UI copy stays normal translatable `ar.json` keys.
- **D-15:** Locked-phrase registries are **separate `legal/ae.ts` + `legal/sa.ts`** mirroring `LOCKED_GB_PHRASES` / `LOCKED_DE_PHRASES`: add `LOCKED_AE_PHRASES` + `LOCKED_SA_PHRASES` with literal-union key types, exported from `packages/validators/src/index.ts`. Consistent with the v5.0 per-jurisdiction convention.
- **D-16:** **Full real translations in all 4 locales** (en/de/pl/ar) for Gulf keys — NOT English placeholders for de/pl. (User decision, overriding the placeholder default.) `pnpm i18n:parity` must pass with genuine de + pl values, not en copies.

### Standing engineering mandate (user-confirmed, Phase 79)
- **D-17:** This phase MUST conform to codebase coding standards over plan-template sketches: Prisma enum values `UPPER_SNAKE_CASE` (`db:audit-enum-casing`); no hardcoded user-facing strings (`useTranslations` + 4-locale parity); `writeAuditLog` on sensitive mutations (GULF-10 overrides, band edits, headcount edits, free-zone migration writes); tenant-scoped raw SQL only; Pino logging, no silent catch; web-vite container/hook/presentational layering + dialog/table pattern checks. DRY/SOLID, reuse existing assets, minimal careful diffs — do NOT touch pre-existing unrelated offenders. Run the relevant lint/biome/db gates before marking any plan done.

### Claude's Discretion
- Exact `FreeZoneAssignment` field set, indexes, and the `UaeFreeZone` global-lookup seed (10 zones + Mainland) — researcher pins; values must be `UPPER_SNAKE_CASE`.
- NOC item severity (default `WARNING` per D-07) — researcher may escalate if a regulatory source requires it.
- ISIC-style code set / catalogue depth and where the contract's activity code is captured (existing contract field vs new) — researcher determines.
- `SaudizationConfig` / `SaudiHeadcount` schema shape, quarterly re-entry prompt mechanism, and last-updated timestamp surfacing.
- Region-routing annotation mechanics for the 4 new models (follow `region.ts` pattern) and the schema-lint cross-region-leakage assertion (GULF-11, Pitfall 19).
- Drift-override storage + audit shape for GULF-10 (mirror F1 Phase 71 override + "Custom — verify with adviser" badge).
- Dashboard data-layer wiring in web-vite (container + hook + presentational), loading/empty/error states, charts via `use-rtl-chart-config`.
- Exact locked Arabic statutory strings (PENDING legal review — see Standing Constraints).
- Iqama expiry roll-up reuse of F1 expiry data — which existing query/service to extend.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements + roadmap (source of truth)
- `.planning/ROADMAP.md` "Phase 79: F3 Gulf …" — 7 numbered success criteria + 10-zone enum + band enum + research flags. SC#1→D-01..D-04; SC#2→D-05..D-08; SC#3→D-09..D-11; SC#4→D-12; SC#5→D-13/D-14/D-16; SC#6→D-17 + GULF-10; SC#7→GULF-11.
- `.planning/REQUIREMENTS.md` — GULF-01..GULF-11 (full requirement text).
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY, legal review DEFERRED; **codebase coding standards override plan templates** (enum casing, no hardcoded strings, audit-log, the full lint/biome/db gate list). Gulf flags land PENDING.

### F1 Compliance infrastructure (Phase 79 registers data INTO this — does not modify the engine)
- `packages/db/prisma/schema/contractor.prisma` — `ContractorComplianceItem`, `ComplianceRequirementTemplate`, `Severity` enum (`BLOCKING/WARNING/INFO` — NO CRITICAL), `ComplianceStatus`, `WaivedReason`, `ContractorAssignment` (D-09 extends), `AssignmentStatus`. RLS policies in the baseline migration.
- `packages/compliance-policy/src/policies/uae.ts` — existing `uae.emirates_id@v1` (BLOCKING) + `uae.free_zone_license@v1` (**WARNING — D-03 bumps to BLOCKING @v2**). Add structured zone handling here.
- `packages/compliance-policy/src/registry.ts` — `registerPolicyRule` API + supersession.
- `packages/api/src/services/compliance-supersession.ts` — `materialiseFromPolicy`, policy-version rotation (D-03 reuses for the @v2 bump).
- Phase 72 reminder-cron + payment-block services (researcher locates) — free-zone expiry plugs into the 90/60/30/15/7 cascade + the EXPIRED hard-block gate.

### Existing UAE/Saudi contractor fields (D-02 migrates these)
- `apps/web-vite/src/components/contractors/country-compliance-section.tsx` — current freeform `freelancePermitNumber`, `tradeLicenseNumber`, `freeZone` switch, `tradeLicenseExpiry` inputs (hide for UAE after migration).
- `packages/api/src/routers/core/contractor.ts` — `getCountryFieldsConfig` / `getCountryFields` / country-fields update; AE field list `['freelancePermitNumber','tradeLicenseNumber','freeZone','tradeLicenseExpiry']`; `computeComplianceHealth` (dashboard-derivation pattern); `LEGAL_TRANSITIONS` lifecycle map.
- `packages/validators/src/country-fields.ts` — `UaeCountryFields` / `SaudiCountryFields` types + `country-fields` validators.

### Multi-region routing (GULF-11)
- `packages/db/src/region.ts` — `getRegionalClient(region)`, `SUPPORTED_REGIONS = ['EU','ME']`, `DataRegion`, `org.dataRegion`.
- `packages/db/src/index.ts` — region/replica export surface + routing notes.
- `packages/api/src/services/regional-storage.ts` — region→bucket pattern (annotation example).
- `packages/api/src/services/org-definition-sync.ts` — `getRegionalClient(region)` usage example (`dataRegion ?? 'EU'`).

### Locked-phrase registry + signoff (GULF-09)
- `packages/validators/src/legal/gb.ts` + `legal/de.ts` — `LOCKED_GB_PHRASES` / `LOCKED_DE_PHRASES` pattern + literal-union key types (D-15 mirrors → `legal/ae.ts`, `legal/sa.ts`).
- `packages/validators/src/index.ts` — export surface for locked phrases + `signoff-registry` (`getAllPending`, `isAllApproved`).
- `packages/feature-flags/src/registry.ts` + `signoff-registry.json` + `signoff-registry-flags-schema.ts` — Gulf flags (`gulf-free-zone-tracking`, `gulf-saudization-dashboard`) land PENDING (Phase 70 D-09 pattern).

### Arabic / RTL (GULF-08, D-13)
- `apps/web-vite/src/hooks/use-rtl-chart-config.ts` — RTL Recharts config + `isRtl(locale)`.
- `apps/web-vite/src/i18n/useTranslations.ts` + `messages/{en,de,pl,ar}.json` — translation boundary; `pnpm i18n:parity` (D-16: real de+pl values).
- web-vite ESLint `ml-`/`mr-` ban guard (Phase 70 v6.0-surface guard).

### web-vite architecture (all Gulf UI)
- `apps/web-vite/ARCHITECTURE.md` — page→container→hook→presentational layering; `check:web-vite-{data-layer,page-shells,presentational,table-pattern,dialog-pattern}` gates.

### Offboarding hook (GULF-07 trajectory banner)
- `packages/api/src/routers/workflow/workflow-shared.ts` — offboarding template keys; `WorkflowRun` / `WorkflowTaskType` (incl. `CONTRACT_HEALTH_CHECK`, `IP_VERIFICATION`).
- `WaivedReason.CONTRACTOR_OFFBOARDED` (contractor.prisma) — fires on offboarding completion; trajectory banner reads at offboarding open.

### Prior-phase context (drift-override + supersession precedent)
- `.planning/phases/71-*/71-CONTEXT.md` — F1 `ContractorComplianceItem` + severity + policy supersession + drift override + "Custom — verify with adviser" badge (D-03, GULF-10 mirror this).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`registerPolicyRule` + `materialiseFromPolicy` + supersession** (`compliance-policy` / `compliance-supersession.ts`) — D-03 bumps the free-zone rule to `BLOCKING @v2` through this existing rotation; no bespoke migration logic.
- **`computeComplianceHealth`** (`contractor.ts`) — dashboard-derivation pattern to mirror for the Saudization live cross-check counts.
- **`getRegionalClient` / `region.ts`** — GULF-11 ME-region routing; annotation precedent in `regional-storage.ts` + `org-definition-sync.ts`.
- **`LOCKED_GB_PHRASES` / `LOCKED_DE_PHRASES`** (`validators/legal`) — exact shape for `LOCKED_AE_PHRASES` / `LOCKED_SA_PHRASES`.
- **`use-rtl-chart-config.ts` + `isRtl`** — RTL charts/layout, reused as-is.
- **Existing UAE `countryFields` UI + router** — source data for the D-02 backfill migration.
- **signoff-registry + feature-flags registry** — Gulf flags land PENDING (Phase 70 pattern).

### Established Patterns
- **Policy-rule + supersession (Phase 71)** — free-zone license is a `ContractorComplianceItem` produced by a policy rule, not a bespoke table for the gate.
- **Severity tri-tier `BLOCKING/WARNING/INFO`** — "CRITICAL"=BLOCKING; never add a CRITICAL enum value.
- **Drift escape-hatch + "Custom — verify with adviser" badge (v5.0 / F1 71)** — GULF-10 reuses for Nitaqat thresholds + permitted-activity catalogue overrides.
- **Regex/code-first matching, MANUAL fallback only where justified (P22/P15)** — D-06/D-08 use deterministic ISIC-code overlap, skip-on-uncoded (no fuzzy, no tristate here).
- **web-vite container/hook/presentational + dialog/table pattern checks** — all Gulf UI conforms; run the `check:web-vite-*` gates.
- **Per-jurisdiction locked-phrase files** — `legal/ae.ts` + `legal/sa.ts`.

### Integration Points
- **New Prisma models** (ME-region annotated): `FreeZoneAssignment` (per-contractor), `SaudizationConfig` (per-org manual band), `SaudiHeadcount` (per-org manual headcount), `UaeFreeZone` (global lookup seed). + new columns on `ContractorAssignment` (`isSaudi`, `nationality`, `qiwaContractAuthenticated`).
- **`compliance-policy/src/policies/uae.ts`** — free-zone rule → `BLOCKING @v2`, `appliesIf` narrowed to free-zone zones (excludes Mainland).
- **Contract-create path** — permitted-activity ISIC-overlap check → advisory banner + auto-NOC item.
- **New tRPC router(s)** — free-zone assignment CRUD, Saudization config/headcount CRUD + dashboard query, drift overrides; Zod inputs, `writeAuditLog`, region-routed.
- **web-vite surfaces** — free-zone form, Saudization dashboard, NOC flow, override UI; full ar/RTL; keys in all 4 locales.
- **`validators/legal/ae.ts` + `sa.ts`** + index exports; signoff-registry PENDING entries.
- **schema-lint test** — assert no cross-region leakage for the 4 new models (GULF-11, Pitfall 19).

</code_context>

<specifics>
## Specific Ideas

- The single biggest landmine: the existing `uae.free_zone_license@v1` is `WARNING` and `appliesIf: () => true` (all UAE). Phase 79 must (a) bump to `BLOCKING @v2` AND (b) narrow `appliesIf` to free-zone zones so Mainland contractors are not wrongly payment-blocked. Both, together, via supersession.
- "CRITICAL" appears in ROADMAP/REQUIREMENTS text but is NOT a `Severity` enum value — it means `BLOCKING`. Adding a `CRITICAL` enum value would break `db:audit-enum-casing` expectations and the F1 tri-tier contract.
- Nitaqat is a whole-workforce metric; the platform only sees contractors — hence `SaudiHeadcount` is MANUAL. Deriving the rate from platform contractors alone would be wrong. Show both numbers, compute the rate from the manual entry.
- Band is manual forever (locked anti-feature). The offboarding trajectory may only *suggest* a band drop in advisory language — it must never set or assert the band authoritatively.
- de/pl Gulf translations are real (user decision), even though no DE/PL Gulf orgs exist — `i18n:parity` must pass with genuine values.
- User explicitly mandated: follow coding standards, DB/lint/biome gates, DRY/SOLID, reuse existing codebase, careful minimal diffs (D-17).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Auto-computed Saudization band = locked anti-feature, GULF-FUTURE-02, intentionally never built.)

</deferred>

---

*Phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-*
*Context gathered: 2026-06-03*
