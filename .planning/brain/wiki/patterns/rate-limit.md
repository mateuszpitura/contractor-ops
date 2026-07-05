---
title: Public API rate limiting (two limiters)
type: pattern
tags: [rate-limit, public-api, quota, upstash]
source_commit: 52012027d6d66885d746d018d5d8db422195e2fb
verify_with:
  - apps/public-api/src/lib/rate-limiter.ts
  - packages/api/src/middleware/api-tier-quota.ts
  - packages/api/src/services/api-quota-counter.ts
  - packages/api/src/lib/api-tier-limits.ts
updated: 2026-07-05
---

# Public API rate limiting (two limiters, two jobs)

The public REST API composes **two independent limiters** — do not merge them.

## 1. Pre-auth burst limiter (DoS)

`apps/public-api/src/lib/rate-limiter.ts` — a flat ~100/min sliding window keyed by the key prefix, run as Hono `app.use('*', ...)` **before** auth (org/tier unknown yet). Upstash sliding-window with an in-memory fallback; **fail-CLOSED (503)** in production when Upstash is unreachable. Emits `X-RateLimit-*` + `Retry-After`.

## 2. Post-auth per-tier monthly quota (billing)

`enforceApiTierQuota` (`packages/api/src/middleware/api-tier-quota.ts`) — a tRPC middleware chained **inside** `apiKeyTenantProcedure` (after `requireTier`, before `demoReadOnly`), so the org + tier are resolved. It reads the tier via the Redis-cached `getSubscription`, and for a finite quota increments a calendar-month counter and throws `TOO_MANY_REQUESTS` (`API_QUOTA_EXCEEDED`) when over.

- **Table** — `lib/api-tier-limits.ts`: `TIER_MONTHLY_REQUEST_QUOTA` (Starter 1 000 / Pro 10 000 / Enterprise `Infinity`) + `TIER_WEBHOOK_SUBSCRIPTION_CAP` (1 / 5 / ∞, **defined here, consumed in Phase 100**).
- **Counter** — `services/api-quota-counter.ts`: Upstash `INCR` on `api-quota:{orgId}:{YYYY-MM}` (UTC) with a TTL to month-end on the first increment (calendar-month fixed window). In-memory per-instance fallback when Upstash env is unset (non-prod best-effort; prod boot without Upstash logs an error). `getMonthlyRequestCount` is a read-only variant for the Developer page.
- **Enterprise (unlimited) short-circuits** — it never writes a counter. All public keys currently require ENTERPRISE, so Starter/Pro quotas are **latent-but-correct** until product opens lower tiers.

## Invariants

- Burst = DoS, monthly = billing — they compose; a request must pass both.
- Calendar-month fixed window (not rolling 30 days); Enterprise writes no counter.
- Quota is fail-open only in non-prod when Upstash is unset (documented in `.env.example`).

## Related

- [[domains/public-api-surface]] · [[structure/key-services]]

## Agent mistakes

- Merging the burst limiter and the monthly quota into one — they run at different chain positions for different purposes.
- Writing a counter for the unlimited tier, or resetting on a rolling window instead of the calendar month.
