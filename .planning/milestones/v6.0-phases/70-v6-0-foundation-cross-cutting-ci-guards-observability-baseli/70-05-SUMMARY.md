---
phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
plan: 05
subsystem: infra

requires:
  - phase: 70-01
    provides: failing FlagSignoffEntrySchema test scaffold

provides:
  - "FlagSignoffEntrySchema (Zod) with v6.0-specific approver roles + legalTicketRef LEGAL-N or URL regex"
  - "Module-load Zod parse: signoff-registry-flags.json corruption aborts startup with [FLAG-SIGNOFF] stderr"
  - "GATED_FLAG_NAMESPACE_PREFIXES typed `as const satisfies readonly string[]` covering compliance-, idp-deprovisioning, gulf-, offboarding-ip-"
  - "isGatedFlag(key) + getFlagSignoff(key) + getAllPendingFlags() + isFlagSignoffSatisfied(key) helpers"
  - "Empty {} signoff-registry-flags.json (no v6.0 flags exist yet — populated in Phases 71+)"

affects: [70-07]

tech-stack:
  added: []
  patterns: ["Parallel registry pattern (D-09): structural sibling of Phase 64's signoff-registry but with independent role enum, gate timing, and consumer."]

key-files:
  created:
    - packages/feature-flags/src/signoff-registry-flags-schema.ts
    - packages/feature-flags/src/signoff-registry-flags.ts
    - packages/feature-flags/src/signoff-registry-flags.json
    - packages/feature-flags/src/__tests__/is-gated-flag.test.ts
  modified:
    - packages/feature-flags/src/index.ts (re-export new public surface)

key-decisions:
  - "ApproverRole enum is fully distinct from Phase 64's: LEGAL_LEAD, COMPLIANCE_OFFICER, PRIVACY_COUNSEL, EXTERNAL_COUNSEL vs Phase 64's UK_TAX_ADVISER, STEUERBERATER, INTERNAL_COUNSEL, INTERNAL_PRODUCT. T-70-05-01 mitigation."
  - "stderr prefix `[FLAG-SIGNOFF]` distinct from Phase 64's `[signoff-registry]` so log scanners never confuse the two gates."
  - "isFlagSignoffSatisfied(key) is a thin wrapper over `Registry[key] !== undefined` because the module-load Zod parse already enforces legalTicketRef when status is APPROVED. Keeping the helper as a separate function gives Plan 70-07 a clean predicate to call."

patterns-established:
  - "Per-concern signoff registry: each phase that needs a legal-review gate clones this 4-file pattern (schema, json, runtime, tests) with its own role enum and stderr prefix."

requirements-completed: [FOUND6-04]

duration: 18min
completed: 2026-04-26
---

# Phase 70 · Plan 05 Summary

**Parallel flag-namespace signoff registry — schema, runtime helpers, gated-prefix list, and an empty data store ready for v6.0 features Phases 71+ to populate. Independent of Phase 64's disclaimer signoff per D-09.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 5
- **Files created:** 4
- **Files modified:** 1

## Accomplishments
- `FlagSignoffEntrySchema` with v6.0 approver-role enum + legalTicketRef regex (LEGAL-N OR URL)
- Refine: APPROVED entries require approvedBy + approvedAt + approverRole + legalTicketRef
- Module-load Zod parse with `[FLAG-SIGNOFF]` stderr abort on malformed data
- `GATED_FLAG_NAMESPACE_PREFIXES` typed-constant list covering all 4 v6.0 feature prefixes
- 4 helper functions: `isGatedFlag`, `getFlagSignoff`, `getAllPendingFlags`, `isFlagSignoffSatisfied`
- Public surface re-exported from `@contractor-ops/feature-flags`
- 13/13 tests pass: 5 schema cases (Wave 0 turns GREEN) + 8 prefix cases
- T-70-05-04 explicitly verified: `module.classification-engine` and `payments.bacs-enabled` are NOT gated by this registry

## Task Commits

1. **Tasks 1–5: signoff registry schema + helpers** — `c251e4c7` (feat)

## Files Created/Modified

- `packages/feature-flags/src/signoff-registry-flags-schema.ts` — Zod schema + types
- `packages/feature-flags/src/signoff-registry-flags.ts` — runtime module + helpers + GATED_FLAG_NAMESPACE_PREFIXES
- `packages/feature-flags/src/signoff-registry-flags.json` — empty `{}`
- `packages/feature-flags/src/__tests__/is-gated-flag.test.ts` — prefix coverage tests
- `packages/feature-flags/src/index.ts` — public surface re-exports

## Decisions Made
None — plan executed exactly as written. The is-gated-flag tests gained one extra case beyond the must_haves list (kill-switch keys are not gated) — defensive coverage at no extra cost.

## Deviations from Plan

None. Plan executed as written.

## Issues Encountered

None.

## Next Phase Readiness
- Plan 70-07 (boot gate) can now consume `getFlagSignoff`, `isGatedFlag`, and `isFlagSignoffSatisfied` directly from the package.
- Plan 70-06 (CI workflow) doesn't depend on this plan's surface — orthogonal.

---
*Phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli*
*Completed: 2026-04-26*
