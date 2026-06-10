---
title: Logging and errors
type: pattern
tags: [logging, observability, sentry]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/logger/src/
  - packages/api/src/init.ts
  - apps/web-vite/src/sentry.ts
updated: 2026-06-09
---

# Logging and errors

## Purpose

Structured logging via Pino (`@contractor-ops/logger`). Sentry on Node services; SPA gap on route boundary.

## Entry points

| Surface | Path |
|---------|------|
| Logger package | `packages/logger/` |
| tRPC error capture | observability middleware in `packages/api/src/init.ts` |
| API Sentry | `apps/api/src/lib/sentry.ts` |
| SPA Sentry | `apps/web-vite/src/sentry.ts` |
| Route boundary | `apps/web-vite/src/components/error/route-error-boundary.tsx` |

## Invariants

- No `console.*` in app source — `pnpm lint:logs`
- Cron: `createCronLogger`
- Empty `catch {}` forbidden in integration paths — see `lint:silent-catch`

## Related

- [[decisions/tech-debt-hotspots]]
- [[integrations/qstash-cron]]

## Verify live

```bash
pnpm lint:logs
pnpm lint:silent-catch
```

## Agent mistakes

- `console.log` debugging left in PR
- Silent catch in notification dispatch
