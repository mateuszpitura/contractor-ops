# 98-01 Spike Findings — validators Zod-4 ↔ `@hono/zod-openapi` metadata seam

**Run:** 2026-07-05 · `apps/public-api/src/__tests__/openapi-metadata-spike.test.ts` (3 tests, all green)
**Resolves:** RESEARCH seam A2 / Pitfall 1 — where do route DTOs live?

## VERDICT: **A — validators-authored schemas REGISTER**

A `.strict()` Zod-4 schema authored in `@contractor-ops/validators` (plain `zod`) registers
into the OpenAPI 3.1 document produced by `app.getOpenAPI31Document(...)`:

1. **`openapi: '3.1.0'` is emitted** — the INTEG-API-02 3.1 target is reachable.
2. **Query parameters surface** — the fields of a validators-authored `.strict()` object used as
   `createRoute` `request.query` appear under `paths['/…'].get.parameters` with `in: 'query'`,
   even though the schema was created by the validators-owned `zod` (not the package `z`).
3. **Named components register via Zod-4 native `.meta({ id })`** — a validators schema carrying
   `.meta({ id: 'Name' })` produces a named `components.schemas.Name` entry in the derived doc,
   identical to the package `z` `.openapi('Name')` control. No package `z` is required to name a
   component.

### Why it works
`@contractor-ops/validators`, `@contractor-ops/api`, and `@hono/zod-openapi@1.4.0` all resolve the
**same `zod@4.4.3`** instance (pnpm dedupes it). `@hono/zod-openapi@1.x` bridges **Zod 4's global
metadata registry**, so `.meta({ id })` set anywhere (validators) is honoured when the schema is
handed to `createRoute`. The historical Zod-3-era requirement to call `.openapi()` from the package
`z` does not apply on Zod 4.

## Consequence for downstream plans (98-05, 98-07, 98-08, 98-09, 98-10)

- **Author route request/response DTOs in `@contractor-ops/validators`** (plain `zod`) and pass them
  straight to `createRoute` — validators stays the single DTO source (also the tRPC `.input()`).
- **For named component schemas** (response envelopes, write bodies that should appear as named SDK
  models), add a Zod-4 native `.meta({ id: '<Name>' })` in validators. Query DTOs need no name —
  their fields are always inlined as `parameters`.
- The app layer does **not** need to re-author schemas with the package `z`. Import `z` from
  `@hono/zod-openapi` only for the ad-hoc inline response wrappers that live in the route file
  (e.g. the `{ data, meta }` envelope wrapper), or reuse validators DTOs directly.

## Practical notes observed
- **Query schemas are always inlined** as `parameters` — a `.openapi('Name')`/`.meta({id})` on a
  *query* schema does NOT create a named component (OpenAPI has no `$ref` for query params). Named
  components only appear for request-body / response schemas. This is expected OpenAPI behaviour,
  not a limitation of the validators seam.

## Supply-chain gate (Task 1)
- Pinned exact ≥7-day versions: `@hono/zod-openapi@1.4.0` (published 2026-05-09, 57 days) +
  `@scalar/hono-api-reference@0.11.6` (published 2026-06-26, 9 days). Both resolve against the
  existing `hono@4.12.18` (not bumped). Speakeasy NOT added as an npm dep.
- `pnpm audit`: 53 advisories, **all pre-existing** (undici via `apps/web-vite`>jsdom + `apps/cms`>
  payload; hono itself `<4.12.21`/`<4.12.25`). **None** flow through `@hono/zod-openapi` or
  `@scalar/hono-api-reference`. Gate PASSES for the new packages.
