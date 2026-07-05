# 101-02 SUMMARY — free API sandbox tier (fail-closed isolation)

**Status:** complete · **Wave:** 1 · **Requirements:** INTEG-DX-04

## What shipped — the load-bearing isolation

A `co_test_` / `co_live_` environment axis on the API key, isolated by REUSE of the
shipped demo read-only layer (no parallel mechanism):

- **Schema** — `Organization.isSandbox` (default false) + `OrganizationApiKey.environment`
  (`ApiKeyEnvironment { LIVE | SANDBOX }`, default LIVE). One deferred migration
  `__phase101_sandbox_environment/` (migration.sql + down.sql), `__`-prefixed → NOT applied
  by codegen; the Prisma client is regenerated so code compiles now.
- **Key service** (`api-key-service.ts`) — `generateApiKey({ environment })` mints `co_test_`
  for SANDBOX and `co_live_` for LIVE (256-bit entropy + HMAC unchanged). `resolveApiKey`
  now accepts both prefixes; `resolveByPrefix` selects the org's `isSandbox` and, after the
  HMAC verify, **FAILS CLOSED both directions**: `(environment === 'SANDBOX') !== (org.isSandbox === true)` → `null`.
  A `co_test_` key can NEVER resolve to a non-sandbox org, and a `co_live_` key never to a
  sandbox org. On a sandbox resolve it calls `markSandboxOrg` (in-process cache).
- **Demo predicate** (`demo.ts`) — `isDemoContext` returns true when the request context
  carries `isSandbox` (set by the auth middleware from the resolved key's org), so the
  `demoReadOnly` mutation guard blocks every sandbox mutation. `isDemoOrg` additionally
  consults the in-process sandbox-org cache, so the sync service-layer side-effect skips
  (outbox/email/ZATCA/payout) also honor a sandbox org — defense-in-depth, no DB query on
  the hot path.
- **Quota** — `SANDBOX_DAILY_REQUEST_QUOTA = 100` (`api-tier-limits.ts`) +
  `incrementDailyRequestCount`/`getDailyRequestCount` (`api-quota-counter.ts`, UTC-day fixed
  window mirroring the monthly counter; the prod-no-Redis warn is now a shared helper so NO
  new `process.env` read is added — net-zero on the ratchet).
- **Access chain** (`api-key-auth.ts`) — the Bearer gate accepts both prefixes; the auth
  middleware enriches ctx with `apiKeyEnvironment` + `isSandbox`. A single
  `apiKeyAccessGate` branches: **SANDBOX** → global `module.api-sandbox` flag +
  100/day cap (429 on the 101st), NO tier, NO per-org `module.public-api`; **LIVE** → the
  unchanged `module.public-api` dark gate + Enterprise tier + monthly quota (extracted
  `assertMinimumTier` from `tier.ts` keeps LIVE semantics identical). The pre-auth
  rate-limiter (`apps/public-api`) also keys `co_test_` per-key.
- **Provisioning** (`sandbox-provisioning.ts`) — `provisionSandboxOrg({ userId, userName })`
  idempotently (deterministic slug `sandbox-{userId}`) creates a sandbox Organization
  (`isSandbox:true`) + owner Member + a seeded Worker + Contractor fixture (read endpoints
  return realistic shapes). `issueSandboxKey` provisions + mints a read-only `co_test_` key
  + audits. New tRPC mutation `apiKey.createSandboxKey` (tenant + org:update, NO Enterprise
  tier — sandbox is free) for the Developer-page action.
- **Flags** — `module.developer-portal`, `module.public-status-page`, `module.api-sandbox`
  registered (default false, category module, sign-off-gated) in `flags-core.ts`; the three
  keys added to `GATED_FLAG_NAMESPACE_PREFIXES` + PENDING entries in
  `signoff-registry-flags.json`.
- `.env.example` documents the sandbox posture (no new env var — `isSandbox` column + the
  quota constant + the `module.api-sandbox` flag).

## RED → GREEN proof + NO public-api regression

- `sandbox-isolation.security.test.ts` — **GREEN 8/8** (was RED). Proves: prefix minting per
  environment; `resolveApiKey` fail-closed both ways; `isDemoContext({isSandbox})` true;
  `SANDBOX_DAILY_REQUEST_QUOTA === 100`.
- Regression fence: `write-routes-dark` + `owasp-api-gate` + all `*.security.*` public-api
  suites — **GREEN 19/19**. The only 2 failing public-api files are `status-page.test.ts`
  (101-05) + `developer-portal.test.ts` (101-08), still RED by design.
- `@contractor-ops/api` typecheck clean; `@contractor-ops/public-api` typecheck clean;
  `@contractor-ops/db` builds; client regenerated.
- `feature-flags` 124/124; affected api suites (api-key-service/sandbox/tier/demo/quota)
  66/66. `check:no-process-env` net-zero (185; the +3 over baseline 182 is pre-existing
  drift from concurrent merges, not this change).

## Deviations

- The plan put the sandbox 100/day enforcement in `api-tier-quota.ts`; I placed the branch
  in a single `apiKeyAccessGate` (api-key-auth.ts) instead, because the LIVE chain's
  `requireTier('ENTERPRISE')` cannot be conditionally skipped inside the generic factory —
  the combined gate keeps LIVE behaviour byte-identical (via the extracted `assertMinimumTier`)
  while adding the sandbox branch. `enforceApiTierQuota` stays exported (its isolated
  security test is unchanged + green).
- `isDemoOrg` was NOT made async (would break 8 sync call sites); the sandbox coverage is the
  context `isSandbox` flag (primary control) + the in-process cache (defense-in-depth). A
  sandbox org is read-only end-to-end, so it never reaches the service-layer skips anyway.

## Migration (deferred apply)

`__phase101_sandbox_environment` — `ApiKeyEnvironment` enum + `Organization.isSandbox` +
`OrganizationApiKey.environment`. Additive, reversible (down.sql), applied per region at the
human migration gate. EXTERNAL-ENABLEMENT row added in 101-10.
