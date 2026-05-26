# Discovery — Migrate apps/web off Next.js to Vite + React

Captured: 2026-05-22. All counts/paths verified in-tree; no memory-sourced numbers.

## 1. apps/web/src/app/api/** routes (40 route.ts files; all non-test)

### Auth + tRPC mount points

- `apps/web/src/app/api/auth/[...all]/route.ts` — Better Auth catch-all (`toNextJsHandler(auth)`). Wraps with Sentry capture + `runWithRequestContext`. Tests: `__tests__/route.test.ts`.
- `apps/web/src/app/api/trpc/[trpc]/route.ts` — staff `appRouter` via `fetchRequestHandler`. Tests: `__tests__/route.test.ts`.
- `apps/web/src/app/api/trpc/portal/[trpc]/route.ts` — `portalAppRouter` via `fetchRequestHandler`. Tests: `__tests__/route.test.ts`.

### Webhooks (external-signed payloads)

- `webhooks/stripe/route.ts` — Stripe HMAC; tests present.
- `webhooks/storecove/route.ts` — Peppol BIS via Storecove; HMAC; tests.
- `webhooks/inpost/route.ts` — InPost shipment status; HMAC; tests.
- `webhooks/[provider]/route.ts` — multi-provider dispatch (Slack/Resend/etc.); tests.
- `webhooks/_process/route.ts` — QStash drain worker; signature verified; tests.
- `webhooks/slack-webhook-context.ts` — shared helper; tests `__tests__/slack-webhook-context.test.ts`.

### Government / e-invoicing

- `ksef/_sync/route.ts` — Polish KSeF sync; tests.
- `peppol/inbound/route.ts`, `peppol/outbound/route.ts`, `peppol/poll/route.ts` — Peppol AS4; tests for all three.
- `zatca/_submit/route.ts` — Saudi ZATCA submit (B2B Phase 2); no test file.

### Workflow / queue drains

- `ocr/_process/route.ts` — Claude Vision OCR worker; tests.
- `exports/_process/route.ts` — CSV/PDF export render; no test.
- `exports/[exportId]/download/route.ts` — signed download URL; no test.
- `outbox/_drain/route.ts` — transactional outbox drain; no test.
- `google-workspace/_sync/route.ts` — GW directory sync; tests.
- `teams/messages/route.ts` — MS Teams bot receive; tests.
- `late-interest/_render-claim-pdf/route.ts` — PDF render for claim letters; no test.

### Cron HTTP triggers (today; replaced by `apps/cron-worker`)

- `cron/data-purge/route.ts` (tests)
- `cron/exchange-rates/route.ts`
- `cron/token-refresh/route.ts` (tests)
- `cron/trial-notifications/route.ts` (tests)
- `cron/inpost-status-poll/route.ts` (tests)
- `cron/boe-rate-poll/route.ts`
- `cron/classification-reassessment-triggers/route.ts` (tests)
- `cron/classification-economic-dependency/route.ts` (tests)
- `cron/org-definition-sync/route.ts`
- `cron/job-health/route.ts` (tests)
- `cron/late-interest-pdf-reaper/route.ts`
- `cron/reminders/route.ts` (+ shared helpers; tests, including `drv-expiry.test.ts`)

### OAuth

- `oauth/[provider]/start/route.ts` — PKCE start.
- `oauth/[provider]/callback/route.ts` — state-validated callback; tests.

### Portal session cookie helpers

- `portal/set-session/route.ts` — issues portal cookie; tests.
- `portal/clear-session/route.ts` — clears portal cookie; tests.

### Utility / observability

- `health/route.ts` — multi-probe liveness (Postgres, Redis, QStash, R2, backpressure); 5 s overall cap; tests.
- `csp-report/route.ts` — CSP violation sink.
- `web-vitals/route.ts` — client beacon → PostHog forwarder.
- `revalidate-legal/route.ts` — Next ISR cache bust for `/legal/*`; HMAC tests `__tests__/hmac.test.ts`.

## 2. apps/web/src/app/[locale]/** pages (65 page.tsx files; 74 page+layout)

### Route groups

- `(auth)` — `login`, `register`, `verify-email`, `invite/[token]`.
- `(dashboard)` shell + index `page.tsx`; sub-trees: `approvals`, `classification` (+ `expert-help`), `contractors/[id]/...` (engagements, classification, assessments), `contracts/[id]?`, `equipment/[id]?`, `invoices/[id]?` + `invoices/intake[/id]?`, `notifications`, `onboarding/import`, `organization` (+ `cost-centers`, `projects`, `teams`), `payments`, `reports`, `settings` (+ `calendar`, `e-invoicing[/log]`, `integrations/zatca`, `members`, `payments`, `tax`, `workflow-roles`), `time[/[contractorId]]`, `unauthorized`, `workflows[/[id]]` + `workflows/templates[/new|/[id]]`.
- `(legal)` — `legal/breach-notification`, `legal/privacy[/[jurisdiction]]`, `legal/sub-processors`, `legal/terms`. **PUBLIC** (no auth gate).
- `(portal)` — `portal` index, `portal/contracts[/[id]]`, `portal/documents`, `portal/equipment`, `portal/invoices[/[id]|/submit[/success]]`, `portal/login[/verify]`, `portal/payments`, `portal/settings`, `portal/time`.
- Admin tree (path: `/admin/**`) — confirm under `[locale]/admin/**` once Step 10 batch 10 begins.

## 3. Next-only imports across apps/web/src

| Import | Files |
|---|---|
| `next/dynamic` | 2 |
| `next/headers` | 16 |
| `next/navigation` | 77 |
| `next/server` | 58 |
| `next-intl/server` | 28 |
| `next-intl/middleware` | 1 (`src/middleware.ts`) |
| `next-intl/plugin` | 0 |
| `next/image` | 13 |
| `next/font` | 2 |
| `next/link` | 7 |
| `next/cache` | 3 |
| `unstable_cache` | 1 |
| `revalidatePath` | 0 |
| `revalidateTag` | 2 |
| `@sentry/nextjs` | 51 |
| `@next/bundle-analyzer` | 0 |

`next-intl` (any subpath) imports: **545 files**.

## 4. apps/web/src/middleware.ts responsibilities (741 lines)

1. **Locale detection / rewrite** via `createMiddleware(routing)` from `next-intl/middleware`; locales = `['en', 'de', 'pl', 'ar']` (verify in `src/i18n/routing.ts`).
2. **Per-IP rate limiting** via Upstash `Ratelimit.slidingWindow`:
   - portal `/portal/*` → 10 req/min.
   - api `/api/*` (excluding `/api/auth/*`) → 60 req/min.
   - In-memory LRU fallback (`Map<key, {count, resetAt, lastSeenMs}>`, MAX 10 000, LRU 10 % eviction on overflow).
   - **Fail-closed** in production on Upstash error (503 + `Retry-After: 5`); fail-open in dev with Sentry breadcrumb + throttled `captureMessage` (max 1/min).
   - `/api/auth/*` deliberately exempt (Better Auth handles per-endpoint limits + account lockout + Turnstile).
3. **F-SEC-17 trusted-proxy / client-IP extraction** via `proxy-addr` walking XFF right-to-left, stopping at first untrusted hop; falls back to `x-real-ip`; trust list from `TRUSTED_PROXIES` env (default `loopback,linklocal,uniquelocal`).
4. **Load-test bypass** for `/api/trpc/*` via `LOAD_TEST_BYPASS=1` + `LOAD_TEST_SECRET` header (constant-time compare); hard-blocked on Vercel/Render production.
5. **Portal subdomain routing** for `{slug}.{PORTAL_BASE_DOMAIN}`.
6. **Auth route gating** — redirect authenticated users away from `(auth)` pages, unauthenticated users away from `(dashboard)`/`(admin)`; `(legal)` and `/invite/[token]` whitelisted.
7. **Sentry edge instrumentation** — every captured warning/error tagged `component: edge-middleware`.

All seven move into `apps/api` Fastify plugins (rate-limit + CORS + helmet + auth gating) or into the SPA router (locale segment is the URL source of truth; auth gating becomes a React Router `loader`).

## 5. next-intl consumers

- ~545 files import `next-intl` (any subpath). Server subpath `next-intl/server` in 28 files; middleware in 1; the remainder are client `useTranslations()` consumers.
- Messages live at `apps/web/messages/{en,de,pl,ar}.json` (ICU MessageFormat). `git mv` to `apps/web-vite/messages/**` during Step 8 with a thin re-export shim for the legacy app until cutover.
- `apps/web/src/i18n/` exports: `config.ts`, `navigation.ts`, `request.ts`, `routing.ts`, `typed-keys.ts`. The `useTranslations` compat hook ports the `typed-keys.ts` surface to keep call-site signatures stable.

## 6. render.yaml services (730 lines)

Current live services:

- `web` — Docker Web Service, Next.js standalone (`apps/web/Dockerfile` target `runner-web`), Frankfurt, health `/api/health`. **Stays until cutover; removed in Step 18.**
- `cms` — Docker Web Service, Payload (`apps/cms`). **Out of scope.**
- `landing` — Static Site (`apps/landing`). **Out of scope (stays on Next).**
- `public-api` — Docker Web Service, Hono + tRPC Enterprise REST surface (workspace `@contractor-ops/public-api`). **Out of scope; separate from staff tRPC.**
- `worker` — Background Worker, Docker. **Open question (plan risk #6):** decide whether `apps/cron-worker` folds in here or stays a third separate worker. Recommendation: keep separate — `worker` already serves QStash drains; cron schedule belongs in `apps/cron-worker`.
- `clamav` — Private Service, image, persistent disk.
- `unleash-eu`, `unleash-me` — Private Services, self-hosted Unleash OSS per region.
- `cloudflared` — Private Service, Zero Trust tunnel for Unleash admin UIs (suspended by default).
- HTTP cron services (call legacy `web` via private net): `cron-token-refresh` (15 m), `cron-data-purge` (daily 03:00 UTC), `cron-exchange-rates` (daily 06:00 UTC), `cron-org-definition-sync` (cadence in yaml). Plus any other cron jobs declared further in the yaml not enumerated here. **All retired in Step 16 / 18 once `apps/cron-worker` schedules them in-process.**

Added in Step 14:

- `web-vite` — Render Static Site, `apps/web-vite/dist/`, domain `app-next.contractor-ops.com` → renamed to `app` on cutover.
- `api` — Docker Web Service, `apps/api` (`@contractor-ops/api-server`), domain `api-next.contractor-ops.com` → renamed to `api` on cutover.
- `cron-worker` — Background Worker, `apps/cron-worker`.

## 7. public-api workspace confirmation

- Workspace `@contractor-ops/public-api` lives at `apps/public-api/`.
- Stack: Hono + `@hono/node-server` + `@trpc/server` + `@upstash/ratelimit` + `@sentry/node`. Imports `@contractor-ops/api` (staff tRPC routers) and `@contractor-ops/db`. **No Next.js dependency.**
- Conclusion: untouched by this migration. Its build/start commands (`tsx watch ... src/index.ts`, `node dist/index.js`) are independent of `apps/web` and survive the `pnpm-workspace.yaml` additions in Step 1.

## 8. Sentry config locations (for Step 2 port)

- `apps/web/src/sentry.server.config.ts` — server runtime init.
- `apps/web/src/sentry.client.config.ts` — browser init (ports to `apps/web-vite/src/sentry.ts` via `@sentry/react`).
- `apps/web/src/sentry.edge.config.ts` — edge runtime init (DELETED with Next edge runtime).
- `apps/web/src/instrumentation.ts` — Next instrumentation hook (DELETED; Fastify Sentry plugin replaces it).

## 9. Versions in play

- `next ^16.2.5`, `next-intl ^4.11.0`, `@sentry/nextjs ^10.51.0`, `better-auth ^1.6.9`, `react ^19.2.6`.

## 10. Outstanding questions resolved here

- `apps/public-api` is **not** part of this migration. Confirmed via workspace inspection.
- `apps/landing` and `apps/cms` stay on Next (out of scope per facts.md). Their `package.json` keeps `next` / `next-intl` until separately migrated.
- The `worker` Render service stays; `apps/cron-worker` is additive.

## 11. Open items deferred to per-step PRs

- Exhaustive page-level data-fetching audit (server-component bodies → tRPC + TanStack Query) — captured per batch in Step 10 PR descriptions.
- Full per-route Zod schema list for Step 5 webhook port — captured in Step 5 PR.
- CSP per-directive diff between Next config and the new helmet config — captured in Step 2 PR (with a 48 h report-only rollout).
