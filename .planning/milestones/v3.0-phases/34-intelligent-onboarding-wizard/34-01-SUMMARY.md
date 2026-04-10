---
phase: 34-intelligent-onboarding-wizard
plan: 01
subsystem: api
tags: [trpc, zod, jira, linear, slack, google-workspace, onboarding, import, merge, dedup]

# Dependency graph
requires:
  - phase: 29-linear-integration
    provides: linearGraphQL helper for Linear API calls
  - phase: 31-google-workspace
    provides: Google Workspace adapter for directory user listing
  - phase: 28-billing-stripe
    provides: Organization settingsJson for metadata storage
provides:
  - onboardingImportRouter with 6 tRPC endpoints
  - onboarding-import-service with cross-tool user fetch, email merge/dedup, workflow template creation
  - Zod validators for all onboarding import inputs/outputs
affects: [34-02 wizard UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [cross-tool orchestration via Promise.allSettled, email-based merge/dedup with conflict detection, org settingsJson for import job progress tracking]

key-files:
  created:
    - packages/validators/src/onboarding-import.ts
    - packages/api/src/services/onboarding-import-service.ts
    - packages/api/src/routers/onboarding-import.ts
    - packages/api/src/routers/__tests__/onboarding-import.test.ts
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/root.ts

key-decisions:
  - "Used org settingsJson (not a separate Settings model) for import job progress persistence"
  - "Synchronous import processing within mutation (not QStash async) for MVP simplicity with per-item progress updates"
  - "Used crypto.randomUUID instead of cuid2 for import jobId to avoid adding a dependency"

patterns-established:
  - "Cross-tool fetch pattern: Promise.allSettled per source so individual tool failures don't block others"
  - "Email-based merge/dedup: normalize to lowercase, detect name conflicts, mark existing members"
  - "Workflow template auto-generation: project statuses become MANUAL tasks in CUSTOM template"

requirements-completed: [ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05]

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 34 Plan 01: Onboarding Import Backend Summary

**Cross-tool onboarding import API with Jira/Linear/Google Workspace/Slack user fetch, email-based merge/dedup with conflict detection, project-to-workflow template conversion, and per-item retry**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T23:21:47Z
- **Completed:** 2026-04-04T23:30:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 6 tRPC endpoints (listSources, fetchPeople, fetchProjects, startImport, getProgress, retryFailedItem) registered in root router
- Cross-tool user fetching with paginated Jira, active-only Linear, Google Admin SDK, and Slack with bot/deleted/app/USLACKBOT filtering
- Email-based merge/dedup with lowercase normalization, name conflict detection, and existing member marking
- Workflow template creation from imported projects (type CUSTOM, taskType MANUAL, assigneeMode ROLE_BASED)
- Import progress persisted in org settingsJson for page-refresh resilience
- 12 Zod schemas exported from validators package

## Task Commits

Each task was committed atomically:

1. **Task 1: Zod validators + test stubs (RED)** - `7bc0c47` (test)
2. **Task 2: tRPC router + service + root registration (GREEN)** - `35b98a6` (feat)

_Note: TDD task with RED/GREEN phases across two commits_

## Files Created/Modified
- `packages/validators/src/onboarding-import.ts` - 12 Zod schemas for all onboarding import inputs/outputs
- `packages/validators/src/index.ts` - Re-exports for onboarding-import schemas
- `packages/api/src/services/onboarding-import-service.ts` - Cross-tool fetch (Jira/Linear/GWS/Slack), mergeByEmail, createWorkflowTemplatesFromProjects
- `packages/api/src/routers/onboarding-import.ts` - tRPC router with 6 endpoints using tenantProcedure
- `packages/api/src/routers/__tests__/onboarding-import.test.ts` - 12 test cases covering all ONBD requirements
- `packages/api/src/root.ts` - Router registration

## Decisions Made
- Used org settingsJson for import job progress instead of a separate model -- keeps schema simple for MVP
- Synchronous import processing within mutation instead of QStash async -- simpler for MVP, upgradeable later
- Used crypto.randomUUID for job IDs to avoid adding cuid2 as a new dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate organization mock key in test**
- **Found during:** Task 2
- **Issue:** mockPrisma had duplicate `organization` key -- second (without `update`) overwrote first
- **Fix:** Removed duplicate key, kept single definition with both findFirst and update
- **Files modified:** packages/api/src/routers/__tests__/onboarding-import.test.ts
- **Committed in:** 35b98a6

**2. [Rule 3 - Blocking] Replaced prisma.settings with prisma.organization.settingsJson**
- **Found during:** Task 2
- **Issue:** Plan referenced a `Settings` model that doesn't exist in schema -- Organization has settingsJson
- **Fix:** Refactored helpers to use prisma.organization for import job storage
- **Files modified:** packages/api/src/routers/onboarding-import.ts, test file
- **Committed in:** 35b98a6

**3. [Rule 3 - Blocking] Replaced cuid2 with crypto.randomUUID**
- **Found during:** Task 2
- **Issue:** @paralleldrive/cuid2 not installed in api package
- **Fix:** Used Node.js built-in crypto.randomUUID instead
- **Files modified:** packages/api/src/routers/onboarding-import.ts
- **Committed in:** 35b98a6

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Validators package needed rebuild before tests could resolve @contractor-ops/validators imports

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all endpoints are fully wired with real data paths.

## Next Phase Readiness
- All 6 API endpoints ready for wizard UI (Plan 02) consumption
- Validators exported for frontend form validation
- Cross-tool fetch patterns established for future integration additions

---
*Phase: 34-intelligent-onboarding-wizard*
*Completed: 2026-04-05*
