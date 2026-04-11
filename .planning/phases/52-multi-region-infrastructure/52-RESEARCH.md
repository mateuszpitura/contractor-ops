# Phase 52: Multi-Region Infrastructure — Research

**Researched:** 2026-04-11
**Confidence:** HIGH (codebase patterns verified, infra documented)

## 1. Current Architecture Snapshot

### Database Layer
- **ORM:** Prisma with `@prisma/adapter-neon` (PrismaNeon adapter) [VERIFIED: packages/db/src/client.ts]
- **Connection:** Single `DATABASE_URL` env var, single `PrismaClient` singleton cached on globalThis [VERIFIED: packages/db/src/client.ts]
- **Tenant isolation:** `AsyncLocalStorage<TenantContext>` in `packages/db/src/tenant.ts` — stores `organizationId`, auto-injects into all Prisma queries via `$extends` hook [VERIFIED: packages/db/src/tenant.ts]
- **Middleware chain:** `authedProcedure` -> `tenantMiddleware` (wraps handler in `tenantStore.run()`) -> `tenantProcedure` [VERIFIED: packages/api/src/middleware/tenant.ts]
- **Extensions applied:** `withSoftDelete(withTenantScope(prisma))` via `createTenantClient()` [VERIFIED: packages/db/src/index.ts]
- **Organization model:** No `region` or `dataResidency` field currently exists. Has `countryCode`, `defaultCurrency`, `timezone`, `language` [VERIFIED: packages/db/prisma/schema/organization.prisma]

### File Storage Layer
- **Provider:** Cloudflare R2 via `@aws-sdk/client-s3` [VERIFIED: packages/api/src/services/r2.ts]
- **Config:** Single bucket via `R2_BUCKET_NAME` env var (default: `contractor-ops-documents`) [VERIFIED: packages/validators/src/env.ts]
- **Key format:** `orgs/{orgId}/documents/{docId}.{ext}` [VERIFIED: packages/api/src/services/r2.ts]
- **Operations:** presigned upload/download URLs, head, delete — all use singleton `r2Client` and single bucket [VERIFIED: packages/api/src/services/r2.ts]
- **Consumers:** document router, portal router, settings router, OCR extraction, e-sign orchestrator [VERIFIED: grep results]

### Government API Patterns
- **KSeF API client:** `KsefApiClient` in `packages/einvoice/src/profiles/ksef/api-client.ts` — has `fetchWithRetry` method, sandbox/prod URL switching via constructor `environment` param, RSA-OAEP auth [VERIFIED: packages/einvoice/src/profiles/ksef/api-client.ts]
- **E-invoice profile interface:** `EInvoiceProfile` in `packages/einvoice/src/types/profile.ts` — profiles implement generate/parse/validate/getComplianceStatus [VERIFIED: packages/einvoice/src/types/profile.ts]
- **Secrets:** `@contractor-ops/secrets` package with `CachedStore` (in-memory LRU decorator over `SecretStore` interface) [VERIFIED: packages/secrets/src/cached-store.ts]
- **Audit logging:** `IntegrationSyncLog` model with direction, syncType, status, timestamps [VERIFIED: packages/api/src/services/ksef-sync-orchestrator.ts]
- **Caching:** Upstash Redis via `@upstash/redis` with singleflight pattern [VERIFIED: packages/api/src/services/cache.ts]

## 2. Multi-Region Database Routing

### Approach: Regional Prisma Client Pool

**Pattern:** Extend the existing `TenantContext` to include `region`, then select the correct pre-initialized `PrismaClient` from a region-keyed pool.

**Implementation strategy:**

1. **Organization schema change:** Add `dataRegion` field (enum: `EU`, `ME`) to the Organization model. Default `EU` for existing orgs. Set during org creation based on country selection.

2. **Regional client registry:** Create `packages/db/src/region.ts`:
   - `RegionConfig`: maps region key -> Neon connection string env var
   - `createRegionalClient(region)`: creates a PrismaClient with PrismaNeon adapter for that region's connection string
   - `getRegionalClient(region)`: returns from cache or creates
   - Clients cached on globalThis like the existing singleton

3. **TenantContext extension:** Add `region: string` to `TenantContext` interface. The tenant middleware looks up the org's region and passes it into `tenantStore.run()`.

4. **Middleware change:** In `packages/api/src/middleware/tenant.ts`, after resolving `orgId`, fetch org's `dataRegion` from the **primary** (EU) database (since the Organization table itself stays in EU — it's the routing table). Then set the regional client in context.

5. **Migration orchestration:** Schema changes must apply to ALL regional Neon projects. Add a `db:push:all` script that iterates over configured regions and runs `prisma db push` against each.

**Key decisions:**
- Organization table stays in the primary (EU) region — it's the routing lookup table [ASSUMED: follows standard multi-region routing pattern]
- Regional clients are pre-warmed at server start, not created per-request [ASSUMED: Neon serverless connections are stateless but client initialization has overhead]
- Each region has its own `DATABASE_URL_*` env var (e.g., `DATABASE_URL_EU`, `DATABASE_URL_ME`) [ASSUMED]

**Neon specifics:**
- Neon serverless driver (`@neondatabase/serverless`) works with any Neon project, just needs a different connection string [VERIFIED: existing adapter-neon usage in client.ts]
- Frankfurt (aws-eu-central-1) is the closest Neon region to the Middle East [CITED: STATE.md decision]
- No connection pooling concern — PrismaNeon uses HTTP, not persistent connections [ASSUMED: Neon serverless driver uses HTTP fetch]

### Schema Migration Strategy

All Prisma schema files are shared across regions — the schema is identical. Migrations run against each regional project sequentially:

```
for region in EU ME; do
  DATABASE_URL=$DATABASE_URL_{region} npx prisma db push
done
```

This can be a turbo script or a custom Node.js script in `packages/db/scripts/`.

## 3. Regional R2 File Storage

### Approach: Bucket-per-Region with Service Abstraction

**Pattern:** Replace the singleton `r2Client` with a region-aware storage service that selects the correct bucket based on the org's data region.

**Implementation strategy:**

1. **Env vars per region:** `R2_BUCKET_NAME_EU`, `R2_BUCKET_NAME_ME` (plus separate credentials if buckets are in different CF accounts — but R2 is region-free, so credentials can be shared)

2. **Storage service abstraction:** Create `packages/api/src/services/regional-storage.ts`:
   - `getRegionalBucket(region)`: returns the correct bucket name
   - Wrap all existing R2 functions to accept an optional `region` param
   - When called from tenant context, auto-resolve region from `tenantStore`
   - Export drop-in replacements for `createPresignedUploadUrl`, `createPresignedDownloadUrl`, etc.

3. **Migration path:** Existing `r2.ts` functions continue working with the EU bucket (backward compatible). New regional functions are used in new code paths.

**Cloudflare R2 specifics:**
- R2 buckets are not physically region-locked by default — Cloudflare distributes globally [ASSUMED: R2 documentation states single global namespace]
- For data residency, R2 supports "jurisdiction" hints (EU, FedRAMP) [ASSUMED: based on CF docs]
- R2 uses the same S3-compatible API regardless of jurisdiction — only the bucket name changes [VERIFIED: existing r2.ts uses standard S3Client]
- Storage key format (`orgs/{orgId}/documents/{docId}.{ext}`) works across buckets — no change needed [VERIFIED: packages/api/src/services/r2.ts]

## 4. Government API Framework

### Approach: Abstract Base Class in `packages/gov-api`

**Pattern:** Extract the common concerns from KSeF's `fetchWithRetry`, Peppol's ASP adapter, and future integrations into a reusable `GovApiClient` base class.

**Shared concerns (from CONTEXT.md D-04):**
1. **Certificate auth loading** — from Infisical/Doppler via `@contractor-ops/secrets`
2. **HTTP retry with exponential backoff** — already partially in KSeF client's `fetchWithRetry`
3. **Rate limiting per API** — Redis-based (Upstash) with configurable limits per API profile
4. **Sandbox/prod URL switching** — already in KSeF client constructor
5. **Request/response audit logging** — extend `IntegrationSyncLog` or add dedicated `GovApiAuditLog`

**Implementation strategy:**

1. **New package:** `packages/gov-api` with:
   - `GovApiClient` abstract base class
   - `GovApiConfig` interface: baseUrls (sandbox/prod), rateLimits, retryConfig, certPath
   - `GovApiAuditLogger` — writes request/response pairs to audit log
   - `GovApiRateLimiter` — Upstash Redis-based sliding window

2. **Base class methods:**
   - `protected fetch(path, options)` — wraps native fetch with retry, rate limiting, audit logging
   - `protected loadCertificate(secretPath)` — loads cert from secrets store
   - `abstract getBaseUrl(environment)` — profile provides URLs
   - `abstract getApiName()` — for rate limit keys and audit log identification

3. **Profile integration:**
   - KSeF: refactor `KsefApiClient.fetchWithRetry` to use `GovApiClient.fetch`
   - ZATCA: will extend `GovApiClient` for Fatoora Portal API
   - Peppol: will extend `GovApiClient` for ASP adapter communication

**Rate limiter design:**
- Sliding window using Upstash Redis `@upstash/ratelimit` package [ASSUMED: popular Upstash pattern]
- Configurable per-API: KSeF allows ~100 req/min, ZATCA has different limits
- Graceful degradation: if Redis unavailable, fall back to in-memory token bucket [ASSUMED: follows existing cache.ts pattern]

**Audit logging:**
- New `GovApiAuditLog` Prisma model: organizationId, apiName, endpoint, method, requestHash, responseStatus, responseTimeMs, errorMessage, createdAt
- Rotated/archived by retention policy (from PDPL Phase 51 consent records pattern) [ASSUMED]

## 5. Validation Architecture

### Test Strategy

| Component | Test Type | What to Verify |
|-----------|-----------|----------------|
| Regional client pool | Unit | Correct client returned per region, caching works |
| Tenant middleware | Unit | Region resolved from org, correct client in context |
| Regional R2 storage | Unit | Correct bucket selected per region |
| GovApiClient base | Unit | Retry logic, rate limiting, audit logging |
| Migration script | Integration | Schema applied to all regions |
| End-to-end routing | Integration | Request from ME org hits ME database |

### Key Risks

1. **Schema drift between regions:** If a migration fails on one region, schemas diverge. Mitigation: migration script must be atomic (all-or-none), with rollback on partial failure.

2. **Cross-region queries:** Some operations (e.g., super-admin reports) may need data from all regions. Pattern: explicit cross-region query helper, never implicit.

3. **Org routing table availability:** If the EU (primary) database is down, region resolution fails for all regions. Mitigation: cache org->region mapping in Redis with TTL.

4. **R2 bucket data isolation:** Must ensure storage key generation always uses the correct regional bucket. Bugs here cause data residency violations. Mitigation: storage service should have a test that verifies bucket selection per region.

## 6. Dependencies & Packages

| Package | Purpose | Version | Status |
|---------|---------|---------|--------|
| `@prisma/adapter-neon` | Neon serverless adapter | (existing) | Already in use [VERIFIED] |
| `@aws-sdk/client-s3` | R2/S3 compatible storage | (existing) | Already in use [VERIFIED] |
| `@upstash/ratelimit` | API rate limiting | latest | New dependency [ASSUMED: well-maintained, from Upstash ecosystem] |
| `@contractor-ops/secrets` | Certificate loading | (existing) | Already in use [VERIFIED] |
| `@upstash/redis` | Rate limiter backing store | (existing) | Already in use [VERIFIED] |

No new major dependencies required. `@upstash/ratelimit` is the only new addition and comes from the already-trusted Upstash ecosystem.

## 7. File Impact Map

| File/Pattern | Change Type | Description |
|-------------|-------------|-------------|
| `packages/db/prisma/schema/organization.prisma` | Modify | Add `dataRegion` enum + field |
| `packages/db/src/tenant.ts` | Modify | Extend `TenantContext` with region |
| `packages/db/src/client.ts` | Modify | Extract client creation for reuse |
| `packages/db/src/region.ts` | New | Regional client registry |
| `packages/db/src/index.ts` | Modify | Export regional client functions |
| `packages/api/src/middleware/tenant.ts` | Modify | Resolve org region, select regional client |
| `packages/api/src/services/r2.ts` | Modify | Add region-aware bucket selection |
| `packages/api/src/services/regional-storage.ts` | New | Regional storage service wrapper |
| `packages/gov-api/` | New package | Government API framework |
| `packages/gov-api/src/client.ts` | New | GovApiClient base class |
| `packages/gov-api/src/rate-limiter.ts` | New | Upstash-based rate limiter |
| `packages/gov-api/src/audit-logger.ts` | New | Request/response audit logging |
| `packages/gov-api/src/types.ts` | New | Config interfaces |
| `packages/db/prisma/schema/gov-api.prisma` | New | GovApiAuditLog model |
| `packages/validators/src/env.ts` | Modify | Add regional env var schemas |
| `.env.example` | Modify | Add regional DB/R2 env vars |

## RESEARCH COMPLETE
