---
title: Logging and errors
type: pattern
tags: [logging, observability, sentry]
source_commit: a691aface4b1b0f4ec333f2f69d9705e0c0338fa
verify_with:
  - packages/logger/src/
  - packages/api/src/init.ts
  - apps/web-vite/src/sentry.ts
updated: 2026-07-05
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
- **PII redaction has two aligned surfaces from `packages/logger/src/pii-mask.ts`**: `PII_MASK_PATHS` (pino `redact` dotted paths, in-pipeline) and `PII_SCRUB_KEYWORDS` / `isPiiScrubKey` (substring predicate for out-of-pipeline object scrubbers — the four Sentry `sentry-scrub.ts` copies import it via `@contractor-ops/logger/pii-mask`). Add a redaction key to both so logs and crash reports stay in lock-step. See [[integrations/sentry]]

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
