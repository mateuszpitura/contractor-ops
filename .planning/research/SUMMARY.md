# Project Research Summary

**Project:** Contractor Ops — B2B Contractor Operations SaaS
**Domain:** Multi-tenant B2B SaaS / Contractor Lifecycle Management (Poland-first)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

This is a B2B operations SaaS targeting Polish companies that manage 5–200 B2B contractors. The product fills a genuine gap: Deel and Remote are priced per-contractor and optimized for cross-border EOR, SaldeoSMART is accounting-first with no lifecycle management, and Faktura.pl is invoice creation only. Nobody owns the full local B2B contractor lifecycle — onboard → contract → invoice → approve → pay → offboard — at a flat platform fee. Research confirms that building this as a multi-tenant Next.js monolith on Vercel, with tRPC for type-safe API access, Prisma + Neon PostgreSQL for data, and Inngest for durable background workflows, is the right stack for a solo developer with high delivery velocity requirements. The monorepo structure (Turborepo + pnpm) enables clean package boundaries without premature microservice complexity.

The recommended approach is to ship a comprehensive v1 that replaces the Excel + email + Slack chaos with a coherent platform, rather than building a minimal tool and iterating. The invoice-to-payment pipeline (intake → match → approve → export) is the core value proposition and must be complete at launch. The workflow engine for onboarding/offboarding is the primary differentiator — no Polish competitor has it — and should ship in v1 despite its complexity. Anti-features to defer include OCR/AI invoice parsing (KSeF XML will supersede it), contractor self-service portal (doubles surface area), and open banking (regulatory complexity). The product should be PLN-only and Poland-focused at launch.

The primary risks are architectural, not feature-level. Tenant data leakage in a financial SaaS is business-ending; the Prisma Client Extension tenant-scoping pattern must be baked into the foundation before any feature work. Currency precision errors (float vs. integer-grosze vs. Decimal) must be resolved at schema design time — retrofitting is extremely expensive. Approval workflow state machine corruption is the most complex domain problem and requires explicit state modeling with snapshotted chain configurations before any UI is built. These three pitfalls have HIGH recovery cost and must be treated as hard constraints from day 1, not afterthoughts.

## Key Findings

### Recommended Stack

The stack is designed for a Vercel-native, serverless-first deployment with a strong TypeScript-first, end-to-end type safety posture. Next.js 15 with the App Router is the framework; tRPC v11 provides the API layer with full type inference from server to client via TanStack Query v5 integration. Better Auth with its Organization plugin handles multi-tenant auth and RBAC, replacing both Auth.js (now in maintenance mode) and Clerk (expensive at scale). Inngest replaces BullMQ/Trigger.dev for all durable background workflows — it is the only viable worker solution on Vercel serverless. Resend Inbound (released Nov 2025) handles email intake without a separate mail server. Cloudflare R2 handles file storage at zero egress cost. The toolchain uses Biome (not ESLint + Prettier) for 10-100x faster linting.

**Core technologies:**
- **Next.js 15 + React 19:** Full-stack framework with Server Components — reduces client bundle for data-heavy SaaS pages. App Router is required for next-intl (i18n) compatibility.
- **tRPC v11:** End-to-end type safety, no code generation. First-class App Router + TanStack Query v5 integration. The API layer for all client-server communication.
- **Prisma 6 + Neon PostgreSQL 17:** ORM with mature migrations, Client Extensions for tenant scoping and audit logging. Neon provides serverless Postgres with connection pooling built in.
- **Better Auth 1.x + Organization plugin:** Multi-tenant RBAC out of the box. Supports custom roles for the 8-role model (admin, finance, ops, manager, legal viewer, IT admin, accountant, readonly). Auth.js successor.
- **Inngest 3.x:** Durable step functions for approval SLA timers, onboarding/offboarding workflows, invoice matching pipeline, scheduled jobs. The only viable worker solution on Vercel.
- **TanStack Query v5 + Zustand 5 + nuqs 2:** Server state cache (TanStack Query), ephemeral UI state (Zustand), shareable filter/sort state in URL (nuqs). Clear separation of state concerns.
- **shadcn/ui + Tailwind CSS 4 + TanStack Table 8:** Component library (copy-owned, not a dependency), utility styling, headless table with sorting/filtering/pagination.
- **Cloudflare R2 + @aws-sdk/client-s3:** Zero-egress document storage with presigned URL upload/download pattern. Server never handles file bytes (critical with Vercel's 4.5MB body limit).
- **Resend 4 + Resend Inbound + React Email 5:** Single vendor for transactional email send and inbound email intake. Webhook-based inbound eliminates IMAP polling (impossible on serverless).
- **Upstash Redis + QStash:** Rate limiting, idempotency keys, and async HTTP job dispatch. QStash is the canonical Vercel pattern for background work (with Inngest handling durable workflows).
- **next-intl 4:** Server Component-native i18n. Polish + English from day 1 with ICU message format.
- **Turborepo 2 + pnpm 9 + Biome 1:** Monorepo orchestration, package management, and unified linting/formatting.

Full details: `.planning/research/STACK.md`

### Expected Features

The product is feature-complete at v1 — research confirms that a minimal invoice-only tool would not replace the existing Excel/email workflow. Every table-stakes feature must ship at launch. The differentiators (workflow engine, Slack inline approval, compliance health scoring) are what justify the platform pricing vs. per-contractor tools.

**Must have at launch (table stakes — gaps here make the product feel incomplete):**
- Multi-tenant org setup + RBAC + user invite flow — everything scopes to organization_id
- Contractor registry + profiles with full activity history
- Contract repository with status tracking, document management, and expiry reminders
- Invoice intake (manual upload + email) with per-org email inbox
- Invoice-to-contractor-to-contract matching with deviation detection
- Duplicate invoice detection with normalized invoice number comparison
- Configurable approval workflow (1–3 levels) with role-based routing, comments on rejection, delegation
- Payment batch export (CSV/bank-compatible file) with idempotency
- Dashboard with KPIs, approval queue, upcoming deadlines, spend overview
- Notifications (in-app + email) for all critical events
- Audit log (immutable, filterable, exportable) — compliance requirement for financial operations
- Basic reports (spend by contractor/period, expiring contracts, overdue invoices)
- Data import wizard (CSV/XLSX) — primary migration path from spreadsheets
- i18n (Polish + English) with locale-aware date/number/currency formatting
- Product onboarding wizard — reduces time-to-value dramatically

**Should have at launch (differentiators — competitive advantage vs. Deel/SaldeoSMART):**
- Workflow engine with configurable onboarding/offboarding templates + task dependencies — no Polish competitor has this
- Slack integration with inline approve/reject buttons — Polish tech companies live in Slack
- Global search + command palette (Cmd+K) — power-user navigation, Linear/Vercel style
- SLA timers on approval levels with escalation notifications
- Compliance health scoring per contractor (valid contract, required docs, NIP verified)
- Approval delegation and backup approvers

**Defer to v1.x (post-validation):**
- Contractor self-service portal — doubles surface area, build after internal flow is validated
- KSeF native integration — grace period until Dec 2026, email/upload intake first
- E-sign integration (Autenti/DocuSign) — most Polish contracts signed by email/wet signature
- OCR invoice parsing — KSeF XML will make OCR largely unnecessary

**Defer to v2+ (future consideration):**
- Open banking / payment initiation — regulatory complexity, bank file export is sufficient
- Public API + webhooks — after integration requests come from customers
- SSO/SCIM — enterprise feature, target market doesn't require it
- Custom fields — fixed schemas cover 90% of cases; validate first

Full details: `.planning/research/FEATURES.md`

### Architecture Approach

The architecture is a Turborepo monolith: a single Next.js app with supporting packages (`api`, `db`, `services`, `auth`, `shared`, `ui`). Business logic lives in `packages/services/`, not in tRPC routers (which are intentionally thin). All database access goes through a Prisma Client Extension that auto-injects `organization_id` from AsyncLocalStorage — this is the primary tenant isolation mechanism, with PostgreSQL RLS as defense-in-depth. Background work (notifications, SLA timers, email intake, scheduled jobs) flows through QStash for HTTP-based async dispatch and Inngest for durable multi-step workflows. Files go directly from browser to Cloudflare R2 via presigned PUT URLs, then server validates type/content; the API never handles file bytes.

**Major components:**
1. **tRPC middleware chain** (auth guard → tenant scope → RBAC check → audit logger) — every API request passes through all four layers in order
2. **Prisma Client Extension (tenant)** — auto-injects `organizationId` into all queries; impossible to forget at the query level
3. **Domain services package** (`packages/services/`) — business logic for invoice matching, workflow engine, approval chain, payment batching, notifications, audit; called by tRPC routers, cron jobs, and webhooks
4. **Database-driven workflow engine** — templates, instances, and tasks stored in PostgreSQL; engine logic in `packages/services/src/workflow/`; no external orchestration needed for human-task workflows
5. **Configurable approval chain** — `ApprovalChain` config snapshot at submission time (never updated in-flight), `ApprovalRequest` + `ApprovalStep` instances, sequential level routing with SLA deadlines
6. **Event-driven audit + notifications** — domain events written to append-only `audit_log` (same transaction as state change) and dispatched to notification handlers via QStash (async, does not block the request)
7. **File storage (presigned URLs)** — three-step pattern: request upload URL → browser PUT to R2 → confirm upload; download URLs generated on demand with 15-minute expiry
8. **Inngest functions** — approval SLA timers, onboarding/offboarding workflow execution, email intake processing pipeline, invoice matching, overdue detection, contract expiry reminders

Build order (what must exist before what): Foundation (monorepo + DB + auth + tRPC middleware) → Core entities (contractors + contracts + documents) → Workflow engine → Invoice pipeline (intake + matching + approval) → Payments + reporting → Polish (Slack, search, import, onboarding wizard).

Full details: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Tenant data leakage via missing or bypassed tenant scoping** — Use Prisma Client Extension (not deprecated middleware) from day 1; write cross-tenant isolation integration tests for every model; never derive `organization_id` from request params (always from session). Recovery cost: CATASTROPHIC. Must be treated as a hard constraint, not a best-effort.

2. **Currency precision errors (float vs. Decimal vs. integer-grosze)** — Store monetary amounts as integers in grosze (1234 = 12.34 PLN) or use Prisma `Decimal` type with `decimal.js`/`dinero.js` for all arithmetic. Never use `Float` in Prisma schema, never call `parseFloat()` on money. Decision must be made at schema design time — retrofitting is extremely expensive.

3. **Approval workflow state machine corruption** — Model approval as an explicit state machine with defined states and valid transitions. Snapshot the approval chain configuration at invoice submission time (in-flight invoices use their snapshot, never the current org config). Use optimistic locking (version field) to prevent concurrent state changes. Any amount change after approval starts must reset the chain.

4. **Vercel serverless cannot run background jobs natively** — Design all async operations as idempotent HTTP endpoints from the start. Use QStash for async dispatch, Inngest for durable workflows, Vercel Cron for schedules, and Resend Inbound (not IMAP polling) for email intake. Wire up QStash + Vercel Cron in the foundation phase before building any feature that needs them.

5. **Better Auth Organization misconfiguration (session/role leakage)** — Define all 8 roles with permissions using Better Auth's custom role system from the start. Always use server-side `hasPermission` API for authorization — never client-side checks for security-critical decisions. Always run `npx @better-auth/cli migrate` after plugin configuration changes.

6. **File upload security holes** — Validate file content via magic bytes (not extension or Content-Type header) after upload completes. Serve files from a separate domain with `Content-Disposition: attachment`. Scope R2 keys by `/{org_id}/{entity_type}/{entity_id}/`. Keep signed URL expiry to 5–15 minutes.

7. **Invoice duplicate detection false positives/negatives** — Normalize invoice numbers before comparison (strip whitespace, normalize separators, uppercase). Use composite detection: exact match on (normalized_number + contractor_id) as primary, amount as secondary confirmation. Add date-range window for recurring invoice handling. Flag suspected duplicates for human review rather than auto-rejecting.

Full details: `.planning/research/PITFALLS.md`

## Implications for Roadmap

Based on combined research, the architecture's explicit build order maps directly to a 6-phase roadmap. Each phase has hard dependencies on the previous one except where noted as parallel.

### Phase 1: Foundation
**Rationale:** Everything in the system depends on this. Tenant scoping, auth, RBAC, and the tRPC middleware chain must exist before any feature can be built safely. Currency precision (integer-grosze vs. Decimal) must be decided here — it cannot be retrofitted. The background job infrastructure (QStash + Vercel Cron + Inngest) must be wired up now because notifications, SLA timers, and email intake all depend on it.
**Delivers:** Working monorepo structure, database schema with tenant extension, Better Auth with all 8 custom roles, tRPC middleware chain (auth → tenant → RBAC → audit), Inngest + QStash integration, i18n framework (next-intl), CI/CD pipeline, and an authenticated app shell with navigation.
**Addresses (features):** Multi-tenant org setup, RBAC, user invite flow, i18n scaffolding.
**Avoids (pitfalls):** Tenant data leakage (Prisma extension from day 1), currency errors (integer schema from day 1), Better Auth misconfiguration (all 8 roles defined upfront), no background job support (QStash + Inngest wired up before needed).
**Research flag:** STANDARD — well-documented patterns for all components.

### Phase 2: Core Entities
**Rationale:** Contractors and contracts are the root entities that invoices, workflows, and payments all reference. Cannot build the invoice pipeline or workflow engine without them. Document management (R2 presigned URLs) is needed for contract attachments, so file storage is established here.
**Delivers:** Contractor registry with search/filter/bulk actions, NIP-based GUS/REGON lookup, contractor profiles with activity history, contract CRUD with status tracking and expiry metadata, document upload/download (R2 presigned URL pattern), compliance health scoring foundation.
**Addresses (features):** Contractor registry + profiles, contract repository, document management, data import wizard (CSV/XLSX for contractors + contracts).
**Avoids (pitfalls):** File upload security (magic byte validation, org-scoped R2 keys, short-expiry signed URLs established here), tenant isolation tests for contractor and contract models.
**Research flag:** STANDARD — well-documented CRUD + R2 presigned URL pattern.

### Phase 3: Workflow Engine
**Rationale:** The workflow engine is the primary differentiator. It is architecturally independent from the invoice pipeline and can be built in parallel, but it shares the notification/QStash infrastructure established in Phase 1. Building it before the invoice pipeline allows the notification service to be validated with a simpler domain (task completion) before being stressed by approval chains.
**Delivers:** Workflow template builder (create/edit templates with ordered steps, dependencies, role assignment, conditional logic, SLA per step), workflow execution engine (advance on task completion, evaluate dependencies, schedule SLA deadlines via QStash), task management UI (list, complete, comment, attach), onboarding/offboarding workflow execution for contractors, overdue task detection (Vercel Cron), notifications for task assignment and deadlines.
**Addresses (features):** Workflow engine + onboarding/offboarding templates, notifications (established here, reused in Phase 4).
**Avoids (pitfalls):** Anti-pattern of building a general-purpose BPM (build simple task-dependency engine, expand only when real requirements demand it); Vercel serverless timeout (SLA checks via QStash delayed messages, not in-process timers).
**Research flag:** NEEDS RESEARCH PHASE — workflow template builder conditional logic and task dependency evaluation need detailed technical design before implementation.

### Phase 4: Invoice Pipeline
**Rationale:** This is the core business value. Depends on contractors and contracts (Phase 2) for matching, and on the notification/QStash infrastructure (Phase 3). The invoice lifecycle is the most complex state machine in the system; the approval chain design must be completed before any UI is built. The approval chain snapshot pattern must be implemented from the first version.
**Delivers:** Invoice intake (drag-and-drop upload + per-org email inbox via Resend Inbound + Inngest processing), invoice-to-contractor matching (by NIP/sender email), invoice-to-contract matching with deviation detection, duplicate detection (normalized invoice numbers + date-range window for recurring), approval chain configuration UI (1–3 levels, role-based or user-specific), invoice approval workflow (approve/reject/clarify/delegate), SLA timers on approval levels with escalation, Slack integration (inline approve/reject in Block Kit messages), approval delegation and backup approvers.
**Addresses (features):** Invoice intake, matching + dedup, configurable approval workflow, SLA timers, Slack integration, approval delegation.
**Avoids (pitfalls):** Approval state machine corruption (explicit state machine with snapshots, optimistic locking, amount-change reset rule), duplicate detection failures (normalization + composite detection + human review for suspected duplicates), Slack webhook without signature verification.
**Research flag:** NEEDS RESEARCH PHASE — approval chain state machine design and Slack Block Kit interactive message patterns need detailed technical design.

### Phase 5: Payments + Reporting
**Rationale:** Only approved invoices enter payment runs (hard dependency on Phase 4). Dashboard KPIs and reports require real data to exist. This phase closes the end-to-end loop: from invoice intake to payment confirmation.
**Delivers:** Payment batch creation (select approved invoices, generate bank-compatible CSV/MT940), idempotent batch operations with partial failure handling, payment status tracking (paid/partial/failed per invoice), dashboard with KPI cards (pending approvals, upcoming deadlines, spend overview, overdue invoices), spend reports (by contractor, by period, by status), expiring contract report, audit log viewer (filterable, exportable), pre-computed KPI caching (Vercel Cron → Redis) to prevent dashboard contention.
**Addresses (features):** Payment batch export, dashboard + KPIs, basic reports, audit log viewer.
**Avoids (pitfalls):** Dashboard performance trap (pre-compute KPIs via scheduled cron, cache in Redis), payment batch without idempotency (idempotency keys from day 1), audit log not truly immutable (database role cannot UPDATE/DELETE).
**Research flag:** STANDARD — bank CSV/MT940 format is documented; Recharts + shadcn/ui chart patterns are established.

### Phase 6: Polish and Launch Readiness
**Rationale:** These features depend on data and flows established in all prior phases. Global search requires indexed data. The data import wizard benefits from knowing the final schema. The product onboarding wizard wraps the full setup flow. Compliance health scoring is now fully computable with contracts, documents, and NIP verification in place.
**Delivers:** Global search + command palette (Cmd+K) with PostgreSQL full-text search (`tsvector`) across contractors/contracts/invoices, data import wizard (CSV/XLSX for contractors + contracts with preview + validation), product onboarding wizard (org setup → import → configure approvals → invite team), compliance health scoring per contractor (dashboard widget), contract expiry warnings (90/60/30/7 days, Vercel Cron), notification preference management (per event type, email vs. in-app), i18n completeness (PLN formatting with Polish locale: `1 234,56 zł`), E2E test coverage for critical flows.
**Addresses (features):** Global search + Cmd+K, data import, product onboarding wizard, compliance health scoring, all remaining i18n gaps.
**Avoids (pitfalls):** Full-text search via SQL LIKE (use `tsvector` indexes for > 5K records), i18n incomplete (PLN/date formatting not just string translation), email without deduplication (notification preferences + rate limiting).
**Research flag:** STANDARD — PostgreSQL full-text search and shadcn/ui Command (cmdk) are well-documented. Import wizard pattern is established.

### Phase Ordering Rationale

- **Foundation must be first** because tenant scoping, auth, RBAC, and currency decisions cannot be retrofitted without catastrophic risk. The architectural decisions made in Phase 1 (tenant extension, integer-grosze schema, async job patterns) determine the safety of every feature built afterward.
- **Core entities before workflows and invoices** because contractors and contracts are foreign keys referenced by every other domain entity. Building workflows or invoice matching without contractors doesn't compile.
- **Workflow engine before invoice pipeline** because it validates the notification/QStash infrastructure in a lower-stakes domain (task completion) before that infrastructure is stressed by approval chain SLA timers. The workflow engine is also the primary differentiator and benefits from early real-world validation.
- **Invoice pipeline as its own phase** because it is the most complex and highest-risk domain (state machine, financial amounts, concurrent access). It should not be mixed with other features.
- **Payments + reporting after invoice pipeline** because the dependency is hard: only approved invoices can enter payment batches. Reports are meaningless without data.
- **Polish phase last** because search, import, onboarding wizard, and compliance scoring all benefit from real schema and data to work with.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Workflow Engine):** The conditional logic system for workflow steps (JSON rules evaluation) and dependency graph traversal need detailed technical design. The database schema for templates vs. instances vs. tasks should be fully mapped before implementation begins.
- **Phase 4 (Invoice Pipeline):** The approval state machine — every state, every valid transition, every guard, every effect — should be diagrammed and reviewed before any code is written. Slack Block Kit interactive message patterns with Inngest step function integration need a spike.

Phases with standard patterns (research-phase can be skipped):
- **Phase 1 (Foundation):** Turborepo + Next.js + Better Auth + tRPC + Prisma + Inngest + QStash are all well-documented with official guides and community patterns.
- **Phase 2 (Core Entities):** Standard CRUD + R2 presigned URL upload pattern is established and documented.
- **Phase 5 (Payments + Reporting):** Bank CSV format is a fixed specification. Recharts + shadcn/ui Chart component patterns are well-documented.
- **Phase 6 (Polish):** PostgreSQL `tsvector` full-text search, cmdk command palette, and CSV import wizard are all established patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified via official docs and multiple sources. Version compatibility matrix confirmed. Inngest/QStash split for durable vs. simple async is the recommended Vercel-native pattern. |
| Features | HIGH | Competitor analysis is thorough (Deel, Remote, SaldeoSMART, Faktura.pl). Feature dependencies are clearly mapped. Anti-features are well-reasoned with specific alternatives. |
| Architecture | HIGH | Well-established patterns for this exact stack (multi-tenant Prisma extension, tRPC middleware chain, presigned URL file storage, QStash + Vercel Cron). Multiple authoritative sources confirm the approaches. |
| Pitfalls | HIGH (stack), MEDIUM (domain workflows) | Stack-specific pitfalls (Prisma, Vercel, Better Auth, R2) are verified against known issues and official docs. Domain workflow pitfalls (approval state machines, duplicate detection edge cases) are based on industry knowledge and AP workflow best practices — may surface additional edge cases during implementation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Resend Inbound reliability at volume:** Resend Inbound was released Nov 2025 and is relatively new. Email attachment handling and reliability for high-volume orgs should be tested early in Phase 4. Fallback: SendGrid Inbound Parse (same webhook pattern, proven at scale).
- **KSeF timeline certainty:** KSeF mandatory deadline and API stability remain in flux. The v1 decision to use email/upload intake with a v1.5 KSeF path is correct, but the KSeF milestone should be re-evaluated when the API stabilizes (expected H1 2026).
- **Approval state machine edge cases:** The pitfalls research identifies known edge cases (deleted approver, concurrent approval, amount change, delegation loops), but a formal state transition diagram should be produced as the first deliverable of Phase 4 planning to surface any missed transitions.
- **Biome rule coverage:** Biome covers ~95% of ESLint rules. Any accessibility linting requirements (axe-core rules) or import sorting specifics should be evaluated early in Phase 1 to determine if a fallback ESLint config is needed.
- **Integer-grosze vs. Decimal decision:** Both approaches (store amounts as integers in grosze, or use Prisma `Decimal` with `decimal.js`) are valid. This decision must be made and documented before Phase 1 database schema is written. The integer approach is safer for arithmetic but requires explicit formatting on display; Decimal is more intuitive but requires discipline with the library.

## Sources

### Primary (HIGH confidence)

- [tRPC v11 announcement](https://trpc.io/blog/announcing-trpc-v11) — SSE subscriptions, FormData, TanStack Query v5 integration
- [Better Auth Organization plugin docs](https://better-auth.com/docs/plugins/organization) — multi-tenant RBAC, custom roles, invitation workflow
- [Inngest pricing + Vercel marketplace](https://www.inngest.com/pricing) / [https://vercel.com/marketplace/inngest](https://vercel.com/marketplace/inngest) — execution model, free tier, step functions
- [Resend Inbound Emails](https://resend.com/blog/inbound-emails) — Nov 2025 launch, webhook parsing, attachment handling
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — S3 compatibility, zero egress
- [next-intl docs](https://next-intl.dev/) — App Router + Server Components native i18n
- [nuqs](https://nuqs.dev/) — type-safe URL state, React Advanced 2025 talk
- [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling) — serverless connection patterns
- [Prisma Neon driver adapter](https://www.prisma.io/docs/orm/overview/databases/neon) — GA since Prisma v6.16
- [QStash + Vercel Next.js](https://upstash.com/docs/qstash/quickstarts/vercel-nextjs) — canonical Vercel async job pattern
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) — scheduling, best-effort timing
- [Securing presigned URLs (AWS)](https://aws.amazon.com/blogs/compute/securing-amazon-s3-presigned-urls-for-serverless-applications/) — file security patterns

### Secondary (MEDIUM confidence)

- [Multi-tenant data isolation with PostgreSQL RLS (AWS)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) — RLS as defense-in-depth rationale
- [ZenStack Multi-Tenancy Implementation Approaches](https://zenstack.dev/blog/multi-tenant) — Prisma extension pattern for tenant scoping
- [Inngest vs Trigger.dev comparison](https://nextbuild.co/blog/background-jobs-vercel-inngest-trigger) — architecture trade-offs
- [Rillion — Invoice Approval Workflow Best Practices](https://www.rillion.com/blog/invoice-approval-workflow-best-practices/) — approval chain patterns, SLA timers
- [KSeF Poland E-Invoicing](https://www.dudkowiak.com/tax-law-in-poland/e-invoicing-in-poland-ksef/) — timeline, grace period to Dec 2026
- [ApprovalMax](https://approvalmax.com/) — AP workflow feature benchmarking
- [Deel](https://www.deel.com/) / [Remote](https://remote.com/) / [SaldeoSMART](https://www.supremis.pl/en/produkt/saldeosmart-en/) — competitor feature matrix

### Tertiary (LOW confidence — needs validation)

- [Resend Inbound attachment volume reliability](https://resend.com/blog/inbound-emails) — new service (Nov 2025), untested at production volume; validate early in Phase 4
- [Currency handling pitfalls in fintech](https://bitcat.dev/avoid-common-pitfalls-fintech-currency-handling/) — general guidance, not Polish-market specific; validate integer-grosze approach against PL accounting requirements

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
