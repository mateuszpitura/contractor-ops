# Contractor Ops

## What This Is

A B2B contractor operations platform for EU companies (Poland-first) with 5-50 contractors. It replaces the Excel + email + Slack + bank chaos with a single system covering the full contractor lifecycle: onboarding, contracts, invoices, approvals, payments, and offboarding. Built as a multi-tenant SaaS targeting software houses, agencies, and tech companies with 10-200 employees.

## Core Value

The invoice-to-payment flow must work end-to-end: a contractor's invoice arrives, gets matched to their contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-tenant organization setup with settings, branding, timezone, currency
- [ ] User management with invite flow, RBAC (admin, finance, ops, manager, legal viewer, IT admin, accountant, readonly)
- [ ] Contractor registry — full CRUD, search, filters, bulk actions, compliance health
- [ ] Contractor profiles with tabs: overview, contracts, documents, workflows, invoices, payments, activity, compliance
- [ ] Contract repository — upload, metadata, versioning, reminders, statuses, amendment tracking
- [ ] Document management — upload, link to contractor/contract, download via signed URLs, virus scanning
- [ ] Workflow engine — template builder, onboarding/offboarding templates, task dependencies, role-based assignment, conditional logic
- [ ] Workflow execution — task tracking, progress, overdue detection, comments, attachments
- [ ] Invoice intake — manual upload (drag & drop), email intake per org, status tracking
- [ ] Invoice matching — auto-match to contractor (NIP) and contract, expected vs actual amount, deviation flags
- [ ] Duplicate invoice detection (invoice number + contractor + amount)
- [ ] Approval workflow — configurable 1-3 level chains, approve/reject/clarify/delegate, mandatory comments on reject, SLA timers
- [ ] Payment runs — batch selection of approved invoices, CSV/bank file export, mark paid/failed, idempotency controls
- [ ] Dashboard — KPI cards, spend chart, upcoming deadlines, approval queue widget, activity feed, alerts
- [ ] Reports — spend by contractor, spend by team/project, expiring contracts, overdue invoices, compliance gaps
- [ ] Notifications — in-app + email for approvals, tasks, reminders, contract expiry
- [ ] Slack integration — approval notifications with inline approve/reject, task reminders, activity alerts
- [ ] Email intake integration — dedicated inbox per org, attachment parsing, sender matching, deduplication
- [ ] Immutable audit log for all critical actions
- [ ] Global search + command palette (Cmd+K)
- [ ] Data import — CSV/XLSX import for contractors and contracts with wizard, validation, preview
- [ ] Product onboarding — guided setup wizard, empty states with CTAs, in-app checklist
- [ ] i18n framework from day 1 (Polish + English)
- [ ] Settings — org profile, users & roles, approval chains, workflow templates, notification defaults, email intake config, audit log viewer

### Out of Scope

- Payroll for employees — not an HR tool, contractor ops only
- EOR/AOR — local contractors only, not employer of record
- Performance reviews / recruiting / ATS — not HR
- Contractor portal (self-service) — deferred to v1.5
- E-sign integration (DocuSign, Autenti) — v1.5
- KSeF native integration — v1.5/v2 (email/upload + manual validation first)
- Open banking / payment initiation — v2+
- OCR / intelligent invoice parsing — v1.5+
- Deep Google/Microsoft/Jira integration — v1 is light references only
- SSO/SCIM — v3
- Public API + webhooks — v2
- Contractor marketplace / directory — never
- Full accounting suite — coordination layer, not replacement
- Mobile native app — desktop-first, responsive to tablet, approval flow works on mobile browser

## Context

**Market timing:** KSeF (Polish national e-invoice system) launched Feb 1, 2026 for large companies, April 1, 2026 for all. Every company with B2B contractors now needs structured invoice intake, matching, and approval — and most still do it in Excel + email.

**Target customer:** Polish tech companies (software houses, agencies, product companies, startups) with 10-200 people and 5-50 active B2B contractors. Buyer persona: COO, Head of Ops, Finance Manager, or Founder doing ops themselves.

**Pricing target:** 350-650 PLN/mo platform fee, optional per-contractor add-on. Path to 10K MRR: 70-130 customers.

**Competitive positioning:** Not "mini-Deel" (they're cross-border EOR at $29-49/contractor). Not Faktura.pl (invoice-first, no contractor lifecycle). Not Notion/Excel (no execution layer or audit trail). Contractor Ops is a narrow, deep, execution-grade system for local B2B contractor lifecycle.

**Existing artifacts:** Comprehensive PRD (prd.md) with UI views, API contracts, data model, security requirements, and gap analysis. Detailed database schema (db-schema.md) with PostgreSQL + Prisma, multi-tenant design, bounded contexts.

## Constraints

- **Monorepo:** Turborepo — apps and packages with clean boundaries
- **Frontend:** Next.js + React + TypeScript + Tailwind CSS + shadcn/ui
- **State:** TanStack Query (server) + Zustand (client)
- **Tables:** TanStack Table
- **Forms:** React Hook Form + Zod
- **Backend:** Node.js + TypeScript, tRPC for API layer
- **ORM:** Prisma with PostgreSQL
- **Auth:** Better Auth (managed, self-hosted)
- **Database:** Neon (serverless PostgreSQL)
- **Cache/Queue:** Redis (Upstash on Vercel)
- **Storage:** S3-compatible (Cloudflare R2 or similar) for files
- **Deployment:** Vercel
- **Multi-tenant:** All queries scoped to organization_id via middleware
- **Desktop-first:** Responsive down to tablet (1024px), approval flow must work on mobile browser
- **i18n:** Polish + English from day 1
- **Quality:** Production-grade code, WCAG AA, strong typing, schema validation at boundaries, security best practices (see CLAUDE.md)
- **Solo developer:** Building with AI assistance — phases should be self-contained and shippable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| tRPC over REST | Full-stack type safety in Turborepo monorepo, better DX for solo dev | -- Pending |
| Better Auth over Clerk | Open-source, self-hosted, flexible — avoids vendor lock-in for auth | -- Pending |
| Neon over Supabase | Serverless Postgres with branching, great Vercel integration, no unnecessary extras | -- Pending |
| Next.js over Vite SPA | SSR/SSG capabilities, Vercel-native, file-based routing suits B2B dashboard app | -- Pending |
| Prisma over Drizzle | Mature ecosystem, great DX, db-schema already designed with Prisma in mind | -- Pending |
| Full MVP scope | Ship all 14 modules from PRD — ambitious but the PRD is detailed enough to execute | -- Pending |
| Email/upload for invoices in v1 | KSeF integration deferred to v1.5 — ship simpler intake first, validate flow | -- Pending |
| No contractor portal in v1 | Internal-facing only — contractor self-service deferred to v1.5 | -- Pending |

---
*Last updated: 2026-03-18 after initialization*
