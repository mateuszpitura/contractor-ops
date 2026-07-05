# Phase 101 — Research: Marketplace Listings + Developer Experience

**Compiled:** 2026-07-05 · Grounded in the live tree (paths + line numbers verified) + the 98/99/100 plans.

This phase is **low-novelty, high-surface-area**: nothing here is a new security primitive. The two
load-bearing concerns are (1) **sandbox isolation** — a `co_test_` key must never touch production data,
solved by REUSING the shipped demo read-only layer (A1), and (2) **artifact drift** — every marketplace +
collection artifact GENERATES from the one OpenAPI snapshot with a CI diff-check so it cannot drift from the
API (A2). Everything else is assembly onto proven 98/99/100 seams + the flag-defer posture for the external
marketplace submissions (A7).

---

## A. Assumptions & Seams (decisions the executor must not re-litigate)

### A1 — sandbox isolation is a REUSE of the demo read-only layer, widened to a persistent org marker (THE control)
The sandbox tier's "no real writes / never touch production data" requirement is ALREADY solved for demo
orgs: `packages/api/src/lib/demo.ts` `isDemoOrg` is the single predicate behind (a) the `demoReadOnly`
tRPC mutation guard (`middleware/demo.ts:26` — blocks any `mutation` without `allowInDemo`) and (b) the
service-layer outbound skips — `outbox/index.ts:415` (no real webhooks/email/notifications), `app-email.ts`
(no real email), `zatca-submission.ts` (no real ZATCA), and payout skips. Today the predicate is
**env-controlled only** (`DEMO_MODE` / `DEMO_ORG_IDS`), which cannot express "a fresh sandbox org
auto-seeded per developer signup."

**Decision:** add a persistent `Organization.isSandbox Boolean @default(false)` column and widen the
predicate so `isDemoOrg(orgId)` (and `isDemoContext`) returns true for a sandbox org. This is the ONLY
isolation code the phase writes — every existing skip then covers sandbox orgs for free. A sandbox key
maps to a sandbox org via the ordinary tenant resolution (`resolveApiKey` → `organizationId`), so RLS +
tenant scoping already fence it to its own seeded data.

**Do NOT** build a parallel "sandbox mode" request flag or a second read-only enforcement path — that risks
a gap the demo layer already closes and forks the isolation logic.

### A2 — every marketplace + collection artifact GENERATES from `openapi.snapshot.json`; a CI diff-check kills drift
`apps/public-api/scripts/build-openapi-snapshot.ts` (98-11) emits `openapi.snapshot.json` from
`buildOpenApiDocument(app)` (`apps/public-api/src/lib/build-openapi-doc.ts`) and CI diff-checks the committed
snapshot (98-11 `must_haves`). Phase 101 adds ONE generator package `packages/marketplace-manifests/` that:

- reads `openapi.snapshot.json` for the **write actions** — each write `operationId`
  (`createContractor`, `createInvoice`, `approveInvoice`, `markPaymentPaid`, `createWorkflowTask`,
  `lookupContractorByTaxId`, …) → a Zapier action / n8n operation / Make module (INTEG-ZAPIER-01's "6+
  actions" is the count of exposed write operationIds after the 100-09 flip);
- reads `packages/validators/src/webhooks/index.ts` (100) for the **triggers** — each of the 16 catalog
  events → a Zapier trigger / n8n trigger / Make instant trigger (INTEG-ZAPIER-01's "8+ triggers");
- emits, from those two inputs: the Zapier app definition modules, the n8n node descriptions, the Make
  blueprint JSON, the Postman collection, and the Insomnia workspace.

A CI diff-check (`generate --check`, mirror the snapshot diff-check) asserts every committed artifact equals
a fresh generation. **If the snapshot has zero write ops (pre-100-09 flip), the generator emits triggers +
read actions only and the action-count assertion is conditional** — the write actions appear once the flip
lands (documented so an executor running before 100-09 does not treat the empty write set as a failure).

### A3 — the developer portal EXTENDS the 98 Scalar `/docs`; new pages hang off the same mount
98-06 mounts `app.get('/docs', Scalar({ url:'/v1/openapi.json' }))`. Phase 101 adds sibling routes under the
same host, gated behind `module.developer-portal` (new, default off):

- `/docs/webhooks` — the event catalog, rendered from `packages/validators/src/webhooks` (16 events + the
  `X-CO-Signature` contract + the 5-min replay window from 100).
- `/docs/sdks` — install guides for `@contractor-ops/sdk` (npm) + `contractor-ops-sdk` (PyPI) from
  `.speakeasy/workflow.yaml`.
- `/docs/recipes` — sample apps: the Zapier/n8n/Make recipes + the TS/Python/Go/PHP verifier snippets
  (`apps/public-api/docs/webhooks/verifiers/*`, 100).
- `/docs/changelog` + `/docs/deprecations` — a committed `CHANGELOG.md` + the RFC-8594 `Sunset` headers
  (98-05 `version-headers.ts`).
- `/collections/postman.json` + `/collections/insomnia.json` — the generated collections, downloadable.

The portal is a static/SSR content surface — no tenant data, no auth. The public
`developers.contractor-ops.{tld}` hostname is a deploy-time DNS step (EXTERNAL-ENABLEMENT), not a build gate.

### A4 — the status page is a public aggregator over the EXISTING health sources + an IncidentReport model
No public status surface exists (`apps/api/src/routes/health.ts` trims its body for the network;
`apps/cron-worker/src/health.ts` is private-network-only). Build a public, unauthenticated, short-cached
`/status.json` endpoint (in `apps/public-api`, OUTSIDE `apiKeyTenantProcedure`) that maps the existing
signals into coarse component states:

| Component | Source | State rule |
|-----------|--------|-----------|
| `api` | `apps/api/src/routes/health.ts` probes | all probes ok → operational; any degraded → degraded; unreachable → down |
| `webhooks-dispatcher` | `job-health.ts` pending/failure counts + the 100 delivery gauges | `recentFailureCount ≤ FAILURE_ALERT_THRESHOLD && pending ≤ 100` → operational |
| `background-jobs` | `cron-worker/health.ts` last-success-per-job + `cron-monitor.ts` heartbeats | last-success within the job's expected interval → operational |

`IncidentReport` (staff-authored: `title`, `status OPEN|MONITORING|RESOLVED`, `severity`, `startedAt`,
`resolvedAt?`, `updates Json[]`) provides incident history. The endpoint exposes **no tenant data, no raw
probe internals, no per-org metric** — only the three component states + open incidents. Front-end in
`apps/landing` renders `/status.json`. Behind `module.public-status-page` (new, default off).

### A5 — the sandbox environment axis on the API key (co_test_) — fail-closed both directions
`api-key-service.ts` mints `co_live_<43-char-base64url>` only (`KEY_PREFIX='co_live_'`, :11). Add:

- `OrganizationApiKey.environment` (`LIVE | SANDBOX`, default `LIVE`); `generateApiKey({ environment })`
  uses `co_test_` for sandbox.
- `resolveByPrefix` classifies by prefix and **fails closed**: a `co_test_` key that resolves to a
  non-sandbox org is rejected; a `co_live_` key against a sandbox org is rejected. This is the technical
  enforcement of "a sandbox key must never touch production data" — the org boundary is the fence, the
  prefix↔org check is the assertion that the fence is intact.
- `SANDBOX_DAILY_REQUEST_QUOTA = 100` in `api-tier-limits.ts`; a per-day counter mirroring
  `services/api-quota-counter.ts` (`incrementMonthlyRequestCount` → a `incrementDailyRequestCount` keyed
  `{orgId}:{YYYYMMDD}`), enforced in a middleware mirroring `api-tier-quota.ts` when the key environment is
  SANDBOX. Over-limit → 429.
- Sandbox keys are minted against a sandbox org from `provisionSandboxOrg()` (seeds fixture data + sets
  `isSandbox`), invoked from the Developer page ("Create sandbox key") and, deferred, from external signup.

### A6 — the publishable packages build + test now but publish/submit DARK (mirror 98-11)
- `@contractor-ops/n8n-nodes` (`packages/n8n-nodes/`) — a community node package whose nodes import the
  generated descriptions (A2). It builds (`tsc`) + passes node-definition tests now; the `npm publish` is a
  DARK CI job needing `NPM_TOKEN` (EXTERNAL-ENABLEMENT row, mirror 98-11 SDK publish). n8n community-nodes
  install is self-serve once published — no external review (the launch-day integration story).
- Zapier app (`packages/zapier-app/` or an `integrations/zapier/` dir) — the Zapier CLI app (auth: API key
  header, optionally OAuth 2.0; 8+ triggers, 6+ actions from the generator). It passes the Zapier
  `validate` / sandbox bundle test now; `zapier push` + public-listing submission needs a Zapier partner
  account (deferred, EXTERNAL-ENABLEMENT; INTEG-ZAPIER-02).
- Make app — the blueprint JSON (generated) + a submission checklist; App Directory submission needs a Make
  partner account (deferred).

New third-party dev-dependencies (`zapier-platform-core`, `n8n-workflow`, the Zapier/n8n test harnesses)
fall under the **7-day release-age** rule (`.npmrc min-release-age=7`) — pin versions ≥7 days old,
`pnpm audit` + typosquat-check after add, `pnpm security:scan`. If a package cannot be pinned ≥7 days old,
defer that platform's package to a follow-up (do NOT bypass the age floor).

### A7 — marketplace SUBMISSIONS are external/non-deterministic — never gate GA on them (the flag-defer spine)
Per the ROADMAP research flag + `EXTERNAL-ENABLEMENT.md`: Zapier review is 2–4wk, Make 1–2wk, and each
needs a partner account the founder does not yet have. The BUILD (definitions, bundle tests, collections,
dashboard, portal, status page, sandbox) completes now; the SUBMIT/PUBLISH is a register row + a dark CI job
+ a `MarketplaceListing` row an operator advances. The three `integration.marketplace-*` flags
(already in the registry, default off, sign-off-gated) gate any in-product "this listing is live" surfacing.
INTEG-ZAPIER-02 (submission + review iteration) is explicitly a separate ongoing milestone — it is NOT a
Phase-101 build task; it is a register row + the dashboard state machine that tracks it.

---

## B. Listing-manifest shapes (the generated artifacts)

### Zapier app (INTEG-ZAPIER-01)
```
authentication: { type: 'custom', fields: [{ key: 'apiKey', label: 'API key (co_live_… or co_test_…)' }] }
  // header X-Api-Key / Authorization: Bearer; optional OAuth 2.0 authorizationCode variant
triggers:   // 8+, generated from packages/validators/src/webhooks (subscribe via webhooks:manage)
  invoice.received | invoice.approved | invoice.paid | contractor.created | contractor.offboarded |
  contractor.compliance_blocked | payment_run.completed | compliance_doc.expiring_soon | ...
actions:    // 6+, generated from the write operationIds in openapi.snapshot.json (post-100-09 flip)
  create_contractor | create_invoice | approve_invoice | mark_payment_paid | create_workflow_task |
  lookup_contractor_by_tax_id
```
Bundle/sandbox test: `zapier test` against the app definition (mock API) — asserts every trigger/action
maps to a real spec/catalog entry, auth wires the key header, sample payloads validate.

### n8n node package (INTEG-N8N-01/-02)
```
packages/n8n-nodes/  →  @contractor-ops/n8n-nodes
  nodes/ContractorOps/ContractorOps.node.ts      // regular node: the write actions
  nodes/ContractorOpsTrigger/…Trigger.node.ts    // trigger node: the webhook events
  credentials/ContractorOpsApi.credentials.ts    // apiKey credential
  package.json  { "n8n": { "nodes": [...], "credentials": [...] } }
docs + example workflows (INTEG-N8N-02): invoice→Slack, contractor-onboard-from-Personio,
  compliance-expiry→PagerDuty  (committed JSON workflow exports + a docs page)
```

### Make blueprint (INTEG-MAKE-01) + Postman/Insomnia (INTEG-DX-02)
```
make/blueprint.json         // modules (actions) + instant-triggers (webhooks) + connection (apiKey)
apps/public-api/collections/postman.json    // one request per snapshot path, {{baseUrl}} + {{apiKey}} vars
apps/public-api/collections/insomnia.json   // Insomnia v4 export, same coverage
```

### MarketplaceListing model (INTEG-MARKETPLACE-01)
```
MarketplaceListing { platform ZAPIER|N8N|MAKE, status DRAFT|SUBMITTED|IN_REVIEW|LIVE|REJECTED|NEEDS_CHANGES,
  versionPin String, lastReviewFeedback String?, submittedAt?, wentLiveAt?, listingUrl?, updatedByUserId }
```

---

## C. Patterns

### Pattern 1 — widen the demo predicate (the sandbox isolation reuse)
```
// packages/api/src/lib/demo.ts — isDemoOrg gains a persistent-marker branch
export async function isDemoOrg(orgId: string): Promise<boolean> {
  if (isGlobalDemo() || envDemoOrgIds().has(orgId)) return true;
  return (await prisma.organization.findUnique({ where: { id: orgId }, select: { isSandbox: true } }))?.isSandbox ?? false;
}
// every existing skip (outbox/index.ts:415, app-email.ts, zatca-submission.ts, payouts) now covers sandbox orgs
```

### Pattern 2 — sandbox key mint + fail-closed resolve (co_test_)
```
// api-key-service.ts
export function generateApiKey(opts: { environment: 'LIVE' | 'SANDBOX' }) {
  const prefixTag = opts.environment === 'SANDBOX' ? 'co_test_' : 'co_live_';
  /* … same 256-bit entropy, hash … */
}
async function resolveByPrefix(plaintext, prefix) {
  const key = /* … existing lookup … */;
  const org = await prisma.organization.findUnique({ where: { id: key.organizationId }, select: { isSandbox: true } });
  if (key.environment === 'SANDBOX' && !org.isSandbox) throw new Error('sandbox-key-nonsandbox-org'); // fail closed
  if (key.environment === 'LIVE'    &&  org.isSandbox) throw new Error('live-key-sandbox-org');       // fail closed
  return key;
}
```

### Pattern 3 — the generator (packages/marketplace-manifests, mirror the 98-11 snapshot diff-check)
```
const spec = JSON.parse(readFileSync('apps/public-api/openapi.snapshot.json'));
const events = WEBHOOK_EVENT_TYPES;                       // packages/validators/src/webhooks
const actions = writeOperationIds(spec);                  // POST/PATCH operationIds (0 pre-100-09-flip)
writeArtifact('zapier/app.json',   toZapier(events, actions));
writeArtifact('collections/postman.json', toPostman(spec));
// `generate --check`: regenerate to a temp dir + diff vs committed → CI fails on drift
```

### Pattern 4 — public status aggregator (apps/public-api, unauthenticated, cached)
```
app.get('/status.json', async c => {
  const [api, dispatcher, jobs] = await Promise.all([probeApi(), probeDispatcher(), probeJobs()]);
  const incidents = await listOpenIncidents();            // IncidentReport, staff-authored
  return c.json({ updatedAt, components: { api, dispatcher, jobs }, incidents }); // NO tenant data
}); // short cache; no auth; coarse operational|degraded|down only
```

### Pattern 5 — portal pages hang off the 98 Scalar mount, flag-gated
```
app.use('/docs/*', requireFlag('module.developer-portal'));   // 404 when off
app.get('/docs/webhooks',   renderEventCatalog(WEBHOOK_EVENT_TYPES));
app.get('/collections/postman.json', c => c.json(postmanCollection));
```

---

## D. Pitfalls

1. **A `co_test_` key reaching a live org (or vice-versa)** — the whole "never touch production data"
   promise. MUST fail-closed on the prefix↔`isSandbox` mismatch at resolve time (A5). Test: a sandbox key
   whose org is not `isSandbox` is rejected; a live key against a sandbox org is rejected.
2. **A sandbox org performing a real side-effect** — if the demo predicate is not widened, a sandbox org's
   outbox events / emails / ZATCA submissions fire for real. MUST widen `isDemoOrg` to `isSandbox` so the
   existing skips apply. Test: a sandbox org's outbox dispatch is skipped; no real email is sent.
3. **Artifact drift from the spec** — a hand-edited Postman/Zapier/n8n def diverges from the API. MUST
   generate + CI-diff-check. Test: `generate --check` fails if a committed artifact ≠ a fresh generation.
4. **Generating write actions before the 100-09 flip** — the snapshot has zero write ops until writes are
   un-hidden; the action-count assertion must be conditional on the snapshot's write set, not a hardcoded 6.
   Test: with a writes-hidden snapshot, the generator emits triggers + reads and does NOT fail the count.
5. **The status page leaking tenant data or raw probe internals** — it is public + unauthenticated. It must
   expose ONLY the three coarse component states + open incidents, never a per-org metric or a raw probe
   body. Test: `/status.json` contains no org id, no tenant field, no raw probe payload.
6. **Blocking the build on a marketplace submission** — the founder has no partner accounts. Submission is a
   register row + a dashboard state, never a plan gate (A7). Test: the phase's GREEN state does not depend on
   any `LIVE` listing status.
7. **A new dep younger than 7 days** — `zapier-platform-core` / `n8n-workflow` move fast. Pin ≥7 days old;
   if impossible, defer that platform's package. Do NOT bypass `min-release-age`.
8. **Portal/status surfaces reachable when their flag is off** — the portal + status page must 404 when
   `module.developer-portal` / `module.public-status-page` is off (ship-dark). Test: flag off ⇒ 404.
9. **Sandbox keys with no per-day cap** — a sandbox key without the 100/day counter is a free unlimited API.
   Enforce `SANDBOX_DAILY_REQUEST_QUOTA` in a middleware branch. Test: the 101st sandbox request in a day is
   429.
10. **The n8n/Zapier publish job running by default** — publish/submit must be a DARK CI job (token/partner
    account absent), never auto-run on merge (mirror 98-11). Test: no publish step runs without the token.

---

## E. Validation Architecture (feeds 101-01 RED net + 101-VALIDATION)

| Requirement | Behavior | Test | Command |
|---|---|---|---|
| INTEG-DX-04 | `co_test_` key → sandbox org only (fail-closed both ways); a sandbox org performs NO real side-effect (outbox/email skip); 101st req/day is 429 | security | `pnpm --filter @contractor-ops/api test sandbox-isolation` |
| INTEG-ZAPIER-01 / INTEG-N8N-01 / INTEG-MAKE-01 | every generated trigger maps to a real event-catalog event; every action maps to a real write operationId in the snapshot; the Zapier/n8n/Make defs validate against each platform schema | contract | `pnpm --filter @contractor-ops/marketplace-manifests test listing-manifest` |
| INTEG-DX-02 | Postman + Insomnia are generated from the snapshot; every snapshot path appears as a request; `generate --check` fails on drift | contract | `pnpm --filter @contractor-ops/marketplace-manifests test collection-generation` |
| INTEG-DX-03 | `/status.json` reports api/dispatcher/jobs component states from the health sources; contains NO tenant data/raw probe; incident history renders | integration | `pnpm --filter @contractor-ops/public-api test status-page` |
| INTEG-DX-01 | the portal serves the event catalog + SDK guides + recipes + changelog + deprecations; 404 when `module.developer-portal` off | integration | `pnpm --filter @contractor-ops/public-api test developer-portal` |
| INTEG-MARKETPLACE-01 | the `MarketplaceListing` model + staff router track 3 platforms' state/version/feedback; the state machine transitions are valid | integration | `pnpm --filter @contractor-ops/api test marketplace-listing` |
| INTEG-N8N-02 | the n8n node package builds; nodes + credentials load; the 3 example workflows are valid n8n JSON | contract | `pnpm --filter @contractor-ops/n8n-nodes test` |
| INTEG-ZAPIER-01 (bundle) | the Zapier app passes its sandbox bundle/validate test | contract | `pnpm --filter @contractor-ops/zapier-app test` |
| INTEG-MARKETPLACE-01 (UI) | Settings → Developer → Marketplace: listing states + version pins + feedback (loading/empty/error) | component | `pnpm --filter @contractor-ops/web-vite test marketplace` |
| INTEG-DX-03 (UI) | the public status page renders `/status.json` (operational/degraded/down + incidents) | component | `pnpm --filter @contractor-ops/landing test status` |

**Kill-switch / flag-deferred:** the portal (`module.developer-portal`), status page
(`module.public-status-page`), and external sandbox-key issuance (`module.api-sandbox`) are default-off; the
three `integration.marketplace-*` flags gate in-product "live" surfacing. Marketplace SUBMISSION + npm
publish + public hostnames are EXTERNAL-ENABLEMENT rows, never build gates. NEVER run the full unscoped
web-vite suite (RAM). Scope every command with `--filter` + a path.

---

## F. Open Questions (executor MUST surface, not silently decide)

1. **Generator home** — `packages/marketplace-manifests/` (a package the n8n/Zapier/collection consumers
   import) vs `apps/public-api/scripts/generate-*.ts`? Lean: a package. Confirm.
2. **Zapier auth** — API-key header only, or also the OAuth 2.0 authorization-code variant (INTEG-ZAPIER-01
   allows either)? Lean: ship the API-key custom-auth now (matches the `co_live_`/`co_test_` model); OAuth is
   a follow-up (the public API is key-based today). Confirm.
3. **Sandbox-org lifecycle** — how long does an auto-seeded sandbox org live, and can a developer hold more
   than one? Lean: one sandbox org per user, TTL-reaped after N days idle (a cron job). Confirm the TTL +
   the cap.
4. **Status-page host** — a `/status` route inside `apps/landing` vs a dedicated minimal `apps/status`?
   Lean: a route in `apps/landing` (reuses its shell); the `status.contractor-ops.{tld}` hostname maps to it
   at deploy. Confirm.
5. **Zapier/n8n/Make dev-deps under the 7-day floor** — confirm `zapier-platform-core` + `n8n-workflow` can
   be pinned ≥7 days old before adding; if not, defer that platform's package (supply-chain review). Confirm.
6. **Portal changelog source** — a committed `CHANGELOG.md` + the `Sunset` headers vs a DB model? Lean:
   file-based (deprecations are low-frequency + version-controlled). Confirm.
7. **When does the write-action generation run** — the write operationIds only exist in the snapshot after
   the 100-09 flip. If Phase 101 executes before 100-09 lands, the generator emits triggers + reads and the
   action set fills on the next snapshot rebuild. Confirm the execution order (101 after 100-09) or accept
   the conditional-count posture.

---

*Phase: 101-theme-c-marketplace-listings-developer-experience · Research compiled 2026-07-05*
