---
phase: 10-onboarding-polish
plan: 01
subsystem: api
tags: [xlsx, csv, import, search, tsvector, postgresql, trpc]

requires:
  - phase: 02-contractor-registry
    provides: Contractor model with taxId, tsvector search_vector column
  - phase: 03-contracts-documents
    provides: Contract model with searchVector tsvector column
  - phase: 05-invoice-intake
    provides: Invoice model with invoiceNumber, notes fields

provides:
  - Import processor service for CSV/XLSX parsing with column auto-mapping and validation
  - Import tRPC router with parse/validate/commit endpoints
  - Unified search tRPC router querying contractors, contracts, invoices via tsvector
  - Invoice search_vector migration for full-text search

affects: [10-02, 10-03, 10-04]

tech-stack:
  added: []
  patterns: [xlsx-read-reverse-pattern, field-alias-auto-mapping, multi-entity-tsvector-search]

key-files:
  created:
    - packages/api/src/services/import-processor.ts
    - packages/api/src/routers/import.ts
    - packages/api/src/routers/search.ts
    - packages/db/prisma/schema/migrations/20260322000000_add_invoice_search_vector/migration.sql
  modified:
    - packages/api/src/root.ts

key-decisions:
  - "Default billingModel MONTHLY_RETAINER and rateType MONTHLY_FIXED for contract import (required fields not in typical import CSVs)"
  - "Contract search uses camelCase searchVector column name matching existing migration convention"

patterns-established:
  - "Field alias auto-mapping: normalizeHeader + alias lookup for CSV/XLSX column matching"
  - "Multi-entity tsvector search: parallel raw queries with Promise.all, type-discriminated results"

requirements-completed: [IMP-01, IMP-02, IMP-03, SRCH-01]

duration: 4min
completed: 2026-03-23
---

# Phase 10 Plan 01: Import Processor & Search Backend Summary

**CSV/XLSX import processor with column auto-mapping, row validation, and duplicate detection; unified cross-entity tsvector search router**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T09:03:24Z
- **Completed:** 2026-03-23T09:07:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Import processor service parses CSV/XLSX files, auto-maps columns by Polish/English aliases, validates rows against entity schemas, and detects duplicates by taxId
- Import router exposes parse/validate/commit endpoints with RBAC permission checks and transactional database writes
- Unified search router queries contractors, contracts, and invoices via PostgreSQL tsvector with prefix matching
- Invoice search_vector migration adds generated tsvector column with GIN index

## Task Commits

Each task was committed atomically:

1. **Task 1: Import processor service and import tRPC router** - `1388aec` (feat)
2. **Task 2: Search tRPC router, invoice search vector migration, root.ts registration** - `dee4e02` (feat)

## Files Created/Modified
- `packages/api/src/services/import-processor.ts` - CSV/XLSX parsing, column auto-mapping, row validation, duplicate detection
- `packages/api/src/routers/import.ts` - Import tRPC router with parse/validate/commit endpoints
- `packages/api/src/routers/search.ts` - Unified cross-entity search via tsvector
- `packages/db/prisma/schema/migrations/20260322000000_add_invoice_search_vector/migration.sql` - Invoice tsvector column and GIN index
- `packages/api/src/root.ts` - Registered import and search routers (18 total)

## Decisions Made
- Default billingModel to MONTHLY_RETAINER and rateType to MONTHLY_FIXED for contract imports since these are required DB fields not typically present in import CSVs
- Contract search uses camelCase `searchVector` column name matching the existing contract migration convention (vs snake_case `search_vector` for Contractor and Invoice)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing billingModel and rateType for contract creation**
- **Found during:** Task 1 (import router commit endpoint)
- **Issue:** Contract.create requires billingModel and rateType fields which were not specified in the plan's contract import data mapping
- **Fix:** Added sensible defaults (MONTHLY_RETAINER, MONTHLY_FIXED) for imported contracts
- **Files modified:** packages/api/src/routers/import.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 1388aec (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for TypeScript correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Import processor and search router are ready for frontend consumption (import wizard, command palette, search bar)
- All backend APIs registered in root.ts and accessible via tRPC client

---
*Phase: 10-onboarding-polish*
*Completed: 2026-03-23*
