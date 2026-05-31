---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 10
subsystem: testing
tags: [cron, gc, d16-template, no-reactivate, rtl, idp-saga]

requires:
  - phase: 76
    provides: "76-04 gcExpiredProvenance; 76-09 GWS deprovision test (D-16 template subject)"
provides:
  - "IdpChangeProvenance 90-day GC sub-task in the reminders cron (D-12)"
  - "D-16 per-provider integration-test template annotation"
  - "SC#7/IDP-15 no-Reactivate invariant (grep guard + 2 RTL)"
affects: [77, 78]

tech-stack:
  added: ["@contractor-ops/idp-saga as @contractor-ops/cron-worker dependency"]
  patterns: ["isolated cron sub-task (never-rejecting Promise.all member)", "render-based absence assertion (ProfileHeaderView at terminal stages)"]

key-files:
  modified:
    - apps/cron-worker/src/jobs/handlers/reminders/index.ts
    - apps/cron-worker/src/__tests__/gc-provenance.test.ts
    - apps/cron-worker/package.json
    - packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts
    - apps/web-vite/src/__tests__/no-reactivate-button.test.tsx

key-decisions:
  - "GC wired into apps/cron-worker reminders handler (apps/web App Router deleted) as a 4th Promise.all member via gcIdpProvenance() which wraps gcExpiredProvenance in its own try/catch so it NEVER rejects — isolation without breaking Promise.all semantics (T-76-10-02)"
  - "GC uses the non-tenant prismaRaw client — it is a cross-org retention sweep (delete by initiatedAt < now-90d), not tenant-scoped"
  - "gc-provenance test mocks remindersHandler (not a Next GET route) and asserts call-once + structured log + isolation; mirrors the existing reminders.test harness"
  - "no-reactivate RTL renders the real ProfileHeaderView at ENDED + OFFBOARDING (the contractor-action surface) and asserts no Reactivate button — member/user reactivation in settings is out of scope (SC#7 is contractor-specific; the grep pattern reactivate.*contractor distinguishes them)"

patterns-established:
  - "SC#7 invariant locked forward: any future Reactivate-contractor label fails the grep guard in CI"

requirements-completed: [IDP-08, IDP-13, IDP-15]

duration: 12 min
completed: 2026-05-31
---

# Phase 76 Plan 10: GC Cron + D-16 Template + No-Reactivate Summary

**90-day IdpChangeProvenance GC wired into the reminders cron (isolated try/catch), the GWS deprovision test annotated as the per-provider D-16 template, and the SC#7/IDP-15 no-Reactivate invariant locked by a grep guard + 2 render-based RTL assertions.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-31T17:50:00Z
- **Completed:** 2026-05-31T18:00:00Z
- **Tasks:** 4
- **Files:** 5 modified

## Accomplishments
- D-12: `gcExpiredProvenance(prismaRaw)` runs once per reminders tick as a 4th `Promise.all` member, wrapped so a GC failure logs + returns 0 without aborting the other sub-tasks; structured pino `{ deleted, sub_task: 'idp_provenance_gc' }` + metrics gauge.
- D-16: GWS deprovision test carries a TEMPLATE header (5-step copy procedure + SC#5 mocked-clock contract) for Phases 77-78.
- SC#7/IDP-15: grep guard GREEN (zero `reactivate.*contractor` in production source + messages) + 2 RTL renders of `ProfileHeaderView` (ENDED, OFFBOARDING) asserting no Reactivate button.
- gc-provenance 3 GREEN; reminders regression 3 GREEN; no-reactivate 3 GREEN; GWS deprovision 7 GREEN; cron-worker typecheck clean.

## Task Commits

1. **76-10-01..04: template annotation + GC cron + gc test + no-reactivate RTL** — `ae1165d7` (feat)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Path/API drift] cron is apps/cron-worker, not apps/web App Router**
- **Found during:** Tasks 76-10-02 / 76-10-03
- **Issue:** Plan targeted `apps/web/src/app/api/cron/reminders/route.ts` (Next GET handler, deleted).
- **Fix:** Wired the GC into `apps/cron-worker/src/jobs/handlers/reminders/index.ts` (4th Promise.all member, never-rejecting wrapper); the gc test mocks `remindersHandler` + idp-saga (mirrors reminders.test). Added idp-saga to cron-worker deps.
- **Verification:** cron-worker typecheck 0; gc-provenance + reminders 6 GREEN.
- **Committed in:** `ae1165d7`

**2. [Rule 1 - Adaptation] no-reactivate RTL renders ProfileHeaderView, not full pages**
- **Found during:** Task 76-10-04
- **Issue:** Plan dynamic-imported Next App Router pages (fragile in web-vite). T-76-10-05 flagged flakiness.
- **Fix:** Rendered the real `ProfileHeaderView` (the contractor-action surface) at terminal stages ENDED + OFFBOARDING and asserted no Reactivate button — a genuine render-based assertion. The grep guard remains the load-bearing invariant.
- **Verification:** no-reactivate 3 GREEN.
- **Committed in:** `ae1165d7`

---

**Total deviations:** 2 auto-fixed (path drift + RTL adaptation)
**Impact on plan:** No scope creep. D-12 GC isolated, D-16 template ready, SC#7 invariant enforced forever.

## Issues Encountered
None beyond the deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 76 is feature-complete: all 19 Wave-0 scaffolds are GREEN. Phases 77/78 copy the D-16 template + add Deprovisionable adapters to PROVIDERS_FOR_RUN.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
