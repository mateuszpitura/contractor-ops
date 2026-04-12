---
status: issues_found
phase: 52
depth: standard
files_reviewed: 16
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
---

# Code Review: Phase 52

## Summary

The multi-region infrastructure is well-structured overall — tenant isolation via AsyncLocalStorage is solid, and region routing is clean. However, two critical issues exist: the R2 client is built with un-validated credentials that will silently produce broken clients, and the `GovApiAuditLogger` bypasses Prisma's type system entirely with an unsafe cast that can mask model renames. Several warnings around certificate caching, rate-limiter key collision, and the tenant middleware's soft failure on missing orgs also need attention.

## Findings

### CR-001: R2 client credentials are never validated — silent broken client at runtime
**Severity:** critical
**File:** `packages/api/src/services/r2.ts`
**Line:** 22–31
**Issue:** `createR2Client()` reads `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` with non-null assertions (`!`). If any of these env vars is absent the S3Client is constructed with `undefined` values and will produce cryptic auth errors on the first actual request rather than failing fast at startup. The env validator in `packages/validators/src/env.ts` validates these fields, but `createR2Client` is also callable from outside the validated environment (tests, scripts, Edge workers) where no such guarantee exists.
**Fix:** Guard at construction time: throw a descriptive error if any required credential is missing before constructing the `S3Client`. Remove the `!` assertions and replace with explicit checks.

```ts
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
if (!accountId || !accessKeyId || !secretAccessKey) {
  throw new Error("R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) must be set");
}
```

---

### CR-002: GovApiAuditLogger uses an unsafe `as unknown as` cast to access `govApiAuditLog`
**Severity:** critical
**File:** `packages/gov-api/src/audit-logger.ts`
**Line:** 27–34
**Issue:** The logger casts `this.prisma` to an inline structural type to access `govApiAuditLog.create`. This completely bypasses Prisma's generated type system. If the model is renamed, the field is removed from the schema, or a generated client regeneration fails, this call silently resolves to `undefined` at runtime and the `try/catch` swallows the error — leaving zero audit trail with no observable failure. The error message `[GovApiAuditLogger] Failed to write audit log: TypeError: this.prisma.govApiAuditLog.create is not a function` may appear, but only in logs that operators may miss.
**Fix:** Import a typed `PrismaClient` that actually includes `govApiAuditLog` (i.e., the fully-generated client from `@contractor-ops/db`), and access the model directly without a cast. If multiple regional clients must be supported, accept `{ govApiAuditLog: { create: ... } }` as a typed interface parameter.

---

### WR-001: Tenant middleware silently defaults to EU region when org is not found
**Severity:** warning
**File:** `packages/api/src/middleware/tenant.ts`
**Line:** 40
**Issue:** `const region = org?.dataRegion ?? "EU"` silently falls back to EU if the `findUnique` returns `null` (org deleted, wrong DB, wrong orgId). This means a session referencing a deleted or inaccessible org will have its queries silently routed to the EU regional database as if the org existed — potentially exposing EU tenant data to an unauthorized actor whose org has been archived.
**Fix:** Throw a `TRPCError({ code: "NOT_FOUND" })` if `org` is null rather than defaulting to a region.

```ts
if (!org) {
  throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
}
const region = org.dataRegion;
```

---

### WR-002: Certificate is cached on the GovApiClient instance — rotation requires process restart
**Severity:** warning
**File:** `packages/gov-api/src/client.ts`
**Line:** 73
**Issue:** `if (this.certificate) return this.certificate;` means once a certificate is loaded it is never refreshed for the lifetime of the process. Government API certificates have finite validity and are rotated (ZATCA certificates expire). If a certificate is rotated in the secret store, the running process will continue using the old (now-expired) cert until it restarts.
**Fix:** Add a TTL-based cache (e.g., re-fetch after 1 hour) or accept a `force?: boolean` parameter to bypass the cache. At minimum, document the limitation prominently so operators know to restart when rotating certs.

---

### WR-003: Rate-limiter key double-prefixes the API name
**Severity:** warning
**File:** `packages/gov-api/src/rate-limiter.ts`
**Line:** 59
**Issue:** The Ratelimit is initialised with `prefix: \`gov-api:${this.apiName}\`` (line 36) and then `limit()` is called with `\`${this.apiName}:${identifier}\`` (line 59). The final Redis key becomes `gov-api:<apiName>:<apiName>:<orgId>`. This is not harmful in isolation but wastes key space and will break any tooling that inspects Redis keys by convention. It also means rate-limit counters are stored under an unexpected key pattern if operators try to monitor or reset them manually.
**Fix:** Either remove the `apiName` from the `limit()` call (since it is already in the prefix):
```ts
const result = await this.limiter.limit(identifier);
```
or remove it from the prefix and keep it only in the `limit()` key — pick one canonical location.

---

### WR-004: `withTenantScope` does not scope `update` and `upsert` on a single record by ID — tenant check can be bypassed
**Severity:** warning
**File:** `packages/db/src/tenant.ts`
**Line:** 107–122
**Issue:** For `update`, the code adds `organizationId` to the `where` clause. However, Prisma's `update` on a model with a compound unique or a plain `id` field will still succeed if the caller passes `{ where: { id: "some-id" } }` — the middleware adds `organizationId` to the where, which Prisma evaluates as `AND`. This is correct behavior. However, for `updateMany` and `deleteMany`, if a caller passes an empty `where: {}`, the middleware produces `where: { organizationId }` which scopes correctly. The gap is in `upsert`: if the calling code passes a `where` that includes a unique field from a *different* org (e.g., a known invoice number), the upsert's create path will inject the correct `organizationId`, but the `where` clause may match another org's record depending on database uniqueness constraints. This is a latent risk rather than an immediate exploit, but it warrants a review of upsert callers to ensure unique fields are always org-scoped.
**Fix:** Document this limitation clearly in the `withTenantScope` JSDoc. For critical models, prefer `create`+`findFirst` over `upsert` when the unique key is not `(organizationId, field)`.

---

### WR-005: `preWarmRegionalClients` silently swallows all errors including unexpected ones
**Severity:** warning
**File:** `packages/db/src/region.ts`
**Line:** 69–77
**Issue:** The bare `catch { /* skip */ }` catches every possible error, not just the expected "env var not set" case. If `createPrismaClientForUrl` throws for an unexpected reason (malformed URL, missing native adapter dependency, etc.), startup continues without any indication of the problem. The first real request will then hit the un-cached client path and fail with a less informative error.
**Fix:** Check specifically for the expected "env var not set" error, or at minimum log unexpected errors:
```ts
} catch (err) {
  if (err instanceof Error && err.message.includes("is not set")) continue;
  console.warn(`[preWarmRegionalClients] Unexpected error for region ${region}:`, err);
}
```

---

### WR-006: `push-all-regions.ts` logs the region env var name but not the target host — unhelpful in CI
**Severity:** warning
**File:** `packages/db/scripts/push-all-regions.ts`
**Line:** 47
**Issue:** `console.log(\`[${region}] Pushing schema to ${envVar}...\`)` prints only the env var name, not the connection host. When this runs in CI, operators cannot confirm which database instance was actually targeted, making post-deploy audits harder. Connection strings contain passwords, but the hostname is safe to log.
**Fix:** Extract and log the hostname from the URL:
```ts
const host = new URL(url).host;
console.log(`[${region}] Pushing schema to ${host} (${envVar})...`);
```

---

### IR-001: `generateStorageKey` in r2.ts does not validate that `orgId` and `docId` are safe path components
**Severity:** info
**File:** `packages/api/src/services/r2.ts`
**Line:** 105–109
**Issue:** The function sanitizes the file extension but constructs the key as `` `orgs/${orgId}/documents/${docId}${ext}` `` without validating `orgId` or `docId`. These values come from the database (Prisma cuid), so in practice they are safe. However, if `orgId` or `docId` were ever constructed from user input (e.g., a future API accepting them as parameters), a value like `../../admin` could traverse the key namespace. This is a defense-in-depth gap.
**Fix:** Add a cuid/uuid format assertion for `orgId` and `docId` at the top of the function, or document the assumption that callers must pass database-sourced IDs only.

---

### IR-002: `GovApiAuditEntry.requestBodyHash` is never populated by `GovApiClient.fetch()`
**Severity:** info
**File:** `packages/gov-api/src/client.ts`
**Line:** 130–138
**Issue:** The `GovApiAuditEntry` type declares `requestBodyHash?: string` and the JSDoc says "SHA-256 hash of the request body (never the raw body)". But `GovApiClient.fetch()` emits the audit entry without ever computing or passing a `requestBodyHash`. POST/PUT requests sent through the base `fetch` method will always produce audit entries with `requestBodyHash: undefined`, which reduces the forensic value of the audit log for compliance scenarios.
**Fix:** If the request body is a string or `ReadableStream`, compute `crypto.subtle.digest("SHA-256", ...)` before issuing the request and pass it to `emitAuditEntry`. If this is intentionally deferred to subclasses, add a comment clarifying the expectation.

---

### IR-003: `serverEnvSchema` in env.ts marks `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as absent — rate limiter silently operates in allow-all mode in production if not set
**Severity:** info
**File:** `packages/validators/src/env.ts` / `packages/gov-api/src/rate-limiter.ts`
**Line:** env.ts (full file), rate-limiter.ts line 28–33
**Issue:** The Upstash Redis credentials used by `GovApiRateLimiter` (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are not present in `serverEnvSchema`. If they are not set in a production deployment, the rate limiter silently operates in allow-all mode (by design), but there is no startup warning or env validation failure. A misconfigured production environment will silently have no rate limiting on government API calls.
**Fix:** Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `serverEnvSchema` (as `.optional()` if dev-optional), or add a startup check in `GovApiRateLimiter.initLimiter()` that logs a prominent warning when Redis is not configured in a production (`NODE_ENV === "production"`) environment.
