---
last_mapped_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
last_mapped_at: 2026-06-08
---

# contractor-ops — Repository Structure

Directory map for navigating the monorepo. Paths are relative to repo root. Pair with `.planning/codebase/ARCHITECTURE.md` for runtime behaviour and data flows.

## Top-level layout

```
contractor-ops/
├── apps/                    # Deployable applications (6)
├── packages/                # Shared libraries (18)
├── scripts/                 # lint-architecture.mjs, codemods
├── .planning/               # Product, roadmap, codebase maps (not shipped)
├── CLAUDE.md                # Engineering contract
├── pnpm-workspace.yaml      # Workspace globs + 7-day release age
├── turbo.json               # Turborepo task graph
├── render.yaml              # Render service definitions
└── package.json             # Root scripts (typecheck, test, lint gates)
```

## `apps/` — deployable services

| App | Key paths | Role |
|-----|-----------|------|
| `apps/api` | `src/server.ts`, `src/plugins/trpc.ts`, `src/plugins/auth.ts`, `src/routes/webhooks/` | Fastify: staff `/api/trpc/*`, portal `/api/trpc/portal/*`, Better Auth, webhooks |
| `apps/web-vite` | `src/pages/`, `src/components/{domain}/`, `ARCHITECTURE.md` | Vite SPA — staff dashboard + portal; container + hook pattern |
| `apps/cron-worker` | `src/jobs/handlers/` | QStash callbacks, scheduled jobs |
| `apps/public-api` | `src/routes/`, `src/lib/create-caller.ts` | Hono REST for API-key consumers |
| `apps/cms` | Payload on port 3002 | Blog CMS (Authors, Categories, Posts) |
| `apps/landing` | Next.js 16 | Marketing + blog consumption |

### `apps/api` tree (selected)

```
apps/api/src/
├── server.ts                # buildServer() — plugin order documented inline
├── plugins/trpc.ts          # Staff + portal tRPC mounts
├── plugins/auth.ts          # /api/auth/**
├── routes/portal-session.ts # Portal cookie helpers
├── routes/webhooks/         # Stripe, provider callbacks
└── lib/web-bridge.ts        # Fastify → Web Request for tRPC
```

### `apps/web-vite` tree (selected)

```
apps/web-vite/src/
├── pages/dashboard/         # Staff route shells (*-container only)
├── pages/portal/            # Contractor portal shells
├── components/{domain}/
│   ├── hooks/use-*.ts       # Sole tRPC boundary per section
│   ├── *-container.tsx      # Permission/variant decisions
│   └── **/data-table.tsx    # Presentational tables
├── components/portal/       # portal-invoices-container, etc.
├── components/layout/       # feature-flag-context, nav
├── hooks/                   # use-entity-detail-query, permissions
└── router/                  # dashboard-routes.tsx, portal-routes.tsx
```

Domain folders (non-exhaustive): `contractors`, `contracts`, `invoices`, `payments`, `approvals`, `workflows`, `equipment`, `time`, `settings`, `integrations`, `classification`, `billing`, `compliance`, `portal`.

## `packages/` — shared libraries

### `packages/api` — tRPC core

```
packages/api/src/
├── root.ts                  # appRouter (~50 namespaces + conditional classification)
├── portal-root.ts           # portalAppRouter (portal, portalTime)
├── init.ts                  # tRPC init, procedures, error formatter
├── context.ts               # createContext (Better Auth session)
├── middleware/
│   ├── tenant.ts            # tenantProcedure
│   ├── portal-auth.ts       # portalProcedure
│   └── rbac.ts              # requirePermission
├── routers/
│   ├── core/                # contractor, contract, approval, audit, …
│   ├── finance/             # invoice, payment, billing, invoice-intake
│   ├── compliance/          # classification, gdpr, zatca, consent, …
│   ├── equipment/, workflow/, integrations/, portal/, public-api/
├── services/                # approval-engine, invoice-matching, audit-writer, …
│   ├── compliance-payment-gate.ts
│   └── invoice-intake/      # ingest, match, finalize-stage
└── lib/                     # idempotency, tenant-find, audited-mutation
```

Finance routers often split and merge: `packages/api/src/routers/finance/payment.ts` composes `payment-core.ts`, `payment-export-router.ts`, `payment-run-ops.ts`, `payment-import.ts`, `payment-skonto.ts`.

### Supporting packages

| Package | Path | Role |
|---------|------|------|
| `db` | `packages/db/prisma/schema/`, `src/` | Prisma 7, migrations, regional + tenant clients |
| `auth` | `packages/auth/` | Better Auth; session types for `context.ts` |
| `validators` | `packages/validators/src/` | Zod inputs (tRPC, forms, `public-api/`) |
| `ui` | `packages/ui/src/components/workbench/data-table/` | Canonical `DataTable`, shadcn, atelier |
| `feature-flags` | `packages/feature-flags/src/registry.ts` | Unleash wrapper; declare keys here |
| `compliance-policy` | `packages/compliance-policy/src/` | Payment eligibility rules |
| `einvoice` | `packages/einvoice/src/profiles/` | XRechnung, ZUGFeRD, KSeF, ZATCA |
| `billing` | `packages/billing/src/webhook/` | Stripe webhook handlers |
| `classification` | `packages/classification/src/profiles/` | IR35 scoring |
| `test-utils` | `packages/test-utils/src/msw/` | MSW fixtures |
| `logger` | `packages/logger/` | Pino (no `console.*` in apps) |
| `lint-guards` | `packages/lint-guards/src/` | Architecture CI guards |

## tRPC namespace index

**Staff** — source: `packages/api/src/root.ts`

| Router folder | Namespaces |
|---------------|------------|
| `routers/core/` | `organization`, `organizationDefinitions`, `user`, `settings`, `contractor`, `contract`, `document`, `approval`, `notification`, `reminder`, `audit`, `import`, `search`, `dashboard`, `report`, `authPermissions`, `adminBoeRate`, `apiKey`, `docs`, `onboardingImport`, `deprovisioning`, `time`, `legal` |
| `routers/finance/` | `invoice`, `invoiceIntake`, `payment`, `billing`, `skonto`, `latePaymentInterest`, `exchangeRate`, `bacs` |
| `routers/workflow/` | `workflow`, `workflowRoles` |
| `routers/equipment/` | `equipment` |
| `routers/compliance/` | `complianceAdmin`, `gdpr`, `consent`, `einvoice`, `leitwegId`, `tax`, `zatca`, `gulf` + 7 conditional `classification*` |
| `routers/integrations/` | `integration`, `jira`, `linear`, `ksef`, `peppol`, `googleWorkspace`, `teams`, `calendar`, `ocr`, `esign` |
| Meta | `featureFlags` |

**Portal** — source: `packages/api/src/portal-root.ts` → `portal`, `portalTime`.

Procedure stacks: staff `tenantProcedure` (`middleware/tenant.ts`); portal `portalProcedure` (`middleware/portal-auth.ts`).

## Invoice & payment file map

| Step | Namespace | Key paths |
|------|-----------|-----------|
| Upload / parse | `invoiceIntake` | `packages/api/src/services/invoice-intake/`, finance intake router |
| CRUD | `invoice` | `packages/api/src/routers/finance/invoice-crud.ts` |
| Match | `invoice` | `invoice-matching.ts` router + `services/invoice-matching.ts` |
| Submit approval | `approval` | `routers/core/approval-submit.ts` |
| Approve queue | `approval` | `approval-queue.ts` + `services/approval-engine.ts` |
| Ready list | `payment` | `payment-core.ts` → `readyForPayment` |
| Create run | `payment` | `payment-core.ts` → `create` + `compliance-payment-gate.ts` |
| Export | `payment` | `payment-export-router.ts` |
| Bank import | `payment` | `payment-import.ts` |
| Staff UI | — | `apps/web-vite/src/components/invoices/`, `components/payments/` |
| Portal UI | `portal` | `apps/web-vite/src/components/portal/portal-invoices-container.tsx` |

## Where to add code (by task)

| Task | Steps |
|------|-------|
| **Staff tRPC procedure** | Zod in `packages/validators/src/` → router in `packages/api/src/routers/{domain}/` with `tenantProcedure` + `requirePermission` → register in `root.ts` if new namespace → `writeAuditLog` on sensitive mutations → hook + container + page in `apps/web-vite` |
| **Portal procedure** | `packages/api/src/routers/portal/` with `portalProcedure` → extend `portal-root.ts` if needed → UI in `components/portal/` + `router/portal-routes.tsx` |
| **DB schema** | `packages/db/prisma/schema/*.prisma` → migrate → seed → `pnpm typecheck --filter=@contractor-ops/api` |
| **Cron job** | `apps/cron-worker/src/jobs/handlers/` → register in job index; shared logic in `packages/api/src/services/` |
| **Feature flag** | `packages/feature-flags/src/registry.ts` → server `evaluate()` / client `useFlag()` in container → Unleash UI |
| **Public REST** | `apps/public-api/src/routes/` + `validators/src/public-api/`; reuse services, don't duplicate rules |
| **Shared UI primitive** | `packages/ui/`; app-specific presentation stays in `apps/web-vite/src/components/` |
| **Env var** | `.env.example` + package `env.ts`; run `pnpm check:no-process-env` |

## web-vite layering (quick reference)

Full spec: `apps/web-vite/ARCHITECTURE.md`.

```
Page (pages/**)  →  Container (*-container.tsx)  →  Hook (hooks/use-*.ts)  →  Component (props only)
```

- Pages: no `useTRPC`, no presentational imports except `*-container` and `page-loading-spinner`.
- Hooks: return props bags + flags (`isLoading`, `toolbarProps`, `tableProps`).
- Tables: `@contractor-ops/ui` `DataTable` only — enforced by `pnpm check:web-vite-table-pattern`.

## Multi-tenant, audit, flags (file pointers)

| Concern | Where |
|---------|-------|
| Staff tenant scope | `packages/api/src/middleware/tenant.ts` — `ctx.session.session.activeOrganizationId` |
| Portal session | `packages/api/src/middleware/portal-auth.ts` — `portal_session` cookie |
| Audit writes | `packages/api/src/services/audit-writer.ts` — pass `tx` in transactions |
| Audit reads | `packages/api/src/routers/core/audit.ts` |
| Flag registry | `packages/feature-flags/src/registry.ts` |
| Client flags | `apps/web-vite/src/components/layout/feature-flag-context.tsx` |

## Tooling

```bash
pnpm typecheck                              # Full monorepo
pnpm typecheck --filter=@contractor-ops/api # API package
pnpm test                                   # Vitest via turbo
pnpm check:web-vite-data-layer              # Hook-only tRPC enforcement
pnpm lint-architecture                      # scripts/lint-architecture.mjs
```

Conventions: tenant from session (never client `organizationId` alone); `packages/*` changes → typecheck apps; 7-day `minimumReleaseAge` on deps.
