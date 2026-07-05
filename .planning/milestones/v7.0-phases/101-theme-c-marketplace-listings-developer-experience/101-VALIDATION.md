---
phase: 101
slug: theme-c-marketplace-listings-developer-experience
status: in-progress
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 101 — Validation Strategy

> Per-phase validation contract. Derived from `101-RESEARCH.md` § E. This phase builds the developer-facing
> surface over the 98/99/100 public API: marketplace listing artifacts (generated from the OpenAPI
> snapshot), a dev portal, Postman/Insomnia collections, a public status page, and a free sandbox tier. The
> two load-bearing controls — **sandbox isolation** (a `co_test_` key must never touch production data) and
> **artifact non-drift** (every generated artifact equals a fresh generation) — get RED tests BEFORE any
> production code. Marketplace SUBMISSION is external/deferred (register rows), never a validation gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (`packages/api`, `packages/marketplace-manifests`, `packages/n8n-nodes`, `apps/public-api`, `apps/web-vite`, `apps/landing` per-package vitest) |
| **Quick run** | `pnpm --filter @contractor-ops/api test <path>` (SCOPED + path arg) |
| **UI run** | `pnpm --filter @contractor-ops/web-vite test <path>` (SCOPED + path arg — NEVER unscoped) |
| **Generation source** | `apps/public-api/openapi.snapshot.json` (98-11) + `packages/validators/src/webhooks` (100) — the generators read these; the diff-check regenerates to a temp dir + diffs the committed artifacts |
| **Sandbox seam** | the existing demo read-only layer (`packages/api/src/lib/demo.ts` + `middleware/demo.ts`); tests seed a sandbox `Organization` (`isSandbox:true`) + a `co_test_` key |
| **Estimated runtime** | ~10–45s scoped |

> **NEVER** run the full unscoped web-vite suite (kills Mac RAM). Always `--filter` + a path arg.

---

## Sampling Rate

- **After every task commit:** scoped test for the touched file.
- **After every wave:** the scoped generator + sandbox + public-api suites + the touched app suite.
- **Before `/gsd:verify-work`:** all Wave-0 RED files GREEN + the `generate --check` drift gate GREEN + the
  sandbox-isolation security suite GREEN + the status page exposes no tenant data.
- **Max feedback latency:** ~45s scoped.

---

## Per-Requirement Verification Map

| Requirement | Wave | Behavior | Test Type | Automated Command | Status |
|-------------|------|----------|-----------|-------------------|--------|
| INTEG-DX-04 | 0 | `co_test_` key resolves to a sandbox org ONLY (fail-closed both ways); a sandbox org fires NO real side-effect; 101st req/day → 429 | security | `pnpm --filter @contractor-ops/api test sandbox-isolation` | ⬜ RED→101-02 |
| INTEG-ZAPIER-01 | 0 | every generated Zapier trigger maps to a real event-catalog event + every action to a real write operationId; the app def validates | contract | `pnpm --filter @contractor-ops/marketplace-manifests test listing-manifest` | ⬜ RED→101-03 |
| INTEG-N8N-01 | 0 | the n8n node/credential descriptions generate from the same source + validate | contract | `pnpm --filter @contractor-ops/marketplace-manifests test listing-manifest` | ⬜ RED→101-03 |
| INTEG-MAKE-01 | 0 | the Make blueprint generates from the same source + validates | contract | `pnpm --filter @contractor-ops/marketplace-manifests test listing-manifest` | ⬜ RED→101-03 |
| INTEG-DX-02 | 0 | Postman + Insomnia generate from the snapshot; every path is a request; `generate --check` fails on drift | contract | `pnpm --filter @contractor-ops/marketplace-manifests test collection-generation` | ⬜ RED→101-04 |
| INTEG-DX-03 | 0 | `/status.json` maps api/dispatcher/jobs from the health sources; NO tenant data/raw probe; incidents render | integration | `pnpm --filter @contractor-ops/public-api test status-page` | ⬜ RED→101-05 |
| INTEG-DX-01 | 0 | the portal serves event catalog + SDK guides + recipes + changelog + deprecations; 404 when `module.developer-portal` off | integration | `pnpm --filter @contractor-ops/public-api test developer-portal` | ⬜ RED→101-08 |
| INTEG-MARKETPLACE-01 | 0 | the `MarketplaceListing` model + staff router track 3 platforms' state/version/feedback; valid state transitions | integration | `pnpm --filter @contractor-ops/api test marketplace-listing` | ⬜ RED→101-03 |
| INTEG-N8N-02 | — | the n8n package builds; nodes + credentials load; the 3 example workflows are valid | contract | `pnpm --filter @contractor-ops/n8n-nodes test` | ⬜ →101-06 |
| INTEG-ZAPIER-01 (bundle) | — | the Zapier app passes its sandbox bundle/validate test | contract | `pnpm --filter @contractor-ops/zapier-app test` | ⬜ →101-07 |
| INTEG-MARKETPLACE-01 (UI) | — | Settings → Developer → Marketplace: states + version pins + feedback (loading/empty/error) | component | `pnpm --filter @contractor-ops/web-vite test marketplace` | ⬜ →101-09 |
| INTEG-DX-03 (UI) | — | the public status page renders `/status.json` | component | `pnpm --filter @contractor-ops/landing test status` | ⬜ →101-09 |
| INTEG-ZAPIER-02 | — | public-listing submission + review iteration | manual/deferred | EXTERNAL-ENABLEMENT row (separate ongoing milestone) | ⬜ deferred |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements (101-01 — RED net)

- [ ] `sandbox-isolation.security.test.ts` — NEW: a `co_test_` key resolves to a sandbox org only
      (fail-closed on prefix↔`isSandbox` mismatch both ways); a sandbox org's outbox/email/side-effects are
      skipped (demo predicate widened); the 101st request/day is 429 (RED until 101-02) — INTEG-DX-04
- [ ] `listing-manifest.test.ts` (marketplace-manifests) — NEW: every generated Zapier trigger → a real
      event-catalog event; every action → a real write operationId in the snapshot; the Zapier/n8n/Make defs
      validate against each platform schema; write-count assertion is conditional on the snapshot's write set
      (RED until 101-03) — INTEG-ZAPIER-01 / INTEG-N8N-01 / INTEG-MAKE-01
- [ ] `collection-generation.test.ts` (marketplace-manifests) — NEW: Postman + Insomnia generate from the
      snapshot; every path is a request; `generate --check` fails on any drift (RED until 101-04) — INTEG-DX-02
- [ ] `status-page.test.ts` (public-api) — NEW: `/status.json` maps the three components from the health
      sources; contains NO org id / tenant field / raw probe body; incident history renders (RED until
      101-05) — INTEG-DX-03
- [ ] `developer-portal.test.ts` (public-api) — NEW: the portal pages serve the catalog/SDK/recipe/changelog/
      deprecation content; 404 when `module.developer-portal` off (RED until 101-08) — INTEG-DX-01
- [ ] `marketplace-listing.test.ts` (api) — NEW: the `MarketplaceListing` model + staff router track 3
      platforms; the DRAFT→SUBMITTED→IN_REVIEW→LIVE/REJECTED/NEEDS_CHANGES state machine rejects invalid
      transitions; every mutation audits (RED until 101-03) — INTEG-MARKETPLACE-01

---

## Manual-Only / Flag-Deferred Verifications

| Behavior | Requirement | Why | Handling |
|----------|-------------|-----|----------|
| Zapier public-listing submission + review | INTEG-ZAPIER-02 | needs a Zapier partner account + a 2–4wk review | EXTERNAL-ENABLEMENT row; the app + bundle test build now; a `MarketplaceListing` row tracks it |
| Make App Directory submission | INTEG-MAKE-01 | needs a Make partner account + a 1–2wk review | EXTERNAL-ENABLEMENT row; blueprint generated + validated now |
| n8n npm publish | INTEG-N8N-01 | needs `NPM_TOKEN` + a CI enable | dark CI job (mirror 98-11 SDK publish); package builds + tests now |
| Public hostnames (`developers.` / `status.contractor-ops.{tld}`) | INTEG-DX-01/-03 | deploy-time DNS/Render | surfaces run behind their flags locally; DNS is an ops step |
| External developer signup → auto-seed sandbox org | INTEG-DX-04 | no public dev signup in a local-only app yet | `provisionSandboxOrg()` is invocable now from the Developer page; the signup auto-trigger is flag-gated (`module.api-sandbox`) |
| Status/marketplace/portal visual (RTL, dark, mobile) | INTEG-DX-01/-03, INTEG-MARKETPLACE-01 | visual | `frontend-design` + manual per `apps/web-vite/ARCHITECTURE.md` / `apps/landing` |
| Native de/pl/ar copy | INTEG-DX-* | native review deferred | i18n parity (GREEN); native pass at GA (EXTERNAL-ENABLEMENT #9) |

Per `.planning/EXTERNAL-ENABLEMENT.md`: any external/manual dependency → default-off `module.*` flag +
conditional-skip/mock test + register row; never a hard blocker in a plan. The sandbox isolation (demo
read-only reuse + fail-closed prefix↔org check) is a CONTROL, not a deferral.

---

## Validation Sign-Off

- [ ] All requirements have an automated verify command or a Wave 0 RED dependency (INTEG-ZAPIER-02 is the
      only intentionally deferred/manual item)
- [ ] No 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers the sandbox-isolation security net + the two generation-drift contracts + the status/
      portal/marketplace-model contracts
- [ ] No watch-mode flags (scoped `vitest run` only)
- [ ] `nyquist_compliant: true` set after 101-01 lands the RED stubs
- [ ] `wave_0_complete: true` set after 101-10 verifies the whole surface

**Approval:** pending
