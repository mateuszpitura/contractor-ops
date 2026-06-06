---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - apps/web-vite/messages/ar.json
  - apps/web-vite/messages/de.json
  - apps/web-vite/messages/en.json
  - apps/web-vite/messages/pl.json
  - apps/web-vite/src/components/idp/__tests__/use-start-deprovisioning.test.tsx
  - apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx
  - apps/web-vite/src/components/idp/deprovisioning-trigger.tsx
  - apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts
  - apps/web-vite/src/components/workflows/workflow-run-detail-container.tsx
  - apps/web-vite/src/components/workflows/workflow-run/task-card-run-container.tsx
  - apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx
  - apps/web-vite/src/components/workflows/workflow-run/task-checklist.tsx
  - apps/web-vite/src/hooks/use-permissions.ts
  - packages/api/src/__tests__/81-int-closure.test.ts
  - packages/api/src/__tests__/compliance-upload-review.test.ts
  - packages/api/src/__tests__/contractor-assignment-resolver.test.ts
  - packages/api/src/__tests__/deprovisioning-start.test.ts
  - packages/api/src/__tests__/v6-cross-feature-composition.test.ts
  - packages/api/src/routers/compliance/compliance-admin.ts
  - packages/api/src/routers/integrations/deprovisioning.ts
  - packages/api/src/services/idp-token-resolver.ts
  - packages/auth/src/__tests__/roles.test.ts
  - packages/auth/src/permissions.ts
  - packages/auth/src/roles.ts
  - packages/integrations/src/adapters/__tests__/slack-adapter.test.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 81: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the v6.0 integration-closure phase: the INT-01 IdP-deprovisioning server seam (new `idp:start_run` grant, dynamic multi-provider derivation, the contractorId→assignmentId resolver, and the gated start/eligibility procedures), the INT-02 compliance payment-block recovery (`onComplianceItemSatisfied` wired into the `approveUploadReplacement` transaction), the web-vite trigger UI (hook / container / presentational card + ACCESS_REVOKE wiring + en/de/pl/ar i18n), and the supporting test suites.

Verdict on the stated focus areas:

- **Multi-tenant / IDOR:** the resolver, the start mutation, the eligibility query, and both compliance approve/reject mutations all scope by `ctx.organizationId` from the session. A cross-org `contractorId` resolves to `{ assignmentId: null }` (no leak); the P2002 idempotency lookup is correctly scoped by the `organizationId_idempotencyKey` composite. No IDOR found in the changed procedures.
- **Authorization (`idp:start_run` lock):** the owner+admin+it_admin grant matches across `roles.ts`, `permissions.ts`, the role tests, and the client mirror. it_admin correctly holds `start_run` only (never `override_step_failure`). HOWEVER a sibling destructive procedure in the same router (`retryDeprovisioningStep`) ships ungated — see CR-01.
- **Audit / tx correctness:** INT-02 is wired correctly — `onComplianceItemSatisfied` runs inside the `$transaction` after the SATISFIED flip, the recovery hook's eligibility re-assertion reads remaining EXPIRED+BLOCKING items through the same `tx` (so the just-approved item is excluded), and the best-effort contractor notification stays post-tx. The `tx as Parameters<...>[0]` cast is internal Prisma plumbing onto `RecoveryClient`, not an external payload — acceptable.
- **i18n parity:** `Idp.trigger` is at full 13-key parity across en/de/pl/ar (RTL). One non-localized server-supplied reason string can still reach the UI — see WR-02.
- **web-vite layering:** the hook is the sole tRPC boundary; the container owns loading/empty/error/permission; the presentational card never calls tRPC. Correct — but the run-view inline render placement is wrong (WR-03).
- **No console.\*, no direct Unleash SDK, no debug artifacts** in the changed source.

## Critical Issues

### CR-01: `retryDeprovisioningStep` re-fires a destructive IdP suspend/revoke job with no permission gate

**File:** `packages/api/src/routers/integrations/deprovisioning.ts:349-351`
**Issue:** Every other start/destructive procedure in this router is gated — `startDeprovisioningRun`, `getDeprovisioningEligibility`, and `resolveAssignmentForContractor` all carry `.use(requirePermission({ idp: ['start_run'] }))`, and `overrideStepFailure` carries `idp:['override_step_failure']`. `retryDeprovisioningStep` chains through `tenantProcedure` **only**:

```ts
retryDeprovisioningStep: tenantProcedure
  .input(z.object({ stepId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
```

Tenant isolation is intact (the step is fetched via `run: { organizationId: ctx.organizationId }`), but there is no RBAC. Any authenticated org member — `readonly`, `external_accountant`, `legal_compliance_viewer`, `team_manager`, etc. — can call it and re-enqueue a fresh QStash job that runs `SUSPEND_ACCOUNT` / `REVOKE_ALL_SESSIONS` against the connected IdP for an offboarded user. This is the same destructive effect the phase deliberately locked behind `idp:start_run` on the start path. The procedure also resets the row to `attempts: 0`, granting a fresh `MAX_ATTEMPTS` budget — so an unprivileged caller can repeatedly re-arm a failed step. Phase 81's explicit mandate was to gate this seam; the retry leg was left open.

**Fix:** Add the same gate the start path uses (retry is a re-trigger of the same destructive action):

```ts
retryDeprovisioningStep: tenantProcedure
  .use(requirePermission({ idp: ['start_run'] }))
  .input(z.object({ stepId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
```

(If retry is intended to be an escalation-only action, gate it on `idp: ['override_step_failure']` instead — but it must not remain ungated.)

## Warnings

### WR-01: `it_admin` client permission mirror is incomplete — under-grants every non-IdP resource the server allows

**File:** `apps/web-vite/src/hooks/use-permissions.ts:55-60`
**Issue:** The phase added a new `it_admin` block to the client mirror containing only `idp: ['start_run']`:

```ts
it_admin: {
  idp: ['start_run'],
},
```

The server `it_admin` role (`packages/auth/src/roles.ts:124-137`) grants substantially more: `member: ['create','read','update']`, `invitation: ['create','cancel']`, `settings: ['read','update']`, `integration: ['read','update']`, `equipment: ['read']`, `team: ['read']`, `project: ['read']`, `costCenter: ['read']`. With the mirror as written, `usePermissions().can('integration', ['read'])`, `can('settings', ['read'])`, `can('member', ['read'])`, etc. all return `false` for an it_admin in the SPA, hiding UI that the server actually authorizes. This is an under-grant (not a security hole — the server stays authoritative), but it is a real UX/correctness defect and a mirror-drift maintainability risk. The deprovisioning flow itself survives (the inline run-view container only gates on `idp:override_step_failure`, which it_admin correctly lacks), but the rest of it_admin's SPA surface is wrongly suppressed.

**Fix:** Mirror the full server `it_admin` grant:

```ts
it_admin: {
  member: ['create', 'read', 'update'],
  invitation: ['create', 'cancel'],
  settings: ['read', 'update'],
  integration: ['read', 'update'],
  idp: ['start_run'],
  equipment: ['read'],
  team: ['read'],
  project: ['read'],
  costCenter: ['read'],
},
```

(Separately note: this mirror still uses role key `observer` where the server uses `readonly` — pre-existing, out of phase-81 scope, but it means the client mirror has been drifting from `roles.ts` for some time. A shared single-source matrix would prevent both classes of drift.)

### WR-02: Raw English cooldown reason from the saga leaks into the UI tooltip (i18n bypass)

**File:** `apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx:89-95` (consumes `state.reason` from `hooks/use-start-deprovisioning.ts:121`, sourced from `getDeprovisioningEligibility` in `deprovisioning.ts:142-158`)
**Issue:** `getDeprovisioningEligibility` returns the raw `decision` object from `canStartDeprovisioning`, whose `reason` field is a hardcoded English sentence (`packages/idp-saga/src/cooldown.ts`): e.g. `'Assignment is not ENDED'` and `'endedAt timestamp missing — set via assignment edit before deprovisioning'`. The hook surfaces this verbatim as `reason`, and the container renders it as the disabled-button tooltip in the fallback branch:

```ts
disabledTooltip={
  state.allowed ? null
    : earliest ? t('cooldownTooltip', { date: earliest })
    : (state.reason ?? t('cooldownTooltipGeneric'))
}
```

For the common 14-day case `earliestDate` is present, so the localized `cooldownTooltip` wins. But for the non-ENDED / missing-`endedAt` edge cases there is no `earliestDate`, so a German / Polish / Arabic user is shown an untranslated English string. The router comment at line 226-228 claims "the message is an i18n error key," but that applies only to the COOLDOWN throw — the query path returns the raw reason. Violates the project's no-hardcoded-user-facing-strings standard.

**Fix:** Map the saga's structured reason to an i18n key before it reaches the UI, or drop `state.reason` from the tooltip fallback and always use `t('cooldownTooltipGeneric')` (already localized in all four locales) when no `earliestDate` is available:

```ts
disabledTooltip={
  state.allowed ? null
    : earliest ? t('cooldownTooltip', { date: earliest })
    : t('cooldownTooltipGeneric')
}
```

### WR-03: The full deprovisioning run-view panel renders inside the compact, horizontal task-card action toolbar

**File:** `apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx:268` + `apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx:72-81`
**Issue:** For ACCESS_REVOKE tasks the `triggerSlot` is rendered inside `TaskActionToolbar`, which lives in the always-visible header row wrapper `<div className="flex items-center gap-1 shrink-0" role="toolbar">`. Once a run exists (`state.startedRunId` set), `DeprovisioningTriggerContainer` swaps from a small button to the entire `DeprovisioningRunViewContainer` — a block-level panel with the per-step status list and override sub-panels (`<div className="space-y-2" data-testid="deprovisioning-run-inline">`). Mounting that full block panel inside a `shrink-0` horizontal flex toolbar, next to the status icon and the complete/skip/reassign buttons, will break the row layout. The trigger element is consumed in exactly one place (the toolbar), so there is no body slot for the larger render.

**Fix:** Render only the small "start" / "view run" affordance in the toolbar, and mount the expanded `DeprovisioningRunViewContainer` in the card's collapsible body (`TaskExpandedDetails`) — pass it through a dedicated body slot rather than the action-toolbar `triggerSlot`. Keep the inline run panel out of the `shrink-0` header row.

## Info

### IN-01: Enable-able-but-unrunnable providers (GITHUB/ENTRA/OKTA) create a confusing toggle state

**File:** `packages/api/src/routers/integrations/deprovisioning.ts:81-90, 662-705, 712-726`
**Issue:** `DEPROVISIONING_TOGGLE_PROVIDERS` and `enableProviderForOrg`'s Zod enum accept all five providers, and `getProviderToggleState` reports GITHUB as `connected` when an IntegrationConnection exists. But `deriveProvidersForRun` intersects with `RESOLVER_BACKED_PROVIDERS = ['GOOGLE_WORKSPACE','SLACK']`, so ENTRA/OKTA/GITHUB never contribute run steps. An org can enable GITHUB, see it on + connected in the settings table, yet runs silently skip it — and if GITHUB is the only enabled provider, `startDeprovisioningRun` throws `INTEGRATION_NOT_CONFIGURED`. This is intentional per the D-05/D-06 comments, but the toggle UI gives no signal that an enabled provider is non-executable.
**Fix:** Add a `runnable`/`resolverBacked` flag to `getProviderToggleState`'s per-provider payload (derived from `RESOLVER_BACKED_PROVIDERS`) so the settings table can show "enabled but not yet executable" for ENTRA/OKTA/GITHUB.

### IN-02: Stale "RED — EXPECTED to fail until wiring lands" comments in now-green test suites

**File:** `packages/api/src/__tests__/deprovisioning-start.test.ts:313-317`, `packages/api/src/__tests__/contractor-assignment-resolver.test.ts:11-13`, `packages/api/src/__tests__/compliance-upload-review.test.ts:477-479`
**Issue:** These suites still carry headers asserting they are RED scaffolds "EXPECTED to RED until 81-02/81-03 lands the source," and `deprovisioning-start.test.ts:316-317` specifically claims "the router still hardcodes `PROVIDERS_FOR_RUN = ['GOOGLE_WORKSPACE']` and both procedures are still ungated." The source has landed and the procedures are gated, so those statements are now false and misleading to a future reader debugging a failure.
**Fix:** Update the headers to reflect that the wiring landed and these cases are now the GREEN post-wiring contract (mirroring the accurate header in `81-int-closure.test.ts`).

### IN-03: `start` callback unnecessarily re-created every render via the `startMutation` dependency

**File:** `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts:94-97`
**Issue:** `start` is wrapped in `useCallback([assignmentId, idempotencyKey, startMutation])`, but `startMutation` is a fresh object on every render (TanStack `useMutation` returns a new wrapper each render), so the memoization yields no stable identity and the callback is rebuilt each render. Harmless, but it defeats the purpose of the `useCallback`.
**Fix:** Depend on `startMutation.mutate` (stable) and `startMutation.isPending` instead of the whole `startMutation` object, or read `isPending` inside via a ref.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
