---
phase: 80-v6-0-verification-hardening-manual-uat
plan: 02
subsystem: testing
tags: [uat, manual-testing, verification, milestone-close, idp, compliance, gulf, offboarding]

# Dependency graph
requires:
  - phase: 71-73 (F1 Compliance)
    provides: compliance dashboard, payment-block modal, portal upload-replacement, override→WAIVED audit
  - phase: 76-78 (F2 IdP Deprovisioning)
    provides: ACCESS_REVOKE saga, GWS/Slack/Entra/Okta/GitHub adapters, deprovisioning run view
  - phase: 79 (F3 Gulf)
    provides: free-zone form, scope-mismatch banner, Saudization dashboard, Arabic RTL, trajectory banner
  - phase: 74-75 (F4 Offboarding)
    provides: KT templates, OWNER-only IP-override dialog, IP-clause health check, credential vault
provides:
  - "80-HUMAN-UAT.md — 21 manual UI UAT scenarios across F1/F2/F3/F4 with repro steps + why_human + result:[pending]"
  - "F2 IdP milestone-close coverage (deliberately excluded from the SC#1 integration test per D-01)"
affects: [80-03 legal-signoff, 80-04 retrospective, v6.0 milestone close, post-deploy UAT execution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror 79-/63-HUMAN-UAT frontmatter + Tests + Summary + Gaps; per-test expected/why_human/result triplet"
    - "Repro steps anchored to real apps/web-vite component paths (verified, not guessed)"
    - "Cross-reference per-phase UAT (79 tests 1-2) at milestone level instead of verbatim duplication (dedup discretion)"

key-files:
  created:
    - .planning/phases/80-v6-0-verification-hardening-manual-uat/80-HUMAN-UAT.md
  modified: []

key-decisions:
  - "21 scenarios: F1 (4), F2 IdP (8), F3 (5), F4 (4) — F2 weighted heavy because UAT is its ONLY milestone-close coverage (D-01 excludes it from the integration test)"
  - "Every result is [pending] — LOCAL-ONLY post-deploy disposition; never a phase/milestone blocker"
  - "F3 Arabic-RTL + de/pl-genuineness scenarios cross-reference 79-HUMAN-UAT tests 1-2 (dedup), restated at milestone scope"

patterns-established:
  - "Pattern: anchor each repro step to a verified real component path so post-deploy testers click the right surface"
  - "Pattern: why_human states the exact reason grep/vitest cannot prove the item (visual render, dialog flow, RTL, role-gated absence, real-provider side effect, byte/PDF inspection)"

requirements-completed: []  # verification phase — 0 ROADMAP requirement IDs

# Metrics
duration: ~18min
completed: 2026-06-05
---

# Phase 80 Plan 02: Manual UI UAT Scenario List Summary

**80-HUMAN-UAT.md — 21 manual UI UAT scenarios across F1/F2/F3/F4 (F2 IdP fully covered), each with repro steps anchored to real apps/web-vite surfaces, a why_human rationale, and a result:[pending] post-deploy disposition, mirroring 79-/63-HUMAN-UAT format.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Authored `80-HUMAN-UAT.md` with 21 manual-UAT scenarios spanning all four v6.0 feature areas.
- F2 IdP given 8 dedicated scenarios (describeImpact preview, GWS, Slack, Entra+CA/hybrid-AD warnings, Okta, GitHub+outside-collab flag, PARTIAL_FAILURE reconcile-retry, idempotent LIKELY_GONE) — its only milestone-close coverage since D-01 excludes it from the SC#1 integration test.
- Every repro step anchored to a verified real `apps/web-vite` component (payment-block-modal, deprovisioning-run-view, free-zone-assignment-form, nitaqat-override-dialog, offboarding/override-dialog, credential-add-dialog, etc.) — discovered via Glob/Grep against the live tree, not guessed.
- Cross-referenced 79-HUMAN-UAT tests 1-2 (Arabic RTL, de/pl genuineness) at milestone scope rather than duplicating verbatim.

## Scenario Count Per Feature

| Feature | Scenarios | Numbers |
|---------|-----------|---------|
| F1 (Compliance) | 4 | 1-4 (dashboard widgets, payment-block modal, portal upload→SATISFIED, override→WAIVED audit) |
| F2 (IdP) **— PRESENT** | 8 | 5-12 (describeImpact preview, GWS, Slack, Entra, Okta, GitHub, PARTIAL_FAILURE retry, idempotent LIKELY_GONE) |
| F3 (Gulf) | 5 | 13-17 (Arabic RTL, free-zone+scope-mismatch+NOC, Saudization rollup+override badge, trajectory banner, de/pl genuineness) |
| F4 (Offboarding) | 4 | 18-21 (KT auto-select+PTO routing, OWNER-only override dialog, IP LIKELY_MISSING+e-sign, credential AWS-key 400) |
| **Total** | **21** | all `result: [pending]` |

**F2 IdP confirmed present** — verify echo `F2_PRESENT` printed; F2 keyword grep count = 23 (>= 1 required).

## Task Commits

1. **Task 1: Assemble F1/F2/F3/F4 manual UAT scenarios into 80-HUMAN-UAT.md** — `78d64311` (docs)

## Files Created/Modified
- `.planning/phases/80-v6-0-verification-hardening-manual-uat/80-HUMAN-UAT.md` - Consolidated v6.0 manual UI UAT scenario list (21 scenarios, all pending)

## Decisions Made
- Followed the plan as specified. Discretionary calls within plan latitude: (a) total = 21 scenarios; (b) F3 Arabic-RTL + de/pl scenarios cross-reference 79-HUMAN-UAT tests 1-2 instead of verbatim re-list (per the dedup discretion); (c) F4 scenario 20 notes the DEFERRED e-sign atomic-webhook slice recorded in STATE.md so the tester verifies whichever portion is wired (the e-sign button is presentational + wired-by-prop).

## Deviations from Plan
None - plan executed exactly as written.

## Threat Surface
Per the plan threat model, this deliverable is a markdown checklist with synthetic example identifiers only. Confirmed: no real credentials, tokens, or live secrets in repro steps (grep for AKIA/xoxb-/ghp_ patterns returned none). T-80-02-01 mitigation satisfied.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 80-HUMAN-UAT.md (SC#2) complete. Ready for 80-03 (80-LEGAL-SIGNOFF.md, SC#3) and 80-04 (D-04 gate re-run + 80-RETROSPECTIVE.md, SC#4).
- The F3 Arabic statutory sign-off item routed from 79-HUMAN-UAT test 3 belongs in 80-LEGAL-SIGNOFF.md (80-03), not here.

## Self-Check: PASSED

---
*Phase: 80-v6-0-verification-hardening-manual-uat*
*Completed: 2026-06-05*
