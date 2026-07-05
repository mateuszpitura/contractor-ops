# 101-08 SUMMARY — developer portal (extends the Scalar /docs mount)

**Status:** complete · **Wave:** 3 · **Requirements:** INTEG-DX-01

## What shipped

The portal EXTENDS the shipped Scalar `/v1/docs` reference (unchanged) with five sibling pages + two
collection routes, all behind a default-off `module.developer-portal` flag (404 when off — ship-dark):

- **`apps/public-api/src/lib/portal-content.ts`** — server-rendered HTML builders sourced from the SAME
  artifacts the API generates, so the docs cannot drift:
  - `/docs/webhooks` — the 16-event catalog rendered from `@contractor-ops/validators` `WEBHOOK_EVENT_TYPES`
    (the same source the marketplace triggers generate from) + the `X-CO-Signature` HMAC-SHA256 contract.
  - `/docs/sdks` — install guides for the 98-11 Speakeasy targets (`@contractor-ops/sdk` npm /
    `contractor-ops-sdk` PyPI).
  - `/docs/recipes` — the shipped TS/Python/Go/PHP verifier snippets read from
    `apps/public-api/docs/webhooks/verifiers/*` + the marketplace recipe pointers.
  - `/docs/changelog` — renders `apps/public-api/CHANGELOG.md`.
  - `/docs/deprecations` — the RFC-8594 `Deprecation`/`Sunset` policy from `version-headers.ts` `VERSION_POLICY`.
- **`apps/public-api/src/routes/docs.ts`** — `registerDeveloperPortal(app)`: the five pages + `/collections/
  {postman,insomnia}.json`, each gated on `module.developer-portal`. The collections are generated on demand
  from the LIVE OpenAPI document (`buildOpenApiDocument(app)` → `generatePostman`/`generateInsomnia`), cached
  per-instance, so they always match the served spec (no committed-snapshot dependency).
- **`apps/public-api/CHANGELOG.md`** — the v1 API changelog.
- Mounted in `app.ts` right after the Scalar `/docs`. Added `@contractor-ops/marketplace-manifests` as a
  public-api dependency (the collection emitters). `.env.example` documents the portal + status-page flags +
  the deferred public hostnames.

## RED → GREEN + no regression

- `developer-portal.test.ts` — **GREEN 5/5** (was RED): the five pages + two collections serve on / 404 off,
  the webhook page contains every `WEBHOOK_EVENT_TYPES` event, and the Scalar `/docs` reference is unchanged.
- `@contractor-ops/public-api` typecheck clean; **full public-api suite 123/123** (all 19 files green) — the
  status-page + developer-portal RED suites are now both green; the OWASP/write-routes-dark fence unchanged.

## Deferred (EXTERNAL-ENABLEMENT — 101-10)

- The public `developers.contractor-ops.{tld}` hostname is a deploy-time DNS/Render step; the portal runs
  behind `module.developer-portal` locally now.
- The collection routes generate from the LIVE derived spec today; when the real 98-11
  `openapi.snapshot.json` lands, the 101-04 committed collections + `generate --check` gate can serve/verify
  the pinned artifacts instead. Recorded as the snapshot-deferral row.
