---
status: issues-found
phase: 76
phase_name: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration
depth: deep
files_reviewed: 18
review_focus: SOLID/DRY, saga correctness, security/tenant/audit, raw-fetch guard, frontend/i18n
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
---

# Phase 76 Code Review — F2 IdP Deprovisioning Saga

Scope: the genuine Phase 76 source set (idp-saga pure helpers, Deprovisionable
contract + registry, saga schema, GWS adapter Deprovisionable methods, QStash
step-runner + route, tRPC start/retry/eligibility, OAuth scope-upgrade callback,
GWS reconnect banner, scopes guard, audit logger). Peripheral router files
(`zatca.ts`, `einvoice.ts`, `core/ocr.ts`, `core/time.ts`, `time-reconciliation.ts`)
appeared in the raw diff only because the diff base predates intervening branch
work — they carry **zero** Phase 76/77/78 feat commits and are out of scope.

Lint-guard surface NOT re-reported except where a guard is broken or its result
is load-bearing. This review targets what lint can't catch.

Verified green during review: `lint:scopes` (23 adapters clean), idp-saga unit
suite (28/28), i18n keys present in en/de/pl/ar for the reconnect banner.

---

## CRITICAL

### CR-1 — `lint:raw-fetch` CI guard is RED: 8 unannotated raw `fetch()` in GoogleWorkspaceAdapter
**File:** `packages/integrations/src/adapters/google-workspace-adapter.ts:406,426,446,475,508,519,543,562`
**Also flags (out of phase but same guard):** `entra-id-adapter.ts` (8 sites), `packages/api/src/services/contract-health/run-health-check.ts:271`

The `lint:raw-fetch` guard (`scripts/lint-raw-fetch.mjs`, wired into `lint:ci` in
`package.json`) scans `packages/integrations/src/**`. The Deprovisionable methods
(`suspendAccount`, `revokeAllSessions`, `verifyDeprovisioned`, `describeImpact`)
use bare `fetch()` with neither the `fetchWithTimeout` wrapper nor the
`// resilience: raw-fetch-OK reason=<why>` annotation the guard requires. The
OAuth/Directory methods on the same class correctly use `fetchWithTimeout` +
`withResilience` (lines 170, 227, 291, 343), so the asymmetry is real, not a
guard false-positive.

I ran the guard directly: it prints "unannotated raw fetch() call(s) detected"
and **`process.exit(1)`** (confirmed true exit code = 1). `pnpm lint:ci` —
hence CI — fails on this branch today.

This is more than a guard nit: the deprovision calls are unbounded (no
timeout) network POST/PATCH/DELETE to the provider. A hung Google socket holds
the QStash step-runner worker open with no wall-clock cap, defeating the timeout
budgets that `OAUTH_TIMEOUT_MS`/`DIRECTORY_TIMEOUT_MS` document elsewhere in the
same file.

**Fix (pick one, consistently):**
- Preferred: route the 8 sites through `fetchWithTimeout(url, init, { timeoutMs, retries: 0 })` (TRANSIENT_* classification + re-throw already handles retry via QStash, so `retries: 0` keeps idempotency intact), or
- If raw fetch is deliberate (e.g. to avoid the helper's retry on non-idempotent PATCH/DELETE), add `// resilience: raw-fetch-OK reason=non-idempotent-deprovision-qstash-retries` directly above each call so the guard passes and the intent is recorded.

Either way the guard must go green before merge. The Phase 76 D-16 plan note that
"raw fetch is acceptable here" is not encoded anywhere the guard can see.

---

## WARNING

### WR-1 — `idempotencyKey` is globally `@unique`, not tenant-scoped → cross-tenant collision
**File:** `packages/db/prisma/schema/idp-deprovisioning.prisma:17` + `packages/api/src/routers/integrations/deprovisioning.ts:258-265`

`idempotencyKey String @unique` is a **global** unique constraint on a
**client-supplied** value (`z.string().min(8).max(128)`). Org B can pick a key
that org A already used; org B's `startDeprovisioningRun` then hits P2002 and is
blocked from starting a legitimate run (cross-tenant DoS / key squatting). The
P2002 handler then does `findUniqueOrThrow({ where: { idempotencyKey } })` with
**no `organizationId` filter** — it relies entirely on RLS on `ctx.db` to avoid
returning org A's run id to org B. If RLS coverage of `findUnique` on this table
is anything less than airtight, this is an IDOR (leaks another tenant's run id).

**Fix:** make the constraint `@@unique([organizationId, idempotencyKey])` (drop
the field-level `@unique`), add the migration, and add `organizationId:
ctx.organizationId` to the P2002 recovery `findFirst`. This both removes the
cross-tenant collision and makes the recovery query defense-in-depth instead of
RLS-only.

### WR-2 — Cooldown `reason`/tooltip date is off-by-one for Gulf (east-of-UTC) jurisdictions
**File:** `packages/idp-saga/src/cooldown.ts:42-48`

`earliestDate` is a UTC instant representing **local midnight** of `endedAt+14d`
in the jurisdiction TZ. The gate comparison (`now.getTime() < earliestDate.getTime()`)
is correct. But the human-facing string uses
`earliestDate.toISOString().slice(0,10)` — i.e. the **UTC calendar date** of a
local-midnight instant. For `Asia/Riyadh` (+03) and `Asia/Dubai` (+04) — both in
`COUNTRY_TZ` (deprovisioning.ts:79-85) — local midnight maps to the **previous**
UTC day, so the reason string and the eligibility tooltip render a date one day
earlier than the true earliest-deprovisioning date.

Verified empirically: endedAt such that Dubai local earliest = 2026-05-16 →
`reason` slice renders `2026-05-15`.

This is audit-evidence + UX accuracy (an admin is told the wrong date), not a
gate bypass. **Fix:** format the date in the jurisdiction TZ, e.g.
`new TZDate(earliestDate, input.jurisdictionTz)` formatted to `yyyy-MM-dd`, or
carry `jurisdictionTz` through so the UI formats it. Mirror whatever Phase 71
`expiry.ts` does for the displayed boundary string.

### WR-3 — Step-runner route never loads adapters; registry fallback can throw or run token-less
**File:** `apps/api/src/routes/idp-deprovisioning.ts` (whole file) + `packages/api/src/services/idp-deprovisioning-step-runner.ts:174-184`

Every sibling QStash route (`google-workspace.ts:33`, `ksef.ts:35`, `ocr.ts:44`,
`oauth.ts:66`) calls `registerAllAdapters()` at module load. The IdP step-runner
route does **not**, and never `await loadHeavyAdapters()`. `GoogleWorkspaceAdapter`
is in the HEAVY (lazy) tier (`register-all.ts:97,116-118`).

In the happy path `resolveAdapter` constructs `new GoogleWorkspaceAdapter()`
directly when `resolveDeprovisionToken` succeeds, so it dodges the registry. But
when the token resolver returns `{ ok: false }` (not connected / decrypt failure),
the fallback is `getDeprovisionableAdapter(body.provider)`, which:
1. **throws** `No Deprovisionable adapter registered for provider: GOOGLE_WORKSPACE` if the heavy load hasn't completed (cold start) → 500 → QStash retry storm until the lazy import happens to win the race; and
2. even when registered, returns a **token-less** adapter instance (`#deprovisionAccessToken = ''`), so suspend/revoke fire with `Authorization: Bearer ` (empty) → 401 → classified as `PERMANENT_AUTH_EXPIRED`/FAILED. A missing connection is silently turned into a "provider rejected us" failure instead of a clear "not connected" outcome.

**Fix:** (a) call `registerAllAdapters()` at module load in the route file and/or
`await loadHeavyAdapters()` before `runDeprovisioningStep`, matching siblings;
(b) in `resolveAdapter`, when the token resolver fails, return a typed
not-connected failure (short-circuit the step to FAILED with a `not_connected`
reason) rather than falling through to a token-less registry adapter.

### WR-4 — `externalUserId` (contractor email, PII) logged in plaintext audit lines, contradicting the canonicalizer and the logger's own "no PII" contract
**File:** `packages/api/src/services/idp-deprovisioning-step-runner.ts:137,154` + `packages/logger/src/idp-audit-logger.ts:45-69`

`externalUserId = assignment.contractor.email` (deprovisioning.ts:182). The
step-runner emits `externalUserId: body.externalUserId` on the
`deprovision_step_completed` and sub-action audit lines. The `idp-audit` child
logger **deliberately does not redact** `externalUserId` (it's on
`IDP_AUDIT_ALLOWED_FIELDS`), and the field is not in `pii-mask.ts`. Meanwhile
`saga-canonicalize.ts:15-40` strips `email`/`primaryemail`/`name` from the hashed
payloads precisely because they are PII. The logger header comment asserts "All
Phase 76 fields are SHA-256 hashes, enum discriminators, or opaque IDs — no PII",
which is false for `externalUserId`.

If carrying the email in the audit trail is the intended SOC2 actor-identity
record, that's defensible — but the asymmetry (hashed in canonicalization,
plaintext in logs) and the inaccurate "no PII" comment should be reconciled with
the compliance team, and GDPR retention/redaction for these log lines confirmed.
At minimum: correct the comment. Consider logging an opaque step/contractor id
instead of the raw email, or hashing `externalUserId` in the log line.

---

## INFO

### IN-1 — Provenance GC runs on `prismaRaw`, not the advisory-locked `tx`
**File:** `apps/cron-worker/src/jobs/handlers/reminders/index.ts:335`

`gcIdpProvenance` is invoked inside the `pg_try_advisory_xact_lock`-guarded
reminders transaction (via `Promise.all`), but `gcExpiredProvenance(prismaRaw)`
uses the raw (non-tx) client, so its `deleteMany` is not actually serialized by
the reminders advisory lock. Functionally fine — GC is idempotent and cross-org
(`deleted: 0` on a second run within the window), and the isolated try/catch
correctly prevents it from aborting siblings — but the lock gives no protection
here. If concurrent-tick safety for the GC is desired, pass `tx`; otherwise the
current behavior is acceptable and only the mental model is slightly off.

### IN-2 — `retryDeprovisioningStep`: `deduplicationId` uses `nextAttempt` but row resets `attempts: 0`
**File:** `packages/api/src/routers/integrations/deprovisioning.ts:299-326`

`nextAttempt = step.attempts + 1` is used only for the QStash `deduplicationId`,
while the row is reset to `attempts: 0` (intentional — a manual retry grants a
fresh MAX_ATTEMPTS budget; the step-runner head guard at line 65 then re-runs).
The labeling mismatch (dedup id says "attempt N+1", row says "0 attempts") is
harmless because dedup ids only need uniqueness per enqueue, but it's a small
readability trap for the next maintainer. A one-line comment clarifying "dedup id
must differ from the original enqueue; attempts is reset deliberately" would help.

### IN-3 — `DeprovisioningProviderId` union duplicated across 4+ sites
**Files:** `packages/integrations/src/registry.ts:164`, `packages/integrations/src/types/idp-saga`-mirror, `packages/idp-saga/src/types.ts:34`, `packages/api/.../deprovisioning.ts:30-51`, `idp-deprovisioning-step-runner.ts:24`

The 5-member provider union (`GOOGLE_WORKSPACE | SLACK | ENTRA | OKTA | GITHUB`)
is hand-redeclared in the integrations registry, the idp-saga types, the tRPC
router (twice — type alias + z.enum + const tuple), and the step-runner zod enum,
plus the Prisma enum. registry.ts:159-162 documents the duplication as deliberate
(avoid a circular dep on `@contractor-ops/idp-saga`). That rationale holds for
the integrations↔idp-saga boundary, but the **three** copies inside
`packages/api` (router type, router z.enum, step-runner z.enum) could share one
`z.enum` const + `z.infer` without any cycle. DRY opportunity, low risk; the
`as const satisfies` patterns elsewhere keep drift mostly compile-checked.

### IN-4 — `recomputeRunStatus` "last write wins" under concurrent step completions
**File:** `packages/idp-saga/src/run-status.ts:48-63`

The doc comment claims idempotent/convergent under concurrency. It re-reads all
steps then writes the derived status with no row version / `WHERE` guard. If two
QStash step jobs finish near-simultaneously, both read, both derive, both write —
the writes converge **only because** they read after their own step's terminal
transition committed. With QStash's at-least-once delivery and independent jobs
this is the intended design (D-02) and the pure derivation makes the final state
correct once all steps are terminal. No bug, but `finishedAt` can be set, then a
late re-derivation that still sees a terminal aggregate will overwrite it with a
new `new Date()` (jitter on the finished timestamp). Cosmetic; flag only if
`finishedAt` is used as an SLA evidence field.

### IN-5 — `verifyDeprovisioned` swallows non-404 errors as `false`
**File:** `packages/integrations/src/adapters/google-workspace-adapter.ts:507-512`

`verifyDeprovisioned` returns `Boolean(data?.suspended)` after `.json().catch(() => ({}))`,
so a 5xx/429/parse-failure silently returns `false` (indistinguishable from "user
active"). The interface doc says this is TEST-TIME only and the production saga
relies on `suspendAccount`'s status, so impact is contained — but if any future
caller treats `verifyDeprovisioned() === false` as authoritative, transient
errors will read as "not deprovisioned". Consider throwing on non-404 non-ok so
callers can distinguish "confirmed active" from "couldn't check".

---

## Confirmed correct (focus items the task called out)

- **QStash signature verification:** step-runner route is registered inside the raw-body webhook plugin scope (`webhooks/index.ts:54,90`); `guardQStashRequest` verifies HMAC over exact bytes before any handler runs, rejects missing sig (401), fails closed (500) on missing keys. Correct.
- **Webhook self-trigger loop prevention:** `provenanceLookup` does the atomic `updateMany({ where: { id, matchedAt: null } })` claim (provenance.ts:40-45); insert-before-adapter-call ordering is honored in the step-runner (lines 85-91); `handleWebhook` suppresses matched self-changes (adapter 635-657). Concurrent-claim race resolves to a single winner. Correct.
- **Idempotent retry / terminal-state derivation:** head-of-job MAX_ATTEMPTS guard (step-runner 65-72); USER_NOT_FOUND/LIKELY_GONE → SUCCEEDED mapping; `deriveRunStatus` terminal logic (all-success→COMPLETED, all-terminal-fail→FAILED, mixed→PARTIAL_FAILURE) is sound; MANUAL_COMPLETED treated as success-equivalent. 28/28 unit tests pass.
- **Cooldown TZ gate boundary:** `startOfDay(TZDate(endedAt+14d, tz))` is computed correctly per-jurisdiction (verified Berlin/Riyadh/Dubai). Only the *display string* is wrong (WR-2).
- **Compile-time Deprovisionable enforcement:** `registerDeprovisionableAdapter(provider, BaseAdapter & Deprovisionable)` enforces the contract at the registration call site (registry.ts:171); same instance registered in both maps (register-all.ts:116-118). Good abstraction — SOLID, single source of contract.
- **Migration vs schema drift (MANUAL_COMPLETED / errorClass / override columns):** NOT a Phase 76 bug — the Phase 76 migration is correctly minimal/additive; the enum value + columns the schema declares are created by the later `20260531184805_phase77_idp_manual_override_errorclass` migration. Confirmed present.
- **Tenant scoping (queries):** eligibility/start/retry/run all filter by `organizationId` from session via `ctx.db` + `findOrThrow`; override mutation goes through a single `$transaction` with `writeAuditLog(tx)`; free-text override note deliberately excluded from audit/log. Good. (Tenant gap is only WR-1, the idempotency key.)
- **Frontend / i18n:** reconnect banner uses logical RTL classes only, `role="region"` + `aria-label`, three-state decision tree is clean; **all** i18n keys (`bannerTitle/Body/Button`, `writeAccess*`) present in en/de/pl/ar — no hardcoded strings. (The `i18n:code-coverage` guard is known-broken, so this was checked manually and is clean for this component.)
- **saga-canonicalize:** PII + auth-header denylist + key-sort canonicalization is correct; hashes are PII-free as advertised. (The PII concern is only the *log line* in WR-4, not the hash.)

---

## By-severity summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 1 | CR-1 (raw-fetch guard RED — CI broken, unbounded deprovision fetches) |
| Warning  | 4 | WR-1 (global idempotencyKey → cross-tenant collision/IDOR), WR-2 (Gulf cooldown date off-by-one in reason/tooltip), WR-3 (step-runner never loads adapters; token-less fallback), WR-4 (contractor email in plaintext audit logs vs "no PII" claim) |
| Info     | 5 | IN-1 (GC not in advisory tx), IN-2 (retry dedup-id vs attempts:0), IN-3 (provider union duplication within packages/api), IN-4 (finishedAt jitter on re-derivation), IN-5 (verifyDeprovisioned swallows non-404) |
| **Total**| **10** | |

**Merge gate:** CR-1 must be fixed (CI is red). WR-1 and WR-3 are the highest-value
correctness/security fixes; WR-2 and WR-4 should be resolved or explicitly
accepted by the compliance owner before this ships to a real tenant.
