# Contractor Ops

## What This Is

A B2B contractor operations platform for EU, UK, and Gulf companies with 5-50 contractors. Replaces the Excel + email + Slack + bank chaos with a single system covering the full contractor lifecycle: onboarding, contracts, invoices, approvals, payments, and offboarding. Built as a multi-tenant SaaS targeting software houses, agencies, and tech companies with 10-200 employees. Multi-market e-invoicing (KSeF, ZATCA, Peppol), multi-currency, Arabic localization, Gulf compliance, and now expanding to UK (IR35) and Germany (Scheinselbständigkeit, XRechnung/ZUGFeRD).

## Core Value

The invoice-to-payment flow must work end-to-end: a contractor's invoice arrives, gets matched to their contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.

## Current State

**v5.0 UK & Germany Expansion COMPLETE 2026-04-26** — all 14 phases shipped (Phase 56–69). Final phase 69 (DE Message-Key Parity Fix) closed GAP-67-01-01 with 32 missing German translations across LPCDA late-interest dialog (Phase 63), Skonto preview-line, and Admin Classification Engine flag panel (Phase 64); FOUND-03 flipped Pending → Complete. Milestone delivers UK invoicing foundation (BACS Standard 18, LPCDA late-payment interest, Bank of England rate poller, IR35/SDS classification), German invoicing foundation (XRechnung CIUS-XR + ZUGFeRD, Skonto early-payment discounts, Scheinselbständigkeit risk classification with DRV criteria), full DE locale (formal-Sie register, 78 locked legal phrases, full message-key parity vs en.json), and v5.0 verification + hardening passes. 6 manual UI checkpoints tracked in `63-HUMAN-UAT.md`; LPCDA copy + Steuerberater + Plain operations sign-off recorded as post-deploy items per Standing Project Constraints (LOCAL-ONLY deploy posture, legal review DEFERRED).

**v4.0 International Foundation & Gulf Expansion shipped 2026-04-12** — ~562K LOC TypeScript, 55 phases (11 v1.0 + 16 v2.0 + 17 v3.0 + 11 v4.0), 205 plans, 55 plans in v4.0.

v4.0 International Foundation & Gulf Expansion (shipped 2026-04-12): Pluggable e-invoicing engine with country profiles (KSeF refactored, ZATCA Fatoorah integration, Peppol PINT-AE via Storecove ASP). Multi-currency with AED/SAR/GBP support and SWIFT pain.001 payment export. VAT engine with per-country rates, Saudi WHT calculator with treaty rates, and reverse charge detection. Full Arabic localization with RTL layout using CSS logical properties. PDPL compliance with jurisdiction-specific consent management and legal document generation. Multi-region infrastructure with per-org database routing and regional R2 storage. Government API framework with cert auth, retry, rate limiting, and audit logging.

v1.0 MVP foundation (shipped 2026-03-23): org setup, RBAC, contractors, contracts, documents, workflows, invoices, approvals, notifications (in-app + email + Slack), payments, dashboard, reports, data import, onboarding wizard, global search + Cmd+K. Full Polish + English i18n.

v2.0 Platform Expansion (shipped 2026-04-01): contractor self-service portal with magic-link auth and org branding, electronic signatures (DocuSign + Autenti), AI-powered invoice OCR (Claude Vision), KSeF national e-invoicing integration, time tracking with Clockify/Jira import and invoice reconciliation, Jira bidirectional sync, Notion/Confluence doc linking with Cmd+K search, Google/Outlook calendar deadline sync, and a provider-agnostic integration framework with OAuth credential store, webhook pipeline, and health monitoring.

v3.0 Enterprise & Monetization (shipped 2026-04-11): Stripe subscription billing with 3-tier plans (Starter/Pro/Enterprise), AI credit metering with hard-block, free trial system. Linear bidirectional sync with status mapping and workflow integration. Equipment tracking with InPost/DPD/UPS courier integrations including automated shipment status tracking via webhooks and polling. Google Workspace directory import with Admin SDK sync and new hire/departure detection. Microsoft Teams integration with Adaptive Card approvals and proactive channel alerts. Intelligent onboarding wizard importing team members and projects from connected tools. Feature gating with requireTier middleware enforcing subscription tiers across all premium features.

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

### Validated — v2.0

- ✓ Contractor portal — magic-link auth, contract viewing, invoice submission, payment tracking, document access — v2.0
- ✓ Portal self-service — profile edit with approval workflow, notification preferences, org branding with subdomain routing — v2.0
- ✓ Integration framework — OAuth credential store, webhook pipeline, health monitoring, token refresh — v2.0
- ✓ E-sign integration (DocuSign + Autenti) — embedded/redirect signing, multi-party, webhook PDF archival — v2.0
- ✓ OCR invoice parsing — Claude Vision extraction with confidence scoring, side-by-side review — v2.0
- ✓ KSeF native integration — auto-fetch, FA(3) XML parsing, duplicate detection, KSeF reference display — v2.0
- ✓ Time tracking — manual logging, Clockify/Jira import, manager approval, invoice deviation flagging — v2.0
- ✓ Jira integration — OAuth connect, auto-issue creation, bidirectional status sync, linked issue display — v2.0
- ✓ Notion/Confluence integration — doc page linking in workflows, Cmd+K search — v2.0
- ✓ Google/Outlook Calendar — deadline auto-push, workflow task event creation — v2.0

### Validated — v3.0

- ✓ Stripe subscription billing with 3-tier plans, trial system, and Stripe-hosted portal — v3.0
- ✓ AI credit metering with hard-block on exhaustion and usage dashboard — v3.0
- ✓ Linear bidirectional integration (issue sync, status mapping, webhooks) — v3.0
- ✓ Teams integration (Adaptive Card approvals, proactive messaging, channel alerts) — v3.0
- ✓ Google Workspace directory import with Admin SDK sync — v3.0
- ✓ Intelligent onboarding wizard importing from connected tools — v3.0
- ✓ Equipment tracking with manual entry tied to contractor lifecycle — v3.0
- ✓ InPost/DPD/UPS courier integrations with automated shipment tracking — v3.0
- ✓ Feature gating with requireTier middleware on all premium features — v3.0

### Validated — v4.0

- ✓ Pluggable e-invoicing engine with country profiles (KSeF, ZATCA, Peppol) — v4.0
- ✓ ZATCA Fatoorah integration with clearance, reporting, XML DSig, QR codes — v4.0
- ✓ Peppol PINT-AE integration with Storecove ASP, outbound/inbound, QR codes — v4.0
- ✓ Multi-currency support (AED, SAR, GBP + PLN/EUR) with SWIFT pain.001 export — v4.0
- ✓ VAT engine with per-country rates, reverse charge detection — v4.0
- ✓ Saudi WHT calculator with treaty rates and certificate generation — v4.0
- ✓ Full Arabic localization with RTL layout (CSS logical properties) — v4.0
- ✓ Country-specific contractor profile fields (freelance permits, trade licenses, tax IDs) — v4.0
- ✓ PDPL compliance with consent management, privacy notices, DPA generation — v4.0
- ✓ Multi-region infrastructure with per-org database routing and regional R2 storage — v4.0
- ✓ Government API framework with cert auth, retry, rate limiting, audit logging — v4.0
- ✓ Locale-aware formatting (currency, dates) across all supported locales — v4.0

### Validated — v5.0

- ✓ Generic contractor classification engine with UK IR35 (CEST-aligned, 25 questions) and German Scheinselbständigkeit (DRV 30/30/25/15 weighted criteria) — v5.0
- ✓ Status Determination Statement (SDS) PDF generation, IR35 chain participant tracking, DRV audit defense PDF bundle — v5.0
- ✓ Economic dependency alerts (70%/83.33% thresholds), reassessment triggers via AuditLog scans, Statusfeststellungsverfahren tracking with expiry reminders — v5.0
- ✓ Per-market compliance health dashboard with CSV export and 7-component visualisation — v5.0
- ✓ XRechnung 3.0.2 CII XML generator with KoSIT 3-layer validation and Leitweg-ID lifecycle — v5.0
- ✓ ZUGFeRD PDF/A-3 hybrid generator with embedded CII XML and inbound parser — v5.0
- ✓ BACS Standard 18 Direct Credit export with VocaLink modulus check and ASCII transliteration — v5.0
- ✓ LPCDA-compliant statutory late-payment interest with BoE base-rate poller, claim PDF, and waiver flow — v5.0
- ✓ German Skonto early-payment-discount cascade with structured BG-20 emission in XRechnung CII + ZUGFeRD embedded CII — v5.0
- ✓ HMRC VAT validation (OAuth + fraud-prevention headers) and VIES qualified USt-IdNr confirmation — v5.0
- ✓ German i18n at full message-key parity (4,281 leaf keys, formal-Sie register, 78/78 locked legal phrases) — v5.0
- ✓ UK GDPR privacy notice + German Datenschutzerklärung MDX with React-PDF download (IDOR-safe) — v5.0
- ✓ UK contractor fields (UTR mod-11, GB VAT mod-97, Companies House) + German contractor fields (Steuernummer 16-Bundesland, USt-IdNr ISO 7064, SV-Nummer DRV-spec, Handelsregister ~120-court list) — v5.0
- ✓ Legal compliance hardening: Unleash feature-flag with PENDING → APPROVED CI gate, advisory banners, ToS reacceptance, classification flag-OFF render-tree removal + tRPC FORBIDDEN — v5.0

### Active

## Next Milestone: v6.0 Platform Maturity & Operational Hardening

**Goal:** Make the platform production-grade across all supported markets (PL, UK, DE, UAE, SA) by closing critical operational gaps. No new market entry; focus on reliability and security for real users.

**Target features:**
- Compliance Document Lifecycle Engine — per-country required document definitions, automated expiry tracking with 90/60/30/15/7-day alerts, hard payment blocking on expired critical documents, automated contractor reminders, compliance dashboard with at-risk contractor count
- Identity Provider Deprovisioning — Google Workspace auto-suspend, Azure AD/Entra ID auto-disable, Okta SSO revocation, GitHub org member removal, Slack workspace deactivation on offboarding, full audit trail of access revocation
- Gulf Operational Polish — UAE free zone entity tracking with permitted activity scope per zone and license expiry monitoring; Saudization workforce composition dashboard with nationality tracking
- Offboarding Hardening — knowledge transfer checklist templates per role type, IP assignment verification workflow blocking offboarding completion, documentation handover task with credential links, contract clause health check flagging missing IP-assignment language

### Out of Scope

- Payroll for employees — not an HR tool, contractor ops only
- EOR/AOR — local contractors only, not employer of record
- Performance reviews / recruiting / ATS — not HR
- Open banking / payment initiation — v4+
- SSO/SCIM — v4+
- KSeF invoice validation against structured data — v4+
- KSeF invoice sending (FA(3) XML generation — accounting system territory
- Contractor marketplace / directory — never
- Full accounting suite — coordination layer, not replacement
- Mobile native app — desktop-first, responsive to tablet, approval flow works on mobile browser
- Bi-directional calendar sync — one-way push sufficient
- Notion/Confluence content mirroring — link + preview, not full rendering
- Build own e-sign engine — legal compliance requires certified providers

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
| Provider adapter pattern | Every integration shares credential store, webhook pipeline, health monitoring | ✓ Good — 10 providers, zero per-integration infrastructure code |
| Portal as route group (not separate app) | Shares auth, DB, tRPC, UI packages — avoids duplication | ✓ Good — portalProcedure + magic-link auth clean separation |
| PortalSession model (not internal User) | Contractors never touch internal user table — separate auth domain | ✓ Good — zero privilege escalation risk |
| QStash for async processing | Webhook processing, OCR extraction, KSeF sync — all fire-and-forget | ✓ Good — reliable retry, signature verification, no infra to manage |
| AES-256-GCM per-provider encryption | Each integration has its own key — credential isolation | ✓ Good — 10 provider keys, no shared-key blast radius |
| Claude Vision for OCR | Native PDF support, tool_use for structured extraction | ✓ Good — high accuracy, grosze handling, confidence scores |
| KSeF token auth (cert deferred) | XAdES certificate auth requires .p12 + XML signing complexity | ✓ Good — token covers 90%+ of use cases |
| Fire-and-forget for integrations | Calendar push, Jira sync, OCR — never block user mutations | ✓ Good — void + .catch() pattern consistent across all hooks |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-26 after Phase 69 DE Message-Key Parity Fix complete — v5.0 UK & Germany Expansion milestone shipped (14/14 phases)*
