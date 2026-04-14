---
phase: 60-classification-polish
fixed_at: 2026-04-14T17:24:45Z
review_path: .planning/phases/60-classification-polish/60-REVIEW.md
iteration: 2-all
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 60: Code Review Fix Report

**Fixed at:** 2026-04-14T17:24:45Z
**Source review:** .planning/phases/60-classification-polish/60-REVIEW.md
**Iteration:** 2-all

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: `activeAlertsByMarket` DE path counts economic-dependency alerts without contractor country scoping

**Files modified:** `packages/api/src/routers/classification-dashboard.ts`, `packages/api/src/routers/__tests__/classification-dashboard.test.ts`
**Commit:** 54c77aba
**Applied fix:** Added `contractorAssignment: { contractor: { countryCode: 'DE' } }` filter to all three counts in the DE branch of `activeAlertsByMarket` (`warning` band, `critical` band, and `statusfeststellungsverfahren` DRV expiry window). Updated test fixtures to include the nested `contractorAssignment` field. All 17 classification-dashboard tests pass.

---

### WR-02: `addDays` helper in `reminders/route.ts` uses local-time `setDate` instead of UTC

**Files modified:** `apps/web/src/app/api/cron/reminders/route.ts`
**Commit:** a8700a4d
**Applied fix:** Changed `addDays` from `setDate`/`getDate` to `setUTCDate`/`getUTCDate`, and `startOfDay` from `setHours(0,0,0,0)` to `setUTCHours(0,0,0,0)`. Aligns both helpers with the UTC arithmetic used by the phase-60 `detectDrvClearanceExpiries` helper and prevents DST drift on non-UTC servers. All 13 reminders cron tests pass.

---

### WR-03: `DownloadCsvButton` anchor element missing `download` attribute; comment contradicts implementation

**Files modified:** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx`
**Commit:** 734109c0
**Applied fix:** Removed the misleading comment claiming `download` hints the browser to save the file, removed `anchor.rel = 'noopener noreferrer'` and `anchor.target = '_self'` (both ineffective on cross-origin R2 signed URLs). Replaced with an accurate comment explaining the browser relies on R2's `Content-Disposition: attachment` header.

---

### IN-01: `overdueByMarket` DE path selects the oldest assessment per engagement, not the most recent

**Files modified:** `packages/api/src/routers/classification-dashboard.ts`
**Commit:** 3ab12bc2
**Applied fix:** Changed `orderBy: { completedAt: 'asc' }` to `orderBy: { completedAt: 'desc' }` so the dedup map's first-occurrence logic keeps the most recent overdue assessment per engagement rather than the oldest. Updated the inline comment to accurately describe the DESC-then-dedup pattern. All 17 classification-dashboard tests pass.

---

### IN-02: `ReassessmentTriggerDismissDialog` does not reset `attempted` state when dialog is closed via `onOpenChange`

**Files modified:** `apps/web/src/components/contractors/classification/reassessment-trigger/dismiss-dialog.tsx`
**Commit:** 64995ba3
**Applied fix:** Wrapped the `onOpenChange` prop in an intercepting handler on `<Dialog>`. When `next` is `false` (dialog closing), both `reason` and `attempted` are reset to their initial values before delegating to the caller's `onOpenChange`. This prevents stale validation errors from flashing on subsequent opens of the same dialog instance. All 4 dismiss-dialog tests pass.

---

_Fixed: 2026-04-14T17:24:45Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2-all_
