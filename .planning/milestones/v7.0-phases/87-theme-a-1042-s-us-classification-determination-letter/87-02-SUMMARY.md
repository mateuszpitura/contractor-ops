---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 02
subsystem: database
tags: [prisma, postgres, 1042-s, 1099-k, us-classification, ab5, tenant-isolation, multi-region]

# Dependency graph
requires:
  - phase: 85-us-treaty-engine
    provides: WithholdingTaxRate.treatyArticle column + applyTreaty treaty-rate resolution reused by the 1042-S service
  - phase: 86-iris-1099
    provides: Form1099Nec / IrisSubmission / IrisAck / Tax1099Threshold immutable-supersede + config-table idioms mirrored here
  - phase: 87-01
    provides: US-expansion flag gating + Wave-1 groundwork this schema builds on
provides:
  - Form1042S immutable + supersede-chain model (Chapter-3/4 boxes, treaty article, FTIN last-4 snapshot)
  - Form1099KTrackerState per-contractor/tax-year band state (SAFE/APPROACHING/OVER)
  - Tax1099KThreshold tax-year-keyed config (TY2026 = $20,000 + 200 tx, OBBBA)
  - US_DETERMINATION_LETTER ClassificationDocumentKind value
  - ContractorAssignment.workState (nullable-additive AB5 work-state trigger)
  - regenerated in-repo Prisma client with the new model/enum types
  - per-model cross-org leak regression for both new tenant-owning models
affects: [87-03 US classification AB5/§530, 87-04 form-1042s.service, 87 1099-K tracker cron, 87 determination-letter PDF]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immutable record-of-record via supersede chain + corrected flag (NOT the APPEND_ONLY runtime guard, so status-flip updateMany stays legal) — mirrors Form1099Nec"
    - "Tax-year-keyed threshold config table instead of hardcoded constants (Tax1099KThreshold)"
    - "Nullable-additive schema evolution (workState) — zero data migration, existing rows stay NULL"
    - "New tenant-owning models kept out of globalModels + a per-model cross-org leak test (V4 IDOR guard)"

key-files:
  created:
    - packages/db/prisma/seed/tax-1099k-threshold.ts
    - packages/db/src/__tests__/cross-org-leak-1042s.test.ts
  modified:
    - packages/db/prisma/schema/tax.prisma
    - packages/db/prisma/schema/classification.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/seed/index.ts

key-decisions:
  - "Form1042S is immutable-by-convention (supersede chain + corrected flag), NOT added to APPEND_ONLY_MODELS — the CORRECTED path (Plan 04) flips prior ACTIVE→SUPERSEDED via updateMany, which the runtime append-only guard would block; this matches Form1099Nec/TaxFormSubmission"
  - "Box-3b/4b chapter rates and all Appendix B/C code columns made nullable so a DRAFT 1042-S is insertable before the treaty/rate is resolved by the service"
  - "1099-K threshold seeded at $20,000 + 200 transactions for TY2026 (OBBBA), never the stale $5K/$600"
  - "No new ClassificationAssessment column for US — countryCode='US' + the existing outcome Json carry the AB5/§530 scoring outcome"

patterns-established:
  - "Pattern: per-tax-year 1099-K config table (Tax1099KThreshold) keyed by taxYear @unique, seeded via the raw client in the seed index"
  - "Pattern: 1099-K band tracker state row mirrors EconomicDependencyAlertState (currentBand + lastScannedAt/lastCrossedAt/lastReminderAt)"

requirements-completed: [US-FORM-06, US-CLASS-01, US-CLASS-02, US-CLASS-03, US-CLASS-04]

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 87 Plan 02: 1042-S + US-Classification Prisma Surface Summary

**Form1042S immutable/supersede model with Chapter-3/4 boxes + treaty snapshot, a tax-year-keyed 1099-K band tracker + threshold config, the US_DETERMINATION_LETTER document kind, and a nullable AB5 workState field — all tenant-isolated and covered by a cross-org leak test; the live-regional migration is deferred to the P82–86 human gate.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-01T10:58:00Z (approx)
- **Completed:** 2026-07-01T11:07:00Z
- **Tasks:** 2 executed (Task 3 deferred — human gate)
- **Files modified:** 20 (7 source + regenerated Prisma client)

## Accomplishments
- Added `Form1042S` (immutable + supersede chain): box-1 income code, box-2 gross income (minor), box-3a/3b + 4a/4b chapter-3/4 exemption codes + rates, box-7 federal tax withheld, recipient 13j/13k/13n status + LOB codes, treaty article, FTIN last-4 `snapshotJson`, `corrected`, `supersededById`, soft-delete `deletedAt`.
- Added `Form1099KTrackerState` (per contractor per tax-year, `@@unique([contractorId, taxYear])`) with `Form1099KBand` (SAFE/APPROACHING/OVER) + cumulative payout/transaction counters + scan/cross/reminder timestamps.
- Added `Tax1099KThreshold` tax-year config; seeded TY2026 = $20,000 (2,000,000 minor) + 200 transactions (OBBBA), adviser-verify annotated.
- Added `US_DETERMINATION_LETTER` to `ClassificationDocumentKind` and a nullable `ContractorAssignment.workState` (AB5 primary trigger; falls back to the contractor's US state).
- Regenerated the in-repo Prisma client (new `Form1042S` / `Form1099KTrackerState` / `Tax1099KThreshold` models + enums) and committed it with the schema.
- Cross-org leak regression proves an org-B tenant client reads zero org-A rows for both new tenant-owning models; both are confirmed absent from `globalModels`.

## Task Commits

1. **Task 1: schema models + fields + seed + regenerated client** - `05d20804f` (feat)
2. **Task 2: cross-org leak test + globalModels negative assertion** - `6fdd3453d` (test)
3. **Task 3: apply multi-region migration (EU/ME/US)** - DEFERRED (human gate, see below)

## Files Created/Modified
- `packages/db/prisma/schema/tax.prisma` - Form1042S + Form1042SStatus, Form1099KTrackerState + Form1099KBand, Tax1099KThreshold
- `packages/db/prisma/schema/classification.prisma` - US_DETERMINATION_LETTER document kind
- `packages/db/prisma/schema/contractor.prisma` - ContractorAssignment.workState + Contractor back-relations (form1042s, form1099kTrackerStates)
- `packages/db/prisma/schema/organization.prisma` - Organization back-relations (form1042s, form1099kTrackerStates)
- `packages/db/prisma/seed/tax-1099k-threshold.ts` - TY2026 $20,000 + 200 threshold seed (created)
- `packages/db/prisma/seed/index.ts` - wired seedTax1099KThreshold into the seed run
- `packages/db/src/__tests__/cross-org-leak-1042s.test.ts` - two-org isolation regression (created)
- `packages/db/src/generated/prisma/client/**` - regenerated client (new model/enum types)

## Verification
- `pnpm --filter @contractor-ops/db db:generate` — GREEN (Prisma Client 7.8.0 regenerated).
- `pnpm --filter @contractor-ops/db exec prisma validate` — GREEN (schemas valid).
- `pnpm --filter @contractor-ops/db db:audit-enum-casing` — the 3 new enums (Form1042SStatus, Form1099KBand, US_DETERMINATION_LETTER) are all clean UPPER_SNAKE_CASE. The script exits non-zero **only** on 5 pre-existing offenders in `idp-deprovisioning.prisma` (`ManualOverrideCategory`, Phase 77) — untouched by this plan, out of scope (see Issues Encountered).
- `cross-org-leak-1042s.test.ts` — 5/5 GREEN (full `packages/db` suite: 155 passed / 6 skipped / 4 todo).
- Acceptance greps all pass: `model Form1042S`=1, `US_DETERMINATION_LETTER`=1, `workState`=1, `@@unique([contractorId, taxYear])`=1, `Tax1099KThreshold.taxYear @unique`=1, seed=$20,000+200; box2GrossIncomeMinor/box7FederalTaxWithheldMinor/treatyArticle/supersededById present.

## Decisions Made
- **Form1042S NOT added to APPEND_ONLY_MODELS.** Immutability is enforced by the supersede-chain convention (status DRAFT→ACTIVE→SUPERSEDED + `corrected` + `supersededById @unique`), exactly like Form1099Nec/TaxFormSubmission. Adding it to the runtime append-only guard would block the CORRECTED path's `updateMany {status:ACTIVE}→{SUPERSEDED}` that Plan 04's service performs. The PATTERNS "mark append-only" note is satisfied by the model's supersede-chain doc comment.
- **Chapter rate + Appendix B/C code columns nullable.** A DRAFT 1042-S is created before the service resolves the treaty rate / codes (gated on a complete W-8 chain), so `box3bChap3Rate` / `box4bChap4Rate` and the income/exemption/status/LOB code columns are nullable; `box2GrossIncomeMinor` stays non-null and `box7FederalTaxWithheldMinor` defaults 0 (mirrors Form1099Nec box amounts).
- **No new ClassificationAssessment column for US** — `countryCode='US'` + existing `outcome Json` carry the US AB5/§530 outcome (confirmed per plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Made Form1042S chapter rates + Appendix code columns nullable**
- **Found during:** Task 1
- **Issue:** The plan listed `box3bChap3Rate Decimal @db.Decimal(5,2)` / `box4bChap4Rate Decimal` (non-null) and the code columns without `?`. A DRAFT 1042-S is inserted before the Plan-04 service resolves the treaty rate / codes, so non-null rates would make valid DRAFT rows uninsertable and contradict the immutable-supersede DRAFT→ACTIVE lifecycle.
- **Fix:** Made `box3bChap3Rate`/`box4bChap4Rate` `Decimal?` and the income/exemption/status/LOB code columns `String? @db.VarChar(2)`; kept `box2GrossIncomeMinor` non-null and `box7FederalTaxWithheldMinor Int @default(0)`.
- **Files modified:** packages/db/prisma/schema/tax.prisma
- **Verification:** prisma validate GREEN; client regenerated with the nullable types.
- **Committed in:** `05d20804f`

**2. [Rule 2 - Correctness] Added currency + note to Tax1099KThreshold**
- **Found during:** Task 1
- **Issue:** Plan listed 3 fields; the analog Tax1099Threshold config table carries `currency` + `note` for the adviser-verify annotation, and the tracker service needs currency context.
- **Fix:** Added `currency String @default("USD") @db.Char(3)` + `note String?` to mirror Tax1099Threshold.
- **Files modified:** packages/db/prisma/schema/tax.prisma, packages/db/prisma/seed/tax-1099k-threshold.ts
- **Verification:** prisma validate GREEN; seed upserts the annotated TY2026 row.
- **Committed in:** `05d20804f`

**3. [Rule 3 - Blocking] Required schema back-relations + a resolvable DATABASE_URL for the pre-commit hook**
- **Found during:** Tasks 1 & 2
- **Issue:** (a) Prisma requires the opposite relation field on both sides — the new `Form1042S`/`Form1099KTrackerState` org+recipient relations forced back-relation arrays on `Organization` and `Contractor`. (b) The lint-staged pre-commit hook runs `npx prisma format`, whose `prisma.config.ts` resolves `env('DATABASE_URL')`; this worktree has no `.env`, so the hook failed with `PrismaConfigEnvError`.
- **Fix:** (a) Added `form1042s Form1042S[]` + `form1099kTrackerStates Form1099KTrackerState[]` back-relations to Organization and Contractor. (b) Exported a non-connecting dummy `DATABASE_URL` in the commit environment so `prisma format`/`validate`/`generate` resolve config without touching a DB — hooks ran normally (no `--no-verify`).
- **Files modified:** packages/db/prisma/schema/organization.prisma, packages/db/prisma/schema/contractor.prisma
- **Verification:** prisma format + biome pre-commit hooks passed on both commits.
- **Committed in:** `05d20804f`, `6fdd3453d`

---

**Total deviations:** 3 auto-fixed (2 correctness, 1 blocking)
**Impact on plan:** All auto-fixes necessary for schema validity, valid DRAFT lifecycle, and passing hooks. No scope creep — surface matches the plan's must_haves.

## Issues Encountered
- **Pre-existing enum-casing offenders (out of scope):** `db:audit-enum-casing` exits non-zero on 5 lowercase `ManualOverrideCategory` values in `idp-deprovisioning.prisma` (Phase 77). Confirmed pre-existing on HEAD and untouched by this plan; the plan's own new enums are all clean. Logged as out-of-scope; not fixed (changing those enum values is a separate breaking DB change).
- **Install-time build drift (not staged):** `pnpm install` regenerated `packages/validators/src/legal/de.js` / `de.d.ts` build outputs (unrelated to this plan). Left unstaged/uncommitted — only task files were staged individually.

## Deferred / Blocked

**Task 3 — multi-region migration apply (EU/ME/US) — DEFERRED-BY-DESIGN (human gate).**
Per the P82–86 posture (see 85-01, 86-02 Task 3, 84-03 in STATE.md, and the open `migration_apply` Deferred Item), the additive migration that creates `Form1042S` / `Form1099KTrackerState` / `Tax1099KThreshold`, adds the `US_DETERMINATION_LETTER` enum value (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`), and adds the nullable `ContractorAssignment.workState` column mutates live regional DBs and stays a human gate. No migration SQL was generated here (`migrate dev` is drift-blocked and needs a live connection; the repo uses the `db push` fallback at apply time). The committed schema + regenerated Prisma client unblock all downstream Phase 87 waves at the **type** level. The EU/ME/US live-DB apply + per-region `Tax1099KThreshold` seed are deferred to the human gate, consistent with the P82–86 convention.

## Known Stubs
None — schema + seed + tests are complete; no placeholder data flows to any UI in this plan.

## Threat Flags
None new — the plan's `<threat_model>` covers the surface. T-87-02-01 (cross-org read) is mitigated by keeping both models out of `globalModels` + the passing cross-org leak test; T-87-02-02 (FTIN) is a schema-level `snapshotJson` last-4 convention enforced by the Plan-04 sanitizer; T-87-02-03 (live migration) is the deferred human gate above.

## Next Phase Readiness
- Downstream Phase 87 waves (US classification AB5/§530 in Plan 03, `form-1042s.service` in Plan 04, the 1099-K tracker cron, the determination-letter PDF) can build against the committed model/enum types now.
- **Blocker for runtime (not type) work:** the multi-region migration must be applied at the human gate before any service actually reads/writes these tables against a live regional DB.

## Self-Check: PASSED

- FOUND: packages/db/prisma/seed/tax-1099k-threshold.ts
- FOUND: packages/db/src/__tests__/cross-org-leak-1042s.test.ts
- FOUND: packages/db/src/generated/prisma/client/models/Form1042S.ts (+ Form1099KTrackerState.ts, Tax1099KThreshold.ts)
- FOUND: 87-02-SUMMARY.md
- FOUND commit: 05d20804f (Task 1) — FOUND commit: 6fdd3453d (Task 2)

---
*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Completed: 2026-07-01*
