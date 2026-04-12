# Playwright performance specs

Measures time to **dashboard shell** (`#main-content` visible) for critical routes. Outputs JSON lines to stdout for CI logs; full report under `e2e/perf/results/perf-results.json`.

## Prereqs

1. App running, e.g. `pnpm dev` (default base URL `http://localhost:3000` or `NEXT_PUBLIC_APP_URL`).
2. Browsers: `pnpm e2e:perf:install` (from `apps/web`).

## Authenticated journeys

Set credentials used only on **non-production** environments:

```bash
export E2E_EMAIL='you@example.com'
export E2E_PASSWORD='...'
pnpm e2e:perf
```

`global-setup.ts` logs in once and writes `e2e/perf/.auth/user.json` (gitignored).

Without `E2E_*`, dashboard specs **skip**; the public login-page spec still runs.

## Override base URL

```bash
PLAYWRIGHT_BASE_URL=https://staging.example.com pnpm e2e:perf
```
