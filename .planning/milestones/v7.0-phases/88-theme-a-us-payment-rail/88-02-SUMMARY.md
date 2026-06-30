---
phase: 88-theme-a-us-payment-rail
plan: 02
subsystem: database
tags: [prisma, postgres, ach, nacha, fedwire, plaid, withholding, encryption]

# Dependency graph
requires:
  - phase: 88-01
    provides: US-expansion region/flag substrate the US payout surface gates on
  - phase: 84-us-onboarding
    provides: encrypted-at-rest column pattern (ssnEncrypted) + USPS advisory-flag analog
  - phase: 63-uk-bacs
    provides: ukSortCode/ukAccountNumber encrypted+masked pair mirrored here for US ACH
provides:
  - "Contractor.backupWithholdingFlagged — queryable nullable boolean the payment-run seeding reads to deduct the IRC §3406 24%"
  - "ContractorBillingProfile US ACH routing/account encrypted+masked pairs (AES-256-GCM at rest, masked-only display)"
  - "ContractorBillingProfile Plaid advisory verification fields (plaidVerificationStatus / plaidVerifiedAt / plaidAccountId)"
  - "PaymentExportFormat enum gains ACH_NACHA + FEDWIRE for the US export factory"
  - "Additive migration 20260701000000_phase88_us_payment_rail_schema + regenerated in-repo Prisma client"
affects: [88-03, 88-04, 88-05, 88-06, 88-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-nullable column + enum ADD VALUE migration (zero backfill, no DROP/NOT NULL/default)"
    - "Encrypted+masked bank-field pair mirrored from the UK BACS analog for US ACH"
    - "String advisory verification status (VERIFIED/PENDING/FAILED) instead of a global enum to avoid enum churn while the live path is flag-dark"

key-files:
  created:
    - packages/db/prisma/schema/migrations/20260701000000_phase88_us_payment_rail_schema/migration.sql
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/payment.prisma
    - packages/db/src/generated/prisma/client (regenerated — enums, Contractor, ContractorBillingProfile, internal namespace)

key-decisions:
  - "backupWithholdingFlagged stored against Contractor (not Worker) and intentionally without a Worker FK — re-pointed after Phase 89 per D-03"
  - "plaidVerificationStatus kept as String (not a Prisma enum) to avoid global-enum churn while the live Plaid path stays flag-dark — mirrors the uspsVerified advisory posture"
  - "Migration hand-authored (no DB reachable for migrate dev --create-only) and verified byte-equivalent to prisma migrate diff base->head"

patterns-established:
  - "US ACH encrypted+masked field pair mirrors the UK BACS pair exactly (D-12)"
  - "Withholding flag is a dedicated queryable column, not buried in TaxFormSubmission.snapshotJson (closes the P86 loose end, D-03)"

requirements-completed: [US-PAY-01, US-PAY-04, US-PAY-05]

# Metrics
duration: ~16min
completed: 2026-07-01
---

# Phase 88 Plan 02: US Payment-Rail Schema Summary

**Additive Prisma schema for the US payout rail — Contractor backup-withholding flag, ContractorBillingProfile US ACH routing/account encrypted+masked pairs + Plaid advisory status, and ACH_NACHA/FEDWIRE on the PaymentExportFormat enum — plus the regenerated client and a reviewed additive migration.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-01T01:05:00Z (approx — includes worktree dependency install)
- **Completed:** 2026-07-01T01:22:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-action handled via autonomous local-only path)
- **Files modified:** 9 (2 schema + 6 generated-client + 1 migration)

## Accomplishments
- Added `Contractor.backupWithholdingFlagged Boolean?` — the queryable, FK-free column the 88-03 withholding deduction reads at item seeding (closes the P86 unwired-flag loose end, D-03).
- Added the US ACH bank pairs (`usRoutingNumberEncrypted/Masked`, `usAccountNumberEncrypted/Masked`) mirroring the UK BACS encrypted+masked pair, plus Plaid advisory fields (`plaidVerificationStatus`, `plaidVerifiedAt`, `plaidAccountId`) on `ContractorBillingProfile` (D-08/D-12).
- Added `ACH_NACHA` + `FEDWIRE` to the Prisma `PaymentExportFormat` enum (UPPER_SNAKE_CASE; both pass the casing audit) (D-10).
- Regenerated and committed the in-repo Prisma client so downstream plans typecheck against the new fields/enum; `pnpm typecheck --filter=@contractor-ops/db` passes.
- Authored an additive-only migration verified byte-equivalent to `prisma migrate diff` (base → head).

## Task Commits

Each task was committed atomically:

1. **Task 1: backup-withholding flag + US bank fields + Plaid status (contractor.prisma)** - `16ad3732b` (feat)
2. **Task 2: ACH_NACHA + FEDWIRE enum + regenerate client (payment.prisma)** - `d5bd9accd` (feat)
3. **Task 3: additive multi-region migration** - `b528e2a1a` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `packages/db/prisma/schema/contractor.prisma` - `Contractor.backupWithholdingFlagged`; `ContractorBillingProfile` US ACH + Plaid fields
- `packages/db/prisma/schema/payment.prisma` - `PaymentExportFormat` += `ACH_NACHA`, `FEDWIRE`
- `packages/db/prisma/schema/migrations/20260701000000_phase88_us_payment_rail_schema/migration.sql` - additive ADD COLUMN / ALTER TYPE ADD VALUE
- `packages/db/src/generated/prisma/client/{enums,models/Contractor,models/ContractorBillingProfile,internal/*}.ts` - regenerated client

## Decisions Made
- `backupWithholdingFlagged` lives on `Contractor` without a Worker FK (forward-compatible; re-point after Phase 89) — per D-03.
- `plaidVerificationStatus` is a `String?` (VERIFIED/PENDING/FAILED) not a Prisma enum — avoids global-enum churn while the live Plaid path is flag-dark; matches the `uspsVerified` advisory pattern.
- The migration was hand-authored (no DB reachable in the worktree for `prisma migrate dev --create-only`) and then validated against `prisma migrate diff --from-schema <base> --to-schema <head> --script`, which produced an identical statement set (2 enum ADD VALUE + `backupWithholdingFlagged BOOLEAN` + 7 nullable TEXT/TIMESTAMP columns). This proves applying the migration to the base schema reproduces the head schema.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 ran as specified; Task 3 (checkpoint:human-action migration gate) was handled via the prescribed autonomous local-only path (generate + verify additive migration, regenerate client, defer live multi-region prod apply).

## Issues Encountered
- **Worktree had no installed dependencies.** The Prisma binary, `db:generate`, `db:audit-enum-casing`, and typecheck all require `node_modules`, which the fresh worktree lacked. Resolved with `pnpm install --frozen-lockfile --prefer-offline` (hardlinked from the populated store; frozen lockfile means no new resolution, so the 7-day release-age gate did not trigger). Postinstall rebuilt some tracked compiled artifacts (`packages/validators/src/legal/de.{d.ts,js}`) — left unstaged as out-of-scope build churn.
- **`prisma.config.ts` requires `DATABASE_URL`** even for `validate`/`generate`/`format` (which never connect). Supplied a placeholder `postgresql://…localhost…` URL for those commands and for the pre-commit `prisma format` lint-staged hook. No DB connection is opened by any of them.
- **No reachable local Postgres** (port 5432 closed; no root `.env`). Per local-only deploy posture, the migration file is generated and committed but not applied to any database.

## Deferred Issues
- **Pre-existing enum-casing offenders (out of scope).** `pnpm db:audit-enum-casing` exits non-zero on 5 snake_case `ManualOverrideCategory` values in `idp-deprovisioning.prisma` (added Phase 77; present on base commit `dd67ff922`). The 88-02 members `ACH_NACHA`/`FEDWIRE` are correctly cased and NOT flagged. Logged to `deferred-items.md`; not fixed here (SCOPE BOUNDARY — unrelated file).
- **Documentation-follows-code (wiki) deferred to 88-07.** `prisma-schema-areas.md` (`verify_with: packages/db/prisma/schema/`) and the new `domains/us-payment-rail.md` are explicitly owned by plan **88-07** (the dedicated wiki-synthesis plan, which lists both in its `files_modified`). Updating the wiki here would pre-empt/duplicate that comprehensive synthesis. The phase-level CI `check:wiki-brain` gate is satisfied once 88-07 lands in the merged phase diff (same pattern as Phase 89's 89-06).

## Production Apply — Deferred (post-deploy item)
The additive migration `20260701000000_phase88_us_payment_rail_schema` was **not** applied to any live database:
- **Local dev DB:** not applied — no reachable Postgres / no `DATABASE_URL` in the worktree.
- **EU / ME / US production:** deferred per the project's local-only deploy posture (production apply deferred, consistent with prior phases P82–P87). Apply per region post-merge via `pnpm db:migrate:all` (or the per-region `prisma db push` drift fallback) against `DATABASE_URL_EU`, `DATABASE_URL_ME`, `DATABASE_URL_US`. The migration is additive-only (nullable columns + enum ADD VALUE), so each region apply is non-destructive and order-independent.

## User Setup Required
None - no external service configuration required for this schema plan.

## Next Phase Readiness
- 88-03 (withholding deduction) can now select `Contractor.backupWithholdingFlagged` at item seeding.
- 88-04 (NACHA/Fedwire generation) and the export-format detection can reference `PaymentExportFormat.ACH_NACHA` / `FEDWIRE`.
- 88-05/88-06 (Plaid adapter / US bank-field writer) can write the new `ContractorBillingProfile` columns.
- **Blocker for live deploy only:** the multi-region production migration apply is deferred (documented above) — not a blocker for downstream code plans, which only need the regenerated client (already committed).

## Self-Check: PASSED
- Files verified present: contractor.prisma, payment.prisma, migration.sql, generated client (enums.ts, Contractor.ts, ContractorBillingProfile.ts).
- Commits verified present: `16ad3732b`, `d5bd9accd`, `b528e2a1a`.
- Generated client confirmed to carry both `ACH_NACHA` and `FEDWIRE`.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
