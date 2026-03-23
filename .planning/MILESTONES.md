# Milestones

## v1.0 MVP (Shipped: 2026-03-23)

**Phases completed:** 11 phases, 51 plans, 98 tasks

**Key accomplishments:**

- Turborepo monorepo with 6 packages, complete Prisma 7 schema (40+ models across 11 bounded contexts), Neon adapter, tenant isolation via AsyncLocalStorage Client Extension, and soft-delete Client Extension with integer grosze for all monetary fields
- Better Auth with 8-role RBAC organization plugin, tRPC v11 middleware chain (auth/tenant/RBAC/sensitive), and organization/user/settings routers with re-authentication guards on sensitive actions
- Auth screens (register/login/invite), collapsible sidebar with org switcher and RBAC-filtered nav, org settings form, user management table with invite/role-change/deactivate, dark mode, and Indigo theme
- next-intl with Polish/English localization across all Phase 1 UI -- 9 translation namespaces, locale routing, PLN currency/date formatters, and language switcher
- tRPC contractor router with 10 procedures (CRUD, paginated list with FTS, lifecycle state machine, compliance health scoring, GUS BIR1 autofill, bulk operations, CSV/XLSX export) plus Zod validators with NIP mod-11 and IBAN validation
- Contractor list page with TanStack Table (12 columns, server-side pagination/sorting/filtering, bulk actions, side panel), 3-step add wizard with GUS NIP autofill, full Polish/English i18n
- Contractor profile page with header/lifecycle actions, 8-tab navigation (overview + compliance fully implemented), compliance health card with per-factor scoring, and sticky right rail with activity timeline and quick notes
- Contract tRPC router with 10 CRUD/list/status/amendment procedures, Zod validators, FTS tsvector migration, and org-level expiry reminder defaults in settings router
- R2 presigned URL upload/download flow with MIME magic-byte validation, ClamAV virus scanning, document versioning, and entity linking via tRPC router
- Contract list page with TanStack Table (12 columns, FTS search, multi-facet filters, pagination, bulk actions) and slide-out side panel on row click
- 3-step contract wizard with contractor billing pre-fill, drag-and-drop document upload via presigned URLs, and top bar quick action entry point
- Contract detail page with 4-tab layout (Overview, Documents, Amendments, Activity) and 6 reusable document components with drag-and-drop upload, PDF preview, and version history
- Contractor profile tabs replaced with real data (Contracts mini table, Documents cards, Compliance upload), Settings expiry reminder defaults, and full Phase 3 EN/PL translations
- Complete workflow tRPC router with template CRUD, run lifecycle, task actions, condition evaluator, assignee resolver, and overdue detection
- Workflow template builder with dnd-kit sortable task list, collapsible task cards, AND/OR condition builder, and 245-key EN/PL i18n translations
- Main /workflows page with runs TanStack Table, My Tasks list, Templates management, side panel preview, and template picker dialog for starting workflows
- Workflow run detail page with progress bar, task checklist, inline Complete/Skip/Reassign actions, threaded comments, and file attachments using Phase 3 document components
- Workflow engine fully connected: contractor profile Workflows tab, header Start onboarding/offboarding buttons, bulk Launch workflow, sidebar overdue badge, and auto-seeded starter templates
- Invoice tRPC router with 11 procedures, Zod validators, and NIP-based auto-matching engine with score classification and duplicate detection
- Resend Inbound webhook handler that receives emails, verifies signatures, parses org slug from recipient, uploads PDF attachments to R2, and creates Invoice drafts with EMAIL_INTAKE source
- Invoice list page with TanStack Table (11 columns), status chip bar with live counts, slide-out side panel, and multi-file PDF upload area with per-file progress
- Invoice detail page with 60/40 PDF split layout, editable metadata form (14 fields with grosze currency conversion), match card with confidence indicator and manual matching, and duplicate warning banner
- Contractor invoices tab with pre-filtered table, settings invoice matching section with copyable email and deviation threshold, full EN+PL translations
- Approval engine with configurable chain routing, 4-action state machine (approve/reject/delegate/clarify), SLA computation, and 14-procedure tRPC router including bulk ops and audit trail
- Settings > Approvals tab with chain list cards, chain editor dialog (1-3 level cards with user/role approver picker, SLA, required toggle), and condition builder for routing rules
- Approvals page with TanStack Table queue, SLA countdown badges, inline approve/reject, bulk toolbar, and side panel with 4 approval actions (approve, reject, clarify, delegate)
- Horizontal chain tracker stepper with status-colored steps and SLA badges, vertical audit timeline with human/system event split, and submit-for-approval action on invoice detail page
- Complete EN + PL i18n for all approval workflow UI (queue, chain tracker, audit timeline, settings) with SLA breach events verified in audit trail API
- Fixed broken bulk approve/reject wiring by adding onSelectionChange callback from TanStack Table row selection to parent page selectedIds state
- Notification dispatch service with deduplication, preference defaulting, and three tRPC routers for notifications, reminders, and Slack integration
- Slack client with AES-256-GCM encrypted tokens, 6 React Email templates, OAuth/interactivity/cron API routes
- Bell icon popover with 30s unread count polling, scrollable notification list, and full /notifications page with type filters, unread toggle, and pagination
- Notification preference matrix with per-channel toggles, reminder rules CRUD dialog, Slack OAuth connection card, and user mapping table in Settings tabs
- Real notification dispatch wired into approval/workflow/invoice routers with Resend email delivery, Slack Block Kit DMs, and full EN+PL i18n for all Phase 7 surfaces
- Vitest configured in api package with 50 todo test stubs covering payment router procedures, export generators, and bank statement parser
- Payment tRPC router with 12 procedures, 3 export formats (CSV/Elixir/SEPA), bank statement parser with auto-matching, and approval-to-READY transition fix
- Full /payments page with run history table, 3-step new payment run dialog, side panel with status management and D-04 invoice removal, bank statement import, and navigation wiring
- Contractor profile Payments tab with mini TanStack Table, settings transfer title template editor with live preview, and 144-key EN/PL i18n namespace covering all payment UI surfaces
- 64 vitest .todo() stubs across 4 files defining behavior contracts for dashboard KPIs, 5 report types, audit log, and CSV export
- 3 tRPC routers (dashboard/report/audit) with 17 query + 6 mutation procedures, raw SQL spend aggregations, and CSV export service
- Full dashboard with 5 KPI cards (trend indicators + click navigation), Recharts spend area chart with 6m/12m/YTD toggle, deadlines/approval/activity widgets in responsive two-column layout
- Reports page with 5 report types (spend/contractor, spend/team, expiring contracts, overdue invoices, compliance gaps), Recharts charts with drill-down, TanStack tables with server-side pagination, and CSV export
- Audit log viewer in Settings tab with searchable TanStack Table, expandable before/after diff rows, structured filters via nuqs, and CSV export
- Complete EN/PL translations for Dashboard (KPI, spend, deadlines, approvals, activity), with all hardcoded strings externalized from Phase 9 components
- CSV/XLSX import processor with column auto-mapping, row validation, and duplicate detection; unified cross-entity tsvector search router
- Reusable EmptyState component with prerequisite-aware smart sequencing and 5-step onboarding checklist widget on dashboard
- 5-step CSV/XLSX import wizard with column auto-mapping, validation preview, duplicate resolution, and list page integration
- Cmd+K command palette with tRPC global search, recent/pinned items, quick actions, and contextual empty states with smart sequencing across all 7 major list views
- Full English + Polish i18n for all Phase 10 surfaces: import wizard, onboarding checklist, empty states, and command palette via 4 new translation namespaces
- Fixed sidebar navigation hrefs, onboarding CTA links, and wired Cmd+K quick actions to open dialogs via ?action= URL params on 4 list pages
- Confirmed tenantStore.run() already wired in tenant middleware -- ORG-07 audit finding was stale, no code changes needed

---
