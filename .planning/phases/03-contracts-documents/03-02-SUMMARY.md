---
phase: 03-contracts-documents
plan: 02
subsystem: api
tags: [r2, s3, presigned-urls, cloudflare, mime-validation, clamav, virus-scanning, trpc, document-management]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: tenantProcedure, requirePermission RBAC middleware, auth Permission type
  - phase: 03-contracts-documents plan 01
    provides: contract.prisma Document/DocumentLink models, appRouter registration pattern
provides:
  - R2 storage service with presigned upload/download URL generation
  - MIME type validator using magic bytes (file-type package)
  - ClamAV virus scanner wrapper service
  - Document Zod validators (requestUpload, confirmUpload, link, list, versionUpload)
  - Document tRPC router with 8 procedures (requestUpload, confirmUpload, getDownloadUrl, list, uploadNewVersion, getVersionHistory, delete, linkToEntity)
  - Document permission resource in auth access control
affects: [03-contracts-documents, 05-invoice-pipeline, 04-workflow-engine]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "file-type", "clamscan"]
  patterns: ["presigned URL upload flow (request -> upload -> confirm)", "fire-and-forget async scanning", "entity linking via DocumentLink polymorphic table"]

key-files:
  created:
    - packages/api/src/services/r2.ts
    - packages/api/src/services/mime-validator.ts
    - packages/api/src/services/virus-scanner.ts
    - packages/api/src/types/clamscan.d.ts
    - packages/validators/src/document.ts
    - packages/api/src/routers/document.ts
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/root.ts
    - packages/auth/src/permissions.ts
    - .env.example

key-decisions:
  - "Document permission as separate resource in auth AC (not nested under contract)"
  - "Virus scanning is fire-and-forget async -- confirmUpload returns immediately"
  - "ClamAV unavailability marks scan as FAILED (never skips scanning)"
  - "Version history derived from DocumentLink entity linkage + documentType match"

patterns-established:
  - "Presigned URL upload flow: requestUpload creates record + returns signed PUT URL, confirmUpload verifies HEAD + triggers async scan"
  - "Service module pattern: packages/api/src/services/ for infrastructure wrappers (R2, MIME, ClamAV)"
  - "Fire-and-forget pattern: void scanAndUpdate(...) with .catch() error logging"

requirements-completed: [CNTR-02, DOCS-01, DOCS-02, DOCS-03, DOCS-04]

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 3 Plan 2: Document Backend Summary

**R2 presigned URL upload/download flow with MIME magic-byte validation, ClamAV virus scanning, document versioning, and entity linking via tRPC router**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T14:00:28Z
- **Completed:** 2026-03-20T14:07:17Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- R2 storage service with singleton client, presigned upload (5min) and download (15min) URL generation
- MIME validator using file-type package for content-based magic byte detection (not extension-based)
- ClamAV virus scanner wrapper with stream-based scanning and availability check
- Document tRPC router with 8 procedures covering full upload, download, versioning, linking, and deletion lifecycle
- Document Zod validators with proper size limits (25MB) and enum mirrors for all DocumentType values

## Task Commits

Each task was committed atomically:

1. **Task 1: R2 storage service, MIME validator, virus scanner, document validators, and env vars** - `5395e11` (feat)
2. **Task 2: Document tRPC router with presigned upload/download, versioning, and entity linking** - `074bcbd` (feat)

## Files Created/Modified
- `packages/api/src/services/r2.ts` - R2 client singleton, presigned URL generation, head/delete operations
- `packages/api/src/services/mime-validator.ts` - MIME validation via magic bytes using file-type package
- `packages/api/src/services/virus-scanner.ts` - ClamAV daemon wrapper with stream scanning
- `packages/api/src/types/clamscan.d.ts` - TypeScript declarations for clamscan package
- `packages/validators/src/document.ts` - Zod schemas for document upload, confirm, link, list, version
- `packages/validators/src/index.ts` - Added document validator exports
- `packages/api/src/routers/document.ts` - Document tRPC router with 8 procedures
- `packages/api/src/root.ts` - Registered documentRouter in appRouter
- `packages/auth/src/permissions.ts` - Added document resource to access control statement
- `.env.example` - Added R2 and ClamAV environment variables

## Decisions Made
- Added `document` as a separate permission resource in auth access control (not nested under `contract`) for granular RBAC control over document operations
- Virus scanning uses fire-and-forget pattern -- confirmUpload returns immediately while scan runs async
- ClamAV unavailability marks virusScanStatus as FAILED (never silently skips, following security-first principle)
- Version history is derived by finding all documents linked to the same entity with the same documentType, ordered by createdAt desc

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added document resource to auth permissions**
- **Found during:** Task 2 (Document router)
- **Issue:** Permission type did not include `document` resource, causing TypeScript errors on `requirePermission({ document: ["create"] })`
- **Fix:** Added `document: ["create", "read", "update", "delete"]` to auth access control statement
- **Files modified:** packages/auth/src/permissions.ts
- **Verification:** tsc --noEmit passes for document router
- **Committed in:** 074bcbd (Task 2 commit)

**2. [Rule 3 - Blocking] Added clamscan TypeScript declarations**
- **Found during:** Task 1 (Virus scanner service)
- **Issue:** clamscan package has no @types package and no built-in declarations
- **Fix:** Created custom type declaration file at packages/api/src/types/clamscan.d.ts
- **Files modified:** packages/api/src/types/clamscan.d.ts
- **Verification:** tsc --noEmit passes for virus-scanner.ts
- **Committed in:** 5395e11 (Task 1 commit)

**3. [Rule 3 - Blocking] Updated root .env.example instead of apps/web/.env.example**
- **Found during:** Task 1 (Env vars)
- **Issue:** Plan specified apps/web/.env.example but the project uses a root-level .env.example
- **Fix:** Added R2 and ClamAV vars to the root .env.example
- **Files modified:** .env.example
- **Verification:** File contains R2_ACCOUNT_ID and CLAMAV_HOST
- **Committed in:** 5395e11 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in packages/api/src/routers/contract.ts (from plan 03-01) -- contract validators not properly exported. Out of scope for this plan, not addressed.

## User Setup Required
None - R2 and ClamAV configuration documented in .env.example but no external service setup needed for development.

## Next Phase Readiness
- Document backend fully operational, ready for document upload UI (plan 03-03+)
- All 8 document procedures available as trpc.document.* from client
- Entity linking supports both CONTRACTOR and CONTRACT entity types
- Presigned URL flow ready for drag-and-drop upload component integration

---
*Phase: 03-contracts-documents*
*Completed: 2026-03-20*
