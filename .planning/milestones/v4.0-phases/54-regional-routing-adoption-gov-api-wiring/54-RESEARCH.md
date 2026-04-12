# Phase 54: Regional Routing Adoption & Gov API Wiring — Research

## RESEARCH COMPLETE

**Researched:** 2026-04-12
**Phase:** 54 — Regional Routing Adoption & Gov API Wiring

---

## 1. Current State Analysis

### Router Migration Scope

All **43 routers** in `packages/api/src/routers/` import `prisma` directly from `@contractor-ops/db` and use it for database operations. None currently use `ctx.db` (the regional Prisma client set by tenant middleware).

The tenant middleware (`packages/api/src/middleware/tenant.ts`) already:
- Resolves org's `dataRegion` from the primary database
- Gets the regional Prisma client via `getRegionalClient(region)`
- Applies tenant scope + soft-delete extensions via `createTenantClientFrom()`
- Sets `ctx.db` as the scoped regional client

**Every router already uses `tenantProcedure`** (which chains the tenant middleware), so `ctx.db` is already available in every handler's `ctx`. The migration is purely mechanical: replace `prisma.X.Y()` calls with `ctx.db.X.Y()` calls, and remove the `prisma` import.

### Storage Migration Scope

**4 files** import from legacy `r2.ts`:
1. `document.ts` — Uses `createPresignedDownloadUrl`, `createPresignedUploadUrl`, `deleteObject`, `generateStorageKey`, `headObject`
2. `portal.ts` — Uses some R2 functions
3. `gdpr.ts` — Uses `deleteObject`
4. `settings.ts` — Uses `createPresignedUploadUrl`

The `regional-storage.ts` module provides region-aware equivalents: `createRegionalPresignedUploadUrl`, `createRegionalPresignedDownloadUrl`, `headRegionalObject`, `deleteRegionalObject`. It auto-resolves region from the tenant context.

**Note:** `generateStorageKey()` lives in `r2.ts` and has no regional equivalent. It is a pure utility (no bucket dependency) and can remain imported from `r2.ts` or be extracted.

### Gov API Wiring Scope

**ZatcaApiClient** (`packages/einvoice/src/profiles/zatca/api-client.ts`):
- Standalone class with its own `fetch()` implementation
- Uses Basic auth (BST:secret), not the GovApiClient cert auth pattern
- Has its own retry classification (`classifyError`) but no retry loop
- No audit logging
- **Decision D-04:** Extend `GovApiClient` — inherit retry with backoff, audit logging. Override `getApiName()` → `"zatca"`. Adapt auth to use ZATCA's Basic auth scheme instead of GovApiClient's Bearer cert pattern.

**StorecoveAdapter** (`packages/einvoice/src/asp/storecove/adapter.ts`):
- Implements `ASPAdapter` interface
- Delegates HTTP to `StorecoveClient` (separate class)
- No rate limiting, no audit logging
- **Decision D-05:** Compose `GovApiRateLimiter` as a dependency (not extend GovApiClient). Wrap API calls with rate limit check. Add `GovApiAuditLogger` for compliance trail.

### Service Dependencies

**33 service files** import `prisma` directly. Per D-02 from CONTEXT.md, services should be refactored to accept a Prisma client as parameter, injected from the calling router. Key services to address:
- `zatca-submission.ts` — Uses prisma for ZATCA submission records
- `zatca-onboarding.ts` — Uses prisma for onboarding state
- `peppol-orchestrator.ts` — Uses prisma for Peppol operations
- `consent-record.ts` — Uses prisma for consent records

**Scope control:** The CONTEXT.md D-02 says services should be refactored, but the success criteria only explicitly mention "routers and services" for criterion 1. Given this is a gap closure phase, we should focus on services that are directly called by v4.0 routers (ZATCA, Peppol, consent, tax) rather than all 33 services.

---

## 2. Migration Strategy

### Router Migration Pattern

Each router follows the same pattern:
```typescript
// Before:
import { prisma } from "@contractor-ops/db";
// ... in handler:
const result = await prisma.contractor.findMany({ ... });

// After:
// Remove: import { prisma } from "@contractor-ops/db";
// ... in handler:
const result = await ctx.db.contractor.findMany({ ... });
```

**Edge case:** Some routers import `prisma` alongside other DB exports (e.g., `Prisma` types). The `Prisma` type import must be preserved — only the runtime `prisma` instance import should be removed.

### Batching Strategy

43 routers can be batched by domain for manageable plan sizes:
- **Wave 1:** Core routers (contractor, contract, document, invoice, payment, approval) — 6 routers + document storage migration
- **Wave 2:** Integration routers (ZATCA, Peppol, KSeF, e-invoice, tax, consent, exchange-rate) + gov API wiring — 8 routers + ZATCA/Storecove refactoring
- **Wave 3:** Supporting routers (remaining 29) — bulk mechanical migration

### ZatcaApiClient → GovApiClient Migration

Key challenge: ZATCA uses Basic auth (`BST:secret`), while `GovApiClient.fetch()` sets `Authorization: Bearer ${certificate}`. Solutions:
1. Override `fetch()` in the ZATCA subclass to set Basic auth header
2. Make `GovApiClient.fetch()` more flexible (e.g., `getAuthHeader()` abstract method)
3. Don't load certificate through `loadCertificate()` — set auth header manually in overridden methods

**Recommendation:** Option 1 — override the headers in each ZATCA-specific method since ZATCA's auth is fundamentally different (per-request Basic auth vs certificate-based Bearer). The `GovApiClient.fetch()` method adds Bearer auth only if `this.certificate` is loaded, so if we never call `loadCertificate()`, it won't interfere.

### StorecoveAdapter Rate Limiting

The `StorecoveClient` handles all HTTP directly. Rate limiting can wrap the adapter's public methods:
```typescript
constructor(config: StorecoveConfig, rateLimiter?: GovApiRateLimiter) {
  this.rateLimiter = rateLimiter;
}

async transmitInvoice(params) {
  if (this.rateLimiter) {
    const limit = await this.rateLimiter.checkLimit(orgId);
    if (!limit.allowed) throw new RateLimitError(...);
  }
  // ... existing logic
}
```

---

## 3. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Type mismatch between `prisma` and `ctx.db` | Build failure | Both are PrismaClient with same extensions — type-compatible |
| `scanAndUpdate` in document.ts uses `prisma` outside handler context | Runtime failure | Accept prisma parameter, inject from handler |
| `generateStorageKey` only in r2.ts | Import break if r2.ts removed | Keep r2.ts for utilities, only replace storage operations |
| ZatcaApiClient auth model differs from GovApiClient | Incorrect auth | Don't call loadCertificate(), manage auth headers manually in overridden fetch |
| Service functions called from non-tRPC contexts (QStash handlers) | No ctx.db available | Keep global prisma as fallback parameter default |

---

## 4. Validation Architecture

### Boundary Validation
- **Type safety:** TypeScript compiler verifies `ctx.db` usage matches PrismaClient interface
- **Build verification:** `turbo build` must pass with zero `prisma` imports in routers
- **Import verification:** `grep -r "from.*@contractor-ops/db" packages/api/src/routers/ | grep "prisma"` must return empty

### Integration Points
- Tenant middleware → ctx.db → router handlers
- Regional-storage.ts → tenant context → R2 bucket selection
- ZatcaApiClient → GovApiClient → retry + audit logging
- StorecoveAdapter → GovApiRateLimiter → rate limit checks

---

*Phase: 54-regional-routing-adoption-gov-api-wiring*
*Research completed: 2026-04-12*
