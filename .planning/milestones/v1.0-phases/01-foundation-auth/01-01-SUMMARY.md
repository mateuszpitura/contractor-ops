---
phase: 01-foundation-auth
plan: 01
subsystem: database
tags: [turborepo, prisma, neon, postgresql, monorepo, tenant-isolation, soft-delete]

# Dependency graph
requires: []
provides:
  - Turborepo monorepo with 6 packages (web, db, auth, api, validators, ui)
  - Complete Prisma 7 schema covering all 40+ tables from db-schema.md
  - Tenant isolation via AsyncLocalStorage Client Extension
  - Soft-delete Client Extension for core business models
  - Neon adapter client singleton pattern
affects: [01-foundation-auth, 02-contractor-management, 03-contracts-documents, 04-workflow-engine, 05-invoice-pipeline, 06-approval-workflow, 07-notifications, 08-payments, 09-integrations, 10-reporting]

# Tech tracking
tech-stack:
  added: [next@15, react@19, prisma@7.5.0, @prisma/adapter-neon, @neondatabase/serverless, better-auth, @trpc/server, zod, turbo, biome]
  patterns: [turborepo-monorepo, prisma-multi-file-schema, prisma-client-extension-tenant, prisma-client-extension-soft-delete, neon-adapter-singleton, integer-grosze-currency]

key-files:
  created:
    - packages/db/prisma/schema/schema.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/contract.prisma
    - packages/db/prisma/schema/invoice.prisma
    - packages/db/prisma/schema/workflow.prisma
    - packages/db/prisma/schema/approval.prisma
    - packages/db/prisma/schema/payment.prisma
    - packages/db/prisma/schema/audit.prisma
    - packages/db/prisma/schema/notification.prisma
    - packages/db/prisma/schema/integration.prisma
    - packages/db/src/client.ts
    - packages/db/src/tenant.ts
    - packages/db/src/soft-delete.ts
    - packages/db/src/index.ts
    - turbo.json
    - biome.json
    - apps/web/src/app/layout.tsx
  modified:
    - packages/db/package.json

key-decisions:
  - "Integer grosze for all monetary fields (Int type) - eliminates floating-point precision risk entirely"
  - "cuid() for all primary keys (String type) - collision-resistant, URL-safe, sortable"
  - "Prisma 7 multi-file schema with --schema flag instead of prisma.config.ts due to Node 24 config parsing issue"
  - "Soft-delete scoped to 5 core models (Organization, Contractor, Contract, Invoice, Document) rather than all models"
  - "InvoiceLine vatRate stored as String to support Polish VAT codes (23, 8, 5, 0, ZW, NP)"

patterns-established:
  - "Turborepo monorepo: apps/web + packages/{db,auth,api,validators,ui} with shared tsconfig.base.json"
  - "Prisma multi-file schema: separate .prisma files per bounded context under prisma/schema/"
  - "Tenant isolation: AsyncLocalStorage + Client Extension injecting organizationId into all queries"
  - "Soft-delete: Client Extension converting delete to update deletedAt, filtering on reads"
  - "Currency: All amounts stored as Int in grosze (1/100 PLN), field names suffixed with Grosze"
  - "Prisma client: Neon adapter singleton with global caching for dev environment"

requirements-completed: [ORG-01, ORG-07]

# Metrics
duration: 12min
completed: 2026-03-18
---

# Phase 1 Plan 01: Monorepo Scaffold + Prisma Schema Summary

**Turborepo monorepo with 6 packages, complete Prisma 7 schema (40+ models across 11 bounded contexts), Neon adapter, tenant isolation via AsyncLocalStorage Client Extension, and soft-delete Client Extension with integer grosze for all monetary fields**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-18T11:39:26Z
- **Completed:** 2026-03-18T11:51:42Z
- **Tasks:** 2
- **Files modified:** 44

## Accomplishments
- Turborepo monorepo with 6 packages installs and builds dry-run successfully
- Complete Prisma 7 multi-file schema covering all tables from db-schema.md generates successfully
- Tenant isolation via AsyncLocalStorage Client Extension with global model exclusion
- Soft-delete Client Extension converting deletes to timestamp updates
- All monetary fields use Int (grosze) for zero floating-point risk
- Every tenant-scoped model has organizationId with composite indexes

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Turborepo monorepo with all packages** - `388548e` (feat)
2. **Task 2: Create complete Prisma 7 database schema with tenant isolation and soft-delete extensions** - `cdfa57a` (feat)

## Files Created/Modified
- `package.json` - Root monorepo config with type: module, pnpm 9.15.0
- `pnpm-workspace.yaml` - Workspace definition for apps/* and packages/*
- `turbo.json` - Turborepo v2 task pipeline (build, dev, lint, test, db:generate, db:push)
- `biome.json` - Biome formatter/linter with 2-space indent, 100 line width
- `tsconfig.base.json` - Shared TypeScript config (ES2022, NodeNext, strict)
- `.env.example` - All required environment variables (DATABASE_URL, auth, OAuth, email)
- `.gitignore` - Standard ignores for node_modules, .next, generated, .env
- `apps/web/` - Next.js app with Inter font, minimal layout and page
- `packages/db/prisma/schema/*.prisma` - 11 schema files covering all bounded contexts
- `packages/db/src/client.ts` - Prisma client singleton with Neon adapter
- `packages/db/src/tenant.ts` - Tenant isolation via AsyncLocalStorage Client Extension
- `packages/db/src/soft-delete.ts` - Soft-delete Client Extension
- `packages/db/src/index.ts` - Re-exports and createTenantClient helper
- `packages/auth/src/index.ts` - Better Auth placeholder
- `packages/api/src/index.ts` - tRPC placeholder
- `packages/validators/src/index.ts` - Zod validators placeholder
- `packages/ui/src/index.ts` - UI component library placeholder

## Decisions Made
- **Integer grosze for currency:** All monetary fields use Int type. Field names suffixed with `Grosze` (e.g., `totalGrosze`, `amountToPayGrosze`). Eliminates floating-point precision risk entirely.
- **cuid() primary keys:** String type with `@default(cuid())` on all models. Collision-resistant, URL-safe, sortable by creation time.
- **Multi-file schema with --schema flag:** Prisma 7's `prisma.config.ts` fails to parse on Node 24. Using `--schema=prisma/schema` flag in package.json scripts instead. Config file deferred until Node/Prisma compatibility resolved.
- **Soft-delete scoped to 5 models:** Only Organization, Contractor, Contract, Invoice, and Document get soft-delete behavior. Other models use hard delete since they are either immutable (AuditLog) or cascade-deleted.
- **InvoiceLine vatRate as String:** Supports Polish VAT rate codes including non-numeric values (ZW for zero-rate exempt, NP for not applicable).
- **Next.js 15.3.x:** Research noted 16.1.7 but npm registry serves 15.x as latest stable. Using 15.3.x which is the current stable version.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma 7 config file parsing failure on Node 24**
- **Found during:** Task 2 (Prisma schema generation)
- **Issue:** `prisma.config.ts` fails to parse with "Failed to parse syntax of config file" error. Prisma 7 cannot load TypeScript config files on Node 24.11.0.
- **Fix:** Removed `prisma.config.ts`, updated package.json scripts to use `--schema=prisma/schema` flag explicitly. The config file will be recreated when migration support is needed and the Node/Prisma compatibility is resolved.
- **Files modified:** packages/db/package.json
- **Verification:** `pnpm --filter @contractor-ops/db db:generate` exits 0 and generates client
- **Committed in:** cdfa57a (Task 2 commit)

**2. [Rule 3 - Blocking] Prisma 7 datasource url no longer supported in schema files**
- **Found during:** Task 2 (Prisma schema generation)
- **Issue:** Prisma 7 error: "The datasource property `url` is no longer supported in schema files"
- **Fix:** Removed `url = env("DATABASE_URL")` from datasource block in schema.prisma. URL will be passed via adapter in client.ts at runtime.
- **Files modified:** packages/db/prisma/schema/schema.prisma
- **Verification:** Schema validates and client generates successfully
- **Committed in:** cdfa57a (Task 2 commit)

**3. [Rule 3 - Blocking] Prisma 7 driverAdapters no longer a preview feature**
- **Found during:** Task 2 (Prisma schema generation)
- **Issue:** `previewFeatures = ["driverAdapters"]` would cause warnings in Prisma 7 where driver adapters are stable
- **Fix:** Removed previewFeatures from generator block
- **Files modified:** packages/db/prisma/schema/schema.prisma
- **Committed in:** cdfa57a (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking issues related to Prisma 7 breaking changes)
**Impact on plan:** All fixes necessary to make Prisma 7 work correctly. prisma.config.ts deferred but not blocking — schema generation and client creation work fine. No scope creep.

## Issues Encountered
- Prisma 7 has significant breaking changes from the patterns documented in research (no url in datasource, no previewFeatures for driverAdapters, config file parsing broken on Node 24). All resolved by adapting to Prisma 7's actual requirements.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- Monorepo structure ready for all subsequent plans
- Complete database schema ready — later phases add no new tables, only use existing ones
- Tenant isolation pattern established — Plan 01-02 will wire it into Better Auth
- Soft-delete pattern established — will be composed with tenant scope in production use
- Placeholder packages ready for auth, api, validators, and ui implementation

## Self-Check: PASSED

All 19 key files verified present. Both task commits (388548e, cdfa57a) verified in git log. Generated Prisma client directory exists at packages/db/generated/prisma/client/.

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-18*
