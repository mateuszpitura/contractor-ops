# Plan — post-migration-parity-restoration

## Solution approach

Restoration is too big for a flat sequential plan: ~78 audit rows + 13 sibling-UI commits to review + 1 new infra surface (edge runtime for CSP nonce) + 1 new shared subsystem (Redis pub/sub for legal revalidations). Strategy = **wave-based parallel execution**:

- Each wave groups gaps that share a surface, dependency, or test-fixture so a single subagent can land them atomically.
- Waves run sequentially when they share a load-bearing path (edge runtime must land before CSP measurement; tRPC `legal.getDocument` must land before legal containers wire to it). Waves run in parallel when independent.
- Every wave's first step is a recon pass that re-reads the audit-report.md rows it owns and looks for stale claims (the `legal.tsx` IDOR finding is the canonical example: the audit said the guard was missing, but the router was refactored to make the guard structurally unreachable). Plan must verify-then-act, not act-on-stale-audit-claim.
- All work continues on branch `audit/post-migration-parity` (or short-lived `audit/restoration-<wave-N>` children fast-forward merged). Restoration report `goals/post-migration-parity-restoration/restoration-report.md` is the deliverable; it mirrors audit-report.md row-for-row with new status.

## Working environment

- **Branch**: `audit/post-migration-parity` head `99584569` is the starting point. Optional per-wave child branches.
- **Scratch dir** (gitignored): `.restoration-scratch/{wave-N,verify}/` for plans, evidence, verify-command outputs. `.gitignore` already covers `.audit-scratch/` — extend pattern.
- **Report**: `goals/post-migration-parity-restoration/restoration-report.md`. Mirror audit-report.md sections + new "Restoration log" appendix.
- **Constraints**: CLAUDE.md memory rule (never unscoped `pnpm --filter @contractor-ops/web-vite test`); semble preferred over grep; READ before EDIT; no `--amend`, no `--no-verify`; quality over speed.

## Wave structure

| Wave | Scope | Parallel? | Depends on |
|------|-------|-----------|------------|
| **0** | Branch hygiene + sibling-UI commit review pass + restoration-report.md scaffold | sequential | — |
| **1** | P0 infra surfaces (edge runtime for GAP-SECURITY-001 + Redis pub/sub channel for GAP-LEGAL-CLUSTER-001) | sequential (foundational) | 0 |
| **2** | P0 code-only fixes — 5 agents in parallel (GAP-OBSERVABILITY-012 + GAP-TEST-015 + GAP-TEST-021 + GAP-TEST-026 + GAP-SECURITY-002 closure with CI guardrail) | **parallel** | 0 |
| **3** | P0 wiring — close GAP-LEGAL-CLUSTER-001 (containers + procedure + subscriber) + GAP-SECURITY-001 cutover | sequential | 1, 2 |
| **4** | P1 cluster A — security + auth + portal + legal (8-10 rows) — 4 agents parallel | **parallel** | 3 |
| **5** | P1 cluster B — observability (4-5 rows) + middleware (3 rows) + routes (3 rows) — 3 agents parallel | **parallel** | 3 |
| **6** | P1 cluster C — UX (Accept-Language, currency, peppol-poll iteration, intake-detail UX) — 3 agents parallel | **parallel** | 3 |
| **7** | P2 cluster — 33 rows split by area (i18n / pages / tests / cosmetic) — 5 agents parallel | **parallel** | 4, 5, 6 |
| **8** | Pre-existing test fixes (FOLLOWUP-PRE-EXISTING-001 — 2 web-vite test files) | sequential | 7 |
| **9** | Final verification + restoration-report.md totals recompute + plannotator --gate | sequential | 8 |

## Steps

### Wave 0 — Branch hygiene, sibling review, scaffold

- **Touches**: `.gitignore` (extend `.audit-scratch/` pattern to include `.restoration-scratch/`); `goals/post-migration-parity-restoration/restoration-report.md` (new scaffold mirroring audit-report.md structure); 13 sibling-UI commit reviews recorded in scratch.
- **Sibling-UI review method**: for each of the 13 sibling commits (`e95e4e75`, `daed398b`, `eb6be3df`, `5d3fa5ce`, `5d436ece`, `e6ec821d`, `cca0ffc2`, `6a76470a`, `b5f09833`, `4c83feb8`, `eb51c97a`, plus any new ones since `99584569`), read the diff and check against the audit rubric (auth break / payment break / data loss / regulatory webhook break / accessibility regression / i18n key loss / Sentry scrub regression). Record clean reviews + any new `GAP-SIBLING-NNN` rows in restoration-report.md.
- **Verification**: `git log audit/post-migration-parity ^4fefacb3 --no-merges | grep -v 'audit'` lists exactly the sibling commits; each appears in the restoration-report's sibling-review section with verdict + reviewer.
- **Risk**: a sibling commit silently introduced a P0 (e.g. `e95e4e75 swap startup spinner` touched `dashboard-home-container.tsx` — the audit's "pre-existing failure" claim already noted the file changed). Mitigation: the sibling review pass IS this risk's mitigation.

### Wave 1 — P0 infra: edge runtime + Redis pub/sub channel

- **Touches**:
  - `render.yaml` — add a new service (`web-vite-edge` running `@fastify/static` OR Cloudflare Worker config), redirect `web-vite` static-deploy traffic through it OR replace.
  - `apps/web-vite-edge/` (new dir) — minimal Fastify app serving the static bundle + per-request nonce injection middleware + matching `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` header emission. OR `.cloudflare/workers/web-vite-csp/` if going Cloudflare route.
  - `packages/api/src/services/legal-pubsub.ts` (new) — Redis publisher + subscriber abstraction wrapping the existing Redis client used elsewhere in apps/api.
  - `apps/api/src/routes/legal/revalidations.ts` (new) — SSE or long-poll endpoint the SPA subscribes to.
- **Method**:
  1. **Edge runtime choice gate**: read `render.yaml` for the current `web-vite` block (line 642+). Confirm Render Web Service supports `runtime: docker` + per-request middleware (it does). Pick `apps/web-vite-edge` as a sibling Fastify app rather than introducing Cloudflare (one fewer cloud dependency).
  2. Build the nonce-injection middleware: read `index.html` from disk on each request (or cache it on startup), replace `<script>` tags' `nonce=""` placeholder with a freshly-generated `crypto.randomBytes(16).toString('base64')`, emit `Content-Security-Policy: script-src 'self' 'nonce-X' 'strict-dynamic' …` plus the rest of the current SPA CSP directives.
  3. **Build the Redis pub/sub channel**: add `LEGAL_REVALIDATION_CHANNEL = 'legal:revalidated'`. Publisher in `legal-pubsub.ts` exposes `publishLegalRevalidation({type, jurisdiction?})`. Subscriber wraps `ioredis` subscribe + emits events to consumers.
  4. SSE endpoint at `/legal/revalidations`: subscribes to Redis channel, streams events as `text/event-stream` so the SPA can hold one long-lived connection per tab.
- **Verification**:
  - `pnpm typecheck --filter @contractor-ops/api` green.
  - New `apps/web-vite-edge/src/__tests__/nonce-injection.test.ts` (3 cases: nonce injected into all `<script>` tags; matching CSP header emitted; nonce changes per request).
  - New `apps/api/src/__tests__/legal-revalidations-sse.test.ts` (2 cases: subscriber receives published events; client disconnect cleans up subscriber).
  - Render preview deploy of the new edge service serves `index.html` with a valid nonce-bearing CSP.
- **Risk**: introducing a new deploy target adds blast radius. Mitigation: Wave 3 is the cutover step — Wave 1 only stands up the edge runtime in parallel; the existing static deploy keeps serving traffic until Wave 3.

### Wave 2 — P0 code-only fixes (5 parallel agents)

Each agent is bounded to one P0 gap, lands an atomic `fix(restoration): GAP-…` commit + a regression test + a restoration-report.md row update.

#### Wave 2 — Agent A: GAP-OBSERVABILITY-012 (PostHog post-signup hook)

- **Touches**: `packages/auth/src/config.ts` (extend `databaseHooks.user.create.after`); `packages/auth/src/env.ts` (add `POSTHOG_PROJECT_API_KEY`); `render.yaml` (api service env block); `packages/auth/package.json` (`posthog-node` dep, 7-day age confirmed); `packages/auth/src/__tests__/config.test.ts` (extend with 2 cases — capture + alias).
- **Method**: read existing `databaseHooks.user.create.after` (line ~285) and append a `posthog.capture({distinctId: user.id, event: 'signup_completed'})` + `posthog.alias({distinctId: user.id, alias: anonDistinctIdFromCookie})` block. Anonymous distinct_id source: read PostHog `ph_<project-key>_posthog` cookie from request headers (Better Auth has access to request); if absent (server-side signup flow without browser context), skip alias and capture only.
- **Verification**: `pnpm --filter @contractor-ops/auth test -- src/__tests__/config.test.ts` (extended count: prior + 2 new = pass). `pnpm typecheck` clean.

#### Wave 2 — Agent B: GAP-TEST-015 (Stripe webhook idempotency)

- **Touches**: `apps/api/src/__tests__/stripe-webhook.test.ts` (new); no source edits (the existing handler already implements idempotency via `StripeEvent.processedAt`).
- **Method**: build a Fastify test instance + prisma test fixture, post a Stripe-signed webhook payload twice with the same event id; assert second call short-circuits without re-processing. Assert handler-throw path leaves `processedAt` null so Stripe retries.
- **Verification**: `pnpm --filter @contractor-ops/api-server exec vitest run src/__tests__/stripe-webhook.test.ts` (4 cases pass).

#### Wave 2 — Agent C: GAP-TEST-021 (intake cross-org IDOR — tRPC audit + route-guard test)

- **Touches**: `packages/api/src/routers/invoices/intake.ts` (verify `where: {organizationId: ctx.organizationId}` on the `get` procedure; add if missing); `apps/web-vite/src/pages/__tests__/intake-detail.test.tsx` (new route-guard test).
- **Method**: read the existing `intake.get` procedure; if it does not scope by `organizationId`, add the scope filter. Write a route-guard test using msw to mock `intake.get` returning a TRPC NOT_FOUND error for cross-org request, assert the SPA navigates to `/not-found` (or matches the parity-with-legacy behavior — verify legacy redirect target via `git show 7fce0d83:apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/page.tsx`).
- **Verification**: `pnpm typecheck` + the new vitest file (3 cases pass).

#### Wave 2 — Agent D: GAP-TEST-026 (privacy DE PDF jurisdiction guard — verify-then-test)

- **Touches**: `packages/api/src/__tests__/privacy-pdf-guard.test.ts` (new) AND possibly `packages/api/src/services/exports/index.ts` if the IDOR-safe-by-construction claim doesn't hold.
- **Method**: **CRITICAL — verify before fixing.** The audit row says `assertJurisdictionOrReject` is missing → enforcement gap. But `packages/api/src/routers/core/legal.tsx:23-49` shows the router uses `z.object({}).optional()` input schema (never accepts user-supplied jurisdiction) AND delegates to `requestExport({type:'gdpr-privacy-notice',params:{}})`. Step 1: read `packages/api/src/services/exports/index.ts` and confirm the `gdpr-privacy-notice` exporter resolves jurisdiction from `organizationId` only (not from `params`). If true, the IDOR is structurally unreachable → close GAP-TEST-026 as `closed-verified-intentional` with a regression test asserting `params.jurisdiction` is ignored even when injected. If false, port `assertJurisdictionOrReject` per the original audit plan.
- **Verification**: new test file passes; restoration-report.md row carries the verification narrative (intentional vs guard-added).

#### Wave 2 — Agent E: GAP-SECURITY-002 closure (R2 wildcard documented acceptance + CI guardrail)

- **Touches**: `apps/web-vite/scripts/check-r2-iframe-sandbox.mjs` (new); `package.json` root (`check:r2-iframe-sandbox` script); `docs/security/csp-r2-wildcard.md` (new); `.planning/risk-register.md` (new or extended); `.github/workflows/ci.yml` (wire new gate).
- **Method**: write a node script that walks `apps/web-vite/src/**/*.tsx`, finds `<iframe>` literals + JSX `<iframe>` elements, resolves their `src=` prop, and rejects when `src` matches an R2 host (`*.r2.cloudflarestorage.com`, `*.amazonaws.com`, or the local MinIO host) AND `sandbox=` is missing or wider than `"allow-downloads"`. Write the acceptance note explaining multi-provider reality (prod R2, local MinIO, both wildcarded). Add risk-register entry.
- **Verification**: script returns OK on current tree; intentional fail-test with a synthetic broad-sandbox iframe returns non-zero.

### Wave 3 — P0 wiring + cutover

- **Touches**:
  - `apps/web-vite/src/components/legal/legal-{terms,privacy,sub-processors,breach-notification}-container.tsx` (wire `trpc.legal.getDocument.useQuery` + CmsLexicalRenderer + static-i18n fallback).
  - `apps/web-vite/src/components/legal/cms-lexical-renderer.tsx` (already exists per audit-report.md).
  - `apps/web-vite/src/hooks/useLegalRevalidations.ts` (new — opens SSE connection on mount, calls `queryClient.invalidateQueries(['legal-content', type, jurisdiction])` on each event).
  - `packages/api/src/routers/core/legal.tsx` (extend with `getDocument({type, jurisdiction?, locale})` reading from Payload local API).
  - `packages/api/src/routers/core/index.ts` (ensure `legalRouter` is mounted; verify already).
  - `apps/api/src/routes/revalidate-legal.ts` (replace the stub `log + breadcrumb` with `publishLegalRevalidation(...)` call to the Wave 1 pub/sub).
  - `render.yaml` (cut SPA traffic over to the edge runtime built in Wave 1; retire the static-deploy block OR keep as fallback).
- **Method**:
  1. Land `legal.getDocument` procedure: input `{type: enum, jurisdiction: enum.optional(), locale: enum}`, output `{body: LexicalContent, version: string, effectiveDate: Date} | null`. Read from Payload local API using the existing Payload client.
  2. Wire the 4 legal containers: useQuery → render CmsLexicalRenderer when data present → fall back to static i18n when null.
  3. Wire SSE subscriber hook (`useLegalRevalidations`) at the route shell layer so all 4 containers share one connection.
  4. Replace revalidate-legal stub with publisher call.
  5. Render-side cutover for GAP-SECURITY-001: flip the `web-vite` service to the new edge runtime; smoke test that the SPA loads + the CSP report endpoint receives zero violations against the legitimate bundle.
- **Verification**:
  - `pnpm typecheck` clean.
  - `pnpm --filter @contractor-ops/api-server test` (extended with `revalidate-legal.test.ts` + `legal-router.test.ts`).
  - `pnpm --filter @contractor-ops/web-vite exec vitest run src/components/legal/__tests__/` (new container tests pass).
  - Manual: publish a test legal doc via Payload, observe the SPA's container re-render within ~1s (SSE) without page reload.
  - 48h soak on the edge runtime: `/csp-report` endpoint shows zero violations against the legitimate bundle.

### Wave 4 — P1 cluster A — security + auth + portal + legal (4 parallel agents)

- **Agent F**: GAP-SECURITY-008 (Teams JWT `AZURE_BOT_APP_ID` prod guard) — add hard-throw in `getAuthConfig()` + `.refine` on env schema.
- **Agent G**: GAP-PAGE-002 + GAP-TEST-024/025 (privacy jurisdiction resolver + tests) — port `resolvePrivacyRedirect` to web-vite, wire into `legal-privacy-container.tsx`, add the 10 `it.each` cases for GB/DE/AE/SA + EU fallback.
- **Agent H**: GAP-TEST-011 / GAP-TEST-016 / GAP-TEST-017 / GAP-TEST-018 (login credential unit + portal set/clear-session route-level + revalidate-legal HMAC tests) — vitest test files only; sources already exist.
- **Agent I**: GAP-TEST-019 (deriveComplianceStatus precedence) — vitest test next to `columns.tsx`, 4 rules + null-safety case.

### Wave 5 — P1 cluster B — observability + middleware + routes (3 parallel agents)

- **Agent J**: Observability P1s — re-enable `replayIntegration` (GAP-OBSERVABILITY-001), `feedbackIntegration` (GAP-OBSERVABILITY-002), finish source-map upload pipeline on Node services (GAP-OBSERVABILITY-009 partial → full + GAP-OBSERVABILITY-010), add `tunnel: '/monitoring'` (GAP-OBSERVABILITY-011) + Fastify proxy route.
- **Agent K**: Middleware P1s — GAP-MIDDLEWARE-003 (portal subdomain decision + doc update OR resurrection if needed), GAP-MIDDLEWARE-005 (Accept-Language → locale prefix router-root loader).
- **Agent L**: Routes P1s — GAP-ROUTE-004 (`/api/*` prefix decision + ops Slack to re-register external publishers OR add reverse-proxy strip-prefix in render.yaml), GAP-ROUTE-005 (peppol/poll iteration restore connection-first loop), GAP-ROUTE-002 (Teams SDK swap smoke test).

### Wave 6 — P1 cluster C — UX (3 parallel agents)

- **Agent M**: i18n currency parity — GAP-I18N-001 (re-introduce `useActiveLocale()`-aware currency helper + update 35 call-sites) + GAP-I18N-002 (fraction-digits default restore).
- **Agent N**: Intake-detail UX — GAP-PAGE-008 (404 vs unauthorized branch) + GAP-TEST-020 (EXTENDED banner + pane composition test).
- **Agent O**: Admin URL shape — GAP-PAGE-006/007 (locale-prefix redirects from legacy URLs).

### Wave 7 — P2 cluster (5 parallel agents)

- **Agent P**: i18n P2s — GAP-I18N-003 (translation backfill), GAP-I18N-005 already inline-fixed (skip).
- **Agent Q**: Test coverage backfill — GAP-TEST-005..010 (auth Zod, invite-accept defaults, social Microsoft, URL state, invoices status chip, dashboard greeting/empty-state).
- **Agent R**: Cosmetic regressions — GAP-MIDDLEWARE-001 (rate-limit bucket sub-prefix isolation if needed), GAP-MIDDLEWARE-002 (LOAD_TEST_BYPASS restore behind env), GAP-MIDDLEWARE-004 (cookie-shape guard restore), GAP-MIDDLEWARE-006 (substring sniff → length+charset cheap guard), GAP-OBSERVABILITY-004 (SPA source-map plugin wiring), GAP-OBSERVABILITY-013 (web-vitals CSRF verify test).
- **Agent S**: Page shell rows — GAP-PAGE-009 (LegalShell layout component), GAP-PAGE-010 (portal pre-auth subdomain branding decision + impl OR doc).
- **Agent T**: Security P2s — GAP-SECURITY-006 (LOAD_TEST_BYPASS — paired with Agent R's MIDDLEWARE-002), GAP-SECURITY-007 (connect-src DocuSign — verify zero direct call-sites then either restore or document closed).

### Wave 8 — Pre-existing test fixes (FOLLOWUP-PRE-EXISTING-001)

- **Touches**:
  - `apps/web-vite/src/hooks/use-approval-actions.ts` and/or `apps/web-vite/src/hooks/__tests__/use-approval-actions.test.tsx` (fix the 5 toast-message assertion failures — likely a literal string mismatch in source or test).
  - `apps/web-vite/src/components/dashboard/dashboard-home-container.tsx` and/or `apps/web-vite/src/components/dashboard/__tests__/dashboard-home-container.test.tsx` (fix the Vite import-resolution failure — likely a missing `DashboardIllustration` export from `@contractor-ops/ui` after `e95e4e75` rewrote imports).
- **Method**: run each test file with direct vitest, read the failure, fix the source or test (whichever is correct per legacy behavior verified via `git show 7fce0d83:<legacy-path>`), re-run, confirm green.
- **Verification**: both test files pass on a clean tree; full `pnpm --filter @contractor-ops/web-vite test -- src/` shows 0 failed.

### Wave 9 — Final verification + gate

- **Commands** (in order):
  - `pnpm typecheck`
  - `pnpm --filter @contractor-ops/api-server test`
  - `pnpm --filter @contractor-ops/cron-worker test`
  - `pnpm --filter @contractor-ops/public-api test`
  - `pnpm --filter @contractor-ops/auth test`
  - `pnpm --filter @contractor-ops/web-vite test -- src/`
  - `pnpm check:web-vite-data-layer`
  - `pnpm check:web-vite-page-shells`
  - `pnpm check:r2-iframe-sandbox` (new gate from Wave 2 Agent E)
  - `pnpm audit` + `pnpm security:scan`
  - Playwright e2e suite — `apps/web-vite/e2e/` (full run, not memory-pressured because no full vitest suite running concurrently).
  - 48h CSP soak result documented (zero violations on legitimate bundle).
- **Restoration report final pass**: every audit-report.md row reflected with new status; Summary table cells recomputed; "Restoration log" appendix lists every commit SHA per gap.
- **Gate**: `plannotator annotate goals/post-migration-parity-restoration/restoration-report.md --gate`.

## Open questions / risks worth flagging now

- **Edge-runtime choice** (Wave 1): the plan assumes `apps/web-vite-edge` as a sibling Fastify app on Render rather than Cloudflare Worker. If Cloudflare Worker is preferred (lower latency, no Render Web Service cost), Wave 1 forks into a different sub-plan: `.cloudflare/workers/web-vite-csp/` + Cloudflare deploy pipeline + cross-account auth between Render-hosted API and Cloudflare-served SPA. Decision before Wave 1 starts.
- **`assertJurisdictionOrReject` may not be needed** (Wave 2 Agent D): the audit's GAP-TEST-026 claim was that the guard is missing. `legal.tsx:23-49` (already verified read) accepts no user-supplied jurisdiction (`z.object({}).optional()`) and the comment explicitly calls out "IDOR-safe by construction". Wave 2 Agent D's first step must verify `requestExport` for `gdpr-privacy-notice` reads jurisdiction from org only; if true, close as `closed-verified-intentional`. Otherwise port the guard. Do not assume the audit's framing is correct — verify, then act.
- **`/api/*` prefix decision** (Wave 5 Agent L): GAP-ROUTE-004 is conditional P0 (elevation if any external publisher is still pointed at legacy URL). The fix is either (a) reverse-proxy strip-prefix in render.yaml OR (b) re-register every external webhook URL in each provider portal (Stripe, Storecove, InPost, Microsoft Bot Framework, Payload CMS). Provider-portal updates are ops work, not code work — coordinate with ops before Wave 5 starts.
- **Legal CMS `getDocument` shape**: the new procedure reads from Payload local API. Payload local API requires the Payload instance to be importable at runtime from `apps/api`. Check `packages/api/src/services/payload-client.ts` (or equivalent) — if no Payload client exists in apps/api, Wave 3 needs a sub-step to add it. Verify before Wave 3.
- **Redis instance** (Wave 1): the plan assumes apps/api already has an `ioredis` client (used for QStash, rate-limit, etc.). If the rate-limit Upstash uses HTTP API rather than Redis protocol, the pub/sub plan needs a real Redis dep (separate Upstash Redis or Render Redis instance). Verify with `grep -nE "(createClient|new Redis|ioredis)" apps/api/src/` before Wave 1.
- **Test scoping**: every wave's verification step uses scoped `pnpm --filter` invocations per CLAUDE.md memory rule. Wave 9 is the only step that runs the full web-vite test suite — and only after the FOLLOWUP-PRE-EXISTING-001 fixes land in Wave 8, so 0 failures are expected.
- **Sibling commit policy** (Wave 0): the 13 sibling-agent UI commits already landed unreviewed. The plan's review pass surfaces new gaps without reverting any commit. If the review finds a P0 introduced by a sibling commit, escalate per the audit's P0 protocol (atomic fix commit `fix(restoration): GAP-SIBLING-NNN <one-line>`).
- **Better Auth post-signup cookie source** (Wave 2 Agent A): PostHog anonymous distinct_id is stored in a browser cookie by the JS SDK. The server-side `databaseHooks.user.create.after` runs after the auth request lands — request headers should be accessible via Better Auth's hook context. If not, the alias step skips (capture-only) and the funnel still works but loses the anonymous→authed stitch. Verify Better Auth hook signature gives access to the incoming request.
- **Sibling commit `4c83feb8`** (Sentry dev hard-disable on api + cron-worker + public-api): already landed; appears to be a sibling-agent fix for GAP-OBSERVABILITY-006 on the backend side (mirroring the SPA fix in `6092d0e9`). Wave 0 review confirms; possibly closes additional rows without explicit audit mapping.
