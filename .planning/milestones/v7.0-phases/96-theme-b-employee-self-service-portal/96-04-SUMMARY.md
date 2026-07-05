---
phase: 96-theme-b-employee-self-service-portal
plan: 04
subsystem: api
tags: [portal, employee-portal, trpc, leave, idor, audit, dark-mount]
requirements: [EMP-PORTAL-02]
dependency_graph:
  requires:
    - phase: 96-02
      provides: "portalEmployeeProcedure (ctx.workerId) + module.employee-portal per-request assert"
    - phase: 96-03
      provides: "the RED net portal-employee-idor / portal-timeoff-request"
  provides:
    - "portalEmployee tRPC namespace (dark-mounted): getDashboard, getLeaveBalance, listMyLeaveRequests, getMyTime, getMyEwidencja, submitTimeOffRequest — every read/write scoped to ctx.workerId"
    - "portalTimeOffRequestInput / portalLeaveBalanceQueryInput validators (no workerId, .strict())"
    - "isEmployeePortalRegistered() boot-time dark-mount gate + portalAppRouter spread"
    - "ActorType.EMPLOYEE audit actor (enum + audit-writer type + migration)"
  affects:
    - "96-05 (getMyAkta + getPayStubAvailability merge into portalEmployeeRouter)"
    - "96-07 (employee dashboard UI consumes this namespace)"
tech_stack:
  patterns:
    - "portal write reuses the shared leave services (computeLeaveBalance + routeToLeaveChain + createApprovalFlow) exactly as staff submitLeaveRequest — never the staff workerId-from-input procedure; workerId injected from the session"
    - "self-scoped reads take a `.strict()` (optional) input so a smuggled workerId is a hard rejection, not a silently-ignored field"
    - "dark-mount mirror of conditionalWorkforceRouters on portalAppRouter (isEmployeePortalRegistered); per-request re-assert lives in portalEmployeeAuthMiddleware"
key_files:
  created:
    - "packages/api/src/routers/portal/portal-employee-router.ts"
    - "packages/api/src/middleware/require-employee-portal-flag.ts"
    - "packages/validators/src/portal-employee.ts"
    - "packages/db/prisma/schema/migrations/__portal_employee_actor_type/migration.sql (+ down.sql)"
  modified:
    - "packages/api/src/portal-root.ts"
    - "packages/api/src/routers/portal/index.ts"
    - "packages/api/src/services/audit-writer.ts"
    - "packages/db/prisma/schema/audit.prisma"
    - "packages/db/src/generated/prisma/client/{enums.ts,internal/class.ts}"
    - "packages/validators/src/index.ts"
    - "packages/api/src/routers/portal/__tests__/portal-fixtures.ts"
    - ".planning/brain/wiki/structure/api-routers-catalog.md"
decisions:
  - "SCHEMA CHANGE (flagged): ActorType gained an 'EMPLOYEE' member — an employee-portal actor is neither a Contractor nor a staff User, and the RED net + audit correctness require it. Additive migration __portal_employee_actor_type authored (apply DEFERRED per region, like __portal_employee_subject). PostgreSQL cannot drop an enum value, so down.sql is a documented no-op."
  - "Akta upload (requestAktaUpload/confirmAktaUpload) was re-grouped into 96-05 alongside getMyAkta — the upload is a document/akta operation and shares the personnel-file read model. No RED test drives uploads in this plan; the leave/time reads + time-off write are the tested surface."
  - "The portal time-off write omits the staff notification dispatch (fire-and-forget approver notify); the request enters the approval chain and the manager surface (96-06) polls pending requests. Notification wiring can layer on later without changing the contract."
requirements_completed: []
completed: 2026-07-05
---

# Phase 96 Plan 04: Employee self-service backend (leave + time reads + time-off write)

**Built the `portalEmployee` tRPC namespace — self-scoped leave-balance / leave-request / time / ewidencja reads and a time-off write that reuses the shipped leave services under an EMPLOYEE-actor audit — flipping the 96-03 employee-IDOR and time-off RED tests GREEN. The surface is dark behind `module.employee-portal`.**

## Accomplishments

- **`portalEmployeeRouter`** — `getDashboard` (balance + pending-leave + recent-time aggregate), `getLeaveBalance` (ledger sum via `computeLeaveBalance`), `listMyLeaveRequests`, `getMyTime` (employeeTimeRecord), `getMyEwidencja` (ewidencjaSnapshot), and `submitTimeOffRequest`. Every `where` carries `{ workerId: ctx.workerId, organizationId: ctx.organizationId }`; no procedure takes a client `workerId`.
- **Time-off write reuses the shared services** — inside one `$transaction`: worker/leaveType/blackout guards, `computeLeaveBalance` insufficient-balance guard, `routeToLeaveChain` + `createApprovalFlow` (the same services staff `submitLeaveRequest` uses), `leaveRequest.create` with `workerId: ctx.workerId`, and `writeAuditLog({ actorType:'EMPLOYEE', actorId: ctx.workerId, ... , tx })`.
- **Validators** — `portalTimeOffRequestInput` (the staff shape minus `workerId`/`teamId`, `.strict()` + start≤end refine) and `portalLeaveBalanceQueryInput` (`leaveTypeId`, `year?`, `.strict()`).
- **Dark-mount** — `isEmployeePortalRegistered()` mirrors `isWorkforceRegistered()`; `portalAppRouter` spreads `portalEmployee` only when registered (else `METHOD_NOT_FOUND`). `portalEmployeeProcedure` re-asserts the flag per request (FORBIDDEN when dark).
- **ActorType.EMPLOYEE** — new enum member + audit-writer type + `__portal_employee_actor_type` migration (apply deferred).

## Verification

- `pnpm typecheck --filter=@contractor-ops/api` — 0 errors (after regenerating the Prisma client for the new enum + rebuilding the db dist). `--filter=@contractor-ops/validators` green.
- `pnpm --filter @contractor-ops/api test portal-employee-idor portal-timeoff-request` — 9/9 GREEN (the two-employee IDOR fence + session-derived audited time-off). The remaining RED-net files (akta, pay-stub, manager, gating) belong to 96-05/06.
- No regression: 110/115 in the existing portal + audit suites pass; the 5 failures are **pre-existing 96-02 test debt** in `portal.test.ts` (its `portal-magic-link` mock lacks `findEmployeesByEmail`, a 96-02 addition) — unrelated to this plan's files.
- `pnpm exec biome check` on the changed files — clean. `pnpm lint:audit-log` + `pnpm lint:no-breadcrumbs` (my files) green.
- Wiki: `structure/api-routers-catalog.md` updated (portalEmployee namespace + dark-mount + IDOR note; `verify_with` binds `portal-root.ts` which this plan changed). The employee-portal domain page + full refresh pipeline (BM25/graph) land in 96-09.

## Notes / deviations

- **ActorType.EMPLOYEE is a schema change** — flagged per the handoff (which expected no new schema). It is additive + deferred-apply, and load-bearing for the audit trail + the RED net.
- **Fixture extended** (`portal-fixtures.ts`, from 96-03): leave types now `active:true`, a leave-ledger ACCRUAL is seeded per worker so the balance guard passes, time entries carry `workedMinutes`, and the mock-prisma maps the real model names (`employeeTimeRecord`, `ewidencjaSnapshot`) so the self-scoped reads are meaningful.
- **`check:wiki-brain`** currently errors only on a missing local BM25 index (a gitignored artifact in the fresh worktree — WARN-only per CLAUDE.md); the doc-drift binding for `portal-root.ts` is satisfied by the api-routers-catalog update. The BM25/graph rebuild is 96-09's refresh pipeline.
