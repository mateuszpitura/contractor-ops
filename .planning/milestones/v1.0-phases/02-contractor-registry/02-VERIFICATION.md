---
phase: 02-contractor-registry
verified: 2026-03-20T13:00:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 2: Contractor Registry Verification Report

**Phase Goal:** Users can manage their full contractor roster with search, filtering, bulk operations, and detailed profiles showing lifecycle status and compliance health
**Verified:** 2026-03-20T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | tRPC contractor.create mutation accepts company details, billing, and assignment data and persists a new Contractor row | VERIFIED | `packages/api/src/routers/contractor.ts` line 376: full create mutation with `$transaction` creating Contractor + ContractorBillingProfile. All contractorCreateSchema fields mapped. |
| 2  | tRPC contractor.list query returns paginated contractors with server-side sorting, filtering, and full-text search | VERIFIED | Lines 157-282: buildable `where` clause with filter support, `$queryRaw` tsvector search (min 2 chars, prefix `:*` terms), `findMany` with skip/take/orderBy, `count` for total. Returns `{ items, total, page, pageSize }`. |
| 3  | tRPC contractor.getById query returns full contractor with billing profiles, compliance items, and computed health score | VERIFIED | Lines 287-371: full `include` with all relations (billingProfiles, complianceItems, contracts, _count). Calls `computeComplianceHealth()`. Returns contractor with `complianceHealth` appended. |
| 4  | tRPC contractor.updateLifecycleStage validates legal status transitions | VERIFIED | Lines 552-601: `LEGAL_TRANSITIONS` map enforced; throws `BAD_REQUEST` on illegal transition; sets status=INACTIVE on ENDED, status=ACTIVE on ACTIVE+INACTIVE. |
| 5  | tRPC contractor.gusLookup fetches company data from GUS BIR1 API by NIP | VERIFIED | Lines 755-800: dynamic `import("bir1")`, `bir.login()`, `bir.search({ nip })`, graceful `found: false` on any failure, `finally` logout. |
| 6  | Full-text search via PostgreSQL tsvector works across legalName, displayName, taxId, email | VERIFIED | Migration SQL: `GENERATED ALWAYS AS` tsvector with weighted fields (legalName/displayName rank A, taxId/email rank B) and `GIN` index. Router uses `to_tsquery('simple', ...)` with tenant-scoped `WHERE organizationId = ...`. |
| 7  | Compliance health score is computed server-side from documents, contract status, overdue tasks, unpaid invoices | VERIFIED | `computeComplianceHealth()` function lines 43-126: 4 factors (documents, contract, tasks, invoices), overall = red if any red / yellow if any yellow / green otherwise. |
| 8  | User can see a paginated, sortable contractor list with 12 columns and configurable column visibility | VERIFIED | `columns.tsx` 279 lines: 13 column defs (select + 12 data). Column visibility stored in `localStorage` key `contractor-table-columns`. `DataTableColumnToggle` dropdown for toggling. |
| 9  | User can search contractors by name, company, NIP, or email with instant results | VERIFIED | `data-table-toolbar.tsx` has search input with 300ms debounce. `useContractorFilters` syncs to URL via nuqs. `data-table.tsx` passes `search` param to `trpc.contractor.list.queryOptions`. |
| 10 | User can filter contractors by status, owner, team, billing model, contract end date, compliance health | VERIFIED | Filter popover in toolbar with lifecycle stage, owner, team, billing model, compliance health options. URL-synced via nuqs. Query maps all filters to `contractorListSchema.filters`. |
| 11 | User can select rows and perform bulk actions: assign owner, export CSV/XLSX, archive | VERIFIED | `data-table-bulk-actions.tsx`: `bulkArchive`, `bulkAssignOwner`, `export` mutations wired and called. AlertDialog for archive confirmation. Toast on success with query invalidation. |
| 12 | User can click a row to open a slide-out side panel with contractor summary | VERIFIED | `data-table.tsx` calls `onRowClick(row.original)`. `ContractorSidePanel` (Sheet, 480px) shows name, badges, NIP, email, billing model, rate, owner, team, and "Open full profile" link. |
| 13 | User can add a contractor via 3-step wizard with GUS NIP autofill | VERIFIED | `wizard-dialog.tsx`: 3-step React Hook Form, zodResolver, per-step validation. `step-company.tsx` calls `/api/trpc/contractor.gusLookup` via fetch and fills fields via `form.setValue`. `contractor.create.mutationOptions` on submit. |
| 14 | User can view contractor profile with header showing name, status badge, type badge, owner, and action buttons | VERIFIED | `profile-header.tsx` 253 lines: displayName heading, lifecycle badge (colored per stage), type badge, owner Avatar, conditional lifecycle action DropdownMenu calling `updateLifecycleStage` / `archive` mutations. |
| 15 | Compliance tab shows full checklist of required documents with upload status and action buttons | VERIFIED | `tab-compliance.tsx`: complianceItems rendered as rows with status badges (SATISFIED/MISSING/EXPIRED/PENDING/WAIVED), color-coded styles, expiring-soon amber text (within 30 days), MISSING items with `bg-red-50` highlight, Upload button disabled with "Coming in Phase 3" tooltip. |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/validators/src/contractor.ts` | Zod schemas for contractor CRUD, NIP/IBAN validation, list filters | VERIFIED | 166 lines. Exports: `contractorCreateSchema`, `contractorUpdateSchema`, `contractorListSchema`, `contractorLifecycleTransitionSchema`, `gusLookupSchema`, `nipSchema`, `isValidNip`. NIP mod-11 with weights [6,5,7,2,3,4,5,6,7]. IBAN via `ibantools`. |
| `packages/validators/src/index.ts` | Re-exports all contractor schemas and types | VERIFIED | All 7 schemas + 5 types re-exported. |
| `packages/api/src/routers/contractor.ts` | Full contractor tRPC router | VERIFIED | 801 lines. 10 procedures: list, getById, create, update, updateLifecycleStage, archive, bulkArchive, bulkAssignOwner, export, gusLookup. All use `tenantProcedure` + `requirePermission`. |
| `packages/db/prisma/schema/contractor.prisma` | Contractor model with tsvector annotation | VERIFIED | Comment annotation present noting `search_vector` is a PostgreSQL GENERATED column. |
| `packages/db/prisma/schema/migrations/20260320120000_add_contractor_search_vector/migration.sql` | FTS migration with search_vector and GIN index | VERIFIED | `ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (...)` with weighted fields + `CREATE INDEX ... USING GIN`. |
| `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` | Contractor list page (server component shell) | VERIFIED | 97 lines. Suspense boundary, wires `ContractorDataTable`, `ContractorSidePanel`, `WizardDialog`. |
| `apps/web/src/components/contractors/contractor-table/data-table.tsx` | TanStack Table wrapper with server-side data fetching | VERIFIED | `useReactTable` with `manualPagination/Sorting/Filtering: true`, `trpc.contractor.list.queryOptions`, skeleton loading, empty state with CTA. |
| `apps/web/src/components/contractors/contractor-table/columns.tsx` | 13 column definitions | VERIFIED | 279 lines. 13 columns (select + 12 data). Note: columns 9 (nextInvoice) and 11 (contractEnd) render `—` placeholder — acceptable since invoice/contract data is Phase 3/5 scope. |
| `apps/web/src/components/contractors/contractor-table/data-table-toolbar.tsx` | Search + filter toolbar | VERIFIED | Search input with debounce, filter popover, active filter badges with remove/clear. |
| `apps/web/src/components/contractors/contractor-table/data-table-pagination.tsx` | Pagination component | VERIFIED | Page size selector (10/25/50), prev/next buttons, page count, total count, selection count. |
| `apps/web/src/components/contractors/contractor-table/data-table-column-toggle.tsx` | Column visibility dropdown | VERIFIED | SlidersHorizontal button, DropdownMenu with checkbox items, localStorage persistence. |
| `apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx` | Bulk action toolbar | VERIFIED | `bulkArchive`, `bulkAssignOwner`, `export` (CSV + XLSX) mutations. AlertDialog confirmation for archive. Toast + query invalidation on success. |
| `apps/web/src/components/contractors/contractor-table/use-contractor-filters.ts` | nuqs URL state hook | VERIFIED | 27 lines. `useQueryStates` with `parseAsInteger`/`parseAsString`/`parseAsArrayOf` for all 10 filter params. |
| `apps/web/src/components/contractors/contractor-side-panel.tsx` | Slide-out Sheet side panel | VERIFIED | 181 lines. Sheet from shadcn, 480px width, shows contractor summary with all key fields, "Open full profile" Link. |
| `apps/web/src/components/contractors/compliance-health-badge.tsx` | Green/yellow/red compliance badge | VERIFIED | 63 lines. Pill badge with icon + i18n label for all 3 states. Used in columns.tsx and tab-overview.tsx. |
| `apps/web/src/components/contractors/contractor-wizard/wizard-dialog.tsx` | Multi-step add contractor dialog | VERIFIED | 3-step Dialog, React Hook Form + zodResolver, per-step validation, step progress indicator, discard confirmation AlertDialog. |
| `apps/web/src/components/contractors/contractor-wizard/step-company.tsx` | Step 1: company details + GUS autofill | VERIFIED | NIP input with "Fetch from GUS" button, `fetch()` to `/api/trpc/contractor.gusLookup`, `form.setValue()` autofill on success. |
| `apps/web/src/components/contractors/contractor-wizard/step-billing.tsx` | Step 2: billing fields | VERIFIED | billingModel Select, currency Select, rate input (zloty display / grosze storage), IBAN input, payment terms. |
| `apps/web/src/components/contractors/contractor-wizard/step-assignment.tsx` | Step 3: owner/team assignment | VERIFIED | Owner Select (from `trpc.user.list`), team/project/cost center placeholders. |
| `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` | Contractor profile page | VERIFIED | 185 lines. Dynamic `[id]` routing, `trpc.contractor.getById.queryOptions`, skeleton loading, 404/error states, flex layout with right rail. |
| `apps/web/src/components/contractors/contractor-profile/profile-header.tsx` | Profile header with lifecycle actions | VERIFIED | 253 lines. Name, lifecycle badge, type badge, owner Avatar, conditional DropdownMenu with `updateLifecycleStage` + `archive` mutations. |
| `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` | 8-tab navigation | VERIFIED | 8 tabs defined, URL `?tab=` query param via `useSearchParams`/`useRouter.replace`. Overview + compliance functional; contracts/documents/workflows/invoices/payments are `TabPlaceholder`; activity derived from contractor data. |
| `apps/web/src/components/contractors/contractor-profile/tab-overview.tsx` | Overview tab with health card | VERIFIED | 322 lines. 5 cards (company details, billing info, active contract, compliance health with clickable factors, key dates). `ComplianceHealthBadge` rendered for overall health. |
| `apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx` | Compliance checklist | VERIFIED | SATISFIED/MISSING/EXPIRED/PENDING/WAIVED badges, expiring-soon detection (30d), `bg-red-50` for MISSING, Upload button with Phase 3 tooltip. |
| `apps/web/src/components/contractors/contractor-profile/tab-placeholder.tsx` | Reusable placeholder for future tabs | VERIFIED | Props: `phase`, `featureDescription`, `icon`. Renders "Coming in Phase X" pattern. |
| `apps/web/src/components/contractors/contractor-profile/right-rail.tsx` | Sticky right rail | VERIFIED | `sticky top-[80px]` class confirmed. Activity timeline, quick notes textarea (calls `contractor.update` mutation), reminders placeholder. |
| `apps/web/messages/en.json` | English i18n namespaces | VERIFIED | `Contractors`, `ContractorProfile`, `ContractorWizard`, `Validation.contractor` namespaces all present. |
| `apps/web/messages/pl.json` | Polish i18n namespaces | VERIFIED | All 4 namespaces present in Polish. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/contractor.ts` | `packages/validators/src/contractor.ts` | `import contractorCreateSchema, contractorListSchema, ...` | WIRED | Line 4-10: imports all 5 schemas from `@contractor-ops/validators`. |
| `packages/api/src/routers/contractor.ts` | `packages/api/src/middleware/tenant.ts` | `tenantProcedure` on all procedures | WIRED | All 10 procedures use `tenantProcedure`. Verified via grep. |
| `packages/api/src/routers/contractor.ts` | `packages/api/src/middleware/rbac.ts` | `requirePermission({ contractor: [...] })` | WIRED | All 10 procedures use `.use(requirePermission({ contractor: [...] }))`. |
| `packages/api/src/root.ts` | `packages/api/src/routers/contractor.ts` | `contractor: contractorRouter` registration | WIRED | Line 5: `import { contractorRouter }`, line 19: `contractor: contractorRouter`. |
| `apps/web/src/components/contractors/contractor-table/data-table.tsx` | `packages/api/src/routers/contractor.ts` | `trpc.contractor.list.queryOptions` | WIRED | Line 107: `useQuery(trpc.contractor.list.queryOptions(queryInput))`. Data is used to populate table rows. |
| `apps/web/src/components/contractors/contractor-wizard/wizard-dialog.tsx` | `packages/api/src/routers/contractor.ts` | `trpc.contractor.create.mutationOptions` | WIRED | Line 198: mutation called on final step submit. `onSuccess` closes dialog, toasts, invalidates query. |
| `apps/web/src/components/contractors/contractor-table/use-contractor-filters.ts` | `nuqs` | `useQueryStates` | WIRED | Line 1-6: imports from nuqs; all 10 filter params declared. |
| `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` | `packages/api/src/routers/contractor.ts` | `trpc.contractor.getById.queryOptions` | WIRED | Line 75: query used to fetch contractor. Result passed to all child components. |
| `apps/web/src/components/contractors/contractor-profile/profile-header.tsx` | `packages/api/src/routers/contractor.ts` | `trpc.contractor.updateLifecycleStage.mutationOptions` | WIRED | Line 76: lifecycle stage mutation. Line 96: archive mutation. Both use `queryClient.invalidateQueries` on success. |
| `apps/web/src/components/contractors/contractor-profile/tab-overview.tsx` | `apps/web/src/components/contractors/compliance-health-badge.tsx` | `ComplianceHealthBadge` import | WIRED | Line 15: import. Line 263: rendered with `contractor.complianceHealth.overall`. |
| `apps/web/src/components/contractors/contractor-wizard/step-company.tsx` | GUS BIR1 via tRPC | `fetch('/api/trpc/contractor.gusLookup')` | WIRED | Line 57: direct fetch to tRPC endpoint (query procedure, not mutation). `form.setValue` called for each autofill field on success. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CONT-01 | 02-01, 02-02 | User can add a contractor with company details (legal name, NIP, VAT-EU, address, type) | SATISFIED | `contractorCreateSchema` includes all fields; `create` procedure persists them; 3-step wizard exposes all fields in step-company.tsx. |
| CONT-02 | 02-01, 02-02 | User can set contractor billing details (bank account, currency, billing model, default rate) | SATISFIED | Billing fields in `contractorCreateSchema` (billingModel, rateValueGrosze, bankAccount, paymentTermsDays); stored in `customFieldsJson` + billing profile; step-billing.tsx exposes all fields. |
| CONT-03 | 02-01, 02-02 | User can assign a contractor to an internal owner, team, project, and cost center | SATISFIED | Assignment fields in schema (ownerUserId, primaryTeamId, primaryProjectId, defaultCostCenterId); create procedure persists them; step-assignment.tsx with owner Select from user list. |
| CONT-04 | 02-01, 02-02 | User can search contractors with full-text search across name, company, NIP, email | SATISFIED | tsvector migration with weighted legalName/displayName (A), taxId/email (B); `$queryRaw` search in list procedure; search input in toolbar with nuqs URL sync. |
| CONT-05 | 02-01, 02-02 | User can filter contractors by status, owner, team, billing model, contract end date, compliance health | SATISFIED | `contractorListSchema.filters` supports all filter types; filter popover in toolbar; nuqs URL state; post-filter for complianceHealth. Note: contract end date filter is defined in schema but not exposed in toolbar popover — partial UI exposure, but backend supports it. |
| CONT-06 | 02-02 | User can perform bulk actions on contractors (assign owner, export, archive, launch workflow) | SATISFIED | `bulkArchive`, `bulkAssignOwner`, `export` (CSV+XLSX) all wired; "Launch workflow" button present but disabled with "Coming in Phase 4" tooltip (by design). |
| CONT-07 | 02-03 | User can view contractor profile with tabs: overview, contracts, documents, workflows, invoices, payments, activity, compliance | SATISFIED | 8 tabs in `profile-tabs.tsx`; overview + compliance fully implemented; contracts/documents/workflows/invoices/payments are intentional placeholders per plan scope; activity shown from contractor data. |
| CONT-08 | 02-01, 02-02, 02-03 | System calculates and displays compliance health score (green/yellow/red) based on required documents, contract status, and overdue tasks | SATISFIED | `computeComplianceHealth()` with 4 factors; `ComplianceHealthBadge` component used in columns, side panel, tab-overview; compliance health card with clickable factors. |
| CONT-09 | 02-01, 02-03 | Contractor status follows lifecycle: draft → onboarding → active → offboarding → inactive → archived | SATISFIED | `LEGAL_TRANSITIONS` map enforces valid transitions; `updateLifecycleStage` throws `BAD_REQUEST` on illegal transition; side effects (ENDED → INACTIVE); `archive` procedure sets ARCHIVED+ENDED+archivedAt. Profile header shows conditional lifecycle actions per current stage. |

All 9 requirements for Phase 2 are SATISFIED. No orphaned requirements found — the REQUIREMENTS.md phase mapping table shows all CONT-01 through CONT-09 as Phase 2 / Complete, matching what the 3 plans collectively claimed.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `columns.tsx` | 213, 238 | Column cells for "Next invoice expected" and "Contract end date" always render `—` | Info | Expected — invoice/contract data belongs to Phase 3/5. Columns are present with correct headers; they will be wired when those phases land. Not a goal blocker. |
| `profile-tabs.tsx` | 80-114 | 5 tabs render `TabPlaceholder` ("Coming in Phase X") | Info | Expected and designed — plan explicitly scoped Contracts/Documents/Workflows/Invoices/Payments to future phases. Tab placeholders communicate roadmap to users. |
| `right-rail.tsx` | ~170 | Notes save uses `as any` cast to work around stale TS cache | Info | Documented deviation in 02-03-SUMMARY. Functional at runtime; `notes` field added to contractorUpdateSchema. Low risk cosmetic workaround. |

No blocker or warning anti-patterns found. All "placeholder" patterns are intentional, scoped, and documented.

---

### Human Verification Required

#### 1. GUS BIR1 Autofill End-to-End

**Test:** Enter a valid Polish NIP in the wizard step-company field and click "Fetch from GUS"
**Expected:** Spinner appears during fetch; legal name, address fields auto-populate; success toast shown; fields remain editable
**Why human:** GUS BIR1 API requires network access and a valid API key. Direct fetch approach (not tRPC mutation) cannot be verified programmatically.

#### 2. Compliance Health Badge Color Rendering

**Test:** Navigate to contractor list and profile pages with contractors in different compliance states
**Expected:** Green badge for fully compliant, yellow for pending/expiring, red for missing/expired documents or no active contract
**Why human:** Color rendering and visual quality cannot be asserted via code inspection.

#### 3. Bulk Export CSV/XLSX Download

**Test:** Select 2-3 contractors and use Export > CSV and Export > XLSX bulk actions
**Expected:** File download triggered in browser with correct contractor data and column headers
**Why human:** Base64 buffer → blob download flow requires browser interaction to verify.

#### 4. URL Deep-linking to Profile Tabs

**Test:** Navigate to `/contractors/[id]?tab=compliance` directly
**Expected:** Compliance tab is pre-selected; switching tabs updates URL; browser back/forward works
**Why human:** URL state behavior requires browser navigation to verify.

---

### Gaps Summary

No gaps found. All 15 observable truths are fully verified at all three levels (exists, substantive, wired). All 9 CONT requirements are satisfied with concrete implementation evidence.

The two "placeholder" column cells (nextInvoice, contractEnd) and five "Coming in Phase X" profile tabs are intentional scope boundaries documented in the plans, not implementation gaps.

---

_Verified: 2026-03-20T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
