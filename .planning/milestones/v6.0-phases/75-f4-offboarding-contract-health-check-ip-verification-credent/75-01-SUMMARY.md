---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 01
subsystem: testing
tags: [vitest, tdd, nyquist, signoff-registry, ip-clauses, contract-health]

requires:
  - phase: 71-f1-compliance-policy-package
    provides: materialiseFromPolicy + signoff-registry shape reused by Phase 75 verdicts
  - phase: 74-f4-offboarding-workflow-foundation
    provides: WorkflowRun/WorkflowTaskRun + overrideBlockingTask the IP-block tests target
provides:
  - 14 NEW failing-test files establishing the Phase 75 RED baseline (1:1 with 75-VALIDATION Nyquist dims)
  - 17 PENDING legal-signoff.ip_clauses.* registry entries (3 UK + 4 DE + 3 PL + 3 US + 2 KSA + 2 UAE)
  - 75-01-RED-BASELINE.txt recording deterministic RED counts for downstream plan verification
affects: [75-02, 75-03, 75-04, 75-05, 75-06, 75-07, 75-08]

tech-stack:
  added: []
  patterns:
    - "Wave 0 Nyquist RED scaffolds — it.todo per acceptance criterion + expect.fail placeholders where no symbol exists yet"
    - "Prefixed signoff namespace legal-signoff.ip_clauses.<phraseId> separates Phase 75 IP clauses from Phase 64/71 disclaimers in one registry"

key-files:
  created:
    - packages/validators/src/__tests__/secret-shape-detector.test.ts
    - packages/validators/src/__tests__/ip-clauses-parity.test.ts
    - packages/validators/src/legal/__tests__/ip-clauses-results-schema.test.ts
    - packages/db/src/__tests__/phase-75-schema.test.ts
    - packages/db/src/__tests__/push-all-regions-phase-75.test.ts
    - packages/integrations/src/adapters/__tests__/contract-health-tools.test.ts
    - packages/integrations/src/services/__tests__/esign-webhook-ip-ratification.test.ts
    - packages/api/src/services/contract-health/__tests__/dedup.test.ts
    - packages/api/src/services/contract-health/__tests__/materialise.test.ts
    - packages/api/src/services/contract-health/__tests__/cross-jurisdiction.test.ts
    - packages/api/src/routers/__tests__/workflow-execution-ip-block.test.ts
    - packages/api/src/routers/__tests__/workflow-execution-credential-warning.test.ts
    - packages/api/src/__tests__/bulk-rerun-contract-health.test.ts
    - apps/web-vite/src/components/contracts/__tests__/health-check-panel.test.tsx
    - .planning/phases/75-.../75-01-RED-BASELINE.txt
  modified:
    - packages/validators/src/legal/signoff-registry.json
    - packages/validators/src/__tests__/locked-phrases-guard.test.ts

key-decisions:
  - "web health-check-panel test placed under apps/web-vite (not the stale apps/web) per 75-DRIFT-MAP — pre-migration plan paths"
  - "region-migration test moved to packages/db/src/__tests__ (not scripts/__tests__) because the db vitest include glob is src/**/__tests__/** — a scripts/ sibling would silently skip (threat T-75-01-01)"
  - "updated locked-phrases-guard count assertion 12 -> 29 (plan overlooked this existing exact-count guard); kept base-disclaimer + IP-clause PENDING invariants explicit rather than just bumping a magic number"

patterns-established:
  - "RED scaffolds use it.todo for not-yet-shipped behaviour and expect.fail/missing-import for hard-RED files; __tests__ excluded from each package tsc so typecheck stays GREEN"

requirements-completed: [OFFB-04, OFFB-05, OFFB-06, OFFB-08, OFFB-09]

duration: 24 min
completed: 2026-05-31
---

# Phase 75 Plan 01: Wave 0 RED Test Scaffolds Summary

**Deterministic RED baseline (14 NEW failing-test files + 17 PENDING IP-clause signoff entries) that maps 1:1 to Phase 75's 5 success criteria and 5 REQ-IDs; `pnpm typecheck` stays GREEN.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-05-31
- **Completed:** 2026-05-31
- **Tasks:** 10/10
- **Files modified/created:** 16 (14 new test files + signoff-registry.json + locked-phrases-guard.test.ts) + RED-baseline.txt

## Accomplishments
- Seeded 17 `legal-signoff.ip_clauses.*` PENDING entries (29 total registry keys); all DE entries reference Steuerberater sign-off; none carry approval fields (legal review outstanding by design).
- Created 14 RED scaffolds across validators / db / integrations / api / web-vite covering every Nyquist dimension; 4 hard-RED files + 102 it.todo blocks.
- Verified workspace typecheck GREEN and existing locked-phrases-guard suite GREEN (78/78) after registry growth.

## Task Commits

1. **75-01-01: seed 17 PENDING IP-clause signoff entries** - `b4c6f3f7` (test)
2. **75-01-02/03/04: validators RED scaffolds** - `94507030` (test)
3. **75-01-05..10: db/integrations/api/web scaffolds + RED-baseline** - `61b6a23f` (test)

## Files Created/Modified
- `packages/validators/src/legal/signoff-registry.json` — +17 IP-clause PENDING entries (29 total)
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — count assertion 12 -> 29 (deviation fix)
- 14 NEW `*.test.ts(x)` scaffold files — see frontmatter key-files.created
- `75-01-RED-BASELINE.txt` — per-package RED counts for downstream plan verification

## Deviations from Plan

**[Rule 2 - Missing critical] locked-phrases-guard exact-count assertion** — Found during: Task 75-01-01 acceptance run. The existing `getAllPending() returns 12 keys` test hard-asserted 12; seeding 17 IP-clause PENDING entries (the plan's own action) broke it (now 29). Fix: updated the assertion to 29 and made the base-disclaimer + 17-IP-clause PENDING invariants explicit. Files: locked-phrases-guard.test.ts. Verification: 78/78 pass. Commit: `b4c6f3f7`.

**[Rule 2 - Missing critical] db region test under non-covered glob** — Found during: Task 75-01-10. `packages/db/scripts/__tests__/` is outside the db vitest include glob (`src/**/__tests__/**`) — the test silently skipped (green-by-vacuum, threat T-75-01-01). Fix: relocated to `packages/db/src/__tests__/push-all-regions-phase-75.test.ts` (now discovered, 4 todo). Files: removed dead-path file. Verification: vitest discovers it. Commit: `61b6a23f`.

**[Path drift — 75-DRIFT-MAP] apps/web -> apps/web-vite** — health-check-panel test placed at `apps/web-vite/src/components/contracts/__tests__/` and run via `@contractor-ops/web-vite` filter (plan referenced pre-migration `apps/web` / `@contractor-ops/web`).

**Total deviations:** 2 auto-fixed (missing-critical) + 1 documented path-drift adaptation. **Impact:** none on RED intent — all scaffolds now actually run and RED/todo as designed.

## Pre-existing issues (out of scope — NOT fixed)

- `pnpm lint:logs` fails on `apps/api/src/routes/csp-report.ts:86` (unredacted-body log). This file was last modified 2026-05-26 (commit e320911b), unrelated to Phase 75. Per scope-boundary rule, left untouched. Flag for the owning phase.

## Self-Check: PASSED

- All 14 test files exist on disk; signoff-registry.json has 29 keys (17 ip_clauses).
- `git log --grep=75-01` returns 3 production commits.
- typecheck GREEN; validators/db/integrations/api/web-vite RED counts match plan acceptance.

## Next

Ready for Wave 1 (75-02 schema [checkpoint], 75-03 policies, 75-04 IP-clause libs, 75-05 secret-shape-detector).
