# `packages/db/scripts/`

Scripts that operate against the regional Prisma databases. Each runs against a single `DATABASE_URL` per invocation; multi-region application is performed by setting the appropriate regional URL and re-running.

| Script | Purpose | Multi-region pattern |
|--------|---------|----------------------|
| `push-all-regions.ts` | Iterate over `DATABASE_URL_EU` + `DATABASE_URL_ME` and run `prisma db push` against each. | Built-in: iterates `REGION_ENV_VARS`. |
| `backfill-scope-capabilities.ts` | Backfill `IntegrationConnection.scopeCapabilities` for existing `GOOGLE_WORKSPACE` connections (Phase 70 D-14). Idempotent (`WHERE scopeCapabilities IS NULL`). | Manual per-region invocation (see below). |

## `backfill-scope-capabilities.ts`

Single-region per invocation. Run twice — once per region.

```sh
# Dry-run first to see how many rows would be touched
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run

# Apply
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts
```

Idempotent: re-running writes 0 rows because the `WHERE scopeCapabilities IS NULL` filter excludes already-backfilled connections. Safe to re-run after partial failure.

The script mirrors `push-all-regions.ts` (dotenv from monorepo root + pino logging + single-region per invocation) but does NOT iterate regions itself — Standing Project Constraint (LOCAL-ONLY) means each region is applied manually, not as part of an automated multi-region runner.
