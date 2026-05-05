# Production Readiness Audit — Synthesis & Fix Plan

**Date:** 2026-05-03
**Scope:** Six parallel audits across DB performance, security, integrations resilience, async/notifications, observability, and scalability.
**Total findings:** 129 (13 CRITICAL, ~40 HIGH, ~50 MEDIUM, ~26 LOW)

| # | Audit | Findings | CRIT | HIGH | File |
|---|-------|---------:|-----:|-----:|------|
| 1 | DB & Performance | 28 | 4 | 11 | `01-db-performance.md` |
| 2 | Security & Vulnerabilities | 22 | 4 | 7 | `02-security.md` |
| 3 | External Integrations Resilience | 23 | 3 | 7 | `03-integrations.md` |
| 4 | Async Processing & Notifications | 18 | 1 | 4 | `04-async.md` |
| 5 | Logging, Tracing & Observability | 18 | 1 | 6 | `05-observability.md` |
| 6 | Scalability & Traffic Handling | 20 | 0 | 5 | `06-scalability.md` |

---

## The 13 critical findings (must-fix before launch)

| ID | Title | Why critical |
|----|-------|--------------|
| **F-SEC-01** | Cross-tenant document exfiltration via portal `submitInvoice` accepting attacker-supplied `storageKey` | Any portal contractor can download any other tenant's R2 documents |
| **F-SEC-02** | Jira webhook signature bypass — secret read from inbound `x-webhook-secret` header | Spoofed Jira webhooks accepted; mutates workflow tasks |
| **F-SEC-03** | Linear webhook signature bypass — same pattern as Jira | Spoofed Linear webhooks accepted |
| **F-SEC-04** | Admin layout: any org owner reaches `/admin/*` (should be `platform_operator` only) | Auto-elevation via signup → create org |
| **F-DB-01** | Payment-run idempotency uses in-memory `Map` on multi-instance Render | Real-money double-spend |
| **F-DB-02** | `getOrCreatePreferences` unique key missing `organizationId` (multi-org users leak prefs cross-tenant) | Cross-tenant data leak |
| **F-DB-03** | Every authenticated tRPC call does sync `Organization.findUnique` against EU primary | Cross-region RTT on every ME request; large fixed perf tax |
| **F-DB-04** | `withRlsSession` exported but never called → no defense-in-depth on tenant isolation | One missed `where: organizationId` = cross-tenant exposure |
| **F-INT-01** | `fetchWithTimeout` adopted by only 4/14 adapters | Hung upstream pins Render instance until platform timeout |
| **F-INT-02** | No timeouts on Jira/Confluence/Linear/Notion/Google*/Outlook/Teams raw `fetch()` | Same |
| **F-INT-04** | No idempotency keys on Stripe/Storecove/InPost/Resend/DocuSign | QStash retries → duplicate payments / parcels / emails / envelopes |
| **F-ASYNC-01** | `queueZatcaSubmission` posts to `/api/zatca/_submit` which doesn't exist | Every Saudi e-invoice submission silently dies in DLQ; user sees "success" |
| **F-OBS-01** | `apps/public-api` (Enterprise REST) has zero Sentry, no per-request logging, no requestId | Production incidents on the customer-facing API are unsupportable |

---

## Top HIGH findings clustered by theme

### Tenant isolation / IDOR / authz
- **F-SEC-07** Cross-org `user.deactivate` → bans target globally without org-membership check
- **F-SEC-09** `/api/portal/set-session` accepts arbitrary token (session fixation)
- **F-SEC-10** `requestedChanges` JSON returns `bankAccountEncrypted` ciphertext to portal
- **F-SEC-12** Suspended orgs still authenticate via API key
- **F-SEC-14** `updateRole` passes `userId` where `memberId` expected (silent role no-op)
- **F-SEC-15** Public-API + core `getDownloadUrl` allow downloads of `PENDING` virus-scan docs
- **F-SEC-16** Global search returns `taxId` to all roles
- **F-DB-13/14** Missing uniqueness on `IntegrationConnection` per-user, `SigningEnvelope.externalEnvelopeId`

### Webhook / OAuth / auth surface
- **F-SEC-05** OAuth state not bound to logged-in browser session (account-takeover via callback hijack)
- **F-SEC-06** InPost webhook fallback to shipment-id matching with no `NODE_ENV` guard
- **F-SEC-08** Magic-link emails interpolate attacker `Origin`/`X-Forwarded-Host`
- **F-SEC-11** Cron `Buffer.from('')` length check bypass when `CRON_SECRET` unset
- **F-SEC-13** `requireEmailVerification: true` but no `sendVerificationEmail`/reset/magic-link/invitation handlers wired (auth flows silently broken in prod)
- **F-INT-08** Jira webhook signature falls open when no secret configured

### Money / async correctness
- **F-ASYNC-03** No outbox table; `dispatch()` after `prisma.$transaction()` with `.catch(_ => {})` → notifications lost on crash
- **F-ASYNC-04** Notification dedup is racy `findFirst within 60s` with no DB unique constraint
- **F-ASYNC-08** Peppol outbound returns 200 on every error → transient Storecove failures permanently lose submissions
- **F-ASYNC-13** `void dispatch(...)` inside Stripe `Serializable` tx fires even on rollback (and is unawaited → unhandled rejection)
- **F-INT-19** `teams-adapter.ts:127` calls `decryptCredentials` on already-decrypted blob → Teams refresh path is dead
- **F-INT-10** Infisical SDK auth token cached forever; rotation will brick ZATCA secret access

### Resilience patterns
- **F-INT-03** KSeF client retry loop has no AbortController (>1 hour hangs during outage)
- **F-INT-05** Zero circuit breakers anywhere in codebase
- **F-INT-11/13** Webhook event-ID dedup uses JSON queries without unique indexes (Storecove + generic pipeline)

### DB performance / scalability
- **F-DB-05/12** `complianceGaps` + `complianceGapsChart` load-everything-then-page-in-memory → OOM at scale
- **F-DB-06/07/08** Sequential awaits inside transactions hold row locks (workflow `instantiateTaskRuns`, contract bulk audit, equipment courier)
- **F-SCALE-01** Five `report.export*` mutations completely unbounded (no row cap)
- **F-SCALE-02** Synchronous `@react-pdf/renderer` inside tRPC (SDS, DRV defense, GDPR notice) — should be QStash
- **F-SCALE-03** All four rate-limit middlewares **fail open** when Upstash errors
- **F-SCALE-04** Dashboard layout: 4-5 uncached Prisma queries per nav + 7-8 client widget queries
- **F-SCALE-05** Notification fanout sequential per recipient (300+ serial DB calls for 100 people)
- **F-SCALE-20** Better Auth has no built-in rate limiting in `packages/auth/src/config.ts`

### Observability
- **F-OBS-02** `requestId` minted but never propagated past middleware — router/service log lines lack orgId/userId/requestId
- **F-OBS-03** QStash payloads include no requestId/traceparent → end-to-end "click → background job" trace impossible
- **F-OBS-04** No `process.on('uncaughtException')`/`unhandledRejection` handlers anywhere
- **F-OBS-05** Sensitive admin actions (`updateRole`, `deactivate`, `invite`, `apiKey.create`, `organization.update`, `settings.*`) skip the audit log
- **F-OBS-06** 30+ raw `fetch()` calls in adapters with zero duration/status/retry logging
- **F-OBS-11** Webhook processor swallows errors silently
- **F-OBS-13** ~45 silent catch blocks across the codebase

---

## Proposed fix plan — three tiers

### Tier 1 — apply now in parallel (this session)
**Scope:** quick, contained, security-bleeds-and-data-correctness fixes that don't need design discussion.

| Group | Findings | Approx LOC | Risk |
|-------|---------:|-----------:|-----:|
| **A. Security bleeds** | F-SEC-01, F-SEC-02/03, F-SEC-04, F-SEC-06, F-SEC-08, F-SEC-09, F-SEC-10, F-SEC-11, F-SEC-12, F-SEC-15, F-SEC-16, F-SEC-20 | ~600 | LOW (additive guards) |
| **B. Auth correctness** | F-SEC-07, F-SEC-13, F-SEC-14 | ~250 | MEDIUM (auth handlers wiring) |
| **C. Money/async correctness** | F-DB-01, F-DB-02, F-ASYNC-01, F-ASYNC-13, F-INT-19 | ~300 | MEDIUM (small migrations) |
| **D. Resilience quick wins** | F-INT-01/02 (apply `fetchWithTimeout` to the 10 adapters), F-INT-08, F-INT-10 | ~400 | LOW (drop-in helper) |
| **E. Observability quick wins** | F-OBS-01 (Sentry on public-api), F-OBS-04 (process handlers), F-SCALE-03 (rate-limit fail-closed in prod) | ~200 | LOW (additive) |

**Estimated:** ~30 fixes, one atomic commit per fix, ~3-5 hours wall clock under parallel fixers.

### Tier 2 — needs short design before code (next session)
- **OAuth state ↔ session binding rewrite** (F-SEC-05) — `__Host-oauth_state` cookie + nonce in state. ~1h design + 2h code.
- **Outbox pattern for transactional notifications** (F-ASYNC-03, F-ASYNC-04) — new `Outbox` table + processor + adapt all `.catch(_ => {})` callsites.
- **Circuit breaker shared util** (F-INT-05) — `opossum` or roll our own; wrap all adapter calls.
- **Defense-in-depth RLS** (F-DB-04) — wire `withRlsSession` into `tenantMiddleware`.
- **Cross-region tenant lookup cache** (F-DB-03) — Upstash Redis cache of `Organization.dataRegion` keyed by id, 5-min TTL.
- **MIME sniffing on confirmUpload** (F-SEC-18) — `file-type` npm + reject mismatches.
- **`requestId` propagation through tRPC → service → DB → fetch → QStash** (F-OBS-02, F-OBS-03) — async-local-storage propagator.
- **Pagination caps + streaming exports** (F-SCALE-01, F-SCALE-08) — async export → R2 + email link.
- **Sequential notification fanout → batched** (F-SCALE-05) + reminders advisory lock (F-ASYNC-06).

### Tier 3 — backlog
- All MEDIUM/LOW findings in DB/Async/Scalability that are sweep-the-codebase changes (audit log coverage on missing routers, slow query log, Sentry beforeSend PII scrub, signup enumeration, etc.)
- Architectural improvements: read replica routing (F-SCALE-06), per-instance connection cap (F-SCALE-07), metric histograms (F-OBS-15).

---

## Open questions before fixing

1. **`storageKey` server-side derivation (F-SEC-01):** Replace client-supplied keys with a `PendingUpload` table, or simpler short-term fix (validate prefix server-side, reject if not `orgs/${ctx.organizationId}/`)?
2. **Cross-org ban (F-SEC-07):** Keep global `banUser` for `platform_operator` only, or move to per-membership `disabledAt`?
3. **Email handlers (F-SEC-13):** Is Resend wired (`sendAppEmail` exists)? If yes, this is a 1h job. If no, blocker.
4. **F-SEC-04 (admin layout):** Confirm `platform_operator` role + `PLATFORM_OPERATOR_ORG_ID` env var pattern — or is the intent for owners to access admin per-org?
