# Phase 96: Theme B — Employee Self-Service Portal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 96-theme-b-employee-self-service-portal
**Areas discussed:** Portal identity model, Graceful degradation, Manager scoping, Write-action surface

---

## Portal Identity Model (EMP-PORTAL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Unified portal-user, role-discriminated session | Magic-link resolves Contractor OR Employee; portalProcedure attaches subject-type + role; routes gate on it. | ✓ |
| Separate employee portal session | Distinct employee subject alongside contractor on same magic-link/subdomain. | |
| Planner decides subject model | Lock reuse magic-link + role-gated routes; leave session shape to planner. | |

**User's choice:** Unified portal-user, role-discriminated session.
**Notes:** Extend contractor resolution (findContractorsByEmail → also employees); one portal, one login. Manager = employee with reports.

---

## Graceful Degradation Across Sibling Surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Per-widget flag-gate + empty/disabled state | Each widget gated on its surface flag; dark surface → real empty/unavailable state; portal ships independent of siblings. | ✓ |
| Block portal until all surfaces live | Expose portal only once P91–95 executed. | |
| Read-only stubs where surface missing | Always render, placeholder where surface absent. | |

**User's choice:** Per-widget flag-gate + proper empty/disabled state.
**Notes:** Portal is independent of P91–95 completion; unbuilt sibling = empty widget, never a blocker or hollow UI.

---

## Manager → Direct-Reports Scoping (EMP-PORTAL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Reporting-line edge + server-side scope + reuse approvals RBAC | Manager relation on EmployeeProfile; server-side scoped reads/approvals; reuse LEAVE_APPROVER; IDOR test. | ✓ |
| Org-hierarchy lookup | Reports derived from broader org/department hierarchy. | |
| Planner decides reports source | Lock server-side-scoped + IDOR-tested + reuse RBAC; leave edge source to planner. | |

**User's choice:** Reporting-line edge on EmployeeProfile + server-side scope + reuse approvals RBAC.
**Notes:** Report ids never client-supplied; mandatory IDOR test (manager can't read/approve non-reports; cross-org blocked).

---

## Portal Write-Action Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse domain mutations via portal procedures | Writes = time-off request, document upload, manager leave/time approvals — through portal procedures calling P91/P92 mutations; rest read-only. | ✓ |
| Read-only portal v1 | Display-only; all writes stay in staff app. | |
| Planner decides write set | Lock writes-reuse-domain-mutations; leave action list to planner. | |

**User's choice:** Reuse existing P91/P92 domain mutations via portal-scoped procedures.
**Notes:** No reimplemented business logic; portal auth + writeAuditLog on every write; everything else read-only.

## Claude's Discretion

- Route path (`/employee/*` vs `/portal/employee/*`) + nav in portal-top-bar.
- Widget → flag/module mapping table.
- Manager view as distinct route vs role-toggled section.
- Pay-stub read-model from the P94 surface; akta read reuse from P91.
- Exact portal-auth session-shape change (discriminated subject vs role field).

## Deferred Ideas

- Org-wide HR dashboard → Phase 97 (this phase = self + direct-reports only).
- Widgets for surfaces not delivered by P90–95 → appear when the surface + flag land.
- Read-only-only portal → rejected (EMP-PORTAL-02/03 need self-serve writes).
