# Phase 10: Onboarding & Polish - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

New organizations get a guided setup experience, existing spreadsheet users can import their data, and power users can navigate the entire app via search and command palette. Delivers: CSV/XLSX import wizard for contractors and contracts, product onboarding wizard with persistent checklist, empty states across all views, global search bar, and Cmd+K command palette.

</domain>

<decisions>
## Implementation Decisions

### Import wizard flow
- **D-01:** Auto-match column mapping by header names with manual override dropdowns. System guesses mappings (e.g., "Company Name" → legalName), user corrects mismatches in a dropdown grid
- **D-02:** Import valid rows, skip invalid — show a table of rejected rows with error details per field. User can fix and re-import just the failures
- **D-03:** Duplicate detection by NIP/tax ID — highlight conflicts, let user choose per-row: skip, update existing, or create new
- **D-04:** Support large imports (1000+ rows) — upload file to server, async processing with status polling. Parse with xlsx library (already in deps)

### Onboarding wizard
- **D-05:** Persistent dashboard checklist widget (like Stripe/Linear) that also re-enterable from Settings ("Setup Guide"). Not a blocking modal
- **D-06:** Full 5-step wizard: Org details → Invite team → Import/add contractor → Configure approval chain → Connect Slack. Some steps marked optional (approval chain, Slack)
- **D-07:** Soft dismiss — no explicit "skip". "I'll do this later" collapses wizard into a dashboard checklist widget
- **D-08:** Progress persisted in org settingsJson as `onboardingCompletedSteps: string[]` — survives across sessions, visible to all admins

### Empty states
- **D-09:** Every list/view gets a dedicated empty state — core entity lists (Contractors, Contracts, Invoices, Workflows, Payments) + Dashboard widgets, Reports, Approval queue, Notification center, Audit log
- **D-10:** Guided format: icon + heading + explanatory paragraph + primary CTA button + secondary action (e.g., "Add contractor" + "Import from CSV")
- **D-11:** Smart sequencing: empty states suggest the logical next step based on what data exists. No contractors → "Add your first contractor". Has contractors but no contracts → "Create a contract for your contractor". Context-aware, not static
- **D-12:** Friendly/encouraging tone: "Your contractor list is empty — let's fix that! Add your first contractor or import from a spreadsheet."

### Command palette & global search
- **D-13:** Search covers contractors, contracts, invoices + all pages/sections as navigation targets (type "settings" → go to Settings)
- **D-14:** Quick actions: navigation to any page + create actions ("New contractor", "New contract", "Upload invoice", "Start workflow") + contextual actions based on current page
- **D-15:** Recent items + user-pinned favorites shown when palette opens before typing. Last 5-10 viewed entities, user can pin frequently accessed items
- **D-16:** Flat result list ranked by relevance with small type badge (Contractor/Contract/Invoice/Page), not grouped sections

### Claude's Discretion
- Loading/error states for import processing
- Exact onboarding checklist widget placement and styling
- Search result ranking algorithm and debounce timing
- How many recent items to show (5-10 range)
- Empty state icon choices per view
- Keyboard shortcuts beyond Cmd+K

</decisions>

<specifics>
## Specific Ideas

- Onboarding checklist should feel like Linear's or Stripe's setup guide — compact, non-intrusive, progress-driven
- Import wizard reuses existing wizard-dialog.tsx pattern (multi-step Dialog with React Hook Form + Zod)
- Command palette uses existing cmdk components (command.tsx already installed)
- Smart empty states should feel helpful, not patronizing — guide without blocking

</specifics>

<canonical_refs>
## Canonical References

### Import wizard
- `packages/api/src/services/report-export.ts` — xlsx library usage, BOM handling for Polish characters (reverse this pattern for import)
- `packages/validators/src/contractor.ts` — contractorCreateSchema validation rules for import validation
- `packages/validators/src/contract.ts` — contractCreateSchema for contract import validation
- `apps/web/src/components/contractors/contractor-wizard/wizard-dialog.tsx` — Multi-step wizard Dialog pattern to reuse
- `apps/web/src/components/documents/drop-zone.tsx` — File upload with react-dropzone

### Onboarding wizard
- `apps/web/src/app/[locale]/(dashboard)/page.tsx` — Dashboard page where checklist widget lives
- `apps/web/src/lib/navigation.ts` — Navigation items config (for step routing)

### Empty states
- `apps/web/src/app/[locale]/(dashboard)/page.tsx` — Existing DashboardEmptyState pattern (icon + heading + body + CTA)

### Command palette & search
- `apps/web/src/components/ui/command.tsx` — cmdk components (CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem)
- `packages/api/src/routers/contractor.ts` — PostgreSQL tsvector full-text search pattern (lines 183-207)
- `packages/db/prisma/schema/migrations/20260320120000_add_contractor_search_vector/migration.sql` — Search vector migration pattern
- `packages/db/prisma/schema/migrations/20260320140000_add_contract_search_vector/migration.sql` — Contract search vector

### Cross-cutting
- `apps/web/messages/en.json` / `pl.json` — i18n message files for all new strings
- `packages/api/src/root.ts` — tRPC router registration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wizard-dialog.tsx` + `step-*.tsx`: Multi-step form pattern with StepIndicator, per-step Zod validation, discard confirmation — copy directly for import wizard and onboarding wizard
- `command.tsx`: Full cmdk component library ready to use for Cmd+K palette
- `drop-zone.tsx`: react-dropzone with file type validation and progress tracking — reuse for CSV/XLSX upload step
- `data-table.tsx` + columns + pagination: TanStack Table pattern for import preview table
- `xlsx` library: Already in dependencies for report export — use for import parsing

### Established Patterns
- Local wizard Zod schemas mirroring validators package (avoid cross-package deps from web)
- nuqs for URL state management on table/filter pages
- base-ui render prop pattern for triggers (not Radix asChild)
- settingsJson for org-level configuration storage
- Subpath exports from api package for service imports
- Fire-and-forget pattern for async operations (.catch to never block)

### Integration Points
- `root.ts`: New routers for import and search
- Dashboard page: Onboarding checklist widget integration
- Settings page: "Setup Guide" re-entry point
- Every list page: Empty state components
- Layout/header: Global search bar + Cmd+K listener
- `settingsJson`: onboardingCompletedSteps array storage

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-onboarding-polish*
*Context gathered: 2026-03-22*
