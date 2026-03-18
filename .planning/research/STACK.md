# Stack Research

**Domain:** B2B Contractor Operations SaaS (multi-tenant, Poland-first)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x | Full-stack framework | SSR/SSG, file-based routing, Vercel-native. App Router is the standard for B2B dashboards. Server Components reduce client bundle for data-heavy pages. |
| React | 19.x | UI library | Server Components, Suspense, transitions — all critical for data-dense SaaS UIs. |
| TypeScript | 5.7+ | Type safety | Non-negotiable for a solo dev building a complex SaaS. End-to-end type safety with tRPC. |
| tRPC | 11.x | API layer | Released March 2025. Full-stack type safety without code generation. SSE subscriptions for real-time updates. FormData support. First-class Next.js App Router + TanStack Query v5 integration. |
| Prisma | 6.x | ORM | Mature ecosystem, declarative schema, migrations, type-safe queries. The db-schema is already designed for Prisma. Prisma Client Extensions for audit logging middleware. |
| PostgreSQL (Neon) | 17 | Primary database | Serverless Postgres with branching (great for preview deploys). Native Vercel integration. Connection pooling built in. |
| Tailwind CSS | 4.x | Styling | Utility-first, composes well with shadcn/ui. v4 has CSS-first config, faster builds. |
| shadcn/ui | latest | Component library | Copy-paste components built on Radix UI. Not a dependency — you own the code. Already includes Chart (Recharts), Command (cmdk), Form (React Hook Form + Zod), and Table components. |

### Authentication & Authorization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Better Auth | 1.x | Authentication | Open-source, self-hosted, TypeScript-first. Organization plugin provides multi-tenant RBAC out of the box: owner/admin/member roles, invitations, member limits. Custom roles via dynamic RBAC stored in DB. Auth.js team joined Better Auth in Sep 2025 — this is the successor. |

**Better Auth Organization plugin covers:**
- Multi-tenant org creation with limits
- Role-based access (owner, admin, member + custom roles)
- Invitation workflows with email
- Permission checking via `hasPermission` API
- Active organization context for query scoping

**Custom RBAC mapping:** The 8 roles from PROJECT.md (admin, finance, ops, manager, legal viewer, IT admin, accountant, readonly) should be implemented as custom roles using Better Auth's dynamic RBAC feature, stored in the database.

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TanStack Query | 5.x | Server state | Cache invalidation, optimistic updates, infinite scroll. The standard for server state in React. tRPC v11 has first-class integration. |
| Zustand | 5.x | Client state | Minimal API, no boilerplate. Use sparingly — for UI state only (sidebar open, active filters, draft form state). Most state should live in TanStack Query or URL params. |
| nuqs | 2.x | URL state | Type-safe search params. Used by Vercel, Sentry, Supabase. Essential for shareable filter/sort/pagination state on data tables. 6 kB gzipped. |

### Data Tables & Forms

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TanStack Table | 8.x | Data tables | Headless, composable. Handles sorting, filtering, pagination, column visibility, row selection. Pairs with shadcn/ui DataTable pattern. |
| React Hook Form | 7.x | Form management | Uncontrolled forms = fewer re-renders. Native Zod resolver. shadcn/ui Form component wraps this. |
| Zod | 3.x | Schema validation | Single source of truth for validation: tRPC input, form validation, API responses. Shared in monorepo `packages/validators`. |

### Background Jobs & Workflow Orchestration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Inngest** | 3.x | Durable workflows, background jobs, scheduling | Event-driven, serverless-native. Runs on Vercel without separate worker infrastructure. Free tier: 50-100K executions/month. Step functions with sleep, fan-out, retries, debounce. First-class Vercel marketplace integration. |

**Why Inngest over alternatives:**
- **vs BullMQ:** BullMQ requires a separate long-running Node.js server for workers — impossible on Vercel serverless. Upstash Redis costs spike with BullMQ's polling. Inngest calls your existing serverless endpoints.
- **vs Trigger.dev:** Trigger.dev runs on dedicated compute (good for long tasks), but Inngest's step function model is better suited for approval chains, SLA timers, and multi-step workflows that sleep between steps. Inngest's free tier is 10x larger (50K vs 5K runs). Inngest can be self-hosted since v1.0.
- **vs QStash:** QStash is a message queue, not a workflow engine. Good for simple fire-and-forget, but lacks step functions, fan-out, and the durability guarantees needed for approval chains.

**Inngest handles these PROJECT.md requirements:**
- Approval workflow SLA timers (step.sleep + step.waitForEvent)
- Onboarding/offboarding workflow execution with task dependencies
- Invoice matching pipeline (event-driven, step-by-step)
- Overdue detection (scheduled cron functions)
- Contract expiry reminders (scheduled)
- Email intake processing pipeline
- Notification fan-out (in-app + email + Slack)

### Email

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Resend | 4.x | Transactional email sending | Built by React Email team. Simple API, good DX. Vercel-native. |
| React Email | 5.x | Email templates | Build emails with React + TypeScript. Dark mode support, Tailwind 4 support. Shared in monorepo as `packages/email`. |
| **Resend Inbound** | - | Email intake per org | Released Nov 2025. Webhook-based inbound email: parses content to JSON, stores attachments, provides download URLs. Eliminates need for SendGrid/Mailgun just for inbound. Single vendor for send + receive. |

**Email intake architecture:**
1. Each org gets a dedicated Resend inbound address (e.g., `invoices-{org-slug}@in.contractorops.com`)
2. Resend parses email, sends webhook to Next.js API route
3. Inngest function triggered: extract attachments, match sender to contractor (by email/NIP), create invoice record, run duplicate detection
4. No separate mail server infrastructure needed

### File Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Cloudflare R2 | - | S3-compatible object storage | Zero egress fees (critical for document downloads). S3-compatible API via `@aws-sdk/client-s3`. Presigned URLs for secure upload/download. Cheapest option for a document-heavy SaaS. |
| @aws-sdk/client-s3 | 3.x | S3 client | Official AWS SDK v3. Works with R2 via custom endpoint. |
| @aws-sdk/s3-request-presigner | 3.x | Presigned URLs | Generate upload/download URLs server-side. Browser uploads directly to R2. |

### Cache & Real-time

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Upstash Redis | - | Cache, rate limiting, sessions | Serverless Redis, per-request pricing. Use for: auth session cache, rate limiting, idempotency keys for payment runs, temporary locks. |
| @upstash/redis | 1.x | Redis client | HTTP-based, works in serverless/edge. |
| @upstash/ratelimit | 2.x | Rate limiting | Sliding window rate limiting for API routes. |

**Note:** Do NOT use Upstash for BullMQ job queues — the polling cost is prohibitive. Use Inngest for background jobs instead.

### Slack Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @slack/bolt | 4.x | Slack app framework | Official SDK. Handles OAuth, interactive messages, slash commands, event subscriptions. |
| @slack/web-api | 7.x | Slack API client | Included with Bolt. For sending Block Kit messages programmatically. |
| slack-block-builder | 2.x | Block Kit builder | Declarative, type-safe builder for Block Kit JSON. Avoids hand-writing JSON for approval messages with buttons. |

**Slack approval flow:**
1. Invoice approved/needs-review triggers Inngest function
2. Sends Block Kit message with Approve/Reject/Clarify buttons
3. User clicks button, Slack sends interaction payload to webhook
4. Webhook triggers tRPC mutation for approval action
5. Updates invoice status, sends confirmation message

### Internationalization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-intl | 4.x | i18n framework | Built for Next.js App Router + Server Components. 931K weekly downloads. Loads translations in Server Components without hydration overhead. Supports ICU message format for plurals, dates, currencies. |

**Why next-intl over next-i18next:** next-i18next is not compatible with the App Router. next-intl was designed for Server Components from the ground up. It's the clear winner for new Next.js projects.

**i18n architecture:**
- Translation files in `packages/i18n/messages/{locale}.json`
- Shared across monorepo
- Polish (pl) + English (en) from day 1
- Currency/date formatting via next-intl's `useFormatter` (handles PLN, EUR, date locales)

### Charts & Reporting

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Recharts | 2.x (3.x when shadcn supports) | Dashboard charts | Already integrated via shadcn/ui Chart component. Composition-based API. Handles spend charts, KPI visualizations, trend lines. |

**Do NOT add Tremor** — it's a wrapper around Recharts + Radix, which is exactly what shadcn/ui already provides. Adding Tremor would duplicate the abstraction layer.

### Data Import/Export

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PapaParse | 5.x | CSV parsing | Fast, streaming, RFC 4180 compliant. Zero dependencies. Handles large files via ReadableStream in Node.js. |
| xlsx (SheetJS) | 0.20.x | XLSX parsing | Read/write Excel files. Use Community Edition (free). For import wizard: XLSX -> parsed rows -> validation -> preview -> insert. |

### Audit Logging

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom Prisma extension | - | Immutable audit trail | Use Prisma Client Extensions to intercept all mutations and write to append-only `audit_log` table. Captures: actor, action, entity, old/new values, timestamp, org_id. |

**Implementation approach:**
- Prisma middleware/extension intercepts `create`, `update`, `delete` operations
- Writes to `audit_log` table with JSON diff of changes
- Table has no UPDATE/DELETE permissions at DB level (PostgreSQL GRANT)
- Separate from application logging — this is business audit trail
- Do NOT use external services (Bemi) for v1 — the pattern is simple enough to build

### Command Palette

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| cmdk | 1.x | Command palette | Already bundled in shadcn/ui Command component. Used by Linear, Vercel. Fuzzy search, keyboard navigation, zero dependencies. Just use `shadcn add command`. |

### Date & Time

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| date-fns | 4.x | Date manipulation | Tree-shakeable, functional API, immutable. Better bundle optimization than dayjs for apps that only use a subset of functions. Native TypeScript. Timezone support via `date-fns-tz`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turborepo | 2.x | Monorepo orchestration | Caching, parallel tasks, dependency graph. Already decided. |
| pnpm | 9.x | Package manager | Fast, disk-efficient, native workspace support. Standard for Turborepo monorepos. |
| Biome | 1.x | Linter + Formatter | Replaces ESLint + Prettier. 10-100x faster. Single tool, single config. Rust-based. |
| Vitest | 2.x | Unit/integration tests | Vite-native, fast, compatible with Jest API. Works with TypeScript out of the box. |
| Playwright | 1.x | E2E tests | Cross-browser, auto-waiting, trace viewer. Best E2E framework for Next.js. |
| Prisma Studio | - | DB GUI | Built into Prisma. Quick data inspection during development. |

**Why Biome over ESLint + Prettier:** ESLint flat config + Prettier requires multiple packages, plugin compatibility headaches, and slower execution. Biome is a single binary that lints and formats TypeScript/TSX/JSON in milliseconds. The ecosystem has matured enough by 2025 to be production-ready.

## Monorepo Structure

```
contractor-ops/
  apps/
    web/                  # Next.js app (dashboard, all UI)
  packages/
    db/                   # Prisma schema, client, migrations, seed
    api/                  # tRPC routers, procedures, middleware
    validators/           # Zod schemas (shared between api + web)
    email/                # React Email templates
    i18n/                 # Translation files, next-intl config
    ui/                   # shadcn/ui components (if extracting shared)
    config-typescript/    # Shared tsconfig
    config-biome/         # Shared Biome config
```

**Note:** Start with a single `web` app. Do NOT create separate `api` or `admin` apps — tRPC in Next.js API routes keeps everything in one deployment. Split only if you later need a separate admin panel or contractor portal.

## Installation

```bash
# Core framework
pnpm add next@latest react@latest react-dom@latest typescript@latest

# API layer
pnpm add @trpc/server@latest @trpc/client@latest @trpc/tanstack-react-query@latest @tanstack/react-query@latest

# Database
pnpm add prisma@latest @prisma/client@latest

# Auth
pnpm add better-auth@latest

# State & UI
pnpm add zustand@latest nuqs@latest
pnpm add @tanstack/react-table@latest
pnpm add react-hook-form@latest @hookform/resolvers@latest zod@latest

# Styling (shadcn/ui installed via CLI)
pnpm add tailwindcss@latest

# Background jobs
pnpm add inngest@latest

# Email
pnpm add resend@latest @react-email/components@latest

# File storage
pnpm add @aws-sdk/client-s3@latest @aws-sdk/s3-request-presigner@latest

# Cache & rate limiting
pnpm add @upstash/redis@latest @upstash/ratelimit@latest

# Slack
pnpm add @slack/bolt@latest slack-block-builder@latest

# i18n
pnpm add next-intl@latest

# Charts (via shadcn, but if manual)
pnpm add recharts@latest

# Data import
pnpm add papaparse@latest xlsx@latest

# Date utilities
pnpm add date-fns@latest

# Dev dependencies
pnpm add -D @biomejs/biome@latest vitest@latest @playwright/test@latest
pnpm add -D @types/react@latest @types/node@latest @types/papaparse@latest
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Better Auth | Clerk | If you want zero auth code and are OK with vendor lock-in + per-MAU pricing. Clerk is faster to ship but expensive at scale. |
| Better Auth | Auth.js (NextAuth) | Don't. Auth.js team joined Better Auth in Sep 2025. Auth.js is in maintenance mode. |
| Inngest | Trigger.dev v3 | If you need long-running compute (>5 min tasks, video processing). Trigger.dev runs on dedicated infra. Not needed for this app's workloads. |
| Inngest | BullMQ + Upstash | If you already have a long-running server. On Vercel-only, this requires a separate VPS for workers — unnecessary complexity. |
| Inngest | QStash | For simple fire-and-forget messages. QStash is good for one-off webhooks but lacks step functions and workflow durability. |
| next-intl | next-i18next | Never for App Router projects. next-i18next doesn't support Server Components. |
| Resend Inbound | SendGrid Inbound Parse | If you need higher volume or already use SendGrid. Resend keeps send + receive in one vendor. |
| Cloudflare R2 | AWS S3 | If you need S3 features not in R2 (like S3 Object Lambda, Glacier). R2 is cheaper for document storage due to zero egress. |
| Prisma | Drizzle | If you want SQL-first with zero abstraction. Drizzle is lighter but less mature ecosystem. The existing db-schema is Prisma-native — switching would cost time for no gain. |
| Neon | Supabase | If you want built-in auth, storage, realtime (Supabase bundles these). This project already has Better Auth, R2, Inngest — Neon is the right focused choice. |
| Biome | ESLint + Prettier | If you need niche ESLint plugins (accessibility, import sorting). Biome covers 95% of rules and is dramatically faster. |
| date-fns | dayjs | If you prefer Moment-like chaining API. date-fns is more tree-shakeable. |
| Recharts | Tremor | Don't — shadcn/ui already wraps Recharts. Adding Tremor duplicates the abstraction. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Moment.js | Deprecated, massive bundle (329 kB). Project recommends modern alternatives. | date-fns |
| next-i18next | Not compatible with Next.js App Router or Server Components | next-intl |
| Auth.js / NextAuth | Maintenance mode since Sep 2025. Better Auth is the successor. | Better Auth |
| Express.js server | Adds deployment complexity. tRPC in Next.js API routes covers all API needs on Vercel. | tRPC + Next.js API routes |
| BullMQ on Vercel | Workers can't run on serverless. Requires separate VPS. Upstash polling costs. | Inngest |
| Tremor | Wraps Recharts + Radix — same as what shadcn/ui already provides. Duplicate abstraction. | shadcn/ui Chart component |
| Prisma Accelerate | Neon already provides connection pooling. Accelerate adds unnecessary cost. | Neon built-in pooler |
| tRPC v10 | v11 released March 2025 with App Router improvements, SSE subscriptions, FormData. No reason to use v10. | tRPC v11 |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| tRPC v11 | TanStack Query v5 | v11 requires TanStack Query v5. Do not use v4. |
| tRPC v11 | Next.js 15 | First-class App Router support via fetch adapter. |
| Better Auth 1.x | Prisma 6.x | Uses Prisma adapter for session/user storage. |
| shadcn/ui (latest) | Recharts 2.x | v3 support coming. Use Recharts 2.x for now. |
| next-intl 4.x | Next.js 15 | Full App Router + Server Components support. |
| Inngest 3.x | Next.js 15 | serve() handler works with App Router route handlers. |
| React Email 5.x | Tailwind 4.x | v5 added Tailwind 4 support. |
| nuqs 2.x | Next.js 15 | Supports both App and Pages router via adapters. |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Core stack (Next.js, tRPC, Prisma, Tailwind) | HIGH | Well-established, verified via official docs and multiple sources |
| Better Auth + Organization plugin | HIGH | Official docs confirm multi-tenant RBAC. Auth.js team merger verified. |
| Inngest for background jobs | HIGH | Verified Vercel integration, pricing, step function capabilities via official docs |
| Resend Inbound for email intake | MEDIUM | Feature released Nov 2025 — relatively new. Needs testing for attachment volume and reliability. Fallback: SendGrid Inbound Parse. |
| Cloudflare R2 | HIGH | S3-compatible, presigned URLs documented, zero egress verified |
| Slack Bolt integration | HIGH | Official Slack SDK, well-documented Block Kit interactive patterns |
| next-intl | HIGH | 931K weekly downloads, Next.js Conf 2025 featured, App Router native |
| Biome over ESLint | MEDIUM | Production-ready but smaller ecosystem of rules. May need ESLint for edge cases. |

## Sources

- [tRPC v11 announcement](https://trpc.io/blog/announcing-trpc-v11) -- SSE subscriptions, FormData, TanStack Query v5
- [Better Auth Organization plugin](https://better-auth.com/docs/plugins/organization) -- multi-tenant RBAC docs
- [Inngest pricing](https://www.inngest.com/pricing) -- free tier, execution model
- [Inngest for Vercel](https://vercel.com/marketplace/inngest) -- marketplace integration
- [Resend Inbound Emails](https://resend.com/blog/inbound-emails) -- Nov 2025 launch, webhook parsing
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- S3 compatibility
- [next-intl docs](https://next-intl.dev/) -- App Router, Server Components
- [nuqs](https://nuqs.dev/) -- type-safe URL state, React Advanced 2025
- [shadcn/ui Chart](https://ui.shadcn.com/docs/components/radix/chart) -- Recharts integration
- [BullMQ + Upstash docs](https://upstash.com/docs/redis/integrations/bullmq) -- worker limitation on serverless
- [Inngest vs Trigger.dev comparison](https://nextbuild.co/blog/background-jobs-vercel-inngest-trigger) -- architecture differences
- [Slack Block Kit](https://docs.slack.dev/block-kit/) -- interactive components

---
*Stack research for: B2B Contractor Operations SaaS*
*Researched: 2026-03-18*
