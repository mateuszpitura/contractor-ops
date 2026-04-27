---
phase: 71-f1-compliance-policy-package-schema-classification-reconcile
plan: 02
subsystem: compliance
tags: [typescript, monorepo, compliance-policy, signoff-registry, date-fns, tz]

# Dependency graph
requires:
  - phase: 71
    plan: 01
    provides: package skeleton, type surface, RED test scaffolds
provides:
  - "13 baseline policy rules across 5 jurisdictions (UK 4 + DE 3 + PL 2 + KSA 2 + UAE 2)"
  - "TZ-aware isExpired helper using @date-fns/tz"
  - "parsePolicyRuleId regex parser + duplicate-detection registerPolicyRule"
  - "deepFreeze runtime guard against malicious mutation"
  - "13 PENDING signoff entries for compliance-policy-engine namespace"
affects: [71-03, 71-04, 71-05, 71-06, 71-07]

tech-stack:
  added: []
  patterns: ["module-import side-effect registration", "appliesIf predicate filter", "TZDate + startOfDay boundary"]

key-files:
  created:
    - packages/compliance-policy/src/freeze.ts
    - packages/compliance-policy/src/policies/uk.ts
    - packages/compliance-policy/src/policies/de.ts
    - packages/compliance-policy/src/policies/pl.ts
    - packages/compliance-policy/src/policies/ksa.ts
    - packages/compliance-policy/src/policies/uae.ts
  modified:
    - packages/compliance-policy/src/registry.ts
    - packages/compliance-policy/src/expiry.ts
    - packages/compliance-policy/src/index.ts
    - packages/compliance-policy/src/__tests__/registry.test.ts
    - packages/compliance-policy/src/__tests__/expiry.test.ts
    - packages/feature-flags/src/signoff-registry-flags.json

key-decisions:
  - "All 13 rules ship at @v1; namespace versioning is engineering not legal (legal text revisions land via signoff JSON legalTicketRef flips)"
  - "EU_NATIONALITIES set in de.ts hardcodes 27 EU + 4 EFTA states for de.aufenthaltstitel applies-predicate"
  - "isExpired strict-after semantics: expiresAt = today is NOT expired until tomorrow 00:00 in jurisdiction TZ"

patterns-established:
  - "policies/<jurisdiction>.ts modules register on import side effect (no central wiring needed)"
  - "appliesIf predicates use null-safe checks for downstream EngagementContext fields that may be null"

requirements-completed: [COMPL-08, COMPL-09]

duration: ~10min
completed: 2026-04-27
---

# Phase 71-02: Compliance Policy Registry Implementation

**13 typed-const policy rules across 5 jurisdictions with TZ-aware expiry helper and 13 PENDING signoff entries.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-04-27T12:35Z
- **Tasks:** 6
- **Files modified:** 12

## Accomplishments
- All Plan 71-01 RED tests turn GREEN: 18 passing across 4 test files in `@contractor-ops/compliance-policy`
- 13 policy rules registered via module-import side effect in 5 sub-modules (`policies/{uk,de,pl,ksa,uae}.ts`)
- `parsePolicyRuleId` regex parser + duplicate-ID detection in `registerPolicyRule`
- `isExpired(expiresAt, tz, now)` boundary helper using `@date-fns/tz` `TZDate` + `startOfDay`; 7 test fixtures covering Riyadh/London/Honolulu/Berlin/Warsaw + DST transition all pass
- `signoff-registry-flags.json` has 13 PENDING `compliance-policy-engine.*` entries (committed via parallel Phase 74 process; entries match exactly)
- Phase 70 guards stay GREEN: `lint:schema` 28 schemas clean, `lint:logs` 1282 sources clean, `i18n:parity` clean, all 50 feature-flags tests pass

## Task Commits

Single squashed commit:

1. **Tasks 1–6 (registry + expiry + 5 policy modules + index + signoff JSON)** — `58c18c4b` (feat)

## Files Created/Modified
- 6 files created (freeze.ts + 5 policy modules)
- 6 files modified (registry.ts, expiry.ts, index.ts, registry.test.ts, expiry.test.ts, signoff-registry-flags.json)

## Decisions Made
- Hardcoded EU_NATIONALITIES (27 EU + 4 EFTA) in `policies/de.ts` rather than importing from a shared package — this list is stable and the rule is co-located with its predicate
- Used `Set<PolicyRuleId>` for duplicate detection in `registerPolicyRule` (O(1) lookup, immutable after registration)
- Kept `parsePolicyRuleId` regex check identical to `registerPolicyRule` — single source of truth

## Deviations from Plan

**1. [Rule 1 — Bug fix] Plan 71-01 registry-shape test regex was too narrow**
- **Found during:** Task 5 (regression check) — running `pnpm --filter @contractor-ops/compliance-policy test`
- **Issue:** Plan 71-01's `every policyRuleId matches the stable-namespace@vN regex` test used `^[a-z]+\.[a-z_]+@v\d+$` which rejects `de.a1@v1` (digit in doc namespace). Plan 71-02 explicitly defines IDs with digits (`de.a1`, `pl.zus_a1`).
- **Fix:** Updated the test regex to `^[a-z]+\.[a-z][a-z_0-9]*@v\d+$` to match the registry's `POLICY_RULE_ID_RE`. Test still validates format defensively.
- **Files modified:** packages/compliance-policy/src/__tests__/registry.test.ts (1 line)
- **Verification:** All 18 tests pass after fix
- **Committed in:** 58c18c4b

**2. [Operational] Parallel Phase 74 process pre-committed signoff-registry-flags.json**
- **Found during:** Task 6 (commit) — `git status` showed signoff JSON had no changes vs HEAD
- **Issue:** A parallel `gsd:execute-phase 74` background process committed the entire `signoff-registry-flags.json` (including all 13 of my 71-02 compliance entries) under their own `feat(74-01)` commit (f8159bf5) ~5 seconds after I wrote the file. The diff was 100% mine + their offboarding-ip-foundation entry.
- **Fix:** No revert needed — the content is identical to what I wrote. Skipped re-staging the JSON; my Plan 71-02 commit covers only the package-internal files. Documented the cross-phase artifact race in this deviation entry.
- **Verification:** `git diff HEAD packages/feature-flags/src/signoff-registry-flags.json` returns empty; all 13 entries present and correct.
- **Committed in:** f8159bf5 (cross-phase) — content reflects my Plan 71-02 design

---

**Total deviations:** 2 (1 auto-fixed test regex; 1 operational note about parallel-execution cross-commit)
**Impact on plan:** Functional outcome unchanged; signoff-registry-flags.json content identical to plan spec.

## Issues Encountered
- One transient regex mismatch in Plan 71-01 test (caught and fixed in <1 minute, no scope impact)
- Cross-phase parallel-execution committed my JSON under a different commit hash; non-blocking, content is correct

## Next Phase Readiness
- Wave 1 done: registry implementation green, signoff entries staged, Phase 70 guards uninhibited
- Plan 71-03 (schema additions) can begin: `policyRuleId`, `severity`, `expiryJurisdictionTz`, `waivedReason` Prisma columns + `policyRuleSetVersion` on ClassificationAssessment
- Plan 71-04 (classification supersession) has the policy registry it needs: `resolvePolicyRules(ctx)` filters by jurisdiction + appliesIf

---
*Phase: 71-f1-compliance-policy-package-schema-classification-reconcile*
*Completed: 2026-04-27*
