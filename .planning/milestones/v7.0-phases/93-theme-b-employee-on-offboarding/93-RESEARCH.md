# Phase 93: Theme B — Employee On/Offboarding - Research

**Researched:** 2026-07-01
**Domain:** Workflow-engine reuse + IdP-deprovisioning-saga worker-keying + per-market statutory paperwork (PL/DE/UK/US)
**Confidence:** HIGH (all core claims verified against in-tree source at current HEAD)

## Summary

Phase 93 is a **reuse-and-extend** phase, not a greenfield build. The v1.0 `WorkflowRun` engine, the v6.0 F4 completion gate (`assertRunCompletable`), the KT-template boot-upsert idiom, the `form-1099-nec-pdf.ts` render→snapshot→R2-CAS pipeline, the `ir35-sds.tsx` react-pdf + locked-disclaimer precedent, the `elstam-stub.ts` gov-seam idiom, and the `compliance-policy` register-on-import rails all exist and are directly reusable. The phase's real work is (a) **worker-keying the IdP `DeprovisioningRun` saga**, (b) adding a **worker branch to `startRun`**, (c) authoring **per-market `WorkflowTemplate` seeds** on the existing boot-upsert rail, (d) adding **statutory-cert react-pdf templates** with adviser-verify watermarks, and (e) **gov stub seams**.

**The single most important finding that reduces the CONTEXT's stated risk:** the IdP saga's *execution half* is **already worker-agnostic**. The QStash step-runner (`apps/api/src/routes/idp-deprovisioning.ts`), the step-runner core (`idp-deprovisioning-step-runner.ts` — `stepRunnerBodySchema` carries only `externalUserId`, never `contractorId`), the token resolver (`idp-token-resolver.ts` — keys on `organizationId`+`provider`), the adapters, the pure cooldown gate (`cooldown.ts` — keys on `endedAt`/`status`/`jurisdictionTz`), and `recomputeRunStatus` **need zero changes**. Contractor-coupling lives in exactly **four** places: the `DeprovisioningRun` schema FKs, the `startDeprovisioningRun` trigger, `resolveAssignmentForContractor`, and the web-vite `use-start-deprovisioning.ts` hook. The blast radius is a **trigger + schema** change, not a saga rewrite.

**The second load-bearing finding:** the CONTEXT's D-03 phrase "extend the `offboarding-templates` package idiom" conflates **two different registries**. The `offboarding-templates` package seeds `WorkflowRoleTemplate`/`WorkflowRoleTaskTemplate` (the KT role registry, auto-selected in `startOffboardingRun`). The per-market on/offboarding **step lists** must instead seed `WorkflowTemplate`/`WorkflowTaskTemplate` — the model `startRun` actually instantiates. The planner must not seed the KT registry for per-market templates. What to *reuse* is the **boot-upsert idempotency pattern** (`upsert-on-boot.ts` + `runPostOrganizationCreateHooks`), retargeted at `WorkflowTemplate` with a new jurisdiction key + compound unique.

**Primary recommendation:** Land schema-additive changes first (EntityType `EMPLOYEE`+`WORKER`, `WorkflowRun.workerId?`, `DeprovisioningRun` nullable-contractor + `workerId?`, `EmployeeProfile.terminatedAt?`, `WorkflowTemplate.jurisdiction` + a `seedKey`/compound-unique), then add a `workerId`-discriminated branch to `startRun` + `startDeprovisioningRun`, then author per-market `WorkflowTemplate` boot seeds, cert react-pdf templates with locked adviser-verify disclaimers, and gov stub seams. Every DB migration is authored as an un-applied `__`-prefixed dir per the milestone's drift-blocked posture; per-region apply defers to the human gate.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Extend BOTH halves of v6.0 F4 by worker-keying, never duplicating.
  - **WorkflowRun half** (KT / IP-verification / credentials / `assertRunCompletable` gate) is near-worker-generic — engine + gate key on `workflowRunId`+`organizationId`. Extend by: (a) add `WORKER`/`EMPLOYEE` to `EntityType` (`contract.prisma:280`); (b) add nullable `workerId` FK on `WorkflowRun` (`workflow.prisma`); (c) a worker-aware `startRun` branch (today `startRunSchema` mandates `contractorId`, `startRun` hardcodes `entityType:'CONTRACTOR'` + `tx.contractor.findFirst`); (d) generalize `resolveAssignee` `CONTRACTOR_OWNER`/`CONTRACT_OWNER` + the "for {contractorName}" notification. **No gate/engine changes.**
  - **DeprovisioningRun half (F2 IdP saga)** is hard contractor-coupled — the biggest new build. Make `DeprovisioningRun.contractorId`+`.assignmentId` **nullable**, add `workerId`; source `externalUserId` from `Worker.email` + country from `EmployeeProfile.countryCode`; add a **dated termination signal** for the 14-day cooldown gate (none exists — `EmploymentStatus` is a status enum, not a dated event); add a worker-keyed sibling to `resolveAssignmentForContractor` + `use-start-deprovisioning`.
  - **Criterion-3 (locked):** compose with v6.0 F4 by extending the existing run, never duplicating.
- **D-02:** Reuse the v1.0 `WorkflowRun` engine (subject-agnostic template/task/condition/progress/overdue). NOT the org-member-import wizard.
- **D-03:** Per-market (PL/DE/UK/US) step templates ship as boot-upserted `WorkflowTemplate`s — extend `packages/offboarding-templates` (currently ROLE-keyed KT seeds; add jurisdiction-keying), register on compliance-policy register-on-import rails. Orgs can edit seeded templates afterward.
- **D-04:** Generate DRAFT PDFs on existing render+snapshot+R2 CAS infra (`form-1099-nec-pdf.ts` pattern + `@react-pdf/renderer`; `ir35-sds.tsx` is the legal-doc precedent). Add NEW cert templates (świadectwo pracy, Arbeitszeugnis qualified/simple, P45, W-2, etc.). Each doc PROMINENTLY watermarked "needs jurisdiction legal/tax adviser verification", archived as immutable snapshot.
- **D-05:** Government integrations (I-9+E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT filing) = STUB hooks + manual workflow steps. No live gov calls this phase (local-only). Mirror P90 ELStAM/ZUS stub idiom.

### Claude's Discretion
- Dated termination signal shape: new `EmploymentEvent` table vs `terminatedAt` field on `EmployeeProfile` vs workflow-run-completion reuse — must feed the IdP 14-day cooldown gate.
- Onboarding-vs-offboarding template taxonomy + per-market step-list granularity.
- E-Verify/ZUS/Abmeldung/RTI stub-hook interface shapes.
- `EntityType.USER` reuse vs new `WORKER`/`EMPLOYEE`.
- react-pdf template composition + which certs are v7.0 vs deferred (v7.5) if the set is large.

### Deferred Ideas (OUT OF SCOPE)
- Live government integrations (E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT filing) → stub now.
- Employee on/offboarding self-service portal surfaces → P96.
- Payroll final-pay computation → P94 consumes offboarding output.
- Probation-watchlist → P97 HR dashboard.
- Some cert templates may be v7.5 if the react-pdf set is large — planner scopes the v7.0 subset.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMP-ON-01 | Per-market onboarding workflow templates — PL (badania wstępne, PIT-2, PPK, IKE/IKZE), DE (Personalfragebogen, Steuer-ID lookup, SV-Ausweis, bAV), UK (P45/P46, RTI, pension auto-enrol), US (W-4, I-9+E-Verify hook, state W-4, direct-deposit) | Reuse `WorkflowTemplate`/`WorkflowTaskTemplate` + `startRun` (§Architecture Pattern 1); per-market boot seeds (§Pattern 3); ELStAM/E-Verify gov stubs (§Pattern 5). Steuer-ID lookup reuses `elstam-stub.ts`. |
| EMP-OFF-01 | Per-market offboarding — PL (świadectwo pracy, ekwiwalent, ZUS ZWUA, PIT-11), DE (Arbeitszeugnis, Abmeldung SV, Lohnsteuerbescheinigung), UK (P45, final RTI, pension, P11D), US (final paycheck, COBRA, W-2, 401k) | Same template rail + statutory-cert react-pdf templates with adviser-verify watermark (§Pattern 4); gov stubs for ZUS ZWUA / Abmeldung SV / RTI (§Pattern 5). ekwiwalent reads P92 leave balance. |
| EMP-OFF-02 | Employee offboarding composes with v6.0 F4 (IP verification, KT templates, IdP deprovisioning) — extends not duplicates | Worker-keyed `WorkflowRun` reuses `assertRunCompletable` unchanged (§Pattern 2); worker-keyed `DeprovisioningRun` (§Pattern 1, the spine); execution half already worker-agnostic (§DeprovisioningRun Blast Radius). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Worker-keyed workflow run lifecycle | API / Backend (`packages/api` workflow routers) | DB (schema) | `startRun` mutation + engine live in tRPC; schema needs `WorkflowRun.workerId`. |
| Worker-keyed IdP deprovisioning trigger | API / Backend (`deprovisioning.ts`) | DB (schema) | Trigger reads worker/employee, writes `DeprovisioningRun`; FKs go nullable + `workerId`. |
| IdP saga step execution | Queue / Worker tier (`apps/api` QStash route) | — | **Already worker-agnostic** — reads `externalUserId` off step row. No change. |
| Dated termination signal | DB (`EmployeeProfile.terminatedAt`) | API (write on TERMINATED) | Feeds pure cooldown gate; mirrors `ContractorAssignment.endedAt`. |
| Per-market template seeding | API boot hook (`post-org-create-hook.ts`) | DB (`WorkflowTemplate` + jurisdiction unique) | Idempotent per-org upsert on boot; org-editable rows. |
| Statutory cert PDF render + archive | API / Backend (`packages/api/src/services` + `pdf-templates`) | Storage (R2 per-region) | react-pdf render → immutable snapshot → R2 CAS. |
| Adviser-verify disclaimer text | Shared package (`packages/validators/legal`) | — | Locked bilingual phrases, CI-guarded absent from i18n. |
| Gov integration seams | API / Backend (`packages/api/src/services/*-stub.ts`) | — | Pure typed stub functions; manual workflow tasks complete them. |
| On/offboarding UI (start + run view) | Client / SPA (`apps/web-vite`) | — | Reuse `workflow-run/*` by `runId`; add worker-keyed trigger variant. |
| Cross-cutting tenancy / flag gate | API middleware | — | `assertWorkforceEnabled` + `withTenantScope` on every worker read/write. |

## Standard Stack

### Core (all already installed — NO new external packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-pdf/renderer` | ^4.5.1 | Statutory cert PDF templates | `[VERIFIED: packages/api/package.json:260]` — already the 1099-NEC / IR35-SDS renderer. |
| `date-fns` + `@date-fns/tz` (`TZDate`) | in-tree | Jurisdiction-TZ cooldown-boundary math | `[VERIFIED: idp-saga/src/cooldown.ts:1-2]` — the exact idiom the worker cooldown reuses. |
| `zod` | v4 (in-tree) | Discriminated-union `startRunSchema`, stub input schemas | `[VERIFIED: packages/validators/src/workflow.ts:133]` |
| Prisma + `prisma-client` generator | ^7.8.0 | Schema-additive migrations | `[VERIFIED: packages/db/package.json:26-52]` |

### Supporting (in-tree modules to reuse, not install)
| Module | Path | Purpose |
|--------|------|---------|
| `@contractor-ops/idp-saga` | `packages/idp-saga` | `canStartDeprovisioning`, `recomputeRunStatus`, `MAX_ATTEMPTS` — reuse unchanged. |
| `@contractor-ops/offboarding-templates` | `packages/offboarding-templates` | Boot-upsert **pattern** to mirror (not the KT rows). |
| `@contractor-ops/compliance-policy` | `packages/compliance-policy` | `Jurisdiction` type + register-on-import rails. |
| `putObjectAndSignDownload` | `packages/api/src/services/r2.ts` | R2 CAS archive of cert PDFs. |
| `writeAuditLog` | `packages/api/src/services/audit-writer.ts` | Audit new sensitive mutations. |
| `assertWorkforceEnabled` | `packages/api/src/middleware/require-workforce-flag.ts` | Per-request `module.workforce-employees` gate. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `terminatedAt` on `EmployeeProfile` | `EmploymentEvent` table | Event table gives a hire/terminate/suspend audit trail + reversibility, but is heavier; `terminatedAt` mirrors the proven `ContractorAssignment.endedAt` idiom exactly and feeds the cooldown gate with zero new join. **Recommend `terminatedAt` for v7.0; defer `EmploymentEvent` to v7.5** if an audit trail is needed. |
| New WorkflowTemplate boot seeds | Reuse `seedStarterTemplates` tRPC mutation | The tRPC mutation is user-triggered + org-specific; per-market templates must exist for **every** org on boot → use `runPostOrganizationCreateHooks` rail. |
| `EntityType.EMPLOYEE`/`WORKER` | Reuse `EntityType.USER` | `USER` = platform staff user (audit/notification semantics); an employee subject is not a staff user. Adding `EMPLOYEE`+`WORKER` also fixes the Phase-89 workaround where worker audit rows were forced to `resourceType: ORGANIZATION`. **Recommend add EMPLOYEE + WORKER.** |

**Installation:** None. All dependencies are already in the workspace. `[VERIFIED: packages/api/package.json]`

## Package Legitimacy Audit

**No external packages are installed in this phase.** All libraries used (`@react-pdf/renderer`, `date-fns`, `@date-fns/tz`, `zod`, Prisma) are pre-existing workspace dependencies verified in `packages/api/package.json` and `packages/db/package.json`. slopcheck / registry verification is **not applicable** — no new supply-chain surface is introduced. If the planner later decides a cert needs a new font or PDF helper, gate that single install behind a `checkpoint:human-verify` task and honor the repo's 7-day `minimumReleaseAge` rule (`[VERIFIED: CLAUDE.md §Monorepo & dependencies]`).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────── HR user (web-vite SPA) ───────────────────────┐
                    │  employee on/offboarding page → container → hook (sole tRPC boundary)  │
                    └───────────────┬───────────────────────────────┬───────────────────────┘
                                    │ start on/offboarding           │ trigger IdP deprovision
                                    ▼                                ▼
          ┌──────────────────────────────────┐        ┌──────────────────────────────────────┐
          │ workflow.startRun (worker branch) │        │ deprovisioning.startDeprovisioningRun │
          │  input: {templateId, workerId}    │        │  (worker branch: workerId)            │
          │  - load WorkflowTemplate + tasks   │        │  - load Worker.email + EmployeeProfile │
          │  - entityType EMPLOYEE, workerId    │        │    .countryCode + .terminatedAt        │
          │  - instantiateTaskRuns (reused)     │        │  - canStartDeprovisioning(  ◄── REUSED │
          │  - assertRunCompletable ◄── REUSED   │       │      {endedAt: terminatedAt, tz,        │
          └───────────────┬──────────────────────┘       │       status: 'ENDED'})                │
                          │ WorkflowRun(workerId)         │  - create DeprovisioningRun(workerId,  │
                          ▼                               │      contractorId NULL) + N steps       │
        ┌─────────────────────────────────────┐          └──────────────────┬────────────────────┘
        │  per-market WorkflowTaskRuns          │                            │ fan-out QStash jobs
        │  - MANUAL / DOCUMENT_COLLECTION tasks  │                            ▼ (body: externalUserId)
        │  - gov-stub-backed tasks (E-Verify…)   │        ┌──────────────────────────────────────┐
        │  - cert-generation tasks               │        │  /idp-deprovisioning/_step-runner       │
        └───────────────┬─────────────────────────┘       │  UNCHANGED — worker-agnostic already:    │
                        │ generate DRAFT cert               │  reads externalUserId off step row;      │
                        ▼                                   │  resolveDeprovisionToken(org,provider); │
        ┌─────────────────────────────────────┐            │  adapter.suspendAccount/revokeSessions  │
        │ renderStatutoryCert (react-pdf)       │            └──────────────────┬────────────────────┘
        │  - immutable snapshot (values-as-of)   │                             ▼
        │  - LOCKED adviser-verify disclaimer     │           recomputeRunStatus → run COMPLETED
        │  - CAS guard (pdfArchiveKey null)       │           → parent ACCESS_REVOKE task auto-closes
        │  - putObjectAndSignDownload → R2 (region)│
        └─────────────────────────────────────────┘

  Boot-time (per org): runPostOrganizationCreateHooks → upsert per-market WorkflowTemplates
                       (idempotent on @@unique([organizationId, jurisdiction, type, seedKey]))
```

### Recommended Project Structure
```
packages/db/prisma/schema/
├── workflow.prisma            # + WorkflowRun.workerId?; WorkflowTemplate.jurisdiction + seedKey + @@unique
├── idp-deprovisioning.prisma  # contractorId/assignmentId → nullable; + workerId? + relation + index
├── employee.prisma            # + terminatedAt DateTime?  (dated termination signal)
├── contract.prisma            # EntityType += EMPLOYEE, WORKER
└── migrations/__phase93_*/    # un-applied additive migration dirs (migration.sql + down.sql)

packages/employee-templates/    # NEW pkg (mirror offboarding-templates) OR extend offboarding-templates
├── seeds/{pl,de,uk,us}.ts       # typed-const WorkflowTemplate + task step-lists per jurisdiction × {ON,OFF}
├── upsert-on-boot.ts            # idempotent WorkflowTemplate upsert (mirror existing pattern)
└── index.ts

packages/api/src/
├── routers/workflow/workflow-execution-runs.ts   # + worker branch in startRun
├── routers/integrations/deprovisioning.ts        # + worker branch + resolveWorkerForDeprovisioning
├── routers/{workforce,employee}/employee-lifecycle-router.ts  # NEW: start on/offboard, generate cert
├── services/{i9-everify,zus-zwua,abmeldung-sv,hmrc-rti,pit-filing}-stub.ts  # gov seams (mirror elstam-stub)
├── services/statutory-cert-pdf.ts                 # render+snapshot+R2 CAS (mirror form-1099-nec-pdf)
└── pdf-templates/{swiadectwo-pracy,arbeitszeugnis,p45,w2,...}.tsx  # NEW react-pdf templates

packages/validators/src/
├── workflow.ts                 # startRunSchema → discriminated union (contractorId | workerId)
└── legal/disclaimers.ts        # + locked adviser-verify cert disclaimers (PL/DE/UK/US)

apps/web-vite/src/components/
├── workflows/workflow-run/*    # REUSE by runId (subject-agnostic)
└── {employees,idp}/hooks/use-start-*-worker.ts  # worker-keyed trigger variant
```

### Pattern 1: Worker-keyed `DeprovisioningRun` (the phase spine)
**What:** Make the IdP saga accept an employee subject without an assignment.
**When to use:** The offboarding `ACCESS_REVOKE` task for a `Worker(EMPLOYEE)`.
**The four coupling points (and only these four):**
```
1. Schema (idp-deprovisioning.prisma:11-12,20-21,27):
   contractorId String  →  String?     // DROP NOT NULL (additive ALTER)
   assignmentId String  →  String?     // DROP NOT NULL
   + workerId  String?                  // new nullable FK → Worker
   + worker    Worker? @relation(...)
   + @@index([organizationId, workerId])
   Enforce "exactly one of contractorId | workerId" in the mutation (+ optional raw CHECK).

2. deprovisioning.ts:202 startDeprovisioningRun — add a worker input path:
   externalUserId  ← Worker.email        (today: contractor.email, :236)
   jurisdictionTz  ← COUNTRY_TZ[EmployeeProfile.countryCode] (today: contractor.countryCode, :227)
   cooldown        ← canStartDeprovisioning({ endedAt: EmployeeProfile.terminatedAt,
                                              status: 'ENDED', jurisdictionTz })   // synthesize status
   create({ workerId, contractorId: null, assignmentId: null, steps: … })

3. resolveAssignmentForContractor (:177) — employees have NO assignment.
   Add resolveWorkerForDeprovisioning(workerId) OR bypass entirely (worker path
   supplies workerId directly; assignmentId stays null).

4. use-start-deprovisioning.ts — add a workerId input path (mirrors the existing
   contractorId → resolver path but resolves nothing; passes workerId straight through).
```
**Source:** `[VERIFIED: packages/api/src/routers/integrations/deprovisioning.ts:202-345]`, `[VERIFIED: packages/db/prisma/schema/idp-deprovisioning.prisma:8-29]`

**UNCHANGED (worker-agnostic already — do NOT touch):**
- `apps/api/src/routes/idp-deprovisioning.ts` (step runner) `[VERIFIED: reads only body.organizationId/runId/stepId/provider/stepKind/externalUserId]`
- `idp-deprovisioning-step-runner.ts` `stepRunnerBodySchema` `[VERIFIED: :19-25 — externalUserId only, no contractorId]`
- `idp-token-resolver.ts` `[VERIFIED: keys on organizationId + provider, :42-47]`
- `cooldown.ts` `canStartDeprovisioning` `[VERIFIED: pure, keys on {status, endedAt, jurisdictionTz}]`
- `recomputeRunStatus`, `DeprovisioningStep`, `IdpChangeProvenance`, all adapters.

### Pattern 2: Worker-keyed `WorkflowRun` (cheap extension)
**What:** Add a `workerId` subject path to `startRun`; the engine + gate are already generic.
```
Schema (workflow.prisma:105-147):
  contractorId String?  already nullable ✓
  + workerId  String?  + worker Worker? @relation + @@index([organizationId, workerId])
  entityType: EntityType  →  set 'EMPLOYEE' for employee runs

Validator (validators/workflow.ts:133): startRunSchema → z.discriminatedUnion on subject:
  { templateId, contractorId }  |  { templateId, workerId }

startRun (workflow-execution-runs.ts:38): branch on input:
  - worker branch: tx.worker.findFirst({ workerType:'EMPLOYEE' }) instead of tx.contractor.findFirst (:57)
  - create({ entityType:'EMPLOYEE', entityId: worker.id, workerId: worker.id, contractorId: null })
  - instantiateTaskRuns(tx, org, runId, tasks, workerBag, null, now)  ← pass employee-shaped bag
```
**Reused unchanged:** `assertRunCompletable` (IP + PENDING-credential gate, keys on `workflowRunId`+`org`) `[VERIFIED: workflow-shared.ts:314-367]`; `calculateProgress`, `unblockDependentsAndRecomputeRun`, `instantiateTaskRuns` (structurally typed `contractor: {id; [k]:unknown}` — an employee bag satisfies it) `[VERIFIED: workflow-execution-shared.ts:196]`.
**resolveAssignee caveat:** `CONTRACTOR_OWNER`/`CONTRACT_OWNER` modes read `internalOwnerUserId`, which employees lack `[VERIFIED: workflow-shared.ts:159-162]`. **Design employee templates to use `ROLE_BASED`** (Phase-89 HR roles: `hr_admin`/`hr_manager`/`payroll_officer`/`leave_approver`) **or `FIXED_USER`** — do not rely on the owner modes. Optionally generalize `resolveAssignee` to accept an `EMPLOYEE_HR_OWNER` mode.

### Pattern 3: Per-market `WorkflowTemplate` boot seeds (NOT the KT registry)
**What:** Idempotent per-org upsert of PL/DE/UK/US × {ONBOARDING, OFFBOARDING} `WorkflowTemplate` rows.
**Critical distinction** `[VERIFIED]`:
- `offboarding-templates/seeds.ts` seeds `WorkflowRoleTemplate`/`WorkflowRoleTaskTemplate` — the **KT role registry** consumed by `startOffboardingRun` template auto-selection `[VERIFIED: seeds.ts:9, workflow-roles.ts selectForContractor:203]`. **Do NOT put per-market step lists here.**
- `startRun` instantiates `WorkflowTemplate`→`WorkflowTaskTemplate` `[VERIFIED: workflow-execution-runs.ts:43-51,99]`. **Per-market templates are these rows.**
**Mechanics to reuse:** the boot-upsert pattern from `upsert-on-boot.ts` + its call site `runPostOrganizationCreateHooks(prisma, orgId)` (fail-soft, logged-not-thrown) `[VERIFIED: post-org-create-hook.ts:14-28]`.
**Schema requirement:** `WorkflowTemplate` has **no** compound unique today → idempotent upsert is impossible without one. Add `jurisdiction String?` + a stable `seedKey String?` + `@@unique([organizationId, jurisdiction, type, seedKey])`. Seed with `status: DRAFT` + `appliesToEntityType: EMPLOYEE` so orgs review/activate/edit (mirrors `seedStarterTemplates` DRAFT posture `[VERIFIED: workflow-templates.ts:467`, `status:'DRAFT']`).
**compliance-policy rails:** mirror the `policies/{uk,de,pl,us}.ts` register-on-import typed-const idiom `[VERIFIED: compliance-policy/src/index.ts:7-12]` for the **template content definitions** (a `Jurisdiction`-keyed const map); the DB rows are materialized on boot. `Jurisdiction = 'UK'|'DE'|'PL'|'US'|'KSA'|'UAE'` `[VERIFIED: compliance-policy/src/types.ts:6]`.

### Pattern 4: Statutory cert PDF (render → immutable snapshot → R2 CAS)
**What:** Generate a DRAFT, adviser-verify-watermarked cert PDF, archived immutably.
```
service (mirror form-1099-nec-pdf.ts):
  1. build immutable snapshot (values-as-of-generation; never a live recompute) [VERIFIED: form-1099-nec-pdf.ts:5,124]
  2. CAS guard: updateMany({ where:{ id, pdfArchiveKey:null }, data:{ pdfArchiveKey }}) → count 0 short-circuits [VERIFIED: :115-122]
  3. renderToBuffer(<CertDocument …snapshot/>) — lazy import @react-pdf/renderer [VERIFIED: :40]
  4. putObjectAndSignDownload({ key:`emp-cert/<orgId>/<id>.pdf`, body, ttlSeconds:60 }) [VERIFIED: :127-134]
  key is org-scoped (ASVS V4) [VERIFIED: :56-59]; R2 bucket routes per region (EU for PL/DE/UK, US for US-org).

template (mirror ir35-sds.tsx): Document/Page/Text/View + StyleSheet [VERIFIED: ir35-sds.tsx:16]
  + a PROMINENT locked disclaimer from packages/validators/legal/disclaimers.ts (see Pattern below).
```
**Adviser-verify watermark idiom** `[VERIFIED]`: legal disclaimers are **locked bilingual const strings** in `disclaimers.ts`, added to `RESERVED_DISCLAIMER_KEYS` + `LOCKED_DISCLAIMERS`, CI-guarded absent from `messages/*.json` (locked-phrases-guard). `[VERIFIED: disclaimers.ts:28,111-139; SDS_DISCLAIMER_EN "…does not constitute legal advice…Consult a qualified UK tax adviser"]`. Add e.g. `CERT_ADVISER_VERIFY_PL/DE/EN` strings ("This document is a DRAFT and needs verification by a jurisdiction-specific legal/tax adviser before use.") and render them as a fixed watermark/footer on every cert.
**Storage model:** add a dedicated `StatutoryCertificate` model (snapshotJson + pdfArchiveKey + workflowRunId + status) mirroring `Form1099Nec`, so the immutable-snapshot + CAS double-render guard carries over; link it to the run via the existing `WorkflowAttachment`/`Document` rail for UI download.

### Pattern 5: Gov stub seam (mirror `elstam-stub.ts`)
**What:** A typed, network-free seam a later live integration slots into.
```
// mirror packages/api/src/services/elstam-stub.ts  [VERIFIED: :55-62]
export interface ZwuaSubmitInput { pesel: string; terminationDate: string; … }
export interface GovStubResult { source: 'STUB'; available: false; note: string; }
export function submitZusZwua(input): GovStubResult {
  return { source:'STUB', available:false,
           note:`ZUS ZWUA submission stubbed for PESEL ending ${input.pesel.slice(-2)} — no live PUE ZUS channel wired.` };
}
```
Each gov interaction = one stub function + one **manual** `WorkflowTaskTemplate` (`taskType: MANUAL` or `NOTIFICATION`) the HR user completes by hand. No network calls. Applies to: I-9+E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT-2/PIT-11. Steuer-ID lookup **reuses the existing `lookupElstam`** `[VERIFIED: elstam-stub.ts]`.

### Anti-Patterns to Avoid
- **Duplicating the offboarding run for employees.** Criterion-3 is explicit: extend the existing `WorkflowRun`/`DeprovisioningRun`. `[VERIFIED: CONTEXT D-01]`
- **Seeding per-market step lists into `WorkflowRoleTemplate`.** That's the KT registry — wrong model. Use `WorkflowTemplate`.
- **Touching the IdP step runner / token resolver / cooldown.** They're worker-agnostic; changing them is churn + regression risk.
- **Relying on `CONTRACTOR_OWNER` assignee mode for employees.** Employees have no `internalOwnerUserId`; use `ROLE_BASED`.
- **Running `prisma migrate dev` against the shared DB.** History is drift-blocked — author `__`-prefixed un-applied migrations (see Pitfall 1).
- **Presenting any cert as adviser-approved.** Local-only, legal DEFERRED, solo-founder liability — DRAFT + watermark only. `[VERIFIED: STATE.md Standing Constraints]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 14-day cooldown boundary math | Custom date-diff | `canStartDeprovisioning` (`idp-saga/cooldown.ts`) | TZ-correct `startOfDay(endedAt+14d)` in jurisdiction TZ; pure + already tested. `[VERIFIED]` |
| IdP step orchestration | New saga runner | Existing `startDeprovisioningRun` + step runner + `recomputeRunStatus` | Fan-out, retries, idempotency, provenance already solved. `[VERIFIED]` |
| Offboarding-completion gate | New IP/credential check | `assertRunCompletable` | IP_VERIFICATION hard-block + PENDING-cred soft-warn already implemented. `[VERIFIED: workflow-shared.ts:314]` |
| PDF render + immutable archive | Custom render loop | `form-1099-nec-pdf.ts` render+snapshot+CAS pattern | Double-render guard + org-scoped R2 key already solved. `[VERIFIED]` |
| Idempotent per-org seeding | Ad-hoc create loop | `upsert-on-boot.ts` upsert-on-compound-unique pattern | Re-run-safe; boot hook already wired. `[VERIFIED]` |
| Legal disclaimer i18n | New i18n keys | Locked const strings in `disclaimers.ts` | CI-guarded from translation drift; the vetted-text pattern. `[VERIFIED]` |
| Workforce access gate | New flag check | `assertWorkforceEnabled` + conditional root.ts spread | Three-layer flag-off already established (P89). `[VERIFIED: require-workforce-flag.ts]` |

**Key insight:** The v6.0 F4 saga and v1.0 workflow engine were built subject-agnostic at the seams that matter (run-keyed gate, org+provider token resolution, externalUserId-carrying steps). The phase's job is to feed employee data into those seams, not to re-implement them.

## Runtime State Inventory

> Rename/refactor-adjacent: making non-null FKs nullable + adding subject columns touches live-run state. All five categories answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `DeprovisioningRun` rows have NON-NULL `contractorId`/`assignmentId`. Dropping NOT NULL is additive — existing rows keep values; new employee runs write `workerId` + NULL contractor FKs. `WorkflowRun` rows: `contractorId` already nullable ✓. | Additive ALTER `DROP NOT NULL`; no data migration of existing rows. |
| Live service config | IdP provider toggles live in `Organization.settingsJson.idpDeprovisioningEnabled` (not in git) — **unchanged**, worker runs read the same per-org toggle map. `[VERIFIED: deprovisioning.ts:84-93]` | None. |
| OS-registered state | None — no OS/Task-Scheduler/pm2 state embeds contractor/employee identity for this phase. | None — verified by scope (all state is DB + R2). |
| Secrets/env vars | No new secret **names**. IdP tokens resolved via existing `IntegrationConnection.credentialsRef` keyed on org+provider — worker-agnostic. `SSN_ENCRYPTION_KEY`/`EMPLOYEE_PII_ENCRYPTION_KEY` already exist (P90). New R2 bucket already provisioned (US) via P83. | None. |
| Build artifacts | Prisma **generated client is tracked in-repo**; schema edits must be paired with `db:generate` or `db:check-drift` (CI gate) fails. `[VERIFIED: package.json db:check-drift]` | Run `db:generate` in the same change set as every schema edit; commit the regenerated client. |

**The canonical question — after every file is updated, what runtime state still holds the old assumption?** Only the **DB constraint** (`DeprovisioningRun.contractorId NOT NULL`) and the **generated Prisma client**. Both are handled by the additive migration + `db:generate`. No cache/queue/OS state assumes contractor-only.

## Common Pitfalls

### Pitfall 1: `prisma migrate dev` is drift-blocked on the shared DB
**What goes wrong:** Running `db:migrate:dev` errors on pre-existing migration-history drift; every v7.0 phase (82–90) hit this.
**Why it happens:** The shared dev DB diverged from the applied-migration namespace before v7.0.
**How to avoid:** Author each migration as an `__`-prefixed **un-applied** dir (`migration.sql` + `down.sql`) — e.g. `migrations/__phase93_worker_lifecycle/` — exactly as Phase 89 did (`__worker_base_additive/`). Run only `prisma generate` (pure codegen) locally. Per-region apply (`db:migrate:all` EU/ME/US) defers to a `[BLOCKING]` human gate per LOCAL-ONLY posture. `[VERIFIED: STATE.md 89-02/89-03 SUMMARY; ls migrations/__worker_base_additive]`
**Warning signs:** `P3009`/drift errors; CI `db:check-drift` red.

### Pitfall 2: Enum casing audit rejects lowercase members
**What goes wrong:** `db:audit-enum-casing` fails if new `EntityType` members aren't `UPPER_SNAKE_CASE`.
**How to avoid:** `EMPLOYEE`, `WORKER` (and any `EmploymentEventKind` if chosen: `TERMINATED`, `HIRED`) must be UPPER_SNAKE. `[VERIFIED: STATE.md Standing Constraints; package.json db:audit-enum-casing]`

### Pitfall 3: "Exactly one subject" invariant can't be a Prisma relation constraint
**What goes wrong:** Both `contractorId` and `workerId` end up null (or both set) on a run.
**How to avoid:** Enforce in the mutation (branch on discriminated-union input); optionally add a raw SQL `CHECK ((contractorId IS NOT NULL) <> (workerId IS NOT NULL))` in the migration for defense-in-depth. `startRunSchema`/`startDeprovisioningRun` input as `z.discriminatedUnion` makes the API-level guarantee.

### Pitfall 4: i18n parity + hardcoded-string lint on new UI/templates
**What goes wrong:** New employee-lifecycle UI strings break `i18n:parity` (en/de/pl/ar + en-US) or trip the hardcoded-string guard.
**How to avoid:** Every user-facing string via `useTranslations` with parity across all locales; **cert disclaimer text is the exception** — it lives as locked const in `disclaimers.ts` and must be **absent** from `messages/*.json` (locked-phrases-guard enforces this). `[VERIFIED: STATE.md; disclaimers.ts:5-8]`

### Pitfall 5: web-vite data-layer / layering guards
**What goes wrong:** Adding tRPC calls in a Page or Container trips `check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-presentational`.
**How to avoid:** Page = thin composer (Suspense/permissions, no tRPC); Container calls domain hooks; **hook is the sole tRPC boundary**; Component is presentational. The worker-keyed trigger must be a hook variant (mirror `use-start-deprovisioning.ts` which resolves server-side to keep the guard green). `[VERIFIED: CLAUDE.md §web-vite UI layers; use-start-deprovisioning.ts:1-13]`

### Pitfall 6: Cross-org leak on new tenant-owning reads
**What goes wrong:** Employee-lifecycle reads/writes leak across orgs (IDOR).
**How to avoid:** `Worker`/`EmployeeProfile` are tenant-owning (absent from `globalModels`, inherit `withTenantScope`) `[VERIFIED: worker.prisma:8-10, employee.prisma:7-10]`. Add a two-org cross-leak regression test for any new model (`StatutoryCertificate`, per-market template rows) per the v7.0 standing decision. `[VERIFIED: STATE.md "two-org cross-leak test per new model"]`

### Pitfall 7: US cooldown TZ has no single value
**What goes wrong:** `COUNTRY_TZ` map has DE/GB/PL/SA/AE but **no US** entry `[VERIFIED: deprovisioning.ts:103-110]`; US TZ varies by state.
**How to avoid:** Add a conservative US default (e.g. `America/New_York`) to `COUNTRY_TZ`, or (better) source per-employee TZ from `EmployeeProfile.countryFields`/state if present; the cooldown is TZ-identical for all valid IANA zones, so a conservative default is safe. Document the choice.

## Code Examples

### Discriminated-union `startRunSchema` (validators/workflow.ts:133)
```typescript
// Source: [VERIFIED current: packages/validators/src/workflow.ts:133]
// TODAY: z.object({ templateId, contractorId: z.string().min(1), contractId: optionalFk })
// TARGET:
export const startRunSchema = z.discriminatedUnion('subjectType', [
  z.object({ subjectType: z.literal('CONTRACTOR'), templateId: z.string().min(1),
             contractorId: z.string().min(1), contractId: optionalFk }),
  z.object({ subjectType: z.literal('EMPLOYEE'), templateId: z.string().min(1),
             workerId: z.string().min(1) }),
]);
```

### Worker cooldown reuse (deprovisioning.ts worker branch)
```typescript
// Source: [VERIFIED pattern: deprovisioning.ts:225-236 + idp-saga/cooldown.ts]
const emp = await ctx.db.employeeProfile.findFirst({
  where: { workerId: input.workerId, organizationId: ctx.organizationId },
  select: { countryCode: true, terminatedAt: true, worker: { select: { email: true } } },
});
const decision = canStartDeprovisioning({
  endedAt: emp.terminatedAt ?? null,          // dated termination signal (recommended shape)
  status: emp.terminatedAt ? 'ENDED' : 'ACTIVE',
  jurisdictionTz: COUNTRY_TZ[emp.countryCode] ?? DEFAULT_JURISDICTION_TZ,
});
const externalUserId = emp.worker.email;      // was contractor.email
```

### Gov stub seam (mirror elstam-stub.ts)
```typescript
// Source: [VERIFIED idiom: packages/api/src/services/elstam-stub.ts:55-62]
export function submitAbmeldungSv(input: AbmeldungSvInput): GovStubResult {
  return { source: 'STUB', available: false,
    note: `Abmeldung SV stubbed for SV-Nr ending ${input.svNumber.slice(-2)} — no live DEÜV channel wired in this deployment.` };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Offboarding = contractor-only `WorkflowRun` + `DeprovisioningRun` | Worker-keyed subject (contractor OR employee) | Phase 93 (this) | Both models gain `workerId`; contractor FKs go nullable. |
| IdP saga assumed a `ContractorAssignment.endedAt` cooldown source | Employee path uses `EmployeeProfile.terminatedAt` | Phase 93 | New dated signal; cooldown gate unchanged. |
| Worker audit rows forced to `resourceType: ORGANIZATION` (no EntityType member) | `EntityType.EMPLOYEE`/`WORKER` added | Phase 93 | Cleaner audit resourceType; fixes P89 workaround. `[VERIFIED: STATE.md 89-03]` |

**Deprecated/outdated:** none relevant — all reused infra is current (v6.0 shipped 2026-06-07).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `terminatedAt` on `EmployeeProfile` is the best dated-termination-signal shape (vs `EmploymentEvent`) | Alternatives / Pattern 1 | If an audit trail of employment events is required, planner picks `EmploymentEvent`; both feed the cooldown gate identically. Discretion item — confirm with planner. |
| A2 | Adding `EMPLOYEE`+`WORKER` to `EntityType` (vs reusing `USER`) | Standard Stack Alternatives | Reusing `USER` would work mechanically but pollutes staff-user semantics; low risk, discretion item. |
| A3 | v7.0 cert subset = PL świadectwo pracy + PIT-11, DE Arbeitszeugnis(simple) + Lohnsteuerbescheinigung, UK P45, US W-2; qualified Arbeitszeugnis / P11D / COBRA / 401k packets deferred v7.5 | Pattern 4 / Open Q | If a market demands a deferred cert now, scope grows; planner confirms the subset. |
| A4 | US cooldown TZ default `America/New_York` is acceptable (state TZ not modeled) | Pitfall 7 | Cooldown is TZ-identical across IANA zones, so impact is only the displayed earliest-date string; low risk. |
| A5 | Per-market template content is authored as typed-const seeds (not user-entered) and materialized DRAFT on boot | Pattern 3 | If content must be legally vetted before shipping, seeds ship watermarked-DRAFT (consistent with Standing Constraint). |
| A6 | `StatutoryCertificate` as a new dedicated model (vs reusing `Document` only) | Pattern 4 | If reusing `Document`+`WorkflowAttachment` alone, the immutable-snapshot + CAS guard must be reimplemented; dedicated model is cleaner. Discretion. |

## Open Questions

1. **Dated termination signal shape (Discretion D-01).**
   - Known: no dated termination field exists; `EmploymentStatus` is a bare enum `[VERIFIED: employee.prisma:45,58-63]`; `ContractorAssignment.endedAt` is the proven precedent (Phase 76 D-06 "administrative termination instant, distinct from activeTo, drives the 14-day cooldown") `[VERIFIED: contractor.prisma:212-215]`.
   - Unclear: whether HR needs a full event history.
   - Recommendation: **`EmployeeProfile.terminatedAt DateTime?`** for v7.0 (mirrors `endedAt`, minimal blast radius, feeds cooldown directly); revisit `EmploymentEvent` in v7.5 if audit history is required.

2. **v7.0 cert subset vs v7.5 deferrals.**
   - Known: the full list (świadectwo pracy, PIT-11, Arbeitszeugnis qualified+simple, Lohnsteuerbescheinigung, P45, P11D, W-2, COBRA, 401k) is large; each is a react-pdf template + locked disclaimer.
   - Recommendation: ship the **structured, form-shaped** certs first (świadectwo pracy, P45, W-2, Lohnsteuerbescheinigung, simple Arbeitszeugnis); defer **free-text narrative** (qualified Arbeitszeugnis) and **US benefits packets** (COBRA, 401k rollover) to v7.5. Planner locks the subset.

3. **Onboarding vs offboarding template taxonomy (Discretion).**
   - Recommendation: two `WorkflowTemplate.type` values already exist (`ONBOARDING`/`OFFBOARDING`) `[VERIFIED: workflow.prisma:255-257]`; seed 8 templates = 4 jurisdictions × 2 types, keyed `@@unique([organizationId, jurisdiction, type, seedKey])`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-pdf/renderer` | Cert PDFs | ✓ | ^4.5.1 | — |
| Prisma + prisma-client generator | Schema/migration | ✓ | ^7.8.0 | — |
| R2 (EU bucket) | PL/DE/UK cert archive | ✓ | — | — |
| R2 (US bucket) | US cert archive | ✓ (provisioned P83) | — | Lazy-throws if `R2_BUCKET_NAME_US` unset |
| QStash / Upstash | IdP step fan-out | ✓ (existing saga) | — | — |
| Phase 90 `EmployeeProfile` | countryCode / employmentStatus / terminatedAt attach | ⚠ mid-execution at context time | — | **BLOCKING — must land before 93 execution** |
| Phase 89 `Worker(EMPLOYEE)` + `module.workforce-employees` | subject + flag gate | ✓ (89 complete, per STATE.md) | — | — |

**Missing dependencies with no fallback:** Phase 90 `EmployeeProfile` (hard dep — 93 can be *planned* now, *executed* only after 90 lands `terminatedAt`-capable profile).
**Missing dependencies with fallback:** US R2 bucket lazy-throws if env unset (matches P83 posture) — non-blocking for PL/DE/UK.

## Validation Architecture

> `nyquist_validation: true` (`.planning/config.json`) — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) `[VERIFIED: packages/api/package.json:231, apps/web-vite/package.json:18]` |
| Config file | `packages/api/vitest.config.ts`; root `vitest.config.ts` / `vitest.monorepo.ts` |
| Quick run command | `pnpm --filter @contractor-ops/api test <path>` |
| Full suite command | `pnpm --filter @contractor-ops/api test` (scoped) |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` `[VERIFIED: MEMORY feedback_test_run_memory]`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMP-OFF-02 | Worker-keyed `startRun` creates `WorkflowRun(entityType=EMPLOYEE, workerId, contractorId=null)` | unit | `pnpm -F @contractor-ops/api test workflow-execution-runs` | ❌ Wave 0 |
| EMP-OFF-02 | Worker `DeprovisioningRun` cooldown gate reads `EmployeeProfile.terminatedAt` + blocks pre-cooldown | unit | `pnpm -F @contractor-ops/api test deprovisioning` | ❌ Wave 0 |
| EMP-OFF-02 | `assertRunCompletable` still gates worker offboarding (IP + PENDING creds) | unit (regression) | `pnpm -F @contractor-ops/api test workflow-shared` | ✅ (extend) |
| EMP-OFF-02 | Step runner processes a worker-run step unchanged (externalUserId from step) | unit (regression) | `pnpm -F @contractor-ops/api test idp-deprovisioning-step-runner` | ✅ (assert no change) |
| EMP-ON-01 / EMP-OFF-01 | Per-market template boot-upsert is idempotent (re-run = no dup) | unit | `pnpm -F @contractor-ops/<pkg> test upsert-on-boot` | ❌ Wave 0 (mirror existing seeds test) |
| EMP-OFF-01 | Cert PDF: immutable snapshot + CAS guard (second render skips) + disclaimer present | unit | `pnpm -F @contractor-ops/api test statutory-cert-pdf` | ❌ Wave 0 |
| EMP-ON/OFF | Gov stub returns `{source:'STUB', available:false}` + no network | unit | `pnpm -F @contractor-ops/api test *-stub` | ❌ Wave 0 (mirror elstam-stub tests) |
| all | New tenant-owning models don't leak cross-org (IDOR) | integration | `pnpm -F @contractor-ops/api test *cross-org*` | ❌ Wave 0 |
| EMP-OFF-01 | Cert disclaimer strings absent from `messages/*.json` (locked-phrases) | guard | existing locked-phrases-guard test | ✅ (extend) |

### Sampling Rate
- **Per task commit:** scoped `pnpm -F @contractor-ops/api test <changed-path>` (< 30s).
- **Per wave merge:** `pnpm -F @contractor-ops/api test` + `pnpm typecheck --filter=@contractor-ops/api` + the touched lint guards (`lint:schema`, `lint:audit-log`, `db:audit-enum-casing`, `i18n:parity`, `check:web-vite-*`).
- **Phase gate:** full scoped API suite green + `db:check-drift` green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/api/src/routers/workflow/__tests__/worker-start-run.test.ts` — EMP-OFF-02 worker branch
- [ ] `packages/api/src/routers/integrations/__tests__/worker-deprovisioning.test.ts` — worker cooldown + nullable-FK run creation
- [ ] `packages/<employee-templates>/src/__tests__/upsert-on-boot.test.ts` — idempotency (mirror `offboarding-templates/__tests__/upsert-on-boot.test.ts`)
- [ ] `packages/api/src/services/__tests__/statutory-cert-pdf.test.ts` — snapshot + CAS + disclaimer
- [ ] `packages/api/src/services/__tests__/*-stub.test.ts` — gov seam shape (mirror ELStAM)
- [ ] Two-org cross-leak regression for `StatutoryCertificate` + per-market template rows
- [ ] Extend locked-phrases-guard with new cert disclaimer keys

## Security Domain

> `security_enforcement` absent = enabled. Included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Reuses Better Auth session; no new auth. |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | `assertWorkforceEnabled` per-request + conditional root.ts spread; `withTenantScope` on `Worker`/`EmployeeProfile`; R2 cert keys org-scoped (`emp-cert/<orgId>/…`); HR-role RBAC (P89 `hr_admin`/`hr_manager`/`payroll_officer`) on lifecycle mutations. `[VERIFIED]` |
| V5 Input Validation | **yes** | Zod on every tRPC input (`startRunSchema` union, stub inputs, cert-generate input); `.strict()` employee schemas reject injected `organizationId`/`workerType`. `[VERIFIED: employee.ts]` |
| V6 Cryptography | no (reuse) | PII already encrypted in dedicated columns (`EMPLOYEE_PII_ENCRYPTION_KEY`, P90) — cert snapshots must carry only `*Last4`, never full national IDs (mirror 1099-NEC snapshot stripping). `[VERIFIED: form-1099-nec-pdf.ts:28 "TIN last-4 ONLY"]` |
| V7/V8 Logging & Data Protection | **yes** | `writeAuditLog` on worker startRun, worker startDeprovisioningRun, cert generation, `terminatedAt` write; no PII in logs. `[VERIFIED: audit-writer pattern]` |

### Known Threat Patterns for {worker-keyed multi-tenant lifecycle}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org employee/cert read (IDOR) | Information Disclosure | `withTenantScope` (tenant-owning models) + two-org leak test + org-scoped R2 key. |
| Full national ID leaking into cert snapshot/PDF | Information Disclosure | Snapshot carries `*Last4` only; recursive strip like `buildFormSnapshot`. `[VERIFIED: STATE.md 85-03 snapshot PII strip]` |
| Subject spoofing (both/neither subject FK set) | Tampering | Discriminated-union input + raw `CHECK` on run row. |
| Cooldown bypass to deprovision early | Elevation / Tampering | Server re-runs `canStartDeprovisioning` (UI cannot bypass); no admin override — must edit `terminatedAt` (audited). `[VERIFIED: cooldown.ts:9-15, deprovisioning.ts:225-234]` |
| Flag-off surface still reachable | Elevation | Conditional root.ts spread (METHOD_NOT_FOUND) + per-request `assertWorkforceEnabled`. `[VERIFIED]` |
| Cert presented as legal advice | Repudiation / liability | Prominent locked adviser-verify watermark; DRAFT status; signoff-registry PENDING. `[VERIFIED: Standing Constraint]` |

## Project Constraints (from CLAUDE.md)

- **Tenant from session** (`organizationId`, region) — never from client input; RLS + `withTenantScope` on all new reads/writes.
- **`writeAuditLog`** on every sensitive mutation (pass `tx` in transactions).
- **Zod** on every tRPC procedure; webhooks/cron use `safeParse`, no unsafe `as` on external payloads.
- **No `console.*`** in app source — use `@contractor-ops/logger` (`createLogger`, `createCronLogger`, `getIdpAuditLogger`).
- **Feature flags** only via `@contractor-ops/feature-flags` (`module.workforce-employees`); keys in `registry.ts`.
- **i18n parity** en/de/pl/ar (+ en-US for US surfaces); no hardcoded user-facing strings; **cert disclaimers are locked const, absent from `messages/*.json`**.
- **web-vite layering:** Page (thin) → Container → Hook (sole tRPC boundary) → Component (presentational); run `check:web-vite-data-layer` etc.
- **Prisma:** `prisma-client` generator; migrations via `migrate dev` **but** drift-blocked → author `__`-prefixed un-applied dirs; pair every schema edit with `db:generate` (CI `db:check-drift`); enum values UPPER_SNAKE (`db:audit-enum-casing`); multi-region `db:migrate:all` deferred to human gate.
- **Deps:** no new external packages this phase; if unavoidable, 7-day `minimumReleaseAge` + `pnpm audit` + typosquat check + `checkpoint:human-verify`.
- **Docs-follow-code:** update wiki (`domains/worker-onboarding-offboarding`, `structure/{prisma-schema-areas,key-services,api-routers-catalog}`, `patterns/{workflow-engine,offboarding}`, `log.md`, `hot.md`) + `MEMORY.md` invariants + `pnpm check:wiki-brain` in the SAME change set.
- **Git safety:** no `git stash`/`reset --hard`/`restore` without explicit approval.
- **`.planning/phases` is a symlink** — stage planning commits via real `milestones/v7.0-phases/` path; GSD plan/execute run inline (nested agents can't spawn subagents).

## Sources

### Primary (HIGH confidence — in-tree, current HEAD)
- `packages/api/src/routers/integrations/deprovisioning.ts` — startDeprovisioningRun, resolveAssignmentForContractor, COUNTRY_TZ, cooldown reuse
- `packages/db/prisma/schema/idp-deprovisioning.prisma` — DeprovisioningRun/Step FKs + indexes
- `packages/db/prisma/schema/workflow.prisma` — WorkflowRun/Template/TaskRun + enums
- `packages/api/src/routers/workflow/{workflow-execution-runs,workflow-shared,workflow-execution-shared}.ts` — startRun, assertRunCompletable, instantiateTaskRuns, resolveAssignee
- `packages/validators/src/workflow.ts:133` — startRunSchema
- `packages/db/prisma/schema/{worker,employee,contractor,contract}.prisma` — Worker/EmployeeProfile/EntityType/ContractorAssignment.endedAt
- `packages/idp-saga/src/cooldown.ts` — canStartDeprovisioning
- `apps/api/src/routes/idp-deprovisioning.ts` + `packages/api/src/services/idp-deprovisioning-step-runner.ts` + `idp-token-resolver.ts` — worker-agnostic execution half
- `packages/offboarding-templates/src/{seeds,upsert-on-boot,types}.ts` + `packages/api/src/services/post-org-create-hook.ts` — boot-upsert pattern
- `packages/api/src/services/form-1099-nec-pdf.ts` + `pdf-templates/ir35-sds.tsx` + `packages/validators/src/legal/disclaimers.ts` — cert render + locked disclaimer
- `packages/api/src/services/elstam-stub.ts` — gov stub idiom
- `packages/compliance-policy/src/{index,types}.ts` — register-on-import + Jurisdiction type
- `packages/api/src/middleware/require-workforce-flag.ts` + `root.ts:168-182` — flag gate + mount
- `packages/db/package.json` + root `package.json` — migrate/lint scripts; `STATE.md` — drift posture, standing constraints

### Secondary / Tertiary
- None required — every claim verified against source; no WebSearch used (all knowledge is repo-local).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps verified present in-tree; no external installs.
- Architecture / blast radius: HIGH — every coupling point read at source; worker-agnostic seams confirmed by reading the step runner + token resolver + cooldown.
- Per-market template mechanics: HIGH — the WorkflowTemplate-vs-WorkflowRoleTemplate distinction verified by reading both registries + startRun + startOffboardingRun.
- Cert PDF pipeline: HIGH — render+snapshot+CAS + locked-disclaimer verified.
- Dated-termination-signal recommendation: MEDIUM — discretion item; recommendation grounded in the verified `ContractorAssignment.endedAt` precedent but final shape is the planner's call.

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (stable repo infra; re-verify line numbers if HEAD advances — Phases 87/90/91 executing concurrently)
