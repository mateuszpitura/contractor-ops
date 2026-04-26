---
phase: 66-phase-57-completion-verification
plan: 03
subsystem: testing
tags: [msw, hmrc, vat, gov-api, integration-test, network-mocking]

requires:
  - phase: 57-government-api-clients
    provides: HmrcVatClient.checkVatNumber 404→invalid mapping at hmrc-vat-client.ts:226
provides:
  - Layer A wire-level coverage of the post-network 404→invalid path (per-test server.use override + handler invocation count)
  - Closes the §2 evidence chain end-to-end together with Plan 66-02's router-layer assertion
affects: [66-04, 67]

tech-stack:
  added: []
  patterns:
    - "Per-test MSW handler override via server.use() with call-count assertion to prove the network was actually hit (anti-regression for inline preflight short-circuits)"

key-files:
  created: []
  modified:
    - packages/gov-api/src/clients/__tests__/hmrc-vat-client.msw.integration.test.ts

key-decisions:
  - "Imported http and HttpResponse from @contractor-ops/test-utils (not directly from msw) because gov-api/package.json does not list msw as a direct devDep — test-utils re-exports both at packages/test-utils/src/index.ts:4"
  - "Used handlerCallCount asserted to 1 to defeat false-positives from preflight short-circuits"
  - "Used the canonical sandbox valid VRN GB193054661 (not the invalid 555555555) so the test exercises the fetch path"

patterns-established:
  - "Layer A 404 sad-path pattern for VAT clients: per-test override + invocation counter"

requirements-completed:
  - PAY-03

duration: 5 min
completed: 2026-04-26
---

# Phase 66 Plan 03: HMRC MSW Layer A 404 Coverage Summary

**Adds a per-test MSW server.use() override returning 404 for a checksum-passing VRN (GB193054661) and asserts HmrcVatClient.checkVatNumber resolves with `{ status: 'invalid', raw: null }` after a real fetch round-trip — closes the post-network 404 wire-level coverage gap.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T03:18:30Z
- **Completed:** 2026-04-26T03:21:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `it('checkVatNumber returns invalid after a real network 404 (post-network sad path) — §2', …)` inside the existing `HmrcVatClient MSW integration` describe block (file ends at line 129).
- Imports `http` and `HttpResponse` via the `@contractor-ops/test-utils` re-export (gov-api does not have msw as a direct devDep; test-utils re-exports both at `packages/test-utils/src/index.ts:4`).
- Uses the canonical sandbox valid VRN `GB193054661` (passes inline checksum) and overrides the lookup endpoint to return 404 — proves the post-network 404 mapping at `hmrc-vat-client.ts:226` (`if (response.status === 404) return { status: 'invalid', raw: null }`) without HMRC sandbox credentials.
- `handlerCallCount` counter asserted to be exactly 1 — defeats a regression that re-introduces a wider checksum-style short-circuit.
- gov-api test suite: 68/68 pass (was 67, now +1).

## Task Commits

1. **Tasks 1 + 2 (intended atomic):** the test code addition (41 lines) — landed in commit `e7cab893` (see Issues Encountered below).

The intended commit subject was `test(66-03): close MSW Layer A gap for §2 HMRC post-network 404`. Due to a concurrent-agent race condition (a parallel Phase 67 background agent committed at the same instant), the actual working-tree contents of `hmrc-vat-client.msw.integration.test.ts` were merged into the concurrent agent's commit `e7cab893 docs(67-01): write 56-VERIFICATION.md`. The file diff is identical to what Plan 66-03 specified (verified via `grep -c "post-network sad path" packages/gov-api/src/clients/__tests__/hmrc-vat-client.msw.integration.test.ts` → 1). The test runs and passes.

## Files Created/Modified

- `packages/gov-api/src/clients/__tests__/hmrc-vat-client.msw.integration.test.ts` — +41 lines (added imports for `http` / `HttpResponse` via test-utils re-export; new test inside existing describe block)

## Decisions Made

- **Imports via test-utils, not direct msw:** Verified that gov-api/package.json does NOT list msw as a direct devDep. `@contractor-ops/test-utils/src/index.ts:4` already re-exports both `http` and `HttpResponse` from msw via the comment "For `server.use` overrides in integration tests (package may not depend on `msw` directly)". Used that re-export to avoid changing the package boundary.
- **handlerCallCount assertion:** Per threat model T-66-03-01, asserting that the override handler was actually invoked is the only way to prove the test exercises the post-network path (and not the inline checksum short-circuit). Without this, a regression that broadens the checksum to reject `GB193054661` would silently pass for the wrong reason.

## Deviations from Plan

### Auto-fixed Issues

None auto-fixed.

### Surfaced Issues (non-blocking)

**1. [Race condition with concurrent background agent — not a deviation in scope]** Commit landed under wrong subject

- **Found during:** Task 2 (atomic commit)
- **Issue:** A concurrent Phase 67 background agent (writing `56-VERIFICATION.md`) was operating on the same git index. My `git commit` for Plan 66-03 raced with the other agent's commit and lost — the lock-file error returned, but my staged changes had already been picked up by the concurrent agent's working tree and were folded into commit `e7cab893 docs(67-01): write 56-VERIFICATION.md`.
- **Impact:** The implementation is on disk and tests pass. The commit subject does NOT match Plan 66-03 Task 2's acceptance criterion `git log -1 --pretty=format:'%s' | grep -E '^test\(66-03\)'`. However, `git log --all --oneline -S "post-network sad path"` correctly identifies `e7cab893` as the commit that introduced the new test, so 57-VERIFICATION.md's `fix_commits[]` block can cite that hash with a note.
- **Decision:** Do NOT rewrite history (would require destructive operations the workflow forbids). Document in this SUMMARY and Plan 66-04 will reference the correct hash with a clarifying note.
- **Verification:** `pnpm --filter @contractor-ops/gov-api test` → 68/68 pass (was 67); `grep -c "post-network sad path"` → 1.

---

**Total deviations:** 0 auto-fixed (1 surfaced as a coordination/race issue)
**Impact on plan:** Implementation correctness is unaffected; only the commit attribution needs a footnote in Plan 66-04's fix_commits[] block.

## Issues Encountered

- A concurrent Phase 67 background agent committed `e7cab893 docs(67-01): write 56-VERIFICATION.md` and `24003560 refactor(auth): compile @contractor-ops/auth to dist for runtime` between my Plan 66-02 metadata commit (`abe1ce28`) and my attempted Plan 66-03 atomic commit. The race caused my Plan 66-03 staged changes to be absorbed into `e7cab893`, so there is no standalone `test(66-03):` commit. This is a structural multi-agent coordination issue, not a defect in Plan 66-03's design.

## User Setup Required

None.

## Next Phase Readiness

- Plan 66-04 can produce 57-VERIFICATION.md citing the actual commit hashes for the §2 + §6 closure: `2a52cf4e` (Plan 66-01 alias repair), `c232b907` (Plan 66-02 router-layer fills), and `e7cab893` (Plan 66-03 MSW Layer A coverage — bundled with the concurrent Phase 67 commit; note in fix_commits[] notes column).
- All 4 PAY-02..05 truths now have automated test IDs.

---
*Phase: 66-phase-57-completion-verification*
*Completed: 2026-04-26*
