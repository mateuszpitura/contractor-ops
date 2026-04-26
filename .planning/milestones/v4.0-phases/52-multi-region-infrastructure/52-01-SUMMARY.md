---
phase: 52-multi-region-infrastructure
plan: 01
subsystem: infra
tags: [prisma, neon, multi-region, tenant-isolation, asynclocalstorage]

requires:
  - phase: 51-pdpl-compliance
    provides: Organization model with countryCode field

provides:
  - DataRegion enum (EU, ME) in Prisma schema
  - Regional Prisma client pool with globalThis caching
  - Region-aware tenant middleware with ctx.db
  - createPrismaClientForUrl reusable factory

affects: [52-02, 52-03, 52-04, phase-48-zatca, phase-49-peppol]

tech-stack:
  added: []
  patterns: [regional-client-pool, region-aware-tenant-context]

key-files:
  created:
    - packages/db/src/region.ts
    - packages/db/src/__tests__/region.test.ts
    - packages/api/src/__tests__/tenant-region.test.ts
  modified:
    - packages/db/prisma/schema/organization.prisma
    - packages/db/src/client.ts
    - packages/db/src/index.ts
    - packages/db/src/tenant.ts
    - packages/api/src/middleware/tenant.ts
    - packages/validators/src/env.ts
    - .env.example

key-decisions:
  - "Organization table stays in primary (EU) region as the routing lookup table"
  - "Regional clients cached on globalThis for HMR safety and singleton behavior"
  - "TenantContext extended with region field — non-breaking for existing withTenantScope"
  - "ctx.db provides scoped regional client; gradual migration from direct prisma imports"

patterns-established:
  - "Regional client pool: getRegionalClient(region) returns cached PrismaClient per region"
  - "Region-aware middleware: tenant middleware resolves org.dataRegion and sets regional client"

metrics:
  files_created: 3
  files_modified: 7
  tests_added: 13
  tests_passing: 13
---

# Plan 52-01: Regional Database Routing — Schema & Client Pool

## What was built

Added per-organization data region assignment and a regional Prisma client pool. The Organization model now has a `dataRegion` field (enum: EU, ME, default EU). A new `packages/db/src/region.ts` module provides `getRegionalClient(region)` which creates and caches PrismaClient instances per region using separate Neon connection strings. The tenant middleware was extended to resolve each org's data region from the primary database and set a region-scoped Prisma client as `ctx.db`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 0886a44 | Add DataRegion enum and regional Prisma client pool |
| 2 | 45da0f6 | Extend tenant middleware with region-aware client routing |

## Deviations

None — implemented as planned.

## Self-Check: PASSED

- [x] DataRegion enum with EU and ME values in Prisma schema
- [x] Regional Prisma client pool with caching (7 tests passing)
- [x] Tenant middleware resolves org region and routes to correct client (6 tests passing)
- [x] Existing tenant isolation tests still pass (12 tests)
- [x] Env validation requires DATABASE_URL_EU and DATABASE_URL_ME
