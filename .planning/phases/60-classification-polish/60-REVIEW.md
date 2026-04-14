---
phase: 60-classification-polish
reviewed: 2026-04-14T17:30:00Z
depth: standard
files_reviewed: 74
files_reviewed_list:
  - apps/web/src/app/[locale]/(dashboard)/classification/__tests__/a11y.test.tsx
  - apps/web/src/app/[locale]/(dashboard)/classification/__tests__/page.test.tsx
  - apps/web/src/app/[locale]/(dashboard)/classification/page.tsx
  - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/page.tsx
  - apps/web/src/app/api/cron/classification-economic-dependency/__tests__/route.test.ts
  - apps/web/src/app/api/cron/classification-economic-dependency/route.ts
  - apps/web/src/app/api/cron/classification-reassessment-triggers/__tests__/route.test.ts
  - apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts
  - apps/web/src/app/api/cron/reminders/__tests__/drv-expiry.test.ts
  - apps/web/src/app/api/cron/reminders/route.ts
  - apps/web/src/components/contractors/classification/dashboard/__tests__/market-card.test.tsx
  - apps/web/src/components/contractors/classification/dashboard/__tests__/risk-distribution-tile.test.tsx
  - apps/web/src/components/contractors/classification/dashboard/active-alerts-tile.tsx
  - apps/web/src/components/contractors/classification/dashboard/coverage-tile.tsx
  - apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx
  - apps/web/src/components/contractors/classification/dashboard/market-card.tsx
  - apps/web/src/components/contractors/classification/dashboard/overdue-reassessments-tile.tsx
  - apps/web/src/components/contractors/classification/dashboard/refresh-dashboard-button.tsx
  - apps/web/src/components/contractors/classification/dashboard/risk-distribution-tile.tsx
  - apps/web/src/components/contractors/classification/drv-clearance/__tests__/a11y.test.tsx
  - apps/web/src/components/contractors/classification/drv-clearance/__tests__/drv-clearance-panel.test.tsx
  - apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-form.tsx
  - apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx
  - apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-row.tsx
  - apps/web/src/components/contractors/classification/drv-clearance/index.ts
  - apps/web/src/components/contractors/classification/economic-dependency-alerts/__tests__/band-chip.test.tsx
  - apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx
  - apps/web/src/components/contractors/classification/reassessment-trigger/__tests__/dismiss-dialog.test.tsx
  - apps/web/src/components/contractors/classification/reassessment-trigger/__tests__/trigger-chip.test.tsx
  - apps/web/src/components/contractors/classification/reassessment-trigger/dismiss-dialog.tsx
  - apps/web/src/components/contractors/classification/reassessment-trigger/trigger-chip.tsx
  - apps/web/src/components/contractors/classification/reassessment-trigger/trigger-cta.tsx
  - packages/api/package.json
  - packages/api/src/lib/__tests__/csv.test.ts
  - packages/api/src/lib/csv.ts
  - packages/api/src/root.ts
  - packages/api/src/routers/__tests__/classification-dashboard.test.ts
  - packages/api/src/routers/__tests__/classification.test.ts
  - packages/api/src/routers/__tests__/contract.test.ts
  - packages/api/src/routers/__tests__/contractor.test.ts
  - packages/api/src/routers/__tests__/economic-dependency-alert.test.ts
  - packages/api/src/routers/__tests__/reassessment-trigger.test.ts
  - packages/api/src/routers/__tests__/statusfeststellungsverfahren.test.ts
  - packages/api/src/routers/classification-dashboard.ts
  - packages/api/src/routers/classification.ts
  - packages/api/src/routers/contract.ts
  - packages/api/src/routers/contractor.ts
  - packages/api/src/routers/economic-dependency-alert.ts
  - packages/api/src/routers/reassessment-trigger.ts
  - packages/api/src/routers/statusfeststellungsverfahren.ts
  - packages/api/src/schemas/__tests__/reassessment-trigger-reason.test.ts
  - packages/api/src/schemas/reassessment-trigger-reason.ts
  - packages/api/src/services/__tests__/audit-writer.test.ts
  - packages/api/src/services/__tests__/economic-dependency-scan.test.ts
  - packages/api/src/services/__tests__/rbac-recipients.test.ts
  - packages/api/src/services/__tests__/reassessment-trigger-scan.test.ts
  - packages/api/src/services/audit-writer.ts
  - packages/api/src/services/cron-monitor.ts
  - packages/api/src/services/economic-dependency-scan.ts
  - packages/api/src/services/rbac-recipients.ts
  - packages/api/src/services/reassessment-trigger-scan.ts
  - packages/db/prisma/schema/auth.prisma
  - packages/db/prisma/schema/classification.prisma
  - packages/db/prisma/schema/contractor.prisma
  - packages/db/prisma/schema/organization.prisma
  - packages/db/src/index.ts
  - packages/db/src/raw.ts
  - packages/db/src/tenant.ts
  - packages/validators/src/__tests__/locked-phrases-guard.test.ts
  - packages/validators/src/legal/de.ts
  - packages/validators/src/notification.ts
  - apps/web/messages/ar.json
  - apps/web/messages/de.json
  - apps/web/messages/en.json
  - apps/web/messages/pl.json
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 60: Code Review Report (Iteration 2)

**Reviewed:** 2026-04-14T17:30:00Z
**Depth:** standard
**Files Reviewed:** 74
**Status:** issues_found

## Summary

This is the second pass review for Phase 60 (classification polish). The four warnings raised in iteration 1 (WR-01 through WR-04) were all confirmed as fixed in the iteration 1 fix report:

- WR-01: `console.*` in contract router — FIXED, `createLogger`/`log.error` used throughout.
- WR-02: `activeAlertsByMarket` GB path missing `countryCode: 'GB'` scoping — FIXED.
- WR-03: `overdueByMarket` GB path missing `countryCode: 'GB'` scoping — FIXED.
- WR-04: `transitionStatus` and `bulkTransition` missing `writeAuditLog` — FIXED, including correct `tx` propagation in `bulkTransition`.

No regressions were introduced by the fixes. Three new warnings and two info items are recorded below. None are in the paths fixed by iteration 1.

---

## Warnings

### WR-01: `activeAlertsByMarket` DE path counts economic-dependency alerts without contractor country scoping

**File:** `packages/api/src/routers/classification-dashboard.ts:544-552`

**Issue:** In the DE branch of `activeAlertsByMarket`, the counts for `economicDependencyAlertState` (lines 545-546) filter only on `currentBand` with no join to verify the assignment belongs to a DE contractor. The `tenantProcedure` auto-scopes by `organizationId`, but within one org there can be both GB and DE contractors. If an `EconomicDependencyAlertState` row exists for a GB assignment (possible via direct DB writes, data migration errors, or future code changes that extend the scan to GB), it would be silently counted in the DE dashboard tile.

The daily scan (`runEconomicDependencyScan`) does filter for `countryCode: 'DE'` before upserting states, so in normal operation no GB rows should exist. However the dashboard aggregate has no defensive filter and would silently miscount if invariant is violated.

**Fix:**
```typescript
// In activeAlertsByMarket DE branch:
const [warning, critical, drvExpiringWithin90d] = await Promise.all([
  db.economicDependencyAlertState.count({
    where: {
      currentBand: 'warning',
      contractorAssignment: { contractor: { countryCode: 'DE' } },
    },
  }),
  db.economicDependencyAlertState.count({
    where: {
      currentBand: 'critical',
      contractorAssignment: { contractor: { countryCode: 'DE' } },
    },
  }),
  db.statusfeststellungsverfahren.count({
    where: {
      validTo: { gte: now, lte: windowEnd },
      outcome: { in: ['SELBSTANDIG', 'ABHANGIG'] },
      contractorAssignment: { contractor: { countryCode: 'DE' } },
    },
  }),
]);
```

---

### WR-02: `addDays` helper in `reminders/route.ts` uses local-time `setDate` instead of UTC

**File:** `apps/web/src/app/api/cron/reminders/route.ts:30-34`

**Issue:** The `addDays` function uses `result.setDate(result.getDate() + days)` which operates in the server's **local timezone**. The cron route is scheduled in UTC (Sentry schedule `timezone: 'UTC'`), but if the Node.js process is ever started in a non-UTC timezone (e.g., a Render region that inherits a system TZ), the day arithmetic will produce wrong dates around DST transitions. This affects `findMatchingContracts` (contract-expiry reminder window) and `findMatchingInvoices` (invoice due-date window).

The `detectDrvClearanceExpiries` function that was added in this phase correctly uses `setUTCDate` and `setUTCHours`, making the inconsistency more visible.

**Fix:**
```typescript
// Replace the existing addDays helper (line 30-34):
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Also update startOfDay to use UTC:
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
```

---

### WR-03: `DownloadCsvButton` anchor element missing `download` attribute; comment contradicts implementation

**File:** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx:26-37`

**Issue:** The comment at line 27 states "an anchor with `download` hints the browser to save the signed URL to disk", but the anchor element created at line 30 does not set `anchor.download`. The `download` attribute is the mechanism that triggers a save-as dialog; without it, the browser decides how to handle the response based solely on the `Content-Disposition` header returned by R2. `target="_self"` means a wrong Content-Type from R2 would cause a page navigation instead of a file download.

In practice the R2 put sets `Content-Disposition: attachment; filename=...` via `downloadFilename` in `putObjectAndSignDownload`, so most browsers will save the file. But the code contradicts its own comment, `download` is missing, and the `target="_self"` is confusing (it has no effect on signed R2 cross-origin URLs, and cross-origin `download` attributes are also ignored — the anchor can be simplified).

**Fix:**
```typescript
const anchor = document.createElement('a');
anchor.href = result.url;
// `download` only works same-origin; R2 signed URLs are cross-origin so the
// browser relies on Content-Disposition: attachment from R2. Remove the
// misleading comment and target="_self" — just click and let the header drive.
document.body.appendChild(anchor);
anchor.click();
anchor.remove();
```
Remove the misleading comment and `target="_self"` / `rel` attributes that don't apply to cross-origin downloads. If same-origin download is ever needed, add `anchor.download = downloadFilename`.

---

## Info

### IN-01: `overdueByMarket` DE path selects the oldest assessment per engagement, not the most recent

**File:** `packages/api/src/routers/classification-dashboard.ts:484-513`

**Issue:** The DE overdue path queries `classificationAssessment` ordered `completedAt: 'asc'` (oldest first). The dedup map at lines 501-505 keeps the first occurrence per `contractorAssignmentId` — which, given the ascending sort, is the **oldest** completed assessment for each engagement, not the most recent. The comment "picking the freshest ASC since all are overdue" is incorrect: ASC returns oldest first.

The practical impact is limited because `contractorName` is sourced from the contractor relation (same regardless of which assessment row is selected), and all selected rows are overdue (older than 12 months). However the field `contractorAssignmentId` and any future use of assessment-level data would be from an old assessment row.

**Fix:**
```typescript
// Change the orderBy to 'desc' to pick the most recent per engagement:
const rows = await db.classificationAssessment.findMany({
  where: {
    status: 'completed',
    countryCode: 'DE',
    completedAt: { lt: cutoff },
  },
  include: { ... },
  orderBy: { completedAt: 'desc' },  // <-- was 'asc'
  take: DETAIL_ROW_TAKE,
});
// The dedup map then naturally keeps the most recent per engagement.
```
Update the comment to match.

---

### IN-02: `ReassessmentTriggerDismissDialog` does not reset `attempted` state when dialog is closed via `onOpenChange`

**File:** `apps/web/src/components/contractors/classification/reassessment-trigger/dismiss-dialog.tsx:42-50`

**Issue:** The `attempted` flag (line 43) is only reset inside `handleConfirm` on a successful submit. If the user types a short reason, clicks Confirm (which sets `attempted = true` and shows the error), then closes the dialog via the Cancel button or Escape key, the `reason` state is cleared via `onOpenChange` closing the dialog — but `attempted` remains `true` if the parent reopens the same dialog instance (e.g., dismissing a different trigger). On next open the error message would flash momentarily until the user types enough characters.

**Fix:**
```typescript
// Reset both states when the dialog closes:
<Dialog
  open={open}
  onOpenChange={next => {
    if (!next) {
      setReason('');
      setAttempted(false);
    }
    onOpenChange(next);
  }}
>
```

---

_Reviewed: 2026-04-14T17:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
