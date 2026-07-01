---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 06
subsystem: personnel-file
tags: [personnel-file, akta-osobowe, classifier, killswitch, feature-flags, claude-vision, gdpr, pii]

# Dependency graph
requires:
  - phase: 91-01
    provides: personnel-classifier.test.ts RED scaffold (the 4 routing cases + injected seams)
  - phase: 91-02
    provides: PersonnelFileSection enum (SECTION_A..D) + PersonnelDocClassificationMethod
  - phase: 91-03
    provides: resolveSectionForDocumentType(jurisdiction, documentType) taxonomy resolver
provides:
  - killswitch.ai-personnel-classifier flag (default-on, killWhenUnknown, non-gated)
  - classifyPersonnelDocument — hybrid taxonomy -> kill-switch-gated AI -> admin (PENDING_REVIEW) router
  - PERSONNEL_CLASSIFY_MIN_CONFIDENCE / PERSONNEL_CLASSIFY_MIN_MARGIN thresholds (85 / 15)
  - defaultEvaluateKillSwitch — production kill-switch seam wiring evaluate('killswitch.ai-personnel-classifier')
  - PersonnelClassifierSeams / PersonnelClassificationResult typed contract for the 91-08 router
affects: [91-08, personnel-file-upload, admin-classify-step]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hybrid classifier: deterministic taxonomy short-circuit (no model) -> kill-switch gate -> injected Claude Vision seam -> confidence+margin threshold -> admin PENDING_REVIEW"
    - "Kill-switch idiom cloned from killswitch.ai-invoice-parser: default-on, killWhenUnknown forces OFF on an Unleash outage and degrades to the admin step, never blocks the persisted upload"
    - "AI + kill-switch as injected seams so routing is deterministic and PII-free in unit tests; the concrete model adapter + presign are the caller's (91-08) wiring"

key-files:
  created:
    - packages/api/src/services/personnel-classifier.ts
  modified:
    - packages/feature-flags/src/flags-core.ts

key-decisions:
  - "Built to the authoritative 91-01 RED scaffold's contract (jurisdiction + region passed in, BOTH seams injected, result shape { classificationMethod, section, status, uploadBlocked }) rather than the plan's proposed signature — mirrors the 91-03 precedent where the RED scaffold is authoritative over the plan's prose."
  - "'OTHER' is treated as no deterministic signal: the 91-03 registry maps 'OTHER' -> SECTION_D as a retention catch-all, but an uploader-declared 'Other' is the ambiguous tail the AI/admin exists to resolve, so the deterministic step skips it and falls through."
  - "The concrete Claude Vision section adapter + presign are injected by the caller (per the plan's 'inject the adapter as a seam'); this plan ships routing + the in-file kill-switch wire + typed seams and stays inside the 2-file must_haves artifact list (no new integrations file, no new dep)."

requirements-completed: [AKTA-04]

# Metrics
duration: ~35min
completed: 2026-07-01
---

# Phase 91 Plan 06: Personnel Document→Section Classifier Summary

**Hybrid document→section classifier for personnel-file uploads — deterministic taxonomy first (no model call), then a `killswitch.ai-personnel-classifier`-gated Claude-Vision fallback, then a below-threshold PENDING_REVIEW admin step — that never blocks the upload and fails safe to admin on an Unleash outage; turns the 91-01 `personnel-classifier.test.ts` scaffold GREEN (4/4).**

## Performance

- **Duration:** ~35 min (incl. fresh-worktree `pnpm install`)
- **Completed:** 2026-07-01
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Declared `killswitch.ai-personnel-classifier` in `flags-core.ts` with the exact `killswitch.ai-invoice-parser` shape: `default:true`, `category:'kill-switch'`, `jurisdiction:'ANY'`, `owner:'ops'`, `killWhenUnknown:true`. Non-gated (`killswitch.` is absent from `GATED_FLAG_NAMESPACE_PREFIXES`) so no signoff-registry entry is required; the `is-gated-flag` enumeration test stays green with the key non-gated.
- Built `classifyPersonnelDocument` (`packages/api/src/services/personnel-classifier.ts`): a pure routing service that resolves the section deterministically from `(jurisdiction, documentType)`, falls through to a kill-switch-gated AI seam on a taxonomy miss, and routes to the admin step below the auto-assign threshold.
- Exported the auto-assign thresholds `PERSONNEL_CLASSIFY_MIN_CONFIDENCE = 85` and `PERSONNEL_CLASSIFY_MIN_MARGIN = 15`; the AI guess is trusted only when top confidence ≥ 85 AND margin ≥ 15, else PENDING_REVIEW.
- Kill-switch is evaluated **before** any Claude call; off/unreachable returns `{ classificationMethod: 'PENDING', status: 'PENDING_REVIEW', uploadBlocked: false }` with no model call and no throw — the already-persisted upload is never blocked (Pitfall 5, T-91-06-02).
- Exposed `defaultEvaluateKillSwitch` (the in-file production wire around `evaluate('killswitch.ai-personnel-classifier', …)`) plus the `PersonnelClassifierSeams` / `PersonnelClassificationResult` typed contract for the 91-08 router to compose the real Claude adapter + presign.
- Single-org context throughout (`organizationId` + `storageKey` for this row only, no cross-tenant batching — T-91-06-01); structured logging via `@contractor-ops/logger`, no `console.*`, no document bytes/PII logged.

## Task Commits

Each task was committed atomically (hooks on, no `--no-verify`):

1. **Task 1: declare killswitch.ai-personnel-classifier** — `ca66d3bc2` (feat)
2. **Task 2: classifyPersonnelDocument service (taxonomy → AI → admin)** — `f6a408ca2` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `packages/feature-flags/src/flags-core.ts` — added the `killswitch.ai-personnel-classifier` declaration (10 lines) directly after the invoice-parser kill-switch.
- `packages/api/src/services/personnel-classifier.ts` — the hybrid classifier: `classifyPersonnelDocument`, `defaultEvaluateKillSwitch`, the `PERSONNEL_CLASSIFY_MIN_*` thresholds, and the `PersonnelClassifierSeams` / `PersonnelAiSectionGuess` / `PersonnelClassificationResult` type surface.

## Decisions Made
- **Contract follows the 91-01 RED scaffold, not the plan's prose.** The authoritative `personnel-classifier.test.ts` calls `classifyPersonnelDocument({ jurisdiction, documentType, storageKey, organizationId, region }, { evaluateKillSwitch, classifyWithClaude })` — it passes `jurisdiction` and `region` directly and injects **both** seams, and it asserts a result shape of `{ classificationMethod, section, status, uploadBlocked, aiSectionGuess?, aiConfidence? }`. The plan's proposed signature (internal `mapCountryCodeToJurisdiction` / `resolveOrgRegion` + a `{ method, section, … }` result) could not satisfy those imports, so — mirroring the 91-03 precedent — the service was built to the scaffold. `region` resolution and result persistence move to the caller (91-08).
- **`section` is the short `A`..`D` code.** The scaffold asserts `result.section ∈ ['A','B','C','D']` and the injected Claude seam returns bare letters, so the service maps the registry's `SECTION_A..D` id down to the short code via `toSectionCode` and returns bare letters for both the deterministic and AI paths.
- **The concrete Claude adapter is injected, not built here.** The plan's `<action>` says to "inject the adapter as a seam so the test mocks it" and lists exactly two artifacts (`flags-core.ts` + `personnel-classifier.ts`). This plan therefore ships the routing, the in-file kill-switch production wire (`defaultEvaluateKillSwitch`, which satisfies the `evaluate('killswitch.ai-personnel-classifier')` key-link), and the typed `classifyWithClaude` seam contract; the concrete Claude-Vision section adapter + R2 presign are the 91-08 router's wiring (mirroring how `ocr-extraction.ts` composes `extractInvoice` + `createPresignedDownloadUrl`). No new dependency and no third file were introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `'OTHER'` catch-all was auto-filing the ambiguous tail into SECTION_D**
- **Found during:** Task 2 (running the RED scaffold — 3/4 failing with `DETERMINISTIC` where `PENDING`/`AI` was expected).
- **Issue:** The 91-03 registry maps `documentType: 'OTHER'` → `SECTION_D` in every jurisdiction (a retention catch-all), so `resolveSectionForDocumentType('PL','OTHER')` returned a non-null section and the classifier auto-assigned it deterministically. The authoritative scaffold uses `'OTHER'` as its taxonomy-**miss** input (the ambiguous tail that must reach the AI/admin), so tests 2–4 saw `DETERMINISTIC` instead of `AI`/`PENDING`.
- **Fix:** The deterministic step treats the `'OTHER'` catch-all (named `UNCLASSIFIED_DOCUMENT_TYPE`) as no signal and falls through to the kill-switch/AI/admin path. This aligns with the plan's own intent ("the AI only resolves the ambiguous tail") and does not touch the 91-03 registry (out of scope; its retention catch-all is preserved).
- **Files modified:** `packages/api/src/services/personnel-classifier.ts`
- **Verification:** `personnel-classifier.test.ts` GREEN 4/4.
- **Committed in:** `f6a408ca2`

**Total deviations:** 1 auto-fixed (Rule 1). The signature/result-shape divergence from the plan's prose is a contract change dictated by the authoritative 91-01 RED scaffold (documented under Decisions), not scope creep.

## Deferred / Out of Scope
- **Pre-existing `@contractor-ops/api` typecheck cascade (NOT introduced here):** `pnpm --filter @contractor-ops/api typecheck` reports 121 errors across 57 files — including `src/services/ocr-extraction.ts`, which this plan never touched — all downstream of the unbuilt `@contractor-ops/classification` dist (its test files import missing `../rule-set.js` / `../scoring.js`). This is the documented `deferred-items.md` offender. **My new file (`personnel-classifier.ts`) contributes zero errors** — a full-package `tsc --noEmit` surfaces no error referencing it, and `lint:no-breadcrumbs` / `lint:logs` are both clean for my files.
- **Wiki synthesis:** the new `services/personnel-classifier.ts` is not referenced by any wiki page `verify_with`, so `check:wiki-brain` is not tripped. Phase 91 batches personnel-file wiki synthesis into plan 91-12 (mirrors 89-06 / 91-03 / 91-04); 91-12 should document this classifier under `key-services.md` + the personnel-file domain page.

## Known Stubs
None. The routing is complete; the `classifyWithClaude` seam is injected by design (documented for 91-08), not a stub.

## User Setup Required
None — no external service configuration. The `killswitch.ai-personnel-classifier` toggle is created in the Unleash UI when ops wants runtime control; until then it resolves to its `default: true` (classifier on) with `killWhenUnknown` forcing it off on an outage.

## Next Phase Readiness
- **91-08 (router wiring) ready:** compose `classifyPersonnelDocument(params, { evaluateKillSwitch: defaultEvaluateKillSwitch, classifyWithClaude: <real Claude section adapter over a presigned URL> })`, then persist `section` / `classificationMethod` / `aiSectionGuess` / `aiConfidence` and flip `Document.status` to `PENDING_REVIEW` on the PENDING branch. Resolve `region` from the org (`resolveOrgRegion` in `ocr-extraction.ts` is the reference) and `jurisdiction` via `mapCountryCodeToJurisdiction`.
- **Threat register:** T-91-06-01 (single-org context, no batching) and T-91-06-02 (killWhenUnknown → admin, never blocks) are satisfied in this service; T-91-06-03 (virus-scan/size gate before the model) is 91-08's upload-path wiring.

## Self-Check: PASSED

- `packages/feature-flags/src/flags-core.ts` — FOUND (killswitch.ai-personnel-classifier registered)
- `packages/api/src/services/personnel-classifier.ts` — FOUND
- Commit `ca66d3bc2` — FOUND
- Commit `f6a408ca2` — FOUND
- `personnel-classifier.test.ts` — GREEN (4/4); feature-flags suite GREEN (122/122); feature-flags typecheck clean

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
