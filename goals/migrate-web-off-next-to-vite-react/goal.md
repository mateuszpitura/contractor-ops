# Goal — Migrate apps/web off Next.js to Vite + React

## Goal

Replace `apps/web` (Next.js 16) with a new Vite + React 19 + React Router v7 SPA backed by a new Fastify `apps/api` and a separate `apps/cron-worker`, motivated by reducing the recurring Next.js framework attack surface. The migration is side-by-side with a 2-week production grace period; only after that period does the legacy Next app get removed.

## Shared understanding

- **Facts:** see [`facts.md`](./facts.md) — the agreed list of testable outcomes (target stack, routing, i18n, API host, auth/domains/cookies, image strategy, observability, feature-parity audit, build/deploy, quality gates, security posture, scope, done condition).

## Execution plan

- **Plan:** see [`plan.md`](./plan.md) — the ordered steps with files touched, verification per step, and the risks/open questions (cross-subdomain cookies, Better Auth Fastify bridge, codemod scale, CSP regression surface, public-api/worker reconciliation in `render.yaml`).

## Done condition

The new stack (`apps/web-vite` → renamed to `apps/web`, `apps/api`, `apps/cron-worker`) has been at full feature parity with the legacy Next app, passed UAT across every domain (dashboard, portal, admin, every webhook, every cron), held production traffic for **14 consecutive days without a P0/P1 regression**, and the legacy `apps/web` Next workspace has been deleted from the repo with its Render `web` service retired. `pnpm typecheck`, `pnpm test`, and every Playwright suite (`functional`, `integration`, `perf`, `rtl`, `a11y`) pass against the renamed workspace, and no source file under `apps/web/**` imports from `next`, `next-intl`, `@sentry/nextjs`, or `@next/bundle-analyzer`.
