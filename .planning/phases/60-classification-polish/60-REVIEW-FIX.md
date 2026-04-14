---
phase: 60-classification-polish
fixed_at: 2026-04-14T17:21:00Z
review_path: .planning/phases/60-classification-polish/60-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 60: Code Review Fix Report

**Fixed at:** 2026-04-14T17:21:00Z
**Source review:** .planning/phases/60-classification-polish/60-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `activeAlertsByMarket` DE path counts economic-dependency alerts without contractor country scoping

**Files modified:** `packages/api/src/routers/classification-dashboard.ts`, `packages/api/src/routers/__tests__/classification-dashboard.test.ts`
**Commit:** 54c77aba
**Applied fix:** Added `contractorAssignment: { contractor: { countryCode: 'DE' } }` filter to all three counts in the DE branch of `activeAlertsByMarket` (`warning` band, `critical` band, and `statusfeststellungsverfahren` DRV expiry window). Updated the test `Alert` type and `DrvRecord` type to include the optional `contractorAssignment` field, and updated the DE active-alerts test fixtures to include `contractorAssignment: { contractor: { countryCode: 'DE' } }` so the nested-object `matchWhere` mock correctly filters them. All 17 classification-dashboard tests pass.

### WR-02: `addDays` helper in `reminders/route.ts` uses local-time `setDate` instead of UTC

**Files modified:** `apps/web/src/app/api/cron/reminders/route.ts`
**Commit:** a8700a4d
**Applied fix:** Changed `addDays` from `setDate`/`getDate` to `setUTCDate`/`getUTCDate`, and `startOfDay` from `setHours(0,0,0,0)` to `setUTCHours(0,0,0,0)`. This aligns both helpers with the UTC arithmetic used by the phase-60 `detectDrvClearanceExpiries` helper and prevents DST drift on non-UTC servers. All 13 reminders cron tests (route + drv-expiry) pass without modification.

### WR-03: `DownloadCsvButton` anchor element missing `download` attribute; comment contradicts implementation

**Files modified:** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx`
**Commit:** 734109c0
**Applied fix:** Removed the misleading comment claiming `download` hints the browser to save the file, removed `anchor.rel = 'noopener noreferrer'` and `anchor.target = '_self'` (both ineffective on cross-origin R2 signed URLs). Replaced with an accurate comment explaining the browser relies on R2's `Content-Disposition: attachment` header. The anchor creation now only sets `href` before click.

---

_Fixed: 2026-04-14T17:21:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
