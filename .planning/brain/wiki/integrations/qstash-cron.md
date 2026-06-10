---
title: QStash and cron
type: integration
tags: [qstash, cron, upstash]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - apps/api/src/lib/qstash-route.ts
  - apps/cron-worker/src/jobs/handlers/
updated: 2026-06-10
---

# QStash + cron worker

## Purpose

Async job delivery via Upstash QStash: deferred cron, webhook retries, background work with Zod-validated bodies and backpressure. Heavy handlers run in `apps/cron-worker`.

## Flow

```mermaid
sequenceDiagram
  participant Render as Render cron
  participant API as apps/api
  participant QStash
  participant Worker as cron-worker
  Render->>API: trigger
  API->>QStash: enqueue
  QStash->>Worker: POST handler
```

## Entry points

| Piece | Path |
|-------|------|
| Verify | `apps/api/src/lib/qstash-verify.ts` |
| Route helper | `defineQStashRoute` in `qstash-route.ts` |
| Client | `packages/integrations/src/services/qstash-client.ts` |
| Backpressure | `qstash-backpressure.ts` |
| Monitor | `cron-monitor.ts` (`withQueueObservability`) |
| Handlers | [[structure/cron-jobs]] |

## Invariants

- Cron: `createCronLogger` — no `console.*`
- `cronProcedure` + `CRON_SECRET` for internal triggers
- Handler bodies validated with Zod

## Related

- [[structure/cron-jobs]]
- [[structure/apps]]
- [[framework-core]]

## Verify live

```bash
semble search "defineQStashRoute"
ls apps/cron-worker/src/jobs/handlers/
```

## Agent mistakes

- Raw cron handler without QStash signature verify
- Business logic duplicated in worker instead of `packages/api` services
