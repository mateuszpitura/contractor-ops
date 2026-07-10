# Go-prod deep audit — 2026-07-10

Pre-commit deep iteration over: external integrations, background processes, UI↔API wiring, security (leaks, rate limiting), performance. Working tree (post round-4 hardening, all repo gates green).

**Method:** 6 parallel read-only audit dimensions → findings land here → fix subagents close them → checkmark with file:line + verify evidence. Severity: 🔴 blocker · 🟠 high · 🟡 medium · ⚪ low.

**Status legend:** ☐ open · ✅ fixed (with evidence) · 📦 accepted-backlog (with reason) · ❌ refuted.

---

## Dimensions

| # | Dimension | Agent scope |
|---|-----------|-------------|
| A | External integrations | Stripe, Storecove/Peppol, ZATCA, KSeF, e-sign, Slack/Teams, Clockify/Jira/Linear, HRIS, couriers, IdP, QStash, Unleash, R2, ClamAV, FX — auth/token refresh, retries/timeouts, webhook signature+replay, idempotency, secret handling |
| B | Rate limiting & abuse | public-api quotas, portal auth, webhook test-fire, OCR, tRPC flood, per-IP limits, Redis-fallback semantics, e-sign URL minting |
| C | Data leakage | PII in responses/errors/logs, encrypted-field omission, public endpoints, presigned URL scope/TTL, exports, portal isolation |
| D | UI↔API wiring | orphan procedures vs broken callers, new error codes rendered, loading/empty/error states on new surfaces, portal flows |
| E | Performance | N+1, unbounded findMany, missing indexes for new query shapes, heavy tx, pagination gaps, cron sweep bounds |
| F | Process integrity | cron registry vs env vs render.yaml, QStash consumers exist per producer, outbox drain wiring, env schema vs .env.example, migrations coherence |

---

## Findings

### B — Rate limiting & abuse

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| B-3 | 🟠 | `apps/api/src/plugins/rate-limit.ts:71` | Portal tRPC (`/api/trpc/portal/*`) matched by `apiLimiter` (60/min) not `portalLimiter` (10/min); `requestMagicLink` has no per-email cap → email bombing at 6× budget | ✅ `usesPortalLimiter()` selector matches `/api/trpc/portal`; `magic-link-rate-limit.ts` 5/15min hashed-email fail-closed; 20 tests |
| B-1 | 🟠 | `apps/public-api/src/app.ts:117` + `lib/rate-limiter.ts:120` | public-api has no per-IP floor; anon traffic unthrottled (openapi.json rebuilds full doc/call, uncached) | 📦 public-api gated `module.public-api` OFF #8 (harden before per-org flip; Render edge covers anon today) |
| B-2 | 🟠 | `lib/rate-limiter.ts:83` + `api-key-service.ts:120` | Invalid-key burst keyed on attacker bytes → fresh 100/min bucket/request, each a cross-region `findMany` (credential-probe DoS) | 📦 public-api gated #8 |
| B-9 | 🟡 | `ocr.ts:158` `portalTrigger`, `esign.ts:165` `getPortalSigningUrl` | Portal contractor OCR trigger (drains org credits + QStash) + e-sign URL mint have no per-subject cap | ✅ `portalSubjectRateLimitMiddleware` 10/min per subject on both |
| B-5 | 🟡 | `apps/public-api/src/index.ts` | public-api no body-size limit (buffers full body before auth) | 📦 public-api gated #8 |
| B-7 | 🟡 | `validators/onboarding-import.ts:97` + `onboarding-import.ts:490` | `startImport` unbounded `people[]`/`projects[]`, sync in-request + invite side effects | 📦 backlog (tRPC 1MB cap + 60/min-IP bound today; add `.max()` + async job) |
| B-8 | 🟡 | `apps/api/src/routes/webhooks/multi-provider.ts:81` | jira/linear ingress runs HMAC verify per connection (N=tenant count) on ≤5MiB body, unauth | 📦 backlog (jira/linear dark; bounded by 60/min-IP + 5MiB) |
| B-6 | 🟡 | `services/webhooks/rate-limit.ts:18` | Outbound dispatch per-sub 100/min but no global cap | 📦 outbound-webhooks dark #17 |
| B-10 | 🟡 | `search.ts:39`; `webhook-subscription.ts:302` | `search.global` (3 tsvector/call) no per-org cap; `testFire` uncapped enqueue | 📦 backlog (staff-authed only) |
| B-4 | 🟡 | `portal-auth-router.ts:45` | Magic-link enumeration via response timing (awaited only on match) | 📦 backlog (per-email cap from B-3 blunts bulk enum) |
| B-11 | ⚪ | `apps/api/src/plugins/rate-limit.ts:67` | QStash callback routes not exempt from 60/min-IP (self-throttle risk under load) | 📦 backlog (QStash backoff mitigates) |

**Verified-solid (B):** Better Auth `/api/auth` layer (sign-in 10/min, sign-up 5/min, lockout, Turnstile) — confirm secondary Upstash storage wired for multi-pod; all Upstash limiters fail-closed (503) in prod, fail-open+Sentry in dev; LRU eviction + size caps; trusted-proxy IP via `proxy-addr` (needs `TRUSTED_PROXIES` set); Fastify bodyLimit 5MiB + tRPC 1MB 413 short-circuit; public-api boots fail-closed on missing Upstash env; magic-link token hygiene (256-bit, SHA-256, single-use atomic, 15min); API quota atomic increment-compare; upload 10/min/user; portal set-session HMAC-signed.

### E — Performance

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| E-1 | 🔴 | `routers/core/import.ts:350` + `db/src/client.ts:148` | Import commit: up to 5000 rows in ONE interactive tx, no timeout → default 5s; ~6-10 RTT/row → P2028 abort beyond a few hundred rows. (round-4 savepoints added RTTs) | ✅ `$transaction {timeout:120s,maxWait:10s}` |
| E-2 | 🟠 | `economic-dependency-scan.ts:396,165,207` | Daily DE scan O(A×N_orgs): unbounded assignment findMany, `organization.findMany` re-fetched PER assignment, identity loaded 2×, no taxId index → 600k+ queries at scale, blows 5min job budget | ✅ O(A×N)→O(A): 1 cross-org peer `findMany` + 1 `invoice.aggregate` (4 q/assignment const, ~104k→4k); duplicate identity load dropped; 20 tests |
| E-3 | 🟠 | `einvoice-submission-triggers.ts:271` | Peppol reconcile covered-set loads ALL OUTBOUND incl. DELIVERED (grows forever) into `notIn` → PG bind-param ceiling ~65k. (round-4 code) | ✅ `notIn`→`NOT EXISTS` correlated anti-join (bounded params) |
| E-6 | 🟡 | `approval-shared.ts:594` + `leave-ewidencja-materialization.ts:108` | Leave finalize per-day upsert loop inside no-timeout tx → PARENTAL (~1yr) ≈700 RTT → P2028 rollback | ✅ `{timeout:120s}` on all 3 finalize tx paths (bulk, single approve, portal-manager) |
| E-4 | 🟡 | `einvoice-submission-triggers.ts:282` | Peppol reconcile: permanently-ineligible invoices (take 50, orderBy updatedAt) starve the head → newer lost enqueues never reached. (round-4 code) | ✅ ACTIVE-participant org precondition in candidate `where` |
| E-5 | 🟡 | `zatca-submission.ts:437` | PENDING sweep `zatcaStatus+createdAt` no usable index (only org-prefixed) → seq scan every 15min | 📦 ZATCA dark (add `@@index([zatcaStatus,createdAt])` before SA enable; small table) |
| E-7 | 🟡 | `compliance-reminder-scan.ts:217` | Scan loads ALL BLOCKING incl. terminal EXPIRED (no take, grows); 8-subjob reminders share one 60s tx cliff | 📦 backlog (exclude terminal band from fetch; small at scale) |
| E-8/9/10 | ⚪ | leak-alarm Set, teams configJson, hris hash map | Bounded/negligible at scale; optional table extraction if usage grows | 📦 |

**Verified-solid (E):** outbox drain (batch 100, FOR UPDATE SKIP LOCKED, HTTP outside tx); all audit reads bounded (keyset + COUNT_CAP 10k, no N+1); reassessment/virus-scan/contract-expiry/zatca-missing-enqueue reconciles bounded (take + cursor + anti-join); data-purge explicit 30s tx timeout; every `SUM(*Minor)` is `::bigint`; bulk approvals capped 50 sequential short txs; web-vite hooks server-paginated + memoized; courier poll per-org bounded; pLimit(10) on scans; index checklist mostly ✓ (gaps = E-2 taxId, E-5 zatca).

### D — UI↔API wiring

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| D-6 | 🟠 | `web-vite/.../use-other-client-attestation.ts:17` | `invalidate: [['ir35Attestation']]` string-vs-array mismatch → invalidation no-ops → stale form → resubmit P2002 | ✅ `trpc.ir35Attestation.pathFilter()` |
| D-4 | 🟠 | `payroll-export-router.ts:101,109,117` | `PAYROLL_FEED_*:${ids}` prefix-parameterized messages not in registry → `unknownError` generic toast; no client parser | ✅ 3 registry constants + `cause.params` + 4-locale keys; UI hook already `useTranslatedError` |
| D-5 | 🟠 | `web-vite/.../use-wht-certificates.ts:20` | raw `err.message` toast → user sees literal `whtCertificateNumberConflict` camelCase | ✅ `translateError(err)` |
| D-9 | 🟡 | `web-vite/.../org-bank-settings.tsx:28` + hook | no error state (blank form on fail); wrong error copy; field-clear impossible (`''→undefined` preserves old) + false success | ✅ QueryErrorPanel + translateError + disable-clear-with-hint (`orgBankCannotClear`, 4 locales) |
| D-10 | 🟡 | `web-vite/.../compliance-held-section.tsx:116` | no error state → section silently unmounts on API error; errorMessage override masks resume errors | ✅ inline QueryErrorPanel on isError + dropped errorMessage override; 4-locale keys |
| D-11 | 🟡 | `web-vite/.../country-compliance-section.tsx:405` | container returns null on query error (looks like "no fields") | ✅ CountryComplianceErrorCard on isError; 4-locale keys |
| D-7 | 🟡 | `web-vite/.../use-ewidencja.ts:87` | static `errorMessage` override masks `ewidencjaVersionConflict` refresh guidance | ✅ removed override → auto-translate |
| D-8 | 🟡 | `web-vite/.../use-upload-review.ts:40` | `onError` generic toast masks `documentScanPending`/`documentInfected` | ✅ `translateError(err)` both handlers |
| D-1 | 🔴 | `web-vite/pages/dashboard/settings/integrations-hris.tsx:38` | HRIS settings page built but NO route registered + no nav link → entire HRIS UI unreachable | 📦 HRIS flag-dark #19-22 (route wiring is part of HRIS enablement — flag OFF + migration #22 unapplied) |
| D-2 | 🔴 | `hris-sync-router.ts:301,344` | `listUnlinkedEmployees` + `linkEmployee` zero callers; no `unlinkEmployee` | 📦 HRIS flag-dark #19-22 (link surface + unlink procedure part of enablement) |
| D-3 | 🟠 | `leave.ts:361` | `leave.adjustBalance` orphan — no UI; HR balance correction unusable | 📦 backlog (audited procedure exists; build adjust-balance dialog — UI-deferral class like #33) |
| D-12 | 🟡 | `web-vite/.../use-org-switcher.ts:31` + `portal-auth-router.ts:291` | in-shell org switcher contractor-only; multi-employee-org can't switch without re-login | 📦 employee-portal enablement #25 (subject-union bootstrap) |
| D-13 | ⚪ | `web-vite/.../use-zatca-trpc.ts:6` | `as unknown` proxy vs router — matches today, rename won't typecheck | 📦 |
| D-14 | ⚪ | `web-vite/.../invoice-submit-upload.tsx:16` | dead `storageKey` UI field behind compat shim | 📦 |

**Verified-solid (D):** org-bank settings + compliance-held + ZATCA CSID OTP + workflow role templates + Peppol 0235 + classification country-fields + startRun subjectType + OCR documentId-only + bankStatementConfirm all correctly wired hook→container→page→route with valid invalidation; 7 named error constants render in 4 locales; HR dashboard full 3-state; portal union narrowing complete. Systemic: route-layer is the weakest wiring link (D-1); section-error-states returning null = silent disappearance (D-10/11); static errorMessage overrides defeat translated-error pipeline (D-5/7/8).

### C — Data leakage

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| C-1 | 🔴 | `routers/public-api/payment-run.ts:67,307` | **Live regression this wave**: export idempotent-replay returns full Prisma run row (bankAccount/routing/account ciphertext + contractor.taxId) to external API consumer; Hono `z.unknown()` no response filter | ✅ idempotent branch re-selects `paymentRunSelect` safe shape (findFirstOrThrow) |
| C-2 | 🟠 | `payment-export-router.ts:225,302` | Same pattern on staff `lockAndExport` idempotent branch → ciphertext + taxId to browser/React-Query cache | ✅ re-select bare row; +idempotent-replay leak test |
| C-3 | 🟠 | `contractor-core.ts:93` | `contractor.list` findMany spreads full rows without `omit:{ssnEncrypted}` (sibling paths all omit) → SSN ciphertext to any `contractor:read` | ✅ `omit:{ssnEncrypted:true}` |
| C-6 | 🟠 | `routers/core/tax.ts:80` | WhtCertificate list/get have ZERO `requirePermission` → any member enumerates all contractor tax IDs + amounts | ✅ `requirePermission({payment:['read']})` on both |
| C-4 | 🟠 | `apps/api/src/plugins/sentry.ts:29` | Fastify error handler replies `{error: message}` for 5xx in prod → Prisma model/column/constraint + DB host leak on non-tRPC routes | ✅ generic 'Internal Server Error' for ≥500 in prod; full to Sentry |
| C-5 | 🟠 | `apps/public-api/src/lib/error-handler.ts:75` | public-api passes raw TRPCError message incl. INTERNAL_SERVER_ERROR → internal message to external consumer | ✅ generic message for mapped ≥500; only coded 4xx pass through; +test |
| C-7 | 🟡 | `routers/core/settings.ts:251+` | New org SEPA IBAN/BIC plaintext in settingsJson + Redis cache + audit oldValues/newValues (BACS pattern is encrypted+masked). Mitigated: own IBAN, on invoices | ✅ audit now `fieldsUpdated:[...]` names only (at-rest encryption → backlog) |
| C-9 | 🟡 | `routers/core/import.ts:391` | `log.warn({err})` — PrismaClientValidationError.message embeds full query args = raw import PII row → Axiom | ✅ logs `err.name` + classified msg only (wave 3) |
| C-8 | 🟡 | `apps/api/src/routes/exports.ts:74` | Export download gates session+org only, no re-check of creation permission → forwarded exportId downloadable by lower role | 📦 backlog (cuid unguessable, low exploitability; store required-permission on Export row) |
| C-10 | ⚪ | `apps/api/src/routes/csp-report.ts:71` | Sentry breadcrumb spreads raw attacker CSP body (Pino redaction covers log, not breadcrumb) | 📦 backlog (attacker's own CSP data, not org PII) |
| C-11 | ⚪ | `apps/public-api/src/lib/build-openapi-doc.ts:8` | Stale `hide:true` comment (routes deliberately un-hidden) — doc drift | 📦 trivial comment cleanup |

**Verified-solid (C):** /health+/ready probe reasons server-side only; status page + developer portal flag-dark + no org data; BACS masked+encrypted+field-name audit; HRIS publicHrisConfig strips creds; payroll export employeePii:read+counts audit; national-ID paths omit all 4 *Encrypted + per-field audited reveal; **tRPC error formatter prod-strips INTERNAL+stack+200char cap** (C-4/C-5 are the NON-tRPC handlers only); api-key/webhook-secret revealed once never audited; portal isolation IDOR-safe re-verify in regional DB + presign-time ownership re-check; presigned R2 300-900s TTL per-object never logged; PII_MASK_PATHS wired all loggers; compliance dashboard narrow select. Infisical-SSRF + OAuth-redirect NOT re-examined (previously refuted).

### A — External integrations (123 findings) — TRIAGE

**Disposition:** the bulk hit **default-OFF flag-deferred external integrations** (per `.planning/EXTERNAL-ENABLEMENT.md`): Personio/BambooHR (#19-22), Gusto/QB/ADP/DATEV native (#11-14), public-api writes (#8), outbound-webhooks (#17), developer-portal (#31), + not-yet-enabled markets ZATCA(SA)/Peppol(UAE)/IdP-Okta-Entra-GitHub/DPD-InPost/Slack/Teams/DocuSign-embedded. **A bug in a dark path is not a go-prod blocker — it is "harden before flipping that flag."** The full 123-row table lives in the audit-agent transcript; dispositioned here:

**FIX NOW (active path OR cheap security, verifiable without external artifact):**
| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| A-1 | 🔴 | `services/document-virus-scan.ts:33,72` | ClamAV scans only first 4100 bytes (reuses MIME-sniff Range) → malware past byte 4100 marked CLEAN. Active on EVERY upload | ✅ full-object GetObject for scan; 4KB read for MIME sniff only; 3 tests |
| A-58 | 🟠 | `routers/integrations/ksef.ts:224,362` | `ksef.connect`/`connectionStatus` return full row incl. `credentialsRef` (token ciphertext) to browser | ✅ `omit:{credentialsRef,connectedByUserId}` re-select |
| A-8 | 🟠 | `routers/core/esign.ts:100` → `docusign-adapter.ts:691` | client `connectionId` loaded with no `organizationId` check → cross-org e-sign IDOR | ✅ `loadIntegrationConnection(db, id, organizationId, {provider})` org-scoped; IDOR-guard test |
| A-10 | 🟠 | `services/token-refresh.ts:58` | Lost-lock `continue` still runs `finally` clearing the OTHER process's `refreshLockedAt` → double-refresh | ✅ claim outside try; lost-claim returns before try/finally |
| A-11 | 🟠 | `token-refresh.ts:161` + `pull-orchestrator.ts:284` | Refresh stamps `lastSyncAt` (the HRIS throttle field) → hourly sync skipped forever for short-TTL providers | ✅ removed lastSyncAt/lastSuccessAt writes from refresh (no field/migration added) |
| A-12 | 🟠 | `token-refresh.ts:146` + `personio-adapter.ts:71` | Refresh cron hard-fails providers lacking refreshToken (Personio) → REAUTH_REQUIRED | ✅ skip adapters without refreshToken handler before claim/markFailed |
| A-89 | 🟡 | `zatca-submission.ts:129` | `submitToZatca` loads invoice by id only, no org equality assert | 📦 (ZATCA dark) |

**📦 HARDEN-BEFORE-FLAG (dark external integration; verify needs the real system):** the built-but-unwired class — Peppol outbound legal_entity_id=0 (A-4/A-5), e-sign inbound org-resolution (A-7/A-9/A-73), KSeF hardened-client swap + cursor-by-issue-date + advisory-lock-leak + dup-hash P2002 (A-18/19/20/59/60/61), IdP Okta/Entra/GitHub unwired + permanent-failure deadlock (A-16/17/47/48/108), courier InPost-config/DPD-SOAP/idempotency (A-21/22/23/32-38), ZATCA QR-TLV + onboarding env-flip + audit-unwired (A-3/50-56), Slack token-crypto mismatch (A-2), regional-DB seam for dark webhooks (A-6/40/42/44/76), token-refresh resilience (A-28/29/67/68/69), + all 🟡/⚪ in dark adapters. **Tracked, not fixed pre-launch.** Each ships behind its default-off flag; harden + unmocked-seam-test before per-org flip. Systemic classes: built-but-unwired (mock-on-the-seam), regional-DB global-prisma, redelivery-dedup NULL key, pooled-conn advisory-lock leak, token-refresh-fights-sync.

**Verified-solid (A):** Stripe (sig-before-parse, unique+processedAt idempotency, outbox-in-tx, out-of-order watermark); QStash core (raw-body verify, fail-closed, typed registry, CAS claim, reaper); ClamAV gate aside from A-1 (fail-closed, magic-byte recheck, 3-layer size); outbound customer webhooks (SSRF DNS-rebind guard, HMAC replay window, DLQ, redaction); FX (BoE/ECB robust, stale error, ≤0 guard); feature flags (fail-closed compliance gates, kill-switch fail-safe); ZATCA crypto/chain-lock/atomic-first-submit; KSeF inbound Zod+pagination+session-finally; Peppol HMAC+idempotency+SSRF; e-sign outbound HMAC+OAuth-Zod+intent-idempotency; HRIS no-mass-deactivate+allowlist; IdP error-classifier+cooldown+forward-saga; Slack/Teams/Clockify/Jira/Linear sig-before-parse+per-conn-secret.

---

## Verification log

### F — Process integrity

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| F-1 | 🔴 | `apps/api/src/plugins/csrf-origin.ts:29` | `/webhooks-outbound/` NOT in CSRF exempt list (`/webhooks/` doesn't prefix-match) → QStash no-Origin callback 403s before signature check → all outbound webhook delivery dies. **VERIFIED in source** | ✅ added `/webhooks-outbound/`, `/contract-health/`, `/idp-deprovisioning/` to EXEMPT_PREFIXES |
| F-2 | 🔴 | `csrf-origin.ts:29` | `/contract-health/_run` not exempt → contract-health QStash callback 403s. **VERIFIED** | ✅ (F-1) |
| F-3 | 🔴 | `csrf-origin.ts:29` | `/idp-deprovisioning/_step-runner` not exempt → deprovisioning saga steps 403. **VERIFIED** | ✅ (F-1) |
| F-7 | 🔴 | `render.yaml:454` vs `virus-scanner.ts:15` | CLAMAV_HOST/PORT never set → defaults 127.0.0.1:3310 → every prod virus scan throws → docs fail-closed FAILED. Active on all uploads | ✅ `CLAMAV_HOST` via `fromService{pserv:clamav,property:host}` + `CLAMAV_PORT=3310` on api-server + cron-worker |
| F-5 | 🟠 | `packages/db/prisma/schema/migrations/` | Fresh-DB replay broken: 22 models no CREATE TABLE (rebase dropped `1a1dd3a86` fixes); `db:migrate:all` fails on new-region provisioning. EU/ME live via db-push | 📦 deploy-ops (new-region only; matches drift-gate handoff) |
| F-8 | 🟠 | `apps/cron-worker/src/jobs/job-meta.ts:30` | Missing meta for `hris-sync`, `api-key-leak-alarm`, `year-end-1099-reminder` → job-health can't detect their scheduler death | ✅ 3 meta entries added (HOUR/HOUR/DAY+catchUpOnBoot) |
| F-6 | 🟠 | `render.yaml` vs `webhooks/storecove.ts:195` | STORECOVE_WEBHOOK_SECRET absent from render.yaml (Peppol dark; cheap add) | ✅ added to app-shared (sync:false) |
| F-9 | 🟠 | `webhooks/fan-out.ts:60` | Outbound WebhookDeliveryAttempt no reaper (job-health scans inbound only) → PENDING strands on publish blip | 📦 (outbound-webhooks flag-dark #17) |
| F-11 | 🟡 | `google-workspace.ts:88` | GWS QStash schedule not deleted on disconnect (ksef/peppol do) | 📦 (GWS dark) |
| F-4 | 🟠 | `queue.ts:42` vs `peppol.ts:202` | `peppol.inbound` dead consumer (zero producers) + payload shape mismatch | 📦 cleanup |
| F-13 | 🟡 | `render.yaml:658` | cron-worker envVars missing 7 newer CRON_* overrides; header lists non-existent services | ✅ 7 CRON_* overrides added (sync:false); header left |
| F-14 | 🟡 | `.env.example` | 14 of 22 CRON_* keys + AUTH_COOKIE_* undocumented (repo env rule) | ✅ 14 CRON_* + AUTH_COOKIE_* commented defaults added |
| F-15 | 🟡 | `webhook-dispatcher.ts:87` + `late-interest-pdf-reaper.ts:67` | raw `process.env.API_URL ?? ''`; reaper stale PUBLIC_APP_URL fallback to dead SPA route | 📦 (outbound dark) |
| F-16 | ⚪ | `packages/validators/src/env.ts:18` | API_URL defaults localhost even in prod → jobs publish to unreachable dest if unset | ✅ superRefine fails when NODE_ENV=production + API_URL localhost default |
| F-12 | 🟡 | `queue.ts:9` + 9 producers | 9+ producers bypass typed `enqueueJob` with raw publishJSON (drift class) | 📦 refactor |
| F-10 | 🟡 | `apps/cron-worker/src/index.ts:64` | SIGTERM doesn't await in-flight tick (bounded by catchUpOnBoot) | 📦 |
| F-17 | ⚪ | `outbox/index.ts:511` | No FAILED-backlog gauge (per-event Sentry only) | ✅ `job-health` fans out `SUPPORTED_REGIONS`, gauges `jobs.outbox.failed_backlog`, Sentry alert >10 + unhealthy; 2 tests (8/8 suite green, cron-worker typecheck green) |

**Verified-solid (F):** all 11 JobRegistry routes registered + producer↔consumer URL match; every QStash worker uses `guardQStashRequest` (Receiver current+next, 401/500 fail-closed, Zod, backpressure); outbox in-tx dedup + FOR UPDATE SKIP LOCKED + regional fan-out both count+drain; cron registry(21)↔env 1:1 + boot schedule validate + overlap/advisory-lock/timeout/CronJobRunState + catchUpOnBoot + inbound reaper; no top-level network await at boot; new wave migrations lexically last + match schema; every `getServerEnv().KEY` exists in schema.

---

## Fix plan (waves)

FIX-NOW = active-path OR cheap-security OR cheap-config, verifiable without external artifact. 📦 = dark-behind-flag or deploy-ops (tracked, harden before flag-flip). Dispatched as 6 parallel scoped fix agents (disjoint file sets).

---

## Verification log

_(fix-wave results: suites + gates re-run after fixes)_

### Final gates — 2026-07-10 (post all 6 fix waves + F-17 + wiki sync)

| Gate | Result |
|------|--------|
| `pnpm typecheck --force` | ✅ 49/49 (prior run this round) |
| `pnpm -F @contractor-ops/api test` (full) | ✅ 4433 passed / 0 fail (prior run this round) |
| `packages/validators/.../employee-country-fields.test.ts` + `apps/api/.../multi-provider-webhook.test.ts` | ✅ 2 files / 24 tests |
| `pnpm lint:ci` (full: biome.ci, breadcrumbs, raw-sql, webhook-routes, silent-catch, i18n-parity, table-pattern, architecture, wiki-brain) | ✅ EXIT 0 |
| web-vite scoped tests — contractors/approvals/settings/payments/employee-time | ✅ 1220 (prior run this round) |
| web-vite scoped tests — billing/invoices/layout/onboarding/peppol/auth | ✅ 650 passed / 1 skipped |
| web-vite scoped tests — portal/reports/workflows/zatca/employees | ✅ 767 passed (122 files) |
| `apps/web-vite` `pnpm typecheck` | ✅ EXIT 0 |
| `job-health.test.ts` (F-17) + `pnpm typecheck --filter=@contractor-ops/cron-worker` | ✅ 8/8 + green |
| `errors-i18n-parity` | ✅ 6/6 (via lint:ci) |
| `pnpm check:wiki-brain` | ✅ 0 errors (re-run after wiki sync below) |

### Addendum — belt-check sweep (2026-07-10, post-verdict-draft)

"Super ready?" belt-check ran full suites for every workspace package with uncommitted src changes (previous gates covered packages/api full + web-vite scoped only). Found + fixed two red classes, both **test-side drift behind already-correct production code**:

| Found | Fix | Evidence |
|-------|-----|----------|
| `apps/api` suite 5 files red (peppol-inbound/outbound/poll, process-webhook, zatca-submit) + latent in outbox-drain: `vi.mock('@contractor-ops/db')` factories predate the rebase's regional helpers (`resolveOrganizationRegion`, `findAcrossRegions`, `tryGetRegionalClient`, `SUPPORTED_REGIONS`) — mocks-didn't-follow-API | Factories extended with faithful single-region mirrors delegating to each test's mocked client (not-found branches stay real); peppol-poll single-org assertion rewritten to current design (region locate, no participant sweep — CONNECTED gate lives in `pollParticipant`) + new org-not-found test; zatca fixture `'ACCEPTED'`→`'CLEARED'` (invalid enum member); peppol-inbound mock arg-signature TS2554 | `api-server` 34/34 files, typecheck --force 17/17, biome 0, zero mock-export errors in output |
| `packages/validators` env.test red: F-16 superRefine (prod refuses localhost API_URL default) not reflected in "accepts all valid NODE_ENV values" loop | production case supplies real API_URL + new negative test asserting the API_URL issue path | validators 47/47 files |

Remaining changed packages' full suites all green first-run: cron-worker 20/20, public-api 19/19, einvoice, db, integrations, compliance-policy, payroll, classification, auth, shared (turbo 15/15 after validators fix).

### Go-prod verdict

**GO** for the active-path surface. Every finding in this document is ✅ (fixed, evidence inline) or 📦 (accepted backlog with reason); none open. The 📦 set is exclusively (a) default-OFF flag-deferred external integrations — harden before each flag flip, per `.planning/EXTERNAL-ENABLEMENT.md` — and (b) deploy-ops items that need the real environment (F-5 fresh-DB migration replay for new regions, C-7 at-rest SEPA encryption backfill, WHT/peppol migrations apply, ClamAV + STORECOVE render env values). Working tree only — NOT committed per user directive.
