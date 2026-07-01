---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 08
subsystem: ui
tags: [web-vite, us-classification, ab5, section530, determination-letter, 1099-k, i18n, tanstack-query, trpc]

# Dependency graph
requires:
  - phase: 87-03
    provides: US classification profile + outcome (US_CLASSIFICATION) + classification.override router
  - phase: 87-05
    provides: classificationDocument.generateUsDeterminationLetter + US_DETERMINATION_LETTER archive
  - phase: 87-06
    provides: form1099kTracker.getTrackerState read router + Form1099KTrackerState cron
provides:
  - Staff US worker-classification result surface (verdict + scored federal factors + AB5 amber flag + §530 info flag + citations)
  - Blocking advisory disclaimer gate + sticky advisory banner before the outcome
  - Reason-required, audit-logged classification override dialog
  - SDS-mirror Determination-Letter generate button + US_DETERMINATION_LETTER document-history row
  - Read-only informational 1099-K band (SAFE/APPROACHING/OVER) on the contractor profile
  - UsClassification + Form1099KTracker i18n namespaces at en/en-US/de/pl/ar parity
affects: [87-09, us-tax-forms, classification-ir35, portal-1042s]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wired 4-state section → sole use-* hook (tRPC boundary) → presentational, no *-container"
    - "Advisory-not-verdict UI: sticky banner + blocking disclaimer + amber AB5 (never destructive) + info §530"
    - "Informational-only band: read-only, amber at most, no filing/generate/fix affordance"
    - "Client-side approval gate (typed name + checkbox) unlocking an async enqueue mutation (SDS mirror)"

key-files:
  created:
    - apps/web-vite/src/components/contractors/classification/us-classification-result.tsx
    - apps/web-vite/src/components/contractors/classification/ab5-watchlist-flag.tsx
    - apps/web-vite/src/components/contractors/classification/classification-override-dialog.tsx
    - apps/web-vite/src/components/contractors/classification/hooks/use-us-classification.ts
    - apps/web-vite/src/components/contractors/classification-documents/generate-determination-letter-button.tsx
    - apps/web-vite/src/components/contractors/classification-documents/hooks/use-generate-determination-letter.ts
    - apps/web-vite/src/components/contractors/form-1099k-band.tsx
    - apps/web-vite/src/components/contractors/hooks/use-1099k-tracker.ts
    - apps/web-vite/src/components/contractors/classification/__tests__/us-classification-result.test.tsx
    - apps/web-vite/src/components/contractors/__tests__/form-1099k-band.test.tsx
  modified:
    - apps/web-vite/src/components/contractors/classification/classification-tile.tsx
    - apps/web-vite/src/components/contractors/classification-documents/document-history-list.tsx
    - apps/web-vite/src/components/contractors/classification-documents/classification-documents-panel.tsx
    - apps/web-vite/src/components/contractors/classification-documents/index.ts
    - apps/web-vite/messages/{en,en-US,de,pl,ar}.json
    - .planning/brain/wiki/domains/us-tax-forms.md
    - .planning/brain/wiki/log.md

key-decisions:
  - "Determination-letter approval gate is client-side only (typed name + checkbox) — there is no server approveDeterminationLetter mutation like SDS; the letter's audit is written server-side on generate"
  - "US blocking disclaimer reuses the country-agnostic classification.acknowledgeDisclaimer persisted mutation with US copy inline, instead of extending the GB/DE-coupled ClassificationDisclaimerDialog + locked constants"
  - "i18n keys added at apps/web-vite/messages/ (real path), not the plan's stale src/messages/ path"
  - "AB5 flag + 1099-K OVER band are amber warning, never destructive; the destructive tone is reserved for the likely-employee verdict pill only"

patterns-established:
  - "Advisory-not-verdict UI invariant enforced in-component (banner + disclaimer gate + amber flags + adviser-verify note)"
  - "Read-only informational band with no write path in the UI (cron writes state, UI surfaces it)"

requirements-completed: [US-CLASS-01, US-CLASS-02, US-CLASS-03, US-CLASS-04]

# Metrics
duration: 40min
completed: 2026-07-01
---

# Phase 87 Plan 08: US classification result + Determination Letter + 1099-K band UI Summary

**Staff US worker-classification result (verdict + scored federal factors + amber AB5 flag + info §530 flag + citations) behind a sticky advisory banner and blocking disclaimer, with a reason-required audit-logged override, an SDS-mirror Determination-Letter generate button, and a read-only informational 1099-K profile band — all strings i18n at en/en-US/de/pl/ar parity.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-01T14:07:00Z (approx)
- **Completed:** 2026-07-01T14:30:00Z
- **Tasks:** 3
- **Files modified/created:** 19 (10 created, 9 modified incl. 5 message files)

## Accomplishments

- Wired US classification result section (`us-classification-result.tsx`) with all four states (Skeleton `aria-busy`, empty + CTA, `role="alert"` error + Reload, loaded), the sticky `ClassificationAdvisoryBanner`, a blocking disclaimer gate that must be acknowledged before the outcome, the verdict pill (employee=destructive / indeterminate=warning / contractor=success), the scored federal-factor `dl` grid + `LegalReferenceCollapsible` citations, an `aria-live` verdict announcement, and the override trigger.
- `ab5-watchlist-flag.tsx` (amber `warning` badge + tooltip, never destructive) and an info-blue §530 chip beside the verdict.
- `classification-override-dialog.tsx` (DialogBody/DialogFooter, verdict select + required reason + acknowledgement) wired to the reason-required, audit-logged `classification.override` via `use-us-classification.ts` (sole tRPC boundary).
- `generate-determination-letter-button.tsx` (SDS-mirror approval gate → `classificationDocument.generateUsDeterminationLetter`) + `use-generate-determination-letter.ts`; `US_DETERMINATION_LETTER` row added to `document-history-list.tsx`; wired for `countryCode === 'US'` in `classification-documents-panel.tsx`.
- `form-1099k-band.tsx` read-only informational band (SAFE/APPROACHING/OVER, amber at most, mono figures vs threshold, no filing affordance) + `use-1099k-tracker.ts` read-only hook.
- `UsClassification` + `Form1099KTracker` i18n namespaces at en/de/pl/ar full parity + en-US thin American-spelling overrides; locked disclaimers kept in `@contractor-ops/validators`.

## Task Commits

1. **Task 3 (i18n foundation): UsClassification + Form1099KTracker parity** - `19db0d406` (feat)
2. **Task 1: US classification result + AB5 flag + override dialog + hook** - `3b79b35dc` (feat)
3. **Task 2: determination-letter button + 1099-K band + hooks** - `673e3168f` (feat)

_Commit order: i18n first so the Task 1/2 components + tests resolve real copy at each commit._

## Files Created/Modified

See frontmatter `key-files`. Highlights:
- `classification/us-classification-result.tsx` — wired 4-state section, disclaimer gate, verdict + flags + factors + override trigger.
- `classification/ab5-watchlist-flag.tsx` — amber advisory flag (grep: `warning` present, `destructive` absent).
- `classification/classification-override-dialog.tsx` — DialogBody/DialogFooter + required reason + acknowledgement.
- `classification/hooks/use-us-classification.ts` — sole boundary: `classification.getLatest` + `classification.override`.
- `classification-documents/generate-determination-letter-button.tsx` + `hooks/use-generate-determination-letter.ts` — SDS-mirror gate + enqueue.
- `form-1099k-band.tsx` + `hooks/use-1099k-tracker.ts` — read-only informational band (grep: `destructive` absent, no file/generate/fix CTA).
- `classification/classification-tile.tsx` — handle the merged `US_CLASSIFICATION` verdict in `toneForOutcome` (blocking typecheck fix).

## Decisions Made

- **Client-side letter approval gate:** unlike SDS (`classification.approveSds`), there is no server-side `approveDeterminationLetter` mutation, so the letter gate (typed client name + checkbox) is a UI unlock for the primary CTA; the letter's audit row is written server-side on `generateUsDeterminationLetter`.
- **US disclaimer reuse:** the blocking disclaimer reuses the country-agnostic persisted `classification.acknowledgeDisclaimer` mutation with `SOFTWARE_NOT_LEGAL_ADVICE_EN` + US i18n copy inline, rather than extending the GB/DE-coupled `ClassificationDisclaimerDialog` (which would require new locked constants + sign-off registry entries).
- **i18n path:** keys live at `apps/web-vite/messages/*.json` (the real path); the plan's `src/messages/*.json` list was stale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `classification-tile.tsx` toneForOutcome non-exhaustive for the merged US verdict**
- **Found during:** Task 1 (typecheck)
- **Issue:** The merged `US_CLASSIFICATION` outcome widened `OutcomeSchemaType`, so `toneForOutcome` (which only handled IR35 + DRV verdicts) lacked an ending return → `tsc` error. The UI-SPEC explicitly anticipates extending `classification-tile` for `kind: 'US_CLASSIFICATION'`.
- **Fix:** Added a `US_CLASSIFICATION` branch (independent-contractor=success, employee=destructive, indeterminate=warning). The tile is GB/DE-scoped in practice; this restores exhaustiveness/type-safety.
- **Files modified:** apps/web-vite/src/components/contractors/classification/classification-tile.tsx
- **Verification:** `pnpm typecheck --filter=@contractor-ops/web-vite` green; existing classification tests (53) still pass.
- **Committed in:** 3b79b35dc (Task 1 commit)

**2. [Rule 2 - Missing critical] Wired the Determination-Letter CTA into the documents panel for US**
- **Found during:** Task 2
- **Issue:** The new button would be orphaned (unreachable) — the documents panel only branched GB (SDS) / DE (DRV).
- **Fix:** Added an `isUs` branch rendering `GenerateDeterminationLetterButton` when `completedAssessmentId` exists (disabled placeholder otherwise), mirroring the GB/DE branches.
- **Files modified:** classification-documents-panel.tsx (+ index.ts barrel export)
- **Verification:** `check:web-vite-presentational` + panel tests green.
- **Committed in:** 673e3168f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical). **Impact:** both necessary for correctness/reachability; no scope creep.

## Issues Encountered

- Full unscoped `vitest run` (accidentally triggered once) is RAM-heavy and surfaced ~5 pre-existing, out-of-scope failing test files (e.g. `okta-provider-section`). Not this plan's scope — logged to `deferred-items.md`. Re-ran scoped via `node_modules/.bin/vitest run <paths>` (RAM-safe); the two new test files + the classification/documents/contractors dirs are all green.
- Biome flagged the `use1099kTracker` name (digit after `use` breaks the hook-name heuristic) → renamed to `useForm1099kTracker`; and one `noJsxPropsBind` inline handler → extracted to `useCallback`. The cognitive-complexity warning on the (now 3-country) documents panel is a non-blocking `warn` (both biome.json and biome.ci.json exit 0).

## Verification

- `pnpm typecheck --filter=@contractor-ops/web-vite` — green.
- `check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-dialog-pattern` / `check:web-vite-presentational` / `check:rtl-logical-props` — green.
- `pnpm i18n:parity` — OK (en covered in de/pl/ar; en-US fallback-aware). `lint:no-breadcrumbs` — OK. `check:wiki-brain` — 0 errors.
- Locked-phrases guard (`@contractor-ops/validators` — 1007 tests) — green; the new keys leak no reserved disclaimer constant.
- Scoped tests: `us-classification-result.test.tsx` + `form-1099k-band.test.tsx` — 14 passed.
- Grep invariants: `ab5-watchlist-flag.tsx` warning≥1 / destructive=0; `form-1099k-band.tsx` destructive=0, no file/generate/fix CTA.

## User Setup Required

None - no external service configuration required. (The surface is dark behind `module.us-expansion`, gated server-side; the 1042-S filing + portal UI is Plan 09.)

## Next Phase Readiness

- Plan 09 (1042-S batch/filing staff UI + portal recipient PDF) can proceed — it mirrors P86 components and the `Tax1042S*` i18n namespaces are intentionally deferred to 09.
- `ar` strings tagged for native review (deferred-items.md); does not block.

## Self-Check: PASSED

- All 8 new source files + the SUMMARY verified present on disk.
- Task commits `19db0d406`, `3b79b35dc`, `673e3168f` verified in git log.

---
*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Completed: 2026-07-01*
