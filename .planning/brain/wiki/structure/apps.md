---
title: Deployable apps
type: structure
tags: [structure, apps]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/intel/file-roles.json
  - apps/api/src/index.ts
updated: 2026-06-09
---

# Deployable apps

## Purpose

Six runnable services in `apps/`. Each has a distinct HTTP/runtime role; shared logic stays in `packages/`.

## Entry points

| App | Package | Listen / bootstrap | Responsibility |
|-----|---------|-------------------|----------------|
| `apps/api` | `@contractor-ops/api-server` | `src/index.ts` → `server.ts` | Staff `/api/trpc/*`, portal `/api/trpc/portal/*`, Better Auth, webhooks |
| `apps/web-vite` | `@contractor-ops/web-vite` | `src/main.tsx`, `src/router.tsx` | Staff dashboard + contractor portal SPA |
| `apps/cron-worker` | `@contractor-ops/cron-worker` | `src/index.ts` | QStash callbacks, scheduled jobs |
| `apps/public-api` | `@contractor-ops/public-api` | `src/index.ts` | Hono REST for API-key consumers |
| `apps/cms` | `@contractor-ops/cms` | port 3002 | Payload blog CMS |
| `apps/landing` | `@contractor-ops/landing` | Next.js 16 | Marketing + blog |

## Key plugins (api)

- `apps/api/src/plugins/trpc.ts` — dual router mount (portal first)
- `apps/api/src/plugins/auth.ts` — `/api/auth/**`
- `apps/api/src/plugins/webhooks.ts` — Stripe, courier, provider callbacks

## Boot side-effects (api)

`src/index.ts` `main()` — after `listen` — ensures the global QStash schedule that polls the transactional-outbox drain (`lib/outbox-schedule.ts` → `ensureOutboxDrainSchedule`, fixed id `outbox-drain`, `* * * * *` → `POST /outbox/_drain`). Idempotent upsert + list-assert; failure is logged + Sentry-captured, never fatal. Gated on `QSTASH_TOKEN` (dev/test skip). Unlike per-org peppol/ksef/google-workspace schedules created on `connect`, the drain is a singleton created at boot. See [[domains/notifications-and-reminders]].

## UI surface

Staff + portal UI: **only** `apps/web-vite`. See [[web-vite-domains]]. CMS + landing: [[cms-and-landing]].

## Related

- [[monorepo-topology]]
- [[cron-jobs]]
- [[domains/public-api-surface]]
- [[patterns/web-vite-data-layer]]

## Verify live

```bash
semble search "buildServer"
semble search "portalAppRouter"
```

## Agent mistakes

- Adding tRPC to `apps/web-vite` pages — hooks only
- Listening in `server.ts` — `index.ts` owns process lifecycle
