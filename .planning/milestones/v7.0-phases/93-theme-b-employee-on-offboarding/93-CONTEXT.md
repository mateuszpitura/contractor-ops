# Phase 93: Theme B — Employee On/Offboarding - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A new or departing `Worker(EMPLOYEE)` runs the correct **per-market statutory workflow** (PL / DE /
UK / US), delivering three locked requirements (EMP-ON-01, EMP-OFF-01, EMP-OFF-02):

- **Onboarding** (EMP-ON-01): per-market templates — PL (badania wstępne, PIT-2, PPK auto-zapis,
  IKE/IKZE), DE (Personalfragebogen, Steuer-ID lookup, SV-Ausweis, bAV), UK (P45/P46, RTI flag,
  pension auto-enrol), US (W-4, I-9 + E-Verify hook, state W-4, direct-deposit).
- **Offboarding** (EMP-OFF-01): per-market — PL (świadectwo pracy, ekwiwalent za urlop, ZUS ZWUA,
  PIT-11), DE (Arbeitszeugnis qualified/simple, Abmeldung SV, Lohnsteuerbescheinigung), UK (P45,
  final RTI, pension, P11D), US (final paycheck per state, COBRA, W-2, 401(k)).
- **Composition** (EMP-OFF-02): employee offboarding **extends** the v6.0 F4 offboarding hardening
  (IP verification, KT templates, IdP deprovisioning) — never duplicates it.

**HARD DEPENDENCY:** Phase 90 (`EmployeeProfile`) must land first. At context time P90 is mid-
execution; this context can be planned, execution waits on 90. Composes with v6.0 F4.

**NOT this phase:** payroll export (P94 — consumes final-pay data), HRIS sync (P95), employee
portal on/offboarding self-service (P96), HR dashboard probation-watchlist (P97). **No live
government integrations** (E-Verify/ZUS/Abmeldung/RTI = stubs). Leave/time (P92) supplies the
ekwiwalent-za-urlop balance input.
</domain>

<decisions>
## Implementation Decisions

### Offboarding F4 Composition (EMP-OFF-02) — the reuse mandate
- **D-01 (locked):** **Extend BOTH halves of F4 — worker-key them, do not duplicate.** The scout
  confirmed a split coupling:
  - **WorkflowRun half (KT / IP-verification / credentials / `assertRunCompletable` gate) is near-
    worker-generic** — the engine + gate key on `workflowRunId`+`organizationId`, never on a
    contractor. Extend by: (a) add `WORKER`/`EMPLOYEE` to `EntityType` (`contract.prisma:280`);
    (b) add a nullable `workerId` FK on `WorkflowRun` (`workflow.prisma`, today only `contractorId?`);
    (c) a worker-aware `startRun` branch (today `startRunSchema` mandates `contractorId` and
    `startRun` hardcodes `entityType:'CONTRACTOR'` + `tx.contractor.findFirst`); (d) generalize
    `resolveAssignee` `CONTRACTOR_OWNER`/`CONTRACT_OWNER` + the "for {contractorName}" notification.
    No gate/engine changes — schema-additive + one start branch.
  - **DeprovisioningRun half (F2 IdP saga) is hard contractor-coupled — the biggest new-build item.**
    `DeprovisioningRun.contractorId` + `.assignmentId` are NON-NULL FKs; the trigger derives
    `externalUserId` from `contractor.email`, cooldown TZ from `contractor.countryCode`, and keys off
    an ENDED `ContractorAssignment`. Employees have none of these. Worker-key it: make
    `contractorId`/`assignmentId` **nullable** + add `workerId`; source `externalUserId` from
    `Worker.email` + country from `EmployeeProfile.countryCode`; add a **dated termination signal**
    for the 14-day cooldown gate (none exists — `EmploymentStatus` is a status enum, not a dated
    event; add an `EmploymentEvent`/`terminatedAt` — planner's shape); add a worker-keyed sibling to
    `resolveAssignmentForContractor` + `use-start-deprovisioning`.
  - **Constraint (locked — criterion-3): compose with v6.0 F4 by extending the existing run, never
    duplicating.**

### Template Engine + Per-Market Seeding (EMP-ON-01, EMP-OFF-01)
- **D-02 (locked):** **Reuse the v1.0 WorkflowRun engine** (confirmed subject-agnostic: template
  builder, dependencies, conditional logic, progress, overdue). The employee on/offboarding is a
  WorkflowRun, NOT the v1.0/v3.0 onboarding *importer* (that is an org member-import wizard, not a
  new-hire checklist).
- **D-03 (locked):** **Per-market (PL/DE/UK/US) step templates ship as boot-upserted
  `WorkflowTemplate`s** — extend the `packages/offboarding-templates` package idiom (currently
  ROLE-keyed KT seeds; add **jurisdiction-keying**), registered on the compliance-policy
  register-on-import rails (`Jurisdiction` type + `policies/<cc>`). Orgs can edit the seeded
  templates afterward (`WorkflowTemplate` is org-editable). Statutory step content carries
  adviser-verify annotations.

### Statutory Termination Paperwork (EMP-OFF-01)
- **D-04 (locked):** **Generate DRAFT PDFs on the existing render+snapshot+R2 infra** (the
  `form-1099-nec-pdf.ts` render→snapshot→R2 CAS pattern + `@react-pdf/renderer` templates; the
  `ir35-sds.tsx` jurisdiction-determination doc is the direct legal-doc precedent). Add **new
  react-pdf templates** per certificate (świadectwo pracy, Arbeitszeugnis qualified/simple, P45,
  W-2, etc. — none exist today). Each generated doc is **prominently watermarked "needs jurisdiction
  legal/tax adviser verification"** (Standing Constraint — local-only, legal DEFERRED, solo-founder
  liability) and archived as an immutable snapshot. **Constraint: per-market paperwork covered
  (criterion-2) + adviser-verify annotation.**

### Government Integration Hooks (EMP-ON/OFF)
- **D-05 (locked):** **Stub hooks + manual checklist steps** — mirror P90 (ELStAM/ZUS stubs). Each
  gov interaction (I-9 + E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT-2/PIT-11 filing) is a
  documented stub hook + a manual workflow task, wired as a seam for later live integration. No live
  gov calls this phase (local-only; no cert/agreement dependencies).

### Claude's Discretion
- The dated termination signal shape (D-01): new `EmploymentEvent` table vs a `terminatedAt` field
  on `EmployeeProfile` vs reuse of a workflow-run completion — planner picks; must feed the IdP
  cooldown gate.
- Onboarding-vs-offboarding template taxonomy + the per-market step lists' exact granularity.
- The E-Verify / ZUS / Abmeldung / RTI stub-hook interface shapes.
- Whether to reuse `EntityType.USER` vs add `WORKER`/`EMPLOYEE` for the WorkflowRun subject (D-01a).
- react-pdf template composition + which certs are v7.0 vs deferred.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — EMP-ON-01 (line 121), EMP-OFF-01 (122), EMP-OFF-02 (123) verbatim;
  line 26 (legal sign-off posture — statutory paperwork adviser-verify annotated).
- `.planning/ROADMAP.md` (Phase 93 entry) — goal + 3 success criteria + research flag (extends v6.0
  F4 saga; legal annotation on statutory copy) + UI hint = yes.
- `.planning/phases/90-theme-b-employee-registry-per-market-6/90-CONTEXT.md` — `EmployeeProfile`
  (countryCode, employmentStatus) the on/offboarding attaches to; stub-hook / reference-list idiom.
- `.planning/phases/89-theme-b-worker-model-abstraction-serial-gate/89-CONTEXT.md` — `Worker(EMPLOYEE)`
  + `module.workforce-employees` gate.

### v1.0 Workflow engine (reuse; extend start path)
- `packages/db/prisma/schema/workflow.prisma` (`WorkflowTemplate` :4, `TaskTemplate` :26,
  `WorkflowRun` :105 — `entityType`/`entityId`, `contractorId?`/`contractId?`, `overrideMetadata`
  :125; `TaskRun` :149; `WorkflowRoleTemplate` :56 / `RoleTaskTemplate` :79 KT; `TemplateType`
  ONBOARDING/OFFBOARDING :255; `TaskType` ACCESS_REVOKE/IP_VERIFICATION/KNOWLEDGE_TRANSFER :269).
- `packages/api/src/routers/workflow/workflow-shared.ts` (pure-fns: condition :97, progress :178,
  transitions :209, dep-unblock+recompute :233; `resolveAssignee` :134; **`assertRunCompletable`
  :314** — IP + PENDING-cred gate, error keys :341/:357).
- `packages/api/src/routers/workflow/workflow-execution-runs.ts:38` (`startRun` — contractor-coupled
  at :56/:87-89) + `packages/validators/src/workflow.ts:133` (`startRunSchema` — mandates
  `contractorId`, must add worker path). `workflow-templates.ts:467` (default Contractor Offboarding
  template, `appliesToEntityType:'CONTRACTOR'`).
- `contract.prisma:280` (`EntityType` — no WORKER/EMPLOYEE; add or reuse USER).

### v6.0 F4 offboarding hardening (extend, criterion-3)
- KT role-templates + per-org boot upsert: `packages/offboarding-templates/src/seeds.ts:9`
  (ROLE-keyed — add jurisdiction-keying), `upsert-on-boot.ts`.
- Credential-rotation: `workflow.prisma:226` (`CredentialReference`),
  `packages/api/src/routers/workflow/credential-reference.ts:69`.

### F2 IdP DeprovisioningRun saga (worker-key — biggest new build)
- `packages/db/prisma/schema/idp-deprovisioning.prisma` (`DeprovisioningRun` :8 — NON-NULL
  `contractorId`/`assignmentId` :11-12/:20-21; `DeprovisioningStep` :31; `IdpChangeProvenance` :66).
- `packages/api/src/routers/integrations/deprovisioning.ts:202` (`startDeprovisioningRun`), `:177`
  (`resolveAssignmentForContractor` — needs worker sibling), `:35` (5 providers),
  `services/idp-token-resolver.ts:17`; cooldown `packages/idp-saga/src/{cooldown.ts,run-status.ts}`.
- Wire: `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts:1` (contractor-keyed —
  needs worker variant); step runner `apps/api/src/routes/idp-deprovisioning.ts:1`.

### Statutory PDF render + snapshot + R2 (reuse infra; new templates)
- `packages/api/src/services/form-1099-nec-pdf.ts:24/:39/:57` (snapshot→renderToBuffer→R2 CAS
  double-render guard) + `packages/api/src/services/r2.ts` (`putObjectAndSignDownload`).
- `packages/api/src/pdf-templates/` (`ir35-sds.tsx` — legal-doc precedent; `form-1099-nec-copy-b.tsx`,
  `drv-defense-bundle.tsx`, `gdpr-privacy-notice.tsx`) — add świadectwo/Arbeitszeugnis/P45/W-2.
- `packages/api/src/services/tax-form.service.ts:14` (`buildFormSnapshot`) — immutable-snapshot pattern.

### Per-jurisdiction registry
- `packages/compliance-policy/src/types.ts:6` (`Jurisdiction`), `index.ts:1` (register-on-import
  `./policies/{uk,de,pl,us,ksa,uae}`), `registry.ts:1`, `doc-registry.ts:1`.

### Worker attach + flag + mount
- `packages/db/prisma/schema/worker.prisma:12` (`Worker`/`WorkerType`, `email` :24),
  `packages/db/prisma/schema/employee.prisma:12` (`EmployeeProfile` — `countryCode` :20,
  `employmentStatus` TERMINATED :58) + `packages/api/src/root.ts:168/:175/:180` (`workforceRouters`
  mount) + `middleware/require-workforce-flag.ts` (`assertWorkforceEnabled`).

### Web-vite UI (reuse + worker variant)
- Reuse by runId (subject-agnostic): `apps/web-vite/src/components/workflows/workflow-run/`
  (`task-checklist.tsx:12`, `task-card-run.tsx:108`, `run-header.tsx`, `task-attachments.tsx`,
  `task-comments.tsx`), `workflows/my-tasks-list.tsx`, `workflows/template-builder/`,
  `workflows/workflow-runs-table/`, `pages/dashboard/workflows/detail.tsx:72`; IdP
  `components/idp/deprovisioning-run-view.tsx:124` (reuse), `deprovisioning-trigger.tsx:142` +
  `use-start-deprovisioning.ts` (need worker-keyed variant).

### Documentation-follows-code (update in the SAME change set)
- `.planning/brain/wiki/domains/` (worker on/offboarding), `wiki/structure/{prisma-schema-areas.md
  (WorkflowRun.workerId + DeprovisioningRun worker-key + EmploymentEvent), key-services.md (per-market
  templates + cert PDFs), api-routers-catalog.md, cron-jobs.md}`, `wiki/patterns/{workflow-engine,
  offboarding, rbac}`, `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` (WorkflowRun/DeprovisioningRun
  worker-keying + adviser-verify-watermarked statutory PDFs invariants); `pnpm check:wiki-brain`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v1.0 WorkflowRun engine** (template/task/condition/progress/gate) — subject-agnostic, reuse;
  extend start path for worker (D-01/D-02).
- **v6.0 F4 gate + KT templates + credential-rotation** — key on runId, reuse cleanly.
- **F2 DeprovisioningRun saga** — worker-key it (nullable FKs + workerId + termination signal) — the
  main new build (D-01).
- **PDF render+snapshot+R2 infra** (`form-1099-nec-pdf.ts` + react-pdf `ir35-sds.tsx`) — add cert
  templates (D-04).
- **compliance-policy register-on-import rails** — per-market template registration (D-03).
- **workflow-run + IdP-run UI** (by runId) — reuse; add worker-keyed trigger variant.

### Established Patterns
- **Extend the generic run, worker-key the coupled saga — never duplicate** (EMP-OFF-02).
- **Register-on-import per-jurisdiction** template/rule content.
- **Reuse render+immutable-snapshot+R2** for statutory docs; adviser-verify watermark.
- **Stub hooks + manual steps for gov integrations** (local-only, mirror P90).
- **module.workforce-employees gate; writeAuditLog; i18n parity; web-vite layering.**

### Integration Points
- Employee on/offboarding = WorkflowRun on `Worker(EMPLOYEE)` (`workerId`); routers in
  `workforceRouters` (root.ts:175) behind `module.workforce-employees`.
- Offboarding IdP step → worker-keyed `startDeprovisioningRun`; needs a dated termination signal.
- Ekwiwalent-za-urlop reads P92 leave balance; final-pay data feeds P94 payroll.
- Per-market templates + certs register on compliance-policy rails alongside P91/P92 rules.

</code_context>

<specifics>
## Specific Ideas

- **Extend, don't duplicate** — the whole point of EMP-OFF-02; the workflow engine + gate + KT +
  PDF infra + jurisdiction rails are all reuse; only the WorkflowRun start path (cheap) and the IdP
  saga (real work) need worker-keying.
- **The IdP saga worker-keying is the phase's spine** — nullable contractor FKs + `workerId` + a
  dated termination event for the cooldown gate; get this right or offboarding IdP for employees
  can't compose.
- **Legally cautious paperwork** — draft PDFs with adviser-verify watermark, never presented as
  adviser-approved (solo-founder liability; legal DEFERRED).
- **No live gov calls** — E-Verify/ZUS/Abmeldung/RTI are seams, not integrations, this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Live government integrations** (E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT filing) → stub
  hooks now; live later if a market demands it.
- **Employee on/offboarding self-service portal surfaces** → P96 (staff/HR side here).
- **Payroll final-pay computation** → P94 consumes offboarding output.
- **Probation-watchlist** → P97 HR dashboard.
- **Some cert templates** may be v7.5 if the react-pdf set is large — planner scopes v7.0 subset.

None expand the phase scope — discussion stayed within the employee on/offboarding boundary
(EMP-ON-01, EMP-OFF-01, EMP-OFF-02).

</deferred>

---

*Phase: 93-theme-b-employee-on-offboarding*
*Context gathered: 2026-07-01*
