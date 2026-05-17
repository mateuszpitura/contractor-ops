# contractor-ops

Cross-border independent-contractor operations platform: invoicing, contracts,
tax artefacts, e-signing, integrations — plus a headless CMS for the public
blog and legal documents.

- **Stack:** pnpm + Turborepo monorepo · Next.js 16 · React 19 · tRPC v11 ·
  Prisma 7 + Neon Postgres (multi-region) · Better Auth · Payload v3 CMS ·
  Render (Docker) · Cloudflare R2 · Upstash Redis + QStash · Resend · Stripe.
- **Status:** active development. The CMS / blog (apps/cms) ships in this
  commit; the platform itself (apps/web, apps/public-api) is in production.

> Looking for the goal-and-plan workflow used during planning? See
> `.planning/` and individual entries under `goals/`.

## Layout

```
apps/
  web/           — main product (Next.js 16, port 3000, Render web service)
  public-api/    — Enterprise REST API (Hono + tRPC caller, default port 4100)
  landing/       — marketing site (Next.js static export, port 3001)
  cms/           — headless CMS + public blog (Next.js 16 + Payload v3, port 3002)
packages/
  api/           — 55 tRPC routers split across 7 domain folders
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
| Neon Postgres    | `apps/web`, `apps/cms` (separate DBs)  | yes      |
| Cloudflare R2    | `apps/web` documents, `apps/cms` media | optional in dev (local FS fallback) |
| Upstash Redis    | rate limiting + cache                  | yes      |
| Upstash QStash   | webhook queue (cron + integrations)    | yes      |
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

# 8. Extra dev tooling: Mailpit, MinIO, CloudBeaver, Redis Insight (optional)
docker compose --profile dev-tooling up -d

# 9. Local Unleash (optional — omit to use code defaults for flags)
docker compose --profile unleash up -d
# Optional: bootstrap Unleash flags + print env hints — `pnpm setup:dev-services`
```

See **`docs/LOCAL-TESTING-GUIDE.md`** for an exhaustive env-var audit
checklist (placeholder values, drift between `.env` and `.env.example`,
optional surfaces).

## Running the full stack locally

```bash
pnpm dev
```

Turborepo starts every app that defines `dev`:

| App        | URL                      | Notes |
| ---------- | ------------------------ | ----- |
| `apps/web` | http://localhost:3000    | Main product |
| `apps/landing` | http://localhost:3001 | Marketing |
| `apps/cms` | http://localhost:3002    | Payload admin + blog (needs CMS DB + migration — see below) |
| `apps/public-api` | http://localhost:4100 (`PUBLIC_API_PORT`) | Requires `API_KEY_HMAC_SECRET` or the process exits during env validation |

- **CMS:** if you skipped Payload setup, `apps/cms` may fail — complete the
  **`apps/cms`** section below first, or run a subset, e.g.
  `pnpm --filter @contractor-ops/web dev`.
- **Background work:** Render runs `apps/web/worker-cron.mjs` as a separate
  worker. `pnpm dev` does **not** start that process — local cron/QStash
  behaviour differs from production (see **`docs/DEPLOYMENT-RENDER.md`** /
  **`docs/LOCAL-TESTING-GUIDE.md`**).

## Per-app setup

### apps/web (main product)

```bash
pnpm --filter @contractor-ops/web dev          # http://localhost:3000
```

Login flow: signup → org create → invite teammates. Better Auth handles
sessions; OAuth providers (Google, Microsoft) are wired but optional.

### apps/landing (marketing static export)

```bash
pnpm --filter @contractor-ops/landing dev      # http://localhost:3001
```

Pure static export — no env required to run.

### apps/public-api (Enterprise REST)

```bash
pnpm --filter @contractor-ops/public-api dev   # default http://localhost:4100
```

API-key auth. OpenAPI at `/api/v1/docs`. Set **`API_KEY_HMAC_SECRET`** in `.env`.
Override port with **`PUBLIC_API_PORT`**. Same `DATABASE_URL` + shared app env
surface as `apps/web` wherever the validators require it.

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

Automated suites use **Vitest** (packages + `apps/web` / `apps/public-api`), **Playwright**
(E2E in `apps/web`), and **k6** (API load scripts). Behaviour and env expectations for
hands-on QA live in **`docs/LOCAL-TESTING-GUIDE.md`**.

### Unit & integration tests (Vitest)

```bash
# Whole monorepo (same surface CI runs via Turborepo)
pnpm test

# Focus one workspace (repeatable locally)
pnpm --filter @contractor-ops/<pkg> test
pnpm --filter @contractor-ops/web run test:watch    # watch mode while editing web code
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

### Browser E2E & accessibility (Playwright — `apps/web`)

Install browser binaries once per machine (examples below use Chromium; configs may differ):

```bash
pnpm --filter @contractor-ops/web run e2e:functional:install
pnpm --filter @contractor-ops/web run e2e:integration:install   # …etc.
```

Run suites (typically against a **built** app — CI uses `pnpm build` + `pnpm start`; match
that or set **`PLAYWRIGHT_BASE_URL`** to your dev server):

```bash
pnpm --filter @contractor-ops/web run e2e:functional
pnpm --filter @contractor-ops/web run e2e:integration
pnpm --filter @contractor-ops/web run e2e:rtl
pnpm --filter @contractor-ops/web run e2e:perf
pnpm --filter @contractor-ops/web run test:a11y         # axe-core gate (subset / project=a11y)
```

Many flows expect **`E2E_EMAIL`** / **`E2E_PASSWORD`** where global setup uses real auth; without
them some specs skip (same contract as CI on forks). See **`docs/ACCESSIBILITY.md`** for the
a11y bar and **`docs/PERF-BUDGETS.md`** for perf/bundle budgeting that complements `e2e:perf`.

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
4. **E2E / a11y** — reproduce the **`e2e-a11y`** job: build → start production server →
   `pnpm --filter @contractor-ops/web run test:a11y` with `PLAYWRIGHT_BASE_URL` set (see `.github/workflows/ci.yml`).
5. **Manual regressions** — follow **`docs/LOCAL-TESTING-GUIDE.md`** for full product flows env-by-env.

## CI (GitHub Actions)

Workflows live in **`.github/workflows/`**. Highlights:

| Workflow | When it runs | What it does |
| -------- | ------------- | ------------- |
| **`ci.yml`** | Push to **`main`** + **all PRs** | Lint gate (`lint:ci`), format check, custom repo linters (`check:no-process-env`, `lint:schema`, `lint:logs`), **i18n parity + i18n code coverage** (mandatory), i18n quality audit (advisory), **`pnpm build`**, **`pnpm test`**, Prisma **`db:check-drift`**, informational `pnpm audit`. Uses **`SKIP_ENV_VALIDATION=true`** — app env is not exercised the same way as local dev.
| **`ci.yml` → `e2e-a11y`** | After the main **`ci`** job succeeds | Builds `apps/web`, starts **`next start`**, runs **`pnpm --filter @contractor-ops/web run test:a11y`** (Playwright + axe-core). Repo secrets **`E2E_EMAIL`** / **`E2E_PASSWORD`** enable deeper coverage when configured.
| **`ci.yml` → `bundle-size`** | After **`ci`** | **`size-limit`** on the web bundle; budgets in **`apps/web/.size-limit.json`** (process in **`docs/PERF-BUDGETS.md`**).
| **`ci.yml` → `secrets-scan`** | Every PR/push covered by **`ci.yml`** | **Gitleaks** with **`.gitleaks.toml`**.
| **`ci.yml` → `legal-gate-production`** | Push to **`main`** only | Blocks production if legal disclaimer sign-offs are **`PENDING`** — see **`packages/validators`** signoff registry.
| **`verapdf.yml`** | PR/push when **`packages/einvoice/**`** changes | Generates ZUGFeRD fixture PDFs and checks **PDF/A-3 B** via **veraPDF** Docker image.
| **`security-scan.yml`** | **Manual** (`workflow_dispatch`) | Gitleaks + **`pnpm audit`** — local parity: **`pnpm security:scan`** (= **`scripts/security-scan.sh`**). |

**Concurrency:** the main CI workflow cancels in-progress runs for the same PR ref.
**Dependabot:** **`.github/dependabot.yml`** proposes dependency updates separately from CI.

## Architecture cheat-sheet

- **Background worker.** The Render **`worker`** service runs `apps/web/worker-cron.mjs`
  (`dockerCommand` in `render.yaml`). It is **not** started by `pnpm dev`; scheduled
  and queue-driven work behaves differently locally unless you run that script on purpose.
- **Multi-region data residency.** EU and ME tenants live on separate Neon
  projects (`DATABASE_URL_EU`, `DATABASE_URL_ME`); `packages/db` routes
  reads/writes by `org.countryCode`. R2 buckets and Unleash flag servers
  also split per region.
- **Auth.** Better Auth (sessions + OAuth) in `apps/web` and `apps/public-api`.
  Payload CMS uses its own native auth (no SSO bridge).
- **Observability.** `@contractor-ops/logger` ships a Pino root with PII
  redaction + Axiom multistream + AsyncLocalStorage request-id mixin.
  `console.*` is forbidden — use `createLogger({ service })` instead.
- **tRPC.** Two endpoints: main `/api/trpc` and portal `/api/trpc/portal`.
  55 internal routers under `packages/api/src/routers/` (7 domain folders).
- **Feature flags.** Self-hosted Unleash OSS, one deployment per region
  on Render. Tiny typed registry wraps the SDK with jurisdiction
  short-circuit — see `packages/feature-flags/`.
- **CMS ↔ web webhook.** Editing a `legal-documents` entry in the CMS admin
  triggers a HMAC-signed POST to `apps/web /api/revalidate-legal` which
  flips the `legal:<type>:<jurisdiction>` cache tag. apps/web's legal
  pages fetch from CMS with `next: { tags, revalidate: 60 }`.

## Deploy

Render Blueprint (`render.yaml`) provisions:
`web`, `public-api`, `landing`, `cms`, `worker`, `clamav`, `unleash-eu`,
`unleash-me`, `cloudflared`, 3 cron jobs. Custom domains (app, blog,
api, marketing) are bound manually in the Render dashboard.

Runbook: **`docs/DEPLOYMENT-RENDER.md`**. Pre-deploy gates:
**`docs/PRODUCTION-CHECKLIST.md`**.

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
