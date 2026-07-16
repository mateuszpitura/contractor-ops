# @contractor-ops/n8n-nodes

Community [n8n](https://n8n.io) nodes for **Contractor Ops** — surface the public
REST API as n8n **actions** (write operations) and a **webhook trigger** (the
16-event catalog), so you can wire contractor onboarding, invoicing, payments,
and compliance into any of n8n's 400+ integrations with no code.

The node surface is **generated** from the Contractor Ops OpenAPI snapshot + the
webhook event catalog (`@contractor-ops/marketplace-manifests`) — it mirrors the
Zapier and Make apps and never drifts from the API.

## What's in the package

| Item | n8n type | Purpose |
| --- | --- | --- |
| **Contractor Ops** | `@contractor-ops/n8n-nodes.contractorOps` | Regular node — performs a write action (create contractor, create/approve invoice, …) |
| **Contractor Ops Trigger** | `@contractor-ops/n8n-nodes.contractorOpsTrigger` | Webhook trigger — starts a workflow on a subscribed Contractor Ops event |
| **Contractor Ops API** | `contractorOpsApi` credential | Your API key (`co_live_…` / `co_test_…`) |

## Install

In self-hosted n8n:

1. Open **Settings → Community Nodes → Install**.
2. Enter the npm package name **`@contractor-ops/n8n-nodes`** and confirm.
3. After install, the **Contractor Ops** and **Contractor Ops Trigger** nodes
   appear in the node panel.

> Community-node install requires `N8N_COMMUNITY_PACKAGES_ENABLED=true` (the
> default on most self-hosted deployments). n8n Cloud users can request the node
> through the verified-community process.

## Authenticate

Create a **Contractor Ops API** credential:

1. In Contractor Ops, go to **Settings → Developers → API keys** and create a key.
   - Use a **`co_live_…`** key for production.
   - Use a **`co_test_…`** key for the free **sandbox** — sandbox keys resolve to
     an isolated demo organization and never touch production data.
2. In n8n, add a **Contractor Ops API** credential and paste the key.
3. Leave **Base URL** as the default (`https://api.contractor-ops.com/v1`) unless
   you target a regional or self-hosted endpoint.

The credential authenticates every request as `Authorization: Bearer <key>`.

## Use the nodes

### Contractor Ops (actions)

Pick an **Operation** (a write action mapped from a public-API `operationId`),
then supply:

- **Path Parameters** — a JSON object filling any `{placeholder}` in the path
  (e.g. `{ "id": "inv_123" }`).
- **Body** — the JSON request payload.

> The available operations are generated from the OpenAPI snapshot. While the
> public **write** routes are still gated, the action list is empty and the node
> is trigger-only; it populates automatically once the write routes are live and
> the snapshot is regenerated.

### Contractor Ops Trigger (events)

1. Select one or more **Events** (from the 16-event catalog — `contractor.*`,
   `invoice.*`, `payment_run.*`, `workflow.*`, `classification.outcome`,
   `compliance_doc.*`).
2. Activate the workflow and copy the **Production URL** n8n generates.
3. In Contractor Ops (**Settings → Developers → Webhooks**), register that URL as
   a webhook endpoint subscribed to the same events.

Deliveries are HMAC-signed (`X-CO-Signature`); the trigger forwards each event
whose `type` matches your selection.

## Example workflows

Import any of these from `workflows/` (**Workflows → Import from File**):

| File | Recipe |
| --- | --- |
| `invoice-to-slack.json` | Post approved / paid invoices to a Slack channel |
| `contractor-onboard-from-personio.json` | Create a Contractor Ops contractor from a Personio "employee created" webhook |
| `compliance-expiry-to-pagerduty.json` | Open a PagerDuty incident when a compliance document is expiring or expired |

Each example ships **inactive** with placeholder credentials — connect your
Contractor Ops, Slack, Personio, and PagerDuty accounts after import.

## Publishing

This package is published to npm **only** through a deliberate, token-gated CI
dispatch (`.github/workflows/publish-n8n-nodes.yml`, `workflow_dispatch`, guarded
on `NPM_TOKEN`). It is never published on merge. See the repository's
`EXTERNAL-ENABLEMENT.md` for the enable steps.

## License

MIT
