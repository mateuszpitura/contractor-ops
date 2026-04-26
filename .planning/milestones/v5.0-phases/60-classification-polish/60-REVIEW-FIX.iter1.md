---
phase: 60-classification-polish
fixed_at: 2026-04-14T16:48:40Z
review_path: .planning/phases/60-classification-polish/60-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 60: Code Review Fix Report

**Fixed at:** 2026-04-14T16:48:40Z
**Source review:** .planning/phases/60-classification-polish/60-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 through WR-04; WR-05 was retracted in the review body)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `console.error` in fire-and-forget calendar sync chains (contract router)

**Files modified:** `packages/api/src/routers/contract.ts`
**Commit:** 4fa6a943
**Applied fix:** Added `import { createLogger } from '@contractor-ops/logger'` and `const log = createLogger('contract-router')` at the top of the file. Replaced all four `.catch(err => console.error(...))` calls (lines 296, 414, 421, 684) with `.catch(err => log.error({ err }, '...'))` using Pino structured logging per the project's no-`console.*` rule.

---

### WR-02: `activeAlertsByMarket` GB path counts reassessment triggers without country-code scoping

**Files modified:** `packages/api/src/routers/classification-dashboard.ts`, `packages/api/src/routers/__tests__/classification-dashboard.test.ts`
**Commits:** 361857cf (source), 60ef3708 (test fixtures)
**Applied fix:** Added `contractorAssignment: { contractor: { countryCode: 'GB' } }` to the `reassessmentTrigger.count` where-clause in the GB branch of `activeAlertsByMarket`. Updated test fixture triggers to include `contractorAssignment` with `countryCode: 'GB'` so the mock's nested `matchWhere` correctly filters them.

---

### WR-03: `overdueByMarket` GB path returns reassessment triggers regardless of contractor country

**Files modified:** `packages/api/src/routers/classification-dashboard.ts`, `packages/api/src/routers/__tests__/classification-dashboard.test.ts`
**Commits:** bf65c5e5 (source), 60ef3708 (test fixtures)
**Applied fix:** Added `contractorAssignment: { contractor: { countryCode: 'GB' } }` to the `reassessmentTrigger.findMany` where-clause in the GB branch of `overdueByMarket`. Removed the now-redundant post-filter `filter(t => t.contractorAssignment?.contractor && ...)` since the query itself ensures only GB contractors are returned. Updated test fixture triggers to include `contractorAssignment` with `countryCode: 'GB'`.

---

### WR-04: `contract.transitionStatus` and `contract.bulkTransition` do not emit audit log entries

**Files modified:** `packages/api/src/routers/contract.ts`
**Commit:** 65192e49
**Applied fix:**
- `transitionStatus`: Added `await writeAuditLog(...)` after the `ctx.db.contract.update` call, recording `action: 'STATUS_TRANSITION'` with `oldValues: { status: contract.status }` and `newValues: { status: updated.status }`.
- `bulkTransition`: Expanded the `findMany` select from `{ id, status }` to `{ id, status, title }` to provide `resourceName`. Inside the `$transaction` callback, after `tx.contract.updateMany`, added a `for` loop that calls `writeAuditLog` once per successfully transitioned contract, passing the `tx` as the transaction client so audit rows commit/rollback atomically with the status update.
- All 41 existing contract tests continue to pass (test mocks already stub `writeAuditLog` via `createLogger` mock).

---

_Fixed: 2026-04-14T16:48:40Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
