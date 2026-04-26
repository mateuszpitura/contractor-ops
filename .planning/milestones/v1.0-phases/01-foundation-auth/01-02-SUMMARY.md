---
phase: 01-foundation-auth
plan: 02
subsystem: auth
tags: [better-auth, trpc, rbac, organization, middleware, tenant-isolation, magic-link, oauth, sensitive-action]

# Dependency graph
requires:
  - phase: 01-foundation-auth/01
    provides: Prisma schema, db client singleton, tenant AsyncLocalStorage, monorepo structure
provides:
  - Better Auth server with email/password, magic link, Google OAuth, Microsoft OAuth
  - 8 predefined RBAC roles with access control enforcement
  - tRPC v11 API layer with auth/tenant/RBAC/sensitive middleware chain
  - Organization, user, and settings tRPC routers
  - Sensitive action re-authentication guard (5-minute session age)
  - tRPC client for server and client components in Next.js
  - Auth catch-all API route and tRPC fetch adapter route
  - Zod validators for organization and user management
affects: [01-foundation-auth, 02-contractor-management, 03-contracts-documents, 04-workflow-engine, 05-invoice-pipeline, 06-approval-workflow, 07-notifications, 08-payments, 09-integrations, 10-reporting]

# Tech tracking
tech-stack:
  added: [better-auth@1.5, @trpc/server@11, @trpc/client@11, @trpc/tanstack-react-query@11, @tanstack/react-query@5, superjson@2, zod@3]
  patterns: [better-auth-organization-plugin, trpc-middleware-chain, rbac-permission-factory, sensitive-action-reauth, trpc-v11-options-proxy, query-client-ssr-hydration]

key-files:
  created:
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/auth/src/config.ts
    - packages/auth/src/client.ts
    - packages/api/src/init.ts
    - packages/api/src/context.ts
    - packages/api/src/middleware/auth.ts
    - packages/api/src/middleware/tenant.ts
    - packages/api/src/middleware/rbac.ts
    - packages/api/src/middleware/sensitive.ts
    - packages/api/src/routers/organization.ts
    - packages/api/src/routers/user.ts
    - packages/api/src/routers/settings.ts
    - packages/api/src/root.ts
    - packages/validators/src/organization.ts
    - packages/validators/src/user.ts
    - apps/web/src/app/api/auth/[...all]/route.ts
    - apps/web/src/app/api/trpc/[trpc]/route.ts
    - apps/web/src/trpc/init.ts
    - apps/web/src/trpc/client.tsx
    - apps/web/src/trpc/query-client.ts
    - apps/web/src/trpc/server.tsx
    - apps/web/src/lib/auth-client.ts
    - apps/web/src/app/providers.tsx
  modified:
    - packages/auth/src/index.ts
    - packages/auth/package.json
    - packages/api/src/index.ts
    - packages/api/package.json
    - packages/validators/src/index.ts
    - apps/web/package.json

key-decisions:
  - "Prisma adapter for Better Auth database layer instead of raw SQL — consistent with Prisma 7 schema"
  - "Permission type as partial record of resource-action arrays — matches Better Auth hasPermission API body shape"
  - "Middleware ctx typing via unknown cast for tenant and sensitive middleware — tRPC v11 middleware ctx is base-typed, upstream additions accessed via runtime cast"

patterns-established:
  - "Auth middleware chain: publicProcedure -> authedProcedure -> tenantProcedure -> adminProcedure/sensitiveActionProcedure"
  - "RBAC permission factory: requirePermission({ resource: ['action'] }) creates reusable middleware"
  - "Sensitive action guard: sensitiveActionProcedure enforces 5-min session age for role changes, deactivation, settings"
  - "tRPC v11 client: createTRPCOptionsProxy with httpBatchLink and superjson transformer"
  - "Server-side tRPC: createCallerFactory + createHydrationHelpers for SSR prefetch"
  - "Organization metadata: Extended settings (legalName, fiscalYear, billing, language) stored in Better Auth org metadata field"

requirements-completed: [ORG-01, ORG-03, ORG-04, ORG-05, ORG-06, ORG-07]

# Metrics
duration: 9min
completed: 2026-03-18
---

# Phase 1 Plan 02: Better Auth + RBAC + tRPC v11 Summary

**Better Auth with 8-role RBAC organization plugin, tRPC v11 middleware chain (auth/tenant/RBAC/sensitive), and organization/user/settings routers with re-authentication guards on sensitive actions**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-18T11:57:15Z
- **Completed:** 2026-03-18T12:07:09Z
- **Tasks:** 2
- **Files modified:** 33

## Accomplishments
- Better Auth configured with email/password, magic link, Google OAuth, Microsoft OAuth, organization plugin, admin plugin, and 24h sessions with email verification
- 8 predefined RBAC roles (admin, finance_admin, ops_manager, team_manager, legal_compliance_viewer, it_admin, external_accountant, readonly) with exact permission mappings across 11 resources
- tRPC v11 API layer with composable middleware chain: auth -> tenant -> RBAC/sensitive -> handler
- Sensitive action re-authentication enforced on updateRole, deactivate, reactivate, and settings.update (session must be < 5 minutes old)
- tRPC client works from both server components (via createCallerFactory + HydrateClient) and client components (via createTRPCOptionsProxy)
- Zod validators shared between frontend and backend for organization and user management

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Better Auth with organization plugin, RBAC roles, and all auth methods** - `026bc35` (feat)
2. **Task 2: Set up tRPC v11 with auth/tenant/RBAC/sensitive middleware chain and routers** - `926683c` (feat)

## Files Created/Modified
- `packages/auth/src/permissions.ts` - Access control statement with 11 resources and all action pairs
- `packages/auth/src/roles.ts` - 8 predefined role definitions using ac.newRole()
- `packages/auth/src/config.ts` - Better Auth server config with all plugins
- `packages/auth/src/client.ts` - Browser auth client with organization and magic link plugins
- `packages/auth/src/index.ts` - Re-exports for auth, client, permissions, roles, types
- `packages/api/src/init.ts` - tRPC v11 initialization with superjson transformer
- `packages/api/src/context.ts` - Context from request headers
- `packages/api/src/middleware/auth.ts` - Session validation middleware
- `packages/api/src/middleware/tenant.ts` - Organization scope + AsyncLocalStorage middleware
- `packages/api/src/middleware/rbac.ts` - requirePermission factory + adminProcedure
- `packages/api/src/middleware/sensitive.ts` - 5-minute session age re-auth guard
- `packages/api/src/routers/organization.ts` - create, getCurrent, update procedures
- `packages/api/src/routers/user.ts` - list, invite, updateRole, deactivate, reactivate procedures
- `packages/api/src/routers/settings.ts` - get, update procedures
- `packages/api/src/root.ts` - Root appRouter merging all sub-routers
- `packages/validators/src/organization.ts` - createOrganization and updateSettings Zod schemas
- `packages/validators/src/user.ts` - inviteUser and updateUserRole Zod schemas
- `apps/web/src/app/api/auth/[...all]/route.ts` - Better Auth catch-all handler
- `apps/web/src/app/api/trpc/[trpc]/route.ts` - tRPC fetch adapter handler
- `apps/web/src/trpc/init.ts` - Client-side tRPC with createTRPCOptionsProxy
- `apps/web/src/trpc/client.tsx` - TRPCProvider with QueryClientProvider
- `apps/web/src/trpc/query-client.ts` - QueryClient factory with 30s staleTime
- `apps/web/src/trpc/server.tsx` - Server-side caller with HydrateClient
- `apps/web/src/lib/auth-client.ts` - Re-export of authClient for web app
- `apps/web/src/app/providers.tsx` - Root providers wrapping TRPCProvider

## Decisions Made
- **Prisma adapter for Better Auth:** Used `prismaAdapter(prisma, { provider: "postgresql" })` for database access, consistent with the Prisma 7 schema established in Plan 01-01.
- **Permission type design:** Defined Permission as a partial record `{ [R in Resource]?: ActionsFor<R>[] }` to match Better Auth's hasPermission API body format, rather than deriving from ac object methods.
- **Middleware ctx typing:** Used `(ctx as unknown as Type)` casts in tenant and sensitive middleware because tRPC v11 types the base context from initTRPC, and upstream middleware additions are not visible to standalone middleware definitions.
- **Organization metadata for extended settings:** Stored legalName, fiscalYearStartMonth, billingEmail, and language in Better Auth's organization metadata field rather than creating separate database tables.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invitationId property access in sendInvitationEmail callback**
- **Found during:** Task 1 (Better Auth config)
- **Issue:** Plan referenced `data.invitationId` but Better Auth types the callback parameter with `data.invitation.id`
- **Fix:** Changed to `data.invitation.id`
- **Files modified:** packages/auth/src/config.ts
- **Committed in:** 026bc35 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Permission type — ac object has no hasPermission method**
- **Found during:** Task 1 (permissions.ts)
- **Issue:** Plan used `Parameters<(typeof ac)["hasPermission"]>[0]` but createAccessControl returns an object with newRole/statements, not hasPermission
- **Fix:** Defined Permission type as explicit partial record mapping resources to action arrays
- **Files modified:** packages/auth/src/permissions.ts
- **Committed in:** 026bc35 (Task 1 commit)

**3. [Rule 3 - Blocking] Added zod dependency to API package**
- **Found during:** Task 2 (router files import zod)
- **Issue:** API package had no zod dependency, routers importing z from "zod" failed
- **Fix:** Added zod to packages/api/package.json dependencies
- **Files modified:** packages/api/package.json
- **Committed in:** 926683c (Task 2 commit)

**4. [Rule 1 - Bug] Fixed middleware context type casts for tenant and sensitive middleware**
- **Found during:** Task 2 (tRPC middleware build)
- **Issue:** tRPC v11 middleware ctx is typed as base Context ({ headers: Headers }), upstream middleware additions not visible. Direct cast failed TypeScript overlap check.
- **Fix:** Used `(ctx as unknown as ...)` double cast to access session from auth middleware
- **Files modified:** packages/api/src/middleware/tenant.ts, packages/api/src/middleware/sensitive.ts
- **Committed in:** 926683c (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 bug)
**Impact on plan:** All fixes necessary for type correctness and build success. No scope creep.

## Issues Encountered
- Better Auth's TypeScript types differ from documentation patterns in RESEARCH.md in several places (invitation callback shape, access control API). Resolved by inspecting actual type definitions from the installed package.

## User Setup Required
None for this plan. OAuth credentials (Google, Microsoft) and DATABASE_URL are required at runtime but were already documented in .env.example from Plan 01-01.

## Next Phase Readiness
- Auth foundation complete: sign-up, login (email/password, magic link, OAuth), organization creation, invitation flow
- RBAC enforcement ready: all 8 roles defined and checkable via requirePermission middleware
- tRPC API layer ready: organization, user, and settings routers handle all Phase 1 backend operations
- Tenant isolation wired: every tenantProcedure wraps handlers in AsyncLocalStorage context
- Sensitive action guards active: role changes, deactivation, and settings updates require fresh session
- Next plan (01-03) can build the app shell UI knowing the API layer is fully functional

## Self-Check: PASSED
