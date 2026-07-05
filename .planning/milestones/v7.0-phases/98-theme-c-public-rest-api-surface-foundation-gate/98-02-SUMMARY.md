# 98-02 SUMMARY — Wave-0 RED regression net

**Wave:** 0 · **Status:** done

## What landed (7 RED scaffolds)

### Hono-boundary (apps/public-api) — terminal Cannot-find-module RED
- `strict-dto.test.ts` — mass-assignment: write DTOs reject `organizationId`/`workerType`/money keys
  (RED: `publicApiContractorCreateInputSchema`/`publicApiInvoiceCreateInputSchema` not yet in validators → 98-09).
- `openapi-doc.test.ts` — 3.1 doc: reads present, ZERO write ops (RED: `../lib/build-openapi-doc` → 98-06; finalized 98-10).
- `cursor-filter.test.ts` — opaque cursor round-trip + tamper→BAD_REQUEST + bracket-filter nesting
  (RED: `../lib/openapi-cursor` + `parseBracketedQuery` → 98-05).
- `version-headers.test.ts` — RFC 8594 Sunset/Deprecation dormant-for-v1 + fires-on-policy
  (RED: `../lib/version-headers` → 98-05).

### tRPC security (packages/api)
- `security/public-api-write-scope.security.test.ts` — canonical BFLA tripwire. `WRITE_SCOPE_MATRIX`
  (14 write procedures × requiredScope) drives two halves: scope-registry membership (14 tests, RED
  until 98-03 adds write scopes) + `describe.skip('HOLD-until-98-09')` live 403 matrix (98-09).
- `security/public-api-flag.security.test.ts` — D-05 double-dark: read+write → NOT_FOUND when flag off
  (RED: `require-public-api-flag` `assertPublicApiEnabled` → 98-04).
- `routers/public-api/__tests__/tenant-isolation.security.test.ts` — cross-org isolation for the 7
  net-new families (RED: `../payment`/`../workflow`/`../audit` sub-routers → 98-08).

## tsconfig alignment (required for the RED net)
`apps/public-api/tsconfig.json` now excludes `src/**/__tests__/**` from `tsc` — matching the
`@contractor-ops/api` convention. Without this, terminal-RED scaffolds (missing-module imports) would
brick `pnpm --filter @contractor-ops/public-api typecheck`. Tests are covered by vitest + biome.

## Verify
- All 7 files collected + RED/HOLD. `pnpm --filter @contractor-ops/public-api typecheck` clean (tests excluded).
- api `__tests__` already excluded from tsc → no tsc regression from the 3 api scaffolds.

## BFLA tripwire note (canonical)
`WRITE_SCOPE_MATRIX` in `public-api-write-scope.security.test.ts` is the single source of the write
surface + required scope. 98-03 confirms membership; 98-09 un-skips the live 403 matrix. Adding a
write procedure without a matrix entry is a hard test failure.
