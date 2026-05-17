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
  public-api/    — Enterprise REST API (Hono + tRPC caller, port 3000)
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
- Docker (for `clamav` + `mailpit` + `minio` dev profiles, optional)
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

# 2. Copy env
cp .env.example .env
# Edit .env — fill in: DATABASE_URL, BETTER_AUTH_SECRET, R2_*, UPSTASH_*,
# QSTASH_*, RESEND_API_KEY, CMS_DATABASE_URL, PAYLOAD_SECRET, CMS_ADMIN_*,
# CMS_WEBHOOK_SECRET, BANK_ACCOUNT_ENCRYPTION_KEY, SLACK_TOKEN_ENCRYPTION_KEY.

# 3. Prisma client
pnpm db:generate

# 4. Apply main app schema to Neon
pnpm db:migrate:dev

# 5. (optional) seed dev data
pnpm db:seed:dev

# 6. ClamAV / mailpit / MinIO via docker (optional)
docker compose --profile dev-tooling up -d
```

See **`docs/LOCAL-TESTING-GUIDE.md`** for an exhaustive env-var audit
checklist (placeholder values, drift between `.env` and `.env.example`,
optional surfaces).

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
pnpm --filter @contractor-ops/public-api dev   # http://localhost:3000
```

API-key auth. OpenAPI at `/api/v1/docs`. Same `DATABASE_URL` + `app-shared`
env group as `apps/web`.

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
pnpm --filter @contractor-ops/cms migrate:create initial
pnpm --filter @contractor-ops/cms migrate
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
pnpm dev                           # turbo dev across all apps
pnpm build                         # turbo build
pnpm typecheck                     # turbo typecheck
pnpm lint                          # turbo lint (biome)
pnpm test                          # turbo test (vitest projects)
pnpm format                        # biome format --write

pnpm db:migrate:dev                # apply Prisma migrations to local DB
pnpm i18n:parity                   # detect missing translation keys
pnpm load:smoke                    # k6 smoke test against running web

pnpm --filter @contractor-ops/<pkg> <script>
```

## Architecture cheat-sheet

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
- `docs/DEPLOYMENT-RENDER.md` — Render Blueprint runbook
- `docs/ACCESSIBILITY.md`, `docs/PERF-BUDGETS.md`, `docs/CACHE-CONTROL.md`,
  `docs/TECH-DEBT.md`, `docs/N+1-AUDIT.md`
- `CLAUDE.md` — engineering & product guidelines for AI-assisted contributions
- `goals/<slug>/{goal,facts,plan}.md` — per-feature artefacts
- `apps/cms/README.md` — CMS-specific quickstart, env reference, webhook contract
- `packages/<name>/README.md` — package-specific docs where they exist
