# Legacy / Migration Cleanup Audit (2026-05-27)

> Scope: residual cruft from `apps/web` (Next.js) → `apps/web-vite` (Vite SPA) migration. Migration commit: `62a97d73`. Skips `.planning/milestones/`, `.audit-2026-05-{03,15,17}/`, `node_modules/`, `dist/`, `.next/`, `out/`, `playwright-report/`, `test-results/`. `goals/` directory inspected only for stale env-var usage cross-refs (its sources are tooling, not production code).

## TL;DR

- **~547 findings total** (capped here at top-impact + representative samples; bulk-class items rolled up with counts).
- **High-impact (broken / misleading in prod) — 9**
  - 4 stale `/api/*` URL paths that will 404/HTML-return in production (CMS revalidate webhook; export download email links; SPA portal session POSTs in 2 hooks).
  - 1 dead `pnpm` script (`e2e:perf` filters `@contractor-ops/web` — gone).
  - 1 broken CI workflow (`.github/workflows/ci.yml` `e2e-a11y` + `bundle-size` jobs filter `@contractor-ops/web`).
  - 1 orphan `WEB_APP_URL` env binding (`render.yaml:346`, `apps/cms/src/lib/env.ts:30`) — semantically points at a service that no longer exists; CMS webhook silently no-ops if `CMS_WEBHOOK_SECRET` unset, else mis-targets.
  - 1 orphan `TURNSTILE_SITE_KEY` env (server-only, declared in `packages/validators/src/env.ts:191` + `render.yaml:269`, never read by any source — only `VITE_TURNSTILE_SITE_KEY` is wired).
  - 1 stale infra TF spec (`infra/aws-me/ecs.tf:247,325` still launches `node apps/web/server.js` + `apps/web/worker-cron.mjs`).
- **Medium (cosmetic, removes noise) — ~125**
  - ~115 `Mirrors apps/web/...` / `Ported from apps/web/...` provenance comments on apps/api + cron-worker + web-vite files (pure provenance, no current value).
  - ~10 stale `apps/web/*` URL/file-path comments in package services + `packages/auth/src/config.ts:209-211` "current Next app" wording.
- **Low (historical context, optional) — ~410**
  - ~252 web-vite source files with port-codemod JSDoc headers (`next/link` → `react-router-dom`, etc.) — useful one-time, no current value.
  - ~96 stale `apps/web/...` doc references across `README.md`, `docs/*.md`, `apps/cms/README.md`, `packages/ui/README.md`, `SECURITY-AUDIT.md`, `contractor-ops-launch-checklist.md`.
  - Stale generated `dist/` artefacts in `packages/{api,auth,ui,integrations}/dist/**` carrying `apps/web` source comments — fixed by `pnpm clean && pnpm -F <pkg> build`.
  - Dead `vi.mock('next/navigation')` / `vi.mock('next-intl')` blocks in 6+ web-vite tests where the SUT no longer imports Next.

---

## 1. Migration provenance comments

### 1.1 Pure provenance — safe to delete (high-volume bulk class)

Rolled up by file count. All match `Mirrors apps/web/...` / `Ported from apps/web/...` / `1:1 port of legacy ...` / `Step <N> cutover` / `post-cutover` and carry zero load-bearing context (the new file path tells you what the code does; the old path is dead).

| File:Line | Pattern | Action |
| --- | --- | --- |
| `apps/cron-worker/src/jobs/handlers/boe-rate-poll.ts:4` | `* Ported from apps/web/src/app/api/cron/boe-rate-poll/route.ts.` | Delete line |
| `apps/cron-worker/src/jobs/handlers/token-refresh.ts:4` | `* Ported from apps/web/src/app/api/cron/token-refresh/route.ts.` | Delete line |
| `apps/cron-worker/src/jobs/handlers/inpost-status-poll.ts:4` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/data-purge.ts:4` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/org-definition-sync.ts:4` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/job-health.ts:4` + `:28` (`1:1 port of legacy ...`) | same shape | Delete both lines |
| `apps/cron-worker/src/jobs/handlers/exchange-rates.ts:4` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/reminders/index.ts:4` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/late-interest-pdf-reaper.ts:4` + `:39` (`1:1 port of legacy reaper branching`) | same shape | Delete both |
| `apps/cron-worker/src/jobs/handlers/trial-notifications.ts:4` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/reminders/shared.ts:5` (`Ported 1:1 from apps/web/...`) | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/reminders/drv-clearance-expiries.ts:5` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/classification-economic-dependency.ts:5` | same shape | Delete line |
| `apps/cron-worker/src/jobs/handlers/classification-reassessment-triggers.ts:5` | same shape | Delete line |
| `apps/cron-worker/src/jobs/registry.ts:11` (`apps/web/src/app/api/cron/<job>/route.ts`) | same shape | Delete line |
| `apps/api/src/routes/late-interest.ts:3` | `port. Mirrors apps/web/.../late-interest/_render-claim-pdf/route.ts.` | Delete line |
| `apps/api/src/routes/webhooks/storecove.ts:4` | `* Mirrors apps/web/.../webhooks/storecove/route.ts step-for-step:` | Delete line |
| `apps/api/src/routes/oauth.ts:4`, `:85`, `:159`, `:178` | mirrors block + 2× `1:1 port of legacy ...` + `legacy host ... post-cutover` | Delete all 4 |
| `apps/api/src/routes/ksef.ts:4` | `* Mirrors apps/web/src/app/api/ksef/_sync/route.ts:` | Delete line |
| `apps/api/src/routes/zatca.ts:4` | same shape | Delete line |
| `apps/api/src/routes/ocr.ts:4` | same shape | Delete line |
| `apps/api/src/routes/exports.ts:4` (`Ported 1:1 from apps/web/...`) + `:100` (`Mirrors apps/web/.../exports/_process/route.ts.`) | same shape | Delete both |
| `apps/api/src/routes/outbox.ts:4` | `* Mirrors apps/web/.../outbox/_drain/route.ts (P2-A · F-ASYNC-03).` | Delete line |
| `apps/api/src/routes/peppol.ts:4`, `:167`, `:272` | 3× mirrors lines | Delete all 3 |
| `apps/api/src/routes/google-workspace.ts:4` | mirrors line | Delete line |
| `apps/api/src/routes/webhooks/stripe.ts:4` | mirrors line | Delete line |
| `apps/api/src/routes/webhooks/process.ts:4` | mirrors line | Delete line |
| `apps/api/src/routes/webhooks/multi-provider.ts:4` | mirrors line | Delete line |
| `apps/api/src/routes/webhooks/inpost.ts:4` (`Ported 1:1 from apps/web/...`) | mirrors line | Delete line |
| `apps/api/src/lib/webhooks/slack-webhook-context.ts:3` | `* apps/web/.../webhooks/slack-webhook-context.ts.` | Delete line |
| `apps/api/src/__tests__/multi-provider-webhook.test.ts:5` | `* apps/web/.../webhooks/[provider]/__tests__/route.test.ts.` | Delete line |
| `apps/api/src/__tests__/storecove-webhook.test.ts:5` | same shape | Delete line |
| `apps/api/src/__tests__/process-webhook.test.ts:5` | same shape | Delete line |
| `apps/api/src/__tests__/slack-webhook-context.test.ts:5` | same shape | Delete line |
| `apps/web-vite/playwright.functional.config.ts:4` | `* Mirrors apps/web/playwright.functional.config.ts but starts:` | Delete (or rewrite as "starts the Vite preview server + the Fastify API host before functional Playwright runs.") |
| `apps/web-vite/src/components/organization/kleinunternehmer-toggle.tsx:4-7` | Codemod swap notes (next-intl → useTranslations, etc.) | Delete block |
| `apps/web-vite/src/components/notifications/notification-item.tsx:4` | `* Ported from apps/web/...notification-item.tsx —` | Delete line |
| `apps/web-vite/src/components/approvals/audit-timeline.tsx:4` + `chain-tracker.tsx:4` | `* Ported from apps/web/...` | Delete lines |
| `apps/web-vite/src/components/time/reconciliation-spot-check.tsx:3` | `* Ported from apps/web/.../reconciliation-spot-check.tsx:` | Delete line |
| `apps/web-vite/src/i18n/typed-keys.ts:39` | `* Mirrors apps/web/src/i18n/typed-keys.ts#tDyn / #tDynLoose — sub-namespace` | Delete clause; keep useful "compat hook accepts string keys; coverage delegated to audit-i18n-code-coverage.ts" sentence |
| `apps/web-vite/src/components/{settings,payments,portal,zatca,peppol,contracts,contracts/contract-detail,contracts/contract-table,contracts/contract-wizard,offboarding,ocr,workflows,billing,onboarding,consent,time}/**/__tests__/*.test.tsx` | ~70 files matching `* Ported from apps/web/.../*.test.tsx.` (line 2 or 4) | Bulk-delete the single provenance line — does not change test behavior |
| `apps/web-vite/src/components/admin/__tests__/boe-rate-table.test.tsx:4` | `* Ported from apps/web parity: the admin BoE-rate page is the only` | Keep the "parity" sentence stripped of `apps/web` (real intent: BoE table not in V2 spec) |
| `apps/web-vite/src/components/organization/__tests__/kleinunternehmer-toggle.test.tsx:4` | `* Ported from apps/web/.../__tests__/kleinunternehmer-toggle.test.tsx.` | Delete line |
| `apps/web-vite/e2e/perf/login-public.spec.ts:8` | `* Ported from apps/web/e2e/perf/login-public.spec.ts. The Vite login form` | Delete first sentence; keep "The Vite login form ..." |
| `apps/web-vite/e2e/functional/*.spec.ts` (`accessibility`, `approval-chain-flow`, `approvals`, `auth`, `billing-flow`, `classification-flow`, `contract-detail`, `contractor-detail`, `contractors`, `contracts`, `dashboard`, `equipment`, `intake-upload-flow`, `invoice-detail`, `invoice-einvoice-flow`, `invoices`, `legal-pages`, `navigation`, `notifications-page`, `payment-run-flow`, `payments`, `portal-authenticated`, `portal-documents-flow`, `portal-invoice-flow`, `portal`, `register`, `reports`, `responsive`, `settings-extra`, `settings-integrations-flow`, `settings`, `time-tracking`, `workflows`, `zugferd-download-flow`) | ~30 files referencing `apps/web/e2e/...` in header JSDoc (`Step 13 port from ...`, `batch 5 port from ...`) | Bulk-delete the `Ported from / Step N port from apps/web/...` line; keep description |
| `apps/web-vite/e2e/integration/{resend-inbound-smoke,peppol-inbound-smoke,public-smoke}.spec.ts` | 3 files with `apps/web/e2e/integration/...` JSDoc | Delete line |
| `apps/web-vite/e2e/rtl/rtl-localization.spec.ts:6` | `* apps/web/e2e/rtl/rtl-localization.spec.ts to the new Vite + Fastify stack.` | Delete line |

**Total: ~115 distinct lines across ~110 files.** All safe single-line deletions — none carry context the surrounding code or filename doesn't already convey.

### 1.2 Mixed — contains useful context (rewrite, don't delete)

| File:Line | Current snippet | Recommended rewrite |
| --- | --- | --- |
| `apps/cron-worker/src/env.ts:15-19` | `Base URL of the Fastify API host. Used by the late-interest PDF reaper to re-publish render jobs to QStash; falls back to PUBLIC_APP_URL until Step 16 cutover.` | Drop "until Step 16 cutover" — the cutover happened. Keep "falls back to PUBLIC_APP_URL" only if the fallback is still intentional (verify with `apps/cron-worker/src/jobs/handlers/late-interest-pdf-reaper.ts:71`). |
| `apps/cron-worker/src/env.ts:22-26` (`PUBLIC_APP_URL`) | `Public app URL used to build links in cron-dispatched emails and as the legacy QStash destination prior to the Fastify cutover.` | Drop "legacy ... prior to the Fastify cutover" clause. |
| `apps/cron-worker/src/jobs/handlers/late-interest-pdf-reaper.ts:68-70` | `Continue posting to the legacy host until cutover (Step 16). The QStash payload only carries the claim id; once API_URL ends up on the new Fastify host, this URL flips automatically.` | Replace with a 1-line note: "QStash callback URL — picks `API_URL` (Fastify), else falls back to `PUBLIC_APP_URL`." Drop the "until cutover" sentence and the "Step 16" tag. |
| `apps/web-vite/src/main.tsx:31` | `* same flat bundle apps/web reads via next-intl, so a label edit in` | Rewrite to reference the actual canonical bundle path in `apps/landing` (next-intl is now landing-only) or drop the analogy. |
| `packages/ui/src/components/atelier/intensity-provider.tsx:35` | `* when no provider is mounted (most pages on apps/web).` | Rewrite: "when no provider is mounted (most SPA / landing pages)." |
| `packages/ui/src/components/shadcn/breadcrumb.tsx:11` | `// root (next-intl for apps/web + apps/landing, i18next for apps/web-vite).` | Rewrite: "next-intl for apps/landing + apps/cms, i18next for apps/web-vite." |
| `packages/ui/src/i18n/translations-provider.tsx:11,18,39` | 3 lines all reference `apps/web` as next-intl consumer | Replace all `apps/web` with `apps/landing` (true next-intl consumer post-migration). |
| `packages/auth/src/auth-emails.ts:19` | `for now; the broader app i18n surface lives in apps/web/messages/*` | Drop "apps/web/messages/*"; the SPA bundle lives at `apps/web-vite/src/i18n/locales/*` (verify path). |
| `packages/auth/src/config.ts:114-115` | `// middleware (apps/web/src/middleware.ts) intentionally does NOT rate-limit` | Replace with `// /api/auth/* — rate-limited at the Fastify edge (apps/api/src/plugins/rate-limit.ts), not here, ...`. |
| `packages/auth/src/config.ts:209-211` | `Cross-subdomain mode (apps/api ↔ apps/web-vite): env sets sameSite='none' + Domain='.contractor-ops.com'. Same-origin legacy posture (current Next app): env omits both → sameSite='lax', Domain unset.` | Drop "Same-origin legacy posture (current Next app)" sentence — no current Next app. |
| `packages/feature-flags/src/evaluator.ts:32` | `apps/web/src/lib/feature-flags-init.ts. Returns true when all classification` | Rewrite: drop the canonical-caller line OR redirect to actual current caller. Search for current call site of `evaluator`. |
| `packages/feature-flags/src/registry.ts:41` | `// Wiring: apps/web/src/lib/feature-flags-init.ts is the canonical caller.` | Same: drop or replace with current init module path. |
| `packages/integrations/src/adapters/resend-adapter.ts:39,42` | references `apps/web/.../webhooks/resend-inbound/route.ts` and `apps/web/.../webhooks/_process` | Replace with `apps/api/src/routes/webhooks/process.ts` (new home). |
| `packages/integrations/src/services/boe-base-rate-poller.ts:11` | `// daily at 06:00 UTC (set by the cron route in apps/web — see /api/cron/...)` | Replace with `apps/cron-worker/src/jobs/handlers/boe-rate-poll.ts` + the actual cron schedule env var. |
| `packages/integrations/src/adapters/register-all.ts:20` | `(/api/webhooks/[provider])` | Rewrite path: `/webhooks/:provider` (Fastify). |
| `packages/integrations/src/services/webhook-schemas.ts:5` | `The generic webhook ingress route (/api/webhooks/[provider]) used to` | Same fix as above. |
| `packages/api/src/middleware/observability.ts:128` | `route handler in apps/web/.../trpc/[trpc]/route.ts wraps` | Replace with `apps/api/src/plugins/trpc.ts`. |
| `packages/api/src/middleware/classification-rate-limit.ts:12` | `apps/web/src/middleware.ts so deployment behaviour stays consistent.` | Replace with `apps/api/src/plugins/rate-limit.ts`. |
| `packages/api/src/middleware/cron-trpc.ts:11` | `(same contract as /api/cron/* routes)` | Replace with reference to actual cron-worker jobs (no `/api/cron/*` routes exist anymore). |
| `packages/api/src/services/qstash-backpressure.ts:32,37-40,176,262` | Multiple `/api/health` + `apps/web/.../route.ts` + JSDoc using `NextResponse` | Replace `/api/health` → `/health`; rewrite usage example to throw a Fastify `httpErrors.tooManyRequests`; drop `apps/web/...` paths and refer to current cron-worker handler files. |
| `packages/api/src/services/late-payment-claim-pdf.ts:4` | `QStash callback route (apps/web/.../late-interest/_render-claim-pdf)` | Replace with `apps/api/src/routes/late-interest.ts`. |
| `packages/api/src/services/posthog.ts:18` | `(apps/web/src/instrumentation.ts).` | Replace with `apps/api/src/lib/sentry.ts` (or wherever PostHog server init now lives) or drop. |
| `packages/api/src/services/resend-email-intake.ts:5-6` | references both `apps/web/.../webhooks/resend-inbound/route.ts (legacy URL)` and `apps/web/.../webhooks/_process/route.ts (unified)` | Replace with `apps/api/src/routes/webhooks/process.ts`. |
| `packages/api/src/services/exports/index.ts:8,10,121` | 3× `/api/exports/_process` JSDoc | Replace with `/exports/_process` (Fastify mount; no `/api` prefix). |
| `packages/api/src/services/cron-monitor.ts:204,243` | `NextResponse` in JSDoc + `/api/health` ref | Replace `NextResponse` → "Fastify reply"; `/api/health` → `/health`. |
| `packages/api/src/services/health-service.ts:130` | `The /api/health route (P2-E) already runs its own probes` | `/api/health` → `/health` |
| `packages/api/src/services/economic-dependency-scan.ts:7` | `Runs from /api/cron/classification-economic-` | Replace with cron-worker handler path. |
| `packages/api/src/services/org-definition-sync.ts:6` | `the nightly cron at /api/cron/org-definition-sync` | Replace with cron-worker handler path + the schedule env. |
| `packages/api/src/routers/portal/portal.ts:92,241,371` (`apps/web/.../portal/set-session/route.ts` + `/api/portal/set-session` callouts) | refer to legacy locations + `/api/portal/set-session` URL | Replace path with `apps/api/src/routes/portal-session.ts` + update URL to `/portal/set-session` (Fastify mount). |
| `packages/api/src/routers/core/dashboard.ts:378` | `refactor in apps/web/src/app/[locale]/(dashboard)/page.tsx` | Drop the file path or replace with the actual web-vite consumer (`apps/web-vite/src/pages/.../dashboard.tsx` or similar). |
| `packages/api/src/routers/compliance/gdpr.ts:74` | `client copy lives in apps/web-vite/...` | OK — this one is current (apps/web-vite). Leave. |
| `packages/api/src/routers/finance/late-payment-interest.ts:468` | `apps/web/src/app/api/late-interest/_render-claim-pdf). This keeps` | Replace with `apps/api/src/routes/late-interest.ts`. |
| `packages/api/src/routers/finance/exchange-rate.ts:17` | ``/api/cron/exchange-rates` in apps/web. The route builds a cron-scoped` | Replace with `apps/cron-worker/src/jobs/handlers/exchange-rates.ts`. |
| `packages/api/src/routers/core/legal.tsx:8` | `at /api/exports/_process renders + uploads + emails a download link.` | Drop `/api` prefix → `/exports/_process`. |
| `packages/api/src/routers/core/report.ts:50,654` | `at /api/exports/:exportId/download` + `polls /api/exports/:exportId/download` | Drop `/api` prefix. Also see Category 2 — these strings end up in client links via `downloadPath`. |
| `packages/api/src/routers/compliance/classification-document.tsx:97,102` | 2× `/api/exports/_process` and `/api/exports/:exportId/download` | Drop `/api` prefix. |
| `packages/api/src/routers/__tests__/report.test.ts:923` | `CSV is rendered by /api/exports/_process.` | Drop `/api` prefix. |
| `packages/api/src/pdf-templates/gdpr-privacy-notice.tsx:16` | `on the client) by apps/web/.../gdpr-privacy-notice-template.tsx` | Replace with web-vite consumer path. |
| `packages/validators/src/env.ts:301` | `the start-up validation in apps/web/src/instrumentation.ts` | Replace with actual server bootstrap (`apps/api/src/index.ts` initSentry block calls `getServerEnv()`). |
| `packages/validators/src/privacy-notices/gb.ts:5` | `apps/web/src/app/[locale]/(legal)/privacy/(content)/gb.mdx` | Replace with the current CMS / landing legal source. |
| `packages/validators/src/legal/signoff-registry.ts:6` | `apps/web/src/app/admin/feature-flags/...` | Replace with web-vite admin page path or drop. |
| `apps/landing/next.config.ts:6-7` | `for the SSR web app, this file's headers() block (apps/web/next.config.ts) remains authoritative.` | Drop sentence — no SSR web app. Landing's own block + `render.yaml` are authoritative. |
| `apps/api/src/plugins/auth.ts:13` | `Observability wrapper mirrors apps/web/.../auth/[...all]/route.ts:` | Delete `apps/web/...` ref. |
| `apps/api/src/lib/csp.ts`, `apps/api/src/lib/client-ip.ts`, `apps/api/src/lib/qstash-verify.ts`, `apps/api/src/lib/rate-limit-store.ts`, `apps/api/src/plugins/rate-limit.ts`, `apps/api/src/plugins/trpc.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/routes/portal-session.ts`, `apps/api/src/routes/web-vitals.ts` | Each carries 1-2 JSDoc references to `apps/web/...` source the file was ported/mirrored from (no algorithmic content — just attribution). | Delete or rewrite to point at current consumer / new code location. |
| `apps/cms/scripts/migrate-legal-from-tsx.ts:3,17`, `apps/cms/src/lib/legal-content.ts:3,6`, `apps/cms/src/collections/LegalDocuments.ts:33-34`, `apps/cms/scripts/seed-qa.ts:32` | All reference `apps/web` as the "consumer offline during seed" or "previous source of truth" | Rewrite: the consumer is now `apps/web-vite` (or `apps/landing` for blog). Suppression env stays; just refresh the comments. |
| `apps/public-api/src/lib/observability-middleware.ts:8` | `pattern used by apps/web/.../trpc/[trpc]/route.ts.` | Replace with `apps/api/src/plugins/trpc.ts`. |
| Plus ~190 more web-vite component-source JSDoc "Step 11 codemod port" headers (e.g. `apps/web-vite/src/components/admin/admin-shell.tsx:1-8`, `.../billing/billing-date-card.tsx:1-N`, `.../feature.tsx:1-N`, `.../contractors/**`, `.../invoices/**`, `.../classification/**`, `.../equipment/**`, etc. — 252 unique files total per `grep --include='*.tsx' --include='*.ts'`) | All match the pattern: "Ported from apps/web/..." + a 3-6 line bullet list of import swaps (next/link → react-router-dom, next-intl → useTranslations, @/lib/utils → ../../lib/utils.js). | Bulk delete (Category 1.1). The swap log was useful during the codemod; it's now archeology and the new imports are visible in the file. |

---

## 2. Stale URL paths (Fastify mounts at root for non-`/auth`, non-`/trpc` routes)

> Verified Fastify mounts: `/api/trpc` + `/api/trpc/portal` (intentionally kept, `apps/api/src/plugins/trpc.ts:53-54`), `/api/auth/*` (Better Auth, `apps/api/src/plugins/auth.ts:31`), `/api/oauth/:provider/{start,callback}` (intentionally kept, `apps/api/src/routes/oauth.ts:84`). Everything else lives at root: `/health`, `/ready`, `/portal/{set,clear}-session`, `/exports/_process`, `/exports/:id/download`, `/webhooks/*`, `/web-vitals`, `/csp-report`, `/teams-messages`, `/revalidate-legal`. The legacy `/api/*` paths below either embed in client URLs (broken in prod) or live in comments (misleading).

### 2.1 Embedded in client-facing strings — **PRODUCTION BREAK**

| File:Line | Current URL | Should be |
| --- | --- | --- |
| `packages/api/src/services/exports/index.ts:286` | `` downloadPath: `/api/exports/${claim.exportId}/download` `` | `` `/exports/${claim.exportId}/download` `` — this `downloadPath` is concatenated onto `PUBLIC_APP_URL` (SPA origin) by `sendExportReadyEmail` (`packages/api/src/services/email/index.ts:41`). The static SPA returns `index.html` for unknown paths, so the user's "your export is ready" email link 200s on the SPA HTML, not the Fastify download. Either (a) drop the `/api` prefix AND make the email build the URL from `API_URL` (Fastify origin), or (b) add an `/api/*` reverse-proxy in front of the SPA in `render.yaml` (currently only `/* → /index.html`). |
| `apps/cms/src/collections/LegalDocuments.ts:48` | `` `${target.replace(/\/$/, '')}/api/revalidate-legal` `` (`target` = `WEB_APP_URL`) | `` `${apiOrigin}/revalidate-legal` `` — Fastify mounts at `/revalidate-legal` (`apps/api/src/routes/revalidate-legal.ts:48`). `WEB_APP_URL` is dead (Category 4); should be `API_URL`. |
| `apps/web-vite/src/components/portal/hooks/use-portal-top-bar.ts:21` | `fetch('/api/portal/clear-session', { method: 'POST' })` | Same-origin in dev only (Vite proxy at `vite.config.mjs:247` rewrites `/api/portal/*` → `/portal/*`). In production the static SPA serves `index.html` for the path → silent 200 HTML, no logout. Use `` `${env.VITE_API_URL}/portal/clear-session` `` with `credentials: 'include'`. |
| `apps/web-vite/src/components/portal/hooks/use-portal-top-bar.ts:53` | same as above | same fix |
| `apps/web-vite/src/components/portal/hooks/use-org-switcher.ts:42` | `fetch('/api/portal/set-session', { ... })` | Same prod bug. `` `${env.VITE_API_URL}/portal/set-session` `` |
| `apps/web-vite/src/components/portal/portal-login-verify-container.tsx:33` | `fetch('/api/portal/set-session', { ... })` | Same fix. |
| `apps/web-vite/src/components/portal/__tests__/use-portal-top-bar.test.tsx:70,101` | Asserts `fetch` called with `'/api/portal/clear-session'` | Update assertion to new URL once Category 2.1 fixed (otherwise tests silently lock in the broken path). |

### 2.2 Stale URLs in comments/JSDoc (misleading, not broken)

| File:Line | Current URL | Should be |
| --- | --- | --- |
| `packages/integrations/src/services/resilience.ts:145` | ``/api/health`` | `/health` |
| `packages/integrations/src/services/health-service.ts:130` | `The /api/health route (P2-E)` | `/health` |
| `packages/api/src/services/qstash-backpressure.ts:32,262` | `/api/health backpressure probe` | `/health` |
| `packages/api/src/services/cron-monitor.ts:243` | `/api/health backpressure probe` | `/health` |
| `packages/api/src/routers/core/report.ts:50,654` | `/api/exports/:exportId/download` | `/exports/:exportId/download` |
| `packages/api/src/routers/core/legal.tsx:8` | `/api/exports/_process` | `/exports/_process` |
| `packages/api/src/routers/compliance/classification-document.tsx:97,102` | `/api/exports/_process`, `/api/exports/:exportId/download` | drop `/api` prefix |
| `packages/api/src/routers/__tests__/report.test.ts:923` | `/api/exports/_process` | drop `/api` prefix |
| `packages/api/src/services/exports/index.ts:8,10,121` | `/api/exports/_process` JSDoc | drop `/api` prefix |
| `packages/api/src/services/email/index.ts:23` | `Path to the in-app download route, e.g. /api/exports/abc/download.` | drop `/api` prefix |
| `packages/api/src/routers/portal/portal.ts:92,241,371` | 3× `/api/portal/set-session` | `/portal/set-session` |
| `packages/api/src/routers/finance/exchange-rate.ts:17` | `/api/cron/exchange-rates in apps/web` | Cron now in `apps/cron-worker/src/jobs/handlers/exchange-rates.ts`; drop `/api/cron/...` URL entirely (no HTTP route). |
| `packages/api/src/services/economic-dependency-scan.ts:7` | `Runs from /api/cron/classification-economic-` | Drop URL; reference cron-worker handler. |
| `packages/api/src/services/org-definition-sync.ts:6` | `the nightly cron at /api/cron/org-definition-sync` | Drop URL; reference cron-worker handler. |
| `packages/integrations/src/services/boe-base-rate-poller.ts:11` | `set by the cron route in apps/web — see /api/cron/...` | Drop URL; reference cron-worker handler. |
| `packages/api/src/middleware/cron-trpc.ts:11` | `(same contract as /api/cron/* routes)` | Drop — there are no `/api/cron/*` HTTP routes anymore. |
| `packages/integrations/src/adapters/register-all.ts:20` | `(/api/webhooks/[provider])` | `/webhooks/:provider` |
| `packages/integrations/src/adapters/resend-adapter.ts:40` | `(legacy URL) and unified /api/webhooks/resend.` | `/webhooks/resend` |
| `packages/integrations/src/services/webhook-schemas.ts:5` | `(/api/webhooks/[provider]) used to` | `/webhooks/:provider` |
| `packages/api/src/services/resend-email-intake.ts:6` | `(unified /api/webhooks/resend + QStash)` | `/webhooks/resend` |
| `apps/web-vite/src/web-vitals.ts:6` | `(added in Step 5's port of the legacy /api/web-vitals)` | `/web-vitals` (Fastify route) |
| `apps/web-vite/e2e/integration/resend-inbound-smoke.spec.ts:9` | `Legacy path was /api/webhooks/resend on the Next SPA origin;` | Rewrite to drop "legacy ... Next SPA origin" entirely. |
| `apps/web-vite/e2e/integration/peppol-inbound-smoke.spec.ts:10` | `path was /api/webhooks/storecove on the SPA origin — Fastify drops the` | Rewrite (only the "drops the `/api`" trivia is interesting; the legacy path isn't). |

---

## 3. Stale env var refs (renamed / dropped post-migration)

| File:Line | Stale name | New name (or dropped) |
| --- | --- | --- |
| `README.md:161` | `NEXT_PUBLIC_APP_URL=http://host.docker.internal:3000` | `PUBLIC_APP_URL=...` (renamed) |
| `README.md:181` | `docker compose logs glitchtip-seed \| grep NEXT_PUBLIC_SENTRY_DSN` | `... grep SENTRY_DSN` |
| `SECURITY-AUDIT.md:102,107` | `## 6. Client XSS, CSP, NEXT_PUBLIC_*` / `NEXT_PUBLIC_*: No secrets — public config only.` | Replace with `VITE_*` (the SPA inline-time vars) and `NEXT_PUBLIC_*` only where landing still uses them. |
| `docker-compose.yml:336` | `# NEXT_PUBLIC_APP_URL must be reachable from this container — use` | `PUBLIC_APP_URL` |
| `docker-compose.yml:389,395,471` | 3× `NEXT_PUBLIC_SENTRY_DSN` | `SENTRY_DSN` (apps/api + cron-worker) + `VITE_SENTRY_DSN` (web-vite). The seed comment block should pick one. |
| `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:41` | `NEXT_PUBLIC_TURNSTILE_SITE_KEY \| Public twin of the above; ships to the browser.` | `VITE_TURNSTILE_SITE_KEY` (the actual SPA-inlined key — see `apps/web-vite/src/env.ts:29`) |
| `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:54` | `NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN ... apps/web/src/sentry.{client,server,edge}.config.ts` | Drop `NEXT_PUBLIC_SENTRY_DSN`. Replace file ref with `apps/api/src/lib/sentry.ts` (server) + `apps/web-vite/src/main.tsx` Sentry init (browser, reads `VITE_SENTRY_DSN`). |
| `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:39,40,43,44,51,61,151,160,179,233,239,295,301` | All cite `apps/web/src/...` as runbook evidence | Rewrite all evidence pointers to current locations (`apps/api/src/...`, `apps/cron-worker/src/...`). The runbook is operational; stale pointers send ops to dead files. |
| `docs/DEPLOYMENT-RENDER.md:154,168,240` | 3× `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SENTRY_DSN` | `PUBLIC_APP_URL` / `SENTRY_DSN` |
| `docs/LOCAL-TESTING-GUIDE.md:34,36,45,189` | 4× `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `PUBLIC_APP_URL` / `VITE_TURNSTILE_SITE_KEY` |
| `docs/marketing/LAUNCH-CUTOVER.md:43` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` | **Dropped — no replacement.** Codebase has no `STRIPE_PUBLISHABLE_KEY` consumer (verified via grep). Remove line. |
| `docs/marketing/LAUNCH-CUTOVER.md:44,45` | `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Keep if marketing doc targets apps/landing (which still uses `NEXT_PUBLIC_POSTHOG_*` per `packages/validators/src/env.ts:345-346` + `apps/landing/src/lib/posthog.tsx:63-64`). Add note "(landing only; SPA uses `VITE_POSTHOG_*`)". |
| `apps/web-vite/src/components/billing/__tests__/plan-comparison-grid.test.ts:8,72,105,111-113` | Comments + assertions explicitly naming `NEXT_PUBLIC_STRIPE_PRICE_*` | These are negative-assertion tests ("does NOT leak the legacy keys onto Vite env"). The tests are valuable; the comments are correct as historical context. **No action needed** — the test is documenting that the bad keys stay out. |

> Note: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_CMS_URL` are **NOT stale** — they are actively read by `apps/landing` (Next.js app) and validated by `packages/validators/src/env.ts:345-346`. Keep.

---

## 4. Orphaned env vars

Methodology: for every key in `.env.example`, count refs in non-env, non-`.planning`, non-`.audit-*`, non-`generated/`, non-`dist/`, non-`node_modules/`, non-`.claude/` files. Then spot-check candidates for dynamic lookups (`getServerEnv()[name]`, `import.meta.env[name]`).

| Key | Last seen (file:line, if any) | Verdict |
| --- | --- | --- |
| `SLACK_REDIRECT_URI` | `packages/validators/src/env.ts:116` (schema-only) | **Verified dead.** No consumer reads it. Either implement Slack OAuth redirect override and document, or drop from schema + `.env.example`. |
| `TURNSTILE_SITE_KEY` (server-side) | `packages/validators/src/env.ts:191` (schema), `render.yaml:269` (binding), `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:40`, `docs/LOCAL-TESTING-GUIDE.md:45,189` | **Verified dead** for code. The only live consumer is `VITE_TURNSTILE_SITE_KEY` (SPA bundle). The bare `TURNSTILE_SITE_KEY` was the SSR equivalent for Next.js — gone. Drop from validators schema, `render.yaml`, `.env.example:505`, and docs. (`TURNSTILE_SECRET_KEY` stays — used by `packages/auth/src/turnstile.ts:52`.) |
| `WEB_APP_URL` | `apps/cms/src/lib/env.ts:30` (schema), `apps/cms/src/collections/LegalDocuments.ts:40` (used), `render.yaml:346`, `apps/cms/README.md:47` | **Semantically dead** (target service `apps/web` no longer exists). The CMS webhook either no-ops (no `CMS_WEBHOOK_SECRET`) or posts to a non-existent endpoint. Either rename to `API_URL` (and point at Fastify) + fix path (`/api/revalidate-legal` → `/revalidate-legal`, Category 2.1), or remove the webhook code path. |
| `QA_FORCE_FLAGS` | `.env.example:616` only | Likely dead. No consumer in src or `goals/`. Spot-check with author of qa-walk tooling before dropping. |
| `KSEF_PROD_TOKEN` | `.env.example:590` only | Likely dead. KSeF tooling uses `KSEF_TOKEN` (`scripts/ksef-te-flow.mjs`). `KSEF_PROD_TOKEN` is documented but never read. Drop. |
| `QA_WALK_WEB_URL` | `goals/qa-walk-and-fix/auth.ts:13`, `goals/qa-walk-and-fix/preflight.ts:42`, `goals/qa-walk-and-fix/README.md:7` | Only consumed by `goals/` tooling (out-of-app). The `_WEB_URL` name still points at the SPA at :3000 — semantically still valid. **Keep** but rename to `QA_WALK_SPA_URL` if pedantic. |
| `QA_WALK_LANDING_URL`, `QA_WALK_CMS_URL` | same as above | Same verdict. Keep. |
| `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_CMS_URL` | `apps/landing/src/app/[locale]/blog/rss.xml/route.ts:14`, `apps/landing/src/app/[locale]/changelog/rss.xml/route.ts:9`, `apps/landing/src/app/[locale]/blog/[slug]/page.tsx:30`, `apps/landing/src/lib/cms.ts:9` | **Not orphans** — actively read by Next.js landing app. Keep. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | `packages/validators/src/env.ts:345-346`, `apps/landing/src/lib/posthog.tsx:63-64` | **Not orphans** — landing's PostHog init. Keep. |
| `STRIPE_PRICE_STARTER/PRO/ENTERPRISE` (server-side) | `packages/api/src/services/billing-constants.ts:24-26`, `packages/validators/src/env.ts:52-54` | **Not orphans** — server-side plan lookup. Keep. |
| `STRIPE_PRICE_TOPUP_{10,25,50}` (server-side) | `packages/api/src/services/billing-constants.ts:50-52` | **Not orphans.** Keep. |
| `VITE_STRIPE_PRICE_{STARTER,PRO,ENTERPRISE,TOPUP_*}` | `apps/web-vite/src/components/billing/{plan-comparison-grid.tsx:44-78,hooks/use-billing.ts:113-115}` | **Not orphans.** Keep. |
| (Other single-occurrence keys: `KSEF_BASE_URL/DATE_FROM/DATE_TO/NIP/TOKEN`, `PG_POOL_MAX`, `PUBLIC_API_CORS_ORIGINS`, `SEED_DEV_ALLOWED_HOST`, `CLAUDE_OCR_MODEL_ID`, `DATAPORT_*`, `DOCUSIGN_OAUTH_HOST`, `HMRC_CLIENT_{ID,SECRET}_SECRET_PATH`) | All have exactly one consumer (scripts, adapters, render.yaml — the expected pattern for tunables). | **Not orphans.** Keep. |

---

## 5. Dead code / orphaned files

| Path | Why dead | Action |
| --- | --- | --- |
| `packages/api/dist/**`, `packages/auth/dist/**`, `packages/ui/dist/**`, `packages/integrations/dist/**` | Stale compiled `.js`/`.d.ts` mention `apps/web/...` in JSDoc carried over from source comments (e.g. `packages/auth/dist/auth-emails.js`, `packages/integrations/dist/adapters/resend-adapter.{js,d.ts}`, `packages/ui/dist/i18n/translations-provider.{js,d.ts}`, `packages/api/dist/routers/portal/portal.js`, `+ 8 more in packages/api/dist`). | `pnpm clean && pnpm -F <pkg> build` after Category 1.2 rewrites land. Verify `.gitignore` covers `dist/` (it does for most packages; some `.d.ts` are committed — confirm per-package `files` field in `package.json`). |
| `infra/aws-me/ecs.tf:247` — `command = ["node", "apps/web/server.js"]` | Container command launches a binary that doesn't exist in any image post-migration. | Replace with `apps/api/dist/index.js` (or whatever the new Fastify image entrypoint is) OR delete the ME-region ECS module if AWS-ME deployment is deferred. |
| `infra/aws-me/ecs.tf:325` — `command = ["node", "apps/web/worker-cron.mjs"]` | Same. | Replace with `apps/cron-worker/dist/index.js` or delete. |
| `infra/aws-me/ecr.tf:4` (`apps/web/Dockerfile` ref in comment) | Comment-only stale ref. | Rewrite comment to list current images (`apps/api/Dockerfile`, `apps/cron-worker/Dockerfile`, `apps/cms/Dockerfile`, `apps/public-api/Dockerfile`). |
| `infra/aws-me/secrets.tf:7` (`apps/web/src/env.ts` ref) | Same. | Replace with `packages/validators/src/env.ts` or `apps/api/src/env.ts`. |
| `package.json:45` — `"e2e:perf": "pnpm --filter @contractor-ops/web run e2e:perf"` | Filter targets removed package; running the script errors with "No package matches the filter". | Replace with `--filter @contractor-ops/web-vite` once the perf script is wired there; otherwise delete the script. |
| `.github/workflows/ci.yml:110,113,116,124,168,171` (6 lines) | `e2e-a11y` + `bundle-size` jobs filter `@contractor-ops/web` — the package no longer exists, so jobs fail on the filter resolve step. Already documented in `README.md:411-412` ("Currently broken"). | Re-wire to `@contractor-ops/web-vite` once `test:a11y` + `size-limit` scripts are ported. |

> No standalone `.d.ts` orphan files found pointing at deleted `apps/web` types (outside of `dist/`).

---

## 6. Doc + config legacy

| File:Line | Issue | Action |
| --- | --- | --- |
| `README.md:411-412` | Explicitly documents the broken CI jobs (Category 5). | Either re-wire the jobs or remove the broken-status note + the obsolete jobs. |
| `README.md:425` (`apps/web-vite`-only mention is fine; check surrounding paragraph for residual apps/web references). | Inspect. | Quick read-through to confirm no other apps/web ref remains. |
| `apps/cms/README.md:47,72,107,116` | 4× `apps/web` as target of revalidate webhook + legal-doc source. | Rewrite: target is now `apps/api` (via `/revalidate-legal`) once Category 4 `WEB_APP_URL` fix lands. Legal source is CMS itself. |
| `packages/ui/README.md:4,68,88,90,246-247,400` | 7 lines treating `apps/web` as canonical consumer of UI atoms / intensity bridges. | Replace with `apps/web-vite` (or `apps/landing` where Next-specific). The `apps/web/src/components/shared/atelier-bridges.tsx` callout is a dead file ref. |
| `docs/TECH-DEBT.md:12,13,30,44,45,46,96` | 7 lines referencing `apps/web/src/middleware.ts`, `apps/web/src/app/api/webhooks/_process/route.ts`, `apps/web/worker-cron.mjs`, `apps/web/src/server/db.ts` as work targets. | Rewrite to current homes (`apps/api/src/plugins/rate-limit.ts`, `apps/api/src/routes/webhooks/process.ts`, `apps/cron-worker/src/index.ts`, `packages/db/src/client.ts`). Otherwise the tech-debt backlog is unworkable. |
| `docs/PRODUCTION-CHECKLIST.md:15,16,71,72,84,95,104,105,110,111,127-138,146,172-176,178,184,186,188,190,218,239` | ~35 lines linking checklist items to specific `apps/web/...` file:line evidence. | Re-survey each item against current code. Drop items that no longer apply (Next.js bundle-analyzer, `next-intl` in dashboard, `app/global-error.tsx`); rewrite still-applicable items with current paths. |
| `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:39,40,43,44,51,54,61,151,160,179,233,239,295,301` | ~14 lines of runbook evidence pointing at deleted files. | Rewrite — ops can't trace incidents through deleted files. |
| `docs/POST-DEPLOY-MONITORING.md:45,74` | 2× `apps/web/src/app/api/health/route.ts` callouts. | Replace with `apps/api/src/routes/health.ts`. |
| `docs/CACHE-CONTROL.md:6,13` | Doc describes `withNoStore()` from `apps/web/src/lib/cache-control.ts` and route handlers under `apps/web/src/app/api/**`. | This whole doc is about Next.js `Route Handlers` — no longer applicable. Replace with Fastify cache-header policy or archive. |
| `docs/ACCESSIBILITY.md:5,29,30,78` | 4× `apps/web/...` paths (security.txt, playwright config, axe spec). | Replace with `apps/web-vite/playwright.functional.config.ts`, `apps/web-vite/e2e/functional/accessibility.spec.ts`, and the current `.well-known/security.txt` host (landing? api?). |
| `docs/INFRA-RECOMMENDATIONS.md:367,370` | `Add @vercel/otel to apps/web/instrumentation.ts ...` recommendation. | Replace with the Fastify OTel hook location (`apps/api/src/index.ts` initSentry block already does Sentry OTel; document where to add `@vercel/otel` if still desired). |
| `docs/COMMIT-ATTRIBUTION.md:22,23,25` | 3 lines citing historical commits against `apps/web/...` files. | This file is intentionally historical — leave as-is, but add a header note: "Pre-migration paths; see migration commit `62a97d73`." |
| `docs/UI-ATELIER-WORKPLAN.md:25,40,84,93,94,174,179,190` | 8 lines tracking V2 dashboard work in `apps/web/src/app/[locale]/(dashboard)/v2/*`. | This workplan is dead — V2 wasn't migrated. Archive the doc or annotate as "completed via web-vite rewrite". |
| `contractor-ops-launch-checklist.md` | (not grepped per-line — large file with `apps/web` mentions). | Quick sweep + replace with web-vite/api paths where the checklist item still applies. |
| `docker-compose.yml:336,389,395,471` | 4× `NEXT_PUBLIC_*` callouts (Category 3). | Rename + drop stale `apps/web`-only seed steps if any survive. |
| `render.yaml:257,275,340,463,643,668` | 6× `apps/web` callouts in comments — all stale (the legacy `web` service is gone). | Already partially acknowledged at `:341` ("The legacy `web` service is gone post-migration"). Sweep the rest of the file. |
| `SECURITY-AUDIT.md:102,107` | NEXT_PUBLIC_* section is Next-specific. | Either widen to "Browser-injected env vars (Vite `VITE_*` + Next `NEXT_PUBLIC_*` for landing)" or scope to landing-only. |
| `.cursor/plans/enterprise_public_rest_api_c3e7382c.plan.md` | Cursor planning doc with `apps/web/src` refs. | Cursor-local; either delete (it's `.cursor/plans/` — likely workspace-local plans) or refresh. |

---

## 7. Next-shaped test mocks

> SUTs no longer import the mocked Next.js module — the `vi.mock()` block is dead and the test still passes only because the import never happens.

| File:Line | Mock | Suggested update |
| --- | --- | --- |
| `apps/web-vite/src/components/equipment/equipment-detail/__tests__/equipment-detail-tabs.test.tsx:4-8` | `vi.mock('next/navigation', () => ({ useSearchParams, useRouter, usePathname }))` | SUT `equipment-detail-tabs.tsx` imports `useSearchParams` from `react-router-dom`. Delete the `vi.mock` block. |
| `apps/web-vite/src/components/contractors/contractor-profile/__tests__/profile-tabs.test.tsx:4` | Same pattern as above | Same fix — SUT uses `react-router-dom`. Delete mock. |
| `apps/web-vite/src/components/settings/__tests__/leitweg-id-list-card.test.tsx:11,22-24` | `vi.mock('next-intl', ...)` + comment "shadcn `dialog` imports next-intl, missing dep in apps/web-vite" | The comment is stale — `next-intl` is not a transitive dep of shadcn in this repo. Verify with `pnpm why next-intl` from `apps/web-vite`; if absent, delete the `vi.mock('next-intl')` block. Keep the local `useTranslations` mock. |
| `apps/web-vite/src/components/settings/__tests__/leitweg-id-row.test.tsx:12,25` | Same shape | Same fix — verify + delete. |
| `apps/web-vite/src/components/settings/__tests__/peppol-participant-card.test.tsx:22` | `vi.mock('next-intl', ...)` | Same fix. |
| `apps/web-vite/src/components/settings/__tests__/users-table.test.tsx:22` | Same | Same fix. |
| `apps/web-vite/src/components/reports/__tests__/drill-down-breadcrumb.test.tsx:14` | Comment block explains "Vite optimizeDeps pre-bundles the package, so a `vi.mock('next-intl', ...)`" works around something. | If `next-intl` isn't a real dep of web-vite, delete the workaround. If it IS (shadcn or other transitive), keep but rewrite comment to drop the apps/web framing. |
| `packages/api/src/services/qstash-backpressure.ts:170-180` (JSDoc) | Usage example uses `return new NextResponse(...)` | Rewrite example to a Fastify handler: `throw fastify.httpErrors.tooManyRequests('backpressure');`. |
| `packages/api/src/services/cron-monitor.ts:204` | `NextResponse — this helper does not interfere with status-code` | Replace with "Fastify reply — this helper does not interfere with ...". |

> The `next/navigation` and `next-intl` mocks ship Next-shaped fake APIs into tests whose SUTs run on `react-router-dom` + the local `useTranslations` compat hook. Removing them surfaces real bugs faster (if a SUT regresses by accidentally importing Next, the test will fail loudly instead of silently using the mock).

---

## Recommended sequencing

1. **Highest-confidence bulk deletions** — Category 1.1 single-line provenance comments (~115 lines, ~110 files). One-line deletes; zero runtime risk; large reduction in `apps/web` mentions across `apps/api`, `apps/cron-worker`, `apps/web-vite` test headers.
2. **Stale URL paths in client-facing code** — Category 2.1 (7 sites). **PRODUCTION FIXES** — broken in current main. Includes:
   - `packages/api/src/services/exports/index.ts:286` (export download email links)
   - `apps/cms/src/collections/LegalDocuments.ts:48` (CMS legal-doc webhook)
   - 5 web-vite `fetch('/api/portal/*')` callers (portal logout / session)
3. **Orphaned env vars & broken `package.json` script** — Category 4 (`TURNSTILE_SITE_KEY`, `SLACK_REDIRECT_URI`) + Category 5 (`package.json:45` `e2e:perf`, CI workflow filters). Schema cleanup; renaming `WEB_APP_URL` → `API_URL` is a coordinated apps/cms + render.yaml + Fastify-side fix.
4. **Stale infra TF specs** — Category 5 `infra/aws-me/ecs.tf:247,325` (broken container commands; may be inert if AWS-ME deploy is deferred, but check before next infra apply).
5. **Stale URL paths in comments** — Category 2.2 + Category 1.2 rewrites. Misleading docs cost reviewer time; not user-visible.
6. **Doc updates** — Category 6 (`docs/*.md`, `apps/cms/README.md`, `packages/ui/README.md`, `README.md`). Largest reduction in "where do I find X?" friction for new contributors. Do `docs/TECH-DEBT.md` + `docs/RUNBOOK-PHASE-2-3-DEPLOY.md` first — operational docs.
7. **Test mock cleanup** — Category 7. Quality only; surfaces accidental Next.js regressions faster.
8. **Rebuild `dist/`** — Category 5. After 1-2 land, `pnpm clean && pnpm build` to flush stale generated comments.

---

## Cross-cutting notes

- **All categories assume `apps/web` stays deleted.** If a re-introduction is planned (e.g. server-rendered SEO app distinct from `apps/landing`), the apps/web-port comments in `apps/web-vite/**` are still useful provenance and Categories 1.1 + 6 should be deferred.
- **Production-break severity (Category 2.1 + 4 `WEB_APP_URL`)** depends on whether any reverse proxy sits in front of the static SPA in production. The static-site config in `render.yaml:718-721` (`source: /*` → `destination: /index.html`) does NOT rewrite `/api/*`, so the SPA origin serves HTML for all `/api/portal/*` requests. Verify with: `curl -X POST https://<spa-host>/api/portal/clear-session` — expect `index.html` body + 200, not a JSON ack.
- **`apps/cron-worker/src/env.ts:18` + handlers** still preserve `API_URL` ?? `PUBLIC_APP_URL` fallback — works in practice but the "until Step 16 cutover" framing is outdated. Pick one (likely `API_URL`) and drop the fallback once env is migrated.
- **`docs/COMMIT-ATTRIBUTION.md`** is intentionally archival; do not modify line-by-line — add a header note.
- **Stale `.audit-2026-05-{15,17}/`** directories were skipped per scope; they likely also reference `apps/web` but are themselves audit snapshots.
