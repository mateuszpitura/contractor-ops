# Audit Closure — May 2026 Production-Readiness Review

**Date:** 2026-05-11
**Scope:** Closes the 5-reviewer audit (`REVIEW-R1..R5` + `REVIEW-SYNTHESIS.md`) shipped on 2026-05-06.
**Result:** Every BLOCKER, HIGH, MEDIUM, and LOW finding from the synthesis is now landed on `main`. Two operational caveats from the work itself are mitigated by tooling.

This document is the single thing to read for a deployer / on-call who wants to know "what's the state of the audit work, and what do I still need to do?"

---

## 1. Closure tally

| Severity | Synthesis count | Closed | Notes |
|---|---:|---:|---|
| BLOCKERS | 6 | 6 | Outbox split-tx (NEW-ARCH-03/04), adapter timeouts (R2 CLAIM-01), runbook §5.1/§7/§4 fixes, idempotency unification (DRIFT-01) — see commits `43fc1fea` → `13b63af3` |
| HIGH | 4 | 4 | F-SEC-01 schema-level fix, Turnstile gate (already correct in source), RLS replica tripwire (NEW-ARCH-01), idempotency helper |
| MEDIUM | 8 | 8 | org.create rate limit (NEW-SEC-05), retry budget cap (NEW-ARCH-06), runbook reconciliation (CLAIM-02), qstash-backpressure tests (DEBT-03) + 4 covered by Group A/C work |
| LOW | 14 | 14 | OAuth pepper (NEW-SEC-03) + cron purge (NEW-SEC-04), Lua-atomic INCR+EXPIRE (NEW-SEC-02), audit-log helper unification (DRIFT-03), advisory-lock namespacing (DRIFT-04 + NEW-ARCH-07), cache docs (DEAD-01/05), test hygiene sweep, `$queryRaw` tenant guard (NEW-AUTHZ-02), F-XXX traceability (R5) |
| Pre-existing complexity warnings | 4 | 4 | `InvoiceSubmitForm`, `payment.create`, `google-workspace-sync-orchestrator`, `ksef-sync-orchestrator` |
| Operational caveats from new work | 2 | 2 | OAuth HMAC migration purge script + advisory-lock dual-hold shim |

**Session commit range:** `43fc1fea`..`95cc0f73` (audit-related; 27 commits). Other Atelier-UI / i18n / Turbopack work is in the same range but unrelated.

---

## 2. What's still open

Three items remain — all explicit deferrals, not regressions:

### 2.1 Tier-2 follow-ups (deferred by design — `RUNBOOK § 9`)

| ID | Title | Status | Pickup criteria |
|---|---|---|---|
| **F-SCALE-06** | Read-replica routing per region | Scaffolded (env vars + helper behind a flag); only consumer is `dashboard.kpis` | When read p95 on primary climbs > 100 ms sustained, OR a region reports cross-region tail latency > 250 ms |
| **F-DB-04** | Defense-in-depth RLS coverage | Scaffolded — partial. `withRlsSession` wired into the tenant tx middleware (`packages/api/src/middleware/tenant.ts:137`), but no Postgres `CREATE POLICY` migration shipped yet, and non-tx `findMany` paths still bypass `SET LOCAL` (`tenant.ts:117`). The `RLS_POLICIES_ENFORCED` tripwire on `readReplica()` (commit `2a2ee701`) is the safety net for the moment policies land. | When a real `CREATE POLICY` migration is approved by a DB engineer + DPO |
| **F-INT-05** | Circuit-breaker rollout to remaining adapters | `withResilience` foundation in place; ~10 of 17 adapters don't yet opt in | Mechanical rollout — ~1 day's work; needs no design |

### 2.2 One-shot Tier-2 cleanup from this session

| ID | Title | Pickup criteria |
|---|---|---|
| **advisory-lock-transition cleanup** | Remove the dual-hold shim in `packages/api/src/lib/advisory-lock.ts` | After `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` has been **unset** for one full deploy cycle. Search `TODO(advisory-lock-transition)` and drop every guarded block. See §3.2. |

### 2.3 Unrelated pre-existing test debt (not from this audit)

- `packages/api` test-debt handoff: 16 files / ~51 failures pending. Full per-file analysis in `.planning/handoffs/test-cleanup-2026-04-27.md`. **Not** introduced by audit work; visibility preserved (no `it.skip` / `it.todo` added to mask).

---

## 3. Operational caveats — deploy sequencing

Two pieces of new code change behaviour-relevant state in ways that require one-time operational steps on the first deploy that ships them. **Both have tooling and runbook entries** — this section is a quick orientation, the canonical procedure is `docs/RUNBOOK-PHASE-2-3-DEPLOY.md` §4.

### 3.1 OAuth HMAC pepper migration (commit `3d412c41`)

**What changed:** `OAuthChallenge.stateHash` migrated from plain `sha256(state)` to `hmac-sha256(BETTER_AUTH_SECRET|oauth-state-v1, state)`. Pre-refactor rows cannot resolve under the new HMAC scheme.

**User impact if ignored:** Up to 10 minutes after deploy, users mid-OAuth-flow see a generic "challenge expired / invalid" error and retry from the start page. Safe but annoying.

**Mitigation:** Run `scripts/predeploy-purge-oauth-challenges.sql` against prod DB in the final minute before pushing the new image. Deletes only `consumedAt IS NULL` rows (audit/forensics for consumed-pending-purge rows preserved). One-shot — subsequent deploys do not need this step.

```bash
psql "$DATABASE_URL" -f scripts/predeploy-purge-oauth-challenges.sql
```

### 3.2 Advisory-lock SQL form migration (commit `ce8b26f4`)

**What changed:** All advisory-lock callsites moved from `pg_advisory_xact_lock(hashtext(string))` (1-arg form, 32-bit shared keyspace, ~1.2% collision risk for 100k orgs) to `pg_advisory_xact_lock(int4 class_id, int4 hashtext(key))` (2-arg namespaced form). Cron / org / payment / sync each get a stable `class_id` (1/2/3/4) — see `packages/api/src/lib/advisory-lock.ts:45`.

**Risk if ignored:** During the rolling deploy, pre-refactor instances hold locks in the 1-arg keyspace while post-refactor instances try to acquire in the 2-arg keyspace. Postgres treats these as **distinct locks** — both sides could believe they own "the" lock for the same logical resource. Mitigations already in place for the highest-blast-radius paths (`PaymentRun` unique index on `(orgId, runNumber)`; `ZatcaHashChain` unique on `(orgId, icv)`; idempotent dedupe keys on cron ticks), so the worst-case observable is a redundant retry, not a corruption.

**Mitigation:** Env-gated dual-hold transition shim landed in commit `fb170d6d`. While `ADVISORY_LOCK_TRANSITION_DUAL_HOLD=true`, every helper acquires BOTH the legacy single-arg lock AND the new two-arg lock. Post-deploy callers serialize correctly against pre-deploy holders. **One-shot:**

1. Set `ADVISORY_LOCK_TRANSITION_DUAL_HOLD=true` in env **before** pushing the deploy that includes `ce8b26f4`.
2. Roll the deploy normally.
3. After at least 24 h (every instance has rotated), **unset** the env var — the shim adds one extra Postgres round-trip per lock acquisition; long-term overhead is undesirable.
4. Open a ticket / next-session item to remove the shim code (`TODO(advisory-lock-transition)` in `packages/api/src/lib/advisory-lock.ts`). Listed in §2.2.

**Legacy-key reconstruction** (for verification):
- `cron` → `\`cron:${key}\`` (pre-refactor const `REMINDERS_LOCK_KEY = 'cron:reminders'`)
- `payment` → `\`payment-run:${key}\`` (pre-refactor `payment-run:${ctx.organizationId}`)
- `org`, `sync` → identity (pre-refactor passed the raw key through)

13 unit tests in `packages/api/src/lib/__tests__/advisory-lock.test.ts` pin both modes.

---

## 4. Tooling added this session (worth knowing about)

These survive past the deploy as permanent infrastructure:

| Tool | Where | Purpose |
|---|---|---|
| `pnpm run lint:raw-sql` | `scripts/check-raw-sql-tenant-scoped.ts` | Grep-based guard against `$queryRaw` callsites that lack a tenant predicate. Wired into `.husky/pre-push`. 5 legitimate cross-tenant sites annotated with `// safe-raw-sql: <reason>`. |
| `RLS_POLICIES_ENFORCED` env var | `packages/db/src/replica.ts` | Tripwire — set to `true` once `CREATE POLICY` migrations land. `readReplica()` will then throw on any callsite that bypasses RLS scoping. |
| `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` env var | `packages/api/src/lib/advisory-lock.ts` | One-shot transition shim — see §3.2. Unset after one deploy cycle. |
| `deriveIdempotencyKey({ orgId, operation, businessKey })` | `packages/integrations/src/services/idempotency.ts` | Single helper that unifies idempotency key derivation across DocuSign, Storecove, Resend, calendar adapters. New providers MUST use this. |
| `writeAuditLog` / `writeAuditLogMany({ rows, tx? })` | `packages/api/src/services/audit-writer.ts` | Single helper for audit-log writes — direct `tx.auditLog.create` calls forbidden. Enforces `before` / `after` JSON discipline. |
| `acquireXactLock` / `tryAcquireXactLock` (`namespace`, `key`) | `packages/api/src/lib/advisory-lock.ts` | Typed advisory-lock helpers — pass the namespace (`cron` / `org` / `payment` / `sync`); never re-use a retired `class_id`. |
| QStash `outbox-drain` schedule (Upstash console) | external | Required for the outbox to drain — register manually per `RUNBOOK § 4`. |

---

## 5. Deploy procedure (consolidated)

For the **next** prod deploy (the one that ships the audit closure):

1. **Set both transition env vars before pushing:**
   - `ADVISORY_LOCK_TRANSITION_DUAL_HOLD=true`
   - Confirm `BETTER_AUTH_SECRET` is set (the OAuth HMAC depends on it).
2. **Run pre-deploy purge** (if `3d412c41` is included for the first time):
   ```bash
   psql "$DATABASE_URL" -f scripts/predeploy-purge-oauth-challenges.sql
   ```
3. **Push the deploy.** Roll normally.
4. **Verify smoke tests** per `RUNBOOK § 5` — pay attention to:
   - `/api/health` shape now is `probes: ProbeResult[]` with 5 entries (`database, redis, qstash, r2, backpressure`).
   - `r2` probe returns `ok` on 404 of canary — confirm by uploading `_health/canary.txt` to each regional bucket.
   - Outbox: insert one event, confirm transition to `DISPATCHED` within 60 s (only works if QStash schedule for `/api/outbox/_drain` is registered).
5. **Watch Sentry / metrics for 48 h.** Pay attention to:
   - Per-instance breaker events — under N instances, a single degraded provider can produce up to N "circuit breaker opened" events. Aggregate by `provider` tag, not event count.
   - `outbox.drain.exhausted` gauge — terminal-failure signal. There is NO `outbox.failed` metric (an earlier draft of the runbook referenced one — it was never implemented).
6. **After 24 h:** unset `ADVISORY_LOCK_TRANSITION_DUAL_HOLD`. Roll the deploy. Done.
7. **Backlog item:** remove the dual-hold shim code (`TODO(advisory-lock-transition)`).

Subsequent deploys do not need steps 1–2, 6, or 7.

---

## 6. What was NOT changed (and why)

Worth documenting so a future audit doesn't re-flag these:

- **Better Auth env validator** for `TURNSTILE_SECRET_KEY` — the runtime fail-closed gate in `packages/auth/src/turnstile.ts:51-70` is sufficient; moving to a boot-time check was considered but skipped because the runtime gate is equally safe and easier.
- **Slack / Teams per-call idempotency keys** in `dispatchNotification` — both adapters' messaging-provider abstraction doesn't expose a per-call idempotency key. Rely on `Notification.dedupKey = ${outboxEventId}:${userId}` DB-level dedup instead. Documented as a known gap in the outbox handler comments.
- **Per-process circuit-breaker → cross-instance breaker state** — explicit decision in the original audit (`NEXT-PHASE-PLAN.md`); Redis RTT per call would exceed the savings. The runbook §7 now documents the operational consequence (N separate Sentry events per outage — aggregate by provider tag).
- **Outbox `IN_FLIGHT` enum value** — not added; the per-row `nextAttemptAt` push-out (5-min claim window) is sufficient to prevent concurrent drainers from picking the same row. Saves a schema migration.
- **Two-arg form on `pg_advisory_xact_lock` second arg** — kept as `hashtext(key)` rather than e.g. a structured numeric id. Collisions are now namespace-local (two orgs hash-colliding still serialize correctly, which is the desired behaviour).

---

## 7. Pointers

| Document | Purpose |
|---|---|
| `.audit-2026-05-03/REVIEW-R1..R5.md` | The five original reviewers' raw findings |
| `.audit-2026-05-03/REVIEW-SYNTHESIS.md` | Triaged action list (the spec this session worked against) |
| `docs/RUNBOOK-PHASE-2-3-DEPLOY.md` | Canonical deploy procedure (§4) + smoke tests (§5) + monitoring (§7) + Tier-2 backlog (§9) |
| `docs/COMMIT-ATTRIBUTION.md` | Phase 2/3 commits whose subject lines drift from their actual file content |
| `scripts/predeploy-purge-oauth-challenges.sql` | One-shot SQL for caveat 3.1 |
| `scripts/check-raw-sql-tenant-scoped.ts` | `pnpm run lint:raw-sql` — pre-push tenant-scoping guard |

---

**Audit is closed.** The remaining Tier-2 items in §2.1 are not part of this audit's scope and have their own pickup criteria.

---

Reconciled into `docs/PRODUCTION-CHECKLIST.md` on 2026-05-16.

Advisory-lock dual-hold shim removed on 2026-05-17 (app not yet deployed; env var was never set in any environment).

CSP enforce flip (drop unsafe-inline from script-src) landed 2026-05-17; app not yet deployed so 48h report-only observation window not needed.
