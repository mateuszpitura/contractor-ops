---
phase: 99
slug: theme-c-api-keys-scopes-rate-limiting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-05
---

# Phase 99 — Validation Strategy

> Per-phase validation contract. Derived from `99-RESEARCH.md` § E. This phase enforces
> least-privilege on the public API + builds the inherited write surface. The whole WRITE surface stays
> DOUBLE-DARK (`module.public-api` off + `hide:true`) until Phase 100 — validation asserts writes are
> BUILT + SCOPE-ENFORCED + RATE-LIMITED + AUDITED, **not reachable**.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (`packages/api` + `apps/public-api` per-package vitest) |
| **Quick run** | `pnpm --filter @contractor-ops/api test <path>` (SCOPED + path arg) |
| **UI run** | `pnpm --filter @contractor-ops/web-vite test <path>` (SCOPED + path arg — NEVER unscoped) |
| **Existing seam** | `*.security.test.ts` regression pattern; the 15 HOLD-until-98-09 skipped rows are the turn-green target |
| **Estimated runtime** | ~10–40s scoped |

> **NEVER** run the full unscoped web-vite suite (kills Mac RAM). Always `--filter` + a path arg.

---

## Sampling Rate

- **After every task commit:** scoped test for the touched file.
- **After every wave:** scoped `packages/api` public-api + security suites + `apps/public-api` suite.
- **Before `/gsd:verify-work`:** all four NEW security suites green + the 15 HOLD rows un-skipped green +
  the Developer-page component tests green.
- **Max feedback latency:** ~40s scoped.

---

## Per-Requirement Verification Map

| Requirement | Wave | Behavior (secure) | Test Type | Automated Command | Status |
|-------------|------|-------------------|-----------|-------------------|--------|
| INTEG-AUTH-02 | 0 | every write 403s WITHOUT its scope, passes WITH it (live BFLA matrix) | security | `pnpm --filter @contractor-ops/api test public-api-write-scope` | ⬜ RED→99-04 |
| INTEG-API-01 | 0 | `.strict()` write DTO rejects org/workerType (contractor) + server-derived money (paymentRun) | unit | `pnpm --filter @contractor-ops/public-api test strict-dto` | ⬜ RED→99-04 |
| INTEG-AUTH-01 | 0 | superseded key usable within grace, 401 after; revoked → 401 | security | `pnpm --filter @contractor-ops/api test api-key-rotation` | ⬜ RED→99-05 |
| INTEG-AUTH-04 | 0 | over-quota request → 429; Enterprise unlimited never 429 | security | `pnpm --filter @contractor-ops/api test api-tier-quota` | ⬜ RED→99-03 |
| INTEG-AUTH-05 | 0 | every external mutation writes AuditLog with apiKeyId + sourceIp + userAgent | contract | `pnpm --filter @contractor-ops/api test public-api-mutation-audit` | ⬜ RED→99-04 |
| D-01 (actor) | 0 | FK-creates set FK to actingUserId; audit records API_KEY + metadata.actingUserId; cross-org actingUserId rejected | contract | `pnpm --filter @contractor-ops/api test api-key-actor` | ⬜ RED→99-02 |
| D-03 (dark) | 0 | write route 404 when flag off AND absent from `buildOpenApiDocument` | integration | `pnpm --filter @contractor-ops/public-api test write-routes-dark` | ⬜ RED→99-06 |
| INTEG-AUTH-03 | — | Developer page renders keys + last-used + source-IP log + scope viz + rotation dialog (loading/empty/error) | component | `pnpm --filter @contractor-ops/web-vite test api-keys` | ⬜ →99-07 |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements (99-01 — RED net)

- [ ] `public-api-write-scope.security.test.ts` — split DELIVERED vs DEFERRED; un-skip the delivered
      live-403 rows (RED until 99-04) — INTEG-AUTH-02
- [ ] `strict-dto.test.ts` — repoint money-rejection → paymentRun, org/workerType → contractor (RED
      until 99-04) — INTEG-API-01
- [ ] `api-key-actor.security.test.ts` — NEW: actingUserId FK on creates + audit metadata + cross-org
      reject (RED until 99-02) — D-01
- [ ] `api-key-rotation.security.test.ts` — NEW: grace-window usable/expired + revoked (RED until 99-05)
      — INTEG-AUTH-01
- [ ] `api-tier-quota.security.test.ts` — NEW: 429 over quota + Enterprise unlimited (RED until 99-03) —
      INTEG-AUTH-04
- [ ] `public-api-mutation-audit.security.test.ts` — NEW: apiKeyId+sourceIp+userAgent on every write
      (RED until 99-04) — INTEG-AUTH-05
- [ ] `public-api-flag.security.test.ts` — un-skip the write-half 404 rows (RED until 99-06) — D-03

---

## Manual-Only / Flag-Deferred Verifications

| Behavior | Requirement | Why | Handling |
|----------|-------------|-----|----------|
| Live per-tier quota under real Upstash traffic | INTEG-AUTH-04 | needs a live Redis + sustained traffic | conditional-skip when `UPSTASH_REDIS_REST_URL` unset (in-memory fallback path unit-tested); document in `.env.example` |
| Rotation grace observed in production (old key expires) | INTEG-AUTH-01 | wall-clock grace window | unit-test with injected clock; manual smoke on staging |
| Developer page visual (RTL, dark, mobile) | INTEG-AUTH-03 | visual | `frontend-design` + manual per `apps/web-vite/ARCHITECTURE.md` |
| **Write flag flip live** | INTEG-API-01 | **belongs to Phase 100** (after INTEG-SEC-01 OWASP gate) | NOT in Phase 99 — writes stay double-dark |

Per `.planning/EXTERNAL-ENABLEMENT.md`: any external/manual dependency → default-off `module.*` flag +
conditional-skip test + document; never a hard blocker in a plan.

---

## Validation Sign-Off

- [ ] All requirements have an automated verify command or a Wave 0 RED dependency
- [ ] No 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all NEW security files + the 15 HOLD turn-green targets
- [ ] No watch-mode flags (scoped `vitest run` only)
- [ ] `nyquist_compliant: true` set after 99-01 lands the RED stubs

**Approval:** pending
