---
title: Developer experience (marketplace + sandbox + status + portal)
type: domain
tags: [developer-experience, marketplace, sandbox, status-page, developer-portal, theme-c]
source_commit: efb2b079
verify_with:
  - packages/marketplace-manifests/
  - packages/api/src/services/sandbox-provisioning.ts
  - packages/api/src/services/status-aggregator.ts
  - packages/api/src/routers/core/incident.ts
  - packages/api/src/routers/core/marketplace-listing.ts
  - apps/public-api/src/routes/status.ts
  - apps/public-api/src/routes/docs.ts
  - apps/public-api/src/lib/portal-content.ts
updated: 2026-07-06
---

# Developer experience

The developer-facing surface over the public API (Theme C, the last v7.0 phase). Everything is
**generated from the OpenAPI spec + the webhook event catalog** and ships **dark behind default-off
`module.*` flags**; only marketplace submissions, public hostnames, and publish tokens are deferred
(see [`EXTERNAL-ENABLEMENT`](../../EXTERNAL-ENABLEMENT.md)).

## Free API sandbox tier (the load-bearing isolation)

A `co_test_` API key resolves ONLY to an `Organization.isSandbox` org; a `co_live_` key ONLY to a
non-sandbox org. `resolveByPrefix` (`api-key-service.ts`) **fails closed on any environment↔org
mismatch both directions**, so a sandbox key can never touch production data. Isolation REUSES the
shipped demo read-only layer: the request context carries `isSandbox`, so `isDemoContext`/`demoReadOnly`
block every sandbox mutation, and `isDemoOrg` also honors an in-process sandbox-org cache. Sandbox keys
gate on the global `module.api-sandbox` flag + a 100/day cap (`SANDBOX_DAILY_REQUEST_QUOTA`) INSTEAD of
Enterprise tier + per-org `module.public-api`. `provisionSandboxOrg` (`sandbox-provisioning.ts`) seeds a
fixture contractor; `apiKey.createSandboxKey` mints a read-only key.

## Public status page

`/v1/status.json` (`apps/public-api/src/routes/status.ts`, unauthenticated, behind
`module.public-status-page`, short-TTL cached) aggregates the SHIPPED health sources via
`status-aggregator.ts` into three coarse component states (`api` / `webhooks-dispatcher` /
`background-jobs`, each `operational|degraded|down`) + open-incident history. Every probe is
timeout-guarded + fail-safe. The payload carries **NO tenant data** (deep-scan invariant). Incidents are
operator-authored via the `IncidentReport` model + `incident` router.

## Developer portal

Extends the shipped Scalar `/v1/docs` reference with sibling pages (`/docs/webhooks`, `/sdks`,
`/recipes`, `/changelog`, `/deprecations`) + downloadable `/collections/{postman,insomnia}.json`, all
behind `module.developer-portal` (404 when off). Content is sourced from the same artifacts the API
generates (`portal-content.ts` renders the webhook event union, the Speakeasy SDK targets, the shipped
verifier snippets, the RFC-8594 version policy); collections generate from the live OpenAPI document.

## Marketplace listings

`@contractor-ops/marketplace-manifests` generates the Zapier/n8n/Make definitions + Postman/Insomnia
collections from the OpenAPI snapshot + the 16-event catalog (triggers → events, actions → write
operationIds). The `marketplaceListing` router + model track each listing's review state
(`admin:marketplace`-gated). Submission to each marketplace is a deferred external step.

## Agent mistakes to avoid

- Do NOT invent a bespoke "sandbox mode" — the isolation is the demo read-only reuse + the fail-closed
  prefix↔org check. A `co_test_` key resolving to a production org is a security failure.
- The status page must expose only coarse states + incidents — never a tenant id, per-org metric, or raw
  probe body.
- Marketplace/collection artifacts are GENERATED, never hand-authored — a drift-check keeps them honest.
