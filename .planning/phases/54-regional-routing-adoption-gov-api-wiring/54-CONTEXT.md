# Phase 54: Regional Routing Adoption & Gov API Wiring - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all routers and services to use the regional database routing infrastructure (ctx.db) from Phase 52, switch the document router from legacy r2.ts to regional-storage.ts, and wire ZATCA/Peppol API clients to the gov-api framework (GovApiClient, GovApiRateLimiter, GovApiAuditLogger).

</domain>

<decisions>
## Implementation Decisions

### Migration Scope
- **D-01:** Migrate ALL 43 routers to use `ctx.db` (regional Prisma client) instead of importing `prisma` directly. Full consistency — not just v4.0 routers. This future-proofs the entire codebase for multi-region.
- **D-02:** Service functions that import `prisma` directly (e.g., consent-record.ts, zatca-submission.ts) should be refactored to accept a Prisma client as a parameter, injected from the calling router. Falls back to global `prisma` if called outside tRPC context (e.g., cron jobs). Makes services region-aware and testable.
- **D-03:** Document router switches from legacy `r2.ts` to `regional-storage.ts` for presigned URL generation. Correct bucket selected based on org's data region.

### Gov API Wiring
- **D-04:** `ZatcaApiClient` extends `GovApiClient` (inheritance). Inherits retry with exponential backoff, cert auth loading from secret store, sandbox/prod switching, and audit logging. Override `getApiName()` and keep ZATCA-specific methods.
- **D-05:** `StorecoveAdapter` composes `GovApiRateLimiter` as a dependency (not extends GovApiClient). Storecove is a third-party ASP, not a government API — composition is semantically correct. Wrap Storecove API calls with rate limiter. Add audit logging for compliance trail.

### Testing Strategy
- **D-06:** Rely on TypeScript compiler for type safety (ctx.db is a typed Prisma client — type mismatches will surface at build). Run existing test suite for regression coverage. Add targeted tests only for regional routing logic (correct client selected per region). No new E2E tests needed for this refactor.

### Claude's Discretion
- Order of router migration (batch by domain or alphabetical)
- How to handle edge cases where services are called from non-tRPC contexts (webhooks, cron)
- GovApiClient constructor parameter design for ZatcaApiClient
- Rate limiter configuration values for StorecoveAdapter
- Whether to deprecate or remove legacy r2.ts after migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gov API framework
- `packages/gov-api/src/client.ts` — GovApiClient abstract base class with retry, cert auth, audit
- `packages/gov-api/src/rate-limiter.ts` — GovApiRateLimiter implementation
- `packages/gov-api/src/audit-logger.ts` — GovApiAuditLogger implementation
- `packages/gov-api/src/index.ts` — Package exports

### Regional infrastructure
- `packages/api/src/middleware/tenant.ts` — Tenant middleware setting ctx.db with regional Prisma client
- `packages/api/src/services/regional-storage.ts` — Regional R2 bucket selection (tests exist)
- `packages/api/src/services/r2.ts` — Legacy storage service (to be replaced in document router)
- `packages/db/` — Prisma client with getRegionalClient(), createTenantClientFrom()

### ZATCA/Peppol clients to wire
- `packages/einvoice/src/profiles/zatca/api-client.ts` — ZatcaApiClient (needs to extend GovApiClient)
- `packages/einvoice/src/asp/storecove/adapter.ts` — StorecoveAdapter (needs GovApiRateLimiter composition)
- `packages/api/src/services/zatca-submission.ts` — Uses ZatcaApiClient, imports prisma directly
- `packages/api/src/services/zatca-onboarding.ts` — ZATCA onboarding service

### All routers to migrate
- `packages/api/src/routers/*.ts` — 43 router files importing prisma directly

### Prior phase context
- `.planning/phases/52-multi-region-infrastructure/52-CONTEXT.md` — D-01 through D-04: regional DB, R2, GovApiClient

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GovApiClient` abstract base class — fully implemented with retry, cert auth, sandbox/prod, audit hooks
- `GovApiRateLimiter` — ready to compose into StorecoveAdapter
- `GovApiAuditLogger` — ready for compliance trail on ASP calls
- Tenant middleware — already sets `ctx.db` with correct regional Prisma client
- `regional-storage.ts` — already handles regional R2 bucket selection
- `getRegionalClient()` from `@contractor-ops/db` — resolves region to Prisma client

### Established Patterns
- `ctx.db` is already used in tenant middleware — routers just need to switch from `prisma` to `ctx.db`
- AsyncLocalStorage-based tenant scoping — region added alongside orgId in the store
- Service dependency injection — some services already accept parameters, pattern to follow

### Integration Points
- Every router in `packages/api/src/routers/` — replace `prisma` import with `ctx.db`
- Document router — switch from `r2.ts` to `regional-storage.ts`
- ZatcaApiClient — extend GovApiClient
- StorecoveAdapter — compose GovApiRateLimiter
- Webhook/cron handlers — may need fallback to global prisma when no tRPC context

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-regional-routing-adoption-gov-api-wiring*
*Context gathered: 2026-04-12*
