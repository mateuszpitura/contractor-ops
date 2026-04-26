# Load tests (k6)

HTTP load and smoke tests for the Next.js app. tRPC uses **GET** with a SuperJSON `input` query param (same shape as `httpLink` in development).

## Install k6

- macOS: `brew install k6`
- Other: [grafana.com/docs/k6/latest/set-up/install-k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)

## Smoke (`/api/health`)

From the monorepo root:

```bash
pnpm load:smoke
```

Or:

```bash
BASE_URL=http://localhost:3000 k6 run load-tests/smoke.js
```

## API read load (`/api/trpc` …)

1. **Session cookie** — log in with the browser, open DevTools → Network → any `/api/trpc` request → copy the full `Cookie` request header. Export it (quotes help in zsh):

   ```bash
   export SESSION_COOKIE='better-auth.session_token=...; better-auth.active_organization=...'
   ```

2. **Rate limits** — middleware allows 60 `/api/trpc` requests per minute per IP. For higher throughput on **non-production** environments, set in `.env`:

   - `LOAD_TEST_BYPASS=1`
   - `LOAD_TEST_SECRET=<long random string>`

   Then pass the same value to k6:

   ```bash
   export LOAD_TEST_SECRET='your-secret'
   ```

   On **Vercel production** (`VERCEL_ENV=production`), the bypass is **disabled** regardless of env.

3. **Run**

   ```bash
   pnpm load:api
   pnpm load:stress   # higher ramp; same env vars
   ```

   Or explicitly:

   ```bash
   BASE_URL=http://localhost:3000 \
   SESSION_COOKIE="$SESSION_COOKIE" \
   LOAD_TEST_SECRET="$LOAD_TEST_SECRET" \
   k6 run load-tests/api-read.js
   ```

## Stress profile

Higher ramp (stages up to 40 VUs). Same env vars as API read:

```bash
pnpm load:stress
```

## API write load (tRPC mutations)

Sends `POST /api/trpc/<proc>` with a SuperJSON body (non-batched `httpLink` shape). Same auth/bypass conventions as the read path.

Default target is `notification.markAllRead` — idempotent-ish (bulk UPDATE, never creates rows).

```bash
pnpm load:writes              # 5 VUs × 60s against the default proc
pnpm load:writes:stress       # ramp to 25 VUs
```

Target a different mutation via env:

```bash
PROC_NAME=reassessment-trigger.dismiss \
PROC_INPUT='{"triggerId":"trg_xxx","reason":"load test"}' \
SESSION_COOKIE="$SESSION_COOKIE" \
k6 run load-tests/api-write.js
```

`PROC_INPUT` must be valid JSON. It is wrapped as `{ json: <PROC_INPUT> }` before POST (SuperJSON non-batched shape). Do **not** target procedures that create rows unless you plan to clean up afterward.

## Safety

- Do **not** point high-VU tests at production.
- Load tests increase DB, Redis, and observability traffic — use staging or local with care.
