# 98-06 SUMMARY — OpenAPIHono host + Scalar dep + /v1 base

**Wave:** 2 · **Status:** done

## What landed
- **`app.ts`** rewritten: `const app = new OpenAPIHono().basePath('/v1')`. Middleware order preserved
  (requestId → observability → secureHeaders → cors → rateLimit) + `versionHeaders` appended. Existing
  5 route modules still `.route()`-mounted (they serve; createRoute spec contribution lands in 98-07).
- **`lib/build-openapi-doc.ts`** (new) — `buildOpenApiDocument(app)` = the single 3.1 doc builder
  (`getOpenAPI31Document`, `servers:[{url:'/v1'}]`), reused by runtime `/openapi.json` AND the 98-11
  snapshot. Writes are `hide:true` so absent by construction.
- **Scalar** — `/docs` served by `@scalar/hono-api-reference` `Scalar({url:'/v1/openapi.json'})`. Removed
  the CDN `<script>`+SRI HTML, the `SCALAR_VERSION`/`SCALAR_SRI`/`SCALAR_SRI_PLACEHOLDER` boot-throw, and
  the `ENABLE_API_DOCS` gate entirely.
- **Deleted** `src/openapi.ts` (hand-written literal — kills the drift) and `src/__tests__/app-sri.test.ts`
  (tested the removed SRI throw).
- **`render.yaml`** `healthCheckPath` `/api/v1/health` → `/v1/health`; comment updated to `/v1/docs`.
- **`.env.example`** removed `ENABLE_API_DOCS` + `SCALAR_SRI_HASH` with a note to drop the matching
  Render dashboard vars (sync:false) — now unused.
- **`app.test.ts`** paths `/api/v1/*` → `/v1/*`; `/docs` test now asserts 200 HTML (Scalar) instead of 404.

## `/api/v1` caller grep
No first-party caller of our `/api/v1/*` exists — the only `/api/v1` hits are external third-party APIs
(clockify.me, dataport.pl). App is local-only. No redirect added.

## Tests / verify
- `app.test.ts` — 13 passed (Scalar /docs 200, /v1 base, health, CORS, security headers).
- `openapi-doc.test.ts` — 3.1-emission + writes-absent PASS; reads-present still RED (routes convert to
  createRoute in 98-07/08 — expected).
- `pnpm typecheck --filter @contractor-ops/public-api` — clean.
