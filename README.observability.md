# Local observability stack

Dev-only replacement for **Sentry SaaS** + **Axiom Cloud** so local runs
stop burning the prod project's error budget and log field quota.

Defined in the main [`docker-compose.yml`](./docker-compose.yml) under
two profiles:

| Profile | Component | Image | Local URL | Replaces |
|---|---|---|---|---|
| `glitchtip` | GlitchTip web | `glitchtip/glitchtip:latest` | <http://localhost:8000> | Sentry SaaS |
| `glitchtip` | GlitchTip worker | `glitchtip/glitchtip:latest` | n/a | Sentry worker |
| `glitchtip` | GlitchTip Postgres | `postgres:17-alpine` | n/a | — |
| `glitchtip` | GlitchTip Redis | `redis:8.6.3-alpine` | n/a | — |
| `glitchtip` | GlitchTip migrate + seed sidecars | n/a | n/a | first-run bootstrap |
| `observability` | Loki | `grafana/loki:3.2.0` | <http://localhost:3100> | Axiom Cloud |
| `observability` | Grafana | `grafana/grafana:11.2.0` | <http://localhost:3001> | Axiom dashboards |

The two profiles are independent — bring up only one if you only need
the half. `pnpm dev:observability` activates both for convenience.

---

## TL;DR

```bash
# 1. Bring both profiles up (calls docker compose --profile glitchtip --profile observability)
pnpm dev:observability

# 2. Grab the seeded DSN — the glitchtip-seed sidecar prints it on first boot
pnpm dev:observability:dsn
#   → SENTRY_DSN=http://abc123@localhost:8000/1
#   → VITE_SENTRY_DSN=http://abc123@localhost:8000/1

# 3. Paste those into .env (or set them via your secret manager), then add:
SENTRY_DEV=true
LOKI_URL=http://localhost:3100

# 4. Restart the app
pnpm dev

# 5. Explore the data
open http://localhost:8000      # GlitchTip Issues feed (admin@glitchtip.local / Test1234!)
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

The compose stack pre-seeds an admin user + organization + project on
first run via [`docker/glitchtip/seed.py`](docker/glitchtip/seed.py),
mounted into the `glitchtip-seed` sidecar. Defaults:

- Admin email: `admin@glitchtip.local`
- Admin password: `Test1234!`
- Organisation: `contractor-ops`
- Project: `contractor-ops`

Override any of these via the `GLITCHTIP_ADMIN_EMAIL` /
`GLITCHTIP_ADMIN_PASSWORD` / `GLITCHTIP_ORG_NAME` / `GLITCHTIP_PROJECT_NAME`
env vars before bringing the stack up.

Verification emails (e.g. for a second user added via the UI) land in
Mailpit when the `dev-tooling` profile is also active — the compose file
already wires `EMAIL_URL: smtp://mailpit:1025` on GlitchTip.

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
[`docker/grafana/provisioning/datasources/loki.yml`](docker/grafana/provisioning/datasources/loki.yml).
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
- The `observability` profile is opt-in — `docker compose up -d` without
  `--profile observability` (or without `pnpm dev:observability`) never
  starts these containers.
- Compose volumes (`glitchtip_pg_data`, `glitchtip_redis_data`,
  `loki_data`, `grafana_data`) live inside Docker and are wiped by
  `pnpm dev:observability:reset`.
- All published ports are bound to `127.0.0.1`. Nothing on the
  observability stack is reachable from the LAN.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| GlitchTip web container exits with `relation … does not exist` | DB volume from an older image still mounted | `pnpm dev:observability:reset` |
| `pnpm dev:observability:dsn` prints nothing | The seed sidecar already ran successfully and rotated out of logs | `docker compose logs glitchtip-seed` (no tail) — or sign in to <http://localhost:8000> and grab the DSN from Settings → Client Keys |
| Events not appearing in GlitchTip | DSN copied with HTTPS instead of HTTP, or `SENTRY_DEV` not set | Check `.env`; restart `pnpm dev` |
| Loki returns `429 too many ingestion requests` | Pino burst at startup | Increase `ingestion_burst_size_mb` in `docker/loki/loki-config.yml` |
| Grafana asks for password | Anonymous Admin disabled or env override | Default login `admin` / `admin`, set new password on first prompt |
| Pino logs still go nowhere | Container can't talk to `host.docker.internal` | Use `LOKI_URL=http://localhost:3100` on the host process. Compose-internal services already reach Loki via the `observability` network. |

If GlitchTip needs a hard reset:

```bash
pnpm dev:observability:reset
pnpm dev:observability
pnpm dev:observability:dsn
```
