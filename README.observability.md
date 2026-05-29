# Local observability stack

Dev-only replacement for **Sentry SaaS** + **Axiom Cloud** so local runs
stop burning the prod project's error budget and log field quota.

| Component | Image | Local URL | Replaces |
|---|---|---|---|
| GlitchTip web | `glitchtip/glitchtip:v4.1` | <http://localhost:8000> | Sentry SaaS |
| GlitchTip worker | `glitchtip/glitchtip:v4.1` | n/a | Sentry worker |
| GlitchTip Postgres | `postgres:15-alpine` | n/a | — |
| GlitchTip Redis | `redis:7-alpine` | n/a | — |
| Loki | `grafana/loki:3.2.0` | <http://localhost:3100> | Axiom Cloud |
| Grafana | `grafana/grafana:11.2.0` | <http://localhost:3001> | Axiom dashboards |

Compose file: [`docker-compose.observability.yml`](./docker-compose.observability.yml).
Compose project name: `contractor-ops-observability`.

---

## TL;DR

```bash
# 1. Bring the stack up
pnpm dev:observability

# 2. First-run only: create admin + project in GlitchTip
open http://localhost:8000
#   → Sign up (first user becomes platform admin)
#   → Create organization → create project (type: JavaScript or Node)
#   → Copy the printed DSN

# 3. Paste the DSN into .env
SENTRY_DSN=http://<key>@localhost:8000/1
VITE_SENTRY_DSN=http://<key>@localhost:8000/1
SENTRY_DEV=true
LOKI_URL=http://localhost:3100

# 4. Restart the app
pnpm dev

# 5. Explore the data
open http://localhost:8000      # GlitchTip Issues feed
open http://localhost:3001      # Grafana → Explore → Loki → {service="api-server"}
```

Tear it down: `pnpm dev:observability:down` (preserve state) or
`pnpm dev:observability:reset` (drop volumes — wipes GlitchTip projects
+ Loki chunks).

---

## How the swap works

### Sentry → GlitchTip

GlitchTip implements the same wire protocol the official `@sentry/*` SDKs
already speak. No code change needed on the apps. The dev guard added in
[`apps/api/src/lib/sentry.ts`](apps/api/src/lib/sentry.ts) (and the
matching `cron-worker`, `public-api`, `web-vite` files) is what made
`pnpm dev` skip uploads entirely; `SENTRY_DEV=true` lifts that guard,
events flow into the local project URL, prod Sentry stays untouched.

What GlitchTip does *not* support:

| Feature | In-codebase usage | Behaviour against GlitchTip |
|---|---|---|
| Session replay | none | n/a |
| Profiling | none | n/a |
| `Sentry.logger.*` / `enableLogs: true` | tests only (no prod use) | events silently dropped — Pino + Loki still capture the same log line |
| Cron monitoring | none | n/a |

Performance traces (`browserTracingIntegration`, `tracesSampleRate`) work.

### Axiom → Loki

[`packages/logger/src/loki-stream.ts`](packages/logger/src/loki-stream.ts)
adds a Pino `Writable` that batches log lines and POSTs them to
`${LOKI_URL}/loki/api/v1/push`. It mirrors the existing
[`axiom-stream.ts`](packages/logger/src/axiom-stream.ts) design:

- Synchronous Writable (no worker threads, plays nice with the existing
  Vite / Next legacy builds).
- Per-line JSON parse → labels (`service`, `level`, `source=pino`) +
  payload. The payload is the original JSON line so structured fields
  stay queryable via `| json` in LogQL.
- Auto-flush every 2 s or when the buffer exceeds 256 KB. Forced flush on
  `beforeExit` + `SIGTERM`.

[`packages/logger/src/index.ts`](packages/logger/src/index.ts)
`createRootLogger()` fans out a Loki stream whenever `LOKI_URL` is set —
parallel to Axiom, independent of it. Prod (no `LOKI_URL`) is unchanged.

---

## Grafana queries

Datasource is auto-provisioned from
[`infra/grafana/provisioning/datasources/loki.yml`](infra/grafana/provisioning/datasources/loki.yml).
Anonymous Admin access is on by default in dev — no login needed.

Useful LogQL:

```logql
# All logs from the api-server (Fastify + tRPC)
{service="api-server"}

# Just errors across every service
{level="error"}

# Cron-worker job emissions for one tenant
{service="cron-worker"} | json | organizationId="org_abc123"

# Trace a single request across services
{source="pino"} | json | requestId="c6aaef48-f440-41e6-82a2-755c81d09fbd"
```

The `derivedFields` block on the datasource exposes a "Copy request id"
chip on every line. Future: swap the URL template for a Tempo / Jaeger
trace explorer when one lands in this stack.

---

## Production safety

- `LOKI_URL` is unset in Render env → the Loki branch in
  `createRootLogger()` is skipped, no Loki traffic ever leaves prod.
- `SENTRY_DEV` is unset in Render env → the dev guard does nothing in
  `NODE_ENV=production`, prod Sentry stays the canonical sink.
- Compose project name is `contractor-ops-observability`; it cannot
  collide with the main app stack and is opt-in via `pnpm
  dev:observability` only.
- The compose volumes (`glitchtip-pg`, `loki-data`, `grafana-data`) live
  inside Docker and are wiped by `pnpm dev:observability:reset`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| GlitchTip web container exits with `relation … does not exist` | DB volume from an older image still mounted | `pnpm dev:observability:reset` |
| Events not appearing in GlitchTip | DSN copied with HTTPS instead of HTTP, or `SENTRY_DEV` not set | Check `.env`; restart `pnpm dev` |
| Loki returns `429 too many ingestion requests` | Pino burst at startup | Increase `ingestion_burst_size_mb` in `infra/loki/loki-config.yml` |
| Grafana asks for password | Anonymous Admin disabled or env override | Default login `admin` / `admin`, set new password on first prompt |
| Pino logs still go nowhere | `LOKI_URL` is set but service can't reach `host.docker.internal` | Use `LOKI_URL=http://localhost:3100` on the host process; the containers reach each other via the compose network, the host process talks to `localhost:3100` |

If GlitchTip needs a hard reset:

```bash
pnpm dev:observability:reset
pnpm dev:observability
```

Then sign up again and paste the new DSN.
