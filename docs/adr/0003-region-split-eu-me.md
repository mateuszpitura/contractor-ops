# 3. Multi-region data residency: EU + ME Neon split

Date: 2026-05-17
Status: Accepted

## Context

Target jurisdictions split into two regulatory clusters:
- **EU** — GDPR, BDSG (DE), CCPA-style state laws when serving US orgs.
  Personal data must remain in the EEA for EU-resident contractors and
  their employers.
- **ME** — Saudi Arabia (PDPL), UAE (Federal Decree-Law 45/2021), Qatar
  (PDPL). Personal data must be stored in-region or in
  similarly-protected jurisdictions; cross-border transfer requires
  specific contractual / regulatory bases.

A single shared database in `eu-central-1` would technically be
defensible for some ME jurisdictions, but several enterprise prospects
(notably UAE and KSA government-adjacent buyers) require demonstrable
in-region storage. Building region awareness later — after schema and
query patterns settle — would be vastly more expensive than building it
in from the start.

R2 object storage and Unleash feature-flag state follow the same data
boundary as Postgres.

## Decision

We run **two independent Neon Postgres projects** (`DATABASE_URL_EU`,
`DATABASE_URL_ME`) and route every read/write through `packages/db` by
`org.countryCode`. The single shared `DATABASE_URL` is reserved for
Better Auth's session/user tables (consent: residual auth metadata is
cross-region by design, scoped to authentication only).

R2 buckets follow the same split (`r2-eu-*`, `r2-me-*`). Unleash runs
twice (`unleash-eu`, `unleash-me`) — both private services on Render's
internal network, each pointed at its own Postgres database for flag
state. The application process runs in `frankfurt` (EU); ME requests are
authorised in EU but execute their data path against ME databases over
TLS.

Migrations are applied to **both** regions in lock-step via
`packages/db/scripts/migrate-all-regions.ts`, invoked from Render's
`preDeployCommand` on the `web` service.

## Consequences

**Good**
- Demonstrable in-region storage for ME prospects.
- Region boundary is explicit at the data-access layer — auditing the
  blast radius of a data leak is straightforward.
- Independent failure domains — Neon ME outage does not affect EU
  tenants.
- Compliance reviews can point at concrete infra, not policy promises.

**Bad**
- Cross-region tenant migration is non-trivial (must move data through
  application-level transfer, not Postgres replication).
- Aggregate queries (platform-wide analytics) require fan-out + merge,
  not a single SQL query.
- Two databases means two backup policies, two PITR windows, two cost
  centres.
- Engineers must remember: `db.eu` and `db.me` are siblings, not a
  shared pool — accidental "default" routing is a latent residency
  violation. The tenant-scoped raw SQL lint guard
  (`scripts/check-raw-sql-tenant-scoped.ts`) catches the obvious cases.
