# Post-migration parity audit report

> Status: **in progress** — Steps 2–8 swept read-only via parallel subagents; per-area `findings.md` artifacts under `.audit-scratch/<area>/`. Numbers below are draft gap rows pending the restoration agent's pass + verification commands (Step 10). No source files were edited during this aggregation pass. Companion agent owns Step 9 (P0 inline fixes); rows below carry the proposed severity and evidence only.

## Baseline

- **Cutover commit (deletion of `apps/web/`)**: `62a97d73` — `chore(repo): remove apps/web — migrated to apps/web-vite`
- **Baseline ref used by audit (`62a97d73^`)**: resolved SHA `7fce0d83c8738aed36d55cd642dec4c7902b36fb`
- **Cutover deletion volume**: 1359 files / 229933 deletions (per `git show 62a97d73 --stat`)
- **Audit branch**: `audit/post-migration-parity` (cut from `dry-solid-audit/extract-shared` @ `4fefacb36d67fd877fe831ffdcab078f59393d6a`)
- **Scratch dir** (gitignored): `.audit-scratch/`

### Legacy inventory (verified counts @ `7fce0d83`)

| Area | Path | Count |
|------|------|------:|
| Pages (`page.tsx`) | `apps/web/src/app/**` | 68 |
| API route handlers (`route.ts`) | `apps/web/src/app/api/**` | 41 |
| Middleware (lines) | `apps/web/src/middleware.ts` | 739 |
| Lib files | `apps/web/src/lib/**` | 46 |
| Locale files | `apps/web/messages/*.json` | 4 |
| E2E spec files (`*.spec.ts`) | `apps/web/e2e/**` | 42 |
| E2E tree total (specs + helpers) | `apps/web/e2e/**` | 51 |
| Full `apps/web/src/**` tree | (incl. components, hooks) | 1272 |
| Unit/component tests in legacy `apps/web/**` | (excl. `e2e/`) | 521 |

### Current inventory (verified counts @ `HEAD` of `audit/post-migration-parity`)

| Area | Path | Count |
|------|------|------:|
| Pages | `apps/web-vite/src/pages/**/*.tsx` | 67 |
| Fastify route files | `apps/api/src/routes/**/*.ts` | 21 |
| E2E spec files | `apps/web-vite/e2e/**/*.spec.ts` | 42 |
| Locale files | `apps/web-vite/messages/*.json` | 4 (en/de/pl/ar) |
| Unit/component tests (web-vite) | `apps/web-vite/**/*.test.{ts,tsx}` | 675 |
| Unit tests (api) | `apps/api/**/*.test.ts` | 22 |
| Unit tests (cron-worker) | `apps/cron-worker/**/*.test.ts` | 13 |
| Unit tests (packages) | `packages/**/*.test.ts` | 435 |

## Severity rubric

| Severity | Definition |
|----------|-----------|
| **P0** | Auth break, payment / money flow break, data loss / tenant leak, regulatory webhook break (KSeF / ZATCA / Peppol / Storecove). Inline-fix during audit window or escalate with named blocker. |
| **P1** | User-facing feature regression that does not lose data and is not in a P0 category. |
| **P2** | i18n string gap, test coverage gap, doc gap, cosmetic regression. |

Gap ID schema: `GAP-<AREA>-<NNN>`, areas ∈ {`PAGE`, `ROUTE`, `WEBHOOK`, `MIDDLEWARE`, `I18N`, `OBSERVABILITY`, `SECURITY`, `TEST`}. Numbering is stable per area; rows never renumber after publication.

Row fields (mandatory): `ID | area | legacy path | new path (or MISSING) | severity | evidence (file:line + git show 62a97d73^:<path> excerpt) | status (open / inline-fixed / deferred) | remediation`.

## Summary table

> Cells = `open / inline-fixed / deferred` counts. All rows currently `open` pending the restoration agent's pass and the verification step.

| Area | P0 | P1 | P2 |
|------|----|----|----|
| PAGE | 0 / 0 / 0 | 5 / 0 / 0 | 3 / 0 / 0 |
| ROUTE | 0 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 |
| WEBHOOK | 0 / 0 / 0 | 1 / 0 / 0 | 0 / 0 / 0 |
| MIDDLEWARE | 0 / 0 / 0 | 2 / 0 / 0 | 3 / 0 / 0 |
| I18N | 0 / 0 / 0 | 0 / 0 / 0 | 5 / 0 / 0 |
| OBSERVABILITY | 0 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |
| SECURITY | **3 / 0 / 0** (2 escalated — see GAP-SECURITY-001, -002) | 2 / 0 / 0 | 1 / 0 / 0 |
| TEST | 0 / 0 / 0 | 2 / 0 / 0 | 7 / 0 / 0 |
| **Total** | **3 / 0 / 0** | **16 / 0 / 0** | **23 / 0 / 0** |

P0 escalation candidates (severity may move to P0 after restoration-agent / legal review):

- `GAP-PAGE-002` — privacy index drops session-based jurisdiction redirect (GDPR Art. 13 implication if GB/DE/KSA tenants live).
- `GAP-ROUTE-002` — `/api/teams/messages` SDK swap (`botbuilder` → `@microsoft/agents-hosting`) — runtime parity unverified.
- `GAP-WEBHOOK-003` — Peppol AS4 `GET`/`PUT` returns `404` (Fastify default) instead of legacy `405` — RFC 7231 violation; partner Access Points may interpret 404 as deployment loss.

---

## Page parity

> Source: `.audit-scratch/pages/{reconciliation.csv,legacy-pages.txt,new-pages.txt}`. 68 legacy → 68 matched → 0 MISSING → 5 suspected regressions + 3 URL-shape / UX divergences.

### Gaps

| ID | Legacy path | New path or MISSING | Sev | Evidence | Status | Remediation |
|----|-------------|---------------------|-----|----------|--------|-------------|
| GAP-PAGE-001 | `apps/web/src/app/[locale]/(legal)/legal/breach-notification/page.tsx` | `apps/web-vite/src/components/legal/legal-breach-notification-container.tsx:17-32` | P1 | Legacy fetched `fetchLegalDocument` + rendered `<CmsLexicalRenderer>`; new is i18n-only fallback — CMS-authored copy unreachable. | open | Add SPA-side `fetchLegalDocument` helper (tRPC into Payload CMS); reuse `CmsLexicalRenderer` already present at `apps/web-vite/src/components/legal/cms-lexical-renderer.tsx`. |
| GAP-PAGE-002 | `apps/web/src/app/[locale]/(legal)/legal/privacy/page.tsx:32-41` | `apps/web-vite/src/components/legal/legal-privacy-container.tsx:20-36` | P1 (P0 candidate) | Legacy did session-based redirect to `/legal/privacy/{gb,de,eu}`; new shows EU content to ALL users → GDPR / UK-GDPR jurisdictional-notice exposure. `PRIVACY_JURISDICTION_SLUGS` still defined in `privacy-jurisdiction-resolve.ts:7` but no caller. | open | Restore session-based jurisdiction selection in `legal-privacy-container.tsx`; reuse existing `isPrivacyJurisdictionSlug` + `JURISDICTION_LABEL` helpers. Escalate to P0 if GB/DE/KSA tenants are live or legal sign-off requires per-jurisdiction notice. |
| GAP-PAGE-003 | `apps/web/src/app/[locale]/(legal)/legal/privacy/[jurisdiction]/page.tsx` | `apps/web-vite/src/components/legal/legal-privacy-jurisdiction-container.tsx` | P1 | Lost CMS fetch (`fetchLegalDocument({type:'privacy',jurisdiction})`) + `versionLabel` from CMS `version` / `effectiveDate`. Static `PrivacyNoticeStructuredContent` only. | open | Same as GAP-PAGE-001 — single CMS-fetch tRPC helper covers all 4 legal pages. |
| GAP-PAGE-004 | `apps/web/src/app/[locale]/(legal)/legal/sub-processors/page.tsx` | `apps/web-vite/src/components/legal/legal-sub-processors-container.tsx` | P1 | CMS-fetch loss; container is static i18n. | open | Same as GAP-PAGE-001. |
| GAP-PAGE-005 | `apps/web/src/app/[locale]/(legal)/legal/terms/page.tsx` | `apps/web-vite/src/components/legal/legal-terms-container.tsx` | P1 | CMS-fetch loss; container is static i18n. | open | Same as GAP-PAGE-001. |
| GAP-PAGE-006 | `apps/web/src/app/(admin)/admin/boe-rate/page.tsx` | `apps/web-vite/src/pages/admin/boe-rate.tsx` | P2 | URL shape changed: legacy unlocalized `/admin/*` → new `/:locale/admin/*`. Bookmarks / external links 404. Loader gate via `requirePlatformOperator` works. | open | Add a `redirect()` route from unlocalized `/admin/*` → `/:locale/admin/*` (or accept admin-only blast radius). |
| GAP-PAGE-007 | `apps/web/src/app/(admin)/admin/feature-flags/classification-engine/page.tsx` | `apps/web-vite/src/pages/admin/classification-engine.tsx` | P2 | Double URL shape change (locale prefix added + `feature-flags/` segment dropped → `/:locale/admin/classification-engine`). | open | Same as GAP-PAGE-006; consider keeping `feature-flags/` group for consistency. |
| GAP-PAGE-008 | `apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/page.tsx` (flag-off branch) | `apps/web-vite/src/pages/invoices/intake-detail.tsx` | P2 | Legacy `notFound()` → new `<Navigate to="/unauthorized">`; minor existence-leak / UX divergence. | open | Render a 404 element instead of redirecting to `/unauthorized` when the flag is off. |

### Ported appendix

All other 60 legacy pages match new web-vite pages on URL pattern, auth gate, and component shape. 12 high-risk pages were sampled deep (payments, invoices, contracts, approvals, classification, settings index, e-invoicing log, ZATCA, invoice intake detail, portal invoice submit, portal contract detail, the 4 legal pages) — outside the gaps above, columns / filters / toolbars / side-panels / dialogs / empty-loading-error states all match legacy. Full table at `.audit-scratch/pages/reconciliation.csv`.

### Out-of-scope notes

- New addition (no legacy counterpart): `/:locale/portal/signatures` + `PortalPendingSignaturesContainer`. Not a regression — verify with restoration agent it is intentional vs accidentally restored from a stale branch.
- `PLATFORM_OPERATOR_ORG_ID` is now build-time inlined as `VITE_PLATFORM_OPERATOR_ORG_ID` (no longer secret); server tRPC `auth.isPlatformOperator` remains authoritative. Documented at `apps/web-vite/src/lib/require-platform-operator.ts`. Not a gap.

---

## API route parity

> Source: `.audit-scratch/routes/{reconciliation.csv,webhook-matrix.csv,legacy-routes.txt,new-routes.txt}`. 41 legacy → 41 matched (12 cron folded into in-process `apps/cron-worker`, 2 tRPC + 1 auth catch-all folded into Fastify plugins, 4 oauth/portal/peppol/webhook files merge multi-path).

### Gaps

| ID | Legacy path | New path or MISSING | Sev | Evidence | Status | Remediation |
|----|-------------|---------------------|-----|----------|--------|-------------|
| GAP-ROUTE-001 | `apps/web/src/app/.well-known/security.txt/route.ts` | `apps/landing/out/<locale>/security.txt` (static) | P2 | Moved from Next API to Next-static landing build. Production reverse proxy must serve `/.well-known/security.txt` without locale prefix; RFC 9116 path may 404 if locale is required. | open | Verify Render/landing rewrite rule for `/.well-known/security.txt` → unlocalized static asset; otherwise mount a Fastify route in `apps/api` for unlocalized passthrough. |
| GAP-ROUTE-002 | `apps/web/src/app/api/teams/messages/route.ts` | `apps/api/src/routes/teams.ts` | P1 (P0 candidate) | SDK swap `botbuilder` → `@microsoft/agents-hosting` (2026-05-22 commit). Auth flow rewritten with hand-rolled Fastify→Express shim around `authorizeJWT` + `CloudAdapter.process`. Static parity matches but JWT issuer / multi-tenant behavior is now implicit (legacy: `ConfigurationBotFrameworkAuthentication(process.env)` with `MicrosoftAppType`). | open | Add a bot-framework smoke test that exercises a real Teams channel post. Until verified, treat as P0 candidate. |
| GAP-ROUTE-003 (pre-existing) | `apps/web/src/app/api/oauth/[provider]/callback/route.ts` | `apps/api/src/routes/oauth.ts` | P1 (pre-existing) | Neither legacy nor new `/oauth/:provider/callback` calls `writeAuditLog` on credential upsert. Inherited gap, not a regression. | open | Out-of-scope of this audit window — log as follow-up. |

### Ported appendix

- `withBackpressure` + `BackpressureRoutes.*` retained in `exports/_process`, `ocr/_process`, `late-interest/_render-claim-pdf`, `peppol/outbound` (verified).
- tRPC body cap `TRPC_MAX_BODY_MB` 413 short-circuit retained in `apps/api/src/plugins/trpc.ts`; server-level `bodyLimit: 5 MiB`.
- All other 38 legacy routes match new tree on method matrix, status branches, audit log, tenant scope, rate-limit, signature verify, idempotency. Full method matrix at `.audit-scratch/routes/reconciliation.csv`.

### Cron schedule status

**Zero risk of QStash POSTing to a non-existent URL.** All 12 legacy `apps/web/src/app/api/cron/**` HTTP routes folded into in-process `node-cron` under `apps/cron-worker/src/jobs/handlers/`; registry at `apps/cron-worker/src/jobs/registry.ts`. `render.yaml:584-611` declares only the `cron-worker` background worker (no Upstash schedule). Trade-off: cron-worker now a single-point-of-failure (no Upstash redundancy) — flag for separate threat-model note, not a routing P1.

QStash callback URLs (producer-side, not schedules) — `/api/webhooks/_process`, `/api/exports/_process`, `/api/ocr/_process`, `/api/ksef/_sync`, `/api/google-workspace/_sync`, `/api/peppol/{inbound,outbound,poll}`, `/api/zatca/_submit`, `/api/outbox/_drain`, `/api/late-interest/_render-claim-pdf` — all map to existing Fastify routes. No dangling producer.

### Better Auth sub-path status

Better Auth uses a Fastify catch-all `app.all('/api/auth/*', …)` in `apps/api/src/plugins/auth.ts` delegating to `auth.handler(Request)`. **Every Better Auth sub-path is consequently reachable** — `sign-in/email`, `sign-up/email`, `sign-out`, `get-session`, `forget-password`, `reset-password`, `verify-email`, magic-link, OAuth callbacks, social. No sub-path is statically declared so none can be silently broken. Raw-body parser is plugin-scoped so JSON sibling routes are unaffected. Observability parity preserved: per-request Pino log + Sentry capture on 5xx + ALS frame seeded via parent `request-context` plugin.

---

## Webhook parity (sub-section of API route parity)

> Source: `.audit-scratch/routes/webhook-matrix.csv`. Per-webhook: signature verify, idempotency, dead-letter, ALS trace, Sentry-on-failure.

### Gaps

| ID | Legacy path | New path or MISSING | Sev | Evidence | Status | Remediation |
|----|-------------|---------------------|-----|----------|--------|-------------|
| GAP-WEBHOOK-001 | `apps/web/src/app/api/webhooks/inpost/route.ts` non-prod fallback | `apps/api/src/routes/webhooks/inpost.ts` | P1 (pre-existing) | Both legacy and new keep an unsigned-payload fallback gated by `NODE_ENV !== 'production'`. If `NODE_ENV` is mis-set on preview/staging pods, attacker can forge `DELIVERED` events. Tracked elsewhere as F-SEC-06. | open | Remove the unsigned fallback unconditionally OR pin the env-check to a `STRICT_INPOST_SIGNATURE` boolean. |
| GAP-WEBHOOK-003 | `apps/web/src/app/api/webhooks/peppol/**/route.ts` (AS4) | `apps/api/src/routes/webhooks/peppol.ts` | P1 (P0 candidate) | Fastify default returns `404` for unregistered HTTP verbs on a mounted path; legacy returned explicit `405 Method Not Allowed`. Peppol AS4 partner Access Points may interpret 404 as "endpoint gone" → silently stop retries. Test drift recorded at `apps/web-vite/e2e/integration/peppol-inbound-smoke.spec.ts:115-128`. | open | Register a `405` handler for the AS4 webhook path with explicit `Allow: POST` header (RFC 7231 compliance). |

### Ported appendix

- `_process` dead-letter: `WebhookDelivery` row + `FAILED` status + replay cron path retained; compare-and-swap `RECEIVED|FAILED → PROCESSING` preserves at-least-once safety.
- ALS reseed on QStash drain: `guardQStashRequest` calls `buildContextFromHeaders` + `runWithRequestContext` — correlation IDs follow the job (F-OBS-03).
- Stripe (`constructEvent`), Storecove (`StorecoveAdapter.verifyWebhookSignature`), InPost (`verifyInPostSignature`), QStash (`Receiver.verify` via `guardQStashRequest`), per-connection Jira/Linear HMAC, `portal/set-session` HMAC, `revalidate-legal` HMAC — all retained byte-identical or via same SDK helper. Idempotency (`StripeEvent.processedAt`, Storecove `guid`, ZATCA `zatcaStatus`, `WebhookDelivery` compare-and-swap) retained. Tenant scope on every signed endpoint resolved server-side. Regulatory webhooks (KSeF, ZATCA, Peppol in/out/poll, Storecove) all present + signed.

---

## Middleware parity

> Source: `.audit-scratch/middleware/{behavior-blocks.md,legacy-middleware.ts}`. 26 numbered behavior blocks: 17 equivalent (incl. stronger), 4 weaker, 3 dropped, 2 Next-specific.

### Gaps

| ID | Legacy line range | New home | Sev | Evidence | Status | Remediation |
|----|-------------------|----------|-----|----------|--------|-------------|
| GAP-MIDDLEWARE-001 | `apps/web/src/middleware.ts` rate-limit bucket | `apps/api/src/plugins/rate-limit.ts:43-94` | P2 | api rate-limit bucket broadened beyond `/api/trpc/*` (now all `/api/*`). Slightly weaker isolation between tRPC and REST traffic. | open | Add per-prefix sub-buckets if isolation needed; otherwise accept as design change. |
| GAP-MIDDLEWARE-002 | LOAD_TEST bypass block | DROPPED | P2 | Legacy supported constant-time-compared `x-load-test-secret` header to skip rate-limit for k6 staging runs. Removed in new stack. Operational hatch only. | open | Restore behind `LOAD_TEST_BYPASS_SECRET` env if k6 staging runs are still planned; otherwise leave dropped. |
| GAP-MIDDLEWARE-003 | Portal subdomain rewrite `x-portal-org-subdomain` | DROPPED | P1 | Architectural change — org now resolved from session, not subdomain. `*.PORTAL_BASE_DOMAIN` referenced only in doc comments (`packages/api/src/routers/portal/portal.ts:80`); runtime org resolution uses session. Safe at data layer but breaks any external link expecting `<org>.portal.contractor-ops.com`. | open | Confirm with restoration agent: is subdomain-per-org public URL contract retired? If yes, update marketing copy + docs. |
| GAP-MIDDLEWARE-004 | Logged-in-on-`/login` bounce block | DROPPED | P2 | Authenticated user landing on `/login` no longer auto-redirected to dashboard. UX-only regression. | open | Add `requireAnonymous` loader on `/login` route in `apps/web-vite/src/router.tsx`. |
| GAP-MIDDLEWARE-005 | Edge Accept-Language → locale prefix rewrite | DROPPED | P1 | First paint now always `pl` (router-level default) regardless of `Accept-Language`. P1 because first-visit UX regresses for non-PL browsers. | open | Add an `Accept-Language` parsing loader at the router-root level OR a small landing redirect in `index.html`. |

### Behavior-block map

Full numbered list (26 blocks) at `.audit-scratch/middleware/behavior-blocks.md`. Highlights:

- Equivalent / stronger: CSRF origin guard (`apps/api/src/plugins/csrf-origin.ts:29-54`); per-portal cookie `HttpOnly; Secure; SameSite=Strict` stricter than legacy Better Auth cross-subdomain cookie (`apps/api/src/routes/portal-session.ts:60-67`); API CSP `script-src 'none'` strictly stricter than legacy SPA CSP.
- Next-specific noise (intentional drop, justified): CSP nonce mint (architectural — static SPA), portal subdomain header (architectural — session-based).

---

## i18n parity

> Source: `.audit-scratch/i18n/{flatten.mjs,*.tsv,*.md,formatter-parity.md,message-source-plumbing.md}`. Per-locale key parity:

| Locale | Legacy | New | Missing | Extra | Shape regressions | Rename suspects |
|--------|------:|----:|--------:|------:|------------------:|----------------:|
| en | 6,036 | 6,280 | **0** | 244 | 0 | 0 |
| de | 6,005 | 6,280 | **0** | 275 | 0 | 0 |
| pl | 6,005 | 6,280 | **0** | 275 | 0 | 0 |
| ar | 6,005 | 6,280 | **0** | 275 | 0 | 0 |

Zero key losses across ~24k shared-key comparisons. Zero ICU shape regressions.

### Gaps

| ID | Surface | New path | Sev | Evidence | Status | Remediation |
|----|---------|----------|-----|----------|--------|-------------|
| GAP-I18N-001 | Currency formatting | `packages/shared/src/money.ts` + 35 call-sites under `apps/web-vite/src/components/{payments,portal,invoices,time,reports,dashboard}/**` | P2 (P1 on invoice/payment surfaces) | `useCurrencyFormatter` hook removed; 14× `formatMinorAsCurrency` + 21× raw `Intl.NumberFormat` hardcode locale (`'pl-PL'`, `'de-DE'`, `'en-US'`, `'en-GB'`). German user viewing PLN invoice sees `125,00 zł` instead of legacy `125 PLN`. | open | Re-introduce a thin `useActiveLocale()`-aware currency helper bridging react-i18next → `formatMinorAsCurrency`; update the 35 call-sites to drop hardcoded locales. |
| GAP-I18N-002 | Currency formatting | `packages/shared/src/money.ts` | P2 | Fraction-digits default flipped 0→2 in `formatMinorAsCurrency`. Visible on dashboard KPIs and approval-queue widgets. | open | Restore the legacy default (or thread a `fractionDigits` option through call-sites that need 0). |
| GAP-I18N-003 | Translation backfill | `apps/web-vite/messages/{de,pl,ar}.json` | INFO / P3 | 31 `Organization.*` keys backfilled to de/pl/ar (spot-checked: actually translated). Positive change — recorded for completeness. | n/a | None. |
| GAP-I18N-004 | Vite chunk-name regex | `apps/web-vite/vite.config.mjs:124-126` | P3 | Message-chunk regex still matches `/web\/messages\//`; new path is `web-vite/messages/`. Chunk falls to default name. | open | Update regex to `/web-vite\/messages\//`. |
| GAP-I18N-005 | Stale doc-comment refs | `apps/web-vite/src/{main.tsx,test/test-utils.tsx,i18n/messages.ts,i18n/index.ts}` + 2 test files | P3 | Six stale `apps/web/messages/` references in doc comments. Cosmetic. | open | Find/replace `apps/web/messages/` → `apps/web-vite/messages/` in the six listed files. |

### Message-source state

**Runtime: correct.** `apps/web-vite/src/i18n/messages.ts` imports `../../messages/{locale}.json` → resolves under `apps/web-vite/messages/`. Legacy `apps/web/messages/` no longer in tree.

### Formatter parity

- `useDateFormatter` — PARITY (provider swap only).
- `usePortalDateFormatter` — PARITY.
- `useFormatter` shim — PARITY (next-intl → react-i18next; same 3 methods, `relativeTime` unit picker matches).
- `useCurrencyFormatter` — REMOVED (see GAP-I18N-001, GAP-I18N-002).

---

## Observability parity

> Source: `.audit-scratch/observability/{sentry-scrub.diff,posthog-callsites.csv,legacy-*}`.

### Gaps

| ID | Surface | New path | Sev | Evidence | Status | Remediation |
|----|---------|----------|-----|----------|--------|-------------|
| GAP-OBSERVABILITY-001 | Sentry session-replay | `apps/web-vite/src/sentry.ts` | P1 | `replayIntegration` + `replaysSessionSampleRate 0.1` + `replaysOnErrorSampleRate 1.0` + masking flags dropped on web-vite vs legacy. | open | Re-enable `replayIntegration` with same masking defaults if replay capture is still desired. |
| GAP-OBSERVABILITY-002 | Sentry feedback widget | `apps/web-vite/src/sentry.ts` | P1 | `feedbackIntegration` dropped. | open | Re-enable if in-app user feedback was used. |
| GAP-OBSERVABILITY-003 | Sentry trace propagation | `apps/web-vite/src/sentry.ts` | P1 | Legacy explicit `tracePropagationTargets: ['localhost', /^https?:\/\//]` dropped. Cross-subdomain SPA→API trace stitching at risk. | open | Add explicit `tracePropagationTargets` covering `api.contractor-ops.com`. |
| GAP-OBSERVABILITY-004 | Sentry source-map upload | `apps/web-vite/vite.config.mjs` | P2 | `withSentryConfig` (sourcemap upload, release, tunnelRoute) absent on web-vite. Build secrets are wired in `render.yaml` but plugin not invoked. | open | Confirm `@sentry/vite-plugin` is configured; if not, wire it up and verify upload runs on Render builds. |
| GAP-OBSERVABILITY-005 | Sentry server logs | `apps/api/src/lib/sentry.ts` | P2 | `_experiments.enableLogs` dropped on server. | open | Re-enable if structured Sentry log capture was being used. |
| GAP-OBSERVABILITY-006 | Sentry dev disable | `apps/web-vite/src/sentry.ts` | P2 | Client hard-disable (`enabled: DSN && !isDev`) dropped — Sentry may now fire from local dev. | open | Re-add the dev hard-disable. |

### Sentry scrub appendix

`PII_KEYWORDS` list = byte-for-byte port (26 → 26 + 26 entries). All nine scrub branches preserved (`user.email`, `user.ip_address → {{auto}}`, `request.{data,query_string,headers,cookies}`, `extra`, `contexts`, `tags`, `breadcrumbs[].data`), `MAX_DEPTH = 6`, `maskEmail()` unchanged. `beforeSend: scrubSentryEvent` wired on every `Sentry.init` (`apps/api/src/lib/sentry.ts:38`, `apps/web-vite/src/sentry.ts:31`). No `beforeSendTransaction` in legacy → no parity gap.

### Web-vitals appendix

`apps/api/src/routes/web-vitals.ts` accepts the same body shape, same sampling, same PostHog event sink as the legacy `apps/web/src/app/api/web-vitals/route.ts`. PARITY.

---

## Security parity

> Source: `.audit-scratch/security/{csp.diff,cors.diff,helmet.diff,rate-limit.diff,audit-log-callsites.csv,signature-verify.csv}`.

### Gaps

| ID | Surface | New path | Sev | Evidence | Status | Remediation |
|----|---------|----------|-----|----------|--------|-------------|
| GAP-SECURITY-001 | SPA CSP `script-src` | `render.yaml:684` + `apps/web-vite/index.html:28` | **P0** | New `script-src 'self' 'wasm-unsafe-eval' https://*.sentry-cdn.com https://challenges.cloudflare.com` replaces legacy `'self' 'nonce-${nonce}' 'strict-dynamic' …`. Loses XSS containment — any same-origin script injection executes unconditionally. Legacy: `apps/web/src/middleware.ts:610-625` (`buildCsp`, verified at `git show 7fce0d83:apps/web/src/middleware.ts`). | **open (escalated)** | See `#### GAP-SECURITY-001 — script-src nonce` under **Escalations** below. Blocker: Render Static-Site has no per-request hook — choosing between Cloudflare Worker, Render web service rewrite, or accept-with-design-review is an infra-owner decision, not an audit-window edit. |
| GAP-SECURITY-002 | SPA CSP `frame-src` | `render.yaml:684` | **P0** | Legacy: 3 hosts (`*.docusign.com`, `*.docusign.net`, `apps-d.docusign.com`). New: 6 hosts (adds `*.autenti.com`, `*.r2.cloudflarestorage.com`, `challenges.cloudflare.com`). `*.r2.cloudflarestorage.com` wildcard in `frame-src` is unusually broad; mitigated by `frame-ancestors 'none'` (same line). Intake-detail PDF iframe verified `sandbox="allow-downloads"` at `apps/web-vite/src/components/invoices/intake/intake-detail-pdf-pane.tsx:86-100` (narrow). | **open (escalated)** | See `#### GAP-SECURITY-002 — frame-src R2 wildcard` under **Escalations** below. Blocker: narrowing the wildcard requires ops to confirm prod R2 account id + per-region bucket subdomain shape (`{bucket}.{accountId}.r2.cloudflarestorage.com` virtual-hosted vs `{accountId}.r2.cloudflarestorage.com` path-style). |
| GAP-SECURITY-003 | SPA CSP reporting | `render.yaml:684` + `apps/web-vite/index.html:28` | **P0** | Legacy CSP body had `report-uri /api/csp-report; report-to csp-endpoint` (`middleware.ts:622-623`) + `Report-To` group via `next.config.ts:122`. New SPA ships zero `report-uri` / `report-to` / `Report-To`. Meta-tag CSPs cannot emit reports. SPA = highest XSS surface; loss of report pipeline = silent regressions invisible to on-call. API CSP retains `/csp-report` endpoint (`apps/api/src/routes/csp-report.ts`). | open | Append `; report-uri https://api.contractor-ops.com/csp-report; report-to csp-endpoint` to SPA CSP `value:` in `render.yaml:684` and add a `Report-To` header entry. `/csp-report` already CSRF-exempt at `apps/api/src/plugins/csrf-origin.ts:32`. Static `<meta>` cannot deliver `report-to` — that must live in the HTTP header. |
| GAP-SECURITY-004 | SPA Permissions-Policy | `render.yaml` (SPA headers) | P1 | Camera / microphone access dropped from `Permissions-Policy`. DocuSign embed needs camera/mic for ID verification flows. | open | Add `camera=(self https://*.docusign.com)`, `microphone=(self https://*.docusign.com)` if ID verification is in scope. |
| GAP-SECURITY-005 | SPA COEP `credentialless` | `render.yaml` (SPA headers) | P1 | Legacy SPA emitted `Cross-Origin-Embedder-Policy: credentialless`. Dropped on new SPA. | open | Re-add COEP if cross-origin isolation was being relied on (e.g. SharedArrayBuffer features). Otherwise accept. |
| GAP-SECURITY-006 | LOAD_TEST_BYPASS | (dropped) | P2 | k6 staging hatch removed. Operational, not security. | open | See GAP-MIDDLEWARE-002. |

### Escalations

> P0 SPA CSP gaps that require architectural decisions the audit window cannot make safely. Status stays `open (escalated)`; both rows above link here.

#### GAP-SECURITY-001 — script-src nonce

**Blocker.** Legacy SPA `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' …` was minted per request by Next.js middleware (`apps/web/src/middleware.ts:610-625` @ `7fce0d83`). The new SPA is served as a pure static bundle by Render Static-Site, which has **no per-request execution hook** — there is nowhere to mint a fresh nonce, so `'strict-dynamic'` cannot be reinstated as-is. The audit cannot pick between (a) standing up an edge runtime (Cloudflare Worker / Render web service in front of the bundle), (b) accepting hash-only hardening, or (c) writing a design-review acceptance — that is an infra-owner call. Verified facts that constrain the decision: SPA `index.html` ships **zero inline `<script>` bodies** (only two external `src=` tags — `/theme-init.js` and `/src/main.tsx`); both are already gated by `script-src 'self'`, so the *practical* XSS containment loss is from dropping `'strict-dynamic'` against same-origin script injection (e.g. a future XSS in user-rendered content), not from inline-script tolerance.

**Options.**

| Opt | Change | Dependency | Effort | Acceptance signal |
|-----|--------|-----------|-------:|-------------------|
| (a) | Front the static bundle with a Cloudflare Worker (or Render web service running `@fastify/static`) that injects per-request nonce into `<script>` tags and emits matching `script-src 'self' 'nonce-…' 'strict-dynamic'` header | New edge runtime provisioned in Cloudflare or Render; release/rollback story; cost line-item | **L** (architectural week — new deploy target + nonce middleware + e2e re-cert) | CSP report-uri (per GAP-SECURITY-003) shows zero `script-src` violations against legitimate bundle for 48 h; synthetic XSS payload in dev blocked |
| (b) | Keep static deploy, drop `'wasm-unsafe-eval'` (verify no WASM runtime needs it — Sentry replay was already removed per GAP-OBSERVABILITY-001), narrow `https://*.sentry-cdn.com` to the specific CDN host actually fetched, and add SRI (`integrity=`) to the two external `<script>` tags in `index.html` | Build-time SRI injection (Vite plugin or manual hash) for `/theme-init.js` + `/src/main.tsx`; ops to confirm Sentry CDN exact host | **M** (multi-file day — `index.html`, `render.yaml`, build script for SRI) | Bundle still loads; CSP reports show no violation; `'strict-dynamic'` still absent (residual risk documented) |
| (c) | Accept the regression with a signed design-review note in `.planning/` + `docs/security/` documenting the threat-model trade-off (Render Static-Site limitation, low same-origin XSS exposure given React's default escaping + no `dangerouslySetInnerHTML` survey-out) | Threat-model write-up reviewed by security owner; entry in risk register | **S** (1-file hour) | Risk register row landed and reviewed; quarterly re-review scheduled |

**Recommended handler + deadline.** Infra owner (currently the sole maintainer per `.planning/PROJECT.md`) — pair with security reviewer. Recommend **(b) within T+14d** as the minimum bar (narrows `script-src` without new runtime), with **(a) scoped as a T+30d follow-up** if Cloudflare Worker capacity is on the roadmap. Option (c) is acceptable only if (a) and (b) are both deferred past T+30d, and must be paired with GAP-SECURITY-003 (CSP report pipeline) so silent regressions surface.

#### GAP-SECURITY-002 — frame-src R2 wildcard

**Blocker.** `frame-src https://*.r2.cloudflarestorage.com` wildcards every R2 bucket on every Cloudflare account on the planet, not just the prod tenant's bucket. The narrowing target is the prod-bucket subdomain, but the exact shape depends on **which addressing mode the bundle uses at runtime** — virtual-hosted (`https://{bucket}.{accountId}.r2.cloudflarestorage.com`) or path-style (`https://{accountId}.r2.cloudflarestorage.com/{bucket}/…`). Code-side facts: signed URLs are produced by `packages/api/src/services/r2.ts` + `packages/api/src/services/regional-storage.ts` (two regional buckets `R2_BUCKET_NAME_EU` / `R2_BUCKET_NAME_ME`, single `R2_ACCOUNT_ID`, `R2_FORCE_PATH_STYLE` env-toggled). The audit cannot read prod env to confirm the live account id, the two prod bucket names, or the path-style flag — that is an ops-owner confirmation. The only iframe that loads R2 content is `apps/web-vite/src/components/invoices/intake/intake-detail-pdf-pane.tsx:86-100`, and it already ships `sandbox="allow-downloads"` (narrow — no `allow-scripts`, no `allow-same-origin`), so the existing mitigation is real even with the wildcard.

**Options.**

| Opt | Change | Dependency | Effort | Acceptance signal |
|-----|--------|-----------|-------:|-------------------|
| (a) | Replace `https://*.r2.cloudflarestorage.com` with explicit per-region hosts: `https://{EU_BUCKET}.{ACCOUNT_ID}.r2.cloudflarestorage.com https://{ME_BUCKET}.{ACCOUNT_ID}.r2.cloudflarestorage.com` (virtual-hosted mode) | Ops confirms prod `R2_ACCOUNT_ID` + `R2_BUCKET_NAME_EU` + `R2_BUCKET_NAME_ME` + `R2_FORCE_PATH_STYLE=false` | **S** (1-file hour after ops confirmation) | Intake-detail PDF still renders for EU + ME tenants; CSP report shows zero `frame-src` violations |
| (b) | If `R2_FORCE_PATH_STYLE=true` in prod, narrow to a single host: `https://{ACCOUNT_ID}.r2.cloudflarestorage.com` (path-style — bucket lives in URL path, not subdomain) | Ops confirms `R2_FORCE_PATH_STYLE=true` + `R2_ACCOUNT_ID` | **S** (1-file hour) | Same as (a); strictly narrower than (a) by one DNS label |
| (c) | Accept the wildcard; document that `sandbox="allow-downloads"` on the only R2-fed iframe is the actual mitigation, and `frame-ancestors 'none'` prevents R2 framing the SPA back. Add a CI assertion that any new R2-iframe call-site keeps a narrow `sandbox=` | Security reviewer sign-off; new CI guardrail in `apps/web-vite/scripts/` | **M** (multi-file day — risk note + lint rule) | CI rule lands; risk register row reviewed |

**Recommended handler + deadline.** Ops owner (R2 account holder) — confirms env, then infra owner edits `render.yaml:684` + `apps/web-vite/index.html:28`. Recommend **(a) or (b) within T+7d**: ops confirmation is a single Slack message, the edit is one line in two files, and the existing `sandbox="allow-downloads"` mitigation means there is no rush to rip out the wildcard but also no architectural reason to keep it. Option (c) only if ops is blocked on confirming env shape past T+7d.

### CORS, Helmet, Rate-limit, Audit-log, Signature-verify appendix

- **CORS**: SAME-intent. Legacy was same-origin only (no CORS surface). New `apps/api/src/plugins/cors.ts:24-46`: exact-origin allowlist from `env.APP_URL` + `env.PUBLIC_APP_URL`, no wildcards, `credentials: true`, headers/exposedHeaders/maxAge sane. `if (!origin) cb(null,true)` covered by csrf-origin guard (`apps/api/src/plugins/csrf-origin.ts:73`) for state-changing requests. **No regression.** Verify `APP_URL` semantics in prod env.
- **Helmet**: SAME. `X-Frame-Options DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS (`max-age 63072000+ includeSubDomains+preload`), COOP same-origin, CORP same-site all carried over (`apps/api/src/plugins/helmet.ts:19-32` + onSend hook). `Permitted-Cross-Domain-Policies: none` added (STRONGER). COEP disabled on `apps/api` is intentional (JSON API).
- **Rate-limit**: SAME. Per-prefix budgets identical: `/api/auth/*` exempt (Better Auth owns), `/api/portal/*` 10 r/min/IP, `/api/*` 60 r/min/IP. Upstash sliding-window + in-mem fallback + production fail-closed 503 + `Retry-After 5` preserved (`apps/api/src/plugins/rate-limit.ts:43-94`). `X-RateLimit-*` headers + 429 `Retry-After 60` preserved. Trusted-proxy XFF walk preserved.
- **`writeAuditLog`**: SAME. Legacy `apps/web` had **zero** `writeAuditLog` call-sites — every audit write lived in `packages/api/src/routers/**`. Call-site counts compared: legacy 71 vs new 71 (same files, ±2 line numbers). All sensitive mutation domains accounted for. **No regression.** Full reconciliation at `.audit-scratch/security/audit-log-callsites.csv`.
- **Signature verify**: SAME or STRONGER. Stripe (`stripe.webhooks.constructEvent`), QStash (`Receiver.verify` centralised via `guardQStashRequest`), InPost (`crypto.createHmac('sha256') + timingSafeEqual`), portal-set-session HMAC, revalidate-legal HMAC, KSeF/ZATCA/Peppol — all preserved. Cron auth: legacy used `timingSafeEqual` against `Bearer ${CRON_SECRET}` on 4 cron HTTP routes; new tree moves all 12 cron handlers in-process → attack surface eliminated. `packages/api/src/middleware/cron-trpc.ts:29` still preserves tRPC-side check. Teams Bot Framework JWT: STRONGER. New tree (`apps/api/src/routes/teams.ts`) explicitly runs `authorizeJWT(authConfig)` Express-shim preHandler BEFORE `adapter.process()` (vs legacy auto-validation). JWT validation now explicit.

---

## Test coverage parity

> Source: `.audit-scratch/tests/{legacy-test-files.txt,new-test-files.txt,file-pair-map.csv,legacy-behavior-classes.csv,assertion-drift.md}`.

### Counts

- Legacy total: **563** test files (42 Playwright e2e + 521 unit/component under `apps/web/**`).
- Current total: **1187** test files (42 Playwright e2e on web-vite + 675 web-vite unit + 22 api + 13 cron-worker + 435 packages).
- E2E pairs: **42 / 42** matched by exact path / name. **MISSING = 0.** Handover "42/42 Playwright" claim verified at file level.
- Behavior classes catalogued: **236** legacy e2e test cases.

### Gaps

| ID | Sev | Surface | Drift |
|----|-----|---------|-------|
| GAP-TEST-001 | P1 | Webhook (Peppol AS4) | `GET returns 405` → `toBe(404)`. Mirrors GAP-WEBHOOK-003. Partner Access Points may interpret 404 as deployment loss → silent retry stop. |
| GAP-TEST-002 | P1 | Webhook (Peppol AS4) | `PUT returns 405` → `toBe(404)`. Same as GAP-TEST-001. |
| GAP-TEST-003 | P1 (P0 candidate) | Legal/compliance | `shows jurisdiction options (EU/UK/Gulf switcher)` → `has prose content sections`. Jurisdiction display no longer asserted on `/legal/*`. Mirrors GAP-PAGE-002. |
| GAP-TEST-004 | P1 | A11y (settings) | `settings tabs are keyboard navigable` removed. WCAG 2.1.1 mandatory per CLAUDE.md. |
| GAP-TEST-005 | P2 | URL state (contractors) | `search filters table via URL` → `search retains typed value`. URL-state assertion swapped for DOM-value-only; bookmarkability regression invisible. |
| GAP-TEST-006 | P2 | Invoices filter | `status chip bar is present` → `status or compliance filter controls are present` (OR-locator, loosened). |
| GAP-TEST-007 | P2 | Invoices upload | `upload button exists` → `import or upload action exists` (OR-locator, loosened). |
| GAP-TEST-008 | P2 | Responsive UX | `search trigger is compact on mobile` removed. |
| GAP-TEST-009 | P2 | Dashboard | `… content or empty state` → `… content or greeting`. Empty-state semantic shift. |
| GAP-TEST-010 | P3 | A11y dashboard loop | `${route}` → `${route || '/'}`. Cosmetic. |

### Ported appendix

- All 42 Playwright e2e specs paired by exact path / name on `{functional,integration,perf,rtl,a11y}` category split.
- Auth, billing, payments, classification, portal/tenant, audit/workflows, public-smoke, Resend webhook: zero drift on assertions.

### Out-of-scope flag

Legacy 521 unit tests vs new 675 web-vite unit tests — file-count net positive but layouts differ (container + hook + component split per `apps/web-vite/ARCHITECTURE.md`). 1:1 unit parity not exhaustively verified in this sweep — recommend follow-up pass on P0 domain hooks (`useBilling`, `useApprovalChain`, `useAudit`, audit-writer wrappers).

---

## P0 fix log

> Per inline-fix: `GAP-<AREA>-<NNN>` | commit SHA | subject | verification command | test added.

_No P0 fixes landed yet. Restoration agent owns Step 9; fixes will be appended here as they commit on `audit/post-migration-parity`._

---

## Verification (Step 10)

> Run + captured at end:

- [ ] `pnpm typecheck`
- [ ] `pnpm --filter @contractor-ops/api-server test`
- [ ] `pnpm --filter @contractor-ops/cron-worker test`
- [ ] `pnpm --filter @contractor-ops/web-vite test` (path-scoped per memory-pressure rule)
- [ ] `pnpm --filter @contractor-ops/web-vite check:web-vite-data-layer`
- [ ] `pnpm --filter @contractor-ops/web-vite check:web-vite-page-shells`
- [ ] `plannotator annotate goals/post-migration-parity-audit/audit-report.md --gate` → approved
