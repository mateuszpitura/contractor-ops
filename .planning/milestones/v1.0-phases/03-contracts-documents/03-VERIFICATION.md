---
phase: 03-contracts-documents
verified: 2026-03-20T00:00:00Z
status: passed
score: 19/19 must-haves verified
---

# Phase 3: Contracts & Documents Verification Report

**Phase Goal:** Users can manage contracts with full lifecycle tracking, version history, and expiry reminders, and securely upload and download documents linked to contractors and contracts
**Verified:** 2026-03-20
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                              | Status     | Evidence                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Contract can be created with all metadata fields                                                   | VERIFIED   | `contractCreateSchema` with all required fields, `contractRouter.create` mutation with full Prisma write       |
| 2   | Contract status transitions enforced via state machine                                             | VERIFIED   | `CONTRACT_TRANSITIONS` map, `transitionStatus` procedure validates against map, rejects illegal transitions   |
| 3   | Amendments can be added with effectiveDate, title, changesSummaryJson                              | VERIFIED   | `amendmentCreateSchema`, `createAmendment` procedure with auto-generated `AME-{n}` number                    |
| 4   | Contract list supports pagination, sorting, filtering by status/type/billingModel/owner/endDate     | VERIFIED   | `contractListSchema` + `list` procedure with full filter/sort/skip/take implementation                        |
| 5   | Expiry reminder intervals stored per-contract in metadataJson                                      | VERIFIED   | `updateExpiryReminders` procedure writes `reminderDaysBefore` into `metadataJson`                            |
| 6   | Org-level default reminder intervals readable and updatable via settings router                    | VERIFIED   | `getExpiryReminderDefaults` + `updateExpiryReminderDefaults` in settings.ts with fallback [30, 60, 90]       |
| 7   | Documents uploadable via presigned R2 URLs with MIME type validation                              | VERIFIED   | `requestUpload` procedure calls `isAllowedMimeType`, creates Document, returns presigned URL                  |
| 8   | Documents downloadable via short-lived signed URLs (15-minute expiry)                             | VERIFIED   | `getDownloadUrl` calls `createPresignedDownloadUrl(key, 900)`, blocks INFECTED files                         |
| 9   | Documents linked to contractors and/or contracts via DocumentLink                                 | VERIFIED   | `linkToEntity` procedure creates DocumentLink; `requestUpload` auto-creates link when entityType+entityId given |
| 10  | File content validated via magic bytes (not just extension)                                        | VERIFIED   | `mime-validator.ts` uses `fileTypeFromBuffer` from `file-type` package; `scanAndUpdate` validates first 4100 bytes |
| 11  | Virus scan status tracked per document (PENDING, CLEAN, INFECTED, FAILED)                         | VERIFIED   | `scanAndUpdate` fire-and-forget updates `virusScanStatus` via ClamAV; fallback to FAILED if unavailable      |
| 12  | Document versioning creates new doc, marks old SUPERSEDED, copies links                           | VERIFIED   | `uploadNewVersion` in `prisma.$transaction`: marks old SUPERSEDED, creates new, `createMany` on old links    |
| 13  | User can see contract list at /contracts with TanStack Table                                       | VERIFIED   | `contracts/page.tsx` + `ContractDataTable` with `useReactTable`, `manualPagination`, 11 columns              |
| 14  | User can search contracts with FTS                                                                 | VERIFIED   | `use-contract-filters.ts` with `parseAsString` for search; `data-table.tsx` passes to `trpc.contract.list`   |
| 15  | User can filter contracts and open side panel on row click                                         | VERIFIED   | `data-table-filters.tsx` Popovers; `onRowClick` opens `ContractSidePanel` with Sheet + "Open contract" CTA  |
| 16  | User can create a contract via 3-step wizard                                                      | VERIFIED   | `wizard-dialog.tsx` with `Dialog`, `useForm`, `zodResolver`, `trpc.contract.create`, contractor pre-fill     |
| 17  | User can view contract detail at /contracts/{id} with 4 tabs                                      | VERIFIED   | `contracts/[id]/page.tsx` uses `trpc.contract.getById`; detail-header with Breadcrumb + DropdownMenu; 4 tabs |
| 18  | Contractor profile Contracts/Documents tabs show real data; Compliance tab has upload capability   | VERIFIED   | `profile-tabs.tsx` passes contractsContent/documentsContent; tab-contracts uses `trpc.contract.list`; tab-compliance has DropZone |
| 19  | All Phase 3 UI text available in Polish and English                                               | VERIFIED   | `en.json` and `pl.json` contain "Contracts", "Documents", "scanStatus", "expiryReminders" namespaces        |

**Score:** 19/19 truths verified

---

### Required Artifacts

| Artifact                                                                      | Expected                                    | Status     | Details                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `packages/validators/src/contract.ts`                                         | Contract Zod schemas (6 schemas)            | VERIFIED   | All 6 schemas present: create, update, list, statusTransition, amendment, expiryReminder, orgExpiryReminder |
| `packages/api/src/routers/contract.ts`                                        | Contract tRPC router (10 procedures)        | VERIFIED   | All 10 procedures: create, getById, update, list, transitionStatus, createAmendment, listAmendments, updateExpiryReminders, delete, bulkTransition |
| `packages/db/prisma/schema/migrations/.../add_contract_search_vector`         | FTS migration with GIN index                | VERIFIED   | `20260320140000_add_contract_search_vector/migration.sql` with `contract_fts_idx` and `searchVector` tsvector |
| `packages/api/src/services/r2.ts`                                             | R2 client, presigned URL generation         | VERIFIED   | Exports: createR2Client, generateStorageKey, createPresignedUploadUrl, createPresignedDownloadUrl, headObject, deleteObject |
| `packages/api/src/services/mime-validator.ts`                                 | MIME validation via magic bytes             | VERIFIED   | `fileTypeFromBuffer` from `file-type`, `ALLOWED_MIMES`, `validateMimeType`, `isAllowedMimeType` |
| `packages/api/src/services/virus-scanner.ts`                                 | ClamAV wrapper                              | VERIFIED   | `scanBuffer`, `isClamAvailable`, ClamAV singleton with CLAMAV_HOST env var          |
| `packages/validators/src/document.ts`                                         | Document Zod schemas (5 schemas)            | VERIFIED   | requestUpload, confirmUpload, link, list, versionUpload schemas with inferred types |
| `packages/api/src/routers/document.ts`                                        | Document tRPC router (8 procedures)         | VERIFIED   | All 8 procedures: requestUpload, confirmUpload, getDownloadUrl, list, uploadNewVersion, getVersionHistory, delete, linkToEntity |
| `packages/api/src/root.ts`                                                    | Both routers registered in appRouter        | VERIFIED   | `contract: contractRouter` and `document: documentRouter` both present              |
| `apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx`                    | Contract list page route                    | VERIFIED   | 65+ lines with Suspense boundary, heading, DataTable, SidePanel                     |
| `apps/web/src/components/contracts/contract-table/data-table.tsx`             | TanStack Table with server-side ops         | VERIFIED   | `useReactTable`, `manualPagination: true`, `trpc.contract.list.queryOptions`        |
| `apps/web/src/components/contracts/contract-side-panel.tsx`                   | Sheet side panel for contract summary       | VERIFIED   | Sheet component (480px), "Open contract" CTA, status badge, key dates               |
| `apps/web/src/components/contracts/contract-wizard/wizard-dialog.tsx`         | 3-step contract creation wizard             | VERIFIED   | Dialog, useForm, zodResolver, trpc.contract.create, contractorId pre-fill           |
| `apps/web/src/components/contracts/contract-wizard/step-documents.tsx`        | Document upload step                        | VERIFIED   | useDropzone, requestUploadMutation, skip link                                        |
| `apps/web/src/components/layout/top-bar.tsx`                                  | Quick action wired to wizard                | VERIFIED   | Imports ContractWizardDialog, useState for open, renders dialog                     |
| `apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx`               | Contract detail page route                  | VERIFIED   | trpc.contract.getById with SSR prefetch, 4-tab structure                            |
| `apps/web/src/components/contracts/contract-detail/amendments-tab.tsx`        | Amendment timeline view                     | VERIFIED   | Vertical timeline with flex connectors, createAmendment mutation, chronological order |
| `apps/web/src/components/documents/drop-zone.tsx`                             | Reusable drag-and-drop upload               | VERIFIED   | useDropzone, UploadCloud, ACCEPTED_TYPES, MAX_FILE_SIZE (25MB), XMLHttpRequest for progress, trpc.document.requestUpload |
| `apps/web/src/components/documents/document-card.tsx`                         | Document display card with scan status      | VERIFIED   | ShieldCheck, virusScanStatus, Download button, infected guard                        |
| `apps/web/src/components/documents/document-list.tsx`                         | List of document cards                      | VERIFIED   | trpc.document.list query, renders DocumentCard per item                              |
| `apps/web/src/components/documents/pdf-preview.tsx`                           | PDF preview dialog                          | VERIFIED   | Dialog (960px, 80vh), native `<object>` tag, close + download buttons               |
| `apps/web/src/components/documents/upload-progress.tsx`                       | Upload progress row with scan status        | VERIFIED   | Progress bar (0-100%), scan status badges (ShieldCheck, ShieldAlert, ShieldQuestion) |
| `apps/web/src/components/documents/version-history.tsx`                       | Version history section                     | VERIFIED   | trpc.document.getVersionHistory query, expandable version list                       |
| `apps/web/src/components/contractors/contractor-profile/tab-contracts.tsx`    | Contractor profile contracts tab            | VERIFIED   | trpc.contract.list with contractorId filter, WizardDialog with contractorId pre-fill |
| `apps/web/src/components/contractors/contractor-profile/tab-documents.tsx`    | Contractor profile documents tab            | VERIFIED   | trpc.document.list with entityType: "CONTRACTOR", DropZone for uploads              |
| `apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx`   | Compliance tab with document upload         | VERIFIED   | DropZone imported from documents/drop-zone, "Required documents" section             |
| `apps/web/messages/en.json`                                                   | English translations for Contracts+Docs     | VERIFIED   | "Contracts", "Documents", "scanStatus", "expiryReminders" all present               |
| `apps/web/messages/pl.json`                                                   | Polish translations for Contracts+Docs      | VERIFIED   | "Contracts" namespace with "pageTitle": "Umowy", "Documents", "expiryReminders" present |

---

### Key Link Verification

| From                                              | To                                     | Via                                        | Status  | Details                                                                                         |
| ------------------------------------------------- | -------------------------------------- | ------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| `packages/api/src/routers/contract.ts`            | `@contractor-ops/validators`           | contractCreateSchema, contractListSchema   | WIRED   | Import on line 4, all 5 schemas imported and used in procedure inputs                          |
| `packages/api/src/root.ts`                        | `packages/api/src/routers/contract.ts` | `contract: contractRouter`                 | WIRED   | Line 24: `contract: contractRouter`                                                            |
| `packages/api/src/routers/settings.ts`            | `@contractor-ops/validators`           | orgExpiryReminderDefaultsSchema            | WIRED   | Line 4: imported; line 101: used as input schema for updateExpiryReminderDefaults               |
| `packages/api/src/routers/document.ts`            | `packages/api/src/services/r2.ts`     | createPresignedUploadUrl, createPresignedDownloadUrl | WIRED | Lines 15-20: imported; used in requestUpload, confirmUpload, getDownloadUrl, uploadNewVersion |
| `packages/api/src/routers/document.ts`            | `packages/api/src/services/mime-validator.ts` | validateMimeType, isAllowedMimeType | WIRED | Line 21: imported; isAllowedMimeType used in requestUpload/uploadNewVersion; validateMimeType in scanAndUpdate |
| `packages/api/src/root.ts`                        | `packages/api/src/routers/document.ts` | `document: documentRouter`                | WIRED   | Line 25: `document: documentRouter`                                                            |
| `apps/web/src/components/contracts/contract-table/data-table.tsx` | `trpc.contract.list` | tRPC query for server-side data   | WIRED   | Line 117: `trpc.contract.list.queryOptions(queryInput)`                                        |
| `apps/web/src/components/contracts/contract-wizard/wizard-dialog.tsx` | `trpc.contract.create` | tRPC mutation on form submit   | WIRED   | Line 287: `trpc.contract.create.mutationOptions({...})`                                        |
| `apps/web/src/components/contracts/contract-wizard/step-documents.tsx` | `trpc.document.requestUpload` | tRPC mutation for presigned URL | WIRED | Line 132: `trpc.document.requestUpload.mutationOptions({})`                                    |
| `apps/web/src/components/layout/top-bar.tsx`      | `contract-wizard/wizard-dialog.tsx`    | Quick action opens wizard                  | WIRED   | Imports `ContractWizardDialog`, renders with `open={contractWizardOpen}`                       |
| `apps/web/src/components/documents/drop-zone.tsx` | `trpc.document.requestUpload`          | presigned URL upload flow                  | WIRED   | Line 59: `trpc.document.requestUpload.mutationOptions({})`; XHR PUT with progress tracking    |
| `apps/web/src/components/contracts/contract-detail/documents-tab.tsx` | `trpc.document.requestUpload` | via DropZone component | WIRED (indirect) | Imports DropZone which internally calls requestUpload; this is the correct architectural pattern |
| `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` | `tab-contracts.tsx` | contractsContent prop | WIRED | Line 83: `{contractsContent}` replacing former TabPlaceholder                                 |
| `apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx` | `drop-zone.tsx` | DropZone for compliance docs | WIRED | Line 8: import, line 145: rendered with entityType/entityId                                   |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                               | Status      | Evidence                                                                                           |
| ----------- | ----------- | ------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| CNTR-01     | 03-01, 03-03, 03-04 | Create contract with metadata (type, dates, notice, rate, currency, billing cycle, payment terms) | SATISFIED | contractCreateSchema + contractRouter.create mutation; 3-step wizard with all fields |
| CNTR-02     | 03-02, 03-04, 03-05, 03-06 | Upload contract documents (PDF, DOCX) with versioning | SATISFIED | documentRouter with requestUpload/uploadNewVersion; DropZone in wizard step 3, documents-tab, contractor tabs |
| CNTR-03     | 03-01, 03-03 | Contract statuses: draft → active → expiring → expired → terminated → superseded | SATISFIED | CONTRACT_TRANSITIONS map enforces valid state machine; all 8 statuses in enum |
| CNTR-04     | 03-01, 03-05, 03-06 | Configurable reminders before contract expiration (30/60/90 days)        | SATISFIED | updateExpiryReminders per-contract + org-level getExpiryReminderDefaults/updateExpiryReminderDefaults in settings; ExpiryReminderDefaults component in settings page |
| CNTR-05     | 03-01, 03-05 | Add amendments to existing contracts                                     | SATISFIED | amendmentCreateSchema + createAmendment procedure with auto-generated AME-n number; amendments-tab with timeline UI |
| DOCS-01     | 03-02, 03-04, 03-05, 03-06 | Upload documents and link them to contractors and/or contracts | SATISFIED | documentLinkSchema + linkToEntity procedure; DocumentLink entity created on requestUpload; tab-documents and tab-compliance |
| DOCS-02     | 03-02, 03-05 | Download documents via short-lived signed URLs                           | SATISFIED | getDownloadUrl returns presigned GET URL (900s = 15 min); blocks INFECTED documents |
| DOCS-03     | 03-02 | Validate file type (MIME content) and scan uploads for malware           | SATISFIED | mime-validator.ts uses magic bytes via `file-type`; virus-scanner.ts wraps ClamAV; scanAndUpdate runs async post-confirmUpload |
| DOCS-04     | 03-02, 03-05 | Track document versions and maintain upload history                      | SATISFIED | uploadNewVersion marks old as SUPERSEDED, creates new, copies DocumentLinks; getVersionHistory returns full chain; version-history.tsx component |

---

### Anti-Patterns Found

| File                                                                    | Line | Pattern                         | Severity | Impact                                                                                               |
| ----------------------------------------------------------------------- | ---- | ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/contracts/contract-detail/activity-tab.tsx`   | 110  | "Document uploaded placeholder" | INFO     | Acceptable per PLAN: "Placeholder implementation is acceptable if full audit trail is Phase 9". Activity constructed from contract data, not real audit log. |

No blocker or warning anti-patterns found. The single INFO item is an intentional, plan-documented placeholder for the activity tab's document event entries — the rest of the tab renders real contract lifecycle events.

---

### Human Verification Required

#### 1. Contract Status Badge Colors

**Test:** Navigate to /contracts and view contracts in different statuses (Draft, Active, Expiring, Expired, Terminated, Superseded)
**Expected:** Each status shows the correct color: Draft=muted, Active=green, Expiring=amber, Expired=red, Terminated=muted, Superseded=muted at 50% opacity
**Why human:** Visual color rendering cannot be verified programmatically

#### 2. Document Upload Progress Tracking

**Test:** Upload a PDF file via the DropZone in a contract's documents tab or wizard step 3
**Expected:** Progress bar advances 0-100% during the direct R2 PUT via XMLHttpRequest; file transitions to "Scanning..." scan status badge after confirmation
**Why human:** XMLHttpRequest progress event behavior requires a live R2 endpoint to verify

#### 3. Virus Scan Status Display

**Test:** After uploading a document, observe the scan status badge cycle
**Expected:** Shows "Scanning for threats..." (animated spinner), then updates to "Scan passed" (green shield) or appropriate error state
**Why human:** Requires ClamAV daemon running; scan status updates are async polling or page refresh

#### 4. Contract Wizard Contractor Pre-fill

**Test:** Open the contract wizard from a contractor profile's "Add contract" button
**Expected:** Contractor field is pre-selected and read-only; financial terms (rate, currency, billing model) are pre-filled from the contractor's billing profile with "Pre-filled from contractor billing profile" hint text
**Why human:** Dynamic form state and pre-fill UX requires manual interaction

#### 5. Side Panel "Open contract" Navigation

**Test:** Click a row in the /contracts table, then click "Open contract" in the side panel
**Expected:** Navigates to /contracts/{id} with all 4 tabs visible
**Why human:** Navigation behavior requires live browser testing

#### 6. PDF Preview Dialog

**Test:** Upload a PDF to a contract, then click the "Preview" button on the document card
**Expected:** Dialog opens with browser-native PDF embed at 960px width, with a download button in the header
**Why human:** Browser PDF embed rendering varies by browser/OS

---

### Gaps Summary

No gaps found. All 19 observable truths are verified. All 9 requirements (CNTR-01 through CNTR-05, DOCS-01 through DOCS-04) are satisfied by substantive, wired implementations.

**Notable implementation details observed during verification:**

- The contract FTS migration is at `packages/db/prisma/schema/migrations/` (not the standard `packages/db/prisma/migrations/`) — this is consistent with the project's schema-per-file migration pattern established in Phase 2.
- The `documents-tab.tsx` wires `requestUpload` indirectly via the `DropZone` component rather than calling the mutation directly. This is architecturally correct (DropZone is the reusable abstraction) — the PLAN key link pattern check would need to traverse one component boundary.
- The `.env.example` vars for R2 and ClamAV are in the root `.env.example` (not `apps/web/.env.example` as the PLAN specified) — functionally equivalent for a monorepo.
- The `upload-progress.tsx` component receives `progress` as a prop from `drop-zone.tsx` (which uses XMLHttpRequest internally) rather than managing XHR itself — this is clean separation of concerns, not a gap.
- `requirePermission` uses `{ contract: [...] }` (singular) in the contract router — consistent with the permission resource naming convention from the existing contractor router which uses `{ contractor: [...] }`.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
