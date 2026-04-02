---
phase: 31-google-workspace-directory-import
plan: 01
subsystem: api
tags: [google-workspace, admin-sdk, directory, oauth, trpc, qstash, zod]

# Dependency graph
requires:
  - phase: 31-00
    provides: Prisma schema with GOOGLE_WORKSPACE enum, IntegrationConnection model
provides:
  - GoogleWorkspaceAdapter with Admin SDK directory/group listing methods
  - Zod validators for directory users, groups, import input
  - tRPC router with 5 procedures (listDirectory, listUserGroups, bulkImport, triggerSync, syncStatus)
  - QStash cron schedule for daily directory sync
  - DIRECTORY_NEW_HIRE and DIRECTORY_DEPARTURE notification types
affects: [31-02, 31-03, 31-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side group re-fetch for RBAC, underscore slug for Prisma enum mapping]

key-files:
  created:
    - packages/integrations/src/adapters/google-workspace-adapter.ts
    - packages/validators/src/google-workspace.ts
    - packages/api/src/routers/google-workspace.ts
  modified:
    - packages/integrations/src/adapters/register-all.ts
    - packages/integrations/package.json
    - packages/validators/src/notification.ts
    - packages/validators/src/index.ts
    - packages/api/src/root.ts
    - .env.example

key-decisions:
  - "Adapter slug uses underscore (google_workspace) so toUpperCase() maps to GOOGLE_WORKSPACE Prisma enum"
  - "Role enum uses actual system roles (admin, ops_manager, team_manager, etc.) not simplified roles from plan"
  - "Server-side group re-fetch in bulkImport ensures RBAC is never based on client data"

patterns-established:
  - "Underscore slugs for adapters with multi-word Prisma enum values"
  - "Server-side re-verification of client-supplied data before RBAC decisions"

requirements-completed: [GOOG-01, GOOG-02, GOOG-03, GOOG-04]

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 31 Plan 01: Backend Foundation Summary

**Google Workspace Admin SDK adapter with directory/group listing, tRPC router with 5 procedures including server-side RBAC group re-fetch, and QStash daily sync cron**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T15:17:07Z
- **Completed:** 2026-04-02T15:23:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- GoogleWorkspaceAdapter with paginated directory user listing and group membership resolution via Admin SDK REST API
- tRPC router with 5 procedures: listDirectory (marks existing members), listUserGroups (deduplicated), bulkImport (server-side RBAC), triggerSync, syncStatus
- Zod validators for all Google API shapes and import input with userGroupMemberships field
- QStash cron schedule created after first import for daily 2 AM sync

## Task Commits

Each task was committed atomically:

1. **Task 1: GoogleWorkspaceAdapter + Zod validators + env config** - `ac13865` (feat)
2. **Task 2: Google Workspace tRPC router with 5 procedures** - `a5c3c4e` (feat)

## Files Created/Modified
- `packages/integrations/src/adapters/google-workspace-adapter.ts` - OAuth adapter with Admin SDK directory/group methods
- `packages/validators/src/google-workspace.ts` - Zod schemas for directory users, groups, import input, result
- `packages/api/src/routers/google-workspace.ts` - tRPC router with 5 procedures and helper functions
- `packages/integrations/src/adapters/register-all.ts` - Registered GoogleWorkspaceAdapter
- `packages/integrations/package.json` - Added adapter export path
- `packages/validators/src/notification.ts` - Added DIRECTORY_NEW_HIRE and DIRECTORY_DEPARTURE
- `packages/validators/src/index.ts` - Exported google-workspace validators
- `packages/api/src/root.ts` - Wired googleWorkspaceRouter into appRouter
- `.env.example` - Added GOOGLE_WORKSPACE_CLIENT_ID, CLIENT_SECRET, ENCRYPTION_KEY

## Decisions Made
- Used underscore in adapter slug (`google_workspace`) instead of hyphen to ensure `.toUpperCase()` produces `GOOGLE_WORKSPACE` matching the Prisma enum. The existing google-calendar adapter uses hyphens which may be a latent bug hidden by `as never` cast.
- Updated role enum from plan's simplified `["admin", "manager", "viewer"]` to actual system roles `["admin", "finance_admin", "ops_manager", "team_manager", "legal_compliance_viewer", "it_admin", "external_accountant", "readonly"]` to match Better Auth organization roles.
- Used `getQStashClient()` singleton instead of `new Client()` to follow existing codebase pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed role enum mismatch with Better Auth**
- **Found during:** Task 2 (tRPC router)
- **Issue:** Plan specified `["admin", "manager", "viewer"]` roles but Better Auth uses `["admin", "finance_admin", "ops_manager", "team_manager", "legal_compliance_viewer", "it_admin", "external_accountant", "readonly"]`. TypeScript caught the mismatch.
- **Fix:** Created `directoryRoleEnum` in validators using actual system roles, updated all references.
- **Files modified:** packages/validators/src/google-workspace.ts, packages/validators/src/index.ts, packages/api/src/routers/google-workspace.ts
- **Verification:** `tsc --noEmit` passes clean
- **Committed in:** a5c3c4e (Task 2 commit)

**2. [Rule 3 - Blocking] Added adapter export to integrations package.json**
- **Found during:** Task 2 (tRPC router)
- **Issue:** `@contractor-ops/integrations/adapters/google-workspace-adapter` import failed because package.json exports map didn't include the new adapter path.
- **Fix:** Added export entry in package.json, built both validators and integrations packages.
- **Files modified:** packages/integrations/package.json
- **Verification:** `tsc --noEmit` passes clean
- **Committed in:** a5c3c4e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Known Stubs
None - all endpoints are fully wired with real adapter calls.

## User Setup Required
None - no external service configuration required beyond the env vars documented in .env.example.

## Next Phase Readiness
- Backend API complete for Plan 02 (UI) to consume: listDirectory, listUserGroups, bulkImport
- triggerSync and syncStatus ready for Plan 03 (sync service)
- Adapter registered and discoverable via `getAdapter("google_workspace")`

---
*Phase: 31-google-workspace-directory-import*
*Completed: 2026-04-02*
