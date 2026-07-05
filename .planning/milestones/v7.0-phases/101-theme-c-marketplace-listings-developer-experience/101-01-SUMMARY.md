# 101-01 SUMMARY — RED validation net

**Status:** complete · **Wave:** 0 · **Requirements:** INTEG-ZAPIER-01, INTEG-N8N-01, INTEG-MAKE-01, INTEG-MARKETPLACE-01, INTEG-DX-01, INTEG-DX-02, INTEG-DX-03, INTEG-DX-04

## What shipped

Six NEW RED test files, each RED against the not-yet-built surface, plus the minimal
`@contractor-ops/marketplace-manifests` package scaffold so its two generator suites are scoped-runnable.
`nyquist_compliant: true` set in `101-VALIDATION.md`.

| RED file | Contract | Greened by |
|----------|----------|------------|
| `packages/api/src/__tests__/security/sandbox-isolation.security.test.ts` | `co_test_`/`co_live_` environment axis; `resolveApiKey` fail-closed both ways; widened `isDemoContext` for a sandbox org; `SANDBOX_DAILY_REQUEST_QUOTA === 100` | 101-02 |
| `packages/api/src/__tests__/marketplace-listing.test.ts` | `MARKETPLACE_PLATFORMS` / `MARKETPLACE_LISTING_STATUSES` + `isValidListingTransition` state machine | 101-03 |
| `packages/marketplace-manifests/src/__tests__/listing-manifest.test.ts` | `generateManifests(spec, events)` → Zapier/n8n/Make defs; triggers map to real catalog events, actions to real write operationIds; write-count conditional on the snapshot | 101-03 |
| `packages/marketplace-manifests/src/__tests__/collection-generation.test.ts` | `generatePostman`/`generateInsomnia` — one request per snapshot path+method; `{{baseUrl}}`/`{{apiKey}}` vars; deterministic (drift-check primitive); no literal key | 101-04 |
| `apps/public-api/src/__tests__/status-page.test.ts` | `/v1/status.json` maps api/webhooks-dispatcher/background-jobs; NO tenant data (deep scan); 404 when `module.public-status-page` off | 101-05 |
| `apps/public-api/src/__tests__/developer-portal.test.ts` | `/v1/docs/{webhooks,sdks,recipes,changelog,deprecations}` + `/v1/collections/*` serve on / 404 off; Scalar `/v1/docs` unchanged; catalog rendered from the shared events source | 101-08 |

## Fixture reuse (for 101-03 / 101-04)

- Generation source fixture: `packages/marketplace-manifests/src/__tests__/fixtures/openapi.snapshot.fixture.json`
  — a hand-written OpenAPI 3.1 spec with 3 read ops (`listContractors`, `getContractor`, `listInvoices`) +
  3 write ops (`createContractor`, `createInvoice`, `approveInvoice`) across 6 path+method combos. The
  generation tests read THIS fixture, not the live app, so drift assertions do not depend on the app build.
- Trigger source: `WEBHOOK_EVENT_TYPES` from `@contractor-ops/validators` (the 16-event catalog).

## Generator API contract asserted (101-03 / 101-04 must satisfy)

- `load-spec.ts`: `writeOperationIds(spec)`, `readOperationIds(spec)`, `requestCount(spec)`, `type OpenApiSnapshot`.
- `index.ts`: `generateManifests(spec, events)` → `{ zapier: { triggers[{key,event}], creates[{key,operationId}], authentication{type,...} }, n8n: { node.operations[{operationId}], trigger.events }, make: { modules[{operationId}], instantTriggers[{event}] } }`.
- `generate-postman.ts`: `generatePostman(spec)` → Postman v2.1. `generate-insomnia.ts`: `generateInsomnia(spec)` → Insomnia v4 (`_type:'export'`, `export_format:4`).

## Verification

- `pnpm --filter @contractor-ops/marketplace-manifests test` — RED (generator source absent).
- `pnpm --filter @contractor-ops/api test sandbox-isolation marketplace-listing` — RED.
- `pnpm --filter @contractor-ops/public-api test status-page developer-portal` — RED.
- `pnpm lint:no-breadcrumbs` — the 6 new files add zero new violations.

## Notes / deviations

- Phase 98 was only partially executed on main (98-01..08 have SUMMARY files; 98-09..12 do not). The 98-11
  `openapi.snapshot.json` + `apps/public-api/scripts/build-openapi-snapshot.ts` + `.speakeasy/workflow.yaml`
  are therefore absent. `buildOpenApiDocument` (98-06) exists. 101-03 will add the snapshot builder + commit
  the generated snapshot so the generators have a real source; the RED net uses the fixture and does not
  depend on it.
