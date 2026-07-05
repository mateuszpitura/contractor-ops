# Render Deployment

Production deployment guide for `contractor-ops` on [Render](https://render.com).

## Database migrations (runbook)

App-schema migrations run automatically on every `api-server` deploy via its
`preDeployCommand` hook; the CMS runs its own Payload migrations on the `cms`
deploy. No other service applies migrations. Operators rarely need to run them
manually — but when a migration goes wrong, the rollback path is in-band and
covered below.

### What runs, where, when

| Service | preDeployCommand | What it does |
|---|---|---|
| `api-server` | `pnpm --filter @contractor-ops/db run db:migrate:all` | Applies Prisma migrations against every configured regional Neon database (EU + ME, and US once provisioned). Implemented by `packages/db/scripts/migrate-all-regions.ts`, which iterates over `DATABASE_URL_EU/ME/US` and invokes `prisma migrate deploy` per region, preferring each region's `DIRECT_URL_*` (unpooled) endpoint so migration advisory locks don't hang on the Neon PgBouncer pooler. |
| `cms` | `pnpm --filter @contractor-ops/cms run migrate` | Applies Payload v3 migrations against `CMS_DATABASE_URL` (separate Neon project, isolated from app DBs). Wraps `payload migrate` via dotenv so env loading matches local dev. |
| `public-api`, `cron-worker`, `web-vite` | _(none)_ | Read-only against the same regional databases — they inherit the schema applied by `api-server`'s preDeploy step. Roll order: `api-server` deploys first, downstream services pick up the new schema on their next revision. |

### Failure mode

- `preDeployCommand` runs **once per deploy** before the new revision starts
  taking traffic.
- A non-zero exit aborts the rollout. Render keeps the **previous revision
  serving** — no partial migration, no broken release.
- Sentry + Render deploy notifications fire on failure. Triage via
  Dashboard → service → **Events** → click the failed deploy → **Logs**.
- The migration script logs each region's outcome through
  `@contractor-ops/logger` so failures show structured fields
  (`region`, `step`, `error.code`) in Axiom.

### Schema-change review checklist

Before merging any PR that adds, modifies, or removes a Prisma migration
(`packages/db/prisma/migrations/**`) or a Payload migration (`apps/cms/src/migrations/**`):

- [ ] **Reversible?** Down-migration documented (or explicit decision recorded that rollback requires manual SQL).
- [ ] **Data-loss risk?** Any `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE`, or type narrowing must be flagged in the PR description with a backfill plan.
- [ ] **Downtime?** Long-running `ALTER TABLE` on large tables must use `CONCURRENTLY` (indexes) or expand-then-contract pattern (rename columns).
- [ ] **Tenant scope?** Cross-tenant queries inside the migration are pre-reviewed (RLS implications).
- [ ] **Multi-region parity.** Both EU and ME schemas converge — there are no region-only branches in the migration.
- [ ] **CODEOWNERS approval** on `packages/db/prisma/`.

### Manual migrate procedure

For staging dry-runs, ad-hoc data fixes, or recovery, you can run migrations
locally against a remote URL. **Always against a single explicit URL — never
unset `DATABASE_URL_*` in the shell where production credentials live.**

```bash
# Dry-run against staging EU (no apply)
DATABASE_URL="$STAGING_EU_URL" \
  pnpm --filter @contractor-ops/db exec prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script

# Apply to a single region
DATABASE_URL="$STAGING_EU_URL" \
  pnpm --filter @contractor-ops/db exec prisma migrate deploy

# Apply to both regions (mirrors the Render preDeploy behaviour)
DATABASE_URL_EU="$PROD_EU_URL" DATABASE_URL_ME="$PROD_ME_URL" \
  pnpm --filter @contractor-ops/db run db:migrate:all

# Payload (CMS)
CMS_DATABASE_URL="$STAGING_CMS_URL" \
  pnpm --filter @contractor-ops/cms run migrate
```

Use Neon's **branch** feature to clone the prod DB and dry-run there before
touching the live branch.

### Rollback procedure

If a migration ships and breaks production:

1. **Roll back the revision in Render first** — Dashboard → `web` → **Events** → previous successful deploy → **Rollback to this deploy**. The previous app code keeps running against the new schema as long as the schema change was **additive** (new columns, new tables). For additive changes this is enough; ship the corrective code change next.
2. **If the migration is destructive** (dropped column, renamed table, narrowed type), the previous revision will fail at runtime. Mitigation: have a hotfix branch ready that reverts the offending migration AND ships compensating SQL. Apply manually via the procedure above:
   ```bash
   # Restore dropped data from Neon point-in-time recovery
   # Neon Dashboard → Branches → create branch from "5 minutes ago"
   # → diff with current → copy missing rows back via psql
   ```
3. **Roll forward, not back, on Prisma.** Prisma has no `migrate down` in deploy mode. To "undo" a migration, write a new corrective migration and ship it through the normal preDeploy path. Never `prisma migrate resolve --rolled-back` against production unless you have already restored the schema state manually.
4. **Payload migrations** support `payload migrate:down`, but treat it the same way — prefer a forward-fix migration over an in-place rollback against production.
5. Post-incident: file an entry in `docs/POST-DEPLOY-MONITORING.md` (incident log) and an ADR if the root cause was a process gap.

### Quick sanity checks

```bash
# What migrations are pending against a URL?
DATABASE_URL="$URL" \
  pnpm --filter @contractor-ops/db exec prisma migrate status

# Compare schema drift between code and DB
pnpm --filter @contractor-ops/db exec tsx scripts/check-generated-drift.ts
```

## Topology

| Service | Type | Plan | Notes |
|---|---|---|---|
| `web` | Web Service (Docker) | `standard` × 2..8 | Next.js 15 standalone, port 3000, public, autoscaling |
| `landing` | Static Site | free | `apps/landing/out`, CDN, public |
| `public-api` | Web Service (Docker) | `standard` × 2..6 | Hono REST API (Enterprise), port 3000, public, autoscaling, OpenAPI at `/api/v1/docs` |
| `worker` | Background Worker (Docker) | `starter` × 1 | node-cron: reminders, trial-notifications, job-health |
| `clamav` | Private Service (image) | `standard` | clamav/clamav:stable, persistent disk 5GB (signatures need ≥1GB RAM) |
| `unleash-eu` | Private Service (image) | `starter` | Self-hosted Unleash (feature flags, EU). Private-only; admin UI via cloudflared |
| `unleash-me` | Private Service (image) | `starter` | Self-hosted Unleash (feature flags, ME). Private-only; admin UI via cloudflared |
| `cloudflared` | Private Service (image) | `starter` | Zero Trust tunnel for Unleash admin UIs. **Suspend by default** — resume on-demand (~$0.30/mc at 1h/day) |
| `cron-token-refresh` | Cron Job | `starter` | `*/15 * * * *` → web/api/cron/token-refresh |
| `cron-data-purge` | Cron Job | `starter` | `0 3 * * *` → web/api/cron/data-purge |

External services (NOT in render.yaml): Neon Postgres (EU + ME), Upstash Redis + QStash, Cloudflare R2, Resend, Sentry, Stripe, Cronitor.

Region: `frankfurt`. ME-residency tenants still hit Neon ME via `DATABASE_URL_ME` — only the application process runs in EU.

---

## First-time setup

### 0. Prerequisites

- **Render workspace tier: Professional or higher ($19/user/month)** — autoscaling (`scaling` block on `web`) is only available on Professional+. Starter/Hobby workspaces will reject the Blueprint.
- GitHub connection authorized for the repo.
- Neon project provisioned (EU + ME regions) with pooled connection string for `DATABASE_URL`.
- Upstash Redis + QStash, Cloudflare R2 buckets, Resend domain, Sentry project — all created before first Blueprint apply.
- `pnpm-lock.yaml` must match `package.json`. Run `pnpm install` and commit before pushing to `main` if you've added/removed workspace packages, otherwise the Docker build fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.

### 1. Create the Blueprint Instance

1. Push `render.yaml` to `main`.
2. Render Dashboard → **New +** → **Blueprint** → connect the GitHub repo.
3. Render parses `render.yaml`, lists every service. Click **Apply**.
4. The Blueprint creates 6 services. The first build for `web` and `worker` takes ~10–15 min (full pnpm install + turbo build).

### 2. Fill `sync: false` env vars

After services exist, open each service → **Environment** tab → fill blanks. The same secrets are needed for `app-shared` env group:

- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `DATABASE_URL`, `DATABASE_URL_EU`, `DATABASE_URL_ME` — Neon connection strings (use the *pooled* one for `DATABASE_URL`).
- `R2_*` — Cloudflare R2 credentials.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
- OAuth: `GOOGLE_*`, `MICROSOFT_*` (and any integration providers used).
- `STRIPE_*` keys + `STRIPE_WEBHOOK_SECRET` (set once Stripe webhook endpoint is created — see step 5).
- `BANK_ACCOUNT_ENCRYPTION_KEY` — `openssl rand -hex 32`.
- `SLACK_TOKEN_ENCRYPTION_KEY` — `openssl rand -hex 32`.
- `API_KEY_HMAC_SECRET` — Enterprise REST API (`public-api`) HMAC secret for API-key hashes. `openssl rand -hex 32`.
- `ANTHROPIC_API_KEY`.
- `CRONITOR_API_KEY`, `AXIOM_TOKEN`, `SENTRY_DSN`, `VITE_SENTRY_DSN`.
- `INFISICAL_*` (if using Infisical secret store; otherwise leave blank — falls back to MemoryStore).

For the `build-secrets` group (build-time only, used in the Docker build):
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

`CRON_SECRET` is auto-generated on `web` and shared with `worker`, `cron-token-refresh`, `cron-data-purge` via `fromService`. Do not set manually.

### 3. Bind a custom domain

1. `web` service → **Settings** → **Custom Domains** → **Add** → e.g. `app.contractor-ops.com`.
2. Add the CNAME record shown by Render at your DNS provider.
3. Render auto-issues a Let's Encrypt cert (~1–2 minutes).
4. Update `app-shared` env group:
   - `PUBLIC_APP_URL=https://app.contractor-ops.com`
   - `APP_URL=https://app.contractor-ops.com`
   - `API_URL=https://api.contractor-ops.com`
   - `BETTER_AUTH_URL=https://app.contractor-ops.com`
   - `PORTAL_BASE_DOMAIN=portal.contractor-ops.com` (and add wildcard `*.portal.contractor-ops.com` on the `api` service's Custom Domains).
5. Repeat for `landing` (e.g. `contractor-ops.com` apex + `www`).
6. Repeat for `public-api` on a dedicated subdomain: `api.contractor-ops.com`. This service is only used by Enterprise customers via API key — keep it on a separate domain so rate limits, audit logs, and WAF rules are scoped independently of `web`.

### 4. Allowlist Render egress IPs

Render egress IPs per region are listed at <https://render.com/docs/static-outbound-ip-addresses>. Add them to:

- **Neon** → Project → Settings → IP Allow → add Render Frankfurt IPs.
- **Upstash Redis / QStash** → Database → Security → IP Whitelist (Upstash REST is open by default, IP allowlist is optional but recommended).
- **Cloudflare R2** → no IP restrictions by default; access is via signed S3 credentials.
- **HMRC** sandbox/production — no IP allowlist required (OAuth client credentials).

### 5. External webhooks

After domain is live, point provider webhooks at the new URLs:

- **Stripe** → Webhooks → endpoint `https://app.contractor-ops.com/api/billing/webhook`. Copy signing secret → `STRIPE_WEBHOOK_SECRET`.
- **Resend** → Webhooks → `https://app.contractor-ops.com/api/webhooks/resend`. Copy secret → `RESEND_WEBHOOK_SECRET`.
- **DocuSign / Linear / Jira / Notion / Slack** — update redirect URIs and webhook URLs for each integration.

### 6. Verify deployment

```bash
# Health check
curl -fsS https://app.contractor-ops.com/api/health

# SSR test (no JS)
curl -fsS https://app.contractor-ops.com/ | grep '<title>'

# Cron Jobs — trigger manually from Render Dashboard ("Trigger Run")
# and tail logs of `web` to confirm /api/cron/token-refresh returned 200.

# Public REST API (Enterprise)
curl -fsS https://api.contractor-ops.com/api/v1/health
# Open https://api.contractor-ops.com/api/v1/docs for OpenAPI reference (Scalar).
# Authenticated endpoints expect: Authorization: Bearer <api_key>
```

Run k6 smoke against the new domain:

```bash
BASE_URL=https://app.contractor-ops.com pnpm load:smoke
```

Verify autoscaling kicks in during stress:

```bash
BASE_URL=https://app.contractor-ops.com pnpm load:stress
# Watch web → Metrics → Instances should grow 2 → up to 8.
```

---

## Operations

### Rotate secrets

`BETTER_AUTH_SECRET` and `BANK_ACCOUNT_ENCRYPTION_KEY` rotation requires a rolling restart of `web` (sessions invalidate on rotation; existing encrypted bank accounts must be re-encrypted before swapping the key — see `packages/api/src/services/bank-encryption.ts` migration helper).

`CRON_SECRET`:
1. `web` service → Environment → click **Regenerate** on `CRON_SECRET`.
2. Trigger redeploy on `web` (auto-redeploys downstream `worker`/cron services because they reference via `fromService`).
3. Confirm `worker` and cron jobs picked up the new value (logs).

### View logs

- Per-service logs in Dashboard → service → **Logs**.
- Aggregate: Axiom dataset `contractor-ops` (configured via `AXIOM_TOKEN`).
- Errors: Sentry project (configured via `SENTRY_DSN` for servers, `VITE_SENTRY_DSN` for the SPA).

### Scale up

- `web` → Settings → Scaling → adjust `minInstances` / `maxInstances` or upgrade plan to `pro`/`pro plus` for more RAM/CPU per instance.
- `public-api` → same autoscaling model as `web`; default 2..6 on `standard`. Enterprise API traffic is typically more predictable than `web` — tune thresholds based on observed load.
- `worker` → fixed at 1 instance (node-cron is single-process). To scale workers, migrate to BullMQ — see `docs/TECH-DEBT.md`.
- `clamav` → fixed at 1 instance (persistent disk does not allow multi-instance).

### Feature flags — Unleash (EU + ME)

Two private Unleash instances (`unleash-eu`, `unleash-me`) run on Render's private network. Neither is reachable from the public internet — `apps/web` and `apps/public-api` talk to them by hostname only.

First-time setup:

1. Provision two dedicated Postgres databases (separate Neon projects recommended — keep them isolated from the main app DB so Unleash's auto-migrations never touch app schemas).
2. Fill `DATABASE_URL` on both `unleash-eu` and `unleash-me` services.
3. Fill `INIT_ADMIN_API_TOKENS` on each (format: `*:*.<64-hex-chars>` — one-shot bootstrap, rotate via UI after first boot).
4. After services are live, grab the private hostnames (Dashboard → service → "Internal Address"). Update `app-shared`:
   - `UNLEASH_URL_EU=http://unleash-eu-XXXX:4242/api/`
   - `UNLEASH_URL_ME=http://unleash-me-XXXX:4242/api/`
5. Create server-side tokens in each Unleash UI (Admin → API access → "server-side") and set `UNLEASH_API_TOKEN_EU` / `UNLEASH_API_TOKEN_ME`.

Admin UI access is via the `cloudflared` tunnel (see below) — by design there is no public URL.

### Cloudflare Tunnel (on-demand)

The `cloudflared` pserv fronts both Unleash admin UIs with Cloudflare Zero Trust Access (Google Workspace SSO + MFA). Cloudflare Tunnel is free; Access is free up to 50 users; the only recurring Render cost is this one pserv — and it only bills while running.

**Setup (one-time):**

1. Cloudflare Zero Trust dashboard → **Networks** → **Tunnels** → **Create a tunnel** → type `Cloudflared` → name e.g. `contractor-ops-admin`.
2. Copy the tunnel **token** (one line starting with `ey…`) → paste into `cloudflared` service env `TUNNEL_TOKEN`.
3. In the tunnel's **Public Hostnames** tab, add two routes:
   - `unleash-eu.internal.contractor-ops.com` → `http://unleash-eu-XXXX:4242` (use the private hostname from Render)
   - `unleash-me.internal.contractor-ops.com` → `http://unleash-me-XXXX:4242`
4. Cloudflare Zero Trust → **Access** → **Applications** → **Add an application** → type `Self-hosted` → cover both hostnames → policy: `Include` → `Emails ending in @contractor-ops.com` (or an explicit allowlist) → require Google Workspace identity provider + MFA.

**Runbook — on-demand access:**

Save Render API key (Dashboard → Account Settings → API Keys) and the `cloudflared` service ID locally:

```bash
export RENDER_API_KEY=rnd_...
export CLOUDFLARED_SVC=srv-...  # from Dashboard URL or `render services`

# Resume (starts billing, ~15s cold start)
curl -sS -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$CLOUDFLARED_SVC/resume"

# Browse to https://unleash-eu.internal.contractor-ops.com (SSO prompt)
# …do admin work…

# Suspend (billing stops)
curl -sS -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$CLOUDFLARED_SVC/suspend"
```

Suggested wrapper as `pnpm unleash:open` / `pnpm unleash:close` (add to root `package.json` when convenient). Optional: auto-suspend after N minutes via a local `at`/`launchd` scheduler — avoids "left running overnight" bills.

**Cost model** — starter pserv is ~$7/mc if left on; on-demand (1h/day ≈ 30h/mc) is ~$0.30/mc. Suspended = $0.

**Why not Access IP allowlist on a public web service instead?** That path needs Render's Enterprise tier. On Professional, private pserv + tunnel is the only Zero-Trust-grade option.

### Preview environments

The blueprint sets `previews.generation: automatic` globally, but every backend service that carries production secrets — `api-server`, `public-api`, `cron-worker`, `cms` (plus `clamav`, `unleash-*`, `cloudflared`) — opts out with `previews: generation: off`. Preview instances inherit `app-shared` (production `DATABASE_URL_EU/ME` + secrets), so a preview `cron-worker` would run the daily data-purge (hard-delete) against production. Only the `web-vite` static SPA keeps PR previews (`pullRequestPreviewsEnabled: true`) — it ships no server process and reads only build-time public `VITE_*` values. To preview a backend service, first stand up an isolated preview env group with its own database.

### Render MCP / CLI

Render publishes an MCP server (`render-oss/render-mcp-server`) for log inspection and deploys via Claude Code. Configure once and use `mcp__render__*` tools to deploy and read logs without leaving the editor.

---

## Troubleshooting

**Build times out (>30 min)** — switch to `pro` build plan, or split monorepo: build `packages/*` separately and cache.

**Web service unreachable from worker / cron jobs** — confirm web is binding on port 3000 (not 10000 — blocked on private network). Check `WEB_HOST` env var is resolved to `web-XXXX` via `fromService.property: host`.

**ClamAV fails to start** — first boot of `clamav/clamav:stable` runs `freshclam` which downloads ~300MB of signatures. Allow `CLAMD_STARTUP_TIMEOUT=180s` (already set). Persistent disk avoids re-downloading.

**Sentry source maps not uploading** — `SENTRY_AUTH_TOKEN` must be in `build-secrets` env group AND service must reference it via `fromGroup: build-secrets`. Check the build log for `> Uploading source maps to Sentry`.

**Better Auth cookies rejected on portal subdomain** — the current `packages/auth/src/config.ts` does not configure cross-subdomain cookies. If the portal subdomain flow needs shared sessions, add Better Auth's `advanced.crossSubDomainCookies` option (see Better Auth docs) and set `BETTER_AUTH_URL` to the apex domain. Treat this as a separate task — it is not required for first deploy.
