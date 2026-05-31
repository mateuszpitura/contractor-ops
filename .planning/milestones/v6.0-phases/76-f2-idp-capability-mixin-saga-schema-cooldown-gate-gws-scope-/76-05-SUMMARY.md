---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 05
subsystem: api
tags: [trpc, deprovisioning, cooldown, eligibility, tenant]

requires:
  - phase: 76
    provides: "76-04 canStartDeprovisioning helper; 76-02 ContractorAssignment.endedAt"
provides:
  - "deprovisioningRouter.getDeprovisioningEligibility tRPC query (cooldown gate UI source-of-truth)"
affects: [76-06]

tech-stack:
  added: ["@contractor-ops/idp-saga as @contractor-ops/api dependency"]
  patterns: ["country-code → IANA TZ resolution map for cooldown boundary", "single-helper two-consumer gate"]

key-files:
  created:
    - packages/api/src/routers/integrations/deprovisioning.ts
  modified:
    - packages/api/src/routers/integrations/index.ts
    - packages/api/src/root.ts
    - packages/api/src/__tests__/deprovisioning-eligibility.test.ts
    - packages/api/package.json

key-decisions:
  - "Router lives in routers/integrations/ subfolder + barrel + root.ts integrations import block (not flat) — matches the post-migration router topology"
  - "Used tenantProcedure (middleware/tenant) for org-scoped auth + tenant-scoped ctx.db; ctx.user.id for the audit userId — protectedProcedure does not exist in this tree"
  - "No Contractor.jurisdictionTz column exists (the Phase 71 expiryJurisdictionTz lives on ContractorComplianceItem), so the query derives the cooldown TZ from contractor.countryCode via a DE/GB/PL/SA/AE map with Europe/Berlin fallback"
  - "Tenant isolation via findOrThrow on tenant-scoped ctx.db → NOT_FOUND on cross-org access (no existence side-channel)"
  - "Test uses the repo's vi.hoisted + vi.mock(auth/db/logger) + createCallerFactory integration harness (mirrors economic-dependency-alert.test); added getIdpAuditLogger to the logger mock"

patterns-established:
  - "Eligibility query + mutation share canStartDeprovisioning — UI cannot lie about gate state"

requirements-completed: [IDP-02, IDP-10]

duration: 10 min
completed: 2026-05-31
---

# Phase 76 Plan 05: getDeprovisioningEligibility Query Summary

**`deprovisioning.getDeprovisioningEligibility` tRPC query — reads the assignment + contractor country, derives the jurisdiction TZ, runs the single source-of-truth cooldown helper, and emits an audit-grade log entry; tenant-isolated via NOT_FOUND.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-31T17:13:00Z
- **Completed:** 2026-05-31T17:19:00Z
- **Tasks:** 3
- **Files:** 1 created + 4 modified

## Accomplishments
- New `deprovisioningRouter` with `getDeprovisioningEligibility` (tenantProcedure query) mounted at `appRouter.deprovisioning`.
- Derives the cooldown boundary TZ from `contractor.countryCode` (DE/GB/PL/SA/AE → IANA TZ; Europe/Berlin fallback) since no per-contractor TZ column exists.
- Calls the same `canStartDeprovisioning` helper the mutation (76-06) will use; emits one `deprovision_eligibility_checked` audit entry per call.
- 4 GREEN tests through the real tenant middleware chain: cooldown active, cooldown elapsed, cross-tenant NOT_FOUND, not-ENDED refusal.

## Task Commits

1. **76-05-01..03: router + mount + test + dep** — `7217ce27` (feat)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Path/API drift] Router topology + procedure + TZ source**
- **Found during:** Tasks 76-05-01 / 76-05-02
- **Issue:** Plan put the router flat at `routers/deprovisioning.ts`, used `protectedProcedure`, `ctx.userId`, and `Contractor.jurisdictionTz` — none match the current tree.
- **Fix:** Placed it under `routers/integrations/` (+ barrel + root.ts integrations import); used `tenantProcedure` + `ctx.user.id`; derived TZ from `contractor.countryCode`.
- **Verification:** api typecheck 0; eligibility 4 GREEN.
- **Committed in:** `7217ce27`

**2. [Rule 3 - Blocker] api did not depend on @contractor-ops/idp-saga**
- **Found during:** Task 76-05-01 typecheck (TS2307)
- **Issue:** `@contractor-ops/api` lacked the idp-saga workspace dependency.
- **Fix:** Added `@contractor-ops/idp-saga: workspace:*` to api deps + `pnpm install`.
- **Verification:** module resolves; typecheck 0.
- **Committed in:** `7217ce27`

---

**Total deviations:** 2 auto-fixed (path/API drift + missing dep)
**Impact on plan:** No scope creep. D-05/D-07 single-helper-two-consumers contract honoured.

## Issues Encountered
None beyond the deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 76-06 (startDeprovisioningRun mutation + step-runner) extends this router with the same helper for the server-side authoritative gate.
- Plan 76-08's UI can call `trpc.deprovisioning.getDeprovisioningEligibility` for the button-disabled state.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
