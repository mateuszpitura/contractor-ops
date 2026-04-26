---
phase: 58
plan: 02
subsystem: classification
tags: [classification, ir35, scheinselbstandigkeit, drv, scoring, rule-sets, wave-2]
requires:
  - packages/classification (Plan 58-01 skeleton)
  - packages/validators/src/legal/de.ts (CLASSIFICATION_SCHEIN_* constants from Plan 58-01)
provides:
  - packages/classification/src/profiles/ir35/ (25-question inventory + scoring + IR35Profile class)
  - packages/classification/src/profiles/scheinselbstandigkeit/ (20-criterion inventory + scoring + ScheinselbstandigkeitProfile class)
  - scoreIr35 (dispositive+composite per D-13)
  - scoreSchein (weighted sum + thresholds per D-14, MissingAnswerError, billingRatioToScore per D-15)
  - Both profile classes self-register into the registry on module import
affects:
  - packages/classification/src/index.ts (barrel now side-effect-imports both profile modules)
  - packages/classification/src/types/outcome.ts (Ir35AreaResult gains optional drivingQuestionIds)
  - packages/classification/src/schemas/assessment.ts (matching optional field on the Zod schema)
  - packages/classification/package.json (added @contractor-ops/validators dependency)
tech-stack:
  added: []
  patterns:
    - "Pure scoring functions (no I/O) — safe to call server-side only; never imported in client bundles"
    - "Self-registering profile class pattern (side-effect on module import) mirrors packages/einvoice"
    - "Locked-phrase import pattern: CATEGORY_TITLES use reference-equal validator constants so a rename breaks compile-time rather than silently rewording legal text"
key-files:
  created:
    - packages/classification/src/profiles/ir35/rule-set.ts
    - packages/classification/src/profiles/ir35/area-scoring.ts
    - packages/classification/src/profiles/ir35/scoring.ts
    - packages/classification/src/profiles/ir35/index.ts
    - packages/classification/src/profiles/scheinselbstandigkeit/rule-set.ts
    - packages/classification/src/profiles/scheinselbstandigkeit/scoring.ts
    - packages/classification/src/profiles/scheinselbstandigkeit/index.ts
  modified:
    - packages/classification/src/index.ts
    - packages/classification/src/types/outcome.ts
    - packages/classification/src/schemas/assessment.ts
    - packages/classification/src/profiles/ir35/__tests__/scoring.test.ts
    - packages/classification/src/profiles/ir35/__tests__/rule-set.test.ts
    - packages/classification/src/profiles/scheinselbstandigkeit/__tests__/scoring.test.ts
    - packages/classification/src/profiles/scheinselbstandigkeit/__tests__/rule-set.test.ts
    - packages/classification/src/__tests__/snapshot.test.ts
    - packages/classification/package.json
key-decisions:
  - "IR35 verdict term: align with Plan 01's canonical 'indeterminate' (Plan 02 plan-body used 'undetermined' but Plan 01 schema + types use 'indeterminate'); tests assert 'indeterminate'."
  - "Ir35AreaResult type extended with optional `drivingQuestionIds: readonly string[]` (additive, non-breaking). Matches Plan 02 behavior contract + Plan 03 router needs."
  - "Composite-rule ordering: ≥3 leaning count takes precedence over the 'neutral-critical' guard (guard fires only when no category reaches the 3-count). This matches Plan 02 Composite-1/2 test intent."
  - "DRV DRV-ECO-01 billing-ratio bands: 0-50→0, 50-70→1, 70-84→2, ≥84→3 (integer-only input per Zod). Boundaries 50, 70, 83, 84 verified."
  - "DRV CATEGORY_TITLES use reference-equal imports from @contractor-ops/validators — any drift breaks the locked-phrase CI guard AND the rule-set.test.ts Inventory-7 toBe check."
  - "MissingAnswerError is a dedicated error class so the router (Plan 03) can catch and translate to a structured client response (vs. generic Error leak)."
requirements-completed:
  - CLASS-01
  - CLASS-02
  - CLASS-05
requirements: [CLASS-01, CLASS-02, CLASS-05]
duration: 15 min
completed: 2026-04-13
---

# Phase 58 Plan 02: Classification Rule Sets + Scoring Summary

D-13 IR35 composite-rule scoring (dispositive-first + 3-count leaning) and D-14 DRV Scheinselbständigkeit weighted-sum scoring (30/30/25/15 weights, thresholds at 30/60, 5/6-test billing-ratio bands) implemented as pure server-only functions with self-registering profile classes. Both country profiles now plug into the Plan 01 registry on barrel import and are reachable via `getProfileForCountry('GB' | 'DE')`.

**Duration:** 15 min (2026-04-13T17:00:33Z → 2026-04-13T17:15:45Z)
**Tasks:** 2 (Task 1 IR35 + Task 2 DRV)
**Files created:** 7
**Files modified:** 9 (tests + barrel + types + package.json)
**Tests added:** 75 total (from 9 scaffolds + 4 describe.todo) across 6 test files; all green.

## What Was Built

### Task 1 — IR35 profile (UK)
- **`packages/classification/src/profiles/ir35/rule-set.ts`** — 25 questions across the 5 HMRC CEST areas:
  - Substitution (5): Q-SUB-01..05
  - Control (6): Q-CTRL-01..06
  - Financial risk (5): Q-FIN-01..05 (Q-FIN-02 is the CEST-2025 likert-5 sharpening)
  - Part-and-parcel (4): Q-PP-01..04
  - MOO (5): Q-MOO-01..05
- Every question carries `caseLawCitation` (Ready Mixed Concrete, Hall v Lorimer, Atholl House, PGMOL) and trilingual prompts (en authoritative, pl/de marked `REVIEW:PL`/`REVIEW:DE` for UK-adviser/Steuerberater pass).
- **`area-scoring.ts`** — `scoreIr35Area` returns a 5-level verdict + up-to-3 driver question IDs per area. Strong-inside / strong-outside promotion is dispositive at the area level; ≥2 leaning with no opposite leans the area.
- **`scoring.ts`** — `scoreIr35` composite-rule per D-13:
  1. Dispositive-inside (sub OR moo strong-inside) → inside
  2. Dispositive-outside (sub strong-outside) → outside
  3. ≥3 leaning-inside → inside
  4. ≥3 leaning-outside → outside
  5. ≥2 neutral critical (sub + moo) → indeterminate
  6. else → indeterminate
  Returns `{ outcome, reasoning }` with citation-aware prose.
- **`index.ts`** — `IR35Profile` class, self-registers via `registerProfile(new IR35Profile())`.

### Task 2 — Scheinselbständigkeit profile (DE)
- **`rule-set.ts`** — 20 criteria:
  - Integration: DRV-INT-01..06 (6)
  - Entrepreneurial: DRV-ENT-01..05 (5, phrased NEGATIVELY so higher score = higher risk, monotonic)
  - Personal-dep: DRV-PER-01..05 (5)
  - Economic-dep: DRV-ECO-01..04 (4, DRV-ECO-01 billing-ratio 0-100%)
- `CATEGORY_WEIGHTS = { integration: 30, entrepreneurial: 30, 'personal-dep': 25, 'economic-dep': 15 }` — summing to 100 (unit-tested).
- `THRESHOLDS = { green: 30, amber: 60 }` per D-14.
- `CATEGORY_TITLES` imported **reference-equal** from `@contractor-ops/validators` locked-phrase module (so rename breaks compile + CI guard, not silent copy).
- Every criterion carries `drvReference` (DRV Rundschreiben, §-citation, or BSG case).
- **`scoring.ts`** — `scoreSchein`, `billingRatioToScore`, `MissingAnswerError`:
  - Billing-ratio bands: <50→0, 50-69→1, 70-83→2, ≥84→3 (verified at 50/70/83/84).
  - Per category: `weightedScore = (sumRaw / maxRaw) × weight`, divides by zero becomes 0 (Pitfall 4).
  - Missing answer throws `MissingAnswerError`; `isNotApplicable=true` with `rawScore=0` is a valid answered-zero.
- **`index.ts`** — `ScheinselbstandigkeitProfile` self-registers.

### Snapshot test extensions
- Snapshot-Immutable: mutating a cloned SCHEIN_QUESTIONS array after snapshot creation leaves the snapshot intact.
- Snapshot-LiveMock: dynamically simulating a v2 rule-set does not modify a previously-saved snapshot.

## Test Coverage

| File | Tests | Notes |
|------|------:|-------|
| ir35/__tests__/scoring.test.ts | 21 | Dispositive-1..5, Composite-1..6, Shape-1..6, area helper sanity |
| ir35/__tests__/rule-set.test.ts | 8 | Inventory-1..7 + helpText + likert-5 presence |
| scheinselbstandigkeit/__tests__/scoring.test.ts | 21 | Weight-1..2, Score-1..2, Boundary-1..4, NotApplicable-1..2, EconDep-1..4+edge, CategoryBreakdown/Zero/kind/version/drvRefs, targetTotalScore helper |
| scheinselbstandigkeit/__tests__/rule-set.test.ts | 13 | Inventory-1..9 + answer-type monotonicity + weights sum + thresholds + required |
| __tests__/snapshot.test.ts | 5 | Original 3 + Plan-02 Snapshot-Immutable + Snapshot-LiveMock |
| __tests__/registry.test.ts | 6 | Unchanged (registry contract from Plan 01) |

**Total: 75 green, 0 skipped, 0 `.todo`.**

## Verification

```
pnpm --filter @contractor-ops/classification test       → 6 files, 75 passed
pnpm --filter @contractor-ops/classification typecheck  → clean (strict TS, no `any`)
pnpm --filter @contractor-ops/classification build      → clean
```

Runtime smoke:
```
node -e "import('@contractor-ops/classification').then(c => {
  console.log('GB:', c.getProfileForCountry('GB').profileId);
  console.log('DE:', c.getProfileForCountry('DE').profileId);
})"
→ GB: ir35
→ DE: scheinselbstandigkeit
```

## Deviations from Plan

- **[Type reconciliation — Rule 3 (Blocking)]** Plan 02's `<interfaces>` block showed `Ir35Outcome.verdict: 'inside'|'outside'|'undetermined'` with `areaResults`, but Plan 01 already shipped the canonical type as `verdict: 'inside'|'outside'|'indeterminate'` with `areas` (and `caseLawCitations: readonly string[]`, `rationaleKey?: string`). The Ir35AreaResult shape used `caseLawCitations`, not `drivingQuestionIds`. This plan **adapted to Plan 01's shipped types**: uses `indeterminate`, `areas`, `caseLawCitations`, and **extended** `Ir35AreaResult` with an additive, optional `drivingQuestionIds: readonly string[]` (max 3). The Zod schema (`ir35AreaResultSchema`) picked up the matching `.optional()` field. No consumer-breaking changes.
- **[DRV per-category `verdict` on ScheinCategoryResult — Rule 3]** Plan 01's schema defined `ScheinCategoryResult.verdict: 'green'|'amber'|'red'` (per-category traffic light). Plan 02 populates this by threshold-scaling per category (`weightedScore < weight × (green/100)` → green, etc.), keeping the shape stable.
- **[Composite-rule order — documented]** Plan body enumerated "≥2 neutral critical → undetermined" before the ≥3 composite count; Plan 02 tests (Composite-1/2) require the composite count to take precedence. Implementation puts composite count first, neutral-critical as the fallback guard, which satisfies both the plan body intent ("≥2 neutral critical → undetermined is a fallback") and the tests.
- **[Validators dependency added — Rule 3]** `packages/classification/package.json` did not previously depend on `@contractor-ops/validators`; adding it was necessary to import the locked `CLASSIFICATION_SCHEIN_*` constants.
- **[Parallel-agent commit sweep]** This plan was executed in a session where parallel refactor agents were also committing on `v2`. Some of the plan's file edits landed in sweeping refactor commits (`69900fb6`, `c7bebca2`) rather than dedicated plan commits. The initial `feat(58-02): implement IR35 …` commit (`41752b9c`) captured the IR35 source files; subsequent edits (test files, schein source, barrel updates) were included in adjacent commits. Net effect: all files are on `v2`, HEAD contains the complete plan output, and `git log -- packages/classification/` shows a continuous chain from Plan 01 through Plan 02.

**Total deviations:** 5 auto-applied (4× Rule 3 Blocking / type reconciliation + 1 documentation note). **Impact:** No functional regression; Plan 01 tests still pass (registry 6/6, snapshot 5/5); both profiles now reachable from the registry.

## Open Items Flagged for Plan 05 Human-Verify Checkpoints

- **`REVIEW:DE` / `REVIEW:PL` markers** — every IR35 question's `prompt.pl` and `prompt.de` string carries a `// REVIEW:PL` or `// REVIEW:DE` comment above it. These are good-faith translations awaiting sign-off from:
  - UK tax-adviser (IR35 prompts) — to verify the `en` wording matches current CEST taxonomy post-PGMOL 2024 and that the `pl` translation preserves legal intent.
  - Steuerberater (DE prompts + Scheinselbständigkeit translations) — to verify the `de` Scheinselbständigkeit wording matches DRV Rundschreiben RS 2022/1 terminology AND that the entrepreneurial-independence negative phrasing ("Kein eigenes ...") reads naturally.
- **DRV-ECO-01 band cutoffs** — Plan 02 uses <50→0, 50-69→1, 70-83→2, ≥84→3. The exact boundary position inside the 0-3 scale is planner interpretation of `§ 2 Nr 9 SGB VI` 5/6-test; Steuerberater should confirm. Phase 60 will own the 70%/83.33% alert thresholds and should match this band.
- **IR35 question inventory (25 total)** — derived from public CEST taxonomy + post-PGMOL 2024 refinements; not cross-checked against HMRC's live CEST question set (HMRC may revise). UK tax-adviser to audit add/remove/rephrase.

## Issues Encountered

- **Parallel-agent race on `packages/classification/src/index.ts`**: multiple large refactor commits happened in the same wall-clock minute as this plan's edits; reran `pnpm --filter @contractor-ops/classification test` + `typecheck` + runtime smoke after each commit to confirm the merged state still green. No file-content loss.
- **Unrelated validators test failures (3×)**: `packages/validators/src/__tests__/invoice.test.ts` has 3 pre-existing failing tests (`invoiceCreateSchema — accepts valid input` / `defaults currency to PLN` / `requires currency to be exactly 3 characters`). These are **not** caused by Plan 58-02; confirmed pre-existing on `v2` before any of this plan's changes. Not a Phase-58 regression; flagged for a separate fix ticket.

## Next Phase Readiness

- Plan 58-03 (classification tRPC router + rate-limit middleware) is **unblocked**: `getProfileForCountry('GB' | 'DE')` returns a working profile with `buildAssessment` + `scoreAssessment` + `renderOutcome`. The router can wire `submit` straight into `profile.scoreAssessment(answers)` and use `buildQuestionsSnapshot(profile, ruleSet)` on completion.
- Plan 58-04 (wizard UI) is **unblocked** (pending Plan 58-03): the wizard shell imports `IR35_QUESTIONS` / `RULE_SET_VERSION` from `@contractor-ops/classification/profiles/ir35/rule-set` and `SCHEIN_QUESTIONS` / `CATEGORY_WEIGHTS` / `CATEGORY_TITLES` from `@contractor-ops/classification/profiles/scheinselbstandigkeit/rule-set` — all exported.
- Plan 58-05 (outcome page + disclaimer dialog) will read snapshot questions + scored outcome via the profile's `renderOutcome`.

Ready for **Plan 58-03**.
