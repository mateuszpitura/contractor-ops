---
phase: 08-payments
verified: 2026-03-22T00:00:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 08: Payments Verification Report

**Phase Goal:** Finance users can batch approved invoices into payment runs, export bank-compatible files, and track payment status with idempotency safeguards
**Verified:** 2026-03-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status     | Evidence                                                                                                         |
|----|-----------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------|
| 1  | Vitest is configured and runs in the api package                                               | VERIFIED   | `packages/api/vitest.config.ts` exists (>5 lines), `"test": "vitest run"` in package.json                       |
| 2  | Test stub files exist for payment router and export services                                   | VERIFIED   | Both `__tests__/payment.test.ts` and `__tests__/payment-export.test.ts` exist with >20 lines of `it.todo()` stubs |
| 3  | Approved invoices transition to `paymentStatus: READY` when approval flow completes            | VERIFIED   | Lines 425–426 and 817–818 in approval.ts: `paymentStatus: "READY", readyForPaymentAt: new Date()`               |
| 4  | Payment runs follow DRAFT→LOCKED→EXPORTED→COMPLETED state machine                             | VERIFIED   | `VALID_TRANSITIONS` map at line 47 in payment.ts; transitions enforced in lockAndExport, cancel mutations        |
| 5  | Sequential run numbering PR-{year}-{seq} is race-condition safe via transaction                | VERIFIED   | `prisma.$transaction` wraps create; `findFirst...orderBy: desc` then increment inside transaction (lines 182–197) |
| 6  | Invoices in a draft run get `paymentStatus: IN_RUN` and are excluded from the ready pool       | VERIFIED   | Line 237 in payment.ts: `data: { paymentStatus: "IN_RUN" }`. readyForPayment query filters `paymentStatus: "READY"` |
| 7  | User can remove invoices from a DRAFT run, resetting their `paymentStatus` to READY            | VERIFIED   | `removeFromRun` procedure at line 865; deletes item, sets invoice to READY, recalculates totals; side panel shows "Remove from run" only for DRAFT status |
| 8  | Export generates valid CSV, Elixir flat file, and SEPA XML pain.001.001.03                     | VERIFIED   | `generateCsv`, `generateElixir`, `generateSepaXml` exported from `payment-export.ts`; called from `lockAndExport` mutation (lines 449–455); SEPA namespace `pain.001.001.03` at line 238 of export service |
| 9  | Bank statement MT940/CSV parsing matches transactions to run items by amount+IBAN               | VERIFIED   | `parseBankStatement`, `matchStatementToRun` in `bank-statement.ts` (308 lines); mt940js installed as dependency  |
| 10 | Failed/cancelled items auto-release invoices back to READY status                              | VERIFIED   | Lines 540, 693, 915 in payment.ts: `paymentStatus: "READY"` on failure, cancellation, removeFromRun             |
| 11 | Finance user can see payment run history table on /payments page                               | VERIFIED   | `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx` (296 lines); `trpc.payment.list.queryOptions()` at line 78 |
| 12 | Finance user can navigate to /payments via sidebar navigation                                  | VERIFIED   | `navigation.ts` lines 77–80: `key: "payments"`, `href: "/payments"`, `icon: Banknote`                           |
| 13 | Finance user can open new payment run dialog, select invoices, review, lock+export             | VERIFIED   | 3-step dialog in `new-payment-run-dialog/`; `payment.create` + `payment.lockAndExport` mutations in step-review; `payment.readyForPayment` query in step-select |
| 14 | Contractor profile Payments tab shows payment history filtered to that contractor              | VERIFIED   | `tab-payments.tsx` (315 lines); `trpc.payment.listByContractor.queryOptions({ contractorId })` at line 77; wired via `contractors/[id]/page.tsx` line 165 |
| 15 | All payment UI strings have EN and PL translations in Payments namespace                       | VERIFIED   | `messages/en.json` and `messages/pl.json` both contain `Payments` key with 144 keys each; all D-04 strings present |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact                                                                   | Expected                                             | Status     | Details                                                |
|----------------------------------------------------------------------------|------------------------------------------------------|------------|--------------------------------------------------------|
| `packages/api/vitest.config.ts`                                            | Vitest config for api package                        | VERIFIED   | Exists, >5 lines, node environment, includes test pattern |
| `packages/api/src/routers/__tests__/payment.test.ts`                       | Test stubs for payment router                        | VERIFIED   | Exists, >20 lines, it.todo() stubs for all procedures  |
| `packages/api/src/services/__tests__/payment-export.test.ts`               | Test stubs for export generators                     | VERIFIED   | Exists, >20 lines, it.todo() stubs for all generators  |
| `packages/validators/src/payment.ts`                                       | Zod schemas for payment CRUD                         | VERIFIED   | 154 lines; exports all 9 required schemas              |
| `packages/api/src/routers/payment.ts`                                      | tRPC router with full payment lifecycle              | VERIFIED   | 980 lines; 12 procedures, VALID_TRANSITIONS map, permissions |
| `packages/api/src/services/payment-export.ts`                              | CSV, Elixir, SEPA XML generators                     | VERIFIED   | 285 lines; generateCsv, generateElixir, generateSepaXml, stripDiacritics |
| `packages/api/src/services/bank-statement.ts`                              | MT940/CSV parser and matcher                         | VERIFIED   | 308 lines; parseBankStatement, matchStatementToRun     |
| `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx`                  | /payments page with table and side panel             | VERIFIED   | 296 lines; Suspense, trpc.payment.list, NewPaymentRunDialog, PaymentRunSidePanel |
| `apps/web/src/components/payments/new-payment-run-dialog/index.tsx`        | 3-step dialog for payment run creation               | VERIFIED   | 151 lines; StepSelect/StepReview/StepConfirmation wired |
| `apps/web/src/components/payments/payment-run-side-panel.tsx`              | Side panel with run details and actions              | VERIFIED   | 703 lines; get, markAllPaid, cancel, removeFromRun, updateItemStatus, AlertDialog |
| `apps/web/src/components/payments/bank-statement-dialog.tsx`               | Bank statement upload, parse, match, confirm         | VERIFIED   | 380 lines; importStatement + confirmStatementMatches mutations |
| `apps/web/src/components/contractors/contractor-profile/tab-payments.tsx`  | Contractor-scoped payment history tab                | VERIFIED   | 315 lines; listByContractor query, empty state, mini table |
| `apps/web/src/components/settings/transfer-title-settings.tsx`             | Transfer title template editor card                  | VERIFIED   | 165 lines; settings.get + settings.update, preview, RHF+Zod |
| `apps/web/messages/en.json` (Payments namespace)                           | English translations (144 keys)                      | VERIFIED   | Actual path differs from PLAN (flat file vs split), but all keys present |
| `apps/web/messages/pl.json` (Payments namespace)                           | Polish translations (144 keys)                       | VERIFIED   | Same divergence from PLAN path; all keys including D-04 strings present |

### Key Link Verification

| From                                              | To                                          | Via                                           | Status   | Details                                                                 |
|---------------------------------------------------|---------------------------------------------|-----------------------------------------------|----------|-------------------------------------------------------------------------|
| `packages/api/vitest.config.ts`                   | `packages/api/package.json`                 | `"test": "vitest run"` script                 | WIRED    | package.json line 35: `"test": "vitest run"`                            |
| `packages/api/src/routers/approval.ts`            | `invoice.paymentStatus`                     | `paymentStatus: "READY"` in approve mutation  | WIRED    | Lines 425–426 and 817–818 in approval.ts                                |
| `packages/api/src/routers/payment.ts`             | `packages/api/src/services/payment-export.ts` | import and call in lockAndExport            | WIRED    | Imported at lines 19–21; called at lines 449–455 per export format      |
| `packages/api/src/root.ts`                        | `packages/api/src/routers/payment.ts`       | `payment: paymentRouter` registration         | WIRED    | Lines 14 and 46 in root.ts                                              |
| `apps/web/src/lib/navigation.ts`                  | `/payments` route                           | Payments nav item                             | WIRED    | Lines 77–80: key, label, href, Banknote icon                            |
| `new-payment-run-dialog/index.tsx`                | `payment.create` tRPC mutation              | `trpc.payment.create.mutationOptions`         | WIRED    | step-review.tsx line 114                                                |
| `payment-run-side-panel.tsx`                      | `payment.markAllPaid` tRPC mutation         | `trpc.payment.markAllPaid.mutationOptions`    | WIRED    | side-panel.tsx line 120                                                 |
| `payment-run-side-panel.tsx`                      | `payment.removeFromRun` tRPC mutation       | `trpc.payment.removeFromRun.mutationOptions`  | WIRED    | side-panel.tsx line 157; visible only for DRAFT status (line 474)       |
| `payments/page.tsx`                               | `payment.list` tRPC query                   | `trpc.payment.list.queryOptions`              | WIRED    | page.tsx line 78                                                        |
| `contractors/[id]/page.tsx`                       | `tab-payments.tsx`                          | `paymentsContent={<TabPayments contractorId>}` | WIRED   | [id]/page.tsx lines 29 and 165; profile-tabs renders via `paymentsContent` prop |
| `settings/page.tsx`                               | `transfer-title-settings.tsx`               | Direct import and render                      | WIRED    | settings/page.tsx lines 8 and 75                                        |

### Requirements Coverage

| Requirement | Source Plans       | Description                                                                                 | Status    | Evidence                                                              |
|-------------|--------------------|---------------------------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------|
| PAY-01      | 08-00, 08-01, 08-02, 08-03 | Finance user can view all approved invoices ready for payment                  | SATISFIED | `readyForPayment` procedure filters `paymentStatus: "READY"`; step-select shows ready invoice table |
| PAY-02      | 08-01, 08-02, 08-03 | Finance user can select invoices for a payment run (all, by currency, by due date, manual)  | SATISFIED | step-select has currency filter, due date range, contractor search, select-all; groupByCurrency switch |
| PAY-03      | 08-01, 08-02, 08-03 | Finance user can export payment run as CSV or bank file format                              | SATISFIED | generateCsv, generateElixir (Elixir bank file), generateSepaXml; lockAndExport returns base64 file; step-confirmation downloads it |
| PAY-04      | 08-01, 08-02, 08-03 | Finance user can mark individual items or entire run as paid/failed                         | SATISFIED | `updateItemStatus` (individual), `markAllPaid` (bulk); auto-releases failed items to READY |
| PAY-05      | 08-00, 08-01, 08-02 | System tracks payment reference IDs and prevents duplicate payment runs (idempotency)       | SATISFIED | `paymentStatus: "IN_RUN"` blocks invoice from `readyForPayment` pool; validation at line 147–154 rejects non-READY invoices; run creation in `$transaction` with sequential numbering |
| PAY-06      | 08-01, 08-02, 08-03 | User can view payment run history with summary (total, count, by currency)                  | SATISFIED | `list` query with pagination; payments page table with runNumber, status, invoiceCount, totalGrosze, exportFormat columns |

### Implementation Divergences from PLAN (Non-Blocking)

These divergences represent valid alternative implementations that achieve the same functional outcome:

1. **Payments page path**: PLAN declared `apps/web/src/app/[locale]/(app)/payments/page.tsx`. Actual path is `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx`. The project uses `(dashboard)` as the authenticated app group, not `(app)`. Route resolves to `/payments` either way.

2. **i18n file structure**: PLANs 03 declared separate files at `apps/web/src/messages/en/Payments.json`. Actual implementation uses consolidated flat files at `apps/web/messages/en.json` with `Payments` as a top-level namespace key (144 keys each). This is the established project pattern for i18n.

3. **TransferTitleSettings integration**: PLAN key_link specified `settings-tabs.tsx` as the consumer. Actual consumer is `settings/page.tsx` directly (import line 8, render line 75). The component is rendered and functional; the enclosing element differs but the outcome is the same.

4. **TabPayments integration**: PLAN key_link specified `profile-tabs.tsx` as the direct importer. Actual wiring: `contractors/[id]/page.tsx` imports `TabPayments` (line 29) and passes it as `paymentsContent` prop to `ProfileTabs` (line 165), which renders it in the payments tab slot (profile-tabs.tsx line 96). This is the established pattern for that component's architecture.

### Anti-Patterns Found

No blockers or warnings found. Scanned:
- `packages/api/src/routers/payment.ts` — no TODO/FIXME/placeholder comments
- `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx` — no stubs, proper data fetching
- `apps/web/src/components/payments/payment-run-side-panel.tsx` — no placeholders
- `apps/web/src/components/payments/new-payment-run-dialog/index.tsx` — no placeholders
- `apps/web/src/components/payments/bank-statement-dialog.tsx` — no placeholders

### Human Verification Required

### 1. 3-Step Dialog UX Flow

**Test:** Open /payments, click "New payment run", step through select → review → confirmation, lock and export in each of CSV, Elixir, and SEPA XML formats.
**Expected:** Step indicator shows active/completed state; invoice selection table is filterable; review screen groups by currency when toggle is on; lock+export generates a downloadable file in each format; confirmation step shows success with correct metadata.
**Why human:** Multi-step dialog interaction, file download triggering, and format correctness cannot be verified statically.

### 2. Bank Statement Import Flow

**Test:** On an EXPORTED payment run, click "Import statement", upload a .csv or .mt940 file, verify parsing, check auto-match results table, confirm matches.
**Expected:** Parsing shows matched/unmatched items; matched rows are pre-checked; confirming updates item statuses and auto-completes run if all terminal.
**Why human:** File parsing UX, MT940 parsing correctness with real bank files, and match table rendering require runtime verification.

### 3. Remove from Run (D-04)

**Test:** Create a DRAFT run, open its side panel, attempt to remove an invoice from the per-item dropdown.
**Expected:** "Remove from run" action is visible for DRAFT status only; after removal, the invoice reappears in the ready-for-payment list; run totals update correctly.
**Why human:** State transition and real-time UI update must be observed in a running app.

### 4. Elixir Export Format Correctness

**Test:** Generate an Elixir export from a PLN payment run and inspect the output file.
**Expected:** File starts with `110,`, lines end with CRLF, Polish diacritics are stripped to ASCII, amounts are integer grosze (no decimal), pipe-delimited multiline fields for sender/recipient names.
**Why human:** Binary file format correctness cannot be verified by static analysis alone.

### 5. Payment Status Tracking via Approval

**Test:** Approve an invoice through the full approval flow; then navigate to /payments.
**Expected:** The invoice appears in the "Ready for payment" pool (readyForPayment query) immediately after approval completes.
**Why human:** Requires end-to-end flow through the approval → payment lifecycle.

---

_Verified: 2026-03-22_
_Verifier: Claude (gsd-verifier)_
