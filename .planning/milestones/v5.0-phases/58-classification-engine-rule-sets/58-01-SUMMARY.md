---
phase: 58
plan: 01
type: summary
status: complete
completed_at: 2026-04-13
---

# Plan 58-01 Summary — Classification Wave-0 Skeleton

## What was built

### Task 1 — packages/classification workspace

Created the `@contractor-ops/classification` workspace mirroring
`packages/einvoice`:

- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/index.ts` (public barrel)
- `src/registry.ts` — `Map<string, ClassificationProfile>` with
  `registerProfile` / `getProfile` / `getProfileForCountry` / `listProfiles` /
  `clearProfiles`. Throws on duplicate registration and on unknown country
  with message containing `"No classification profile for country:"`.
- `src/types/profile.ts` — `ClassificationProfile` interface (D-02):
  `profileId`, `country`, `displayName`, `ruleSetVersion`,
  `buildAssessment`, `scoreAssessment`, `renderOutcome`.
- `src/types/assessment.ts` — `Assessment`, `AssessmentShell`, `AnswerMap`,
  `AnswerValue`, `QuestionsSnapshot`, `AssessmentStatus` (D-03, D-04).
- `src/types/outcome.ts` — discriminated union on `kind`:
  `Ir35Outcome` (5 areas × 5-level verdict) + `ScheinselbstandigkeitOutcome`
  (4 categories × traffic light, weighted sum) (D-03, D-13, D-14).
- `src/types/rule-set.ts` — `RuleSetQuestion`, `RuleSet`, `AnswerType`,
  `LocalisedText` (D-06).
- `src/schemas/assessment.ts` — Zod `outcomeSchema` as
  `z.discriminatedUnion('kind', [ir35OutcomeSchema, scheinOutcomeSchema])`
  plus per-component schemas.
- `src/schemas/answers.ts` — per-answer-type Zod schemas
  (`yes-no`, `likert-5`, `score-0-3`, `billing-ratio`, `rationale`) plus
  `getAnswerSchemaForType` lookup.
- `src/snapshot.ts` — `buildQuestionsSnapshot(profile, ruleSet)` using
  `structuredClone` + deep `Object.freeze` (D-08).

**7 Wave-0 test scaffolds** (matches VALIDATION.md):

- `src/__tests__/registry.test.ts` — 6 executing tests (unknown country,
  idempotent clear/register, duplicate rejection, ID + country lookup,
  extensibility proof).
- `src/__tests__/snapshot.test.ts` — 3 executing tests (`Object.isFrozen`,
  source-mutation isolation, field preservation).
- `src/profiles/ir35/__tests__/scoring.test.ts` — 2 `describe.todo`.
- `src/profiles/ir35/__tests__/rule-set.test.ts` — 2 `describe.todo`.
- `src/profiles/scheinselbstandigkeit/__tests__/scoring.test.ts` — 4
  `describe.todo` covering CATEGORY_WEIGHTS, thresholds, Nicht anwendbar,
  economic-dependency billing-ratio.
- `src/profiles/scheinselbstandigkeit/__tests__/rule-set.test.ts` — 1
  `describe.todo` for drvReference coverage.

Also registered `classification` in `vitest.monorepo.ts` (groupOrder 10).

**Verification:** `pnpm --filter @contractor-ops/classification typecheck &&
pnpm --filter @contractor-ops/classification test` both exit 0.
**Test report:** 9 passed, 4 test files skipped (todos are the Plan-02
scaffolds).

### Task 2 — Prisma ClassificationAssessment model

- New `packages/db/prisma/schema/classification.prisma` with
  `ClassificationAssessmentStatus` enum (`draft`, `completed`) and
  `ClassificationAssessment` model carrying D-04 columns:
  `id`, `organizationId`, `contractorAssignmentId`, `countryCode`,
  `ruleSetVersion`, `status`, `questionsSnapshot`, `answers`, `outcome`,
  `completedAt`, `disclaimerAcknowledgedAt`, `immutableAfter`, `createdAt`,
  `updatedAt`.
- Three indexes (explicit `map` names to avoid the 63-character Postgres
  identifier truncation collision): `organizationId`, composite
  `CA_org_assign_status_idx`, composite
  `CA_org_assign_completedAt_idx`.
- Back-relations on `ContractorAssignment` (`classificationAssessments
  ClassificationAssessment[]`) and `Organization` (same).
- **No** `@@unique([contractorAssignmentId, status])` per D-04 — Prisma 7
  lacks partial-unique; single-draft enforcement moves to the Plan 03
  createDraft handler.
- `pnpm --filter @contractor-ops/db prisma format` + `prisma validate` pass.
- `pnpm --filter @contractor-ops/db prisma generate` regenerated the
  client (Prisma 7.7.0).
- `pnpm --filter @contractor-ops/db db:push` synced the schema to the
  local Neon EU Postgres (`ep-spring-meadow-al06qnru-pooler`). No data
  conflicts.

### Task 3 — Locked phrases + disclaimers + CI guard

- Appended 9 CLASSIFICATION_SCHEIN_* constants to
  `packages/validators/src/legal/de.ts` and merged them into
  `RESERVED_LEGAL_KEYS` / `LOCKED_DE_PHRASES` (D-07).
- New `packages/validators/src/legal/disclaimers.ts` with
  `DISCLAIMER_IR35_BODY` (ITEPA 2003 reference), `DISCLAIMER_IR35_ACKNOWLEDGEMENT`,
  `DISCLAIMER_SCHEIN_BODY` (§ 7a SGB IV reference),
  `DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT`, plus `RESERVED_DISCLAIMER_KEYS` and
  `LOCKED_DISCLAIMERS` (D-12).
- Re-exported both modules from `packages/validators/src/index.ts`.
- Extended `packages/validators/src/__tests__/locked-phrases-guard.test.ts`
  with two new describe blocks:
  - **CLASSIFICATION_\*** — key-presence + verbatim-value guards across
    en/pl/de/ar, plus `RESERVED_LEGAL_KEYS` coverage check.
  - **DISCLAIMER_\*** — key-presence guard plus mirror + non-empty +
    Unicode-preservation checks (§ 7a SGB IV, ITEPA 2003).
- Updated the existing "privacy-notices/de.ts content contains every
  locked phrase" test to exclude classification-scoped keys (they live in
  the classification package's rule sets, not in privacy notices).

**Verification:** `pnpm --filter @contractor-ops/validators exec vitest
run src/__tests__/locked-phrases-guard.test.ts` — 32 tests pass, 0 fail.

## Key files created

- `packages/classification/**` (19 files, 9 source + 7 tests + 3 config)
- `packages/db/prisma/schema/classification.prisma`
- `packages/validators/src/legal/disclaimers.ts`

## Key files modified

- `vitest.monorepo.ts` — classification project registration.
- `packages/db/prisma/schema/contractor.prisma` — back-relation on
  `ContractorAssignment`.
- `packages/db/prisma/schema/organization.prisma` — back-relation on
  `Organization`.
- `packages/validators/src/legal/de.ts` — 9 new CLASSIFICATION_* phrases.
- `packages/validators/src/index.ts` — re-exports.
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` —
  Phase 58 describes + privacy-notice exclusion update.

## Commits

1. `feat(classification): scaffold packages/classification workspace [58-01]` (task 1)
2. `feat(db): add ClassificationAssessment model + back-relations [58-01]` (task 2)
3. `feat(validators): lock classification phrases + bilingual disclaimers [58-01]` (task 3)

## Notes for downstream plans

- **Plan 02 (IR35 + DRV rule sets):** the `describe.todo` scaffolds in
  `src/profiles/{ir35,scheinselbstandigkeit}/__tests__/` are your TDD
  starting points. The DE rule set MUST import category titles from
  `packages/validators/src/legal/de.ts` (CLASSIFICATION_SCHEIN_*) so the
  CI guard catches any hard-coded regression.
- **Plan 03 (tRPC router):** enforce single-draft-per-engagement in the
  `createDraft` handler (findFirst status='draft' → return existing).
  Do NOT add `@@unique([contractorAssignmentId, status])` to the Prisma
  schema — it would block the append-only completed-history per D-04.
- **Plan 04 / 05 (wizard + outcome pages):** the disclaimer constants
  are in `@contractor-ops/validators` — import them directly; never
  pass them through next-intl (the CI guard will fail the build).

## Environment

- **pnpm install** ran with pre-existing build failures in
  `@contractor-ops/integrations` (docusign / claude-ocr adapter tests —
  not touched by this phase). The classification package installed and
  built cleanly in isolation.
- **Concurrent Phase 57 agent** made unrelated modifications to shared
  files during this run (messages/*.json, many apps/web/**). Those are
  outside Plan 58-01's scope and were not staged into these commits.

## Self-Check: PASSED

All acceptance criteria for the three plan 58-01 tasks were verified:

- classification typecheck + test green (9 passing, 4 todo-scaffolds).
- Prisma schema valid + generated client contains `ClassificationAssessment`
  + db:push synced against Neon EU.
- locked-phrases-guard green (32/32) with Phase 58 coverage.
