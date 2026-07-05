---
title: Sentry error tracking
type: integration
tags: [sentry, observability, glitchtip]
source_commit: a691aface4b1b0f4ec333f2f69d9705e0c0338fa
verify_with:
  - apps/api/src/lib/sentry.ts
  - packages/api/src/middleware/observability.ts
  - apps/web-vite/src/sentry.ts
  - apps/api/src/lib/sentry-scrub.ts
  - apps/public-api/src/lib/sentry-scrub.ts
  - apps/cron-worker/src/lib/sentry-scrub.ts
  - apps/web-vite/src/lib/sentry-scrub.ts
  - packages/logger/src/pii-mask.ts
updated: 2026-07-05
---

# Sentry (error tracking)

## Purpose

Capture backend tRPC errors and (partially) frontend failures. PII scrubbing before send. Local dev uses GlitchTip (Sentry-compatible DSN).

## Flow

```mermaid
flowchart LR
  trpc[tRPC procedure] --> obs[observability middleware]
  obs --> sentry[@sentry/node]
  spa[web-vite] --> spaSentry[sentry.ts browser tracing]
  boundary[route-error-boundary] -.->|gap: console only| spa
```

## Entry points

| Surface | Path |
|---------|------|
| API init | `apps/api/src/lib/sentry.ts` |
| tRPC capture | `packages/api/src/middleware/observability.ts` |
| PII scrub (4 copies) | `apps/{api,public-api,cron-worker,web-vite}/src/lib/sentry-scrub.ts` |
| Shared PII keyword list | `packages/logger/src/pii-mask.ts` → `PII_SCRUB_KEYWORDS` / `isPiiScrubKey` |
| Cron worker | `apps/cron-worker/src/lib/sentry.ts` |
| Public API | `apps/public-api/src/lib/sentry.ts` |
| SPA | `apps/web-vite/src/sentry.ts` |
| Route boundary | `components/error/route-error-boundary.tsx` |
| Local DSN | `pnpm dev:observability` + `pnpm dev:observability:dsn` |

## Invariants

- Structured logging still via `@contractor-ops/logger` — Sentry complements, not replaces
- **Single shared PII keyword list**: the four `sentry-scrub.ts` `beforeSend` copies (one per runtime, differing only in `@sentry/node` vs `@sentry/react`) import `isPiiScrubKey` / `PII_SCRUB_KEYWORDS` from the dependency-free `@contractor-ops/logger/pii-mask` subpath — no local hand-lists, so Node services and the browser bundle can no longer drift apart. Add a redaction keyword there (aligned with `PII_MASK_PATHS`), never in a copy. Matching is case-insensitive substring, so short tokens are deliberately broad (e.g. `ein` also redacts `eInvoiceId`) — over-redacting a crash report is the safe side
- SPA boundary should call `Sentry.captureException` — tech debt: [[decisions/tech-debt-hotspots]]

## Related

- [[patterns/logging-and-errors]]
- [[patterns/ci-guards]]

## Verify live

```bash
semble search "observability"
grep -r "captureException" apps/web-vite/src
```

## Agent mistakes

- `console.error` only in route boundary without Sentry
- Logging PII without scrub middleware path
