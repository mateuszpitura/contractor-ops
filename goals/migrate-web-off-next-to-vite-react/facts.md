# Facts — Migrate apps/web off Next.js to Vite + React

## Target stack

- `apps/web` (current Next.js 16) is replaced by a new `apps/web-vite` built on **Vite + React 19 + React Router v7** using the `createBrowserRouter` data-router API (loaders/actions/error-elements per route, no JSX `<Routes>`).
- Rendering mode is **pure CSR / SPA**: Vite produces a static `index.html` + JS/CSS chunks; there is no SSR, no streaming, no hydration.
- Backend lives in a new `apps/api` built on **Fastify + Node** with `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/cookie`.
- Cron jobs live in a separate new `apps/cron-worker` (Node process, `node-cron`) — isolated from the API process.
- Webhooks (KSeF, Peppol, ZATCA, teams, google-workspace, OAuth, OCR) are Fastify routes inside `apps/api` under dedicated path prefixes (e.g. `/webhooks/ksef`, `/webhooks/peppol`) with per-route signature verification and rate-limit.

## Routing & UI

- Route tree mirrors the current `apps/web/src/app/[locale]/**` shape: `/:locale/(dashboard)/*`, `/:locale/(portal)/portal/*`, `/:locale/(auth)/*`, `/:locale/admin/*`.
- Locale segment is part of the URL and is validated against `['en', 'de', 'pl', 'ar']` at the router level; unknown locales redirect to a default.
- Auth gating is implemented as a React Router `loader` (or top-level guard component) that calls `/api/auth/session` on `apps/api` and redirects to the locale-aware login on missing/expired session.
- Code splitting uses `React.lazy` + `Suspense` per route segment (replaces `next/dynamic { ssr: false }`).
- All async data fetching goes through `@tanstack/react-query` + the existing tRPC client (`@trpc/tanstack-react-query`). There is no server-rendered data fetching.
- URL state continues to be managed with `nuqs` using its React Router adapter; consumer call-sites remain unchanged.

## i18n

- `next-intl` is replaced by **`i18next` + `react-i18next`** with `i18next-icu` so the existing ICU MessageFormat strings in `apps/web/messages/{en,de,pl,ar}.json` remain valid and untouched at the data level.
- A thin compatibility wrapper exports a `useTranslations(ns)` hook with the same call signature used today, so the ~592 consuming files only change their import path (no per-call rewrite).
- Locale detection uses `i18next-browser-languagedetector` plus a persistent cookie; the URL `:locale` segment is the source of truth on the client.
- Arabic (`ar`) sets `dir="rtl"` on the `<html>` element at locale-switch time; RTL Playwright suite continues to pass.

## API host

- `packages/api` (tRPC v11) is reused as-is. `apps/api` mounts the existing `appRouter` (50+ staff namespaces) at `/api/trpc` and the existing `portalAppRouter` at `/api/trpc/portal`, using `fetchRequestHandler` from `@trpc/server/adapters/fetch` (already the current adapter in `apps/web`).
- `packages/auth` (Better Auth) is reused as-is. `apps/api` mounts the Better Auth handler under `/api/auth/**` via its Fastify-compatible adapter.
- All current `apps/web/src/app/api/*` route handlers (auth, cron callbacks, csp-report, exports, google-workspace, health, ksef, late-interest, oauth, ocr, outbox, peppol, portal, revalidate-legal, teams, web-vitals, webhooks, zatca) have a 1:1 counterpart in `apps/api`. The cron route is replaced by `apps/cron-worker` schedules calling internal handlers.
- `revalidate-legal` (Next ISR cache invalidation) is replaced by tRPC-level cache invalidation + TanStack Query `queryClient.invalidateQueries` triggered by an authenticated `/internal/revalidate-legal` endpoint.
- `web-vitals` endpoint stays — the SPA reports Core Web Vitals to it; the endpoint forwards to PostHog as today.

## Auth, domains, cookies

- SPA is served from `app.contractor-ops.com` (or per-env equivalent). API is served from `api.contractor-ops.com`.
- Better Auth session cookies are set on `api.*` with `SameSite=None; Secure; HttpOnly; Path=/`. CORS on `apps/api` allows the exact SPA origin only (no wildcards), with `credentials: true`.
- CSRF protection is enforced on every state-changing API request via Better Auth's CSRF token + Fastify-level origin check; SameSite=None increases the importance of this check.
- A documented edge-case section in the plan calls out that cross-site cookies require third-party-cookie support to remain functional in supported browsers; no Safari ITP blockers are expected because `api.*` is a same-organisation subdomain.

## Images

- `next/image` is replaced by the **`unpic-img`** `<Image>` component (framework-agnostic). Source hosts allowed: `*.r2.cloudflarestorage.com`, `lh3.googleusercontent.com`, `*.googleusercontent.com`, `graph.microsoft.com` — same set as today's `images.remotePatterns`.
- Cloudflare R2 image transforms are used for resizing/format negotiation; there is no in-app optimizer service and no `sharp` runtime on `apps/api`.
- All `<Image src>` call-sites in `apps/web` are codemodded to the unpic component preserving `width`/`height`/`alt`/`priority` semantics.

## Observability

- `@sentry/nextjs` is removed. `apps/web-vite` uses **`@sentry/react`** with the browser tracing integration; `apps/api` and `apps/cron-worker` use **`@sentry/node`** with the Node profiling integration.
- Source maps for the SPA build are uploaded via `@sentry/vite-plugin` during CI.
- All application logging continues to go through `@contractor-ops/logger` (Pino). No `console.*` is introduced.
- PostHog product analytics + Web Vitals capture is preserved with no behavioural change.

## Feature parity & lost features

- The migration audits and replaces every Next-only feature currently in use:
  - React Server Components → all server-only pages/components are rewritten as client components consuming tRPC + TanStack Query.
  - `next/dynamic { ssr: false }` → `React.lazy` + `Suspense`.
  - Streaming SSR / Suspense SSR → CSR skeletons.
  - ISR / on-demand revalidation (`/api/revalidate-legal`) → tRPC cache invalidation pattern documented above.
  - Partial Prerendering / Server Actions → audited; any Server Actions are rewritten as tRPC mutations.
  - Next-specific request/response APIs (`next/headers`, `next/navigation`, `cookies()`, `redirect()`) → React Router equivalents (`useNavigate`, `redirect()` from react-router, `document.cookie` / Better Auth client).
- Email previewing, PDF rendering (`@react-pdf/renderer`), drag-and-drop (`@dnd-kit/*`), forms (`react-hook-form`), tables (`@tanstack/react-table`), animations (`motion`), and the rest of the React-only dependency tree continue to work unchanged.

## Build, deploy, infra

- The Render deployment becomes **3 services** instead of 1:
  - `contractor-ops-web` — Render Static Site (Vite `dist/`), served from CDN.
  - `contractor-ops-api` — Render Web Service (Node) running Fastify.
  - `contractor-ops-cron-worker` — Render Background Worker (Node) running the cron process.
- `render.yaml` is updated to describe the three services with their build/start commands, env vars, and health checks. The old `apps/web` Render service is retired only after cutover.
- The Vite build emits hashed asset filenames and a `Cache-Control: public, max-age=31536000, immutable` policy for hashed assets; `index.html` has `Cache-Control: no-cache`.
- `apps/api` exposes a `/health` endpoint compatible with Render health checks.
- Env vars split: client-side vars are explicitly prefixed `VITE_*` and validated by a `packages/web-vite/src/env.ts` schema; server-side vars stay in `apps/api/src/env.ts` and `apps/cron-worker/src/env.ts` Zod schemas. `.env.example` is updated accordingly.

## Quality gates

- A `size-limit` config gates the SPA bundle in CI (initial JS budget defined when first build is measured; budget is committed in the same PR).
- `rollup-plugin-visualizer` produces a treemap on `pnpm --filter @contractor-ops/web-vite build:analyze`.
- Web Vitals (LCP, INP, CLS, TTFB, FCP) are captured client-side and POSTed to `/api/web-vitals` → PostHog, as today.
- `pnpm typecheck` (tsc) passes on the new packages. `pnpm test` (Vitest) passes 1:1 — vitest configs are portable.
- Playwright configs (`playwright.functional.config.ts`, `playwright.integration.config.ts`, `playwright.perf.config.ts`, `playwright.rtl.config.ts`, `a11y` project) are rewritten to point at the new dev/prod URLs; the test scenarios themselves are preserved.
- WCAG checks (keyboard, focus, semantic HTML, contrast) survive — the `a11y` Playwright project remains green.

## Security posture

- The migration is **explicitly motivated by reducing Next.js framework attack surface** (recurring CVEs in middleware/image-optimizer/cache layers). Pure CSR + a hand-rolled Fastify API removes those framework surfaces entirely.
- `apps/api` is hardened by default: `helmet` for security headers, `@fastify/rate-limit` globally and per-route, `@fastify/cors` with an exact origin allowlist, Zod validation on every tRPC procedure and every webhook payload (`safeParse`, no unsafe `as`).
- A CSP header is emitted on `apps/api` responses (including HTML for the rare error pages) and on the SPA `index.html` (via Render static-site headers). `img-src` continues to allow the four hosts above; `connect-src` includes `api.contractor-ops.com`, Sentry, PostHog, R2.
- All sensitive mutations continue to call `writeAuditLog` from `packages/api/src/services/audit-writer.ts` with the transactional `tx` argument.

## Scope, non-goals, done condition

- **In scope:** `apps/web` → `apps/web-vite` rewrite, `apps/api` creation, `apps/cron-worker` creation, `render.yaml` updates, env var split, Playwright/Vitest reconfig, Sentry/observability swap, image swap, i18n swap, auth/session cookie posture, CORS/CSP hardening.
- **Out of scope:** `apps/landing` (stays on Next), `apps/cms` (stays on Payload+Next — Payload is tightly coupled and is not replaced), database schema (Prisma untouched), `packages/db`, `packages/integrations`, `packages/ui`, `packages/validators`, `packages/feature-flags`, `packages/logger`, `packages/classification`, `packages/einvoice`. `packages/api` and `packages/auth` receive only the minimum host-glue adjustments required to mount under Fastify.
- **Migration mode:** side-by-side — `apps/web` (Next) keeps running and serving traffic until the new stack is at full feature parity. No big-bang cutover.
- **Pacing:** full-time focus; other product work is paused during the migration.
- **Cutover gate:** the new stack reaches full feature parity, passes UAT against every domain (dashboard, portal, admin, all webhooks, all crons), and all existing Vitest + Playwright suites are green.
- **Done condition:** after cutover, the new services run in production for a **2-week grace period** without regression; only then is `apps/web` (the Next app) removed from the repo and its Render service deleted.
