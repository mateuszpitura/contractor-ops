# Phase 5: Invoice Intake & Matching - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Invoice intake via drag-and-drop upload (multi-file batch) and per-org email inbox (Resend Inbound). Metadata entry with header-level totals (line items deferred to v2 OCR). Two-step flow: save draft then submit for matching. Auto-matching engine that matches invoices to contractors by NIP and to active contracts with configurable deviation detection. Duplicate detection with warning banner. Manual matching for unmatched invoices via search pickers. Invoice list page with status chips and TanStack Table. Invoice detail page with side-by-side PDF viewer + metadata form + match card. This phase does NOT include approval workflow (Phase 6) or payment processing (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Invoice upload & metadata
- Multi-file batch upload — DropZone accepts multiple PDFs at once, each creates a separate invoice draft in RECEIVED status. User reviews and fills metadata for each individually
- Inline metadata form on invoice detail page — editable fields: invoice number, issue date, due date, service period, seller NIP, net/VAT/gross amounts, bank account. All editable while in RECEIVED status
- Header-level totals only in v1 — net, VAT rate, VAT amount, gross total, withholding, amount to pay. Line items stored in schema but not exposed in UI until OCR/extraction (v2)
- Two-step flow: save draft then submit for matching — user saves invoice as editable draft (RECEIVED), then explicitly clicks "Submit for matching" to trigger auto-match. Gives control over when matching runs

### Email intake experience
- Org slug subdomain format: invoices@{org-slug}.contractorhub.io — each org gets unique subdomain, parsed from Resend Inbound webhook
- Auto-create draft with notification — email arrives → extract PDF attachment → upload to R2 → create Invoice (RECEIVED, source: EMAIL_INTAKE) → link document → store submittedByEmail → notify user in-app (email notification deferred to Phase 7)
- Accept all attachments, skip non-PDF emails — multiple PDFs create one draft per PDF. Non-PDF attachments accepted as supporting if a PDF is also present. No attachment → log and skip
- Email inbox address visible in Settings page with one-click copy button + inline tip in invoice upload area: "Or email invoices to invoices@acme.contractorhub.io"

### Matching & deviation display
- Match card with confidence indicator on invoice detail page — shows matched contractor (link), matched contract (link), match score, expected vs actual amount, deviation percentage. Green/yellow/red indicator based on match quality
- Manual matching via search pickers in match card — when unmatched, card shows contractor search (by name/NIP) and contract picker (filtered by selected contractor). "Confirm manual match" button records the match
- Configurable deviation threshold per org — Settings > Invoice Matching: default 10% threshold. Also flags: no active contract found, expired contract, currency mismatch
- Duplicate detection via warning banner — SHA256 hash of invoice number + contractor + amount. Warning banner at top of detail page: "Possible duplicate of Invoice #X [View original] [Not a duplicate]". User can dismiss or void

### Invoice list & detail view
- Standalone /invoices page with full TanStack Table — columns: Invoice #, Contractor, Issue date, Due date, Net amount, Gross amount, Currency, Status, Match status, Source (upload/email)
- Status chips above table for quick filtering — clickable chips: All, Received, Matched, Unmatched, Discrepancy, Pending Approval, Approved, Ready for Payment. Each shows count
- Click row opens slide-out side panel with invoice summary, status, match status, amounts, and "Open invoice" button. Same pattern as contractor/contract lists
- Invoice detail page: side-by-side layout — PDF viewer on left (60%), editable metadata form + match card + duplicate warning on right (40%). User sees invoice while filling data
- Contractor profile Invoices tab — shows invoices filtered to that contractor (same TanStack Table, pre-filtered)

### Claude's Discretion
- Invoice side panel width and content layout
- Upload progress indicator design for multi-file batch
- Search debounce timing in manual matching pickers
- Match score calculation algorithm details
- Exact status chip styling and positioning
- Empty states for invoice list and detail
- VAT rate dropdown options (23%, 8%, 5%, 0%, ZW, NP)
- Resend Inbound webhook security validation
- Invoice number format validation rules

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with invoice pipeline requirements (section 11.4), API contracts (section 15), UI views
- `db-schema.md` — Complete database schema including Invoice, InvoiceFile, InvoiceLine, InvoiceMatchResult models

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 5 requirements: INV-01 through INV-10
- `.planning/ROADMAP.md` — Phase 5 plans: invoice upload, email intake, auto-matching, duplicate detection, invoice detail

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, Stripe Dashboard aesthetic, RBAC hidden items, integer grosze
- `.planning/phases/02-contractor-registry/02-CONTEXT.md` — TanStack Table patterns, side panel, NIP validation
- `.planning/phases/03-contracts-documents/03-CONTEXT.md` — Document upload (DropZone, R2 presigned URLs), inline PDF preview, virus scanning

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/prisma/schema/invoice.prisma` — Full Invoice, InvoiceFile, InvoiceLine, InvoiceMatchResult models with all fields, enums, indexes, and relationships already defined
- `apps/web/src/components/documents/drop-zone.tsx` — Reusable DropZone for invoice PDF upload (accepts entityType + entityId for linking)
- `apps/web/src/components/documents/document-card.tsx` — DocumentCard for file display with scan status badges
- `apps/web/src/components/documents/pdf-preview.tsx` — PDF preview via browser-native `<object>` tag
- `apps/web/src/components/contracts/contract-table/` — Full TanStack Table pattern to follow for invoice list
- `packages/api/src/services/r2.ts` — R2 storage service with presigned URL generation
- `packages/api/src/services/mime-validator.ts` — MIME validation via magic bytes
- `packages/api/src/services/virus-scanner.ts` — ClamAV virus scanner wrapper
- `packages/api/src/routers/document.ts` — Document tRPC router for upload/download flow

### Established Patterns
- tRPC routers in `packages/api/src/routers/` with `tenantProcedure` + `requirePermission()` middleware chain
- Validators in `packages/validators/src/` with Zod schemas
- `plain()` helper to strip Prisma class prototypes from tRPC returns
- React Hook Form + Zod resolver for all forms
- `useTranslations()` from next-intl for all UI text
- URL query params via nuqs for page state (status chips, filters)
- PostgreSQL tsvector for full-text search
- `prisma.$transaction()` for atomic multi-step operations
- DocumentLink polymorphic linking (entityType=INVOICE for invoice attachments)
- NIP validation already in `packages/validators/src/contractor.ts` (isValidNip)

### Integration Points
- Sidebar nav "Invoices" already configured in `apps/web/src/lib/navigation.ts` with route /invoices and invoice permission
- Contractor profile `profile-tabs.tsx` — Invoices tab currently shows TabPlaceholder (Phase 5), needs replacement
- Root tRPC router in `packages/api/src/root.ts` — needs invoice router registration
- Auth permissions — invoice resource with CRUD + match actions
- Contractor `sellerTaxId` (NIP) on Invoice matches contractor NIP for auto-matching
- Contract `rateValueGrosze` and `billingModel` for expected amount calculation in deviation detection
- Organization `settingsJson` — already used for expiry reminder defaults (Phase 3), extend for deviation threshold

</code_context>

<specifics>
## Specific Ideas

- Side-by-side PDF + metadata layout is the key UX differentiator — user sees the invoice PDF while entering data, reducing errors and speeding up processing
- Status chips give an instant pipeline overview — how many invoices need attention at each stage
- Multi-file batch upload handles the real-world pattern: finance team receives a stack of invoices monthly
- Match card with confidence indicator makes the auto-matching transparent — user can see exactly why a match was made and what deviated
- Two-step flow (draft → submit for matching) prevents premature matching on incomplete metadata

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-invoice-intake-matching*
*Context gathered: 2026-03-21*
