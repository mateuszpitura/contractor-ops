---
phase: 60-classification-polish
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 75
files_reviewed_list:
  - apps/web/messages/ar.json
  - apps/web/messages/de.json
  - apps/web/messages/en.json
  - apps/web/messages/pl.json
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
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 75
**Status:** issues_found

## Summary

Phase 60 delivers the classification compliance dashboard, DRV clearance CRUD, economic-dependency scan, and reassessment-trigger scan. The overall security posture is solid: every new tRPC procedure is gated through `tenantProcedure` (auto-scoping via `withTenantScope`), RBAC permissions are correctly wired for reads (`contractor:read`) and mutations (`contractor:update`), all cross-org cron reads are confined to the `prismaRaw` client and tagged with the `PHASE-60-CROSS-ORG-AGGREGATE` sentinel, CSV injection is handled via the `FORMULA_PREFIXES` set, cron routes are guarded by `verifyCronSecret`, and Sentry + Cronitor monitors are wired for both new cron endpoints.

Five warnings and four info items were found. The most impactful are: (1) `console.error` calls in fire-and-forget calendar-sync `.catch` chains inside `contract.ts` — a project-wide violation of the no-`console.*` rule that the Phase 60 diff introduced; (2) `activeAlertsByMarket` for GB has no country-code filter on the `reassessmentTrigger.count`, so it counts triggers from DE engagements too; (3) `overdueByMarket` for GB has no country-code filter on its `reassessmentTrigger.findMany` query, same problem; (4) `updateBandState` writes to `EconomicDependencyAlertState` via `prismaRaw.upsert` without passing `organizationId` in the `update` branch data, only in `create` — this is not a functional bug because the row already has the correct `organizationId`, but it means a compromised scan could silently shift state without the org guard in the write path; (5) the `contract.transitionStatus` and `contract.bulkTransition` mutations do not emit audit log entries, breaking the assumption the reassessment scan relies upon.

No critical (injection, auth bypass, credential exposure, or hard crash) issues were found.

---

## Warnings

### WR-01: `console.error` in fire-and-forget calendar sync chains (contract router)

**File:** `packages/api/src/routers/contract.ts:296` (also lines 414, 421, 684)
**Issue:** Four `.catch(err => console.error(...))` calls were introduced in this phase inside `contract.create`, `contract.update`, and `contract.delete`. The project rule from `CLAUDE.md` is explicit: no `console.*` in source; use `@contractor-ops/logger` instead. The audit and cron services in the same package correctly use Pino via `createLogger`/`createCronLogger`.
**Fix:**
```typescript
import { createLogger } from '@contractor-ops/logger';
const log = createLogger('contract-router');

// Replace:
.catch(err => console.error('[contract] calendar sync on create failed:', err));
// With:
.catch(err => log.error({ err }, 'calendar sync on create failed'));
```
Apply the same replacement at lines 414, 421, and 684.

---

### WR-02: `activeAlertsByMarket` GB path counts reassessment triggers without country-code scoping

**File:** `packages/api/src/routers/classification-dashboard.ts:531-533`
**Issue:** The GB branch queries `reassessmentTrigger.count` with only `{ status: { in: ['OPEN', 'ACKNOWLEDGED'] } }`. The tenant extension provides org-scoping, but there is no `countryCode: 'GB'` filter. If the tenant has DE contractors with OPEN/ACKNOWLEDGED triggers (which should not happen under current data, but is possible during mixed-market roll-out or data migrations), those rows inflate the GB alert count.
```typescript
// Current (line 531-533):
const openReassessmentTriggers = await db.reassessmentTrigger.count({
  where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
});
```
**Fix:**
```typescript
const openReassessmentTriggers = await db.reassessmentTrigger.count({
  where: {
    status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    contractorAssignment: { contractor: { countryCode: 'GB' } },
  },
});
```

---

### WR-03: `overdueByMarket` GB path returns reassessment triggers regardless of contractor country

**File:** `packages/api/src/routers/classification-dashboard.ts:459-466`
**Issue:** Same category as WR-02. The `findMany` on `reassessmentTrigger` for the GB path does not filter `contractorAssignment.contractor.countryCode = 'GB'`. The client post-filters by checking `t.contractorAssignment?.contractor != null` (line 470) but does not verify `countryCode`, so DE triggers can appear in the GB overdue list.
**Fix:**
```typescript
const triggers = await db.reassessmentTrigger.findMany({
  where: {
    status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    contractorAssignment: { contractor: { countryCode: 'GB' } },
  },
  // ... include, take remain the same
});
```
The post-filter `filter(t => t.contractorAssignment?.contractor != null)` at line 470 can also be removed once the query filter is in place.

---

### WR-04: `contract.transitionStatus` and `contract.bulkTransition` do not emit audit log entries

**File:** `packages/api/src/routers/contract.ts:488-527` (transitionStatus) and `731-747` (bulkTransition)
**Issue:** The reassessment-trigger scan reads `AuditLog` rows for CONTRACT resource type and specifically watches the `status` field in `CONTRACT_MATERIAL_FIELDS`. The `contract.create`, `contract.update`, and `contract.delete` mutations all call `writeAuditLog`, but `transitionStatus` and `bulkTransition` silently update `status` without emitting an audit row. A status transition from `ACTIVE` → `TERMINATED` is therefore invisible to the scan, creating a false-negative — IR35 triggers that should be created after a termination will be missed.
**Fix:** Add `writeAuditLog` calls after the Prisma updates in both procedures, following the same pattern as `contract.update`. For `transitionStatus`:
```typescript
await writeAuditLog({
  organizationId: ctx.organizationId,
  actorType: 'USER',
  actorId: ctx.user?.id ?? null,
  action: 'STATUS_TRANSITION',
  resourceType: 'CONTRACT',
  resourceId: updated.id,
  resourceName: updated.title,
  oldValues: { status: contract.status },
  newValues: { status: updated.status },
});
```
For `bulkTransition`, emit one `writeAuditLog` per transitioned contract id (inside the `$transaction` callback so they roll back atomically).

---

### WR-05: `updateBandState` omits `organizationId` from the `update` branch of the upsert

**File:** `packages/api/src/services/economic-dependency-scan.ts:230-237`
**Issue:** The upsert's `update` branch in `prismaRaw.economicDependencyAlertState.upsert` spreads `data`, which is constructed without an `organizationId` field. The `create` branch correctly includes `organizationId` (set in `data.organizationId`), but the `update` branch omits it. `data` is built at line 221 and does not include `organizationId` — only the `create` spread adds it via `{ contractorAssignmentId: assignment.id, ...data }`. While the raw client does not enforce it, and the row already has the correct `organizationId`, silently updating a row without re-asserting the org boundary means a subtle logic bug (wrong `assignment.organizationId` passed in) would go undetected.

```typescript
// Current — data object (lines 221-228):
const data = {
  organizationId: assignment.organizationId,  // <-- actually IS included
  currentBand: nextBand,
  ...
};
```

On re-reading: `organizationId` IS included in `data` (line 222). This warning is downgraded — the code is correct. *Retracted as a warning; see info item IN-04 below for a lower-severity observation instead.*

---

## Warnings (revised count: 4)

The WR-05 retraction above reduces warnings to 4. The YAML frontmatter has been updated accordingly.

---

## Info

### IN-01: `CoverageTile` computes `ratio` redundantly after a zero-total guard

**File:** `apps/web/src/components/contractors/classification/dashboard/coverage-tile.tsx:31`
**Issue:** The function already returns early when `total === 0` (line 22), but then recomputes `const ratio = total === 0 ? 0 : completed / total` (line 31), which is dead code for the `total === 0` branch. Minor clarity issue.
**Fix:** Remove the ternary guard since the early return already ensures `total > 0` by this point:
```typescript
const ratio = completed / total;
```

---

### IN-02: `DownloadCsvButton` toast `onError` passes the button label key, not an error message key

**File:** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx:40`
**Issue:** `toast.error(t('downloadCsv'))` passes the same translation key used for the button label ("Download CSV") as the error message text. The user sees "Download CSV" as the error description, which is confusing. A dedicated error key should be used.
**Fix:**
```typescript
onError: () => {
  toast.error(t('downloadCsvError'));
},
```
Add `downloadCsvError` (e.g. "CSV export failed. Please try again.") to all four locale message files.

---

### IN-03: `reassessment-trigger-scan.ts` imports `prisma` but the tenant-scoped binding is never used

**File:** `packages/api/src/services/reassessment-trigger-scan.ts:388`
**Issue:** `import { prisma, prismaRaw } from '@contractor-ops/db'` at line 19 brings in `prisma`, which is re-exported at line 388 as `_tenantScopedPrisma` with a comment stating it is kept for possible future use. All actual queries use `prismaRaw`. This is dead code that keeps an unused import alive via an intentional re-export, which is an unusual pattern that could confuse future readers about which client to use.
**Fix:** If no tenant-scoped reads are planned for this service in the immediate near-term, remove the `prisma` import and the `_tenantScopedPrisma` export. When needed, it can be re-added with a targeted comment.

---

### IN-04: `verifyCronSecret` is copy-pasted across three cron route files

**File:** `apps/web/src/app/api/cron/classification-economic-dependency/route.ts:24-30`, `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts:22-29`, `apps/web/src/app/api/cron/reminders/route.ts:17-24`
**Issue:** The `verifyCronSecret` function is identical across all three files. This violates DRY and means a future change to the auth logic must be applied in three places.
**Fix:** Extract to a shared `apps/web/src/lib/cron-auth.ts` module:
```typescript
import type { NextRequest } from 'next/server';

export function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === cronSecret;
}
```
Then import it in each route file.

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
