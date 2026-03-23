# Contractor Ops

## What This Is

A B2B contractor operations platform for EU companies (Poland-first) with 5-50 contractors. Replaces the Excel + email + Slack + bank chaos with a single system covering the full contractor lifecycle: onboarding, contracts, invoices, approvals, payments, and offboarding. Built as a multi-tenant SaaS targeting software houses, agencies, and tech companies with 10-200 employees.

## Core Value

The invoice-to-payment flow must work end-to-end: a contractor's invoice arrives, gets matched to their contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.

## Current State

**v1.0 MVP shipped 2026-03-23** — 214K LOC TypeScript, 11 phases, 51 plans, 698 files.

All 14 product modules delivered: org setup, RBAC, contractors, contracts, documents, workflows, invoices (upload + email intake), approvals, notifications (in-app + email + Slack), payments, dashboard, reports, data import, onboarding wizard, global search + Cmd+K. Full Polish + English i18n.

## Requirements

### Validated — v1.0

- ✓ Multi-tenant organization setup with settings, branding, timezone, currency — v1.0
- ✓ User management with invite flow, RBAC (8 roles) — v1.0
- ✓ Contractor registry — full CRUD, search, filters, bulk actions, compliance health — v1.0
- ✓ Contractor profiles with 8 tabs — v1.0
- ✓ Contract repository — upload, metadata, versioning, reminders, statuses, amendments — v1.0
- ✓ Document management — upload, signed URLs, virus scanning, versioning — v1.0
- ✓ Workflow engine — template builder, dependencies, conditional logic — v1.0
- ✓ Workflow execution — task tracking, progress, overdue detection, comments, attachments — v1.0
- ✓ Invoice intake — drag & drop upload, email intake per org, status tracking — v1.0
- ✓ Invoice matching — auto-match by NIP, expected vs actual amount, deviation flags — v1.0
- ✓ Duplicate invoice detection — v1.0
- ✓ Approval workflow — 1-3 level chains, approve/reject/clarify/delegate, SLA timers — v1.0
- ✓ Payment runs — batch selection, CSV/bank file export, mark paid/failed, idempotency — v1.0
- ✓ Dashboard — KPI cards, spend chart, deadlines, approval queue, activity feed — v1.0
- ✓ Reports — 5 report types with filters and CSV export — v1.0
- ✓ Notifications — in-app + email for all critical events — v1.0
- ✓ Slack integration — approve/reject from Slack, reminders, activity alerts — v1.0
- ✓ Immutable audit log with search, filters, and export — v1.0
- ✓ Global search + command palette (Cmd+K) — v1.0
- ✓ Data import — CSV/XLSX wizard with column mapping, validation, preview — v1.0
- ✓ Product onboarding — guided setup wizard, empty states with CTAs — v1.0
- ✓ i18n — Polish + English with locale-aware formatting — v1.0
- ✓ Settings — org profile, users & roles, approval chains, workflows, notifications, email intake, audit log — v1.0

### Active

(No active requirements — define in next milestone)

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
- **Storage:** S3-compatible (Cloudflare R2) for files
- **Deployment:** Vercel
- **Multi-tenant:** All queries scoped to organization_id via AsyncLocalStorage + Prisma extension
- **Desktop-first:** Responsive down to tablet (1024px), approval flow works on mobile browser
- **i18n:** Polish + English from day 1
- **Quality:** Production-grade code, WCAG AA, strong typing, schema validation at boundaries, security best practices (see CLAUDE.md)
- **Solo developer:** Building with AI assistance — phases should be self-contained and shippable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| tRPC over REST | Full-stack type safety in Turborepo monorepo, better DX for solo dev | ✓ Good — 19 routers, zero API contract drift |
| Better Auth over Clerk | Open-source, self-hosted, flexible — avoids vendor lock-in for auth | ✓ Good — org plugin + RBAC works well |
| Neon over Supabase | Serverless Postgres with branching, great Vercel integration | ✓ Good — zero ops overhead |
| Next.js over Vite SPA | SSR/SSG, Vercel-native, file-based routing suits B2B dashboard | ✓ Good — locale routing, API routes for webhooks |
| Prisma over Drizzle | Mature ecosystem, great DX, schema designed with Prisma in mind | ✓ Good — multi-file schema, client extensions for tenant/soft-delete |
| Integer grosze for money | Eliminates floating-point precision risk | ✓ Good — consistent across all 11 phases |
| Email/upload for invoices v1 | KSeF deferred to v1.5 — ship simpler intake first | ✓ Good — validates flow without KSeF complexity |
| No contractor portal v1 | Internal-facing only — self-service deferred to v1.5 | ✓ Good — focused scope |
| cmdk for command palette | Already installed, lightweight, accessible | ✓ Good — zero config, works with tRPC search |
| xlsx for import/export | Single library for both directions | ✓ Good — BOM handling for Polish characters |
| Recharts for dashboard | Simple API, responsive, works with SSR | ✓ Good — area/bar/pie charts all working |

---
*Last updated: 2026-03-23 after v1.0 MVP milestone completion*
