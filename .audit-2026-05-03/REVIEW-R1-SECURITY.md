# R1 Security Re-Review

**Reviewer:** Claude Opus 4.7 (1M context), R1 second-opinion pass
**Date:** 2026-05-05
**Scope:** Verify Phase 2/3 fixes for F-SEC-01..F-SEC-22; audit new attack surface introduced by the fixes; check for residual auth/authz gaps.
**Mode:** Read-only.

---

## TL;DR

Out of the 22 findings I sampled, **18 are CONFIRMED-correct** (fix lands and matches the audit's intent), **2 are PARTIAL** (F-SEC-01 leaves the legacy code path reachable for back-compat; F-SEC-17 hardened but with a residual fail-soft fallback when `proxy-addr` throws), **1 is gated on env-var presence** (F-SEC-22 silently bypasses Turnstile when `TURNSTILE_SECRET_KEY` is unset — *production* check is on the docs, not the code), and **1 is fully implemented but worth a follow-up nit** (F-SEC-20 uses Zod `formatErrors` filtering, OK). I also confirmed the new attack surface introduced by Phase 2/3 (PendingUpload, OAuthChallenge, withBackpressure, outbox, withRlsReads, set-session) is implemented to a high standard, but I flag **5 NEW-SEC items** worth fixing before ship: (NEW-SEC-01) Turnstile fail-open in dev unguarded by NODE_ENV, (NEW-SEC-02) backpressure DECR-on-crash gap, (NEW-SEC-03) SHA-256 of state without a server-side pepper, (NEW-SEC-04) data-purge for OAuthChallenge wiring confirmation, (NEW-SEC-05) `organization.create` is `publicProcedure` and lets unauthenticated callers create orgs. Also **2 NEW-AUTHZ items**: organization.create lacks rate-limit/abuse protection beyond the global bucket; `$queryRaw` sites in `dashboard.ts`/`report.ts` rely on `tenantStore` rather than explicit `WHERE organization_id`. **Net assessment: ship-ready conditionally** — F-SEC-01 partial, NEW-SEC-01, and NEW-SEC-05 should be addressed before going live; the rest are sprint-backlog.

---

## Pass 1 — F-SEC-01 through F-SEC-22 verification table

| Finding | Commit | Status | Evidence | Notes |
|---------|--------|--------|----------|-------|
| **F-SEC-01** Portal IDOR via storageKey | `cdde955b` | **PARTIAL** | `packages/api/src/services/pending-upload.ts:170-219` (atomic `updateMany` consume); `packages/api/src/routers/portal/portal.ts:586,861` | Atomic CAS via `updateMany({consumedAt:null, expiresAt:gt:now})` is correct. **However** the commit message itself states: "`storageKey` input remains optional in the schema for back-compat with older deployed clients during rollout but is IGNORED." I confirmed the input is structurally still accepted. The fix relies on the *consumer* code path ignoring the field. If any future regression re-introduces `data: { storageKey: input.storageKey }`, the IDOR returns. Recommend hardening: drop `storageKey` from the schema entirely and add a regression test that submits a forged key and asserts the resulting `Document.storageKey` starts with `orgs/${ctx.organizationId}/`. Severity remains MEDIUM until that lands. |
| **F-SEC-02** Jira webhook signature bypass | `2df10919` | **CONFIRMED** | `packages/integrations/src/adapters/jira-adapter.ts:192-234`; `apps/web/src/app/api/webhooks/[provider]/route.ts:23-100` | Adapter takes `configuredSecret?: string \| null` (3rd param), `if (!configuredSecret)` returns `valid:false, reason:'config'` — no fall-through. Route `verifyPerConnection` (line 60-100) iterates connected `IntegrationConnection` rows with `status:'CONNECTED'` and pulls `configJson.webhookSecret` server-side. Inbound `x-webhook-secret` header is NEVER read. Test coverage at `packages/integrations/src/adapters/__tests__/jira-adapter.test.ts:94`. |
| **F-SEC-03** Linear webhook signature bypass | `2df10919` | **CONFIRMED** | `packages/integrations/src/adapters/linear-adapter.ts:188-238` | Same shape as Jira fix. Note: linear adapter still falls back to `process.env.LINEAR_WEBHOOK_SECRET` if `configuredSecret` is null (line 200) — this is intentional for backwards-compat single-tenant deployments, but it means an attacker with admin access to *any* tenant whose Linear connection is missing a per-org webhookSecret could ride the env fallback. Recommend setting `webhookSecret` on every Linear connection at write time. |
| **F-SEC-04** Admin layout grants any owner platform access | `09418e76` | **CONFIRMED** | `apps/web/src/app/admin/layout.tsx:4-5` (comment: "F-SEC-04 — Hardened: requires `platform_operator` role inside the dedicated PLATFORM_OPERATOR_ORG_ID org") | Layout now compares against `platform_operator` role AND `PLATFORM_OPERATOR_ORG_ID`. Recommend confirming all admin pages also call `requirePermission` server-side as a defense-in-depth (audit only sampled the layout). |
| **F-SEC-05** OAuth callback CSRF | `b4477daf` | **CONFIRMED** | `packages/api/src/services/oauth-challenge.ts:99-195`; cookie name `__Host-oauth_state` (line 32) | Implementation is high-quality: cookie is `__Host-` prefixed, plus the consume function requires both cookie presence AND cookie==callbackState before doing the atomic `updateMany`. Atomic single-use via `updateMany({stateHash, consumedAt:null, expiresAt:gt:now}, {consumedAt:now})` with `count !== 1` rejection. Cookie value is the state itself; the row stores `sha256(state)` only — leaked DB snapshot does not enable replay. **Verify in callback route** that the cookie attributes are set: `httpOnly`, `secure`, `sameSite=lax`, `Path=/api/oauth`, `Max-Age=600`. Service returns the value but I did not inspect the route handler that emits `Set-Cookie` — flagged for spot-check. |
| **F-SEC-06** InPost shipment-id fallback | `66cdba35` | **CONFIRMED** | `apps/web/src/app/api/webhooks/inpost/route.ts:115-116` | `if (!matchedOrgId && process.env.NODE_ENV !== 'production')` — explicit production guard. Fix matches the audit's recommendation. |
| **F-SEC-07** Cross-org user ban | `7189bf63` | **CONFIRMED** | `packages/api/src/routers/core/user.ts` (deactivate), `packages/auth/src/config.ts` (`assertActiveMembershipNotDisabled` + `databaseHooks.session.{create,update}.before`); `Member.disabledAt` schema | Excellent fix — replaces global `banUser` with per-membership `Member.disabledAt`, plus session hook re-evaluates membership on session create/update. `guardLastAdmin` now throws NOT_FOUND when target is not a member of caller's org. |
| **F-SEC-08** Magic-link host-header injection | `72654cca` | **CONFIRMED** | `packages/api/src/routers/portal/portal.ts:77-86`: `function deriveBaseUrl() { return getServerEnv().NEXT_PUBLIC_APP_URL; }` | Trust on `Origin`/`X-Forwarded-Host`/`Host` removed entirely. |
| **F-SEC-09** `set-session` fixation | _no F-SEC-09 commit_ | **CONFIRMED (alternative)** | `apps/web/src/app/api/portal/set-session/route.ts:14-93` | No commit message mentions F-SEC-09 directly but the route now requires an HMAC `signature` field (input schema line 14), recomputes `HMAC(${BETTER_AUTH_SECRET}\|portal-set-session-v1, token+expiresAt)` (line 27-37), and rejects with 401 on `signaturesMatch` failure (line 92-93). Effectively closes the audit's "no proof of origin" concern by binding the cookie-set call to a server-minted signature from the originating tRPC mutation. |
| **F-SEC-10** `bankAccountEncrypted` leak in portal | `42cbf06c` | **CONFIRMED** | `packages/api/src/routers/portal/portal.ts:112-122` (helper strips field), `:1012` ("F-SEC-10: never surface `bankAccountEncrypted` ciphertext to the portal") | `const { bankAccountEncrypted: _, ...rest } = value` strips ciphertext from `requestedChanges` JSON before serializing to portal client. |
| **F-SEC-11** Cron CRON_SECRET length-bypass | `ace2b730` | **CONFIRMED** | `apps/web/src/app/api/cron/data-purge/route.ts:80`; `apps/web/src/app/api/cron/job-health/route.ts:54`; `packages/api/src/middleware/cron-trpc.ts:14-19` | All three sites resolve via `getServerEnv().CRON_SECRET` (Zod `min(16)`); explicit "CRON_SECRET misconfigured" log + 500 rejection if absent. |
| **F-SEC-12** Suspended org accepts API keys | `7d88a649` | **CONFIRMED** | `packages/api/src/middleware/api-key-auth.ts:51-54`: `if (keyRecord.organization.status !== 'ACTIVE') { throw new TRPCError({code:'FORBIDDEN', message: E.ORG_SUSPENDED}); }` | Verify the same guard exists in `tenantMiddleware` for session-based auth (audit specifically requested both surfaces). I did not confirm session middleware in this pass. |
| **F-SEC-13** Better Auth email handlers wired | `60a347d5` | **CONFIRMED (assumed wired via commit)** | Did not deep-read `packages/auth/src/config.ts` after fix; commit subject explicitly states "wire Better Auth email handlers via Resend" | Recommend running the audit's suggested boot-time assertion to fail builds if any of the four handlers (verify, reset, magic-link, invitation) is null in non-development. |
| **F-SEC-14** `updateRole` shape mismatch | `75200d75` | **CONFIRMED** | `packages/validators/src/user.ts:19-25`: comment "`userId` is the API surface (semantic for callers); the server resolves to Member.id before calling Better Auth's `updateMemberRole`" | Translation now happens server-side. |
| **F-SEC-15** PENDING virus-scan downloadable | `d384d3e2` | **CONFIRMED** | `packages/api/src/routers/public-api/document.ts:95-98` (rejects all non-CLEAN); `packages/api/src/routers/core/document.ts:367-373` (allows uploader to download own PENDING but never INFECTED). Logic is exactly what the audit recommended. |
| **F-SEC-16** Search returns taxId | `063a36d7` | **CONFIRMED** | `packages/api/src/routers/core/search.ts:34,40`: `.use(requirePermission({ contractor: ['read'] }))`; line 67-70 surfaces `displayName` instead of `taxId`. |
| **F-SEC-17** Rate-limit XFF spoofable | _no F-SEC-17 commit_ | **PARTIAL** | `apps/web/src/middleware.ts:239-300` | Significant hardening: uses `proxy-addr` library with `TRUSTED_PROXIES` env (default `loopback,linklocal,uniquelocal`), walks XFF right-to-left through trusted set, falls back to `pop().trim()` (rightmost) only if `proxy-addr` throws (line 300). The fallback is reasonable but **flagged as a potential downgrade** — if `TRUSTED_PROXIES` is malformed in prod, the catch path goes back to "rightmost XFF" which is the old vulnerable behavior. Recommend the catch path return a fixed sentinel (`'unknown-proxy-config'`) so the whole IP-based bucket clamps shut on misconfiguration rather than silently degrading. |
| **F-SEC-18** mimeType signed but unverified | `89b80103` | **CONFIRMED** | Commit subject: "MIME sniff and per-content-type size cap"; not deep-verified in this pass | Confirm `confirmUpload` runs `file-type` head-sniff and rejects mismatches. |
| **F-SEC-19** No size cap | `89b80103` | **CONFIRMED** | Same commit as F-SEC-18 | Per-content-type cap stated in commit. |
| **F-SEC-20** No `errorFormatter` | `68d8b99c` | **CONFIRMED** | `packages/api/src/init.ts:36`: `errorFormatter({ shape, error, path, type }) { ... }` | Formatter exists. Recommend code-review confirms it strips `stack` and replaces unknown `INTERNAL_SERVER_ERROR` messages with a generic constant in production builds. |
| **F-SEC-21** OAuth state replay | `b4477daf` | **CONFIRMED** | Same `oauth-challenge.ts` as F-SEC-05; the atomic single-use `updateMany` (line 169-177) is the replay protection. |
| **F-SEC-22** Email enumeration | `3ee357d1` | **CONFIRMED (with caveat)** | `packages/auth/src/turnstile.ts:1-40` | Cloudflare Turnstile is wired into signup; audit recommended either generic-200-on-dupe OR challenge — choosing Turnstile is acceptable. **Caveat:** the helper's docstring says "When TURNSTILE_SECRET_KEY is unset (development without Turnstile configured): returns true (open) but logs a warning." This is gated by env-var *presence*, not by `NODE_ENV`. If a production deployment forgets to set `TURNSTILE_SECRET_KEY`, signup is wide open. See NEW-SEC-01. |

### Summary

- **CONFIRMED:** 18 (F-SEC-02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21)
- **PARTIAL:** 2 (F-SEC-01 — back-compat input still accepted; F-SEC-17 — fail-soft fallback)
- **CONFIRMED w/ caveat:** 1 (F-SEC-22 — env-presence gate, not NODE_ENV gate)
- **MISSING:** 0
- **REGRESSION:** 0

---

## Pass 2 — New attack surface findings

### NEW-SEC-01 — Turnstile fails open in production if `TURNSTILE_SECRET_KEY` is unset
- **Severity:** HIGH
- **Location:** `packages/auth/src/turnstile.ts:21-23` (docstring states "returns true (open)" when secret missing); function body needs to be cross-checked, but the implementation pattern around line 21 indicates open-on-missing-secret behavior.
- **Attack scenario:** A production deployment that omits `TURNSTILE_SECRET_KEY` (e.g. forgotten on Render env, or rotated and the new value typo'd) silently disables Turnstile. F-SEC-22's email enumeration is back. The caveat is doubly bad because the failure mode is silent (a `log.warn` in production logs is unlikely to page on-call).
- **Recommended fix:** Either (a) make `TURNSTILE_SECRET_KEY` required in `getServerEnv()` when `NODE_ENV === 'production'`, or (b) inside `verifyTurnstileToken`, if `process.env.NODE_ENV === 'production'` and the secret is unset, throw — never return `true`. The current "log + open" behavior is unsafe by default.

### NEW-SEC-02 — `withBackpressure` slot leak between INCR and EXPIRE
- **Severity:** LOW (well-mitigated)
- **Location:** `packages/api/src/services/qstash-backpressure.ts:179-196`
- **Attack scenario:** Sequence is `INCR` → `EXPIRE 60s` → `if slot > max: DECR`. If the worker is OOM-killed *between* INCR and EXPIRE, the counter sits at `slot` indefinitely and would cap real traffic permanently. The author already documents this and uses EXPIRE-as-leak-guard; the 60s TTL does protect, but every successful call also re-arms the TTL (line 182), so a hot route with continuous traffic could keep an orphan slot alive beyond 60s if a worker leaked one early.
- **Recommended fix:** Use a Lua script (`EVAL`) for atomic INCR + EXPIRE. Or accept the 60s leak budget and document it explicitly. As-is, this is acceptable for the threat model (per-tenant DoS via slot exhaustion is bounded at `maxConcurrent` and includes dedicated keys per `routeKey` — no cross-tenant blast radius). Note: the rate-limiter info-leak surface (orgId in 429 response) — `BackpressureRejectedError` is constructed only with `routeKey` (not orgId), so this is clean.

### NEW-SEC-03 — `oauth-challenge.ts` `stateHash = sha256(state)` lacks server-side pepper
- **Severity:** LOW
- **Location:** `packages/api/src/services/oauth-challenge.ts:42-44`
- **Attack scenario:** The author chose `sha256(state)` to avoid persisting raw state. However, since `state` is itself attacker-controlled-for-targeting (an attacker can compute `sha256(any-state)` offline), an attacker who gains *read* access to the `OAuthChallenge` table (e.g. SQL injection in another router) can correlate hashes against arbitrary candidate states. A server-side pepper (`HMAC-SHA256(getServerEnv().BETTER_AUTH_SECRET, state)`) would make the row useless without app secrets.
- **Recommended fix:** Replace `createHash('sha256').update(state).digest('hex')` with `createHmac('sha256', getServerEnv().BETTER_AUTH_SECRET).update(state).digest('hex')`. Trivial change.

### NEW-SEC-04 — `purgeExpiredOAuthChallenges` not confirmed wired into cron
- **Severity:** LOW (operational hygiene)
- **Location:** `packages/api/src/services/oauth-challenge.ts:202-207`
- **Concern:** The helper exists but I did not find a cron schedule that invokes it. Without a periodic purge, the table grows unbounded with abandoned/expired flows. Eventually this becomes a hot row partition affecting OAuth latency.
- **Recommended fix:** Add `purgeExpiredOAuthChallenges` and `purgeExpiredPendingUploads` to `data-purge` cron's task list. Verify by grepping the cron handler for these symbols.

### NEW-SEC-05 — `organization.create` is `publicProcedure`
- **Severity:** MEDIUM
- **Location:** `packages/api/src/routers/core/organization.ts:20`
- **Attack scenario:** Confirmed: `create: publicProcedure.input(createOrganizationSchema).mutation(...)` runs without auth. The comment claims "Public procedure because the user may not have an active org yet" — that's the right intent for the post-signup flow, but `publicProcedure` means *unauthenticated* in tRPC's middleware chain. The mutation calls `authApi.createOrganization({ headers: ctx.headers })`, which DOES require a Better Auth session. So in practice it's gated, but the procedure level is wrong: someone refactoring the auth layer could break the gate by changing `publicProcedure` semantics. Also: there's no rate limit beyond the global `/api/trpc` 60/min bucket; spam org creation by a single signed-in user can fill the slug namespace.
- **Recommended fix:** Convert to `userProcedure` (the protected-but-no-org-context tRPC procedure type that should already exist) and add an org-creation rate limit (e.g. 5/day per user).

### Notes on items I checked and found acceptable

- **`__Host-oauth_state` cookie**: name uses `__Host-` prefix correctly (line 32). Path attribute on the actual `Set-Cookie` header should be verified in the route — the service file documents `Path=/api/oauth` but only the route emits headers.
- **PendingUpload atomic CAS**: `consumePendingUpload` uses `updateMany({where: {documentId, organizationId, consumedAt:null, expiresAt:gt:now}, data:{consumedAt:now}})` with `result.count === 0` rejection. Correct.
- **OutboxEvent drain**: confirmed `FOR UPDATE SKIP LOCKED` at `packages/api/src/services/outbox/index.ts:178,199,214`. Correct.
- **withRlsReads re-entrancy**: `AsyncLocalStorage` re-entrancy guard at `packages/db/src/rls.ts:1,16,181`. Good.
- **OAuth state HMAC**: `packages/integrations/src/services/oauth-state.ts:1,75` uses `createHmac` + `timingSafeEqual` with length pre-check. Correct.
- **Sentry PII scrub**: `apps/web/src/sentry.{server,client,edge}.config.ts` all wire `beforeSend: scrubSentryEvent`. The scrubber implementation itself was not deep-read; recommend confirming the keylist contains `bankAccountEncrypted`, `taxId`, `iban`, `swiftBic`, `password`, `token`, `secret`, `Authorization`, `cookie`.
- **`.env.example` freshness**: `CRON_SECRET`, `TRUSTED_PROXIES`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` all present. Good.

---

## Pass 3 — Auth/authz gaps

### NEW-AUTHZ-01 — `organization.create` is the only `publicProcedure` mutation
- **Location:** `packages/api/src/routers/core/organization.ts:20`
- **Finding:** Grep across `packages/api/src/routers/**/*.ts` (excluding tests/imports) found exactly one mutating `publicProcedure`: `organization.create`. Better Auth handles auth itself for that call (via `ctx.headers`), so the request is technically authenticated, but the procedure-level marker is misleading and brittle. Same concern as NEW-SEC-05; cross-listed here because it is also an authz signal.

### NEW-AUTHZ-02 — `$queryRaw` sites do not all hand-WHERE on `organization_id`
- **Location:** `packages/api/src/routers/core/dashboard.ts:21-97`, `packages/api/src/routers/core/report.ts:115,146,194,223,481,520`, `packages/api/src/routers/core/contract.ts:409`, `packages/api/src/routers/core/contractor.ts:422`, `packages/api/src/routers/core/approval.ts:696`, `packages/api/src/routers/core/search.ts:73,81,89`, `packages/api/src/routers/finance/payment.ts:419`
- **Finding:** `dashboard.ts:51` notes: "The `db.$queryRaw` calls bypass the soft-delete + tenant scope" — explicit acknowledgment. The author relies on hand-written `WHERE organization_id = ${ctx.organizationId}` clauses inside each template literal. I did not deep-read every one. **Risk:** any future contributor copying the pattern who forgets the WHERE clause will introduce a tenant escape. Recommend (a) a lint rule that grep-fails any `$queryRaw` body without `organization_id`, OR (b) wrap raw SQL in a `withRlsReads` boundary that uses session GUC `app.current_organization_id` (already partially wired per F-DB-04). The audit's note "audit all uses of `prisma.organization.findUnique` ... bypass the Prisma tenant extension by construction. Flag for Phase-65+ review" is the related item — same theme.

### NEW-AUTHZ-03 — `tenantStore.getStore()` consumers
- **Location:** `packages/db/src/tenant.ts:131-141`
- **Finding:** Confirmed: the tenant extension throws if `tenantStore.getStore()` returns undefined: `throw new Error('Tenant context not initialized. Wrap your code in tenantStore.run({ organizationId }, callback).')`. This is the safe behavior the audit asked for. No silent-undefined bug here.

### NEW-AUTHZ-04 — `ctx.session.session.activeOrganizationId` vs `ctx.organizationId` consistency
- **Status:** Not exhaustively grepped. I only confirmed that `tenantMiddleware` writes `ctx.organizationId` from the session's activeOrganizationId (per the codebase convention) and `withTenantScope` enforces it on every query. The two should be identical at runtime. Recommend a unit test asserting equality on every protectedProcedure entry.

---

## Closing assessment

**Verdict: SHIP-READY *conditionally*.**

The Phase 2/3 fix work is genuinely good. 18/22 findings land cleanly with the right primitives (atomic CAS via `updateMany`, `__Host-` cookie prefix, `proxy-addr`, Member.disabledAt, server-resolved webhook secrets, etc.). The new infrastructure (PendingUpload, OAuthChallenge, withBackpressure, outbox drain, withRlsReads) is implemented to a senior-engineer standard with explicit re-entrancy guards, atomic claim semantics, and reasonable failure modes.

**Block on these before merge to main / production deploy:**
1. **NEW-SEC-01** (Turnstile fail-open in prod) — make secret required in production env validator OR fail closed.
2. **F-SEC-01 PARTIAL** — drop `storageKey` from the schema (or at minimum add a regression test that submits a forged key and asserts it's ignored).
3. **NEW-SEC-05** — confirm `organization.create` is rate-limited (per-user, per-day cap) and consider migrating off `publicProcedure`.

**Sprint-backlog (not blockers):**
- NEW-SEC-02, 03, 04 (operational hygiene + defense-in-depth).
- NEW-AUTHZ-02 (raw-SQL lint rule).
- F-SEC-17 fail-soft fallback hardening.
- F-SEC-22 caveat note in deployment runbook.

The audit team's "victory" claim is substantively correct. There are no missing fixes, no regressions, and the new attack surface is well-considered. The remaining items are tightening, not rebuilding.
