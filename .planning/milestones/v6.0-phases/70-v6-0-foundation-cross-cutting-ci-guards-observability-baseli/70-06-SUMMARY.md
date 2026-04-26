---
phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
plan: 06
subsystem: infra

requires:
  - phase: 70-02
    provides: pnpm lint:schema script
  - phase: 70-03
    provides: pnpm lint:logs script
  - phase: 70-04
    provides: pnpm i18n:parity script

provides:
  - "Three new CI steps in .github/workflows/ci.yml (lint:schema, lint:logs, i18n:parity) inserted between check:no-process-env and Build"
  - "Updated .husky/pre-push pipeline with all three new guards in &&-chained sequence"

affects: []

tech-stack:
  added: []
  patterns: ["Per-guard CI step (no umbrella) per D-04 — failures surface independently in PR view"]

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .husky/pre-push

key-decisions:
  - "Inserted lint steps after check:no-process-env and before Build packages — matches the existing 'small-fast-checks first' pattern in the workflow."
  - "Used `pnpm run <script>` consistently in CI YAML (matches existing surrounding steps); pre-push file uses `pnpm run` for consistency with the format:check / lint head."

patterns-established:
  - "Phase 70 D-04 wiring pattern: each guard gets its own GitHub Actions step with the FOUND6/PITFALLS reference in the step name."

requirements-completed: [FOUND6-01, FOUND6-02, FOUND6-03]

duration: 12min
completed: 2026-04-26
---

# Phase 70 · Plan 06 Summary

**CI workflow + husky pre-push wired with the three lint scripts. Engineers can no longer push (or land via PR) code that violates schema tenant scoping, body-redaction, or i18n parity.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 4
- **Files modified:** 2

## Accomplishments
- Three new CI steps added between `check:no-process-env` and `Build packages` — each runs independently with FOUND6/PITFALLS references in the step name
- `.husky/pre-push` extended with the same three commands in a single `&&`-chained pipeline
- Live smoke: full pipeline green against current state (28 schema files clean, 1257 source files clean for body-log scan, baseline-tolerated i18n parity)
- Synthetic body-log injection into `apps/web/src/lib/_temp_phase70_smoke.ts` reliably triggers `[lint:logs] FAIL` with exit code 1; cleanup verified

## Task Commits

1. **Tasks 1–4: CI + pre-push wiring + smoke verification** — `f2d76942` (ci)

## Files Modified

- `.github/workflows/ci.yml` — three new steps inserted (lint:schema → lint:logs → i18n:parity)
- `.husky/pre-push` — extended &&-chained pipeline

## Decisions Made
None — plan executed exactly as written.

## Deviations from Plan

None.

## Issues Encountered

YAML validation via Python's `yaml` module wasn't available locally, so I verified ordering with `grep -n` (lint steps at lines 51/54/57, Build at 59, Test at 62 — correct ordering). The lint-staged hook on commit didn't try to format the YAML/sh files (no patterns matched), avoiding the read-before-edit interaction that occurred earlier in the wave for `.husky/pre-push`.

## Next Phase Readiness
- Plan 70-07 (boot-time signoff gate) can land — it's orthogonal to the wiring layer.
- Plan 70-08 (getIdpAuditLogger) can land — also orthogonal.
- After Wave 2 closes, the foundation is ready for Wave 3 (multi-region migration + GWS reconnect banner).

---
*Phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli*
*Completed: 2026-04-26*
