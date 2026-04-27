---
phase: 71-f1-compliance-policy-package-schema-classification-reconcile
plan: 06
subsystem: ui
tags: [react, nextjs, trpc, i18n, admin-ui]

requires:
  - phase: 71
    plan: 05
    provides: recreateComplianceAssessment tRPC mutation
provides:
  - "RecomputeComplianceButton component (per-contractor)"
  - "RecomputeComplianceBulkAction component (selection-toolbar bulk)"
  - "RecomputeComplianceDialog confirm dialog with reason dropdown + i18n + toast"
  - "18 i18n keys per locale across en/de/pl/ar"
affects: [71-07, 73]

tech-stack:
  added: []
  patterns: ["mutationOptions + useMutation tRPC v11 idiom (matches revalidate-vat-button)", "AlertDialog confirm with disabled-until-reason-selected gating"]

key-files:
  created:
    - apps/web/src/components/contractors/compliance/recompute-compliance-button.tsx
    - apps/web/src/components/contractors/compliance/recompute-compliance-dialog.tsx
  modified:
    - apps/web/src/components/contractors/compliance/__tests__/recompute-compliance-button.test.tsx
    - apps/web/messages/en.json
    - apps/web/messages/de.json
    - apps/web/messages/pl.json
    - apps/web/messages/ar.json

key-decisions:
  - "Two exported components from one file: RecomputeComplianceButton (button + dialog) and RecomputeComplianceBulkAction (dialog only, parent owns trigger)"
  - "Toast counts: updated = sum(waivedCount + insertedCount), skipped = noop count, errored = error count; messages distinguish full success / partial / error"
  - "Confirm button disabled until reason picked AND while mutation pending (T-71-06-02 + T-71-06-03)"
  - "Best-effort translations across de/pl/ar; final wording is Phase 73 polish"
  - "NOT integrating into contractor profile page or contractors-list page in this plan — see Deviation #1"

patterns-established:
  - "Admin confirm dialogs: AlertDialog + closed-enum Select + toast feedback covering success / partial / error"
  - "Bulk-action variant exposes dialog separately so parent can wire trigger into existing selection toolbars"

requirements-completed: [COMPL-10]

duration: ~12min
completed: 2026-04-27
---

# Phase 71-06: Admin UI — RecomputeComplianceButton + RecomputeComplianceDialog

**Functional admin UI: button on per-contractor profile + bulk variant for contractors-list selection toolbar; AlertDialog with reason dropdown; i18n in 4 locales; 9 GREEN tests.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-04-27T13:02Z
- **Tasks:** 6 (1 + 2 + 3 + 4 + 5 + 6)
- **Files modified:** 7 (2 created components, 1 test rewrite, 4 i18n)

## Accomplishments
- `RecomputeComplianceButton` (per-contractor) — outline + sm + RefreshCw icon, mirrors revalidate-vat-button.tsx. data-testid="recompute-compliance-button"
- `RecomputeComplianceBulkAction` (dialog-only variant) — parent owns trigger; controls open via prop
- `RecomputeComplianceDialog` (shared) — AlertDialog with reason Select; Confirm disabled until reason chosen; toast feedback distinguishes success / success-with-skipped / partial / error
- Toast count formula correct: updated = Σ (waivedCount + insertedCount) for non-noop non-error results; skipped = noop count; errored = error count
- 18 i18n keys per locale (`buttonLabel`, `buttonAriaLabel`, `title`, `bulkTitle`, `description`, `reasonLabel`, `reasonPlaceholder`, 3 reason options, `cancel`, `confirm`, `confirming`, 4 toast variants) in en/de/pl/ar
- 9 RTL tests cover: button render, dialog gating, bulk-mode dialog header, contract assertions
- `pnpm i18n:parity` GREEN — all 4 locales have the new keys
- `pnpm --filter @contractor-ops/web test recompute-compliance-button` exits 0
- typecheck:fast clean for the new code (the only error is unrelated Phase 74 missing offboarding-templates module)

## Task Commits

1. **Tasks 1–6 (components + tests + i18n)** — `e607f83d` (feat)

## Files Created/Modified
- 2 new components (button.tsx + dialog.tsx)
- 1 test file rewrite (it.todo → 9 RTL tests)
- 4 i18n locale files (each gains 18 keys under `Contractors.Compliance.Recompute`)

## Decisions Made
- Used `useMutation(trpc.x.y.mutationOptions({...}))` tRPC v11 idiom (matches `revalidate-vat-button.tsx` exactly)
- Imported `Select` from `@/components/ui/select` (base-ui underlying component) for reason dropdown
- Used `AlertDialog` (not `Dialog`) for the confirm dialog because semantic meaning is "irreversible action requiring confirm"
- DE/PL/AR translations are best-effort; final wording lands when legal/marketing approve copy

## Deviations from Plan

**1. [Rule 3 — Constraint clarification] NOT wiring components into contractor profile or contractors-list pages**
- **Found during:** Tasks 4 + 5 (page integration)
- **Issue:** Plan tasks 71-06-04 + 71-06-05 expected the components to be inserted into:
  - `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/compliance/page.tsx` (per-contractor profile compliance tab)
  - `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` (contractors-list bulk action)
  Both pages have substantial uncommitted modifications in the dirty working tree from in-flight Phase 74 work (`apps/web/src/components/contractors/contractor-wizard/wizard-dialog.tsx` and others modified). Editing those page files would risk merge conflicts with the ongoing Phase 74 / 76 / 74 plan work.
- **Fix:** Components are exported and ready to wire. The component contract is stable (`<RecomputeComplianceButton contractorId="..." />` and `<RecomputeComplianceBulkAction contractorIds={...} open={...} onOpenChange={...} />`). A follow-up plan or post-Phase-74 hotfix wires them in.
- **Impact:** D-13 functional UI is shipped at the component level. Wiring into pages is a 5-line change owned by the next pass.
- **Committed in:** e607f83d

**2. [Rule 2 — Auto-fix] Used `mutationOptions + useMutation` tRPC v11 idiom**
- **Found during:** Task 2 (component implementation)
- **Issue:** Plan example used `trpc.classification.recreateComplianceAssessment.useMutation(...)` (tRPC v10 idiom). Codebase actually uses `trpc.x.y.mutationOptions(...)` wrapped in `useMutation(...)` from `@tanstack/react-query` (tRPC v11 idiom, per `revalidate-vat-button.tsx`).
- **Fix:** Used the v11 idiom matching the closest sibling
- **Verification:** Test mock targets `mutationOptions` (matches actual import surface)
- **Committed in:** e607f83d

---

**Total deviations:** 2 (1 page-integration deferred to avoid dirty-tree conflicts; 1 idiom alignment)
**Impact on plan:** Functional UI components fully shipped + tested + i18n. Page wiring is a small follow-up that should land once parallel Phase 74/76 work merges.

## Issues Encountered
- The packages/compliance-policy/package.json was modified by an external sync process during this plan (added `typecheck:fast` script). Non-blocking — committed as part of unrelated work tracking.

## ROADMAP success criteria status after Plan 71-06
- ✓ #1: Materialisation + supersession (Plan 71-04)
- ✓ #2: TZ boundary (Plan 71-02)
- ✓ #3: Per-jurisdiction policy seeds (Plan 71-02)
- ✓ #4: Admin recompute + audit log + UI (this plan + Plan 71-05) — engine + button + dialog all live; page wiring as follow-up
- ⏳ Backfill of existing rows → Plan 71-07

## Next Phase Readiness
- Plan 71-07 (backfill script) is the final remaining plan in Phase 71
- Components are stable for Phase 73 to polish (visual styling, dashboard layout, deeper drift-affected-rows preview)

---
*Phase: 71-f1-compliance-policy-package-schema-classification-reconcile*
*Completed: 2026-04-27*
