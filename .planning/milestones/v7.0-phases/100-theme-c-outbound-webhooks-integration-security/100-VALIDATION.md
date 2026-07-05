---
phase: 100
slug: theme-c-outbound-webhooks-integration-security
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 100 — Validation Strategy

> Per-phase validation contract. Derived from `100-RESEARCH.md` § E. This phase pushes signed, PII-safe
> events to hostile customer URLs behind an SSRF guard, and performs the inherited P99 write flag-flip.
> Live dispatch stays behind `module.outbound-webhooks` (default off); all delivery tests run against a
> LOCAL MOCK RECEIVER with the guard in force. The security-critical controls (SSRF/DNS-rebind, HMAC replay,
> PII redaction, DLQ poison-handling) get RED tests BEFORE any production code.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (`packages/api`, `apps/public-api`, `apps/cron-worker`, `apps/web-vite` per-package vitest) |
| **Quick run** | `pnpm --filter @contractor-ops/api test <path>` (SCOPED + path arg) |
| **UI run** | `pnpm --filter @contractor-ops/web-vite test <path>` (SCOPED + path arg — NEVER unscoped) |
| **Local mock receiver** | an in-test HTTP server (or MSW handler) capturing method/headers/body — delivery tests assert signature/redaction/retry WITHOUT the live flag |
| **Existing seam** | `*.security.test.ts` regression pattern; `packages/test-utils` MSW QStash handlers for the deliver-route callback |
| **Estimated runtime** | ~10–45s scoped |

> **NEVER** run the full unscoped web-vite suite (kills Mac RAM). Always `--filter` + a path arg.

---

## Sampling Rate

- **After every task commit:** scoped test for the touched file.
- **After every wave:** scoped `packages/api` webhook + security suites + the touched app suite.
- **Before `/gsd:verify-work`:** all Wave-0 RED files GREEN + the OWASP gate suite GREEN + the write-routes-
  dark test proves writes stay dark until 100-09.
- **Max feedback latency:** ~45s scoped.

---

## Per-Requirement Verification Map

| Requirement | Wave | Behavior (secure) | Test Type | Automated Command | Status |
|-------------|------|-------------------|-----------|-------------------|--------|
| INTEG-SEC-01 | 0 | subscribe+dispatch reject private/loopback/link-local/`169.254.169.254`; DNS-rebind blocked at connect; redirects not followed | security | `pnpm --filter @contractor-ops/api test webhook-ssrf` | ⬜ RED→100-02 |
| INTEG-SEC-02 | 0 | non-HTTPS url rejected unless per-org HTTP override; override still SSRF-checked | security | `pnpm --filter @contractor-ops/api test webhook-ssrf` | ⬜ RED→100-02 |
| INTEG-WEBHOOK-04 | 0 | `X-CO-Signature: t=…,v1=…` verifies with the sub secret; wrong secret fails | security | `pnpm --filter @contractor-ops/api test webhook-hmac` | ⬜ RED→100-03 |
| INTEG-WEBHOOK-05 | 0 | a `t` older than the 5-min window is rejected by the sample verifier before compare | security | `pnpm --filter @contractor-ops/api test webhook-hmac` | ⬜ RED→100-03 |
| INTEG-WEBHOOK-07 | 0 | redacted subscription's persisted attempt payload has no PII keys; `include_pii:true` retains | contract | `pnpm --filter @contractor-ops/api test webhook-redact` | ⬜ RED→100-04 |
| INTEG-WEBHOOK-01/-02 | 0 | subscription model + event-catalog union; SSRF-checked on create/update; audited | integration | `pnpm --filter @contractor-ops/api test webhook-subscription` | ⬜ RED→100-05 |
| INTEG-WEBHOOK-03 | 0 | non-2xx retries 1m/5m/30m/2h/12h/24h max 6 then DLQ; DLQ replayable; poison row doesn't stall batch; 5 failures/1h alerts | integration | `pnpm --filter @contractor-ops/api test webhook-dispatch` | ⬜ RED→100-06 |
| INTEG-SEC-03 | 0 | 101st delivery/min for one sub is throttled (requeued), not dropped | security | `pnpm --filter @contractor-ops/api test webhook-rate-limit` | ⬜ RED→100-06 |
| INTEG-SEC-05 | 0 | key seen from >3 IPs in 24h raises the leak alarm; ≤3 does not | integration | `pnpm --filter @contractor-ops/cron-worker test api-key-leak-alarm` | ⬜ RED→100-07 |
| INTEG-WEBHOOK-06 | — | Settings → Developer → Webhooks: CRUD + test-fire + last-100 (loading/empty/error) | component | `pnpm --filter @contractor-ops/web-vite test webhooks` | ⬜ →100-08 |
| INTEG-SEC-04 | 0 | OWASP API Top-10 checks (BOLA/BFLA/SSRF/mass-assignment/misconfig/injection) run GREEN as tests | security | `pnpm --filter @contractor-ops/api test owasp-api-gate` | ⬜ RED→100-09 |
| write flip (P99) | 0 | write-verb count in `buildOpenApiDocument` is 0 UNTIL 100-09; then N + 404→reachable per org | integration | `pnpm --filter @contractor-ops/public-api test write-routes-dark` | ⬜ →100-09 |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements (100-01 — RED net)

- [ ] `webhook-ssrf.security.test.ts` — NEW: private/loopback/link-local/metadata reject at subscribe +
      dispatch; DNS-rebind (public→private re-resolve) blocked; redirect-to-metadata rejected; HTTPS-only
      (RED until 100-02) — INTEG-SEC-01/-02
- [ ] `webhook-hmac.security.test.ts` — NEW: `X-CO-Signature t=…,v1=…` sign+verify; 5-min replay reject;
      wrong-secret fail (RED until 100-03) — INTEG-WEBHOOK-04/-05
- [ ] `webhook-redact.security.test.ts` — NEW: PII stripped from the PERSISTED attempt snapshot when
      `include_pii:false`; retained when true (RED until 100-04) — INTEG-WEBHOOK-07
- [ ] `webhook-subscription.test.ts` — NEW: model + event-catalog union + SSRF-on-create + audit (RED until
      100-05) — INTEG-WEBHOOK-01/-02
- [ ] `webhook-dispatch.test.ts` — NEW: backoff schedule + max-6 + DLQ + poison-row isolation + 5/1h alert
      (RED until 100-06) — INTEG-WEBHOOK-03
- [ ] `webhook-rate-limit.security.test.ts` — NEW: per-sub 100/min throttle-not-drop (RED until 100-06) —
      INTEG-SEC-03
- [ ] `api-key-leak-alarm.test.ts` (cron-worker) — NEW: >3 IPs/24h alarm (RED until 100-07) — INTEG-SEC-05
- [ ] `owasp-api-gate.security.test.ts` — NEW: BOLA/BFLA/SSRF/mass-assignment/misconfig/injection checks
      as real assertions (RED until 100-09) — INTEG-SEC-04
- [ ] `write-routes-dark.test.ts` (public-api) — EXTEND (from P99): write-verb count stays 0 until 100-09
      flips (RED/hold until 100-09) — P99 write flip

---

## Manual-Only / Flag-Deferred Verifications

| Behavior | Requirement | Why | Handling |
|----------|-------------|-----|----------|
| Live dispatch to a real external URL | INTEG-WEBHOOK-03 | needs `module.outbound-webhooks` granted + a real receiver | flag default OFF; tests use a local mock receiver with the guard in force; document in `.env.example` |
| DNS-rebind under real DNS | INTEG-SEC-01 | wall-clock DNS TTL flip | unit-test with a mocked `dns.lookup` returning public→private; manual smoke on staging |
| Per-tier webhook-subscription cap | INTEG-WEBHOOK-01 | consumes P99 `TIER_WEBHOOK_SUBSCRIPTION_CAP` | assert against the P99 tier-limits table; conditional-skip if the module is unbuilt |
| Webhooks page visual (RTL, dark, mobile) | INTEG-WEBHOOK-06 | visual | `frontend-design` + manual per `apps/web-vite/ARCHITECTURE.md` |
| **`module.public-api` per-org grant** | P99 write flip | **manual Unleash/ops act post-OWASP-gate** | 100-09 un-hides routes + regenerates SDK in code; the per-org flag grant is recorded in `EXTERNAL-ENABLEMENT.md` row #8, not scripted |
| Native de/pl/ar webhook copy | INTEG-WEBHOOK-06 | native review deferred | i18n parity (GREEN); native pass at GA (EXTERNAL-ENABLEMENT #9) |

Per `.planning/EXTERNAL-ENABLEMENT.md`: any external/manual dependency → default-off `module.*` flag +
conditional-skip/mock test + document; never a hard blocker in a plan. The SSRF guard is a CONTROL, not a
deferral.

---

## Validation Sign-Off

- [ ] All requirements have an automated verify command or a Wave 0 RED dependency
- [ ] No 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all NEW security files (SSRF, HMAC, redaction, dispatch/DLQ, rate-limit, leak-alarm,
      OWASP gate) + the write-routes-dark hold
- [ ] No watch-mode flags (scoped `vitest run` only)
- [ ] `nyquist_compliant: true` set after 100-01 lands the RED stubs
- [ ] `wave_0_complete: true` set after 100-10 verifies the whole surface + the gated flip

**Approval:** pending
