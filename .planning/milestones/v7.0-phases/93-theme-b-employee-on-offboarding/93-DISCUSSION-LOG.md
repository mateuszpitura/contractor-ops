# Phase 93: Theme B — Employee On/Offboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 93-theme-b-employee-on-offboarding
**Areas discussed:** Offboarding F4 composition, Template engine + seeding, Statutory paperwork, Gov integration hooks

---

## Offboarding F4 Composition (EMP-OFF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend both (worker-key the saga) | Extend WorkflowRun (+workerId, worker startRun) AND worker-key DeprovisioningRun (nullable FKs + workerId + termination-date + resolver sibling) | ✓ |
| Extend run; defer employee-IdP | WorkflowRun offboarding now; employee IdP deprovisioning → v7.5 (avoids saga refactor); partial EMP-OFF-02 | |
| You decide | Planner picks; constraint = criterion-3 extend F4 not duplicate | |

**User's choice:** Extend both (worker-key the saga).
**Notes:** Scout split verdict: WorkflowRun half near-worker-generic (cheap, schema-additive + start branch); DeprovisioningRun half hard contractor-coupled (NON-NULL contractorId/assignmentId FKs, derives externalUserId from contractor.email, cooldown TZ from countryCode, keys off ENDED ContractorAssignment). Worker-keying the saga + adding a dated termination signal is the biggest new-build item. No OffboardingRun model — "F4 offboarding" = WorkflowRun(type=OFFBOARDING) + assertRunCompletable gate + F2 DeprovisioningRun saga.

---

## Template Engine + Seeding (EMP-ON-01, EMP-OFF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse workflow engine + seeded per-market templates | v1.0 WorkflowRun engine + boot-upsert PL/DE/UK/US templates (extend offboarding-templates pkg + jurisdiction-keying); org-editable | ✓ |
| Org-editable only (no seeds) | Engine + blank builder; orgs build own templates; low liability, high setup burden | |
| You decide | Planner picks; constraint = criterion-1/2 per-market templates run | |

**User's choice:** Reuse workflow engine + seeded per-market templates.
**Notes:** Onboarding importer (v1.0/v3.0) is org member-import, NOT a new-hire checklist — ride the WorkflowRun engine instead. Current offboarding seeds are role-keyed; per-market template set is net-new content on reusable rails (compliance-policy register-on-import).

---

## Statutory Paperwork (EMP-OFF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Draft PDF + adviser-verify watermark | Generate on existing render+snapshot+R2 infra (new react-pdf templates), watermarked adviser-verify; value now, liability flagged | ✓ |
| Checklist + manual upload | Tasks prompt for each doc; HR produces + uploads externally; lowest liability, no gen value | |
| You decide | Planner picks; constraint = criterion-2 + adviser-verify annotation | |

**User's choice:** Draft PDF + adviser-verify watermark.
**Notes:** PDF render+snapshot+R2 infra fully reusable (form-1099-nec-pdf.ts pattern; ir35-sds.tsx legal-doc precedent). No świadectwo/Arbeitszeugnis/P45 template exists → new react-pdf templates. Watermark per Standing Constraint (local-only, legal DEFERRED, solo-founder liability).

---

## Gov Integration Hooks (EMP-ON/OFF)

| Option | Description | Selected |
|--------|-------------|----------|
| Stub hooks + manual steps | E-Verify/ZUS ZWUA/Abmeldung SV/RTI = documented stub hook + manual task, wired as seam (mirror P90); local-only | ✓ |
| You decide | Planner picks; constraint = local-only, gov = manual + seam | |

**User's choice:** Stub hooks + manual steps.
**Notes:** Mirrors P90 (ELStAM/ZUS stubs). No live gov calls this phase; no cert/agreement dependencies.

---

## Claude's Discretion

- Dated termination signal shape (D-01) — EmploymentEvent table vs terminatedAt field vs run-completion; must feed IdP cooldown gate.
- Onboarding-vs-offboarding template taxonomy + per-market step granularity.
- E-Verify/ZUS/Abmeldung/RTI stub-hook interface shapes.
- EntityType.USER reuse vs add WORKER/EMPLOYEE for the WorkflowRun subject.
- react-pdf template composition + v7.0-vs-deferred cert subset.

## Deferred Ideas

- Live government integrations → stub hooks now, live later.
- Employee on/offboarding portal self-service → P96.
- Payroll final-pay computation → P94.
- Probation-watchlist → P97.
- Large react-pdf cert set → planner may scope a v7.0 subset.
