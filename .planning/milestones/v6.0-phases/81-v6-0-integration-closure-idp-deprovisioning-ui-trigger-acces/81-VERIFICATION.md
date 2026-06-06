---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
verified: 2026-06-06T19:45:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit the offboarding workflow for a contractor with an ENDED assignment. Locate the ACCESS_REVOKE task card. Confirm the trigger renders in the card body (collapsible section), not in the compact header toolbar row next to the status icon and complete/skip/reassign buttons."
    expected: "The trigger button (or run-view panel if a run already exists) is displayed in the task body area, with no layout breakage of the horizontal header toolbar."
    why_human: "WR-03 was fixed in code (the triggerSlot now renders below the header, not inside TaskActionToolbar). The actual layout can only be confirmed visually in a browser."
  - test: "Log in as an it_admin user (the seeded ACCESS_REVOKE workflow assignee). Open an offboarding workflow with an ACCESS_REVOKE task. Confirm the deprovisioning trigger is visible and usable (not hidden by the UI permission gate)."
    expected: "The trigger is visible. Clicking 'Start Revocation' opens the confirm dialog with the impact preview. On confirmation, a deprovisioning run is created and the run-view renders inline."
    why_human: "The it_admin client-side permission mirror was added in 81-05 but end-to-end reachability for the seeded it_admin assignee role requires a browser session."
  - test: "On a German or Polish locale (switch language in settings), navigate to a contractor's ACCESS_REVOKE task where the cooldown is active but no earliestDate is returned (assignment is not ENDED or endedAt is missing). Confirm the disabled button tooltip shows the localized generic message, not an English string like 'Assignment is not ENDED'."
    expected: "The tooltip text is in the user's language (German/Polish/Arabic), using the 'cooldownTooltipGeneric' i18n key."
    why_human: "WR-02 was fixed by dropping state.reason from the tooltip fallback. The edge case (non-ENDED assignment with no earliestDate) requires a specific data state that is hard to reproduce programmatically; visual confirmation is the reliable path."
---

# Phase 81: v6.0 Integration Closure Verification Report

**Phase Goal:** Close INT-01 (wire IdP-deprovisioning trigger into the UI, un-hardcode PROVIDERS_FOR_RUN, gate procedures with `idp:start_run`, add contractorId→assignmentId resolver) and INT-02 (fire `onComplianceItemSatisfied` inside `approveUploadReplacement`'s transaction). Plus a binding E2E composition test and Slack deprovision regression coverage.
**Verified:** 2026-06-06T19:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `idp:start_run` exists in packages/auth and gates startDeprovisioningRun + getDeprovisioningEligibility + resolveAssignmentForContractor + retryDeprovisioningStep | ✓ VERIFIED | `permissions.ts:28` declares it; `roles.ts:28,58,132` grants it to owner/admin/it_admin; `deprovisioning.ts:121,174,198,350` all have `.use(requirePermission({ idp: ['start_run'] }))`. CR-01 (retryDeprovisioningStep ungated) is FIXED. |
| 2 | PROVIDERS_FOR_RUN is no longer hardcoded — `RESOLVER_BACKED_PROVIDERS` exported from idp-token-resolver.ts; deprovisioning.ts derives providers dynamically (enabled ∩ signoff ∩ resolver-backed), throwing DEPROVISIONING_INTEGRATION_NOT_CONFIGURED on empty set | ✓ VERIFIED | `idp-token-resolver.ts:17` exports `RESOLVER_BACKED_PROVIDERS = ['GOOGLE_WORKSPACE', 'SLACK'] as const`; `deprovisioning.ts:81-90` implements `deriveProvidersForRun(settingsJson)` filtering with `RESOLVER_BACKED_SET`; `deprovisioning.ts:253` throws on empty. No `PROVIDERS_FOR_RUN` const anywhere in the file. |
| 3 | `onComplianceItemSatisfied` is called INSIDE `approveUploadReplacement`'s `$transaction` | ✓ VERIFIED | `compliance-admin.ts:39` imports it; `compliance-admin.ts:319-323` calls it inside the `$transaction` callback, after the SATISFIED flip and audit write, before the return. `dispatchComplianceUploadOutcome` stays post-tx at line 328. |
| 4 | web-vite trigger UI: hook is sole tRPC boundary; container owns states; ACCESS_REVOKE card has no direct tRPC; en/de/pl/ar i18n parity | ✓ VERIFIED | `use-start-deprovisioning.ts` contains all `trpc.deprovisioning.*` calls; `deprovisioning-trigger-container.tsx:40` only calls `useStartDeprovisioning`; `task-card-run-container.tsx` renders `<DeprovisioningTriggerContainer contractorId={...} />` for ACCESS_REVOKE; `task-card-run.tsx` has no tRPC. All four locales have 13 matching `Idp.trigger.*` keys. `check:web-vite-data-layer` passes. |
| 5 | `packages/api/src/__tests__/81-int-closure.test.ts` exists and composes both real flows | ✓ VERIFIED | File exists; contains `resolveAssignmentForContractor → startDeprovisioningRun` (3 cases) and `approveUploadReplacement → assertContractorPaymentEligibility` (3 cases). All 6 pass: `Tests 6 passed (6)`. |
| 6 | Code-review Critical CR-01 fixed: retryDeprovisioningStep is gated with `idp:start_run` | ✓ VERIFIED | `deprovisioning.ts:349-350` shows `.use(requirePermission({ idp: ['start_run'] }))` on that procedure. |
| 7 | Code-review Warning WR-01 fixed: it_admin client mirror includes full server grant | ✓ VERIFIED | `use-permissions.ts:55-68` has the full it_admin block: member/invitation/settings/integration/idp/equipment/team/project/costCenter — matching `roles.ts:124-137`. |
| 8 | Code-review Warning WR-02 fixed: raw English reason removed from tooltip fallback | ✓ VERIFIED | `deprovisioning-trigger-container.tsx:90-98` drops `state.reason` from the tooltip; uses `t('cooldownTooltipGeneric')` as fallback (localized in all 4 locales). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/auth/src/permissions.ts` | idp:start_run in action array | ✓ VERIFIED | Line 28: `idp: ['override_step_failure', 'start_run']` |
| `packages/auth/src/roles.ts` | start_run granted to owner/admin/it_admin | ✓ VERIFIED | Lines 28, 58, 132 — confirmed by roles test 19/19 GREEN |
| `packages/api/src/services/idp-token-resolver.ts` | RESOLVER_BACKED_PROVIDERS exported | ✓ VERIFIED | Line 17: `export const RESOLVER_BACKED_PROVIDERS = ['GOOGLE_WORKSPACE', 'SLACK'] as const` |
| `packages/api/src/routers/integrations/deprovisioning.ts` | Dynamic derivation + gates + resolver | ✓ VERIFIED | `deriveProvidersForRun` at line 81; requirePermission gates at 121/174/198/350; `resolveAssignmentForContractor` at 173; DEPROVISIONING_INTEGRATION_NOT_CONFIGURED throw at 253 |
| `packages/api/src/routers/compliance/compliance-admin.ts` | onComplianceItemSatisfied in-tx | ✓ VERIFIED | Import at line 39; call at 319-323 inside `$transaction` |
| `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts` | Sole tRPC boundary, min 40 lines | ✓ VERIFIED | 131 lines; contains resolver/eligibility/mutation calls; no direct tRPC outside this file |
| `apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx` | Loading/empty/error + permission gate | ✓ VERIFIED | All 6 states: loading skeleton, error+retry, not-configured, existing-run, cooldown-disabled, startable |
| `apps/web-vite/src/components/idp/deprovisioning-trigger.tsx` | Presentational button + confirm dialog | ✓ VERIFIED | File exists; props-in JSX-out; uses DialogBody/DialogFooter convention |
| `apps/web-vite/messages/en.json` | Idp.trigger.* keys with "trigger" | ✓ VERIFIED | 13 keys confirmed across en/de/pl/ar with full parity |
| `packages/api/src/__tests__/81-int-closure.test.ts` | Cross-feature composition, startDeprovisioningRun | ✓ VERIFIED | Both flows present; 6/6 GREEN (37.32s, cold worker) |
| `packages/integrations/src/adapters/__tests__/slack-adapter.test.ts` | Slack deprovision regression, admin.users.session.invalidate | ✓ VERIFIED | 17 tests GREEN; contains withOrgGridToken, SCIM PATCH active=false, admin.users.session.invalidate |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| deprovisioning.ts startDeprovisioningRun | Organization.settingsJson.idpDeprovisioningEnabled | organization.findUnique select settingsJson | ✓ WIRED | Line 237: `const org = await ctx.db.organization.findUnique(...)` before derivation |
| deprovisioning.ts derivation | idp-token-resolver RESOLVER_BACKED_PROVIDERS | import + Set intersection | ✓ WIRED | Line 9: `import { RESOLVER_BACKED_PROVIDERS, ... }` from idp-token-resolver; `RESOLVER_BACKED_SET = new Set(RESOLVER_BACKED_PROVIDERS)` used in deriveProvidersForRun |
| deprovisioning.ts startDeprovisioningRun + getDeprovisioningEligibility + resolveAssignmentForContractor + retryDeprovisioningStep | requirePermission idp:start_run | .use(requirePermission(...)) | ✓ WIRED | Lines 121, 174, 198, 350 |
| compliance-admin.ts approveUploadReplacement $transaction | onComplianceItemSatisfied | in-tx call after SATISFIED flip | ✓ WIRED | Line 319: `await onComplianceItemSatisfied(tx as ..., { itemId: input.itemId, contractorId: before.contractorId, organizationId: ctx.organizationId })` inside `$transaction` at line 266 |
| deprovisioning-trigger-container.tsx | use-start-deprovisioning hook | hook call (no direct tRPC) | ✓ WIRED | Line 40: `const state = useStartDeprovisioning(props)` |
| use-start-deprovisioning.ts | deprovisioning.startDeprovisioningRun / getDeprovisioningEligibility / resolveAssignmentForContractor | trpc.deprovisioning.* queryOptions/mutationOptions | ✓ WIRED | Lines 56, 66, 78 respectively |
| task-card-run-container.tsx | DeprovisioningTriggerContainer / trigger props | conditional render when taskType === ACCESS_REVOKE | ✓ WIRED | Lines 30-35: `task.taskType === 'ACCESS_REVOKE' && contractorId ? <DeprovisioningTriggerContainer contractorId={contractorId} />` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| deprovisioning-trigger-container.tsx | `state` (from hook) | useStartDeprovisioning → trpc.deprovisioning.* (server procedures backed by Prisma queries) | Yes | ✓ FLOWING |
| use-start-deprovisioning.ts | resolverQuery, eligibilityQuery | trpc.deprovisioning.resolveAssignmentForContractor / getDeprovisioningEligibility | Yes — DB queries in the procedures | ✓ FLOWING |
| 81-int-closure.test.ts Flow 1 | resolveAssignmentForContractor → startDeprovisioningRun | createCaller(appRouter) + hoisted mock store | Yes — real procedure chain through appRouter | ✓ FLOWING |
| 81-int-closure.test.ts Flow 2 | approveUploadReplacement → onComplianceItemSatisfied | same appRouter caller + mock store mutating SATISFIED state | Yes — in-tx recovery hook called; mock store mutation confirms atomic release | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| retryDeprovisioningStep gated | `grep -n "requirePermission.*idp.*start_run" deprovisioning.ts` | 4 matches (121, 174, 198, 350) | ✓ PASS |
| PROVIDERS_FOR_RUN removed | `grep -n "PROVIDERS_FOR_RUN" deprovisioning.ts` | No const declaration — only function-based derivation | ✓ PASS |
| auth roles 19 tests green | `pnpm --filter @contractor-ops/auth test roles` | 19 passed | ✓ PASS |
| E2E composition 6 tests green | `pnpm --filter @contractor-ops/api test src/__tests__/81-int-closure.test.ts` | 6 passed (37.32s) | ✓ PASS |
| deprovisioning-start 13 tests green | `pnpm --filter @contractor-ops/api test deprovisioning-start` | 13 passed | ✓ PASS |
| compliance-upload-review 18 tests green | `pnpm --filter @contractor-ops/api test compliance-upload-review` | 18 passed | ✓ PASS |
| resolver 2 tests green | `pnpm --filter @contractor-ops/api test contractor-assignment-resolver` | 2 passed | ✓ PASS |
| Slack adapter 17 tests green | `pnpm --filter @contractor-ops/integrations test slack-adapter` | 17 passed | ✓ PASS |
| hook 6 tests green | `pnpm --filter @contractor-ops/web-vite test components/idp/__tests__/use-start-deprovisioning` | 6 passed | ✓ PASS |
| data-layer guard | `node scripts/check-web-vite-data-layer.mjs` | check:web-vite-data-layer — OK | ✓ PASS |
| i18n parity | python3 key count across en/de/pl/ar | 13 keys each, identical key set | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IDP-01 | 81-02, 81-05 | Admin can trigger access revocation via ACCESS_REVOKE task | ✓ SATISFIED | hook + container + task-card wiring; trigger reachable by owner/admin/it_admin |
| IDP-02 | 81-02 | 14-day cooldown gate enforced | ✓ SATISFIED | `getDeprovisioningEligibility` gated; eligibility.allowed checked by container; cooldown-disabled state in UI |
| IDP-03 | 81-02 | Google Workspace deprovisioning | ✓ SATISFIED | RESOLVER_BACKED_PROVIDERS includes GOOGLE_WORKSPACE; derivation produces GWS steps when enabled+signoff |
| IDP-04 | 81-04 | Slack deprovisioning regression locked | ✓ SATISFIED | slack-adapter.test.ts: 17 tests GREEN asserting SCIM PATCH active=false + session invalidate with org-grid bearer |
| IDP-05 | 81-02 | Entra ID (excluded from resolver-backed, fails fast) | ✓ SATISFIED | ENTRA not in RESOLVER_BACKED_PROVIDERS; deriveProvidersForRun throws DEPROVISIONING_INTEGRATION_NOT_CONFIGURED |
| IDP-06 | 81-02 | Okta (excluded from resolver-backed) | ✓ SATISFIED | Same as IDP-05; OKTA not resolver-backed |
| IDP-07 | 81-02 | GitHub (excluded from resolver-backed) | ✓ SATISFIED | Same; GITHUB not resolver-backed |
| IDP-08 | 81-04 | Each adapter implements suspend+revoke; integration test | ✓ SATISFIED | Slack behavioral coverage confirmed via 21 sibling tests + new regression lock |
| IDP-09 | 81-06 | Independent QStash jobs per step; COMPLETED/PARTIAL_FAILURE/FAILED aggregate | ✓ SATISFIED | 81-int-closure.test.ts Flow 1 asserts publishJSON spy fired per step with unique deduplicationId |
| IDP-10 | 81-02 | Admin views deprovisioning run audit trail | ✓ SATISFIED | Both start and eligibility procedures gated; run-view container renders inline on success |
| IDP-12 | 81-02 | Admin can manually complete MANUAL_ESCALATION step | ✓ SATISFIED | overrideStepFailure remains gated with override_step_failure (unchanged); not in scope of this phase |
| IDP-13 | (prior phases) | Webhook self-trigger loop prevention | ✓ SATISFIED | Pre-existing; not modified this phase |
| IDP-15 | (prior phases) | No reactivate button by design | ✓ SATISFIED | Pre-existing |
| COMPL-07 | 81-03, 81-06 | PaymentRunComplianceCheck audit row in same tx as bank-file export | ✓ SATISFIED | onComplianceItemSatisfied in-tx; 81-int-closure Flow 2 asserts atomic commit |
| COMPL-08 | 81-03 | Document expiry stored as @db.Date with jurisdiction TZ | ✓ SATISFIED | Pre-existing; approveUploadReplacement accepts expiresAt; not modified |
| COMPL-11 | 81-05 | All COMPL surfaces en/pl/de parity | ✓ SATISFIED | 13-key Idp.trigger parity across en/de/pl/ar confirmed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/__tests__/deprovisioning-start.test.ts` | 313-317 | Stale "EXPECTED to RED" comment claiming procedures are ungated (IN-02 from code review) | ℹ️ Info | Misleading to future readers but does not affect behavior. Tests are GREEN. |
| `packages/api/src/__tests__/compliance-upload-review.test.ts` | 477-479 | Same stale "RED scaffold" header (IN-02) | ℹ️ Info | Same — informational only |
| `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts` | 94-97 | `useCallback` depends on whole `startMutation` object (IN-03) | ℹ️ Info | No semantic bug; memoization is ineffective but harmless |

No `TBD`, `FIXME`, or `XXX` markers found in any file modified by this phase.

### Human Verification Required

### 1. ACCESS_REVOKE trigger layout — body vs toolbar

**Test:** Log into the app as owner or admin. Open an offboarding workflow that has an ACCESS_REVOKE task. Expand the task card. Confirm the deprovisioning trigger (start button or run-view panel) renders in the task body area (the collapsible expanded section), not inside the compact horizontal header toolbar row next to the status icon and action buttons.
**Expected:** The trigger element is in the body region. The header toolbar row (status icon + complete/skip/reassign buttons) is not disrupted by the trigger. The block-level run-view panel, once a run exists, also renders in the body, not in the shrink-0 toolbar.
**Why human:** WR-03 was fixed in code (`task-card-run.tsx:330` renders the triggerSlot below the header). Visual layout correctness in the rendered DOM can only be confirmed in a browser — grep cannot verify that CSS flex/grid renders the element in the intended region.

### 2. it_admin end-to-end trigger reachability

**Test:** Log in as an it_admin user (the seeded ACCESS_REVOKE assignee role). Navigate to an offboarding workflow with an ACCESS_REVOKE task where the contractor has an ENDED assignment. Confirm the deprovisioning trigger is visible (not hidden by the `can('idp', ['start_run'])` gate). Click it, confirm the impact preview dialog appears, and confirm triggering creates a run.
**Expected:** Trigger is visible. Confirm dialog opens with the GWS impact preview. On confirm, a deprovisioning run is created and the run-view renders inline.
**Why human:** The it_admin client permission mirror and server grant are both correct in code (verified). Actual session-based reachability for the seeded it_admin role requires a running browser session.

### 3. Localized tooltip for non-cooldown edge cases (WR-02 regression guard)

**Test:** Switch the UI to German or Polish locale. Navigate to an ACCESS_REVOKE task for a contractor whose assignment is NOT ENDED (still ACTIVE or PLANNED) — this produces a disabled trigger where `getDeprovisioningEligibility` returns `allowed: false` but no `earliestDate`. Hover the disabled start button.
**Expected:** The tooltip text is the localized `cooldownTooltipGeneric` message (e.g. German: whatever the de.json `cooldownTooltipGeneric` value is), NOT the English string "Assignment is not ENDED" or "endedAt timestamp missing."
**Why human:** WR-02 fix drops `state.reason` from the tooltip. The edge case requires a not-ENDED contractor assignment (specific data state) and locale switching — not reliably testable without a running app.

### Gaps Summary

No gaps. All 8 must-have truths are VERIFIED by codebase evidence and live test runs. The three code-review Criticals/Warnings (CR-01, WR-01, WR-02) are all fixed. The phase gate composition test (81-int-closure.test.ts) is GREEN with 6/6 cases.

Three informational anti-patterns (stale comments in test headers; ineffective useCallback) are low-risk and do not block goal achievement.

The 76-WR1 unique index (`@@unique([organizationId, idempotencyKey])` on `DeprovisioningRun`) is present in the Prisma schema source but was not confirmed against the live Neon EU DB (sandbox blocked the read-only query in both 81-01 and 81-02). This is a setup dependency for production P2002 behavior, documented in SUMMARYs 01/02/05/06 as requiring `prisma db push`/migrate before relying on it in production. It does not affect test coverage (idempotency is proven at the deterministic-key level in the mocked test suite).

---

_Verified: 2026-06-06T19:45:00Z_
_Verifier: Claude (gsd-verifier)_
