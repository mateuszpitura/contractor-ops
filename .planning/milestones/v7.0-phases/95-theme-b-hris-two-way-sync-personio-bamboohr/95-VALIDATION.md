---
phase: 95
slug: theme-b-hris-two-way-sync-personio-bamboohr
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 95 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `95-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map is populated by the planner as tasks are authored.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) — `packages/api/package.json`, `packages/integrations/package.json` |
| **Config file** | `packages/api/vitest.config.ts`; `packages/integrations/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test <path>` / `pnpm --filter @contractor-ops/integrations test <path>` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test` (scoped by path — the hris-sync tree); `pnpm --filter @contractor-ops/integrations test` (adapters) |
| **Estimated runtime** | ~5–10s pure units (field-partition, sync-hash, mapping); ~30s scoped-by-path API (orchestrator/router/outbox); adapters ~10s (fixture-driven, live cases skipped) |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` (kills Mac RAM).

---

## Sampling Rate

- **After every task commit:** Run scoped `pnpm --filter @contractor-ops/<pkg> test <changed-path>` (< 30s)
- **After every plan wave:** `pnpm -F @contractor-ops/api test` (scoped) + `pnpm -F @contractor-ops/integrations test` + `pnpm typecheck --filter=@contractor-ops/api` + touched guards (`lint:schema`, `lint:audit-log`, `lint:raw-sql`, `lint:logs`, `lint:silent-catch`, `i18n:parity`, `check:web-vite-*`, `pnpm standards:check`, `pnpm check:no-process-env` when env touched)
- **Before `/gsd:verify-work`:** Full scoped api + integrations suites green + `pnpm check:wiki-brain` green
- **Max feedback latency:** 30 seconds (scoped)

---

## Per-Task Verification Map

> Seed rows map each phase requirement to its automated proof (from RESEARCH § Validation Architecture). The field-partition allowlist + loop-prevention are the primary proofs (D-01 + Pitfall 1); IDOR + one-HRIS-per-org are the mandatory security regressions.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| HRIS-SYNC-05 | `projectToWritablePatch` returns ONLY HRIS-owned keys; a raw record with invoice/payment/PESEL mapped to a protected key → those keys ABSENT from the patch | unit | `pnpm -F @contractor-ops/api test field-partition` | ❌ W1 (GREEN in 95-01) |
| HRIS-SYNC-05 | protected field survives a conflicting HRIS pull — applying a patch leaves financial/compliance/`*Encrypted` columns unchanged | unit | `pnpm -F @contractor-ops/api test field-partition-survives` | ❌ W1 (GREEN in 95-01) |
| HRIS-SYNC-02 | `syncHash` deterministic (equal patch → equal hash, key-order-independent); unchanged snapshot → write skipped (idempotent pull) | unit | `pnpm -F @contractor-ops/api test sync-hash` | ❌ W1 (GREEN in 95-01) |
| HRIS-SYNC-03 | loop-prevention: a pull run enqueues NO push event; `assertNotHrisOwnedField` throws when a push payload carries an HRIS-owned key | unit | `pnpm -F @contractor-ops/api test hris-push-loop` | ❌ W1 (RED via missing handlers) |
| HRIS-SYNC-06 | one-HRIS-per-org: a second HRIS connect on an org already connected to the other → P2002 → typed `CONFLICT` | integration | `pnpm -F @contractor-ops/api test hris-one-per-org` | ❌ W1 (RED via missing enum/migration) |
| HRIS-SYNC-* | cross-org IDOR: a Personio record referencing org B's externalId never writes when the sync runs for org A | integration | `pnpm -F @contractor-ops/api test hris-cross-org` | ❌ W1 (RED) |
| HRIS-SYNC-01 | Personio adapter: bearer mint, offset/limit≤200 pager, ≤200 req/min limiter, `safeParse` payloads; live token-exchange/pull `it.skipIf(!PERSONIO_CLIENT_ID)` | unit + conditional | `pnpm -F @contractor-ops/integrations test personio` | ❌ W1 (RED via missing adapter) |
| HRIS-SYNC-04 | BambooHR adapter: `getOAuthConfig` shape, exchange/refresh, un-paginated list, standard-field map; custom-attr path `it.skipIf(!BAMBOOHR_CUSTOM_ATTR_VERIFIED)`; live `it.skipIf(!BAMBOOHR_CLIENT_ID)` | unit + conditional | `pnpm -F @contractor-ops/integrations test bamboohr` | ❌ W1 (RED) |
| HRIS-SYNC-02 | pull orchestrator: writes `IntegrationSyncLog(INBOUND)` STARTED→SUCCESS, takes the `sync` advisory-lock (second concurrent run skips), passes the delta cursor, per-record best-effort (one bad record doesn't abort the run) | integration | `pnpm -F @contractor-ops/api test hris-pull-orchestrator` | ❌ W1 (RED via missing orchestrator) |
| HRIS-SYNC-03 | outbox: the three event types dispatch to the connected adapter's push; no connection / flag dark → no-op (not error); `outboxEventId` threaded as idempotency key | unit | `pnpm -F @contractor-ops/api test hris-outbox` | ❌ W1 (RED via missing handlers) |
| HRIS-SYNC-* | export/sync surface absent from `appRouter` when `module.workforce-employees` OFF (METHOD_NOT_FOUND) | unit (regression) | `pnpm -F @contractor-ops/api test root-router-gating` | ✅ extend |
| HRIS-SYNC-* | router: connect XOR (one-HRIS-per-org), disconnect, syncNow, get/set mapping; per-request `assertWorkforceEnabled` + `evaluate('integration.*-sync')`; `writeAuditLog` on connect/disconnect | unit | `pnpm -F @contractor-ops/api test hris-sync-router` | ❌ W1 (RED via missing router) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 1 Requirements (the RED net — seeded before any impl)

- [ ] `packages/api/src/services/hris-sync/__tests__/field-partition.test.ts` — allowlist projection drops CO-owned/PII keys + protected-field-survives (GREEN as part of 95-01 — the pure module ships with it)
- [ ] `packages/api/src/services/hris-sync/__tests__/sync-hash.test.ts` — deterministic hash + idempotent-skip (GREEN in 95-01)
- [ ] `packages/api/src/services/hris-sync/__tests__/hris-pull-orchestrator.test.ts` — SyncLog(INBOUND) + advisory-lock + delta cursor + per-record best-effort (RED via missing orchestrator)
- [ ] `packages/api/src/services/hris-sync/__tests__/hris-cross-org.test.ts` — two-org IDOR on pull write (RED)
- [ ] `packages/api/src/services/hris-sync/__tests__/hris-one-per-org.test.ts` — partial-index P2002 → CONFLICT (RED via missing enum/migration)
- [ ] `packages/api/src/services/outbox/__tests__/hris-outbox.test.ts` + `.../hris-push-loop.test.ts` — three event types + change-origin guard + no-op-when-dark (RED via missing handlers)
- [ ] `packages/integrations/src/adapters/__tests__/personio-adapter.test.ts` (+ `fixtures/personio/*.json`) — bearer/pager/limiter + live `it.skipIf(!creds)` (RED via missing adapter)
- [ ] `packages/integrations/src/adapters/__tests__/bamboohr-adapter.test.ts` (+ `fixtures/bamboohr/*.json`) — OAuthConfig + list/push + custom-attr/live `it.skipIf` (RED)
- [ ] `packages/api/src/routers/workforce/__tests__/hris-sync-router.test.ts` — connect XOR + syncNow + mapping + flag gate + audit (RED via missing router)

**tsconfig guard:** `packages/api` and `packages/integrations` already exclude `src/**/__tests__/**` from `tsc --noEmit` (Phase 88) so RED scaffolds importing not-yet-built modules do not brick the package typecheck — confirm before seeding, do NOT re-add a broad include.

**Migration guard:** the `hris-one-per-org` integration test needs the `PERSONIO`/`BAMBOOHR` enum + the partial unique index (95-03). Author the test against the intended constraint; it stays RED until 95-03 lands the migration + `pnpm db:generate`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Personio pull/push (client-credentials bearer) | HRIS-SYNC-01/02/03 | Needs a Personio partner app + client id/secret (external) | Set `PERSONIO_CLIENT_ID`/`SECRET`, flip `integration.personio-sync` APPROVED, connect an org sandbox, confirm a pull maps to registry fields + a push lands; conditional-skip tests auto-flip GREEN when creds land |
| Live BambooHR OAuth round-trip + pull/push | HRIS-SYNC-04 | Needs a BambooHR OAuth app + client id/secret (external) | Set `BAMBOOHR_CLIENT_ID`/`SECRET`, flip `integration.bamboohr-sync` APPROVED, complete the OAuth connect, confirm token exchange + a sandbox pull/push; conditional-skip tests auto-flip GREEN when creds land |
| BambooHR custom-attribute mapping | HRIS-SYNC-04 | Custom-attribute contract is unverified (D-06 gate) | Verify the tenant's custom-attribute contract, set `BAMBOOHR_CUSTOM_ATTR_VERIFIED`, confirm the custom-attr → `countryFields` mapping; the standard-field sync ships regardless |
| Personio exact endpoint-level rate limits | HRIS-SYNC-01 | 200 req/min is community data (MEDIUM confidence) | Confirm the real per-endpoint limit against the current Personio contract at enablement; the limiter is set conservatively so a tighter real limit still passes |
| Migration apply to regional `DATABASE_URL_*` | HRIS-SYNC-06 | Deploy-time human step (drift-blocked posture) | The `__`-prefixed migration (enum + partial unique index) is generated + committed; apply at deploy; Prisma client compiles without a live DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 1 RED dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 1 covers all MISSING references (field-partition, sync-hash, orchestrator, outbox, both adapters, router, one-per-org, cross-org)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
