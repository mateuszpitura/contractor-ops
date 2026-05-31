---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 02
subsystem: database
tags: [prisma, schema, migration, enum, gin-index, compliance, COMPL-01, COMPL-04]

requires:
  - phase: 73-01
    provides: compliance-override-columns / document-status-pending-review / compliance-dashboard-index / audit-log-itemid-index Wave 0 RED scaffolds
  - phase: 71-72
    provides: ContractorComplianceItem model, WaivedReason enum, DocumentStatus enum, AuditLog
provides:
  - WaivedReasonCategory enum (UPPER_SNAKE_CASE) + waivedReasonCategory/waivedReasonNote columns on ContractorComplianceItem
  - DocumentStatus.PENDING_REVIEW for the portal upload-replacement flow (D-06)
  - composite index ([organizationId, severity, status, expiresAt]) for the dashboard at-risk filter (D-02)
  - partial GIN index on AuditLog.metadataJson WHERE resourceType=CONTRACTOR (D-13)
  - regenerated Prisma client exposing the new types to Wave 2
affects: [73-03, 73-05, 73-07, 73-08]

tech-stack:
  added: []
  patterns:
    - "additive-only raw-SQL migration (CREATE TYPE / ALTER TYPE ADD VALUE / ADD COLUMN / CREATE INDEX) — no DROP/RENAME/NOT NULL"
    - "Prisma enum values MUST be UPPER_SNAKE_CASE (enforced by pnpm --filter @contractor-ops/db db:audit-enum-casing)"

key-files:
  created:
    - packages/db/prisma/schema/migrations/20260428000000_phase_73_compliance_dashboard_overrides_pending_review/migration.sql
    - packages/db/src/__tests__/compliance-override-columns.test.ts
    - packages/db/src/__tests__/document-status-pending-review.test.ts
    - packages/db/src/__tests__/compliance-dashboard-index.test.ts
    - packages/db/src/__tests__/audit-log-itemid-index.test.ts
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/contract.prisma
    - packages/db/src/generated/prisma/client/* (6 files — regenerated)

key-decisions:
  - "WaivedReasonCategory enum values are UPPER_SNAKE_CASE (CONTRACTOR_OFFBOARDED, ...) NOT the plan template's lowercase — the codebase enforces UPPER_SNAKE via db:audit-enum-casing (dropdown-normalization workstream). Migration SQL + schema test updated to match."
  - "Multi-region apply (pnpm db:migrate:all EU+ME) deferred as a post-deploy LOCAL-ONLY item (Phase 70/74/76 precedent) — NOT a phase blocker"
  - "Used prisma generate (not db push) to regenerate the client — the live dev DB has a Contractor.search_vector GENERATED column that blocks db push (pre-existing, documented in schema header); generate reads schema only, no DB write"

patterns-established:
  - "Schema tests read .prisma + migration.sql from disk via __dirname — no live DB needed (mirrors phase-72-migration-shape.test.ts)"

requirements-completed: [COMPL-01, COMPL-04]

duration: 35 min
completed: 2026-06-01
---

# Phase 73 Plan 02: Compliance Dashboard Schema + PENDING_REVIEW + Indexes Summary

**Additive-only Prisma migration adding the WaivedReasonCategory enum + override columns, DocumentStatus.PENDING_REVIEW, a composite dashboard index, and a partial GIN audit-log index — schema tests GREEN, client regenerated for Wave 2.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-01T00:30:00Z
- **Completed:** 2026-06-01T01:05:00Z
- **Tasks:** 4
- **Files modified:** 13 (5 created, 2 schema, 6 regenerated client)

## Accomplishments
- WaivedReasonCategory enum (6 UPPER_SNAKE values) + 2 nullable override columns
- DocumentStatus.PENDING_REVIEW between ACTIVE and SUPERSEDED
- composite + partial-GIN indexes for D-02 dashboard and D-13 timeline
- single additive migration; prisma validate 0; 4 schema tests GREEN (6 cases); enum-casing audit clean for the new enum
- Prisma client regenerated — Wave 2 sees waivedReasonCategory/waivedReasonNote/PENDING_REVIEW

## Task Commits

1. **Tasks 73-02-01..04: schema + migration + regenerated client + 4 schema tests** - `10ac5a4d` (feat)

## Files Created/Modified
- See `key-files`.

## Decisions Made
- See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Standards/correctness] Enum values UPPER_SNAKE_CASE, not lowercase**
- **Found during:** post-task standards sweep (user flagged enum casing)
- **Issue:** Plan template + my first pass used lowercase enum values (`contractor_offboarded`). The codebase enforces `^[A-Z][A-Z0-9_]*$` via `db:audit-enum-casing` (dropdown-normalization workstream) — the lowercase enum failed the gate (11 offenders, 6 mine).
- **Fix:** Converted all 6 WaivedReasonCategory values to UPPER_SNAKE (matching the sibling WaivedReason enum); updated migration `CREATE TYPE` literals + the schema test's value-extraction regex + expected array.
- **Files modified:** contractor.prisma, migration.sql, compliance-override-columns.test.ts
- **Verification:** db:audit-enum-casing no longer reports my enum (only 5 pre-existing Phase 77 ManualOverrideCategory offenders remain, out of scope); prisma validate 0; schema tests GREEN.
- **Committed in:** `10ac5a4d`

**2. [Rule 1 - Bug] prisma:validate script name corrected to `prisma validate`**
- **Found during:** Task verification
- **Issue:** Plan acceptance referenced `pnpm --filter @contractor-ops/db prisma:validate` — no such script exists.
- **Fix:** Used `pnpm --filter @contractor-ops/db exec prisma validate` (the real validate path).
- **Verification:** "The schemas at prisma/schema are valid".
- **Committed in:** `10ac5a4d`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1).
**Impact on plan:** The enum-casing fix is mandatory for the codebase standard + CI gate. No scope creep.

## Issues Encountered
- `prisma db push` against the live dev DB fails on the pre-existing `Contractor.search_vector` GENERATED column (documented in the schema header). Resolved by using `prisma generate` to regenerate the client (schema-only, no DB write) — sufficient for Wave 2 type resolution. The actual DB apply is the deferred multi-region step.

## User Setup Required
None.

## Deferred Verification (Standing Constraint — LOCAL-ONLY)
- **DEFERRED post-deploy MANUAL OPS:** after merge to main + before production, run `pnpm db:migrate:all` and confirm BOTH `$DATABASE_URL_EU` and `$DATABASE_URL_ME` report success. Migration `20260428000000_phase_73_compliance_dashboard_overrides_pending_review`. Additive-only (1 CREATE TYPE, 1 ALTER TYPE ADD VALUE, 2 ADD COLUMN, 2 CREATE INDEX). Idempotent via `_prisma_migrations`.
- Local dev DB `prisma db push` blocked by pre-existing search_vector generated-column drift — resolve separately; does not affect CI/phase verification (schema tests read from disk).

## Next Phase Readiness
- Wave 2 (73-03 auth+override mutation, 73-05 dashboard data layer) can consume `waivedReasonCategory`, `waivedReasonNote`, and `DocumentStatus.PENDING_REVIEW` via the regenerated client.

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-06-01*
