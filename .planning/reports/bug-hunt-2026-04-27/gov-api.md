# Bug-hunt: packages/gov-api — 2026-04-27

## Summary
- Files reviewed: 9 source files (~830 LOC of production code; tests skimmed for coverage signal)
- Findings: 0 CRITICAL, 6 HIGH, 8 MEDIUM, 5 LOW
- Top 3 risks
  1. OAuth token POST in HMRC client bypasses the base-class fetch — no timeout, no abort, no retry. A hung HMRC `/oauth/token` will lock up every VAT lookup indefinitely.
  2. Retry loop in `GovApiClient.fetch` returns the last 5xx response even when the most recent attempt threw a network/timeout error, masking transient failures as a "real" 500 to callers and skewing soft-fail logic.
  3. HMRC token cache + 401-refresh flow has no single-flight protection; concurrent lookups will issue parallel `/oauth/token` POSTs (token-refresh stampede), and concurrent 401s race on `accessToken = null`.

## Findings

### [HIGH] OAuth token POST has no timeout, abort, or retry
**File:** `packages/gov-api/src/clients/hmrc-vat-client.ts:163-168`
**What:** `refreshAccessToken()` calls `globalThis.fetch(url, ...)` directly, skipping the base class `fetch()` helper. There is no `AbortController`, no `signal`, no retry, and no audit entry.
**Why it's a bug/risk:** HMRC's OAuth endpoint is the most rate-limited and most-likely-to-hang dependency in the entire flow. If it stalls, *every* `checkVatNumber()` call awaits forever (every cached token eventually expires). It also produces no audit log entry on success or failure, so operators cannot see token-issuance latency or 5xx rates from HMRC's IDP.
**Suggested fix:** Build an `AbortController` with the same `config.timeoutMs` cap and explicit `Accept: application/json`; retry on 502/503/504 (but NOT 400/401, those mean bad credentials); emit an audit entry with `endpoint: '/oauth/token'` and a redacted body hash. Easiest path: route through `this.fetch()` with a flag that disables the bearer-Authorization auto-injection.

### [HIGH] Retry loop returns stale 5xx response when later attempt threw
**File:** `packages/gov-api/src/client.ts:189-211`
**What:** The loop tracks `lastResponse` (set on retryable 5xx) and `lastError` (set on thrown network/timeout) independently. After the loop, `if (lastResponse) return lastResponse` runs unconditionally — so if attempt 1 returned 503 (assigned to `lastResponse`), attempt 2 timed out (assigned to `lastError`), attempt 3 also timed out, the caller receives the original 503 Response and never learns that the network is now broken.
**Why it's a bug/risk:** Soft-fail branches in `ViesClient` (`response.status >= 500 → unavailable`) and `HmrcVatClient` (`!response.ok → throw`) react very differently to a 5xx vs a thrown timeout. Confusing the two breaks observability ("looks like upstream returned 500, must be VIES — actually our network is dead") and skews the orchestrator's stale-fallback decision (D-08).
**Suggested fix:** Track which condition was hit on the *most recent* attempt. If the last attempt threw, propagate `lastError`; only fall back to `lastResponse` when the last attempt actually returned a (retryable) response. Or simpler: clear `lastResponse = null` at the top of each iteration before retrying.

### [HIGH] HMRC token refresh has no single-flight / mutex
**File:** `packages/gov-api/src/clients/hmrc-vat-client.ts:142-147, 223-230`
**What:** `ensureAccessToken()` checks `accessToken.expiresAt > Date.now()` and falls through to `refreshAccessToken()` if expired. Concurrent callers all see the expired token and all issue parallel `/oauth/token` POSTs. The 401-recovery path at line 223 (`this.accessToken = null; await this.ensureAccessToken();`) is also racy: N concurrent 401s each null the token and each refresh.
**Why it's a bug/risk:** HMRC OAuth has its own quota; a stampede of refreshes on token expiry can itself trigger 429 throttling on the IDP and break every subsequent lookup. Also wastes the platform client_secret — each extra POST is an audit-able event on HMRC's side.
**Suggested fix:** Cache the in-flight refresh `Promise<string>` in a private field; if a refresh is already pending, await it instead of starting a new one. Reset the in-flight promise when it settles. Standard single-flight pattern (see `p-limit`/`async-mutex` or implement inline — ~10 lines).

### [HIGH] `response.json()` not guarded — non-JSON body crashes typed error path
**File:** `packages/gov-api/src/clients/vies-client.ts:185`, `packages/gov-api/src/clients/hmrc-vat-client.ts:175, 240`
**What:** `await response.json()` is called without try/catch. The output is then handed to `safeParse` (VIES) or `parse` (HMRC). The `await` itself can throw `SyntaxError: Unexpected token <` when the upstream returns HTML (CloudFront error pages, gateway timeouts pages, HMRC platform maintenance HTML), regardless of the HTTP status.
**Why it's a bug/risk:** Government APIs commonly proxy through CDNs/load balancers that emit HTML error bodies on edge errors. The thrown `SyntaxError` is not a `ViesApiError`/`HmrcApiError`, so the orchestrator's typed-error handling path is bypassed and the user sees a generic 500.
**Suggested fix:** Wrap with try/catch and convert to the typed error, or read `response.text()` first and `JSON.parse` inside a try/catch — that also lets you log the first 200 chars of an unexpected body for diagnosis (without leaking secrets).

### [HIGH] HMRC schema parse throws raw ZodError, not `HmrcApiError`
**File:** `packages/gov-api/src/clients/hmrc-vat-client.ts:175, 240`
**What:** `hmrcOauthTokenSchema.parse(...)` and `hmrcVatLookupResponseSchema.parse(...)` use `.parse` (throws ZodError). VIES uses `.safeParse` for the same boundary. Both should be uniform.
**Why it's a bug/risk:** Schema drift on HMRC's side (a new optional field, a renamed key, change of `token_type` casing) leaks a Zod stack trace up the stack instead of producing a domain error with `httpStatus`. Callers that special-case `HmrcApiError` won't catch it.
**Suggested fix:** Switch to `safeParse` and throw `new HmrcApiError('HMRC response schema violation', 502, parsed.error.message)` (or hash the issues). Same fix already lives in VIES — copy it.

### [HIGH] Internal rate-limiter rejection mislabelled as upstream 429
**File:** `packages/gov-api/src/clients/vies-client.ts:148-150`, `packages/gov-api/src/clients/hmrc-vat-client.ts:211-213`
**What:** When `rateLimiter.checkLimit()` denies a request, the client throws `new ViesApiError('VIES rate limit exceeded', 429)` / `new HmrcApiError('HMRC rate limit exceeded', 429)`. The 429 makes it look like the upstream gov API throttled us.
**Why it's a bug/risk:** Distinguishing "we self-throttled" from "gov throttled us" matters: the first is a tuning issue (raise the bucket, the API is fine), the second is a circuit-breaker / backoff signal. Mixing them sends false alarms to the gov-API health dashboard. It also exposes our internal capacity to the orchestrator's retry logic.
**Suggested fix:** Use a distinct error code (e.g. `'INTERNAL_RATE_LIMIT_EXCEEDED'`) or a different exception class / `httpStatus: 503` or 0, and log structured metadata (`apiName`, `organizationId`, `remaining: 0`) so it's grep-able. Keep the message clearly self-attributed: `'gov-api self-throttle: vies bucket empty'`.

### [MEDIUM] No jitter on exponential backoff
**File:** `packages/gov-api/src/client.ts:122-124`
**What:** `retryDelay = min(baseDelayMs * 2^(attempt-1), maxDelayMs)` — pure deterministic exponential.
**Why it's a bug/risk:** When VIES returns 503 to many tenants at once (common during EU-wide MS_UNAVAILABLE windows), every caller retries at the same offset → thundering herd that prolongs the outage.
**Suggested fix:** Add full or "decorrelated" jitter: `Math.random() * min(baseDelayMs * 2^attempt, maxDelayMs)`. Standard AWS recommendation; one-line change.

### [MEDIUM] No audit entry emitted on thrown fetch errors (timeouts, DNS, TLS)
**File:** `packages/gov-api/src/client.ts:194-206`
**What:** `fetchOnce()` only calls `maybeAudit` after a successful `fetch()` resolution. If the request aborts (timeout) or rejects (network), no audit log is written for that attempt.
**Why it's a bug/risk:** Operators monitoring `GovApiAuditLog` see only successful round-trips. Hung/timeout attempts are invisible — exactly the failure mode that needs the most observability. Also breaks SLA tracking (you can't compute p99 latency or error rate from a log that omits errors).
**Suggested fix:** Catch in `fetchOnce`, emit an audit entry with `responseStatus: 0` (or 599) and `errorMessage: err.message`, then rethrow. Already have `errorMessage` field in `GovApiAuditEntry` — it's just unused.

### [MEDIUM] No total-deadline / circuit breaker — operations can take ~2 minutes
**File:** `packages/gov-api/src/client.ts:178-211`
**What:** Each attempt has its own `timeoutMs` (default 30 000). With `maxRetries=3`, total wall-clock can be `30s × 4 + (1+2+4)s backoff = ~127s` before throwing. There's no overall deadline parameter and no circuit breaker.
**Why it's a bug/risk:** A request handler holding a DB connection for 2 minutes during a VIES outage will saturate the connection pool. Government API outages cascade into our own SLO breach.
**Suggested fix:** Add a `deadlineMs` option and short-circuit when `Date.now() - startMs > deadlineMs`. Optionally add a per-API circuit breaker (consecutive failure threshold opens the circuit for ~30 s).

### [MEDIUM] Rate limiter swallows Redis errors silently
**File:** `packages/gov-api/src/rate-limiter.ts:65-72`
**What:** `catch {}` (empty catch) returns `allowed: true`. Fail-open is the right policy, but no `log.warn` / metric / counter records that Redis failed.
**Why it's a bug/risk:** Redis can be down for hours and operators won't notice — meanwhile every gov-api call passes through unthrottled, potentially burning HMRC quota / annoying VIES. Silent degradation is the worst kind.
**Suggested fix:** Inject a logger and `log.warn({ err, apiName, identifier }, 'gov-api rate limiter Redis check failed — failing open')`. Consider rate-limiting the warning itself (one per minute) so a Redis outage doesn't spam logs.

### [MEDIUM] Rate limiter env vars read at construction — order-sensitive
**File:** `packages/gov-api/src/rate-limiter.ts:27-40`
**What:** `initLimiter()` reads `process.env.UPSTASH_REDIS_REST_URL/TOKEN` once, in the constructor. If a client is instantiated before env is fully loaded (test setup, lambda cold-start with delayed config fetch), the limiter is permanently a no-op.
**Why it's a bug/risk:** Subtle: looks rate-limited locally, isn't in production. No telemetry to detect the silent disable.
**Suggested fix:** Either (a) lazy-init on first `checkLimit()` call, or (b) accept Redis URL/token as constructor args so the caller controls timing, or (c) log a structured `{ apiName, redisConfigured: false }` line at construction so this is observable.

### [MEDIUM] HMRC `Gov-Client-User-IDs` leaks internal organization ID
**File:** `packages/gov-api/src/clients/hmrc-vat-client.ts:258`
**What:** Header value is `os=contractor-ops;orgId=${organizationId}`, where `organizationId` is the internal Prisma org primary key.
**Why it's a bug/risk:** HMRC retains fraud-prevention headers; sending the raw internal ID creates a low-grade correlation channel between HMRC's logs and our DB. Also, if the ID format ever changes (UUID → ULID), the heuristic is brittle.
**Suggested fix:** Hash the `organizationId` (e.g. SHA-256 truncated to 16 hex chars, or HMAC with a fixed platform secret). Document the hashing scheme so it's stable across deploys.

### [MEDIUM] `Bearer ${certificate}` auto-injection is misleading
**File:** `packages/gov-api/src/client.ts:88-90`
**What:** `buildHeaders` injects `Authorization: Bearer ${certificate}` when a cert is loaded. Certificates aren't bearer tokens; for mTLS-style profiles this is the wrong header entirely (those need `agent` / `https.Agent` with `cert/key`).
**Why it's a bug/risk:** When ZATCA/Peppol clients are added (planned per file header), authors may assume "set certSecretPath → mTLS works" and ship a broken integration. The base class's "certificate" terminology blurs three different mechanisms (bearer token, mTLS cert, signed XML).
**Suggested fix:** Rename `certificate` → `bearerToken` (or split into two slots), and either remove the auto-inject (let subclasses decide) or document the constraint loudly. mTLS support requires `undici.Agent` injection, not header injection.

### [MEDIUM] `prisma as unknown as { govApiAuditLog: ... }` cast
**File:** `packages/gov-api/src/audit-logger.ts:30-36`
**What:** Bypasses Prisma's generated types. Either the `GovApiAuditLog` model isn't in the schema yet, or types weren't regenerated. The cast hides this.
**Why it's a bug/risk:** Field renames in the schema won't surface as type errors. A typo (`organisationId` vs `organizationId`) compiles. Brittle.
**Suggested fix:** Verify the model exists, regenerate Prisma types, drop the cast. If the model is intentionally not in schema yet, file a TODO with phase reference and hide behind a build-time flag.

### [LOW] `toError(err)` produces `[object Object]` for non-Error throws
**File:** `packages/gov-api/src/client.ts:159-161`
**What:** `String(err)` on a thrown object yields `[object Object]` losing all info.
**Why it's a bug/risk:** Debugging a thrown POJO from a future SDK becomes impossible.
**Suggested fix:** `new Error(typeof err === 'object' ? JSON.stringify(err) : String(err))`, or use `serialize-error`.

### [LOW] No structured logging on retry / error paths
**File:** `packages/gov-api/src/client.ts` (whole file)
**What:** No `log.info`/`log.warn` calls. Successful audit entries go to DB, but retries, timeouts, and 5xx fall-throughs produce no Pino events. No correlation ID is propagated.
**Why it's a bug/risk:** When a tenant reports "VIES check failed", operators have only the audit-log row (status 500) and no insight into how many retries fired or how long the attempt took.
**Suggested fix:** Inject a `Logger` (per the project's `@contractor-ops/logger` factory pattern) and emit `log.warn({ apiName, attempt, status, latencyMs })` on each retry; emit `log.info` on the final outcome with a `requestId` (UUID per `fetch()` call).

### [LOW] Inline duplicated VAT format checks (`isValidUstIdNrInline`, `isValidGbVatInline`)
**File:** `packages/gov-api/src/clients/vies-client.ts:39-58`, `packages/gov-api/src/clients/hmrc-vat-client.ts:48-62`
**What:** Both clients duplicate format-validation logic from `@contractor-ops/validators` (acknowledged in comments — "avoid a workspace dependency cycle").
**Why it's a bug/risk:** Two implementations will drift. If `isValidGbVat` in `validators` adds GD branch range support, the inline copy here won't get it. The MOD-11/MOD-97-55 maths are the kind of thing that's quietly wrong for years.
**Suggested fix:** Either break the cycle (extract pure format validators to a leaf package with no other deps), or add a regression test that re-runs the canonical validator's table-driven test cases against the inline copies. Today there's no cross-check.

### [LOW] Retries enabled for all methods including POST
**File:** `packages/gov-api/src/client.ts:189-207`
**What:** The retry policy retries on 500/502/503/429 regardless of HTTP method. Both VIES and HMRC lookups are GET (idempotent), but the base class is the contract for future profiles (Peppol "send invoice" is POST).
**Why it's a bug/risk:** A retried POST on 502 can produce duplicate state changes (a Peppol invoice submitted twice). Future-bug — not currently triggered, but the framework invites it.
**Suggested fix:** Either (a) skip retries for non-GET unless caller opts in (`{ retryNonIdempotent: true }`), or (b) require an idempotency key for POST/PUT and document the constraint.

### [LOW] `fetch()` total-attempt count off-by-one in error message
**File:** `packages/gov-api/src/client.ts:210`
**What:** Throws `Failed to fetch ${url} after ${retry.maxRetries + 1} attempts`. With `maxRetries=3`, says "after 4 attempts" — correct, but only when the loop ran the full count. If the `break` at line 205 fires early (`attempt >= retry.maxRetries` after a thrown error on the last attempt), the count is still accurate. Mostly fine, just confusing wording: "maxRetries" usually means "additional retries after the first try" but the message conflates total attempts with retries.
**Why it's a bug/risk:** Pure readability; will confuse the next reader.
**Suggested fix:** Reword to "Failed after N attempts (maxRetries=M)" or track the actual attempt counter.

## Files reviewed
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/index.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/client.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/rate-limiter.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/audit-logger.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/types.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/clients/index.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/clients/vies-client.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/clients/hmrc-vat-client.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/schemas/vies.schema.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/gov-api/src/schemas/hmrc-vat.schema.ts`
- Skimmed for coverage signal: `__tests__/client.test.ts`, `package.json`
