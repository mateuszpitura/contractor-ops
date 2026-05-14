# R2 Code-Quality + Consistency Review

**Reviewer:** R2 (second-opinion)
**Date:** 2026-05-05
**Scope:** Audit-fix landings (Tier-1 + Phase 2 + Phase 3 + two sweep waves) on `main` since 2026-05-03.
**Method:** Spot-check, not exhaustive — six audit reports + plan + runbook + COMMIT-ATTRIBUTION read; ~25 grep/Read passes against HEAD; six git-show verifications; no edits.

---

## TL;DR

Phase 1/2/3 landed substantively — every architectural milestone the runbook claims (transactional `OutboxEvent` + drain at `/api/outbox/_drain`, `PendingUpload` for server-derived storage keys, `OAuthChallenge` single-use replay protection, `Member.disabledAt` per-membership soft-disable, `withRlsSession` SET LOCAL plumbed into the tenant tx middleware, `cachedSingleflight` on the dashboard hot path, F-INT-01 `fetchWithTimeout` rolled out to most adapters, `verifyTurnstileToken` fail-closed in production, `PLATFORM_OPERATOR_ORG_ID` admin gate, F-OBS-03 traceparent threading across QStash producer/consumer, advisory-lock guards on reminders + trial-notifications + ZATCA hash chain) is **physically present in HEAD** and the COMMIT-ATTRIBUTION caveats reproduce on `git show`. The "all green" Phase grades are not a fabrication.

That said, three classes of drift survive that the audit team's self-grades did not flag:

1. **F-INT-01/02 is incomplete.** Three adapters at the OAuth-token / GraphQL surface — `jira-adapter.ts`, `linear-adapter.ts`, `teams-adapter.ts` — still call raw `fetch()` for token exchange and the Linear GraphQL endpoint, despite F-INT-01 having been declared closed. Five adapters in total (jira, linear, teams, ksef, resend, claude-ocr, clockify) lack a `fetchWithTimeout` import in their entire file.
2. **Idempotency-key derivation rules are not consistent across providers.** `auth-emails.ts` uses `sha256("auth:" + ...)`, Storecove uses `sha256(canonical-document-string)`, DocuSign uses `sha256("envelope-" + ...)`, Google Calendar encodes the key into the event id, Outlook into `client-request-id`, while the outbox tells handlers to use `OutboxEvent.id`. There is no single helper or documented contract — P2-B's "settled" decision (`sha256(\`${orgId}:${businessKey}:${operation}\`)`) is not what most callsites do.
3. **`F-DB-04` defense-in-depth RLS coverage is partial AND the runbook downplays it.** The runbook says "B-A2 wired `withRlsSession`… coverage is partial" and points to `tenant.ts:117` as a documented `TODO(F-DB-04)`. That TODO survives. Non-tx `ctx.db.X.findMany()` in router code is the dominant pattern. Marketing this as "closed" in the runbook overview ("roughly 125 findings closed") is misleading — F-DB-04 is **scaffolded**, not closed.

**Counts:** 4 DRIFT, 5 DEAD-/orphaned, 4 CLAIM divergences, 4 CONTRACT inconsistencies, 3 DEBT items. None are CRITICAL on their own; one (F-INT-01 hole on jira/linear/teams token fetch) is HIGH and should block declaring resilience-quick-wins complete.

---

## Pattern drift findings

### DRIFT-01 — Idempotency-key derivation has 6 different schemes (HIGH)
**Files:** `packages/auth/src/auth-emails.ts:75-91`, `packages/integrations/src/adapters/docusign-adapter.ts:352-367`, `packages/integrations/src/adapters/google-calendar-adapter.ts:47-48,259-274`, `packages/integrations/src/adapters/outlook-calendar-adapter.ts:43-44,261-289`, `packages/einvoice/src/asp/storecove/client.ts:54-69`, `packages/api/src/services/outbox/index.ts` (handler contract).

**Description:** P2-B's design doc (`NEXT-PHASE-PLAN.md` § "Settled (was open)") commits to `sha256(\`${orgId}:${businessKey}:${operation}\`)` server-derived. In HEAD, every provider rolls its own:

- **auth-emails.ts** → `sha256("auth:" + template + to + body)` — no `orgId` in the input (auth happens before tenancy is established, so this is defensible, but it diverges from the contract).
- **docusign-adapter** → `"envelope-" + sha256(...)` — no `orgId` namespace either.
- **google/outlook calendar** → uses caller-supplied `idempotencyKey` and encodes it into a provider-specific id (Google `event.id` base32, Outlook `client-request-id` UUIDv4-format). The conversion is silent and lossy — two `idempotencyKey` values that hash to the same 36-char prefix collide. None of the four adapters validate against this.
- **storecove client** → `sha256(canonical-doc-string)` — fine, but the canonical-string composition is ad-hoc.
- **outbox handlers** → "use `OutboxEvent.id`". This is the *only* layer that follows the spirit of the P2-B contract, but only because OutboxEvent.id is itself a UUID, not the composed business-key the design called for.

**Risk:** Same business operation re-tried via two paths (e.g. inline + outbox replay) produces two different idempotency keys → duplicate downstream effects. This is the exact bug F-INT-04 was supposed to close.

**Recommended fix:** Add `packages/integrations/src/services/idempotency.ts` exporting `deriveIdempotencyKey({ orgId, operation, businessKey })`. Refactor all six callsites to consume it. Document the contract in a single place. Effort: ~half-day.

### DRIFT-02 — Throttling/concurrency caps stack without composition rules (MED)
**Files:** `apps/web/src/middleware.ts:529` (F-SCALE-19 backpressure semaphore), `packages/integrations/src/adapters/google-calendar-adapter.ts` + `slack-adapter.ts` (p-limit), `packages/integrations/src/services/resilience.ts` (opossum + p-retry + p-limit), `apps/public-api/src/lib/rate-limiter.ts` (Upstash + LRU fallback per F-SCALE-15), `packages/auth/src/config.ts` (Better Auth rate limiter F-SCALE-20).

**Description:** Five distinct throttle mechanisms exist:
1. tRPC body cap (F-SCALE-17, 1 MB, env-tunable)
2. Public-API rate limiter (Upstash + LRU fallback, fail-closed in prod)
3. Better Auth's built-in limiter (F-SCALE-20)
4. QStash backpressure semaphore on heavy consumers (F-SCALE-19)
5. p-limit per adapter (calendars, notifications)
6. opossum breaker + p-limit composed inside `withResilience` (P2-B foundation; rolled out only to a subset)

There's no documented order-of-evaluation when a heavy notification fan-out goes: rate-limiter → tRPC → service → resilience.withResilience → adapter p-limit → fetchWithTimeout. The same call can be capped twice; no composition tests exist.

**Risk:** Hidden double-throttling that surfaces under load as user-visible 429/503 storms. Also: `Tier-2 follow-ups` says F-INT-05 circuit-breaker rollout to all 14 adapters is mechanical — but mechanical rollouts that don't think about composition will create deadlocks (opossum half-open + p-limit slot exhaustion + fetchWithTimeout 30s = 30s held semaphore slot).

**Recommended fix:** A short ADR in `.planning/` describing the order. Mostly documentation; no code change required immediately. Effort: ~2h.

### DRIFT-03 — Audit log writes use two patterns (MED)
**Files:** `packages/api/src/routers/core/reminder.ts`, `packages/api/src/routers/core/settings.ts`, `packages/api/src/routers/core/contract.ts`, `packages/api/src/routers/portal/portal.ts`.

**Description:** Most F-OBS-05 audit writes go through `writeAuditLog` from `packages/api/src/services/audit-writer.ts` (good — centralised helper, single signature, append-only contract enforced). But `portal/portal.ts:1404` and `:1495` call `tx.auditLog.create({ … })` directly (bypassing the helper), and `contract.ts:749` uses `tx.auditLog.createMany({ … })` for the bulk-transition case.

Three different shapes for the same audit row → schemas drift over time. The helper has an explicit `before/after` JSON discipline; the direct calls do not enforce it.

**Recommended fix:** Move portal direct calls onto `writeAuditLog`; add a `writeAuditLogMany` overload to handle the bulk-transition case. Effort: ~1h.

### DRIFT-04 — Advisory lock keys lack a namespace convention (LOW)
**Files:** `apps/web/src/app/api/cron/reminders/route.ts:416`, `apps/web/src/app/api/cron/trial-notifications/route.ts:149`, `packages/api/src/services/zatca-hash-chain.ts:71`, `packages/api/src/routers/finance/payment.ts:420`, `packages/api/src/lib/advisory-lock.ts`.

**Description:** All callsites use `pg_advisory_xact_lock(hashtext($1))` (xact = transaction-scoped, auto-released on commit/rollback — this part is correct everywhere). However, the `$1` payload is each caller's choice: reminders pass an org-scoped string, trial-notifications similarly, ZATCA passes `organizationId` raw, payment passes a payment-run-id. Hash collision in `hashtext` (a 32-bit Postgres function) is rare but not impossible across millions of orgs, and there's no shared `lockKey()` helper that prefixes the key with a namespace (e.g. `reminder:`, `zatca:`, `payment-run:`).

**Risk:** One in 4 billion (per pair) collision is fine today; bad debugging story when `pg_locks` shows a colliding lock and you can't tell which subsystem holds it.

**Recommended fix:** Wrap `tryAcquireAdvisoryLock` in `packages/api/src/lib/advisory-lock.ts` with a typed `Namespace` first argument. Effort: ~30 min.

---

## Dead code findings

### DEAD-01 — F-SCALE-19 backpressure documented as deferred but commit landed (LOW)
**File:** `apps/web/src/middleware.ts:529` says `// F-SCALE-19 — QStash queue-depth backpressure (deferred — TODO)`. But `git log` shows three F-SCALE-19 commits (`0cb3cb75`, `6f8763ac`, `5b1657fd`) including a probe at `/api/health`. The "deferred" comment is now stale.

**Recommended fix:** Update the comment or remove the TODO. ~5 min.

### DEAD-02 — `apps/web/src/components/contractors/classification/drv-clearance/index.ts` shows as deleted but the panel survived (LOW)
**File:** From `git status` — `D apps/web/src/components/contractors/classification/drv-clearance/index.ts`, but `M apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx` is still modified. If the index re-export is gone, every consumer of `import { DrvClearancePanel } from '.../drv-clearance'` now imports from a non-existent barrel. (This is uncommitted working-tree state, not on `main`, but flag-worthy because it suggests an incomplete refactor.)

**Recommended fix:** Either restore the barrel or update consumers. Out of scope for this audit review but should not be merged as-is.

### DEAD-03 — Surviving `TODO(F-…)` annotations (LOW)
The runbook §8 lists six known TODOs. HEAD-grep confirms five of them physically (`google-calendar-adapter:17`, `outlook-calendar-adapter:17`, `webhook-dispatcher:78`, `register-all:66`, `tenant.ts:117`, `cron/job-health:81`, plus `middleware.ts:529`). All match the runbook list — **so this category is clean**.

The audit-related cluster I'd add: `packages/api/src/routers/core/contract.ts:729` notes "Phase 60 CLASS-08 still wants one audit row" — that's a Phase-60-era TODO, not Phase-2/3, but it's in the audit-touched routers and worth tracking for someone closing CLASS-08.

### DEAD-04 — `withRlsSession` exported twice (LOW)
**File:** `packages/db/src/index.ts:35-36` re-exports both `withRlsReads` and `withRlsSession`. Both are real APIs — no duplication. But many call sites import from `'@contractor-ops/db'` while `__tests__/*` mock with `withRlsReads: <T,>(c: T) => c` (passthrough). The mock for `withRlsSession` is missing in most test files I sampled. If a test exercises a tx middleware that does `await withRlsSession(tx, ctx)` and the mock chains don't provide a callable, the test silently no-ops. Likely intentional, but undocumented.

**Recommended fix:** Add a comment in `tenant.ts` middleware explaining the test-mock contract.

### DEAD-05 — `cachedSingleflight` exists; `cached()` still has callers (LOW)
**File:** `packages/api/src/services/cache.ts:148` defines `cachedSingleflight`; line 129 has the migration note. Quick grep didn't reveal a sweep that removed all `cached()` callers — they may still exist for non-hot-path reads, which is fine, but no policy doc says when to use which.

**Recommended fix:** A short comment in `cache.ts` clarifying the policy ("hot path / dashboard → cachedSingleflight; everything else → cached"). Effort: ~10 min.

---

## Audit-claim-vs-HEAD divergences

### CLAIM-01 — F-INT-01/02 not closed for jira/linear/teams (HIGH)
**Audit claim:** `03-integrations.md` F-INT-01 says only 4/14 adapters use `fetchWithTimeout` and proposes closing the gap; the synthesis `00-SYNTHESIS.md` puts F-INT-01/02 in Tier-1 group D ("Resilience quick wins"). The runbook does not list F-INT-01 as a deferred item.

**HEAD reality:** Out of 17 adapter files, 9 still have **zero** `fetchWithTimeout` imports: `base-adapter.ts`, `claude-ocr-adapter.ts`, `clockify-adapter.ts`, `jira-adapter.ts`, `ksef-adapter.ts`, `linear-adapter.ts`, `register-all.ts` (registry, not a fetch surface — exclude), `resend-adapter.ts`, `teams-adapter.ts`. Of these, the OAuth token exchange and GraphQL endpoints in `jira-adapter.ts` (lines 80, 128, 285), `linear-adapter.ts` (81, 135, 322), `teams-adapter.ts` (163, 221) are bare `fetch(...)` with no timeout. KSEF and Resend may go through SDKs (which have their own timeouts), but jira/linear/teams definitely don't.

**Recommended fix:** Either (a) close the gap by routing the 8 token/GraphQL fetches through `fetchWithTimeout`, OR (b) add F-INT-01/02 to the runbook §8 deferred TODO list with a reason. Effort: 2h for option (a), 5 min for option (b). Option (a) is the right answer.

### CLAIM-02 — `F-DB-04` declared closed in runbook overview, contradicted by runbook §8 + §9 (MED)
**Conflict:** Runbook §1 says "roughly 125 findings closed". §9 lists F-DB-04 as a Tier-2 follow-up, "scaffolded", needing a real Postgres `CREATE POLICY` to be considered done. The TODO at `tenant.ts:117` survives. The original critical finding was about an **unused** `withRlsSession` export — that part is fixed (`SET LOCAL` is wired into tenant tx middleware). But the audit's exit criterion ("one missed `where: organizationId` = cross-tenant exposure") is not met because non-tx `findMany` calls bypass the SET LOCAL.

**Recommended fix:** Re-classify F-DB-04 as "scaffolded, partial" in §1 / synthesis follow-ups so future audits don't read this as resolved. Effort: 5 min.

### CLAIM-03 — COMMIT-ATTRIBUTION verified for two of seven (PASS)
**Verified:**
- `git show 8c79880c --stat` confirms the F-OBS-03 commit also contains `packages/db/src/rls.ts` (+72) and `packages/db/src/__tests__/rls.test.ts` (+83) as the table claims.
- `git show e26dd055 --stat` confirms the F-OBS-08 PII scrubber also contains `packages/api/src/services/oauth-challenge.ts` (+207), `packages/db/prisma/schema/oauth-challenge.prisma` (+49), and the OAuth callback/start route additions.

I did not spot-check the other five rows but the methodology was correct on the two I sampled — trust-but-verify yields verify on this table.

### CLAIM-04 — Env-var blocking semantics audit (PASS)
**Verified the four "blocking" entries from runbook §2:**
- `PLATFORM_OPERATOR_ORG_ID`: `apps/web/src/lib/admin-auth.ts:45` reads `getServerEnv().PLATFORM_OPERATOR_ORG_ID`; `:54` logs and rejects when unset. **Fail-closed: yes.**
- `TURNSTILE_SECRET_KEY`: `packages/auth/src/turnstile.ts:52-67` reads the secret; if unset and `NODE_ENV==='production'`, logs `auth.turnstile.unconfigured` and returns false. **Fail-closed: yes.**
- `R2_HEALTHCHECK_KEY`: `packages/integrations/src/services/health-service.ts:248` and `apps/web/src/app/api/health/route.ts:40` both fall back to `'_health/canary.txt'`. The runbook claims "if unset, /api/health fails" but the code uses a hardcoded default. The probe will succeed if the bucket has `_health/canary.txt` regardless of env-var setting. **Fail-closed: NO — runbook description is incorrect.** Severity LOW because the probe still works if ops uploaded the canary; just the documentation lies.
- `EMAIL_FROM` / `RESEND_API_KEY`: `packages/validators/src/env.ts:66-68` — RESEND_API_KEY is `z.string().min(1)`, EMAIL_FROM is `z.email().default('noreply@…')`. Boot fails on missing RESEND_API_KEY. **Fail-closed: yes.**

**Recommended fix:** Correct the runbook §2 row for `R2_HEALTHCHECK_KEY` — say "default `_health/canary.txt` is read if unset; ensure that file exists in the bucket". Effort: 2 min.

---

## Broken contracts

### CONTRACT-01 — Schema/mock alignment for `Member.disabledAt` (PASS, mostly)
**Schema:** `packages/db/prisma/schema/organization.prisma:159` adds `disabledAt DateTime?` plus `@@index([organizationId, disabledAt])`. Auth-config reads it (`packages/auth/src/config.ts:61-72`) to reject session creation when set.

**Test mocks:** Sampled — the auth tests (`packages/auth/src/__tests__/`) and the routers that previously called the global `banUser` (now `disableMember` per F-SEC-07) appear updated. I didn't fan out to every member-mocking test, so high confidence not full confidence.

### CONTRACT-02 — `F-DB-18` consumers updated (PASS)
**Audit claim:** F-DB-18 collapsed `update + findUniqueOrThrow` into `update({ include })` for workflow `startRun`. Commit `62b28dbd` confirms.

**Verification:** Did not full-trace every caller, but the touched file is `workflow-execution`-scoped and confined.

### CONTRACT-03 — `cachedSingleflight` rollout (PARTIAL)
See DEAD-05. Both APIs co-exist; no policy doc. Not "broken", just under-documented.

### CONTRACT-04 — `OutboxEvent` consumer dispatch contract (MED)
**File:** `packages/api/src/services/outbox/index.ts` documents: "Each handler receives the OutboxEvent.id; it MUST pass that id as the downstream provider's idempotency key."

**Reality check:** Inside outbox handlers (`handlers.ts`), I'd expect every dispatch to pass `event.id` through. The biome-ignore on `handlers.ts:108` (`registry-driven dispatch`) signals registry mapping is dynamic — meaning the type system can't enforce that all registered handlers pass `event.id` through. This is a runtime contract, not a compile-time one. A handler that forgets is a silent bug.

**Recommended fix:** Add a runtime assertion or type-level guard in the handler signature (`handler: (event, helpers: { idempotencyKey: string }) => Promise<void>`) so the dedup key is supplied to handlers as a positional, not pulled from `event.id` ad-hoc. Effort: half-day.

---

## Hidden test debt

### DEBT-01 — Five `it.todo` in workflow-execution router tests (LOW)
**Files:** `packages/api/src/routers/__tests__/workflow-execution-template-selection.test.ts:97-100` (2 todos), `packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts:54-58` (3 todos).

These are pre-existing (not Phase-2/3-introduced) per a quick blame check. Not a regression but unclosed.

### DEBT-02 — `e2e/` test.skip on missing fixture data (~30 occurrences) (LOW)
**Files:** `apps/web/e2e/functional/*.spec.ts`, `apps/web/e2e/rtl/rtl-localization.spec.ts`, `apps/web/e2e/integration/*-smoke.spec.ts`, `apps/web/e2e/perf/helpers.ts`.

These are guarded by `test.skip(condition, 'reason')` and the condition is "no test data / no E2E credentials in CI". Defensible, but every guarded skip is a test that doesn't run on CI today and won't catch a regression. Not introduced by the audit; flag for future seeding work.

### DEBT-03 — Coverage gap: backpressure / replica / withRlsReads (MED)
**Source vs test files for new modules:**
- `packages/db/src/replica.ts` — `replica.test.ts` exists (good)
- `packages/db/src/rls.ts` — `rls.test.ts` + `rls-integration.test.ts` (good — integration test gated by `hasDb`)
- `packages/api/src/services/outbox/` — `outbox.test.ts` exists (good)
- `packages/api/src/services/exports/` — has `__tests__` (good)
- `packages/integrations/src/services/resilience.ts` — has `__tests__` (good)
- **No dedicated test file for the QStash backpressure semaphore** introduced in `0cb3cb75`. Wired into `apps/web/src/middleware.ts:529` and consumer routes; the only verification is the F-SCALE-19 health probe added in `5b1657fd`. Direct unit coverage of "semaphore returns 503 when slots exhausted" is missing.

**Recommended fix:** Add a Vitest unit test for the backpressure semaphore behaviour. Effort: 1-2h.

---

## Recommendations (ranked by effort × impact)

| # | Item | Effort | Severity | Why |
|---|------|--------|----------|-----|
| 1 | Close F-INT-01/02 hole on `jira`/`linear`/`teams` adapter raw `fetch(...)` calls (8 sites) | 2h | HIGH | Audit declares this Tier-1 closed; leaving production-bound HTTP without a timeout is the single highest-impact omission found. |
| 2 | Add `deriveIdempotencyKey({ orgId, operation, businessKey })` helper + refactor 6 callsites | 4h | HIGH | DRIFT-01. The exact bug F-INT-04 was supposed to prevent — same op via two paths, two keys. |
| 3 | Re-classify F-DB-04 in synthesis / runbook as "scaffolded — partial" | 5 min | MED | CLAIM-02. Cosmetic but matters for future audits and ops trust. |
| 4 | Correct runbook §2 row for `R2_HEALTHCHECK_KEY` (default applies; not strictly blocking) | 2 min | LOW | CLAIM-04. Documentation matches reality. |
| 5 | Move portal-direct `tx.auditLog.create` calls onto `writeAuditLog` helper; add `writeAuditLogMany` for contract bulk-transition | 1h | MED | DRIFT-03. Keep audit writes single-shape over time. |
| 6 | Add `tryAcquireAdvisoryLock` namespace prefix wrapper | 30 min | LOW | DRIFT-04. Pure debuggability win; no immediate bug. |
| 7 | Add unit test for QStash backpressure semaphore (slot exhaustion → 503 + Retry-After) | 2h | MED | DEBT-03. The most user-visible new throttle has no isolated coverage. |
| 8 | Stale comment cleanup at `middleware.ts:529` ("deferred — TODO" vs. landed F-SCALE-19 commits) | 5 min | LOW | DEAD-01. |
| 9 | Document `cached()` vs. `cachedSingleflight` policy in `packages/api/src/services/cache.ts` header | 10 min | LOW | DEAD-05 / CONTRACT-03. |
| 10 | ADR for throttle-stack composition order (rate-limiter → tRPC body cap → backpressure → service → resilience.withResilience → adapter p-limit → fetchWithTimeout) | 2h | MED | DRIFT-02. Matters most when F-INT-05 circuit-breaker rollout starts. |

---

## What I deliberately did NOT investigate

- **Sentry `beforeSend` PII scrubber correctness against real fixtures.** I read the commit (`e26dd055`) and the runbook smoke-test command (`grep Sentry for bankAccount/taxId/Authorization → 0 hits`); I did not attempt to run it.
- **Stripe `idempotencyKey` opt completeness.** Synthesis mentions Stripe in F-INT-04. I sampled the auth/calendar/storecove/docusign idempotency code paths for DRIFT-01 but did not chase the Stripe checkout path end-to-end.
- **Each of the seven COMMIT-ATTRIBUTION rows.** Sampled two; both verified; assumed the other five.
- **Full schema-vs-mock alignment for OutboxEvent / Export / WebhookDelivery.attempts.** Spot-checked Member.disabledAt only.
- **F-OBS-05 audit-log coverage on the claimed ~30 mutations across 11 routers.** I inspected the helper signature and 4-5 callsites; full-router coverage is a separate scan.

These are the most likely places for additional findings if a follow-up R2 pass is run.

---

## Closing note

The audit team's "all green" Phase grades hold up *for the architectural milestones they claim*. They do not hold up for the long-tail "and 14 adapters use fetchWithTimeout" claims — three high-traffic OAuth-token surfaces still don't, despite the Tier-1 sweep landing weeks ago. Severity is HIGH because (a) the bug class is exactly what F-INT-01 was supposed to prevent and (b) jira/linear/teams are the chattiest adapters in the codebase. The other findings are small. The architecture moves are solid; the polish has gaps.
