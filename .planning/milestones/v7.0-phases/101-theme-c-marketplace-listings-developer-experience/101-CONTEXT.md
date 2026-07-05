# Phase 101: Theme C — Marketplace Listings + Developer Experience - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 101 is the **developer-facing surface over the public API built in 98/99/100** — the last Theme C
phase. It makes Contractor Ops reachable from ~9,000 apps (three marketplace listings) and gives external
developers everything they need to integrate: a portal, collections, a status page, and a free sandbox. It
delivers ten locked requirements (INTEG-ZAPIER-01/-02, INTEG-N8N-01/-02, INTEG-MAKE-01, INTEG-MARKETPLACE-01,
INTEG-DX-01..04):

- **Marketplace listing artifacts, generated from the OpenAPI spec + webhook event catalog** — a Zapier app
  (8+ triggers mapped to the webhook event catalog, 6+ actions mapped to public-API write operationIds), a
  `@contractor-ops/n8n-nodes` community package, and a Make.com app blueprint. The *definitions* are
  GENERATED + VALIDATED now from `openapi.snapshot.json` (98-11) + `packages/validators/src/webhooks` (100);
  actual *submission/publication* to each marketplace is a deferred human step (partner accounts +
  review) — recorded in `EXTERNAL-ENABLEMENT.md`, never a build blocker (INTEG-ZAPIER-01, INTEG-N8N-01/-02,
  INTEG-MAKE-01).
- **Internal listing-status dashboard** — a `MarketplaceListing` model + staff router + web-vite admin
  surface tracking all three listings' review state (DRAFT → SUBMITTED → IN_REVIEW → LIVE / REJECTED / NEEDS_CHANGES),
  version pins, and last review feedback (INTEG-MARKETPLACE-01).
- **Developer portal (Scalar)** — extends the 98-06 `/docs` Scalar mount with the webhook event catalog, SDK
  install guides (the 98-11 `@contractor-ops/sdk` / `contractor-ops-sdk`), sample recipes
  (Zapier/n8n/Make + the TS/Python/Go/PHP webhook verifiers from 100), a changelog, and RFC-8594 deprecation
  notices (INTEG-DX-01).
- **Postman collection + Insomnia workspace** — generated artifacts from the SAME `openapi.snapshot.json`
  (no external dependency), CI diff-checked so they never drift from the spec (INTEG-DX-02).
- **Public status page** — reuses the shipped health-monitoring surface (`apps/api/src/routes/health.ts`
  public probes + `apps/cron-worker/src/health.ts` last-success-per-job + `cron-monitor.ts` Cronitor
  heartbeats + `job-health.ts` failure thresholds) behind a public `/status.json` aggregator + an
  `IncidentReport` model for incident history (INTEG-DX-03).
- **Free-forever sandbox tier** — `co_test_` API keys resolve to an **isolated sandbox organization** that
  is a demo org (no real side-effects), capped at 100 requests/day, that a fresh test org auto-seeds per
  developer signup. The sandbox key **must NEVER touch production data** — the load-bearing security control
  of the phase (INTEG-DX-04).

**Depends on:** Phase 98 (`build-openapi-doc.ts` + `build-openapi-snapshot.ts` + `.speakeasy/workflow.yaml`
+ the `/docs` Scalar mount + the `@contractor-ops/sdk` SDKs), Phase 99 (`OrganizationApiKey` + `co_live_`
prefix + `generateApiKey`/`resolveByPrefix` + `api-tier-limits.ts` + the Settings → Developer page +
`ApiKeyIpEvent`), Phase 100 (the webhook event catalog `packages/validators/src/webhooks/index.ts` + the
TS/Python/Go/PHP verifier docs + the delivery gauges + the write flag-flip that un-hides writes in the
snapshot). **Read `100-101-HANDOFF.md` if present** — 100-10 authors it (the event catalog + SDK-with-writes
+ verifiers feed the marketplace apps + portal; the delivery gauges feed the status page; the sandbox reuses
the dark-flag posture).

**NOT this phase:** any change to the public-API read/write endpoints, scopes, key auth, rate-limit
enforcement, or the webhook dispatcher (98/99/100 own those — Phase 101 CONSUMES the stable surface). The
actual marketplace *submissions* (Zapier/Make partner review, n8n npm publish enable) are deferred human/CI
steps, not build tasks.
</domain>

<decisions>
## Implementation Decisions

### D-01 (locked) — every marketplace + collection artifact is GENERATED from the OpenAPI snapshot; never hand-authored
`apps/public-api/scripts/build-openapi-snapshot.ts` (98-11) writes `openapi.snapshot.json` — the single
source of truth (writes hidden until the 100-09 flip, then present). Phase 101 adds ONE generator seam
(`packages/marketplace-manifests/`) that reads (a) `openapi.snapshot.json` for the write **actions**
(operationId → Zapier action / n8n node / Make module) and (b) `packages/validators/src/webhooks/index.ts`
for the **triggers** (the 16-event catalog → Zapier trigger / n8n trigger / Make instant trigger). The
Postman collection + Insomnia workspace are emitted by the same seam. A CI diff-check asserts the committed
artifacts equal a fresh generation (mirror 98-11's snapshot diff-check) so no artifact drifts from the spec.
**Rejected: hand-authoring per-platform definitions** — three hand-maintained trigger/action lists drift
from the API the day an endpoint changes.

### D-02 (locked) — the sandbox tier reuses the EXISTING demo read-only isolation; it is not a parallel mechanism
A `co_test_` key resolves to a sandbox `Organization` that is marked demo. The load-bearing isolation is the
already-shipped demo predicate (`packages/api/src/lib/demo.ts` `isDemoOrg` / `packages/api/src/middleware/
demo.ts` `demoReadOnly`): every real side-effect path (outbox dispatch `outbox/index.ts:415`, email
`app-email.ts`, ZATCA `zatca-submission.ts`, payouts) ALREADY skips for a demo org, and every mutation is
blocked unless `allowInDemo`. Phase 101 **widens the demo predicate to also honor a persistent
`Organization.isSandbox` marker** (env `DEMO_ORG_IDS` cannot scale to auto-seeded-per-signup orgs), so ALL
existing skips cover sandbox orgs with ZERO new isolation code. The sandbox key's authority is still its
tenant (`organizationId` from `resolveApiKey`) + scopes; the sandbox org holds only seeded fixture data.
**Rejected: a bespoke "sandbox mode" flag on the request** — it would re-implement isolation the demo layer
already enforces and risk a gap the demo path already closes.

### D-03 (locked) — sandbox keys are a NEW environment axis on the API key, minted only against sandbox orgs
`api-key-service.ts` today mints `co_live_<43-char>` only. Phase 101 adds an `environment` (`LIVE` |
`SANDBOX`) axis: `co_test_` prefix for sandbox, a `SANDBOX_DAILY_REQUEST_QUOTA = 100/day` limit (a NEW axis
in `api-tier-limits.ts`, keyed off the key environment, NOT `SubscriptionTier`), enforced by a per-day
counter mirroring the 99 `enforceApiTierQuota` monthly idiom (`api-quota-counter.ts`). A `co_test_` key can
be created ONLY against a sandbox org; `resolveByPrefix` refuses a `co_test_` key that resolves to a
non-sandbox org and refuses a `co_live_` key against a sandbox org (fail-closed both directions). This is the
technical spine of "a sandbox key must NEVER touch production data" (T-101-02-01).

### D-04 (locked) — the developer portal EXTENDS the 98 Scalar `/docs`, gated behind a NEW `module.developer-portal` flag
98-06 mounts `/docs` via `@scalar/hono-api-reference` `Scalar({ url:'/v1/openapi.json' })`. Phase 101 does
NOT replace it — it enriches it: the webhook event catalog page (rendered from `packages/validators/src/
webhooks`), SDK install guides, sample-recipe pages, a changelog, and deprecation notices, all behind a new
default-off `module.developer-portal` flag (ship-dark, sign-off-gated — mirror `module.public-api`). The
portal is buildable + testable now against the local spec; the public `developers.contractor-ops.{tld}`
hostname is a deploy-time DNS/Render step (deferred, EXTERNAL-ENABLEMENT), never a build blocker.

### D-05 (locked) — the status page reuses v2.0 health monitoring via a public aggregator + an IncidentReport model
No public status surface exists (the health routes are private/liveness-only: `apps/api/src/routes/health.ts`
trims its body for the network; `apps/cron-worker/src/health.ts` is bound to the private network). Phase 101
adds a public, unauthenticated, cached `/status.json` aggregator (in `apps/public-api`, outside
`apiKeyTenantProcedure`) that summarizes API uptime + webhook-dispatcher health from the EXISTING sources
(the health probes + `job-health.ts` `FAILURE_ALERT_THRESHOLD` + the delivery gauges) into coarse
`operational | degraded | down` component states — it exposes NO tenant data, NO raw probe internals. An
`IncidentReport` model (staff-authored) provides incident history. The status page front-end (in
`apps/landing`) renders `/status.json`. Behind a new default-off `module.public-status-page` flag.

### D-06 (locked) — the publishable packages ship BUILT + TESTED but publish-DARK (mirror the 98-11 SDK pipeline)
`@contractor-ops/n8n-nodes` (npm) and the Zapier app (Zapier CLI) build + pass their sandbox/bundle tests
now, but the publish/submit steps are disabled/dark jobs: the n8n npm publish needs `NPM_TOKEN` + a CI enable
(exactly like 98-11's Speakeasy SDK publish), the Zapier `zapier push`/submit needs a Zapier partner account,
the Make submission needs a Make partner account. All three are `EXTERNAL-ENABLEMENT.md` register rows. The
marketplace flags (`integration.marketplace-zapier` / `-n8n` / `-make`, already in the registry default-off,
sign-off-gated) gate any in-product surfacing of a listing as "live".

### Claude's Discretion
- Generator home: a dedicated `packages/marketplace-manifests/` (imports the snapshot + event catalog, emits
  all platform defs + collections) vs `apps/public-api/scripts/generate-*.ts` (lean: a package, so the n8n
  node package + the Zapier app + the collection scripts all import ONE typed generator, and the CI
  diff-check runs from it).
- Sandbox-org auto-seed trigger: a `provisionSandboxOrg()` service invoked (a) from a "Create sandbox key"
  action on the Developer page (buildable now) and (b) on external developer signup (the signup path itself
  is flag-gated/deferred — local-only app has no public dev signup yet).
- Sandbox seed data: a fixture set (a demo contractor / invoice / workflow) seeded into the sandbox org so
  read endpoints return realistic shapes; reuse the existing demo-seed fixtures if present.
- Status component granularity: `api`, `webhooks-dispatcher`, `background-jobs` as three components vs a
  single rollup (lean: three, each mapping to a real health source).
- Postman/Insomnia home: committed under `apps/public-api/collections/{postman,insomnia}.json` (served by the
  portal + CI-diff-checked) vs a `packages/` fixtures dir (lean: `apps/public-api/collections/`, linked from
  the portal + snapshot-diff-checked).
- Changelog + deprecation source: a committed `apps/public-api/CHANGELOG.md` + the RFC-8594 `Sunset` headers
  (98-05 `version-headers.ts`) surfaced as a portal page vs a DB model (lean: file-based; deprecations are
  low-frequency and version-controlled).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — INTEG-ZAPIER-01/-02 + INTEG-N8N-01/-02 + INTEG-MAKE-01 +
  INTEG-MARKETPLACE-01 (lines 195-200) + INTEG-DX-01..04 (204-207) verbatim.
- `.planning/ROADMAP.md` (Phase 101 entry, lines 590-604) — goal + 4 success criteria + the research flag
  (marketplace review timelines are external/non-deterministic — submit early, do NOT gate GA on approvals;
  n8n self-serve npm publish is the launch-day story; INTEG-ZAPIER-02 review iteration is a separate
  ongoing milestone).
- `.planning/EXTERNAL-ENABLEMENT.md` — the register + posture (external deps never block dev; default-off
  `module.*` flag + conditional-skip test + register row). Row #7 (Speakeasy SDK publish, dark CI job) is
  the template for the n8n-publish + Zapier/Make-submit rows this phase adds.
- `.../98-.../98-11-PLAN.md` (Speakeasy publish-dark pipeline — the template for the publishable-package
  dark posture) + `98-06-PLAN.md`/`98-06-SUMMARY.md` (the `/docs` Scalar mount + `build-openapi-doc.ts` +
  `build-openapi-snapshot.ts` the generators consume).
- `.../99-.../99-07-PLAN.md` (the Settings → Developer page the marketplace dashboard + sandbox-key UI
  extend) + `99-100-HANDOFF.md` (`api-tier-limits.ts`, `ApiKeyIpEvent`, the key model).
- `.../100-.../100-CONTEXT.md` + `100-RESEARCH.md` § B (the 16-event webhook catalog + the delivery
  contract the triggers map to) + `100-101-HANDOFF.md` (read if present).

### OpenAPI-spec reuse seam (the generation source — DO NOT rebuild)
- `apps/public-api/src/lib/build-openapi-doc.ts` — `buildOpenApiDocument(app)`: the single 3.1 doc builder
  (`getOpenAPI31Document`). **The portal + every generated artifact derive from its output.**
- `apps/public-api/scripts/build-openapi-snapshot.ts` — writes `openapi.snapshot.json` (98-11). **The
  marketplace + collection generators read THIS file, not the live app** (deterministic; writes present
  only after the 100-09 flip). CI diff-checks it.
- `apps/public-api/src/lib/version-headers.ts` (98-05) — the RFC-8594 `Sunset` header source the portal's
  deprecation page surfaces.
- `.speakeasy/workflow.yaml` (98-11) — the SDK targets (`@contractor-ops/sdk` npm / `contractor-ops-sdk`
  PyPI) the portal's install guides document.

### Webhook event catalog (the trigger source — Phase 100)
- `packages/validators/src/webhooks/index.ts` (100) — the 16-event `z.discriminatedUnion` (`contractor.*`,
  `invoice.*`, `payment_run.*`, `workflow.*`, `classification.outcome`, `compliance_doc.*`). **The
  marketplace TRIGGERS + the portal's event-catalog page are generated from this.**
- `apps/public-api/docs/webhooks/verifiers/{ts,py,go,php}` (100) — the sample verifiers the portal's
  recipe pages embed.

### Sandbox isolation reuse (the load-bearing control — DO NOT reinvent)
- `packages/api/src/lib/demo.ts` — `isDemoOrg` / `isGlobalDemo` / `resolveDemoOrgId`; the single predicate.
  **Widen it to honor `Organization.isSandbox` (D-02).**
- `packages/api/src/middleware/demo.ts` — `demoReadOnly` (mutation guard) + `isDemoContext`.
- `packages/api/src/services/outbox/index.ts:415` — the outbox already skips real dispatch for a demo org
  (`isDemoOrg(row.organizationId)`); email (`app-email.ts`), ZATCA (`zatca-submission.ts`) do the same.
  **Sandbox orgs inherit all of these for free once the predicate widens.**

### API key + tier limits (the sandbox environment axis)
- `packages/api/src/services/api-key-service.ts` — `KEY_PREFIX='co_live_'` (:11), `generateApiKey()` (:50),
  `resolveByPrefix` (:116). **Add the `co_test_` environment axis + the fail-closed sandbox↔org check (D-03).**
- `packages/db/prisma/schema/api-key.prisma` — `OrganizationApiKey` (add `environment`); the sandbox org
  needs `Organization.isSandbox`.
- `packages/api/src/lib/api-tier-limits.ts` — `TIER_MONTHLY_REQUEST_QUOTA` / `TIER_WEBHOOK_SUBSCRIPTION_CAP`.
  **Add `SANDBOX_DAILY_REQUEST_QUOTA = 100`.**
- `packages/api/src/middleware/api-tier-quota.ts` + `services/api-quota-counter.ts` — the monthly-quota
  counter idiom to mirror for the per-day sandbox counter.
- `packages/api/src/routers/core/api-key.ts` — the key CRUD router (add sandbox-key create + the
  `provisionSandboxOrg` action).

### Health / status reuse (the status page source — Phase 101 wraps, does not rebuild)
- `apps/api/src/routes/health.ts` — public liveness probes (`health.degraded`; body trimmed for the network).
- `apps/cron-worker/src/health.ts` — per-job last-success timestamps (private-network liveness).
- `apps/cron-worker/src/jobs/handlers/job-health.ts` — `FAILURE_ALERT_THRESHOLD` + pending/failure counts
  (the webhook-dispatcher health input).
- `packages/api/src/services/cron-monitor.ts` — Cronitor heartbeats (run/complete/fail) per job.

### Flags (add three; three marketplace flags already exist)
- `packages/feature-flags/src/flags-core.ts:287-313` — `integration.marketplace-zapier` / `-n8n` / `-make`
  (ALREADY exist, default false, sign-off-gated). **Add `module.developer-portal`, `module.public-status-page`,
  `module.api-sandbox` (default false; the sandbox flag gates external self-serve key issuance).**
- `packages/feature-flags/src/signoff-registry-flags.ts:73-77` — `module.public-api`, `integration.marketplace-`
  reserved prefixes. **Add the three new module flags to the sign-off cohort if gated.**

### web-vite Developer page (extend — the marketplace dashboard + sandbox-key surface)
- `apps/web-vite/src/components/settings/api-keys-tab.tsx` + `api-keys/` + `hooks/use-api-keys-tab.ts` (99-07)
  — the container+hooks CRUD the sandbox-key create + the Marketplace sub-tab mirror (loading/empty/error,
  i18next en/de/pl/ar-RTL) per `apps/web-vite/ARCHITECTURE.md`.

### Documentation-follows-code (same change set — 101-10)
- Update `.planning/brain/wiki/domains/public-api-surface.md` + `wiki/integrations/_index.md`; NEW
  `wiki/integrations/{zapier,n8n,make}.md` + `wiki/domains/developer-experience.md`; update `structure/
  {packages,api-routers-catalog,key-services,prisma-schema-areas}.md`, `patterns/feature-flags.md`,
  `log.md` + `hot.md`; `.planning/MEMORY.md`; `.planning/EXTERNAL-ENABLEMENT.md` (the submit/publish rows);
  `pnpm check:wiki-brain`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`openapi.snapshot.json` + `build-openapi-doc.ts`** (98) — the single generation source for every
  marketplace + collection artifact; CI-diff-checked so nothing drifts.
- **The webhook event catalog** (`packages/validators/src/webhooks`, 100) — the trigger source for all three
  marketplaces + the portal's event-catalog page.
- **The demo read-only isolation** (`demo.ts` + `demoReadOnly` + the outbox/email/ZATCA skips) — the sandbox
  tier's entire isolation, reused by widening the predicate to `Organization.isSandbox`.
- **The 98 Scalar `/docs` mount** — the developer portal extends it (webhook catalog + SDK guides + recipes +
  changelog + deprecations), not a new portal.
- **`api-tier-limits.ts` + `api-quota-counter.ts` + `api-key-service.ts`** — the sandbox environment axis +
  100/day counter slot onto the existing per-tier quota machinery.
- **The shipped health surface** (`health.ts` + `cron-worker/health.ts` + `job-health.ts` + `cron-monitor.ts`)
  — the status page aggregates these; no new monitoring stack.
- **The 98-11 Speakeasy publish-dark pipeline** — the template for the n8n-npm-publish + Zapier/Make-submit
  dark posture (build + test now, publish behind a token/partner-account register row).
- **The three `integration.marketplace-*` flags** — already in the registry, default off, sign-off-gated.

### Established Patterns
- Generate artifacts from one source + CI-diff-check the committed output (98-11 snapshot pattern).
- Ship-dark behind a `module.*` flag; the isolation control (demo read-only) is a hard reuse, not a deferral.
- Publishable packages build + test now; publish/submit is a dark CI job / register row (98-11).
- web-vite container+hooks; the hook is the only tRPC boundary; loading/empty/error mandatory.
- Every external/manual dependency → default-off flag + conditional-skip test + EXTERNAL-ENABLEMENT row.

### Integration Points
- New `packages/marketplace-manifests/` generator (reads the snapshot + event catalog).
- New `packages/n8n-nodes/` (`@contractor-ops/n8n-nodes`) + a Zapier app dir + a Make blueprint.
- New `MarketplaceListing` + `IncidentReport` Prisma models (one migration) + `Organization.isSandbox` +
  `OrganizationApiKey.environment`.
- `api-key-service.ts` + `api-tier-limits.ts` + `demo.ts` widen for the sandbox axis.
- `apps/public-api` gains `/status.json` + the enriched portal pages + `collections/`.
- `apps/landing` gains the public status page; `apps/web-vite` Settings → Developer gains the Marketplace
  dashboard + sandbox-key surface.
- Three new `module.*` flags; three `integration.marketplace-*` flags consumed.
</code_context>

<specifics>
## Specific Ideas
- **The OpenAPI snapshot is the single source of truth** — Zapier actions, n8n nodes, Make modules, Postman,
  Insomnia all derive from it; a CI diff-check makes drift impossible.
- **Sandbox isolation is a REUSE, not a rebuild** — a `co_test_` key → a sandbox org marked demo → every
  real side-effect already skips. The one new invariant: mint sandbox keys ONLY against sandbox orgs,
  fail-closed both ways.
- **Everything is buildable + testable now behind default-off flags** — only the marketplace SUBMISSIONS
  (partner accounts) + the public hostnames (DNS) + the npm/publish tokens are deferred.
- **The status page exposes NO tenant data** — it aggregates the existing coarse health signals into
  `operational | degraded | down` components; it never proxies a raw probe or a per-org metric.
</specifics>

<deferred>
## Deferred Ideas
- **Zapier public-listing submission + review iteration** (INTEG-ZAPIER-02) → the app builds + passes its
  sandbox bundle test now; submission needs a Zapier partner account + a 2–4wk review, tracked as a separate
  ongoing milestone (EXTERNAL-ENABLEMENT row).
- **Make.com App Directory submission** (INTEG-MAKE-01) → blueprint generated + validated now; submission
  needs a Make partner account + a 1–2wk review (EXTERNAL-ENABLEMENT row).
- **n8n npm publish** (INTEG-N8N-01) → the package builds + tests now; the `npm publish` needs `NPM_TOKEN`
  + a CI enable (dark job, mirror 98-11).
- **Public hostnames** — `developers.contractor-ops.{tld}` (portal) + `status.contractor-ops.{tld}` (status
  page) → deploy-time DNS/Render steps; the surfaces run behind their flags locally now.
- **External developer self-serve signup → auto-seed sandbox org** → the `provisionSandboxOrg()` service is
  buildable + invocable now (from the Developer page); the public signup wiring is flag-gated/deferred
  (local-only app has no external dev signup yet).

None expand the phase scope — discussion stayed within INTEG-ZAPIER/N8N/MAKE/MARKETPLACE-01 + INTEG-DX-01..04.

---

*Phase: 101-theme-c-marketplace-listings-developer-experience*
*Context gathered: 2026-07-05*
