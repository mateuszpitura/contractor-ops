---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 04
subsystem: api
tags: [validators, legal, locked-phrases, i18n, signoff-registry, compliance, COMPL-11]

requires:
  - phase: 73-01
    provides: compl-doc-names-parity Wave 0 RED scaffold
  - phase: 71
    provides: compliance-policy registry (listPolicyRules) — 19 registered rules across 6 jurisdictions
provides:
  - per-jurisdiction COMPL doc-name locked-phrase registry (LOCKED_COMPL_NAMES_<JX>) for UK/DE/PL/KSA/UAE/US
  - 19 PENDING COMPL_DOCNAME_* signoff entries (one per registered policyRuleId)
  - D-17 data-driven parity guard (compl-doc-names-parity.test.ts) — GREEN
affects: [73-06, 73-07, 73-08]

tech-stack:
  added:
    - "@contractor-ops/compliance-policy as a validators devDependency (test-time parity invariant only)"
  patterns:
    - "per-jurisdiction leaf-level locked-name data modules with `satisfies Record<...>` shape guard; aggregator re-export; mirrors ip-clauses-index.ts six-jurisdiction shape"
    - "every locked-name entry carries en+pl+de+ar (ar required so i18n:parity guard stays green); authoritative Arabic where well-known, interim-mirror en + TODO elsewhere"

key-files:
  created:
    - packages/validators/src/legal/compliance-uk.ts
    - packages/validators/src/legal/compliance-de.ts
    - packages/validators/src/legal/compliance-pl.ts
    - packages/validators/src/legal/compliance-ksa.ts
    - packages/validators/src/legal/compliance-uae.ts
    - packages/validators/src/legal/compliance-us.ts
    - packages/validators/src/legal/index.ts
  modified:
    - packages/validators/src/legal/signoff-registry.json
    - packages/validators/src/__tests__/compl-doc-names-parity.test.ts
    - packages/validators/package.json

key-decisions:
  - "Added compliance-us.ts (6th module) beyond the plan's 5 — Phase 75 registered us.ip_assignment@v1 and the D-17 guard is data-driven over the FULL listPolicyRules() set, so every registered jurisdiction needs a locked-name module or the guard fails"
  - "Used ACTUAL registered policyRuleIds (uk.right_to_work@v1 not the plan template's @v3; no uk.proof_of_address) — enumerated from packages/compliance-policy/src/policies/*.ts"
  - "Added @contractor-ops/compliance-policy as a validators devDependency (no circular dep — compliance-policy depends only on date-fns) so the parity guard reads the live registry rather than a drift-prone hardcoded list"

patterns-established:
  - "COMPL_DOCNAME_<jx-lower>_<stable-namespace>_v<N> flat-key form for signoff entries"

requirements-completed: [COMPL-11]

duration: 22 min
completed: 2026-06-01
---

# Phase 73 Plan 04: COMPL Doc-Name Locked-Phrase Registry + Parity Guard Summary

**Per-jurisdiction (UK/DE/PL/KSA/UAE/US) locked COMPL doc-name registry with en/pl/de/ar phrase maps, 19 PENDING signoff entries, and a data-driven D-17 parity guard that flips the Wave 0 scaffold GREEN (22 assertions).**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-01T00:05:00Z
- **Completed:** 2026-06-01T00:27:00Z
- **Tasks:** 6
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments
- 6 per-jurisdiction locked-name modules, each exporting LOCKED_COMPL_NAMES_<JX> + RESERVED_COMPL_KEYS_<JX> + key type
- every entry has en+pl+de+ar (ar required for i18n:parity); Iqama/Emirates ID/Qiwa/free-zone use authoritative Arabic, rest interim-mirror en with TODO
- legal/index.ts aggregator re-exports all 6
- 19 COMPL_DOCNAME_* PENDING signoff entries appended additively (existing entries untouched)
- parity guard: 22 passing assertions; typecheck + build green; signoff-registry-schema, locked-phrases, ip-clauses-parity tests still pass

## Task Commits

1. **Tasks 73-04-01..06: registry modules + signoff + parity guard** - `<feat 73-04>` (feat)

## Files Created/Modified
- See `key-files`. Actual registered rules: UK 5, DE 4, PL 3, KSA 3, UAE 3, US 1 = 19.

## Decisions Made
- See `key-decisions` frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Missing critical] Added compliance-us.ts (6th jurisdiction module)**
- **Found during:** Task 73-04-06 (parity test)
- **Issue:** Plan specified 5 modules, but `listPolicyRules()` includes `us.ip_assignment@v1` (Phase 75). The data-driven guard + `satisfies Record<Jurisdiction,...>` (Jurisdiction union includes US) would fail without a US module.
- **Fix:** Added `compliance-us.ts` mirroring the shape; included US in the parity test's REGISTRIES_BY_JURISDICTION + signoff entry.
- **Files modified:** packages/validators/src/legal/compliance-us.ts, legal/index.ts, compl-doc-names-parity.test.ts, signoff-registry.json
- **Verification:** parity test 22 passing; typecheck 0.
- **Committed in:** Plan 73-04 commit

**2. [Rule 3 - Blocking] Added compliance-policy as validators devDependency**
- **Found during:** Task 73-04-06 (parity test collection)
- **Issue:** `@contractor-ops/compliance-policy` was not resolvable from validators — the static import (replacing the Wave 0 `await import`) threw `Cannot find package`.
- **Fix:** Added `"@contractor-ops/compliance-policy": "workspace:*"` to validators devDependencies + `pnpm install`. No circular dep (compliance-policy depends only on date-fns). Workspace dep, so 7-day release-age rule does not apply.
- **Files modified:** packages/validators/package.json, pnpm-lock.yaml
- **Verification:** parity test resolves + passes.
- **Committed in:** Plan 73-04 commit

**3. [Rule 1 - Bug] Used real policyRuleIds, not plan-template placeholders**
- **Found during:** Tasks 73-04-01..03
- **Issue:** Plan templates used non-existent IDs (`uk.right_to_work@v3`, `uk.proof_of_address@v1`, `pl.zus_certificate@v1`). The registry actually has `@v1` IDs and different namespaces.
- **Fix:** Enumerated the real IDs from `packages/compliance-policy/src/policies/*.ts` and used those verbatim.
- **Verification:** parity guard (every registered rule must have an entry) passes.
- **Committed in:** Plan 73-04 commit

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3).
**Impact on plan:** All necessary for a GREEN data-driven parity guard. No scope creep — only the planned legal-registry surface plus the US sibling and a test-only workspace dep.

## Issues Encountered
- Biome renamed `_typecheck` → `Typecheck` and reordered index.ts re-exports alphabetically on commit (cosmetic; typecheck already green).

## User Setup Required
None - no external service configuration required.

## Deferred Verification (Standing Constraint — legal review post-deploy)
- UK adviser: compliance-uk.ts (5 entries)
- Steuerberater: compliance-de.ts (4 entries)
- PL adviser: compliance-pl.ts (3 entries)
- KSA adviser: compliance-ksa.ts (3 entries)
- UAE adviser: compliance-uae.ts (3 entries)
- US adviser: compliance-us.ts (1 entry)
- Phase 79: Arabic doc-name legal review for all `// TODO ar legal review` entries
- All COMPL_DOCNAME_* signoff entries stay PENDING until per-jurisdiction APPROVED PRs land.

## Next Phase Readiness
- Locked-name registry ready for the web-vite `use-compl-doc-name.ts` hook (Plan 73-06) to surface per-locale doc names (COMPL-11).

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-06-01*
