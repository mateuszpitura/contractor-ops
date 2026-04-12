# Phase 8: Payments - Research

**Researched:** 2026-03-22
**Domain:** Payment batch processing, bank file generation (CSV/Elixir/SEPA), bank statement import, idempotency controls
**Confidence:** HIGH

## Summary

Phase 8 implements the final step of the invoice-to-payment pipeline: batching approved invoices into payment runs, exporting bank-compatible files, and tracking payment status. The database schema (PaymentRun, PaymentRunItem, PaymentExport) is already fully defined in `packages/db/prisma/schema/payment.prisma` with all enums, indexes, and relationships. The permission system already includes `payment: ["create", "read", "export"]` with correct role assignments (admin, finance_admin get full access; external_accountant gets read-only).

The main technical challenges are: (1) generating three distinct export formats (CSV, Polish Elixir flat file, SEPA XML pain.001), (2) parsing MT940/CSV bank statements for auto-matching imported payments, (3) maintaining idempotency with the DRAFT->LOCKED->EXPORTED->COMPLETED status machine while preventing duplicate invoice inclusion across runs, and (4) implementing the sequential run numbering (PR-{year}-{seq}) with race-condition safety.

**Primary recommendation:** Build export generators as pure functions in a dedicated `packages/api/src/services/payment-export.ts` service, reusing the existing XLSX library for CSV and hand-rolling Elixir/SEPA since no production-quality npm packages exist for Polish bank formats. Use `prisma.$transaction()` with serializable isolation for run creation and status transitions. Use `mt940js` for MT940 parsing and hand-roll CSV statement parsing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dedicated `/payments` page with payment run history as the primary view. Prominent "New Payment Run" button opens a dialog with invoice selection -- not a separate "ready for payment" tab
- **D-02:** Invoice selection via checkbox table with smart filters (currency, due date range, contractor) + "Select all matching" for bulk. Group-by-currency toggle that auto-creates separate runs per currency
- **D-03:** Auto-generated year-prefixed sequential run number (PR-2026-001) + optional name/description. Finance user can add context like "March contractors" but doesn't have to
- **D-04:** Draft stage before locking -- run starts as DRAFT, user can add/remove invoices, then explicitly locks. Invoices in a draft run are flagged IN_RUN and hidden from the ready pool
- **D-05:** Three export formats: plain CSV (universal fallback), Polish domestic bank format (Elixir/VideoTEL for PLN transfers), and SEPA XML pain.001 for EUR invoices
- **D-06:** CSV columns (standard set): Contractor name, IBAN, amount, currency, invoice number, contractor NIP, bank name, SWIFT/BIC, due date, payment reference
- **D-07:** Transfer title defaults to invoice number (e.g., "FV/2026/03/001"). Configurable template per org in Settings -- pattern supports placeholders like {invoice_number}, {billing_period}. Stored in Organization.settingsJson
- **D-08:** Review step before export -- full invoice list with totals by currency, then "Lock & Export" action. Locking and exporting happen together from this review screen
- **D-09:** Bulk "Mark All Paid" as the happy path (most runs succeed fully), plus per-item override for exceptions. Each item can be individually marked paid/failed with optional reference ID and failure reason
- **D-10:** Payment references optional on both levels -- run-level batch reference from bank + per-item override for individual transaction references
- **D-11:** Failed items auto-release back to "Ready for Payment" pool -- immediately available for inclusion in the next payment run. No manual release step needed
- **D-12:** MT940/CSV bank statement import that auto-matches by amount + IBAN and marks items as paid. Supports the common flow: export run -> upload to bank -> download statement -> import to confirm
- **D-13:** Both application-level and database-level protection -- invoice gets paymentStatus IN_RUN when added to a draft (UI hides from pool) + DB unique constraint prevents invoice in two active runs simultaneously
- **D-14:** Run numbering: PR-{year}-{seq} per org, sequential within calendar year (PR-2026-001, PR-2026-002). Resets each year
- **D-15:** Cancellation rules by status: DRAFT/LOCKED any payment user can cancel; EXPORTED requires admin role + confirmation dialog; COMPLETED cannot be cancelled
- **D-16:** Lock confirmation shows review summary -- invoice count, total by currency, run number -- before committing

### Claude's Discretion
- Payment run dialog layout and step flow
- Table column widths and responsive behavior on /payments page
- Side panel content for payment run rows
- Bank statement import parsing implementation details
- Elixir flat file field mapping specifics
- SEPA XML pain.001 schema version selection
- Empty states for payments page and contractor payments tab
- Error handling for malformed bank statement imports
- Transfer title template editor UI in Settings

### Deferred Ideas (OUT OF SCOPE)
- Open banking / payment initiation API (direct bank integration) -- v2+
- Automated recurring payment schedules -- separate feature
- Payment forecasting / cash flow projections -- Phase 9 dashboard scope
- Multi-bank account management -- v1.5 if needed
- Payment approval workflow (separate from invoice approval) -- v1.5 if needed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | Finance user can view all approved invoices ready for payment | Query invoices WHERE paymentStatus = 'READY' with TanStack Table in new payment run dialog. Approval router currently sets status to APPROVED but not paymentStatus to READY -- need transition logic. |
| PAY-02 | Finance user can select invoices for a payment run (all, by currency, by due date, manual pick) | Checkbox TanStack Table with filters (currency, due date range, contractor). Group-by-currency toggle auto-splits into separate runs. Existing table patterns from invoice-table and contractor-table. |
| PAY-03 | Finance user can export payment run as CSV or bank file format | Three formats: CSV via XLSX library (existing pattern), Elixir flat file (hand-rolled, type 110 comma-delimited), SEPA XML pain.001.001.03 (hand-rolled XML generation). Export stored in PaymentExport model. |
| PAY-04 | Finance user can mark individual items or entire run as paid/failed | Bulk "Mark All Paid" toolbar + per-item popover for status override. Failed items auto-release (paymentStatus back to READY). Uses prisma.$transaction for atomic updates. |
| PAY-05 | System tracks payment reference IDs and prevents duplicate payment runs (idempotency) | DB @@unique([paymentRunId, invoiceId]) prevents duplicates. paymentStatus IN_RUN blocks at app level. Sequential PR-{year}-{seq} run numbers via atomic counter in transaction. |
| PAY-06 | User can view payment run history with summary (total, count, by currency) | /payments page with TanStack Table showing run history. Side panel for run details. Contractor profile Payments tab replaces TabPlaceholder. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xlsx | 0.18.5 | CSV file generation | Already in project for contractor export; reuse json_to_sheet pattern |
| mt940js | 1.3.5 | MT940 bank statement parsing | Most popular JS MT940 parser; parses transactions with amounts, IBANs, dates |
| ibantools | 4.5.1 | IBAN validation and formatting | Already in validators package; use for IBAN extraction and validation in matching |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | (existing) | Invoice selection table + run history table | All table views in this phase |
| nuqs | (existing) | URL state for filters, tabs | Payment history filters, tab state |
| next-intl | (existing) | i18n for all UI strings | All new UI text |
| zod | (existing) | Schema validation | All payment validators |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Elixir format | No npm package exists | Polish Elixir is a simple CSV-like format; hand-rolling is the only option |
| Hand-rolled SEPA XML | sepa (npm v3.0.0) | sepa npm package supports pain.001.001.03 but adds dependency for simple XML generation; hand-roll keeps it dependency-free and customizable |
| Hand-rolled CSV | xlsx library | xlsx already in project, use for consistency with contractor export pattern |

**Installation:**
```bash
cd packages/api && pnpm add mt940js
```

**Version verification:** xlsx 0.18.5, mt940js 1.3.5, ibantools 4.5.1 -- all verified against npm registry 2026-03-22.

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
├── routers/payment.ts             # tRPC router with all payment procedures
├── services/payment-export.ts     # Export generators (CSV, Elixir, SEPA XML)
├── services/bank-statement.ts     # MT940/CSV bank statement parser + matcher
packages/validators/src/
├── payment.ts                     # Zod schemas for payment run creation, status updates
apps/web/src/
├── app/[locale]/(app)/payments/
│   └── page.tsx                   # /payments page with run history
├── components/payments/
│   ├── payment-run-table/         # TanStack Table for run history (mirrors invoice-table)
│   ├── payment-run-side-panel.tsx  # Side panel for run details
│   ├── new-payment-run-dialog/    # Multi-step dialog (Select -> Review -> Export)
│   ├── invoice-selection-table/   # Checkbox table for invoice picking
│   ├── payment-status-toolbar.tsx # Floating bulk action bar
│   ├── bank-statement-dialog.tsx  # Import + match results
│   ├── payment-run-badge.tsx      # Status badge component
│   └── run-review-summary.tsx     # Review step summary card
├── components/contractors/contractor-profile/
│   └── payments-tab.tsx           # Replace TabPlaceholder
├── components/settings/
│   └── transfer-title-settings.tsx # Template editor in Settings
```

### Pattern 1: Payment Run State Machine
**What:** PaymentRun follows DRAFT -> LOCKED -> EXPORTED -> COMPLETED/FAILED/CANCELLED with strict transition rules
**When to use:** Every status mutation
**Example:**
```typescript
// Valid transitions map
const VALID_TRANSITIONS: Record<PaymentRunStatus, PaymentRunStatus[]> = {
  DRAFT: ["LOCKED", "CANCELLED"],
  LOCKED: ["EXPORTED", "CANCELLED"],
  EXPORTED: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [], // terminal
  FAILED: ["DRAFT"], // allow retry
  CANCELLED: [], // terminal
};

// In tRPC router mutation:
if (!VALID_TRANSITIONS[run.status].includes(newStatus)) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Cannot transition from ${run.status} to ${newStatus}`,
  });
}
```

### Pattern 2: Atomic Run Creation with Sequential Numbering
**What:** Run number generation inside a serializable transaction to prevent race conditions
**When to use:** Creating a new payment run
**Example:**
```typescript
const result = await prisma.$transaction(async (tx) => {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  // Get max existing run number for this org+year
  const lastRun = await tx.paymentRun.findFirst({
    where: {
      organizationId,
      runNumber: { startsWith: prefix },
    },
    orderBy: { runNumber: "desc" },
    select: { runNumber: true },
  });

  const seq = lastRun?.runNumber
    ? parseInt(lastRun.runNumber.replace(prefix, ""), 10) + 1
    : 1;

  const runNumber = `${prefix}${String(seq).padStart(3, "0")}`;

  const run = await tx.paymentRun.create({
    data: {
      organizationId,
      runNumber,
      status: "DRAFT",
      currency,
      createdByUserId: userId,
    },
  });

  // Create items + update invoice paymentStatus to IN_RUN
  for (const invoiceId of invoiceIds) {
    await tx.paymentRunItem.create({ data: { ... } });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paymentStatus: "IN_RUN" },
    });
  }

  return run;
});
```

### Pattern 3: Export Generator Service (Pure Functions)
**What:** Each export format as a pure function taking run data, returning Buffer
**When to use:** All export operations
**Example:**
```typescript
// packages/api/src/services/payment-export.ts
export type ExportItem = {
  contractorName: string;
  iban: string;
  amountGrosze: number;
  currency: string;
  invoiceNumber: string;
  taxId: string | null;
  bankName: string | null;
  swiftBic: string | null;
  dueDate: Date;
  transferTitle: string;
};

export function generateCsv(items: ExportItem[]): Buffer { ... }
export function generateElixir(items: ExportItem[]): Buffer { ... }
export function generateSepaXml(items: ExportItem[], orgInfo: OrgInfo): Buffer { ... }
```

### Pattern 4: Bank Statement Auto-Matching
**What:** Parse uploaded MT940/CSV, match transactions to payment run items by amount + IBAN
**When to use:** Bank statement import flow
**Example:**
```typescript
// Match logic: exact amount (grosze) + IBAN substring match
type MatchResult = {
  transactionIndex: number;
  paymentRunItemId: string;
  confidence: "exact" | "partial" | "unmatched";
  amountMatched: boolean;
  ibanMatched: boolean;
};

function matchStatementToRun(
  transactions: ParsedTransaction[],
  items: PaymentRunItemWithInvoice[],
): MatchResult[] { ... }
```

### Anti-Patterns to Avoid
- **Floating-point money calculations:** All amounts are integer grosze. Never convert to float for calculations. Only use `Intl.NumberFormat` for display.
- **Non-transactional status changes:** Every payment status change must be inside `prisma.$transaction()`. Partial state is the #1 risk in payment systems.
- **Optimistic locking without DB constraints:** The `@@unique([paymentRunId, invoiceId])` constraint is the safety net, but also check `paymentStatus !== 'IN_RUN'` before adding to a run.
- **Synchronous file generation for large runs:** For v1 with small org sizes (5-50 contractors), synchronous generation in the tRPC mutation is acceptable. Do not prematurely optimize with background jobs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Custom CSV string builder | xlsx library (json_to_sheet) | Handles escaping, encoding, BOM for Excel compat |
| MT940 parsing | Custom SWIFT message parser | mt940js | MT940 has complex multi-line record structure, tag detection, balance parsing |
| IBAN validation | Regex-based validation | ibantools (already installed) | Handles check digit verification, country-specific length |
| Table with selection | Custom checkbox list | TanStack Table with row selection | Existing pattern in contractor-table and invoice-table |
| File download trigger | Custom anchor/blob handling | Follow existing contractor export pattern (base64 -> Blob -> download) |

**Key insight:** The Elixir bank format and SEPA XML are domain-specific formats that no mainstream npm package handles well for the Polish banking context. Hand-rolling these as pure functions with clear type contracts is the correct approach -- they are essentially string templates with strict field ordering.

## Common Pitfalls

### Pitfall 1: Invoice Status Transition Gap
**What goes wrong:** Approval router sets invoice.status to APPROVED but does NOT update paymentStatus to READY. Invoices remain with paymentStatus NOT_READY after approval.
**Why it happens:** The approval engine in `packages/api/src/services/approval-engine.ts` and the approve mutation in `packages/api/src/routers/approval.ts` only update `status: "APPROVED"` when the flow completes (line 421-424). The `paymentStatus` field is never touched.
**How to avoid:** Phase 8 must add a paymentStatus transition. Two options: (a) extend the approval router's approve mutation to also set `paymentStatus: "READY"` and `readyForPaymentAt: new Date()` when flow completes, or (b) add a separate "mark ready for payment" step. Option (a) is correct per D-01 (no separate "ready for payment" tab).
**Warning signs:** Empty invoice list when opening "New Payment Run" dialog despite having approved invoices.

### Pitfall 2: Race Condition on Run Number Generation
**What goes wrong:** Two concurrent payment run creations get the same sequential number.
**Why it happens:** Reading max run number and creating the new run are two separate queries without serializable isolation.
**How to avoid:** Use `prisma.$transaction()` wrapping both the max-number query and the create. The DB unique index on `runNumber` per org provides the safety net, but the transaction prevents retries.
**Warning signs:** Prisma unique constraint violation errors on paymentRun creation.

### Pitfall 3: Elixir File Encoding
**What goes wrong:** Polish characters in contractor names/addresses are garbled when imported into bank software.
**Why it happens:** Elixir format requires Windows-1250 or CP852 encoding, not UTF-8. Node.js strings are UTF-8 by default.
**How to avoid:** Use `Buffer.from(content, 'utf-8')` then transcode to Windows-1250 using a simple character mapping table or the `iconv-lite` package. Alternatively, strip diacritics for bank files (many Polish banks accept ASCII-only transfer titles).
**Warning signs:** Bank import tool rejects the file or shows mojibake characters.

### Pitfall 4: Orphaned IN_RUN Invoices
**What goes wrong:** An invoice is marked IN_RUN but the payment run is cancelled or fails, leaving the invoice stuck and invisible in the ready pool.
**Why it happens:** Cancellation handler doesn't release all items back to READY.
**How to avoid:** Every cancellation path (DRAFT cancel, LOCKED cancel, EXPORTED admin cancel) must atomically reset all run items' invoices to `paymentStatus: "READY"`. Use D-11's auto-release for failed items.
**Warning signs:** Finance user reports missing invoices that should be ready for payment.

### Pitfall 5: SEPA XML Validation
**What goes wrong:** Generated SEPA XML is rejected by the bank's import system.
**Why it happens:** pain.001 has strict schema requirements (message ID format, payment information ID, debtor/creditor structure, IBAN format, BIC requirements).
**How to avoid:** Use pain.001.001.03 (widest bank support, still accepted through November 2026 per SEPA transition timeline). Validate generated XML structure against known requirements: MsgId max 35 chars, PmtInfId max 35 chars, all amounts as decimal with 2 places, EndToEndId per transaction.
**Warning signs:** Bank rejects XML with "schema validation failed" or "invalid message structure" errors.

### Pitfall 6: Bank Statement Amount Matching Precision
**What goes wrong:** Auto-matching fails because bank statement amounts don't exactly match payment run item amounts.
**Why it happens:** Banks may deduct fees, apply exchange rates, or round differently. Some statements show gross amounts while invoices track net.
**How to avoid:** Match on IBAN first (high confidence), then allow a small tolerance on amount (e.g., +/- 1 grosze for rounding). Flag partial matches for manual review rather than auto-confirming.
**Warning signs:** Low match rate on bank statement import despite all payments being correct.

## Code Examples

### Elixir (Polish Domestic Transfer) File Format

The Elixir format (type 110) is a comma-delimited flat file with quoted text fields. Each line is one transfer order. No header or footer.

```typescript
// Source: Bank Millennium Elixir format specification
// Field layout for type 110 (credit transfer):
// field 1: transaction type (110)
// field 2: execution date (YYYYMMDD)
// field 3: amount in grosze (integer, no decimals)
// field 4: sender bank sort code (8 digits, first 8 of sender IBAN)
// field 5: zero-fill (0)
// field 6: sender account (IBAN, 26 digits without PL prefix)
// field 7: recipient account (IBAN, 26 digits without PL prefix)
// field 8: sender name + address (max 4x35 chars, pipe-delimited lines)
// field 9: recipient name + address (max 4x35 chars, pipe-delimited lines)
// field 10: zero-fill (0)
// field 11: recipient bank sort code (8 digits)
// field 12: transfer title (max 4x35 chars, pipe-delimited lines)
// field 13: empty ("")
// field 14: empty ("")
// field 15: identification type ("1" = NIP, "2" = PESEL, "P" = passport)
// field 16: identification number

function generateElixirLine(item: ExportItem, senderInfo: SenderInfo): string {
  const date = formatDate(item.dueDate, "yyyyMMdd");
  const amountGrosze = String(item.amountGrosze);
  const senderSort = senderInfo.iban.substring(2, 10);
  const senderAccount = senderInfo.iban.substring(2); // strip PL
  const recipientAccount = item.iban.substring(2); // strip PL
  const recipientSort = item.iban.substring(2, 10);

  return [
    "110",
    date,
    amountGrosze,
    senderSort,
    "0",
    `"${senderAccount}"`,
    `"${recipientAccount}"`,
    `"${formatMultiline(senderInfo.name, 4, 35)}"`,
    `"${formatMultiline(item.contractorName, 4, 35)}"`,
    "0",
    recipientSort,
    `"${formatMultiline(item.transferTitle, 4, 35)}"`,
    '""',
    '""',
    `"${item.taxId ? "1" : ""}"`,
    `"${item.taxId ?? ""}"`,
  ].join(",");
}

// Lines separated by \r\n (CRLF), encoding: Windows-1250
```

### SEPA XML pain.001.001.03 Structure

```typescript
// Source: ISO 20022 pain.001.001.03 specification
// Use pain.001.001.03 for maximum bank compatibility (valid through Nov 2026)

function generateSepaXml(
  items: ExportItem[],
  org: { name: string; iban: string; bic: string },
  runNumber: string,
): string {
  const msgId = runNumber.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 35);
  const now = new Date().toISOString();
  const totalAmount = items.reduce((sum, i) => sum + i.amountGrosze, 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${(totalAmount / 100).toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${escapeXml(org.name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${(totalAmount / 100).toFixed(2)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${items[0]?.dueDate.toISOString().slice(0, 10)}</ReqdExctnDt>
      <Dbtr><Nm>${escapeXml(org.name)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${org.iban}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${org.bic}</BIC></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      ${items.map((item, i) => `
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${msgId}-${String(i + 1).padStart(4, "0")}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${(item.amountGrosze / 100).toFixed(2)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>${item.swiftBic ?? "NOTPROVIDED"}</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>${escapeXml(item.contractorName)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${item.iban}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${escapeXml(item.transferTitle)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join("")}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}
```

### MT940 Parsing and Matching

```typescript
// Source: mt940js npm documentation
import { Parser } from "mt940js";

interface ParsedTransaction {
  amount: number; // positive = credit, negative = debit
  currency: string;
  description: string;
  accountIdentification?: string; // counterparty IBAN if available
  date: Date;
  reference?: string;
}

function parseMt940(content: string): ParsedTransaction[] {
  const parser = new Parser();
  const statements = parser.parse(content);

  return statements.flatMap((stmt) =>
    stmt.transactions.map((tx) => ({
      amount: tx.amount,
      currency: stmt.currency,
      description: tx.description ?? "",
      accountIdentification: tx.structuredDetails?.accountIdentification,
      date: tx.date,
      reference: tx.reference,
    })),
  );
}
```

### Transfer Title Template Resolution

```typescript
// Template stored in Organization.settingsJson.paymentTransferTitleTemplate
// Default: "{invoice_number}"
// Supported placeholders: {invoice_number}, {billing_period}, {contractor_name}

function resolveTransferTitle(
  template: string,
  context: {
    invoiceNumber: string;
    billingPeriod?: string;
    contractorName: string;
  },
): string {
  return template
    .replace("{invoice_number}", context.invoiceNumber)
    .replace("{billing_period}", context.billingPeriod ?? "")
    .replace("{contractor_name}", context.contractorName)
    .trim();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SEPA pain.001.001.03 | pain.001.001.09 available | March 2024 | v03 still valid through Nov 2026; use v03 for maximum compatibility |
| Unstructured SEPA addresses | Structured/Hybrid addresses | Nov 2025 | Mandatory structured addresses from Nov 2026; v03 uses unstructured (still ok) |
| MT940 (SWIFT) | camt.053 (ISO 20022) | Gradual migration | MT940 still dominant in Polish banking; support MT940 first, camt.053 in v2 |

**Deprecated/outdated:**
- pain.001.001.02: Fully deprecated, do not use
- VideoTEL format name: Functionally same as Elixir; use "Elixir" as the canonical name

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- no test infrastructure exists in this project |
| Config file | none -- Wave 0 gap |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | Query approved invoices with READY paymentStatus | unit | N/A | N/A |
| PAY-02 | Invoice selection + group-by-currency split | unit | N/A | N/A |
| PAY-03 | CSV/Elixir/SEPA export generation | unit | N/A | N/A |
| PAY-04 | Mark paid/failed with atomic status transitions | unit | N/A | N/A |
| PAY-05 | Idempotency: unique constraint + IN_RUN guard | unit | N/A | N/A |
| PAY-06 | Payment run history query with currency summaries | unit | N/A | N/A |

### Sampling Rate
- No test framework exists; validation is manual-only for this phase

### Wave 0 Gaps
- No test framework configured (vitest, jest, or similar)
- No test files exist in the project
- This is consistent with all prior phases (01-07) which also had no automated tests

## Open Questions

1. **Invoice paymentStatus transition from approval**
   - What we know: Approval router sets `status: "APPROVED"` but never touches `paymentStatus`. The paymentStatus field exists with `NOT_READY` as default.
   - What's unclear: Should Phase 8 extend the approval router to also set `paymentStatus: "READY"`, or should there be a batch job / trigger that transitions approved invoices to READY?
   - Recommendation: Extend the approval router's approve mutation to also set `paymentStatus: "READY"` and `readyForPaymentAt: new Date()` when the approval flow completes. This is the simplest approach and matches D-01 (no separate "mark ready" step). Also add a one-time migration/script to mark already-APPROVED invoices as READY.

2. **Elixir file encoding strategy**
   - What we know: Polish Elixir format requires Windows-1250 or CP852 encoding for Polish diacritics.
   - What's unclear: Whether to add `iconv-lite` dependency or strip diacritics to ASCII.
   - Recommendation: Start with ASCII transliteration (replace diacritics: a->a, e->e, etc.) which most Polish banks accept. Add proper encoding in v1.1 if users report issues. This avoids a new dependency.

3. **Organization sender bank details for exports**
   - What we know: Elixir and SEPA exports require the sender's (organization's) IBAN, BIC, and legal name.
   - What's unclear: Where these are stored. Organization model has metadata but no explicit bank fields.
   - Recommendation: Store organization bank details in `Organization.settingsJson` under a `bankAccount` key (iban, bic, bankName, legalName). Add a settings UI section or extend the existing settings page.

## Sources

### Primary (HIGH confidence)
- `packages/db/prisma/schema/payment.prisma` -- Full PaymentRun, PaymentRunItem, PaymentExport models verified
- `packages/db/prisma/schema/invoice.prisma` -- Invoice paymentStatus field and enum verified
- `packages/auth/src/permissions.ts` -- payment permission ["create", "read", "export"] verified
- `packages/auth/src/roles.ts` -- Role assignments verified (admin, finance_admin: full; external_accountant: read)
- `packages/api/src/routers/approval.ts` -- Approval flow completion behavior verified (only sets status, not paymentStatus)
- `packages/api/src/routers/contractor.ts` -- XLSX export pattern verified (json_to_sheet, base64 return)

### Secondary (MEDIUM confidence)
- [SEPA pain.001 transition timeline](https://l3consulting.de/iso-20022-sepa-formatumstellung-auf-pain-001-001-09/) -- pain.001.001.03 valid through Nov 2026
- [Bank Millennium Elixir format](https://www.bankmillennium.pl/documents/10184/128700/Elixir-0_EN_2012-09-18_Opis_formatu_pliku_platnosci_krajowych_do_importu_w_systemie_Millenet_1363460.pdf) -- Elixir field layout (PDF, could not extract full text but cross-referenced with multiple bank docs)
- [mBank Elixir specification](https://www.mbank.pl/pdf/msp-korporacje/bankowosc-elektroniczna/mbank-companynet-import-export-file-elixir-v-1.082.pdf) -- Field ordering and encoding requirements
- [mt940js npm](https://www.npmjs.com/package/mt940js) -- MT940 parser API verified
- [sepa.js GitHub](https://github.com/kewisch/sepa.js/) -- SEPA XML generation library (evaluated, not recommended)

### Tertiary (LOW confidence)
- Elixir field 15/16 identification type mapping (NIP="1", PESEL="2") -- from web search, needs bank confirmation
- MT940 structured details availability in Polish bank statements -- depends on bank implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries verified in npm, existing patterns confirmed in codebase
- Architecture: HIGH -- follows established project patterns (tRPC routers, services, TanStack Table)
- Bank file formats: MEDIUM -- Elixir format specification could not be fully extracted from PDFs; SEPA pain.001.001.03 well-documented
- Pitfalls: HIGH -- approval status gap verified in source code; idempotency patterns verified in schema

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days -- stable domain, no fast-moving dependencies)
