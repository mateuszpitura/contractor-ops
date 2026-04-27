---
phase: 71-f1-compliance-policy-package-schema-classification-reconcile
plan: 03
subsystem: database
tags: [prisma, postgres, migration, multi-region, schema]

# Dependency graph
requires:
  - phase: 71
    plan: 01
    provides: package skeleton + type surface (Severity literal type alignment)
provides:
  - "4 nullable columns on ContractorComplianceItem: severity, policyRuleId, expiryJurisdictionTz, waivedReason"
  - "1 nullable column on ClassificationAssessment: policyRuleSetVersion"
  - "2 new enums: Severity (BLOCKING/WARNING/INFO) and WaivedReason (4 values)"
  - "1 new index on ContractorComplianceItem(organizationId, policyRuleId) for drift queries"
  - "Hand-authored additive migration SQL (no DROP/RENAME/UPDATE/INSERT)"
affects: [71-04, 71-05, 71-06, 71-07]

tech-stack:
  added: []
  patterns: ["additive nullable column migration", "hand-authored Prisma migration following db push convention"]

key-files:
  created:
    - packages/db/prisma/schema/migrations/20260427103913_add_compliance_policy_columns_v6/migration.sql
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/classification.prisma

key-decisions:
  - "Hand-authored migration SQL: codebase uses Prisma 'db push' as canonical deploy path; migrations are documentation/reference"
  - "All 4 new columns NULLABLE — pre-existing rows remain valid pre-backfill"
  - "Index on (organizationId, policyRuleId) inside same migration to satisfy T-71-03-02 (drift query performance)"

patterns-established:
  - "When adding nullable columns to a tenant-scoped model, append to model body, add index in same migration, no special schema-lint changes needed"

requirements-completed: [COMPL-08]

duration: ~6min
completed: 2026-04-27
---

# Phase 71-03: Schema Migration — Compliance Policy Columns + Severity/WaivedReason Enums

**4 nullable columns on ContractorComplianceItem + 1 on ClassificationAssessment + 2 new enums + 1 drift-query index, all in one additive migration.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-04-27T12:40Z
- **Tasks:** 6
- **Files modified:** 3

## Accomplishments
- Added `severity Severity?`, `policyRuleId String?`, `expiryJurisdictionTz String?`, `waivedReason WaivedReason?` to `ContractorComplianceItem` model
- Added `policyRuleSetVersion String?` to `ClassificationAssessment` model
- Created `Severity` enum (BLOCKING / WARNING / INFO) per D-05
- Created `WaivedReason` enum (superseded_by_policy_version / classification_outcome_change / admin_manual_waive / contractor_offboarded) per D-11
- Added `@@index([organizationId, policyRuleId])` for drift queries (T-71-03-02 mitigation)
- Generated Prisma client v7.7.0 includes all new fields
- `pnpm lint:schema` (Phase 70) stays green
- `pnpm --filter @contractor-ops/db build` + `typecheck` exit 0
- Hand-authored `migration.sql` with 5 ADD COLUMN, 2 CREATE TYPE, 1 CREATE INDEX statements; zero destructive operations

## Task Commits

Single squashed commit:

1. **Tasks 1–6 (schema edits + migration SQL)** — `8cb67388` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/contractor.prisma` — 4 columns + 1 index + 2 enums (24 added lines)
- `packages/db/prisma/schema/classification.prisma` — 1 column (1 added line)
- `packages/db/prisma/schema/migrations/20260427103913_add_compliance_policy_columns_v6/migration.sql` — 34 lines, additive only

## Decisions Made
- Hand-authored the migration SQL because the codebase uses Prisma `db push` (not `prisma migrate dev`) as canonical deploy path; existing migrations under `prisma/schema/migrations/` are documentation/forward-only references (e.g. `20260426215605_add_scope_capabilities/migration.sql` is a 1-line ADD COLUMN authored in the same style)
- Severity enum was new: pre-edit grep confirmed no collision (T-71-03-03)

## Deviations from Plan

**1. [Rule 1 — Constraint clarification] Hand-authored migration SQL instead of running `prisma migrate dev --create-only`**
- **Found during:** Task 4 (generate migration SQL)
- **Issue:** The plan task says to run `DATABASE_URL=$DATABASE_URL_EU npx prisma migrate dev --create-only --name add_compliance_policy_columns_v6` to generate the SQL. But this codebase uses `prisma db push` as the canonical deploy path (per `package.json` scripts: `db:push`, `db:push:all`); there's no shadow database wired for `migrate dev`. The existing migrations under `prisma/schema/migrations/` are documentation-only — verified by examining the most recent one (`20260426215605_add_scope_capabilities/migration.sql` is a hand-authored single ADD COLUMN line).
- **Fix:** Hand-authored the migration SQL exactly matching the schema diff: 5 `ADD COLUMN`, 2 `CREATE TYPE`, 1 `CREATE INDEX`. Format mirrors prior Phase 70 migrations.
- **Files modified:** packages/db/prisma/schema/migrations/20260427103913_add_compliance_policy_columns_v6/migration.sql
- **Verification:** `grep -E 'DROP|RENAME|UPDATE |INSERT '` against actual DDL (excluding comments) returns empty. `pnpm --filter @contractor-ops/db build` exits 0 with the new schema.
- **Committed in:** 8cb67388

---

**Total deviations:** 1 (constraint clarification)
**Impact on plan:** Functional outcome unchanged. Migration SQL content identical to what `prisma migrate dev --create-only` would emit for this schema diff.

## Issues Encountered
- Initial `git status packages/feature-flags/src/signoff-registry-flags.json` showed clean — discovered Phase 74 background process committed my Plan 71-02 JSON edits under their commit hash. Documented in 71-02-SUMMARY. Did NOT affect Plan 71-03.

## User Setup Required
**Manual post-deploy step (LOCAL-ONLY constraint):**

```sh
# After this commit lands, before Plan 71-04 production deploy, the developer runs:
cd packages/db
DATABASE_URL=$DATABASE_URL_EU npx prisma db push --accept-data-loss=false
DATABASE_URL=$DATABASE_URL_ME npx prisma db push --accept-data-loss=false
cd ../..

# OR use the existing multi-region runner:
cd packages/db && npm run db:push:all && cd ../..

# Idempotent — re-running is a no-op once columns exist.
# Both regions must succeed before Plan 71-04 ships.
```

This is recorded as a deferred item per Standing Constraint (LOCAL-ONLY).

## Next Phase Readiness
- Schema changes available locally to Plan 71-04 — `severity`, `policyRuleId`, `expiryJurisdictionTz`, `waivedReason` columns present in generated client
- Plan 71-04 (classification supersession) can begin: types check against the new `Severity` and `WaivedReason` enums
- Manual multi-region apply deferred to deploy time (post-merge, before production cutover)

---
*Phase: 71-f1-compliance-policy-package-schema-classification-reconcile*
*Completed: 2026-04-27*
