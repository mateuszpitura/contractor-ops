---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 05
subsystem: validators
tags: [zod, secret-detection, credential-vault, security]

requires:
  - phase: 75-01
    provides: secret-shape-detector RED test flipped GREEN here
provides:
  - looksLikeSecret(input) synchronous detector + LooksLikeSecretResult
  - looksLikeSecretRefinement (Zod 4 superRefine carrying { reason, patternId, fieldHint })
  - SECRET_PATTERNS — 12 ordered patterns (most-specific-first)
affects: [75-07, 75-08]

tech-stack:
  added: []
  patterns:
    - "Whole-input-anchored secret-shape regexes; catch-all hex-32-plus last; negative lookahead on aws-secret so pure-hex defers to hex-32-plus"

key-files:
  created:
    - packages/validators/src/secret-shape-detector.ts
  modified:
    - packages/validators/src/index.ts
    - packages/validators/src/__tests__/secret-shape-detector.test.ts

key-decisions:
  - "Used Zod 4 `code: 'custom'` + `params` (not the plan's legacy z.ZodIssueCode.custom) — matches the repo's existing addIssue usage; params carriage verified to surface on the issue"
  - "aws-secret-access-key regex gained a non-(lowercase-hex) lookahead so a 40-char pure-hex string attributes to hex-32-plus (the plan's matrix expectation) while real base64 AWS secret keys still match"
  - "Lowered fine-grained PAT threshold from {82,} to {40,} to match the canonical 69-char test fixture while staying well above the 36-char classic PAT"

patterns-established:
  - "Explicit named barrel exports for the new module (validators index uses explicit exports, not export *)"

requirements-completed: [OFFB-08]

duration: 18 min
completed: 2026-05-31
---

# Phase 75 Plan 05: Secret-shape Detector Summary

**Shipped the credential-vault structural defence — `looksLikeSecret` + Zod-4 `looksLikeSecretRefinement` over 12 ordered secret-shape patterns; flipped the 75-01 RED scaffold to 30 GREEN tests.**

## Performance
- **Duration:** ~18 min
- **Tasks:** 3/3
- **Files:** 3

## Accomplishments
- `secret-shape-detector.ts` with `looksLikeSecret`, `looksLikeSecretRefinement`, `SECRET_PATTERNS`, `SecretPattern`, `LooksLikeSecretResult`.
- Fixed two implementation bugs the RED test surfaced (fine-grained PAT length, hex-vs-aws-secret attribution).
- 30/30 GREEN; validators typecheck clean; ip-clauses RED scaffolds correctly preserved for 75-04.

## Task Commits
1. **75-05-01..03 (module + barrel + test + fixes)** - `5223b324` (feat)

## Deviations from Plan

**[Rule 1 — correctness] fine-grained PAT length + hex/aws-secret ordering** — RED test surfaced two real bugs: (1) `{82,}` rejected the 69-char canonical fixture → lowered to `{40,}`; (2) a 40-char pure-hex string matched `aws-secret-access-key` before `hex-32-plus` → added `(?=.*[G-Zg-z/+=])` lookahead to aws-secret so pure-hex defers to hex-32-plus. Both fixed and verified.

**[Rule 1 — API] Zod 4 issue API** — Plan used `z.ZodIssueCode.custom`; this repo is Zod 4.4.3 which uses `code: 'custom'`. Adapted to match existing `ctx.addIssue` usage; `params` carriage confirmed via the refinement test.

**[Process] commit absorbed pre-staged Phase 72 files** — The git index already contained pre-staged Phase 72 replan artifacts (72-*-PLAN.md, 72-REPLAN-DRIFT-MAP.md) from before this session. `git add` of my 3 files + commit captured them too (16-file commit). Content is valid (legitimate Phase 72 replan docs); nothing lost, but they landed in a 75-05-labelled commit. Going forward: verify `git diff --cached --name-only` before each commit. Not reverted (history rewrite is riskier with a shared tree).

**Total deviations:** 2 correctness/API auto-fixed + 1 process note.

## Self-Check: PASSED
- secret-shape-detector 30/30 GREEN; validators typecheck clean.
- Module + 5 exports present; barrel re-exports; 12 patterns hex-last.
- ip-clauses-parity / ip-clauses-results-schema still RED (preserved for 75-04).

## Next
Wave 1 continues: 75-03 (compliance policies), 75-04 (IP-clause libs — flips ip-clauses RED scaffolds).
