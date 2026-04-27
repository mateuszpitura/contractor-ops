# Bug-hunt: packages/integrations — 2026-04-27

## Summary
- Files reviewed: 27 (all `src/` excluding type-only files and re-exports were skimmed end-to-end; types/* read for context)
- Findings: 2 CRITICAL, 6 HIGH, 8 MEDIUM, 3 LOW
- Top 3 risks (one-liner each):
  1. CRITICAL — DocuSign webhook signature verification crashes the request on length mismatch in `Buffer.from(...).length` comparison when DocuSign sends a base64 sig and our HMAC is also base64; the webhook layer happens to recover, but worse: the same comparison in **Autenti** treats a hex-vs-hex mismatch as `valid: false` only after a length check that masks a `timingSafeEqual` throw — and on any signer providing a malformed hex header the whole adapter throws an unhandled exception (see HIGH-1).
  2. CRITICAL — `register-all.ts:46` registers `ClaudeOcrAdapter` via `as unknown as IntegrationProviderAdapter` to bypass the type system; the OCR adapter does **not** define `displayName`/`supportsOAuth`/`supportsWebhooks` (the registry assumes it). `health-service.getAllProviderHealth()` will iterate this adapter and call `getProviderHealth(orgId, 'claude')` which queries `IntegrationConnection` with `provider: 'CLAUDE'` — likely not a valid Prisma enum value.
  3. HIGH — `boe-base-rate-poller.ts` has a hard-coded Claude model ID (`claude-sonnet-4-5-20250514`) that is wrong format/date AND DocuSign embedded-signing URL `expiresAt` is a fabricated 5-minute claim that does not match the SDK's actual TTL — both undermine downstream contract behavior.

---

## Findings

### [CRITICAL] OCR adapter registered against wrong contract — `getAllProviderHealth` will misbehave
**File:** `src/adapters/register-all.ts:46`, `src/adapters/claude-ocr-adapter.ts:238-251`, `src/services/health-service.ts:109-114`
**What:** `ClaudeOcrAdapter` does not extend `BaseAdapter` and only implements the `OcrAdapter` interface (no `displayName`, no `supportsOAuth`, no `supportsWebhooks`, no `handleWebhook`). It is registered into the global adapter registry behind `as unknown as IntegrationProviderAdapter`. `getAllProviderHealth()` then iterates *every* registered adapter and calls `getProviderHealth(orgId, adapter.slug)` — for `claude` this runs `prisma.integrationConnection.findFirst({ where: { provider: 'CLAUDE' } })`. There is no `CLAUDE` entry in the integration provider enum (it is an OCR engine, not a connection).
**Why it's a bug/risk:** At minimum, `getAllProviderHealth` will throw a Prisma validation error every time the admin Health endpoint is hit — entire health page breaks. At worst, this also means OCR provider lookup goes through the same registry that assumes `IntegrationProviderAdapter`, defeating the type system the rest of the package relies on. The `as unknown as` cast hides this from `tsc`.
**Suggested fix:** Either (a) keep OCR adapters in a separate `ocrRegistry` map (`Map<OcrProvider, OcrAdapter>`), so `getAllAdapters()` returns only true integration adapters; or (b) make `ClaudeOcrAdapter` extend `BaseAdapter`, declare `slug='claude'`, `displayName='Claude OCR'`, `supportsOAuth=false`, `supportsWebhooks=false`, AND filter it out of `getAllProviderHealth` (because there is no `Connection` row for OCR engines). Option (a) is cleaner.

### [CRITICAL] DocuSign webhook compares base64 with `timingSafeEqual` after a length check that uses `Buffer.from(string).length` — silent verifier bypass possible
**File:** `src/adapters/docusign-adapter.ts:496-507`
**What:** The expected signature is computed as `createHmac('sha256', secret).update(rawBody).digest('base64')` (line 496) and compared against the raw `signature` string from `x-docusign-signature-1` (line 491). Both are converted via `Buffer.from(stringValue)` (default UTF-8) before `timingSafeEqual`. This works only if both strings are ASCII (true for base64), but the verifier never validates that the incoming `signature` *is* base64. An attacker who can submit any byte string of the right length will pass the length check and reach `timingSafeEqual`. While `timingSafeEqual` itself is constant-time, this same pattern is *also* used in Autenti (HIGH-1 below) where it actually combines with a buggy comparison to mask exceptions.
**Why it's a bug/risk:** Defense-in-depth: best practice is to *first* try `Buffer.from(signature, 'base64')` and bail if the round-trip doesn't reproduce, OR compare hex/b64 in their canonical decoded form. The receiving side should reject any signature that fails strict base64 validation rather than relying on a length match against the expected hex/b64 string.
**Suggested fix:** Decode both sides to raw bytes before comparison: `const expected = createHmac('sha256', secret).update(rawBody).digest()` (returns Buffer), `const received = Buffer.from(signature, 'base64')`, then length check + `timingSafeEqual(expected, received)`.

### [HIGH] Autenti webhook signature compares two hex strings via `Buffer.from(string)` (UTF-8) — incorrect compare and exception risk
**File:** `src/adapters/autenti-adapter.ts:358-369`
**What:** Same anti-pattern as DocuSign: `expectedSignature = createHmac(...).digest('hex')` is compared to `signature` (raw header value) by passing both through `Buffer.from(string)` with default UTF-8. If the inbound signature header contains any non-ASCII byte (e.g., padding, accidental UTF-8), the resulting Buffer length will not match the expected hex length and you'll *think* the rejection was timing-safe — but actually the `Buffer.from('abc')` → `Buffer.from('def')` round-trip is correct only because both sides are pure hex. An attacker sending `signature: '<garbage>'` of the right length will reach `timingSafeEqual` over UTF-8 bytes of hex, which is fine, but the sec model leaks. More importantly: **no decoding to bytes** means the actual cryptographic comparison is hex-vs-hex string compare, which still works — but the code is confusing and brittle.
**Why it's a bug/risk:** Combined with line 359-361 there is no validation that `signature` is well-formed hex. If a malformed header gets through, the comparison still runs and produces `false`, which is OK — but the same code in DocuSign's base64 path is *more* dangerous (CRITICAL above). Also: for Autenti and DocuSign the rawBody is read once and HMACed — there is no replay-protection (no timestamp check like Slack adapter does). DocuSign Connect supports replay-window mitigation; Autenti does not document one but a per-event-ID idempotency record would help.
**Suggested fix:** (1) Decode both sides to bytes (`createHmac(...).digest()` → Buffer; `Buffer.from(signature, 'hex')`) and length-check + `timingSafeEqual` on raw bytes. (2) Add a `try/catch` around `Buffer.from(..., 'hex')` because Node accepts invalid hex by silently truncating — explicitly reject via regex `/^[0-9a-f]+$/i`. (3) Consider replay protection by storing `providerEventId` (already present in `NormalizedSigningEvent`) before processing.

### [HIGH] DocuSign embedded signing URL `expiresAt` is fabricated — caller will trust it
**File:** `src/adapters/docusign-adapter.ts:343-346`
**What:** After `createRecipientView`, the adapter unconditionally returns `expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()`. DocuSign recipient view URLs default to 5 minutes BUT the actual TTL depends on the envelope's `viewUrlExpiry` and any account-level overrides. Returning a constant pretends to be authoritative while it is a guess.
**Why it's a bug/risk:** Downstream code (UI, retry logic, analytics) treats this as the real expiry. If DocuSign extends or shortens the TTL — or if account policy moves it to e.g. 60 seconds — the cached "valid until" lies and the UI shows a stale URL as still good (sometimes the reverse). Embedded signing is a UX-critical and contract-completion-critical path.
**Suggested fix:** Either (a) return `expiresAt: undefined` and let the UI re-issue on first use, or (b) read the actual TTL from the SDK response (DocuSign returns no TTL by default — their docs note the URL is single-use anyway) and document the uncertainty.

### [HIGH] BoE poller swallows `parseFloat('NaN')` — wrong Number check on rate
**File:** `src/services/boe-base-rate-poller.ts:128-130`
**What:** `const ratePercent = Number.parseFloat(rateStr);` followed by `if (!Number.isFinite(ratePercent)) continue;` is correct. **However**, in `parseFa3Line` (`ksef-xml-parser.ts:54-71`) the analogous calls use `Number.isNaN(parseFloat(...))` checks but ALSO multiply by amounts and round, so a non-numeric VAT field silently turns into `NaN`. In BoE the check is fine, but the parent flow then calls `latest.ratePercent` and stores it. After the BoE upsert path also relies on `storedRate === fetchedRate` — IEEE-754 comparing 4.75 from BoE today vs 4.75 stored as Prisma `Decimal` round-tripped via `toNumber()` may not be exactly equal once the rate hits 6+ decimals or scientific notation (BoE rarely does, but defensively, the equality is fragile).
**Why it's a bug/risk:** A rate like `0.10000000000000001` (rare BoE artifact, but the source is a CSV of ad-hoc text) compared to a stored Decimal `0.1` triggers a spurious "different rate" insert. The unique-key `effectiveFrom` then prevents a duplicate insert, but the function returns `updated: false` while logging "BoE rate updated" path is taken for the equality-failure branch — a subtle log lie.
**Suggested fix:** Compare with epsilon (or compare BigDecimal-style) against `Math.abs(storedRate - fetchedRate) < 1e-6`. The BoE rate is published to 2 dp so this is safe.

### [HIGH] BoE poller fetch override has no timeout when `deps.fetcher` is supplied (tests can hang real network)
**File:** `src/services/boe-base-rate-poller.ts:250-272`
**What:** The `AbortController` + `setTimeout(..., FETCH_TIMEOUT_MS)` is correct for the production path. But test injections via `deps.fetcher` get the same `signal: controller.signal` — fine. The bug is subtler: `clearTimeout(timeout)` runs in a `finally` block on the inner try-block; if `fetcher` throws synchronously (returns a rejected promise without the abort), the outer `try/catch` catches it, but the `finally` ran first so timer is cleared — OK. The real issue: if the fetch succeeds but `await response.text()` (line 283) hangs/streams slowly, **the timeout has already been cleared** (finally on line 270-272 runs after `await fetcher` resolves, before `response.text()`). A slow-streaming response can hang the cron forever.
**Why it's a bug/risk:** BoE is a public CSV — if BoE has a slow afternoon and streams the CSV at 1 KB/s, the cron job has no upper bound on duration. Vercel/Render cron has its own ceiling but burns time/cost. Worse: in tests with a custom fetcher, you could hit indefinite hangs.
**Suggested fix:** Move `clearTimeout(timeout)` into an outer `finally` that wraps both `fetcher()` and `response.text()`, or set a fresh `setTimeout` before reading the body. Best practice: read body inside the same abortable scope: `csvText = await response.text();` should be inside the inner try.

### [HIGH] `lazyRefresh` lock acquisition is non-atomic — race between read and write
**File:** `src/services/token-refresh.ts:88-123`
**What:** `lazyRefresh` reads the connection (line 89-91), checks if lock is stale (line 97-99), then writes a new lock (line 103-106). Two concurrent callers can both pass the read-side check before either writes. By contrast, `refreshExpiring` correctly uses `updateMany` with a `where: { OR: [...] }` predicate to atomically claim the lock (line 47-56). `lazyRefresh` does **not** use this pattern.
**Why it's a bug/risk:** Two API requests on the same expiring connection both call `lazyRefresh`. Both pass the lock-stale check. Both call `adapter.refreshToken()` against the OAuth provider, racing on the *same* refresh token. Most OAuth providers (Google, Atlassian, DocuSign) invalidate the previous refresh token on use → one request succeeds, the other gets `invalid_grant` and the user is silently moved to `REAUTH_REQUIRED`. This is exactly the "retry without idempotency" pattern called out in the bug-hunt brief.
**Suggested fix:** Use the same `updateMany` atomic claim pattern as `refreshExpiring`. If `locked.count === 0`, return false (another process is doing it); the caller can poll-and-retry the API call shortly.

### [HIGH] `KsefApiClient` retries POSTs blindly — no idempotency for redeem-token / start-query
**File:** `src/services/ksef-api-client.ts:103-110, 193-210, 431-448`
**What:** `fetchWithRetry` retries on 5xx and 429 for *any* HTTP method. Calls like `POST /auth/token/redeem` and `POST /invoices/query/metadata` are not idempotent — replaying them after a 502/timeout can create duplicate query jobs or claim multiple sessions. KSeF's docs explicitly note that re-issuing a `redeem` with the same encrypted token may return a different referenceNumber and the original session may still be alive.
**Why it's a bug/risk:** Cron jobs that hit transient 5xx during invoice sync can create double pending queries against KSeF, exceed rate limits, and produce duplicate sync logs. Also: there is no `Idempotency-Key` header sent on POSTs.
**Suggested fix:** (1) Restrict retries to GET/HEAD by default; (2) for retryable POSTs (none here, really), generate a per-call UUID and set `Idempotency-Key`; (3) for `redeem`, do not retry — surface 5xx immediately and let the caller decide whether to re-authenticate.

### [HIGH] BoE poller "different rate" branch can stomp manually-inserted history when prior `ratePercent` storage is `Decimal`-typed
**File:** `src/services/boe-base-rate-poller.ts:317-336, 380-388`
**What:** Read of `stored.ratePercent` uses `toNumber?.()` fallback to `Number(stored.ratePercent)`. If Prisma returns a `Decimal` whose `toNumber` returns `NaN` (extreme precision), `storedRate` becomes `NaN` and `storedRate !== fetchedRate` (always true because NaN). The poller then proceeds to `existing` check and inserts — no real data loss because of the unique key on `effectiveFrom`, but if the fetched `effectiveFrom` is *different* from the manually-entered admin row's date by a single day, the poller inserts a *new* row with `source: 'BOE_API'` that the admin override never anticipated. The comment at line 351-355 ("a scheduled cron must NOT stomp on a human correction") is enforced only when `effectiveFrom` matches.
**Why it's a bug/risk:** Admin corrects rate for "31 May 2025" but BoE later publishes "30 May 2025" with a slightly different rate → both rows exist, queries that expect "the most recent rate as of date X" use whichever ordered first, possibly the wrong one for late-payment-interest calculation (LPCDA §4(1) reference window per the file comment).
**Suggested fix:** Add a `source = 'MANUAL'` check before inserting: if the most recent prior history row is `source = 'MANUAL'` AND the BoE-published `effectiveFrom` is within ±2 days, log and abort (require human review). Or surface a "discrepancy" record that admins must resolve.

### [MEDIUM] OCR / E-Sign service casts `as unknown as XxxAdapter` — runtime check too weak
**File:** `src/services/ocr-service.ts:29-31`, `src/services/esign-service.ts:36-38`
**What:** Both services do `const x = adapter as unknown as OcrAdapter; if (typeof x.extractInvoice !== 'function') throw`. They check exactly one method. If `extractInvoice` exists but `pageCount`/`supportedDocumentTypes` are missing, downstream code crashes with "cannot read property of undefined". Same for E-Sign — only `createEnvelope` is checked but `getEmbeddedSigningUrl`, `voidEnvelope`, `getSignedDocument`, `normalizeWebhookEvent` are also called.
**Why it's a bug/risk:** A future adapter implementing only part of the interface registers fine, fails at first real call. Type system can't catch it (CRITICAL-1 root cause).
**Suggested fix:** Either keep typed registries (`Map<string, OcrAdapter>`) populated by adapter-specific register fns, OR use a small zod-like runtime guard that checks the full method surface.

### [MEDIUM] DocuSign `loadDocuSignSdk` calls dynamic `import('docusign-esign')` on every operation
**File:** `src/adapters/docusign-adapter.ts:560-562`, called by every operation method
**What:** Each public method calls `await this.loadDocuSignSdk()` which does `await import('docusign-esign')`. Node's module cache makes subsequent imports cheap, BUT the cast `as unknown as DocuSignSdk` happens every call. More importantly: each call also calls `getApiClient` which queries Prisma fresh, decrypts credentials, and instantiates a new `ApiClient`. Across a single envelope flow (create → getEnvelopeStatus → getSignedDocument) that's 3 Prisma round-trips, 3 decryption ops, 3 SDK constructions.
**Why it's a bug/risk:** Performance — a connection refresh / signing flow can be 5-10x slower than necessary. More subtly: if `lazyRefresh` runs concurrent to one of these reads, the decrypted token may be the old one; subsequent SDK calls with the same `apiClient` will 401. There's no in-flight token-staleness check.
**Suggested fix:** Cache the SDK module once at the module level (`let sdkPromise: Promise<DocuSignSdk> | null = null`). Optionally cache decrypted credentials per request scope (don't cross-request — credentials change on refresh).

### [MEDIUM] DocuSign hard-codes demo OAuth + REST URLs as defaults
**File:** `src/adapters/docusign-adapter.ts:127-128, 144, 192, 550`
**What:** `account-d.docusign.com` (demo) and `https://demo.docusign.net/restapi` are the OAuth endpoints AND default REST base path. Production envs need `account.docusign.com` and the user's specific basePath (e.g., `na3.docusign.net`). The default makes accidental production-against-demo possible if `configJson.basePath` is missing.
**Why it's a bug/risk:** A user connecting in production but without `accountId/basePath` populated correctly will silently sign envelopes in DocuSign's demo environment. Compliance/legal nightmare.
**Suggested fix:** Make the OAuth host environment-driven (`DOCUSIGN_OAUTH_HOST` env or per-connection config) and **fail closed** if `basePath` is not set in production. The hard-coded `'https://demo.docusign.net/restapi'` fallback should be replaced with `throw new Error('DocuSign basePath missing — refusing to default to demo environment')`.

### [MEDIUM] Resend webhook verification re-instantiates `Resend` client per request and silently swallows errors
**File:** `src/adapters/resend-adapter.ts:50-86`
**What:** Every webhook builds a fresh `new Resend(apiKey)` (line 51). The `.webhooks.verify` call is wrapped in `try/catch` that returns `{ valid: false }` on any error — but a malformed webhook secret (env var typo) and a real bad signature look identical. The downstream pipeline cannot distinguish "the secret is wrong" from "an attacker is probing".
**Why it's a bug/risk:** Operator can't debug why no Resend webhooks are processing. Also the inner `try/catch` (line 65-77) for org-slug parsing swallows everything and silently leaves `organizationSlug = undefined`.
**Suggested fix:** Singleton the Resend client. Log at `warn` level when `verify` throws with the error class, never the secret. Distinguish missing-config (`{ valid: false, reason: 'config' }`) from bad-signature (`{ valid: false, reason: 'signature' }`).

### [MEDIUM] `esign-webhook-handler` casts string→Prisma enum without validating
**File:** `src/services/esign-webhook-handler.ts:149, 175, 204, 230`
**What:** Lines like `eventType: event.eventType as never` and `status: envelopeStatus as SigningEnvelopeStatus` cast strings to enums. If `mapDocuSignEventType` falls through to `'ENVELOPE_SENT'` (line 595) for an unknown DocuSign status, that's fine — but the recipient-status mapping in `mapAutentiParticipantStatus` (line 451-460) returns `status.toLowerCase()` for unknown values, which is *not* a member of `SigningRecipientStatus`. The Prisma update will throw at runtime.
**Why it's a bug/risk:** A new Autenti status value (e.g., they add `SUSPENDED`) breaks every webhook for that connection — and the throw bubbles up to `handleSigningWebhook` which is called from a webhook route; the webhook will be retried infinitely until manually intervened.
**Suggested fix:** Add a runtime validator that maps any unknown enum value to a safe default (probably `PENDING` for recipients). Better: import the actual enum values from Prisma at the top of the file and validate before cast.

### [MEDIUM] BoE poller's `parseBoeDate` accepts case-insensitive month but not "Sept" / "March"
**File:** `src/services/boe-base-rate-poller.ts:142-171`
**What:** Regex `^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$` requires exactly 3 letter month. BoE's CSV consistently uses 3-letter abbreviations, but if BoE ever changes (as they have for press releases — using "Sept"), every row is silently skipped and the poller returns "No parseable rows" for weeks until someone notices.
**Why it's a bug/risk:** Silent failure mode — the surface symptom is `error: 'No parseable rows in BoE CSV response'` per the file's own logging, which is in `log.warn`. Cron returns success.
**Suggested fix:** Accept `[A-Za-z]{3,9}` and normalize against a longer month-name table including 4-letter ("June") and full names.

### [MEDIUM] DocuSign `resendToRecipient` truncates signer name and may break visible name in re-sent envelope
**File:** `src/adapters/docusign-adapter.ts:428-441`
**What:** When re-sending, the constructed Signer uses `name: matchingSigner.email` (line 432). The original signer's name is lost; the recipient sees themselves addressed by their email rather than their display name.
**Why it's a bug/risk:** Cosmetic but unprofessional in a contract email. Worse: if the original `matchingSigner.name` is required by some DocuSign accounts (in strict-name-match mode), the re-send may be rejected.
**Suggested fix:** Read the full signer (including `name`) from `listRecipients` and copy it through. The `DocuSignSigner` interface (line 41-45) doesn't include `name` — extend it.

### [MEDIUM] `ClaudeOcrAdapter` model id `'claude-sonnet-4-5-20250514'` does not match Anthropic's published model naming
**File:** `src/adapters/claude-ocr-adapter.ts:250`
**What:** The default model id is `'claude-sonnet-4-5-20250514'` — but published Anthropic model IDs follow the format `claude-sonnet-4-5-YYYYMMDD` corresponding to actual snapshot dates. This date predates Sonnet 4.5's release (which is later in 2025). The constructor accepts an override, but the default is non-functional — the API will return a 404/model-not-found.
**Why it's a bug/risk:** OCR fails for any consumer that doesn't pass `modelId` — and the error `errorMessage: error instanceof Error ? error.message : 'Unknown extraction error'` is buried in the OCR result, leading to invoice extraction silently degrading to empty.
**Suggested fix:** Use a known-good current ID (e.g., `'claude-sonnet-4-5-20250929'` or whatever is actually deployed) and add a `MODEL_ID` env var override at the package level. Also treat a 404 as a hard error rather than burying it in `errorMessage`.

### [LOW] BoE poller, KSeF client, DocuSign adapter — no shared retry/timeout helper
**File:** `src/services/boe-base-rate-poller.ts:258-272`, `src/services/ksef-api-client.ts:431-448`, all OAuth token-fetch paths
**What:** Each adapter and service rolls its own retry/timeout/error-handling. DocuSign OAuth fetches have no timeout. Autenti OAuth fetches have no timeout. Slack OAuth has no timeout. Only BoE and KSeF have explicit retry/timeout — and they implement the same logic differently.
**Why it's a bug/risk:** Long-tail latencies on third-party OAuth endpoints (Atlassian, Microsoft, Google, DocuSign) can hang serverless functions until the platform timeout. Inconsistent retry semantics make on-call debugging harder.
**Suggested fix:** Extract a `fetchWithTimeout(url, opts, { timeoutMs, retries, retryOn? })` helper into a shared module. Apply uniformly across all OAuth + provider-API fetches.

### [LOW] Adapters duplicate ~70 LOC of `getHealthStatus` boilerplate
**File:** `src/adapters/{ksef,clockify,jira,notion,linear,google-calendar,google-workspace,outlook-calendar,confluence,teams}-adapter.ts`
**What:** 10 adapters each carry an identical `getHealthStatus` body (read connection, read sync logs, count errors, derive status). Minor variations: `Linear` allows `PENDING_MAPPING`, KSeF/Clockify omit `tokenExpiresAt`. ~700 LOC of pure duplication.
**Why it's a bug/risk:** Drift — when status-derivation logic must change (e.g., add `RATE_LIMITED`), 10 places need updates and one will inevitably be missed.
**Suggested fix:** Move to `BaseAdapter.getHealthStatus(connectionId, opts?: { allowedExtraStatuses?: string[] })`. Each adapter overrides only if it needs custom logic. Saves ~600 LOC and removes drift risk.

### [LOW] `register-all.ts` registration is order-sensitive and silent on duplicates
**File:** `src/registry.ts:15-17`, `src/adapters/register-all.ts`
**What:** `registerAdapter` does `adapters.set(...)` with no check for existing entries. If two modules call `registerAllAdapters()` and one of them constructs an adapter differently (e.g., a test passing custom config), the last-wins order is fragile.
**Why it's a bug/risk:** Tests that override adapters can leak into production-mode runs sharing a process (e.g., Vitest serial mode).
**Suggested fix:** Have `registerAdapter` log a warning (or throw in dev) when a slug is already registered. Or version the registry per-invocation via a returned handle.

---

## Files reviewed
- `src/index.ts` (re-exports only — no logic to review)
- `src/registry.ts`
- `src/adapters/register-all.ts`
- `src/adapters/base-adapter.ts`
- `src/adapters/docusign-adapter.ts`
- `src/adapters/autenti-adapter.ts`
- `src/adapters/claude-ocr-adapter.ts`
- `src/adapters/slack-adapter.ts`
- `src/adapters/resend-adapter.ts`
- `src/adapters/jira-adapter.ts`
- `src/adapters/notion-adapter.ts`
- `src/adapters/linear-adapter.ts`
- `src/adapters/clockify-adapter.ts`
- `src/adapters/ksef-adapter.ts`
- `src/adapters/google-calendar-adapter.ts`
- `src/adapters/google-workspace-adapter.ts`
- `src/adapters/outlook-calendar-adapter.ts` (skim)
- `src/adapters/confluence-adapter.ts` (skim)
- `src/adapters/teams-adapter.ts` (skim)
- `src/services/boe-base-rate-poller.ts`
- `src/services/credential-service.ts`
- `src/services/esign-service.ts`
- `src/services/esign-webhook-handler.ts`
- `src/services/health-service.ts`
- `src/services/infisical-client.ts`
- `src/services/ksef-api-client.ts`
- `src/services/ksef-xml-parser.ts`
- `src/services/oauth-state.ts`
- `src/services/ocr-service.ts`
- `src/services/qstash-client.ts`
- `src/services/secret-store.ts`
- `src/services/token-refresh.ts`
- `src/services/webhook-dispatcher.ts`
- `src/types/{credentials,esign,ocr,provider,health,webhook,index}.ts` (read for context)
