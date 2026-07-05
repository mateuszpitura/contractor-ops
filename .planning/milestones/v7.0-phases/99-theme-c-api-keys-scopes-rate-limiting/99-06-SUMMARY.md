# 99-06 SUMMARY — hidden Hono write routes (double-dark transport)

**Wave:** 3 · **Status:** done

## What landed
- The 11 write procedures now have Hono `createRoute` POST/PATCH endpoints across the 6 write-entity
  route modules (contractors, invoices, payments, payment-runs, workflows, workflow-tasks), each with
  **`hide: true`** so they are ABSENT from the derived OpenAPI 3.1 document (and therefore the Scalar
  portal + Speakeasy SDK). Handlers are thin transport: validate the `.strict()` body
  (`c.req.valid('json')`) → `createPublicCaller(c).<entity>.<verb>(body)` → `{ data }`.
- Route map: contractors POST `/` + PATCH `/`; invoices POST `/` + PATCH `/void`; payments PATCH `/`;
  payment-runs POST `/` + PATCH `/transition` + POST `/export`; workflows POST `/` + POST `/execute`;
  workflow-tasks PATCH `/transition`. **No** write route for compliance-documents / classifications /
  audit-log.
- Shared `jsonBody` + `writeResponses` helpers in `openapi-route.ts` (documents 400 + 429 + the auth
  error set). The runtime flag gate + scope check + tier quota live in the inherited tRPC layer.

## Double-dark, by construction
The runtime `module.public-api` gate + `hide:true` compose: a write is 404-until-flag-granted AND
invisible-to-consumers. **Phase 99 does NOT flip the flag or un-hide** — that is Phase 100 after the
INTEG-SEC-01 OWASP gate.

## Tests (GREEN)
- `write-routes-dark.test.ts` (new, 12): every write route 404s while the flag is off (the mapped tRPC
  NOT_FOUND → HTTP 404), and the derived doc contains ZERO write operations.
- `openapi-doc.test.ts` still GREEN (reads present, writes absent, `openapi` 3.1); the full public-api
  suite (115) + `packages/api` `public-api-flag` write-half (real dark gate) pass.

## Verification
- `pnpm typecheck --filter @contractor-ops/public-api` clean.
