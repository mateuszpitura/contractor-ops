# 99-03 SUMMARY — per-tier monthly request quota

**Wave:** 2 · **Status:** done

## What landed
- **`lib/api-tier-limits.ts`** — single source of truth: `TIER_MONTHLY_REQUEST_QUOTA`
  (STARTER 1 000 / PRO 10 000 / ENTERPRISE unlimited) **and** `TIER_WEBHOOK_SUBSCRIPTION_CAP`
  (STARTER 1 / PRO 5 / ENTERPRISE unlimited). The webhook caps are **defined here, consumed in Phase 100**
  (subscriptions do not exist yet).
- **`services/api-quota-counter.ts`** — `incrementMonthlyRequestCount(orgId)`: Upstash `INCR` on
  `api-quota:{orgId}:{YYYY-MM}` (UTC) with a TTL to month-end on the first increment (calendar-month fixed
  window). In-memory per-instance fallback when Upstash env is unset (non-prod best-effort; a prod boot
  without Upstash logs an error). Reuses the existing `@upstash/redis` dep + `getServerEnv` (no new deps).
- **`middleware/api-tier-quota.ts`** — `enforceApiTierQuota` (tRPC middleware): resolves the org tier via
  the Redis-cached `getSubscription`, and for a finite quota increments the counter and throws
  `TOO_MANY_REQUESTS` (`API_QUOTA_EXCEEDED`) when over. **ENTERPRISE (unlimited) short-circuits without
  writing a counter.** Chained into `apiKeyTenantProcedure` after `requireTier` / before `demoReadOnly`.
- The pre-auth flat 100/min burst limiter (`apps/public-api/src/lib/rate-limiter.ts`) is **untouched** —
  two limiters, two jobs (burst = DoS, monthly = billing). `requireTier('ENTERPRISE')` is **unchanged**,
  so STARTER/PRO quotas are latent-but-correct until product opens lower tiers.
- `.env.example` documents that the monthly quota needs Upstash in prod.

## Tests
- `api-tier-quota.security.test.ts` GREEN (5): STARTER/PRO over quota → 429, STARTER at-boundary allowed,
  ENTERPRISE never throws + no counter write, and the middleware is proven wired into the full
  `apiKeyTenantProcedure` chain. Because `requireTier('ENTERPRISE')` gates the real chain before the quota,
  the STARTER/PRO 429 cases exercise `enforceApiTierQuota` in isolation.
- No regression: all public read + `api-key-auth` + `tenant-isolation` suites pass (ENTERPRISE
  short-circuits the counter). Only `public-api-flag` write-half stays RED (→ 99-04).

## Verification
- `pnpm typecheck --filter @contractor-ops/api` clean.
