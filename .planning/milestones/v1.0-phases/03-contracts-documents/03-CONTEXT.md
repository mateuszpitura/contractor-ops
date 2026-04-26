# Phase 3: Contracts & Documents - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Contract repository with full lifecycle management (draft through terminated/superseded), version history via amendments, configurable expiry reminders, and secure document management with upload, download via signed URLs, versioning, and malware scanning. Documents link to both contractors and contracts. This phase replaces the contractor profile Contracts and Documents tab placeholders with full implementations and adds a standalone /contracts page.

</domain>

<decisions>
## Implementation Decisions

### Contract list & navigation
- Standalone /contracts page with full TanStack Table (search, filters, bulk actions) AND contracts tab inside contractor profile pre-filtered to that contractor
- Full detail columns by default: Title, Contractor, Type, Status, Start date, End date, Rate, Currency, Billing model, Owner, Compliance risk
- Click row opens slide-out side panel with contract summary, key dates, linked docs. "Open" button navigates to full detail page
- Contract detail page uses tabbed layout: Overview, Documents, Amendments, Activity — consistent with contractor profile pattern

### Contract creation flow
- 3-step wizard: Step 1 (Contract details: title, type, dates, notice period, auto-renewal) → Step 2 (Financial terms: rate, currency, billing cycle, payment terms) → Step 3 (Document upload: attach contract PDF/DOCX)
- Multiple entry points: /contracts page "New" button, contractor profile "Add contract" button (auto-fills contractor), top bar quick action
- Financial terms pre-filled from contractor's billing profile (rate, currency, billing model) — user can override
- Contractor is required — every contract must be linked to a contractor. When creating from contractor profile, auto-selected. From /contracts page, contractor picker required

### Document upload & storage
- Drag & drop zone with "Browse files" button fallback. Shows upload progress, file preview, and validation errors inline
- Upload available from: contract detail page, contractor profile Documents tab, contract creation wizard (step 3), contractor profile Compliance tab (for required docs)
- Allowed file types: PDF, DOCX, XLSX, PNG, JPG — MIME-type validation (not just extension check)
- Inline PDF preview with download button. Other file types show metadata with download-only
- Downloads via short-lived signed URLs (R2 presigned URLs)

### Versioning & amendments
- Amendment timeline view in contract detail Amendments tab: vertical timeline showing original contract, each amendment with date and change summary, current version highlighted. Click any entry to see details/docs
- Manual supersede action — user explicitly marks old contract as "Superseded" and links to new one. Both remain visible in history. No automatic status changes
- Expiry reminders: org-level default intervals in Settings (e.g., 30, 60, 90 days before expiry), per-contract override with custom intervals. Reminders surface in dashboard and notification system
- Explicit document versioning — user clicks "Upload new version" on existing document. Old version moves to history with version number. No accidental overwrites

### Claude's Discretion
- Contract side panel width and content layout
- Contract detail page section ordering within tabs
- Upload progress indicator design (progress bar vs percentage)
- Virus scan status display (inline badge vs notification)
- Document type categorization UX in upload flow
- Search debounce timing and filter behavior
- Empty states for contract list and document sections
- Exact reminder notification delivery (in-app vs email deferred to Phase 7)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with UI views, core processes, API contracts, security requirements
- `db-schema.md` — Complete database schema including Contract, ContractAmendment, ContractRatePeriod, Document, DocumentLink models with all fields and relationships

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 3 requirements: CNTR-01 through CNTR-05, DOCS-01 through DOCS-04
- `.planning/ROADMAP.md` — Phase 3 plans: contract CRUD, document upload/storage, expiry reminders/versioning

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, Stripe Dashboard aesthetic, density settings, RBAC hidden items, dark/light mode
- `.planning/phases/02-contractor-registry/02-CONTEXT.md` — TanStack Table patterns, side panel on row click, multi-step wizard, compliance health scoring, contractor profile tabs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/prisma/schema/contract.prisma` — Full Contract, ContractAmendment, ContractRatePeriod, Document, DocumentLink models already defined with all fields, enums, indexes, and relationships
- `apps/web/src/components/ui/sheet.tsx` — Sheet component for slide-out side panel (same pattern as contractor list)
- `apps/web/src/components/ui/dialog.tsx` — Dialog for wizard steps
- `apps/web/src/components/ui/tabs.tsx` — Tab component for contract detail page
- `apps/web/src/components/ui/card.tsx` — Card component for contract overview sections
- `apps/web/src/components/ui/badge.tsx` — Badge for status chips (DRAFT, ACTIVE, EXPIRING, etc.)
- `apps/web/src/components/ui/calendar.tsx` — Calendar for date pickers in wizard
- `apps/web/src/components/ui/skeleton.tsx` — Loading states
- `apps/web/src/components/contractors/contractor-wizard/wizard-dialog.tsx` — Multi-step wizard pattern to follow
- `apps/web/src/components/settings/users-table.tsx` — TanStack Table reference pattern

### Established Patterns
- tRPC routers in `packages/api/src/routers/` with `tenantProcedure` + `requirePermission()` middleware chain
- Validators in `packages/validators/src/` with Zod schemas — follow contractor.ts patterns for contract/document validators
- `plain()` helper to strip Prisma class prototypes from tRPC returns (TS2742 fix)
- React Hook Form + Zod resolver for all forms
- `useTranslations()` from next-intl for all UI text
- URL query params for tab state (`?tab=contracts`) via nuqs
- PostgreSQL tsvector for full-text search (follow contractor FTS pattern)
- `prisma.$transaction()` for atomic multi-step operations

### Integration Points
- Contractor profile `profile-tabs.tsx` — Contracts and Documents tabs currently show `TabPlaceholder`, need replacement with full implementations
- Contractor profile `profile-header.tsx` — "Add contract" button currently disabled with "Coming in Phase 3" tooltip, needs wiring
- Sidebar nav "Contracts" item already rendered from Phase 1 — needs route wiring to new /contracts page
- Tenant scoping via `tenantStore.run()` — all contract/document queries auto-scoped to organization
- Compliance health scoring in Phase 2 already factors contract status — will use real contract data once available

</code_context>

<specifics>
## Specific Ideas

- Contract list follows the same data-dense Stripe aesthetic as contractor list — TanStack Table with side panel on row click
- Amendment timeline gives visual contract history — easy to see rate changes and scope extensions at a glance
- Pre-fill from contractor billing profile reduces data entry and errors when creating contracts
- Inline PDF preview saves time when reviewing contracts — no need to download every time
- Explicit "Upload new version" prevents accidental overwrites of important legal documents

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-contracts-documents*
*Context gathered: 2026-03-20*
