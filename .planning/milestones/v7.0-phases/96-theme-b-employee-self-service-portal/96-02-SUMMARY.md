---
phase: 96-theme-b-employee-self-service-portal
plan: 02
subsystem: auth
tags: [portal, auth, trpc, magic-link, idor, discriminated-session]
requirements: [EMP-PORTAL-01]
dependency_graph:
  requires:
    - phase: 96-01
      provides: "PortalSession subject columns + one-of CHECK; PortalSubjectType; managerWorkerId; module.employee-portal"
  provides:
    - "Discriminated validatePortalSession (CONTRACTOR | EMPLOYEE) + discriminated createPortalSession"
    - "portalEmployeeProcedure (ctx.workerId, never ctx.contractorId) + portalManagerProcedure (asserts >=1 report)"
    - "findEmployeesByEmail + magic-link subject union (requestMagicLink/verifyMagicLink/selectOrg)"
    - "EMPLOYEE_PORTAL_DISABLED + PORTAL_NOT_A_MANAGER error codes (en/de/pl/ar)"
  affects:
    - "96-03 (RED net constructs employee/manager callers against these procedures)"
    - "96-04/05/06 (routers bind portalEmployeeProcedure/portalManagerProcedure)"
tech_stack:
  patterns:
    - "One findUnique loads both subject relations; the stored subjectType selects the discriminated return branch"
    - "const-local narrowing of the nullable subject id so it survives into the tenantStore.run closure"
    - "portalManagerProcedure = portalEmployeeProcedure.use(...) so the manager gate inherits the employee-augmented ctx type"
    - "Additive magic-link contract: `orgs` (contractor-only) unchanged for the existing UI + new `subjects` union"
key_files:
  created:
    - "packages/api/src/services/__tests__/portal-session-subject.test.ts"
    - "packages/api/src/services/__tests__/portal-contractor-regression.test.ts"
    - "packages/api/src/services/__tests__/portal-employee-resolution.test.ts"
  modified:
    - "packages/api/src/services/portal-session.ts"
    - "packages/api/src/services/portal-magic-link.ts"
    - "packages/api/src/middleware/portal-auth.ts"
    - "packages/api/src/routers/portal/portal-auth-router.ts"
    - "packages/api/src/errors.ts"
    - "packages/api/src/services/__tests__/portal-session.test.ts (updated for discriminated shape)"
    - "apps/web-vite/messages/{en,de,pl,ar}.json (Errors keys)"
    - ".planning/brain/wiki/patterns/portal-auth.md"
decisions:
  - "verifyMagicLink keeps the contractor-only `orgs` array byte-identical (existing web-vite login UI untouched) and adds a `subjects` union + employee single-subject auto-login; selectOrg gains an additive subjectType (default CONTRACTOR) + workerId branch. Employee picker wiring is a UI-wave concern."
  - "96-02 tests are unit-level with the existing mock-prisma harness (portal-*.test.ts mock @contractor-ops/db — no live DB); the one-of CHECK is asserted via a rejecting create mock. The full two-subject IDOR is the 96-03 RED net + Wave 4."
requirements_completed: [EMP-PORTAL-01]
completed: 2026-07-05
---

# Phase 96 Plan 02: Subject-discriminated portal session + employee/manager procedures

**One magic-link + cookie now resolves a Contractor OR an employee Worker: `validatePortalSession` returns a discriminated subject, `portalEmployeeProcedure`/`portalManagerProcedure` expose a typed employee/manager ctx (`ctx.workerId`, never `ctx.contractorId`), and the contractor login is a proven regression.**

## Accomplishments

- **Discriminated session service** — `createPortalSession` takes a discriminated union (writes exactly one subject id + `subjectType`, satisfying the DB CHECK); `validatePortalSession` loads both relations in one `findUnique` and branches on `subjectType` (EMPLOYEE rejects soft-deleted worker / TERMINATED profile; CONTRACTOR keeps the ARCHIVED/INACTIVE gate).
- **Employee + manager procedures** — `portalEmployeeAuthMiddleware` rejects non-EMPLOYEE subjects, asserts `module.employee-portal` (FORBIDDEN when dark), and sets `ctx.workerId`/`ctx.worker`/`ctx.employeeProfile` (never `ctx.contractorId`). `portalManagerProcedure` extends it and asserts ≥1 direct report (`EmployeeProfile.managerWorkerId = ctx.workerId`).
- **Magic-link resolution** — `findEmployeesByEmail` (ACTIVE EMPLOYEE workers, TERMINATED/deleted excluded); `requestMagicLink` issues for contractor OR employee; `verifyMagicLink` returns the subject union + auto-logs-in a single subject of the right type; `selectOrg` additively mints an employee session.
- **Contractor regression proven** — `portal-contractor-regression.test.ts` asserts the CONTRACTOR branch payload + status gate are unchanged and no worker/workerId leaks.

## Verification

- `pnpm typecheck` (api, direct tsc) — 0 errors.
- `pnpm --filter @contractor-ops/api test` (portal-session, portal-session-subject, portal-contractor-regression, portal-employee-resolution, portal-magic-link, portal-auth, portal-self-view-sections) — all GREEN (45 tests).
- `pnpm lint:logs` OK; my files have no console.* / silent catches.
- Wiki: `patterns/portal-auth.md` updated (subject discrimination + employee/manager procedures + subject fence invariant) — the drift-bound page for portal-auth.ts/portal-session.ts.

## Notes / deviations

- **Two new error constants** (`employeePortalDisabled`, `portalNotAManager`) added with en/de/pl/ar translations (errors-i18n-parity requires it). en-US omits them, matching the existing portal error keys' pattern (en-US falls back to en).
- **Pre-existing `errors-i18n-parity` RED on main:** 28 errors.ts codes across other themes (payments, tax, api-keys, leave, personnel, public-api) were never added to the locale `Errors` namespace by their originating phases — the test is red on main independent of this plan. My two new keys are compliant; I also filled the one worker-domain gap (`workerNotFound`) since I was editing that namespace. The remaining 27 span Theme A/C + other streams and are out of scope.
