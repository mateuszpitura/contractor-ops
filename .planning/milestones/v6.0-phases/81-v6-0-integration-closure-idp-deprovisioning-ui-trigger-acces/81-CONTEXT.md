# Phase 81: v6.0 Integration Closure — IdP deprovisioning UI trigger + multi-provider run steps + compliance payment-block recovery - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the two source-confirmed E2E integration blockers from the v6.0 milestone audit
(`.planning/v6.0-MILESTONE-AUDIT.md`). Both are seams where a phase's own deliverables are
correct in isolation but were never wired to a downstream step:

- **INT-01** — The IdP-deprovisioning saga (`startDeprovisioningRun`, phases 76/77/78) has **zero
  callers in `apps/web-vite`**, so the F2 "differentiator" is unreachable from the UI. This phase
  adds the admin trigger (offboarding `ACCESS_REVOKE` + assignment detail) and un-hardcodes
  `PROVIDERS_FOR_RUN` so a run spans the org's enabled, executable providers (not just GWS).
- **INT-02** — `approveUploadReplacement` flips a compliance item to `SATISFIED` but never fires the
  recovery hook, so an approved portal upload leaves the contractor payment-blocked. This phase
  wires `onComplianceItemSatisfied` into the admin-approve transaction.

**This is wiring + light hardening of already-shipped, phase-verified deliverables — NOT new
capability.** Building credential storage / token resolvers for Entra/Okta/GitHub, auto-completing
workflow tasks from the saga, and new notification types are explicitly OUT of scope (deferred).

</domain>

<decisions>
## Implementation Decisions

### INT-01 — Deprovisioning UI trigger
- **D-01: Entry points — BOTH.** Build a deprovisioning trigger on the contractor/assignment detail
  surface (where `assignmentId` is unambiguous) AND an inline action on the offboarding
  workflow-run `ACCESS_REVOKE` task card (`task-card-run.tsx`). Both route through **one shared
  hook** (the sole tRPC boundary). The task-card path must resolve `WorkflowRun.contractorId → the
  offboarded ContractorAssignment` to obtain `assignmentId` (WorkflowRun has `contractorId` only,
  not `assignmentId`); pick the relevant ended/most-recent assignment — define this resolution
  explicitly in planning.
- **D-02: Pre-flight = impact preview + confirm.** Before firing (real, irreversible provider
  account suspensions), show the existing `impact-preview-panel` (`getImpactPreview`) + a confirm
  dialog, then start. GWS impact is populated; other providers render the generic preview shape.
- **D-03: Post-start navigation.** After a successful start, link/navigate to the EXISTING
  `deprovisioning-run-view` (`components/idp/`, `use-deprovisioning-run.ts`). Do not rebuild run
  status UI — it already exists.
- **D-04: Run and ACCESS_REVOKE task stay INDEPENDENT.** IT_ADMIN completes the workflow task
  manually; run success does NOT auto-complete the task. (No new saga→workflow callback — keeps the
  closure surface minimal. Auto-completion is a deferred idea.)

### INT-01 — Provider scope (`PROVIDERS_FOR_RUN`)
- **D-05: Per-org dynamic provider set.** A run's providers = the org's **ENABLED** toggles
  (`Organization.settingsJson.idpDeprovisioningEnabled`, 77 D-15) **∩ signoff-APPROVED**
  (`isProviderSignoffSatisfied` / `module.idp-deprovisioning-{provider}`) **∩ resolver-backed**.
  Resolver-backed today = **`{GOOGLE_WORKSPACE, SLACK}`** only (see code_context). This replaces the
  hardcoded `const PROVIDERS_FOR_RUN = ['GOOGLE_WORKSPACE']` (`deprovisioning.ts:68`) and honors the
  78-07 toggle UI.
- **D-06: Empty provider set → throw.** If an org has no enabled + signoff + resolver-backed
  provider, `startDeprovisioningRun` rejects with a clear precondition error
  (`DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` is already imported). Do NOT create a zero-step run.
  The UI disables the trigger and explains why.
- **D-07: Entra/Okta/GitHub stay DEFERRED.** Their adapters remain registered as `Deprovisionable`
  but are EXCLUDED from runs (the step-runner `resolveAdapter` already fails closed for them — no
  token resolver, and `IntegrationProvider` enum lacks `ENTRA`/`OKTA`). Full enablement (enum
  migration + `IntegrationConnection` storage + token-resolver extension) is tracked 78 tech-debt,
  not this phase.
- **D-08: Verify the Slack leg precisely.** Phase 77 claimed Slack complete; the audit asked for
  confirmation. Before relying on Slack in a run, confirm the `SLACK_ORG_GRID` token resolution
  (`idp-token-resolver.ts`) + `SlackAdapter.withOrgGridToken` suspend/revoke path actually executes
  end-to-end (not just registers).

### INT-01 — Run guards & idempotency
- **D-09: Deterministic `idempotencyKey` per-assignment.** The UI derives a stable key from
  `assignmentId` so a double-click / re-trigger returns the EXISTING run (mutation returns existing
  on P2002; 76-WR1 per-org unique index enforces it). Once a run exists for the assignment, the
  trigger shows "view run" rather than "start". Failed steps are re-run via the existing
  `retryDeprovisioningStep`, not by starting a second run.
- **D-10: New `idp:start_run` permission.** Add a dedicated action to the existing `idp` permission
  group (sibling of `idp:override_step_failure`) and gate `startDeprovisioningRun` +
  `getDeprovisioningEligibility` + the UI trigger with it. Both procedures are currently UNGATED
  (`tenantProcedure` only) — closing this gap is in scope because the trigger is the first real
  caller of a destructive, security-critical mutation. Register/seed the permission across roles.
- **D-11: Cooldown pre-check + disabled button.** Call `getDeprovisioningEligibility` on render;
  disable the start button + show an earliest-date tooltip while inside the 14-day cooldown (the
  query was built for exactly this). The server re-runs the gate on submit regardless — the UI
  cannot bypass it.

### INT-02 — Compliance payment-block recovery
- **D-12: Wire `onComplianceItemSatisfied` into `approveUploadReplacement`.** Inside the existing
  `$transaction`, after the item flips to `SATISFIED` (`compliance-admin.ts:287`), call
  `onComplianceItemSatisfied(tx, { itemId: input.itemId, contractorId, organizationId })` for the
  **approved item only**. The hook re-asserts FULL contractor eligibility for every `ApprovalFlow`
  whose `complianceHoldsJson` contains this item — correct because exactly one item flips per
  approval (unlike supersession, which flips many at once). Mirror the call shape used in
  `classification.ts:101` (`releaseHeldApprovalsForContractor`), but per-item — do NOT loop all
  BLOCKING items.
- **D-13: No new notification on flow resume.** Recovery writes the existing
  `approval.compliance_resolved` audit row; the resumed flow reappears in the approver's PENDING
  queue via existing surfacing. The contractor already receives the "upload approved" notification.
  An approver-notification-on-resume is a deferred idea.
- **D-14: Recovery must not break the approve flow.** Keep the recovery call INSIDE the transaction
  (atomic with the `SATISFIED` flip), but ensure the post-tx best-effort contractor notification
  semantics are preserved (T-73-08-04: a dispatch failure must never roll back the approval).

### Claude's Discretion
- i18n key namespace for the new trigger UI (e.g., `Idp.trigger`) — follow existing `Idp.*`
  conventions; en/de/pl/ar parity is mandatory.
- Exact placement of the `contractorId → assignmentId` resolution helper (server vs hook) — pick the
  layer that keeps the web-vite data-layer guard (`check:web-vite-data-layer`) green.
- Test/Nyquist structure for both seams — but coverage of the two E2E flows is mandatory (see
  deferred/verification note below).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec / source of truth
- `.planning/v6.0-MILESTONE-AUDIT.md` — defines INT-01 + INT-02 with source-confirmed file:line
  anchors, affected requirements (IDP-01..10/12/13/15; COMPL-07/08/11), blast radius, and the
  PROVIDERS_FOR_RUN secondary note. THE spec for this phase.
- `.planning/STATE.md` — carries the 78-06 schema constraint (ENTRA/OKTA not in `IntegrationProvider`
  enum → toggle in `Organization.settingsJson.idpDeprovisioningEnabled`), the 78 WR-1 router-dup
  deferral, and the PROVIDERS_FOR_RUN / Entra-Okta-GitHub deferred-credential notes.

### INT-01 server (IdP deprovisioning)
- `packages/api/src/routers/integrations/deprovisioning.ts` — `startDeprovisioningRun` (:147),
  `getDeprovisioningEligibility` (:99, both currently UNGATED), `PROVIDERS_FOR_RUN` const (:68),
  `DEPROVISIONING_TOGGLE_PROVIDERS` (:32), `isProviderSignoffSatisfied` (:53),
  `getProviderToggleState`/`enableProviderForOrg` (:594/:644, `settings:read|update` gated).
- `packages/api/src/services/idp-deprovisioning-step-runner.ts` — `resolveAdapter` (:203) **fails
  closed for ENTRA/OKTA/GITHUB**; only GWS + Slack get a configured adapter.
- `packages/api/src/services/idp-token-resolver.ts` — `DeprovisionProvider = 'GOOGLE_WORKSPACE' |
  'SLACK'` (:10); the authoritative list of resolver-backed providers.
- `packages/api/src/services/idp-impact-preview.ts` — `getImpactPreview`; GWS branch populated (:50),
  others generic.
- `packages/integrations/src/adapters/register-all.ts` — all 5 register as `Deprovisionable`
  (:116–134, :177); registration ≠ executable (token resolver gates execution).

### INT-01 UI (web-vite)
- `apps/web-vite/ARCHITECTURE.md` — Page→Container→Hook→Component layering (mandatory).
- `apps/web-vite/src/components/idp/` — existing run-view (`deprovisioning-run-view.tsx`),
  `impact-preview-panel.tsx`, `override-step-dialog.tsx`, `hooks/use-deprovisioning-run.ts`,
  `hooks/use-impact-preview.ts`. Reuse for D-02/D-03.
- `apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx` — `ACCESS_REVOKE` icon-only
  today (:76); `TaskActionToolbar` (:216) is where the inline trigger action attaches.
- `packages/db/prisma/schema/workflow.prisma` — `WorkflowRun.contractorId` nullable (:111), **no
  `assignmentId`** (drives the D-01 resolution requirement).

### INT-02 server (compliance recovery)
- `packages/api/src/routers/compliance/compliance-admin.ts` — `approveUploadReplacement` (:236),
  item→SATISFIED in `$transaction` (:287), post-tx best-effort notification (:314).
- `packages/api/src/services/compliance-recovery.ts` — `onComplianceItemSatisfied` (:43); the hook
  to wire (signature: `(tx: RecoveryClient, {itemId, contractorId, organizationId})`).
- `packages/api/src/routers/compliance/classification.ts` — `releaseHeldApprovalsForContractor`
  (:91) + caller (:101); the working pattern to mirror (per-item, not the all-BLOCKING loop).

### Permissions
- `packages/auth` (permissions/roles) — add the `idp:start_run` action (D-10); existing `idp` group
  already has `override_step_failure`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`components/idp/` run-view + impact-preview + override dialog + hooks** — the entire run-VIEW
  surface already exists; this phase adds only the START path that feeds it.
- **`getDeprovisioningEligibility`** — purpose-built single-source-of-truth cooldown query for both
  UI gating (D-11) and the server gate; reuse, don't duplicate.
- **`impact-preview-panel` + `getImpactPreview`** — drop-in for the D-02 pre-flight.
- **`onComplianceItemSatisfied` + `releaseHeldApprovalsForContractor`** — recovery hook + a verbatim
  in-transaction call pattern for INT-02.
- **`enableProviderForOrg` / `getProviderToggleState` / `isProviderSignoffSatisfied`** — the
  enabled+signoff source the D-05 provider derivation reads.

### Established Patterns
- web-vite Page→Container→Hook→Component; one hook = sole tRPC boundary per section
  (`check:web-vite-data-layer`). i18n en/de/pl/ar parity; loading/empty/error; WCAG.
- Mutations are idempotent via `idempotencyKey` + per-org unique index (76-WR1); P2002 returns the
  existing run.
- Recovery / eligibility re-assertion runs INSIDE the caller's transaction (atomic).
- `requirePermission({ group: ['action'] })` on tenant procedures; `idp`, `integration`, `settings`
  groups exist.

### Integration Points
- **Trigger → saga:** new web-vite hook → `deprovisioning.startDeprovisioningRun` (+ eligibility
  pre-check) → existing QStash fan-out + step-runner. This is the INT-01 seam being closed.
- **Task-card → assignment:** `WorkflowRun.contractorId` → resolve `ContractorAssignment` →
  `assignmentId` (the D-01 resolution step; no direct FK today).
- **Approve → recovery:** `approveUploadReplacement` `$transaction` → `onComplianceItemSatisfied` →
  `ApprovalFlow` PENDING_COMPLIANCE → PENDING → payment gate
  (`assertContractorPaymentEligibility`) releases. This is the INT-02 seam being closed.

</code_context>

<specifics>
## Specific Ideas

- The phase scope title is the contract: "IdP deprovisioning UI trigger (ACCESS_REVOKE to
  startDeprovisioningRun) + multi-provider run steps (un-hardcode PROVIDERS_FOR_RUN) + compliance
  payment-block recovery on admin upload approval." All three sub-deliverables must land.
- Resolver-backed provider set is **exactly `{GOOGLE_WORKSPACE, SLACK}`** today — derive
  programmatically from the token-resolver/step-runner capability, do not hardcode a new const that
  can drift from the resolver.

</specifics>

<deferred>
## Deferred Ideas

- **Auto-complete the ACCESS_REVOKE task on run SUCCEEDED** — needs a saga
  (`recomputeRunStatus`)→workflow-task-completion callback; revisit as a UX enhancement phase.
- **Entra/Okta/GitHub deprovisioning execution** — enum migration (`IntegrationProvider` +
  `ENTRA`/`OKTA`), `IntegrationConnection` credential storage, and per-provider token resolvers +
  `idp-impact-preview` extension. Existing 78 tech-debt; not this closure.
- **78 WR-1 DRY refactor** — consolidate the 3 per-provider connection routers
  (`entra.ts`/`okta.ts`/`github.ts`) into `deprovisioning.enableProviderForOrg`. Separate refactor
  phase (see STATE.md DEFERRED REFACTOR 2026-06-01).
- **Approver-notification-on-flow-resume** — notify the approver/owner when a held flow unblocks.
- **Verification of phases 70/71/75** — the audit flagged these as never goal-backward verified
  (`/gsd:verify-work`); track alongside milestone closure, not in this phase's build.

### Note on requirements
Closing INT-01 reaches IDP-01..10, IDP-12, IDP-13, IDP-15 (UI-unreachable → reachable). Closing
INT-02 reaches COMPL-07, COMPL-08, COMPL-11. Both E2E flows ("offboarding ACCESS_REVOKE → IdP
deprovisioning" and "portal upload → admin approve → payment unblock") must be exercised by tests.

</deferred>

---

*Phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces*
*Context gathered: 2026-06-06*
