# Facts — post-migration-parity-restoration

Full restoration of every gap surfaced by the post-migration parity audit (`goals/post-migration-parity-audit/audit-report.md` head `99584569`). Scope is **everything**: 7 P0 + 32 P1 + 33 P2 + a review pass on the 13 sibling-agent UI polish commits that landed on the audit branch unreviewed. Production cutover is gated on this restoration; no time pressure — quality over speed per CLAUDE.md.

## Baseline + scope

- Audit branch `audit/post-migration-parity` head `99584569` is the input. Restoration work continues on the same branch or branches off it.
- Every gap row in audit-report.md is in scope. New gaps surfaced during the sibling-UI review pass are also in scope.
- The 4 P0s already inline-fixed during the audit (GAP-SECURITY-003, GAP-WEBHOOK-003, GAP-OBSERVABILITY-007, GAP-OBSERVABILITY-008) stay fixed; their commits are not re-touched.
- "Closed" = audit-report.md row status is `inline-fixed (<SHA>)` OR `closed-decision (<doc-ref>)` OR `closed-verified-intentional` (the GAP-SECURITY-004 pattern).

## Deliverables

- A restoration report at `goals/post-migration-parity-restoration/restoration-report.md` mirrors the audit-report.md structure: per-area sections, per-row status table, fix-log appendix, verification block.
- Every row in audit-report.md is reflected in restoration-report.md with new status. Rows that stay open need an explicit deferral rationale (e.g. "deferred — needs <X>; risk-register entry <Y>").
- Restoration work commits land on `audit/post-migration-parity` (or a child branch `audit/restoration-<wave>` merged back fast-forward) with subjects `fix(restoration): GAP-<AREA>-<NNN> <one-line>`.

## P0 closures (each one specifically)

### GAP-LEGAL-CLUSTER-001 — Legal CMS pipeline (load-bearing confirmed)

- New tRPC procedure `legal.getDocument({type, jurisdiction?, locale})` exists in `packages/api/src/routers/core/legal.ts` and reads from Payload CMS via its local API.
- The 4 SPA legal containers (`apps/web-vite/src/components/legal/legal-{terms,privacy,sub-processors,breach-notification}-container.tsx`) call the procedure and render the CMS body via `CmsLexicalRenderer`, falling back to static i18n only when the CMS returns null.
- `apps/api/src/routes/revalidate-legal.ts` publishes to a Redis pub/sub channel (`legal:revalidated`) on HMAC-verified webhook receipt.
- SPA subscribes to the channel via a long-poll or SSE endpoint (`/api/legal/revalidations`) wired through TanStack Query's `invalidateQueries(['legal-content', type, jurisdiction])`.
- Vitest coverage: `apps/api/src/__tests__/revalidate-legal.test.ts` asserts HMAC verify + body validation + Redis publish (closes GAP-TEST-018). Web-vite coverage: `apps/web-vite/src/components/legal/__tests__/legal-container.test.tsx` asserts CMS path + fallback path.

### GAP-OBSERVABILITY-012 — PostHog `signup_completed` post-signup hook

- `packages/auth/src/config.ts` `databaseHooks.user.create.after` calls `posthog.capture({ distinctId: user.id, event: 'signup_completed' })` + `posthog.alias({ distinctId: user.id, alias: anonDistinctIdFromCookie })`.
- `POSTHOG_PROJECT_API_KEY` declared in `packages/auth/src/env.ts` and wired in `render.yaml` api-service env block.
- `posthog-node` dep added (7-day release age confirmed).
- Vitest coverage in `packages/auth/src/__tests__/config.test.ts` asserts both calls fire and the alias uses the cookie value when present (no-op when cookie absent).

### GAP-SECURITY-001 — SPA CSP `script-src` nonce (option a — Cloudflare Worker / Render Web Service)

- The static SPA bundle is now served behind an edge runtime (Cloudflare Worker OR Render Web Service running `@fastify/static`) that mints a fresh nonce per request, injects it into every `<script>` tag in the HTML response, and emits a matching `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` CSP header.
- `render.yaml` updated to the new service shape (static deploy retired OR proxied).
- E2E or synthetic-load test confirms zero CSP violations for the legitimate bundle over a 48h soak window via the `/csp-report` endpoint (already wired by GAP-SECURITY-003 fix).
- Synthetic XSS payload in dev is blocked by the new policy (test under `apps/web-vite/e2e/security/`).

### GAP-SECURITY-002 — SPA CSP `frame-src` R2 wildcard (keep wildcard — documented acceptance)

- `render.yaml:684` keeps `https://*.r2.cloudflarestorage.com` wildcard on `frame-src`.
- Per-iframe sandbox enforcement: `apps/web-vite/scripts/check-r2-iframe-sandbox.mjs` (new) greps the SPA tree for any `<iframe>` whose `src` resolves to an R2 host and rejects when `sandbox=` is missing `allow-downloads`-only.
- Quality-gate wired into `package.json` (root scripts) as `check:r2-iframe-sandbox` and added to CI.
- Acceptance note at `docs/security/csp-r2-wildcard.md` documents the multi-provider reality (prod = R2, local dev = MinIO with arbitrary host) + the `sandbox="allow-downloads"` mitigation + `frame-ancestors 'none'` + the new CI guardrail.
- Risk register entry in `.planning/risk-register.md` cross-links the acceptance note + scheduled quarterly review.

### GAP-TEST-015 — Stripe webhook idempotency + transactional processing

- New `apps/api/src/__tests__/stripe-webhook.test.ts` asserts:
  - `skips processing when StripeEvent.processedAt is set` (idempotency).
  - `processes a new event in a transaction and returns 200`.
  - `marks StripeEvent.processedAt on success`.
  - `does NOT mark processedAt on handler throw → 500 → Stripe retries`.
- Test uses real Fastify + prisma test-fixture (no full DB mock); follows the pattern in `apps/api/src/__tests__/peppol-method-not-allowed.test.ts`.

### GAP-TEST-021 — Invoice intake cross-org IDOR (test + tRPC scope audit)

- Two-part fix:
  - (1) Audit + verify `intake.get` tRPC procedure (`packages/api/src/routers/invoices/intake.ts`) enforces `where: { organizationId: session.user.organizationId }` at the data layer; if missing, add it. Closes the actual IDOR primitive.
  - (2) New `apps/web-vite/src/pages/__tests__/intake-detail.test.tsx` route-guard test asserts: (a) flag-off → `<Navigate to="/unauthorized">`; (b) tRPC `intake.get` cross-org throw → `<Navigate to="/not-found">` (or matching parity-with-legacy behavior).
- Vitest + msw fixtures for the tRPC mock; no Playwright (out of memory rule).

### GAP-TEST-026 — Privacy DE PDF `assertJurisdictionOrReject` (port + test)

- New `packages/api/src/lib/legal/privacy-pdf-guard.ts` (or `apps/api/src/lib/`) exports `assertJurisdictionOrReject({orgJurisdiction, requestedJurisdiction})` that throws TRPCError UNAUTHORIZED when org's jurisdiction does not match the requested PDF jurisdiction.
- The guard is wired into the existing PDF render path (`packages/api/src/services/legal-pdf.ts` or the appropriate tRPC procedure) before any PDF generation.
- Vitest coverage in `packages/api/src/__tests__/privacy-pdf-guard.test.ts` asserts: DE org requesting GB PDF → reject; DE org requesting DE PDF → allow; missing orgJurisdiction → reject (fail-closed).

## P1 closures (32 rows, grouped by surface)

- All P1 rows under `## Page parity` / `## API route parity` / `## Webhook parity` / `## Middleware parity` / `## Observability parity` / `## Security parity` / `## Test coverage parity` in audit-report.md are addressed.
- Per area, each P1 row's status flips to one of: `inline-fixed (<SHA>)`, `closed-verified-intentional`, OR `deferred (<rationale + risk-register-ref>)`.
- Notable P1 work (non-exhaustive — full list per audit-report.md):
  - **Pages**: GAP-PAGE-001..005 (legal containers wired into the new `legal.getDocument` tRPC procedure — automatically closed by the GAP-LEGAL-CLUSTER-001 implementation).
  - **Routes**: GAP-ROUTE-004 (`/api/*` prefix — re-register all external publishers OR add reverse-proxy strip-prefix); GAP-ROUTE-005 (peppol/poll iteration — restore connection-first loop or add fallback sweep).
  - **Middleware**: GAP-MIDDLEWARE-003 (portal subdomain — decision + doc update); GAP-MIDDLEWARE-005 (Accept-Language → locale prefix — router-root loader).
  - **Observability**: GAP-OBSERVABILITY-001 (Sentry replay re-enabled); GAP-OBSERVABILITY-002 (feedback widget); GAP-OBSERVABILITY-009 partial → full (build-pipeline `sentry-cli releases new/finalize` + `SENTRY_AUTH_TOKEN` env); GAP-OBSERVABILITY-010 (source-map upload on Node services).
  - **Security**: GAP-SECURITY-008 (Teams JWT `AZURE_BOT_APP_ID` prod guard hard-throw).
  - **Tests**: every promoted P0 already covered above; remaining P1 tests (login credential, portal set/clear-session route-level, revalidate-legal HMAC, deriveComplianceStatus, privacy GB/EU resolvers) all ported with vitest coverage.

## P2 closures (33 rows)

- All P2 rows in audit-report.md are addressed; each row's status flips to one of: `inline-fixed (<SHA>)`, `closed-verified-intentional`, OR `deferred (<rationale>)`.
- P2 work focuses on i18n, test-coverage, doc, and cosmetic gaps. Examples: GAP-I18N-001/002 currency formatter parity + fraction-digits default restore; GAP-PAGE-006/007/008 admin URL shape + intake 404 vs unauthorized; GAP-TEST-005..010 unit coverage backfill on auth / contractors / invoices / dashboard; GAP-OBSERVABILITY-004/011/013 source-map plugin + tunnel route + web-vitals CSRF assertion.

## Sibling-agent UI commit review pass

- The 13 sibling-agent UI polish commits that landed on the audit branch unreviewed are each reviewed against the audit's severity rubric:
  - `e95e4e75` swap startup spinner for bento skeleton + AtelierBackground.
  - `daed398b` accent-line under top bar.
  - `eb6be3df` dark-mode atelier gradient.
  - `5d3fa5ce` document-level scroll on dashboard shell.
  - `5d436ece` Activity Feed native overflow.
  - `e6ec821d` my-tasks flex-row.
  - `cca0ffc2` intensity-aware scroll model (workbench vs atelier).
  - `6a76470a` public/flags + public/logos asset restore.
  - `b5f09833` shadcn Input solid background.
  - `4c83feb8` Sentry dev hard-disable (api + cron-worker + public-api).
  - `eb51c97a` Edit-name dialog + density toggle (user-menu).
  - Plus any later sibling commits landing during restoration work.
- New gaps surfaced by the review are added to restoration-report.md with new IDs (`GAP-SIBLING-NNN`) and severity per the same rubric.
- "Reviewed clean" rows record the reviewer + verification command + a one-line note.

## Verification (final, on restoration branch head)

- `pnpm typecheck` passes.
- `pnpm --filter @contractor-ops/api-server test` passes.
- `pnpm --filter @contractor-ops/cron-worker test` passes.
- `pnpm --filter @contractor-ops/public-api test` passes.
- `pnpm --filter @contractor-ops/web-vite test -- src/` passes — including the two files (`use-approval-actions.test.tsx`, `dashboard-home-container.test.tsx`) that were verified-pre-existing during the audit (their fix is in scope per "everything" + sibling-review).
- `pnpm check:web-vite-data-layer` + `pnpm check:web-vite-page-shells` + `pnpm check:r2-iframe-sandbox` (new) all pass.
- `pnpm audit` clean; `pnpm security:scan` clean.
- E2E suite (`apps/web-vite/e2e/{functional,integration,perf,rtl,a11y}/`) passes on a clean branch — including the legal-jurisdiction Playwright assertion restored (closes GAP-TEST-003).
- The audit-report.md Summary table is recomputed: every P0/P1/P2 cell shows `0 open / N inline-fixed / 0 deferred` (or deferred only with explicit risk-register entries).
- The CSP report pipeline (`/csp-report`) shows zero violations against the legitimate bundle for a 48h soak after the GAP-SECURITY-001 edge-runtime cutover.
- User signs off on `restoration-report.md` via `plannotator annotate ... --gate`.

## Done condition

`goals/post-migration-parity-restoration/restoration-report.md` exists and mirrors `goals/post-migration-parity-audit/audit-report.md` row-for-row, with every row's status flipped to `inline-fixed (<SHA>)`, `closed-decision (<doc-ref>)`, `closed-verified-intentional`, OR `deferred (<rationale + risk-register-ref>)`. Every verification command above passes. The 13 sibling-agent UI commits are reviewed (clean or new-gap-recorded). No row sits `open` without a documented deferral rationale. The user signs off via `plannotator --gate`. Production cutover proceeds.
