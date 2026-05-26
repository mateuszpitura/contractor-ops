# Cutover runbook — Steps 16–18

Operational checklist for migrating production traffic from `apps/web` (Next.js)
to `apps/web-vite` + `apps/api` + `apps/cron-worker`. Execute only after
[`uat.md`](uat.md) is fully signed off.

## Preconditions

- [ ] All rows in [`uat.md`](uat.md) checked with Engineering + Product sign-off
- [ ] `pnpm --filter @contractor-ops/api-server test` green (128+ cases)
- [ ] `pnpm --filter @contractor-ops/web-vite typecheck` green
- [ ] `pnpm --filter @contractor-ops/web-vite exec playwright test -c playwright.functional.config.ts` green against staging stack
- [ ] OAuth routes registered at `/api/oauth/:provider/*` on Fastify with `redirectUri = ${API_URL}${redirectPath}`
- [ ] `VITE_*` env vars set on Render `web-vite` service (rebuild required)

## Step 16 — DNS + external integrations (user-driven)

1. Provision custom domains in Render:
   - `app.contractor-ops.com` → `web-vite` static site
   - `api.contractor-ops.com` → `api-server` web service
2. Set on `api-server`:
   - `AUTH_COOKIE_DOMAIN=.contractor-ops.com`
   - `AUTH_COOKIE_SAME_SITE=none`
   - `APP_URL=https://app.contractor-ops.com`
   - `API_URL=https://api.contractor-ops.com`
3. Rebuild `web-vite` with:
   - `VITE_APP_URL=https://app.contractor-ops.com`
   - `VITE_API_URL=https://api.contractor-ops.com`
4. Update external webhook/OAuth callback URLs to `https://api.contractor-ops.com/...`
5. Delete legacy Render HTTP cron services after `cron-worker` has ticked all 12 jobs
6. Run synthetic transaction script (see `uat.md` Build under test section)

## Step 17 — 14-day grace period

Track daily metrics in [`grace-period.md`](grace-period.md):

- Sentry error rate ±5% vs baseline
- PostHog active users ±5%
- Web Vitals p75 (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1)
- Audit log volume per domain

Rollback: repoint DNS to legacy `web` + re-enable HTTP cron services.

## Step 18 — Retire legacy Next app

Execute only after Step 17 closes cleanly:

1. `git rm -r apps/web/`
2. Remove `web` + HTTP cron services from `render.yaml`
3. `git mv apps/web-vite apps/web` + rename package to `@contractor-ops/web`
4. `pnpm install && pnpm typecheck && pnpm test`
5. Verify `pnpm lint:no-next` passes (allows `apps/landing` + `apps/cms` only)
