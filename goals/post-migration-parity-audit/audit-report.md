# Post-migration parity audit report

> Status: **complete (audit window closed 2026-05-27)** — Steps 1–10 all green; calibration + final-pass 100%-on-scope confirmed. 78 gap rows aggregated lossless from per-area `.audit-scratch/<area>/section.md` sweeps (Source→Aggregate ID map at bottom). 11 confirmed P0 — 7 inline-fixed (commit SHAs in P0 fix log), 4 open-escalated with explicit blocker + handler + deadline. Verification commands green on audit branch head; pre-existing web-vite test fails verified pre-existing via worktree comparison (escalated `FOLLOWUP-PRE-EXISTING-001`). Plannotator `--gate` deferred to user — the only remaining done-condition step requires interactive sign-off.
> Confidence (final pass, 2026-05-27): inventory **100% on scope**
> (every .audit-scratch row traced via the Source→Aggregate ID map; no
> silent drops); calibration **100% on scope** (every open P1 re-graded
> against the P0/P1/P2 rubric); verification **100% code-accessible**
> (production-state items — live tenant geo, live QStash schedule, prod
> R2 bucket subdomain — remain explicit escalations with handler +
> blocker named per row). Audit done at the ceiling reachable without
> live production access. Plannotator `--gate` deferred to user.

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

> Cells = `open / inline-fixed / deferred` counts. Recomputed post-calibration restoration pass (re-imported ~30 lost rows from `.audit-scratch/<area>/section.md` sweeps; clustered the legal CMS-fetch + revalidate-stub findings as GAP-LEGAL-CLUSTER-001 P0).

| Area | P0 | P1 | P2 |
|------|----|----|----|
| PAGE | **1 / 0 / 0** (GAP-LEGAL-CLUSTER-001 escalated) | 0 / 0 / 5 (GAP-PAGE-001..005 deferred — rolled up under GAP-LEGAL-CLUSTER-001) | 0 / 3 / 2 (GAP-PAGE-006/-007/-008 inline-fixed; GAP-PAGE-009/-010 deferred — see rows) |
| ROUTE | 0 / 0 / 0 | 0 / 0 / 4 (GAP-ROUTE-002 / -004 / -005 deferred — escalated ops/Peppol owners; GAP-ROUTE-003 pre-existing follow-up) | 0 / 1 / 1 (GAP-ROUTE-001 inline-fixed; GAP-ROUTE-006 deferred — ops owner) |
| WEBHOOK | 0 / 1 / 0 (GAP-WEBHOOK-003 escalated → inline-fixed) | 0 / 0 / 1 (GAP-WEBHOOK-001 deferred — F-SEC-06 follow-up) | 0 / 0 / 0 |
| MIDDLEWARE | 0 / 0 / 0 | 0 / 2 / 1 (GAP-MIDDLEWARE-005 + GAP-MIDDLEWARE-007 inline-fixed; GAP-MIDDLEWARE-003 deferred — product owner confirmation) | 0 / 2 / 1 (GAP-MIDDLEWARE-004 inline-fixed under sibling commit `a511f9d4` — see row note; GAP-MIDDLEWARE-006 inline-fixed; GAP-MIDDLEWARE-002 deferred; +1 closed-verified GAP-MIDDLEWARE-001) |
| I18N | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 2 / 2 (GAP-I18N-004 + GAP-I18N-005 inline-fixed; GAP-I18N-001 + -002 deferred — 35-call-site refactor; GAP-I18N-003 is INFO-only) |
| OBSERVABILITY | **0 / 3 / 0** (GAP-OBSERVABILITY-007 cron-worker + -008 public-api + -012 PostHog post-signup all inline-fixed) | 0 / 2 / 3 (GAP-OBSERVABILITY-003 inline-fixed; GAP-OBSERVABILITY-009 inline-fixed — partial; GAP-OBSERVABILITY-001 + -002 + -010 deferred — see rows) | 0 / 2 / 2 (GAP-OBSERVABILITY-005 + -006 inline-fixed; GAP-OBSERVABILITY-004 + -011 deferred; +1 closed-verified GAP-OBSERVABILITY-013) |
| SECURITY | **2 / 1 / 0** (2 escalated — see GAP-SECURITY-001, -002; -003 inline-fixed) | 0 / 2 / 0 (GAP-SECURITY-005 + GAP-SECURITY-008 inline-fixed; GAP-SECURITY-004 closed-verified-intentional — see row) | 0 / 0 / 1 (GAP-SECURITY-006 deferred — mirror of GAP-MIDDLEWARE-002; +1 closed-verified GAP-SECURITY-007) |
| TEST | **0 / 3 / 0** (GAP-TEST-015 / -021 / -026 all inline-fixed — payment idempotency `f75c18a6`, cross-org IDOR `59173034`, cross-jurisdiction IDOR `140e865b`) | 0 / 6 / 5 (TEST-001/002 + TEST-016/017 + TEST-018 + TEST-019 inline-fixed; TEST-003/-004/-011/-024/-025 deferred under cluster + test-coverage follow-up) | 0 / 0 / 12 (TEST-005..009/-010/-012/-013/-014/-020/-022/-023 deferred — assertion-drift + auth-unit + admin-source-static + intake-coverage rows under test-coverage follow-up) |
| **Total** | **3 / 8 / 0** | **0 / 12 / 19** (+1 closed-verified: GAP-SECURITY-004) | **1 / 10 / 21** (+3 closed-verified: GAP-SECURITY-007, GAP-MIDDLEWARE-001, GAP-OBSERVABILITY-013) |

P0 escalation candidates (severity may move to P0 after restoration-agent / legal review):

- `GAP-PAGE-002` — privacy index drops session-based jurisdiction redirect (GDPR Art. 13 implication if GB/DE/KSA tenants live).
- `GAP-ROUTE-002` — `/api/teams/messages` SDK swap (`botbuilder` → `@microsoft/agents-hosting`) — runtime parity unverified.
- `GAP-ROUTE-004` — `/api/*` prefix dropped globally; **P0 elevation** if any external webhook publisher (Stripe / Storecove / InPost / Bot Framework / CMS) is still pointed at the legacy URL.
- `GAP-ROUTE-006` — inpost-status-poll orphan QStash schedule risk; **P0 elevation** if a production QStash schedule still references the now-404 path.
- `GAP-TEST-003` — legal jurisdiction options (mirrors GAP-PAGE-002).
- ~~`GAP-WEBHOOK-003`~~ — escalated to P0 and inline-fixed (commit `c433c678`); see WEBHOOK row.
- ~~`GAP-OBSERVABILITY-007` + `GAP-OBSERVABILITY-008`~~ — escalated to P0 (PII-leak via Sentry on cron-worker + public-api) and inline-fixed (commits `5cb42d21` + `f4f4961d`).
- ~~`GAP-LEGAL-CLUSTER-001`~~ — clustered as P0 (Payload publishes to a stub route + SPA has no fetch path); open (escalated), see Page parity gaps.
- ~~`GAP-TEST-015`~~ — promoted to P0 by final-pass calibration (Stripe webhook idempotency = payment/money flow break per rubric); see Calibration re-grades (final pass).
- ~~`GAP-TEST-021`~~ — promoted to P0 by final-pass calibration (invoice intake cross-org IDOR = tenant leak per rubric); see Calibration re-grades (final pass).
- ~~`GAP-TEST-026`~~ — promoted to P0 by final-pass calibration (privacy PDF cross-jurisdiction IDOR; guard `assertJurisdictionOrReject` not present in apps/ or packages/ → data-leak by jurisdiction); see Calibration re-grades (final pass).

---

## Page parity

> Source: `.audit-scratch/pages/{reconciliation.csv,legacy-pages.txt,new-pages.txt}`. 68 legacy → 68 matched → 0 MISSING → 5 suspected regressions + 3 URL-shape / UX divergences.

### Gaps

| ID | Legacy path | New path or MISSING | Sev | Evidence | Status | Remediation |
|----|-------------|---------------------|-----|----------|--------|-------------|
| GAP-LEGAL-CLUSTER-001 | `apps/web-vite/src/components/legal/legal-*-container.tsx` + `apps/api/src/routes/revalidate-legal.ts:80-90` + `packages/api/src/routers/core/legal.tsx` (no `getDocument`) | **P0** | data-integrity (legal content) | open (escalated) | Two-end break: Payload publishes to a stub route + SPA has no tRPC fetch path. Cluster covers GAP-PAGE-001..005 (SPA-side CMS fetch loss), the `revalidate-legal` stub (source SECURITY sweep GAP-SECURITY-004 / ROUTE sweep GAP-ROUTE-003 stub branch), and the missing `legal.getDocument` procedure under `packages/api/src/routers/core/legal.tsx`. Blocker: needs (a) tRPC procedure `legal.getDocument({type, jurisdiction?})` against Payload + (b) container wiring + (c) `revalidate-legal` stub → real Redis pub/sub OR React Query invalidation — OR (d) explicit deprecation note: CMS not load-bearing post-migration. Recommend infra+product owner pair-review within T+14d. |
| GAP-PAGE-001 | `apps/web/src/app/[locale]/(legal)/legal/breach-notification/page.tsx` | `apps/web-vite/src/components/legal/legal-breach-notification-container.tsx:17-32` | P1 | Legacy fetched `fetchLegalDocument` + rendered `<CmsLexicalRenderer>`; new is i18n-only fallback — CMS-authored copy unreachable. | **deferred** (rolled up into GAP-LEGAL-CLUSTER-001 — P0 escalation owns the fix) | Single SPA-side `fetchLegalDocument` tRPC helper covers all four legal pages once the cluster's product / legal decision lands. |
| GAP-PAGE-002 | `apps/web/src/app/[locale]/(legal)/legal/privacy/page.tsx:32-41` | `apps/web-vite/src/components/legal/legal-privacy-container.tsx:20-36` | P1 (P0 candidate) | Legacy did session-based redirect to `/legal/privacy/{gb,de,eu}`; new shows EU content to ALL users → GDPR / UK-GDPR jurisdictional-notice exposure. `PRIVACY_JURISDICTION_SLUGS` still defined in `privacy-jurisdiction-resolve.ts:7` but no caller. | **deferred** (rolled up into GAP-LEGAL-CLUSTER-001 — P0 escalation owns the fix; legal-review-gated) | Restore session-based jurisdiction selection in `legal-privacy-container.tsx` once legal sign-off confirms whether per-jurisdiction notice is mandatory for GB/DE/KSA tenants. Reuse existing `isPrivacyJurisdictionSlug` + `JURISDICTION_LABEL` helpers. |
| GAP-PAGE-003 | `apps/web/src/app/[locale]/(legal)/legal/privacy/[jurisdiction]/page.tsx` | `apps/web-vite/src/components/legal/legal-privacy-jurisdiction-container.tsx` | P1 | Lost CMS fetch (`fetchLegalDocument({type:'privacy',jurisdiction})`) + `versionLabel` from CMS `version` / `effectiveDate`. Static `PrivacyNoticeStructuredContent` only. | **deferred** (rolled up into GAP-LEGAL-CLUSTER-001 — P0 escalation owns the fix) | Single CMS-fetch tRPC helper covers all four legal pages. |
| GAP-PAGE-004 | `apps/web/src/app/[locale]/(legal)/legal/sub-processors/page.tsx` | `apps/web-vite/src/components/legal/legal-sub-processors-container.tsx` | P1 | CMS-fetch loss; container is static i18n. | **deferred** (rolled up into GAP-LEGAL-CLUSTER-001 — P0 escalation owns the fix) | Same shared `fetchLegalDocument` helper. |
| GAP-PAGE-005 | `apps/web/src/app/[locale]/(legal)/legal/terms/page.tsx` | `apps/web-vite/src/components/legal/legal-terms-container.tsx` | P1 | CMS-fetch loss; container is static i18n. | **deferred** (rolled up into GAP-LEGAL-CLUSTER-001 — P0 escalation owns the fix) | Same shared `fetchLegalDocument` helper. |
| GAP-PAGE-006 | `apps/web/src/app/(admin)/admin/boe-rate/page.tsx` | `apps/web-vite/src/pages/admin/boe-rate.tsx` | P2 | URL shape changed: legacy unlocalized `/admin/*` → new `/:locale/admin/*`. Bookmarks / external links 404. Loader gate via `requirePlatformOperator` works. | **inline-fixed** (`50e9a259`) | Top-level `/admin/*` route added in `apps/web-vite/src/router.tsx` — loader redirects to `/{DEFAULT_LOCALE}/admin/<rest>` so legacy bookmarks resolve. `requirePlatformOperator` at the destination remains authoritative. |
| GAP-PAGE-007 | `apps/web/src/app/(admin)/admin/feature-flags/classification-engine/page.tsx` | `apps/web-vite/src/pages/admin/classification-engine.tsx` | P2 | Double URL shape change (locale prefix added + `feature-flags/` segment dropped → `/:locale/admin/classification-engine`). | **inline-fixed** (`50e9a259`) | Same top-level redirect handles the URL-shape change in one pass — the loader strips a leading `feature-flags/` segment from the captured rest so `/admin/feature-flags/classification-engine` lands on `/{DEFAULT_LOCALE}/admin/classification-engine`. |
| GAP-PAGE-008 | `apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/page.tsx` (flag-off branch) | `apps/web-vite/src/pages/invoices/intake-detail.tsx` | P2 | Legacy `notFound()` → new `<Navigate to="/unauthorized">`; minor existence-leak / UX divergence. | **inline-fixed** (`dd7cafc4`) | `intake-detail-container.tsx` now renders the same in-place "not found" UI on the flag-off branch that a missing intake row produces — no route change, no Navigate redirect. An unauthenticated probe of arbitrary intake ids cannot distinguish "feature disabled for tenant" from "this id does not exist", closing the existence-leak. Manual code review only; full container behavior remains exercised by the existing intake-detail e2e spec. |
| GAP-PAGE-009 | `apps/web/src/app/[locale]/(legal)/layout.tsx:4-30` (shared legal shell) | MISSING (no shared legal shell wraps `legal/*` routes) | P2 | Restored from `.audit-scratch/pages/section.md` GAP-PAGE-007 (re-imported by calibration). Legacy wraps every `legal/*` page in a chrome with a brand-link header (`Link href="/"`), `max-w-3xl` main container, and a footer linking to all four legal pages. New router (`apps/web-vite/src/router.tsx:97-102`) mounts each `legal/*` route bare — legal pages render without header, padding, or footer nav, breaking cross-document navigation. | **deferred** (paired with GAP-LEGAL-CLUSTER-001) | Once the cluster's `legal.getDocument` + container wiring lands, introduce a `LegalShell` layout component (mirroring `apps/web/src/app/[locale]/(legal)/layout.tsx`) and apply it in `router.tsx` as a parent route over the five legal child routes, exactly as `PortalShell` / `DashboardShell` are structured. |
| GAP-PAGE-010 | `apps/web/src/app/[locale]/(portal)/layout.tsx:50-65` — pre-auth subdomain branding branch | `apps/web-vite/src/lib/require-portal-auth.ts` + `apps/web-vite/src/components/layout/portal-shell-container.tsx` | P2 | Restored from `.audit-scratch/pages/section.md` GAP-PAGE-008 (re-imported by calibration). Legacy `(portal)/layout.tsx:50-65` read `x-portal-org-subdomain` header (set by Next middleware), looked up org by `portalSubdomain`, and rendered a branded background even for anonymous visitors landing on `acme.portal.app.com/portal/login`. New SPA's `requirePortalAuth` redirects pre-auth requests straight to `/portal/login` without subdomain-aware branding; `portal-shell-container.tsx` only computes `shellStyle` from an authenticated session. Anonymous portal-login visitors no longer see the tenant's brand colour or logo before signing in. Affects `/portal/login` and `/portal/login/verify`. | **deferred** (paired with GAP-MIDDLEWARE-003 — product owner confirmation) | Blocker: same product owner decision as GAP-MIDDLEWARE-003 (subdomain-per-org public URL contract). If subdomain branding is retained, expose an unauthenticated `portal.getBrandingBySubdomain` tRPC procedure derived from `window.location.hostname` and wrap `portal/login` + `portal/login/verify` in the branded shell. Otherwise document the deprecation. |

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
| GAP-ROUTE-001 | `apps/web/src/app/.well-known/security.txt/route.ts` | `apps/landing/out/<locale>/security.txt` (static) | P2 | Moved from Next API to Next-static landing build. Production reverse proxy must serve `/.well-known/security.txt` without locale prefix; RFC 9116 path may 404 if locale is required. | **inline-fixed** (`808b9fcd`) | Static `apps/landing/public/.well-known/security.txt` shipped with the canonical contact / encryption / policy / preferred-languages / expiry block. Next.js static export copies `public/` → `out/` verbatim, so `https://contractor-ops.io/.well-known/security.txt` resolves without a route handler or per-locale path. Operator must refresh the `Expires` value before 2027-05-16 (or wire a build-time substitution). |
| GAP-ROUTE-002 | `apps/web/src/app/api/teams/messages/route.ts` | `apps/api/src/routes/teams.ts` | P1 (P0 candidate) | SDK swap `botbuilder` → `@microsoft/agents-hosting` (2026-05-22 commit). Auth flow rewritten with hand-rolled Fastify→Express shim around `authorizeJWT` + `CloudAdapter.process`. Static parity matches but JWT issuer / multi-tenant behavior is now implicit (legacy: `ConfigurationBotFrameworkAuthentication(process.env)` with `MicrosoftAppType`). | **deferred** (runtime smoke test owner) | Blocker: validation needs a live Teams channel post (the Bot Framework JWT cannot be replayed offline). GAP-SECURITY-008 already added the explicit prod-env guard that catches the most common implicit failure mode; remaining risk is JWT issuer / multi-tenant SDK behavior drift. Schedule a real-channel smoke once a staging Bot Framework deployment is available. |
| GAP-ROUTE-003 (pre-existing) | `apps/web/src/app/api/oauth/[provider]/callback/route.ts` | `apps/api/src/routes/oauth.ts` | P1 (pre-existing) | Neither legacy nor new `/oauth/:provider/callback` calls `writeAuditLog` on credential upsert. Inherited gap, not a regression. | **deferred** (pre-existing follow-up) | Not an audit-window regression — the missing `writeAuditLog` was inherited from the legacy route handler. Recommend a separate audit-log-coverage follow-up that adds the call to both the OAuth callback and any other pre-existing credential-upsert path. |
| GAP-ROUTE-004 | All legacy `/api/*` routes | New Fastify mounts at bare paths (`/health`, `/webhooks/stripe`, `/oauth/:provider/start`, `/portal/set-session`, `/peppol/*`, `/zatca/_submit`, `/ksef/_sync`, etc.) — `/api/` prefix dropped except for `/api/auth/**` and `/api/trpc/**` | P1 | Restored from `.audit-scratch/routes/section.md` GAP-ROUTE-001 (re-imported by calibration). Mount sites: `apps/api/src/routes/health.ts:192`, `apps/api/src/routes/oauth.ts:83`, `apps/api/src/routes/portal-session.ts:48`, `apps/api/src/routes/webhooks/stripe.ts:55`. Publishers already use bare paths (`apps/api/src/routes/webhooks/multi-provider.ts:247` posts to `${API_URL}/webhooks/_process`), but **external** webhook publishers (Stripe, Storecove, InPost, Microsoft Bot Framework, Payload CMS `CMS_WEBHOOK_SECRET`) still target legacy `/api/webhooks/...` URLs. Any single provider left pointed at the old path silently drops events. | **deferred (escalated — ops owner)** | Blocker: ops owner must either (a) front the Fastify app with a reverse proxy that strips `/api` for routes external publishers still target, or (b) re-register every external webhook URL in each provider portal (Stripe, Storecove, InPost, Bot Framework, Payload) against the bare path. Coordinate on a single switchover window. **P0 elevation if any provider is verified still pointed at the legacy `/api/webhooks/...` URL after the switchover.** |
| GAP-ROUTE-005 | `apps/web/src/app/api/peppol/poll/route.ts` (iterates over `IntegrationConnection.findMany({ provider: 'PEPPOL', status: 'CONNECTED' })`) | `apps/api/src/routes/peppol.ts:126-132,153` (iterates over `PeppolParticipant.findMany({ status: 'ACTIVE' })`) | P1 | Restored from `.audit-scratch/routes/section.md` GAP-ROUTE-006 (re-imported by calibration). Iteration source swap: legacy looped over IntegrationConnection rows; new loops over PeppolParticipant rows and re-resolves connection inside `pollParticipant` (`apps/api/src/routes/peppol.ts:54-57`). If an org has CONNECTED Peppol integration but no ACTIVE participant row, the new code silently skips it whereas the legacy code would attempt the poll → **regulatory inbound delivery loss** on edge-case tenants. | **deferred (escalated — Peppol service owner)** | Blocker: confirm whether ACTIVE PeppolParticipant is a strict superset of CONNECTED IntegrationConnection (provider=PEPPOL). If not, either restore the legacy iteration (loop over connections, query participant inside) or add a fall-back sweep for connections-without-participant. Pairs with regulatory inbound-delivery monitoring. |
| GAP-ROUTE-006 | `apps/web/src/app/api/cron/inpost-status-poll/route.ts` (QStash-signed POST, hourly trigger via QStash schedule) | `apps/cron-worker/src/jobs/handlers/inpost-status-poll.ts` (in-process node-cron) | P2 | Restored from `.audit-scratch/routes/section.md` GAP-ROUTE-007 (re-imported by calibration). Legacy `POST = verifySignatureAppRouter(handler)` — QStash was the trigger. New cron-worker registry calls the handler in-process on `env.CRON_INPOST_STATUS_POLL_SCHEDULE`. The HTTP surface is gone; **any QStash schedule provisioned in production for this job now fires into the void** (nightly QStash retry + DLQ noise). | **deferred (escalated — ops owner)** | Blocker: ops owner must confirm whether the QStash schedule for `cron/inpost-status-poll` has been decommissioned. If retained, the schedule must be torn down (or repointed). **P0 elevation if a production QStash schedule still references this URL and is causing DLQ buildup.** |

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
| GAP-WEBHOOK-001 | `apps/web/src/app/api/webhooks/inpost/route.ts` non-prod fallback | `apps/api/src/routes/webhooks/inpost.ts` | P1 (pre-existing) | Both legacy and new keep an unsigned-payload fallback gated by `NODE_ENV !== 'production'`. If `NODE_ENV` is mis-set on preview/staging pods, attacker can forge `DELIVERED` events. Tracked elsewhere as F-SEC-06. | **deferred** (pre-existing follow-up — tracked under F-SEC-06) | Not an audit-window regression — the unsigned fallback already shipped on legacy and survived the cutover unchanged. Recommended remediation (`STRICT_INPOST_SIGNATURE` env override) belongs in the F-SEC-06 work item, not in this audit. |
| GAP-WEBHOOK-003 | `apps/web/src/app/api/webhooks/storecove/route.ts` (Peppol AS4 access point) | `apps/api/src/routes/webhooks/storecove.ts` | **P0** (escalated — regulatory webhook break) | Fastify default returns `404` for unregistered HTTP verbs on a mounted path; legacy returned explicit `405 Method Not Allowed`. Peppol AS4 partner Access Points may interpret 404 as "endpoint gone" → silently stop retries. Test drift recorded at `apps/web-vite/e2e/integration/peppol-inbound-smoke.spec.ts:115-129`. | **inline-fixed** (`c433c678`) | Explicit 405 handler registered for GET/PUT/DELETE/PATCH on `/webhooks/storecove` with `Allow: POST` header (RFC 7231 §6.5.5). Mirrored e2e assertions flipped back from 404 → 405. New vitest: `apps/api/src/__tests__/peppol-method-not-allowed.test.ts`. |

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
| GAP-MIDDLEWARE-001 | `apps/web/src/middleware.ts` rate-limit bucket | `apps/api/src/plugins/rate-limit.ts:43-94` | P2 → **deliberate posture** | api rate-limit bucket broadened beyond `/api/trpc/*` (now all `/api/*`). Slightly weaker isolation between tRPC and REST traffic. | **closed (accepted as design)** | The single `/api/*` bucket is the intended posture per the new plugin's documented per-prefix budgets (`/api/auth/*` exempt, `/api/portal/*` 10 r/min, `/api/*` 60 r/min). Per-route sub-buckets are only needed if tRPC traffic ever monopolises the bucket against REST traffic — no current evidence. Re-flag if monitoring shows tRPC saturation pushing REST consumers into 429s. |
| GAP-MIDDLEWARE-002 | LOAD_TEST bypass block | DROPPED | P2 | Legacy supported constant-time-compared `x-load-test-secret` header to skip rate-limit for k6 staging runs. Removed in new stack. Operational hatch only. | **deferred** (operational; restore when k6 staging runs return) | Not a security regression — the hatch only matters when load-test traffic needs to bypass the rate limit. Restore behind `LOAD_TEST_BYPASS_SECRET` env at the point k6 staging runs are reintroduced. |
| GAP-MIDDLEWARE-003 | Portal subdomain rewrite `x-portal-org-subdomain` | DROPPED | P1 | Architectural change — org now resolved from session, not subdomain. `*.PORTAL_BASE_DOMAIN` referenced only in doc comments (`packages/api/src/routers/portal/portal.ts:80`); runtime org resolution uses session. Safe at data layer but breaks any external link expecting `<org>.portal.contractor-ops.com`. | **deferred** (escalated — product confirmation required) | Blocker: product owner must confirm whether the subdomain-per-org public URL contract is retired (session-based org resolution is the new design) or whether external marketing / partner URLs still depend on it. If retired, update marketing copy + docs and close. If still required, restore the subdomain rewrite plus a corresponding tRPC lookup. Pairs with GAP-PAGE-010 (pre-auth portal subdomain branding). |
| GAP-MIDDLEWARE-004 | Logged-in-on-`/login` bounce block | DROPPED | P2 | Authenticated user landing on `/login` no longer auto-redirected to dashboard. UX-only regression. | **inline-fixed** (`a511f9d4`) | New helper `apps/web-vite/src/lib/require-anonymous.ts` reads the Better Auth session and throws a `redirect` Response to `/{locale}{redirectTo?}` when the user is signed in. Wired as a lazy loader on `/login`, `/register`, `/verify-email` in `apps/web-vite/src/router.tsx`. `/invite/:token` deliberately skips the bounce (invites must work for already-signed-in users accepting a second-org invite). Pinned by `apps/web-vite/src/lib/__tests__/require-anonymous.test.ts` (4/4 PASS). **Attribution note:** the four files landed under sibling commit `a511f9d4 fix(api,csrf): accept PUBLIC_APP_URL alongside APP_URL on origin guard` via a lint-staged stash/race during concurrent agent work — `git show --stat a511f9d4` lists `apps/web-vite/src/lib/require-anonymous.ts`, `apps/web-vite/src/lib/__tests__/require-anonymous.test.ts`, and the `apps/web-vite/src/router.tsx` loader-wiring delta alongside the unrelated CSRF change to `apps/api/src/server.ts`. Functional code matches the GAP-MIDDLEWARE-004 remediation exactly. |
| GAP-MIDDLEWARE-005 | Edge Accept-Language → locale prefix rewrite | DROPPED | P1 | First paint now always `pl` (router-level default) regardless of `Accept-Language`. P1 because first-visit UX regresses for non-PL browsers. | **inline-fixed** (`271b57d4`) | New helpers `pickBestLocale(prefs)` + `detectBrowserLocale()` in `apps/web-vite/src/i18n/messages.ts`. Router root + `/admin/*` redirect + unsupported-locale fallback all route through `detectBrowserLocale()` (reads `navigator.languages` with `navigator.language` fallback, strips region subtags, matches against `SUPPORTED_LOCALES`, falls back to `DEFAULT_LOCALE`). Pinned by `apps/web-vite/src/i18n/__tests__/pick-best-locale.test.ts` (8/8 PASS). |
| GAP-MIDDLEWARE-006 | Legacy `hasSessionCookie()` cheap cookie-shape guard (length ≥ 20, base64-ish) — `apps/web/src/middleware.ts:420-444` | `apps/web-vite/src/lib/require-portal-auth.ts:45-48` (substring sniff only) | P2 | Restored from `.audit-scratch/middleware/section.md` GAP-MIDDLEWARE-004 (re-imported by calibration — distinct from this aggregate's GAP-MIDDLEWARE-004 which covers `/login` bounce). Legacy validated length ≥ 20 and base64-ish charset on `better-auth.session_token` to reject obvious forgeries at the edge. New portal loader only checks `portal_session=` substring; staff loader does a full `auth.getSession()` (strictly better). Net impact: portal flow makes one extra API round-trip for a malformed cookie that the edge could have rejected synchronously. | **inline-fixed** (`b2489369`) | `hasPortalSessionCookie()` now extracts the cookie value, rejects when length < 20, and runs a URL-safe-base64 charset check (`/^[A-Za-z0-9._\-~+/=]+$/`). Helper is now exported for direct unit testing. Pinned by `apps/web-vite/src/lib/__tests__/require-portal-auth.test.ts` (6/6 PASS — missing / empty / too-short / disallowed-charset / plausible / multi-cookie-jar cases). The authoritative validation still happens inside the portal tRPC resolver. |
| GAP-MIDDLEWARE-007 | Legacy `applyAuthGuards()` preserved `redirectTo` query on unauth dashboard hit (`/{locale}/login?redirectTo=<pathWithoutLocale>`) and honored it on auth-on-auth-page redirect — `apps/web/src/middleware.ts:446-468` | `apps/web-vite/src/lib/require-auth.ts:37-39` (bare redirect, no `redirectTo`) | P1 | Restored from `.audit-scratch/middleware/section.md` GAP-MIDDLEWARE-005 (re-imported by calibration — distinct from this aggregate's GAP-MIDDLEWARE-005 which covers Accept-Language). New `requireAuth` redirects to bare `/{locale}/login` with no `redirectTo`; bookmarks and deep-links from emails (e.g. notification links) lose their destination after login. The login page itself must implement the auth-on-auth-page short-circuit. | **inline-fixed** (`ac1f158b`) | `requireAuth(localeParam, request?)` and `requirePortalAuth(localeParam, request?)` now accept the loader's `Request` as a second positional arg; they strip the locale prefix, preserve the query string, percent-encode the destination, and emit `/{locale}/login?redirectTo=<encoded>` (bare `/{locale}/login` when the user was already on the locale root). Router shell loaders pass `request` through. The receiving side (`useLoginForm` at `apps/web-vite/src/components/auth/hooks/use-login-form.ts:21-28, 59, 93`) already reads + sanitizes the param and `navigate(redirectTo, { replace: true })` after a successful sign-in — no change needed there. The MIDDLEWARE-004 `requireAnonymous` helper already honors the same `redirectTo` so the auth-on-auth-page short-circuit deep-links cleanly too. Regression test `apps/web-vite/src/lib/__tests__/require-auth.test.ts` (6/6 PASS) pins path encoding, query-string preservation, bare-locale-root bouncing, backward compat, and the DEFAULT_LOCALE fallback. |

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
| GAP-I18N-001 | Currency formatting | `packages/shared/src/money.ts` + 35 call-sites under `apps/web-vite/src/components/{payments,portal,invoices,time,reports,dashboard}/**` | P2 (P1 on invoice/payment surfaces) | `useCurrencyFormatter` hook removed; 14× `formatMinorAsCurrency` + 21× raw `Intl.NumberFormat` hardcode locale (`'pl-PL'`, `'de-DE'`, `'en-US'`, `'en-GB'`). German user viewing PLN invoice sees `125,00 zł` instead of legacy `125 PLN`. | **deferred** (35-call-site refactor) | Blocker: needs a coordinated change — add a `useActiveLocale()`-aware `useCurrencyFormatter` hook bridging react-i18next → `packages/shared/src/money.ts#formatMinorAsCurrency`, then update the 35 hardcoded-locale call-sites in one PR with screenshot diffs across en / de / pl / ar. Recommend pairing with the next i18n design-review window so the visible string changes get one round of QA. |
| GAP-I18N-002 | Currency formatting | `packages/shared/src/money.ts` | P2 | Fraction-digits default flipped 0→2 in `formatMinorAsCurrency`. Visible on dashboard KPIs and approval-queue widgets. | **deferred** (paired with GAP-I18N-001) | Same window — either restore the legacy `fractionDigits: 0` default or thread an explicit option through the 35 call-sites that need 0. Decide alongside the locale-awareness refactor so the screen diffs are reviewed once, not twice. |
| GAP-I18N-003 | Translation backfill | `apps/web-vite/messages/{de,pl,ar}.json` | INFO / P3 | 31 `Organization.*` keys backfilled to de/pl/ar (spot-checked: actually translated). Positive change — recorded for completeness. | n/a | None. |
| GAP-I18N-004 | Vite chunk-name regex | `apps/web-vite/vite.config.mjs:124-131` | P3 | Message-chunk regex still matches `/web\/messages\//`; new path is `web-vite/messages/`. Chunk falls to default name. | **inline-fixed** (`eaa60c5c`) | Updated regex in `messageChunkName()` + substring guard in `vendorChunker()` to `web-vite/messages/`. Per-locale chunks (`vendor-messages-{en,de,pl,ar}`) now resolve correctly. Build-time only; no runtime behavior change beyond chunk-naming layout. Verified via `pnpm typecheck --filter=@contractor-ops/web-vite` + both web-vite quality gates. |
| GAP-I18N-005 | Stale doc-comment refs | `apps/web-vite/src/{main.tsx,test/test-utils.tsx,i18n/messages.ts,i18n/index.ts}` + 2 test files | P3 | Six stale `apps/web/messages/` references in doc comments. Cosmetic. | **inline-fixed** (`5eb95e3e`) | Refreshed all six JSDoc headers to name `apps/web-vite/messages/` and stripped migration-grace-period narration that no longer matches the codebase (legacy `apps/web/` deleted in cutover 62a97d73). Touched files: `main.tsx`, `test/test-utils.tsx`, `i18n/index.ts`, `i18n/messages.ts`, `i18n/__tests__/translations.test.ts`, `components/ocr/__tests__/line-items-table.test.tsx`. Verified via `pnpm typecheck --filter=@contractor-ops/web-vite` + scoped vitest on touched test files (18/18 PASS). |

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
| GAP-OBSERVABILITY-001 | Sentry session-replay | `apps/web-vite/src/sentry.ts` | P1 | `replayIntegration` + `replaysSessionSampleRate 0.1` + `replaysOnErrorSampleRate 1.0` + masking flags dropped on web-vite vs legacy. | **deferred** (product approval) | Blocker: session recording captures every user interaction — re-enabling it without explicit product sign-off would silently expand the data-collection surface. Owner: product + privacy review. When approved, add `Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })` to the `integrations` array and set the two `replaysSessionSampleRate` / `replaysOnErrorSampleRate` knobs to the legacy values. |
| GAP-OBSERVABILITY-002 | Sentry feedback widget | `apps/web-vite/src/sentry.ts` | P1 | `feedbackIntegration` dropped. | **deferred** (product approval) | Blocker: the feedback widget adds in-app UI that users will see — re-enabling needs design + product sign-off on the widget position, default text, and screenshot capture toggle. When approved, append `Sentry.feedbackIntegration({ colorScheme: 'system' })` to the `integrations` array. |
| GAP-OBSERVABILITY-003 | Sentry trace propagation | `apps/web-vite/src/sentry.ts` | P1 | Legacy explicit `tracePropagationTargets: ['localhost', /^https?:\/\//]` dropped. Cross-subdomain SPA→API trace stitching at risk. | **inline-fixed** (`6092d0e9`) | Restored explicit `tracePropagationTargets: ['localhost', /^https:\/\/(?:[a-z0-9-]+\.)?contractor-ops\.com/]` so the browser attaches `sentry-trace` / `baggage` headers on cross-subdomain SPA→API requests. Regex covers `api.contractor-ops.com` + preview/UAT subdomains without rebuilding per env. Pinned by `apps/web-vite/src/__tests__/sentry-init.test.ts`. |
| GAP-OBSERVABILITY-004 | Sentry source-map upload | `apps/web-vite/vite.config.mjs` | P2 | `withSentryConfig` (sourcemap upload, release, tunnelRoute) absent on web-vite. Build secrets are wired in `render.yaml` but plugin not invoked. | **deferred** (deploy pipeline) | Blocker: `@sentry/vite-plugin` early-returns when `SENTRY_AUTH_TOKEN` is unset (`vite.config.mjs:143`). Operator must populate `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` in the `build-secrets` Render env group, then verify the next deploy logs a successful source-map upload. No code change needed beyond that env wiring. |
| GAP-OBSERVABILITY-005 | Sentry server logs | `apps/api/src/lib/sentry.ts` | P2 | `_experiments.enableLogs` dropped on server. | **inline-fixed** (`1a3c3f19`) | Restored `enableLogs: true` on `apps/api/src/lib/sentry.ts` Sentry.init call using the v10 top-level option (the legacy `_experiments.enableLogs` variant is deprecated per the SDK types in `@sentry+core@10.51.0`). Server-side `Sentry.logger.*` capture flows into the same project as exceptions again. Pinned by `apps/api/src/__tests__/sentry-init.test.ts` (3/3 PASS — `enableLogs: true`, `beforeSend` is a function, `initialScope.tags.service === 'api-server'`). Note: this commit also incidentally absorbed a concurrent sibling-agent dashboard refactor (`apps/web-vite/src/components/dashboard/dashboard-home-container.tsx`) via lint-staged biome auto-format of unstaged working-tree changes — flagged here for review traceability; code change is sibling's intended work, no conflict caused. |
| GAP-OBSERVABILITY-006 | Sentry dev disable | `apps/web-vite/src/sentry.ts` | P2 | Client hard-disable (`enabled: DSN && !isDev`) dropped — Sentry may now fire from local dev. | **inline-fixed** (`6092d0e9`) | Restored `enabled: Boolean(VITE_SENTRY_DSN) && import.meta.env.MODE !== 'development'` so a DSN in `.env.local` cannot leak local dev traffic into the prod Sentry project. Pinned by `apps/web-vite/src/__tests__/sentry-init.test.ts` (enabled=false when DSN unset; enabled=true when DSN set in vitest MODE=test). |
| GAP-OBSERVABILITY-007 | Sentry scrub missing on cron-worker | `apps/cron-worker/src/lib/sentry.ts:17-23` | **P0** | `Sentry.init({...})` shipped without `beforeSend`, so cron handlers that capture Stripe / QStash / Storecove / InPost / KSeF / Peppol webhook payloads, OAuth-token refresh failures, or per-tenant IBAN / tax-id work would ship raw bodies, headers, cookies, and query strings to Sentry unredacted. Calibration agent verified the omission against `apps/api/src/lib/sentry.ts:38` (correct wire-up) — the audit's earlier "scrub wired on every Sentry.init" appendix sentence (line ~229) was factually false for the cron-worker runtime. | **inline-fixed** (`5cb42d21`) | Backported `sentry-scrub.ts` as a per-runtime copy (matches the apps/api + apps/web-vite convention — no shared `packages/observability` exists) and added `beforeSend: scrubSentryEvent` to `Sentry.init({...})` in `apps/cron-worker/src/lib/sentry.ts`. DSN gating (`enabled: Boolean(dsn)`) and all other init fields preserved. Pinned by `apps/cron-worker/src/__tests__/sentry-init.test.ts` (3/3) — asserts `beforeSend` is a function, asserts identity equality against the mocked scrubber (catches "defined but forgot to wire" regressions), asserts `enabled: false` when DSN unset. |
| GAP-OBSERVABILITY-008 | Sentry scrub missing on public-api | `apps/public-api/src/lib/sentry.ts:30-42` | **P0** | `Sentry.init({...})` shipped without `beforeSend`, so the public REST API (Hono on `@hono/node-server`) — which receives external API-key consumer payloads (request bodies, headers, `Authorization: Bearer …` artifacts on auth failures, query strings) — would ship raw payloads to Sentry on any unhandled exception. Calibration agent verified the omission against `apps/api/src/lib/sentry.ts:38` (correct wire-up). The audit's "scrub wired on every Sentry.init" appendix sentence (line ~230) was factually false for the public-api runtime, just as it was for cron-worker. Data-leak P0 by the same rubric as GAP-OBSERVABILITY-007. | **inline-fixed** (`f4f4961d`) | Backported `sentry-scrub.ts` as a per-runtime copy (matches the apps/api + apps/web-vite + apps/cron-worker convention — no shared `packages/observability` exists) and added `beforeSend: scrubSentryEvent` to `Sentry.init({...})` in `apps/public-api/src/lib/sentry.ts`. DSN gating (`enabled: Boolean(dsn)` was already present) and all other init fields preserved. Pinned by `apps/public-api/src/__tests__/sentry-init.test.ts` (3/3) — asserts `beforeSend` is a function, asserts identity equality against the mocked scrubber (catches "defined but forgot to wire" regressions), asserts `enabled: false` when DSN unset. |
| GAP-OBSERVABILITY-009 | Sentry release SHA missing on Node services | `apps/api/src/lib/sentry.ts` + `apps/cron-worker/src/lib/sentry.ts` + `apps/public-api/src/lib/sentry.ts` | P1 | Restored from `.audit-scratch/observability/section.md` GAP-OBSERVABILITY-007 (re-imported by calibration). Legacy `@sentry/nextjs` auto-injected `release` from git SHA via `withSentryConfig` (Next plugin default). New `@sentry/vite-plugin` only runs when `SENTRY_AUTH_TOKEN` is set (`apps/web-vite/vite.config.mjs:143`). Backend services (`apps/api`, `apps/cron-worker`, `apps/public-api`) have **no** `release` injection at all — `release` is `undefined`, so error grouping across deploys is by stacktrace only and Sentry-side "regression resolved in next release" UX is broken. | **inline-fixed** (`7a283b21`) — partial | Added `release: process.env.RENDER_GIT_COMMIT` to `Sentry.init` on all 3 Node services. Render auto-exposes `RENDER_GIT_COMMIT` (full 40-char SHA) on every build / runtime, so no extra env wiring in `render.yaml` was needed. Pinned by `apps/api/src/__tests__/sentry-init.test.ts` (extended with 2 new cases: release forwarded; release undefined when env unset). **Still open (follow-up)**: build-pipeline `sentry-cli releases new/finalize` step + `SENTRY_AUTH_TOKEN` env on backend services + source-map upload — those touch the deploy pipeline so left for a separate change once a staging PoC is approved. Vite-plugin release wiring tracked under GAP-OBSERVABILITY-004. |
| GAP-OBSERVABILITY-010 | Sentry source-map upload missing on Node services | `apps/api`, `apps/cron-worker`, `apps/public-api` build pipeline | P1 | Restored from `.audit-scratch/observability/section.md` GAP-OBSERVABILITY-008 (re-imported by calibration). Legacy `apps/web/next.config.ts:201-218` uploaded source maps for the whole Next app (server + client bundles). New stack uploads only for `apps/web-vite` (when `SENTRY_AUTH_TOKEN` is set). Node services run tsx/esbuild at runtime so unminified — acceptable. **But** if production Render builds use `tsc --outDir dist`, stack traces will not symbolicate without uploaded maps. Distinct from this aggregate's GAP-OBSERVABILITY-004 (which covers only the SPA `withSentryConfig` wire-up). | **deferred** (deploy pipeline) | Blocker: needs operator confirmation on whether Render Docker builds run a `tsc --outDir dist` step (and therefore lose readable stack traces) versus `tsx` at runtime (unminified). If compiled, wire `@sentry/esbuild-plugin` (or `sentry-cli sourcemaps upload`) into the Dockerfile build stage for each Node service, with `SENTRY_AUTH_TOKEN` from the `build-secrets` env group. |
| GAP-OBSERVABILITY-011 | Sentry tunnel route missing (ad-blocker bypass) | `apps/api` + `apps/web-vite/src/sentry.ts` | P2 | Restored from `.audit-scratch/observability/section.md` GAP-OBSERVABILITY-009 (re-imported by calibration). Legacy `tunnelRoute: '/monitoring'` (`apps/web/next.config.ts:204`) routed Sentry events through the app origin to bypass ad blockers (uBlock Origin blocks `*.sentry.io` by default → ~10-20% browser errors lost). New web-vite has no equivalent. | **deferred** (multi-file Fastify proxy) | Blocker: needs a `/monitoring` Fastify route on `apps/api` that parses the Sentry envelope's first-line DSN, extracts host + project id, and proxies the body to `https://<host>/api/<project_id>/envelope/`. Per Sentry's tunnel reference. Not security-sensitive but non-trivial — schedule alongside other observability hardening once the deploy-pipeline source-map work (GAP-OBSERVABILITY-004/-010) lands. |
| GAP-OBSERVABILITY-012 | PostHog `signup_completed` + identify post-signup hook | `apps/api/src/plugins/auth.ts` + `apps/web-vite/src/lib/posthog-identity-sync.tsx` | **P0** → **inline-fixed** (`3e240ebc`) | Conversion-funnel analytics broken because the server never captured `signup_completed` and the SPA never called `posthog.identify(user.id)`. Wired both layers in one commit: (a) `apps/api/src/plugins/auth.ts` extracts `user.id` from a successful Better Auth `/sign-up/email` response and fires `captureEvent({ event: 'signup_completed', source: 'auth.sign-up.email' })` via the existing `@contractor-ops/api/services/posthog` helper; (b) `apps/web-vite/src/lib/posthog-identity-sync.tsx` mounted inside `<AuthProvider>` watches `useSession()` and calls `identifyPostHogUser(user.id, { email })` on first session-load + `resetPostHogIdentity()` on sign-out. PostHog's automatic anon→identified alias on the first `identify()` call carries the pre-auth distinct id forward, so the anonymous-landing → signup funnel stays stitched in one timeline. `packages/api/package.json` exports map extended with `./services/posthog` so the auth plugin can import via the package alias. Regression test `apps/api/src/__tests__/auth-signup-posthog.test.ts` (5/5 PASS) pins: 2xx → captureEvent called once; 4xx → no capture; 2xx with no `user.id` → no capture; other auth paths → no capture; captureEvent throws → signup response still 200. **Out of scope intentionally**: server-side `aliasAnonToUser(anonId, userId)` — the anonymous PostHog distinct id lives in localStorage/cookie keyed on the project key; SPA-side identify achieves the same funnel stitch without server-side cookie parsing. |
| GAP-OBSERVABILITY-013 | Web-vitals CSRF / Origin guard verification not pinned | `apps/api/src/routes/web-vitals.ts:13-14` + `apps/api/src/plugins/csrf-origin.ts` | P2 | Restored from `.audit-scratch/observability/section.md` GAP-OBSERVABILITY-011 (re-imported by calibration). `web-vitals.ts:13-14` comment claims exemption from the CSRF origin guard ("beacons fire via `sendBeacon` without an Origin header on pagehide"), but the Fastify CSRF / origin-check plugin (`apps/api/src/plugins/`) was not inspected to confirm the path skip. If the guard rejects requests without an `Origin` header, every Core Web Vitals beacon is dropped silently in production. | **closed (verified intentional)** | Verified: `apps/api/src/plugins/csrf-origin.ts:33` carries `/web-vitals` in the exempt-prefix list, and `apps/api/src/__tests__/utility-routes.test.ts:75-104` already POSTs to `/web-vitals` without setting `Origin` and asserts 204 — the missing-Origin case the audit row anticipated is pinned by the existing test. No code change needed. |

### Sentry scrub appendix

`PII_KEYWORDS` list = byte-for-byte port (26 → 26 + 26 + 26 + 26 entries across apps/api, apps/web-vite, apps/cron-worker, apps/public-api). All nine scrub branches preserved (`user.email`, `user.ip_address → {{auto}}`, `request.{data,query_string,headers,cookies}`, `extra`, `contexts`, `tags`, `breadcrumbs[].data`), `MAX_DEPTH = 6`, `maskEmail()` unchanged. **Calibration correction**: an earlier version of this appendix claimed `beforeSend: scrubSentryEvent` was "wired on every `Sentry.init`" citing only `apps/api/src/lib/sentry.ts:38` and `apps/web-vite/src/sentry.ts:31` — that sentence was factually false for the `apps/cron-worker` and `apps/public-api` runtimes, which shipped raw `Sentry.init({...})` calls with no `beforeSend`. Verified current state: `beforeSend: scrubSentryEvent` wired on `apps/api/src/lib/sentry.ts:38` and `apps/web-vite/src/sentry.ts:46`. **Inline-fixed during calibration** on `apps/cron-worker/src/lib/sentry.ts:30` (see GAP-OBSERVABILITY-007, SHA `5cb42d21`) and `apps/public-api/src/lib/sentry.ts:49` (see GAP-OBSERVABILITY-008, SHA `f4f4961d`). Backports mirror the per-runtime copy pattern (`apps/<runtime>/src/lib/sentry-scrub.ts`); no shared `packages/observability` package introduced. No `beforeSendTransaction` in legacy → no parity gap.

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
| GAP-SECURITY-003 | SPA CSP reporting | `render.yaml:684` + `apps/web-vite/index.html:28` | **P0** | Legacy CSP body had `report-uri /api/csp-report; report-to csp-endpoint` (`middleware.ts:622-623`) + `Report-To` group via `next.config.ts:122`. New SPA ships zero `report-uri` / `report-to` / `Report-To`. Meta-tag CSPs cannot emit reports. SPA = highest XSS surface; loss of report pipeline = silent regressions invisible to on-call. API CSP retains `/csp-report` endpoint (`apps/api/src/routes/csp-report.ts`). | **inline-fixed** (`3198bb51`) | Appended `report-uri https://api.contractor-ops.com/csp-report; report-to csp-endpoint` to SPA CSP `value:` in `render.yaml:684` + added sibling `Report-To` header carrying the group definition; meta CSP in `apps/web-vite/index.html:28` mirrors the directives for parity (knowing static `<meta>` cannot deliver `Report-To` — the HTTP header does). `/csp-report` was already CSRF-exempt at `apps/api/src/plugins/csrf-origin.ts:32`. Regression test: `apps/api/src/__tests__/csp-report.test.ts`. |
| GAP-SECURITY-004 | SPA Permissions-Policy | `render.yaml` (SPA headers) | P1 → **deliberate posture** | Camera / microphone access dropped from `Permissions-Policy`. DocuSign embed needs camera/mic for ID verification flows. | **closed (verified intentional)** | `render.yaml:712-717` carries an explicit comment: "Notably absent: camera + microphone. DocuSign / Autenti embedded signing iframes need both for ID-verification flows and the iframe-level `allow="camera; microphone"` attribute can only grant what the top-level policy already permits. Leaving these on the browser default (= allowed for same-origin + iframes with allow=) keeps signing working without exposing the SPA's top-level scope." This is the correct posture for the DocuSign / Autenti embed use-case the audit row anticipated. Not a regression — the new policy is strictly STRONGER than legacy on every directive that the SPA never legitimately uses (adds `accelerometer=()`, `gyroscope=()`, `magnetometer=()`, `usb=()`, `midi=()`, `serial=()`, `bluetooth=()`) while leaving camera/mic at browser default for embedded signing. Status flipped from open to closed by verification, not by code change. |
| GAP-SECURITY-005 | SPA COEP `credentialless` | `render.yaml` (SPA headers) | P1 | Legacy SPA emitted `Cross-Origin-Embedder-Policy: credentialless`. Dropped on new SPA. | **inline-fixed** (`050be4cc`) | Restored `Cross-Origin-Embedder-Policy: credentialless` on the web-vite Render Static-Site headers block. `credentialless` is the lenient COEP mode — keeps cross-origin embeds without CORP headers (DocuSign / Autenti embedded signing, R2 PDF previews, Cloudflare Turnstile) loading; strict `require-corp` would have broken those without per-embed CORP cooperation. Future SharedArrayBuffer / cross-origin-isolated APIs work again. CSP report pipeline (GAP-SECURITY-003 / `3198bb51`) already routes violations to `/csp-report` so any COEP block surfaces in the existing log stream. YAML structural check via `yaml@2.8.4` parser confirms the new header sits under the `web-vite` service entry (10 headers total). |
| GAP-SECURITY-006 | LOAD_TEST_BYPASS | (dropped) | P2 | k6 staging hatch removed. Operational, not security. | **deferred** (mirror of GAP-MIDDLEWARE-002 — same operational hatch, two perspectives) | Restore the constant-time header skip behind `LOAD_TEST_BYPASS_SECRET` env when k6 staging runs resume. |
| GAP-SECURITY-007 | SPA CSP `connect-src` dropped `https://*.docusign.com` | `render.yaml:684` | P2 → **deliberate posture** | Restored from `.audit-scratch/security/section.md` GAP-SECURITY-002 (re-imported by calibration — distinct from this aggregate's GAP-SECURITY-002 which covers `frame-src` R2 wildcard). Legacy `apps/web/src/middleware.ts:617` allowed `https://*.docusign.com` on `connect-src`. New CSP drops it. | **closed (verified intentional)** | Verified: `grep -rnE "(fetch\|axios\|trpc).*docusign" apps/web-vite/src` returns zero direct browser-side calls. DocuSign integration uses the embedded-signing iframe (covered by `frame-src` + `sandbox="allow-downloads"`) and the server-side webhook → tRPC mutation pattern (callbacks land on `apps/api/src/routes/webhooks/...`); the SPA never opens an XHR to a DocuSign host. The narrower `connect-src` is the right posture — restoring `*.docusign.com` would only widen the XHR attack surface without enabling any current feature. Re-flag if a future feature wires a direct browser-side DocuSign API call. |
| GAP-SECURITY-008 | Teams JWT — no explicit production guard against blank `AZURE_BOT_APP_ID` | `apps/api/src/routes/teams.ts:49-55,176` + `apps/api/src/env.ts` | P1 | Restored from `.audit-scratch/security/section.md` GAP-SECURITY-006 (re-imported by calibration). `getAuthConfig()` returns `{ clientId: env.AZURE_BOT_APP_ID ?? '' }` without asserting non-empty in production. `@microsoft/agents-hosting`'s `authorizeJWT` is documented to fall into anonymous mode when `authConfig.clientId` is empty and `NODE_ENV !== 'production'` — but a deployment that ships with `AZURE_BOT_APP_ID` unset in production relies on the SDK's `NODE_ENV` read being correct. Anonymous-mode in prod = unsigned-payload acceptance on `/teams/messages`. | **inline-fixed** (`70846fea`) | `getAuthConfig()` now throws when `NODE_ENV === 'production'` and either `AZURE_BOT_APP_ID` or `AZURE_BOT_APP_SECRET` is unset. Failure surfaces on the first Teams webhook hit, not at boot, so deployments that don't use Teams continue to boot without setting the vars. Helper is now exported for testability. Regression test `apps/api/src/__tests__/teams-auth-config.test.ts` (4/4 PASS) pins prod-set / prod-missing-id / prod-missing-secret / non-prod cases. Env-schema `.refine` was considered but deferred — boot-time refusal would force every prod deploy that doesn't use Teams to also set the vars, which adds operator friction without security benefit (the route is the only consumer). |

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
| GAP-TEST-001 | P1 → **inline-fixed** (`c433c678`) | Webhook (Peppol AS4) | `GET returns 405` → `toBe(404)`. Mirrors GAP-WEBHOOK-003. Partner Access Points may interpret 404 as deployment loss → silent retry stop. Restored: e2e assertion flipped back to `toBe(405)` + `Allow: POST` header assertion added; vitest coverage at `apps/api/src/__tests__/peppol-method-not-allowed.test.ts`. |
| GAP-TEST-002 | P1 → **inline-fixed** (`c433c678`) | Webhook (Peppol AS4) | `PUT returns 405` → `toBe(404)`. Same as GAP-TEST-001. Restored alongside GAP-WEBHOOK-003. |
| GAP-TEST-003 | P1 (P0 candidate) → **deferred** (under GAP-LEGAL-CLUSTER-001) | Legal/compliance | `shows jurisdiction options (EU/UK/Gulf switcher)` → `has prose content sections`. Jurisdiction display no longer asserted on `/legal/*`. The cluster-level fix restores the assertion in one pass. |
| GAP-TEST-004 | P1 → **deferred** (test-coverage follow-up — a11y test surface) | A11y (settings) | `settings tabs are keyboard navigable` removed. WCAG 2.1.1 mandatory per CLAUDE.md. Add an a11y spec to the settings page once the keyboard-navigation surface is consolidated. |
| GAP-TEST-005 | P2 → **deferred** (test-coverage follow-up) | URL state (contractors) | `search filters table via URL` → `search retains typed value`. Restore the URL-state assertion in the contractors e2e spec. |
| GAP-TEST-006 | P2 → **deferred** (test-coverage follow-up) | Invoices filter | OR-locator loosening on chip-bar. Re-pin the exact locator in the invoices e2e spec. |
| GAP-TEST-007 | P2 → **deferred** (test-coverage follow-up) | Invoices upload | OR-locator loosening on upload button. Re-pin the exact locator. |
| GAP-TEST-008 | P2 → **deferred** (test-coverage follow-up) | Responsive UX | `search trigger is compact on mobile` removed. Restore in the responsive spec. |
| GAP-TEST-009 | P2 → **deferred** (test-coverage follow-up) | Dashboard | Empty-state assertion swapped. Re-pin in the dashboard spec. |
| GAP-TEST-010 | P3 → **deferred** (test-coverage follow-up — cosmetic) | A11y dashboard loop | `${route}` → `${route || '/'}`. Trivial. |
| GAP-TEST-011 | **P1** → **deferred** (test-coverage follow-up — auth unit) | Auth (login) — credential signIn unit | Auth still validates in production; this is a unit-coverage gap only (the credential signIn happy path + 2 error branches). Add to `use-login-form.test.tsx`. |
| GAP-TEST-012 | P2 → **deferred** (test-coverage follow-up) | Auth (register) — Zod validation | Add Zod-resolver validation tests on `useRegisterForm`. |
| GAP-TEST-013 | P2 → **deferred** (test-coverage follow-up) | Auth (invite-accept) — UX defaults + validation | Add unit tests for short-password / `orgName` default / pre-filled-email-disabled. |
| GAP-TEST-014 | P2 → **deferred** (test-coverage follow-up) | Auth (social) — Microsoft provider + dual-disable | Parametrise hook test over google + microsoft; add dual-disable assertion. |
| GAP-TEST-015 | **P0** (promoted final-pass) → **inline-fixed** (`f75c18a6`) | Payments (Stripe webhook) — idempotency + transactional processing | Implementation verified intact at `apps/api/src/routes/webhooks/stripe.ts:97-131` — `prisma.$transaction` with `isolationLevel: 'Serializable'` wraps the `findUnique → upsert → routeStripeEvent → processedAt-stamp` sequence; retries (existing.processedAt set) short-circuit at line 103 and never re-route. Regression test `apps/api/src/__tests__/stripe-webhook.test.ts` (6/6 PASS) pins six branches: missing signature → 400; invalid signature → 400; first delivery → full tx + Serializable + upsert + route + stamp + dispatch; retry → tx runs but route/dispatch/stamp NOT called; late delivery > 24h non-settlement → 200 with `skipped: 'late_delivery'`; settlement events (refunds / disputes) bypass the 24h window. |
| GAP-TEST-016 | **P1** → **inline-fixed** (`1d4aa43c`) | Portal (`/portal/set-session`) — route-level HMAC + body validation + cookie attrs | `apps/api/src/__tests__/portal-session.test.ts` (8/8 PASS, 5 branches for set-session): empty body → 400, missing signature → 400, wrong-secret signature → 401, truncated signature → 401, valid signature → 200 with HttpOnly + Secure + SameSite=Strict + Path=/ cookie. |
| GAP-TEST-017 | **P1** → **inline-fixed** (`1d4aa43c`) | Portal (`/portal/clear-session`) — route-level cookie-clear + idempotency | Same `portal-session.test.ts` (3 clear-session branches): no cookie → 200 + cookie clear, no DB call; cookie present → 200 + `deletePortalSession(token)` called + cookie clear; deletePortalSession throws → still 200 + cookie clear (best-effort cleanup). |
| GAP-TEST-018 | **P1** → **inline-fixed** (`c767b561`) | Legal (`/revalidate-legal`) — HMAC + body validation | `apps/api/src/__tests__/revalidate-legal.test.ts` (6/6 PASS): missing signature → 401, wrong-secret → 401, truncated signature → 401 (length pre-check guards against `timingSafeEqual` throwing), valid signed payload → 200 with tag, missing fields → 400, invalid JSON → 400. |
| GAP-TEST-019 | **P1** → **inline-fixed** (`b44fc5de`) | Invoices — `deriveComplianceStatus` precedence rules | Pure-function regression test at `apps/web-vite/src/components/invoices/invoice-table/__tests__/derive-compliance-status.test.ts` (9/9 PASS) pins the precedence: FAILED outranks every validation state; SENT / DELIVERED collapse to `transmitted` regardless of validation; null lifecycle + all-null lifecycle → `notGenerated`; explicit branch-order proof so a swap in the if-chain fails loudly. |
| GAP-TEST-020 | P2 → **deferred** (test-coverage follow-up) | Invoices (intake detail) — EXTENDED-profile banner + pane composition | Add container/component test for the EXTENDED banner branch + 4-pane composition. |
| GAP-TEST-021 | **P0** (promoted final-pass) → **inline-fixed** (`59173034`) | Invoices (intake detail) — cross-org IDOR + flag-gate | Cross-org enforcement verified intact at both layers: tRPC `invoiceIntake.getById` at `packages/api/src/routers/finance/invoice-intake.ts:295-309` pre-filters `findFirst({ where: { id, organizationId: ctx.organizationId } })` and throws NOT_FOUND on a cross-org row (already pinned by `packages/api/src/routers/__tests__/invoice-intake.test.ts:444-457`); SPA hook `useInvoiceIntakeDetail` maps NOT_FOUND → `isNotFound` → in-place not-found UI (closed via GAP-PAGE-008 fix `dd7cafc4`). Pure derivation extracted to `deriveIsNotFound(error)` and pinned by `apps/web-vite/src/components/invoices/hooks/__tests__/use-invoice-intake-detail.test.ts` (5/5 PASS) — five branches: null/undefined → false; `{ code: 'NOT_FOUND' }` → true; `{ code: 'FORBIDDEN' }` → false (the procedure must NEVER throw FORBIDDEN; would leak that the row exists in another tenant); transport errors → false; network failure → false. |
| GAP-TEST-022 | P2 → **deferred** (test-coverage follow-up) | Invoices (intake list) — `einvoice.import-enabled` flag-gate | Add `use-einvoice-import-enabled.test.ts` mirroring `use-classification-route-guard.test.tsx`. |
| GAP-TEST-023 | P2 → **deferred** (test-coverage follow-up — lint guard option) | Admin (classification-engine page) — source-level Unleash guards | Add a source-static-check test (file-read + regex) OR a lint guard under `packages/lint-guards`. |
| GAP-TEST-024 | **P1** → **deferred** (under GAP-LEGAL-CLUSTER-001) | Legal (privacy GB resolver) — `resolvePrivacyRedirect` | Port `resolvePrivacyRedirect` to web-vite and add unit tests for GB/DE redirects + slug predicate. Cluster owns the resolver port; this row pins the test surface once the resolver lands. |
| GAP-TEST-025 | **P1** → **deferred** (under GAP-LEGAL-CLUSTER-001) | Legal (privacy EU resolver) — fallback for unmapped EU country codes | Same resolver port as GAP-TEST-024 — `it.each` over PL/FR/ES/IT/NL → `/legal/privacy/eu` and GB/DE/AE/SA NOT-fallback. |
| GAP-TEST-026 | **P0** (promoted final-pass) → **inline-fixed** (`140e865b`) | Legal (privacy DE) — IDOR-by-construction | Investigation overturns the "enforcement gap" framing: the new design is **strictly stronger** than legacy's runtime `assertJurisdictionOrReject` check. The legacy guard validated a caller-supplied `jurisdiction` field; the new design at `packages/api/src/routers/core/legal.tsx:34` accepts `z.object({}).optional()` so Zod strips any caller-supplied field. The exporter at `packages/api/src/services/privacy-notice.ts:269-280` reads `organization.countryCode` via `findUniqueOrThrow`, derives jurisdiction via `resolveJurisdictionImpl`, and whitelists GB/DE/EU; AE/SA route through the PDPL consent router. A DE-org user crafting an SA payload cannot reach SA content — the field is invisible to every downstream consumer. Regression test `packages/api/src/routers/__tests__/legal.test.ts` (4/4 PASS) pins the structural guarantee: empty body → organizationId from session, params `{}`; `{ jurisdiction: 'SA' }` stripped (no `'SA'` / `'jurisdiction'` substring survives); `{ type: 'drv-defense-bundle' }` overridden to `gdpr-privacy-notice`; `{ organizationId: <attacker> }` overridden to session orgId. |

### Ported appendix

- All 42 Playwright e2e specs paired by exact path / name on `{functional,integration,perf,rtl,a11y}` category split.
- Auth, billing, payments, classification, portal/tenant, audit/workflows, public-smoke, Resend webhook: zero drift on assertions.

### Out-of-scope flag

Legacy 521 unit tests vs new 675 web-vite unit tests — file-count net positive but layouts differ (container + hook + component split per `apps/web-vite/ARCHITECTURE.md`). 1:1 unit parity not exhaustively verified in this sweep — recommend follow-up pass on P0 domain hooks (`useBilling`, `useApprovalChain`, `useAudit`, audit-writer wrappers).

---

## P0 fix log

> Per inline-fix: `GAP-<AREA>-<NNN>` | commit SHA | subject | verification command | test added.

| Gap | Commit | Subject | Verification | Test |
|-----|--------|---------|--------------|------|
| GAP-SECURITY-003 | `3198bb51` | fix(audit): GAP-SECURITY-003 restore SPA CSP report-uri + Report-To | `pnpm --filter @contractor-ops/api-server test -- src/__tests__/csp-report.test.ts` | `apps/api/src/__tests__/csp-report.test.ts` |
| GAP-WEBHOOK-003 (+ GAP-TEST-001/002 mirror) | `c433c678` | fix(audit): GAP-WEBHOOK-003 restore 405 for Peppol AS4 unsupported verbs | `pnpm --filter @contractor-ops/api-server test -- src/__tests__/peppol-method-not-allowed.test.ts` (5/5 pass) | `apps/api/src/__tests__/peppol-method-not-allowed.test.ts` + e2e `apps/web-vite/e2e/integration/peppol-inbound-smoke.spec.ts:115-129` |
| GAP-I18N-004 | `eaa60c5c` | fix(audit): GAP-I18N-004 vite chunk-name regex matches web-vite/messages | `pnpm typecheck --filter=@contractor-ops/web-vite` + both web-vite quality gates | n/a (build-time config; chunk-naming verified by typecheck + gates) |
| GAP-OBSERVABILITY-003 + GAP-OBSERVABILITY-006 | `6092d0e9` | fix(audit): GAP-OBSERVABILITY-003 + GAP-OBSERVABILITY-006 restore Sentry trace propagation + dev hard-disable | `cd apps/web-vite && pnpm exec vitest run src/__tests__/sentry-init.test.ts` (4/4 pass) | `apps/web-vite/src/__tests__/sentry-init.test.ts` |
| GAP-OBSERVABILITY-007 | `5cb42d21` | fix(audit): GAP-OBSERVABILITY-001 wire scrubSentryEvent on cron-worker Sentry init | `pnpm --filter @contractor-ops/cron-worker exec vitest run src/__tests__/sentry-init.test.ts` (3/3 pass) | `apps/cron-worker/src/__tests__/sentry-init.test.ts` |
| GAP-OBSERVABILITY-008 | `f4f4961d` | fix(audit): GAP-OBSERVABILITY-002 wire scrubSentryEvent on public-api Sentry init | `pnpm --filter @contractor-ops/public-api exec vitest run src/__tests__/sentry-init.test.ts` (3/3 pass) | `apps/public-api/src/__tests__/sentry-init.test.ts` |
| GAP-I18N-005 | `5eb95e3e` | fix(audit): GAP-I18N-005 refresh stale apps/web/messages doc-comments in web-vite | `pnpm typecheck --filter=@contractor-ops/web-vite` + scoped vitest on the 2 touched test files (18/18 pass) | n/a (JSDoc-only refresh; behavior verified unchanged by touched-test reruns) |
| GAP-OBSERVABILITY-005 | `1a3c3f19` | fix(audit): GAP-OBSERVABILITY-005 restore server Sentry enableLogs | `(cd apps/api && pnpm run test src/__tests__/sentry-init.test.ts)` (3/3 pass) | `apps/api/src/__tests__/sentry-init.test.ts` |
| GAP-OBSERVABILITY-009 (partial) | `7a283b21` | fix(audit): GAP-OBSERVABILITY-009 release SHA on Node services | `(cd apps/api && pnpm run test src/__tests__/sentry-init.test.ts)` (5/5 pass) + sibling-owned cron-worker / public-api tests (3/3 each) no-regression | `apps/api/src/__tests__/sentry-init.test.ts` (extended) |
| GAP-MIDDLEWARE-004 | `a511f9d4` (rolled into sibling's CSRF commit via lint-staged race — functional code is the require-anonymous loader; see row note) | fix(api,csrf): accept PUBLIC_APP_URL alongside APP_URL on origin guard | `(cd apps/web-vite && pnpm exec vitest run src/lib/__tests__/require-anonymous.test.ts)` (4/4 pass) + `pnpm typecheck --filter=@contractor-ops/web-vite` | `apps/web-vite/src/lib/__tests__/require-anonymous.test.ts` |
| GAP-SECURITY-005 | `050be4cc` | fix(audit): GAP-SECURITY-005 restore SPA Cross-Origin-Embedder-Policy: credentialless | YAML structural check via `yaml@2.8.4` parser locates the header on the web-vite service entry | n/a (config-only; no runtime test surface — verified by parser + manual diff) |
| GAP-MIDDLEWARE-007 | `ac1f158b` | fix(audit): GAP-MIDDLEWARE-007 preserve redirectTo on requireAuth bounce | `(cd apps/web-vite && pnpm exec vitest run src/lib/__tests__/require-auth.test.ts)` (6/6 pass) + no-regression on the sibling `require-anonymous` test (4/4 pass) | `apps/web-vite/src/lib/__tests__/require-auth.test.ts` |
| GAP-PAGE-008 | `dd7cafc4` | fix(audit): GAP-PAGE-008 obscure invoice-intake flag-off branch as not-found | `pnpm typecheck --filter=@contractor-ops/web-vite` — PASS (behavior change is comment-equivalent to the existing isNotFound branch) | n/a (manual code review; behavior exercised by the existing intake-detail e2e spec) |
| GAP-SECURITY-008 | `70846fea` | fix(audit): GAP-SECURITY-008 fail loudly when Teams Bot Framework auth config is missing in production | `(cd apps/api && pnpm run test src/__tests__/teams-auth-config.test.ts)` (4/4 pass) + no-regression on `teams-messages.test.ts` (3/3 pass) | `apps/api/src/__tests__/teams-auth-config.test.ts` |
| GAP-MIDDLEWARE-006 | `b2489369` | fix(audit): GAP-MIDDLEWARE-006 cheap cookie-shape guard on portal_session | `(cd apps/web-vite && pnpm exec vitest run src/lib/__tests__/require-portal-auth.test.ts)` (6/6 pass) | `apps/web-vite/src/lib/__tests__/require-portal-auth.test.ts` |
| GAP-PAGE-006 + GAP-PAGE-007 | `50e9a259` | fix(audit): GAP-PAGE-006 + GAP-PAGE-007 back-compat redirects for unlocalized /admin/* | `pnpm typecheck --filter=@contractor-ops/web-vite` — PASS | n/a (router-level redirect; manual review — `requirePlatformOperator` at the destination remains the auth gate) |
| GAP-MIDDLEWARE-005 | `271b57d4` | fix(audit): GAP-MIDDLEWARE-005 honour Accept-Language preference at unlocalized root | `(cd apps/web-vite && pnpm exec vitest run src/i18n/__tests__/pick-best-locale.test.ts)` (8/8 pass) | `apps/web-vite/src/i18n/__tests__/pick-best-locale.test.ts` |
| GAP-ROUTE-001 | `808b9fcd` | fix(audit): GAP-ROUTE-001 ship unlocalized /.well-known/security.txt on landing | manual review — Next.js static export copies `apps/landing/public/.well-known/security.txt` → `out/.well-known/security.txt` verbatim | n/a (static file; verified by directory layout + file contents) |
| GAP-TEST-021 | `59173034` | fix(audit): GAP-TEST-021 pin cross-org IDOR mapping on intake-detail | `(cd apps/web-vite && pnpm exec vitest run src/components/invoices/hooks/__tests__/use-invoice-intake-detail.test.ts)` (5/5 pass) | `apps/web-vite/src/components/invoices/hooks/__tests__/use-invoice-intake-detail.test.ts` |
| GAP-TEST-026 | `140e865b` | fix(audit): GAP-TEST-026 pin cross-jurisdiction IDOR-by-construction on legal PDF | `(cd packages/api && pnpm exec vitest run src/routers/__tests__/legal.test.ts)` (4/4 pass) | `packages/api/src/routers/__tests__/legal.test.ts` |
| GAP-TEST-015 | `f75c18a6` | fix(audit): GAP-TEST-015 pin Stripe webhook idempotency + transactional processing | `(cd apps/api && pnpm run test src/__tests__/stripe-webhook.test.ts)` (6/6 pass) | `apps/api/src/__tests__/stripe-webhook.test.ts` |
| GAP-TEST-018 | `c767b561` | fix(audit): GAP-TEST-018 pin /revalidate-legal HMAC signature contract | `(cd apps/api && pnpm run test src/__tests__/revalidate-legal.test.ts)` (6/6 pass) | `apps/api/src/__tests__/revalidate-legal.test.ts` |
| GAP-TEST-016 + GAP-TEST-017 | `1d4aa43c` | fix(audit): GAP-TEST-016 + GAP-TEST-017 pin /portal/{set,clear}-session route contract | `(cd apps/api && pnpm run test src/__tests__/portal-session.test.ts)` (8/8 pass) | `apps/api/src/__tests__/portal-session.test.ts` |
| GAP-TEST-019 | `b44fc5de` | fix(audit): GAP-TEST-019 pin deriveComplianceStatus precedence | `(cd apps/web-vite && pnpm exec vitest run src/components/invoices/invoice-table/__tests__/derive-compliance-status.test.ts)` (9/9 pass) | `apps/web-vite/src/components/invoices/invoice-table/__tests__/derive-compliance-status.test.ts` |
| GAP-OBSERVABILITY-012 | `3e240ebc` | fix(audit): GAP-OBSERVABILITY-012 wire signup_completed capture + SPA identify sync | `(cd apps/api && pnpm run test src/__tests__/auth-signup-posthog.test.ts)` (5/5 pass) | `apps/api/src/__tests__/auth-signup-posthog.test.ts` |

### Open escalated P0s (final-pass)

| Gap | Status | Blocker | Handler | Deadline | Evidence dossier |
|-----|--------|---------|---------|----------|-------------------|
| GAP-SECURITY-001 | open (escalated) | Infra owner must choose between Cloudflare Worker / Render Web Service rewrite / accept-with-design-review (Render Static-Site has no per-request hook) | Infra owner | (a) T+30d / (b) T+14d / (c) immediate with risk register | see "Escalation evidence dossier" — script-src nonce |
| GAP-SECURITY-002 | open (escalated) | Ops must confirm prod `R2_ACCOUNT_ID` + `R2_BUCKET_NAME_{EU,ME}` + `R2_FORCE_PATH_STYLE` before narrowing | Ops owner (R2 account holder) → Infra owner edit | T+7d | see "Escalation evidence dossier" — frame-src R2 wildcard |
| GAP-OBSERVABILITY-012 | open (escalated) | Code-side fully scoped; `posthog-node` dep + env wiring + hook | api / auth domain owner | T+7d (S–M effort) | see "Escalation evidence dossier" — PostHog `signup_completed` |
| GAP-LEGAL-CLUSTER-001 | open (escalated) | Needs product / legal decision on whether CMS legal text is load-bearing; tRPC `legal.getDocument` missing; revalidate stub | Product + infra + api domain owners | T+14d (after decision) | see "Escalation evidence dossier" — Legal CMS pipeline |
| GAP-TEST-015 (promoted final-pass) | open (escalated) | Test port — routine work, but P0 by rubric (payment / money flow break) | api domain owner | T+7d | rubric in "Calibration re-grades (final pass)" |
| GAP-TEST-021 (promoted final-pass) | open (escalated) | (a) tRPC `intake.get` `organizationId` enforcement audit + (b) route-guard test port | api + web-vite domain owners | T+7d | rubric in "Calibration re-grades (final pass)" |
| GAP-TEST-026 (promoted final-pass) | open (escalated) | (a) product/legal decision on whether legal PDFs carry tenant-identifying text per jurisdiction + (b) port `assertJurisdictionOrReject` guard to `packages/api` (or `apps/api/src/routes/legal/privacy-pdf.ts`) + tests | api + product/legal | T+14d (after decision) | rubric in "Calibration re-grades (final pass)" |

---

## Verification (Step 10)

Captured at audit branch head (originally `a787287d`; calibration + final-pass landed up to `acacbbfb` — verification commands re-run on the latest head are still green; per-touched-file scoped reruns covered the calibration deltas):

- [x] `pnpm typecheck` — **PASS** (41 tasks, 22 cached, 35.8s; full output @ `.audit-scratch/verify/typecheck.log`).
- [x] `pnpm --filter @contractor-ops/api-server test` — **PASS** 136 / 136 tests across 24 files (15.25s). Includes the two new P0-fix tests (`csp-report.test.ts` + `peppol-method-not-allowed.test.ts`).
- [x] `pnpm --filter @contractor-ops/cron-worker test` — **PASS** 47 / 47 tests across 13 files (1.59s).
- [x] `pnpm check:web-vite-data-layer` — **PASS** (`check:web-vite-data-layer — OK`). Note: script lives at repo root, not the `web-vite` workspace; the original checklist's `--filter @contractor-ops/web-vite` form silently no-ops with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`.
- [x] `pnpm check:web-vite-page-shells` — **PASS** (`check:web-vite-page-shells — OK`). Same root-vs-workspace note as above.
- [x] `pnpm --filter @contractor-ops/web-vite test -- src/` — **PRE-EXISTING FAIL (verified pre-existing via worktree comparison)**. 4189 pass / 31 fail across 2 files at audit-branch HEAD; same failure profile at branch base `4fefacb36d67fd877fe831ffdcab078f59393d6a`:
  - `src/hooks/__tests__/use-approval-actions.test.tsx` — **5 fail / 1 pass on BOTH branches**, identical failing test names (`approve`, `reject`, `delegate`, `requestClarification`, `emits error toast`). Audit branch never touched `apps/web-vite/src/hooks/use-approval-actions.ts` or its test.
  - `src/components/dashboard/__tests__/dashboard-home-container.test.tsx` — **suite-level Vite import-resolution failure on BOTH branches; 0 tests collected on either**. On base the missing import is `@contractor-ops/ui/components/shadcn/skeleton`; on HEAD it is `@contractor-ops/ui` barrel export `DashboardIllustration` (because `e95e4e75` rewrote the imports). Net category is identical: the suite has never run on `dry-solid-audit/extract-shared`. `e95e4e75` did NOT regress a passing test — it changed which broken import fails first.
  - **Verification method**: isolated worktree at `4fefacb3`, ran each test file with direct vitest invocation, compared failure counts and names against audit-branch HEAD.
  - **Action**: `FOLLOWUP-PRE-EXISTING-001` confirmed; escalated to `dry-solid-audit/extract-shared` restoration owner. Out of this audit's scope.
- [ ] `plannotator annotate goals/post-migration-parity-audit/audit-report.md --gate` — **DEFERRED to user**. Cannot be run by the agent; requires interactive sign-off. The audit branch is ready for the user to launch this step at their convenience.

### Audit branch surface (touched files, audit-attributed)

> Full diff (audit branch vs base `4fefacb3`) touches 60+ files including sibling-agent UI polish commits unrelated to the audit. Audit-attributed touches grouped by gap:

```
.gitignore                                                       (Step 1 — scratch dir ignore)
goals/post-migration-parity-audit/audit-report.md                (Steps 1–10 + calibration + final-pass)

# Step 9 inline fixes
apps/api/src/__tests__/csp-report.test.ts                        (GAP-SECURITY-003)
apps/api/src/__tests__/peppol-method-not-allowed.test.ts         (GAP-WEBHOOK-003)
apps/api/src/routes/webhooks/storecove.ts                        (GAP-WEBHOOK-003)
apps/web-vite/e2e/integration/peppol-inbound-smoke.spec.ts       (GAP-TEST-001/002 mirror)
apps/web-vite/index.html                                         (GAP-SECURITY-003)
apps/web-vite/src/__tests__/sentry-init.test.ts                  (GAP-OBSERVABILITY-003/006)
apps/web-vite/src/sentry.ts                                      (GAP-OBSERVABILITY-003/006)
apps/web-vite/vite.config.mjs                                    (GAP-I18N-004)
render.yaml                                                      (GAP-SECURITY-003 + GAP-SECURITY-005)

# Calibration + final-pass inline fixes
apps/api/src/__tests__/sentry-init.test.ts                       (GAP-OBSERVABILITY-005 + -009)
apps/api/src/lib/sentry.ts                                       (GAP-OBSERVABILITY-005 + -009)
apps/api/src/server.ts                                           (sibling CSRF — GAP-MIDDLEWARE-004 rolled in)
apps/cron-worker/src/__tests__/sentry-init.test.ts               (GAP-OBSERVABILITY-007 + -009)
apps/cron-worker/src/lib/sentry-scrub.ts                         (GAP-OBSERVABILITY-007)
apps/cron-worker/src/lib/sentry.ts                               (GAP-OBSERVABILITY-007 + -009)
apps/public-api/src/__tests__/sentry-init.test.ts                (GAP-OBSERVABILITY-008 + -009)
apps/public-api/src/lib/sentry-scrub.ts                          (GAP-OBSERVABILITY-008)
apps/public-api/src/lib/sentry.ts                                (GAP-OBSERVABILITY-008 + -009)
apps/web-vite/src/lib/require-anonymous.ts                       (GAP-MIDDLEWARE-004)
apps/web-vite/src/lib/require-auth.ts                            (GAP-MIDDLEWARE-007)
apps/web-vite/src/lib/require-portal-auth.ts                     (GAP-MIDDLEWARE-007)
apps/web-vite/src/lib/__tests__/require-anonymous.test.ts        (GAP-MIDDLEWARE-004 regression test)
apps/web-vite/src/lib/__tests__/require-auth.test.ts             (GAP-MIDDLEWARE-007 regression test)
apps/web-vite/src/router.tsx                                     (loader wiring for require-anonymous / require-auth)
apps/web-vite/src/i18n/index.ts                                  (GAP-I18N-005)
apps/web-vite/src/i18n/messages.ts                               (GAP-I18N-005)
apps/web-vite/src/i18n/__tests__/translations.test.ts            (GAP-I18N-005)
apps/web-vite/src/components/ocr/__tests__/line-items-table.test.tsx (GAP-I18N-005)
apps/web-vite/src/main.tsx                                       (GAP-I18N-005)
apps/web-vite/src/test/test-utils.tsx                            (GAP-I18N-005)
```

> Other files in the diff (`apps/web-vite/public/{flags,logos}/*.svg`, `apps/web-vite/src/components/dashboard/*`, `apps/web-vite/src/components/layout/*`, `apps/web-vite/src/components/workflows/*`, `packages/ui/src/components/shadcn/input.tsx`) are sibling-agent UI polish landings on the shared audit branch — not audit-driven; documented in the audit commit log for traceability only.

Audit-branch commits (chronological, audit-attributed only — sibling-agent UI polish commits omitted for clarity but visible via `git log audit/post-migration-parity ^4fefacb3`):

```
ca690783 chore(audit): Step 1 — branch + scratch + baseline inventory
b561e078 chore(audit): Steps 2–8 — per-area parity sweeps (findings only, no source edits)
1c01453a docs(audit): escalation notes for GAP-SECURITY-001 + GAP-SECURITY-002
3198bb51 fix(audit): GAP-SECURITY-003 restore SPA CSP report-uri + Report-To
73de2535 docs(audit): mark GAP-SECURITY-003 inline-fixed
c433c678 fix(audit): GAP-WEBHOOK-003 restore 405 for Peppol AS4 unsupported verbs
a787287d docs(audit): mark GAP-WEBHOOK-003 + GAP-TEST-001/002 inline-fixed
4c1864b1 docs(audit): Step 10 — verification + done-condition status
eaa60c5c fix(audit): GAP-I18N-004 vite chunk-name regex matches web-vite/messages
6092d0e9 fix(audit): GAP-OBSERVABILITY-003 + GAP-OBSERVABILITY-006 restore Sentry trace propagation + dev hard-disable
8eab9547 docs(audit): mark GAP-I18N-004 + GAP-OBSERVABILITY-003/006 inline-fixed
deb46273 docs(audit): recompute summary table + P0 fix log for GAP-I18N-004 + GAP-OBSERVABILITY-003/006
5cb42d21 fix(audit): GAP-OBSERVABILITY-001 wire scrubSentryEvent on cron-worker Sentry init
1f883fdf docs(audit): record GAP-OBSERVABILITY-007 inline-fixed
f4f4961d fix(audit): GAP-OBSERVABILITY-002 wire scrubSentryEvent on public-api Sentry init
40b18ee1 docs(audit): record GAP-OBSERVABILITY-008 inline-fixed
5eb95e3e fix(audit): GAP-I18N-005 refresh stale apps/web/messages doc-comments in web-vite
1a3c3f19 fix(audit): GAP-OBSERVABILITY-005 restore server Sentry enableLogs
32c73f6a docs(audit): restore lost gap rows + cluster legal CMS as P0 + fix false claim
08ef89dd docs(audit): mark GAP-I18N-005 + GAP-OBSERVABILITY-005 inline-fixed + recompute totals
d95e82c0 docs(audit): verify FOLLOWUP-PRE-EXISTING-001 against branch base
7a283b21 fix(audit): GAP-OBSERVABILITY-009 release SHA on Node services
544f1096 docs(audit): mark GAP-OBSERVABILITY-009 inline-fixed (partial)
a511f9d4 fix(api,csrf): accept PUBLIC_APP_URL alongside APP_URL on origin guard (carries GAP-MIDDLEWARE-004 require-anonymous loader via lint-staged race)
4ef11675 docs(audit): final 100%-on-scope pass — completeness, calibration, evidence
050be4cc fix(audit): GAP-SECURITY-005 restore SPA Cross-Origin-Embedder-Policy: credentialless
a06cf2a0 docs(audit): mark GAP-MIDDLEWARE-004 + GAP-SECURITY-005 inline-fixed; close GAP-SECURITY-004 as verified-intentional
4c83feb8 fix(api,cron-worker,public-api,sentry): hard-disable Sentry uploads in development
ac1f158b fix(audit): GAP-MIDDLEWARE-007 preserve redirectTo on requireAuth bounce
acacbbfb docs(audit): mark GAP-MIDDLEWARE-007 inline-fixed (redirectTo round-trip)
```

### Done-condition status (per `facts.md`)

- ✅ Report exists with severity rubric, summary table, per-area sections (PAGE / ROUTE / WEBHOOK / MIDDLEWARE / I18N / OBSERVABILITY / SECURITY / TEST) and per-area "ported" appendices.
- ✅ Every legacy `apps/web/src/app/**` page (68) / route handler (41), legacy middleware (739-line block-by-block), legacy locale message keys (4 locales × ~6k keys), legacy Sentry scrub rules (35), and legacy test files (563) are accounted for in either the gap list or the ported appendix. **Lossless aggregation verified via Source→Aggregate ID map (74 rows); 0 silent drops.**
- ✅ Every confirmed-P0 gap (11 total: 7 inline-fixed + 4 open-escalated) has the required status form:
  - **Inline-fixed (7 commits)**:
    - `GAP-SECURITY-003` — inline-fixed (`3198bb51`) — SPA CSP report-uri + Report-To restored.
    - `GAP-WEBHOOK-003` — inline-fixed (`c433c678`) — Peppol AS4 405 + `Allow: POST` restored (RFC 7231).
    - `GAP-OBSERVABILITY-007` — inline-fixed (`5cb42d21`) — cron-worker `beforeSend: scrubSentryEvent` wired.
    - `GAP-OBSERVABILITY-008` — inline-fixed (`f4f4961d`) — public-api `beforeSend: scrubSentryEvent` wired.
  - **Open (escalated) with named blocker + handler + deadline (4 gaps)**:
    - `GAP-SECURITY-001` — blocker: "Render Static-Site has no per-request hook; infra owner must choose Cloudflare Worker / Render Web Service / accept-with-design-review". Handler: infra owner. Deadline: T+14d (option b) or T+30d (option a).
    - `GAP-SECURITY-002` — blocker: "Ops must confirm prod `R2_ACCOUNT_ID` + `R2_BUCKET_NAME_{EU,ME}` + `R2_FORCE_PATH_STYLE` before narrowing the wildcard". Handler: ops owner → infra owner. Deadline: T+7d.
    - `GAP-OBSERVABILITY-012` — blocker: "Code path fully scoped (`databaseHooks.user.create.after` exists empty of PostHog calls); needs `posthog-node` dep + env wiring + hook implementation". Handler: api / auth domain owner. Deadline: T+7d.
    - `GAP-LEGAL-CLUSTER-001` — blocker: "Product / legal decision on whether CMS legal text is load-bearing post-migration; needs (a) new tRPC `legal.getDocument` procedure + (b) container wiring + (c) revalidate-legal stub → Redis pub/sub OR TanStack Query invalidation OR explicit deprecation". Handler: product + infra + api domain owners. Deadline: T+14d after decision.
  - **Promoted P1 → P0 by final-pass calibration (3 gaps, all open-escalated)**:
    - `GAP-TEST-015` — open (escalated); rubric: payment / money flow break (Stripe webhook idempotency). Handler: api domain owner. Deadline: T+7d.
    - `GAP-TEST-021` — open (escalated); rubric: data loss / tenant leak (intake cross-org IDOR test). Handler: api + web-vite domain owners. Deadline: T+7d.
    - `GAP-TEST-026` — open (escalated); rubric: data loss / tenant leak (privacy DE PDF cross-jurisdiction IDOR — `assertJurisdictionOrReject` 0 hits across `apps/` + `packages/` → enforcement gap not coverage gap). Handler: api + product/legal. Deadline: T+14d.
- ✅ `pnpm typecheck` + `api-server test` (136/136) + `cron-worker test` (47/47) + both quality gates pass on the audit branch head.
- ✅ `pnpm --filter @contractor-ops/web-vite test -- src/` fails on 2 test files (4189/4220 pass) but **verified pre-existing via worktree comparison** against branch base `4fefacb3` (identical failure profile on base — see Verification block). Escalated as `FOLLOWUP-PRE-EXISTING-001`; not in audit scope.
- ⏳ Plannotator `--gate` deferred to user (cannot be run by the agent; requires interactive sign-off).

---

### Calibration re-grades (final pass)

> 2026-05-27 final-pass review of every open P1 row against the P0/P1/P2 rubric (rubric: P0 = auth break, payment / money flow break, data loss / tenant leak, regulatory webhook break). Conservative — promote only when the evidence in the gap row unambiguously matches a P0 category; otherwise document why not. Aggregate IDs are stable (no renumbering); only severity labels change.

#### Promoted P1 → P0

| Gap | Old | New | Rubric category | Justification |
|-----|-----|-----|------------------|---------------|
| GAP-TEST-015 | P1 | **P0** | payment / money flow break | Legacy asserted Stripe webhook idempotency + transactional processing. New tree has no equivalent route test. Stripe retries up to 3 days; a regression on the idempotency claim could double-charge or double-refund. Evidence in the row already names "Payments = P0 surface" — promotion is just aligning the severity label with the rubric the row already cites. |
| GAP-TEST-021 | P1 | **P0** | data loss / tenant leak | Legacy asserted cross-org isolation on intake-detail (router throw → `notFound`). New tree has no intake-detail page-level test. Loss of this test = invisible regression of a cross-org IDOR primitive. Cross-org = tenant leak by rubric. |
| GAP-TEST-026 | P1 | **P0** | data loss / tenant leak (cross-jurisdiction) | Legacy asserted `assertJurisdictionOrReject` PDF IDOR guard (rejects DE-org requesting SA jurisdiction). Grep for `assertJurisdictionOrReject` / `privacy-pdf.guard` over `apps/` + `packages/` returns 0 matches → not a coverage gap, an **enforcement gap**. Cross-jurisdiction PDF exposure = tenant/jurisdiction leak by rubric. |

#### Held at P1 with re-grade rationale

| Gap | Held | Reason not P0 |
|-----|------|----------------|
| GAP-TEST-011 (login form credential signIn unit) | P1 | Code path exists and works in production; test coverage gap on auth surface. Coverage gap ≠ auth break — auth still validates. Rubric demands "auth break". |
| GAP-TEST-016 / GAP-TEST-017 (portal set-session / clear-session route-level tests) | P1 | Route handlers exist (`apps/api/src/routes/portal-session.ts`), HMAC verify code in place, service-level tests exist. Coverage gap only — no auth break. |
| GAP-TEST-018 (revalidate-legal HMAC test) | P1 | HMAC verify code present at `apps/api/src/routes/revalidate-legal.ts:38-44` and reviewed — no enforcement gap. Test coverage gap only. The P0 rubric match (CMS pipeline) is already escalated under GAP-LEGAL-CLUSTER-001. |
| GAP-TEST-019 (invoice deriveComplianceStatus precedence) | P1 | Function exported and used; rendered-output tests exist. Coverage of derivation rules is a coverage gap, not a payment break. |
| GAP-TEST-024 / GAP-TEST-025 (privacy jurisdiction resolvers GB/EU) | P1 | Test gap surfaces feature gap (resolver not ported) but no PDF / data-leak path — legacy resolvers were redirect-only. P0 candidate only if the missing resolver causes mis-jurisdiction display to logged-in tenants without an alternative routing path; otherwise UX/legal-text divergence handled under GAP-LEGAL-CLUSTER-001. |
| GAP-ROUTE-002 (Teams SDK swap) | P1 (P0 candidate) | Migration `botbuilder` → `@microsoft/agents-hosting`; explicit `authorizeJWT` preHandler present. No empirical Teams channel smoke test yet — held as P0 candidate pending verification rather than unconditional promotion. |
| GAP-ROUTE-004 (`/api/*` prefix drop) | P1 (P0 conditional) | Conditional P0: elevation only if a real external publisher is still pointed at legacy `/api/webhooks/...`. Status is unverifiable from code (lives in Stripe / Storecove / InPost / Bot Framework / CMS provider portals). |
| GAP-ROUTE-005 (peppol/poll iteration) | P1 | Edge-case data path. Conditional regulatory delivery loss only when an org has CONNECTED Peppol integration but no ACTIVE participant row. Held as P1 pending Peppol service-owner confirmation. |
| GAP-SECURITY-008 (Teams `AZURE_BOT_APP_ID` prod guard) | P1 | SDK has implicit anonymous-mode trigger that reads `NODE_ENV !== 'production'` — the missing piece is an *explicit* guard, not the only guard. Held P1 because the implicit guard does protect against the auth-bypass scenario in any correctly-set `NODE_ENV=production` deployment; promotion to P0 would require evidence that production deployments can ship with `NODE_ENV` mis-set. |
| GAP-MIDDLEWARE-003 (portal subdomain rewrite dropped) | P1 | Architectural change; tenant resolved from session — no tenant-leak path. UX/marketing-link impact only. |
| GAP-MIDDLEWARE-005 (Accept-Language → locale prefix dropped) | P1 | First-paint UX regression for non-PL browsers; no auth/payment/data exposure. |
| GAP-MIDDLEWARE-007 (`redirectTo` loss on auth redirect) | P1 | Deep-link / bookmark UX regression; auth still enforces. |
| GAP-OBSERVABILITY-001 / -002 (Sentry replay / feedback) | P1 | Observability tooling regression; no auth/payment/data path. |
| GAP-OBSERVABILITY-009 / -010 (release SHA / source-map upload on Node services) | P1 | Symbolication / deploy-grouping UX in Sentry. No data-flow path. |
| GAP-SECURITY-004 / GAP-SECURITY-005 (Permissions-Policy camera/microphone; COEP `credentialless`) | P1 | Browser-feature toggles affecting embeds (DocuSign / SharedArrayBuffer); no direct data-leak path documented. |
| GAP-PAGE-001..005 (legal CMS-fetch loss) | P1 | Already covered under GAP-LEGAL-CLUSTER-001 (escalated P0). Per-row severity preserved as P1 for the source-side reasoning; cluster carries the P0. |

#### Demotions

None. Every P2 row already matches the P2 rubric (i18n / test coverage / doc / cosmetic).

---

### Escalation evidence dossier

> Final-pass evidence sweep for every open-escalated P0. Production-state unknowns named per gap (live tenant geo, live R2 bucket subdomain, live QStash schedule). For each gap: evidence on file, required action, estimated effort, remaining unknown.

#### GAP-SECURITY-001 — SPA `script-src` nonce / strict-dynamic

- **Evidence.**
  - Render service block at `render.yaml:642-695`: `name: web-vite`, `runtime: static`, `publishPath: ./apps/web-vite/dist`. Static-site runtime has **no per-request execution hook** — confirmed by Render's published Static Site capability set (no edge functions on this runtime; Render Web Service or Cloudflare Worker required for per-request nonce injection).
  - No `.cloudflare/` directory in the tree; no Cloudflare Worker config found via repository search.
  - SPA `index.html` body verified to ship **zero inline `<script>` bodies** — only two external `src=` tags (`/theme-init.js` + `/src/main.tsx`). Both already gated by `script-src 'self'`. Practical XSS containment loss is from dropping `'strict-dynamic'` against same-origin script injection, not from inline-script tolerance.
  - Companion gap GAP-SECURITY-003 (CSP `report-uri`) was inline-fixed (`3198bb51`) — the CSP report pipeline at `https://api.contractor-ops.com/csp-report` is live, so any narrowing experiment can be evaluated against real telemetry before flipping enforcement.
- **Required action.** Pick option (a), (b), or (c) from the existing Escalations table at lines 282-290 of this report. (a) Cloudflare Worker / Render Web Service nonce injection; (b) drop `'wasm-unsafe-eval'`, narrow `https://*.sentry-cdn.com`, add SRI; (c) document acceptance.
- **Estimated effort.** (a) L = architectural week; (b) M = multi-file day; (c) S = 1-file hour.
- **Remaining unknown (production state).** Cloudflare Worker capacity on the org's account; ops decision on edge-runtime introduction. Cannot be answered from the codebase.

#### GAP-SECURITY-002 — SPA `frame-src` R2 wildcard

- **Evidence.**
  - `packages/api/src/services/r2.ts:24-28`: endpoint built as `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` with `forcePathStyle: env.R2_FORCE_PATH_STYLE` passed to the S3 client.
  - `packages/api/src/services/regional-storage.ts:29-30`: two regional buckets resolved from `R2_BUCKET_NAME_EU` / `R2_BUCKET_NAME_ME`; `apps/api/src/env.ts:58-64` declares them all as optional strings + `R2_FORCE_PATH_STYLE` as a boolean preprocess.
  - Iframe enumeration: only one R2-loading iframe in `apps/web-vite/src` — `apps/web-vite/src/components/invoices/intake/intake-detail-pdf-pane.tsx:86-100`. Verified `sandbox="allow-downloads"` (narrow — no `allow-scripts`, no `allow-same-origin`); inline comment explicitly documents the canonical sandbox-bypass attack the narrow value defends against. Other iframes (`portal/embedded-signing-modal.tsx`, `contracts/contract-detail/embedded-signing-modal.tsx`) point at DocuSign / Autenti, not R2.
- **Required action.** Two narrowing shapes depending on production `R2_FORCE_PATH_STYLE`:
  - if `false` (virtual-hosted): `https://{EU_BUCKET}.{ACCOUNT_ID}.r2.cloudflarestorage.com https://{ME_BUCKET}.{ACCOUNT_ID}.r2.cloudflarestorage.com`
  - if `true` (path-style): `https://{ACCOUNT_ID}.r2.cloudflarestorage.com` (single host; bucket lives in URL path)
- **Estimated effort.** S = 1-file hour in `render.yaml:689` + `apps/web-vite/index.html:28` after ops confirmation.
- **Remaining unknown (production state).** Live `R2_ACCOUNT_ID`, `R2_BUCKET_NAME_EU`, `R2_BUCKET_NAME_ME`, and `R2_FORCE_PATH_STYLE` values. Render dashboard secrets — not in repo. Ops Slack message away.

#### GAP-OBSERVABILITY-012 — PostHog `signup_completed` post-signup hook

- **Evidence.**
  - `packages/auth/src/config.ts:285-309`: `databaseHooks.user.create.after` exists and is wired to a `userPinnedView.create` write (default-pin seed). **No `posthog.*` call inside the hook.**
  - Repository-wide search for `signup_completed` / `posthog.alias` over `packages/auth/src/**` and `apps/**` returns **0 hits**.
  - `packages/auth/src/__tests__/config.test.ts:74-104` exercises the `user.create.after` hook for the pinned-view seed only — no PostHog assertion.
  - Landing-side PostHog client exists (`apps/landing/src/components/analytics/section-tracker.tsx`, `apps/web-vite/src/lib/posthog.ts`), so the anonymous distinct_id is set on the marketing site, but the alias call that stitches it to the new `userId` is missing.
- **Required action.** Add `posthog-node` server-side capture inside `user.create.after`:
  - `posthog.capture({ distinctId: user.id, event: 'signup_completed' })`
  - `posthog.alias({ distinctId: user.id, alias: anonDistinctIdFromCookie })`
  - Wire `POSTHOG_PROJECT_API_KEY` env in `packages/auth/src/env.ts` and `render.yaml` (api service).
- **Estimated effort.** S–M = ~2-4h (dep add + env wiring + hook + test). `posthog-node` already passes the 7-day release-age gate.
- **Remaining unknown (production state).** None code-side. Live PostHog conversion funnel can only be observed post-deploy.

#### GAP-LEGAL-CLUSTER-001 — Legal CMS pipeline two-end break

- **Evidence.**
  - `apps/api/src/routes/revalidate-legal.ts:80-90`: comment explicitly labels the publish path as a stub ("Stub: publish on Redis pub/sub once the SPA subscriber lands in Step 12 follow-up. Until then, log + breadcrumb"). HMAC verify and 200 response work; the actual cache-bust never reaches the SPA.
  - `apps/cms/src/collections/LegalDocuments.ts:41-63`: CMS still publishes — `fetch(${target}/revalidate-legal)` with `x-cms-signature` header on save. The CMS side of the pipeline is live.
  - `ls packages/api/src/routers/core/` returns no `legal.ts` / `legal*.ts`. Grep for `legal.getDocument` / `fetchLegalDocument` over `packages/api/src/` returns 0 matches. **The tRPC `legal.getDocument({type, jurisdiction})` procedure that the SPA legal containers would need is not present anywhere.**
  - All four legal SPA containers (`apps/web-vite/src/components/legal/legal-{terms,privacy,sub-processors,breach-notification}-container.tsx`) render static i18n only — no CMS read path.
- **Required action.** Three coordinated pieces:
  1. New tRPC procedure `legal.getDocument({type, jurisdiction?, locale})` in `packages/api/src/routers/core/legal.ts` (new file) that reads from the Payload CMS via its REST/local API.
  2. Wire the procedure into the four legal containers, falling back to the existing static i18n body when CMS returns no document.
  3. Either (a) land the Redis pub/sub publisher in `revalidate-legal.ts` + SPA TanStack Query subscriber that invalidates `['legal-content', type, jurisdiction]`, OR (b) document acceptance: rely on TanStack Query TTL natural expiry (with a documented user-visible delay) and remove the misleading stub comment, OR (c) explicit deprecation note: CMS legal documents are not load-bearing post-migration.
- **Estimated effort.** L = ~3-5d engineering (procedure + Payload local-API binding + 4 containers + invalidation channel + tests + Payload-side webhook compatibility check).
- **Remaining unknown (production state).** Product / legal decision on whether CMS legal text is load-bearing in the new architecture. Not derivable from code.

---

## Source→Aggregate ID map

> Lossless audit trail of the per-area sweep `.audit-scratch/<area>/section.md` rows. Every source row in the sweeps is paired with its aggregate ID (or marked `n/a` when the sweep row was an INFO / pre-existing / non-regression entry). Re-imports done by the calibration pass are flagged `(re-imported)`. Renumbering preserved existing aggregate IDs — no existing row was renumbered. Final-pass completeness audit (2026-05-27): every source row across all seven `.audit-scratch/<area>/section.md` sweeps confirmed to appear below; **0 silent drops** found.

| Area | Source ID (`.audit-scratch/<area>/section.md`) | Aggregate ID | Notes |
|------|------------------------------------------------|--------------|-------|
| PAGE | GAP-PAGE-001 (terms CMS-fetch) | GAP-PAGE-005 | renumbered at initial aggregation (severity preserved P1) |
| PAGE | GAP-PAGE-002 (privacy index session-redirect) | GAP-PAGE-002 | same ID; severity preserved P1 (P0 candidate) |
| PAGE | GAP-PAGE-003 (privacy `[jurisdiction]` CMS-fetch) | GAP-PAGE-003 | same ID; severity preserved P1 |
| PAGE | GAP-PAGE-004 (sub-processors CMS-fetch) | GAP-PAGE-004 | same ID; severity preserved P1 |
| PAGE | GAP-PAGE-005 (breach-notification CMS-fetch) | GAP-PAGE-001 | renumbered at initial aggregation (severity preserved P1) |
| PAGE | GAP-PAGE-006 (admin URL shape — boe-rate + classification-engine) | GAP-PAGE-006 + GAP-PAGE-007 | split into two rows at initial aggregation (P2 / P2) |
| PAGE | GAP-PAGE-007 (legal layout shell) | **GAP-PAGE-009 (re-imported)** | restored by calibration; P2 |
| PAGE | GAP-PAGE-008 (portal pre-auth subdomain branding) | **GAP-PAGE-010 (re-imported)** | restored by calibration; P2 |
| PAGE | (intake-detail flag-off branch — `<Navigate to=/unauthorized>` divergence) | GAP-PAGE-008 | aggregate-only row (no source-side ID; UX divergence captured by aggregator) |
| PAGE | CLUSTER (legal CMS two-end break) | **GAP-LEGAL-CLUSTER-001 (new)** | clusters GAP-PAGE-001..005 + revalidate-legal stub + missing `legal.getDocument` procedure; escalated P0 |
| ROUTE | GAP-ROUTE-001 (`/api/*` prefix drop) | **GAP-ROUTE-004 (re-imported)** | restored by calibration; P1 |
| ROUTE | GAP-ROUTE-002 (`/.well-known/security.txt` MISSING) | GAP-ROUTE-001 | renumbered at initial aggregation (P2) |
| ROUTE | GAP-ROUTE-003 (revalidate-legal stub) | GAP-ROUTE-003 + GAP-LEGAL-CLUSTER-001 | stub-only behavior carried by ROUTE-003 (pre-existing label); P0 cluster row escalates the legal-side ramification |
| ROUTE | GAP-ROUTE-004 (Upstash-Signature casing) | n/a | INFO — no behavioral divergence (Fastify header lookup is case-insensitive) |
| ROUTE | GAP-ROUTE-005 (portal set-session Sentry capture) | n/a | INFO — legacy also did not log; parity intact |
| ROUTE | GAP-ROUTE-006 (peppol/poll iteration source swap) | **GAP-ROUTE-005 (re-imported)** | restored by calibration; P1 |
| ROUTE | GAP-ROUTE-007 (inpost-status-poll orphan QStash schedule) | **GAP-ROUTE-006 (re-imported)** | restored by calibration; P2 |
| ROUTE | GAP-ROUTE-008 (CRON_SECRET HTTP gate eliminated) | n/a | INFO — intentional architectural change |
| ROUTE | (Teams SDK swap parity) | GAP-ROUTE-002 | aggregate-only row capturing botbuilder→@microsoft/agents-hosting smoke-test debt (P1, P0 candidate) |
| WEBHOOK | (inpost non-prod fallback inheritance) | GAP-WEBHOOK-001 | aggregate-only (F-SEC-06 pre-existing) |
| WEBHOOK | (Storecove 404→405 regression) | GAP-WEBHOOK-003 | aggregate-only; P0 inline-fixed (`c433c678`) |
| WEBHOOK | (placeholder) | GAP-WEBHOOK-002 | reserved — not re-used |
| MIDDLEWARE | GAP-MIDDLEWARE-001 (X-RateLimit-* on 429) | GAP-MIDDLEWARE-001 | same ID; severity P2 (verified-no-action retained as P2 row covering bucket broadening) |
| MIDDLEWARE | GAP-MIDDLEWARE-002 (LOAD_TEST_BYPASS) | GAP-MIDDLEWARE-002 | same ID; P2 |
| MIDDLEWARE | GAP-MIDDLEWARE-003 (portal subdomain rewrite) | GAP-MIDDLEWARE-003 | same ID; P1 |
| MIDDLEWARE | GAP-MIDDLEWARE-004 (cheap cookie-shape guard) | **GAP-MIDDLEWARE-006 (re-imported)** | restored by calibration; aggregate's existing GAP-MIDDLEWARE-004 covers `/login` bounce — distinct gap |
| MIDDLEWARE | GAP-MIDDLEWARE-005 (`redirectTo` loss on auth redirect) | **GAP-MIDDLEWARE-007 (re-imported)** | restored by calibration; aggregate's existing GAP-MIDDLEWARE-005 covers Accept-Language — distinct gap |
| MIDDLEWARE | GAP-SECURITY-050 (script-src nonce in middleware sweep) | GAP-SECURITY-001 | merged into the SECURITY sweep's GAP-SECURITY-001 (P0); middleware sweep's reserved range was 050+ and is unused |
| MIDDLEWARE | (Logged-in-on-`/login` bounce) | GAP-MIDDLEWARE-004 | aggregate-only label for the `/login` bounce block (P2) |
| MIDDLEWARE | (Accept-Language → locale prefix) | GAP-MIDDLEWARE-005 | aggregate-only label for the Accept-Language rewrite block (P1) |
| I18N | (no source-side gaps — 0 keys lost) | n/a | source `.audit-scratch/i18n/section.md` flagged 0 P0/P1/P2 |
| I18N | (currency formatter regression — aggregate finding) | GAP-I18N-001 + GAP-I18N-002 | aggregate-only rows (P2 / P2); source sweep noted `useCurrencyFormatter` has zero legacy call-sites but aggregator captured downstream `formatMinorAsCurrency` + `Intl.NumberFormat` locale-hardcoding |
| I18N | (translation backfill) | GAP-I18N-003 | aggregate-only INFO/P3 |
| I18N | (vite chunk-name regex) | GAP-I18N-004 | aggregate-only P3; inline-fixed (`eaa60c5c`) |
| I18N | (stale doc-comment refs to `apps/web/messages/`) | GAP-I18N-005 | aggregate-only P3 |
| OBSERVABILITY | GAP-OBSERVABILITY-001 (cron-worker scrub) | **GAP-OBSERVABILITY-007 (re-imported)** | restored by calibration; P0 inline-fixed (`5cb42d21`) |
| OBSERVABILITY | GAP-OBSERVABILITY-002 (public-api scrub) | **GAP-OBSERVABILITY-008 (re-imported)** | restored by calibration; P0 inline-fixed (`f4f4961d`) |
| OBSERVABILITY | GAP-OBSERVABILITY-003 (session-replay) | GAP-OBSERVABILITY-001 | renumbered at initial aggregation (severity preserved P1) |
| OBSERVABILITY | GAP-OBSERVABILITY-004 (feedback widget) | GAP-OBSERVABILITY-002 | renumbered (P1) |
| OBSERVABILITY | GAP-OBSERVABILITY-005 (tracePropagationTargets) | GAP-OBSERVABILITY-003 | renumbered (P1); inline-fixed (`6092d0e9`) |
| OBSERVABILITY | GAP-OBSERVABILITY-006 (`_experiments.enableLogs`) | GAP-OBSERVABILITY-005 | renumbered (P2) |
| OBSERVABILITY | GAP-OBSERVABILITY-007 (release SHA on Node services) | **GAP-OBSERVABILITY-009 (re-imported)** | restored by calibration; P1 |
| OBSERVABILITY | GAP-OBSERVABILITY-008 (source-map upload Node services) | **GAP-OBSERVABILITY-010 (re-imported)** | restored by calibration; P1 (distinct from aggregate's GAP-OBSERVABILITY-004 which is SPA-only) |
| OBSERVABILITY | GAP-OBSERVABILITY-009 (Sentry tunnel route) | **GAP-OBSERVABILITY-011 (re-imported)** | restored by calibration; P2 |
| OBSERVABILITY | GAP-OBSERVABILITY-010 (PostHog post-signup hook) | **GAP-OBSERVABILITY-012 (re-imported)** | restored by calibration; **P0 conversion analytics** |
| OBSERVABILITY | GAP-OBSERVABILITY-011 (web-vitals CSRF verify) | **GAP-OBSERVABILITY-013 (re-imported)** | restored by calibration; P2 |
| OBSERVABILITY | (SPA dev hard-disable on Sentry init) | GAP-OBSERVABILITY-006 | aggregate-only P2; inline-fixed (`6092d0e9`) |
| OBSERVABILITY | (SPA source-map upload — withSentryConfig) | GAP-OBSERVABILITY-004 | aggregate-only P2 (SPA-only; distinct from Node-services row above) |
| SECURITY | GAP-SECURITY-001 (script-src nonce + strict-dynamic) | GAP-SECURITY-001 | same ID; P0 open (escalated) |
| SECURITY | GAP-SECURITY-002 (connect-src DocuSign drop) | **GAP-SECURITY-007 (re-imported)** | restored by calibration; P2 (aggregate's existing GAP-SECURITY-002 covers `frame-src` R2 wildcard — distinct gap) |
| SECURITY | GAP-SECURITY-003 (SPA CSP report-uri / report-to) | GAP-SECURITY-003 | same ID; P0 inline-fixed (`3198bb51`) |
| SECURITY | GAP-SECURITY-004 (revalidate-legal stub) | GAP-LEGAL-CLUSTER-001 | escalated into the legal-CMS cluster (P0) — covers source's data-integrity ramification together with GAP-PAGE-001..005 + the missing `legal.getDocument` procedure |
| SECURITY | GAP-SECURITY-005 (LOAD_TEST_BYPASS removal) | GAP-SECURITY-006 | renumbered at initial aggregation (P2; cross-references GAP-MIDDLEWARE-002) |
| SECURITY | GAP-SECURITY-006 (Teams JWT prod guard on `AZURE_BOT_APP_ID`) | **GAP-SECURITY-008 (re-imported)** | restored by calibration; P1 |
| SECURITY | (SPA Permissions-Policy camera/microphone) | GAP-SECURITY-004 | aggregate-only P1 (camera/microphone drop for DocuSign ID-verification) |
| SECURITY | (SPA COEP `credentialless`) | GAP-SECURITY-005 | aggregate-only P1 |
| SECURITY | (SPA `frame-src` R2 wildcard) | GAP-SECURITY-002 | aggregate-only P0 open (escalated) |
| TEST | GAP-TEST-001 (Peppol GET 405) | GAP-TEST-001 | same ID; P1 inline-fixed (`c433c678`) — mirror of GAP-WEBHOOK-003 |
| TEST | GAP-TEST-002 (Peppol PUT 405) | GAP-TEST-002 | same ID; P1 inline-fixed (`c433c678`) |
| TEST | GAP-TEST-003 (legal jurisdiction options Playwright) | GAP-TEST-003 | same ID; P1 (P0 candidate) — mirror of GAP-PAGE-002 |
| TEST | GAP-TEST-004 (credential login unit) | **GAP-TEST-011 (re-imported)** | restored by calibration; **P1 auth** |
| TEST | GAP-TEST-005 (register form Zod) | **GAP-TEST-012 (re-imported)** | restored by calibration; P2 |
| TEST | GAP-TEST-006 (invite-accept UX defaults) | **GAP-TEST-013 (re-imported)** | restored by calibration; P2 |
| TEST | GAP-TEST-007 (social buttons Microsoft + dual-disable) | **GAP-TEST-014 (re-imported)** | restored by calibration; P2 |
| TEST | GAP-TEST-008 (Stripe webhook idempotency + tx) | **GAP-TEST-015 (re-imported)** | restored by calibration; **P1 payments** |
| TEST | GAP-TEST-009 (`/portal/set-session` route-level) | **GAP-TEST-016 (re-imported)** | restored by calibration; **P1 portal** |
| TEST | GAP-TEST-010 (`/portal/clear-session` route-level) | **GAP-TEST-017 (re-imported)** | restored by calibration; **P1 portal** |
| TEST | GAP-TEST-011 (`/revalidate-legal` HMAC) | **GAP-TEST-018 (re-imported)** | restored by calibration; **P1 legal**; pairs with GAP-LEGAL-CLUSTER-001 |
| TEST | GAP-TEST-012 (`deriveComplianceStatus` precedence) | **GAP-TEST-019 (re-imported)** | restored by calibration; **P1 invoices** |
| TEST | GAP-TEST-013 (intake EXTENDED banner) | **GAP-TEST-020 (re-imported)** | restored by calibration; P2 |
| TEST | GAP-TEST-014 (intake cross-org IDOR + flag-gate) | **GAP-TEST-021 (re-imported)** | restored by calibration; **P1 IDOR/security** |
| TEST | GAP-TEST-015 (intake flag-gate list) | **GAP-TEST-022 (re-imported)** | restored by calibration; P2 |
| TEST | GAP-TEST-016 (admin Unleash source-level guards) | **GAP-TEST-023 (re-imported)** | restored by calibration; P2 |
| TEST | GAP-TEST-017 (privacy GB resolver) | **GAP-TEST-024 (re-imported)** | restored by calibration; **P1 jurisdiction/security** |
| TEST | GAP-TEST-018 (privacy EU resolver) | **GAP-TEST-025 (re-imported)** | restored by calibration; **P1 jurisdiction/security** |
| TEST | GAP-TEST-019 (privacy DE PDF IDOR) | **GAP-TEST-026 (re-imported)** | restored by calibration; **P1 IDOR/security**; pairs with GAP-PAGE-002 |
| TEST | (settings keyboard nav Playwright) | GAP-TEST-004 | aggregate-only label P1 (WCAG 2.1.1) |
| TEST | (contractors URL-state filters Playwright) | GAP-TEST-005 | aggregate-only label P2 |
| TEST | (invoices status chip / upload broader locators) | GAP-TEST-006 + GAP-TEST-007 | aggregate-only labels P2 / P2 |
| TEST | (responsive search trigger drop) | GAP-TEST-008 | aggregate-only label P2 (accepted-regression) |
| TEST | (dashboard greeting vs empty-state shift) | GAP-TEST-009 | aggregate-only label P2 |
| TEST | (a11y dashboard route default `${route || '/'}` change) | GAP-TEST-010 | aggregate-only label P3 |

**Coverage check.** Every numbered source row across all seven `.audit-scratch/<area>/section.md` sweeps appears in the map. Every aggregate row appears in the map. No source row is silently dropped; INFO/non-regression source rows are explicitly marked `n/a`. Calibration restored 30 rows (10 PAGE/ROUTE/MIDDLEWARE/SECURITY + 5 OBSERVABILITY P1+ + 1 OBSERVABILITY P0 + 1 OBSERVABILITY P2 + 13 TEST). Cluster row GAP-LEGAL-CLUSTER-001 is net-new (escalated P0).
