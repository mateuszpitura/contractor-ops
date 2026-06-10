# @contractor-ops/api

tRPC v11 domain layer for contractor-ops. Consumed by `apps/api` (staff + portal host), `apps/public-api` (Hono REST → tRPC caller), and `apps/cron-worker` (job dispatch).

## Package layout

```
packages/api/src/
├── index.ts              # Public package entry (routers only)
├── root.ts               # appRouter — ~50 staff namespaces
├── portal-root.ts        # portalAppRouter — portal + portalTime
├── context.ts            # createContext, createCronContext, createApiKeyContext
├── init.ts               # tRPC init + procedure builders
├── middleware/           # tenant, rbac, tier, add-on, feature-flag, api-key-auth
├── routers/              # Thin(ning) domain routers — validate + delegate
│   ├── core/
│   ├── finance/
│   ├── compliance/
│   ├── equipment/
│   ├── integrations/
│   ├── workflow/
│   ├── gulf/
│   ├── portal/
│   └── public-api/       # Enterprise REST subset (apiKeyTenantProcedure)
├── services/             # Orchestration, side effects, external I/O
│   ├── cron-jobs/        # Stable cron-worker entrypoints (barrel)
│   ├── outbox/
│   ├── courier/
│   └── …
└── lib/                  # tenant-find, audited-mutation, pagination, csv
```

## Main entrypoints (`@contractor-ops/api`)

| Export | Path | Use |
|--------|------|-----|
| `appRouter` | `src/root.ts` | Staff SPA `/api/trpc/*` |
| `portalAppRouter` | `src/portal-root.ts` | Contractor portal `/api/trpc/portal` |
| `publicApiRouter` | `src/routers/public-api/index.ts` | Hono `/api/v1/*` via caller |
| `createContext` | `src/context.ts` | Per-request tRPC context (session) |
| `createApiKeyContext` | `src/context.ts` | Public API key auth |
| `createCronContext` | `src/context.ts` | Cron / QStash internal procedures |
| `createCallerFactory` | `src/init.ts` | Server-side caller for tests + Hono |

**Import rule for apps:** Prefer root exports. Deep-imports are for tree-shaking heavy subsystems only.

## Routers vs services

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Router** | Auth middleware, Zod input, tenant scope, call service, map errors | `routers/finance/payment-core.ts` |
| **Service** | Business logic, Prisma, external APIs, audit, queues | `services/payment-export.ts` |

Routers should not grow past ~800 LOC — split into `*-crud.ts`, `*-actions.ts`, `*-shared.ts` (Wave B pattern).

**Sensitive mutations:** `writeAuditLog` from `services/audit-writer.ts` (pass `tx` in transactions).

## cron-jobs barrel

**Path:** `packages/api/src/services/cron-jobs/index.ts`

Cron-worker handlers import **only** from this barrel (or `package.json#exports` service subpaths) — no inline Prisma in `apps/cron-worker`.

| Export | Underlying service |
|--------|-------------------|
| `processKsefSync` | `ksef-sync-orchestrator.ts` |
| `runComplianceReminderScan` | `compliance-reminder-scan.ts` |

Add new cron commands here when extracting logic from cron-worker (Wave D D2).

## Subpath exports (`package.json#exports`)

Heavy / app-specific services are addressable without pulling the full package:

```
@contractor-ops/api/services/audit-writer
@contractor-ops/api/services/outbox
@contractor-ops/api/services/ksef-sync-orchestrator
@contractor-ops/api/lib/advisory-lock
… (see package.json for full list)
```

**cron-worker** should use `cron-jobs` barrel for new jobs; legacy subpaths remain for existing handlers.

## Middleware composition (typical stack)

```
tenantProcedure
  .use(requireTier('STARTER'))          # billing tier
  .use(requireAddOn('workforce'))       # v7 add-on SKU (optional)
  .use(requireFeatureFlag('…'))         # flag-off → NOT_FOUND
  .use(requirePermission({ … }))        # RBAC or API-key scopes
```

See `middleware/rbac.ts`, `middleware/feature-flag.ts`, `middleware/add-on.ts`.

## public-api anti-corruption

Hono REST inputs: `@contractor-ops/validators/public-api` — not inline `z.object` in routers.

Staff tRPC inputs: `@contractor-ops/validators` main export.

## Tests

```bash
pnpm test --filter=@contractor-ops/api
pnpm typecheck --filter=@contractor-ops/api
```

Router tests: `packages/api/src/routers/__tests__/`. Service tests co-located under `services/**/__tests__/`.

## Related docs

- `.planning/architecture/V7-TIMING-OVERLAY.md` — when to split routers / public-api schemas
- `apps/web-vite/ARCHITECTURE.md` — UI data layer (containers must not import api directly)
