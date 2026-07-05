# 98-07 SUMMARY — migrate the 5 shipped reads to createRoute + cursor

**Wave:** 3 · **Status:** done

## Architecture decision (load-bearing)
The **opaque cursor encode/decode lives at the Hono boundary** (`apps/public-api`), because
`packages/api` cannot depend on the app. The tRPC read procedures use **plain row-id cursors** via
`cursorClause` + `paginateByLastKeptUndefined`; the Hono handler `decodeCursor(input.cursor)` before
calling the caller and `encodeCursor(nextCursor)` in the response envelope.

**Pitfall 6 solved:** `createRoute` `request.query` wraps the validators DTO in
`z.preprocess(parseBracketedQuery, dto)` (via `listQuery(dto)`), so `filter[field]=` bracket params
are reconstructed into the nested `{filter}` object BEFORE `.strict()` runs — validated correctly,
unknown filters → 400, and params still surface in the spec. (The wrapper is cast back to the DTO
type so tsc accepts it as `request.query`.)

## What landed
- **validators**: the 4 offset list DTOs (contractor/invoice/contract/document) replaced with cursor
  DTOs `= publicListBaseSchema.extend({ filter: z.object({...}).strict().optional(), sort: enum })
  .strict()`. `publicListBaseSchema`/`publicListMetaSchema`/`publicListEnvelope` relocated above them.
- **`packages/api/src/lib/public-cursor.ts`** (new): `publicOrderBy(sort)` — `field`|`-field` →
  deterministic `[{field:dir},{id:dir}]` keyset order.
- **4 tRPC read routers** (contractor/invoice/contract/document): offset (`skip/take/count`,
  `{items,total,page,pageSize}`) → cursor (`cursorClause` + `paginateByLastKeptUndefined`,
  `{items,nextCursor}`). Read scope + `where:{organizationId,deletedAt:null}` + `select` unchanged.
- **`apps/public-api/src/lib/openapi-route.ts`** (new): shared `errorResponses`, `listQuery`,
  `listOkResponse`/`itemOkResponse`, and `envelope()` helper.
- **5 Hono routes** (contractors/invoices/contracts/documents/feature-flags) → `OpenAPIHono`
  `createRoute` with typed, named response item schemas (`PublicContractor` etc.) — they now appear in
  the derived 3.1 spec. Handlers emit `{data,meta:{nextCursor,hasMore}}` (no `total`).
- **build-openapi-doc.ts**: `servers` fixed to the API host (NOT `/v1`) — `basePath('/v1')` already
  puts `/v1` in the derived paths, so `servers:'/v1'` would double-prefix.
- Updated the 4 tRPC router tests + 4 Hono route tests to the cursor/filter/envelope shape.
- Fixed two `/v1`-base fallouts: `rate-limit.security.test.ts` GUARDED_ROUTE `/api/v1`→`/v1`, and the
  spike test param assertions (`status`/`sortBy` → `cursor`/`sort`, since its schema changed).

## Response-typing note (0.x)
Response item schemas mirror the list `select` with reasonable types (enums/dates as strings). Fields
are documentation-only (zod-openapi does not validate responses). This is an honest 0.x-PRERELEASE
foundation; field precision can be hardened before SDK 1.0 (post-Phase-99).

## Verify
- `pnpm --filter @contractor-ops/public-api test` — 99 passed; only strict-dto (→98-09) + openapi-doc
  reads-present (→98-08) remain RED (future waves).
- `pnpm --filter @contractor-ops/api test public-api` — 65 passed / 15 skipped; tenant-isolation RED (→98-08).
- `pnpm typecheck --filter @contractor-ops/api --filter @contractor-ops/validators --filter @contractor-ops/public-api` — clean (16 tasks).
- No `page`/`pageSize`/`skip`/`meta.total` in the public read path.
