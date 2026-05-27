# Facts — post-migration-parity-audit

Exhaustive parity audit of the `apps/web` (Next.js 16) → `apps/web-vite` + `apps/api` migration that the 2026-05-25 handover declared "full functional parity". Scope is `apps/web-vite` and `apps/api` only (cms, landing, public-api, cron-worker out of scope except where the legacy `apps/web` used to call into them). Legacy baseline = commit `62a97d73^` (last tree state where `apps/web/` existed). Output = a discovery report; any gap classified P0 (auth break, payment break, data loss / tenant leak, regulatory webhook break) is fixed inline during the audit; everything else is recorded for later triage.

## Deliverables

- A report at `goals/post-migration-parity-audit/audit-report.md` is the single source of truth for every gap found.
- The report opens with a Summary table: gap counts per area (page, route handler, middleware, i18n, observability, security, test) × severity (P0, P1, P2) × status (open, inline-fixed, deferred).
- Every gap has a stable ID matching `GAP-<AREA>-<NNN>` (e.g. `GAP-PAGE-007`, `GAP-WEBHOOK-003`); IDs do not collide across areas and do not renumber after publication.
- Each gap row carries: ID, area, legacy path (e.g. `apps/web/src/app/[locale]/payments/page.tsx`), new path (or the string `MISSING`), severity (P0 / P1 / P2), evidence (`file:line` for new code, `git show 62a97d73^:<path>` excerpt or line range for legacy), status (`open` / `inline-fixed` / `deferred`), and proposed remediation (one paragraph).
- The report includes a per-area appendix listing every legacy artifact that *was* successfully ported, so absence of an artifact from both the gap list and the "ported" list is itself flagged.
- Severity rubric is stated at the top of the report: **P0** = auth break, payment / money flow break, data loss / tenant leak, regulatory webhook break (KSeF / ZATCA / Peppol / Storecove); **P1** = user-facing feature regression that does not lose data and is not in a P0 category; **P2** = i18n string gap, test coverage gap, doc gap, cosmetic regression.

## Page parity (web-vite UI)

- Every `apps/web/src/app/[locale]/**/page.tsx` from `62a97d73^` has a counterpart route in `apps/web-vite/src/routes/**` (or `src/App.tsx` router tree) — or is recorded as a `GAP-PAGE-NNN`.
- Every `apps/web/src/app/admin/**/page.tsx` from `62a97d73^` has a counterpart in the web-vite admin area — or is recorded as a `GAP-PAGE-NNN`.
- Every `apps/web/src/app/portal/**` route from `62a97d73^` has a counterpart in the web-vite portal area — or is recorded as a `GAP-PAGE-NNN`.
- Every dynamic-segment shape (`[id]`, `[token]`, `[locale]`, nested groups like `(dashboard)`, `(marketing)`) is preserved in the new router; segment-shape mismatches that change URL contracts are gaps.
- Every loader / `requireAuth` / role gate that legacy pages applied (via middleware, `getServerSession`, or per-page guards) is preserved in the equivalent web-vite loader; a route that used to require auth and now does not is a `GAP-SECURITY-NNN` with severity P0.
- Every UI section that legacy pages rendered (table columns, filter chips, action buttons, bulk operations, export buttons, drawer / sheet / dialog triggers, empty states, error states) is preserved in the web-vite counterpart; a missing column / filter / action is `GAP-PAGE-NNN`.
- Every "hidden" or admin-only flow reachable only by direct URL (e.g. `/<locale>/admin/feature-flags`, `/<locale>/admin/audit-log`) is reachable in web-vite with the same auth gate.

## API route parity (Next route handlers → Fastify)

- Every `apps/web/src/app/api/**/route.ts` from `62a97d73^` has a counterpart in `apps/api/src/routes/**` (or in `apps/cron-worker` / `apps/public-api` if the responsibility moved) — or is recorded as a `GAP-ROUTE-NNN`.
- Every HTTP method handled by the legacy route (`GET`, `POST`, `PATCH`, `DELETE`, `PUT`, `OPTIONS`, `HEAD`) is handled by the new route; missing methods are `GAP-ROUTE-NNN`.
- Every status code branch (200 / 201 / 204 / 400 / 401 / 403 / 404 / 409 / 422 / 429 / 500 / 503) returned by the legacy route is reachable in the new route under equivalent inputs; missing branches are `GAP-ROUTE-NNN`.
- Every header the legacy route emitted (`Cache-Control`, `Set-Cookie`, `Location`, `Retry-After`, `X-RateLimit-*`, `Content-Type`, custom `X-*`) is emitted by the new route; missing headers are `GAP-SECURITY-NNN` if they were security-relevant, else `GAP-ROUTE-NNN`.
- Every webhook route (`stripe`, `storecove`, `inpost`, multi-provider dispatch, QStash `_process`, KSeF `_sync`, Peppol inbound / outbound / poll, ZATCA `_submit`, Teams `messages`, Google Workspace `_sync`, OCR `_process`, exports `_process`, outbox `_drain`, late-interest `_render-claim-pdf`, revalidate-legal, portal session set / clear, CSP-report, web-vitals) preserves: signature verification, idempotency key handling, dead-letter behavior, retry classification, ALS trace propagation, and Sentry-on-failure capture. Each missing guarantee is a separate `GAP-WEBHOOK-NNN`.
- Every OAuth flow under `/api/oauth/**` preserves the `__Host-oauth_state` cookie shape, the HMAC challenge, the PKCE handling (if present), and the post-callback redirect; deviations are `GAP-SECURITY-NNN`.
- Every legacy server-action (functions exported from files with `'use server'`) that performed a mutation has an equivalent tRPC procedure or REST route in the new world; orphan server-actions are `GAP-ROUTE-NNN`.
- Every legacy route that called `writeAuditLog` (or equivalent audit helper) has a new counterpart that also calls `writeAuditLog` with the same `action`, `resource`, and `metadata` shape; missing audit calls are `GAP-SECURITY-NNN` with severity P0 (data-loss / tenant-leak category).
- Every legacy route that gated by `organizationId` / region / `userId` from the session preserves the same tenant scope in the new route; weaker scoping is a `GAP-SECURITY-NNN` with severity P0.

## Middleware parity (legacy `apps/web/src/middleware.ts` → apps/api plugins + web-vite loaders)

- Every behavior in the legacy 739-line middleware is accounted for in the new stack (apps/api plugins, web-vite router loaders, or explicitly dropped with a recorded reason). The audit lists each behavior block and its new home.
- Locale negotiation (path `/<locale>/...`, `Accept-Language` fallback, cookie persistence, redirect to `/<defaultLocale>/...`) behaves identically; deviations are `GAP-MIDDLEWARE-NNN`.
- Auth gate (which paths require a session, which redirect to `/login`, which return 401 JSON) behaves identically; weaker gates are P0.
- Rate-limit rules (per-route limit, key derivation from `clientIp` + session, `Retry-After` shape) are preserved in `apps/api/src/plugins/rate-limit.ts`; missing rules are `GAP-SECURITY-NNN`.
- CSP header (every `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `frame-src`, `font-src`, `worker-src`, `form-action`, `frame-ancestors`, `base-uri`, `object-src`, `report-uri` / `report-to` origin) is preserved or strictly stronger in `apps/api/src/lib/csp.ts` and the web-vite `index.html` meta; any quietly relaxed directive is `GAP-SECURITY-NNN` with severity P0 if it weakens isolation.
- CORS allowlist (every origin allowed by legacy `Access-Control-Allow-Origin` logic) is preserved in `apps/api/src/plugins/cors.ts`; extras / removals are recorded.
- CSRF defense (Origin check, exempt paths) behaves identically in `apps/api/src/plugins/csrf-origin.ts`; new exemptions added during migration are listed with justification.
- Cookie attributes (`Domain=.contractor-ops.com`, `SameSite=None`, `Secure`, `HttpOnly`, `Path=/`) for session, locale, theme, and feature-flag override cookies are preserved end-to-end across `app.* ↔ api.*`; mismatches are P0.

## i18n parity (en / de / pl / ar)

- The active message source for web-vite is identified (currently `apps/web/messages/{locale}.json` re-exported via `apps/web-vite/src/i18n/messages.ts`, pending git-mv in legacy Step 18); the audit notes whether the `git mv` has happened, and if so, that no key was lost in the move.
- For every locale in `['en', 'de', 'pl', 'ar']`, the new message file has every key the legacy `apps/web/messages/{locale}.json` from `62a97d73^` had; missing keys are `GAP-I18N-NNN` (severity P2 unless the missing key is on a P0 surface like login error, in which case P1).
- ICU plural / select formats present in legacy messages still parse and render in `i18next-icu`; ICU shape regressions are `GAP-I18N-NNN`.
- RTL behavior (Arabic): every page that legacy explicitly rendered RTL renders RTL in web-vite (dir=rtl on root, mirrored layout primitives); regressions are `GAP-I18N-NNN`.
- Date / number / currency formatters (legacy `apps/web/src/lib/format/use-*-formatter.ts`) have web-vite counterparts producing identical strings for the same input under each locale; mismatches are `GAP-I18N-NNN`.

## Observability parity (Sentry + PostHog)

- Every PII / secret scrub rule in legacy `apps/web/src/lib/sentry-scrub.ts` (154 lines) has a counterpart in `apps/api/src/lib/sentry-scrub.ts` and in `apps/web-vite/src/lib/sentry-scrub.ts` (or shared package); missing rules are `GAP-OBSERVABILITY-NNN` with severity P0 (data-leak category).
- Every Sentry `beforeSend` / `beforeSendTransaction` filter (e.g. drop healthcheck noise, drop expected 401s on `/api/me`) is preserved; missing filters are `GAP-OBSERVABILITY-NNN`.
- Every Sentry release / dist convention (`release = git sha`, `environment` from `RENDER_SERVICE_NAME` or equivalent, source-map upload to the right project) is preserved in the Vite build; deviations recorded.
- Every PostHog event the legacy app captured (`identify`, `capture`, feature-flag exposure) is captured in web-vite at the same call site; missing captures are `GAP-OBSERVABILITY-NNN`.
- Web-vitals endpoint contract (`apps/web/src/app/api/web-vitals/route.ts` shape) matches `apps/api/src/routes/web-vitals.ts`; mismatches are `GAP-OBSERVABILITY-NNN`.

## Security parity

- Every `helmet` directive set by legacy (any custom CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) is set by `apps/api` `@fastify/helmet` config or by the SPA host headers (Render static-site headers); weaker headers are `GAP-SECURITY-NNN` with severity P0.
- Every legacy `redirect()` from a server component or middleware that prevented an unauthenticated user reaching a page is reproduced in the web-vite loader; a now-reachable formerly-protected page is `GAP-SECURITY-NNN` P0.
- Every legacy `revalidatePath` / cache-tag invalidation point has an equivalent React Query invalidation in web-vite; missing invalidations that cause stale-data security issues (e.g. revoked permission still cached) are P0.
- Every legacy use of `crypto.timingSafeEqual` / HMAC verify / signature verify is preserved with the same algorithm and the same fail-closed behavior; weakening (e.g. `===` slipped in) is P0.
- Every legacy rate-limit on auth-sensitive endpoints (login, password reset, magic link, invite accept) is preserved; missing limits are `GAP-SECURITY-NNN` P0.

## Test coverage parity

- Every legacy `apps/web/**/*.test.{ts,tsx}` file from `62a97d73^` is mapped to either a web-vite or apps/api test file that covers the same behavior class (not necessarily the same file shape).
- Behavior classes that are no longer covered are listed as `GAP-TEST-NNN` with severity P2 unless the uncovered behavior is on a P0 surface, in which case P1.
- Every legacy `apps/web/e2e/**/*.spec.ts` from `62a97d73^` has a counterpart in `apps/web-vite/e2e/{functional,integration,perf,rtl,a11y}/`; absent specs are `GAP-TEST-NNN`. The handover claims 42-for-42 parity — the audit verifies this claim assertion-by-assertion, not just by filename count.
- Any new test that *only* asserts the new structure (without asserting the legacy behavior class) is flagged so the test debt is not hidden by a higher count.

## P0 fix protocol (inline-fix during the audit)

- A gap classified P0 is fixed in a separate atomic commit per gap, with subject `fix(audit): GAP-<AREA>-<NNN> <one-line summary>` and a body that quotes the report row.
- A P0 fix that cannot be completed safely inside the audit window (e.g. needs a DB migration or a coordinated deploy) is escalated: the report row stays `open` and is annotated with the blocking reason and a proposed handler.
- Every P0 fix updates the report row to `inline-fixed` and adds the fix commit SHA.
- No P0 gap remains `open` at the end of the audit without an explicit escalation note naming the blocker.

## Done condition

- `audit-report.md` exists at `goals/post-migration-parity-audit/audit-report.md` and contains: severity rubric, summary table, per-area gap rows (with all required fields), per-area "ported" appendix, and the P0 fix log.
- Every legacy `apps/web/src/app/**` route (pages and API handlers), every legacy middleware behavior block, every legacy locale message key, every legacy Sentry scrub rule, and every legacy test file has either a "ported" entry in the appendix or a `GAP-*-NNN` row in the gap list — nothing is unaccounted for.
- Every `GAP-*-NNN` row classified P0 has status `inline-fixed` (with commit SHA) or `open` (with an explicit escalation note naming the blocker).
- `pnpm typecheck`, `pnpm --filter @contractor-ops/api-server test`, `pnpm --filter @contractor-ops/cron-worker test`, and `pnpm --filter @contractor-ops/web-vite test` all pass on the audit branch head.
- The user signs off on the report via the Plannotator `--gate` flow before the audit is declared closed.
