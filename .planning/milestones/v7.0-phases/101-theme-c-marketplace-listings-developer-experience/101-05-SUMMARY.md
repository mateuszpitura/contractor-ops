# 101-05 SUMMARY — public status aggregator + IncidentReport

**Status:** complete · **Wave:** 1 · **Requirements:** INTEG-DX-03

## What shipped

- **`status-aggregator.ts`** (`@contractor-ops/api`, new `./services/status-aggregator` export) —
  `aggregateStatus()` → `{ updatedAt, components, incidents }`. Three coarse component states
  (`operational|degraded|down`) mapped from the SHIPPED sources (no new monitoring stack):
  - `api` → a `SELECT 1` datastore liveness probe.
  - `webhooks-dispatcher` → the exact `job-health.ts` rule: `webhookDelivery` FAILED-in-last-hour
    vs `FAILURE_ALERT_THRESHOLD` (10) + RECEIVED/PROCESSING queue depth vs 100.
  - `background-jobs` → `outboxEvent` FAILED-in-last-hour + due-PENDING backlog vs the same thresholds.
  Every probe is timeout-guarded (1.5s) + try/catch → an unavailable source degrades ONLY its own
  component, never throws. Open/monitoring incidents are overlaid (CRITICAL → down, else degraded) but
  never de-escalate a live probe. The payload carries NO tenant data.
- **`apps/public-api/src/routes/status.ts`** — the public, unauthenticated `/v1/status.json` handler
  mounted in `app.ts` OUTSIDE the key/flag chain (next to `/health`). Gated by `module.public-status-page`
  (404 when off — ship-dark), short-TTL cached (10s) so a status-check storm doesn't hammer the probes.
- **`IncidentReport` model** (`incident.prisma`) — `title`, `status` (OPEN|MONITORING|RESOLVED),
  `severity` (MINOR|MAJOR|CRITICAL), `componentsAffected String[]`, `updates Json[]`, `startedAt`,
  `resolvedAt?`. Global (NOT tenant-scoped). `EntityType += INCIDENT`; `AuditEntityType += 'INCIDENT'`.
- **`incidentRouter`** (`routers/core/incident.ts`, mounted `incident:` in `root.ts`) — `list`, `create`,
  `addUpdate`, `resolve`; every mutation `writeAuditLog`s with the `INCIDENT` entity type. Open incidents
  render in `/status.json` (id, title, status, severity, componentsAffected, startedAt, latestUpdate — no
  tenant data).

## RED → GREEN + no regression

- `status-page.test.ts` — **GREEN 3/3** (was RED): the three component keys, valid coarse states, the
  deep-scan no-tenant-data invariant, and 404 when the flag is off.
- `@contractor-ops/api` + `@contractor-ops/public-api` typecheck clean; `@contractor-ops/db` builds; client
  regenerated. authz-permission-matrix + marketplace-listing + root suites 29/29. Public-api regression
  fence unchanged (only `developer-portal.test.ts` stays RED → 101-08).

## `/status.json` shape (for 101-09 front-end)

```json
{
  "updatedAt": "ISO",
  "components": {
    "api": { "status": "operational|degraded|down" },
    "webhooks-dispatcher": { "status": "..." },
    "background-jobs": { "status": "..." }
  },
  "incidents": [
    { "id", "title", "status": "OPEN|MONITORING", "severity": "MINOR|MAJOR|CRITICAL",
      "componentsAffected": ["api", ...], "startedAt": "ISO", "latestUpdate": "string|null" }
  ]
}
```

## Deviations

- The incident router reuses the platform-operator `admin:marketplace` permission (the same
  developer-experience operator cohort owns the marketplace + status surfaces) rather than minting a new
  permission — avoids auth-package churn + the exact-grant auth-test updates. Semantically the operator set
  is identical.
- `background-jobs` maps to the outbox-drain backlog (there is no persistent cross-process job-run table;
  cron-worker job status is in-memory per-process, unreadable from the API tier).

## Migration (deferred apply)

`__phase101_incident_report` — `IncidentStatus` + `IncidentSeverity` enums + `IncidentReport` table +
`EntityType += INCIDENT`. Additive, reversible. Applied per region at the human migration gate.
EXTERNAL-ENABLEMENT row in 101-10.
