# Plan — Migrate apps/web off Next.js to Vite + React

## Solution approach

Side-by-side build-out: the existing `apps/web` (Next.js 16) keeps serving production while three new workspaces are stood up in parallel — `apps/api` (Fastify), `apps/cron-worker` (Node + node-cron), `apps/web-vite` (Vite + React + React Router v7 data router). Migration proceeds backend-first (so the SPA always has a real API to talk to), then the SPA shell, then domain-by-domain route porting, then bundle/perf/security hardening, then UAT, cutover, grace period, and deletion of the legacy Next app.

The shared packages (`packages/api` tRPC routers, `packages/auth` Better Auth config, `packages/db`, `packages/integrations`, `packages/ui`, `packages/feature-flags`, `packages/logger`, `packages/validators`, `packages/classification`, `packages/einvoice`) stay structurally unchanged. The only edits there are minimal host-glue: ensuring `packages/api` exposes its `appRouter` / `portalAppRouter` cleanly to a Fastify mount, and ensuring `packages/auth` exposes the Better Auth config so a Fastify adapter can wrap it instead of `toNextJsHandler`.

Codemods are applied with one `Edit` per file (no `sed`/script bulk replace per CLAUDE.md), parallelised across non-conflicting files. Each migration step is committed atomically with a passing typecheck and the relevant Vitest filter green before merge.

## Pre-flight discovery (read-only)

Before writing any code, the following must be fully enumerated and committed to a discovery note (`goals/migrate-web-off-next-to-vite-react/discovery.md`) so later steps don't drift:

- Every route under `apps/web/src/app/api/**` — list, request methods, auth posture, rate-limit posture.
- Every page under `apps/web/src/app/[locale]/**` — list, layout chain, data dependencies.
- Every Next-only import across `apps/web/src/**`: `next/dynamic`, `next/headers`, `next/navigation`, `next/server`, `next-intl/server`, `next-intl/middleware`, `next-intl/plugin`, `next/image`, `next/font`, `next/link`, `next/cache`, `unstable_cache`, `revalidatePath`, `revalidateTag`, `'use server'`, `'use client'`, `@sentry/nextjs`, `@next/bundle-analyzer`.
- Every consumer of `next-intl` APIs (~592 files known from grep) and the namespaces they pull.
- All `apps/web/middleware.ts` responsibilities: locale detect, Upstash rate-limit (Redis + in-memory fallback, LRU eviction), Sentry instrumentation, header injection, redirects.
- Existing `render.yaml` services: `web`, `landing`, `public-api`, `worker`, `clamav`, `unleash-eu`, `unleash-me`, `cloudflared`, `cron-token-refresh`, `cron-data-purge`, `cron-exchange-rates`. Clarify which keep / move / merge into `apps/cron-worker`.
- Confirm `public-api` is a separate Enterprise REST surface (not the staff tRPC) — locate its source workspace and confirm it is out of scope.

Verification: `discovery.md` exists with one bullet per concrete artifact, no "TBD"s.

## Ordered steps

### Step 1 — Workspace scaffolding

- Add three workspaces to `pnpm-workspace.yaml`: `apps/web-vite`, `apps/api`, `apps/cron-worker`.
- Create `apps/web-vite/package.json`, `apps/api/package.json`, `apps/cron-worker/package.json` with `"private": true`, `"type": "module"`, and only the dev-time minimum to typecheck (no runtime deps yet).
- Add three Turborepo pipelines in `turbo.json` (`dev`, `build`, `typecheck`, `test`, `lint`) keyed on the new workspaces.
- Touched: `pnpm-workspace.yaml`, `turbo.json`, `apps/web-vite/package.json`, `apps/api/package.json`, `apps/cron-worker/package.json`, three matching `tsconfig.json` files extending the repo base.
- Verify: `pnpm install`, `pnpm typecheck --filter=@contractor-ops/api-server --filter=@contractor-ops/cron-worker --filter=@contractor-ops/web-vite` succeeds with empty `src/index.ts` stubs.

### Step 2 — Fastify skeleton + security baseline

- Add to `apps/api`: `fastify`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`, `@fastify/sensible`, `@upstash/redis` (reused for rate-limit store), `@sentry/node`, `@contractor-ops/logger`, Zod.
- Implement `apps/api/src/env.ts` (Zod schema; reuses `packages/auth/src/env.ts` patterns).
- Implement `apps/api/src/server.ts`: Fastify instance with helmet (CSP composed to mirror current Next CSP, including R2 + Sentry + PostHog + Better Auth), CORS with exact-origin allowlist from `APP_URL` env, rate-limit (Upstash backend, in-memory LRU fallback ported from `middleware.ts`), cookie plugin, request-context Pino integration via `runWithRequestContext`, Sentry init mirroring `@sentry/nextjs` config from `apps/web/sentry.server.config.ts`.
- Implement `/health` (liveness) + `/ready` (readiness — checks DB + Upstash + R2 ping).
- Touched: `apps/api/src/{env,server,plugins/sentry,plugins/rate-limit,plugins/cors,plugins/helmet,routes/health}.ts`.
- Verify: `pnpm --filter @contractor-ops/api-server build && pnpm --filter @contractor-ops/api-server start` boots clean; `curl -i http://localhost:4000/health` returns 200 with `x-request-id`; `curl -i -H "Origin: https://evil.example" http://localhost:4000/health` is rejected by CORS preflight; `pnpm --filter @contractor-ops/api-server test` passes a smoke suite for the security headers.

### Step 3 — Mount Better Auth on Fastify

- Replace `toNextJsHandler(auth)` (currently only at `apps/web/src/app/api/auth/[...all]/route.ts`) with a Fastify route prefix `/api/auth/**`. Better Auth ships a `toNodeHandler(auth)` that converts the framework-agnostic handler to a Node `IncomingMessage`/`ServerResponse` handler; mount it via Fastify's `rawHandler` registration (or via a thin compat shim that bridges Fastify's request → Web `Request`).
- Port the observability wrapper (logging, Sentry capture on 5xx, `runWithRequestContext`) from `apps/web/src/app/api/auth/[...all]/route.ts` into a Fastify `preHandler` + `onResponse` hook.
- Confirm cookies emitted by Better Auth carry `SameSite=None; Secure; HttpOnly; Path=/; Domain=.contractor-ops.com` (cross-subdomain) once env says we run under `api.contractor-ops.com` ↔ `app.contractor-ops.com`.
- Add a Fastify-level CSRF origin check guarding all non-`GET` requests under `/api/**`: reject if `Origin` is not in the allowlist, regardless of Better Auth's own CSRF token (defense in depth).
- Touched: `apps/api/src/plugins/auth.ts`, `apps/api/src/routes/auth.ts`, optionally a small export tweak in `packages/auth/src/index.ts` if the framework-agnostic handler isn't already exposed.
- Verify: Vitest contract tests around the Fastify route mirror the existing `apps/web/src/app/api/auth/__tests__/*` suite and pass; a manual `pnpm --filter @contractor-ops/api-server dev` + `curl -i http://localhost:4000/api/auth/session -H "Cookie: ..."` returns the expected session JSON; the Better Auth sign-in flow completes end-to-end against a local SPA stub.

### Step 4 — Mount tRPC on Fastify (staff + portal)

- Reuse `appRouter` from `packages/api/src/root.ts` and `portalAppRouter` from `packages/api/src/portal-root.ts`. Both already work with `fetchRequestHandler` from `@trpc/server/adapters/fetch`.
- Add two Fastify routes: `POST/GET /api/trpc/:path*` → calls `fetchRequestHandler({ endpoint: '/api/trpc', req: bridgedRequest, router: appRouter, createContext })`, and `POST/GET /api/trpc/portal/:path*` → same with `portalAppRouter` and endpoint `/api/trpc/portal`.
- Implement `createContext` to mirror `apps/web/src/server/api/trpc-context.ts`: pull Better Auth session from cookies, resolve `organizationId` from session (never from client input), attach Pino logger with request-id, attach Sentry hub.
- Confirm and preserve all middleware: tenant isolation, audit-log writer transactional wrapper, RLS context.
- Touched: `apps/api/src/routes/trpc.ts`, `apps/api/src/trpc-context.ts`, possibly a `packages/api/src/http.ts` helper if the Fastify→fetch bridge proves reusable.
- Verify: `pnpm --filter @contractor-ops/api test` passes (existing tRPC router unit tests); a Vitest integration test in `apps/api` exercises a `trpc.health.ping` style procedure end-to-end through the Fastify mount and asserts cookie auth + tenant resolution; the contract test for `apps/web/src/app/api/trpc/[trpc]/__tests__/route.test.ts` is ported and passes.

### Step 5 — Port webhook + utility routes to Fastify

For each route under `apps/web/src/app/api/**` (excluding `/api/trpc/**` and `/api/auth/**` already handled), create the Fastify equivalent in `apps/api/src/routes/**`:

- `/webhooks/ksef`, `/webhooks/peppol`, `/webhooks/zatca`, `/webhooks/teams`, `/webhooks/google-workspace`, `/webhooks/oauth/*`, `/webhooks/ocr`.
- `/health` (already), `/csp-report`, `/web-vitals`, `/exports/*`, `/late-interest/*`, `/portal/*`, `/outbox/*`, `/revalidate-legal` (now an internal admin endpoint that triggers tRPC cache invalidation).
- Each route ports its existing Zod input validation, signature verification (HMAC for webhooks where present), rate-limit override (e.g. webhook routes get higher limits than user-facing), and `writeAuditLog` calls.
- All `console.*` is forbidden; all logging goes through `@contractor-ops/logger` factories.
- Touched: `apps/api/src/routes/webhooks/**`, `apps/api/src/routes/{exports,late-interest,portal,outbox,csp-report,web-vitals,revalidate-legal}.ts`.
- Verify: a per-route Vitest port of every existing `apps/web/src/app/api/**/__tests__/*.test.ts` passes; signature-mismatched webhook payload is rejected with 401; rate-limit headers appear on responses.

### Step 6 — Cron worker

- `apps/cron-worker/src/index.ts`: long-running Node process. Uses `node-cron` to schedule jobs at the same cadence as the existing `render.yaml` cron services (`cron-token-refresh` 15m, `cron-data-purge` daily 03:00 UTC, `cron-exchange-rates` daily 06:00 UTC) plus anything currently triggered via `apps/web/src/app/api/cron/**`.
- Each job imports its handler directly from the relevant package (no HTTP self-call), runs inside a `runWithRequestContext` frame with a generated trace id, writes a `cron_run` audit log row with `success | failure | durationMs`, and reports failures to Sentry.
- Health: exposes a tiny HTTP `/health` on a non-public port returning the timestamp of the last successful run per job, so Render's liveness check has something to read.
- Touched: `apps/cron-worker/src/{index,jobs/*,env,health}.ts`.
- Verify: `pnpm --filter @contractor-ops/cron-worker test` exercises each job handler with a mocked clock; a manual `pnpm --filter @contractor-ops/cron-worker dev` shows scheduled runs in logs; the Render `cron-token-refresh`-style HTTP cron services are marked for deletion in the `render.yaml` update step but not yet removed.

### Step 7 — Vite SPA skeleton

- Add to `apps/web-vite`: `vite`, `@vitejs/plugin-react`, `react@^19.2.6`, `react-dom@^19.2.6`, `react-router-dom@^7`, `@tanstack/react-query`, `@trpc/client`, `@trpc/tanstack-react-query`, `i18next`, `react-i18next`, `i18next-icu`, `i18next-browser-languagedetector`, `@unpic/react`, `nuqs`, `@sentry/react`, `@contractor-ops/ui`, `@contractor-ops/feature-flags`, `@contractor-ops/validators`, `@contractor-ops/auth` (client only — Better Auth ships a framework-agnostic client).
- Add `vite.config.ts` with `@vitejs/plugin-react`, `rollup-plugin-visualizer`, `@sentry/vite-plugin` (source-map upload behind `SENTRY_AUTH_TOKEN`), `vite-plugin-checker` (tsc + biome in dev), explicit `build.target` matching production browsers, and `build.rollupOptions.output.manualChunks` shape (deferred until Step 12 budget gate).
- `index.html` with strict CSP `<meta>` and the same Content-Security-Policy `connect-src` / `img-src` / `script-src` profile as today's Next config.
- `src/main.tsx`: mounts `<RouterProvider>`, wraps in `<QueryClientProvider>`, `<TRPCProvider>`, `<I18nextProvider>`, `<SentryErrorBoundary>`, `<ThemeProvider>`.
- `src/router.tsx`: `createBrowserRouter` with the route tree (initially empty besides a `:locale` parent + a `404` element).
- Touched: `apps/web-vite/{vite.config,index.html,src/main.tsx,src/router.tsx,src/env.ts,src/providers/*,src/i18n/*}.ts(x)`.
- Verify: `pnpm --filter @contractor-ops/web-vite build` produces a `dist/` with `index.html` + chunked assets; `pnpm --filter @contractor-ops/web-vite preview` serves it; Lighthouse audit on the empty shell shows no CSP violations.

### Step 8 — i18n wrapper + locale routing

- `apps/web-vite/src/i18n/index.ts`: initialise `i18next` with `i18next-icu` formatter so existing ICU placeholders (e.g. `{date, date, short}`, plural forms) keep working against the unchanged `apps/web/messages/{en,de,pl,ar}.json` files (those files move to `apps/web-vite/messages/**` via `git mv` during the SPA codemod step, leaving a thin re-export so the old app keeps booting until cutover).
- Implement `useTranslations(ns: string)` compatibility hook with the same return shape (`(key, vars?) => string`) used by the 592 consuming files. Internally it composes `useTranslation(ns)` from `react-i18next`.
- Locale source of truth = the `:locale` URL segment; `i18next-browser-languagedetector` is configured with the path detector first, cookie second, navigator last.
- `dir="rtl"` is toggled on `<html>` in a top-level locale loader when locale === `'ar'`.
- Touched: `apps/web-vite/src/i18n/{index,useTranslations,detector}.ts`, the consumer codemod is deferred to Step 11.
- Verify: a Vitest snapshot test renders a sample component using each locale's namespaced strings and asserts no ICU formatting failures; switching locale flips `<html dir>`.

### Step 9 — Auth + tRPC client wiring

- `apps/web-vite/src/providers/auth-provider.tsx`: wraps Better Auth's framework-agnostic client (`createAuthClient` from `better-auth/react`) configured against `import.meta.env.VITE_API_URL` (= `https://api.contractor-ops.com`), `credentials: 'include'`.
- `apps/web-vite/src/providers/trpc-provider.tsx`: builds the tRPC React client (`createTRPCReact<AppRouter>`) with `httpBatchLink({ url: \`${VITE_API_URL}/api/trpc\`, fetch: (url, init) => fetch(url, { ...init, credentials: 'include' }) })`. A parallel `portalTrpc` instance is built for the portal namespace.
- A React Router `loader`-based `requireAuth` helper queries `getSession()` (Better Auth client) and `redirect('/login')` on null.
- Touched: `apps/web-vite/src/providers/{auth-provider,trpc-provider}.tsx`, `apps/web-vite/src/lib/require-auth.ts`.
- Verify: with `apps/api` running, the SPA's stub home page calls `trpc.health.ping.useQuery()` and renders the result; an unauthenticated visit to a protected route triggers the login redirect.

### Step 10 — Route porting (per-domain)

The Next route tree is ported to React Router routes in domain-sized batches. Each batch is one PR with its own typecheck + test gate. Order:

1. `(auth)` — `/login`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, `/portal/login`, `/portal/login/verify`.
2. `(dashboard)` shell + `/dashboard` index + global layout (sidebar, top bar, theme switcher, locale switcher).
3. `(dashboard)/contractors/**` (list, detail, engagements, classification subtree).
4. `(dashboard)/invoices/**` (list, detail, intake, intake/[id]).
5. `(dashboard)/payments/**`, `(dashboard)/approvals/**`, `(dashboard)/contracts/**`, `(dashboard)/equipment/**`.
6. `(dashboard)/workflows/**`, `(dashboard)/time/**`, `(dashboard)/organization/**` (cost-centers, projects, teams).
7. `(dashboard)/classification/**` (root + expert-help).
8. `(dashboard)/settings/**`, `(dashboard)/unauthorized`.
9. `(portal)/portal/**` — invoices, contracts, time, payments, login, login/verify.
10. `admin/**` (root layout + BoeRate page + any other admin tools).

For each batch:
- Pages with no `'use server'`, no `next/headers`, no `cookies()`/`redirect()` from Next, and no async server-component body port as 1:1 client components.
- Async server-component bodies are rewritten as client components that load via tRPC + TanStack Query. The `loader` on the React Router route is used only for auth gating and 404 short-circuiting, not for data fetching (matches the chosen pattern: data flows through TanStack Query for cache + invalidation parity with today's app).
- `next/link` → `react-router-dom` `<Link>` / `<NavLink>`.
- `next/navigation` → `react-router-dom` `useNavigate`, `useParams`, `useLocation`, `useSearchParams`.
- `next/dynamic { ssr: false }` (2 known call-sites) → `React.lazy(() => import(...))` + `Suspense` fallback.
- Touched per batch: `apps/web-vite/src/app/(<group>)/**/page.tsx` mirrors of `apps/web/src/app/[locale]/(<group>)/**/page.tsx`, the matching `*.test.tsx` ports, and any route-local components.
- Verify per batch: `pnpm typecheck --filter=@contractor-ops/web-vite`, `pnpm test --filter=@contractor-ops/web-vite`, `pnpm --filter @contractor-ops/web-vite preview` + manual smoke of every page in the batch in en/de/pl/ar.

### Step 11 — Codemod sweeps across the new SPA

Once routes are ported, three mechanical sweeps clean up imports:

- `next-intl` import → `@/i18n/useTranslations` (the compat hook). Per-file `Edit` (CLAUDE.md forbids bulk `sed`).
- `next/image` `<Image>` → `@unpic/react` `<Image>` preserving `src`/`width`/`height`/`alt`/`priority`/`className`.
- `nuqs` consumers continue to import from `nuqs` but the provider in `main.tsx` uses the React Router adapter (`<NuqsAdapter>` from `nuqs/adapters/react-router/v7`).
- Touched: every consumer file across `apps/web-vite/src/**`.
- Verify: `pnpm typecheck` passes with zero references to `next-intl`, `next/image`, `next/link`, `next/navigation`, `next/dynamic`, `next/headers`, `next/server`, `next/cache`, `@sentry/nextjs`, `next-themes/Next` from the new SPA tree (a grep gate is added to `pnpm lint:no-next` and wired into CI).

### Step 12 — Bundle, perf, Web Vitals

- Add `size-limit` config at the repo root targeting `apps/web-vite/dist/**` with explicit budgets per chunk class (initial JS, CSS, async per-route). Initial budget is set from the first production build measurement plus a small headroom; tightening passes happen in follow-up PRs.
- Add `rollup-plugin-visualizer` output to `apps/web-vite/dist/stats.html` on `build:analyze`.
- Wire Web Vitals reporting client-side using `web-vitals` library to `POST /api/web-vitals` on `apps/api`, which forwards to PostHog with the existing event schema.
- Wire `@sentry/vite-plugin` to upload source maps from `apps/web-vite/dist/**` to Sentry on every production build (token via `SENTRY_AUTH_TOKEN`).
- Touched: `apps/web-vite/{size-limit.config,vite.config}.ts`, repo root `.size-limit.json` if cross-package gate is preferred, CI workflow file.
- Verify: `pnpm size` (or equivalent script) reports size against budget and exits non-zero on overage; `dist/stats.html` opens; a Web Vitals event arrives at PostHog when the preview server is exercised; a deliberately thrown error in the SPA appears in Sentry with original source frames.

### Step 13 — Playwright reconfig

- Update `playwright.functional.config.ts`, `playwright.integration.config.ts`, `playwright.perf.config.ts`, `playwright.rtl.config.ts` (and the `a11y` project) to point `baseURL` at the new dev/preview URL (`http://localhost:5173` dev, `http://localhost:4173` preview) and the API at `http://localhost:4000`.
- Each Playwright project starts both `apps/web-vite` and `apps/api` via `webServer` config (dual-process).
- Scenarios that asserted URL shape `[locale]/...` continue to pass because the URL contract is preserved.
- Touched: the four `playwright.*.config.ts` files + the per-project setup helpers.
- Verify: `pnpm --filter @contractor-ops/web-vite e2e:functional`, `e2e:integration`, `e2e:perf`, `e2e:rtl`, `test:a11y` all pass against the new stack.

### Step 14 — render.yaml + DNS

- Add three new services to `render.yaml`:
  - `web-vite` — Render Static Site, build `pnpm --filter @contractor-ops/web-vite build`, publish dir `apps/web-vite/dist`, custom domain placeholder `app-next.contractor-ops.com` (rename to `app` on cutover).
  - `api` — Render Web Service, Docker, build/start `pnpm --filter @contractor-ops/api-server start`, custom domain `api-next.contractor-ops.com` (rename to `api` on cutover).
  - `cron-worker` — Render Background Worker, Docker, build/start `pnpm --filter @contractor-ops/cron-worker start`.
- Old `web` service is **kept running** during migration. The three legacy HTTP cron services (`cron-token-refresh`, `cron-data-purge`, `cron-exchange-rates`) keep pinging the old `web` until cutover.
- Add a `previews` block for the new services mirroring the existing 7-day preview policy.
- Touched: `render.yaml`.
- Verify: a `render` blueprint dry-run validates the yaml (`render blueprint validate render.yaml`); a preview deploy of a PR brings up the three new services accessible behind the `*-next` domains; old prod traffic on `web` remains unaffected.

### Step 15 — UAT (cross-domain regression)

- Build a UAT checklist in `goals/migrate-web-off-next-to-vite-react/uat.md` covering every domain in the route porting list, every webhook (signed payload replay), every cron job (manual trigger), and the auth flow in each locale.
- Run UAT manually + via the ported Playwright suites against `app-next.*` + `api-next.*`.
- Capture any parity gaps as follow-up tasks gated as **blockers** for cutover.
- Verify: all UAT items checked off; zero unresolved blockers.

### Step 16 — Cutover

- Swap DNS / Render custom domains: `app.contractor-ops.com` now points to the static site, `api.contractor-ops.com` now points to the new Fastify service.
- Update env vars `APP_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` (where still consumed by `apps/landing` / `apps/cms`) to the post-cutover values.
- Reissue Better Auth cookies under the new `api.*` host with `Domain=.contractor-ops.com` so existing sessions on `app.*` are honoured (or, if cross-domain cookies cause friction, force a fresh login on cutover and document it in the release notes).
- Cut over webhook providers (KSeF / Peppol / ZATCA / Teams / Google Workspace / OAuth callbacks) to the new `api.*` hostnames.
- Cut over external cron schedulers (Render HTTP cron jobs that used to ping `web`) — either delete them now that `apps/cron-worker` handles its own schedule, or repoint them at `api.*` for any remaining HTTP-triggered jobs.
- Verify: a synthetic transaction script hits each of: login, dashboard load, contractor CRUD, invoice intake, portal login, portal invoice submit, webhook receive (one per provider via signed test payload), cron trigger; everything green; Sentry shows no surge in error rate; PostHog active-users metric matches the prior baseline.

### Step 17 — 2-week grace period

- Old `apps/web` + its Render `web` service stay deployed but de-prioritised (no new domains, no new traffic). Kept warm for instant rollback by repointing DNS.
- Active monitoring: Sentry error rate, PostHog active-user count, Web Vitals (LCP/INP/CLS) p75 vs pre-cutover baseline, audit-log volume.
- Any P0/P1 regression triggers a documented rollback playbook: repoint DNS back to old `web`, re-enable old cron HTTP jobs, surface the regression in a new fix-forward task.
- Verify: a daily health digest is captured in `goals/migrate-web-off-next-to-vite-react/grace-period.md` for 14 days; no rollback needed.

### Step 18 — Retire Next app

- After the grace period closes cleanly:
  - Delete `apps/web/` from the repo.
  - Remove the `web` service from `render.yaml` (and the three legacy HTTP cron services if not already removed in Step 16).
  - Remove `next`, `@sentry/nextjs`, `@next/bundle-analyzer`, `next-intl`, `next-themes` (if no longer consumed elsewhere — `apps/landing` may still need them) from the root `package.json` and any workspace package.json files.
  - `git mv` the `apps/web-vite` workspace to `apps/web` (final name).
- Touched: `apps/web/**` (delete), `apps/web-vite/**` → `apps/web/**` (move), `render.yaml`, `pnpm-workspace.yaml`, every `package.json` referencing the old paths.
- Verify: `pnpm install` + `pnpm typecheck` + `pnpm test` + `pnpm --filter @contractor-ops/web build` all pass under the renamed workspace; a final Playwright run against staging is green; the `render.yaml` describes only the new service set.

## Risks & open questions

- **Cross-subdomain cookies**: `app.* ↔ api.*` requires `SameSite=None; Secure` with `Domain=.contractor-ops.com`. Modern browsers honour this for same-org subdomains, but ITP/tracking-prevention rules around third-party cookies are evolving — must be validated in Safari (macOS + iOS) and Firefox Private mode before cutover. Mitigation: if blocked, fall back to a same-origin reverse-proxy posture (Caddy/Render rewrite `/api/*` → api service) and revisit the architectural separation later. **This contradicts the chosen "separate domains" decision in `facts.md` and is the single largest risk.**
- **Better Auth Fastify adapter**: Better Auth's `toNodeHandler` path needs verification against the current Better Auth version (`^1.6.9`); if Web `Request`/`Response` bridging is required, that helper lives in `apps/api` and must be carefully unit-tested for header / body / streaming / cookie correctness. CSRF/SameSite/CORS interactions here are the most error-prone surface in the entire migration.
- **`apps/cms` shared dependencies**: `apps/cms` (Payload + Next) likely pulls some shared types via `packages/db` / `packages/auth`. Need to confirm removing Next from the repo root deps doesn't break the CMS workspace. Pin shared deps in the CMS workspace explicitly before pruning at the root.
- **public-api workspace**: `render.yaml` references a `public-api` service (Enterprise REST surface). Locate its workspace, confirm it is unrelated to `apps/web` and stays untouched, and ensure its build/start commands are not broken by `pnpm-workspace.yaml` changes.
- **next-intl ICU compatibility under i18next-icu**: not all next-intl ICU extensions are 1:1 with formatjs ICU. The codemod sweep must spot-check uncommon patterns (e.g. `{value, selectordinal, …}`, custom format aliases). A Vitest harness loading every namespace and rendering with each locale catches regressions before cutover.
- **Web Vitals SSR baseline gone**: today's INP/LCP partly benefits from SSR-prerendered shell. Pure CSR will likely degrade LCP on first paint until route-level code-splitting + skeleton states are dialled in. The bundle-budget gate in Step 12 is the lever; we may need to widen the initial budget short-term and tighten it iteratively.
- **Render `worker` service**: there is already a `worker` Background Worker in `render.yaml`. Confirm whether `apps/cron-worker` replaces it, supplements it, or is the same workspace renamed. If supplemented, decide whether the new cron logic should fold into the existing `worker` instead of adding a new service.
- **Source-map upload secret**: `SENTRY_AUTH_TOKEN` must be added to Render and to CI before the first production Vite build, otherwise Sentry stack frames are minified-only.
- **CSP regression surface**: the current Next CSP is large and tuned per route. Composing it into a single helmet config requires a careful per-directive audit; a CSP report-only rollout on `apps/api` for 48 h before enforcing is recommended.
- **CORS preflight cache**: with separate domains, every cross-origin call costs an `OPTIONS`. Tune `@fastify/cors` `maxAge` to a high value (e.g. 86400) to amortise.
- **Codemod scale**: 592 next-intl consumers, dozens of `<Image>` and `next/link` call-sites. CLAUDE.md forbids `sed`/script bulk replace — every file gets an individual `Edit`. This is slow but contractual.
- **Test debt baseline**: `packages/api` carries a known test-debt handoff (`.planning/handoffs/test-cleanup-2026-04-27.md`, ~16 files / ~51 failures as of Apr 2026). Re-run `pnpm test --filter @contractor-ops/api` at the start of the migration to capture the current baseline so we don't blame the migration for pre-existing failures.
