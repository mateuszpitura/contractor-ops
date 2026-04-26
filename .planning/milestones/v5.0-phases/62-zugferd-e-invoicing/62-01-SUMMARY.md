---
phase: 62-zugferd-e-invoicing
plan: 01
subsystem: database

tags:
  - prisma
  - postgres
  - neon
  - zugferd
  - einvoice
  - schema

# Dependency graph
requires:
  - phase: 61-xrechnung-e-invoicing
    provides: EInvoiceLifecycle + EInvoiceLifecycleEvent tables, multi-tenant `@@index` map-name pattern, R2 content-addressed storage conventions
provides:
  - InvoiceIntakeRequest Prisma model + four intake enums (sourceKind / status / validationStatus / profileLevel)
  - EInvoiceLifecycle.zugferdPdfKey + zugferdPdfSha256 + zugferdGeneratedAt columns
  - EInvoiceLifecycleEventType.ZUGFERD_GENERATED enum value
  - Live Neon DB synced with new surface
  - Forward-only migration file documenting the schema diff
affects:
  - 62-02-zugferd-profile-generator
  - 62-03-zugferd-parser
  - 62-04-invoice-intake-service
  - 62-05-invoice-intake-router
  - 62-06-invoice-intake-ui
  - 62-07-e2e-and-hardening

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Forward-only hand-authored migration SQL that mirrors what `prisma db push` actually emits (PascalCase tables, camelCase columns) — matches existing migration convention and remains human-readable
    - Staging entity pattern (InvoiceIntakeRequest) parallel to EInvoiceLifecycle — mutable parent + separate lifecycle events on existing audit table
    - Content-addressed dedup via (organizationId, rawFileSha256) unique constraint
    - `ALTER TYPE ... ADD VALUE` committed outside transaction block (Postgres requirement)

key-files:
  created:
    - packages/db/prisma/schema/migrations/20260414120000_invoice_intake_request/migration.sql
  modified:
    - packages/db/prisma/schema/invoice.prisma
    - packages/db/prisma/schema/einvoice.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/contract.prisma
    - packages/db/prisma/schema/organization.prisma

key-decisions:
  - "Migration SQL uses Prisma default naming (PascalCase tables, camelCase columns) to match existing schema conventions and `prisma db push` output — plan's snake_case SQL would not have matched the live DB"
  - "ALTER TYPE ADD VALUE for ZUGFERD_GENERATED is moved outside the BEGIN/COMMIT block because PostgreSQL rejects new enum values inside an open transaction — prevents runtime failures on replay"
  - "Used `IF NOT EXISTS` guard on `ALTER TYPE ... ADD VALUE` for idempotency against an already-pushed live DB"
  - "Opposite relations added across User / Contractor / Contract / Invoice / Organization with explicit named relations (InvoiceIntakeUploadedBy / InvoiceIntakeMatchedContractor / InvoiceIntakeMatchedContract / InvoiceIntakeConvertedInvoice / InvoiceIntakeValidationAckBy) to allow two FKs from the same intake row into the User table without ambiguity"

patterns-established:
  - "Multi-relation-name convention for multi-FK-into-same-table scenarios"
  - "Forward-only migration files are authored manually to document db push changes — file is the canonical historical record, not the applier"

requirements-completed: [EINV-03, EINV-02]

# Metrics
duration: ~15 min
completed: 2026-04-14
---

# Phase 62 Plan 01: Database Contract for ZUGFeRD + Invoice Intake Summary

**InvoiceIntakeRequest model + 4 enums added to Prisma schema, EInvoiceLifecycle extended with three ZUGFeRD PDF columns + ZUGFERD_GENERATED event type, live Neon DB synced via `prisma db push`, generated Prisma client types compile.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-14T23:11Z
- **Completed:** 2026-04-14T23:26Z
- **Tasks:** 4 / 4
- **Files modified:** 6 (plus 1 created)

## Accomplishments
- New `InvoiceIntakeRequest` Prisma model wired into `User` / `Contractor` / `Contract` / `Invoice` / `Organization` with all D-09 fields, SHA-256 dedup unique constraint, and explicit `@@index` map names that stay ≤63 chars (Neon Postgres compatibility).
- `EInvoiceLifecycle` extended with three nullable ZUGFeRD columns (`zugferdPdfKey`, `zugferdPdfSha256`, `zugferdGeneratedAt`) matching Phase 61 conventions; `EInvoiceLifecycleEventType` enum appended with `ZUGFERD_GENERATED`.
- Forward-only migration SQL committed at `packages/db/prisma/schema/migrations/20260414120000_invoice_intake_request/migration.sql` using Prisma default naming so the file matches what `prisma db push` actually produces.
- Live Neon DB pushed and verified via live SELECTs — `InvoiceIntakeRequest` table exists, `EInvoiceLifecycle.zugferdPdfKey` column exists, `ZUGFERD_GENERATED` enum value exists.
- `pnpm --filter @contractor-ops/db exec tsc --noEmit` exits 0 — generated Prisma client v7.7.0 types compile cleanly.

## Task Commits

1. **Task 1: Add InvoiceIntakeRequest model + enums to invoice.prisma** — `ad9b7e3f` (feat)
2. **Task 2: Extend EInvoiceLifecycle with zugferdPdfKey and ZUGFERD_GENERATED event type** — `f0be5cb8` (feat)
3. **Task 3: Generate forward-only migration SQL** — `1f73511a` (chore)
4. **Task 4 [BLOCKING]: Apply migration to live DB + regenerate client** — no code commit (side-effect only); verified via live SELECTs + tsc

## Files Created/Modified

### Created
- `packages/db/prisma/schema/migrations/20260414120000_invoice_intake_request/migration.sql` — forward-only SQL documenting the intake table + ZUGFeRD columns + new enum value

### Modified
- `packages/db/prisma/schema/invoice.prisma` — new `InvoiceIntakeRequest` model + four enums + opposite relation on `Invoice`
- `packages/db/prisma/schema/einvoice.prisma` — three ZUGFeRD columns on `EInvoiceLifecycle` + `ZUGFERD_GENERATED` enum value
- `packages/db/prisma/schema/auth.prisma` — `uploadedIntakes` and `acknowledgedIntakes` back-relations on `User`
- `packages/db/prisma/schema/contractor.prisma` — `intakes` back-relation on `Contractor`
- `packages/db/prisma/schema/contract.prisma` — `intakes` back-relation on `Contract`
- `packages/db/prisma/schema/organization.prisma` — `invoiceIntakes` back-relation on `Organization`

## Decisions Made
- **Plan migration SQL used snake_case table names that do not exist in this DB.** Fixed to PascalCase tables + camelCase columns matching Prisma default naming as used throughout the project (`"Invoice"`, `"EInvoiceLifecycle"`, `"Member"`, etc.). The project uses `prisma db push` rather than `migrate deploy`, so the migration file is documentation — but keeping it accurate to DB reality is important for audit and potential future `migrate resolve` usage.
- **`ALTER TYPE ... ADD VALUE` moved outside the `BEGIN/COMMIT` block.** PostgreSQL disallows adding enum values inside an open transaction on newer versions; isolating the statement keeps the file replay-safe.
- **`IF NOT EXISTS` on the enum value.** Makes the migration idempotent against the already-pushed DB without failure.
- **Every new @@index / @@unique carries an explicit map: name ≤63 chars.** Matches Phase 61 convention and pre-empts Postgres identifier truncation collisions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected migration SQL table/column naming**
- **Found during:** Task 3 (writing migration SQL)
- **Issue:** The plan's migration SQL used snake_case table names (`"invoice_intake_request"`, `"e_invoice_lifecycle"`, `"organization"`, `"user"`, `"contractor"`, `"contract"`, `"invoice"`) and snake_case column names (`"organization_id"`, `"raw_file_key"`, etc.). Inspection of existing migrations (`20260318120000_enable_rls`, `20260322000000_add_invoice_search_vector`, `20260411140000_approval_condition_field_snake_case`) shows the Postgres schema actually uses PascalCase table names (`"Member"`, `"Invoice"`, `"ApprovalChainConfig"`) and camelCase column names (`"invoiceNumber"`, `"notes"`) — i.e. Prisma defaults. Applying the plan's snake_case SQL would not match the live DB, could not be used for `migrate resolve`, and would confuse future auditors.
- **Fix:** Rewrote the migration SQL to use the correct naming conventions (PascalCase tables, camelCase columns, PascalCase enum types). Kept the `@@index` map: names as specified in the Prisma schema (`invoice_intake_org_sha_uniq`, etc.), since those are explicitly set to snake_case by the plan's schema for readability.
- **Files modified:** `packages/db/prisma/schema/migrations/20260414120000_invoice_intake_request/migration.sql`
- **Verification:** grep checks for `CREATE TABLE "InvoiceIntakeRequest"`, `ALTER TABLE "EInvoiceLifecycle"`, `ZUGFERD_GENERATED`, no DROP statements, index name lengths all ≤63 chars — all pass.
- **Committed in:** `1f73511a`

**2. [Rule 2 - Missing Critical] Moved `ALTER TYPE ... ADD VALUE` outside the transaction block**
- **Found during:** Task 3 (writing migration SQL)
- **Issue:** The plan placed `ALTER TYPE "e_invoice_lifecycle_event_type" ADD VALUE 'ZUGFERD_GENERATED'` inside the `BEGIN; ... COMMIT;` block. PostgreSQL rejects enum value additions inside open transactions on modern versions (the statement fails with `unsafe use of new value of enum type`). On replay this would abort the whole migration.
- **Fix:** Moved the `ALTER TYPE` statement below the `COMMIT;` and added `IF NOT EXISTS` for idempotency.
- **Files modified:** `packages/db/prisma/schema/migrations/20260414120000_invoice_intake_request/migration.sql`
- **Verification:** Structural correctness by inspection; live DB push (Task 4) succeeded and the enum value is queryable.
- **Committed in:** `1f73511a`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical).
**Impact on plan:** Both auto-fixes preserve plan intent while correcting correctness issues that would have surfaced on any future replay or resolve. No scope creep.

## Issues Encountered
- `node -e` against the generated Prisma client at `packages/db/generated/prisma/client/` failed to resolve `@prisma/client-runtime-utils` from the package-local `node_modules` because pnpm hoists it to the repo-root `.pnpm/` store. Worked around by running `tsx` from the repo root against a `/tmp` script that imports via the workspace alias `@contractor-ops/db` (the same pattern production code uses). Live DB verification succeeded.
- The `name` pg_catalog type is not auto-deserialized by `@prisma/adapter-neon`; resolved by `::text` casts in the verification queries (diagnostic only — no code change).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 62-02 (ZUGFeRD profile generator) can now import `InvoiceIntakeProfileLevel` enum types from the generated Prisma client.
- Plan 62-04 (intake service) can call `prisma.invoiceIntakeRequest.*` operations — types exist and DB is in sync.
- Plan 62-05 (intake router) can write `EInvoiceLifecycleEvent` rows with `eventType: 'ZUGFERD_GENERATED'` and read/write `zugferdPdfKey` / `zugferdPdfSha256` / `zugferdGeneratedAt` on `EInvoiceLifecycle`.
- No blockers for downstream plans.

## Self-Check: PASSED

Verified:
- [x] `packages/db/prisma/schema/invoice.prisma` contains `model InvoiceIntakeRequest` and all four enums
- [x] `packages/db/prisma/schema/einvoice.prisma` contains `zugferdPdfKey`, `zugferdPdfSha256`, `zugferdGeneratedAt` columns and `ZUGFERD_GENERATED` enum value
- [x] Migration file `packages/db/prisma/schema/migrations/20260414120000_invoice_intake_request/migration.sql` exists
- [x] Commit `ad9b7e3f` exists (Task 1)
- [x] Commit `f0be5cb8` exists (Task 2)
- [x] Commit `1f73511a` exists (Task 3)
- [x] `pnpm --filter @contractor-ops/db exec prisma validate` exits 0
- [x] `pnpm --filter @contractor-ops/db exec tsc --noEmit` exits 0
- [x] Live DB has `InvoiceIntakeRequest` table (queried 1 row)
- [x] Live DB has `EInvoiceLifecycle.zugferdPdfKey` column (queried 1 row)
- [x] Live DB has `ZUGFERD_GENERATED` enum value (queried 1 row)
- [x] Generated Prisma client exposes `invoiceIntakeRequest` (29 references in `index.d.ts`), `ZUGFERD_GENERATED` (1 reference), `zugferdPdfKey` (45 references)
- [x] No `console.*` calls in any edited file

---
*Phase: 62-zugferd-e-invoicing*
*Completed: 2026-04-14*
