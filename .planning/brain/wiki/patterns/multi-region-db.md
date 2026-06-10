---
title: Multi-region database
type: pattern
tags: [database, neon, multi-tenant]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/db/src/region.ts
  - packages/db/src/client.ts
  - packages/db/src/rls.ts
updated: 2026-06-09
---

# Multi-region database

## Purpose

Orgs hosted in EU or ME (Gulf) regions. Prisma clients routed by org `dataHostingRegion`.

## Flow

```mermaid
flowchart LR
  org[activeOrganizationId] --> region[dataHostingRegion]
  region --> eu[DATABASE_URL_EU]
  region --> me[DATABASE_URL_ME]
  eu --> client[tenant Prisma client]
  me --> client
```

## Entry points

| Piece | Path |
|-------|------|
| Region routing | `packages/db/src/region.ts` |
| Pool + logging | `packages/db/src/client.ts` |
| RLS | `packages/db/src/rls.ts` |
| Migrations | `packages/db/scripts/migrate-all-regions.ts` |
| R2 regional | `packages/api/src/services/regional-storage.ts` |

## Invariants

- `withRlsReads` / `withRlsTransactions` for tenant isolation
- Raw SQL must be tenant-scoped — `pnpm lint:raw-sql`

## Related

- [[tenant-and-audit]]
- [[integrations/neon-r2]]
- [[structure/prisma-schema-areas]]

## Verify live

```bash
semble search "DATABASE_URL_EU"
pnpm lint:raw-sql
```

## Agent mistakes

- Single global DB assumption for all orgs
- `$executeRaw` without tenant guard
