# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the Turborepo monorepo, full database schema (all tables from db-schema.md), Better Auth with multi-tenant RBAC (8 predefined roles), tenant-scoped data access, i18n framework (Polish + English), and the authenticated app shell with sidebar navigation. This is the foundation every later phase builds on.

</domain>

<decisions>
## Implementation Decisions

### App shell & navigation
- Collapsible sidebar: full icons + labels, collapses to icon-only. Linear-style.
- Org switcher as dropdown at the top of the sidebar (above navigation items)
- Action-rich top bar: breadcrumb + global search trigger + quick action buttons (Add contractor, Upload invoice, etc.) + notifications bell + user avatar
- All 10 navigation items visible from day 1 (Dashboard, Contractors, Contracts, Workflows, Invoices, Approvals, Payments, Reports, Integrations, Settings) — no progressive reveal
- Blue / Indigo accent color palette
- Light + dark mode from day 1, with system preference detection and manual toggle in settings
- User-configurable information density (comfortable vs compact) for tables and data-heavy views
- Stripe Dashboard as the aesthetic reference — professional, data-dense, great tables and forms
- Desktop-first, responsive down to tablet (1024px)

### Auth & session flow
- Multiple auth methods: email/password, magic link, and social OAuth (Google + Microsoft)
- Org creation happens during sign-up flow — user enters org name in the same form, lands directly in their org
- Invite acceptance: click link → create account (or use social) → auto-join org with assigned role. No separate "accept invite" step.
- Strict 24-hour sessions. Re-authentication required for sensitive actions (payment runs, role changes, settings changes)
- Email verification required after sign-up

### RBAC & permissions UX
- 8 predefined roles only (no custom roles in v1): admin, finance admin, ops manager, team manager, legal/compliance viewer, IT admin, external accountant, readonly
- Unauthorized navigation items and actions are completely hidden (not disabled/grayed)
- User management screen: simple table with name, email, role, status, last login. Invite button at top. Role change via dropdown in table row.
- Permissions enforced at both tRPC procedure level and UI level

### Database schema
- Full database schema created in Phase 1 (all tables from db-schema.md) — later phases use existing tables without migration churn
- Invoice line items with per-line VAT rate support (handles mixed-rate Polish invoices: 23%, 8%, 5%, 0%, ZW, NP)
- Soft delete via Prisma middleware (global auto-filter of deleted_at records, delete operations converted to soft-delete)
- Multi-tenant scoping via Prisma Client Extension with organization_id on every query

### Claude's Discretion
- Currency storage approach (integer grosze vs Prisma Decimal) — research pitfalls analysis recommends integer, but Claude should pick based on implementation tradeoffs
- Team assignment model for team managers (single-team vs multi-team per user) — pick based on data model simplicity
- Exact sidebar collapse animation and breakpoints
- Loading states and skeleton patterns
- Error page designs (404, 500, unauthorized)
- Exact quick action buttons in top bar

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & architecture
- `prd.md` — Full PRD with UI views (§9), core processes (§10), API contracts (§15), security requirements (§16), MVP scope (§17)
- `db-schema.md` — Complete database schema with Prisma models, bounded contexts, relationships, indexes, enums
- `CLAUDE.md` — Engineering guidelines: monorepo (Turborepo), clean architecture, SOLID, security, accessibility, performance, validation

### Research findings
- `.planning/research/STACK.md` — Validated tech stack with versions, Better Auth organization plugin details, Inngest for background jobs, next-intl for i18n
- `.planning/research/ARCHITECTURE.md` — Monorepo structure, tenant isolation via Prisma Client Extension, QStash for background jobs, R2 for file storage
- `.planning/research/PITFALLS.md` — Critical: tenant data leakage prevention, currency precision, approval state corruption, Vercel serverless limitations

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: ORG-01 through ORG-07, I18N-01, I18N-02
- `.planning/ROADMAP.md` — Phase 1 plans: monorepo scaffolding, auth + RBAC, org settings + app shell, i18n framework

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes all patterns (this is the foundation phase)

### Integration Points
- Better Auth organization plugin provides multi-tenant RBAC foundation
- Prisma Client Extension for tenant-scoped queries (all downstream phases depend on this)
- next-intl for i18n (all UI components from Phase 1 onward use this)
- shadcn/ui for component library (sidebar, dropdowns, tables, forms)

</code_context>

<specifics>
## Specific Ideas

- "Stripe Dashboard" as the aesthetic reference — professional, data-dense, great tables and forms
- Light + dark mode with system preference detection from day 1
- Collapsible sidebar like Linear — clean, fast, keyboard-first
- Strict sessions (24h) with re-auth on sensitive actions — this is a financial tool handling invoices and payments

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-03-18*
