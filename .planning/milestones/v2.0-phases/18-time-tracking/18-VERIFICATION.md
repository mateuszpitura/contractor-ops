---
phase: 18-time-tracking
verified: 2026-03-28T00:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
---

# Phase 18: Time Tracking Verification Report

**Phase Goal:** Contractors can report hours and managers can verify that invoiced amounts align with approved time
**Verified:** 2026-03-28
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Timesheet and TimeEntry models exist with DRAFT/SUBMITTED/APPROVED/REJECTED lifecycle | VERIFIED | `packages/db/prisma/schema/time-tracking.prisma` has both models, `enum TimesheetStatus`, `@@unique` constraints |
| 2  | Time entries store minutes as integers with source tracking (MANUAL/CLOCKIFY/JIRA) | VERIFIED | `enum TimeEntrySource` in schema, `minutes Int` column, `source: "MANUAL"` enforced in service |
| 3  | Zod schemas validate all time entry inputs | VERIFIED | `packages/validators/src/time-tracking.ts` exports 10 schemas including all required ones |
| 4  | Time entry service enforces status transitions and prevents edits on submitted timesheets | VERIFIED | `time-entry.ts` uses `updateMany` with status where-clause (optimistic lock), `PRECONDITION_FAILED` thrown on wrong status, `source !== "MANUAL"` check blocks imported entry edits |
| 5  | CLOCKIFY added to IntegrationProvider enum, TIMESHEET to EntityType | VERIFIED | `integration.prisma` line 112 has `CLOCKIFY`, `contract.prisma` lines 215+263 have `TIMESHEET` |
| 6  | Clockify adapter registered with API key auth and regional base URL support | VERIFIED | `clockify-adapter.ts` exports `CLOCKIFY_REGIONS` with 5 regional URLs; registered via `new ClockifyAdapter()` in `register-all.ts` line 33 |
| 7  | Jira adapter registered with OAuth 2.0 3LO for worklog access | VERIFIED | `jira-adapter.ts` has `auth.atlassian.com/authorize`, `read:jira-work` scope, `accessible-resources` discovery; registered in `register-all.ts` line 34 |
| 8  | Clockify sync service fetches time entries by user/workspace/date-range with pagination | VERIFIED | `clockify-sync.ts` (317 lines): `syncClockifyEntries`, `parseDurationToMinutes`, `page-size=100` pagination, `source: "CLOCKIFY"` |
| 9  | Jira sync service fetches worklogs by accountId/date-range with two-step JQL+worklog pagination | VERIFIED | `jira-worklog-sync.ts` (431 lines): `syncJiraWorklogs`, `worklogAuthor`, `accountId` resolution, `timeSpentSeconds / 60` conversion |
| 10 | Both sync services handle deduplication via externalId | VERIFIED | Both use Prisma upsert on `@@unique([organizationId, contractorId, source, externalId])` |
| 11 | Contractor can see a weekly timesheet grid and enter/submit hours | VERIFIED | `/portal/time/page.tsx` renders `TimesheetGrid` with `step="0.25"` cells and all `portalTime.*` mutations wired; portal top bar shows `{ label: "Time", href: "/portal/time", icon: Clock }` |
| 12 | Contractor can sync from Clockify/Jira when connected | VERIFIED | `external-sync-button.tsx` with "Sync from {provider}" label; `portalTime.syncExternal` mutation wired in page |
| 13 | Manager can see pending timesheets and approve/reject individually or in batch | VERIFIED | `approval-queue-table.tsx` with `ApprovalQueueTable`, `Checkbox`, `Approve`, `Reject`; admin page wires `trpc.time.approve/reject/bulkApprove/bulkReject` |
| 14 | Manager can drill into a contractor's timesheet to review entries | VERIFIED | `/time/[contractorId]/page.tsx` with `ContractorTimesheetReview` component; `trpc.time.getTimesheet` wired |
| 15 | Admin sidebar has Time nav item in the finance group | VERIFIED | `navigation.ts` line 96-99: `key: "time"`, `href: "/time"`, `icon: Clock` |
| 16 | System computes expected amount from approved hours x rate for PER_HOUR/PER_DAY contracts | VERIFIED | `time-reconciliation.ts`: `computeTimeReconciliation` with PER_HOUR and PER_DAY formulas, default 10% threshold, only counts APPROVED timesheet entries |
| 17 | Invoice detail page shows ReconciliationCard with approved hours, expected amount, and deviation | VERIFIED | `/invoices/[id]/page.tsx` imports `ReconciliationCard`, calls `trpc.time.getInvoiceReconciliation` (line 149), renders card conditionally |
| 18 | Deviation flags are warnings only and do not block invoice approval (D-15) | VERIFIED | `invoice-matching.ts` line 235: `flags.push("TIME_DEVIATION")` — flag added to `flags` array only, `matchStatus` unchanged |

**Score:** 18/18 truths verified

---

## Required Artifacts

| Artifact | Plan | Status | Details |
|----------|------|--------|---------|
| `packages/api/src/services/__tests__/time-entry.test.ts` | 18-00 | VERIFIED | Exists, has `describe/it.todo` stubs for TIME-01 behaviors |
| `packages/api/src/services/__tests__/timesheet.test.ts` | 18-00 | VERIFIED | Exists, has stubs for timesheet lifecycle |
| `packages/api/src/services/__tests__/time-approval.test.ts` | 18-00 | VERIFIED | Exists, has stubs for approve/reject/bulk flows |
| `packages/api/src/services/__tests__/clockify.test.ts` | 18-00 | VERIFIED | Exists, has stubs for Clockify sync + `parseDurationToMinutes` |
| `packages/api/src/services/__tests__/jira-worklog.test.ts` | 18-00 | VERIFIED | Exists, has stubs for two-step JQL+worklog fetch |
| `packages/api/src/services/__tests__/reconciliation.test.ts` | 18-00 | VERIFIED | Exists, has stubs for all reconciliation formulas and TIME_DEVIATION flag |
| `packages/db/prisma/schema/time-tracking.prisma` | 18-01 | VERIFIED | `model Timesheet`, `model TimeEntry`, both `@@unique` constraints, all enums |
| `packages/validators/src/time-tracking.ts` | 18-01 | VERIFIED | All 10 schemas exported including `saveDraftEntriesSchema`, `syncExternalEntriesSchema`, `timeReconciliationSchema` |
| `packages/api/src/services/time-entry.ts` | 18-01 | VERIFIED | All 6 functions exported, optimistic locking via `updateMany`, imported entry protection |
| `packages/integrations/src/adapters/clockify-adapter.ts` | 18-02 | VERIFIED | `CLOCKIFY_REGIONS`, 5 regional URLs, `X-Api-Key` auth |
| `packages/integrations/src/adapters/jira-adapter.ts` | 18-02 | VERIFIED | OAuth 2.0 3LO config, `accessible-resources` cloud ID discovery |
| `packages/api/src/services/clockify-sync.ts` | 18-02 | VERIFIED | 317 lines, `syncClockifyEntries`, `parseDurationToMinutes`, pagination, deduplication |
| `packages/api/src/services/jira-worklog-sync.ts` | 18-02 | VERIFIED | 431 lines, `syncJiraWorklogs`, two-step JQL+worklog, `timeSpentSeconds` conversion |
| `packages/api/src/routers/portal-time.ts` | 18-03 | VERIFIED | `portalTimeRouter`, all 8 procedures, uses `portalProcedure` |
| `apps/web/src/app/[locale]/(portal)/portal/time/page.tsx` | 18-03 | VERIFIED | Contains `TimesheetGrid`, all `portalTime.*` tRPC mutations wired |
| `apps/web/src/components/time/timesheet-grid.tsx` | 18-03 | VERIFIED | `TimesheetGrid` export, `step="0.25"` input, disabled state for non-DRAFT |
| `apps/web/src/components/time/timesheet-header.tsx` | 18-03 | VERIFIED | Week selector, `TimeEntryStatusBadge`, "Submit Timesheet" button |
| `apps/web/src/components/time/single-entry-form.tsx` | 18-03 | VERIFIED | Dialog with "Log Time Entry" title |
| `apps/web/src/components/time/time-entry-status-badge.tsx` | 18-03 | VERIFIED | All 4 statuses mapped with correct variants |
| `apps/web/src/components/time/time-source-badge.tsx` | 18-03 | VERIFIED | MANUAL/CLOCKIFY/JIRA sources with icons and tooltips |
| `apps/web/src/components/time/external-sync-button.tsx` | 18-03 | VERIFIED | "Sync from {provider}" label, date range popover, sonner toast |
| `apps/web/src/components/time/time-summary-stats.tsx` | 18-03 | VERIFIED | "This Week", pending count, approved month stats |
| `packages/api/src/routers/time.ts` | 18-04 | VERIFIED | `timeRouter`, `tenantProcedure`, `listPending`, `approve`, `reject`, `bulkApprove`, `bulkReject`, `getReconciliation`, `listReconciliations`, `getInvoiceReconciliation` |
| `apps/web/src/app/[locale]/(dashboard)/time/page.tsx` | 18-04/05 | VERIFIED | 3 tabs: Pending Reviews, All Entries, Reconciliation with `ReconciliationTable` |
| `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx` | 18-04 | VERIFIED | `ContractorTimesheetReview` with `trpc.time.approve/reject` mutations |
| `apps/web/src/components/time/approval-queue-table.tsx` | 18-04 | VERIFIED | `ApprovalQueueTable`, `Checkbox`, individual + bulk approve/reject |
| `apps/web/src/components/time/contractor-timesheet-review.tsx` | 18-04 | VERIFIED | `ContractorTimesheetReview`, "Approve Timesheet" button, `onReject` prop |
| `apps/web/src/components/time/rejection-reason-dialog.tsx` | 18-04 | VERIFIED | "Reject Timesheet" title, 10-char minimum enforced at line 61 and in button disabled state |
| `packages/api/src/services/time-reconciliation.ts` | 18-05 | VERIFIED | `TimeReconciliation` interface, `computeTimeReconciliation`, PER_HOUR + PER_DAY formulas, `timeDeviationThresholdPercent` |
| `apps/web/src/components/time/deviation-flag.tsx` | 18-05 | VERIFIED | `DeviationFlag`, severity tiers "Within X%", "+X% over expected", "+X% deviation" |
| `apps/web/src/components/time/reconciliation-card.tsx` | 18-05 | VERIFIED | `ReconciliationCard`, "Time Reconciliation", "Approved Hours", "Expected Amount", "Invoiced Amount" |
| `apps/web/src/components/time/reconciliation-table.tsx` | 18-05 | VERIFIED | `ReconciliationTable`, wired to `trpc.time.listReconciliations` |
| `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` | 18-05 | VERIFIED | Imports `ReconciliationCard`, calls `trpc.time.getInvoiceReconciliation`, conditionally renders card |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `time-entry.ts` | `time-tracking.prisma` | `prisma.timesheet.*` queries | WIRED | 10+ `prisma.timesheet.*` calls confirmed |
| `validators/time-tracking.ts` | `services/time-entry.ts` | imported in router layer (`portal-time.ts`, `time.ts`) | WIRED | `@contractor-ops/validators` imported at router boundary; service takes typed params directly |
| `clockify-adapter.ts` | `register-all.ts` | `new ClockifyAdapter()` | WIRED | `register-all.ts` line 33 |
| `jira-adapter.ts` | `register-all.ts` | `new JiraAdapter()` | WIRED | `register-all.ts` line 34 |
| `clockify-sync.ts` | `clockify-adapter.ts` | `decryptCredentials` for API calls | WIRED | `clockify-sync.ts` line 2 imports `decryptCredentials` from integrations |
| `timesheet-grid.tsx` | `portal-time.ts` | `trpc.portalTime.*` mutations | WIRED | Portal time page calls all `portalTime.*` procedures; grid receives `onSave` prop |
| `portal-top-bar.tsx` | `/portal/time/page.tsx` | `href: "/portal/time"` | WIRED | `portal-top-bar.tsx` line 41 |
| `approval-queue-table.tsx` | `time.ts` | `trpc.time.*` queries/mutations | WIRED | Admin time page wires all `trpc.time.*` mutations to `ApprovalQueueTable` props |
| `navigation.ts` | `/time/page.tsx` | `href: "/time"` | WIRED | `navigation.ts` line 98 |
| `time-reconciliation.ts` | `invoice-matching.ts` | `TIME_DEVIATION` flag | WIRED | `invoice-matching.ts` line 235 |
| `invoice-detail page` | `reconciliation-card.tsx` | `ReconciliationCard` render | WIRED | `/invoices/[id]/page.tsx` lines 24, 308 |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TIME-01 | 18-00, 18-01, 18-03 | Contractor can log hours manually in portal | SATISFIED | Schema, service, validators, portal UI all implemented and wired |
| TIME-02 | 18-00, 18-01, 18-04 | Manager can review and approve/reject time entries | SATISFIED | `timeRouter`, approval queue, contractor review page, bulk operations |
| TIME-03 | 18-00, 18-02, 18-03 | System can import time entries from Clockify via API | SATISFIED | Clockify adapter registered, `syncClockifyEntries` with pagination, `ExternalSyncButton` in portal |
| TIME-04 | 18-00, 18-02, 18-03 | System can import worklogs from Jira issues | SATISFIED | Jira OAuth adapter, `syncJiraWorklogs` with two-step fetch, portal sync button |
| TIME-05 | 18-00, 18-05 | System compares approved hours against invoice amount and flags deviations | SATISFIED | `computeTimeReconciliation`, `TIME_DEVIATION` flag, `ReconciliationCard` on invoice detail, `ReconciliationTable` in admin |

All 5 requirements covered. No orphaned requirements found.

---

## Anti-Patterns Found

No blocking anti-patterns found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/[locale]/(dashboard)/time/page.tsx` | 361 | JSDoc comment says "Reconciliation (placeholder)" but implementation has real `ReconciliationTable` | Info | Documentation only — code is correct |

---

## Human Verification Required

### 1. Weekly timesheet grid cell editing and auto-save

**Test:** Navigate to `/portal/time` as a contractor with active contracts. Click a grid cell, enter a number (e.g. 2.5), click another cell.
**Expected:** Entry saves automatically on blur; total hours update in the header; cell value persists on page refresh.
**Why human:** Auto-save-on-blur behavior requires runtime interaction to verify.

### 2. External sync flow (Clockify)

**Test:** Navigate to `/portal/time` as a contractor with a connected Clockify account. Click "Sync from Clockify", set a date range, click "Import Entries".
**Expected:** Spinner shown during sync, toast notification "N entries imported from Clockify" on completion, entries appear in the grid.
**Why human:** Requires a live Clockify connection or mocked integration test.

### 3. Timesheet submission and manager review flow

**Test:** (a) As contractor: submit a timesheet. (b) As manager: navigate to `/time`, see it in Pending Reviews, approve or reject with reason. (c) As contractor: see status update.
**Expected:** Status transitions correctly, rejection reason visible, contractor can resubmit after rejection.
**Why human:** End-to-end multi-role flow.

### 4. Invoice detail reconciliation card visibility

**Test:** Open an invoice detail page for a PER_HOUR or PER_DAY contractor who has APPROVED timesheets for the invoice period.
**Expected:** ReconciliationCard appears below invoice metadata showing approved hours, expected amount, deviation badge.
**Why human:** Requires real invoice + approved timesheet data combination.

### 5. TIME_DEVIATION flag in invoice matching

**Test:** Process an invoice where the invoiced amount deviates from approved hours by more than the org threshold (default 10%). Check the invoice flags.
**Expected:** "TIME_DEVIATION" flag appears in invoice flags; invoice can still be approved (not blocked).
**Why human:** Requires triggering the invoice matching pipeline with specific data conditions.

---

## Summary

Phase 18 goal is fully achieved. All 5 requirements (TIME-01 through TIME-05) are implemented across 6 plans.

**Contractors** can log hours manually via a weekly grid or single entry dialog, submit timesheets, and sync from Clockify or Jira. The portal Time section is accessible via a new nav item.

**Managers** can review submitted timesheets in a pending queue, approve or reject individually or in batch (with a required rejection reason), and drill into per-contractor detail views. The admin sidebar has a Time nav item in the finance group.

**Reconciliation** works by comparing approved time entries against invoiced amounts for PER_HOUR and PER_DAY contracts. The `TIME_DEVIATION` flag is a warning only and does not block invoice approval (D-15). The invoice detail page shows a ReconciliationCard, and the admin Time section has a full Reconciliation tab.

The invoice detail integration note: the plan specified adding `ReconciliationCard` to `invoice-detail-layout.tsx`, but the implementation places it in the invoice detail page component (`/invoices/[id]/page.tsx`). This achieves the same user-visible outcome and is architecturally cleaner (avoids coupling a generic layout component to time-tracking domain logic).

---

_Verified: 2026-03-28_
_Verifier: Claude (gsd-verifier)_
