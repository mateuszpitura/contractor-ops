---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 02
subsystem: database
tags: [prisma, postgres, migrations, gin-index, jsonb, compliance, approval, payments]

requires:
  - phase: 72-01
    provides: RED scaffolds asserting the new tables/enums these migrations create
provides:
  - ContractorComplianceReminderState table + ReminderBand enum (D-01/D-02)
  - ApprovalStatus.PENDING_COMPLIANCE value + ApprovalFlow.complianceHoldsJson JSONB + GIN(jsonb_path_ops) index (D-12/D-14)
  - PaymentRunComplianceCheck table + EligibilityVerdict enum (D-16) with audit-preserving SET NULL FK (D-19)
  - Regenerated Prisma client exposing all new types to the workspace
affects: [72-03, 72-04, 72-05, 72-06, 72-08]

tech-stack:
  added: []
  patterns:
    - "Additive migration with header comment flagging multi-region apply as MANUAL post-deploy (mirrors phase75/phase76)"
    - "ALTER TYPE ... ADD VALUE at top of a single migration file (PG16 inline-safe; not referenced in same tx) — matches phase75 IP_RATIFICATION precedent"
    - "Migration-shape regression test reading migration.sql and asserting required SQL constructs"

key-files:
  created:
    - packages/db/prisma/schema/migrations/20260531170000_phase72_compliance_reminder_state/migration.sql
    - packages/db/prisma/schema/migrations/20260531170001_phase72_approval_compliance_holds/migration.sql
    - packages/db/prisma/schema/migrations/20260531170002_phase72_payment_run_compliance_check/migration.sql
    - packages/db/src/__tests__/phase-72-migration-shape.test.ts
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/approval.prisma
    - packages/db/prisma/schema/payment.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/src/generated/prisma/client (regenerated)

key-decisions:
  - "Migration directory naming follows the CURRENT-tree convention (20260531170000_phase72_*, full timestamp sorting after the 20260512000000_baseline + phase75/phase76) rather than the plan's pre-baseline 20260427_phase_72_* names — those would sort before the baseline and break migration ordering. Migration-shape test references the actual directory names."
  - "Migration B kept as a SINGLE file with ALTER TYPE ... ADD VALUE at the top (not split) — matches the in-tree phase75 IP_RATIFICATION precedent; PG16 only forbids USING a new enum value in the same tx, and no statement here references PENDING_COMPLIANCE as a value."
  - "Migration-shape test placed at packages/db/src/__tests__/ (the vitest include glob is src/**/__tests__/**) instead of the plan's packages/db/scripts/__tests__/ which vitest does NOT collect."
  - "No RLS on the two new org-scoped tables — the architectural twin EconomicDependencyAlertState and the entire baseline have zero RLS; tenant scoping is enforced at the API layer. (Phase 75 added RLS selectively; the plan's SQL specified none.)"
  - "Authored migration SQL by hand (plan's documented fallback) instead of `prisma migrate dev` — the shared Neon dev DB is 2 migrations behind (phase75/phase76 unapplied by a concurrent session); running migrate dev would apply another session's in-flight work."

patterns-established:
  - "Phase 72 schema contract locked by both prisma:validate, db:check-drift, and a migration-shape regression test"

requirements-completed: [COMPL-03, COMPL-06, COMPL-07]

duration: ~20 min
completed: 2026-05-31
---

# Phase 72 Plan 02: Compliance Schema + 3 Additive Migrations Summary

**Three additive Prisma migrations (reminder-state table + ReminderBand enum; PENDING_COMPLIANCE enum value + complianceHoldsJson JSONB GIN index; PaymentRunComplianceCheck audit table + EligibilityVerdict enum) plus matching schema-file edits and a migration-shape regression test — Prisma client regenerated and in sync.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-05-31
- **Tasks:** 6
- **Files modified:** 24 (incl. regenerated client)

## Accomplishments
- Migration A — `ContractorComplianceReminderState` (1:1 via `itemId @unique`, ON DELETE CASCADE) + `ReminderBand` enum
- Migration B — `ApprovalStatus += PENDING_COMPLIANCE` (AFTER PENDING), `ApprovalFlow.complianceHoldsJson JSONB`, GIN index with `jsonb_path_ops`
- Migration C — `PaymentRunComplianceCheck` (4 FKs; `paymentExportId` ON DELETE SET NULL; `(contractorId, snapshottedAt DESC)` index) + `EligibilityVerdict` enum
- Back-relations added on `ContractorComplianceItem`, `Contractor`, `PaymentRun`, `PaymentExport`, `Organization`
- `prisma validate` clean, `prisma generate` clean, `db:check-drift` reports client in sync, api typecheck exits 0
- `phase-72-migration-shape.test.ts` — 10 assertions GREEN

## Task Commits

1. **Schema edits + 3 migrations + shape test + regenerated client (Tasks 72-02-01..06)** - `aa89135b` (feat)

## Files Created/Modified
- `migrations/20260531170000_phase72_compliance_reminder_state/migration.sql` - Migration A
- `migrations/20260531170001_phase72_approval_compliance_holds/migration.sql` - Migration B (ADD VALUE + JSONB + GIN)
- `migrations/20260531170002_phase72_payment_run_compliance_check/migration.sql` - Migration C
- `prisma/schema/contractor.prisma` - ReminderBand enum, ContractorComplianceReminderState model, back-relations
- `prisma/schema/approval.prisma` - PENDING_COMPLIANCE value, complianceHoldsJson column
- `prisma/schema/payment.prisma` - EligibilityVerdict enum, PaymentRunComplianceCheck model, back-relations
- `prisma/schema/organization.prisma` - paymentComplianceChecks back-relation
- `src/__tests__/phase-72-migration-shape.test.ts` - SQL-shape regression lock
- `src/generated/prisma/client/**` - regenerated client (drift-check verified in sync)

## Decisions Made
See key-decisions in frontmatter. Most consequential: current-tree migration naming, single-file Migration B (phase75 precedent), hand-authored SQL to avoid disturbing the shared DB's in-flight phase75/76 migrations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Post-migration drift] Migration directory naming + ordering**
- **Found during:** Task 72-02-02
- **Issue:** Plan specified `20260427_phase_72_*` names (from the pre-web-migration tree). The current tree squashed history into `20260512000000_baseline`; the plan's names would sort BEFORE the baseline and break `prisma migrate` ordering.
- **Fix:** Used full-timestamp `20260531170000/170001/170002_phase72_*` names that sort after the baseline and phase75/phase76 (the current convention). Updated the shape test to reference the actual names.
- **Verification:** `prisma validate` clean; `prisma migrate status` lists migrations in correct order; shape test GREEN.
- **Committed in:** `aa89135b`

**2. [Rule 1 - Post-migration drift] Migration-shape test location**
- **Found during:** Task 72-02-06
- **Issue:** Plan placed the test under `packages/db/scripts/__tests__/`, but the db vitest `include` glob is `src/**/__tests__/**/*.test.ts` — a test under `scripts/` would never run.
- **Fix:** Placed it at `packages/db/src/__tests__/phase-72-migration-shape.test.ts` (matches `phase-75-schema.test.ts`); adjusted the migrations-dir resolve to `../../prisma/schema/migrations`.
- **Verification:** `pnpm --filter @contractor-ops/db test --run --testNamePattern='Phase 72 Migration'` runs and passes 10 assertions.
- **Committed in:** `aa89135b`

**3. [Rule 3 - Blocking/shared-resource] Hand-authored SQL instead of `prisma migrate dev`**
- **Found during:** Task 72-02-02/05
- **Issue:** The shared Neon dev DB is 2 migrations behind (phase75/phase76 unapplied — a concurrent session's in-flight work). `migrate dev` would apply those + reset the shadow DB, interfering with another session.
- **Fix:** Hand-authored the migration SQL (the plan's documented fallback) and used `prisma generate` (schema-only, no DB write). Multi-region apply deferred to the manual ops checkpoint.
- **Verification:** `db:check-drift` confirms the committed client matches the schema.
- **Committed in:** `aa89135b`

---

**Total deviations:** 3 auto-fixed (2 post-migration drift, 1 shared-resource).
**Impact on plan:** Necessary for the migrations to land correctly on the current tree without disturbing the shared DB. Schema intent (tables, enums, indexes, FKs, audit semantics) is exactly as the plan specified. No scope creep.

## Issues Encountered
None blocking. Prisma format + biome reformatted files on commit (cosmetic, assertions re-verified GREEN after).

## User Setup Required

**Manual post-deploy ops step (DEFERRED — LOCAL-ONLY standing constraint):**
After merge to main, an ops engineer must run the multi-region migration apply:
`pnpm --filter @contractor-ops/db db:migrate:all` (`tsx scripts/migrate-all-regions.ts`)
to apply these 3 migrations to every region (EU + ME). Tracked as a STATE.md post-deploy checkpoint. Until applied, the new tables/columns exist only in the schema + generated client, not in the live regional databases. The shared dev DB also still needs phase75/phase76 applied first (owned by the concurrent session).

## Next Phase Readiness
- Schema + generated types ready. Wave 2 (Plans 72-03 reminder cron + 72-04 payment-block helper/guard) can now import `ContractorComplianceReminderState`, `ReminderBand`, `PaymentRunComplianceCheck`, `EligibilityVerdict`, and the `PENDING_COMPLIANCE` status.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
