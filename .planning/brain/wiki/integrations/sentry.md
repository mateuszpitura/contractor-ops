---
title: Sentry error tracking
type: integration
tags: [sentry, observability, glitchtip]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - apps/api/src/lib/sentry.ts
  - packages/api/src/middleware/observability.ts
  - apps/web-vite/src/sentry.ts
updated: 2026-06-10
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
| PII scrub | `apps/api/src/lib/sentry-scrub.ts` |
| Cron worker | `apps/cron-worker/src/lib/sentry.ts` |
| Public API | `apps/public-api/src/lib/sentry.ts` |
| SPA | `apps/web-vite/src/sentry.ts` |
| Route boundary | `components/error/route-error-boundary.tsx` |
| Local DSN | `pnpm dev:observability` + `pnpm dev:observability:dsn` |

## Invariants

- Structured logging still via `@contractor-ops/logger` — Sentry complements, not replaces
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
