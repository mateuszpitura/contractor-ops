# Render Deployment

Production deployment guide for `contractor-ops` on [Render](https://render.com).

## Topology

| Service | Type | Plan | Notes |
|---|---|---|---|
| `web` | Web Service (Docker) | `standard` × 2..8 | Next.js 15 standalone, port 3000, public, autoscaling |
| `landing` | Static Site | free | `apps/landing/out`, CDN, public |
| `worker` | Background Worker (Docker) | `starter` × 1 | node-cron: reminders, trial-notifications, job-health |
| `clamav` | Private Service (image) | `starter` | clamav/clamav:stable, persistent disk 5GB |
| `cron-token-refresh` | Cron Job | `starter` | `*/15 * * * *` → web/api/cron/token-refresh |
| `cron-data-purge` | Cron Job | `starter` | `0 3 * * *` → web/api/cron/data-purge |

External services (NOT in render.yaml): Neon Postgres (EU + ME), Upstash Redis + QStash, Cloudflare R2, Resend, Sentry, Stripe, Cronitor.

Region: `frankfurt`. ME-residency tenants still hit Neon ME via `DATABASE_URL_ME` — only the application process runs in EU.

---

## First-time setup

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
- `ANTHROPIC_API_KEY`.
- `CRONITOR_API_KEY`, `AXIOM_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`.
- `INFISICAL_*` (if using Infisical secret store; otherwise leave blank — falls back to MemoryStore).

For the `build-secrets` group (build-time only, used in the Docker build):
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

`CRON_SECRET` is auto-generated on `web` and shared with `worker`, `cron-token-refresh`, `cron-data-purge` via `fromService`. Do not set manually.

### 3. Bind a custom domain

1. `web` service → **Settings** → **Custom Domains** → **Add** → e.g. `app.contractor-ops.com`.
2. Add the CNAME record shown by Render at your DNS provider.
3. Render auto-issues a Let's Encrypt cert (~1–2 minutes).
4. Update `app-shared` env group:
   - `NEXT_PUBLIC_APP_URL=https://app.contractor-ops.com`
   - `APP_URL=https://app.contractor-ops.com`
   - `BETTER_AUTH_URL=https://app.contractor-ops.com`
   - `PORTAL_BASE_DOMAIN=portal.contractor-ops.com` (and add wildcard `*.portal.contractor-ops.com` on the `web` service's Custom Domains).
5. Repeat for `landing` (e.g. `contractor-ops.com` apex + `www`).

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
- Errors: Sentry project (configured via `NEXT_PUBLIC_SENTRY_DSN`).

### Scale up

- `web` → Settings → Scaling → adjust `minInstances` / `maxInstances` or upgrade plan to `pro`/`pro plus` for more RAM/CPU per instance.
- `worker` → fixed at 1 instance (node-cron is single-process). To scale workers, migrate to BullMQ — see `docs/TECH-DEBT.md`.
- `clamav` → fixed at 1 instance (persistent disk does not allow multi-instance).

### Preview environments

Every PR opens an automatic preview environment (`previews.generation: automatic`, expires after 7 days). Preview env vars inherit from `app-shared` but use isolated databases — connect a Neon branch via `DATABASE_URL` per-PR override if you need full data isolation.

### Render MCP / CLI

Render publishes an MCP server (`render-oss/render-mcp-server`) for log inspection and deploys via Claude Code. Configure once and use `mcp__render__*` tools to deploy and read logs without leaving the editor.

---

## Troubleshooting

**Build times out (>30 min)** — switch to `pro` build plan, or split monorepo: build `packages/*` separately and cache.

**Web service unreachable from worker / cron jobs** — confirm web is binding on port 3000 (not 10000 — blocked on private network). Check `WEB_HOST` env var is resolved to `web-XXXX` via `fromService.property: host`.

**ClamAV fails to start** — first boot of `clamav/clamav:stable` runs `freshclam` which downloads ~300MB of signatures. Allow `CLAMD_STARTUP_TIMEOUT=180s` (already set). Persistent disk avoids re-downloading.

**Sentry source maps not uploading** — `SENTRY_AUTH_TOKEN` must be in `build-secrets` env group AND service must reference it via `fromGroup: build-secrets`. Check the build log for `> Uploading source maps to Sentry`.

**Better Auth cookies rejected on portal subdomain** — set `BETTER_AUTH_URL` to apex (e.g. `https://contractor-ops.com`) and configure `cookieDomain: '.contractor-ops.com'` in `packages/auth/src/config.ts`.
