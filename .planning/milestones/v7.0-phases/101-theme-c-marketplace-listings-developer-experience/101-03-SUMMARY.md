# 101-03 SUMMARY — marketplace-manifests generator + MarketplaceListing model

**Status:** complete · **Wave:** 1 · **Requirements:** INTEG-ZAPIER-01, INTEG-N8N-01, INTEG-MAKE-01, INTEG-MARKETPLACE-01

## What shipped

### The generator (`@contractor-ops/marketplace-manifests`)

Pure TypeScript over the OpenAPI snapshot + the 16-event webhook catalog — no hand-authored per-platform lists.

- `load-spec.ts` — the typed snapshot reader: `OpenApiSnapshot`, `listOperations` (deterministic order),
  `writeOperationIds`/`readOperationIds`/`requestCount`, `serverUrl`, `toSnakeKey`.
- `generate-zapier.ts` — `generateZapier(spec, events)` → custom API-key auth + one trigger per catalog
  event (`hook` type) + one create per write operationId.
- `generate-n8n.ts` — `generateN8n(spec, events)` → the regular-node operations (writes), the trigger-node
  events, and the apiKey credential.
- `generate-make.ts` — `generateMake(spec, events)` → modules (writes) + instant triggers (events) +
  apiKey connection.
- `index.ts` — `generateManifests(spec, events)` → `{ zapier, n8n, make }`, the single seam 101-06/07 import.

The write-action set is derived from the snapshot's actual write ops, so a writes-hidden snapshot yields
triggers + reads with zero creates (no false count failure). Greens `listing-manifest.test.ts` (8/8).

### The MarketplaceListing model + router

- `packages/db/prisma/schema/marketplace.prisma` — `MarketplaceListing` (one row per platform, `@unique`
  platform) + `MarketplacePlatform` + `MarketplaceListingStatus` enums. Global (not tenant-scoped).
- `packages/api/src/routers/core/marketplace-listing.ts` — `MARKETPLACE_PLATFORMS`,
  `MARKETPLACE_LISTING_STATUSES`, `isValidListingTransition`, and `marketplaceListingRouter` (`list` seeds
  the three platforms lazily; `update` enforces the review-state machine and audits every advance).
  Gated on the platform-operator `admin:marketplace` permission. Mounted in `root.ts`. Greens
  `marketplace-listing.test.ts` (14/14).
- New permission `admin:marketplace` in `packages/auth` (`permissions.ts` statement + `platform_operator`
  role in `roles.ts`); the three exact-grant auth tests updated (281/281 pass).
- `MARKETPLACE_LISTING` added to the `EntityType` Prisma enum + the `AuditEntityType` TS union.

### Migration (deferred apply)

`packages/db/prisma/schema/migrations/__marketplace_listing/` (migration.sql + down.sql): the two enums +
the table + `ALTER TYPE "EntityType" ADD VALUE 'MARKETPLACE_LISTING'`. `__`-prefixed → NOT applied by
codegen; applied per region at the human migration gate (EXTERNAL-ENABLEMENT row added in 101-10). The Prisma
client is regenerated so code compiles now.

## Generator entry + artifact contract (for 101-06 / 101-07)

- Import `{ generateManifests, generateZapier, generateN8n, generateMake, writeOperationIds, listOperations }`
  from `@contractor-ops/marketplace-manifests`.
- Shapes: `zapier.{authentication,triggers[],creates[]}`, `n8n.{node.operations[],trigger.events,credential}`,
  `make.{modules[],instantTriggers[],connection}`.

## Verification

- `pnpm --filter @contractor-ops/marketplace-manifests build` + `test listing-manifest` — GREEN (8/8).
- `pnpm --filter @contractor-ops/api test marketplace-listing` — GREEN (14/14); `authz-permission-matrix` — GREEN.
- `pnpm --filter @contractor-ops/auth test` — GREEN (281/281).
- `pnpm --filter @contractor-ops/api typecheck` — clean; `@contractor-ops/db` builds; client regenerated.

## Notes

- The `--check` drift CLI + the committed real artifacts are 101-04 work (they need the real
  `openapi.snapshot.json`, absent because 98-11 was not executed — see 101-01 SUMMARY). The generator core +
  its fixture-based contract are complete and independent of that.
- `collection-generation.test.ts` stays RED until 101-04 adds `generate-postman.ts` / `generate-insomnia.ts`.
