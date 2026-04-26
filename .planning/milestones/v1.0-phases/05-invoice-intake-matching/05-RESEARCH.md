# Phase 5: Invoice Intake & Matching - Research

**Researched:** 2026-03-21
**Domain:** Invoice upload, email intake (Resend Inbound), auto-matching engine, duplicate detection, TanStack Table list, side-by-side detail view
**Confidence:** HIGH

## Summary

Phase 5 builds the invoice intake pipeline: drag-and-drop upload (reusing the existing DropZone + R2 presigned URL flow from Phase 3), email intake via Resend Inbound webhooks, metadata editing, auto-matching to contractors by NIP and contracts by expected amount, duplicate detection via SHA256 hashing, and a full invoice list + detail UI. The database schema (Invoice, InvoiceFile, InvoiceLine, InvoiceMatchResult) is already defined in Prisma. The UI patterns (TanStack Table, side panel, PDF preview, DropZone) are all established from Phases 2-4.

The main new technical surface is the Resend Inbound webhook endpoint (a Next.js API route outside tRPC) that receives email.received events, fetches attachments via the Resend Receiving API, uploads them to R2, and creates invoice drafts. The matching engine is a pure server-side function that runs NIP lookup, contract matching with deviation calculation, and duplicate hash checking within a Prisma transaction.

**Primary recommendation:** Reuse every existing pattern (TanStack Table, DropZone, PDF preview, side panel, settings in settingsJson) -- the only genuinely new code is the invoice tRPC router, the matching engine service, and the Resend Inbound webhook handler.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Multi-file batch upload -- DropZone accepts multiple PDFs at once, each creates a separate invoice draft in RECEIVED status. User reviews and fills metadata for each individually
- Inline metadata form on invoice detail page -- editable fields: invoice number, issue date, due date, service period, seller NIP, net/VAT/gross amounts, bank account. All editable while in RECEIVED status
- Header-level totals only in v1 -- net, VAT rate, VAT amount, gross total, withholding, amount to pay. Line items stored in schema but not exposed in UI until OCR/extraction (v2)
- Two-step flow: save draft then submit for matching -- user saves invoice as editable draft (RECEIVED), then explicitly clicks "Submit for matching" to trigger auto-match
- Org slug subdomain format: invoices@{org-slug}.contractorhub.io -- each org gets unique subdomain, parsed from Resend Inbound webhook
- Auto-create draft with notification -- email arrives -> extract PDF attachment -> upload to R2 -> create Invoice (RECEIVED, source: EMAIL_INTAKE) -> link document -> store submittedByEmail -> notify user in-app
- Accept all attachments, skip non-PDF emails -- multiple PDFs create one draft per PDF. Non-PDF attachments accepted as supporting if a PDF is also present. No attachment -> log and skip
- Email inbox address visible in Settings page with one-click copy button + inline tip in invoice upload area
- Match card with confidence indicator on invoice detail page -- shows matched contractor (link), matched contract (link), match score, expected vs actual amount, deviation percentage. Green/yellow/red indicator
- Manual matching via search pickers in match card -- when unmatched, card shows contractor search (by name/NIP) and contract picker (filtered by selected contractor). "Confirm manual match" button
- Configurable deviation threshold per org -- Settings > Invoice Matching: default 10% threshold. Also flags: no active contract found, expired contract, currency mismatch
- Duplicate detection via warning banner -- SHA256 hash of invoice number + contractor + amount. Warning banner at top of detail page
- Standalone /invoices page with full TanStack Table -- columns: Invoice #, Contractor, Issue date, Due date, Net amount, Gross amount, Currency, Status, Match status, Source
- Status chips above table for quick filtering -- clickable chips: All, Received, Matched, Unmatched, Discrepancy, Pending Approval, Approved, Ready for Payment. Each shows count
- Click row opens slide-out side panel with invoice summary, status, match status, amounts, and "Open invoice" button
- Invoice detail page: side-by-side layout -- PDF viewer on left (60%), editable metadata form + match card + duplicate warning on right (40%)
- Contractor profile Invoices tab -- shows invoices filtered to that contractor (same TanStack Table, pre-filtered)

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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INV-01 | User can upload invoices via drag & drop (single or multi-file) | Reuse existing DropZone component with PDF-only accept filter; each file creates an Invoice record + InvoiceFile + Document via R2 presigned URL flow |
| INV-02 | System receives invoices via dedicated email inbox per organization | Resend Inbound webhook endpoint (Next.js API route); parse org from subdomain; fetch attachments via Resend Receiving API; upload to R2 |
| INV-03 | User can enter/edit invoice metadata (number, dates, amounts, NIP, bank account, billing period) | React Hook Form + Zod resolver on invoice detail page; all monetary fields as integer grosze with PLN display formatter |
| INV-04 | System auto-matches invoices to contractors by NIP | Matching engine service: query contractors WHERE sellerTaxId = invoice.sellerTaxId AND organizationId; use existing NIP validation |
| INV-05 | System auto-matches invoices to active contracts and calculates expected vs actual amount | Matching engine: find active contracts for matched contractor; compare rateValueGrosze * billing period to invoice totalGrosze |
| INV-06 | System flags deviations above configurable threshold (amount, missing contract, expired contract) | Deviation threshold from Organization.settingsJson; flag types stored in Invoice.flagsJson; match status DISCREPANCY |
| INV-07 | System detects duplicate invoices by invoice number + contractor + amount | SHA256 hash of `${invoiceNumber}|${sellerTaxId}|${totalGrosze}` stored in duplicateCheckHash; index already exists |
| INV-08 | Invoice follows status flow: received -> matched/unmatched/discrepancy -> pending approval -> approved/rejected -> ready for payment -> paid | InvoiceStatus + InvoiceMatchStatus enums already defined in schema; status transitions in tRPC router |
| INV-09 | User can manually match unmatched invoices to a contractor and contract | Manual match via match card search pickers; creates InvoiceMatchResult with matchedBy=MANUAL |
| INV-10 | User can view invoice detail with linked contractor, contract, approval chain, comments, and embedded PDF viewer | Side-by-side detail page: PDF via browser `<object>` tag (60%), metadata form + match card (40%); links to contractor/contract profiles |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.21.3 | Invoice list table | Already used for contractor + contract tables; server-side pagination/sort/filter |
| react-dropzone | 15.0.0 | Invoice PDF upload | Already used in DropZone component; multi-file batch support built-in |
| react-hook-form | 7.71.2 | Invoice metadata form | Already used for all forms in the app |
| @hookform/resolvers | 5.2.2 | Zod form validation | Already paired with react-hook-form |
| zod | 3.23.x | Schema validation | Already used across all packages |
| nuqs | 2.8.9 | URL state for filters/chips | Already used for table filter state in Phase 2-4 |
| resend | 6.9.4 | Resend Inbound webhook verification + Receiving API | SDK for webhook signature verification and attachment retrieval |
| @aws-sdk/client-s3 | 3.1013.0 | R2 storage | Already installed for document upload |
| @aws-sdk/s3-request-presigner | (installed) | Presigned URLs | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| svix | 1.89.0 | Webhook signature verification (alternative) | If Resend SDK webhook verification is insufficient; Resend uses Svix under the hood |
| date-fns | 4.1.0 | Date formatting in table/detail | Already in web app dependencies |
| lucide-react | 0.577.0 | Icons | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend SDK for webhook verify | svix package directly | Resend wraps svix internally; SDK is simpler but svix gives more control |
| Browser `<object>` for PDF | react-pdf | `<object>` is zero-bundle-cost, already proven in Phase 3 |
| Custom matching engine | External rules engine | Over-engineered for NIP + contract matching; simple functions suffice |

**Installation:**
```bash
pnpm add resend --filter @contractor-ops/api
```

All other packages are already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  routers/
    invoice.ts              # Invoice tRPC router (CRUD, list, match, status transitions)
  services/
    invoice-matching.ts     # Auto-matching engine (NIP lookup, contract matching, deviation calc, duplicate check)
    r2.ts                   # Existing R2 service (reused)
    mime-validator.ts        # Existing MIME validator (reused)
    virus-scanner.ts         # Existing virus scanner (reused)

packages/validators/src/
  invoice.ts                # Zod schemas for invoice create, update, match, list

apps/web/src/
  app/[locale]/(dashboard)/
    invoices/
      page.tsx              # Invoice list page
      [id]/
        page.tsx            # Invoice detail page
  app/api/
    webhooks/
      resend-inbound/
        route.ts            # Resend Inbound webhook handler (Next.js API route, NOT tRPC)
  components/invoices/
    invoice-table/          # Mirror contract-table pattern
      columns.tsx
      data-table.tsx
      data-table-toolbar.tsx
      data-table-pagination.tsx
      data-table-filters.tsx
      data-table-column-toggle.tsx
      use-invoice-filters.ts
    invoice-side-panel.tsx   # Slide-out sheet on row click
    invoice-detail/
      invoice-detail-layout.tsx  # 60/40 split layout
      invoice-metadata-form.tsx  # Editable metadata form (React Hook Form)
      match-card.tsx             # Match results + manual matching
      duplicate-warning.tsx      # Duplicate detection banner
      status-chip-bar.tsx        # Clickable status filter chips
    invoice-upload-area.tsx      # DropZone wrapper for invoice page
```

### Pattern 1: Invoice tRPC Router (mirrors document/contract router)
**What:** Standard tRPC router with tenantProcedure + requirePermission middleware chain
**When to use:** All invoice CRUD, list, and matching operations
**Example:**
```typescript
// Source: established pattern from packages/api/src/routers/document.ts
export const invoiceRouter = router({
  create: tenantProcedure
    .use(requirePermission({ invoice: ["create"] }))
    .input(invoiceCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Create invoice in RECEIVED status
      // Create InvoiceFile linking to uploaded Document
      // Compute duplicateCheckHash
      return plain(invoice);
    }),

  submitForMatching: tenantProcedure
    .use(requirePermission({ invoice: ["update"] }))
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Run matching engine
      // Update matchStatus + status based on results
      // Create InvoiceMatchResult record
    }),

  list: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .input(invoiceListSchema)
    .query(async ({ ctx, input }) => {
      // Server-side pagination, sorting, filtering
      // Include contractor name join for display
      // Return { items, totalCount, page, pageSize }
    }),

  // statusCounts: for status chip bar counts
  statusCounts: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .query(async ({ ctx }) => {
      // GROUP BY status, matchStatus and return counts
    }),
});
```

### Pattern 2: Resend Inbound Webhook (Next.js API Route)
**What:** POST endpoint outside tRPC that receives Resend webhook events
**When to use:** Email intake processing
**Example:**
```typescript
// Source: Resend official docs
// apps/web/src/app/api/webhooks/resend-inbound/route.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  // 1. Verify webhook signature
  const payload = await request.text();
  const headers = {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };

  let event;
  try {
    event = resend.webhooks.verify(payload, headers) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  // 2. Parse org from recipient address: invoices@{org-slug}.contractorhub.io
  const toAddress = event.data.to[0];
  const orgSlug = parseOrgSlugFromEmail(toAddress);

  // 3. Fetch email details + attachments via Resend Receiving API
  const emailDetails = await resend.emails.receiving.get(event.data.email_id);
  const attachments = emailDetails.attachments ?? [];

  // 4. For each PDF attachment: download, upload to R2, create Invoice
  for (const att of attachments) {
    if (att.content_type !== "application/pdf") continue;
    const attData = await resend.emails.receiving.attachments.get({
      id: att.id,
      emailId: event.data.email_id,
    });
    // Download from attData.download_url, upload to R2, create Invoice record
  }

  return NextResponse.json({ processed: true });
}
```

### Pattern 3: Matching Engine Service
**What:** Pure function that takes invoice data and returns match results
**When to use:** Called by submitForMatching tRPC procedure and email intake webhook
**Example:**
```typescript
// packages/api/src/services/invoice-matching.ts
export async function runAutoMatch(
  organizationId: string,
  invoice: { sellerTaxId: string | null; totalGrosze: number; currency: string },
  deviationThresholdPercent: number = 10,
): Promise<MatchResult> {
  // Step 1: Match contractor by NIP (sellerTaxId)
  const contractor = invoice.sellerTaxId
    ? await prisma.contractor.findFirst({
        where: { organizationId, nip: invoice.sellerTaxId, deletedAt: null },
      })
    : null;

  // Step 2: Find active contracts for matched contractor
  const contracts = contractor
    ? await prisma.contract.findMany({
        where: {
          organizationId,
          contractorId: contractor.id,
          status: { in: ["ACTIVE", "EXPIRING"] },
        },
      })
    : [];

  // Step 3: Calculate deviation and match score
  // Step 4: Check for duplicate hash
  // Step 5: Return structured result with matchStatus
}
```

### Pattern 4: Duplicate Check Hash
**What:** SHA256 hash for duplicate detection
**When to use:** On invoice create and update
**Example:**
```typescript
import { createHash } from "crypto";

export function computeDuplicateCheckHash(
  invoiceNumber: string,
  sellerTaxId: string,
  totalGrosze: number,
): string {
  const input = `${invoiceNumber.trim().toLowerCase()}|${sellerTaxId.trim()}|${totalGrosze}`;
  return createHash("sha256").update(input).digest("hex");
}
```

### Anti-Patterns to Avoid
- **Running matching on save (not submit):** User decided on two-step flow. Never auto-match on draft save -- only on explicit "Submit for matching" action.
- **Storing attachment content in database:** Always store in R2 via presigned URLs. Only metadata in DB.
- **Using floating-point for amounts:** All monetary values are integer grosze (already established in Phase 1).
- **Processing webhook synchronously for large attachments:** Fetch and upload attachments, but if the webhook times out, Resend will retry. Keep processing efficient.
- **Hardcoding deviation threshold:** Must be configurable per org via settingsJson.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC verification | `resend.webhooks.verify()` | Resend uses Svix under the hood; SDK handles timestamp tolerance, signature rotation |
| PDF file upload + storage | Custom multipart upload handler | Existing DropZone + R2 presigned URL flow | Already battle-tested in Phase 3 with progress tracking, virus scanning |
| NIP validation | Custom checksum logic | Existing `isValidNip()` from validators package | Already implemented with mod-11 checksum in Phase 2 |
| Table with server-side pagination | Custom pagination component | Existing TanStack Table pattern from contract-table | Proven pattern with URL state, column toggle, bulk actions |
| PDF viewer | react-pdf or pdf.js | Browser native `<object>` tag (existing PdfPreview) | Zero bundle cost, already proven in Phase 3 |
| IBAN validation | Custom regex | `ibantools` (already in validators) | Edge cases in international bank account numbers |

**Key insight:** This phase is ~80% pattern reuse from Phases 2-4. The only genuinely new code is the matching engine logic and the Resend Inbound webhook handler.

## Common Pitfalls

### Pitfall 1: Webhook Timeout on Large Attachments
**What goes wrong:** Resend Inbound webhook sends the event, handler tries to download large PDF attachments and upload to R2, exceeds the webhook response timeout.
**Why it happens:** Resend expects a response within a reasonable time window. Downloading + re-uploading multiple large PDFs can be slow.
**How to avoid:** Keep the webhook handler fast: acknowledge receipt quickly, process attachments in a fire-and-forget async pattern (similar to virus scanning). Or use a queue/background job. For v1, fire-and-forget with error logging is acceptable since Resend retries on failure.
**Warning signs:** 5xx responses on webhook endpoint, Resend showing failed delivery in dashboard.

### Pitfall 2: Org Slug Parsing from Email
**What goes wrong:** Email comes to `invoices@acme.contractorhub.io` but slug extraction fails due to case sensitivity, extra whitespace, or multiple recipients.
**Why it happens:** Email addresses can have varied casing and the `to` field can contain display names.
**How to avoid:** Normalize: lowercase, trim, extract only the domain part, split on first dot to get slug. Handle multiple `to` addresses by using the first one that matches the pattern.
**Warning signs:** Invoices created without org association, 404 on org lookup.

### Pitfall 3: Duplicate Hash Collision on Different Invoices
**What goes wrong:** Different invoices with same number, same contractor, same amount are flagged as duplicates when they're legitimate (e.g., monthly recurring invoices with same amount).
**Why it happens:** Hash includes only number + NIP + amount, not dates.
**How to avoid:** The decision is to show a warning banner, not block. User can dismiss with "Not a duplicate". Consider including issue date in the hash if false positives become frequent, but start with the decided formula.
**Warning signs:** High rate of "Not a duplicate" dismissals.

### Pitfall 4: Matching Engine Returns Multiple Contracts
**What goes wrong:** Contractor has multiple active contracts, and the system doesn't know which one to match.
**Why it happens:** B2B contractors often have overlapping contracts (MSA + SOW).
**How to avoid:** Match to the contract whose expected amount is closest to the invoice amount. If multiple contracts are equally close, set matchStatus to PARTIAL and let user confirm manually. Store all candidates in InvoiceMatchResult with scores.
**Warning signs:** Many invoices stuck in PARTIAL match status.

### Pitfall 5: Currency Mismatch Not Caught
**What goes wrong:** Invoice is in EUR but contract rate is in PLN, deviation calculation produces meaningless results.
**Why it happens:** Comparing grosze amounts across currencies without conversion.
**How to avoid:** Check currency match before deviation calculation. If currencies differ, flag as DISCREPANCY with explanation "Currency mismatch: invoice EUR vs contract PLN" in flagsJson.
**Warning signs:** Suspiciously low deviation percentages on foreign-currency invoices.

### Pitfall 6: Resend Webhook Secret Not Configured
**What goes wrong:** Webhook verification fails silently, or worse, verification is skipped and endpoint accepts forged requests.
**Why it happens:** Missing RESEND_WEBHOOK_SECRET environment variable in deployment.
**How to avoid:** Fail loudly: if secret is not configured, return 500 with clear error message. Add to .env.example. Validate at startup.
**Warning signs:** All webhook requests returning 401 or 500.

## Code Examples

### Invoice Zod Schemas
```typescript
// packages/validators/src/invoice.ts
import { z } from "zod";

// Prisma enum mirrors
const invoiceStatusEnum = z.enum([
  "RECEIVED", "UNDER_REVIEW", "APPROVAL_PENDING", "APPROVED",
  "REJECTED", "READY_FOR_PAYMENT", "PARTIALLY_PAID", "PAID", "VOID",
]);

const invoiceMatchStatusEnum = z.enum([
  "UNMATCHED", "PARTIAL", "MATCHED", "DISCREPANCY", "MANUALLY_CONFIRMED",
]);

const invoiceSourceEnum = z.enum(["MANUAL_UPLOAD", "EMAIL_INTAKE", "KSEF", "API"]);

export const invoiceCreateSchema = z.object({
  invoiceNumber: z.string().min(1).max(100),
  issueDate: z.string(), // ISO date string
  dueDate: z.string(),
  servicePeriodStart: z.string().optional(),
  servicePeriodEnd: z.string().optional(),
  currency: z.string().length(3).default("PLN"),
  subtotalGrosze: z.number().int().min(0),
  vatRate: z.string().optional(), // "23%", "8%", "5%", "0%", "ZW", "NP"
  vatAmountGrosze: z.number().int().min(0).optional(),
  totalGrosze: z.number().int().min(0),
  withholdingGrosze: z.number().int().min(0).optional(),
  amountToPayGrosze: z.number().int().min(0),
  sellerTaxId: z.string().max(50).optional(),
  sellerName: z.string().max(500).optional(),
  sellerBankAccount: z.string().max(34).optional(),
  documentIds: z.array(z.string()).min(1), // At least one PDF
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial();

export const invoiceListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
  search: z.string().optional(),
  sortBy: z.enum(["receivedAt", "invoiceNumber", "issueDate", "dueDate", "totalGrosze", "status"]).default("receivedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  filters: z.object({
    status: z.array(invoiceStatusEnum).optional(),
    matchStatus: z.array(invoiceMatchStatusEnum).optional(),
    source: z.array(invoiceSourceEnum).optional(),
    contractorId: z.string().optional(),
  }).optional(),
});

export const invoiceManualMatchSchema = z.object({
  invoiceId: z.string(),
  contractorId: z.string(),
  contractId: z.string().optional(),
});
```

### Settings Extension for Deviation Threshold
```typescript
// Extend existing settings router pattern
// Organization.settingsJson structure:
// {
//   contractExpiryReminderDaysBefore: [30, 60, 90],  // Phase 3
//   invoiceDeviationThresholdPercent: 10,             // Phase 5
// }

export const invoiceMatchingSettingsSchema = z.object({
  invoiceDeviationThresholdPercent: z.number().min(0).max(100).default(10),
});
```

### Status Chip Bar with Counts
```typescript
// Pattern: nuqs URL state for active status filter
// Each chip shows count from statusCounts query
import { parseAsString, useQueryState } from "nuqs";

function StatusChipBar({ counts }: { counts: Record<string, number> }) {
  const [activeStatus, setActiveStatus] = useQueryState(
    "matchStatus",
    parseAsString.withDefault("all"),
  );

  const chips = [
    { key: "all", label: "All", count: Object.values(counts).reduce((a, b) => a + b, 0) },
    { key: "RECEIVED", label: "Received", count: counts.RECEIVED ?? 0 },
    { key: "MATCHED", label: "Matched", count: counts.MATCHED ?? 0 },
    { key: "UNMATCHED", label: "Unmatched", count: counts.UNMATCHED ?? 0 },
    { key: "DISCREPANCY", label: "Discrepancy", count: counts.DISCREPANCY ?? 0 },
    // ... more statuses (Pending Approval, Approved, Ready for Payment) from Phase 6+
  ];

  return (
    <div className="flex gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant={activeStatus === chip.key ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setActiveStatus(chip.key === "all" ? null : chip.key)}
        >
          {chip.label} ({chip.count})
        </Badge>
      ))}
    </div>
  );
}
```

### Email Org Slug Parser
```typescript
// Parse org slug from Resend Inbound recipient address
// Format: invoices@{org-slug}.contractorhub.io
export function parseOrgSlugFromEmail(toAddress: string): string | null {
  // Handle format "Display Name <email@domain>" or plain "email@domain"
  const emailMatch = toAddress.match(/<([^>]+)>/) ?? [null, toAddress];
  const email = (emailMatch[1] ?? toAddress).toLowerCase().trim();

  // Extract domain part
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return null;

  const domain = email.slice(atIdx + 1);
  // Expected: {org-slug}.contractorhub.io
  const suffix = ".contractorhub.io";
  if (!domain.endsWith(suffix)) return null;

  const slug = domain.slice(0, domain.length - suffix.length);
  return slug || null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resend webhooks include full body/attachments | Webhooks include metadata only; use Receiving API for content | 2024 | Must call separate API to get attachment download URLs |
| Manual HMAC webhook verification | `resend.webhooks.verify()` wrapping Svix | Resend SDK v4+ | Simpler, handles timestamp tolerance |
| react-pdf for PDF viewing | Browser native `<object>` tag | Phase 3 decision | Zero bundle cost, sufficient for invoice preview |

**Deprecated/outdated:**
- Resend Inbound Webhooks do NOT contain email body or attachment content -- only metadata. The Receiving API must be called separately to get `download_url` for attachments.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project -- no test runner configured |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | Invoice upload creates draft | integration | N/A | No -- Wave 0 |
| INV-02 | Email intake creates draft from PDF attachment | integration | N/A | No -- Wave 0 |
| INV-03 | Metadata CRUD on invoice | unit | N/A | No -- Wave 0 |
| INV-04 | NIP-based contractor matching | unit | N/A | No -- Wave 0 |
| INV-05 | Contract matching with deviation | unit | N/A | No -- Wave 0 |
| INV-06 | Deviation threshold flagging | unit | N/A | No -- Wave 0 |
| INV-07 | Duplicate detection by hash | unit | N/A | No -- Wave 0 |
| INV-08 | Status transitions | unit | N/A | No -- Wave 0 |
| INV-09 | Manual matching | integration | N/A | No -- Wave 0 |
| INV-10 | Invoice detail with PDF viewer | manual-only | Visual verification | N/A |

### Sampling Rate
- **Per task commit:** No automated test suite
- **Per wave merge:** No automated test suite
- **Phase gate:** Manual verification via UI

### Wave 0 Gaps
- [ ] Test framework installation (vitest recommended for this stack)
- [ ] Test infrastructure is entirely absent from the project -- this is a known gap across all phases, not Phase 5 specific

## Open Questions

1. **Resend Inbound MX Record Setup**
   - What we know: Resend requires MX records pointing to their servers for the receiving domain
   - What's unclear: Whether contractorhub.io domain is already configured with Resend, or if this needs DevOps work
   - Recommendation: The webhook handler code can be built regardless; MX record configuration is an infrastructure task

2. **Webhook Processing Timeout**
   - What we know: Downloading attachments from Resend + uploading to R2 could take significant time
   - What's unclear: Exact timeout limits for Next.js API routes on the deployment platform (Vercel has 10s/30s limits depending on plan)
   - Recommendation: Use fire-and-forget async pattern (same as virus scanning). Acknowledge webhook immediately, process in background.

3. **Match Score Algorithm Details**
   - What we know: Need to show confidence indicator (green/yellow/red) and match score
   - What's unclear: Exact scoring formula is at Claude's discretion
   - Recommendation: Simple weighted score: exact NIP match = 50 points, active contract found = 30 points, amount within threshold = 20 points. Score 80-100 = green, 50-79 = yellow, 0-49 = red.

## Sources

### Primary (HIGH confidence)
- Codebase: `packages/db/prisma/schema/invoice.prisma` -- full data model
- Codebase: `packages/api/src/routers/document.ts` -- upload/download pattern
- Codebase: `apps/web/src/components/documents/drop-zone.tsx` -- DropZone component
- Codebase: `apps/web/src/components/contracts/contract-table/data-table.tsx` -- TanStack Table pattern
- Codebase: `packages/api/src/routers/settings.ts` -- settingsJson pattern
- Codebase: `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` -- TabPlaceholder for invoices

### Secondary (MEDIUM confidence)
- [Resend Inbound Email Docs](https://resend.com/docs/dashboard/receiving/introduction) -- webhook payload structure, MX setup
- [Resend Retrieve Received Email API](https://resend.com/docs/api-reference/emails/retrieve-received-email) -- SDK method `resend.emails.receiving.get(id)`
- [Resend Retrieve Attachment API](https://resend.com/docs/api-reference/emails/retrieve-received-email-attachment) -- SDK method with `download_url` response

### Tertiary (LOW confidence)
- Match score algorithm -- Claude's discretion, no external reference needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use except Resend SDK (verified current version 6.9.4)
- Architecture: HIGH -- patterns directly mirror established Phase 2-4 code
- Pitfalls: HIGH -- based on actual Resend API behavior and codebase patterns
- Matching engine: MEDIUM -- algorithm details are discretionary, but NIP matching and deviation calc are straightforward

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable patterns, no fast-moving dependencies)
