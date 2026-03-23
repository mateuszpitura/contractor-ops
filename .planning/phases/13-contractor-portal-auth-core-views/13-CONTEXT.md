# Phase 13: Contractor Portal Auth & Core Views - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Contractor-facing portal with magic-link authentication, org-scoped access, and core read/write views: contract viewing, invoice submission, payment tracking, document access. No profile self-management (Phase 14), no org branding customization (Phase 14), no time tracking (Phase 18).

</domain>

<decisions>
## Implementation Decisions

### Portal layout & navigation
- **D-01:** Minimal top bar navigation — org logo + name on left, nav links center (Overview, Contracts, Invoices, Documents, Payments), profile/logout on right. No sidebar — contractors have ~5 sections, top bar keeps it clean
- **D-02:** Overview dashboard as landing page — summary cards showing active contracts count, pending invoices, recent payments, upcoming deadlines. Quick actions: Submit invoice, View contracts
- **D-03:** Responsive down to mobile (375px+) — top bar collapses to hamburger menu on small screens. Contractors check payment status from phones
- **D-04:** Same design system as admin, lighter feel — reuse shadcn/ui components, same colors/typography, but simpler layouts. No dense tables, no complex filters. Professional and consistent with admin side
- **D-05:** Portal lives in `(portal)` route group alongside `(auth)` and `(dashboard)` — shares Next.js app, auth, DB, tRPC, UI packages

### Invoice submission experience
- **D-06:** Upload PDF + minimal metadata — contractor uploads one PDF and enters: invoice number, issue date, due date, net amount, gross amount. Org's matching engine handles the rest
- **D-07:** Single invoice at a time — one PDF + metadata per submission. Contractors typically submit 1 invoice/month
- **D-08:** Contractor picks which contract the invoice is for — dropdown of their active contracts. Pre-fills expected amounts, eliminates ambiguity. Auto-select if only 1 active contract
- **D-09:** Success page with summary after submission — dedicated confirmation page showing invoice summary, expected next steps, and link to track status

### Status & payment tracking
- **D-10:** Three-layer status visibility — (a) status badges on invoice list for quick scanning, (b) horizontal step timeline on invoice detail page (Submitted → In Review → Approved → Payment Scheduled → Paid), (c) filtered activity log showing contractor-relevant events
- **D-11:** Activity log filters out internal events — show: submitted, under review, approved, payment scheduled, paid, rejected with reason. Hide: internal reviewer assignments, approval chain details, batch operations
- **D-12:** Payment details show date + amount only — no internal batch IDs, no org-side bank details. Clean and sufficient for contractor records

### Session & access model
- **D-13:** PortalSession model separate from internal User/Session — contractors never added to internal user table. Portal sessions scoped to organization + contractor record
- **D-14:** Magic link with 7-day session duration — contractors check status occasionally, week-long sessions reduce friction. Lower security risk than admin (24h) since portal is read-heavy
- **D-15:** Org picker after login for multi-org contractors — single magic link, contractor picks which org to view if they work for multiple companies. Link contractor records across orgs by email
- **D-16:** Dual access trigger: org invites + contractor self-request — org admin can send portal access link from contractor profile. Contractor can also request access from a public login page by entering email — if it matches a contractor record, magic link is sent
- **D-17:** Better Auth magicLink plugin already configured — reuse existing plugin, extend with portal-specific session handling and org scoping

### Claude's Discretion
- Overview dashboard card layout and exact metrics displayed
- Invoice form field validation rules and error messaging
- Status timeline step indicator component design
- Activity log entry formatting and timestamp display
- Hamburger menu animation and mobile nav behavior
- Empty states for all portal sections
- Loading skeleton patterns for portal pages
- Public login page layout and copy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with portal requirements, UI views, API contracts, security requirements
- `db-schema.md` — Complete database schema including Contractor, Contract, Invoice, Document models and their relationships

### Auth infrastructure
- `packages/auth/src/config.ts` — Better Auth config with magicLink plugin, organization plugin, 24h sessions, social providers
- `packages/auth/src/client.ts` — Auth client exports
- `packages/db/prisma/schema/auth.prisma` — User, Session, Account, Verification models (internal users — portal needs separate PortalSession)

### Existing invoice pipeline
- `packages/db/prisma/schema/invoice.prisma` — Invoice, InvoiceFile, InvoiceLine, InvoiceMatchResult models
- `.planning/phases/05-invoice-intake-matching/05-CONTEXT.md` — Invoice intake decisions: upload flow, metadata fields, matching engine, status pipeline

### Integration foundation
- `.planning/phases/12-integration-foundation/12-CONTEXT.md` — Phase 12 decisions on credential store, webhook layer, health monitoring

### Contractor data model
- `packages/db/prisma/schema/contractor.prisma` — Contractor model with email, taxId, contacts, billingProfiles, contracts, invoices relations

### UI patterns
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx` — Dashboard layout (reference for portal layout structure)
- `apps/web/src/components/auth/login-form.tsx` — Existing login form (reference for portal login page)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/auth/src/config.ts` magicLink plugin: Already configured with sendMagicLink callback — extend for portal-specific magic links
- `packages/db/prisma/schema/invoice.prisma`: Full Invoice model with status enums, file attachments, match results — portal reads from same tables
- `apps/web/src/components/documents/drop-zone.tsx`: Reusable DropZone for file upload — can be used for portal invoice upload
- `apps/web/src/components/documents/pdf-preview.tsx`: PDF preview component — reusable in portal invoice detail
- `packages/api/src/services/r2.ts`: R2 storage service with presigned URLs — needed for portal file uploads/downloads
- shadcn/ui component library: Cards, tables, badges, buttons, forms all available

### Established Patterns
- tRPC routers with `tenantProcedure` + `requirePermission()` middleware — portal needs analogous `portalProcedure` middleware
- TanStack Query for server state management
- React Hook Form + Zod for form validation
- `useTranslations()` from next-intl for i18n (Polish + English)
- nuqs for URL-synced state
- AsyncLocalStorage for multi-tenant context scoping
- Route groups: `(auth)` for login/signup, `(dashboard)` for admin — `(portal)` follows same pattern

### Integration Points
- Invoice intake pipeline: portal submissions must enter the same pipeline as admin uploads (RECEIVED status → matching → approval → payment)
- Document management: portal document viewing reads from same DocumentLink/Document tables
- Contract display: portal reads from Contract model (read-only)
- Notification system: portal actions trigger existing notification system (Phase 7)
- Prisma tenant scoping: portal queries must be org-scoped like admin queries

</code_context>

<specifics>
## Specific Ideas

- Three-layer status tracking was explicitly requested: badges on list + timeline on detail + activity log — all three, not just one
- Success page after invoice submission (not just a toast) — contractor needs reassurance their invoice was received
- Org picker for multi-org contractors — contractors working for multiple companies should see an org selector after magic link login
- Filtered activity log — contractors see their events only, no internal workflow details exposed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-contractor-portal-auth-core-views*
*Context gathered: 2026-03-23*
