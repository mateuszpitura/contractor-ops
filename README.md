# contractor-ops

Cross-border independent-contractor operations platform: invoicing, contracts,
tax artefacts, e-signing, integrations — plus a headless CMS for the public
blog and legal documents.

- **Stack:** pnpm + Turborepo monorepo · React 19 + Vite SPA · Fastify (API
  server, cron worker) · Hono (public REST) · Next.js 16 (landing, CMS) ·
  tRPC v11 · Prisma 7 + Neon Postgres (multi-region) · Better Auth ·
  Payload v3 CMS · Render (Docker) · Cloudflare R2 · Upstash Redis + QStash ·
  Resend · Stripe.
- **Status:** launch-ready, pre-deploy. Production hardening is complete
  (deploy blockers cleared, multi-region migrations wired, observability +
  rate limiting in place) and the platform has **not yet been deployed to
  production**. First deploy is gated on the action items in
  `docs/POST-DEPLOY-MONITORING.md` and `docs/INFRA-RECOMMENDATIONS.md`.

> Looking for the goal-and-plan workflow used during planning? See
> `.planning/` and individual entries under `goals/`.

## Layout

```
apps/
  web-vite/      — main product SPA (React + Vite, static site on Render)
  api/           — Fastify tRPC server hosting `/api/trpc/*` for web-vite + portal
  cron-worker/   — Fastify background worker (cron, QStash callbacks, webhooks)
  public-api/    — Enterprise REST API (Hono + tRPC caller, default port 4100)
  landing/       — marketing site (Next.js 16, port 3001)
  cms/           — headless CMS + public blog (Next.js 16 + Payload v3, port 3002)
packages/
  api/           — 50 tRPC routers (staff appRouter) + 2 portal routers
  auth/          — Better Auth wiring + shared session helpers
  db/            — Prisma 7 schema + generated client + replica helpers
  einvoice/      — ZUGFeRD/Peppol/KSeF document generators
  feature-flags/ — typed Unleash wrapper with jurisdiction short-circuit
  gov-api/       — HMRC, VIES, ECB integrations
  integrations/  — Slack, Jira, Linear, Notion, DocuSign, Calendar adapters
  logger/        — Pino root logger + Axiom multistream + PII redaction
  ui/            — shared component primitives
  validators/    — zod schemas (env, jurisdiction, currency, tax IDs)
  + shared, secrets, test-utils, classification, gov-api, offboarding-templates
infra/
  aws-me/        — Middle-East data-residency Terraform
scripts/
  ...            — repo-wide tooling (env ratchet, i18n parity, log linting)
docs/
  DEPLOYMENT-RENDER.md      — Render Blueprint runbook
  LOCAL-TESTING-GUIDE.md    — end-to-end manual QA checklist
  PRODUCTION-CHECKLIST.md   — pre-deploy gate
  ACCESSIBILITY.md, PERF-BUDGETS.md, CACHE-CONTROL.md, ...
goals/
  <slug>/        — per-feature goal + facts + execution plan (Plannotator)
```

## Prerequisites

- Node `^24`
- pnpm `10.33.x` (corepack: `corepack prepare pnpm@10.33.2 --activate`)
- Docker (**ClamAV** — practically required if you exercise file uploads; optional
  **Mailpit / MinIO** and other tooling via compose profiles below)
- A `.env` at repo root copied from `.env.example` with the values listed below

External services to provision (free tiers are fine for local dev):

| Service          | Used by                                | Required |
| ---------------- | -------------------------------------- | -------- |
| Neon Postgres    | `apps/api`, `apps/cms` (separate DBs)  | yes      |
| Cloudflare R2    | `apps/api` documents, `apps/cms` media | optional in dev (local FS fallback) |
| Upstash Redis    | rate limiting + cache                  | yes (local substitute via SRH — see below) |
| Upstash QStash   | webhook queue (cron + integrations)    | yes (local substitute via QStash dev server — see below) |
| Resend           | transactional email                    | optional (Mailpit fallback) |
| Anthropic API    | OCR invoice intake (Claude Vision)     | optional |
| Stripe (test)    | subscription billing                   | optional |

## First-time setup

```bash
# 1. Clone + install
git clone <repo>
cd contractor-ops
corepack enable && corepack prepare pnpm@10.33.2 --activate
pnpm install

# 2. Sanity-check toolchain + highlight missing vars (optional but recommended)
node scripts/setup.mjs

# 3. Copy env
cp .env.example .env
# Edit .env — fill in at minimum: DATABASE_URL, BETTER_AUTH_SECRET, R2_*,
# UPSTASH_*, QSTASH_*, BANK_ACCOUNT_ENCRYPTION_KEY, SLACK_TOKEN_ENCRYPTION_KEY,
# CMS_DATABASE_URL, PAYLOAD_SECRET, CMS_ADMIN_*, CMS_WEBHOOK_SECRET.
# Enterprise REST locally: API_KEY_HMAC_SECRET (openssl rand -hex 32).
# Optional: RESEND_API_KEY (or Mailpit via DEV_SMTP_* — see LOCAL-TESTING-GUIDE).

# 4. Prisma client
pnpm db:generate

# 5. Apply main app schema to Neon
pnpm db:migrate:dev

# 6. (optional) seed dev data — see full flags:
pnpm db:seed:dev -- --help
# Defaults unless overridden: --profile=small --regions=EU --seed=42 --progress
# You must pass --confirm (wipes tenant tables first) or --append (add orgs on top).
# Typical full reset:
pnpm db:seed:dev -- --confirm

# 7. ClamAV (recommended — file upload / virus scan flows expect a healthy daemon)
docker compose up -d clamav

# 8. Extra dev tooling: Mailpit, MinIO, DBGate (Postgres + Redis GUI),
#    Redis Insight, plus local Upstash substitutes
#    (app-redis + SRH + QStash dev server).
docker compose --profile dev-tooling up -d
# Open http://localhost:8888 (dev-portal) for the full link directory.

# 9. Local Unleash (optional — omit to use code defaults for flags)
docker compose --profile unleash up -d
# Optional: bootstrap Unleash flags + print env hints — `pnpm setup:dev-services`
```

### Local Upstash substitutes (no cloud account needed)

`docker compose --profile dev-tooling up -d` brings up three extra containers
that stand in for Upstash cloud services during local development:

| Container     | Host port | Purpose                                                                    |
| ------------- | --------- | -------------------------------------------------------------------------- |
| `app-db`      | `5433`    | Plain Postgres 17 — Neon substitute. Hosts THREE databases in one instance: `contractor_ops_eu`, `contractor_ops_me` (multi-region split) and `contractor_ops_cms` (Payload). Persistent volume `app_db_data`. Uses `@prisma/adapter-pg` so no Neon emulator needed. |
| `app-redis`   | `6380`    | Plain Redis 8.6 — Upstash Redis substitute. Persistent volume `app_redis_data`. |
| `srh`         | `8079`    | Serverless Redis HTTP proxy — Upstash-Redis-REST compatible front for `app-redis`. |
| `qstash-dev`  | `8089`    | Upstash QStash mock server (`qstash dev`). Stable token + signing keys printed on startup. |

**Fill `.env` for local dev:**

```bash
# Postgres — point Prisma at app-db (skip Neon for fast iteration; keep
# Neon for pre-prod/staging to validate latency + driver behaviour).
# After `pnpm db:migrate:dev` runs against the EU db, run `pnpm db:migrate:all`
# to propagate the schema to ME too.
DATABASE_URL=postgresql://app:app@localhost:5433/contractor_ops_eu
DATABASE_URL_EU=postgresql://app:app@localhost:5433/contractor_ops_eu
DATABASE_URL_ME=postgresql://app:app@localhost:5433/contractor_ops_me
CMS_DATABASE_URL=postgresql://app:app@localhost:5433/contractor_ops_cms

# Redis — point @upstash/redis at SRH
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=example_token

# QStash — point SDK at the dev server
QSTASH_URL=http://localhost:8089

# Then read these from `docker compose logs qstash-dev` and copy into .env:
QSTASH_TOKEN=<printed-on-startup>
QSTASH_CURRENT_SIGNING_KEY=<printed-on-startup>
QSTASH_NEXT_SIGNING_KEY=<printed-on-startup>

# Required for QStash webhook callbacks — dev server (in container) reaches
# the Fastify API (on host) via host.docker.internal:
API_URL=http://host.docker.internal:4000
```

**RedisInsight** (already at `http://localhost:5540`) → Add Database →
host `app-redis`, port `6379` to inspect cache/rate-limit/idempotency keys.
Infisical's own Redis remains reachable at `redis://infisical-redis:6379`.

**Skip the substitutes**: leave `QSTASH_URL=` empty and fill `UPSTASH_*` /
`QSTASH_*` with real Upstash console values — code falls back to the cloud
endpoints (`https://qstash.upstash.io` and the configured Redis URL).

### Local Sentry substitute — GlitchTip (optional)

```bash
docker compose --profile glitchtip up -d
# The glitchtip-seed sidecar runs once and bootstraps:
#   user:     admin@glitchtip.local / Test1234!
#   org:      contractor-ops
#   project:  contractor-ops (platform: javascript-nextjs)
# Grab the auto-generated DSN:
docker compose logs glitchtip-seed | grep SENTRY_DSN
# Paste the printed line into .env, then open http://localhost:8000 to log in.
```

Override credentials/org/project names via env on the seed container —
`GLITCHTIP_ADMIN_EMAIL`, `GLITCHTIP_ADMIN_PASSWORD`, `GLITCHTIP_ORG_NAME`,
`GLITCHTIP_PROJECT_NAME`.

GlitchTip implements the Sentry event-ingestion protocol, so `@sentry/nextjs`
ships events to it without any code change. Useful for verifying that Sentry
instrumentation works end-to-end before pointing at the real Sentry org.

Reuses Mailpit (`docker compose --profile dev-tooling up -d mailpit`) for
account-verification email.

See **`docs/LOCAL-TESTING-GUIDE.md`** for an exhaustive env-var audit
checklist (placeholder values, drift between `.env` and `.env.example`,
optional surfaces).

## Running the full stack locally

```bash
pnpm dev
```

Turborepo starts every app that defines `dev`:

| App                  | URL                      | Notes |
| -------------------- | ------------------------ | ----- |
| `apps/web-vite`      | http://localhost:3000    | Main product SPA |
| `apps/api`           | http://localhost:4000 (`PORT`) | Fastify tRPC server consumed by web-vite |
| `apps/cron-worker`   | http://localhost:4101 (`CRON_HEALTH_PORT`) | Background jobs + cron health endpoint |
| `apps/landing`       | http://localhost:3001    | Marketing |
| `apps/cms`           | http://localhost:3002    | Payload admin + blog (needs CMS DB + migration — see below) |
| `apps/public-api`    | http://localhost:4100 (`PUBLIC_API_PORT`) | Requires `API_KEY_HMAC_SECRET` or the process exits during env validation |

- **CMS:** if you skipped Payload setup, `apps/cms` may fail — complete the
  **`apps/cms`** section below first, or run a subset, e.g.
  `pnpm --filter @contractor-ops/web-vite dev`.
- **Background work:** Render runs `apps/cron-worker` as a separate service.
  `pnpm dev` does start it locally; scheduled and queue-driven work behaves
  similarly to production (see **`docs/DEPLOYMENT-RENDER.md`** /
  **`docs/LOCAL-TESTING-GUIDE.md`**).

## Per-app setup

### apps/web-vite (main product SPA)

```bash
pnpm --filter @contractor-ops/web-vite dev     # http://localhost:3000
```

Login flow: signup → org create → invite teammates. Better Auth handles
sessions; OAuth providers (Google, Microsoft) are wired but optional. The
SPA talks to `apps/api` (`/api/trpc/*`) — start both for full functionality.

### apps/api (Fastify tRPC server)

```bash
pnpm --filter @contractor-ops/api dev          # http://localhost:4000
```

Hosts the staff + portal tRPC routers (`packages/api`) plus Better Auth
mounts, OAuth callbacks, CSP / rate-limit plugins, and Sentry/OpenTelemetry
instrumentation.

### apps/cron-worker (background jobs)

```bash
pnpm --filter @contractor-ops/cron-worker dev  # health on http://localhost:4101
```

Runs scheduled jobs (`apps/cron-worker/src/jobs/handlers/*`) and consumes
QStash callbacks/webhooks. Exposes a lightweight `/health` endpoint for
Cronitor.

### apps/landing (marketing site)

```bash
pnpm --filter @contractor-ops/landing dev      # http://localhost:3001
```

Next.js 16 marketing site — minimal env required to run.

### apps/public-api (Enterprise REST)

```bash
pnpm --filter @contractor-ops/public-api dev   # default http://localhost:4100
```

API-key auth. OpenAPI at `/api/v1/docs`. Set **`API_KEY_HMAC_SECRET`** in `.env`.
Override port with **`PUBLIC_API_PORT`**. Same `DATABASE_URL` + shared app env
surface as `apps/api` wherever the validators require it.

### apps/cms (headless CMS + blog) — NEW

Provision a **dedicated Neon project** for the CMS (must NOT reuse
`DATABASE_URL`), then:

```bash
# Fill in .env:
#   CMS_DATABASE_URL=postgresql://...
#   PAYLOAD_SECRET=$(openssl rand -hex 32)
#   CMS_ADMIN_EMAIL=admin@example.com
#   CMS_ADMIN_PASSWORD=$(openssl rand -hex 16)
#   CMS_WEBHOOK_SECRET=$(openssl rand -hex 32)
#   CMS_PUBLIC_URL=http://localhost:3002
#   WEB_APP_URL=http://localhost:3000

pnpm --filter @contractor-ops/cms generate:types
pnpm --filter @contractor-ops/cms generate:importmap

# Payload migrations — pick ONE path:
#   • This repo clone already ships `apps/cms/migrations/*` → apply only:
pnpm --filter @contractor-ops/cms migrate
#   • Brand-new CMS database with no migrations yet → create then apply:
#     pnpm --filter @contractor-ops/cms migrate:create initial
#     pnpm --filter @contractor-ops/cms migrate
pnpm --filter @contractor-ops/cms seed:admin       # one-shot bootstrap admin
pnpm --filter @contractor-ops/cms migrate:legal    # seed the 6 legal docs
pnpm --filter @contractor-ops/cms dev              # http://localhost:3002
```

- Admin UI: `http://localhost:3002/admin`
- Public blog: `http://localhost:3002/en`
- REST API: `http://localhost:3002/api/legal-documents`

Full docs: **`apps/cms/README.md`**.

## Daily commands

```bash
pnpm dev                           # web :3000, landing :3001, cms :3002, public-api :4100
pnpm build                         # turbo build
pnpm typecheck                     # turbo typecheck
pnpm lint                          # turbo lint (biome)
pnpm test                          # turbo test (vitest projects)
pnpm format                        # biome format --write

pnpm db:migrate:dev                # apply Prisma migrations to local DB
pnpm db:seed:dev -- --help         # dev seed CLI (defaults: profile=small, regions=EU, seed=42)
pnpm i18n:parity                   # detect missing translation keys
pnpm load:smoke                    # k6 smoke test against running web

pnpm --filter @contractor-ops/<pkg> <script>
```

## Testing

Automated suites use **Vitest** (packages + `apps/api` / `apps/cron-worker` /
`apps/public-api` / `apps/web-vite`), **Playwright** (E2E in `apps/web-vite`),
and **k6** (API load scripts). Behaviour and env expectations for hands-on QA
live in **`docs/LOCAL-TESTING-GUIDE.md`**.

### Unit & integration tests (Vitest)

```bash
# Whole monorepo (same surface CI runs via Turborepo)
pnpm test

# Focus one workspace (repeatable locally)
pnpm --filter @contractor-ops/<pkg> test
pnpm --filter @contractor-ops/web-vite run test:watch    # watch mode while editing SPA code
```

The root **`vitest.config.ts`** declares a merged workspace (`vitest.monorepo.ts` lists
named projects for IDE filters). Prefer **`pnpm test`** before opening a PR so all packages
with a `test` script stay green.

### Coverage

```bash
pnpm test:coverage    # merges coverage across the root Vitest workspace; see vitest.config.ts
```

Coverage scope and excluded paths are defined in **`vitest.config.ts`** (generated Prisma
client, harness files, etc. are deliberately out of the denominator). **`pnpm test`**
runs **every** workspace that defines **`test`** via Turborepo — including packages whose
coverage is merged only partially or not through the root config.

### Browser E2E & accessibility (Playwright — `apps/web-vite`)

Install browser binaries once per machine (Chromium):

```bash
pnpm --filter @contractor-ops/web-vite run e2e:functional:install
```

Run the functional suite (typically against a **built** app — CI uses
`pnpm build` + `pnpm preview`; match that or set **`PLAYWRIGHT_BASE_URL`**
to your dev server):

```bash
pnpm --filter @contractor-ops/web-vite run e2e:functional
```

Many flows expect **`E2E_EMAIL`** / **`E2E_PASSWORD`** where global setup uses real auth; without
them some specs skip (same contract as CI on forks). See **`docs/ACCESSIBILITY.md`** for the
a11y bar and **`docs/PERF-BUDGETS.md`** for perf/bundle budgeting.

### Load tests (k6)

Scripts live under **`load-tests/`**. They assume a reachable web/API deployment (URLs and tokens
vary by script):

```bash
pnpm load:smoke
pnpm load:api
pnpm load:writes                  # `-e K6_PROFILE=stress` for stress variants
```

### How to test well (contributors)

1. **Mirror CI locally** when changing shared code — at minimum:
   `pnpm format:check && pnpm lint:ci && pnpm typecheck && pnpm build && pnpm test`
   (`lint:ci` is stricter than plain `pnpm lint`; see **`## CI`**).
2. **Touching i18n?** Run `pnpm i18n:parity` (and heed `pnpm i18n:code-coverage` — both are CI gates).
3. **Touching Prisma schema?** Regenerate client (`pnpm db:generate`) and ensure committed generated
   client matches (**`pnpm --filter @contractor-ops/db run db:check-drift`** is enforced in CI).
4. **E2E / a11y** — reproduce the **`e2e-a11y`** job: build → start production preview →
   `pnpm --filter @contractor-ops/web-vite run e2e:functional` with `PLAYWRIGHT_BASE_URL` set (see `.github/workflows/ci.yml`).
5. **Manual regressions** — follow **`docs/LOCAL-TESTING-GUIDE.md`** for full product flows env-by-env.

## CI (GitHub Actions)

Workflows live in **`.github/workflows/`**. Highlights:

| Workflow | When it runs | What it does |
| -------- | ------------- | ------------- |
| **`ci.yml`** | Push to **`main`** + **all PRs** | Lint gate (`lint:ci`), format check, custom repo linters (`check:no-process-env`, `lint:schema`, `lint:logs`), **i18n parity + i18n code coverage** (mandatory), i18n quality audit (advisory), **`pnpm build`**, **`pnpm test`**, Prisma **`db:check-drift`**, informational `pnpm audit`. Uses **`SKIP_ENV_VALIDATION=true`** — app env is not exercised the same way as local dev.
| **`ci.yml` → `bundle-size`** | After **`ci`** | **`size-limit`** on the SPA bundle — budgets in **`apps/web-vite/.size-limit.json`**; published numbers in **`docs/PERF-BUDGETS.md`**.
| **`ci.yml` → `secrets-scan`** | Every PR/push covered by **`ci.yml`** | **Gitleaks** with **`.gitleaks.toml`**.
| **`ci.yml` → `legal-gate-production`** | Push to **`main`** only | Blocks production if legal disclaimer sign-offs are **`PENDING`** — see **`packages/validators`** signoff registry.
| **`verapdf.yml`** | PR/push when **`packages/einvoice/**`** changes | Generates ZUGFeRD fixture PDFs and checks **PDF/A-3 B** via **veraPDF** Docker image.
| **`security-scan.yml`** | **Manual** (`workflow_dispatch`) | Gitleaks + **`pnpm audit`** — local parity: **`pnpm security:scan`** (= **`scripts/security-scan.sh`**). |

**Concurrency:** the main CI workflow cancels in-progress runs for the same PR ref.
**Dependabot:** **`.github/dependabot.yml`** proposes dependency updates separately from CI.

## Architecture cheat-sheet

- **Background worker.** The Render **`cron-worker`** service runs
  `apps/cron-worker`. `pnpm dev` starts it locally alongside `apps/api`
  and `apps/web-vite`.
- **Multi-region data residency.** EU and ME tenants live on separate Neon
  projects (`DATABASE_URL_EU`, `DATABASE_URL_ME`); `packages/db` routes
  reads/writes by `org.countryCode`. R2 buckets and Unleash flag servers
  also split per region.
- **Auth.** Better Auth (sessions + OAuth) mounted from `apps/api` and
  `apps/public-api`. Payload CMS uses its own native auth (no SSO bridge).
- **Observability.** `@contractor-ops/logger` ships a Pino root with PII
  redaction + Axiom multistream + AsyncLocalStorage request-id mixin.
  `console.*` is forbidden — use `createLogger({ service })` instead.
- **tRPC.** Two endpoints: main `/api/trpc` and portal `/api/trpc/portal`,
  both served by `apps/api`. 50 staff + 2 portal routers under
  `packages/api/src/routers/` (split by domain folder).
- **Feature flags.** Self-hosted Unleash OSS, one deployment per region
  on Render. Tiny typed registry wraps the SDK with jurisdiction
  short-circuit — see `packages/feature-flags/`.
- **CMS ↔ API webhook.** Editing a `legal-documents` entry in the CMS admin
  triggers a HMAC-signed POST to `apps/api`'s `/api/revalidate-legal` which
  flips the `legal:<type>:<jurisdiction>` cache tag consumed by web-vite.

## Deploy

Render Blueprint (`render.yaml`) provisions:
`web-vite` (static site), `api-server`, `public-api`, `landing`, `cms`,
`cron-worker`, `clamav`, `unleash-eu`, `unleash-me`, `cloudflared`. Cron
schedules run in-process inside `cron-worker` (see
`apps/cron-worker/src/jobs/registry.ts`). Custom domains (app, blog, api,
marketing) are bound manually in the Render dashboard.

Runbook: **`docs/DEPLOYMENT-RENDER.md`**. Pre-deploy gates:
**`docs/PRODUCTION-CHECKLIST.md`**.

## Production monitoring dashboards

External services we run against production (bookmark these):

- **UptimeRobot** — synthetic uptime pings against public endpoints
  → https://dashboard.uptimerobot.com/monitors
- **Cronitor** — cron heartbeats + `/api/health` / `/health` liveness
  → https://cronitor.io/app/?env=production&time=7d
- **Axiom** — log stream + saved queries (HTTP, tRPC, auth, web vitals)
  → https://app.axiom.co/contractor-ops-jfw2/stream/contractor-ops?caseSensitive=0

Wiring + alert thresholds: `docs/POST-DEPLOY-MONITORING.md`.

## Further reading

- `PRD.md` — product requirements
- `DB-SCHEMA.md` — entity overview
- `SECURITY-AUDIT.md` — threat model
- `MARKET-EXPANSION-ANALYSIS.md` — geo roadmap
- `contractor-ops-launch-checklist.md` — go-live punch list
- `docs/PRODUCTION-CHECKLIST.md` — pre-deploy gate
- `docs/LOCAL-TESTING-GUIDE.md` — end-to-end manual QA
- `.github/workflows/` — CI (**`ci.yml`**, **`verapdf.yml`**, **`security-scan.yml`**, Dependabot adjacent). Local **`pnpm security:scan`** mirrors the manual security workflow.
- `docs/DEPLOYMENT-RENDER.md` — Render Blueprint runbook
- `docs/ACCESSIBILITY.md`, `docs/PERF-BUDGETS.md`, `docs/CACHE-CONTROL.md`,
  `docs/TECH-DEBT.md`, `docs/N+1-AUDIT.md`
- `CLAUDE.md` — engineering & product guidelines for AI-assisted contributions
- `goals/<slug>/{goal,facts,plan}.md` — per-feature artefacts
- `apps/cms/README.md` — CMS-specific quickstart, env reference, webhook contract
- `packages/<name>/README.md` — package-specific docs where they exist
