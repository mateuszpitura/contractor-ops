---
title: Employee self-service portal
type: domain
tags: [portal, employee-portal, self-service, manager, reporting-line, idor, leave, akta, feature-flags]
source_commit: e0d533fa
verify_with:
  - packages/api/src/routers/portal/portal-employee-router.ts
  - packages/api/src/routers/portal/portal-employee-akta.ts
  - packages/api/src/routers/portal/portal-manager-router.ts
  - packages/api/src/routers/portal/portal-self-view-sections.ts
  - packages/api/src/services/portal-reports.ts
  - packages/api/src/middleware/portal-auth.ts
  - packages/api/src/services/portal-session.ts
  - packages/api/src/portal-root.ts
  - packages/validators/src/portal-employee.ts
  - packages/validators/src/portal-manager.ts
  - apps/web-vite/src/components/portal/employee/hooks/use-employee-dashboard.ts
updated: 2026-07-10
---

# Employee self-service portal

## Purpose

The **same external portal shell** the contractor uses now also serves the
**employee** subject: a worker signs in with a magic link and sees their own
leave balance + requests, recorded time + ewidencja, personnel-file (akta)
documents, and a pay-stub pointer — plus, for a line manager, a `/team` surface
to approve/reject their direct reports' leave. It reuses the shipped leave /
personnel-file / approval services; it never re-implements policy.

## Flow

1. **Magic link → subject-discriminated session.** `findEmployeesByEmail` resolves
   an ACTIVE employee by email alongside `findContractorsByEmail`; the portal
   session row carries a **discriminated subject** (`subjectType` CONTRACTOR |
   EMPLOYEE, with a DB one-of CHECK — a Contractor XOR a Worker, never both).
2. **Per-request auth.** `portalEmployeeProcedure` (in `middleware/portal-auth.ts`)
   validates the session, requires `subjectType === 'EMPLOYEE'`, asserts
   `module.employee-portal` for the org, and attaches `ctx.workerId` /
   `ctx.worker` / `ctx.employeeProfile` — **never `ctx.contractorId`**.
   `portalManagerProcedure` extends it and asserts the caller has ≥1 direct
   report (else FORBIDDEN — a non-manager sees no manager surface).
3. **Dark-mount.** `portalEmployee` + `portalManager` are spread onto
   `portalAppRouter` only when `isEmployeePortalRegistered()` (METHOD_NOT_FOUND at
   boot when the flag is unregistered); the procedures re-assert the flag per
   request (FORBIDDEN when dark).
4. **UI.** `/portal/employee/*` (dashboard, leave, time, documents, pay) and
   `/portal/employee/team/*` (overview, approvals) render inside the portal shell;
   the tRPC boundary is the `components/portal/employee/**/hooks/use-*.ts` hooks.

## Entry points

- **Backend:** `portalEmployeeRouter` (`getDashboard`, `getLeaveBalance`,
  `listMyLeaveRequests`, `getMyTime`, `getMyEwidencja`, `submitTimeOffRequest`,
  `getMyAkta`, `getMyAktaDocumentUrl`, `getPayStubAvailability`) +
  `portalManagerRouter` (`getTeamOverview`, `listReportLeaveRequests`,
  `approveReportLeaveRequest`, `rejectReportLeaveRequest`). See
  [[structure/api-routers-catalog]].
- **Reporting-line scope:** `services/portal-reports.ts`
  (`resolveDirectReports` / `assertIsDirectReport`) — see [[structure/key-services]].
- **UI:** `apps/web-vite/src/components/portal/employee/**` +
  `pages/portal/employee/**` — see [[structure/web-vite-domains]].

## Security invariants

- **An employee is NOT a Contractor.** Never synthesize a Contractor for a worker;
  the session subject is discriminated and the middleware attaches a `workerId`,
  not a `contractorId`.
- **Session-scoped only.** Every read/write is scoped to `ctx.workerId` +
  `ctx.organizationId` from the SESSION; no procedure accepts a client `workerId`
  (self-reads are `.strict()` so a smuggled id is a hard rejection).
- **Self-view section allowlist.** `getMyAkta` filters to
  `PERSONNEL_FILE_SELF_VIEW_SECTIONS` (A/B/D) **in the query** — section C
  (pay/national-PII) rows never load; the download resolver re-checks own-file +
  allowlist before signing.
- **Manager reporting-line fence.** A manager acts only on direct reports:
  reports are resolved server-side from `EmployeeProfile.managerWorkerId =
  ctx.workerId` (same org, enforced because the reference is not an FK); every
  mutation re-derives the request's own workerId and calls `assertIsDirectReport`
  before the shared approval transition (`closeLeaveFlowAsApproved` →
  `finalizeApprovedLeave`, PENDING-guarded + idempotent) under an
  `EMPLOYEE`-actor audit.
- **Pay stubs are external in v7.0.** `getPayStubAvailability` returns
  `{ available:false, reason:'EXTERNAL_PAYROLL' }` — payroll is export-only, there
  is no payslip model to fabricate a stub from.
- **Portal traffic gets the strict rate-limit tier.** Portal tRPC
  (`/api/trpc/portal/*`) is matched by the `portalLimiter` (10/min) via the
  `usesPortalLimiter()` selector in `apps/api/src/plugins/rate-limit.ts` — not
  the general 60/min `apiLimiter`.
- **Magic-link requests are throttled per email, not just per IP.**
  `requestMagicLink` carries a 5-requests / 15-min throttle keyed on the hashed
  email, fail-closed
  (`packages/api/src/middleware/magic-link-rate-limit.ts`) — bulk email-bombing
  via the magic-link endpoint is capped independently of source IP.
- **Credit-burning portal procedures are capped per subject.**
  `portalSubjectRateLimitMiddleware`
  (`packages/api/src/middleware/portal-rate-limit.ts`) caps 10/min per portal
  subject on the portal OCR trigger (`portalTrigger` in
  `packages/api/src/routers/core/ocr.ts`) and e-sign URL minting
  (`getPortalSigningUrl` in `packages/api/src/routers/core/esign.ts`) — both
  drain org credits / QStash and must not be burnable by one contractor.
- Rate-limit error copy has locale keys in all 4 languages (`magicLink*` /
  `portal*` keys).

## UI surface

Employee: dashboard (summary + composed sections), leave (balance + own requests
+ a validated time-off dialog, no `workerId`), time (recorded time + ewidencja),
documents (akta by self-view section with signed per-document downloads), pay
(truthful unavailable empty state). Manager `/team`: overview (reports +
pending-leave counts) + approvals (approve/reject with a reason dialog). A dark
surface or wrong subject degrades to a real unavailable/forbidden state, never a
crash (`isModuleDarkError`).

## Agent mistakes

- Treating an employee session as a contractor (adding `ctx.contractorId`, calling
  `portalProcedure`) — the shell's `portal.auth.getSession` is contractor-only; an
  employee-subject shell bootstrap is a separate foundational wiring step.
- Accepting a client `workerId`/report id — always derive the subject from the
  session and validate a target against the reporting-line edge.
- Surfacing section C in the self-view or fabricating a pay stub.
- Re-implementing leave approval instead of reusing `finalizeApprovedLeave`.
