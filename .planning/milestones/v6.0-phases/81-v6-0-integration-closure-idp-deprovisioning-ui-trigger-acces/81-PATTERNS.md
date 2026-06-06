# Phase 81: v6.0 Integration Closure — Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 16 (10 source/test modify, 4 new web-vite, 1 i18n bundle ×4 locales, 1 D-08 regression)
**Analogs found:** 16 / 16 (every target has an in-repo analog — this is a ~95% reuse wiring phase)

All file paths below are absolute-from-repo-root. All line anchors verified by Read this session.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/api/src/routers/integrations/deprovisioning.ts` (MODIFY — dynamic `PROVIDERS_FOR_RUN`, gate 2 procs, add settings read, optional resolver proc) | controller (tRPC router) | request-response / CRUD | self (`getProviderToggleState` :594 in same file) + `overrideStepFailure` gate | exact |
| `packages/api/src/routers/compliance/compliance-admin.ts` (MODIFY — call `onComplianceItemSatisfied` in `approveUploadReplacement` tx :284-311) | controller (tRPC router) | request-response / transform | `packages/api/src/routers/compliance/classification.ts:91-103` | exact |
| `packages/auth/src/permissions.ts` (MODIFY — add `start_run` to `idp` :25) | config (access statement) | n/a | `workflow: [...'override_blocking_task']` :21, existing `idp` :25 | exact |
| `packages/auth/src/roles.ts` (MODIFY — `start_run` to owner :28, admin :58, it_admin :124-133) | config (role grants) | n/a | existing `idp:['override_step_failure']` :28/:58 | exact |
| `packages/auth/src/__tests__/roles.test.ts` (MODIFY — :75-86 invariants) | test | n/a | self (existing idp assertions :75-86) | exact |
| `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts` (NEW) | hook (sole tRPC boundary) | request-response | `apps/web-vite/src/components/idp/hooks/use-deprovisioning-run.ts` + `use-impact-preview.ts` | exact |
| `apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx` (NEW) | container | request-response | `apps/web-vite/src/components/idp/deprovisioning-run-view-container.tsx` + `impact-preview-panel-container.tsx` | exact |
| `apps/web-vite/src/components/idp/deprovisioning-trigger.tsx` (NEW — button+confirm dialog) | component | n/a (presentational) | `impact-preview-panel.tsx` + `override-step-dialog.tsx` (Dialog body/footer) | role-match |
| `apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx` (MODIFY — `TaskActionToolbar` :216) | component | n/a (presentational) | self (`TaskActionToolbar` :216, `SkipPopover` :116) | exact |
| `apps/web-vite/messages/{en,de,pl,ar}.json` (MODIFY — new `Idp.trigger.*`) | config (i18n) | n/a | existing `Idp.preview` / `Idp.runView` namespaces | exact |
| `packages/api/src/__tests__/deprovisioning-start.test.ts` (MODIFY — derivation, empty-set, gate cases) | test | n/a | self (existing P2002 case + hoisted mockPrisma) | exact |
| `packages/api/src/__tests__/compliance-upload-review.test.ts` (MODIFY — recovery fires + D-14 isolation) | test | n/a | self (existing approve harness) | exact |
| `contractorId→assignmentId` resolver test (NEW, api) | test | n/a | `deprovisioning-start.test.ts` hoisted-prisma pattern | role-match |
| `apps/web-vite/.../idp/__tests__/use-start-deprovisioning.test.tsx` (NEW) | test | n/a | `apps/web-vite/src/components/idp/__tests__/_render.tsx` + use-deprovisioning-run test pattern | role-match |
| `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` (MODIFY or new `81-int-closure.test.ts`) | test (integration) | n/a | self (F2 deliberately excluded :28-30 — this fills the gap) | exact |
| `packages/integrations/src/adapters/__tests__/slack-adapter.test.ts` (MODIFY — D-08 suspend/revoke/impact regression) | test | n/a | self (existing OAuth/webhook cases) — but suspend path is NOT yet covered | role-match (NEW cases) |

---

## Pattern Assignments

### `packages/api/src/routers/integrations/deprovisioning.ts` (tRPC router, request-response/CRUD)

**Analog:** self — the file already contains every primitive needed.

**Change 1 — dynamic `PROVIDERS_FOR_RUN` derivation (D-05/D-06/D-07).**
The hardcoded const is the ONLY consumer of provider list:
- declared: `:68` — `const PROVIDERS_FOR_RUN = ['GOOGLE_WORKSPACE'] as const;`
- consumed: `:200` — `steps: { create: PROVIDERS_FOR_RUN.flatMap(provider => STEP_KINDS.map(...)) }`

Source of the three intersection terms, all in-file or imported:
- `DEPROVISIONING_TOGGLE_PROVIDERS` (:32-38) — the 5-provider tuple (schema-derived).
- `isProviderSignoffSatisfied(provider)` (:53-56) — signoff-flag gate (local bypass aware).
- resolver-backed authoritative list — `DeprovisionProvider = 'GOOGLE_WORKSPACE' | 'SLACK'` at `packages/api/src/services/idp-token-resolver.ts:10`. **Derive from this, do NOT add a 4th literal** (CONTEXT "Specific Ideas" / RESEARCH A3). Recommended: export `RESOLVER_BACKED_PROVIDERS` from `idp-token-resolver.ts` and define `DeprovisionProvider` as `(typeof RESOLVER_BACKED_PROVIDERS)[number]`.

The enabled-map read pattern is verbatim in `getProviderToggleState` (:614-615):
```typescript
const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
const enabledMap = (settings.idpDeprovisioningEnabled as Record<string, boolean>) ?? {};
```

**Change 2 — add the org settings read inside `startDeprovisioningRun` (Pitfall 5).**
`startDeprovisioningRun` (:147-273) currently fetches ONLY the assignment (:155-168) — it does NOT read `Organization.settingsJson`. Add a read mirroring `getProviderToggleState:597-601`:
```typescript
const org = await ctx.db.organization.findUnique({
  where: { id: ctx.organizationId },
  select: { settingsJson: true },
});
```
Then derive providers; if `[]` → `throw new TRPCError({ code: 'PRECONDITION_FAILED', message: DEPROVISIONING_INTEGRATION_NOT_CONFIGURED })` (error key already imported :11). The fan-out loop (:229) already iterates `run.steps`, so >1 provider works automatically.

**Change 3 — gate both ungated procedures with `idp:start_run` (D-10).**
Mirror the existing override gate in this same file (`overrideStepFailure` uses `.use(requirePermission({ idp: ['override_step_failure'] }))`). Add to:
- `getDeprovisioningEligibility` (:99, currently `tenantProcedure` only)
- `startDeprovisioningRun` (:147, currently `tenantProcedure` only)

Insert chain pattern (from `approveUploadReplacement` :237 and `getProviderToggleState` :595):
```typescript
tenantProcedure
  .use(requirePermission({ idp: ['start_run'] }))
  .input(...)
```

**Change 4 (Claude's-discretion placement) — `contractorId→assignmentId` resolver (D-01 / Pattern 4).**
RESEARCH recommends a server-side tenantProcedure (keeps the hook one tRPC call → `check:web-vite-data-layer` green). Query the most-recent ENDED assignment; `AssignmentStatus` enum = `ACTIVE|ENDED|PLANNED` (verified `packages/db/prisma/schema/contractor.prisma:322-326`):
```typescript
const assignment = await ctx.db.contractorAssignment.findFirst({
  where: { contractorId, organizationId: ctx.organizationId, status: 'ENDED' },
  orderBy: { endedAt: 'desc' },
  select: { id: true },
});
```
Follow the `findOrThrow` + `organizationId`-scoped `where` idiom used by `getDeprovisioningEligibility` (:103-115). Null result → trigger disabled with reason (A2 — disambiguation rule needs plan confirmation).

**Idempotency / existing-run lookup (D-09):** P2002 handler already returns the existing run (:256-272), filtered by `organizationId_idempotencyKey`. No change to this logic; the UI derives a stable `idempotencyKey` from `assignmentId`.

---

### `packages/api/src/routers/compliance/compliance-admin.ts` (tRPC router, request-response/transform)

**Analog:** `packages/api/src/routers/compliance/classification.ts:91-103` (`releaseHeldApprovalsForContractor` — mirror the per-item CALL, NOT the all-BLOCKING loop).

**Call shape to mirror** (`classification.ts:101`):
```typescript
await onComplianceItemSatisfied(tx, { itemId: item.id, contractorId, organizationId });
```
The `tx` typing the analog uses: `Parameters<typeof onComplianceItemSatisfied>[0]` (`classification.ts:92`).

**Hook signature** (`packages/api/src/services/compliance-recovery.ts:43-46`):
```typescript
export async function onComplianceItemSatisfied(
  tx: RecoveryClient,
  args: { itemId: string; contractorId: string; organizationId: string },
): Promise<{ resumedFlowIds: string[] }>
```
`RecoveryClient` (:29-35) is satisfied structurally by the `$transaction` callback client (it needs `$queryRaw`, `approvalFlow.update`, payment-gate + audit-writer clients — all present on `tx`).

**Where (D-12):** inside the existing `$transaction` in `approveUploadReplacement` (:246-312), AFTER the SATISFIED flip (:284-291) and audit write (:296-310), BEFORE `return { item: updated, contractorId: before.contractorId }` (:311). `contractorId` is `before.contractorId` (already in scope :249). `onComplianceItemSatisfied` is NOT currently imported (import block :19-40) — add it from `'../../services/compliance-recovery'`.

**D-14 invariant — do NOT touch the post-tx notification.** `dispatchComplianceUploadOutcome` (:314-317) stays OUTSIDE the tx, unchanged, best-effort — a dispatch failure must never roll back the approval (T-73-08-04). The recovery call IS in-tx (atomic, intended).

---

### `packages/auth/src/permissions.ts` (access statement) + `roles.ts` (role grants)

**Analog:** the existing single-action `idp` group + the `workflow:override_blocking_task` owner/admin split.

**`permissions.ts:25`** — add the sibling action:
```typescript
idp: ['override_step_failure', 'start_run'],
```

**`roles.ts`** — three grants:
- `allPermissions.idp` (:28) → `['override_step_failure', 'start_run']` (owner inherits via `ac.newRole(allPermissions)` :46)
- `admin` block `idp` (:58) → `['override_step_failure', 'start_run']`
- `it_admin` block (:124-133) — currently holds NO `idp` key. ADD `idp: ['start_run'],` (A1 / Pitfall 2 — it_admin is the seeded `ACCESS_REVOKE` assignee `workflow-templates.ts:396`, so the D-01 inline-card path must be reachable by it_admin). `override_step_failure` stays owner/admin-only.

**RBAC enforcement is code, not DB seed** (RESEARCH Runtime State Inventory): Better Auth evaluates `roles.ts` per request via `authApi.hasPermission`. Adding the action takes effect on next request — no migration. UI gate mirror: `usePermissions().can('idp', ['start_run'])` (analog `deprovisioning-run-view-container.tsx:21`).

---

### `packages/auth/src/__tests__/roles.test.ts` (test) — MUST update or CI reds (Pitfall 1)

**Analog:** self. Three assertions hard-code the current single-action shape:
- `:75-78` — `owner and admin both hold idp:override_step_failure` asserts `.idp` `toEqual(['override_step_failure'])` (exact). Update to expect `['override_step_failure', 'start_run']` (sort-tolerant).
- `:80-86` — `no role other than owner/admin holds idp:override_step_failure` asserts `statements.idp` `toBeUndefined()` for every non-owner/admin role. Rewrite to allow `it_admin` to hold EXACTLY `['start_run']` and assert it does NOT hold `override_step_failure`; all other roles stay `undefined`.
- Also the owner-vs-statement equality test (:26-37) iterates the full statement — `idp` now has 2 actions; the sort-compare at :35 already handles it (owner gets all), but verify.

Note `:100-103` (`it_admin cannot read invoices or contractors`) still holds — it_admin gains only `idp:start_run`, not invoice/contractor.

---

### `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts` (hook — SOLE tRPC boundary) — NEW

**Analog:** `apps/web-vite/src/components/idp/hooks/use-deprovisioning-run.ts` (mutation + invalidate + toast) and `use-impact-preview.ts` (query + `useQueryClient`).

**Imports pattern** (verbatim from `use-deprovisioning-run.ts:7-12`):
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
```

**Query-options + mutation-options pattern** (`use-deprovisioning-run.ts:38-51`, `use-impact-preview.ts:18-20`):
```typescript
const eligibilityQuery = useQuery(
  trpc.deprovisioning.getDeprovisioningEligibility.queryOptions({ assignmentId }),
);
const startMutation = useMutation(
  trpc.deprovisioning.startDeprovisioningRun.mutationOptions({
    onSuccess: ({ runId }) => { /* navigate to run-view (D-03) */ },
    onError: err => toast.error(err.message || t('startFailure')),
  }),
);
```

This hook is the single boundary for BOTH entry points (D-01). It must expose:
- the eligibility gate (`getDeprovisioningEligibility` → `{ allowed, earliestDate?, reason? }`, `deprovisioning.ts:99-137`) for D-11 disabled-button + tooltip;
- the deterministic `idempotencyKey` derived from `assignmentId` (D-09; key min(8)max(128) per `deprovisioning.ts:151`);
- the start mutation (D-03 → navigate to existing `DeprovisioningRunViewContainer`).

The `contractorId→assignmentId` resolution (D-01 task-card path) must go through ONE server call, not client logic — call the new resolver procedure inside this hook (keeps `check:web-vite-data-layer` green; forbidden patterns are `useTRPC`/`useQuery`/`useMutation`/`useInfiniteQuery`/`useSuspenseQuery` outside `/hooks/`, verified `scripts/check-web-vite-data-layer.mjs:12-18`; `useQueryClient`/`useQueryState` are exempt :45-46).

---

### `apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx` + `deprovisioning-trigger.tsx` — NEW

**Container analog:** `deprovisioning-run-view-container.tsx` (loading/error/empty + permission gate + hook call) and `impact-preview-panel-container.tsx` (failure-state branches).

**Permission-gate + state-machine pattern** (`deprovisioning-run-view-container.tsx:18-43`):
```typescript
const permissions = usePermissions();
const canStart = permissions.can('idp', ['start_run']);   // D-10 UI gate
const state = useStartDeprovisioning(assignmentId);
if (state.isLoading) return <Skeleton className="h-48 w-full" data-testid="..." />;
if (state.isError)   return (/* role="alert" + retry button */);
if (state.isEmpty)   return (/* role="status" empty */);
```
Container owns loading/empty/error (CLAUDE.md web-vite layering); it calls the hook only — NO direct tRPC.

**Reuse, do not rebuild (D-02/D-03):**
- pre-flight impact preview → render existing `ImpactPreviewPanelContainer` (`impact-preview-panel-container.tsx:31`, props `{ assignmentId, provider, onProceedWithoutPreview? }`). `ImpactProvider = 'GOOGLE_WORKSPACE' | 'SLACK'` (`use-impact-preview.ts:11`).
- post-start → navigate to existing `DeprovisioningRunViewContainer` (`runId` prop) (`deprovisioning-run-view-container.tsx:14-16`).

**Component (button + confirm dialog) analog:** Dialog body/footer convention is mandatory (memory `project_web_vite_dialog_pattern`): `DialogContent → DialogBody (scroll) + DialogFooter (sticky actions)`. The confirm dialog wraps the `ImpactPreviewPanelContainer` in `DialogBody`; start/cancel in `DialogFooter`. WCAG: keyboard, focus, semantic roles (mirror the `role="alert"`/`role="status"` usage in the analog containers).

---

### `apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx` (component) — MODIFY `TaskActionToolbar` (:216)

**Analog:** self — `SkipPopover` (:116-160) / `ReassignPopover` (:162-214) show the established "extra inline action via a small sub-component fed by a hook-returned object" idiom, and `TaskActionToolbar` (:216-270) is the attachment point.

**Attachment:** inside `TaskActionToolbar` render (:248-269), conditionally render the deprovisioning trigger when `task.taskType === 'ACCESS_REVOKE'`. The `taskType` field is on `TaskCardRunTask` (:89) and the ACCESS_REVOKE icon already maps at :76.

**Data-layer constraint:** `task-card-run.tsx` is a COMPONENT, not under `/hooks/` — it MUST NOT call tRPC. The existing pattern passes hook-returned objects down as props (see `completeMutation`/`skip`/`reassign` props :109-111, sourced from `useTaskCardRun` :73-83). The deprovisioning trigger must follow suit: the run-page container wires `use-start-deprovisioning` (resolving `contractorId→assignmentId` server-side) and passes the trigger element/handlers down — OR renders `DeprovisioningTriggerContainer` (which itself only calls the hook). Do NOT add `useMutation` here (guard at `scripts/check-web-vite-data-layer.mjs`).

The `contractorId` is reachable client-side: `workflow.getRun` (`workflow-execution.ts:708-754`) uses `include` (not `select`), so the `WorkflowRun.contractorId` scalar + the `contractor` relation (`id`, :726-733) are both in the returned row. `WorkflowRun` has NO `assignmentId` FK (`workflow.prisma`) — hence the server resolver.

---

### `apps/web-vite/messages/{en,de,pl,ar}.json` (i18n) — MODIFY

**Analog:** existing `Idp.preview` and `Idp.runView` sub-namespaces (verified keys in `en.json`):
- `Idp` top-level keys: `["preview","runView","OverrideStepDialog","StepOverrideBadge","slackOrgGrid","toggleTable"]`
- `Idp.runView`: includes `error`, `retry`, `empty`, `provider.*`, `status.*`.
- `Idp.preview`: includes `failure.title/body/retry/proceed`, `empty`, `refresh`.

Add a new `Idp.trigger.*` sub-namespace (Claude's discretion on exact keys) covering: start label, confirm title/body, cooldown-disabled tooltip (with earliest-date), "view run" (existing-run state, D-09), not-configured reason (D-06). **en/de/pl/ar parity mandatory** (Pitfall 6 — `i18n:parity` CI reds on missing locales). Arabic machine-generated, native review deferred (LOCAL-ONLY).

---

## Shared Patterns

### RBAC gate (server-authoritative)
**Source:** `packages/api/src/middleware/rbac.ts:19-61` (`requirePermission`); usage `compliance-admin.ts:237`, `deprovisioning.ts:595`, `workflow-execution.ts:709`.
**Apply to:** `startDeprovisioningRun`, `getDeprovisioningEligibility`, the new `contractorId→assignmentId` resolver.
```typescript
tenantProcedure.use(requirePermission({ idp: ['start_run'] }))
```
UI gate (advisory only): `usePermissions().can('idp', ['start_run'])` (`deprovisioning-run-view-container.tsx:21`).

### Tenant scoping + IDOR-safe lookup
**Source:** `deprovisioning.ts:103-115` (`findOrThrow` + `organizationId` in `where` → NOT_FOUND on cross-tenant); `compliance-admin.ts:247-282` (org + ownership guards).
**Apply to:** every new/modified DB read. `ctx.organizationId` from session — never client input.

### Audit logging on sensitive mutations
**Source:** `compliance-admin.ts:296-310` (`writeAuditLog({ tx, ... })` inside the tx); `deprovisioning.ts:246-254` (`getIdpAuditLogger().info({ auditEvent, ... })`).
**Apply to:** start-run already logs (`deprovision_run_started`); recovery writes `approval.compliance_resolved` inside `onComplianceItemSatisfied` (no extra audit needed — D-13). No NEW notification on flow resume.

### In-transaction recovery atomicity (D-12/D-14)
**Source:** `classification.ts:84-103` (recovery runs inside the caller's `$transaction`); `compliance-recovery.ts:43-57` (`$queryRaw` with bound `::jsonb` parameter — no interpolation).
**Apply to:** the `approveUploadReplacement` change. Recovery in-tx (atomic); contractor notification post-tx best-effort (unchanged).

### web-vite Page→Container→Hook→Component
**Source guard:** `scripts/check-web-vite-data-layer.mjs` — `useTRPC|useQuery|useMutation|useInfiniteQuery|useSuspenseQuery` forbidden outside `*/hooks/*` and `providers/`; `useQueryClient`/`useQueryState` exempt.
**Apply to:** all new web-vite files. One hook = sole tRPC boundary; containers own loading/empty/error; components are presentational (props in, JSX out). Dialog body/footer convention for the confirm dialog.

### Server-caller test harness (both seams)
**Source:** `packages/api/src/__tests__/deprovisioning-start.test.ts:5-90` and `compliance-upload-review.test.ts:1-60`.
Pattern: `vi.hoisted(() => ({ mockPrisma, ... }))` building an in-memory store; `$transaction: vi.fn(async fn => fn(mockPrisma))`; `vi.mock('@contractor-ops/auth', ...)` with `authApi.hasPermission` resolving `{ success: true|false }` (flip to false for the D-10 reject case); `vi.mock('@contractor-ops/db', ...)` returning `mockPrisma`; noop logger mock; `createCallerFactory(appRouter)`. For INT-02 add `$queryRaw` + `approvalFlow.update` to the mock store (D-14 isolation case asserts a notify failure does NOT roll back).

### web-vite hook test harness
**Source:** `apps/web-vite/src/components/idp/__tests__/_render.tsx` (`mount(ui)` + `setupTestI18n()` + React 19 `act`). Mirror the `use-deprovisioning-run` test pattern for `use-start-deprovisioning`.

---

## No Analog Found

None. Every target maps to an existing in-repo analog. Two items are **NEW test cases against an existing file** (not extends of an existing assertion) — flagged so the planner does not assume coverage exists:

| File | Role | Note |
|------|------|------|
| `packages/integrations/src/adapters/__tests__/slack-adapter.test.ts` | test | D-08 regression. Current file covers ONLY `getOAuthConfig` / `exchangeCodeForTokens` / `refreshToken` / `verifyWebhookSignature` (verified — describe/it grep). The deprovision execution path (`withOrgGridToken` :136, `suspendAccount` SCIM `active=false` :481-484, `revokeAllSessions` `admin.users.session.invalidate` :516-520, `describeImpact` :540) is implemented but NOT yet tested. D-08 = add these cases (stub `fetch`, assert SCIM PATCH + admin.session.invalidate fire with the org-grid bearer). |
| `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` (or new `81-int-closure.test.ts`) | test | F2 (IdP deprovisioning) was DELIBERATELY excluded from the composition (verified comment :28-30). Both E2E flows are now mandatory (CONTEXT deferred-note) → this fills the gap. |

---

## Metadata

**Analog search scope:**
- `packages/api/src/routers/integrations/`, `packages/api/src/routers/compliance/`, `packages/api/src/services/`, `packages/api/src/middleware/`, `packages/api/src/__tests__/`
- `packages/auth/src/` + `__tests__/`
- `packages/integrations/src/adapters/` + `__tests__/`
- `packages/db/prisma/schema/` (contractor, workflow, idp-deprovisioning enums)
- `apps/web-vite/src/components/idp/` (+ hooks, __tests__), `apps/web-vite/src/components/workflows/workflow-run/` (+ hooks)
- `apps/web-vite/messages/`, `scripts/check-web-vite-data-layer.mjs`

**Files read (verified line anchors):** 16 source/test/config files + en.json key inventory + 2 confirming greps.

**Key cross-cutting facts confirmed this session:**
- `PROVIDERS_FOR_RUN` has exactly ONE consumer (`deprovisioning.ts:200`); derivation terms all in-file/imported.
- `startDeprovisioningRun` does NOT read `Organization.settingsJson` today (Pitfall 5 confirmed) — must add the read.
- `it_admin` holds NO `idp` permission today (`roles.ts:124-133`); `roles.test.ts:80-86` hard-asserts the single-action shape (Pitfall 1 confirmed).
- `onComplianceItemSatisfied` NOT imported in `compliance-admin.ts` (import block :19-40); call site is :311 (before return).
- `WorkflowRun` has no `assignmentId`; `AssignmentStatus = ACTIVE|ENDED|PLANNED` (confirmed schema) — server resolver picks most-recent ENDED.
- `workflow.getRun` uses `include` → `contractorId` scalar reaches the client.
- Slack deprovision methods exist but are NOT unit-tested → D-08 is a NEW test, not an extend.

**Pattern extraction date:** 2026-06-06
