# Phase 96: Theme B — Employee Self-Service Portal - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**UI phase:** yes — run `/gsd:ui-phase 96` for a UI-SPEC before/alongside planning.

<domain>
## Phase Boundary

Employees **and their managers self-serve through the existing v2.0 contractor portal shell** —
same magic-link auth + subdomain, new `/employee/*` routes — fully localized across five locales
(en / pl / de / ar RTL / en-US).

- **Employee** (EMP-PORTAL-02): pay stubs (where payroll-integrated), leave balance, time-off request,
  document upload, personal akta view.
- **Manager** (EMP-PORTAL-03): direct reports' leave requests, time entries to approve, document-expiry flags.
- **i18n parity** (EMP-PORTAL-04): en / pl / de / ar (RTL, v4.0) / en-US, formal-Sie register (v5.0).

**Depends on:** Phases 90–95 for the data surfaces displayed — P90 `EmployeeProfile` + roles,
P91 akta + document-expiry, P92 leave/time, P93 offboarding docs, P94 pay-stub surface.
**Reality:** several sibling surfaces are not executed yet (92 partial; 93/94/95 planned or just-discussed).
The portal must ship **independent of sibling completion** via per-widget gating (D-02).

**NOT this phase:**
- Org-wide HR dashboard (P97) — this phase is self + direct-reports only.
- New domain logic for leave/time/akta/payroll — the portal *reuses* P91–94 mutations/reads, it does not reimplement them.
- Any widget whose surface isn't delivered by P90–95.
</domain>

<decisions>
## Implementation Decisions

### Portal Identity Model (EMP-PORTAL-01) — D-01
- **D-01:** **Unified portal-user, role-discriminated session.** Magic-link resolves **either a Contractor OR an Employee**
  by email; `portalProcedure` / `middleware/portal-auth.ts` attaches a **subject-type + role** (employee / manager / contractor)
  to the portal session; `/employee/*` routes and manager views gate on it. One portal, one magic-link + subdomain, one login
  flow — extend the existing contractor resolution (`findContractorsByEmail` → also match employees), do not stand up a parallel
  employee auth. Manager = an employee whose reporting-line edge has reports (D-03).

### Graceful Degradation Across Sibling Surfaces — D-02
- **D-02:** **Per-widget flag-gate + proper empty/disabled state.** Each widget (pay stubs, leave balance, time-off, document
  upload, akta view, doc-expiry, reports-to-approve) is **independently gated on its surface's flag/module** (e.g. payroll-integration
  for pay stubs, leave module for balances). When a surface is dark for the org, the widget renders a real **empty/unavailable**
  state — never a crash, never hollow placeholder content. The portal ships even if P91–95 are partially live for the org.

### Manager → Direct-Reports Scoping (EMP-PORTAL-03) — D-03
- **D-03:** **Reporting-line edge + server-side scope + reuse approvals RBAC.** Resolve direct reports via a **manager relation on
  `EmployeeProfile`** (P90); every manager read and approval is **server-side scoped to the caller's own reports** — report ids are
  never taken from client input. Reuse the `LEAVE_APPROVER` role (WORKER-04) + the existing approvals RBAC/authorization path.
  **Mandatory IDOR test:** a manager cannot read or approve for an employee who is not their report (and cross-org is blocked).

### Portal Write-Action Surface — D-04
- **D-04:** **Writes reuse existing domain mutations through portal-scoped procedures.** Write actions are: **employee** time-off
  request + document upload; **manager** leave approve/reject + time-entry approve. Each routes through a portal procedure that calls
  the **same P91/P92 domain mutation** (no reimplemented business logic), under portal auth + `writeAuditLog`. Everything else
  (pay stubs, balances, akta, expiry flags) is **read-only** display.

### Cross-Cutting (carried forward — not re-asked)
- **D-05:** i18n parity en / pl / de / ar (RTL) / en-US via the **existing portal i18n** + hardcoded-string check; formal-Sie register
  (v5.0). RTL layout verified for the new routes. Parity is a gate, not advisory.
- **D-06:** Whole surface gated on **`module.workforce-employees`**; tenant `organizationId` from session; `writeAuditLog` on every
  portal write; Zod `.strict()` on portal procedures; portal session is isolated from staff `tenantProcedure`.
- **D-07:** Extend the v2.0 portal — reuse `PortalShell` / `PortalShellContainer` + `requirePortalAuth` loader + `portalAppRouter`;
  follow web-vite portal layering (page = thin composer → wired section/container → hook = sole tRPC boundary → presentational).
- **D-08:** UI built to standard — `frontend-design` + impeccable, WCAG (keyboard/focus/contrast/semantic), mandatory
  loading/empty/error states. Documentation-follows-code: new portal routes/hooks/containers → domain wiki +
  `structure/web-vite-domains.md` + portal domain page in the same change set.

### Claude's Discretion
- Route path shape (`/employee/*` vs `/portal/employee/*`) + nav integration in `portal-top-bar`.
- Exact widget → flag/module mapping table.
- Whether the manager view is a distinct route group or a role-toggled section within the employee dashboard.
- Pay-stub data-source shape from the P94 payroll-integration surface (read model).
- Reuse shape of the P91 akta read for the "personal akta view".
- Precise session-shape change in `portal-auth` (discriminated union subject vs added role field).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 96: Theme B — Employee Self-Service Portal" (goal, success criteria, UI-hint, "extends v2.0 portal magic-link + subdomain")
- `.planning/REQUIREMENTS.md` — EMP-PORTAL-01..04 (portal extension, employee dashboard, manager dashboard, i18n parity en/pl/de/ar/en-US + Sie register)

### Data surfaces (upstream phases)
- `.planning/milestones/v7.0-phases/90-theme-b-employee-registry-per-market-6/90-CONTEXT.md` — `EmployeeProfile` + roles (`LEAVE_APPROVER` etc); reporting-line edge source for D-03
- `.planning/milestones/v7.0-phases/93-theme-b-employee-on-offboarding/93-CONTEXT.md` — offboarding docs / document surface
- `.planning/milestones/v7.0-phases/94-theme-b-payroll-integration-adapters/94-CONTEXT.md` — pay-stub / payroll-integration surface
- (P91 akta + P92 leave/time CONTEXT under `.planning/milestones/v7.0-phases/91-*` and `92-*` — read for the akta / leave-balance / time widgets)

### Reuse — portal auth + shell (v2.0)
- `packages/api/src/portal-root.ts` — `portalAppRouter` (separate portal tRPC surface at /api/trpc/portal)
- `packages/api/src/middleware/portal-auth.ts` — `portalProcedure` / `portalPublicProcedure` (the session to extend for employee/manager subjects, D-01)
- `packages/api/src/routers/portal/portal-auth-router.ts` + `packages/api/src/services/portal-magic-link.ts` — magic-link issue/verify + `findContractorsByEmail` (extend to resolve employees)
- `apps/web-vite/src/router.tsx` (portal route section) + `apps/web-vite/src/router/portal-routes.tsx` — authenticated portal route table (add `/employee/*`)
- `apps/web-vite/src/lib/require-portal-auth.ts` — portal-session loader gate
- `apps/web-vite/src/components/layout/portal-shell.tsx` + `portal-shell-skeleton.tsx` — the shell to extend

### Reuse — write mutations (domain)
- P91 document/akta mutations + P92 leave/time mutations (portal procedures wrap these — see P91/P92 CONTEXT + routers) for D-04
- Existing approvals RBAC path (`LEAVE_APPROVER`, `requirePermission`) for manager approve actions (D-03)

### Conventions
- `apps/web-vite/ARCHITECTURE.md` — web-vite layering (page → container/wired section → hook = sole tRPC boundary → presentational)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v2.0 portal shell** — `PortalShell`/`PortalShellContainer`, `requirePortalAuth` loader, `portal-shell-skeleton`; add `/employee/*` children, reuse top-bar/nav.
- **`portalAppRouter` + `portalProcedure`** — isolated portal auth; extend the session to carry an employee/manager subject + role (D-01).
- **Magic-link infra** — `portal-magic-link.ts` + `portal-auth-router.ts` (`findContractorsByEmail`); extend resolution to employees, same 15-min token flow.
- **Existing portal pages** (`/portal` index, settings, equipment, contracts, invoices, time) — pattern templates for the new employee widgets.
- **P90 roles + reporting-line** — `LEAVE_APPROVER` + EmployeeProfile edge for manager scoping.
- **P91/P92 domain mutations** — reused verbatim behind portal procedures for time-off request, upload, leave/time approvals.

### Established Patterns
- **Portal auth isolation** — cookie-based portal session, separate from staff `tenantProcedure`; portal procedures live under `routers/portal/`.
- **web-vite portal layering** — page (thin) → wired section → hook (sole tRPC boundary) → presentational; mandatory loading/empty/error.
- **Feature-gated widgets** — render real empty/unavailable states when a surface is dark (D-02).
- **Server-side authorization scoping** — never trust client-supplied ids; IDOR-tested (D-03).
- **i18n parity gate** + RTL (v4.0) + formal-Sie (v5.0); tenant + audit + Zod-strict.

### Integration Points
- `middleware/portal-auth.ts` — session subject/role extension (biggest change).
- `portal-auth-router.ts` / `portal-magic-link.ts` — employee email resolution.
- `router.tsx` + `portal-routes.tsx` — `/employee/*` route table + nav.
- New portal-scoped procedures wrapping P91/P92 mutations + P94/P91/P92 reads for the widgets.

</code_context>

<specifics>
## Specific Ideas

- "Extends the v2.0 portal" is literal — same magic-link, same subdomain, same shell; the change is a role-discriminated session + new routes, not a new app.
- The portal must degrade gracefully: a Theme B sibling being unbuilt is an **empty widget state**, never a blocker to shipping 96.
- Manager access is a security surface — server-side report scoping + a mandatory IDOR test are non-negotiable.

</specifics>

<deferred>
## Deferred Ideas

- **Org-wide HR dashboard** — Phase 97 (this phase is self + direct-reports only).
- **Widgets for surfaces not delivered by P90–95** — appear only when their surface + flag land.
- **Read-only-only portal** — rejected; EMP-PORTAL-02/03 require self-serve writes (via reused domain mutations).

None are in Phase 96 scope — recorded so they aren't lost.

</deferred>

---

*Phase: 96-theme-b-employee-self-service-portal*
*Context gathered: 2026-07-05*
