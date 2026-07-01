---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 11
subsystem: web-vite
tags: [personnel-file, akta-osobowe, web-vite, classify-queue, rodo, erasure, criterion-3, locked-phrase, i18n, rtl]

# Dependency graph
requires:
  - phase: 91-08
    provides: personnelFile.pendingReviewQueue / classifyApprove / classifyReject router contract
  - phase: 91-09
    provides: personnelFile.requestErasure { workerId, fullErasureClaimed, sections[] } disposition contract
  - phase: 91-10
    provides: personnel-file 4-section shell + PersonnelFile i18n namespace + SectionJurisdiction/section labels
provides:
  - Admin classify-review queue (WorkbenchDataTable + row Approve/Reject) + approve/reject dialog reusing the upload-review Tabs+DialogBody/DialogFooter shell
  - RODO erasure flow (PersonnelErasureDialog) whose ErasureResultView branches STRICTLY on fullErasureClaimed — partial-erasure warning whenever false, full-erasure success only when true (criterion #3)
  - use-personnel-classify-queue + use-personnel-erasure hooks (sole tRPC boundaries)
  - erasure-disposition-badge (erased/retained status-token badge; retained rows use ShieldAlert, not the RBAC Lock)
  - PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_EN/DE/PL/AR locked-phrase constants + guard assertions
  - PersonnelFile.classifyReview + PersonnelFile.erasure i18n across en/de/pl/ar (real translations, ar RTL)
affects: [91-12 wiki synthesis, personnel-file admin classify-queue route + shell erasure mount (follow-up)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The erasure banner branches on the server's fullErasureClaimed flag, never on client-recomputed counts — the honest never-over-claim contract is decided server-side and rendered verbatim; counts feed only the partial-message text"
    - "Adviser-verify legal note renders a test-guarded locked-phrase constant (validators) selected by UI locale, not a freely-editable i18n string, so the wording cannot drift; retention.adviserVerifyNote i18n VALUE mirrors it, so only the reserved KEY is guarded (AE/SA idiom)"
    - "Personnel locked phrases live in a dedicated legal/personnel-file.ts (own RESERVED_/LOCKED_ sets, no signoff-registry entry) re-exported through the validators barrel — mirrors ae.ts/sa.ts, not the disclaimers.ts ToS machinery"
    - "Confidence badge reuses the shipped getConfidenceConfig threshold→colour/icon mapping but supplies a translated tooltip (no second hardcoded-English copy) for the locale-sensitive admin queue"

key-files:
  created:
    - apps/web-vite/src/components/employees/personnel-file/hooks/use-personnel-classify-queue.ts
    - apps/web-vite/src/components/employees/personnel-file/hooks/use-personnel-erasure.ts
    - apps/web-vite/src/components/employees/personnel-file/personnel-classify-queue/data-table.tsx
    - apps/web-vite/src/components/employees/personnel-file/personnel-classify-queue/personnel-classify-review-dialog.tsx
    - apps/web-vite/src/components/employees/personnel-file/personnel-erasure-dialog.tsx
    - apps/web-vite/src/components/employees/personnel-file/erasure-disposition-badge.tsx
    - apps/web-vite/src/components/employees/personnel-file/__tests__/personnel-erasure-view.test.tsx
    - packages/validators/src/legal/personnel-file.ts
  modified:
    - packages/validators/src/index.ts
    - packages/validators/src/__tests__/locked-phrases-guard.test.ts
    - apps/web-vite/messages/en.json
    - apps/web-vite/messages/de.json
    - apps/web-vite/messages/pl.json
    - apps/web-vite/messages/ar.json

key-decisions:
  - "Locked adviser-verify phrases placed in a NEW legal/personnel-file.ts (own RESERVED_PERSONNEL_FILE_LEGAL_KEYS + LOCKED_PERSONNEL_FILE_PHRASES) re-exported through index.ts, rather than defined inline in the barrel index.ts. index.ts is a pure barrel (0 direct const); this keeps the ae.ts/sa.ts idiom, makes index.ts contain the identifier (must_have), and deliberately avoids LOCKED_DISCLAIMERS's signoff-registry coupling (a seeded-data caveat is not a ToS legal-signoff artifact)."
  - "The erasure banner keys strictly on result.fullErasureClaimed (the server flag), not on counts — a single retained section makes it false and forces the partial warning. Locked to the criterion-#3 contract and asserted by a component test."
  - "The erasure foot-note renders the locked validators constant selected by useLocale() (en/de/pl/ar, en-US→en fallback), so it is identical per-locale to the shipped retention.adviserVerifyNote yet test-guarded against drift."
  - "classifyReview i18n shipped with Task 1 (so the classify components' keys resolve at that commit); erasure i18n with Task 2. Both commits stay buildable and i18n:parity-clean."

patterns-established:
  - "A per-domain locked-phrase module (legal/<domain>.ts) re-exported through the validators barrel + guarded in locked-phrases-guard.test.ts is the reusable idiom for legal-sensitive UI copy that must not drift but is not a legal-signoff artifact"
  - "Reuse WorkbenchDataTable + upload-review Tabs/DialogBody/DialogFooter shells for an admin approve/reject queue by swapping columns + the approve control; row-level actions only"

requirements-completed: [AKTA-03, AKTA-04]

# Metrics
duration: ~75min
completed: 2026-07-01
---

# Phase 91 Plan 11: Admin Classify Queue + RODO Erasure Flow Summary

**The staff-side admin classify-review queue (AKTA-04) and the RODO erasure flow (AKTA-03): a WorkbenchDataTable queue of PENDING_REVIEW personnel documents with an Approve(assign-section)/Reject dialog reusing the upload-review shell, plus a per-employee erasure dialog whose result view carries the phase's single most legally load-bearing pixel — a banner that branches STRICTLY on `fullErasureClaimed` and NEVER claims full erasure while any statutory hold is active (partial warning even at 1-of-4 retained), footed by a test-guarded locked-phrase adviser-verify note. Two sole-boundary hooks, an erased/retained badge, `PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_*` locked constants + guard assertions, and classify/erasure i18n across en/de/pl/ar.**

## Performance
- **Duration:** ~75 min (incl. fresh-worktree `pnpm install` + turbo dep builds)
- **Completed:** 2026-07-01
- **Tasks:** 2 auto tasks (2 atomic feat commits) + 1 AUTO-APPROVED human-verify checkpoint
- **Files:** 14 (8 created, 6 modified)

## Accomplishments
- **Classify-review queue (AKTA-04):** `use-personnel-classify-queue` is the sole tRPC boundary over `pendingReviewQueue` + `classifyApprove`/`classifyReject`, invalidating the personnel-file namespace on success so an approved document leaves the queue. `personnel-classify-queue/data-table.tsx` mirrors `ApprovalQueueTable` (WorkbenchDataTable) with columns Employee / Jurisdiction / Document / Uploaded / AI guess (section label + i18n-wrapped confidence badge or "—") / Actions, plus loading (built-in skeleton), empty ("Nothing pending review"), and a queue-level error with Retry. `personnel-classify-review-dialog.tsx` reuses the upload-review Tabs + DialogBody/DialogFooter shell: Approve tab = Select of the 4 jurisdiction-resolved section labels pre-set to the AI guess (`SECTION_A..D`), Reject tab = closed-enum reason + optional note; accent confirm for approve, destructive for reject.
- **RODO erasure flow (AKTA-03):** `use-personnel-erasure` wraps `requestErasure`. `PersonnelErasureDialog` is a page-level accent "Request erasure" + destructive AlertDialog confirm; `ErasureResultView` renders the per-section disposition list (erased = CheckCircle2/`--status-success`; retained = **ShieldAlert** (not the RBAC Lock) /`--status-warning` + citation + retainUntil) UNDER the criterion-#3 banner.
- **Criterion #3 (the load-bearing pixel):** the banner branches **strictly** on `result.fullErasureClaimed` — `true` renders the "All sections erased" success (`role="status"`); any `false` renders the partial-erasure warning (`role="alert"`, "{erased} of {total} sections erased — {retained} retained under statutory hold") **even when only one of four sections is retained**. A component test asserts both the 1-of-4-retained WARNING (no success) and the all-erased success paths.
- **Locked adviser-verify phrase:** `PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_EN/DE/PL/AR` added in `legal/personnel-file.ts` (own RESERVED/LOCKED sets), re-exported through the validators barrel, and asserted verbatim per-locale (+ formal-Sie + no-leak) in `locked-phrases-guard.test.ts`. The erasure foot-note renders the locked constant by UI locale, not an i18n key.
- **i18n:** `PersonnelFile.classifyReview` + `PersonnelFile.erasure` added to en/de/pl/ar with real translations (formal-Sie German, ar under the existing RTL + `--font-arabic` swap); logical Tailwind utilities only.

## Task Commits
Each task committed atomically (hooks on, no `--no-verify`):
1. **Task 1 — classify review queue (table + approve/reject dialog + hook) + classifyReview i18n** — `4fc3bd284` (feat)
2. **Task 2 — erasure dialog + disposition view + badge + hook + locked-phrase + guard test + criterion-#3 test + erasure i18n** — `724bffc0c` (feat)

**Plan metadata:** this SUMMARY committed separately at the real milestones path.

## Task 3 — human-verify checkpoint: AUTO-APPROVED (background mode)
No human is available to drive a live browser in background/autonomous mode, so the visual UAT checkpoint is resolved as AUTO-APPROVED: every automated gate is GREEN and the single load-bearing behavior (criterion #3) is machine-verified, not left to human eyes.
- Automated gates GREEN: `check:web-vite-data-layer`, `check:web-vite-dialog-pattern`, `i18n:parity`, `check:rtl-logical-props`, the `locked-phrases-guard` test (102/102, +8 new), the criterion-#3 banner component test (2/2), and web-vite typecheck (my files add ZERO new errors).
- **Deferred to a human post-merge item:** live-browser visual UAT — locked-section card states, RTL `ar` layout walkthrough, the upload-never-blocked flow, and eyeballing the erasure banner wording on a running server.

## Decisions Made
- **Locked phrases in a dedicated module, not the disclaimers ToS machinery.** `LOCKED_DISCLAIMERS` requires a signoff-registry entry per key and is asserted against exact registry counts; a seeded-data adviser-verify caveat is not a legal-signoff artifact. Mirroring `ae.ts`/`sa.ts`, `legal/personnel-file.ts` carries its own `RESERVED_/LOCKED_` sets with no registry coupling, re-exported through `index.ts` (which is a pure barrel, so the must_have "index.ts contains PERSONNEL_FILE_RETENTION_ADVISER_VERIFY" is met by the re-export).
- **Only the reserved KEY is guarded, not the VALUE.** The `retention.adviserVerifyNote` i18n VALUE legitimately equals the locked phrase (one disclaimer voice across the feature), so a value-absence check would false-positive; the guard asserts verbatim per-locale wording + reserved-key absence (the AE/SA pattern).
- **`classify.*` outcome badges (auto/pendingReview/manualRouted) intentionally NOT added.** Those are the Screen-2 upload-card badges rendered by a future upload/attach plan; no component here references them, so shipping them would be unused keys. `classifyReview.*` + `erasure.*` fully cover the surfaces built in this plan.

## Deviations from Plan

### Auto-fixed / regrouped (Rule 3)
**1. [Rule 3 - Idiom] Locked phrases in a new `legal/personnel-file.ts`, re-exported through `index.ts`.** The plan named `packages/validators/src/index.ts`, but that file is a pure barrel (0 direct `export const`). Defined the constants + `RESERVED_/LOCKED_` sets in a dedicated module (ae.ts/sa.ts idiom) and re-exported them through the barrel, satisfying the must_have `contains: PERSONNEL_FILE_RETENTION_ADVISER_VERIFY` on `index.ts` without inlining legal constants into the barrel or touching the signoff-registry. Files: `legal/personnel-file.ts` (new), `index.ts`. Commit `724bffc0c`.

**2. [Rule 3 - Buildable-commit regrouping] i18n split across the two commits.** The plan lists the message files under Task 2, but the Task-1 classify components need their `t()` keys to resolve at their own commit. Shipped `classifyReview` keys (4 locales) with Task 1 and `erasure` keys (4 locales) with Task 2; both commits stay buildable (web-vite typecheck) and i18n:parity-clean (mirrors 91-10's commit-grouping deviation).

**3. [Rule 3 - Contract fit] Static `entityLabel`.** `WorkbenchDataTable.entityLabel` is a generic plural noun ("caller owns plural rules"); called `t('entityLabel')` without count interpolation (the i18n system uses single-brace `{x}` interpolation, and the table chrome expects a plain noun).

**Total:** 3 Rule-3 deviations (idiom + commit-regrouping + contract-fit). No architectural (Rule 4) decisions, no auth gates.

## Deferred / Out of Scope
- **Route/shell mounting (follow-up).** The plan's file list scopes to components + hooks + i18n + validators (no page, route, or shell edit). `PersonnelClassifyQueuePanel` (org-wide admin surface) and `PersonnelErasureDialog` (Screen-3 entry) are delivered fully wired to their hooks (sole boundary) and render loading/empty/error, ready to mount: the classify queue needs its own admin route; the erasure dialog mounts in the personnel-file shell header. Consistent with 91-10 deferring the upload-CTA wiring. The criterion-#3 behavior is machine-verified independent of mounting.
- **Screen-2 upload flow.** `DropZone` + `attachDocument` wiring and the `classify.*` outcome badges are a separate upload/attach plan.
- **Pre-existing web-vite typecheck offender (NOT this plan):** `src/components/contractors/classification/classification-tile.tsx:55` (`TS2366`, missing ending return) — already logged in this phase's `deferred-items.md` (91-10). My 8 new files + validators changes add ZERO typecheck errors. Left untouched (SCOPE BOUNDARY).
- **Wiki synthesis:** batched into 91-12 (matches 89-06 / 91-03..10). No wiki `verify_with` references these new files, so `check:wiki-brain` is not tripped.

## Known Stubs
None that fake data. The delivered containers/dialogs are fully wired to the sole-boundary hooks and render loading/empty/error states; they await a route/shell mount (documented above), which is a wiring step, not a value-faking placeholder.

## Threat Flags
None — all new surface is within the plan's `<threat_model>` and mitigated:
- **T-91-11-01 (Repudiation — UI implying full erasure during a hold):** the banner branches strictly on `fullErasureClaimed`; the partial copy is the locked Copywriting-Contract phrasing; the criterion-#3 component test asserts the 1-of-4-retained WARNING (never a success); the adviser-verify note is a locked-phrase constant guarded per-locale.
- **T-91-11-02 (Information Disclosure / BFLA — queue exposing another org's docs):** the queue is driven by the org-scoped server `pendingReviewQueue`; the hook is the sole boundary and cannot fetch-all-then-filter.
- **T-91-11-03 (Tampering — adviser-verify wording drift per locale):** `PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_*` locked constants + `locked-phrases-guard.test.ts` verbatim assertions.

## Verification
- `pnpm --filter @contractor-ops/validators test locked-phrases-guard.test.ts` — GREEN 102/102 (8 new personnel-file assertions: mirror, non-empty, EN/DE/PL/AR verbatim, formal-Sie, per-locale key-absence).
- `pnpm --filter @contractor-ops/web-vite test src/components/employees/personnel-file` — GREEN 6/6 (4 section-card + 2 criterion-#3 banner: 1-of-4-retained WARNING never a success; all-erased success only when claimed).
- `pnpm i18n:parity` — OK (classifyReview + erasure keys covered in de/pl/ar).
- `pnpm check:web-vite-data-layer` — OK (both hooks are the only tRPC/React-Query boundaries).
- `pnpm check:web-vite-dialog-pattern` — OK (classify dialog uses DialogBody+DialogFooter; erasure confirm uses AlertDialog, exempt).
- `pnpm check:rtl-logical-props` — OK (logical `ms/me/ps/pe/start/end` + gap only; no physical utilities).
- `pnpm turbo typecheck --filter=@contractor-ops/web-vite` — my new files + the validators import add ZERO errors; only the pre-existing `classification-tile.tsx` offender remains (deferred).

## Next Phase Readiness
- **Route/shell mount:** register a `PersonnelClassifyQueuePanel` admin route (compliance area) and mount `PersonnelErasureDialog` in the personnel-file shell header (Screen-3 entry), plus a human live-browser UAT of the locked states + RTL.
- **91-12 wiki synthesis:** document the classify-review queue + erasure flow, the criterion-#3 fullErasureClaimed banner invariant, and the personnel-file locked-phrase constant, under `web-vite-domains.md` + the personnel-file domain page + `packages.md` (new validators export).

## Self-Check: PASSED
- All 8 created files present on disk (2 hooks + 4 components + 1 test + 1 validators module); 6 modified (validators index + guard test + 4 message files).
- Both task commits present (`4fc3bd284`, `724bffc0c`).
- Gates GREEN: locked-phrases-guard (102/102), criterion-#3 banner test (2/2), i18n:parity, check:web-vite-data-layer, check:web-vite-dialog-pattern, check:rtl-logical-props; web-vite typecheck adds zero new errors.
- No STATE.md / ROADMAP.md edits. SUMMARY at the real `.planning/milestones/v7.0-phases/…` path (the `.planning/phases` symlink is not used for the commit).

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
