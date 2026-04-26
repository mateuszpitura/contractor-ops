# Phase 2: Contractor Registry - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Full contractor CRUD with search, filtering, bulk operations, and detailed tabbed profiles showing lifecycle status and compliance health. Includes: contractor list table, add contractor wizard, contractor profile page (all 8 tabs with placeholders for future phases), compliance health scoring with configurable required documents, and slide-out side panel.

</domain>

<decisions>
## Implementation Decisions

### Contractor list table
- All 12 columns visible by default: Name/Company, Type, Status, Owner, Billing model, Rate, Currency, Next invoice expected, Team/Project, Contract end date, Last activity, Compliance health badge
- Default sort: Created (newest first)
- Click row → slide-out side panel with profile summary. "Open" button for full profile page.
- User-configurable column visibility (show/hide dropdown, persisted per user)
- Bulk actions when rows selected: assign owner, export CSV/XLSX, archive, launch workflow
- Pagination with configurable page size (follows density setting from Phase 1)
- Full-text search across name, company, NIP, email (PostgreSQL full-text search)
- Filters: status, owner, team, billing model, contract end date range, compliance health

### Contractor profile page
- Full header: name, company, status chip, type badge, owner avatar, action buttons (Edit, Add contract, Upload invoice, Start onboarding, Start offboarding, Mark inactive)
- All 8 tabs present from day 1: Overview, Contracts, Documents, Workflows, Invoices, Payments, Activity, Compliance
- Tabs for future phases show placeholder: "Coming in Phase X" with brief description
- Overview tab: company details, billing info, active contract summary, health card, key dates
- Compliance tab: full checklist with required docs per type, upload status, expiry dates, missing items highlighted, action buttons to upload
- Sticky right rail: activity timeline + quick notes (activity data will be sparse initially — shows contractor creation, status changes, profile edits)
- Right rail also shows upcoming reminders and pending approvals (empty until Phase 3+)

### Add contractor form
- Multi-step wizard: Step 1 (Company details) → Step 2 (Billing) → Step 3 (Assignment) with progress indicator
- Required fields: legal name, type (JDG/sole trader/company/freelancer), NIP, email, billing model, currency, rate, owner
- GUS autofill: enter NIP → auto-fetch company name, address, REGON from Polish GUS registry API
- Top bar "Add contractor" quick action opens the same full wizard (not a simplified version)
- Wizard validates each step before allowing next

### Compliance health scoring
- Multi-factor health calculation: required documents + contract status (active/expiring/expired) + overdue tasks + unpaid invoices
- Green: all factors OK. Yellow: non-critical items missing or expiring soon. Red: critical docs missing, expired contract, or critical overdue items
- Required documents per contractor type are configurable by admin in Settings (compliance requirements template)
- Health card on Overview tab: dedicated card with checklist items (✅ Documents complete? ✅ Contract active? ✅ No overdue tasks? ✅ No unpaid invoices?) — each item green/yellow/red
- Compliance tab: full checklist of required docs with upload status, expiry dates, missing items highlighted, action buttons

### Claude's Discretion
- Exact GUS API integration approach (direct API vs third-party wrapper)
- Side panel width and animation
- Contractor profile URL structure
- Search debounce timing and minimum query length
- Export file format details (column mapping)
- How to handle contractor type change (what happens to required docs)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` §9.2–9.3 — Contractor list columns, filters, bulk actions, profile tabs, health card
- `prd.md` §11.1 — Contractor Registry functional requirements
- `prd.md` §11.8 — Compliance & Audit requirements, configurable document checklist
- `db-schema.md` §4 — Contractor, ContractorContact, ContractorBillingProfile, ContractorAssignment, ContractorTag, ContractorTagLink, ContractorComplianceItem, ComplianceRequirementTemplate models

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: CONT-01 through CONT-09
- `.planning/ROADMAP.md` — Phase 2 plans: contractor CRUD, search/filters/bulk, profiles/compliance

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, Stripe Dashboard aesthetic, user-configurable density, RBAC hidden items
- `.planning/phases/01-foundation-auth/01-UI-SPEC.md` — Design tokens, typography, spacing, color palette, component registry

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/ui/table.tsx` — shadcn Table component (base for TanStack Table)
- `apps/web/src/components/ui/dialog.tsx` — Dialog for add contractor wizard steps
- `apps/web/src/components/ui/badge.tsx` — For status chips and compliance badges
- `apps/web/src/components/ui/card.tsx` — For profile overview cards and health card
- `apps/web/src/components/ui/sheet.tsx` — For slide-out side panel
- `apps/web/src/components/ui/command.tsx` — For search (cmdk)
- `apps/web/src/components/ui/select.tsx` — For filter dropdowns
- `apps/web/src/components/ui/skeleton.tsx` — For loading states
- `apps/web/src/components/settings/users-table.tsx` — Reference pattern for TanStack Table with actions

### Established Patterns
- tRPC routers in `packages/api/src/routers/` with tenant middleware chain
- Validators in `packages/validators/src/` with Zod schemas
- Auth client in `apps/web/src/lib/auth-client.ts`
- i18n via `useTranslations()` from next-intl
- Form pattern: React Hook Form + Zod resolver (see register-form.tsx, org-settings-form.tsx)

### Integration Points
- Prisma Contractor model already exists in `packages/db/prisma/schema/contractor.prisma` with all fields
- Sidebar nav item "Contractors" already rendered (from Phase 1) — needs route wiring
- Top bar "Add contractor" quick action button exists — needs onClick handler
- Tenant scoping via `tenantStore.run()` in middleware — all contractor queries auto-scoped

</code_context>

<specifics>
## Specific Ideas

- Side panel on row click (not full page navigation) — keeps the list visible, like Stripe's detail panels
- GUS autofill for NIP — differentiator for Polish market, saves manual data entry
- All 8 profile tabs visible from day 1 with placeholders — user sees the full product scope
- Multi-step wizard for adding contractors — structured data entry for the many required fields

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-contractor-registry*
*Context gathered: 2026-03-20*
