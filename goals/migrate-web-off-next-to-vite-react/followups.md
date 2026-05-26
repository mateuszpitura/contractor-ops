# Follow-ups — Migrate apps/web off Next.js to Vite + React

Concrete remaining work, ordered by dependency. Every item names the
exact files involved and references the proof-of-pattern artifact in
this branch so the next session can pick it up without re-deriving the
approach.

## Status snapshot (commit XXX)

Done: discovery + Steps 1-9, 12-15 (11 of 19). 27 tests added — all
green. `vite build` succeeds; size-limit gate at 568 KB gzipped /
650 KB limit.

### Session 2026-05-22 increment

Ported in this session, all tests green (50 total in apps/api now):

- `/webhooks/storecove` → `apps/api/src/routes/webhooks/storecove.ts` +
  `apps/api/src/__tests__/storecove-webhook.test.ts` (5 cases — success
  event, failed event, invalid signature, unknown event type,
  idempotency).
- `/webhooks/:provider` (multi-provider dispatch) →
  `apps/api/src/routes/webhooks/multi-provider.ts` +
  `apps/api/src/__tests__/multi-provider-webhook.test.ts` (8 cases —
  unknown provider, no-webhook adapter, invalid sig, happy path with
  QStash enqueue, Slack team-id resolve + unresolved, Resend slug
  resolve + unknown slug).
- `/webhooks/_process` (QStash drain) →
  `apps/api/src/routes/webhooks/process.ts` +
  `apps/api/src/__tests__/process-webhook.test.ts` (8 cases — missing
  sig, invalid sig, invalid body, no-handler adapter, missing delivery,
  happy-path PROCESSED, already-processed skip, claim-contention skip).
  Replaces `verifySignatureAppRouter` from `@upstash/qstash/nextjs` with
  the framework-agnostic `Receiver` from `@upstash/qstash` — request URL
  rebuilt from Fastify's `protocol`+`hostname`+`url` (trustProxy honours
  XFF).
- Shared QStash guard extracted to `apps/api/src/lib/qstash-verify.ts`
  (`guardQStashRequest`) — `_process`, `/zatca/_submit`, `/peppol/poll`
  all consume it. Owns: signature check, missing-key fail-fast,
  URL rebuild, ALS frame reseed from upstream headers.
- `/zatca/_submit` → `apps/api/src/routes/zatca.ts` (uses the shared
  guard; mirrors legacy idempotency + `ZatcaApiError` branch).
  Smoke test pending — pattern equivalent to `process-webhook.test.ts`.
- `/peppol/poll` → `apps/api/src/routes/peppol.ts` (uses the shared
  guard; per-org sweep + `queue:peppol-poll-participants` depth gauge
  preserved). Smoke test pending.
- `EXEMPT_PREFIXES` in `apps/api/src/plugins/csrf-origin.ts` now also
  covers `/zatca/` + `/peppol/` + `/ksef/` (QStash signature is the
  actual authn).
- `/peppol/inbound` + `/peppol/outbound` appended to
  `apps/api/src/routes/peppol.ts` — outbound retains F-ASYNC-08 retry
  classification + F-SCALE-19 backpressure via
  `BackpressureRoutes.PEPPOL_OUTBOUND`. Smoke tests pending.
- `/ksef/_sync` → `apps/api/src/routes/ksef.ts` (Polish KSeF feed
  consumer, hourly cron + manual triggers). Smoke test pending.
- `/teams/messages` → `apps/api/src/routes/teams.ts` (Bot Framework
  CloudAdapter singleton + shim req/res preserved). Registered at root
  scope; `/teams/` added to csrf-origin exempt list.
- **Stage 1 botbuilder → Microsoft 365 Agents SDK migration** (2026-05-22):
  archived `botbuilder` (Microsoft archived the JS SDK end of Dec 2025)
  swapped across 4 files for `@microsoft/agents-hosting` +
  `@microsoft/agents-hosting-extensions-teams` + `@microsoft/agents-activity`.
  Files: `apps/api/src/routes/teams.ts`,
  `packages/api/src/services/teams/teams-bot-handler.ts`,
  `packages/api/src/services/messaging/teams-messaging-provider.ts`,
  `apps/web/src/app/api/teams/messages/route.ts` (legacy, deleted in Step 18).
  Key changes:
  - `ConfigurationBotFrameworkAuthentication(process.env)` →
    plain `AuthConfiguration` object built from existing
    `AZURE_BOT_APP_ID`/`AZURE_BOT_APP_SECRET` (no Render env rename).
  - Agents SDK splits JWT validation out of `CloudAdapter.process()`
    into the Express middleware `authorizeJWT(authConfig)`. `apps/api/`
    bridges this into Fastify with a small Express ↔ Fastify shim that
    runs `authorizeJWT` as a route-scoped preHandler step before
    `adapter.process()`. Without it `request.user` is undefined and
    Bot Framework activities are processed without identity.
  - `adapter.continueConversationAsync` renamed to `continueConversation`.
  - `TurnContext.getConversationReference(activity)` (static) →
    `activity.getConversationReference()` (instance).
  - Protected `onInstallationUpdateAddActivity` collapsed into
    `onInstallationUpdateActivity`; we filter on `activity.action === 'add'`.
  - `context.sendActivity({...})` and `context.updateActivity({...})`
    now require Activity instances; wrapped with `MessageFactory.attachment`
    + `Activity.fromObject` where POJOs were previously inlined.
  - Stage 2 deferred: switch `ActivityHandler`-based class to the
    recommended `AgentApplication` route-builder. Track separately —
    bigger refactor, no SDK obligation (ActivityHandler compat indefinite).
  Verification: `pnpm --filter @contractor-ops/api-server typecheck` clean;
  apps/api 50/50 tests pass; packages/api teams + messaging suites 58/58
  pass; pre-existing test debt (per `.planning/handoffs/test-cleanup-2026-04-27.md`)
  unchanged.
- Workflow / queue drains ported (`/ocr/_process`, `/exports/_process`,
  `/outbox/_drain`, `/google-workspace/_sync`, `/late-interest/_render-claim-pdf`)
  → `apps/api/src/routes/{ocr,exports,outbox,google-workspace,late-interest}.ts`.
  Each consumes `guardQStashRequest` + `withQueueObservability` and
  preserves the legacy F-SCALE-19 backpressure + F-ASYNC-16 error
  classification where present. CSRF exempt prefixes extended for each.
- Slack helper lifted to
  `apps/api/src/lib/webhooks/slack-webhook-context.ts` (1:1 port — same
  cache keys / TTL) + `slack-webhook-context.test.ts` (6 cases for
  `extractSlackTeamId`).
- `apps/api/package.json` gains `@contractor-ops/einvoice`,
  `@contractor-ops/integrations`, `@upstash/qstash` deps.

Remaining work:
- Step 5 — Fastify port: all 18 routes from the **Webhook providers**,
  **Workflow/queue drains**, **OAuth**, and **Portal session helpers**
  sections shipped, plus the full `/health` probe set
  (Postgres + Upstash Redis + Upstash QStash + Cloudflare R2 + QStash
  backpressure depth). `NODE_ENV === 'test'` short-circuits `/health` to
  the skeleton shape and disables the rate-limit throttle (headers still
  emitted) so cross-file integration tests don't share Upstash slots.
- Step 6 — Cron-worker handler ports: `token-refresh`,
  `exchange-rates`, `boe-rate-poll`, `org-definition-sync` lifted from
  `apps/web/src/app/api/cron/<job>/route.ts` to
  `apps/cron-worker/src/jobs/handlers/<job>.ts`; registry wired to call
  them directly (no HTTP self-call). boe-rate-poll preserves the
  `payments.late-interest-enabled` feature-flag short-circuit. Adds
  `@contractor-ops/{api,db,feature-flags,integrations,validators}`
  workspace deps to cron-worker plus a `clamscan` ambient shim
  (transitive via `@contractor-ops/api`). Two new env vars:
  `CRON_BOE_RATE_POLL_SCHEDULE`, `CRON_ORG_DEFINITION_SYNC_SCHEDULE`.
  Plus `classification-reassessment-triggers` +
  `classification-economic-dependency` (both flag-gated on
  `module.classification-engine`), `inpost-status-poll` (covers
  InPost + DPD + UPS with per-carrier resilience), and `data-purge`
  (90-day soft-delete retention sweep + R2 cleanup + ephemeral table
  purges; F-SCALE-07 tx timeout/maxWait preserved). 8 of 12 cron
  handlers now production-real.
  Plus `job-health` (every-5-min reaper: bumps `attempts`, exponential
  backoff re-enqueue, FAILED after 5 attempts; emits queue-depth +
  failure-rate gauges and fires Sentry alerts on threshold breach),
  `late-interest-pdf-reaper` (backfills pre-async-migration rows with a
  pdfKey, reverts crashed-mid-render rows, re-enqueues with
  `deduplicationId` collapsing duplicate ticks),
  `trial-notifications` (D-10 7d/1d trial-end fanout with
  F-ASYNC-07 advisory lock + per-org `NotificationCronDedup` dedup), and
  `reminders` (largest handler — daily 09:00 UTC; F-ASYNC-06 advisory
  lock + F-SCALE-07 60s tx ceiling; fans out `evaluateReminderRules` +
  `detectOverdueTasks` + `detectDrvClearanceExpiries` via `Promise.all`;
  shared `addDays/startOfDay/claimCronNotificationDedup` helpers live
  under `handlers/reminders/shared.ts`).
  **All 12 cron handlers now production-real.**
- Smoke tests landed for `/zatca/_submit`, `/ocr/_process`,
  `/outbox/_drain`, `/peppol/poll`, `/ksef/_sync`,
  `/google-workspace/_sync`, `/exports/_process`,
  `/late-interest/_render-claim-pdf`, `/peppol/inbound`,
  `/peppol/outbound`, `/api/oauth/:provider/start`,
  `/api/oauth/:provider/callback`, `/teams/messages`,
  `/health` (full probe pipeline) — **78 cases (apps/api now
  128/128 green)**. Each suite covers: missing/invalid signature (or
  state), invalid body / missing query params, happy path, error /
  classification branches, cookie set+clear flow for OAuth, JWT-bridge
  401 propagation for teams, and per-probe ok/skipped/fail combos for
  the production health endpoint (DB/Redis/QStash/R2/backpressure).
  Test setup now seeds `STRIPE_SECRET_KEY=sk_test_placeholder` because
  `packages/api` eagerly constructs the Stripe client at module load —
  that throws on undefined key during test boot before any test runs.
- Step 14 — `render.yaml` now ships `api-server` (Fastify Docker web
  service, port 4000, `/health` probe), `cron-worker` (Background
  Worker, internal `/health` on 4100), and `web-vite` (Render Static
  Site, SPA rewrite fallback, immutable asset cache + no-cache index.html,
  full CSP / HSTS / Frame-Options / Referrer-Policy header set). The
  `cron-worker` envVars block lists every schedule override so an
  operator can tighten cadence from the Render dashboard without code
  changes. Legacy `web` + the 4 legacy HTTP cron services stay in the
  blueprint until plan.md Step 16 cutover.
- Step 10 — port remaining page bodies (dashboard shell + ListDataView landed; widgets/tables in follow-up batches).
- Step 11 — codemod ~592 `next-intl` consumer imports in apps/web (`apps/web-vite/src` clean — `pnpm lint:no-next`).
- Step 13 — Playwright batch 1 auth spec ported to `apps/web-vite/e2e/functional/auth.spec.ts`.
- Step 16 — cutover (user-driven Render + DNS work) — see `cutover-runbook.md`.
- Step 17 — 14-day production grace period — see `grace-period.md`.
- Step 18 — delete legacy apps/web + remove Next deps + git mv rename.

### OAuth path alignment (2026-05-22)

Fastify routes register at `/api/oauth/:provider/{start,callback}` (legacy parity).
`redirectUri` uses `${API_URL}${oauthConfig.redirectPath}` so IdP callbacks hit the
API host after cutover. Smoke tests: `oauth-start.test.ts`, `oauth-callback.test.ts`.

## Step 5 — port remaining webhook + utility routes

Proof-of-pattern shipped in this branch:
- `apps/api/src/routes/csp-report.ts`
- `apps/api/src/routes/web-vitals.ts`
- `apps/api/src/routes/webhooks/stripe.ts`
- `apps/api/src/routes/webhooks/inpost.ts`
- `apps/api/src/routes/webhooks/storecove.ts`
- `apps/api/src/routes/webhooks/multi-provider.ts` (parametric
  `:provider` dispatcher — adapter-driven; register AFTER explicit
  per-provider routes)
- `apps/api/src/routes/webhooks/index.ts` (raw-body parser scope)
- `apps/api/src/lib/webhooks/slack-webhook-context.ts`
- `apps/api/src/__tests__/utility-routes.test.ts`
- `apps/api/src/__tests__/storecove-webhook.test.ts`
- `apps/api/src/__tests__/multi-provider-webhook.test.ts`
- `apps/api/src/__tests__/slack-webhook-context.test.ts`

Each remaining route is a mechanical application:

1. Read the legacy `apps/web/src/app/api/<route>/route.ts`.
2. Lift its handler into `apps/api/src/routes/<route>.ts` (or
   `routes/webhooks/<provider>.ts` for signed-webhook providers).
3. Convert `NextRequest` / `NextResponse` calls to Fastify
   `request` / `reply` calls — every helper used in the legacy route
   (`createWebhookLogger`, `metrics`, `Sentry`, Prisma transactions,
   `writeAuditLog`, idempotency tables) is already imported the same
   way in the new tree.
4. Register the route inside `server.ts` (root-scope handlers like
   csp-report / web-vitals) or inside `routes/webhooks/index.ts`
   (signed providers needing the raw body parser).
5. Port the legacy `__tests__/route.test.ts` into the same path under
   `src/__tests__/` adapted to `app.inject()`.
6. If the route needs an Origin exemption (signed webhooks, browser
   beacons), add the prefix to `EXEMPT_PREFIXES` in
   `apps/api/src/plugins/csrf-origin.ts`.

### Webhook providers to port (≈ 11 files)

| Route | Legacy path | Notes |
|---|---|---|
| ~~`/webhooks/storecove`~~ | `apps/web/src/app/api/webhooks/storecove/route.ts` | DONE (2026-05-22) |
| ~~`/webhooks/inpost`~~ | `apps/web/src/app/api/webhooks/inpost/route.ts` | DONE (earlier proof-of-pattern) |
| ~~`/webhooks/:provider`~~ | `apps/web/src/app/api/webhooks/[provider]/route.ts` | DONE (2026-05-22) — registered AFTER explicit static routes |
| ~~`/webhooks/_process`~~ | `apps/web/src/app/api/webhooks/_process/route.ts` | DONE (2026-05-22) — QStash `Receiver` (framework-agnostic) replaces Next-only `verifySignatureAppRouter` |
| ~~`webhooks/slack-webhook-context`~~ | helper | DONE — `apps/api/src/lib/webhooks/slack-webhook-context.ts` |
| ~~`/ksef/_sync`~~ | `apps/web/src/app/api/ksef/_sync/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/ksef.ts`; smoke test pending |
| ~~`/peppol/inbound`~~ | `apps/web/src/app/api/peppol/inbound/route.ts` | DONE (2026-05-22) — appended to `apps/api/src/routes/peppol.ts`; smoke test pending |
| ~~`/peppol/outbound`~~ | `apps/web/src/app/api/peppol/outbound/route.ts` | DONE (2026-05-22) — backpressure + classification preserved; smoke test pending |
| ~~`/peppol/poll`~~ | `apps/web/src/app/api/peppol/poll/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/peppol.ts`; smoke test pending |
| ~~`/zatca/_submit`~~ | `apps/web/src/app/api/zatca/_submit/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/zatca.ts`; smoke test pending |
| ~~`/teams/messages`~~ | `apps/web/src/app/api/teams/messages/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/teams.ts`; CloudAdapter singleton + shim req/res preserved |

### Workflow / queue drains (≈ 7 files)

| Route | Legacy path | Notes |
|---|---|---|
| ~~`/ocr/_process`~~ | `apps/web/src/app/api/ocr/_process/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/ocr.ts`; backpressure + classification preserved; smoke test pending |
| ~~`/exports/_process`~~ | `apps/web/src/app/api/exports/_process/route.ts` | DONE (2026-05-22) — appended to `apps/api/src/routes/exports.ts`; smoke test pending |
| ~~`/exports/[exportId]/download`~~ | `apps/web/src/app/api/exports/[exportId]/download/route.ts` | DONE (earlier proof-of-pattern) — `apps/api/src/routes/exports.ts` |
| ~~`/outbox/_drain`~~ | `apps/web/src/app/api/outbox/_drain/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/outbox.ts`; smoke test pending |
| ~~`/google-workspace/_sync`~~ | `apps/web/src/app/api/google-workspace/_sync/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/google-workspace.ts`; smoke test pending |
| ~~`/late-interest/_render-claim-pdf`~~ | `apps/web/src/app/api/late-interest/_render-claim-pdf/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/late-interest.ts`; smoke test pending |
| ~~`/revalidate-legal`~~ | `apps/web/src/app/api/revalidate-legal/route.ts` | DONE (earlier) — `apps/api/src/routes/revalidate-legal.ts` |

### OAuth (2 files)

| Route | Legacy path | Notes |
|---|---|---|
| ~~`/oauth/:provider/start`~~ | `apps/web/src/app/api/oauth/[provider]/start/route.ts` | DONE (2026-05-22) — `apps/api/src/routes/oauth.ts`; `__Host-oauth_state` cookie + challenge mint preserved |
| ~~`/oauth/:provider/callback`~~ | `apps/web/src/app/api/oauth/[provider]/callback/route.ts` | DONE (2026-05-22) — atomic challenge consume + Jira on-connect sync preserved |

### Portal session cookie helpers (2 files)

| Route | Legacy path | Notes |
|---|---|---|
| ~~`/portal/set-session`~~ | `apps/web/src/app/api/portal/set-session/route.ts` | DONE (earlier) — `apps/api/src/routes/portal-session.ts` |
| ~~`/portal/clear-session`~~ | `apps/web/src/app/api/portal/clear-session/route.ts` | DONE (earlier) — `apps/api/src/routes/portal-session.ts` |

### Cron HTTP routes (moved to `apps/cron-worker`, not Fastify)

The legacy `apps/web/src/app/api/cron/<job>/route.ts` files do NOT get
ported to apps/api — `apps/cron-worker` calls the handler functions
directly. Each placeholder in `apps/cron-worker/src/jobs/registry.ts`
is replaced by:

```ts
{ meta: { name: 'token-refresh', schedule: env.CRON_TOKEN_REFRESH_SCHEDULE },
  handler: tokenRefreshHandler }
```

where `tokenRefreshHandler` is lifted (not exported through HTTP) from
the corresponding legacy `apps/web/src/app/api/cron/token-refresh/route.ts`
body. 12 handlers total:

- token-refresh, data-purge, exchange-rates, boe-rate-poll,
  classification-reassessment-triggers, classification-economic-dependency,
  org-definition-sync, inpost-status-poll, trial-notifications, reminders
  (+ drv-clearance-expiries sub-job), job-health, late-interest-pdf-reaper.

### Health probes (one file)

`apps/api/src/routes/health.ts` currently returns a placeholder for
`/ready`. Port the full probe set from
`apps/web/src/app/api/health/route.ts`:

- Postgres `SELECT 1` via `@contractor-ops/db`
- Upstash Redis PING via `@upstash/redis`
- Upstash QStash health HEAD
- Cloudflare R2 canary HEAD
- QStash backpressure (depth < 1.5× maxConcurrent per route)

Each probe carries a 1.5 s soft timeout; overall handler caps at
`env.HEALTH_TIMEOUT_MS` (defaulted to 5000).

## Step 10 — port 65 pages across 10 batches

Foundation in place:
- `apps/web-vite/src/router.tsx` — locale-validated parent route with
  `applyLocale()` loader.
- `apps/web-vite/src/i18n/useTranslations.ts` — drop-in for the legacy
  `next-intl` hook (same call signature).
- `apps/web-vite/src/providers/{auth,trpc}-provider.tsx` — Better Auth
  client + typed staff/portal tRPC proxies.
- `apps/web-vite/src/lib/require-auth.ts` — React Router loader that
  redirects to `/<locale>/login` when no session.

### Per-batch template

Each batch is one PR. For batch N:

1. Add the batch's routes to `apps/web-vite/src/router.tsx`'s
   `:locale` children array.
2. For every page in the batch:
   - Create `apps/web-vite/src/pages/<group>/<route>/index.tsx`.
   - Lift the legacy page's body (`apps/web/src/app/[locale]/<route>/page.tsx`).
   - Swap imports per the codemod table in Step 11 below.
   - Async server-component bodies → client components consuming
     `useTRPC().<...>.queryOptions(...)` via `useQuery`.
   - `next/dynamic { ssr: false }` → `React.lazy(() => import(...))` +
     `Suspense` fallback.
3. Add `loader: ({ params }) => requireAuth(params.locale)` to every
   dashboard/admin/portal route (NOT to `(legal)` or `(auth)`).
4. Port the legacy `__tests__/page.test.tsx` into
   `apps/web-vite/src/pages/<route>/__tests__/index.test.tsx`.
5. Add a Playwright spec under `apps/web-vite/e2e/functional/<batch>.spec.ts`
   covering the golden path.
6. Verify: `pnpm --filter @contractor-ops/web-vite typecheck`,
   `pnpm --filter @contractor-ops/web-vite test`,
   `pnpm --filter @contractor-ops/web-vite preview` + manual smoke in
   each of `en` / `pl` / `ar` / `de`.

### Batch list

1. **(auth)** — login, register, verify-email, invite/[token]. 4 pages.
2. **(dashboard) shell + index** — sidebar, topbar, theme switcher,
   locale switcher, KPI dashboard. ≈ 6 files.
3. **contractors/** — list, detail, engagements, classification subtree.
   9 pages.
4. **invoices/** — list, detail, intake, intake/[id]. 4 pages.
5. **payments / approvals / contracts / equipment** — 6 pages.
6. **workflows / time / organization** — workflows[/[id]],
   workflows/templates[/new|/[id]], time[/[contractorId]], organization/
   cost-centers + projects + teams. 9 pages.
7. **classification** — root + expert-help. 2 pages.
8. **settings/** — calendar, e-invoicing[/log], integrations/zatca,
   members, payments, tax, workflow-roles + unauthorized. 9 pages.
9. **(portal)/portal/** — invoices, contracts, time, payments,
   documents, equipment, settings, login + login/verify, submit +
   submit/success. 13 pages.
10. **admin/** — boe-rate + any other admin tools. ≈ 3 pages.

(Legal pages `(legal)/legal/{privacy,privacy/[jurisdiction],terms,sub-processors,breach-notification}`
are added with the legal-content lift — they pre-date `(auth)` in the
batch list because they have no auth dependency.)

## Step 11 — codemod the next-intl import path

Compat hook signature kept identical to the legacy one, so the swap is
a one-line import change per file. **CLAUDE.md forbids `sed` / script
bulk replace** — every file gets an individual `Edit`.

Per-file edit:

```diff
- import { useTranslations } from 'next-intl';
+ import { useTranslations } from '@/i18n/useTranslations';
```

For the ≈ 28 `next-intl/server` imports in async server-component
bodies, the replacement is a tRPC call wrapped in TanStack Query (each
case is component-shaped — see the per-batch porting template above).

For `next/dynamic { ssr: false }` (2 call-sites) the replacement is
`React.lazy(() => import(...))` + `<Suspense fallback={…}>`.

For `next/image` (13 files) the replacement is `@unpic/react`'s
`<Image>` preserving `src` / `width` / `height` / `alt` / `priority` /
`className`. Add the dep:

```diff
- "next": "^16.2.5",
+ "@unpic/react": "^0.x.x",
```

For `next/link` (7 files) the replacement is `react-router-dom`'s
`<Link>` / `<NavLink>`.

For `next/navigation` (77 files) — `useRouter` → `useNavigate`,
`useSearchParams` → `useSearchParams` (same name, different export),
`usePathname` → `useLocation().pathname`, `redirect()` → `throw redirect(...)`
from react-router.

For `next/headers` (16 files) — server-only. Each case is rewritten as
either a tRPC procedure (cookies / headers come from the createContext
on the API side) or a client component reading
`document.cookie` / `useSession()`.

After every codemod run:

```sh
pnpm typecheck --filter=@contractor-ops/web-vite
pnpm test --filter=@contractor-ops/web-vite
# CI grep gate — fails the build if any next-intl / next/* import remains.
! rg "from ['\"]next" apps/web-vite/src
```

## Step 13 — Playwright spec ports

Configs already in place: functional, integration, perf, rtl. Each
batch in Step 10 ports its spec from `apps/web/e2e/<suite>/<batch>/*`
to `apps/web-vite/e2e/<suite>/<batch>/*` adapting selectors that
referenced Next-specific data attributes (`data-rsc-link`, etc.).

`baseURL` is already wired to the vite preview + apps/api on the local
ports, so the test commands are just:

```sh
pnpm --filter @contractor-ops/web-vite exec playwright test -c playwright.functional.config.ts
pnpm --filter @contractor-ops/web-vite exec playwright test -c playwright.integration.config.ts
pnpm --filter @contractor-ops/web-vite exec playwright test -c playwright.perf.config.ts
pnpm --filter @contractor-ops/web-vite exec playwright test -c playwright.rtl.config.ts
```

## Step 16 — cutover (user-driven)

Sequence to execute against Render dashboard after UAT passes (uat.md
checklist fully ticked):

1. Provision custom domains:
   - `app.contractor-ops.com` → `web-vite` static site.
   - `api.contractor-ops.com` → `api-server` web service.
2. Set `AUTH_COOKIE_DOMAIN=.contractor-ops.com` +
   `AUTH_COOKIE_SAME_SITE=none` on `api-server`. Set `APP_URL` /
   `API_URL` to the final hostnames.
3. Set `VITE_API_URL=https://api.contractor-ops.com` +
   `VITE_APP_URL=https://app.contractor-ops.com` on `web-vite` and
   trigger a rebuild (VITE_* envs are baked at build time).
4. Update every external webhook URL to the new host:
   - Stripe (`https://api.contractor-ops.com/webhooks/stripe`)
   - Storecove, KSeF, Peppol AS4, ZATCA, MS Teams, Google Workspace,
     OAuth callback URLs in each provider's dashboard.
5. Delete the legacy Render HTTP cron services (`cron-token-refresh`,
   `cron-data-purge`, `cron-exchange-rates`, `cron-org-definition-sync`)
   once `apps/cron-worker` has had at least one tick per job.
6. Run the synthetic-transaction script (see uat.md "Build under test"
   section) against the new domains; record results.
7. Drop the brace-expansion override from root `package.json` (no
   longer needed by the new stack) and re-enable `@sentry/vite-plugin`
   in `apps/web-vite/vite.config.mjs` (commented out in this branch).

## Step 17 — 14-day production grace period

Keep `apps/web` Render service deployed but de-prioritised; no traffic
routed there. Monitor every day:

- Sentry error rate vs pre-cutover baseline (must stay within ±5 %).
- PostHog active-user count (must stay within ±5 %).
- Web Vitals p75 (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1).
- Audit log volume per domain.

Append daily health digest entries to
`goals/migrate-web-off-next-to-vite-react/grace-period.md`.

Rollback playbook: if any P0/P1 surfaces, repoint DNS back to legacy
`web` (TTL is short so propagation < 5 min) and re-enable the legacy
HTTP cron services. Document the regression in a fix-forward task.

## Step 18 — retire legacy

Execute only after Step 17 closes cleanly:

1. `git rm -r apps/web/`.
2. Remove the `web` + the four HTTP cron services from `render.yaml`.
3. Strip `next`, `@sentry/nextjs`, `@next/bundle-analyzer`, `next-intl`,
   `next-themes` from every workspace `package.json` that referenced
   them (apps/web is gone; apps/landing + apps/cms keep their own copies).
4. `git mv apps/web-vite apps/web`.
5. Update every workspace reference: `pnpm-workspace.yaml` glob already
   covers it; `package.json` `"name": "@contractor-ops/web-vite"` →
   `"@contractor-ops/web"`; `render.yaml` service name `web-vite` →
   `web`; turbo.json + vitest.monorepo.ts entries.
6. Verify `pnpm install`, `pnpm typecheck`, `pnpm test`, and every
   Playwright suite pass against the renamed workspace.
7. CI lint gate: `pnpm lint:no-next` (rg ban) fails on any `from 'next'`
   import remaining anywhere outside apps/landing + apps/cms.
