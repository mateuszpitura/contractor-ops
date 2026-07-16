---
phase: 101-theme-c-marketplace-listings-developer-experience
plan: 06
subsystem: integrations
tags: [n8n, marketplace, community-node, webhooks, public-api, publish-dark]

# Dependency graph
requires:
  - phase: 101-03
    provides: "@contractor-ops/marketplace-manifests generateN8n (node/trigger/credential descriptor generated from the OpenAPI snapshot + the 16-event webhook catalog)"
  - phase: 100
    provides: "WEBHOOK_EVENT_TYPES — the 16-event catalog the trigger node subscribes to"
  - phase: 99
    provides: "co_live_/co_test_ API keys + Authorization: Bearer scheme the credential injects"
provides:
  - "@contractor-ops/n8n-nodes — a community-installable n8n node package (regular node + webhook trigger + apiKey credential) built from the generated descriptions"
  - "Three importable example workflows: invoice->Slack, contractor-onboard-from-Personio, compliance-expiry->PagerDuty"
  - "A DARK npm-publish CI job (publish-n8n-nodes.yml) — workflow_dispatch only, NPM_TOKEN-gated no-op until enabled"
affects: [101-10, marketplace-listings, developer-portal]

# Tech tracking
tech-stack:
  added: ["n8n-workflow@2.16.0 (dev + peer; n8n node/credential type contract)"]
  patterns:
    - "n8n community node surface GENERATED from marketplace-manifests (never hand-authored) — mirrors the Zapier/Make surface"
    - "Publishable package builds + tests now; npm publish is a dark workflow_dispatch job gated on NPM_TOKEN (mirror Speakeasy SDK posture)"

key-files:
  created:
    - packages/n8n-nodes/package.json
    - packages/n8n-nodes/src/generated.ts
    - packages/n8n-nodes/src/descriptions.ts
    - packages/n8n-nodes/src/credentials/ContractorOpsApi.credentials.ts
    - packages/n8n-nodes/src/nodes/ContractorOps/ContractorOps.node.ts
    - packages/n8n-nodes/src/nodes/ContractorOpsTrigger/ContractorOpsTrigger.node.ts
    - packages/n8n-nodes/src/__tests__/nodes.test.ts
    - packages/n8n-nodes/src/__tests__/workflows.test.ts
    - packages/n8n-nodes/workflows/invoice-to-slack.json
    - packages/n8n-nodes/workflows/contractor-onboard-from-personio.json
    - packages/n8n-nodes/workflows/compliance-expiry-to-pagerduty.json
    - packages/n8n-nodes/README.md
    - .github/workflows/publish-n8n-nodes.yml
  modified:
    - pnpm-lock.yaml

key-decisions:
  - "Node operations + trigger events derive from generateN8n at module load — the node cannot drift from the API"
  - "Pin n8n-workflow to exact 2.16.0 (the `latest` npm tag, 100 days old) — comfortably past the 7-day release-age floor; declared dev (build/test) + peer (host-provided at runtime)"
  - "The trigger is a MANUAL webhook node (n8n generates the URL, the user registers it in Contractor Ops Settings) — no public /v1/webhooks REST management route exists in the snapshot, so nothing is hardcoded to a guessed endpoint"
  - "Publish is DARK: workflow_dispatch only, NPM_TOKEN-guarded no-op, dry_run defaults true"

patterns-established:
  - "Seam test imports the REAL generator + REAL event catalog (no mocks) and asserts every node option maps to a generated write op / catalog event"
  - "Example workflows are wired: a test asserts each references this package's node types and subscribes only to real catalog events"

requirements-completed: [INTEG-N8N-01, INTEG-N8N-02]

# Metrics
duration: 37min
completed: 2026-07-16
---

# Phase 101 Plan 06: n8n community node package Summary

**`@contractor-ops/n8n-nodes` is a build-verified, community-installable n8n package whose regular node (write actions), webhook trigger (16-event catalog), and apiKey credential are all generated from the marketplace-manifests surface — shipping three importable example workflows + docs, with the npm publish deferred behind a dark, token-gated CI dispatch.**

## Performance

- **Duration:** ~37 min
- **Started:** 2026-07-16T23:00 (approx, local)
- **Completed:** 2026-07-16T23:37 (local)
- **Tasks:** 2 completed
- **Files created/modified:** 17 (16 created, 1 modified)

## Accomplishments
- A community n8n node package (`n8n.nodes` + `n8n.credentials` contract + `n8n-community-node-package` keyword) that builds (`tsc`) and loads the two nodes + credential without error.
- The node/trigger/credential surface is imported from `generateN8n` (101-03) — the write actions come from the OpenAPI snapshot's write ops, the trigger events from the compiled-in `WEBHOOK_EVENT_TYPES`; it mirrors the Zapier/Make surface and cannot drift.
- Three valid, importable n8n workflow exports (invoice->Slack, contractor-onboard-from-Personio, compliance-expiry->PagerDuty) + a README (install / auth / node usage / recipes).
- A DARK npm-publish job (`publish-n8n-nodes.yml`) — `workflow_dispatch` only, NPM_TOKEN-gated, dry-run by default; the package builds + tests on every run but publishes nothing until enabled.
- 23 tests green (12 node/credential seam + 11 workflow consistency).

## Task Commits

Each task was committed atomically:

1. **Task 1: the n8n node package (nodes + credential from the generated descriptions)** — `b68054d58` (feat)
2. **Task 2: example workflows + README + the DARK npm-publish job** — `57c985d98` (feat)

## Files Created/Modified
- `packages/n8n-nodes/package.json` — the community package manifest (`n8n.nodes`/`credentials`, `n8n-community-node-package` keyword, `publishConfig.access=public`, `n8n-workflow` dev+peer).
- `packages/n8n-nodes/src/generated.ts` — loads the OpenAPI snapshot (or an empty pre-flip spec) + `WEBHOOK_EVENT_TYPES` and builds the `N8nDescriptor` via `generateN8n`.
- `packages/n8n-nodes/src/descriptions.ts` — pure builders turning the descriptor into n8n property lists + the `Authorization: Bearer` auth.
- `packages/n8n-nodes/src/credentials/ContractorOpsApi.credentials.ts` — the apiKey credential (masked key + base URL + credential test).
- `packages/n8n-nodes/src/nodes/ContractorOps/ContractorOps.node.ts` — the regular node; one operation per generated write op; `execute` sends the authenticated request.
- `packages/n8n-nodes/src/nodes/ContractorOpsTrigger/ContractorOpsTrigger.node.ts` — the manual webhook trigger; the 16 catalog events; `webhook()` filters deliveries by the selected event `type`.
- `packages/n8n-nodes/src/__tests__/{nodes,workflows}.test.ts` — seam + workflow-consistency suites.
- `packages/n8n-nodes/workflows/*.json` — the three example workflow exports.
- `packages/n8n-nodes/README.md` — install / auth / usage / recipes / dark-publish note.
- `.github/workflows/publish-n8n-nodes.yml` — the dark npm publish job.
- `pnpm-lock.yaml` — the `n8n-workflow@2.16.0` addition.

## Decisions Made
- **Generated, not hand-authored (Shield S1):** the node imports `generateN8n`; the operation list and trigger events are the generated surface. A seam test (Shield S2) imports the real generator + real `WEBHOOK_EVENT_TYPES` (no mocks) and asserts the 1:1 mapping.
- **n8n-workflow@2.16.0 exact pin:** the `latest` npm dist-tag (100 days old), well past the 7-day floor. Declared as a `devDependency` (build/test) and a `peerDependency` (the n8n host supplies it at runtime), so the published artifact does not bundle it or its transitive deps.
- **Manual webhook trigger:** no public `/v1/webhooks` REST management route exists in the current snapshot, so the trigger generates a URL the user registers in Contractor Ops Settings rather than hardcoding a guessed endpoint.
- **Pre-flip posture:** while the public write routes are hidden, the snapshot is absent, so the regular node has zero write actions (asserted in tests); the trigger always exposes all 16 events. Operations populate automatically once the snapshot is regenerated with writes.
- **Publish is DARK:** `workflow_dispatch` only, NPM_TOKEN-guarded no-op, `dry_run` defaults true.

## Security / Supply Chain (T-101-06-01..03)
- **T-101-06-01 (dep supply chain):** `n8n-workflow` is the exact official package (`github.com/n8n-io/n8n`, maintainer `jan_n8n_io`) — typosquat-clear. Pinned exact 2.16.0 under the strict `minimumReleaseAge` gate. `pnpm audit` surfaces transitive `lodash` (high/moderate) and `form-data` (high) advisories **via n8n-workflow** — these classes **pre-exist** in the tree (multiple `lodash`/`form-data` versions already installed from other packages), are **not net-new**, and are **peer-scoped** (not bundled in the published `dist`, provided by the n8n host at runtime). No `console.*` in source.
- **T-101-06-02 (accidental publish):** dark `workflow_dispatch` job, NPM_TOKEN-gated, never on push; `dry_run` defaults true — three independent guards.
- **T-101-06-03 (embedded secret):** auth is the user-supplied apiKey credential; no secret in the package.

## Deviations from Plan

### Auto-fixed / adjusted

1. **[Rule 3 - Blocking] `N8nOperation`/`N8nDescriptor` not re-exported from marketplace-manifests**
   - **Found during:** Task 1 build (TS2459).
   - **Fix:** derived `N8nOperation` via indexed access and re-exported `N8nDescriptor` from `generated.ts` — kept the change inside this package rather than editing the 101-03 package.
   - **Commit:** `b68054d58`.

2. **[Rule 2 - Correctness] Added `workflows.test.ts`**
   - Task 2's plan named the three workflows + README + yml; I added a consistency test so the examples cannot drift from the node types / catalog events (Shield S1). Not in the plan `files` list but strengthens the verify.
   - **Commit:** `57c985d98`.

### Out of scope (not committed)
- `packages/validators/src/legal/de.{js,d.ts}` showed as modified after `pnpm build` (pure `tsc` reformatting churn of committed build-output files in `src/`). Unrelated to this plan — left unstaged.

## Known Stubs / Deferred
- **npm publish (INTEG-N8N-01 enable):** deferred. Register row #32 in `.planning/EXTERNAL-ENABLEMENT.md` already covers it. Concrete enable steps for 101-10:
  1. Add the `NPM_TOKEN` repository secret (npm automation token with publish rights to the `@contractor-ops` scope).
  2. Create the `npm-publish` GitHub environment with required reviewers.
  3. Dispatch `publish-n8n-nodes.yml` with `dry_run: false`.
- **Published-artifact self-containment (publish-time follow-up):** the package depends on `@contractor-ops/marketplace-manifests` + `@contractor-ops/validators` via `workspace:*`; those are private and not on npm. Before the real publish, either bundle the generated descriptor at build time or publish those deps. Not a blocker for the build/test-now + dark-publish posture.
- **Wiki (documentation-follows-code):** the phase batches all wiki updates (`integrations/n8n.md`, `structure/packages.md`, etc.) into plan **101-10** per `101-CONTEXT.md` canonical_refs — deferred there by design.

## Shield Verdict
- **Patterns:** S1 (Wired — node surface derives from `generateN8n`, verified by seam test) PASS; S2 (unmocked seam test — real generator + real `WEBHOOK_EVENT_TYPES`) PASS.
- **Seams tested:** `packages/n8n-nodes/src/__tests__/nodes.test.ts` (generator -> node/trigger/credential), `workflows.test.ts` (examples -> node types + catalog events).
- **Verify run:** `pnpm --filter @contractor-ops/n8n-nodes build` (green), `test` (23/23 green), `typecheck` (clean), `lint` (clean), `pnpm audit` (transitive-via-n8n-workflow, pre-existing classes).
- **Residual risk:** published-artifact `workspace:*` deps + npm publish are the sole deferred, documented steps (dark posture); no runtime tenant/money/status seams touched.

## Self-Check: PASSED
- All 14 checked created files present (13 source/config + SUMMARY).
- Both task commits present in git (`b68054d58`, `57c985d98`).
- `build` + `typecheck` + `lint` clean; `test` 23/23 green; workflows parse as valid n8n JSON; publish job is dark (`workflow_dispatch`, no `push`).
