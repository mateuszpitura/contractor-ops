# Final Review Synthesis (R1–R5)

**Date:** 2026-05-06
**Source reports:** `REVIEW-R1-SECURITY.md`, `REVIEW-R2-CONSISTENCY.md`, `REVIEW-R3-ARCHITECTURE.md`, `REVIEW-R4-RUNBOOK.md`, `REVIEW-R5-TEST-DEBT.md`

## TL;DR

The audit's "all green" claim is mostly true but **not deploy-ready as written**. Five independent reviewers found **10 issues that block a clean cutover** and **~25 secondary items** worth handling before or during the next sprint. Nothing is a security catastrophe; the gaps are about completeness, documentation accuracy, and a couple of architectural composition bugs that bite once `CREATE POLICY` migrations land.

## Severity-grouped action list (no fix-ups in this session — for next session)

### BLOCKERS (cutover-day breakage if shipped as-is) — 6 items

1. **R4: `/api/health` runbook shape is wrong.** Runbook §5.1 expects `probes.{db,redis,qstash,r2}` object; code returns array of 5 with `database, redis, qstash, r2, backpressure`. Smoke test as written returns null.
2. **R4: `outbox.failed` metric referenced in runbook §7 doesn't exist** in the emitting code. Outbox emits gauges (`outbox.drain.{scanned,dispatched,retried,exhausted}`). On-call dashboard searching for it sees zero.
3. **R4: QStash schedule for `/api/outbox/_drain` not registered** in deploy checklist or `render.yaml`. Outbox ships dead until a 30s schedule POSTs the route.
4. **R3 NEW-ARCH-03: outbox status update + handler in same tx.** If row UPDATE fails after handler side-effect, drain re-fires. Move the UPDATE to a SEPARATE small tx after handler resolves.
5. **R3 NEW-ARCH-04: outbox `handleNotificationDispatch` ignores `ctx.outboxEventId`** and dedupes via business-bucket. Re-fire crossing the per-day boundary double-sends. Use the outbox event id as the canonical dedupKey.
6. **R2 CLAIM-01 (HIGH): F-INT-01/02 incomplete.** 8 raw `fetch()` callsites in jira-adapter / linear-adapter / teams-adapter still bypass `fetchWithTimeout`. Audit declared this Tier-1 closed; runbook lists no deferral. Either finish the rollout or amend the runbook to flag.

### HIGH — fix this sprint (4 items)

7. **R1 NEW-SEC-01: Turnstile fail-closed gating.** Currently keys on env-var presence, not `NODE_ENV`. A misconfigured prod with `TURNSTILE_SECRET_KEY` unset silently disables anti-enumeration. Gate on `NODE_ENV === 'production'` regardless of env-var presence.
8. **R1 F-SEC-01 partial: portal `submitInvoice` still accepts `storageKey` input** (ignored server-side). Remove the field from the input schema.
9. **R2 DRIFT-01: idempotency-key derivation has 6 different schemes** across providers. P2-B "settled" on `sha256(orgId:businessKey:operation)` — honored nowhere. Same op via two paths produces different dedup keys. Pick one helper, route every callsite through it.
10. **R3 NEW-ARCH-01: `readReplica()` bypasses both RLS extensions.** Latent today (no DB policies yet); breaks the moment `CREATE POLICY` lands. Either wire RLS to the replica path OR add a runtime guard rejecting replica use after the policy migration.

### MEDIUM — within 2 weeks of deploy (8 items)

11. **R1 NEW-SEC-05:** `organization.create` is `publicProcedure` with no per-IP rate cap; Better Auth's gate is brittle. Add Upstash rate limit.
12. **R3 NEW-ARCH-02:** outbox drain holds row locks for the entire 100-row batch in one tx. Slow handler + 60s `maxDuration` rolls back the whole batch after side-effects shipped. Per-row tx scope.
13. **R3 NEW-ARCH-06:** retry compounding (resilience 3-5× × outbox 10× × QStash 3-5×) — worst case ~60 calls per logical event. Document the budget; cap one layer.
14. **R2 CLAIM-02:** F-DB-04 self-contradictory in runbook (§1 says "closed", §9 says "scaffolded, partial"). Reconcile.
15. **R4 RUNBOOK-FIX-04:** §5.4 OAuth smoke test greps for wrong cookie name (`oauth_state` vs `__Host-oauth_state`). Case-sensitive prefix.
16. **R4 RUNBOOK-FIX-06:** §7 Sentry tag is `org.id` not `app.org_id`.
17. **R4 RUNBOOK-FIX-07:** §7 `pg_stat_activity` query filters `application_name LIKE '%tenant%'` but Prisma doesn't set such an `application_name`. Returns zero rows.
18. **R5: qstash-backpressure.ts has no direct unit test** (332 LoC hot path service).

### LOW — sprint backlog (10+ items)

- R1 NEW-SEC-02 backpressure INCR/EXPIRE leak window
- R1 NEW-SEC-03 oauth-challenge no server-side pepper on stateHash
- R1 NEW-SEC-04 OAuthChallenge cron purge unverified
- R1 Pass-3: `$queryRaw` rely on hand-WHERE for tenant scoping (lint rule recommended)
- R2 CLAIM-04: `R2_HEALTHCHECK_KEY` mislabeled "blocking" in runbook (has default)
- R2: audit log writes use 2 patterns (writeAuditLog vs direct tx.auditLog.create)
- R2: advisory lock keys lack namespace prefix
- R2: `cached()` vs `cachedSingleflight` selection policy undocumented
- R3 NEW-ARCH-07: 32-bit hashtext collision (use two-int form)
- R3 NEW-ARCH-08: per-process breaker decision not in runbook
- R5: 3 vacuous tests in recompute-compliance-button (assert true)
- R5: 17 stale `console` spy suppressions across 9 service tests
- R5: 0 source-resident `F-XXX-NN` traceability for deferred items
- R4 RUNBOOK-FIX-08: §5.1 R2 probe lies on canary missing (404 → ok)

## What the reviewers confirmed CORRECT

- 18/22 F-SEC-* fixes verified end-to-end (R1)
- All 5 architectural milestones present in HEAD: OutboxEvent, PendingUpload, OAuthChallenge, Member.disabledAt, withRlsReads (R2, R3)
- ALS + tenantStore + RLS re-entrancy guard interaction (R3)
- `withResilience` composition order is correct (R3)
- `INSERT … ON CONFLICT DO NOTHING` race fix is right (R3)
- COMMIT-ATTRIBUTION.md spot-checked entries are accurate (R2, R4)
- No `--no-verify` / weakened CI gates added during the audit (R5)
- Husky pre-commit/pre-push chain intact (R5)
- 16-file test-debt handoff did NOT get masked with skip/todo (R5)
- TURNSTILE_SECRET_KEY does fail-closed in production exactly as documented (R4)

## Recommended next-session plan

A single follow-up session can absorb the 6 BLOCKERS + 4 HIGH cleanly:

- ~1h: runbook fixes (items 1, 2, 3, 14, 15, 16, 17 are all doc-only edits)
- ~2h: outbox composition fix (items 4, 5) — requires careful surgery in `outbox/index.ts` + `outbox/handlers.ts`
- ~2h: F-INT-01 finish (item 6) — 8 callsite fetch→fetchWithTimeout swaps
- ~30min: Turnstile gating fix (item 7) + storageKey input removal (item 8)
- ~2-3h: idempotency unification (item 9) — deserves a proper helper module
- ~1h: replica-bypasses-RLS guard (item 10) — small util + test

Total: ~9 hours under one engineer, or ~3 hours under 4 parallel agents.

The MEDIUM/LOW items can be tackled opportunistically; none of them block ops from running the deploy assuming the BLOCKERS land first.
