# Handover — External Integration Testing & Automation

> **IMPLEMENTATION STATUS — 2026-05-31 (this session).** A first slice is implemented + verified on branch `audit/post-migration-parity`. Remaining items below (live-smoke real runs, Sentry source-maps, legal pipeline, Teams live channel, MCP installs, IdP adapters) are unchanged.
>
> **Done + verified:**
> - **Route-drift contract guard** (RISK-ROUTE-001): `scripts/check-webhook-routes.mjs` freezes all 26 mounted routes + asserts each external/QStash route references a signature mechanism. Wired into `pnpm lint:ci` as `check:webhook-routes`. Verified green: `check:webhook-routes — OK (26 routes match contract)`.
> - **Peppol CONNECTED-superset fallback** (RISK-ROUTE-003): `apps/api/src/routes/peppol.ts` poll now sweeps ACTIVE participants ∪ CONNECTED Peppol connections and warns on the gap, so a CONNECTED-but-not-ACTIVE tenant is no longer silently skipped.
> - **InPost strict-signature** (RISK-WEBHOOK-001): new `STRICT_INPOST_SIGNATURE` env (`apps/api/src/env.ts` + `.env.example`) disables the unsigned dev/staging fallback in every environment; `apps/api/src/routes/webhooks/inpost.ts` gated on it. Test `apps/api/src/__tests__/inpost-webhook.test.ts` — 3/3 green.
> - **OAuth credential-upsert audit-log** (RISK-ROUTE-005): `apps/api/src/routes/oauth.ts` now emits `writeAuditLog` (best-effort, post-persist) on connection upsert.
> - **Live-smoke scaffold**: `tests/integration-smoke/` (harness + stripe/slack/vies), `vitest.smoke.config.ts`, `pnpm test:integration:smoke`, `.github/workflows/integration-smoke.yml` (nightly + dispatch, per-provider matrix, env-gated self-skip).
>
> **Inject-test harness — FIXED this session:** `apps/api/src/__tests__/setup.ts` now stubs the full `validateServerEnv` required set (44 added format-valid placeholders), so `buildServer()` inject tests import cleanly again. Verified: `stripe-webhook.test.ts` + `inpost-webhook.test.ts` → **9/9 green**. The InPost regression test ships as a focused env-schema test; richer per-route HTTP inject tests are now trivially addable on the unbroken harness.
> **Cross-tenant fix (subagent review finding):** `apps/api/src/routes/peppol.ts` inbound handler now binds the `WebhookDelivery` lookup to the payload's `organizationId` — was `findUniqueOrThrow({ id })`, an IDOR on a forged/replayed QStash signature.
>
> _Verification used two subagents: an adversarial diff reviewer (found the IDOR + the env-harness root cause) and an env-schema investigator (enumerated the full required-env set)._

> **Audience:** the agent that will design, build, and wire the external-integration test harness for contractor-ops before production cutover.
> **Author:** prior session (status review of branch `audit/post-migration-parity`, 2026-05-31).
> **Standing constraint:** app is **LOCAL-ONLY** — never deployed, no live tenants, no live data. Legal/regulatory sign-off deferred. See `.planning/STATE.md` → "Standing Project Constraints".
> **Repo facts below are verified against the tree** on 2026-05-31. Paths without a `[verify]` tag were confirmed by `find`/`grep`.

---

## 0. TL;DR

The integration **unit/MSW layer already exists and is broad** (nearly every adapter + service has a `*.msw.integration.test.ts`). The real gaps the requester cares about ("maximally automate testing of external integrations before cutover") are:

1. **No webhook-URL / route-drift contract guard** → RISK-ROUTE-001 (HIGH) is unprotected.
2. **No gated live-sandbox smoke layer** — every existing test is mocked (MSW). Nothing exercises a real provider round-trip.
3. **Specific risk-register defects** still need fix + regression test (Peppol superset, InPost strict signature, OAuth audit-log, Teams live channel, legal pipeline).
4. **IdP differentiator adapters not built** — Entra/Okta/GitHub (Phase 78). GWS/Slack/Teams adapters **do** exist.

**MCP is not the test driver.** Use MCP only for 3 assertion points (Gmail inbox, PostHog events, Linear issue-tracking). Backbone = provider sandboxes + the existing MSW pattern + a new gated live-smoke suite.

---

## 1. Verified repo state

- **Branch:** `audit/post-migration-parity` — **194 commits ahead of `main`, 0 behind.** Not merged.
- **Uncommitted:** ~341 files dirty (272 in `apps/web-vite` — i18n dead-key purge + `data-table-unification` + `no-jsx-props-bind` goals). Land/triage before starting.
- **Stack after migration:** Vite SPA `apps/web-vite`; Fastify `apps/api` (tRPC + webhooks + cron-ish routes); Hono `apps/public-api` (external API-key REST); `apps/cron-worker`; Payload CMS `apps/cms` (port 3002); Next.js `apps/landing`.

### Where integration code actually lives
- **`packages/integrations/src/adapters/`** (18 adapters, confirmed):
  `slack`, `teams`, `google-workspace`, `google-calendar`, `outlook-calendar`, `docusign`, `autenti`, `claude-ocr`, `jira`, `confluence`, `clockify`, `notion`, `linear`, `resend`, `ksef`, `bir1-company-registry`, `dataport-company-registry`, `base-adapter`.
- **`packages/integrations/src/services/`** — shared infra, exported: `credential-service`, `concurrency`, `idempotency`, `webhook-schemas`, `registry`, plus `qstash-client`, `ksef-api-client`. **Reuse these — don't reinvent.**
- **`packages/gov-api/src/clients/`** — `hmrc-vat-client`, `vies-client` (both have MSW integration tests).
- **`apps/api/src/routes/webhooks/`** — `stripe.ts`, `storecove.ts`, `inpost.ts`, `multi-provider.ts`, `process.ts`, `index.ts`.
- **`apps/api/src/routes/`** — `oauth.ts`, `teams.ts`, `google-workspace.ts`, `peppol.ts`, `ksef.ts`, `zatca.ts`, `ocr.ts`, `revalidate-legal.ts`, `csp-report.ts`, `late-interest.ts`, `outbox.ts`, `portal-session.ts`, `web-vitals.ts`, `exports.ts`, `health.ts`.
- **`apps/api/src/services/__tests__/`** — MSW tests for `stripe-billing`, `slack-client`, `resend-client`, `jira-issue-sync`, `jira-worklog-sync`, `linear-issue-sync`, `clockify-sync`, `regional-storage`, `cache`, `msw-providers-fetch`.

### Existing test coverage (already green-ish)
- **MSW unit/integration:** essentially all 18 adapters + gov-api clients + qstash + ksef-api-client + the api services above. Pattern file: `packages/integrations/src/adapters/__tests__/claude-ocr-adapter.msw.integration.test.ts`.
- **Webhook tests:** `apps/api/src/__tests__/` — `stripe-webhook`, `storecove-webhook`, `multi-provider-webhook`, `process-webhook`, `slack-webhook-context`.
- **Known broken (STATE.md):** `docusign-adapter.test.ts` + `claude-ocr-adapter.msw.integration.test.ts` had type errors failing the repo-wide postinstall build. **Verify current status** — may already be fixed; if not, fix first (blocks `pnpm install`).
- ⚠ Never run the full `apps/web-vite` vitest suite unscoped (eats 100% RAM — memory note). Always `pnpm --filter @contractor-ops/integrations test <path>`.

> **Net:** layer 1 (mocked) is largely DONE. Do not rebuild it. Audit it for gaps, then build layers 2–4.

---

## 2. External integration inventory (verified)

"Phase" = v6.0 roadmap (`.planning/ROADMAP.md`); only Phase 70 shipped.

| Provider | App role | Home | Adapter/route | MSW test | Sandbox | MCP |
|----------|----------|------|---------------|----------|---------|-----|
| **Stripe** | billing/top-ups/payments | api | `webhooks/stripe.ts` + `services/stripe-billing` | ✅ | ✅ test mode + Stripe CLI | ❌ |
| **Storecove** | e-invoice (Peppol) send | api | `webhooks/storecove.ts` | ✅ (webhook) | ✅ sandbox | ❌ |
| **Peppol** | inbound regulatory poll (`PeppolParticipant`) | api | `routes/peppol.ts` | partial | ⚠ via Storecove | ❌ |
| **InPost** | equipment shipment carrier | api | `webhooks/inpost.ts` | partial | ✅ sandbox | ❌ |
| **Teams** (Bot Framework) | notifications/bot | integrations + api | `teams-adapter` + `routes/teams.ts` | ✅ | ✅ Bot Framework Emulator | ❌ |
| **Slack** | notifications + IdP wedge | integrations + api | `slack-adapter` + `slack-client` + `slack-webhook-context` | ✅ | ✅ test workspace + Socket Mode | ❌ add official Slack MCP |
| **Google Workspace** | IdP deprovision / directory | integrations + api | `google-workspace-adapter` + `routes/google-workspace.ts` | ✅ | ✅ test tenant + SA delegation | ⚠ Gmail/Cal/Drive MCP = **wrong (end-user) scopes** |
| **Google Calendar / Outlook Calendar** | scheduling / free-busy | integrations | adapters | ✅ (incl. freebusy) | ✅ | ⚠ Cal MCP end-user only |
| **DocuSign / Autenti** | contract e-signature | integrations | adapters | ✅ | ✅ demo accounts | ❌ |
| **Claude OCR** (Anthropic) | invoice OCR | integrations + api | `claude-ocr-adapter` + `routes/ocr.ts` | ✅ | ✅ real / MSW | ❌ |
| **Jira / Confluence / Clockify / Notion / Linear** | PM / time / docs sync | integrations + api | adapters + sync services | ✅ | ✅ | Linear ✅ (track, not drive) |
| **Resend** | transactional email | integrations + api | `resend-adapter` + `resend-client` | ✅ | ✅ | Gmail MCP = inbox assertion |
| **KSeF** | Poland e-invoice (gov) | integrations + api | `ksef-adapter` + `ksef-api-client` + `routes/ksef.ts` | ✅ | ✅ test env | ❌ |
| **ZATCA** | Saudi e-invoice (gov) | api | `routes/zatca.ts` | `[verify]` | ✅ sandbox | ❌ |
| **HMRC** | UK VAT/MTD (gov) | gov-api | `hmrc-vat-client` | ✅ | ✅ (registration takes weeks) | ❌ |
| **VIES** | EU VAT validation | gov-api | `vies-client` | ✅ | ✅ live test VATs; SOAP fallback risk | ❌ |
| **BIR1 / Dataport** | company registry (PL / DE) | integrations | adapters | ✅ | ✅ | ❌ |
| **QStash** (Upstash) | cron fan-out / callbacks | integrations | `qstash-client` | ✅ | ✅ | ❌ |
| **Payload CMS** | legal doc publish → revalidate | cms + api | `routes/revalidate-legal.ts` (**stub**) | ❌ | local CMS | ❌ |
| **Sentry** | observability | all node svcs | — | n/a | ✅ | ❌ |
| **Entra ID / Okta / GitHub** | IdP deprovision (differentiator) | — | **NOT built (Phase 78)** | ❌ | ✅ dev tenants | GitHub via `gh` CLI |

---

## 3. Where MCP helps (and the traps)

**MCP servers seen this session** (most need `authenticate` → `complete_authentication`; claude.ai connectors may be **absent in headless/CI** — never depend on them in main CI):

| MCP | Use |
|-----|-----|
| `semble` | code discovery (use before grep) |
| `context7` | provider SDK docs |
| `linear-server` | **track**: auto-file findings as Linear issues. (Note: app also has its own `linear-adapter` — different thing.) |
| Gmail (claude.ai) | **assert**: Resend emails actually arrive at a test mailbox (email pipeline `dad1c821`, `81bcab35`) |
| Google Calendar / Drive (claude.ai) | ⚠ **trap**: end-user OAuth scopes. The GWS *deprovisioning* path needs Admin SDK Directory API (suspend/revoke). MCP cannot drive it — use a GWS test tenant + service account. |
| PostHog | **assert**: events/errors landed post-flow; verify observability wiring |

**Not connected, worth adding:** official **Slack MCP** (post/read test channel), **GitHub MCP** (or `gh` CLI). No MCP exists for Stripe/Storecove/InPost/Peppol/HMRC/VIES/Okta/Entra/Teams/ZATCA/KSeF — sandboxes + SDK/MSW only.

**Rule:** MCP = optional assertion sugar at 3 points (inbound email, observability, issue-tracking). Architect the suite around sandbox creds + existing MSW infra, not MCP.

---

## 4. Findings to fix + cover (from `.planning/risk-register.md`, edited 2026-05-30)

### HIGH
- **RISK-LEGAL-001** — Legal CMS pipeline broken both ends: `apps/api/src/routes/revalidate-legal.ts` is a **stub**; SPA has no tRPC fetch path; no `legal.getDocument` procedure. CMS copy unreachable → static i18n fallback only. **Build** Redis pub/sub + SSE + `legal.getDocument` + container wiring. **Test:** Payload publish → revalidate → SPA receives updated doc.
- **RISK-SECURITY-001** — SPA CSP lost per-request nonce + `strict-dynamic`; Render static-site can't mint nonces. **Build** edge runtime (Fastify/CF Worker) for nonce injection. **Test:** CSP header shape; no inline-script path.
- **RISK-ROUTE-001** — `/api/*` prefix dropped on Fastify mounts (except `/api/auth/**`, `/api/trpc/**`). External publishers (Stripe, Storecove, InPost, Teams, Payload) may POST legacy URLs. **Fix:** ops re-register URLs OR reverse-proxy strip-prefix in `render.yaml`. **P0 if any provider still on legacy path after cutover.** **Test (highest leverage):** route-inventory snapshot + per-provider expected-callback-URL contract test that fails CI on drift.

### MEDIUM
- **RISK-ROUTE-002** — Teams Bot SDK swap `botbuilder` → `@microsoft/agents-hosting`; JWT issuer / multi-tenant unvalidated on live channel. Prod-env guard exists (`70846fea`). **Test:** Bot Framework Emulator smoke + dev tenant.
- **RISK-ROUTE-003** — Peppol poll source changed `IntegrationConnection` → `PeppolParticipant`; CONNECTED-not-ACTIVE tenants may be skipped. **Test:** assert ACTIVE `PeppolParticipant` ⊇ CONNECTED `IntegrationConnection(provider=PEPPOL)`, else fall-back sweep.
- **RISK-WEBHOOK-001** — InPost webhook unsigned-payload fallback gated only by `NODE_ENV !== 'production'`. **Fix:** `STRICT_INPOST_SIGNATURE=true` override + test signature-required path.
- **RISK-ROUTE-005** — `apps/api/src/routes/oauth.ts` missing `writeAuditLog` on credential upsert. **Fix + test** the audit write fires.
- **RISK-OBSERVABILITY-002** — Sentry source-map upload not wired in CI; prod traces won't symbolicate. **Ops:** set `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`; verify upload on deploy. `release: RENDER_GIT_COMMIT` already flows (`7a283b21`).
- **RISK-MIDDLEWARE-002** — portal subdomain rewrite dropped (pre-auth branding). Product confirms contract; if retained, restore rewrite + unauth `portal.getBrandingBySubdomain`.
- **RISK-I18N-001** — currency formatter parity loss (35 hardcoded-locale call-sites on invoice/payment surfaces).

### LOW / near-auto-clearing
- **RISK-ROUTE-004** — orphan QStash legacy `cron/inpost-status-poll` → DLQ noise. Ops decommission.
- **RISK-SECURITY-002** — SPA `frame-src` R2 wildcard; closed-decision (`docs/security/csp-r2-wildcard.md`).
- **RISK-OBSERVABILITY-001/003** — Sentry replay/feedback disabled (privacy); `/monitoring` tunnel absent.
- **RISK-DEPS-001** — `tmp` + `turbo` vulns blocked by 7-day age; mature ~2026-06-02/03 → add overrides then.
- **RISK-TEST-001/002** — test coverage drift; two pre-existing failing web-vite suites.

---

## 5. Target harness architecture (build on what exists)

1. **Unit / MSW (EXISTS)** — audit for gaps only. Add MSW coverage for any route lacking it (ZATCA `[verify]`, Peppol poll, InPost signature paths). Deterministic, main CI, no creds.
2. **Contract / route-drift (NEW, top priority)** — route-inventory snapshot of every mounted webhook path + a per-provider expected-callback-URL/scope/signature-scheme table. Fails CI when a path drifts. Closes RISK-ROUTE-001 with a regression net. Reuse `services/webhook-schemas`.
3. **Signature/auth (extend)** — replay real signed samples (Stripe `whsec_`, InPost, DocuSign, Teams JWT issuer) → assert verify-accept / tamper-reject. Checked-in samples, main CI.
4. **Live-smoke (NEW, the real automation gap)** — thin suite hitting real sandboxes, gated `RUN_LIVE_SMOKE=1` + per-provider creds. **Separate workflow (nightly/dispatch), NOT main CI.** Smallest real round-trip per provider, **self-cleaning + idempotent** (create-then-delete; IdP deprovision smokes target disposable identities only). Assert via MCP where available (Gmail inbox for Resend, PostHog for events).
5. **E2E (extend Playwright)** — flows crossing an integration boundary (invoice → Storecove send; equipment → InPost label).

---

## 6. CI wiring

- Main CI (`pnpm test` via turbo): layers 1–3 + 5. No external creds. Deterministic.
- New `integration-smoke` workflow (layer 4): `workflow_dispatch` + nightly cron; creds from CI secret group; **matrix per provider** so one outage doesn't fail the rest.
- Add `pnpm test:integration:smoke` (env-gated), mirroring Phase-70 guard-script style (`pnpm lint:schema|logs`, `i18n:parity`).
- Don't regress existing guards: `check:web-vite-data-layer`, `check:web-vite-dialog-pattern`, `check:web-vite-table-pattern`, `check:r2-iframe-sandbox`, `lint:schema|logs`, `i18n:parity`, `check:no-process-env`.

---

## 7. Env vars (add to `.env.example` + package `env.ts` schema — CLAUDE.md rule; `pnpm check:no-process-env` after)

Sandbox creds only, in CI secret group, never committed:
`STRIPE_SECRET_KEY`(test)/`STRIPE_WEBHOOK_SECRET`; `SLACK_BOT_TOKEN`/`SLACK_SIGNING_SECRET`/`SLACK_TEST_CHANNEL_ID`; `AZURE_BOT_APP_ID`/`AZURE_BOT_APP_SECRET`; GWS service-account JSON + `GWS_ADMIN_SUBJECT`/`GWS_TEST_DOMAIN`; `STORECOVE_API_KEY`; InPost sandbox key + `STRICT_INPOST_SIGNATURE`; HMRC sandbox id/secret; KSeF test token; ZATCA sandbox creds; `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`; `RUN_LIVE_SMOKE`. (Entra/Okta/GitHub only once Phase 78 builds those adapters.)

---

## 8. Task order

1. **Verify** — fix the `[verify]` tags (ZATCA MSW status; current state of the 2 known-broken test files). Confirm `pnpm --filter @contractor-ops/integrations test` is green.
2. **Contract/route-drift guard** (RISK-ROUTE-001) — cheapest highest-leverage. Snapshot mounted webhook routes + expected-URL table; fail on drift.
3. **Targeted risk fixes + regression tests:** Peppol superset (ROUTE-003), InPost strict-sig (WEBHOOK-001), OAuth audit-log (ROUTE-005).
4. **Live-smoke workflow** — start Stripe (`stripe trigger`) + Slack (test channel) + Resend→Gmail-MCP assertion; expand provider-by-provider.
5. **Sentry source-maps** (OBSERVABILITY-002) + a PostHog-MCP assertion smoke.
6. **Legal pipeline** (LEGAL-001) — `legal.getDocument` + revalidate wiring + Payload→SPA test (only if in cutover scope — see §9).
7. **Teams live-channel smoke** (ROUTE-002) via Bot Framework Emulator.
8. **MCP add-ons:** install Slack + GitHub MCP; authenticate Gmail/PostHog/Linear; auto-file remaining findings to Linear.
9. **IdP differentiator adapters + smokes** (Entra/Okta/GitHub) — only after Phase 78 executes.

**Acceptance:** route-drift guard green in main CI and fails on a deliberately-broken URL; ROUTE-003/WEBHOOK-001/ROUTE-005 fixed with passing regression tests; gated live-smoke workflow passes against sandboxes for ≥ Stripe + Slack + GWS; Sentry symbolication verified on a test deploy; all new env in `.env.example` + schema; risk-register rows updated (closed / downgraded) or Linear issues filed.

---

## 9. Open questions for product/ops (don't block)

- Is the Payload→SPA legal pipeline in v1 cutover scope, or is static-i18n acceptable at launch? (sets LEGAL-001 priority)
- Which IdP providers ship first cutover? (Phase 77 wedge GWS+Slack already have adapters; Phase 78 Entra/Okta/GitHub unbuilt) — scopes the IdP smoke matrix.
- Subdomain-per-org public URLs retained? (MIDDLEWARE-002)
- Live-smoke as nightly cron or pre-cutover gate only?

---

## 10. Pointers

- Findings source of truth: `.planning/risk-register.md` (2026-05-30, current).
- Backlog: `.planning/STATE.md` + `.planning/ROADMAP.md` (v6.0 phases 70–80; only 70 shipped).
- Rules: `CLAUDE.md`, `apps/web-vite/ARCHITECTURE.md`, `.claude/core-values.yml`.
- MSW pattern: `packages/integrations/src/adapters/__tests__/claude-ocr-adapter.msw.integration.test.ts`.
- Shared integration infra: `packages/integrations/src/services/{webhook-schemas,idempotency,concurrency,credential-service,registry}`.
- Prior reports: `.planning/reports/integration-verification.md`, `.planning/reports/bug-hunt-2026-04-27/{integrations,gov-api}.md`, `.planning/reports/TEST-GAP-AUDIT.md`.
