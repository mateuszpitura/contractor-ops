---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 03
subsystem: classification
tags: [us-classification, ab5, section-530, irs-common-law, trpc, audit-log, i18n, prisma]

# Dependency graph
requires:
  - phase: 87-01
    provides: Wave-0 RED scaffolds for profiles/us (rule-set.test.ts, scoring.test.ts)
  - phase: 87-02
    provides: ContractorAssignment.workState column + US_DETERMINATION_LETTER document kind + regenerated Prisma client
provides:
  - Registered UsClassificationProfile resolvable via getProfileForCountry('US')
  - Pure scoreUsClassification (federal IRS common-law base + dispositive CA-ABC overlay + §530 relief flag)
  - UsClassificationOutcome added to the Outcome type union + Zod discriminated-union branch
  - AB5 work-state trigger (engagement work-state primary, contractor US state fallback)
  - Reason-required, audit-logged classification.override tRPC mutation
affects: [87-04, 87-05, us-determination-letter, classification-ui, us-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry-plugin profile: side-effect registerProfile(new UsClassificationProfile()) on import; no registry.ts edit"
    - "Reserved answer-map context key (US_WORK_STATE) carries server-resolved work-state into the fixed single-arg scoreAssessment(answers)"
    - "Audit-log-as-override-ledger: override records human decision + reason into append-only AuditLog; scored outcome stays server-derived"
    - "Advisory posture: verdict framed as decision-support with adviser-verify annotations, never a legal determination"

key-files:
  created:
    - packages/classification/src/profiles/us/rule-set.ts
    - packages/classification/src/profiles/us/scoring.ts
    - packages/classification/src/profiles/us/index.ts
    - packages/classification/src/profiles/us/__tests__/index.test.ts
    - packages/api/src/routers/compliance/classification-override.ts
    - packages/api/src/__tests__/classification-override.test.ts
  modified:
    - packages/classification/src/types/outcome.ts
    - packages/classification/src/types/rule-set.ts
    - packages/classification/src/schemas/assessment.ts
    - packages/classification/src/index.ts
    - packages/api/src/routers/compliance/classification.ts
    - packages/api/src/services/classification-document-keys.ts
    - packages/api/src/errors.ts
    - apps/web-vite/messages/en.json, de.json, pl.json, ar.json

key-decisions:
  - "Verdict values follow the executable RED scaffold contract (employee | independent-contractor | indeterminate), not the plan prose (likely-employee)"
  - "US rule-set prompts use the package's established en/pl/de LocalisedText shape (matching ir35/schein) rather than adding a US-only ar field; app-facing ar parity is handled in the web-vite message catalog"
  - "Override persists only into the append-only AuditLog (no new schema column) — avoids an architectural change while fully satisfying the reason-required + audited mitigation"
  - "workState reaches the fixed single-arg scoreAssessment via a reserved US_WORK_STATE answer key injected server-side"

patterns-established:
  - "US profile registry plugin mirrors IR35/Schein side-effect registration"
  - "AB5 dispositive overlay: CA work-state defaults to employee unless all three ABC prongs pass"
  - "§530 as a relief-eligibility flag, never a verdict change"

requirements-completed: [US-CLASS-01, US-CLASS-02]

# Metrics
duration: 40min
completed: 2026-07-01
---

# Phase 87 Plan 03: US Worker-Classification Profile + AB5 Trigger + Audited Override Summary

**Registered US ClassificationProfile scoring the federal IRS common-law three-category base with a dispositive California AB5 ABC overlay and a §530 safe-harbor relief flag, wired to a reason-required, audit-logged override — advisory decision-support, never a legal verdict.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-01T11:24:58+02:00
- **Completed:** 2026-07-01T12:01+02:00
- **Tasks:** 2 (both `auto`; Task 1 `tdd`)
- **Files modified/created:** 20 (excluding the reconstructed dependency base)

## Accomplishments
- Authored the US rule set (15 questions: 3 behavioral / 3 financial / 3 relationship federal factors + 3 AB5 ABC prongs + 3 §530 conditions) with IRS common-law / CA Labor Code §2775-2785 / §530 citations, en/pl/de prompts + REVIEW tokens, and adviser-verify annotations on every item.
- Implemented pure `scoreUsClassification`: federal common-law composite → dispositive CA-ABC overlay when work-state=CA → §530 relief flag; reasoning cites the triggering rule verbatim; explicitly not the DOL 2024 economic-reality rule.
- Registered `UsClassificationProfile` (getProfileForCountry('US') auto-resolves) and extended the `Outcome` type union + `outcomeSchema` Zod discriminated union with the US branch.
- Wired the AB5 work-state trigger: engagement work-state primary, contractor US state (`countryFields.state`) fallback, injected into scoring via a reserved answer-map key.
- Added the reason-required, audit-logged `classification.override` mutation gated behind `classificationProcedure` + `assertUsExpansionEnabled`, writing `writeAuditLog({ action: 'classification.override' })`.
- Turned the Wave-0 `profiles/us` RED scaffolds GREEN.

## Task Commits

1. **Dependency base reconstruction** - `5f4fa08` (chore) — cherry-picked 87-01 US scaffolds + 87-02 Prisma surface into the stale wave-3 worktree base
2. **Task 1: US rule set + pure scoring + outcome union** - `b555986` (feat, TDD GREEN)
3. **Task 2: register US profile + AB5 trigger + audited override** - `f7dcd52` (feat)
4. **Scaffold breadcrumb cleanup** - `d6d797e` (chore) — dropped a decision-ID comment flagged by lint:no-breadcrumbs

## Files Created/Modified
- `packages/classification/src/profiles/us/rule-set.ts` - RULE_SET_VERSION `US-2026-COMMONLAW-AB5`, 15-question inventory, citations, YES_DIRECTION map, reserved work-state key
- `packages/classification/src/profiles/us/scoring.ts` - pure `scoreUsClassification(answers, { workState })`
- `packages/classification/src/profiles/us/index.ts` - `UsClassificationProfile` + `resolveUsWorkState` / `withUsWorkState` + side-effect registration
- `packages/classification/src/types/outcome.ts` - `UsClassificationOutcome`, `UsClassificationVerdict`, `UsQuestionCategory`, `UsFederalFactorResult`; widened `Outcome` union + `OutcomeView.verdict`
- `packages/classification/src/types/rule-set.ts` - widened `RuleSetQuestion.category` for US categories + added `citation` / `adviserVerify` fields
- `packages/classification/src/schemas/assessment.ts` - `usClassificationOutcomeSchema` branch in the Zod discriminated union
- `packages/classification/src/index.ts` - side-effect import + US rule-set/type re-exports
- `packages/api/src/routers/compliance/classification-override.ts` - the override mutation
- `packages/api/src/routers/compliance/classification.ts` - merged the override router into the classification namespace
- `packages/api/src/services/classification-document-keys.ts` - mapped US_DETERMINATION_LETTER (Rule 3, see below)
- `packages/api/src/errors.ts` + `apps/web-vite/messages/{en,de,pl,ar}.json` - two override error keys with 4-locale parity

## Decisions Made
- **Verdict naming follows the RED scaffold contract** (`employee | independent-contractor | indeterminate`) — the executable test is the binding contract over the plan's `likely-employee` prose.
- **Rule-set prompts stay en/pl/de** matching the package's `LocalisedText` shape (ir35/schein) rather than adding a US-only `ar` field; app-facing Arabic parity lives in the web-vite message catalog.
- **Override ledger = AuditLog** — no new schema column (which would be a Rule 4 architectural change); the append-only audit row is the override record while the scored outcome stays server-derived.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reconstructed the 87-01/87-02 dependency base**
- **Found during:** Setup (before Task 1)
- **Issue:** The wave-3 worktree was branched from a stale `main` that did not contain the merged 87-01 RED scaffolds or the 87-02 Prisma surface (workState column, US_DETERMINATION_LETTER kind, regenerated client). The plan's stated preconditions ("scaffolds and Prisma client already on this branch's base") were not met — the orchestrator did not merge dependency branches into the base.
- **Fix:** Cherry-picked the two dependency commits (`3b4136708` 87-01, `05d20804f` 87-02); dropped the out-of-scope 1042-S/1099-K/determination-letter RED scaffolds belonging to other wave plans.
- **Verification:** workState + US_DETERMINATION_LETTER present in schema; scaffolds import-resolve.
- **Committed in:** `5f4fa08`

**2. [Rule 3 - Blocking] Widened shared classification types for the US profile**
- **Found during:** Task 1
- **Issue:** `RuleSetQuestion.category` was typed `ScheinCategory`; US categories + the scaffold's `q.citation`/`q.adviserVerify` reads did not fit. `outcomeSchema` (Zod) is a discriminated union with an explicit "add a branch per profile" gate.
- **Fix:** Widened `RuleSetQuestion.category` to `ScheinCategory | UsQuestionCategory`, added optional `citation`/`adviserVerify`, and added the US Zod branch. Verified no exhaustive-switch consumer breaks (all `outcome.kind` consumers use `!==` guards; schein uses category comparisons only).
- **Files modified:** types/rule-set.ts, types/outcome.ts, schemas/assessment.ts
- **Verification:** classification typecheck + 314 tests green.
- **Committed in:** `b555986`

**3. [Rule 3 - Blocking] Mapped US_DETERMINATION_LETTER in classification-document-keys.ts**
- **Found during:** Task 2 (api typecheck)
- **Issue:** The integrated 87-02 Prisma enum now includes `US_DETERMINATION_LETTER`; the untouched `Record<ClassificationDocumentKind, string>` was non-exhaustive → api typecheck failure (blocking the plan's acceptance criterion).
- **Fix:** Added the `US_DETERMINATION_LETTER: 'us-determination-letter'` path segment. (The determination-letter document surface itself belongs to a later wave plan; only the exhaustive-map entry was added here.)
- **Verification:** `pnpm typecheck --filter=@contractor-ops/api` green.
- **Committed in:** `f7dcd52`

**4. [Rule 2 - Missing Critical] i18n error constants for override messages**
- **Found during:** Task 2
- **Issue:** The `goals/i18n-system-messages` lint rule forbids hardcoded TRPCError messages.
- **Fix:** Added `CLASSIFICATION_OVERRIDE_REASON_REQUIRED` / `CLASSIFICATION_OVERRIDE_US_ONLY` constants + en/de/pl/ar translations; the unreachable outcome-kind guard uses a plain invariant `Error`.
- **Committed in:** `f7dcd52`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing-critical). **Impact:** All necessary for a compiling, gated, audited, standards-compliant result. No product-scope creep beyond the plan's US-CLASS-01/02 objective.

## Issues Encountered
- **Stale worktree base** (see Deviation 1) — the primary friction; resolved by surgical cherry-pick of the two dependency commits rather than merging the far-ahead main (which carries unrelated in-flight phases).
- **`@contractor-ops/classification` consumed as built dist** — the api test initially failed (`resolveUsWorkState is not a function`) against the stale dist; resolved by `pnpm --filter @contractor-ops/classification build` (dist is gitignored, rebuilt by turbo in CI).
- **Build-artifact churn** — validators `tsc` builds (triggered by api typecheck) reformatted the tracked compiled outputs `packages/validators/src/legal/de.{js,d.ts}`. Left uncommitted and never staged; the merge-back uses commits, not working-tree state, so no pollution.

## Verification
- `pnpm --filter @contractor-ops/classification test` — 17 files / 314 tests green (incl. the two US scaffolds turned GREEN + the new profile test).
- API classification test files (override + supersession + recompute + document + dashboard + flag-coverage) — 63 tests green; new `classification-override.test.ts` — 5/5.
- `pnpm typecheck --filter=@contractor-ops/classification` + `--filter=@contractor-ops/api` — green.
- `pnpm lint:no-breadcrumbs` — clean.

## User Setup Required
None - no external service configuration required. The override surface is gated behind existing flags (`module.classification-engine`, `module.us-expansion`).

## Next Phase Readiness
- US profile + Outcome union + document-kind mapping are ready for the US determination-letter PDF surface (later wave plans) and US classification UI.
- Wiki synthesis (domain page + api-routers-catalog for `classification.override`) is deferred to the phase's dedicated wiki-synthesis plan per the GSD flow.
- Advisory posture (D-05) is preserved end-to-end: verdicts are decision-support with adviser-verify annotations, never a legal determination.

## Self-Check: PASSED

All 6 created source files and the SUMMARY exist on disk; all 5 commits (`5f4fa08`, `b555986`, `f7dcd52`, `d6d797e`, `d2b8d26`) are present in the branch history.

---
*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Completed: 2026-07-01*
