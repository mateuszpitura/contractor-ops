# Phase 96: Theme B — Employee Self-Service Portal - Research

**Researched:** 2026-07-05
**Domain:** Extend the shipped v2.0 contractor portal (magic-link + subdomain + cookie session) so a `Worker(workerType='EMPLOYEE')` and their line manager self-serve through new `/portal/employee/*` routes: leave balance + time-off request, employee-time/ewidencja view, entitlement-scoped personnel-file (akta) view, a pay-stub surface (graceful-unavailable in v7.0), and a manager view of direct reports' approvals + document-expiry flags. Reuses the P90–94 backends; adds ONE genuinely new invariant surface — a **subject-discriminated portal session** — plus the **manager reporting-line edge** and an **employee self-view entitlement**, all fenced by a two-employee IDOR test.
**Confidence:** HIGH (every reuse seam read at source at current HEAD; five CONTEXT / decision assumptions corrected against live code — see Corrections).

## Summary

Phase 96 is a **reuse-the-surface, extend-the-identity** phase. The portal shell, magic-link flow, cookie session, tenant scoping, `portalProcedure`, per-org region routing, and the web-vite portal route table all exist and were read at source. The phase adds new **read/write portal procedures** that wrap the already-built P91/P92 domain services under portal auth scoped to the session subject, plus the web-vite UI. The one load-bearing new thing is that the current portal session **only knows how to be a Contractor** — every downstream design decision hangs off how an EMPLOYEE subject is authenticated. This research resolves that decision (§ The Load-Bearing Decision) and corrects four CONTEXT assumptions that would otherwise brick an executor.

Reuse seams verified at source:

- **The portal session is a cookie → `PortalSession` row → `ctx.contractorId`.** `portalAuthMiddleware` parses the `portal_session` cookie, calls `validatePortalSession(rawToken)`, resolves the org's region, opens a tenant-scoped regional client, and attaches `ctx.portalSession / contractorId / organizationId / contractor / region / db` inside `tenantStore.run` `[VERIFIED: packages/api/src/middleware/portal-auth.ts:42-89]`. `portalProcedure = publicProcedure.use(portalAuthMiddleware).use(demoReadOnly)` `[VERIFIED: :109]`; `portalPublicProcedure = publicProcedure` `[VERIFIED: :100]`.
- **`validatePortalSession` is Contractor-only.** It looks up the session by hashed token, `include: { contractor: true }`, and rejects when the contractor is `ARCHIVED`/`INACTIVE` `[VERIFIED: packages/api/src/services/portal-session.ts:69-86]`. `createPortalSession` writes a row with a **required** `contractorId` `[VERIFIED: :39-63]`.
- **`PortalSession.contractorId` is a required FK to `Contractor`** (`contractor Contractor @relation(...)`), a **global** (non-tenant-scoped) model `[VERIFIED: packages/db/prisma/schema/portal.prisma:4-23]`. There is no `workerId`, no subject discriminator.
- **Magic-link resolution is Contractor-only.** `requestMagicLink` calls `findContractorsByEmail(email)` (ACTIVE, non-deleted contractors, with org) and issues a token only if ≥1 match `[VERIFIED: packages/api/src/routers/portal/portal-auth-router.ts:31-51; packages/api/src/services/portal-magic-link.ts:86-103]`. `verifyMagicLink`/`selectOrg` mint the session via `createPortalSession(...)` + an HMAC-signed cookie-set signal `[VERIFIED: portal-auth-router.ts:121-178]`.
- **`portalAppRouter` is a two-namespace surface** (`portal`, `portalTime`) mounted at `/api/trpc/portal`, deliberately split from the staff `appRouter` for TS inference cost `[VERIFIED: packages/api/src/portal-root.ts:14-17]`. The self-scoping precedent is `portal.complianceItems` — a `portalProcedure` query filtered strictly to `ctx.contractorId` + `ctx.organizationId`, "no client-supplied id is trusted" `[VERIFIED: packages/api/src/routers/portal/portal-profile-router.ts:389-410]`. The audit precedent is `portal.recordEdeliveryConsent` — `writeAuditLog({ actorType: 'CONTRACTOR', actorId: ctx.contractorId, ... })` `[VERIFIED: packages/api/src/routers/portal/portal-tax-1099-router.ts:91-109]`.
- **The employee data surfaces are shipped, staff-side, behind `module.workforce-employees`.** `workforceRouters = { employeeRegistry, personnelFile, leave, employeeTime, ewidencja, ... }` are mounted only when `isWorkforceRegistered()` (the module flag), otherwise an empty object `[VERIFIED: packages/api/src/root.ts:185-196,262]`. They are all `tenantProcedure` + `requirePermission({ employee: [...] })` (staff RBAC) `[VERIFIED: packages/api/src/routers/workforce/leave.ts:71-72]` — NOT portal procedures.
- **The leave domain services are reusable verbatim.** `submitLeaveRequest` (staff) routes through `createApprovalFlow` + `routeToLeaveChain`, computes balance with `computeLeaveBalance`, and audit-logs in-transaction `[VERIFIED: leave.ts:108-120,31-34]`; approve/reject is delegated to the shared, `resourceType`-gated approval procedures so a leave approver never gains `invoice:approve` (the BFLA fence) `[VERIFIED: leave.ts:3-8]`; the approval transition writes a `leaveLedgerEntry` DEDUCTION `[VERIFIED: packages/api/src/routers/core/approval-shared.ts:337-355]`. `computeLeaveBalance` takes `{ jurisdiction, leaveKind, tenureYears, etat }` `[VERIFIED: packages/api/src/services/leave-balance.ts:31-44]`.
- **The personnel-file section gate is staff-role-based.** `hasSectionPermission(ctx, section)` maps `SECTION_A..D → employeeFileA..D` Better-Auth resources and returns whether the caller's **server-side session role** (or API-key scopes) grants `read` — a portal subject has neither `[VERIFIED: packages/api/src/routers/core/personnel-file/section-access.ts:22-83]`. Documents link into exactly one `PersonnelFileSection` via `PersonnelFileDocument.section` `[VERIFIED: packages/db/prisma/schema/personnel.prisma:20-79]`.
- **The web-vite portal is a single authenticated shell + a flat route table.** Public routes `portal/login`, `portal/login/verify` sit outside the shell; the authenticated shell (`PortalShellContainer`, loader `requirePortalAuth`) wraps `portalRoutes` — a flat array of `portal`, `portal/settings`, `portal/equipment`, `portal/time`, `portal/documents`, … `[VERIFIED: apps/web-vite/src/router.tsx:146-157; apps/web-vite/src/router/portal-routes.tsx:31-50]`. Hooks are the sole tRPC boundary (`usePortalTRPC`) `[VERIFIED: apps/web-vite/src/components/portal/hooks/use-portal-equipment.ts:1-16]`.
- **The `module.workforce-employees` flag exists** (category `module`, `default:false`, owner `workforce-platform`, ship-dark, signoff PENDING→APPROVED) `[VERIFIED: packages/feature-flags/src/flags-core.ts:230-238]`. It gates the STAFF workforce routers.

**The single most important finding — the portal identity is Contractor-shaped end to end, and an employee is not a Contractor.** `PortalSession.contractorId` is a required FK, `validatePortalSession` hard-includes `contractor`, and every portal procedure reads `ctx.contractorId`. An employee is a `Worker(workerType='EMPLOYEE')` with an `EmployeeProfile` sidecar — a different table, no `Contractor` row. D-01 (CONTEXT) chose the **unified, subject-discriminated session**: one magic-link, one cookie, one login, resolving *either* a Contractor *or* an Employee. This research confirms that is the right call and specifies the exact schema + middleware shape to make it real (§ The Load-Bearing Decision) — a nullable `contractorId` + a new nullable `workerId` + a `subjectType` discriminator + a one-of CHECK constraint, a discriminated `validatePortalSession` return, and a new `portalEmployeeProcedure` / `portalManagerProcedure` that expose `ctx.workerId` (never `ctx.contractorId`) to employee handlers. The contractor path is byte-for-byte preserved (regression-tested).

**The second finding — three of the "reuse P90–95" seams the CONTEXT names do not yet exist and must be built here (see Corrections C2–C4):** the manager→direct-reports **reporting-line edge** is nowhere in the schema (only `Team.managerUserId → User`, a staff user); there is **no Payslip/pay-stub model** (P94 is export-only), so the pay-stub widget is a graceful-unavailable state, not a data read; and the personnel-file **self-view entitlement** for a non-staff subject does not exist (the section gate reads a staff role). Each is small, but an executor who assumes they are already shipped will fail.

**Primary recommendation:** (Wave 1) DB + flag + reporting-line + self-view-allowlist foundation; (Wave 2) the subject-discriminated portal session + `portalEmployee`/`portalManager` procedures + magic-link employee resolution; (Wave 3) the RED net — two-employee IDOR, manager-non-report IDOR + cross-org, leave-from-portal session-scoping, entitlement-scoped akta, pay-stub-unavailable, dark-flag gating; (Wave 4) the employee-self + manager backend routers that flip the RED net GREEN; (Wave 5) the employee + manager dashboard UI; (Wave 6) 5-locale i18n parity, nav wiring, docs-follow-code, graph/BM25.

## Corrections to CONTEXT (verified against live code — an executor MUST heed)

| # | CONTEXT / decision claim | Reality at HEAD | Consequence |
|---|--------------------------|-----------------|-------------|
| C1 | D-01 / D-07: "extend the existing contractor resolution … portal session isolated from staff `tenantProcedure`." | Correct in spirit; the session is **Contractor-shaped at the row + validate + middleware level** — `PortalSession.contractorId` is a required FK `[VERIFIED: portal.prisma:7,16]`, `validatePortalSession` hard-`include`s `contractor` and rejects on `contractor.status` `[VERIFIED: portal-session.ts:74-83]`, `portalAuthMiddleware` sets `ctx.contractorId = session.contractorId` unconditionally `[VERIFIED: portal-auth.ts:80]`. | The extension is a **schema + service + middleware change**, not just a router add. Make `contractorId` nullable, add nullable `workerId` + a `subjectType` (`CONTRACTOR`\|`EMPLOYEE`) discriminator + a one-of CHECK constraint; branch `validatePortalSession` on the discriminator; add `portalEmployeeProcedure` that sets `ctx.workerId` and never `ctx.contractorId`. Plans 96-01 (schema) + 96-02 (service/middleware). |
| C2 | D-03 / code-context: "reporting-line edge on `EmployeeProfile` (P90)" resolves direct reports. | **No such edge exists.** `EmployeeProfile` has no `managerId`; `Worker` has no manager/reports relation `[VERIFIED: employee.prisma:12-63; worker.prisma:17-45]`. The only manager relation in the schema is `Team.managerUserId → User` — a **staff** user, not a portal employee `[VERIFIED: organization.prisma:227-238]`. | Plan 96-01 **adds** the reporting-line edge: a nullable self-relation `managerWorkerId` on `EmployeeProfile` (FK → `Worker.id`, same-org, indexed) — a manager is an employee some other employee's `managerWorkerId` points at. Direct reports = `EmployeeProfile where managerWorkerId = <caller's workerId>`, server-derived (D-03). Not a Prisma-only add — a migration + `db:generate`. |
| C3 | Scope / EMP-PORTAL-02: "pay stubs (where payroll-integrated)" from P94. | **P94 ships no per-employee pay-stub / payslip model.** It is an **export-only** adapter engine (`packages/payroll`, `PayrollExportProfile`) that pushes employee master-data to Symfonia/DATEV/Sage/Gusto/QuickBooks/ADP; the external system computes + owns the payslip `[VERIFIED: .planning/milestones/v7.0-phases/94-theme-b-payroll-integration-adapters/94-CONTEXT.md:6-27]`. | The pay-stub widget has **no data surface in v7.0**. Per D-02 it renders a real **"pay stubs live in your payroll system / unavailable"** empty state gated on the payroll flag — never a crash, never fabricated stubs. The RED net asserts the unavailable state, not a stub read. Plans 96-05 (read model returns `available:false`) + 96-07 (UI empty state). |
| C4 | D-03 / EMP-PORTAL-02: employee "personal akta view" reuses the P91 read + the section gate. | The P91 section gate `hasSectionPermission` derives the grant from a **staff session role** (`ctx.session.activeRole`) or API-key scopes — a portal subject has neither `[VERIFIED: section-access.ts:63-83]`. Reusing it verbatim for a portal employee returns `false` for every section (no role). | The portal self-view needs a **new, server-fixed self-view entitlement**: an employee reads documents in **their own** `PersonnelFile` (workerId from session), filtered to a conservative **self-view section allowlist** (`PERSONNEL_FILE_SELF_VIEW_SECTIONS`), never a client-supplied workerId or section. Section C (pay/PII) is excluded by default; the allowlist is one constant, legal-review-flagged. Plans 96-01 (allowlist constant) + 96-05 (read). |
| C5 | D-04: writes "reuse the same P91/P92 domain mutation." | The staff `leave.submitLeaveRequest` takes `workerId` **from client input** on a `tenantProcedure` with `employee:update` RBAC `[VERIFIED: leave.ts:108-120; packages/validators/src/leave.ts submitLeaveRequestInput has workerId]`. A portal employee must NOT be able to submit for another worker. | The portal time-off procedure takes a **session-scoped input WITHOUT `workerId`** (derived from `ctx.workerId`) and calls the shared services (`computeLeaveBalance`, `createApprovalFlow`, `routeToLeaveChain`) directly — it reuses the domain **services**, not the staff procedure. The two-employee IDOR test proves a portal caller cannot inject another workerId. Plan 96-04. |

## User Constraints (from CONTEXT.md)

### Locked Decisions (carried from CONTEXT — re-verified, not re-litigated)
- **D-01 (EMP-PORTAL-01):** Unified portal-user, **role/subject-discriminated session**. One magic-link + subdomain + login resolves a Contractor **or** an Employee; the session carries subject-type + role; `/portal/employee/*` + manager views gate on it. Extend `findContractorsByEmail` to also resolve employees — do not stand up a parallel employee auth app. Manager = an employee with reports (D-03). **This research specifies the exact schema/middleware shape (§ The Load-Bearing Decision).**
- **D-02:** Per-widget flag-gate + real empty/disabled state. Each widget (pay stubs, leave balance, time-off, upload, akta, doc-expiry, reports-to-approve) is independently gated on its surface's flag/module; a dark surface renders a real unavailable state; the portal ships even if P91–95 are partially live. **Pay stubs are always unavailable in v7.0 (C3).**
- **D-03 (EMP-PORTAL-03):** Reporting-line edge + server-side scope + reuse the approvals authorization path. Every manager read/approval is server-side scoped to the caller's own reports; report ids are never taken from client input. **Correction C2:** the edge is *built here*; the approval *authorization* for a portal manager is the reporting-line edge (a portal subject is not a staff `leave_approver` User), while the approval *transition* reuses the shared approval-shared state machine + ledger write. Mandatory two-subject IDOR test.
- **D-04:** Writes reuse existing domain **services** through portal-scoped procedures: employee time-off request + document upload; manager leave approve/reject + time-entry approve. Each under portal auth + `writeAuditLog`. Everything else (balances, akta, expiry flags, pay stubs) is read-only. **Correction C5:** wrap the services, not the staff procedures; derive workerId from the session.
- **D-05:** i18n parity en / pl / de / ar (RTL) / en-US via the existing portal i18n + `i18n:parity` + hardcoded-string check; formal-Sie (de). RTL verified for the new routes. Parity is a gate, not advisory. Native review deferred (EXTERNAL-ENABLEMENT #9).
- **D-06:** Whole surface gated on a `module.*` flag (default off); tenant `organizationId`/region from session; `writeAuditLog` on every portal write; Zod `.strict()` on portal procedures; portal session isolated from staff `tenantProcedure`. **Resolved (§ Open Q1):** a dedicated `module.employee-portal` flag is the portal gate, layered on `module.workforce-employees` as the Theme-B data prerequisite.
- **D-07:** Extend the v2.0 portal — reuse `PortalShell` / `PortalShellContainer`, `requirePortalAuth`, `portalAppRouter`; web-vite portal layering (page → wired section → hook = sole tRPC boundary → presentational).
- **D-08:** UI to standard — `frontend-design` + impeccable, WCAG, mandatory loading/empty/error. Documentation-follows-code: new portal routes/hooks/procedures → domain wiki + `structure/web-vite-domains.md` + `structure/api-routers-catalog.md` + portal domain page in the same change set.

### Claude's Discretion (resolved in this research)
- Route shape → resolved: `/:locale/portal/employee/*` inside the existing authenticated `PortalShell` (Open Q2). Not a new shell.
- Widget → flag mapping → resolved: mapping table in § Widget Gating Map.
- Manager view placement → resolved: a distinct route group `portal/employee/team/*` (not a role-toggled inline section) so the manager surface can be permission-loaded independently and IDOR-tested in isolation (Open Q3).
- Pay-stub read-model shape → resolved: a `{ available: false, reason: 'EXTERNAL_PAYROLL' }` read model in v7.0 (C3), forward-compatible with a future payslip surface.
- Akta read reuse → resolved: a new self-view read filtered by session workerId + `PERSONNEL_FILE_SELF_VIEW_SECTIONS` (C4).
- Portal-auth session-shape change → resolved: discriminated-subject columns on `PortalSession` + `subjectType` (§ The Load-Bearing Decision, Option A).

### Deferred Ideas (OUT OF SCOPE)
- Org-wide HR dashboard (headcount / vacation-utilization / doc-expiry / probation / Gulf rollup) → **Phase 97 (STAFF side). Do not plan it here.**
- Widgets for surfaces P90–95 do not deliver → appear only when the surface + flag land.
- A live in-app payslip surface → future (external payroll owns it in v7.0).
- Contractor-side portal changes beyond the shared auth extension → out; the contractor path is preserved unchanged.
- e-ZLA/eAU sick-leave auto-pull, benefits enrollment → later milestones.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support | Plan |
|----|-------------|------------------|------|
| EMP-PORTAL-01 | Employee portal extends the v2.0 contractor portal (magic-link auth, subdomain routing, `/employee/*` routes) | Subject-discriminated `PortalSession` (nullable `contractorId` + `workerId` + `subjectType` + one-of CHECK) `[VERIFIED: portal.prisma:4-23; portal-session.ts:69-86; portal-auth.ts:42-89]`; `findEmployeesByEmail` extends resolution `[VERIFIED: portal-magic-link.ts:86-103]`; `/portal/employee/*` in the existing shell `[VERIFIED: portal-routes.tsx:31-50]` | 96-01, 96-02, 96-07 |
| EMP-PORTAL-02 | Employee dashboard — pay stubs (where payroll-integrated), leave balance, time-off request, document upload, personal akta view | Portal-scoped procedures wrapping `computeLeaveBalance` + `createApprovalFlow`/`routeToLeaveChain` `[VERIFIED: leave.ts:31-34,108-120; leave-balance.ts:31-44]`, employee-time/ewidencja reads, `PendingUpload` server-key upload `[VERIFIED: portal.prisma:97-116]`, self-view akta (C4), pay-stub-unavailable (C3) | 96-04, 96-05, 96-07 |
| EMP-PORTAL-03 | Manager dashboard — direct reports' leave requests, time entries to approve, document-expiry flags | New `managerWorkerId` reporting-line edge (C2); server-scoped reports read; approve/reject via the shared approval-shared state machine + ledger `[VERIFIED: approval-shared.ts:337-355]`; two-subject IDOR fence (D-03) | 96-01, 96-06, 96-08 |
| EMP-PORTAL-04 | Portal i18n parity — en/pl/de/ar/en-US (Arabic RTL v4.0, formal-Sie v5.0) | Existing portal i18n + `i18n:parity` + hardcoded-string check `[VERIFIED: apps/web-vite/src/i18n/*]`; RTL shell already ships; en canonical, de/pl machine-assisted, native review deferred (EXTERNAL-ENABLEMENT #9) | 96-07, 96-08, 96-09 |

## The Load-Bearing Decision — how an EMPLOYEE authenticates on the portal

The portal session is Contractor-shaped end to end (C1). Three ways to make an EMPLOYEE a first-class portal subject:

### Option A — Extend `PortalSession` to a discriminated subject (RECOMMENDED, = D-01)
One `PortalSession` table, one cookie, one middleware. Make `contractorId` **nullable**, add nullable `workerId` + a `subjectType` (`CONTRACTOR`\|`EMPLOYEE`) column + a DB **CHECK constraint** `(subjectType='CONTRACTOR' AND contractorId IS NOT NULL AND workerId IS NULL) OR (subjectType='EMPLOYEE' AND workerId IS NOT NULL AND contractorId IS NULL)` (raw SQL in the migration — Prisma cannot express a multi-column CHECK, same posture as the P95 partial-index correction). `validatePortalSession` branches on `subjectType`: contractor branch unchanged (`include: { contractor }`, status gate); employee branch loads the `Worker` + `EmployeeProfile` and rejects when `Worker.deletedAt` or `EmployeeProfile.employmentStatus='TERMINATED'`. `portalAuthMiddleware` sets `ctx.subjectType` + either `ctx.contractorId` (contractor) or `ctx.workerId` (employee), never both. A new `portalEmployeeProcedure = publicProcedure.use(portalEmployeeAuthMiddleware)` narrows the ctx type so an employee handler can only see `ctx.workerId`; a `portalManagerProcedure` further asserts the caller has ≥1 report. Magic-link `requestMagicLink` calls `findContractorsByEmail` **and** a new `findEmployeesByEmail`; `verifyMagicLink` returns the union of subjects for the org-picker.

- **Pros:** exactly D-01; one login/cookie/subdomain; the contractor path is preserved (the CHECK + nullable column is additive, existing rows are all `subjectType='CONTRACTOR'` via a backfill default); the smallest set of new concepts; the IDOR fence is one middleware to reason about; the `portalAppRouter` stays one router.
- **Cons:** touches the security-critical session table + validate + middleware (mitigated: additive migration + a contractor-path regression test as an explicit acceptance criterion in 96-02); a nullable-FK + CHECK invariant (mitigated: the CHECK is DB-enforced, unit + integration tested).
- **Verdict:** RECOMMENDED. It is D-01, it is minimal, and it keeps a single auditable IDOR boundary.

### Option B — A parallel `EmployeePortalSession` + parallel middleware
A second table, a second cookie (`employee_portal_session`), a second `portalEmployeeAuthMiddleware`, a second magic-link path.

- **Pros:** total isolation of the employee session from the contractor session; no change to the existing contractor row/validate.
- **Cons:** duplicates the magic-link + session + cookie + region-routing infra; two cookies + two login entry points contradict D-01 ("one portal, one magic-link + subdomain, one login"); two IDOR surfaces to audit; a shared email that is both a contractor and an employee needs cross-table reconciliation anyway. **Rejected by D-01 + the maintenance cost.**

### Option C — Reuse the contractor session by linking Contractor ↔ Worker
Attach employees to a synthetic Contractor row or a Contractor↔Worker bridge and keep `ctx.contractorId`.

- **Cons:** an employee is definitionally **not** a contractor (`workerType` is the whole point of the P89 Worker abstraction); a synthetic Contractor pollutes contractor lists, invoicing, 1099/tax surfaces, and RLS; every employee read would have to re-derive the real `workerId` anyway. **Rejected — corrupts the domain model.**

**Recommendation: Option A**, precisely as D-01 specified. The rest of this research and every plan assume Option A.

### The employee-IDOR fence (the load-bearing security invariant)
Every employee-scoped read/write derives its subject from `ctx.workerId` (set by the middleware from the validated session) and **never** from client input. Concretely:
- Employee reads/writes: `where: { workerId: ctx.workerId, organizationId: ctx.organizationId }`. No procedure in the employee surface accepts a `workerId` argument. The time-off input omits `workerId` (C5).
- Manager reads/writes: the caller's reports are `EmployeeProfile.findMany({ where: { managerWorkerId: ctx.workerId, organizationId: ctx.organizationId } })`, server-derived; a manager action on a target worker first asserts `target.managerWorkerId === ctx.workerId` (and same org) before any state change. A report id supplied by the client is validated against that set, never trusted.
- Cross-org: `organizationId` comes from the session's org (via `tenantStore.run`), so a token minted for org A can never read org B — the two-employee IDOR test includes a cross-org case.
- The RED net (96-03) proves: employee A cannot read employee B's balance/akta/time; a manager cannot read or approve for a non-report; a cross-org subject reads nothing; a portal caller cannot inject a `workerId`; the whole surface is `METHOD_NOT_FOUND`/404 when `module.employee-portal` is OFF.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|------------|--------------|-----------|-----------|
| Subject-discriminated session (row + validate + middleware) | DB (`portal.prisma` migration) + API (`portal-session.ts`, `middleware/portal-auth.ts`) | — | The EMP-PORTAL-01 crux; the single IDOR boundary; additive + regression-fenced. |
| Reporting-line edge | DB (`employee.prisma` migration) + API (reports resolver) | — | New `managerWorkerId` self-relation (C2); server-derived reports. |
| Employee self-view entitlement | API (`PERSONNEL_FILE_SELF_VIEW_SECTIONS` + read) | — | New conservative allowlist (C4); own-file-only, section-filtered. |
| Employee-self reads + writes | API portal router (`routers/portal/portal-employee-router.ts`) | Domain services (`leave-balance`, `approval-engine`, `employee-time`) | Wrap the shipped services under portal auth scoped to `ctx.workerId` (D-04, C5). |
| Manager reads + approvals | API portal router (`routers/portal/portal-manager-router.ts`) | `approval-shared` state machine + ledger | Server-scoped to reports; reuse the approval transition, authorize by the edge (D-03). |
| Pay-stub availability | API read model (`{ available:false }`) | — | No payslip surface in v7.0 (C3); graceful-unavailable (D-02). |
| Flag gate | Feature-flags (`module.employee-portal` + per-widget) | API middleware + web-vite `useFlag` | D-06; dedicated portal flag on top of `module.workforce-employees`. |
| Employee + manager dashboard UI | Client (`apps/web-vite/src/pages/portal/employee/*` + `components/portal/employee/*`) | — | Page → wired section → hook (sole tRPC boundary) → presentational; loading/empty/error + i18n. |

## Standard Stack (all in-tree — NO new external packages)

| Library / module | Path | Purpose |
|------------------|------|---------|
| Portal auth | `packages/api/src/middleware/portal-auth.ts`, `services/portal-session.ts`, `services/portal-magic-link.ts` | The session/middleware/magic-link to extend (Option A). |
| Portal router surface | `packages/api/src/portal-root.ts`, `routers/portal/*` | Add `portalEmployee` + `portalManager` namespaces; self-scoping + audit precedents (`portal-profile-router.ts:389-410`, `portal-tax-1099-router.ts:91-109`). |
| Leave services | `packages/api/src/services/leave-balance.ts`, `services/approval-engine.ts`, `routers/core/approval-shared.ts` | `computeLeaveBalance`, `createApprovalFlow`, `routeToLeaveChain`, the approval transition + ledger. |
| Employee-time / ewidencja | `packages/api/src/routers/workforce/{employee-time,ewidencja}.ts` | The read shapes to expose read-only to the owner. |
| Personnel file | `packages/api/src/routers/core/personnel-file/{read,section-access}.ts` | Section enum + document link; the self-view read reuses the store, not the staff gate (C4). |
| Upload | `packages/db/prisma/schema/portal.prisma` `PendingUpload` (`PORTAL_DOC_VERSION`) | Server-generated storage key — no client-supplied `storageKey` (the F-SEC-01 posture). |
| Feature flags | `packages/feature-flags/src/flags-core.ts`, `signoff-registry-flags.*` | `module.workforce-employees` (exists) + new `module.employee-portal`; per-widget flags. |
| Audit | `packages/api/src/services/audit-writer.ts` | `writeAuditLog({ actorType, actorId: ctx.workerId, ... })` on every portal write. |
| web-vite portal | `apps/web-vite/src/router.tsx`, `router/portal-routes.tsx`, `components/layout/portal-shell.tsx`, `lib/require-portal-auth.ts`, `providers/trpc-provider.ts` (`usePortalTRPC`) | The shell + route table + loader + tRPC boundary to extend. |
| i18n | `apps/web-vite/src/i18n/*` + `Portal` message namespace | 5-locale parity + RTL; `i18n:parity` gate. |

**Installation: none.** No vendor SDK, no new dep. Alternatives (a second auth app, a Contractor↔Worker bridge) are rejected in § The Load-Bearing Decision.

## Reuse Patterns (VERIFIED)

- **Pattern 1 — self-scoped portal read.** `portalEmployeeProcedure.query(({ ctx }) => ctx.db.X.findMany({ where: { workerId: ctx.workerId, organizationId: ctx.organizationId } }))` — mirrors `portal.complianceItems` (`{ contractorId: ctx.contractorId, organizationId: ctx.organizationId }`) `[VERIFIED: portal-profile-router.ts:397-410]`. No client id trusted.
- **Pattern 2 — portal write via domain service.** The portal time-off procedure Zod input omits `workerId`; the handler injects `ctx.workerId`, opens `ctx.db.$transaction`, calls `computeLeaveBalance` + `createApprovalFlow`/`routeToLeaveChain`, and `writeAuditLog(..., tx)` in the same tx — the staff `submitLeaveRequest` shape minus client `workerId` `[VERIFIED: leave.ts:108-120,31-34]`.
- **Pattern 3 — manager authorize-then-act.** Resolve reports server-side; assert `target.managerWorkerId === ctx.workerId`; then call the shared approval transition (which writes the `leaveLedgerEntry` DEDUCTION) `[VERIFIED: approval-shared.ts:337-355]`. Authorization = the edge; execution = the shared state machine.
- **Pattern 4 — server-key upload.** Request a presigned PUT → server mints `documentId` + storage key into `PendingUpload(purpose='PORTAL_DOC_VERSION')` → client returns only `documentId` → confirm consumes the row `[VERIFIED: portal.prisma:83-123]`. No client-supplied `storageKey`.
- **Pattern 5 — dark-mount gating.** The employee/manager namespaces mount on `portalAppRouter` only when the portal module is registered (mirror `conditionalWorkforceRouters` — `isWorkforceRegistered() ? routers : {}`) `[VERIFIED: root.ts:185-196,262]`, and each procedure re-asserts the flag per request (mirror `assertWorkforceEnabled`) `[VERIFIED: leave.ts:112]`. Absent flag → `METHOD_NOT_FOUND`.
- **Pattern 6 — web-vite portal section.** A hook under `components/portal/employee/hooks/use-*.ts` is the sole `usePortalTRPC` boundary; a wired section decides loading/empty/error/forbidden; a `*View` is props-only; the page is `Suspense` + the wired root `[VERIFIED: use-portal-equipment.ts:1-16; ARCHITECTURE.md]`.

## Route + Namespace Inventory (concrete)

**Portal tRPC namespaces (added to `portalAppRouter`):** `portalEmployee` (self: `getDashboard`, `getLeaveBalance`, `submitTimeOffRequest`, `listMyLeaveRequests`, `getMyTime`, `getMyEwidencja`, `getMyAkta`, `requestAktaUpload`/`confirmAktaUpload`, `getPayStubAvailability`), `portalManager` (`getTeamOverview`, `listReportLeaveRequests`, `approveReportLeaveRequest`, `rejectReportLeaveRequest`, `listReportTimeToApprove`, `approveReportTimeEntry`, `listReportDocumentExpiry`). Magic-link/verify stay on `portal` (extended to resolve employees).

**web-vite routes (added to `portalRoutes`, inside the authenticated shell):**
`portal/employee` (employee dashboard), `portal/employee/leave` (balance + request), `portal/employee/time` (ewidencja/time), `portal/employee/documents` (akta self-view + upload), `portal/employee/pay` (pay-stub availability), `portal/employee/team` (manager overview), `portal/employee/team/approvals` (leave + time approvals), `portal/employee/team/documents` (report document-expiry). Public routes unchanged.

## Widget Gating Map (D-02)

| Widget | Gate(s) | Dark state |
|--------|---------|-----------|
| Leave balance + time-off request | `module.employee-portal` + `module.workforce-employees` | "Leave management not enabled" empty card |
| Employee-time / ewidencja | `module.employee-portal` + `module.workforce-employees` | "Time tracking not enabled" empty card |
| Personal akta view + upload | `module.employee-portal` + `module.workforce-employees` | "No documents / not enabled" empty state |
| Pay stubs | `module.employee-portal` (+ payroll flag) | **Always** unavailable in v7.0 — "Pay stubs live in your payroll system" (C3) |
| Manager approvals + doc-expiry | `module.employee-portal` + caller has ≥1 report | Non-managers never see the `/team` nav; direct nav → forbidden |

## Validation Architecture (seeds 96-VALIDATION)

- **Framework:** Vitest (`packages/api`), Playwright/RTL where the UI needs it; `pnpm --filter @contractor-ops/api test <path>` (scoped). **NEVER** run the full web-vite suite unscoped (RAM).
- **The RED net (Wave 3, before impl):** two-employee IDOR (A cannot read B's balance/akta/time; cross-org blocked); manager-non-report IDOR (read + approve); leave-from-portal session-scoping (workerId injected, client `workerId` rejected by `.strict()`); entitlement-scoped akta (own file, allowlisted sections only; section C excluded); pay-stub-unavailable (`available:false`); dark-flag gating (`portalEmployee`/`portalManager` absent + per-procedure `METHOD_NOT_FOUND` when OFF); contractor-path regression (contractor session/validate/middleware unchanged).
- **Per-widget:** each read is self-scoped-tested; each write is audit-log-asserted (`lint:audit-log`) + Zod-`.strict()`.
- **Gates per wave:** `pnpm typecheck --filter=@contractor-ops/api`, `pnpm --filter @contractor-ops/api test <path>`, `lint:audit-log`, `lint:schema`, `lint:logs`, `lint:silent-catch`, `check:web-vite-data-layer` + `check:web-vite-page-shells` + `check:web-vite-presentational` (UI waves), `i18n:parity` (UI waves), `pnpm standards:check`, `pnpm lint:no-breadcrumbs`, `pnpm check:wiki-brain` (before verify).
- **tsconfig guard:** `packages/api` excludes `src/**/__tests__/**` from `tsc --noEmit`, so RED scaffolds importing not-yet-built procedures do not brick the package typecheck — confirm before seeding; do not re-add a broad include.
- **Migration guard:** the `PortalSession` subject columns + CHECK and the `EmployeeProfile.managerWorkerId` FK are `__`-prefixed generated migrations; apply at deploy (EXTERNAL-ENABLEMENT deploy-time step); Prisma client compiles without a live DB.

## Open Questions (resolved with a recommendation)

- **Q1 — the portal flag.** Reuse `module.workforce-employees` or mint `module.employee-portal`? **Resolved:** mint `module.employee-portal` (category `module`, `default:false`, owner `workforce-platform`, signoff PENDING) as the **portal** gate, and require `module.workforce-employees` as the **data prerequisite** (the employee surfaces are dark without it). Rationale: an org may run internal workforce management long before it opens an external employee portal; a dedicated flag lets the portal ship dark and flip independently. Both checked (defense in depth). Plan 96-01.
- **Q2 — route root.** `/employee/*` (top-level) or `/portal/employee/*`? **Resolved:** `/portal/employee/*` inside the existing authenticated `PortalShell` — the subdomain + loader + shell already exist and D-07 says "extend, don't rebuild." A top-level `/employee/*` would need a second shell + loader for no benefit.
- **Q3 — manager view placement.** Inline role-toggle vs distinct route group? **Resolved:** a distinct `portal/employee/team/*` group — it permission-loads independently (a non-manager never mounts it), and the IDOR fence is testable in isolation.
- **Q4 — shared email (contractor AND employee at the same org).** The org-picker must present both subjects. **Resolved:** `verifyMagicLink` returns a union list; the picker shows subject-type; selecting one mints a session of that `subjectType`. Both remain reachable via separate logins. (Edge case; covered by a resolution unit test.)
- **Q5 — a manager who is also an approver on the staff side.** The portal manager approval and the staff `leave_approver` approval are **distinct authorization paths** over the **same** leave request; both write through the shared transition, which is idempotent on state. **Resolved:** the portal path asserts the reporting-line edge; the staff path asserts the User role; neither can act outside its scope; a request already actioned by one path is a no-op/typed-conflict for the other.

## Wave Plan Overview (the acyclic DAG)

| Wave | Plans | Delivers | RED→GREEN |
|------|-------|----------|-----------|
| 1 | 96-01 | DB (PortalSession subject + CHECK; EmployeeProfile.managerWorkerId) + `module.employee-portal` flag + `PERSONNEL_FILE_SELF_VIEW_SECTIONS` | GREEN (schema + flag) |
| 2 | 96-02 | Subject-discriminated `validatePortalSession` + `createPortalSession` + `portalEmployee`/`portalManager` procedures + magic-link `findEmployeesByEmail` + verify union | GREEN (unit + contractor regression) |
| 3 | 96-03 | The RED net (IDOR, manager-IDOR+cross-org, leave-from-portal scoping, entitlement-scoped akta, pay-stub-unavailable, dark-flag gating) | RED |
| 4 | 96-04, 96-05, 96-06 | Employee-self router (leave+time+upload); employee akta self-view + pay-stub availability; manager router (reports + approvals + doc-expiry) | flips RED→GREEN |
| 5 | 96-07, 96-08 | Employee dashboard UI; manager dashboard UI (routes/hooks/wired sections/views + states) | GREEN |
| 6 | 96-09 | 5-locale i18n parity + nav wiring + docs-follow-code (wiki + catalog + MEMORY) + graph/BM25 | GREEN |

Dependencies: 96-02→96-01; 96-03→{96-01,96-02}; {96-04,96-05,96-06}→{96-01,96-02}; 96-07→{96-04,96-05}; 96-08→96-06; 96-09→{96-07,96-08}. Acyclic.

---

*Phase: 96-theme-b-employee-self-service-portal*
*Researched: 2026-07-05 — every reuse seam read at source at current HEAD; C1–C5 corrected against live code.*
