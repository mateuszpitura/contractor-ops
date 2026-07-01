---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 05
subsystem: api
tags: [classification, react-pdf, us-tax, determination-letter, audit, exports, ab5, section530]

# Dependency graph
requires:
  - phase: 87-01
    provides: us-determination-letter RED scaffold + US_DETERMINATION_LETTER key segment
  - phase: 87-02
    provides: US_DETERMINATION_LETTER ClassificationDocumentKind (Prisma) + key builder
  - phase: 87-03
    provides: UsClassificationOutcome shape (verdict/federalFactors/ab5Flag/section530ReliefEligible)
provides:
  - Deterministic no-LLM US Classification Determination Letter react-pdf template
  - renderDeterminationLetterPdfBuffer — append-only archive + frozen ruleSetVersion + audit
  - classificationDocument.generateUsDeterminationLetter (staff-only, us-expansion gated)
  - classification-document-us-determination-letter async export type + dispatch handler
affects: [us-classification, determination-letter-ui, classification-document-router]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic react-pdf byte stability via pinned Document creation/modification dates (trailer /ID)"
    - "Render-from-frozen-snapshot: ruleSetVersion copied from the assessment, never recomputed"
    - "Async export type + exhaustive dispatch handler mirrors the SDS/DRV render path"

key-files:
  created:
    - packages/api/src/pdf-templates/us-determination-letter.tsx
    - packages/api/src/services/__tests__/classification-document-render.test.ts
  modified:
    - packages/api/src/services/classification-document-render.ts
    - packages/api/src/routers/compliance/classification-document.tsx
    - packages/api/src/services/exports/registry.ts
    - packages/api/src/services/exports/index.ts
    - packages/api/src/errors.ts
    - packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx

key-decisions:
  - "Audit-log inside renderDeterminationLetterPdfBuffer (where the append-only row is created), so one render-service test proves append-only + frozen ruleSetVersion + audit together"
  - "No server-side approval row for the US letter (unlike SDS) — the typed-name gate stays UI-side (Plan 08); the server records generatedByUserId + the audit event"
  - "Byte stability achieved by pinning Document creationDate/modificationDate to renderedAt so the PDF trailer /ID is deterministic"

patterns-established:
  - "AB5 chip is always amber (warning), §530 chip always info-blue; only a likely-employee verdict is destructive-toned"
  - "Federal factors read from outcome.federalFactors (guarded); citations from the questionsSnapshot + a static statute block"

requirements-completed: [US-CLASS-04]

# Metrics
duration: 22min
completed: 2026-07-01
---

# Phase 87 Plan 05: Classification Determination Letter Summary

**Deterministic no-LLM react-pdf Determination Letter (verdict + federal factors + AB5/§530 flags + citations + locked advisory footer) archived append-only as a US_DETERMINATION_LETTER ClassificationDocument with a frozen ruleSetVersion and audit-logged generation, wired through a staff-only us-expansion-gated document-router procedure.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-01T11:14:00Z
- **Completed:** 2026-07-01T11:36:00Z
- **Tasks:** 2
- **Files modified:** 11 (2 created, 6 modified, 3 wiki)

## Accomplishments
- `us-determination-letter.tsx` renders deterministically from the frozen assessment snapshot with NO LLM/network path; the Plan 01 RED scaffold is GREEN (7/7), including byte stability.
- `renderDeterminationLetterPdfBuffer` archives an append-only `US_DETERMINATION_LETTER` row with `ruleSetVersion` frozen from the assessment and writes `writeAuditLog({action:'classification.determinationLetter.generate'})`.
- New `classification-document-us-determination-letter` async export type + exhaustive dispatch handler, plus a staff-only `generateUsDeterminationLetter` mutation gated behind `classificationProcedure` + `assertUsExpansionEnabled`.
- Render-service test suite (6/6) proves append-only, frozen ruleSetVersion, determination-letter audit action, actor typing, and the completed/US-outcome guards.

## Task Commits

1. **Task 1: us-determination-letter.tsx template (deterministic, no LLM)** — `c13f5f0f2` (feat, TDD GREEN)
2. **Task 2: renderDeterminationLetterPdfBuffer + document-router wiring** — `f9d9cc241` (feat)

**Wiki (docs-follow-code):** `e28fce01c` (docs)

## Files Created/Modified
- `packages/api/src/pdf-templates/us-determination-letter.tsx` — deterministic Determination-Letter template (verdict pill, federal factors, AB5 amber + §530 info chips, statute citations, locked footer)
- `packages/api/src/services/classification-document-render.ts` — `renderDeterminationLetterPdfBuffer` (render → append-only archive → audit)
- `packages/api/src/routers/compliance/classification-document.tsx` — `generateUsDeterminationLetter` mutation + `KIND_DOWNLOAD_LABEL` map for the download filename
- `packages/api/src/services/exports/registry.ts` — `classification-document-us-determination-letter` export definition
- `packages/api/src/services/exports/index.ts` — dispatch case + `handleUsDeterminationLetter`
- `packages/api/src/errors.ts` — `CLASSIFICATION_DETERMINATION_LETTER_US_ONLY`
- `packages/api/src/services/__tests__/classification-document-render.test.ts` — render/archive/audit lifecycle tests
- `packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx` — dropped stale `D-01/D-05` breadcrumb (comment-only)
- wiki: `structure/api-routers-catalog.md`, `domains/classification-ir35.md`, `wiki/log.md`

## Decisions Made
- Audit lives in the render service (the archival event), so the plan's "append-only + frozen ruleSetVersion + audit" acceptance is proven by one render-service test.
- No SDS-style server approval row for the US letter — the typed-name acknowledgement is UI-side (Plan 08); the server records `generatedByUserId` + audit.
- Byte stability solved by pinning `Document` `creationDate`/`modificationDate` to `renderedAt` (react-pdf derives the trailer `/ID` from those; the scaffold's plaintext metadata strip cannot reach the ID inside compressed streams).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Byte-stability failure on the RED scaffold**
- **Found during:** Task 1
- **Issue:** Two identical-prop renders differed after the scaffold's metadata strip — react-pdf derives the PDF trailer `/ID` from `CreationDate` (default `new Date()`), which the plaintext strip cannot reach inside compressed streams.
- **Fix:** Pinned `Document` `creationDate`/`modificationDate`/`producer`/`creator` to stable values (`renderedAt`) so the `/ID` is deterministic.
- **Files modified:** packages/api/src/pdf-templates/us-determination-letter.tsx
- **Verification:** `us-determination-letter` byte-stability test GREEN (7/7).
- **Committed in:** c13f5f0f2

**2. [Rule 3 - Blocking] Missing error constant for the US-only guard**
- **Found during:** Task 2
- **Issue:** The generate mutation needs a distinct precondition message for a non-US assessment.
- **Fix:** Added `CLASSIFICATION_DETERMINATION_LETTER_US_ONLY`.
- **Files modified:** packages/api/src/errors.ts, classification-document.tsx
- **Verification:** typecheck clean; guard exercised by the render-service test.
- **Committed in:** f9d9cc241

**3. [CLAUDE.md no-breadcrumbs] Stale decision-ID comment in the test scaffold**
- **Found during:** Task 2 (deferred-items flagged it as owned by this determination-letter plan)
- **Issue:** `us-determination-letter.test.tsx:5` carried a `D-01 / D-05` breadcrumb; `lint:no-breadcrumbs` flags it.
- **Fix:** Rewrote the comment to keep the WHY (deterministic no-LLM + locked advisory-footer contract), dropped the IDs.
- **Files modified:** packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx
- **Verification:** `node scripts/lint-no-migration-breadcrumbs.mjs` no longer flags this file.
- **Committed in:** f9d9cc241

---

**Total deviations:** 3 (1 bug, 1 blocking, 1 breadcrumb cleanup)
**Impact on plan:** All within scope; necessary to turn the scaffold GREEN and satisfy CLAUDE.md. No scope creep.

## Threat Model Coverage
- **T-87-05-01 (tamper):** renders from the frozen assessment snapshot; `ruleSetVersion` copied from the assessment (test asserts it differs from the outcome payload's stale version); append-only row.
- **T-87-05-02 (repudiation):** `writeAuditLog` with actor + tenant on generation (test asserts action/actor/tenant/resource).
- **T-87-05-03 (liability):** `SOFTWARE_NOT_LEGAL_ADVICE_EN` locked footer + adviser-verify note; AB5/§530 framed as flags; NO LLM verdict.
- **T-87-05-04 (elevation):** staff-only `classificationProcedure` + `assertUsExpansionEnabled`; US-outcome guard.

## Issues Encountered
- **Pre-existing typecheck failures (out of scope, logged to `deferred-items.md`):** 11 `@contractor-ops/api` errors in `classification-override.ts` (87-03) and `form-1099k-tracker.service.ts` (87-06) — merged-in sibling-plan files this plan never touched. 87-05's own files are all typecheck-clean.
- **Plan verify referenced a non-existent script `lint:audit-log`** — the api package has no such script; ran `biome check` on the touched files instead (clean).

## Next Phase Readiness
- Ready for Plan 08 (UI button + typed-name acknowledgement gate) — the staff generate procedure, download-URL label, and list surface already cover the new kind.
- Blocked-adjacent: 87-03 must export `resolveUsWorkState`/`withUsWorkState` and refresh the classification build so `classification-override.ts` typechecks; 87-06 must fix its notification-type union.

## Self-Check: PASSED

- Files: `us-determination-letter.tsx`, `classification-document-render.test.ts`, `87-05-SUMMARY.md` all present.
- Commits: `c13f5f0f2`, `f9d9cc241`, `e28fce01c` all in history.
- Tests: `us-determination-letter` 7/7, `classification-document-render` 6/6, `locked-phrases-guard` 91/91 GREEN; 87-05 files typecheck-clean.

---
*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Completed: 2026-07-01*
