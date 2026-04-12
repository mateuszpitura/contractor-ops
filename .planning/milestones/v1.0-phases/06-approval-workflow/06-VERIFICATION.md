---
phase: 06-approval-workflow
verified: 2026-03-22T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/10
  gaps_closed:
    - "Approver can bulk approve/reject via checkbox selection and floating toolbar (APPR-04)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /approvals and verify the Approvals tab appears in Settings between General and Members"
    expected: "Settings page shows tabs in order: General | Approvals | Members"
    why_human: "Tab order and visual positioning cannot be verified programmatically"
  - test: "Create an approval chain in Settings > Approvals with 2 levels, an amount threshold condition, and submit an invoice for approval"
    expected: "Invoice status changes to APPROVAL_PENDING, approval queue shows the pending step with SLA badge, chain tracker appears on invoice detail"
    why_human: "Requires live database interaction and multi-step user flow"
  - test: "On /approvals, click a row to open the side panel and use Approve, Reject, Request Clarification, and Delegate actions"
    expected: "Each action updates the step status and refreshes the queue"
    why_human: "Real-time state transitions and toast notifications require interactive testing"
  - test: "On the approvals queue, select 2+ rows via checkboxes and verify the floating bulk toolbar appears with Approve All and Reject All buttons"
    expected: "Floating bulk toolbar appears when rows are selected. Approve All processes all and clears selection. Changing tab/filter clears selection."
    why_human: "Row selection interaction and floating toolbar appearance require interactive testing"
  - test: "On an invoice with APPROVAL_PENDING status, check the chain tracker shows step circles with correct colors (primary for pending, green for approved)"
    expected: "Horizontal stepper with correctly colored step circles, responsive vertical layout below lg breakpoint"
    why_human: "Visual rendering and responsive layout cannot be verified by code analysis"
  - test: "Let an approval step's SLA deadline pass and verify the SLA badge shows OVERDUE red styling and the audit trail includes an sla_breached system event"
    expected: "SlaBadge shows 'OVERDUE Xh' in destructive red, getAuditTrail returns event with label sla_breached"
    why_human: "Requires time-based testing with a past SLA deadline"
---

# Phase 06: Approval Workflow Verification Report

**Phase Goal:** Invoices route through configurable multi-level approval chains with SLA enforcement, delegation, and a complete audit trail for every decision
**Verified:** 2026-03-22T00:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 06-06, commit d98be5f)

## Re-verification Summary

The previous verification (2026-03-21T23:10:00Z) found 1 blocker gap: APPR-04 bulk selection wiring was broken because `handleSelectionFromTable` in `approvals/page.tsx` was an empty no-op and `ApprovalQueueTable` had no `onSelectionChange` callback.

Gap closure plan 06-06 (commit `d98be5f`) fixed this with the following changes:

`apps/web/src/components/approvals/approval-queue/data-table.tsx`:
- Added `onSelectionChange?: (ids: string[]) => void` to `ApprovalQueueTableProps`
- Added `rowSelection` state via `useState<RowSelectionState>({})`
- Wired `onRowSelectionChange: setRowSelection` in `useReactTable`
- Added `useEffect` that calls `onSelectionChange?.(ids)` when `rowSelection` changes
- Added `useEffect` that resets `rowSelection` to `{}` when `data` changes (clears on page/filter navigation)

`apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx`:
- Removed the empty `handleSelectionFromTable` no-op callback
- Passes `onSelectionChange={setSelectedIds}` directly to `<ApprovalQueueTable>`
- Adds `useEffect` that clears `selectedIds` when `tab`, `status`, `search`, or `page` changes

TypeScript compiles clean. All 10 must-have truths now pass automated verification. No regressions detected.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Approval chain configs can be created, read, updated, and deleted via tRPC | VERIFIED | `approvalRouter` exports `listChains`, `getChain`, `createChain`, `updateChain`, `deleteChain` with `$transaction` and org-scoped checks |
| 2 | Submitting an invoice routes to the correct chain and creates an ApprovalFlow with snapshotted steps | VERIFIED | `submitForApproval` calls `routeToChain` (first-match + default fallback) then `createApprovalFlow` (deep-clones stepsJson, resolves role-based approvers) |
| 3 | Approver can approve, reject (with comment), request clarification, or delegate a step | VERIFIED | All 4 action procedures in router, each in `$transaction`. `rejectStepSchema` enforces `z.string().min(10)`. Side panel provides all 4 actions. |
| 4 | SLA deadline is computed at step activation time using slaHours | VERIFIED | `createApprovalFlow` uses `addHours(now, step.slaHours)` for first step. `advanceFlow` computes `addHours(now, slaHours)` for each subsequently activated step. |
| 5 | Every approval decision is recorded as an ApprovalDecision row with actor, timestamp, and comment | VERIFIED | All 4 action procedures create `ApprovalDecision` with `actorUserId: ctx.user.id`, `createdAt` auto-set, `comment` field. `getAuditTrail` retrieves with actor join. |
| 6 | Bulk approve/reject processes items individually via Promise.allSettled and reports success/failure counts | VERIFIED | `bulkApprove` and `bulkReject` use `Promise.allSettled` per step. Returns `{ succeeded, failed, errors }`. |
| 7 | Admin can configure approval chains (Settings > Approvals tab) | VERIFIED | `settings/page.tsx` has `TabsTrigger value="approvals"` rendering `ApprovalChainsTab`. `ChainEditorDialog` calls `trpc.approval.createChain` or `updateChain`. |
| 8 | Approver sees a dedicated /approvals page with queue sorted by SLA, tabs, SLA badges, and side panel | VERIFIED | Page has My/All tabs, `trpc.approval.listPending` with `refetchInterval: 30000`, `SlaBadge` with `setInterval(60000)`, `ApprovalSidePanel` with all 4 actions |
| 9 | Invoice detail shows chain tracker and audit timeline when in approval flow | VERIFIED | `invoices/[id]/page.tsx` conditionally renders `ChainTracker` and `AuditTimeline` when `hasApprovalFlow`. Both call `trpc.approval.getAuditTrail`. |
| 10 | Approver can bulk approve/reject via checkbox selection and floating toolbar | VERIFIED | `onSelectionChange={setSelectedIds}` passed to table (page.tsx line 229). Table forwards `rowSelection` via `useEffect` to `onSelectionChange?.(ids)` (data-table.tsx line 87). Toolbar renders when `selectedIds.length > 0` and calls `bulkApprove`/`bulkReject`. Selection clears on success and on filter/tab/page change. |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/validators/src/approval.ts` | Zod schemas for chain config CRUD, approval actions, queue query | VERIFIED | All required schemas present |
| `packages/api/src/services/approval-engine.ts` | Pure approval state machine functions | VERIFIED | `evaluateConditions`, `routeToChain`, `createApprovalFlow`, `advanceFlow`, `computeSlaStatus` all present |
| `packages/api/src/routers/approval.ts` | Complete approval tRPC router (14 procedures) | VERIFIED | 14 procedures confirmed |
| `packages/api/src/root.ts` | approvalRouter registered | VERIFIED | `approval: approvalRouter` at line 34 |
| `apps/web/src/components/approvals/approval-queue/data-table.tsx` | TanStack Table with `onSelectionChange` callback | VERIFIED | `onSelectionChange?: (ids: string[]) => void` in interface; `rowSelection` state with `RowSelectionState`; `useEffect` forwards selection; `useEffect` resets on data change |
| `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` | Wired selection state from table to bulk toolbar | VERIFIED | `onSelectionChange={setSelectedIds}` at line 229; `useEffect` clears `selectedIds` on filter/tab/page change; empty no-op removed |
| `apps/web/src/components/approvals/approval-queue/data-table-toolbar.tsx` | Queue toolbar with bulk actions | VERIFIED | Floating toolbar gated on `selectedIds.length > 0`; `bulkApprove` and `bulkReject` mutations wired with `selectedIds`; `onClearSelection` called on success |
| `apps/web/src/components/approvals/approval-queue/side-panel.tsx` | Side panel with full approval actions | VERIFIED | All 4 actions present |
| `apps/web/src/components/approvals/chain-tracker.tsx` | Horizontal stepper showing approval chain progress | VERIFIED | `trpc.approval.getAuditTrail` wired, step circles with status-based colors, responsive layout |
| `apps/web/src/components/approvals/audit-timeline.tsx` | Vertical timeline of approval events | VERIFIED | `trpc.approval.getAuditTrail` wired, human and system events rendered |
| `apps/web/messages/en.json` | English translations for Approvals namespace | VERIFIED | All 18 sub-namespaces present including `Settings.tabs.approvals` |
| `apps/web/messages/pl.json` | Polish translations for Approvals namespace | VERIFIED | Matching structure with `Settings.tabs.approvals = "Akceptacje"` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `packages/api/src/root.ts` | `packages/api/src/routers/approval.ts` | `approval: approvalRouter` | WIRED | Lines 10 and 34 confirmed |
| `packages/api/src/routers/approval.ts` | `packages/api/src/services/approval-engine.ts` | import + call within $transaction | WIRED | All engine functions called in router procedures |
| `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` | `approval-chains-tab.tsx` | `TabsContent value="approvals"` | WIRED | Settings renders `ApprovalChainsTab` |
| `apps/web/src/components/approvals/approval-queue/data-table.tsx` | `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` | `onSelectionChange` callback | WIRED | `onSelectionChange={setSelectedIds}` at page.tsx:229; table calls `onSelectionChange?.(ids)` in `useEffect` at data-table.tsx:87 |
| `apps/web/src/components/approvals/approval-queue/data-table-toolbar.tsx` | `trpc.approval.bulkApprove` and `bulkReject` | `useMutation` + `selectedIds` | WIRED | Mutations at lines 96 and 118; `selectedIds` now correctly populated via fixed wiring |
| `apps/web/src/components/approvals/chain-tracker.tsx` | `trpc.approval.getAuditTrail` | `useQuery` | WIRED | Confirmed |
| `apps/web/src/components/approvals/audit-timeline.tsx` | `trpc.approval.getAuditTrail` | `useQuery` | WIRED | Confirmed |
| `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` | `chain-tracker.tsx` + `audit-timeline.tsx` | conditional render | WIRED | Conditional on `hasApprovalFlow` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| APPR-01 | 06-01, 06-04 | System routes invoices through configurable approval chains (1-3 levels) | SATISFIED | `submitForApproval` → `routeToChain` → `createApprovalFlow` with first-match + default fallback |
| APPR-02 | 06-01, 06-03 | Approver can approve, reject (mandatory comment), request clarification, or delegate | SATISFIED | 4 action procedures; `rejectStepSchema` enforces `z.string().min(10)` |
| APPR-03 | 06-03 | User can view personal approval queue sorted by priority (overdue first, then due date) | SATISFIED | `listPending` with `sortBy: "slaDeadline"`, `sortOrder: "asc"` |
| APPR-04 | 06-01, 06-03, 06-06 | User can bulk approve/reject selected items | SATISFIED | Gap closed: table row selection forwards via `onSelectionChange` to `selectedIds`; toolbar gates on `count > 0`; mutations use `selectedIds`; TypeScript compiles clean |
| APPR-05 | 06-01, 06-03 | System tracks SLA timers per approval level with visual indicators (green/yellow/red) | SATISFIED | `computeSlaStatus` color levels; `SlaBadge` with `setInterval(60000)` and correct thresholds |
| APPR-06 | 06-01, 06-05 | System surfaces SLA breach events for escalation (Phase 7 notification consumption) | SATISFIED | `getAuditTrail` emits `{ type: "system", label: "sla_breached" }` canonical events |
| APPR-07 | 06-01, 06-03 | Approver can delegate to another user | SATISFIED | `delegate` procedure verifies step PENDING + assigned to ctx.userId, verifies delegate is org member, creates DELEGATE decision |
| APPR-08 | 06-01, 06-04 | System snapshots approval chain at submission time | SATISFIED | `createApprovalFlow` deep-clones via `JSON.parse(JSON.stringify())` into individual `ApprovalStep` rows |
| APPR-09 | 06-01, 06-04 | Full audit trail for every decision with actor, timestamp, comment | SATISFIED | All 4 action procedures create `ApprovalDecision`; `getAuditTrail` returns decisions + system events |
| ORG-08 | 06-01, 06-02 | Admin can configure approval chain templates (default chains, amount thresholds) | SATISFIED | Chain CRUD in settings; `isDefault` management; `conditionsJson` supports amount + contractorType |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/components/approvals/approval-queue/side-panel.tsx` | 74-134 | `MiniChainTracker` uses `Math.max(currentOrder, 1)` to estimate `totalSteps` instead of reading actual flow steps from API | Warning | Mini tracker shows incorrect step count for multi-level chains. Does not block the core approval workflow. Carried over from initial verification — not introduced by 06-06. |

No blocker anti-patterns remain.

---

### Human Verification Required

#### 1. Settings Approvals Tab Position

**Test:** Navigate to Settings and verify the Approvals tab appears between General and Members
**Expected:** Tab order is General | Approvals | Members, with correct i18n label ("Approvals" / "Akceptacje")
**Why human:** Visual tab ordering cannot be verified programmatically

#### 2. End-to-End Approval Flow

**Test:** Create an approval chain in Settings > Approvals with 2 levels. Submit a matched invoice for approval. Verify the queue shows the item with SLA badge, chain tracker appears on invoice detail, and approving step 1 advances to step 2.
**Expected:** Status transitions MATCHED → APPROVAL_PENDING → (after both approvals) APPROVED. Chain tracker shows correct step states.
**Why human:** Requires live database, multi-step user flow across multiple pages

#### 3. Bulk Selection and Bulk Actions

**Test:** On /approvals, check 2 or more rows via the checkbox column. Verify the floating bulk toolbar appears with "Approve All" and "Reject All" buttons. Click "Approve All" and verify success toast shows approved count and selection clears. Change tab or filter and verify selection also clears.
**Expected:** Floating bulk toolbar appears when rows are checked. After approve, toast shows "N approved", toolbar disappears. Tab/filter change resets selection.
**Why human:** Row selection interaction and floating toolbar rendering require interactive testing

#### 4. SLA Color Thresholds

**Test:** With an approval step that has slaHours=24 and deadline set 6h from now (less than 25% remaining), verify badge shows red. With deadline 18h from now (more than 50% remaining), verify green.
**Expected:** Correct colors per D-08 thresholds
**Why human:** Requires time-based data setup

#### 5. SLA Breach Audit Event

**Test:** Let an approval step's SLA deadline expire. Open the invoice detail and check the audit timeline.
**Expected:** Audit timeline shows an SLA breach system event entry with smaller circle marker styling, distinct from human decisions
**Why human:** Requires time-based testing and visual inspection

#### 6. Delegation Flow

**Test:** From the side panel, use "Delegate approval" to reassign a step to another user. Verify the original assignee's queue no longer shows the item and the delegate's queue does.
**Expected:** Real-time queue update after delegation
**Why human:** Requires two users and interactive testing

---

### Gaps Summary

No gaps remain. The single blocker gap from the initial verification (APPR-04 bulk selection wiring) was closed by plan 06-06 (commit `d98be5f`).

All 10 truths are verified. All 10 requirements (APPR-01 through APPR-09 and ORG-08) are satisfied. TypeScript compiles clean with zero errors.

The one remaining warning (MiniChainTracker step count estimate) was present in the initial verification, was not introduced by gap closure, and does not block the phase goal.

Phase 06 goal is achieved. Ready to proceed to phase 07.

---

_Verified: 2026-03-22T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: after gap closure plan 06-06_
