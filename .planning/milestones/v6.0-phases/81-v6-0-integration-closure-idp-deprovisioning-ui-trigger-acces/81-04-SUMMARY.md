---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
plan: 04
subsystem: testing
tags: [slack, idp-deprovisioning, scim, vitest, msw, regression]

# Dependency graph
requires:
  - phase: 77-f2-idp-slack
    provides: SlackAdapter Deprovisionable (suspendAccount SCIM active=false, revokeAllSessions admin.users.session.invalidate, describeImpact) + withOrgGridToken
  - phase: 76-f2-idp-saga
    provides: Deprovisionable contract + ImpactPreview union + idp-deprovisioning-step-runner resolving SlackAdapter().withOrgGridToken(token)
provides:
  - Regression lock in slack-adapter.test.ts asserting the Slack deprovision execution path fires with the org-grid bearer (suspend SCIM PATCH active=false, revoke admin.users.session.invalidate, describeImpact SLACK shape)
  - Contract-surface guards (Deprovisionable methods present after withOrgGridToken; dedicated deprovision suites guarded against silent deletion)
affects: [81-02 multi-provider PROVIDERS_FOR_RUN run steps, v6.0 milestone close, INT-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-08 regression lock: a named test file gets a minimal must-have-truths block using the canonical @contractor-ops/test-utils MSW harness, deliberately NOT duplicating the dedicated behavioral suites"
    - "Sibling-suite existence guard (existsSync on file:// URL) prevents silent deletion of behavioral coverage the lock intentionally omits"

key-files:
  created: []
  modified:
    - packages/integrations/src/adapters/__tests__/slack-adapter.test.ts

key-decisions:
  - "Plan premise was stale: the Slack deprovision execution path is ALREADY covered by 21 GREEN tests across slack-deprovision.test.ts / slack-describe-impact.test.ts / slack-enterprise-grid-detection.test.ts. Honored D-08 intent (confirm + lock, no behavior change) by adding a focused non-duplicative regression block to the plan's named target file instead of creating a fourth duplicate suite."
  - "Used the canonical createMockServer (MSW) harness from @contractor-ops/test-utils for the behavioral assertions — consistent with the dedicated deprovision suites — rather than the raw vi.stubGlobal('fetch') convention in the rest of slack-adapter.test.ts."
  - "suspendAccount asserted with a bare Slack user id (no @) so #resolveScimUserId passes through and the single observed request is the SCIM PATCH /Users/{id} — the email-resolve branch is already covered in slack-deprovision.test.ts."

patterns-established:
  - "Regression-lock-without-duplication: assert only the must-have contract truths + guard the existence of the dedicated behavioral suites."

requirements-completed: [IDP-04, IDP-08]

# Metrics
duration: 6min
completed: 2026-06-06
---

# Phase 81 Plan 04: Slack Deprovision Execution-Path Regression Lock (D-08) Summary

**Added a focused, non-duplicative regression lock to `slack-adapter.test.ts` asserting the Slack deprovision execution path (suspend SCIM `active=false`, revoke `admin.users.session.invalidate`, `describeImpact` SLACK shape) fires with the org-grid bearer — confirming D-08 with zero change to the adapter source.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-06T18:25:00Z (approx)
- **Completed:** 2026-06-06T18:28:00Z (approx)
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Locked the three D-08 must-have truths in the plan's named target file (`slack-adapter.test.ts`), each asserting the org-grid `Bearer` token crosses to Slack:
  - `suspendAccount` → SCIM `PATCH` with body `Operations: [{ op: 'replace', path: 'active', value: false }]` and `Authorization: Bearer org-grid-token`.
  - `revokeAllSessions` → `POST https://slack.com/api/admin.users.session.invalidate` with `{ user_id }` and the org-grid bearer.
  - `describeImpact` → `provider: 'SLACK'` shape with the org-grid bearer asserted on every admin Web-API read.
- Added contract-surface guards: the four Deprovisionable methods exist after `withOrgGridToken`, `withOrgGridToken` is chainable (returns `this`), and the dedicated deprovision suites are guarded against silent deletion.
- Verified the adapter source `slack-adapter.ts` is byte-for-byte unchanged (empty `git diff`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Slack suspend/revoke/impact regression cases (D-08)** — `8b02cacb` (test)

_TDD note: this is a GREEN-only regression lock — see "TDD Gate Compliance" below._

## Files Created/Modified
- `packages/integrations/src/adapters/__tests__/slack-adapter.test.ts` — Added a `deprovision execution path — contract surface (D-08)` describe block inside the existing top-level suite (method presence + `withOrgGridToken` chainability + dedicated-suite existence guard), and a separate MSW-backed `deprovision execution path fires with the org-grid bearer (D-08)` describe block (suspend / revoke / impact behavioral assertions). Added imports for `node:fs`, `node:url`, and `@contractor-ops/test-utils` MSW helpers.

## Decisions Made
- **Honor D-08 intent over the stale plan premise.** The plan (and 81-PATTERNS/81-RESEARCH) asserted the suspend/revoke/impact methods have "ZERO test cases" because a describe/it grep only inspected `slack-adapter.test.ts`. In the current tree, the path is already covered by **21 GREEN tests** in three dedicated sibling files (`slack-deprovision.test.ts`, `slack-describe-impact.test.ts`, `slack-enterprise-grid-detection.test.ts`). Creating a fourth duplicate suite would be wasteful and drift-prone. Instead, the plan's named artifact (`slack-adapter.test.ts`) now carries a minimal, non-overlapping regression lock that still contains every required string anchor (`withOrgGridToken`, SCIM PATCH `active=false`, `admin.users.session.invalidate`, `provider: 'SLACK'`) and a guard that the real behavioral suites stay present.

## Deviations from Plan

### Out-of-scope discovery (no fix applied — surfaced for record)

**1. [Scope/observation] Plan premise contradicted by the live tree (Slack deprovision path already covered)**
- **Found during:** Task 1 (read-first of the target + sibling discovery via grep)
- **Issue:** The plan, 81-PATTERNS.md (line 267/291), and the interfaces block claim the deprovision execution path is implemented but "NOT yet unit-tested / ZERO test cases." This is false against the current branch — `slack-deprovision.test.ts` (16 cases), `slack-describe-impact.test.ts` (3), and `slack-enterprise-grid-detection.test.ts` (4) already exercise suspend SCIM `active=false` + org-grid bearer, email→SCIM-id resolve, 403/401/429 error-class mapping, revoke `admin.users.session.invalidate` (ok/user_not_found/missing_scope/ratelimited), `verifyDeprovisioned`, token-independent hashes, and the full `describeImpact` matrix. All 21 GREEN.
- **Action:** No adapter change, no duplicate suite. Delivered the plan's acceptance criteria (named file contains the required anchors + GREEN + adapter source unchanged) via a focused regression lock. This is a planning-vs-reality drift, not a Rule 1-3 auto-fix and not a Rule 4 architectural change — surfaced here per "Quality > time, narrow scope."
- **Verification:** Existing 21 sibling tests re-run GREEN; new 17-test `slack-adapter.test.ts` GREEN; adapter `git diff` empty.
- **Committed in:** `8b02cacb` (test-only)

---

**Total deviations:** 0 auto-fixed; 1 surfaced planning-premise drift (handled by honoring intent, not literal "zero coverage" framing).
**Impact on plan:** None negative. D-08's actual goal (confirm + lock the Slack leg against regression, no behavior change) is satisfied. No scope creep, no adapter change.

## TDD Gate Compliance

This plan is `type: tdd`, but the RED gate cannot apply: the behavior under test already exists and is already covered (21 GREEN sibling tests), so any new assertion against it passes on first write. Per the TDD fail-fast rule, a test that passes unexpectedly during RED means the feature already exists — confirmed here. D-08 is explicitly "confirm + lock, no behavior change," so a **GREEN-only regression lock** is the correct shape; there is no `feat(...)` implementation commit because there is (and must be) no adapter change. The commit is `test(81-04): ...` (`8b02cacb`).

## Issues Encountered
- None. The only friction was reconciling the stale plan premise with the live tree (resolved by honoring D-08 intent).

## User Setup Required
None — no external service configuration required. Tests use the in-process MSW harness; no network egress, no real org-grid credential (placeholder token `org-grid-token` only, satisfying threat T-81-04-01 / T-81-04-02).

## Next Phase Readiness
- The Slack leg of the resolver-backed `{GOOGLE_WORKSPACE, SLACK}` set is regression-locked in the named target file, so 81-02's dynamic `PROVIDERS_FOR_RUN` can create Slack steps with confidence the suspend/revoke/impact contract is held.
- No blockers. Adapter source untouched; integrations typecheck clean.

## Self-Check: PASSED
- FOUND: packages/integrations/src/adapters/__tests__/slack-adapter.test.ts (modified, 17 tests GREEN)
- FOUND: commit 8b02cacb
- VERIFIED: packages/integrations/src/adapters/slack-adapter.ts unchanged (empty git diff)

---
*Phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces*
*Completed: 2026-06-06*
