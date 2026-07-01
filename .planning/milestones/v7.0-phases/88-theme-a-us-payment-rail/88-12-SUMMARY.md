---
phase: 88-theme-a-us-payment-rail
plan: 12
subsystem: payments
tags: [plaid, identity-verification, us-payment-rail, trpc, fail-open, tin-match, backup-withholding, mock-behind-seam]

# Dependency graph
requires:
  - phase: 88-06
    provides: MockPlaidIdentityClient + PlaidIdentityClient seam (deterministic mock default, live client flag-dark)
  - phase: 88-02
    provides: ContractorBillingProfile.plaidVerificationStatus / plaidVerifiedAt / plaidAccountId columns + US masked routing/account fields
  - phase: 88-05
    provides: _initiatePayoutForRun payout-time advisory read of plaidVerificationStatus
provides:
  - "payment.verifyBillingProfilePlaid — reachable, mock-triggerable tRPC mutation that writes ContractorBillingProfile.plaidVerificationStatus (+ plaidVerifiedAt, plaidAccountId), tenant-scoped + masked-audited, advisory fail-open"
  - "The write half of US-PAY-05: the payout advisory read now has a real non-null status to differentiate verified from unverified accounts"
  - "Recorded defer of the tin-match backup-withholding writer to Phase 86 with the seam documented (deferred-items.md)"
affects: [86-year-end-batch, us-payment-rail, plaid-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Onboarding write trigger for an advisory verification: gated + tenant-scoped mutation runs the deterministic mock and persists the status the payout path already reads — the write itself is fail-open (persists non-VERIFIED, never throws/blocks)"
    - "Recorded defer (not silent omission): an existing-but-untriggered writer is documented in deferred-items.md naming the owning phase + the exact seam to call"

key-files:
  created:
    - packages/api/src/routers/finance/__tests__/payment-plaid-onboarding.test.ts
  modified:
    - packages/api/src/routers/finance/payment-core.ts
    - .planning/brain/wiki/integrations/plaid.md
    - .planning/brain/wiki/domains/us-payment-rail.md
    - .planning/MEMORY.md
    - .planning/phases/88-theme-a-us-payment-rail/deferred-items.md

key-decisions:
  - "Reused the existing E.BILLING_PROFILE_NOT_FOUND error key — no errors.ts change needed (key already existed), keeping the shared file untouched"
  - "Audit resourceType CONTRACTOR + resourceId = contractorId (AuditEntityType has no BILLING_PROFILE member); billingProfileId + status carried in metadata only"
  - "accountId resolution prefers an existing plaidAccountId, else a deterministic plaid-acct-<profileId> so the mock is stable per profile"
  - "tin-match backup-withholding writer is a DEFER to Phase 86 (the year-end batch owner), not a wire — wiring a standalone trigger here would duplicate P86's batch under a LOCAL-ONLY posture"

patterns-established:
  - "Onboarding verification write trigger mirrors initiatePayout's gate (payment:export + assertUsExpansionEnabled + tenant-scoped .strict() Zod)"
  - "Advisory fail-open extends to the write path: a non-VERIFIED verify result is persisted and returned as { status, advisoryWarning }, never thrown"

requirements-completed: [US-PAY-05]

# Metrics
duration: 16min
completed: 2026-07-01
---

# Phase 88 Plan 12: Plaid Onboarding Verification Write Path + tin-match Defer Summary

**Wired `payment.verifyBillingProfilePlaid` — a reachable, mock-triggerable, tenant-scoped tRPC mutation that runs `MockPlaidIdentityClient.verify` and persists `ContractorBillingProfile.plaidVerificationStatus` (advisory fail-open) — and recorded the tin-match backup-withholding writer as an explicit defer to Phase 86.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-01T11:45:00Z
- **Completed:** 2026-07-01T12:01:07Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Closed the write half of US-PAY-05: `payment.verifyBillingProfilePlaid` is now the reachable onboarding trigger that makes `plaidVerificationStatus` real, so the payout-time advisory read stops always taking the unverified branch.
- Proved advisory fail-open on the write path: a PENDING/FAILED mock result is persisted and returned as `{ status, advisoryWarning }` — it never throws or blocks; a foreign-org `billingProfileId` is `NOT_FOUND` (never verified); the masked audit carries `billingProfileId` + status only.
- Recorded the tin-match backup-withholding writer (`createBackupWithholdingFlagWriter` / `createDbTinMatchPersistence`) as an explicit, documented defer to Phase 86 — naming the owning phase and the exact seam P86 will call — rather than a silent omission.
- Documentation-follows-code sweep: Plaid integration page + us-payment-rail domain page + MEMORY invariant, with `check:wiki-brain` at 0 errors.

## Task Commits

Each task was committed atomically (Task 1 is TDD: RED → GREEN):

1. **Task 1 (RED): failing test for Plaid onboarding verification** - `126ff2e5c` (test)
2. **Task 1 (GREEN): wire mock-triggerable Plaid onboarding verification** - `cec2745a3` (feat)
3. **Task 2: record tin-match defer to Phase 86 + Plaid onboarding docs** - `7f3c6df8e` (docs)

_No REFACTOR commit — the GREEN implementation was already minimal and clean._

## Files Created/Modified
- `packages/api/src/routers/finance/__tests__/payment-plaid-onboarding.test.ts` - **Created.** Reachable-mutation harness (mirrors the ach-return caller harness): write half (persist status + plaidVerifiedAt + masked audit), fail-open (PENDING/FAILED never throw), status differentiation, tenant isolation (foreign-org → NOT_FOUND), US-expansion gate. 7 tests.
- `packages/api/src/routers/finance/payment-core.ts` - **Modified.** Added the `verifyBillingProfilePlaid` mutation to `paymentCoreRouter` + imported `MockPlaidIdentityClient`.
- `.planning/brain/wiki/integrations/plaid.md` - **Modified.** Onboarding write trigger row + invariant, `payment-core.ts` added to `verify_with`, `source_commit` bump.
- `.planning/brain/wiki/domains/us-payment-rail.md` - **Modified.** Onboarding write-path bullet + Entry-points row, `source_commit` bump.
- `.planning/MEMORY.md` - **Modified.** Appended the Plaid-write-path + tin-match-defer invariant to the Phase 88 section.
- `.planning/phases/88-theme-a-us-payment-rail/deferred-items.md` - **Modified.** Recorded the tin-match → Phase 86 defer with the seam documented.

## Decisions Made
- **Reused `E.BILLING_PROFILE_NOT_FOUND`** (already present at `errors.ts:384`) — the plan allowed adding it "if no suitable key exists"; it existed, so `errors.ts` stayed untouched (less shared-file merge surface).
- **Audit `resourceType: 'CONTRACTOR'`, `resourceId: contractorId`** — `AuditEntityType` has no billing-profile member; `billingProfileId` + status live in metadata (masked, no bank data).
- **Deterministic accountId fallback** `plaid-acct-<profileId>` when a profile has no linked `plaidAccountId`, so the mock is stable per profile.
- **tin-match writer = DEFER to Phase 86, not a wire** — the writer is correct but the year-end TIN-match batch that triggers it is owned by P86; wiring a standalone trigger here would duplicate that batch under the LOCAL-ONLY posture.

## Deviations from Plan

None - plan executed exactly as written. `errors.ts` (listed in `files_modified`) was not touched because `E.BILLING_PROFILE_NOT_FOUND` already existed — the plan explicitly conditioned that edit on "if no suitable key exists".

## Issues Encountered
- **Fresh worktree lacked built workspace packages + native binding.** The scoped vitest run initially failed to resolve `@contractor-ops/shared` (no `dist`) and to load `libxmljs2` (native `xmljs.node` not built) because the worktree was bootstrapped with `pnpm install --ignore-scripts`. Resolved with `pnpm turbo run build --filter=@contractor-ops/api^...` (dep dists) + `pnpm rebuild libxmljs2` (native binding). Both are environment-only, not code changes; the two `payment-export-{fedwire,swift}` suites (the only ones touching the native XSD binding) then passed 30/30. No source or lockfile change.
- **`check:wiki-brain` reported a missing BM25 index** (gitignored local artifact absent in a fresh worktree). Ran the CLAUDE.md refresh pipeline (`contextual-prefix.py --no-llm` + `bm25-index.py build`) which writes only to the gitignored `.vault-meta/` — no tracked-file mutation. Result: 0 errors, 1 benign pre-existing WARN (multiple `source_commit` prefixes, WARN-only).

## Verification
- `pnpm --filter @contractor-ops/api exec vitest run payment-plaid-onboarding` → 7/7 passed.
- `pnpm --filter @contractor-ops/api exec vitest run payment-plaid-onboarding payment` → 298 tests passed (+ the 2 native-XSD suites 30/30 after `pnpm rebuild libxmljs2`); no payment regression.
- `pnpm typecheck --filter=@contractor-ops/api` → clean (14/14).
- `git diff -- '**/package.json'` → empty (no new dependency; mock only, no SDK installed).
- `pnpm lint:audit-log` → clean; `pnpm lint:no-breadcrumbs` → the two changed source files are clean (1 pre-existing offender in `form-1099k-tracker.service.test.ts:5` is out of scope, already logged in `deferred-items.md`).
- `pnpm check:wiki-brain` → 0 errors.

## Notes for the orchestrator
- Per the worktree isolation contract, this plan did NOT touch `STATE.md`, `ROADMAP.md`, `root.ts` (paymentCore already reachable via `payment.ts`), the shared `wiki/hot.md` / `wiki/log.md`, or the BM25/graph artifacts. State/roadmap advancement and the hot.md/log.md/graph regeneration are left to the orchestrator's post-merge pipeline.
- Shared-file edits (`errors.ts` untouched; `MEMORY.md`, `us-payment-rail.md`, `plaid.md` additive-only) were kept append/additive for a clean 3-way merge with sibling phases 87/91.

## Next Phase Readiness
- **Phase 86** owns the outstanding tin-match trigger: when the year-end IRS TIN-match batch lands, call `createDbTinMatchPersistence` (which composes `createBackupWithholdingFlagWriter`) from the batch's per-recipient mismatch path — no new writer code needed, only the trigger. Documented in `deferred-items.md`.
- The live Plaid Link → `public_token` → verify flow + hard-block-on-unverified remain deferred behind `payments.plaid-verification` + the live SDK (referenced only in the dark client).

## Self-Check: PASSED

- Created/modified files verified on disk: `payment-plaid-onboarding.test.ts`, `payment-core.ts` (contains `verifyBillingProfilePlaid`), `88-12-SUMMARY.md`, `deferred-items.md` — all FOUND.
- Task commits verified in git log: `126ff2e5c` (test), `cec2745a3` (feat), `7f3c6df8e` (docs) — all FOUND.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
