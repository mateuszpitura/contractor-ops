---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
plan: 06
subsystem: testing
tags: [vitest, composition-test, int-01, int-02, idp-deprovisioning, compliance-recovery, phase-gate, tdd]

# Dependency graph
requires:
  - phase: 81
    plan: 02
    provides: INT-01 server seam — resolveAssignmentForContractor (D-01), idp:start_run gate (D-10), deriveProvidersForRun multi-provider derivation (D-05), DEPROVISIONING_INTEGRATION_NOT_CONFIGURED empty-set throw (D-06)
  - phase: 81
    plan: 03
    provides: INT-02 server seam — onComplianceItemSatisfied called in-tx in approveUploadReplacement (D-12/D-14)
  - phase: 81
    plan: 05
    provides: INT-01 UI seam — use-start-deprovisioning hook, deterministic per-assignment idempotencyKey deprov:<assignmentId> (D-09)
provides:
  - 81-int-closure.test.ts — the binding composition proof for BOTH E2E integration flows (closes the F2 gap left in v6-cross-feature-composition.test.ts:28-30)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-feature composition over the staff appRouter caller + a single shared hoisted mock-Prisma store serving both seams (deprovisioning + compliance-admin)"
    - "Idempotency asserted at the deterministic-key level (run created once for deprov:<assignmentId>) rather than via a live-DB P2002 unique-violation"

key-files:
  created:
    - packages/api/src/__tests__/81-int-closure.test.ts
  modified:
    - packages/api/src/__tests__/v6-cross-feature-composition.test.ts

key-decisions:
  - "Idempotency proven at the deterministic-key level (idempotencyKey carried verbatim into the run insert), NOT via a live-DB P2002 — the 76-WR1 @@unique index is present in schema source but unconfirmed against the live Neon DB; the dedicated P2002 path is already covered at the mocked-Prisma level in deprovisioning-start.test.ts"
  - "Both seams share ONE hoisted mock-Prisma store + one @contractor-ops/db mock so the composition runs through the real createCaller(appRouter) — the seam is exercised, not re-mocked away"
  - "Cold-import headroom: a SLOW=30s per-test timeout on each composition case (mirrors the idp-deprovision-connections.test.ts 20s bump) — the first full appRouter procedure execution per fork worker exceeds the 5s default"

patterns-established:
  - "Per-flow store-mutating mock: the compliance-item update mock drops the approved item from the blocking set, so the recovery hook's in-tx eligibility re-assertion AND a follow-up payment-gate read both observe the release through the same store"

requirements-completed: [IDP-01, IDP-09, COMPL-07, COMPL-08, COMPL-11]

# Metrics
duration: ~20min
completed: 2026-06-06
---

# Phase 81 Plan 06: INT-01 + INT-02 E2E Closure Proof Summary

**Added `81-int-closure.test.ts` — the binding cross-feature composition that proves BOTH milestone-audit-flagged integration flows now complete end-to-end against the real `createCaller(appRouter)`: Flow 1 (INT-01) resolves a contractor's most-recent ENDED assignment, derives the deterministic per-assignment idempotencyKey, and starts a multi-provider (GWS + Slack) deprovisioning run with one independent QStash job per step; Flow 2 (INT-02) admin-approves a portal upload, fires the in-tx recovery hook that resumes the held PENDING_COMPLIANCE flow to PENDING, and confirms the payment gate releases — closing the F2 composition gap deliberately left in `v6-cross-feature-composition.test.ts:28-30`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 1 (tdd plan — the test IS the deliverable; the seams it composes are already wired and GREEN)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **Task 1 — both E2E flows composed (`81-int-closure.test.ts`, 6 cases GREEN).**
  - **Flow 1 (INT-01) — 3 cases.** The primary case seeds a contractor with TWO ENDED assignments (an older one + a most-recent one) so the resolver's `endedAt desc` disambiguation (D-01) is load-bearing; calls `deprovisioning.resolveAssignmentForContractor({ contractorId })` → asserts it returns the *recent* assignment; derives `deprov:<assignmentId>` (the UI's deterministic key, D-09); calls `deprovisioning.startDeprovisioningRun` and asserts the created run has steps for BOTH `GOOGLE_WORKSPACE` + `SLACK` (suspend + revoke each = 4 steps, D-05), the QStash `publishJSON` spy fired once per step with a unique per-step `deduplicationId` (IDP-09, no aggregation), and the deterministic key was carried verbatim into the run insert. A second case proves a contractor with no ENDED assignment resolves to `null` (the trigger disables rather than picking an ACTIVE row). A third proves the `idp:start_run` gate is composed end-to-end — a caller without the permission can neither resolve nor start (`FORBIDDEN`, no run created).
  - **Flow 2 (INT-02) — 3 cases.** The primary case seeds a held `PENDING_COMPLIANCE` ApprovalFlow + the approved item still EXPIRED+BLOCKING; asserts the payment gate blocks the contractor BEFORE approval; calls `complianceAdmin.approveUploadReplacement(...)`; then asserts (a) the item is `SATISFIED`, (b) the recovery hook ran in-tx — `$queryRaw` was called and `approvalFlow.update` flipped the held flow to `PENDING` (D-12), and (c) a follow-up `assertContractorPaymentEligibility([contractorId], { tx, throwOnFail: false })` no longer blocks (`blocked: false`, empty reasons — COMPL-07/08/11). A second case proves the D-14 invariant: a post-tx notification dispatch failure does NOT roll back the approval or the in-tx recovery flip. A third proves the recovery re-asserts FULL eligibility — with a SECOND BLOCKING item still expired, approving the first item leaves the held flow `PENDING_COMPLIANCE` (the hook correctly keeps it held).
- **Closed the F2 gap pointer.** Updated the `v6-cross-feature-composition.test.ts:28-30` exclusion comment to record that the F2 end-to-end composition (plus the INT-02 recovery flow) now lives in `81-int-closure.test.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: compose INT-01 + INT-02 E2E closure proof** — `51220fb6` (test)

## Files Created/Modified

- `packages/api/src/__tests__/81-int-closure.test.ts` (NEW) — two composition flows over the real `createCaller(appRouter)` with a shared hoisted mock-Prisma store serving both the `deprovisioning` and `complianceAdmin` namespaces. Mirrors the `deprovisioning-start.test.ts` (`$transaction`, `makeCaller`, `publishJSON` spy, `FLAG_SIGNOFF_BYPASS=local`) and `compliance-upload-review.test.ts` (`$queryRaw`, `approvalFlow.update`, recovery store) harness conventions so it reads as a peer.
- `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` — comment-only: the F2-exclusion note now points at the new closure file (no behavior change).

## Decisions Made

- **Idempotency asserted at the deterministic-key level (not via a live-DB P2002).** Per the carried-forward note from 81-01/02/05, the 76-WR1 `@@unique([organizationId, idempotencyKey])` index is present in the Prisma schema source but was NOT confirmed against the live Neon EU DB (the sandbox blocked the read). Rather than silently depend on an unmigrated index, this composition proves the run is created exactly once for `deprov:<assignmentId>` and that the deterministic key is carried verbatim into the insert (so a re-trigger would collide on the same key). The dedicated P2002 unique-violation path is already covered at the mocked-Prisma level in `deprovisioning-start.test.ts:276` and `:421`; re-proving it here against a mock would only re-test the mock, not the seam.
- **One shared store + one `@contractor-ops/db` mock for both seams.** The composition runs both flows through the same `createCaller(appRouter)` and the same mock-Prisma store so the seam under test (the wired procedures) is genuinely exercised — the test does not re-mock away the `resolveAssignmentForContractor → startDeprovisioningRun` derivation or the `approveUploadReplacement → onComplianceItemSatisfied → payment-gate` chain.
- **The compliance-item `update` mock mutates the shared blocking-set.** When the approve flip sets `SATISFIED`, the mock removes the item from the EXPIRED+BLOCKING set, so the recovery hook's in-tx eligibility re-assertion AND the follow-up gate read both observe the release through the same store — the payment-gate `findMany` predicates (contractorId.in + severity + status + org-scope) remain load-bearing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Raised the per-test timeout for the composition cases (cold appRouter import)**
- **Found during:** Task 1 (first GREEN run)
- **Issue:** The two Flow 1 cases (and the Flow 2 cases) timed out at the vitest 5s default on a cold fork worker — the first full staff-`appRouter` procedure execution per worker is a heavy import (this is the exact cause behind the documented 20s bump in `idp-deprovision-connections.test.ts`). The failures were timeouts, not assertion or harness errors.
- **Fix:** Added a `SLOW = 30_000` per-test timeout (third arg on each `it`). No source or harness logic changed; the assertions are unchanged.
- **Files modified:** `packages/api/src/__tests__/81-int-closure.test.ts`
- **Commit:** `51220fb6`

**2. [Rule 3 - Blocking] Removed an unused hoisted export (`runFindUnique`) flagged by the biome pre-commit hook**
- **Found during:** Task 1 (commit — biome `noUnusedVariables`)
- **Issue:** `runFindUnique` was destructured from the `vi.hoisted` factory but never referenced in the test body (the P2002 existing-run path is intentionally not exercised here — see the idempotency decision). Biome's pre-commit check failed on the unused binding.
- **Fix:** Removed `runFindUnique` from the destructure and the factory `return` (it remains a local inside the factory, assigned to `deprovisioningRun.findUniqueOrThrow`, so the mock shape is unchanged). Re-ran the scoped suite GREEN (6/6) before committing.
- **Files modified:** `packages/api/src/__tests__/81-int-closure.test.ts`
- **Commit:** `51220fb6`

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking-issue fixes confined to the new test file). No source behavior changed; no seam was re-mocked away; no test was weakened.

## GREEN Verification

- `pnpm --filter @contractor-ops/api test src/__tests__/81-int-closure.test.ts --run` → **6 passed (6)** (Flow 1: 3, Flow 2: 3).
- `pnpm typecheck --filter @contractor-ops/api` → **clean** (14/14 turbo tasks successful).
- Scoped-run only per the in-effect integration-sweep rule (no `turbo test`, no full web-vite suite, no unscoped package suite).

## Threat Surface

No new trust boundary, network endpoint, auth path, or schema change — this plan adds a test file and a comment-only edit. It ASSERTS the boundaries 81-02/81-03 enforce:
- **T-81-06-01 (EoP):** the Flow 1 gate case proves a caller without `idp:start_run` cannot resolve or start (the authorized happy path AND the deny path are both composed).
- **T-81-06-02 (Tampering / idempotency double-start):** the deterministic per-assignment key is asserted as carried into the single run insert.
- **T-81-06-03 (DoS / recovery rollback):** the Flow 2 D-14 case proves the approve + in-tx recovery commit atomically and survive a post-tx notification failure.

## Known Stubs

None — the test composes already-wired, GREEN seams. No source stubs introduced or relied upon.

## User Setup Required

None.

## Next Phase Readiness

- **Phase gate (per 81-VALIDATION.md):** both binding E2E flows are now exercised by an automated composition and GREEN. The remaining phase-gate items before `/gsd:verify-work` are `pnpm lint:ci` (`check:web-vite-data-layer` + i18n en/de/pl/ar parity) — owned by the orchestrator, not this plan.
- **Carried forward:** the 76-WR1 `@@unique([organizationId, idempotencyKey])` index live-DB confirmation remains open (schema source has it; live Neon EU read was sandbox-blocked). It does not gate this composition (idempotency asserted at the deterministic-key level), but should be confirmed via `prisma db push`/migrate before relying on a real P2002 in production.

## Self-Check: PASSED

- FOUND: `packages/api/src/__tests__/81-int-closure.test.ts` (created, 6/6 GREEN)
- FOUND: `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` (modified — F2-exclusion comment points at the new file)
- FOUND: commit `51220fb6` in git history
- No accidental deletions in the task commit (`git diff --diff-filter=D HEAD~1 HEAD` empty)

---
*Phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces*
*Completed: 2026-06-06*
