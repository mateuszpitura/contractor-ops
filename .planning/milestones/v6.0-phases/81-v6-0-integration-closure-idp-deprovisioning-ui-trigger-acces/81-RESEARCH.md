# Phase 81: v6.0 Integration Closure — IdP deprovisioning UI trigger + multi-provider run steps + compliance payment-block recovery - Research

**Researched:** 2026-06-06
**Domain:** Integration wiring (tRPC v11 seams + web-vite Page→Container→Hook layering + RBAC + Prisma) — closing two source-confirmed E2E blockers, NOT new capability.
**Confidence:** HIGH (all decisions verified against live code with file:line anchors; zero open contradictions with CONTEXT.md)

## Summary

This is a wiring + light-hardening phase. Every downstream deliverable already exists and is phase-verified in isolation; the work is connecting three seams: (1) a web-vite trigger that calls `deprovisioning.startDeprovisioningRun`, (2) replacing the hardcoded `PROVIDERS_FOR_RUN` const with a per-org dynamic derivation, and (3) calling `onComplianceItemSatisfied` inside `approveUploadReplacement`'s transaction. I verified all 14 locked decisions (D-01..D-14) against the current source. **All decisions hold — no plan-breaking surprises.**

The single most important confirmation is **D-08 (Slack leg)**: the audit flagged it unverified. It is fully wired and executes end-to-end. `idp-deprovisioning-step-runner.ts:204-216` resolves `SlackAdapter().withOrgGridToken(token)` directly (not via the lazy registry), `idp-token-resolver.ts:10` declares `DeprovisionProvider = 'GOOGLE_WORKSPACE' | 'SLACK'`, and `slack-adapter.ts:481/516` make real SCIM-deactivate + `admin.users.session.invalidate` calls with the org-grid token. Resolver-backed set is therefore confirmed exactly `{GOOGLE_WORKSPACE, SLACK}`.

Two findings sharpen the plan beyond what CONTEXT.md states. First, the offboarding ACCESS_REVOKE task is seeded with `assigneeRole: 'IT_ADMIN'` (`workflow-templates.ts:396`), but the `it_admin` role currently holds NO `idp` permissions and the `roles.test.ts:80` invariant explicitly asserts "no role other than owner/admin holds idp" — so D-10's `idp:start_run` seeding decision is load-bearing and must reconcile with which role actually performs the task. Second, `DeprovisioningRun` DOES carry a required `assignmentId` FK with a `@@unique([organizationId, idempotencyKey])` and `@@index([organizationId, assignmentId])` — so "view run vs start" (D-09) and the run↔assignment lookup are both directly queryable.

**Primary recommendation:** Build one shared web-vite hook (`components/idp/hooks/use-start-deprovisioning.ts`) as the sole tRPC boundary for both entry points; add a server-side `contractorId → assignmentId` resolver (new tenantProcedure or extend an existing query) so the data-layer guard stays green; derive `PROVIDERS_FOR_RUN` from `DEPROVISIONING_TOGGLE_PROVIDERS ∩ org-enabled ∩ signoff ∩ {GOOGLE_WORKSPACE,SLACK resolver-backed}` inside the mutation; add `idp:start_run` to the auth statement + grant to owner/admin AND the ACCESS_REVOKE assignee role; add the recovery call inside the `approveUploadReplacement` transaction after the SATISFIED flip.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**INT-01 — Deprovisioning UI trigger**
- **D-01:** Entry points — BOTH. Trigger on contractor/assignment detail (where `assignmentId` is unambiguous) AND inline on the offboarding `ACCESS_REVOKE` task card (`task-card-run.tsx`). Both route through ONE shared hook (sole tRPC boundary). Task-card path must resolve `WorkflowRun.contractorId → offboarded ContractorAssignment` to get `assignmentId` (WorkflowRun has `contractorId` only); pick relevant ended/most-recent assignment — define resolution explicitly in planning.
- **D-02:** Pre-flight = impact preview + confirm. Before firing real, irreversible suspensions, show existing `impact-preview-panel` (`getImpactPreview`) + confirm dialog, then start. GWS impact populated; other providers render generic preview shape.
- **D-03:** Post-start navigation. After successful start, link/navigate to EXISTING `deprovisioning-run-view` (`components/idp/`, `use-deprovisioning-run.ts`). Do not rebuild run status UI.
- **D-04:** Run and ACCESS_REVOKE task stay INDEPENDENT. IT_ADMIN completes the workflow task manually; run success does NOT auto-complete the task. No new saga→workflow callback.

**INT-01 — Provider scope (`PROVIDERS_FOR_RUN`)**
- **D-05:** Per-org dynamic provider set. Run providers = org ENABLED toggles (`Organization.settingsJson.idpDeprovisioningEnabled`, 77 D-15) ∩ signoff-APPROVED (`isProviderSignoffSatisfied` / `module.idp-deprovisioning-{provider}`) ∩ resolver-backed. Resolver-backed today = `{GOOGLE_WORKSPACE, SLACK}` only. Replaces hardcoded `const PROVIDERS_FOR_RUN = ['GOOGLE_WORKSPACE']` (`deprovisioning.ts:68`) and honors the 78-07 toggle UI.
- **D-06:** Empty provider set → throw. If no enabled+signoff+resolver-backed provider, `startDeprovisioningRun` rejects with clear precondition error (`DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` already imported). Do NOT create a zero-step run. UI disables trigger + explains why.
- **D-07:** Entra/Okta/GitHub stay DEFERRED. Adapters remain registered as `Deprovisionable` but EXCLUDED from runs (step-runner `resolveAdapter` already fails closed; no token resolver; `IntegrationProvider` enum lacks ENTRA/OKTA). Full enablement is 78 tech-debt.
- **D-08:** Verify the Slack leg precisely. Before relying on Slack in a run, confirm `SLACK_ORG_GRID` token resolution + `SlackAdapter.withOrgGridToken` suspend/revoke executes end-to-end (not just registers).

**INT-01 — Run guards & idempotency**
- **D-09:** Deterministic `idempotencyKey` per-assignment. UI derives stable key from `assignmentId` so a double-click / re-trigger returns the EXISTING run (P2002; 76-WR1 per-org unique index). Once a run exists for the assignment, trigger shows "view run" not "start". Failed steps re-run via existing `retryDeprovisioningStep`, not a second run.
- **D-10:** New `idp:start_run` permission. Add a dedicated action to the existing `idp` group (sibling of `idp:override_step_failure`) and gate `startDeprovisioningRun` + `getDeprovisioningEligibility` + the UI trigger with it. Both procedures currently UNGATED (`tenantProcedure` only) — closing this gap is in scope because the trigger is the first real caller of a destructive, security-critical mutation. Register/seed across roles.
- **D-11:** Cooldown pre-check + disabled button. Call `getDeprovisioningEligibility` on render; disable start + show earliest-date tooltip while inside the 14-day cooldown. Server re-runs the gate on submit regardless.

**INT-02 — Compliance payment-block recovery**
- **D-12:** Wire `onComplianceItemSatisfied` into `approveUploadReplacement`. Inside the existing `$transaction`, after the item flips to SATISFIED (`compliance-admin.ts:287`), call `onComplianceItemSatisfied(tx, { itemId: input.itemId, contractorId, organizationId })` for the approved item ONLY. The hook re-asserts FULL contractor eligibility for every `ApprovalFlow` whose `complianceHoldsJson` contains this item. Mirror the call shape in `classification.ts:101`, but per-item — do NOT loop all BLOCKING items.
- **D-13:** No new notification on flow resume. Recovery writes the existing `approval.compliance_resolved` audit row; resumed flow reappears in the approver's PENDING queue via existing surfacing. Contractor already gets the "upload approved" notification. Approver-notification-on-resume is deferred.
- **D-14:** Recovery must not break the approve flow. Keep the recovery call INSIDE the transaction (atomic with the SATISFIED flip), but preserve the post-tx best-effort contractor notification semantics (T-73-08-04: a dispatch failure must never roll back the approval).

### Claude's Discretion
- i18n key namespace for the new trigger UI (e.g., `Idp.trigger`) — follow existing `Idp.*` conventions; en/de/pl/ar parity mandatory.
- Exact placement of the `contractorId → assignmentId` resolution helper (server vs hook) — pick the layer that keeps `check:web-vite-data-layer` green.
- Test/Nyquist structure for both seams — but coverage of the two E2E flows is mandatory.

### Deferred Ideas (OUT OF SCOPE)
- Auto-complete the ACCESS_REVOKE task on run SUCCEEDED (needs a saga→workflow-task-completion callback).
- Entra/Okta/GitHub deprovisioning execution (enum migration `IntegrationProvider` + ENTRA/OKTA, `IntegrationConnection` credential storage, per-provider token resolvers + impact-preview extension). 78 tech-debt.
- 78 WR-1 DRY refactor (consolidate `entra.ts`/`okta.ts`/`github.ts` into `deprovisioning.enableProviderForOrg`).
- Approver-notification-on-flow-resume.
- Verification of phases 70/71/75 (track alongside milestone closure, not in this phase's build).
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are explicitly mapped in ROADMAP (TBD). Per CONTEXT.md, closing the two seams REACHES these requirements (currently PARTIAL — server-complete but UI-unreachable / unwired). The binding outcome is **E2E coverage of both flows**.

| ID | Description | Research Support |
|----|-------------|------------------|
| IDP-01..10, IDP-12, IDP-13, IDP-15 | IdP deprovisioning capabilities (suspend, revoke, impact preview, run view, multi-provider, etc.) — server-complete, UI-unreachable | INT-01 trigger wiring (D-01..D-11) makes them reachable. Server surface verified: `startDeprovisioningRun`, `getDeprovisioningEligibility`, `describeImpact`, `getDeprovisioningRun`, `retryDeprovisioningStep`, `overrideStepFailure` all exist in `deprovisioning.ts`. |
| IDP-11, IDP-14 | Cooldown gate + scopes | Unaffected (already wired) — `getDeprovisioningEligibility` + `canStartDeprovisioning` confirmed. |
| COMPL-07, COMPL-08, COMPL-11 | Compliance hold release + payment unblock on doc approval | INT-02 recovery wiring (D-12..D-14). `onComplianceItemSatisfied` (`compliance-recovery.ts:43`) verified; `approveUploadReplacement` (`compliance-admin.ts:236`) verified missing the call. |

**E2E flows that MUST be test-covered (binding):**
1. Offboarding ACCESS_REVOKE → IdP deprovisioning run (trigger → saga → step fan-out).
2. Portal upload → admin approve → payment unblock (approve → recovery → ApprovalFlow PENDING_COMPLIANCE→PENDING → payment gate releases).
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Binding directives the planner MUST honor:

- **web-vite layering:** Page (thin composer, no tRPC) → Container (`*-container.tsx`, calls hooks, owns loading/empty/error, no direct tRPC) → Hook (`components/{domain}/hooks/use-*.ts`, SOLE tRPC/React-Query boundary) → Component (presentational). Enforced by `pnpm check:web-vite-data-layer`. `useQueryClient`/`useQueryState` ARE allowed outside hooks; `useTRPC`/`useQuery`/`useMutation`/`useInfiniteQuery`/`useSuspenseQuery` are NOT.
- **i18n:** en/de/pl/ar parity mandatory; ar is RTL. New keys in all four `apps/web-vite/messages/{en,de,pl,ar}.json`. Arabic is machine-generated (native review deferred — non-blocking under LOCAL-ONLY).
- **Logging:** `@contractor-ops/logger` only; NO `console.*` in app source. Use `getIdpAuditLogger()` (existing) for IdP audit lines, `createLogger({ service })` elsewhere.
- **Feature flags:** `@contractor-ops/feature-flags` only (`getFlagSignoff` is already used in `deprovisioning.ts`). No direct Unleash SDK.
- **tRPC:** Zod input on every procedure; tenant from session (`ctx.organizationId`), never client input. `writeAuditLog` on sensitive mutations (already present in both target routers).
- **RBAC:** `requirePermission({ group: ['action'] })` middleware on tenant procedures.
- **Read before Edit:** MUST Read each existing file before first Edit. Edit > Write. No sed/awk/bulk-replace.
- **Dependencies:** No new deps expected. If any are added: 7-day release age, `pnpm audit` + `pnpm security:scan` after.
- **Tests:** Run scoped — NEVER the full unscoped web-vite suite (kills RAM). Use `pnpm --filter @contractor-ops/web-vite test <path>`.
- **UI:** `frontend-design` skill for any UI work; WCAG (keyboard, focus, semantic HTML, contrast); loading/empty/error states.
- **Git safety:** No stash/checkout/reset without explicit approval.
- **No "legacy"/"GAP-ID"/migration-breadcrumb comments in source** — those belong in commit messages + .planning/.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deprovisioning trigger UI (button, confirm, preview) | web-vite Component/Container | — | Presentational; loading/empty/error in container |
| Trigger data fetching + mutation + eligibility pre-check | web-vite Hook | API (tRPC) | Sole tRPC boundary (`check:web-vite-data-layer`); calls existing procedures |
| `contractorId → assignmentId` resolution | API (tRPC tenantProcedure) | — | DB query (most-recent ENDED assignment); MUST be server-side to keep the hook a single tRPC call and the guard green |
| `PROVIDERS_FOR_RUN` dynamic derivation | API (server, inside mutation) | — | Reads org settings + signoff flags + resolver capability; server is the authoritative gate |
| Provider account suspend/revoke execution | Integrations adapters (via step-runner) | — | Already wired (GWS + Slack); QStash fan-out; not touched by this phase |
| `idp:start_run` permission enforcement | API (RBAC middleware) | web-vite Hook/Container (UI gate, advisory) | Server is authoritative; UI gate is convenience (`usePermissions().can`) |
| Compliance recovery (release held approvals) | API (inside `approveUploadReplacement` tx) | — | Atomic with SATISFIED flip; pure server-side; no UI change |
| Contractor "upload approved" notification | API (post-tx best-effort) | — | Already exists (`dispatchComplianceUploadOutcome`); must stay best-effort |

## Standard Stack

No new libraries. Everything is in the existing monorepo. Verified present and used by the target files:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trpc/server` | v11 | Router procedures, `TRPCError`, `createCallerFactory` | Repo standard (`packages/api`) `[VERIFIED: codebase grep]` |
| `@tanstack/react-query` | (workspace) | `useQuery`/`useMutation`/`useQueryClient` in hooks | web-vite standard `[VERIFIED: use-deprovisioning-run.ts]` |
| `zod` | (workspace) | Procedure input validation | Every procedure `[VERIFIED: deprovisioning.ts]` |
| `@contractor-ops/auth` | (workspace) | `accessControlStatement`, `roles`, `authApi.hasPermission` | Better Auth access-control `[VERIFIED: permissions.ts/roles.ts]` |
| `@contractor-ops/idp-saga` | (workspace) | `canStartDeprovisioning`, `recomputeRunStatus`, `MAX_ATTEMPTS` | Cooldown gate + run-status `[VERIFIED: deprovisioning.ts:4]` |
| `@contractor-ops/logger` | (workspace) | `getIdpAuditLogger`, `createLogger` | No `console.*` `[VERIFIED: deprovisioning.ts:5]` |
| `@contractor-ops/feature-flags` | (workspace) | `getFlagSignoff` (signoff status) | Provider signoff gate `[VERIFIED: deprovisioning.ts:3]` |
| `vitest` | (workspace) | All unit/integration tests | Repo standard `[VERIFIED: existing tests]` |

### Supporting (web-vite UI primitives — all already imported by sibling idp components)
| Component | Source | Use Case |
|-----------|--------|----------|
| `Button`, `Badge`, `Card`, `Skeleton`, `Tooltip` | `@contractor-ops/ui/components/shadcn/*` | Trigger button, disabled-tooltip, preview card `[VERIFIED: impact-preview-panel.tsx]` |
| `Dialog` / `AlertDialog` (DialogBody + DialogFooter pattern) | `@contractor-ops/ui` | D-02 confirm dialog (note repo Dialog body/footer convention; AlertDialog is out of that enforced pattern) `[CITED: memory project_web_vite_dialog_pattern]` |
| `usePermissions().can('idp', [...])` | `apps/web-vite/.../hooks/use-permissions` | UI gate for D-10/D-11 `[VERIFIED: deprovisioning-run-view-container.tsx:21]` |

**Installation:** None — no `npm install`.

## Package Legitimacy Audit

Not applicable — this phase installs **zero external packages**. All code uses existing workspace packages already present in `package.json` lockfile. slopcheck/registry verification is unnecessary; no `npm install`, `pip install`, or `cargo add` in scope.

## Architecture Patterns

### System Architecture Diagram — INT-01 (deprovisioning trigger seam)

```
[Offboarding workflow-run page]            [Contractor/Assignment detail page]
  TaskCardRun (ACCESS_REVOKE)                  AssignmentDetail
        |  has: runId, contractorId                 |  has: assignmentId (unambiguous)
        v                                           v
  +-----------------------------------------------------------+
  |  SHARED HOOK: use-start-deprovisioning.ts (sole tRPC)     |
  |  - if only contractorId: call resolver -> assignmentId    |
  |  - derive idempotencyKey from assignmentId (deterministic)|
  |  - getDeprovisioningEligibility(assignmentId) [D-11 gate] |
  |  - describeImpact(assignmentId, provider)     [D-02 prev] |
  |  - existing-run lookup -> "view run" vs "start" [D-09]    |
  |  - startDeprovisioningRun({assignmentId, idempotencyKey}) |
  +-----------------------------------------------------------+
        |                                       |
        v (mutation)                            v (on success)
  deprovisioning.startDeprovisioningRun   navigate to
   (RBAC: idp:start_run [NEW D-10])        DeprovisioningRunViewContainer(runId)
        |                                       (EXISTING — D-03)
        | server-side:
        |  1. re-run cooldown gate (canStartDeprovisioning)
        |  2. derive PROVIDERS_FOR_RUN = TOGGLE ∩ enabled ∩ signoff ∩ {GWS,SLACK}
        |  3. empty set -> throw DEPROVISIONING_INTEGRATION_NOT_CONFIGURED [D-06]
        |  4. $transaction: create run + steps (provider × stepKind), -> IN_PROGRESS
        |  5. P2002 -> return existing run (idempotent) [D-09]
        v
  post-commit fan-out: N QStash jobs -> /idp-deprovisioning/_step-runner
        v
  runDeprovisioningStep -> resolveAdapter (GWS | Slack, fail-closed otherwise)
        v
  GoogleWorkspaceAdapter.suspendAccount/revokeAllSessions  (real Admin SDK calls)
  SlackAdapter.suspendAccount (SCIM active=false) / revokeAllSessions (admin.users.session.invalidate)
        v
  recomputeRunStatus -> DeprovisioningRun.status (run-view reflects it)
```

### System Architecture Diagram — INT-02 (compliance recovery seam)

```
[Portal: contractor uploads replacement doc]  ->  Document PENDING_REVIEW
        |
        v
[Admin: approveUploadReplacement(itemId, documentId, expiresAt)]
   (RBAC: compliance:override — existing)
        |
        v
  $transaction:
    1. verify item, document PENDING_REVIEW, DocumentLink owner (existing guards)
    2. ContractorComplianceItem -> SATISFIED (+satisfiedByDocumentId,+expiresAt)  [:287]
    3. Document -> ACTIVE
    4. writeAuditLog compliance.upload.approved
 >> 5. onComplianceItemSatisfied(tx, {itemId, contractorId, organizationId})  [NEW D-12]
        |     - $queryRaw: held PENDING_COMPLIANCE ApprovalFlows containing itemId
        |     - assertContractorPaymentEligibility([contractorId], {tx, throwOnFail:false})
        |     - if NOT blocked: ApprovalFlow PENDING_COMPLIANCE -> PENDING, clear holds
        |     - writeAuditLog approval.compliance_resolved
        v  (commit — atomic; recovery failure rolls back the whole approve [D-14])
  post-tx (best-effort, MUST NOT roll back):
    dispatchComplianceUploadOutcome(...) — existing contractor notification [D-14]
        v
  Resumed ApprovalFlow reappears in approver PENDING queue (existing surfacing — D-13)
  Payment gate (assertContractorPaymentEligibility) no longer blocks -> contractor payable
```

### Component Responsibilities

| File | Layer | Change |
|------|-------|--------|
| `deprovisioning.ts` | API router | Replace `PROVIDERS_FOR_RUN` const (:68) usage at :200 with dynamic derivation; gate `startDeprovisioningRun` + `getDeprovisioningEligibility` with `idp:start_run`; (optionally) add `contractorId→assignmentId` resolver procedure + existing-run lookup |
| `compliance-admin.ts` | API router | Import + call `onComplianceItemSatisfied` inside `approveUploadReplacement` tx (after :291, before return at :311) |
| `permissions.ts` | auth | Add `start_run` to `idp` action array (:25) |
| `roles.ts` | auth | Add `start_run` to `allPermissions.idp` (:28), `admin.idp` (:58), and the ACCESS_REVOKE assignee role (see D-10 finding) |
| `roles.test.ts` | auth test | Update the "no role other than owner/admin holds idp" invariant (:80-86) + the owner/admin idp assertions (:75-78) |
| `components/idp/hooks/use-start-deprovisioning.ts` | web-vite hook | NEW — sole tRPC boundary for both entry points |
| `components/idp/deprovisioning-trigger-*.tsx` | web-vite container+component | NEW — button + confirm + preview reuse |
| `task-card-run.tsx` `TaskActionToolbar` (:216) | web-vite component | Conditionally render the trigger when `task.taskType === 'ACCESS_REVOKE'` |
| `messages/{en,de,pl,ar}.json` | i18n | NEW `Idp.trigger` sub-namespace, four-locale parity |

### Pattern 1: Dynamic `PROVIDERS_FOR_RUN` derivation (D-05/D-06/D-07)

**What:** Replace the hardcoded const with a function that intersects three sets. The authoritative resolver-backed list is `DeprovisionProvider` in `idp-token-resolver.ts` (`'GOOGLE_WORKSPACE' | 'SLACK'`), which mirrors exactly what `resolveAdapter` (`idp-deprovisioning-step-runner.ts:204`) will accept. Do NOT hardcode a fourth copy — derive from the same source so it cannot drift (CONTEXT.md "Specific Ideas").

**Where:** `deprovisioning.ts:200` (the only consumer of `PROVIDERS_FOR_RUN`).

**Example (pattern — verify exact symbol export at implementation time):**
```typescript
// Source: derived from idp-token-resolver.ts:10 (DeprovisionProvider) +
// deprovisioning.ts:53 (isProviderSignoffSatisfied) + getProviderToggleState logic (:614-633)
// RESOLVER_BACKED must come from the token-resolver capability, not a literal.
// Option: export a const from idp-token-resolver.ts, e.g.
//   export const RESOLVER_BACKED_PROVIDERS = ['GOOGLE_WORKSPACE', 'SLACK'] as const;
// and have DeprovisionProvider = (typeof RESOLVER_BACKED_PROVIDERS)[number].

function deriveProvidersForRun(settingsJson: unknown): DeprovisioningToggleProvider[] {
  const settings = (settingsJson as Record<string, unknown>) ?? {};
  const enabledMap = (settings.idpDeprovisioningEnabled as Record<string, boolean>) ?? {};
  return DEPROVISIONING_TOGGLE_PROVIDERS.filter(
    p =>
      enabledMap[p] === true &&                       // org ENABLED (77 D-15)
      isProviderSignoffSatisfied(p) &&                // signoff APPROVED (flag)
      (RESOLVER_BACKED_PROVIDERS as readonly string[]).includes(p), // resolver-backed today
  );
}
// In startDeprovisioningRun: read organization.settingsJson, derive, and if [] -> throw
// DEPROVISIONING_INTEGRATION_NOT_CONFIGURED (already imported, deprovisioning.ts:11). [D-06]
```

**Note:** `startDeprovisioningRun` currently does NOT fetch `organization.settingsJson` — only the assignment. The mutation must add an `organization.findUnique({ select: { settingsJson: true } })` read (mirror `getProviderToggleState:597`) before deriving. The fan-out loop at :229 already iterates `run.steps`, so multi-provider works automatically once the steps are created with >1 provider.

### Pattern 2: Recovery call inside the approve transaction (D-12/D-14)

**What:** Mirror `classification.ts:101` but per-item (not the all-BLOCKING loop in `releaseHeldApprovalsForContractor`). The signature is `onComplianceItemSatisfied(tx, { itemId, contractorId, organizationId })`. The tx variable in `approveUploadReplacement` satisfies `RecoveryClient` structurally (it is the same `$transaction` callback client).

**Where:** `compliance-admin.ts` — add inside the existing `$transaction` (after the item update at :291, before `return` at :311). `onComplianceItemSatisfied` is NOT currently imported in this file (confirmed — import list is :19-40).

**Example:**
```typescript
// Source: classification.ts:101 (call shape) + compliance-recovery.ts:43 (signature)
// INSIDE the existing $transaction, after the SATISFIED update and audit log:
await onComplianceItemSatisfied(tx as Parameters<typeof onComplianceItemSatisfied>[0], {
  itemId: input.itemId,
  contractorId: before.contractorId,
  organizationId: ctx.organizationId,
});
// The post-tx dispatchComplianceUploadOutcome (:314) stays UNCHANGED — best-effort,
// outside the tx, so a notify failure never rolls back the approval (D-14 / T-73-08-04).
```

### Pattern 3: `idp:start_run` permission (D-10)

**What:** Add a sibling action to the `idp` group. Three files + one test.

```typescript
// permissions.ts:25 — accessControlStatement
idp: ['override_step_failure', 'start_run'],

// roles.ts:28 — allPermissions (owner inherits via ac.newRole(allPermissions))
idp: ['override_step_failure', 'start_run'],

// roles.ts:58 — admin
idp: ['override_step_failure', 'start_run'],

// roles.ts — the ACCESS_REVOKE assignee role (see finding below): it_admin has NO idp today
// it_admin currently lacks any idp entry — add: idp: ['start_run'],

// deprovisioning.ts — gate BOTH currently-ungated procedures:
//   startDeprovisioningRun: .use(requirePermission({ idp: ['start_run'] }))
//   getDeprovisioningEligibility: .use(requirePermission({ idp: ['start_run'] }))
```

**Server gate mirror:** existing `overrideStepFailure` uses `.use(requirePermission({ idp: ['override_step_failure'] }))` (`deprovisioning.ts:491`). UI gate mirror: `usePermissions().can('idp', ['start_run'])` (analog `deprovisioning-run-view-container.tsx:21`).

### Pattern 4: `contractorId → assignmentId` resolution (D-01)

**What:** From `WorkflowRun.contractorId` (available client-side via `workflow.getRun` — the run object carries the `contractorId` scalar), resolve the offboarded assignment. `WorkflowRun` has NO `assignmentId` (`workflow.prisma:111` — `contractorId String?` only). `ContractorAssignment` has `status` (`ACTIVE|ENDED|PLANNED`) and `endedAt: DateTime?`.

**Recommendation: server-side resolver** (keeps the hook one tRPC call → guard green). Pick the **most-recent ENDED** assignment (status='ENDED', order by `endedAt desc`), falling back to most-recent-by-`updatedAt` if none ENDED. This matches the cooldown semantics — `canStartDeprovisioning` reads `endedAt`, and the ACCESS_REVOKE task runs post-offboarding when the assignment is ENDED.

```typescript
// New tenantProcedure (or extend an existing one). Input: { contractorId } or { runId }.
const assignment = await ctx.db.contractorAssignment.findFirst({
  where: { contractorId, organizationId: ctx.organizationId, status: 'ENDED' },
  orderBy: { endedAt: 'desc' },
  select: { id: true },
});
// Disambiguation: status='ENDED' + endedAt desc = the offboarded engagement that armed cooldown.
// If a contractor has multiple ended assignments, the most-recently-ended is the offboarding target.
// Edge: contractor with no ENDED assignment -> resolver returns null -> trigger disabled w/ reason.
```

### Anti-Patterns to Avoid
- **Hardcoding a 4th provider list.** D-05 explicitly forbids a new const that drifts from the resolver. Derive from `DeprovisionProvider`/resolver capability.
- **Calling `releaseHeldApprovalsForContractor` (the all-BLOCKING loop) in approve.** D-12: per-item only. Exactly one item flips per approval; the loop is for supersession (many at once).
- **Putting `useQuery`/`useMutation` in the trigger container or task-card.** `check:web-vite-data-layer` fails. All tRPC in `components/idp/hooks/`.
- **Putting `contractorId→assignmentId` resolution in the hook via a second tRPC round-trip + client logic.** Prefer a single server resolver to keep the data layer thin and the guard green.
- **Auto-completing the ACCESS_REVOKE task on run success.** D-04: deferred. The run and task are independent.
- **Moving the contractor notification inside the tx.** D-14: it must stay post-tx best-effort.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cooldown gate | New eligibility logic | `getDeprovisioningEligibility` + `canStartDeprovisioning` | Single source of truth; server re-runs on submit (D-11) `[VERIFIED]` |
| Impact preview | New preview fetch | `describeImpact` + `impact-preview-panel(-container)` + `use-impact-preview` | Exists, GWS+Slack, cache-fronted (D-02) `[VERIFIED]` |
| Run status view | New run UI | `DeprovisioningRunViewContainer` + `use-deprovisioning-run` | Exists, full step/override UI (D-03) `[VERIFIED]` |
| Idempotency / dedup | New dedup table | `idempotencyKey` + `@@unique([organizationId, idempotencyKey])` (76-WR1) | P2002 returns existing run (D-09) `[VERIFIED: idp-deprovisioning.prisma:25]` |
| Held-approval release | New flow-resume logic | `onComplianceItemSatisfied` | Re-asserts eligibility + audit row (D-12) `[VERIFIED: compliance-recovery.ts:43]` |
| Failed-step retry | New retry button logic | `retryDeprovisioningStep` | Exists; D-09 says re-run failed steps, not a 2nd run `[VERIFIED: deprovisioning.ts:281]` |
| Permission check | Manual role check | `requirePermission({ idp: ['start_run'] })` + `usePermissions().can` | Repo RBAC pattern `[VERIFIED: rbac.ts:19]` |

**Key insight:** This phase is ~95% reuse. The only genuinely new code is: the dynamic provider derivation, the `idp:start_run` action, the trigger UI (button + confirm wiring), the `contractorId→assignmentId` resolver, and the one-line recovery call. Everything else is connecting existing parts.

## Runtime State Inventory

This is partly a wiring phase but also touches an auth statement (RBAC) and a permission seed — which can leave runtime state out of sync. Explicit audit:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None requiring migration. `Organization.settingsJson.idpDeprovisioningEnabled` already populated by 77/78 toggle UI; the dynamic derivation reads it (no write). `DeprovisioningRun.assignmentId`/`idempotencyKey` columns + 76-WR1 unique index already exist in schema. | None — verified against `idp-deprovisioning.prisma`. |
| Live service config | None. Unleash signoff flags (`module.idp-deprovisioning-{provider}`) already exist (77 D-15) and are read via `getFlagSignoff`. `FLAG_SIGNOFF_BYPASS=local` short-circuits in local. No new flags. | None — verified `isProviderSignoffSatisfied` (deprovisioning.ts:53). |
| OS-registered state | None. No cron/scheduler/process-name changes. QStash fan-out URLs unchanged. | None. |
| Secrets/env vars | None new. `SLACK_ORG_GRID` credentials + GWS tokens already stored in `IntegrationConnection.credentialsRef` (decrypted by `resolveDeprovisionToken`). `API_URL` (QStash step URL) already required. | None. |
| Build artifacts / RBAC seed | **Better Auth access-control statement is code (`permissions.ts`/`roles.ts`) — recompiled, no DB seed for the statement itself.** BUT: member→role assignments live in the DB. Adding `idp:start_run` to a role grants it to all existing members of that role automatically (Better Auth evaluates `roles.ts` at request time via `authApi.hasPermission`). No data migration needed for the permission. If any org-member role mapping is cached, verify it refreshes. `roles.test.ts` MUST be updated or it fails (asserts current idp shape verbatim). | Update `roles.test.ts` invariants. No DB migration. |

**The canonical question — after every file is updated, what runtime systems still have stale state?** Answer: only the `roles.test.ts` assertions (a test, not runtime) and any in-memory permission cache (Better Auth evaluates statements per request via `authApi.hasPermission`, so a code change takes effect on next request — no stored permission rows to migrate). The `PROVIDERS_FOR_RUN` change is pure code; existing org toggle settings are read as-is. **No data migration is required for this phase.**

## Common Pitfalls

### Pitfall 1: `roles.test.ts` hard-asserts the current `idp` permission shape
**What goes wrong:** `roles.test.ts:75-78` asserts `roles.owner.statements.idp` and `roles.admin.statements.idp` **equal** `['override_step_failure']` (toEqual, exact). `:80-86` asserts "no role other than owner/admin holds idp permissions". Adding `start_run` (and granting it to `it_admin`) breaks all three.
**Why:** The test was written tightly for Phase 77's single-action `idp` group.
**How to avoid:** Update those assertions in the same task that edits `roles.ts`/`permissions.ts`. The plan MUST include the test edit or CI red.
**Warning signs:** `pnpm --filter @contractor-ops/auth test` fails on `roles.test.ts`.

### Pitfall 2: ACCESS_REVOKE assignee (`it_admin`) cannot reach the trigger
**What goes wrong:** D-04 says IT_ADMIN completes the ACCESS_REVOKE task. The offboarding template seeds `assigneeRole: 'IT_ADMIN'` (`workflow-templates.ts:396`). But `it_admin` holds NO `idp` permission today. If `idp:start_run` is granted only to owner/admin (mirroring `override_step_failure`), the role that actually sees the task cannot start the run — the seam is "closed" but practically unreachable for the intended actor.
**Why:** `override_step_failure` is an owner/admin escalation; `start_run` is the routine action for the task assignee.
**How to avoid:** The plan must make an explicit decision: grant `idp:start_run` to owner + admin + `it_admin` (the ACCESS_REVOKE assignee), OR document that only owner/admin trigger and IT_ADMIN escalates. Recommend granting to `it_admin` to match D-04's flow. Surface this in discuss-phase if ambiguous — `[ASSUMED]` that it_admin should hold it.
**Warning signs:** UAT: an it_admin user sees the ACCESS_REVOKE card but the trigger is permission-disabled.

### Pitfall 3: Recovery failure silently rolls back a valid approval (D-14 violation)
**What goes wrong:** If `onComplianceItemSatisfied` throws (e.g., `$queryRaw` error), the whole `approveUploadReplacement` tx rolls back — the doc stays unapproved. D-14 says recovery IS atomic with the SATISFIED flip (correct, keep it in tx) — so this is intended for genuine DB errors. The real trap is the **notification**: it must stay OUTSIDE the tx. Do NOT move `dispatchComplianceUploadOutcome` inside the tx.
**Why:** A notification dispatch failure (transient network) must never undo a legitimate approval (T-73-08-04).
**How to avoid:** Keep recovery in tx (atomic, correct), keep notification post-tx (best-effort, unchanged at :314).
**Warning signs:** Approve fails with a notification-service error.

### Pitfall 4: Multi-provider run creates Slack steps for an org with no SLACK_ORG_GRID connection
**What goes wrong:** Org enables SLACK toggle + signoff approved → derivation includes SLACK → run creates Slack steps → step-runner `resolveAdapter` throws "not connected" → step FAILS. This is the fail-closed behavior (correct, but a poor UX if not surfaced).
**Why:** The toggle (`enableProviderForOrg`) gates on signoff, not on an actual connected `IntegrationConnection`. `getProviderToggleState` reports `connected` separately.
**How to avoid:** The impact-preview pre-flight (D-02) already surfaces `reconnect_required` per provider; the derivation could additionally intersect with the connected state (`getProviderToggleState` logic) — but CONTEXT.md D-05 defines the set as enabled∩signoff∩resolver-backed (NOT ∩connected). Follow CONTEXT.md: include SLACK if enabled+signoff+resolver-backed, and let the step fail-closed + surface in run-view. Optionally note connection state in the trigger UI. Flag for discuss-phase if "connected" should be a 4th intersection term.
**Warning signs:** A deprovisioning run shows a FAILED Slack step with "not connected".

### Pitfall 5: `startDeprovisioningRun` lacks the org settings read
**What goes wrong:** The current mutation only fetches the assignment (deprovisioning.ts:155-168) — it never reads `Organization.settingsJson`. The dynamic derivation needs it. Forgetting to add the read → derivation reads `undefined` → empty set → always throws `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED`.
**Why:** The const didn't need settings; the dynamic version does.
**How to avoid:** Add `organization.findUnique({ where: { id: ctx.organizationId }, select: { settingsJson: true } })` (mirror `getProviderToggleState:597-601`).
**Warning signs:** Every start throws "integration not configured" even with GWS enabled.

### Pitfall 6: i18n parity gate fails on the new `Idp.trigger` keys
**What goes wrong:** New keys added to `en.json` only → `pnpm lint:i18n` / `i18n:parity` CI step red (en/de/pl/ar must match).
**How to avoid:** Add `Idp.trigger.*` to all four `apps/web-vite/messages/{en,de,pl,ar}.json`. Arabic is machine-generated (acceptable, native review deferred under LOCAL-ONLY).
**Warning signs:** `i18n:parity` CI step fails.

## Code Examples

### Existing run-view reuse (D-03 — verified shape)
```typescript
// Source: apps/web-vite/src/components/idp/deprovisioning-run-view-container.tsx
// Drop-in after a successful start: navigate to or render this with the returned runId.
<DeprovisioningRunViewContainer runId={runId} />
// It owns loading/empty/error and reads idp:override_step_failure internally.
```

### Existing eligibility query (D-11 — verified)
```typescript
// Source: deprovisioning.ts:99 — returns { allowed, earliestDate?, reason? }
trpc.deprovisioning.getDeprovisioningEligibility.queryOptions({ assignmentId })
// Disable the start button while !allowed; show earliestDate tooltip.
```

### Server caller test harness (both seams — verified template)
```typescript
// Source: packages/api/src/__tests__/deprovisioning-start.test.ts
import { createCallerFactory } from '../init';
import { appRouter } from '../root';
const createCaller = createCallerFactory(appRouter);
// vi.mock @contractor-ops/db (mockPrisma), @contractor-ops/auth (hasPermission),
// @contractor-ops/logger (noop), qstash-client (publishJSON spy).
// makeCaller builds a session with user.role='admin' + activeOrganizationId.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PROVIDERS_FOR_RUN = ['GOOGLE_WORKSPACE']` hardcoded | Per-org dynamic derivation (enabled∩signoff∩resolver-backed) | This phase (D-05) | Runs span GWS+Slack per org toggles |
| `startDeprovisioningRun`/`getDeprovisioningEligibility` UNGATED (`tenantProcedure`) | Gated with `idp:start_run` | This phase (D-10) | First-caller security closure |
| `approveUploadReplacement` flips SATISFIED but no recovery | Recovery hook called in-tx | This phase (D-12) | Payment unblocks on approve |
| ACCESS_REVOKE = icon only (`task-card-run.tsx:76`) | Inline trigger action in `TaskActionToolbar` | This phase (D-01) | F2 reachable from UI |

**Not deprecated, just deferred (verified registered but excluded):** ENTRA/OKTA/GITHUB adapters ARE registered as `Deprovisionable` (`register-all.ts:177` Slack; ENTRA/OKTA/GITHUB in `startHeavyLoad`), but `resolveAdapter` (`idp-deprovisioning-step-runner.ts:218-222`) fails closed for them (no token resolver). `IntegrationProvider` enum lacks ENTRA/OKTA. Confirmed out of scope (D-07).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `idp:start_run` should be granted to `it_admin` (the ACCESS_REVOKE assignee role), not only owner/admin | D-10 / Pitfall 2 | If only owner/admin get it, the role that completes the task per D-04 cannot start the run — the seam is technically closed but practically unreachable for IT_ADMIN. Surface in discuss-phase. |
| A2 | The `contractorId→assignmentId` resolution picks the most-recent `status='ENDED'` assignment ordered by `endedAt desc` | D-01 / Pattern 4 | If a contractor has multiple ended assignments and the wrong one is chosen, the cooldown/impact apply to the wrong engagement. CONTEXT.md says "define explicitly in planning" — this is the recommended rule, needs confirmation. |
| A3 | The resolver-backed set should be exported as a const from `idp-token-resolver.ts` and reused (not re-declared) so it cannot drift | D-05 / Pattern 1 | Low risk — this is the cleanest way to honor "derive, don't hardcode". The exact export mechanism is an implementation choice. |
| A4 | The provider derivation intersects enabled∩signoff∩resolver-backed but NOT ∩connected (per CONTEXT.md D-05 verbatim) | Pitfall 4 | If a SLACK toggle is on + signoff approved but no SLACK_ORG_GRID connection, the run creates a Slack step that fails-closed. Whether to also intersect ∩connected is a UX call — flag for discuss-phase. |
| A5 | No DB migration is required (RBAC statement is code; org settings already populated; 76-WR1 index already in schema) | Runtime State Inventory | If the 76-WR1 unique index was NOT yet applied to local DBs, an idempotency P2002 path won't fire. Audit tech-debt notes 76-WR1 "MUST precede any prod startDeprovisioningRun" — verify the index exists locally before E2E testing. |

## Open Questions

1. **Should `idp:start_run` be granted to `it_admin`?** (A1)
   - What we know: ACCESS_REVOKE task is assigned to IT_ADMIN (`workflow-templates.ts:396`); D-04 says IT_ADMIN completes the task; `it_admin` role holds no idp permission today.
   - What's unclear: CONTEXT.md D-10 says "register/seed across roles" but doesn't name which roles beyond the owner/admin sibling pattern.
   - Recommendation: Grant to owner + admin + it_admin. Confirm in discuss-phase; this is the only RBAC ambiguity.

2. **Is the 76-WR1 per-org unique index applied to local DBs?** (A5)
   - What we know: schema declares `@@unique([organizationId, idempotencyKey])`; tech-debt says it must precede prod runs; migrations deferred post-deploy under LOCAL-ONLY.
   - What's unclear: whether `pnpm db:migrate` was run locally for the 76-WR1 migration.
   - Recommendation: A Wave-0/setup task verifies the index exists locally (or applies it) before the E2E idempotency test relies on P2002.

3. **Should the provider derivation also require an active `IntegrationConnection` (∩connected)?** (A4)
   - What we know: D-05 defines the set as enabled∩signoff∩resolver-backed. `getProviderToggleState` reports `connected` separately.
   - Recommendation: Follow CONTEXT.md verbatim (no ∩connected); rely on step fail-closed + run-view surfacing. Flag as a possible UX refinement.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL 17 + Prisma 7 | All DB reads/writes (assignment, run, ApprovalFlow) | ✓ (repo standard) | 17 / Prisma 7 | — |
| Better Auth | `idp:start_run` enforcement (`authApi.hasPermission`) | ✓ (`packages/auth`) | (workspace) | — |
| Unleash (feature-flags) | `getFlagSignoff` provider signoff | ✓ self-hosted; `FLAG_SIGNOFF_BYPASS=local` bypass in local | — | local bypass |
| QStash (Upstash) | Step fan-out (not exercised by unit tests — mocked) | env-gated; mocked in tests | — | tests mock `publishJSON` |
| vitest | All tests | ✓ | (workspace) | — |

**No missing blocking dependencies.** QStash + real provider APIs are not needed for the unit/integration tests (all mocked, per the existing harness). The E2E flow tests run DB-free against hoisted mock-Prisma stores (per `deprovisioning-start.test.ts` and `v6-cross-feature-composition.test.ts`).

## Validation Architecture

> nyquist_validation: config not inspected as explicitly false → treated as ENABLED. The audit lists 81 is not yet in nyquist tables; both E2E flows are mandatory per CONTEXT.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (workspace; turbo `pnpm test`) |
| Server tests | `packages/api/src/__tests__/*.test.ts` + `packages/api/src/services/__tests__/*.test.ts` |
| web-vite tests | `apps/web-vite/src/**/__tests__/*.test.tsx` (per-domain `_render.tsx` helper) |
| Quick run (server) | `pnpm --filter @contractor-ops/api test <path>` |
| Quick run (web-vite) | `pnpm --filter @contractor-ops/web-vite test <path>` (NEVER unscoped — RAM) |
| Auth tests | `pnpm --filter @contractor-ops/auth test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| INT-01 derivation | Multi-provider run creates GWS+Slack steps when both enabled+signoff; GWS-only when only GWS | unit | `pnpm --filter @contractor-ops/api test deprovisioning-start` | ✅ extend (`deprovisioning-start.test.ts`) |
| INT-01 D-06 | Empty provider set → throws `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` | unit | same file | ❌ Wave 0 (new case) |
| INT-01 D-10 | `startDeprovisioningRun`/`getDeprovisioningEligibility` reject without `idp:start_run` | unit | same file (mock `hasPermission` → false) | ❌ Wave 0 (new case) |
| INT-01 D-10 seed | owner/admin/it_admin hold `idp:start_run`; others don't | unit | `pnpm --filter @contractor-ops/auth test roles` | ⚠️ update `roles.test.ts:75-86` |
| INT-01 D-01 | `contractorId→assignmentId` resolves most-recent ENDED | unit | new resolver test (api) | ❌ Wave 0 |
| INT-01 D-09 | Existing run for assignment → "view run" / re-trigger returns existing (P2002) | unit | `deprovisioning-start.test.ts` (P2002 case exists :227) | ✅ exists; extend for per-assignment key |
| INT-01 E2E | ACCESS_REVOKE trigger → start → run created (hook + container) | integration | new web-vite hook test + composition | ❌ Wave 0 |
| INT-02 recovery | approve → `onComplianceItemSatisfied` fires → held flow PENDING_COMPLIANCE→PENDING | unit | `pnpm --filter @contractor-ops/api test compliance-upload-review` | ✅ extend (`compliance-upload-review.test.ts`) |
| INT-02 D-14 | notification dispatch failure does NOT roll back approval | unit | same file | ❌ Wave 0 (new case) |
| INT-02 E2E | portal upload → admin approve → payment gate releases | integration | extend composition or new test | ❌ Wave 0 |
| D-08 (regression) | Slack suspend/revoke execute via org-grid token | unit | `pnpm --filter @contractor-ops/integrations test slack-adapter` | ✅ exists (`slack-adapter.test.ts`) |

### Sampling Rate
- **Per task commit:** scoped quick run of the touched package's relevant test file.
- **Per wave merge:** `pnpm --filter @contractor-ops/api test` + `pnpm --filter @contractor-ops/auth test` + scoped web-vite tests.
- **Phase gate:** both E2E flows green + `pnpm lint:ci` (includes `check:web-vite-data-layer`, `i18n` parity) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Extend `packages/api/src/__tests__/deprovisioning-start.test.ts` — multi-provider derivation, empty-set throw, `idp:start_run` gate.
- [ ] Extend `packages/api/src/__tests__/compliance-upload-review.test.ts` — assert `onComplianceItemSatisfied` fires + D-14 notification-failure isolation (add `$queryRaw`/`approvalFlow.update` to mock).
- [ ] New: `contractorId→assignmentId` resolver test (api).
- [ ] New: web-vite `use-start-deprovisioning` hook test (mirror `use-deprovisioning-run` test pattern + `_render.tsx`).
- [ ] Update `packages/auth/src/__tests__/roles.test.ts` invariants for `idp:start_run`.
- [ ] E2E: extend `v6-cross-feature-composition.test.ts` (or a new `81-int-closure.test.ts`) to compose both flows — note the existing composition test deliberately excluded F2 (line 28-30), so this fills that gap.
- [ ] Verify 76-WR1 unique index applied locally (setup task) before relying on P2002.

## Security Domain

> security_enforcement: treated as ENABLED (not explicitly false in config inspected).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Tenant isolation via Prisma RLS extension (`tenantProcedure`); region routing (EU/ME) |
| V2 Authentication | yes (indirect) | Better Auth session; `ctx.user.id` from session, never client |
| V4 Access Control | **yes (core of D-10)** | `requirePermission({ idp: ['start_run'] })` — closes the UNGATED gap on a destructive mutation; IDOR-safe via `organizationId` scoping + `findOrThrow` NOT_FOUND narrowing |
| V5 Input Validation | yes | Zod on every procedure (`assignmentId`, `idempotencyKey` min(8)max(128), `itemId`/`documentId` cuid) |
| V6 Cryptography | yes (existing) | Provider tokens decrypted via `decryptCredentials` (not touched); org-grid token never logged raw |
| V7 Error Handling/Logging | yes | `getIdpAuditLogger` + `writeAuditLog`; external user IDs hashed (`hashExternalUserId`); override notes never logged raw |
| V8 Data Protection | yes | `complianceHoldsJson` containment query uses bound parameter (no string interpolation — `compliance-recovery.ts:49`) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized deprovisioning trigger (destructive) | Elevation of Privilege | `idp:start_run` RBAC gate (D-10) — was missing; this phase closes it |
| Cross-tenant idempotency-key squat | Tampering | `@@unique([organizationId, idempotencyKey])` (76-WR1) + P2002 handler filters by org (`deprovisioning.ts:260`) |
| IDOR on assignment/run/item | Information Disclosure | `organizationId` in every `where` + `findOrThrow` → NOT_FOUND on cross-tenant |
| SQL injection in held-flow query | Tampering | `$queryRaw` with bound `${containment}::jsonb` parameter (no interpolation) `[VERIFIED: compliance-recovery.ts:49]` |
| Recovery rollback of valid approval | Denial of Service | Recovery in-tx (atomic, intended); notification post-tx best-effort (D-14) |
| Override note leakage via run-view | Information Disclosure | Existing secondary permission check redacts note unless caller holds `idp:override_step_failure` (`deprovisioning.ts:413`) — unaffected |

## Sources

### Primary (HIGH confidence — read this session)
- `packages/api/src/routers/integrations/deprovisioning.ts` (full) — `startDeprovisioningRun`, `getDeprovisioningEligibility`, `PROVIDERS_FOR_RUN`, `DEPROVISIONING_TOGGLE_PROVIDERS`, `isProviderSignoffSatisfied`, toggle procedures.
- `packages/api/src/services/idp-token-resolver.ts` (full) — `DeprovisionProvider = GWS|SLACK` (resolver-backed authoritative list).
- `packages/api/src/services/idp-deprovisioning-step-runner.ts` (full) — `resolveAdapter` GWS+Slack execution, fail-closed for ENTRA/OKTA/GITHUB.
- `packages/integrations/src/adapters/slack-adapter.ts` (full) — D-08 confirmed: `suspendAccount`/`revokeAllSessions`/`describeImpact` execute via `#orgGridToken`.
- `packages/integrations/src/adapters/register-all.ts` — Deprovisionable registration (Slack essential-tier; ENTRA/OKTA/GITHUB heavy-tier).
- `packages/api/src/services/idp-impact-preview.ts` — `getImpactPreview` GWS+Slack.
- `packages/api/src/routers/compliance/compliance-admin.ts` (:1-40, :230-350) — `approveUploadReplacement` tx; recovery NOT imported/called.
- `packages/api/src/services/compliance-recovery.ts` (full) — `onComplianceItemSatisfied` signature + per-item semantics.
- `packages/api/src/routers/compliance/classification.ts` (:80-103) — `releaseHeldApprovalsForContractor` (all-BLOCKING loop) + `onComplianceItemSatisfied` call shape to mirror.
- `packages/auth/src/permissions.ts` + `roles.ts` + `__tests__/roles.test.ts` (full) — `idp` group, role grants, invariants to update.
- `packages/api/src/middleware/rbac.ts` (full) — `requirePermission` pattern.
- `packages/db/prisma/schema/workflow.prisma` (:105-147) — `WorkflowRun.contractorId` nullable, no assignmentId.
- `packages/db/prisma/schema/contractor.prisma` (:161-202, :322-326) — `ContractorAssignment` (endedAt, status), `AssignmentStatus` enum.
- `packages/db/prisma/schema/idp-deprovisioning.prisma` (:8-61) — `DeprovisioningRun.assignmentId`, `@@unique([organizationId, idempotencyKey])`, `@@index([organizationId, assignmentId])`.
- `apps/web-vite/src/components/idp/*` + `hooks/*` — run-view, impact-preview, hooks (reuse surface).
- `apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx` (full) — `TaskActionToolbar` (:216) attachment point.
- `apps/web-vite/src/components/workflows/hooks/use-task-card-run.ts` — existing task-card hook boundary.
- `apps/web-vite/src/components/idp/__tests__/_render.tsx` — web-vite test render helper.
- `packages/api/src/__tests__/deprovisioning-start.test.ts` + `compliance-upload-review.test.ts` + `v6-cross-feature-composition.test.ts` + `services/__tests__/compliance-recovery.test.ts` — test harness templates.
- `scripts/check-web-vite-data-layer.mjs` — the data-layer guard rules.
- `packages/api/src/routers/workflow/workflow-execution.ts` (:708-754) — `getRun` returns contractor relation (+ contractorId scalar).
- `packages/api/src/routers/workflow/workflow-templates.ts` (:396) — ACCESS_REVOKE seeded `assigneeRole: 'IT_ADMIN'`.
- `apps/web-vite/messages/en.json` — `Idp` namespace (preview/runView/OverrideStepDialog/StepOverrideBadge/slackOrgGrid/toggleTable).
- `.planning/phases/81-.../81-CONTEXT.md` + `.planning/v6.0-MILESTONE-AUDIT.md` — phase decisions + spec.

### Secondary
- `.planning/STATE.md` (via CONTEXT.md references) — 78-06 schema constraint, 76-WR1 deferral notes.

### Tertiary
- None — all claims verified against live source.

## Metadata

**Confidence breakdown:**
- D-08 Slack leg: HIGH — execution path traced from step-runner → adapter methods making real SCIM/admin API calls with org-grid token.
- PROVIDERS_FOR_RUN derivation (D-05/06/07): HIGH — resolver-backed set, toggle/signoff sources, and the single consumer (:200) all verified.
- contractorId→assignmentId (D-01): HIGH on schema facts (no assignmentId FK; status/endedAt present); MEDIUM on the disambiguation rule (recommended, needs confirmation — A2).
- idp:start_run (D-10): HIGH on pattern; the it_admin grant decision is flagged (A1).
- idempotency/existing-run (D-09): HIGH — unique index + P2002 handler + per-assignment index verified.
- INT-02 recovery (D-12/13/14): HIGH — exact tx shape, hook signature, mirror pattern, and the missing-import gap all verified.
- web-vite reuse (D-02/03/11): HIGH — all components/hooks exist with the shapes CONTEXT.md describes.
- Validation/tests: HIGH — existing harness templates for both seams confirmed.

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable internal code; re-verify only if 76/77/78 files change before planning)
