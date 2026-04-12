# Phase 3: Contracts & Documents - Research

**Researched:** 2026-03-20
**Domain:** Contract lifecycle management, document storage (Cloudflare R2), file security
**Confidence:** HIGH

## Summary

Phase 3 adds contract CRUD with full lifecycle tracking (draft through terminated/superseded), amendment versioning, configurable expiry reminders, and secure document management with upload/download via R2 presigned URLs. The Prisma schema is already fully defined with Contract, ContractAmendment, ContractRatePeriod, Document, and DocumentLink models. The codebase has well-established patterns from Phase 2 (tRPC routers with tenant/RBAC middleware, TanStack Table, multi-step wizard, side panel) that this phase follows exactly.

The key new technical territory is: (1) Cloudflare R2 integration via AWS SDK v3 for presigned upload/download URLs, (2) server-side MIME validation using the `file-type` package (magic bytes, not extension), (3) virus scanning via ClamAV/clamscan, and (4) inline PDF preview. All other patterns (table, wizard, tabs, forms) are direct extensions of Phase 2 code.

**Primary recommendation:** Follow Phase 2 patterns exactly for all UI and API code. New infrastructure is limited to an R2 storage service module and a document upload tRPC router with presigned URL generation, MIME validation, and async virus scanning.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Standalone /contracts page with full TanStack Table (search, filters, bulk actions) AND contracts tab inside contractor profile pre-filtered to that contractor
- Full detail columns by default: Title, Contractor, Type, Status, Start date, End date, Rate, Currency, Billing model, Owner, Compliance risk
- Click row opens slide-out side panel with contract summary, key dates, linked docs. "Open" button navigates to full detail page
- Contract detail page uses tabbed layout: Overview, Documents, Amendments, Activity
- 3-step wizard: Step 1 (Contract details) -> Step 2 (Financial terms) -> Step 3 (Document upload)
- Multiple entry points: /contracts page "New" button, contractor profile "Add contract" button (auto-fills contractor), top bar quick action
- Financial terms pre-filled from contractor's billing profile
- Contractor is required on every contract. When creating from contractor profile, auto-selected. From /contracts page, contractor picker required
- Drag & drop zone with "Browse files" button fallback. Shows upload progress, file preview, and validation errors inline
- Upload available from: contract detail page, contractor profile Documents tab, contract creation wizard (step 3), contractor profile Compliance tab
- Allowed file types: PDF, DOCX, XLSX, PNG, JPG with MIME-type validation (not just extension check)
- Inline PDF preview with download button. Other file types show metadata with download-only
- Downloads via short-lived signed URLs (R2 presigned URLs)
- Amendment timeline view in contract detail Amendments tab
- Manual supersede action (user explicitly marks old contract as "Superseded" and links to new one)
- Expiry reminders: org-level default intervals in Settings, per-contract override with custom intervals
- Explicit document versioning (user clicks "Upload new version", old version moves to history)

### Claude's Discretion
- Contract side panel width and content layout
- Contract detail page section ordering within tabs
- Upload progress indicator design (progress bar vs percentage)
- Virus scan status display (inline badge vs notification)
- Document type categorization UX in upload flow
- Search debounce timing and filter behavior
- Empty states for contract list and document sections
- Exact reminder notification delivery (in-app vs email deferred to Phase 7)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CNTR-01 | User can create a contract with metadata (type, dates, notice period, rate, currency, billing cycle, payment terms) | Contract model fully defined in Prisma schema. 3-step wizard pattern from Phase 2 contractor wizard. Zod validators for contract create/update. tRPC mutation with tenantProcedure + requirePermission. |
| CNTR-02 | User can upload contract documents (PDF, DOCX) with versioning | R2 presigned URL upload flow. file-type package for MIME validation. Document + DocumentLink models in schema. Version tracking via DocumentStatus.SUPERSEDED + new document creation. |
| CNTR-03 | System tracks contract statuses: draft -> active -> expiring -> expired -> terminated -> superseded | ContractStatus enum already defined in Prisma. Status transition map (like contractor lifecycle transitions). Cron/scheduled check for expiring/expired transitions based on endDate. |
| CNTR-04 | System sends configurable reminders before contract expiration (30/60/90 days) | Contract.metadataJson stores per-contract reminder intervals. Org settings stores defaults. Phase 3 implements configuration storage and display; actual notification delivery deferred to Phase 7. |
| CNTR-05 | User can add amendments to existing contracts | ContractAmendment model defined. Amendment timeline UI. Dialog form (not wizard) for amendment creation. changesSummaryJson stores structured change data. |
| DOCS-01 | User can upload documents and link them to contractors and/or contracts | DocumentLink model with EntityType enum (CONTRACTOR, CONTRACT). Drop zone component. Multi-context upload (wizard step 3, contract detail, contractor profile). |
| DOCS-02 | User can download documents via short-lived signed URLs | R2 GetObjectCommand + getSignedUrl with expiry (e.g., 15 minutes). tRPC query returns signed URL, frontend opens in new tab or triggers download. |
| DOCS-03 | System validates file type (MIME content) and scans uploads for malware | file-type package reads magic bytes server-side. clamscan package for ClamAV integration. VirusScanStatus enum (PENDING, CLEAN, INFECTED, FAILED) in Document model. Async scanning after upload. |
| DOCS-04 | System tracks document versions and maintains upload history | Explicit versioning: "Upload new version" creates new Document, old gets status SUPERSEDED. DocumentLink maintains version chain. Version number auto-incremented. |

</phase_requirements>

## Standard Stack

### Core (New for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-s3 | 3.1013.x | R2 bucket operations (PutObject, GetObject, DeleteObject) | Official AWS SDK v3 -- Cloudflare R2 is S3-compatible. Used for creating bucket client, object operations. |
| @aws-sdk/s3-request-presigner | 3.1013.x | Generate presigned upload/download URLs | Standard companion to client-s3 for presigned URL generation. |
| file-type | 21.3.x | MIME type detection from file content (magic bytes) | De facto standard for content-based MIME detection in Node.js. Pure ESM. Inspects first bytes, does not rely on file extension. |
| clamscan | 2.4.x | Virus/malware scanning via ClamAV daemon | Most popular Node.js ClamAV wrapper. Supports TCP/Unix socket to clamd, stream scanning. |
| react-dropzone | 15.x | Drag-and-drop file upload UI | De facto standard React file drop zone. 4500+ dependents. Headless hook-based API. |

### Reused from Phase 1-2 (Already Installed)

| Library | Version | Purpose |
|---------|---------|---------|
| @tanstack/react-table | 8.21.x | Contract list table with sorting, filtering, pagination |
| react-hook-form | 7.71.x | Contract wizard forms, amendment form |
| zod | 3.23.x | Schema validation for contract/document inputs |
| nuqs | 2.8.x | URL state for table params and contract detail tab state |
| sonner | 2.x | Toast notifications for CRUD operations |
| next-intl | 4.8.x | i18n for all UI strings |
| lucide-react | latest | Icons (FileText, Upload, ShieldCheck, etc.) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-dropzone | Native HTML5 drag events | react-dropzone handles edge cases (browser compat, accessibility, multiple files). Worth the 8kB. |
| file-type | MIME check by extension | Extension-based is trivially spoofable. Magic byte detection is the only secure approach. |
| clamscan | Cloudflare WAF content scanning | WAF scans HTTP traffic only, not R2 objects directly. ClamAV gives explicit scan-per-file with status tracking. |
| Inline PDF via `<object>/<embed>` | react-pdf (10.4.x) | UI-SPEC specifies browser-native `<object>` or `<embed>` tag. Simpler, zero bundle cost. react-pdf adds 200kB+ for pdf.js worker. Use native embed. |

**Installation:**
```bash
pnpm add -w @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm --filter @contractor-ops/api add file-type clamscan
pnpm --filter @contractor-ops/web add react-dropzone
```

## Architecture Patterns

### Recommended Project Structure

```
packages/
  api/src/
    routers/
      contract.ts          # Contract CRUD, list, status transitions, amendments
      document.ts          # Document upload, download URL generation, versioning
    services/
      r2.ts               # R2 client init, presigned URL helpers
      virus-scanner.ts    # ClamAV scanning service wrapper
  validators/src/
    contract.ts           # Contract create/update/list Zod schemas
    document.ts           # Document upload/link Zod schemas
  db/prisma/schema/
    contract.prisma       # Already defined -- no changes needed

apps/web/src/
  app/[locale]/(dashboard)/
    contracts/
      page.tsx            # Contract list page
      [id]/
        page.tsx          # Contract detail page
  components/
    contracts/
      contract-table/     # TanStack Table (mirrors contractor-table/)
        columns.tsx
        data-table.tsx
        table-toolbar.tsx
        table-filters.tsx
      contract-wizard/    # 3-step creation wizard (mirrors contractor-wizard/)
        wizard-dialog.tsx
        step-details.tsx
        step-financial.tsx
        step-documents.tsx
      contract-detail/    # Detail page components
        detail-header.tsx
        overview-tab.tsx
        documents-tab.tsx
        amendments-tab.tsx
        activity-tab.tsx
      contract-side-panel.tsx
    documents/
      drop-zone.tsx       # Reusable drag-and-drop upload component
      document-card.tsx   # Document display card with scan status
      document-list.tsx   # Document list for any context
      pdf-preview.tsx     # PDF inline preview dialog
      upload-progress.tsx # Individual file upload progress row
      version-history.tsx # Version history expandable section
```

### Pattern 1: Presigned URL Upload Flow

**What:** Client requests a presigned upload URL from the server, uploads directly to R2, then notifies the server to create the Document record.

**When to use:** All document uploads (wizard step 3, contract detail, contractor profile).

**Flow:**
1. Client calls `document.requestUpload` tRPC mutation with filename, MIME type, size
2. Server validates MIME type against allowlist, generates a presigned PUT URL (5-minute expiry), creates a pending Document record
3. Client uploads file directly to R2 using the presigned URL (with progress tracking via XMLHttpRequest)
4. Client calls `document.confirmUpload` tRPC mutation with document ID
5. Server verifies the object exists in R2, computes SHA-256 checksum, triggers async virus scan
6. Server updates Document record with checksumSha256 and virusScanStatus

```typescript
// packages/api/src/services/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function createPresignedUploadUrl(key: string, contentType: string, expiresIn = 300) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn });
}

export async function createPresignedDownloadUrl(key: string, expiresIn = 900) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });
  return getSignedUrl(r2, command, { expiresIn });
}
```

### Pattern 2: Contract Status State Machine

**What:** Enforced status transitions with a transition map, matching the contractor lifecycle pattern.

**When to use:** All contract status changes.

```typescript
// packages/api/src/routers/contract.ts
const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["EXPIRING", "TERMINATED", "SUPERSEDED"],
  EXPIRING: ["ACTIVE", "EXPIRED", "TERMINATED", "SUPERSEDED"],
  EXPIRED: ["TERMINATED", "SUPERSEDED"],
  TERMINATED: [],       // terminal state
  SUPERSEDED: [],       // terminal state
};
// Note: ACTIVE -> EXPIRING and EXPIRING -> EXPIRED are system-triggered
// based on endDate proximity, not user actions
```

### Pattern 3: Document Versioning via DocumentLink Chain

**What:** When uploading a new version, create a new Document record, mark the old one as SUPERSEDED, and link both to the same entity.

**When to use:** "Upload new version" action on any document.

```typescript
// Versioning flow in document router
async function uploadNewVersion(existingDocId: string, newDocData: {...}) {
  return prisma.$transaction(async (tx) => {
    // 1. Mark existing document as superseded
    await tx.document.update({
      where: { id: existingDocId },
      data: { status: "SUPERSEDED" },
    });
    // 2. Create new document record
    const newDoc = await tx.document.create({ data: newDocData });
    // 3. Copy all document links from old to new
    const existingLinks = await tx.documentLink.findMany({
      where: { documentId: existingDocId },
    });
    await tx.documentLink.createMany({
      data: existingLinks.map((link) => ({
        organizationId: link.organizationId,
        documentId: newDoc.id,
        entityType: link.entityType,
        entityId: link.entityId,
        linkRole: link.linkRole,
      })),
    });
    return newDoc;
  });
}
```

### Pattern 4: MIME Validation (Server-Side)

**What:** Validate file content using magic bytes, not file extension.

```typescript
// packages/api/src/services/mime-validator.ts
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // XLSX
  "image/png",
  "image/jpeg",
]);

export async function validateMimeType(buffer: Buffer): Promise<{ valid: boolean; detectedMime: string | undefined }> {
  const result = await fileTypeFromBuffer(buffer);
  const detectedMime = result?.mime;
  return {
    valid: detectedMime !== undefined && ALLOWED_MIMES.has(detectedMime),
    detectedMime,
  };
}
```

### Anti-Patterns to Avoid

- **Uploading through the API server:** Never proxy file uploads through tRPC/Next.js API routes. Use presigned URLs so clients upload directly to R2. This avoids server memory pressure and request timeouts on large files.
- **Extension-based MIME validation only:** Checking `.pdf` extension is trivially spoofable. Always validate magic bytes server-side after upload confirmation.
- **Synchronous virus scanning in the upload path:** Scanning takes seconds. Run it asynchronously after upload confirmation. Display "Scanning..." status to the user and poll/refetch for completion.
- **Storing files in the database:** Never store file content in PostgreSQL. Use R2 for blob storage, database for metadata only.
- **Generating presigned URLs with long expiry:** Keep upload URLs to 5 minutes, download URLs to 15 minutes. Shorter = more secure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned URL generation | Custom token/signing logic | @aws-sdk/s3-request-presigner | S3 signature V4 is complex; SDK handles it correctly |
| MIME detection | Extension parsing or regex | file-type | Magic byte detection covers edge cases, renaming attacks |
| Virus scanning | Custom binary analysis | clamscan + ClamAV daemon | ClamAV has decades of virus signatures; no viable alternative for self-hosted |
| Drag-and-drop upload | Native HTML5 drag events from scratch | react-dropzone | Browser compatibility, accessibility (keyboard, screen reader), file filtering |
| File upload progress | Custom XMLHttpRequest wrapper | react-dropzone + onUploadProgress | react-dropzone provides progress events via its API |
| State machine transitions | Ad-hoc if/else chains | Transition map object (like contractor lifecycle) | Explicit map is testable, documentable, and prevents invalid transitions |

## Common Pitfalls

### Pitfall 1: R2 CORS Configuration Missing
**What goes wrong:** Browser uploads to presigned URLs fail with CORS errors.
**Why it happens:** R2 buckets have no CORS rules by default. Presigned URLs authenticate but CORS is separate.
**How to avoid:** Configure CORS on the R2 bucket to allow PUT from the app domain. Include `Content-Type` in allowed headers.
**Warning signs:** Upload works from Postman/curl but fails from browser.

### Pitfall 2: Content-Type Mismatch on Presigned Upload
**What goes wrong:** R2 rejects the upload or stores with wrong content type.
**Why it happens:** The Content-Type used when generating the presigned URL must match the Content-Type header sent by the client.
**How to avoid:** Generate presigned URL with the exact MIME type the client will send. Pass content type from client to server in the requestUpload call.
**Warning signs:** 403 errors on PUT to presigned URL.

### Pitfall 3: file-type ESM Import in CommonJS Context
**What goes wrong:** `require('file-type')` fails or `import` fails at runtime.
**Why it happens:** file-type v21+ is pure ESM. The API package uses `"type": "module"` so this should be fine, but test harnesses or tooling may have issues.
**How to avoid:** Ensure all consuming packages use ESM (`"type": "module"` in package.json). Use dynamic `import()` if needed in edge cases.
**Warning signs:** `ERR_REQUIRE_ESM` or `SyntaxError: Cannot use import statement`.

### Pitfall 4: Large File Memory Pressure During MIME Validation
**What goes wrong:** Server runs out of memory validating large files.
**Why it happens:** Reading the entire file into a buffer for file-type check.
**How to avoid:** file-type only needs the first 4100 bytes (magic bytes). When validating after R2 upload, use a Range request to fetch only the first few KB, not the entire file.
**Warning signs:** OOM crashes on 25MB file uploads.

### Pitfall 5: Virus Scan Status Never Updates
**What goes wrong:** Document stays in "Scanning..." state forever.
**Why it happens:** Async scan fails silently, no error handling or timeout.
**How to avoid:** Set a scan timeout (e.g., 60 seconds). If ClamAV is unreachable, set status to FAILED (not CLEAN). Add error logging. Client polls document status via TanStack Query refetchInterval.
**Warning signs:** All documents stuck in PENDING virusScanStatus.

### Pitfall 6: Contract Status Expiry Not Automated
**What goes wrong:** Contracts with past endDate remain in ACTIVE status.
**Why it happens:** No scheduled job to transition ACTIVE -> EXPIRING -> EXPIRED.
**How to avoid:** Implement a Next.js API route or cron endpoint that runs daily, queries contracts where endDate is approaching (within reminder intervals) or past, and updates status. For Phase 3, this can be a simple API route called by an external cron (Vercel Cron or similar).
**Warning signs:** Compliance health shows contracts as "active" when they are actually expired.

### Pitfall 7: Presigned Download URL Leakage
**What goes wrong:** Signed download URLs get cached, shared, or bookmarked, allowing unauthorized access.
**Why it happens:** URLs are valid for the expiry period regardless of who uses them.
**How to avoid:** Keep download URL expiry short (15 minutes max). Never cache presigned URLs in TanStack Query. Generate fresh on each download click. Include proper RBAC checks before generating the URL.
**Warning signs:** Documents accessible after user loses permissions.

## Code Examples

### R2 Client Configuration

```typescript
// packages/api/src/services/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

export function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
```

### Storage Key Generation

```typescript
// Deterministic, collision-free storage keys
function generateStorageKey(orgId: string, docId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "";
  return `orgs/${orgId}/documents/${docId}${ext ? `.${ext}` : ""}`;
}
```

### Reusable Drop Zone Component

```tsx
// apps/web/src/components/documents/drop-zone.tsx
"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

interface DropZoneProps {
  onFilesAccepted: (files: File[]) => void;
  onFileRejected?: (errors: Array<{ file: File; message: string }>) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesAccepted, onFileRejected, disabled }: DropZoneProps) {
  const t = useTranslations("Documents");

  const onDrop = useCallback(
    (acceptedFiles: File[], rejections: unknown[]) => {
      if (acceptedFiles.length > 0) onFilesAccepted(acceptedFiles);
      // Handle rejections...
    },
    [onFilesAccepted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled,
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
        isDragActive
          ? "border-primary bg-primary/[0.03]"
          : "border-border bg-muted/50"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input {...getInputProps()} />
      <UploadCloud
        className={`mb-3 h-8 w-8 text-muted-foreground transition-transform ${
          isDragActive ? "scale-110 text-primary" : ""
        }`}
      />
      <p className="text-sm text-muted-foreground">
        {t("dropZone.body")}{" "}
        <Button variant="link" className="h-auto p-0 text-sm" asChild>
          <span>{t("dropZone.browse")}</span>
        </Button>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("dropZone.accepted")}</p>
    </div>
  );
}
```

### Contract Validator Schemas

```typescript
// packages/validators/src/contract.ts
import { z } from "zod";

const contractTypeEnum = z.enum([
  "B2B_MASTER_SERVICE", "STATEMENT_OF_WORK", "NDA",
  "IP_ASSIGNMENT", "DPA", "OTHER",
]);

const contractStatusEnum = z.enum([
  "DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRING",
  "EXPIRED", "TERMINATED", "SUPERSEDED", "ARCHIVED",
]);

const billingModelEnum = z.enum([
  "MONTHLY_RETAINER", "HOURLY", "DAILY",
  "MILESTONE", "DELIVERABLE_BASED", "MIXED",
]);

const rateTypeEnum = z.enum([
  "MONTHLY_FIXED", "PER_HOUR", "PER_DAY",
  "PER_MILESTONE", "PER_DELIVERABLE",
]);

const invoiceCycleEnum = z.enum([
  "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DELIVERABLE", "AD_HOC",
]);

export const contractCreateSchema = z.object({
  contractorId: z.string().min(1, "Contractor is required"),
  title: z.string().min(1, "Contract title is required").max(255),
  type: contractTypeEnum,
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  noticePeriodDays: z.number().int().positive().optional(),
  autoRenewal: z.boolean().default(false),
  renewalTerms: z.string().optional(),
  currency: z.string().length(3),
  billingModel: billingModelEnum,
  rateType: rateTypeEnum,
  rateValueGrosze: z.number().int().nonnegative().optional(),
  retainerAmountGrosze: z.number().int().nonnegative().optional(),
  expectedHoursPerPeriod: z.number().positive().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  invoiceCycle: invoiceCycleEnum.optional(),
  internalOwnerUserId: z.string().optional(),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => !data.endDate || new Date(data.endDate) > new Date(data.startDate),
  { message: "End date must be after start date", path: ["endDate"] },
);

export const contractListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "title", "status", "endDate", "startDate", "type"]).default("endDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  contractorId: z.string().optional(), // For contractor profile pre-filtering
  filters: z.object({
    status: z.array(contractStatusEnum).optional(),
    type: z.array(contractTypeEnum).optional(),
    billingModel: z.array(billingModelEnum).optional(),
    ownerUserId: z.array(z.string()).optional(),
    endDateFrom: z.string().datetime().optional(),
    endDateTo: z.string().datetime().optional(),
    complianceRiskLevel: z.array(z.enum(["LOW", "MEDIUM", "HIGH"])).optional(),
  }).optional(),
});

export const amendmentCreateSchema = z.object({
  contractId: z.string().min(1),
  title: z.string().min(1).max(255),
  effectiveDate: z.string().datetime(),
  description: z.string().optional(),
  changesSummaryJson: z.record(z.unknown()),
});
```

### Async Virus Scan Pattern

```typescript
// packages/api/src/services/virus-scanner.ts
import NodeClam from "clamscan";

let clamInstance: Awaited<ReturnType<typeof new NodeClam().init>> | null = null;

async function getClamInstance() {
  if (!clamInstance) {
    const clam = new NodeClam();
    clamInstance = await clam.init({
      clamdscan: {
        host: process.env.CLAMAV_HOST ?? "127.0.0.1",
        port: Number(process.env.CLAMAV_PORT ?? 3310),
        timeout: 60000,
      },
      preference: "clamdscan",
    });
  }
  return clamInstance;
}

export async function scanStream(stream: ReadableStream | NodeJS.ReadableStream): Promise<{
  isClean: boolean;
  virusName?: string;
}> {
  try {
    const clam = await getClamInstance();
    const { isInfected, viruses } = await clam.scanStream(stream);
    return {
      isClean: !isInfected,
      virusName: viruses?.[0],
    };
  } catch (error) {
    // Log error, return scan failed status
    console.error("Virus scan failed:", error);
    throw error; // Caller handles by setting FAILED status
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AWS SDK v2 single package | AWS SDK v3 modular packages | 2021+ | Import only what you need. Tree-shakeable. |
| Server-proxied uploads | Presigned URL direct uploads | Standard practice | Eliminates server as bottleneck for file transfers |
| Extension-based file validation | Magic byte detection (file-type) | Always best practice | Prevents file type spoofing attacks |
| Synchronous virus scan in request | Async scan with status polling | Standard for web apps | Prevents request timeouts, better UX |
| react-pdf for PDF viewing | Browser-native `<object>/<embed>` | UI-SPEC decision | Zero bundle cost for PDF preview |

## Open Questions

1. **ClamAV hosting in production**
   - What we know: clamscan needs a running ClamAV daemon (clamd). Development can use a local Docker container.
   - What's unclear: Production hosting strategy -- sidecar container, dedicated service, or third-party API.
   - Recommendation: For Phase 3, implement the scanning interface with a configurable host/port. Use Docker for dev. Production deployment decision can be made later. If ClamAV is unavailable, gracefully degrade to FAILED status (never skip scanning).

2. **Cron job for contract status transitions**
   - What we know: ACTIVE -> EXPIRING and EXPIRING -> EXPIRED need automated transition based on endDate.
   - What's unclear: Vercel Cron vs external scheduler vs Next.js API route.
   - Recommendation: Use a Next.js API route (`/api/cron/contract-expiry`) protected by a secret header, triggered by Vercel Cron Jobs (free tier supports daily). Simple implementation: query contracts with endDate approaching/past, update statuses.

3. **R2 bucket creation and CORS setup**
   - What we know: Need an R2 bucket with CORS configured for the app domain.
   - What's unclear: Whether this should be Terraform/Wrangler managed or manual dashboard setup.
   - Recommendation: Document the manual setup steps. Add env vars to `.env.example`. Automate later if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework currently configured |
| Config file | none -- see Wave 0 |
| Quick run command | `pnpm test` (not yet configured) |
| Full suite command | `pnpm test` (not yet configured) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CNTR-01 | Contract creation with all metadata fields | unit | `vitest run packages/api/src/__tests__/contract-router.test.ts -t "create"` | Wave 0 |
| CNTR-02 | Document upload with versioning | integration | `vitest run packages/api/src/__tests__/document-router.test.ts -t "upload"` | Wave 0 |
| CNTR-03 | Contract status transitions (valid + invalid) | unit | `vitest run packages/api/src/__tests__/contract-router.test.ts -t "status"` | Wave 0 |
| CNTR-04 | Expiry reminder configuration storage | unit | `vitest run packages/api/src/__tests__/contract-router.test.ts -t "reminder"` | Wave 0 |
| CNTR-05 | Amendment creation linked to contract | unit | `vitest run packages/api/src/__tests__/contract-router.test.ts -t "amendment"` | Wave 0 |
| DOCS-01 | Document linking to contractor and contract entities | unit | `vitest run packages/api/src/__tests__/document-router.test.ts -t "link"` | Wave 0 |
| DOCS-02 | Presigned download URL generation | unit | `vitest run packages/api/src/__tests__/document-router.test.ts -t "download"` | Wave 0 |
| DOCS-03 | MIME validation rejects invalid types | unit | `vitest run packages/api/src/__tests__/mime-validator.test.ts` | Wave 0 |
| DOCS-04 | Version chain maintained on new version upload | unit | `vitest run packages/api/src/__tests__/document-router.test.ts -t "version"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run --reporter=verbose`
- **Per wave merge:** Full test suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration at workspace root or per package
- [ ] `packages/api/src/__tests__/contract-router.test.ts` -- Contract CRUD + status transitions
- [ ] `packages/api/src/__tests__/document-router.test.ts` -- Upload, download, versioning
- [ ] `packages/api/src/__tests__/mime-validator.test.ts` -- MIME type validation
- [ ] Test fixtures: mock Prisma client, mock R2 client
- [ ] Framework install: `pnpm add -D vitest @vitest/coverage-v8`

## Sources

### Primary (HIGH confidence)
- Cloudflare R2 Presigned URLs docs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare R2 AWS SDK v3 example: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- Cloudflare R2 CORS configuration: https://developers.cloudflare.com/r2/buckets/cors/
- file-type npm package: https://www.npmjs.com/package/file-type
- clamscan npm package: https://www.npmjs.com/package/clamscan
- react-dropzone npm package: https://www.npmjs.com/package/react-dropzone
- Existing codebase: contractor.ts router, contractor-wizard/, contract.prisma schema

### Secondary (MEDIUM confidence)
- R2 virus scanning patterns: https://community.cloudflare.com/t/is-there-any-options-to-enable-r2-virus-scanning/646756
- attachmentAV R2 integration: https://attachmentav.com/solution/malware-protection-for-cloudflare-r2/

### Tertiary (LOW confidence)
- ClamAV production hosting patterns -- needs validation for Vercel/serverless deployment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified against npm registry, versions confirmed current
- Architecture: HIGH -- Patterns directly extend existing Phase 2 codebase (tRPC routers, wizards, tables)
- Pitfalls: HIGH -- R2 CORS and presigned URL issues are well-documented; MIME validation approach is standard
- Virus scanning: MEDIUM -- ClamAV integration is proven but production hosting in serverless needs validation
- Document versioning: HIGH -- Schema supports it natively via Document status + DocumentLink

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days -- stable domain, libraries at mature versions)
