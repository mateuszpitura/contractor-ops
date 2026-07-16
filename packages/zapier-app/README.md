# @contractor-ops/zapier-app

The Contractor Ops [Zapier CLI](https://platform.zapier.com/) app. Every trigger and
action is **generated** from the OpenAPI snapshot + the webhook event catalog via
[`@contractor-ops/marketplace-manifests`](../marketplace-manifests) — nothing is
hand-authored per platform, so the app can never drift from the public API.

## What it exposes

| Surface | Source | Count |
| --- | --- | --- |
| **Triggers** (REST hooks) | the webhook event catalog (`@contractor-ops/validators`) | one per event (16) |
| **Actions** (creates) | the OpenAPI snapshot's write operationIds | one per write op |

Triggers subscribe a Zapier-managed target URL to an event (e.g. `invoice.paid`,
`contractor.created`) and pass the delivered envelope straight through. Actions POST/PATCH
to the matching public-API write endpoint (create contractor, create invoice, approve
invoice, mark payment paid, create workflow task, …).

While the snapshot's write routes are hidden (pre-flip) the app ships its triggers with
**zero actions**; the actions appear automatically once the snapshot exposes the writes —
the count is always derived from the snapshot, never hardcoded.

## Authentication

The shipping scheme is a **custom API-key** field. The user pastes a Contractor Ops API
key, created under **Settings → Developer**:

- `co_live_…` — production
- `co_test_…` — the free sandbox tier (isolated demo org, no real side-effects)

Every request carries the key as `Authorization: Bearer <key>`. An **OAuth 2.0
authorization-code** variant is scaffolded (`oauth2Authentication`) for a future
partner-hosted flow but is not wired in — the platform contract accepts either scheme and
the key flow needs no partner OAuth client to ship.

## Build & validate

```bash
pnpm --filter @contractor-ops/zapier-app build   # tsc
pnpm --filter @contractor-ops/zapier-app test    # bundle test (zapier validate equivalent)
```

The bundle test runs the platform's own compile + schema-clean + validate pipeline (the
same routine `zapier validate` runs) and asserts every trigger maps to a real catalog
event, every action to a real write operationId, and the API-key header is wired.

## Submission (deferred)

Building + validating the app is done here; **publishing** to the Zapier marketplace is a
deferred external step and never blocks the build:

1. `zapier login` + `zapier register` under a Zapier **partner account**.
2. `zapier push` this app definition.
3. Submit for public-listing review (`integration.marketplace-zapier`, ~2–4 week review).

Tracked as an [`EXTERNAL-ENABLEMENT.md`](../../.planning/EXTERNAL-ENABLEMENT.md) register
row and by the `MarketplaceListing` dashboard. No submission runs in this package.
