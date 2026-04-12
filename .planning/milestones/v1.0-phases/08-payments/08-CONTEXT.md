# Phase 8: Payments - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Payment run creation from approved invoices, batch export as CSV, Polish bank format (Elixir), and SEPA XML for EUR. Manual and bulk status tracking with bank statement import for auto-matching. Idempotency controls to prevent duplicate payments. Payment run history with currency summaries. Contractor profile Payments tab. This phase does NOT include open banking / payment initiation (v2+), automated recurring payments, or dashboard KPIs (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Payment run creation flow
- **D-01:** Dedicated `/payments` page with payment run history as the primary view. Prominent "New Payment Run" button opens a dialog with invoice selection — not a separate "ready for payment" tab
- **D-02:** Invoice selection via checkbox table with smart filters (currency, due date range, contractor) + "Select all matching" for bulk. Group-by-currency toggle that auto-creates separate runs per currency
- **D-03:** Auto-generated year-prefixed sequential run number (PR-2026-001) + optional name/description. Finance user can add context like "March contractors" but doesn't have to
- **D-04:** Draft stage before locking — run starts as DRAFT, user can add/remove invoices, then explicitly locks. Invoices in a draft run are flagged IN_RUN and hidden from the ready pool

### Bank file export format & content
- **D-05:** Three export formats: plain CSV (universal fallback), Polish domestic bank format (Elixir/VideoTEL for PLN transfers), and SEPA XML pain.001 for EUR invoices
- **D-06:** CSV columns (standard set): Contractor name, IBAN, amount, currency, invoice number, contractor NIP, bank name, SWIFT/BIC, due date, payment reference
- **D-07:** Transfer title defaults to invoice number (e.g., "FV/2026/03/001"). Configurable template per org in Settings — pattern supports placeholders like {invoice_number}, {billing_period}. Stored in Organization.settingsJson
- **D-08:** Review step before export — full invoice list with totals by currency, then "Lock & Export" action. Locking and exporting happen together from this review screen

### Payment status tracking
- **D-09:** Bulk "Mark All Paid" as the happy path (most runs succeed fully), plus per-item override for exceptions. Each item can be individually marked paid/failed with optional reference ID and failure reason
- **D-10:** Payment references optional on both levels — run-level batch reference from bank + per-item override for individual transaction references
- **D-11:** Failed items auto-release back to "Ready for Payment" pool — immediately available for inclusion in the next payment run. No manual release step needed
- **D-12:** MT940/CSV bank statement import that auto-matches by amount + IBAN and marks items as paid. Supports the common flow: export run → upload to bank → download statement → import to confirm

### Idempotency & safety controls
- **D-13:** Both application-level and database-level protection — invoice gets paymentStatus IN_RUN when added to a draft (UI hides from pool) + DB unique constraint prevents invoice in two active runs simultaneously
- **D-14:** Run numbering: PR-{year}-{seq} per org, sequential within calendar year (PR-2026-001, PR-2026-002). Resets each year
- **D-15:** Cancellation rules by status:
  - DRAFT/LOCKED: any user with payment permission can cancel, invoices release back to pool
  - EXPORTED: requires admin role + confirmation dialog with warning ("A bank file was already exported. Ensure it was NOT submitted to your bank before cancelling.")
  - COMPLETED: cannot be cancelled
- **D-16:** Lock confirmation shows review summary — invoice count, total by currency, run number — before committing

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with payment processing requirements, API contracts, UI views
- `db-schema.md` — Complete database schema including PaymentRun, PaymentRunItem, PaymentExport, ContractorBillingProfile models

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 8 requirements: PAY-01 through PAY-06
- `.planning/ROADMAP.md` — Phase 8 plans and success criteria

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, Stripe Dashboard aesthetic, RBAC with 8 roles, integer grosze pattern, Settings page structure
- `.planning/phases/02-contractor-registry/02-CONTEXT.md` — TanStack Table patterns, side panel, bulk actions with floating toolbar
- `.planning/phases/05-invoice-intake-matching/05-CONTEXT.md` — Invoice status flow, invoice detail page layout, match card, two-step draft flow
- `.planning/phases/06-approval-workflow/06-CONTEXT.md` — Approval chain routing, SLA timers, audit trail timeline, invoice APPROVED status transition

### Prisma schema
- `packages/db/prisma/schema/payment.prisma` — PaymentRun (status, runNumber, totalGrosze, exportFormat), PaymentRunItem (amountGrosze, paymentReference, status), PaymentExport (format, documentId, status)
- `packages/db/prisma/schema/invoice.prisma` — Invoice paymentStatus field (NOT_READY, READY, IN_RUN, PARTIALLY_PAID, PAID, FAILED), paymentRunItems relation
- `packages/db/prisma/schema/contractor.prisma` — ContractorBillingProfile with IBAN, SWIFT, bank name, preferred currency

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/prisma/schema/payment.prisma` — Full PaymentRun, PaymentRunItem, PaymentExport models with all fields, enums, indexes, and relationships already defined
- `apps/web/src/components/invoices/invoice-table/` — Full TanStack Table pattern to follow for payment run invoice selection and run history
- `apps/web/src/components/contractors/contractor-table/data-table-toolbar.tsx` — Bulk action toolbar pattern to reuse for "Mark All Paid" and bulk status updates
- `apps/web/src/components/invoices/invoice-detail/` — Invoice detail page where payment status indicators integrate
- `apps/web/src/components/settings/` — Settings page structure to extend with payment transfer title template config
- `packages/api/src/routers/contractor.ts` — XLSX export pattern (json_to_sheet → book_new → write buffer → base64) reusable for CSV/bank file generation

### Established Patterns
- tRPC routers in `packages/api/src/routers/` with `tenantProcedure` + `requirePermission()` middleware chain
- Validators in `packages/validators/src/` with Zod schemas
- `plain()` helper to strip Prisma class prototypes from tRPC returns
- Integer grosze for all monetary fields with `Intl.NumberFormat` for display formatting
- React Hook Form + Zod resolver for all forms
- `useTranslations()` from next-intl for all UI text
- URL query params via nuqs for page state (filters, tabs)
- `prisma.$transaction()` for atomic multi-step operations (critical for payment run creation and status updates)
- Popover pattern for inline actions (mark failed with reason)
- Side panel pattern for row detail previews

### Integration Points
- Sidebar nav — "Payments" route needs to be configured in `apps/web/src/lib/navigation.ts`
- Contractor profile `profile-tabs.tsx` — Payments tab currently shows TabPlaceholder, needs replacement with payment history filtered to contractor
- Invoice status transition — approval router sets APPROVED, payment system transitions to READY_FOR_PAYMENT → IN_RUN → PAID
- Root tRPC router in `packages/api/src/root.ts` — needs payment router registration
- Auth permissions — payment resource with CRUD + export + mark-paid actions
- Organization `settingsJson` — extend for transfer title template configuration
- Notification dispatch — payment run completed/failed events for Phase 7 notification system

</code_context>

<specifics>
## Specific Ideas

- History-first /payments page matches finance workflow — they check run status daily, create runs weekly
- Group-by-currency auto-split prevents the common mistake of mixing PLN and EUR in one bank upload
- Draft stage gives confidence — finance user can review and adjust before committing real money
- Bank statement import closes the loop — export file to bank, import confirmation back, no manual checking of 30 line items
- Admin-gated cancellation of exported runs prevents accidental double-payment while allowing recovery from genuine mistakes

</specifics>

<deferred>
## Deferred Ideas

- Open banking / payment initiation API (direct bank integration) — v2+
- Automated recurring payment schedules — separate feature
- Payment forecasting / cash flow projections — Phase 9 dashboard scope
- Multi-bank account management — v1.5 if needed
- Payment approval workflow (separate from invoice approval) — v1.5 if needed

</deferred>

---

*Phase: 08-payments*
*Context gathered: 2026-03-22*
