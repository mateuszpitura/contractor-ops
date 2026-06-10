---
last_mapped_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
last_mapped_at: 2026-06-08
---

# contractor-ops — System Architecture

B2B contractor operations platform for EU, UK, and Gulf markets. The monorepo separates deployable **apps** (HTTP entrypoints) from shared **packages** (domain logic, UI, DB). Staff users interact via the Vite SPA; external contractors use the portal slice of the same SPA with a separate tRPC router and session model.

## Monorepo topology

| Layer | Tooling | Role |
|-------|---------|------|
| Workspace | `pnpm-workspace.yaml`, Turborepo | Six apps + eighteen packages; `minimumReleaseAge: 10080` (7-day dep gate) |
| Apps | `apps/*` | Runnable services: API, SPA, cron, REST, CMS, marketing |
| Packages | `packages/*` | Shared libraries consumed by apps; `@contractor-ops/api` is the tRPC core |
| Planning | `.planning/` | Product/process docs (not shipped) |
| Infra | `render.yaml`, `.env.example` | Render deploy; env schemas live in package `env.ts` files |

Canonical stack reference: `CLAUDE.md`. Web UI layering: `apps/web-vite/ARCHITECTURE.md`.

## Deployable apps

| App | Path | Runtime | Responsibility |
|-----|------|---------|----------------|
| API server | `apps/api` | Fastify + tsx | Staff + portal tRPC, Better Auth (`/api/auth/**`), webhooks, OAuth, exports |
| Web SPA | `apps/web-vite` | Vite + React | Staff dashboard + contractor portal routes; TanStack Query + tRPC v11 client |
| Cron worker | `apps/cron-worker` | Fastify | QStash callbacks, scheduled jobs, background webhooks |
| Public API | `apps/public-api` | Hono | REST for API-key consumers; reuses `@contractor-ops/api` via caller |
| CMS | `apps/cms` | Payload (port 3002) | Blog: Authors, Categories, Posts |
| Landing | `apps/landing` | Next.js 16 | Marketing site |

The API app factory is `apps/api/src/server.ts` → `buildServer()`. It wires security plugins (helmet, CORS, CSRF origin guard, rate limit), `authPlugin`, `webhookPlugin`, and `trpcPlugin`. It does **not** listen — `apps/api/src/index.ts` owns the process lifecycle so tests can `inject()` without a socket.

## Core packages (selected)

| Package | Path | Purpose |
|---------|------|---------|
| API / tRPC | `packages/api` | Routers, middleware, services, PDF templates; exported `appRouter`, `portalAppRouter`, `createContext` |
| DB | `packages/db` | Prisma 7 schema (`packages/db/prisma/schema/`), migrations, seed, regional clients |
| Auth | `packages/auth` | Better Auth config; session types used by `packages/api/src/context.ts` |
| Validators | `packages/validators` | Zod input schemas shared by tRPC, forms, public API |
| UI | `packages/ui` | shadcn + workbench `DataTable`, marketing components |
| Feature flags | `packages/feature-flags` | Unleash wrapper; keys in `packages/feature-flags/src/registry.ts` |
| Compliance policy | `packages/compliance-policy` | Payment eligibility rules consumed by `compliance-payment-gate` |
| E-invoice | `packages/einvoice` | XRechnung/ZUGFeRD/KSeF/ZATCA profiles and orchestration |
| Logger | `packages/logger` | Pino structured logging (no `console.*` in app source) |
| Test utils | `packages/test-utils` | MSW fixtures, integration helpers |

## HTTP → tRPC routing

`apps/api/src/plugins/trpc.ts` mounts two isolated routers:

```
Browser (staff)  →  POST /api/trpc/*           →  appRouter
Browser (portal) →  POST /api/trpc/portal/*    →  portalAppRouter
```

Portal routes register **first** so the staff wildcard does not swallow `/api/trpc/portal/*`. Each request is bridged to a Web `Request` via `apps/api/src/lib/web-bridge.ts` and handled by `fetchRequestHandler` from `@trpc/server/adapters/fetch`.

## Staff `appRouter` vs portal `portalAppRouter`

Defined in `packages/api/src/root.ts` and `packages/api/src/portal-root.ts`.

**Staff (`appRouter`)** — ~50 always-mounted namespaces for authenticated org members. Uses `tenantProcedure` (Better Auth session → `activeOrganizationId` → regional tenant-scoped Prisma). Examples: `contractor`, `contract`, `invoice`, `payment`, `approval`, `workflow`, `equipment`, `billing`, `audit`, `featureFlags`.

**Portal (`portalAppRouter`)** — two namespaces only: `portal`, `portalTime`. Uses `portalProcedure` (`packages/api/src/middleware/portal-auth.ts`): validates `portal_session` cookie, scopes via `tenantStore`, exposes `ctx.contractorId` and `ctx.organizationId`. Kept separate to shrink `AppRouter` TypeScript inference cost for the dashboard client.

**Conditional classification** — when `module.classification-engine` is enabled (or `QA_DEFAULT_ORG_ID` is set), `root.ts` spreads seven extra routers: `classification`, `classificationDashboard`, `classificationDocument`, `ir35Chain`, `ir35Attestation`, `economicDependencyAlert`, `reassessmentTrigger`, `statusfeststellungsverfahren`. When off, procedures return `METHOD_NOT_FOUND` at runtime; client types still see the namespaces.

Procedure chain for staff mutations:

```
publicProcedure → authedProcedure → tenantProcedure → requirePermission → handler
```

Context creation: `packages/api/src/context.ts` → `createContext()` resolves Better Auth session from request headers.

## Multi-tenant session model

**Never trust `organizationId` from client input alone.** Tenant scope is always derived server-side:

1. **Staff** — `packages/api/src/middleware/tenant.ts` reads `ctx.session.session.activeOrganizationId`, asserts org is ACTIVE, resolves `dataRegion` (EU / ME via `getOrgMeta`), builds a tenant-scoped Prisma client via `runWithTenantContext()`.
2. **Portal** — `portal-auth.ts` reads `organizationId` from the validated portal session token.
3. **API keys** — `packages/api/src/middleware/api-key-auth.ts` resolves org from the key record.
4. **Cron** — `cronProcedure` authenticates via `Authorization: Bearer <CRON_SECRET>`.

Regional DB: `DATABASE_URL_EU` / `DATABASE_URL_ME` (Neon multi-region in prod). RLS scaffolding (`withRlsReads`, `withRlsTransactions`) issues `SET LOCAL app.org_id` on scoped models.

## Audit trail

Sensitive mutations call `writeAuditLog()` or `writeAuditLogMany()` from `packages/api/src/services/audit-writer.ts`. Contract:

- Caller supplies `organizationId` explicitly (no implicit lookup).
- Pass `tx` inside `$transaction` so audit rows commit/roll back with business data.
- Append-only — no updates/deletes on `AuditLog`.
- Query/export via `audit` router (`packages/api/src/routers/core/audit.ts`).

## Feature flags

All flag access goes through `@contractor-ops/feature-flags` — **never** the Unleash SDK directly from apps.

| Surface | Usage |
|---------|--------|
| Server | `evaluate()`, `buildFlagBag()`, `isPaymentBlockEnforced()` |
| Web | `useFlag()`, `<Feature>` via `apps/web-vite/src/components/layout/feature-flag-context.tsx` |
| Registry | New keys declared in `packages/feature-flags/src/registry.ts`, then configured in Unleash UI |
| Boot gate | `assertFlagSignoffs()` — legal-sensitive namespaces require signoff entries |

Domain configuration (tax rates, jurisdiction rules) lives in Prisma, not flags.

## Invoice → payment data flow

End-to-end path from inbound document to bank export:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Invoice intake  │────▶│ Match / confirm  │────▶│ Submit approval │
│ invoiceIntake   │     │ invoice (matching│     │ approval.submit │
│ router +        │     │ router) + OCR    │     │ ForApproval     │
│ services/       │     │ auto-match via   │     │                 │
│ invoice-intake/ │     │ invoice-matching │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              ▼
                        │ Approval queue   │     ┌─────────────────┐
                        │ approval (queue) │◀────│ APPROVAL_PENDING│
                        │ approve/reject   │     └─────────────────┘
                        └────────┬─────────┘
                                 │ all steps approved
                                 ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ Invoice APPROVED│────▶│ paymentStatus   │
                        │ paymentStatus   │     │ READY           │
                        │ READY           │     └────────┬────────┘
                        └─────────────────┘              │
                                                           ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ Payment run     │◀────│ payment.ready   │
                        │ payment.create  │     │ ForPayment      │
                        │ (payment-core)  │     └─────────────────┘
                        └────────┬────────┘
                                 │ compliance gate
                                 ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ lockAndExport   │────▶│ Bank file       │
                        │ SEPA/Elixir/BACS│     │ CSV import back │
                        │ payment-export  │     │ payment-import  │
                        └─────────────────┘     └─────────────────┘
```

Key files:

- Intake pipeline: `packages/api/src/services/invoice-intake/` (`ingest.ts`, `match.ts`, `finalize-stage.ts`); router `packages/api/src/routers/finance/invoice-intake` (via finance index).
- Matching engine: `packages/api/src/services/invoice-matching.ts`; procedures in `packages/api/src/routers/finance/invoice-matching.ts`.
- Approval engine: `packages/api/src/services/approval-engine.ts`; submit in `packages/api/src/routers/core/approval-submit.ts`; queue in `packages/api/src/routers/core/approval-queue.ts`.
- Payment run: composed router `packages/api/src/routers/finance/payment.ts` → `payment-core.ts` (create, readyForPayment), `payment-export-router.ts` (lock/export), `payment-run-ops.ts`, `payment-import.ts`, `payment-skonto.ts`.
- Compliance gate before run creation: `packages/api/src/services/compliance-payment-gate.ts` → `@contractor-ops/compliance-policy`.

Statuses worth knowing: invoice `matchStatus` (MATCHED / MANUALLY_CONFIRMED required before approval), invoice `status` (APPROVAL_PENDING → APPROVED), `paymentStatus` (READY → PAID via run items or statement import).

## web-vite UI architecture (summary)

Four layers — full spec in `apps/web-vite/ARCHITECTURE.md`:

| Layer | Path pattern | tRPC allowed? |
|-------|--------------|---------------|
| Page | `apps/web-vite/src/pages/**` | No — compose `*Container` only |
| Container | `apps/web-vite/src/components/{domain}/*-container.tsx` | No — call domain hooks |
| Hook | `apps/web-vite/src/components/{domain}/hooks/use-*.ts` | Yes — sole tRPC boundary per section |
| Component | presentational `*.tsx` | No |

CI gates: `pnpm --filter @contractor-ops/web-vite check:data-layer`, `check:page-shells`, `check:web-vite-presentational`.

## Where to add new code

| Change | Primary location | Also check |
|--------|------------------|------------|
| New staff API procedure | `packages/api/src/routers/{domain}/` → register in `packages/api/src/root.ts` or domain `index.ts` | `packages/validators`, RBAC in `packages/api/src/middleware/rbac.ts`, audit on mutations |
| New portal procedure | `packages/api/src/routers/portal/` → `packages/api/src/portal-root.ts` | Portal session in `portal-auth.ts` |
| Business logic (shared) | `packages/api/src/services/` | Unit tests alongside service |
| DB schema change | `packages/db/prisma/schema/*.prisma` + migration | Downstream routers, seed |
| Staff UI screen | Hook first → container → thin page in `apps/web-vite/src/pages/` | `packages/ui` for shared primitives |
| Feature flag | `packages/feature-flags/src/registry.ts` | Unleash UI, signoff if gated namespace |
| Cron / background job | `apps/cron-worker/src/jobs/handlers/` | Register in cron index; use `createCronLogger` |
| Public REST endpoint | `apps/public-api/src/routes/` | API-key scopes, validators in `packages/validators/src/public-api/` |
| Env var | `.env.example` + relevant `packages/*/src/env.ts` | `pnpm check:no-process-env` |

## Verification commands

```bash
pnpm typecheck                              # CI-canonical tsc
pnpm typecheck --filter=@contractor-ops/api # API package only
pnpm test                                   # vitest via turbo
# Router keys: packages/api/src/root.ts + packages/api/src/portal-root.ts
```
