---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
plan: 02
subsystem: idp-deprovisioning
tags: [trpc, rbac, better-auth, idp-deprovisioning, multi-provider, green-gate, int-01]

# Dependency graph
requires:
  - phase: 81
    plan: 01
    provides: INT-01 RED tests (deprovisioning-start D-05/D-06/D-10/D-09, contractor-assignment-resolver D-01, roles.test idp:start_run)
  - phase: 77
    provides: idp:override_step_failure permission, isProviderSignoffSatisfied, DEPROVISIONING_TOGGLE_PROVIDERS, idpDeprovisioningEnabled toggle map
  - phase: 76
    provides: startDeprovisioningRun + getDeprovisioningEligibility, DeprovisioningRun @@unique([organizationId, idempotencyKey]), P2002 handler
provides:
  - idp:start_run access-control action granted to owner + admin + it_admin
  - RESOLVER_BACKED_PROVIDERS exported const driving DeprovisionProvider (single source of truth)
  - per-org dynamic run provider derivation (enabled ∩ signoff ∩ resolver-backed) replacing hardcoded PROVIDERS_FOR_RUN
  - DEPROVISIONING_INTEGRATION_NOT_CONFIGURED empty-set throw (no zero-step run)
  - idp:start_run gate on startDeprovisioningRun + getDeprovisioningEligibility
  - resolveAssignmentForContractor tenantProcedure (most-recent ENDED, org-scoped, idp:start_run-gated)
affects: [81-05, 81-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source resolver-backed provider list: DeprovisionProvider = (typeof RESOLVER_BACKED_PROVIDERS)[number]"
    - "Per-org provider derivation as a pure helper fed by Organization.settingsJson read inside the mutation"

key-files:
  created: []
  modified:
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/api/src/services/idp-token-resolver.ts
    - packages/api/src/routers/integrations/deprovisioning.ts
    - packages/api/src/__tests__/deprovisioning-start.test.ts

key-decisions:
  - "idp:start_run granted to owner + admin + it_admin (locked D-10 / research A1); override_step_failure stays owner/admin-only"
  - "Provider set derived from RESOLVER_BACKED_PROVIDERS ∩ enabled ∩ signoff — no 4th literal that can drift (D-05)"
  - "resolveAssignmentForContractor returns { assignmentId: string | null } (null on no-ENDED) rather than throwing, so the UI can disable with a reason (D-01)"

patterns-established:
  - "deriveProvidersForRun(settingsJson) pure helper: DEPROVISIONING_TOGGLE_PROVIDERS.filter(enabled ∩ signoff ∩ resolver-backed)"

requirements-completed: [IDP-01, IDP-02, IDP-03, IDP-04, IDP-05, IDP-06, IDP-07, IDP-08, IDP-09, IDP-10, IDP-12, IDP-13, IDP-15]

# Metrics
duration: ~25min
completed: 2026-06-06
---

# Phase 81 Plan 02: INT-01 Server Seam (GREEN) Summary

**Closed the INT-01 server seam — added the `idp:start_run` permission (owner+admin+it_admin), gated the two previously-ungated deprovisioning procedures with it, replaced the hardcoded GWS-only `PROVIDERS_FOR_RUN` with a per-org dynamic derivation (enabled ∩ signoff ∩ resolver-backed) backed by a single-source `RESOLVER_BACKED_PROVIDERS`, added the missing org-settings read, threw `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` on an empty set, and added the server-side `contractorId → assignmentId` resolver — turning every 81-01 INT-01 RED case GREEN.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- **Task 1 — `idp:start_run` permission.** Added `start_run` to the `idp` action array in `permissions.ts`; granted it to owner (via `allPermissions.idp`), the admin block, and added a new `idp: ['start_run']` key to the it_admin block (it_admin is the seeded `ACCESS_REVOKE` assignee, so the D-01 inline-card path is reachable). `override_step_failure` remains owner/admin-only. The three 81-01 `roles.test.ts` invariants are now GREEN (19/19 auth roles tests pass).
- **Task 2 — server seam.** Exported `RESOLVER_BACKED_PROVIDERS = ['GOOGLE_WORKSPACE', 'SLACK'] as const` from `idp-token-resolver.ts` and redefined `DeprovisionProvider` as `(typeof RESOLVER_BACKED_PROVIDERS)[number]` (single source of truth — D-05/A3). In `deprovisioning.ts`: replaced the hardcoded `PROVIDERS_FOR_RUN` const with a `deriveProvidersForRun(settingsJson)` helper (enabled ∩ signoff ∩ resolver-backed); added the `Organization.findUnique({ select: { settingsJson } })` read inside `startDeprovisioningRun` before derivation (Pitfall 5); threw `PRECONDITION_FAILED` / `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` on an empty set with no run created (D-06); wired the derived list into the existing step-create fan-out; gated both `startDeprovisioningRun` and `getDeprovisioningEligibility` with `.use(requirePermission({ idp: ['start_run'] }))` (D-10); and added the `resolveAssignmentForContractor` tenantProcedure (most-recent ENDED, `orderBy endedAt desc`, org-scoped, also `idp:start_run`-gated, returning `{ assignmentId: string | null }`) (D-01). The P2002 idempotency handler was left untouched (D-09).

## Task Commits

Each task was committed atomically:

1. **Task 1: idp:start_run permission + owner/admin/it_admin grant** — `c7901c4b` (feat)
2. **Task 2: dynamic provider derivation + idp:start_run gate + assignment resolver** — `d917f62d` (feat)

## Files Created/Modified

- `packages/auth/src/permissions.ts` — added `start_run` to the `idp` access-control action array.
- `packages/auth/src/roles.ts` — `start_run` added to `allPermissions.idp` (owner), the admin `idp` block, and a new `idp: ['start_run']` key on the it_admin block.
- `packages/api/src/services/idp-token-resolver.ts` — exported `RESOLVER_BACKED_PROVIDERS`; `DeprovisionProvider` now derives from it.
- `packages/api/src/routers/integrations/deprovisioning.ts` — `deriveProvidersForRun` helper replaces the hardcoded const; settingsJson read + empty-set throw inside `startDeprovisioningRun`; both procedures gated; new `resolveAssignmentForContractor` procedure.
- `packages/api/src/__tests__/deprovisioning-start.test.ts` — corrected two 81-01 RED assertions (error message vs constant-name literal) + added `FLAG_SIGNOFF_BYPASS=local` to `beforeEach` / cleanup in `afterEach` (see Deviations).

## GREEN Verification

- `pnpm --filter @contractor-ops/auth test roles` → **19 passed** (3 prior RED cases GREEN).
- `pnpm --filter @contractor-ops/api test deprovisioning-start.test.ts contractor-assignment-resolver.test.ts` → **14 passed** (5 deprovisioning-start RED cases + 2 resolver RED cases GREEN; 7 pre-existing 76 D-03 cases still pass).
- `pnpm typecheck --filter @contractor-ops/api --filter @contractor-ops/auth` → **clean** (15/15 turbo tasks successful).
- `grep PROVIDERS_FOR_RUN deprovisioning.ts` → **no hardcoded const** (replaced by the derivation helper).
- `grep -c "requirePermission({ idp: ['start_run']" deprovisioning.ts` → **3** (eligibility, start, resolver).

## Decisions Made

- **idp:start_run grant set is LOCKED** to owner + admin + it_admin (research A1 / commit 5ec98dfe). it_admin holds EXACTLY `start_run` — never `override_step_failure`.
- **Derivation excludes ENTRA/OKTA/GITHUB at the router**, not just at the step-runner: an org that enables ENTRA (with signoff bypass) still derives an empty set and throws, because ENTRA is not in `RESOLVER_BACKED_PROVIDERS`. This fails fast at the trigger rather than creating a step that can only fail-closed at the runner (matches the D-06 RED case "enabled but NOT resolver-backed").
- **The org-settings read and derivation run after the cheaper preconditions** (cooldown gate, contractor-email check) but before the `$transaction`, so the empty-set throw never leaves an orphaned run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected two 81-01 RED assertions that compared the error MESSAGE to the constant NAME literal**
- **Found during:** Task 2 (GREEN gate run)
- **Issue:** The two D-06 RED cases in `deprovisioning-start.test.ts` asserted `message: 'DEPROVISIONING_INTEGRATION_NOT_CONFIGURED'` (the SCREAMING_SNAKE constant *name* as a literal string). The error constant's *value* is the camelCase i18n key `'deprovisioningIntegrationNotConfigured'` (`errors.ts:407`). The plan (D-06) and the source both throw the imported constant, so the assertion could never match correct behavior — the source was right, the test literal was wrong.
- **Fix:** Imported `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` into the test and replaced both literal strings with the constant, so the assertion tracks the error registry and cannot drift. This does NOT weaken the test — it still asserts `code: 'PRECONDITION_FAILED'` AND the specific error key, with no run created.
- **Files modified:** `packages/api/src/__tests__/deprovisioning-start.test.ts`
- **Commit:** `d917f62d`

**2. [Rule 3 - Blocking] Added FLAG_SIGNOFF_BYPASS=local to the test harness beforeEach**
- **Found during:** Task 2 (GREEN gate run)
- **Issue:** Once `PROVIDERS_FOR_RUN` became a signoff-gated derivation, the three pre-existing 76 D-03 success-path cases (`inserts run + N steps`, `fans out`, `idempotent P2002`) and the new D-09 per-assignment case began to throw `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED`: they enable GWS in the toggle map but never set `FLAG_SIGNOFF_BYPASS`, so `isProviderSignoffSatisfied('GOOGLE_WORKSPACE')` returned false (no APPROVED flag in the unit env) → empty derived set. The multi-provider RED cases already set the bypass per-test; the older success cases predate the signoff dependency.
- **Fix:** Set `process.env.FLAG_SIGNOFF_BYPASS = 'local'` in `beforeEach` (so the default GWS-enabled org derives GWS, mirroring the legacy single-provider behaviour) and cleared it in a new `afterEach` so it does not leak across files in the worker. The empty-set cases are unaffected (they rely on an empty / non-resolver-backed enabled map, not on signoff); the D-10 gate cases short-circuit at the RBAC layer before derivation.
- **Files modified:** `packages/api/src/__tests__/deprovisioning-start.test.ts`
- **Commit:** `d917f62d`

---

**Total deviations:** 2 auto-fixed (1 test bug, 1 blocking harness gap). Both confined to the test file; no source behavior was altered to satisfy a test, and no test was weakened.
**Impact on plan:** Required to make the 81-01 RED cases assertion-accurate against the documented D-06 behavior and to keep the pre-existing 76 success cases green under the new signoff-gated derivation.

## Issues Encountered

None beyond the two test-file deviations above. Source typecheck and both scoped test suites are clean.

## Threat Flags

None — no new network endpoint, auth path beyond the in-scope `idp:start_run` gate, or schema change was introduced. The new `resolveAssignmentForContractor` read is org-scoped (`organizationId: ctx.organizationId`), closing T-81-02-02 (IDOR); the two gated mutations close T-81-02-01 (EoP); the single-source `RESOLVER_BACKED_PROVIDERS` closes T-81-02-04 (derivation drift); the empty-set throw closes T-81-02-05 (zero-step run).

## Known Stubs

None — all behavior is fully wired server-side. The UI trigger that consumes this seam (`resolveAssignmentForContractor` + the gated procedures) lands in 81-05; that is the planned downstream consumer, not a stub in this plan.

## User Setup Required

None — RBAC enforcement is code (Better Auth evaluates `roles.ts` per request via `authApi.hasPermission`); the `idp:start_run` grant takes effect on next request with no DB migration. Org `settingsJson.idpDeprovisioningEnabled` is read as-is (already populated by the 77/78 toggle UI).

## Next Phase Readiness

- **81-05 (INT-01 UI):** the shared `use-start-deprovisioning` hook can now call `deprovisioning.resolveAssignmentForContractor` (single tRPC round-trip, data-layer guard stays green), `getDeprovisioningEligibility`, and `startDeprovisioningRun` — all `idp:start_run`-gated. The UI gate mirror is `usePermissions().can('idp', ['start_run'])`.
- **81-06 (E2E):** before the P2002 idempotency E2E case relies on the unique index, confirm `DeprovisioningRun_organizationId_idempotencyKey` is applied at the DB level (carried forward from 81-01).

## Self-Check: PASSED

All five modified files exist on disk; both task commits (`c7901c4b`, `d917f62d`) are present in git history; both scoped test suites and the api+auth typecheck are green.

---
*Phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces*
*Completed: 2026-06-06*
