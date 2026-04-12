# Phase 54: Regional Routing Adoption & Gov API Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 54-regional-routing-adoption-gov-api-wiring
**Areas discussed:** Migration scope, Gov API wiring approach, Testing strategy

---

## Migration Scope

### Router migration breadth

| Option | Description | Selected |
|--------|-------------|----------|
| V4.0 routers only | Focus on zatca, peppol, einvoice, consent, tax, exchange-rate. Less risk, smaller diff. | |
| All routers | Migrate all 43 routers for consistency. Future-proofs everything. Higher risk. | ✓ |
| V4.0 + document router | V4.0 routers plus document router. Targeted scope. | |

**User's choice:** All routers
**Notes:** None

### Service refactoring approach

| Option | Description | Selected |
|--------|-------------|----------|
| Accept db parameter | Refactor service functions to accept Prisma client as parameter. Falls back to global prisma. Testable and region-aware. | ✓ |
| Read from AsyncLocalStorage | Services resolve regional client from tenantStore. No parameter changes but implicit dependency. | |
| You decide | Claude picks during planning | |

**User's choice:** Accept db parameter
**Notes:** None

---

## Gov API Wiring Approach

### ZatcaApiClient integration

| Option | Description | Selected |
|--------|-------------|----------|
| Extend GovApiClient | ZatcaApiClient extends GovApiClient. Inherits retry, cert auth, audit logging. Clean inheritance. | ✓ |
| Compose via dependency injection | Receives GovApiRateLimiter and GovApiAuditLogger as constructor args. Independent but manual wiring. | |
| You decide | Claude picks during planning | |

**User's choice:** Extend GovApiClient
**Notes:** None

### StorecoveAdapter rate limiting

| Option | Description | Selected |
|--------|-------------|----------|
| Compose GovApiRateLimiter | Use as dependency, not extends. Storecove is ASP, not government API. Wrap calls with rate limiter. | ✓ |
| Extend GovApiClient | Treat as government API. Simpler but semantically wrong. | |
| You decide | Claude picks during planning | |

**User's choice:** Compose GovApiRateLimiter
**Notes:** None

---

## Testing Strategy

### Verification approach

| Option | Description | Selected |
|--------|-------------|----------|
| Existing tests + type safety | TypeScript compiler catches type mismatches. Run existing suite. Add targeted regional routing tests only. | ✓ |
| Integration tests per router | Write tests for each migrated router. More coverage but significant effort. | |
| You decide | Claude picks during planning | |

**User's choice:** Existing tests + type safety
**Notes:** None

---

## Claude's Discretion

- Router migration ordering
- Non-tRPC context handling (webhooks, cron)
- GovApiClient constructor design for ZatcaApiClient
- Rate limiter configuration for StorecoveAdapter
- Legacy r2.ts deprecation/removal

## Deferred Ideas

None — discussion stayed within phase scope
