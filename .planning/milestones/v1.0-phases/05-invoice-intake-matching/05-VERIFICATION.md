---
phase: 05-invoice-intake-matching
verified: 2026-03-21T00:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
---

# Phase 5: Invoice Intake & Matching — Verification Report

**Phase Goal:** Invoice intake via email/upload, auto-matching to contractors, status workflow
**Verified:** 2026-03-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Invoice can be created in RECEIVED status with metadata and linked document | VERIFIED | `invoiceRouter.create` sets `status: "RECEIVED"`, `source: "MANUAL_UPLOAD"`, creates `InvoiceFile` links |
| 2 | Invoice metadata can be updated while in RECEIVED status only | VERIFIED | `invoiceRouter.update` checks `existing.status !== "RECEIVED"` and throws `BAD_REQUEST` otherwise |
| 3 | Submitting for matching runs NIP-based contractor lookup and contract deviation detection | VERIFIED | `submitForMatching` calls `runAutoMatch`; engine does NIP lookup via `prisma.contractor.findFirst`, scores and detects deviations |
| 4 | Duplicate check hash is computed on create and update | VERIFIED | `create` calls `computeDuplicateCheckHash`; `update` recomputes when `invoiceNumber`, `sellerTaxId`, or `totalGrosze` change |
| 5 | Manual matching links invoice to contractor and contract with MANUALLY_CONFIRMED status | VERIFIED | `manualMatch` creates `InvoiceMatchResult` with `matchedBy: "MANUAL"`, `status: "MANUALLY_CONFIRMED"` and updates invoice |
| 6 | Status counts query returns counts grouped by status and matchStatus | VERIFIED | `statusCounts` uses `prisma.invoice.groupBy` on both `status` and `matchStatus`, returns prefixed keys |
| 7 | Resend Inbound webhook receives email.received events and verifies signature | VERIFIED | `route.ts` calls `resend.webhooks.verify()`, returns 401 on failure, 500 if `RESEND_WEBHOOK_SECRET` unset |
| 8 | Org slug is parsed from recipient email address | VERIFIED | `parseOrgSlugFromEmail()` handles both plain and "Display Name <email>" formats, checks `.contractorhub.io` suffix |
| 9 | PDF attachments are fetched via Resend Receiving API and uploaded to R2 | VERIFIED | Calls `resend.emails.receiving.attachments.get()`, downloads PDF, sends `PutObjectCommand` to R2 |
| 10 | Each PDF attachment creates a separate Invoice draft in RECEIVED status with source EMAIL_INTAKE | VERIFIED | Each attachment creates `prisma.invoice.create` with `source: "EMAIL_INTAKE"`, `status: "RECEIVED"` |
| 11 | User can see invoice list with all columns and status chip bar | VERIFIED | `InvoiceDataTable` renders 10 columns; `StatusChipBar` fetches live counts via `trpc.invoice.statusCounts` |
| 12 | User can upload multiple PDFs via drag and drop, each creating a separate invoice draft | VERIFIED | `InvoiceUploadArea` accepts `multiple: true`, calls `trpc.document.requestUpload` then `trpc.invoice.create` per file |
| 13 | User can view invoice detail with PDF on left (60%) and metadata on right (40%) | VERIFIED | `InvoiceDetailLayout` uses `grid-cols-[60%_1fr]` with sticky left column; PDF rendered via `<object>` tag |
| 14 | User can edit invoice metadata fields when status is RECEIVED | VERIFIED | `InvoiceMetadataForm` uses React Hook Form + Zod, calls `trpc.invoice.update`; fields disabled when not RECEIVED |
| 15 | Match card shows matched contractor, contract, confidence, and deviation | VERIFIED | `MatchCard` renders confidence dot, contractor/contract links, deviation %, flags from `explanationJson` |
| 16 | Unmatched invoices show contractor search picker and contract picker for manual matching | VERIFIED | `MatchCard` shows `Command` component for contractor search via `trpc.invoice.searchContractors`, `Select` for contracts |
| 17 | Duplicate warning banner appears and can be dismissed | VERIFIED | `DuplicateWarning` renders with `border-l-[3px] border-l-destructive`, calls `trpc.invoice.dismissDuplicate` |
| 18 | Contractor profile Invoices tab shows invoices filtered to that contractor | VERIFIED | `InvoicesTab` passes `contractorId` to `trpc.invoice.list.queryOptions`, wired in `contractors/[id]/page.tsx` |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|---------|--------|---------|
| `packages/validators/src/invoice.ts` | Zod schemas for invoice CRUD and matching | VERIFIED | Exports `invoiceCreateSchema`, `invoiceUpdateSchema`, `invoiceListSchema`, `invoiceManualMatchSchema` with all required fields |
| `packages/api/src/services/invoice-matching.ts` | Auto-matching engine | VERIFIED | Exports `computeDuplicateCheckHash` (SHA-256) and `runAutoMatch` (6-step pipeline: NIP, contracts, scoring, deviation, flags, duplicate) |
| `packages/api/src/routers/invoice.ts` | Invoice tRPC router | VERIFIED | 11 procedures: `create`, `getById`, `update`, `list`, `statusCounts`, `submitForMatching`, `manualMatch`, `voidInvoice`, `dismissDuplicate`, `searchContractors`, `contractsForContractor` |
| `packages/api/src/root.ts` | Router registration | VERIFIED | `invoice: invoiceRouter` added, JSDoc updated |
| `apps/web/src/app/api/webhooks/resend-inbound/route.ts` | Email intake webhook | VERIFIED | POST handler with signature verification, org slug parsing, R2 upload, prisma invoice creation |
| `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` | Invoice list page | VERIFIED | Suspense-wrapped, contains `StatusChipBar`, `InvoiceDataTable`, `InvoiceSidePanel`, `InvoiceUploadArea` |
| `apps/web/src/components/invoices/invoice-table/data-table.tsx` | TanStack Table | VERIFIED | `manualPagination: true`, fetches via `trpc.invoice.list`, overdue row highlighting |
| `apps/web/src/components/invoices/status-chip-bar.tsx` | Status filter chips | VERIFIED | Fetches `trpc.invoice.statusCounts`, 8 chips with live counts, nuqs URL state |
| `apps/web/src/components/invoices/invoice-side-panel.tsx` | Slide-out sheet | VERIFIED | Sheet component, shows amounts/dates/matching sections, "Open invoice" link |
| `apps/web/src/components/invoices/invoice-upload-area.tsx` | Multi-file PDF upload | VERIFIED | `multiple: true`, presigned URL upload flow, per-file `trpc.invoice.create` |
| `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` | Invoice detail page | VERIFIED | Breadcrumb, fetches `trpc.invoice.getById` and `trpc.document.getDownloadUrl`, renders all sub-components |
| `apps/web/src/components/invoices/invoice-detail/invoice-detail-layout.tsx` | 60/40 split layout | VERIFIED | CSS grid `grid-cols-[60%_1fr]`, sticky PDF, responsive stacking at `lg:` breakpoint |
| `apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx` | Metadata form | VERIFIED | React Hook Form + Zod, 14 fields, calls `trpc.invoice.update` (save draft) and `trpc.invoice.submitForMatching` |
| `apps/web/src/components/invoices/invoice-detail/match-card.tsx` | Match results and manual matching | VERIFIED | Confidence indicator, contractor/contract links, deviation %, `Command` search via `trpc.invoice.searchContractors`, `trpc.invoice.manualMatch` |
| `apps/web/src/components/invoices/invoice-detail/duplicate-warning.tsx` | Duplicate detection banner | VERIFIED | `border-l-[3px] border-l-destructive`, view original link, `trpc.invoice.dismissDuplicate` |
| `apps/web/src/components/contractors/contractor-profile/tabs/invoices-tab.tsx` | Contractor profile Invoices tab | VERIFIED | Pre-filtered by `contractorId`, wired in `contractors/[id]/page.tsx` as `invoicesContent` |
| `apps/web/messages/en.json` | English translations (Invoices namespace) | VERIFIED | Nested namespace with `chips`, `duplicate`, `detail`, `match`, `tab`, `upload`, `sidePanel`, `empty`, `status`, `matchStatus` sections |
| `apps/web/messages/pl.json` | Polish translations (Invoices namespace) | VERIFIED | All EN keys present in PL; `pageTitle: "Faktury"`, `chips.all: "Wszystkie"`, `duplicate.heading` confirmed |
| `apps/web/src/components/settings/invoice-matching-settings.tsx` | Settings invoice section | VERIFIED | Email inbox display with clipboard copy, deviation threshold input, `trpc.settings.updateInvoiceSettings` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routers/invoice.ts` | `services/invoice-matching.ts` | `submitForMatching` calls `runAutoMatch` | WIRED | Direct import and call with `prisma`, `ctx.organizationId`, invoice fields, `deviationThreshold` |
| `routers/invoice.ts` | `validators/src/invoice.ts` | `.input(invoiceCreateSchema)` etc. | WIRED | All 4 schemas imported and used as `.input()` on corresponding procedures |
| `root.ts` | `routers/invoice.ts` | `invoice: invoiceRouter` | WIRED | Import and registration confirmed |
| `webhooks/resend-inbound/route.ts` | R2 (S3Client) | `PutObjectCommand` upload | WIRED | Direct `S3Client` + `PutObjectCommand` with buffer from downloaded PDF |
| `webhooks/resend-inbound/route.ts` | `prisma.invoice.create` | Creates invoice drafts from email | WIRED | Called per PDF attachment with `source: "EMAIL_INTAKE"`, `status: "RECEIVED"` |
| `data-table.tsx` | `trpc.invoice.list` | `useQuery(trpc.invoice.list.queryOptions(...))` | WIRED | URL state mapped to query input, result destructured to `items` and `totalCount` |
| `status-chip-bar.tsx` | `trpc.invoice.statusCounts` | `useQuery(trpc.invoice.statusCounts.queryOptions())` | WIRED | Counts used to compute totals per chip |
| `invoice-upload-area.tsx` | `trpc.document.requestUpload` | Presigned URL flow | WIRED | Mutation called for each file before upload |
| `invoice-metadata-form.tsx` | `trpc.invoice.update` | Save draft mutation | WIRED | `useMutation(trpc.invoice.update.mutationOptions(...))` |
| `invoice-metadata-form.tsx` | `trpc.invoice.submitForMatching` | Submit for matching mutation | WIRED | `useMutation(trpc.invoice.submitForMatching.mutationOptions(...))` |
| `match-card.tsx` | `trpc.invoice.manualMatch` | Confirm match mutation | WIRED | `useMutation(trpc.invoice.manualMatch.mutationOptions(...))` |
| `match-card.tsx` | `trpc.invoice.searchContractors` | Contractor search query | WIRED | `trpc.invoice.searchContractors.queryOptions({ query: ... })` with debounce |
| `duplicate-warning.tsx` | `trpc.invoice.dismissDuplicate` | Dismiss mutation | WIRED | `useMutation(trpc.invoice.dismissDuplicate.mutationOptions(...))` |
| `invoices-tab.tsx` | `trpc.invoice.list` | Pre-filtered by `contractorId` | WIRED | `contractorId` passed in `filters` object to list query |
| `contractors/[id]/page.tsx` | `invoices-tab.tsx` | `invoicesContent={<InvoicesTab contractorId={...} />}` | WIRED | Imported and passed as prop to `ProfileTabs` |
| `invoice-matching-settings.tsx` | `trpc.settings.updateInvoiceSettings` | Saves deviation threshold | WIRED | `useMutation(trpc.settings.updateInvoiceSettings.mutationOptions(...))` |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| INV-01 | 05-01, 05-03 | User can upload invoices via drag & drop (single or multi-file) | SATISFIED | `InvoiceUploadArea` with `multiple: true`, presigned URL per file, `trpc.invoice.create` per document |
| INV-02 | 05-02 | System receives invoices via dedicated email inbox per organization | SATISFIED | Resend Inbound webhook at `/api/webhooks/resend-inbound/route.ts`; org slug parsed from recipient; invoice created with `source: EMAIL_INTAKE` |
| INV-03 | 05-01, 05-04 | User can enter/edit invoice metadata | SATISFIED | `InvoiceMetadataForm` with 14 fields (number, dates, amounts, NIP, bank account, billing period); editable in RECEIVED status only |
| INV-04 | 05-01 | System auto-matches invoices to contractors by NIP | SATISFIED | `runAutoMatch` step 1: `prisma.contractor.findFirst` where `taxId === sellerTaxId`; +50 score for NIP match |
| INV-05 | 05-01 | System auto-matches to active contracts and calculates expected vs actual amount | SATISFIED | `runAutoMatch` steps 2-4: finds ACTIVE/EXPIRING contracts, picks closest by `rateValueGrosze`, computes `amountDeltaGrosze` and `amountDeltaPercent` |
| INV-06 | 05-01, 05-05 | System flags deviations above configurable threshold | SATISFIED | `runAutoMatch` generates `NO_ACTIVE_CONTRACT`, `EXPIRED_CONTRACT`, `CURRENCY_MISMATCH` flags; `invoiceDeviationThresholdPercent` configurable in settings |
| INV-07 | 05-01 | System detects duplicate invoices by invoice number + contractor + amount | SATISFIED | `computeDuplicateCheckHash` uses SHA-256 of `invoiceNumber|sellerTaxId|totalGrosze`; step 6 of `runAutoMatch` queries for hash match |
| INV-08 | 05-01, 05-03 | Invoice follows status flow | SATISFIED | `statusCounts` groups by all `InvoiceStatus` values; `submitForMatching` transitions to `UNDER_REVIEW`; `voidInvoice` transitions to `VOID` |
| INV-09 | 05-01, 05-04 | User can manually match unmatched invoices | SATISFIED | `MatchCard` unmatched state shows `Command` contractor search + contract `Select`; `trpc.invoice.manualMatch` creates `MANUALLY_CONFIRMED` result |
| INV-10 | 05-03, 05-04, 05-05 | User can view invoice detail with linked contractor, contract, and embedded PDF viewer | SATISFIED | `/invoices/[id]` page: 60/40 split layout with `<object>` PDF viewer, `MatchCard` with contractor/contract links, breadcrumb, status badge |

All 10 requirements (INV-01 through INV-10) are satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `webhooks/resend-inbound/route.ts` | 246-247 | Invoice created with empty `invoiceNumber: ""` and zeroed monetary fields (`subtotalGrosze: 0`, `totalGrosze: 0`) | Info | Expected for email intake — fields are filled in manually or via OCR later. Not a stub; this is intentional draft state. |
| `invoice-detail-layout.tsx` | 38-41 | Hardcoded "PDF preview is not available in your browser." fallback text | Info | Minor: fallback text is not translated. Does not affect goal achievement. |
| `invoice-matching-settings.tsx` | 59 | `toast.error("Failed to update invoice settings")` — hardcoded English string | Info | Error toast not from i18n. Does not block functionality. |

No blocker or warning-level anti-patterns found. All `return null` occurrences are conditional guards (e.g., `if (!invoice) return null` in side panel, `if (options.length === 0) return null` in filters), not stub implementations.

---

### Human Verification Required

#### 1. Email intake end-to-end flow

**Test:** Configure Resend Inbound webhook with a real domain, send an email with a PDF attachment to `invoices@{slug}.contractorhub.io`
**Expected:** Invoice appears in `/invoices` list with `source: EMAIL_INTAKE`, PDF viewable in detail page
**Why human:** Requires live Resend configuration, MX records, and real email delivery

#### 2. PDF viewer in invoice detail

**Test:** Upload a PDF invoice, open the invoice detail page
**Expected:** PDF renders inline in the left 60% panel on desktop; stacks below content on mobile
**Why human:** Browser PDF rendering depends on browser version and PDF object support

#### 3. Auto-match confidence UX

**Test:** Create a contractor with taxId, create a contract with `rateValueGrosze`, upload an invoice with matching `sellerTaxId` and similar amount, submit for matching
**Expected:** Match card shows "Strong match" (score >= 90) with green dot, contractor and contract linked, deviation displayed
**Why human:** Requires live database state with related records

#### 4. Status chip bar live counts

**Test:** Navigate to `/invoices` with invoices in various statuses
**Expected:** Chips show accurate counts, clicking a chip filters the table instantly
**Why human:** Requires real data; nuqs URL state interaction can only be tested in browser

#### 5. Duplicate detection banner

**Test:** Create two invoices with identical `invoiceNumber`, `sellerTaxId`, and `totalGrosze`; submit the second for matching
**Expected:** Duplicate warning banner appears in detail view of second invoice with link to original
**Why human:** Requires coordinated database state and matching pipeline execution

---

### Notes

**Translation key structure:** The plan (05-05) specified flat keys like `"submitForMatching"`, `"duplicateHeading"`, `"chipAll"` etc. The actual implementation uses a nested namespace structure (`detail.submitForMatching`, `duplicate.heading`, `chips.all`). Both EN and PL messages files use the nested structure consistently, and all components reference keys matching the nested structure. This is a deviation from plan specification but a better practice — not a gap.

**ProfileTabs pattern:** Plan 05-05 specified replacing `TabPlaceholder` in `profile-tabs.tsx`. The actual implementation uses a render-prop/children pattern — `ProfileTabs` accepts `invoicesContent: ReactNode` prop, and `InvoicesTab` is instantiated in `contractors/[id]/page.tsx`. `TabPlaceholder` is still present for the "payments" tab (future phase). This is correct and more flexible than direct import in the tabs file.

**Settings component:** The plan specified `trpc.settings.update` with `invoiceDeviationThresholdPercent`. The actual implementation uses dedicated `trpc.settings.getInvoiceSettings` and `trpc.settings.updateInvoiceSettings` procedures — a cleaner separation that achieves the same goal.

---

## Summary

Phase 5 goal is fully achieved. All 18 observable truths are verified. All 10 requirement IDs (INV-01 through INV-10) are satisfied with concrete implementation evidence. All key links are wired — no orphaned artifacts or disconnected stubs found.

The invoice intake system delivers:
- Complete tRPC backend (11 procedures, matching engine, validators)
- Email intake via Resend Inbound webhook with R2 storage
- Invoice list page with TanStack Table, status chip bar, side panel, and multi-file upload
- Invoice detail page with 60/40 PDF/metadata split, metadata form, match card, and duplicate warning
- Contractor profile Invoices tab and settings with configurable deviation threshold
- Full EN and PL i18n coverage

---

_Verified: 2026-03-21T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
