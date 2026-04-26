---
phase: 02-contractor-registry
plan: 01
subsystem: api
tags: [trpc, prisma, zod, nip-validation, iban, full-text-search, tsvector, bir1, xlsx, compliance]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: tRPC init, tenantProcedure, requirePermission middleware, Prisma client, validators package
provides:
  - contractorRouter with 10 tRPC procedures (CRUD, list, lifecycle, compliance, GUS, bulk, export)
  - Zod validators for contractor domain (create, update, list, lifecycle transition, GUS lookup)
  - NIP mod-11 checksum validation (isValidNip, nipSchema)
  - PostgreSQL full-text search migration (tsvector + GIN index)
  - Compliance health computation (green/yellow/red multi-factor)
affects: [02-02-PLAN, 02-03-PLAN, 03-contract-management]

# Tech tracking
tech-stack:
  added: [validate-polish, ibantools, bir1, xlsx]
  patterns: [plain() helper for Prisma type stripping in tRPC routers, customFieldsJson for schema-flexible billing model storage]

key-files:
  created:
    - packages/validators/src/contractor.ts
    - packages/api/src/routers/contractor.ts
    - packages/db/prisma/schema/migrations/20260320120000_add_contractor_search_vector/migration.sql
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/root.ts
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/package.json
    - packages/api/package.json

key-decisions:
  - "Store billingModel and rateValueGrosze in Contractor.customFieldsJson since ContractorBillingProfile schema lacks billingModel column"
  - "Use plain() JSON.parse/stringify helper to strip Prisma class prototypes from tRPC return types, avoiding TS2742 monorepo portability errors"
  - "Add subpath exports for Prisma generated client in db package.json for proper type resolution"
  - "Use 'simple' text search config for tsvector (not language-specific) to support Polish names and identifiers"

patterns-established:
  - "plain() helper pattern: wrap Prisma query results in JSON.parse(JSON.stringify(data)) to produce portable types for tRPC declaration emission"
  - "Contractor lifecycle transitions: explicit state machine with LEGAL_TRANSITIONS map, side-effects on ENDED/ACTIVE transitions"
  - "Compliance health computation: multi-factor (documents, contract, tasks, invoices) with overall green/yellow/red badge"

requirements-completed: [CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-08, CONT-09]

# Metrics
duration: 12min
completed: 2026-03-20
---

# Phase 2 Plan 1: Contractor Backend Summary

**tRPC contractor router with 10 procedures (CRUD, paginated list with FTS, lifecycle state machine, compliance health scoring, GUS BIR1 autofill, bulk operations, CSV/XLSX export) plus Zod validators with NIP mod-11 and IBAN validation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-20T12:07:32Z
- **Completed:** 2026-03-20T12:19:32Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Full Zod validator suite for contractor domain with NIP mod-11 checksum and IBAN validation via ibantools
- Complete tRPC contractor router with 10 procedures all enforcing tenant isolation and RBAC
- PostgreSQL full-text search via tsvector GENERATED column with weighted fields (legalName/displayName rank A, taxId/email rank B) and GIN index
- Multi-factor compliance health computation (documents, contract, tasks, invoices) producing green/yellow/red badges
- Lifecycle state machine with validated transitions and side-effects (ENDED sets INACTIVE, ACTIVE restores status)
- GUS BIR1 API integration for Polish company autofill by NIP
- CSV/XLSX export via xlsx library

## Task Commits

Each task was committed atomically:

1. **Task 1: Create contractor Zod validators with NIP/IBAN validation** - `486e277` (feat)
2. **Task 2: Create contractor tRPC router with CRUD, FTS, compliance health, GUS, and bulk ops** - `74977aa` (feat)

## Files Created/Modified
- `packages/validators/src/contractor.ts` - Zod schemas for contractor CRUD, NIP/IBAN validation, list filters, lifecycle transitions, GUS lookup
- `packages/validators/src/index.ts` - Re-exports all contractor schemas and types
- `packages/api/src/routers/contractor.ts` - Full contractor tRPC router with 10 procedures
- `packages/api/src/root.ts` - Registered contractorRouter in appRouter
- `packages/db/prisma/schema/contractor.prisma` - Added tsvector documentation comment
- `packages/db/prisma/schema/migrations/20260320120000_add_contractor_search_vector/migration.sql` - FTS migration with tsvector column and GIN index
- `packages/db/package.json` - Added subpath exports for Prisma generated client
- `packages/api/package.json` - Added bir1 and xlsx dependencies

## Decisions Made
- **billingModel storage:** ContractorBillingProfile lacks a billingModel column, so billingModel and rateValueGrosze are stored in `Contractor.customFieldsJson` as a JSON object. This avoids a schema migration for a conceptual field.
- **plain() type stripping:** Used `JSON.parse(JSON.stringify(data))` pattern to break Prisma type chain in tRPC router returns, fixing TS2742 "not portable" declaration errors in monorepo builds.
- **tsvector config:** Used PostgreSQL 'simple' text search config (not 'polish' or 'english') since contractor data includes NIP numbers, company abbreviations, and mixed-language names that shouldn't be stemmed.
- **Prisma generated client exports:** Added subpath exports `./generated/prisma/client` and `./generated/prisma/client/runtime/client` to db package.json for proper cross-package type resolution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed bir1 import pattern**
- **Found during:** Task 2 (GUS lookup implementation)
- **Issue:** Plan used `{ Bir }` named import but bir1 uses default export
- **Fix:** Changed to `birModule.default` pattern for default import
- **Files modified:** packages/api/src/routers/contractor.ts
- **Verification:** Build passes
- **Committed in:** 74977aa (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed TS2742 Prisma type portability errors**
- **Found during:** Task 2 (API build verification)
- **Issue:** TypeScript could not emit portable declaration files because tRPC router return types included Prisma generated client types from a non-portable path
- **Fix:** Added `plain()` helper (JSON serialize/deserialize) to strip Prisma class prototypes from all query results. Replaced `Prisma.ContractorWhereInput` etc. with `Record<string, any>`. Added Prisma generated client subpath exports to db package.json.
- **Files modified:** packages/api/src/routers/contractor.ts, packages/db/package.json
- **Verification:** Full clean build passes with declarations generated correctly
- **Committed in:** 74977aa (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for correct compilation. No scope creep.

## Issues Encountered
- TS2742 portability error required iteration through multiple approaches (subpath exports, paths mapping, declaration disabling) before settling on the plain() helper pattern. This is a known Prisma + TypeScript monorepo issue with composite projects.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend fully supports all contractor operations needed by frontend plans 02-02 (contractor list/table) and 02-03 (contractor detail/forms)
- All 10 tRPC procedures ready for frontend consumption
- FTS migration ready for deployment (needs `prisma migrate deploy`)

## Self-Check: PASSED

All key files verified present. Both task commits (486e277, 74977aa) confirmed in git log.

---
*Phase: 02-contractor-registry*
*Completed: 2026-03-20*
