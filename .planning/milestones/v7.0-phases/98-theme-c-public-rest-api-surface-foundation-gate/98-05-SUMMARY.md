# 98-05 SUMMARY — pagination + filter/sort + versioning substrate

**Wave:** 1 · **Status:** done · **Verdict A** (DTO base authored in validators)

## What landed
- **`apps/public-api/src/lib/openapi-cursor.ts`** (new) — `encodeCursor(id)` / `decodeCursor(token?)`.
  Opaque, stateless, versioned base64url `{v:1,id}` envelope over the internal row-id cursor; empty
  token → `undefined`, tampered/garbage → `TRPCError BAD_REQUEST` (never a silent wrong page).
- **`apps/public-api/src/lib/parse-list-query.ts`** — added `parseBracketedQuery(q)`: collapses flat
  `filter[field]=` Hono keys into a nested `{filter:{...}}` object (cursor/limit/sort pass through)
  BEFORE `.strict()` validation. Existing `parseListQuery` safeParse→BAD_REQUEST contract preserved.
- **`packages/validators/src/public-api/index.ts`** — `publicListBaseSchema` (`.strict()` cursor +
  `limit` coerced int 1..100 default 25), `publicListMetaSchema` (`{nextCursor:string|null, hasMore}`
  — NO `total`), and a `publicListEnvelope(item)` helper for `{data, meta}` response schemas. The
  offset `paginationSchema` is retained until 98-07 migrates its call sites (non-breaking additive).
- **`apps/public-api/src/lib/version-headers.ts`** (new) — RFC 8594 `versionHeaders` middleware +
  `VERSION_POLICY` map. Dormant for `v1` (policyUrl only); emits `Deprecation`/`Sunset`/`Link;
  rel="sunset"` only when a policy sets dates.

## Tests GREEN
- `cursor-filter.test.ts` — 4 passed (round-trip, undefined, tamper→BAD_REQUEST, bracket nesting).
- `version-headers.test.ts` — 2 passed (dormant for v1; fires RFC 8594 headers on a set policy).

## Verify
- `pnpm typecheck --filter @contractor-ops/validators --filter @contractor-ops/public-api` — clean (15 tasks).
- INTEG-API-03 (versioning mechanism) + INTEG-API-04 (cursor + filter/sort) primitives in place;
  the per-entity extension pattern + `{data,meta:{nextCursor,hasMore}}` envelope documented for 98-07/08.
