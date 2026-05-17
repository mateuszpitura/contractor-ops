# Production Readiness Checklist

**Last reviewed:** 2026-05-16
**Reconciled-against:** `.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md` (2026-05-11 closure)
**Production-Hardening-completed:** 2026-05-16 (commits e0be0966..dc6776c3 on `feat/production-hardening`)
**Stack:** pnpm + Turborepo · Next.js 15 (SSR) · tRPC v11 · Prisma 7 + Neon (EU + ME) · Better Auth · Render · Pino · Sentry · Upstash Redis · Unleash OSS

> **Production-Hardening Goal status (2026-05-16):** Phases A, B, C, D shipped on
> branch `feat/production-hardening` across 31 atomic commits. Two steps deferred:
>
> - **B.5 — advisory-lock dual-hold shim cleanup.** Gated on maintainer confirming
>   `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` is unset in every Render service for
>   ≥1 deploy cycle. Deferred to follow-up PR `feat/production-hardening-b5`.
> - **C.1.c — flip CSP to enforce (drop unsafe-inline).** Gated on 48h of
>   `Content-Security-Policy-Report-Only` observation with zero unexpected
>   reports. Report-only header lives now (`apps/web/next.config.ts`); enforce
>   flip deferred to follow-up PR `feat/production-hardening-c1c`.

This checklist is the operational counterpart to [`/contractor-ops-launch-checklist.md`](../contractor-ops-launch-checklist.md). The launch checklist is authoritative on multi-tenancy, auth, GDPR, and payments. **This file** owns infrastructure, observability, security headers, CI/CD gates, DR, and documentation. Both must pass before paid launch.

For depth on specific areas, see [`.audit-2026-05-03/`](../.audit-2026-05-03/) — nine audits covering db, security, integrations, async, observability, scalability, market scan, and next-phase plan.

---

## Legend

| Status | Meaning |
|---|---|
| `[x]` | Done — already in place. |
| `[ ]` | Outstanding — needs work. |
| 🟡 | Partial — exists but incomplete or has caveats. |

| Priority | When to ship |
|---|---|
| 🔴 **BLOCKER** | Cannot launch without this. |
| 🟠 **CRITICAL** | Within 2 weeks of launch. |
| 🟢 **IMPORTANT** | Within 30 days post-launch. |
| ⚪ **NICE-TO-HAVE** | Backlog; build when asked. |

---

## Summary

| Area | Done | Pending | Blockers |
|---|---:|---:|---:|
| 1. CI/CD & Deployment | 5 | 3 | 0 |
| 2. Testing | 7 | 4 | 1 |
| 3. Environment & Secrets | 5 | 3 | 0 |
| 4. Observability | 8 | 6 | 1 |
| 5. Security | 26 | 3 | 1 |
| 6. Database & Migrations | 5 | 6 | 2 |
| 7. Performance | 11 | 1 | 0 |
| 8. Accessibility & UX | 7 | 3 | 0 |
| 9. Documentation | 6 | 4 | 1 |
| 10. Feature Flags | 4 | 3 | 0 |
| 11. i18n | 4 | 3 | 0 |
| 12. Compliance & Legal | 9 | 4 | 1 |
| 13. Backup & Disaster Recovery | 2 | 5 | 2 |
| 14. Code Quality Gates | 11 | 4 | 0 |
| **Total** | **110** | **52** | **9** |

**Realistic effort to clear all blockers + criticals:** 3–4 weeks of focused work alongside the items still open in the launch checklist.

---

## 1. CI/CD & Deployment

- [x] Lint / typecheck / test / audit gates — `.github/workflows/ci.yml`
- [x] Custom CI linters (Prisma tenant-scope, logger redaction, i18n parity, no raw `process.env`) — `scripts/lint-*.mjs`
- [x] Render Blueprint covers web, landing, public-api, worker, ClamAV, Unleash EU + ME, cloudflared, 2 cron jobs — `render.yaml`
- [x] Multi-target Docker image (`runner-web`, `runner-worker`, `.next/standalone`) — `apps/web/Dockerfile`
- [x] Post-deploy health verification (curl `/api/health`, fail the deploy on non-200) — `apps/web/src/app/api/health/route.ts:48` ships `ProbeResult[]` over five probes (db/redis/qstash/r2/backpressure); per closure §5 step 4 — 🟠 CRITICAL  → evidence: `apps/web/src/app/api/health/route.ts:48` — closure-confirmed `ProbeResult[]` shape with 5 probes
- [ ] Documented rollback procedure (Render redeploy from previous commit + DB rollback decision tree) — 🟠 CRITICAL  → evidence: `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:219` documents schema rollback only; no consolidated decision tree for Render redeploy + DB rollback exists
- [ ] Branch protection rules captured in repo (`docs/BRANCH-PROTECTION.md` mirroring GitHub settings) — 🟢 IMPORTANT  → evidence: `docs/BRANCH-PROTECTION.md` does not exist
- [ ] Canary / blue-green strategy doc (or explicit decision: full-cut deploys are fine) — ⚪ NICE-TO-HAVE  → evidence: covered as recommendation in `docs/INFRA-RECOMMENDATIONS.md` (Phase D, commit dc6776c3); per-strategy adoption deferred to follow-up

## 2. Testing

- [x] Vitest with coverage support (`@vitest/coverage-v8`) — `vitest.config.ts`
- [x] Four Playwright configs: functional, integration, perf, RTL — `e2e/playwright.*.config.ts`
- [x] 57 multi-tenancy + security automated tests — `e2e/tenant-isolation.test.ts`, `background-job-isolation.test.ts`, `session-security.test.ts`
- [x] k6 load profiles (smoke, API read/write, stress) — `package.json` `load:*` scripts
- [x] Manual k6 stress runbook documented — verified pre-launch in launch checklist
- [x] axe-core / `@axe-core/playwright` CI gate on top-10 dashboard routes — 🟢 IMPORTANT  → evidence: commit c3053fd4 + `apps/web/e2e/a11y/dashboard-routes.spec.ts` + `.axe-allowlist.json`; CI job wired in commit 1b8efef1 (`.github/workflows/ci.yml` `e2e-a11y` job)
- [x] axe-core a11y violations gate PR merges (WCAG 2.2 AA target) — 🟢 IMPORTANT  → evidence: commit 1b8efef1 — `.github/workflows/ci.yml` `e2e-a11y` job + `docs/ACCESSIBILITY.md` attestation
- [ ] Playwright e2e gated in CI (currently only unit tests gate) — 🔴 BLOCKER  → evidence: `.github/workflows/ci.yml` runs unit + lint + gitleaks + the new `e2e-a11y` slice; full e2e suite still not gated
- [ ] Coverage % thresholds enforced in CI (e.g., 70% statements on `packages/api`, `packages/auth`) — 🟠 CRITICAL  → evidence: `vitest.config.ts` enables coverage but no CI threshold gate enforced in `.github/workflows/ci.yml`
- [ ] Scheduled k6 smoke against staging (nightly) — 🟢 IMPORTANT  → evidence: `package.json` exposes `load:*` scripts but no scheduled GitHub Action invokes them
- [ ] 🟡 API router test coverage uneven — search and gov-api routers have gaps; per-file analysis in `.planning/handoffs/test-cleanup-2026-04-27.md` — 🟠 CRITICAL  → evidence: `.planning/handoffs/test-cleanup-2026-04-27.md` still tracks 16 files / ~51 failures; closure §2.3 marks this as pre-existing test debt

## 3. Environment & Secrets

- [x] Comprehensive `.env.example` (~100 vars) — root
- [x] `.env*` properly gitignored, only `.env.example` tracked — `.gitignore:20-22`
- [x] Runtime env validation at boot via `getServerEnv()` — `apps/web/src/instrumentation.ts:6-7` + `@contractor-ops/validators`
- [x] Secrets injected via Render dashboard (`sync: false` for all secrets) — `render.yaml`
- [x] gitleaks secret scan in CI — `.github/workflows/security-scan.yml`
- [ ] Secret rotation SOP (which keys, cadence, owner, last-rotated date) — `docs/SECRET-ROTATION.md` — 🟠 CRITICAL  → evidence: `docs/SECRET-ROTATION.md` does not exist
- [ ] Build-time hardcoded-secret guard (extend gitleaks config to flag `sk_live_*`, raw JWTs in source) — 🟢 IMPORTANT  → evidence: `.gitleaks.toml` keeps the path allowlist for `^\.claude/` but does not add `sk_live_*` / JWT patterns
- [ ] CI env validation re-enabled where safe (`SKIP_ENV_VALIDATION` should not be a permanent default) — 🟢 IMPORTANT  → evidence: `SKIP_ENV_VALIDATION=1` still defaulted in `.github/workflows/ci.yml` build steps; no per-job override

## 4. Observability

- [x] Sentry (`@sentry/nextjs` v10.50.0) with source maps + tunnel route — `apps/web/next.config.ts:137-156`
- [x] Sentry instrumentation hook (`register()` + `onRequestError`) — `apps/web/src/instrumentation.ts`
- [x] Pino structured logging via `@contractor-ops/logger` — never `console.*` in source
- [x] Axiom log shipping configured — `render.yaml` `AXIOM_TOKEN`, `AXIOM_DATASET`
- [x] Cronitor uptime + cron monitoring — `render.yaml`
- [x] Immutable audit log (actor / action / resource / before-after / IP / UA) with CSV export
- [x] `requestId` propagated end-to-end (browser → middleware → tRPC → workers) via AsyncLocalStorage — 🟠 CRITICAL  → evidence: commit e7c86329 — `apps/web/src/middleware.ts` mints/propagates `x-request-id`; `apps/web/src/app/api/trpc/[trpc]/route.ts` binds it through `withRequestContext`
- [x] Webhook handlers surface errors instead of silent catch (signed by lint guard) — 🟠 CRITICAL  → evidence: commits c3f48219 + 0eba770a — `apps/web/src/app/api/webhooks/_process/route.ts`, `apps/web/src/app/api/webhooks/[provider]/route.ts` log + propagate; `scripts/lint-silent-catch.mjs` forbids unannotated empty catches in adapter/service/route paths
- [ ] Alerting thresholds + on-call escalation runbook (Cronitor → who pages?) — 🔴 BLOCKER  → evidence: `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:4` names "Platform / on-call" as owner but no thresholds or escalation matrix; canonical `docs/RUNBOOK.md` does not exist
- [ ] OpenTelemetry traces across web → tRPC → workers → DB — currently no distributed tracing — 🟠 CRITICAL  → evidence: `packages/logger/src/request-context.ts:13` explicitly notes "We do NOT add `@opentelemetry/sdk-node`"; recommendation captured in `docs/INFRA-RECOMMENDATIONS.md` (commit dc6776c3); adoption deferred
- [ ] SLO / SLI document (latency targets, error budget, availability target per service) — 🟠 CRITICAL  → evidence: no `docs/SLO.md`; recommendation captured in `docs/INFRA-RECOMMENDATIONS.md` (commit dc6776c3); adoption deferred
- [ ] Dashboards committed as code (Axiom queries / Grafana JSON) — 🟢 IMPORTANT  → evidence: `infra/` has no `dashboards/` subtree; Axiom dashboards exist only in vendor UI
- [ ] Audit log archival beyond the 10k-row CSV cap (cold storage in R2) — 🟢 IMPORTANT  → evidence: `packages/api/src/routers/core/audit.ts:219` exposes CSV export only; no R2 archival job
- [ ] Synthetic checks beyond `/api/health` (login flow, tRPC ping, signed-URL fetch) — 🟢 IMPORTANT  → evidence: Cronitor pings `/api/health` only per `render.yaml`; no synthetic login / signed-URL checks defined

## 5. Security

- [x] Better Auth v1.5.0 with database sessions, 24 h expiry, hourly refresh
- [x] Banned-user check in `authMiddleware` — returns `ACCOUNT_BANNED`
- [x] Account lockout (5 failed attempts → 15 min, atomic increment)
- [x] Rate limiting via Upstash Redis (10/min auth, 60/min API)
- [x] Better Auth `trustedOrigins` configured via `AUTH_TRUSTED_ORIGINS` + baseURL seed — `packages/auth/src/config.ts`
- [x] CSRF posture: SameSite=Lax + Origin validation (Better Auth defaults)
- [x] Content-Security-Policy header — `apps/web/next.config.ts:97-110`
- [x] X-Frame-Options DENY — `apps/web/next.config.ts:111-114`
- [x] X-Content-Type-Options nosniff — `apps/web/next.config.ts:115-118`
- [x] Referrer-Policy strict-origin-when-cross-origin — `apps/web/next.config.ts:119-122`
- [x] Permissions-Policy (camera/mic/geo denied + extended surface) — `apps/web/next.config.ts:123-126` and commit 52628844 (mirrored to `apps/landing/next.config.ts`)
- [x] HSTS `max-age=63072000; includeSubDomains; preload` — `apps/web/next.config.ts:127-130`
- [x] AES-256-GCM bank account encryption — `bank-account-crypto.ts`
- [x] XSS sanitization on create/update mutations
- [x] Report-only nonce-based CSP shipped alongside enforce header (Phase C.1.a/b complete; enforce flip deferred per goal callout) — 🟠 CRITICAL  → evidence: commit 11a56375 — `apps/web/next.config.ts` + `apps/landing/next.config.ts` emit `Content-Security-Policy-Report-Only` with per-request nonce; `apps/web/src/app/api/csp-report/route.ts` ingests reports
- [x] Inline theme bootstrap replaced by Server Component cookie read (eliminates inline `<script>` blocker for CSP enforce) — 🟠 CRITICAL  → evidence: commit 62ca7261 — `apps/web/src/app/layout.tsx`, `apps/landing/src/app/layout.tsx`
- [x] COOP / COEP / CORP headers + extended Permissions-Policy — 🟠 CRITICAL  → evidence: commit 52628844 — `apps/web/next.config.ts` + `apps/landing/next.config.ts`
- [x] `/.well-known/security.txt` for vulnerability disclosure — 🟢 IMPORTANT  → evidence: commit eb854533 — `apps/web/src/app/.well-known/security.txt/route.ts`
- [x] Dependabot weekly + daily security channel — 🟠 CRITICAL  → evidence: commit e11cac5f — `.github/dependabot.yml`
- [x] Outbound HTTP wrapped in `withResilience` (timeout + retry + circuit-breaker) on 11 integration adapters — 🟠 CRITICAL  → evidence: commit 6928d109 — `packages/integrations/src/adapters/*` (Jira, Slack, Teams, Asana, ClickUp, Linear, Notion, Trello, Zendesk, Freshdesk, Intercom)
- [x] Courier clients use `fetchWithTimeout` (InPost / DPD / UPS) — 🟠 CRITICAL  → evidence: commit ebb42b3a — `packages/api/src/services/courier/inpost-client.ts`, `dpd-client.ts`, `ups-client.ts`
- [x] Service-layer outbound calls use `fetchWithTimeout` (13 service files) — 🟠 CRITICAL  → evidence: commit 346c3581 — 13 files under `packages/api/src/services/*`
- [x] Lint guard: raw `fetch` forbidden in adapter/service paths without annotation — 🟢 IMPORTANT  → evidence: commit e8e05475 — `scripts/lint-raw-fetch.mjs`
- [x] Idempotency keys unified through `deriveIdempotencyKey` (Stripe / InPost / Resend) — 🟠 CRITICAL  → evidence: commit 867c50c3 — `billing-service.ts`, `inpost-client.ts`, `app-email.ts` (+ slack/teams docs)
- [x] Lint guard: hand-rolled idempotency keys forbidden outside `deriveIdempotencyKey` — 🟢 IMPORTANT  → evidence: commit d4dbaaa2 — `scripts/lint-idempotency.mjs`
- [ ] Flip CSP to enforce (drop `'unsafe-inline'`) — gated on 48h report-only observation, deferred to follow-up PR `feat/production-hardening-c1c` — 🟠 CRITICAL  → evidence: report-only emitter shipped (commit 11a56375, `apps/web/next.config.ts`); enforce flip recorded as gated deferral in top-of-file callout
- [ ] Production `trustedOrigins` audit — confirm no `localhost` in deployed env — 🔴 BLOCKER (verify before launch; trivial)  → evidence: `packages/auth/src/config.ts:107` reads `AUTH_TRUSTED_ORIGINS` at boot but a production env attestation has not been captured in any doc; runtime verification only
- [x] RLS audit on Neon (Prisma extension covers most paths; raw SQL paths in search router need explicit enumeration) — 🟠 CRITICAL  → evidence: `packages/api/src/middleware/tenant.ts` wires `withRlsSession` per closure §2.1; `scripts/check-raw-sql-tenant-scoped.ts` enumerates raw SQL exits via `pnpm run lint:raw-sql` (closure §4)
- [ ] Public-API key revocation drill (HMAC keys via `API_KEY_HMAC_SECRET`) — 🟢 IMPORTANT  → evidence: revocation code paths exist in `packages/api/src/routers/` but no drill log captured in `docs/`

## 6. Database & Migrations

- [x] Prisma 7 modular schema (`esign`, `approval`, `api-key`, `financial`, `peppol`, base) — `packages/db/prisma/schema/`
- [x] Multi-region Neon (`DATABASE_URL_EU`, `DATABASE_URL_ME`) — `render.yaml`
- [x] CI gate: committed Prisma client matches schema (`db:check-drift`) — `turbo.json`
- [x] Tenant-scope schema lint (FOUND6-01) blocks new models without `organizationId`
- [ ] Pooled vs direct URL split documented (`DATABASE_URL` via PgBouncer/pooler + `DIRECT_URL` for migrations) — 🔴 BLOCKER (per Neon + Prisma official guidance)  → evidence: `.env.example:14-19` ships `DATABASE_URL` + regional `DATABASE_URL_EU/ME` but no `DIRECT_URL` variant for migrations; Neon pooler URL not documented
- [ ] `connection_limit` tuned per service (workers, web, public-api) — start with `connection_limit=1` for serverless and benchmark up — 🟠 CRITICAL  → evidence: no `connection_limit` query string in any `.env.example` URL; `render.yaml` does not pin per-service pool sizes; recommendation captured in `docs/INFRA-RECOMMENDATIONS.md` (commit dc6776c3)
- [ ] Tested restore drill — Neon PITR works in theory; never exercised end-to-end with sign-off — 🔴 BLOCKER  → evidence: no drill record in `docs/`; Neon PITR is provider-managed but no end-to-end test captured
- [ ] Documented backup retention + RPO / RTO targets — `docs/BACKUP-POLICY.md` — 🟠 CRITICAL  → evidence: `docs/BACKUP-POLICY.md` does not exist; recommendation captured in `docs/INFRA-RECOMMENDATIONS.md` (commit dc6776c3)
- [ ] Migration rollback / down-migration policy (when reversible, when forward-only) — 🟠 CRITICAL  → evidence: `docs/RUNBOOK-PHASE-2-3-DEPLOY.md:219` mentions schema rollback but no project-wide policy doc
- [ ] Seed script for ephemeral preview environments — 🟢 IMPORTANT  → evidence: existing seed scripts target dev; no preview-env-specific seed (separate `goals/comprehensive-dev-seed/` tracks the dev seed; preview tier not addressed)
- [x] 🟡 RLS or app-level tenant scoping coverage report — Prisma extension covers ORM paths; explicit enumeration of raw SQL exits is missing — 🟠 CRITICAL  → evidence: `packages/db/src/replica.ts:95` ships the `RLS_POLICIES_ENFORCED` tripwire and `scripts/check-raw-sql-tenant-scoped.ts` enumerates raw SQL exits per closure §4 (5 legitimate cross-tenant sites annotated `// safe-raw-sql:`)

## 7. Performance

- [x] Upstash Redis caching (auth, rate limits, hot reads) — `UPSTASH_REDIS_REST_URL`
- [x] Next.js standalone output for thin Docker image — `next.config.ts:26`
- [x] Turbo build cache (local + remote on CI)
- [x] Server Components by default; explicit `'use client'` boundaries
- [x] k6 load profiles (smoke, API read/write, stress) for capacity planning
- [x] `@next/bundle-analyzer` integrated with per-route size budget — 🟢 IMPORTANT  → evidence: commit 0f3386cb — `apps/web/next.config.ts` wraps config in `withBundleAnalyzer`; `apps/web/.size-limit.json` budgets + `docs/PERF-BUDGETS.md`
- [x] `useReportWebVitals` → analytics for LCP / INP / CLS field data — 🟢 IMPORTANT  → evidence: commit b6a801b1 — `apps/web/src/components/perf/web-vitals-reporter.tsx` + ingestion at `apps/web/src/app/api/web-vitals/route.ts`
- [x] Explicit `Cache-Control` headers on public/CDN-cacheable GET routes — 🟠 CRITICAL  → evidence: commit 99188f70 — per-route `Cache-Control` declared across the relevant `apps/web/src/app/api/**/route.ts` files + `docs/CACHE-CONTROL.md` policy
- [x] Hot-path organization lookups routed through 5min cache — 🟠 CRITICAL  → evidence: commit c6b59148 — `apps/web/src/app/[locale]/(dashboard)/layout.tsx` and classification layouts route through the org cache helper
- [x] Image `remotePatterns` narrowed to known external hosts only — 🟢 IMPORTANT  → evidence: commit afddd8c2 — `apps/web/next.config.ts` `images.remotePatterns` allowlist
- [x] N+1 query review for hot paths (Prisma query logging + top-10 tRPC procedures) — 🟠 CRITICAL  → evidence: commit cbbe7ff1 — `docs/N+1-AUDIT.md`
- [ ] `next/font` audit (no rogue `<link href="fonts.googleapis...">` outside CSP) — 🟢 IMPORTANT  → evidence: CSP `style-src` at `apps/web/next.config.ts:91` still includes `https://fonts.googleapis.com` — audit of `next/font` adoption not captured in any doc

## 8. Accessibility & UX

- [x] Playwright RTL config — `playwright.rtl.config.ts`, `e2e/rtl/`
- [x] MDX `rehype-autolink-headings` with `behavior: 'wrap'` — `next.config.ts:14-19`
- [x] `next-intl` for EN / PL / DE / AR — `apps/web/src/i18n/`
- [x] CSP `frame-src` allows DocuSign embeds (signing flow accessibility)
- [x] axe-core / `@axe-core/playwright` CI gate on top-10 dashboard routes — 🟢 IMPORTANT  → evidence: commit c3053fd4 — `apps/web/e2e/a11y/dashboard-routes.spec.ts` + `.axe-allowlist.json`; CI job in commit 1b8efef1
- [x] WCAG 2.2 AA self-attestation — 🟢 IMPORTANT  → evidence: commit 1b8efef1 — `docs/ACCESSIBILITY.md`
- [x] `loading.tsx` / `not-found.tsx` / `error.tsx` boundary coverage on top-10 dashboard routes — 🟠 CRITICAL  → evidence: commit 664d1dc7 — shared boundary primitives under `apps/web/src/components/boundaries/*` wired into the top-10 dashboard route files
- [ ] Lighthouse CI on staging — 🟢 IMPORTANT  → evidence: no `lighthouse` job in `.github/workflows/`; deferred (Core Web Vitals field data already shipping via commit b6a801b1)
- [ ] `app/global-error.tsx` audit and documented error boundary pattern — 🟠 CRITICAL  → evidence: per-route boundaries shipped (commit 664d1dc7) but `apps/web/src/app/global-error.tsx` audit doc (stack-trace leak / Sentry report / reload affordance) not yet produced
- [ ] Keyboard-only smoke test on critical user journeys (login, create invoice, sign document) — 🟢 IMPORTANT  → evidence: no documented kbd-smoke test in `e2e/` or `docs/`

## 9. Documentation

- [x] [`docs/DEPLOYMENT-RENDER.md`](DEPLOYMENT-RENDER.md) — Render setup
- [x] [`docs/TECH-DEBT.md`](TECH-DEBT.md) — tracked debt
- [x] [`/contractor-ops-launch-checklist.md`](../contractor-ops-launch-checklist.md) — multi-tenancy / auth / GDPR / payments launch gate
- [x] [`.audit-2026-05-03/`](../.audit-2026-05-03/) — nine deep audits
- [x] [`.planning/`](../.planning/) — REQUIREMENTS, ROADMAP, STATE
- [ ] Root `README.md` — 5-minute developer onboarding (clone → install → seed → `dev`) — 🟠 CRITICAL  → evidence: no root `README.md` present
- [ ] `docs/RUNBOOK.md` — incident response, common ops (rotate secret, drain worker, replay outbox), on-call rotation — 🔴 BLOCKER  → evidence: only `docs/RUNBOOK-PHASE-2-3-DEPLOY.md` exists (deploy-specific); canonical runbook not promoted
- [ ] `docs/ARCHITECTURE.md` — system diagram, request lifecycle, data flow EU↔ME — 🟠 CRITICAL  → evidence: `docs/ARCHITECTURE.md` does not exist
- [ ] `docs/adr/` — ADRs for Prisma 7 generator, Unleash dual-instance, multi-region Neon, Better Auth choice — 🟢 IMPORTANT  → evidence: no `docs/adr/` directory
- [x] Public-API OpenAPI spec export (`apps/public-api/openapi.json` published with the service) — 🟠 CRITICAL  → evidence: `apps/public-api/src/openapi.ts` defines the spec; `apps/public-api/src/app.ts:84` serves it at `/openapi.json` and renders Scalar reference at `/api/v1/openapi.json`

## 10. Feature Flags

- [x] Unleash OSS dual instance (EU + ME) on Render — `render.yaml`
- [x] `@contractor-ops/feature-flags` evaluator with jurisdiction short-circuit — `packages/feature-flags/src/evaluator.ts`
- [x] Tests for evaluator behaviour — `packages/feature-flags/src/__tests__/`
- [x] Mirror requirement documented (each flag must exist in both regions)
- [ ] Flag registry (`docs/FEATURE-FLAGS.md`: name, default, owner, target removal date) — 🟠 CRITICAL  → evidence: `docs/FEATURE-FLAGS.md` does not exist; typed registry lives in code (`packages/feature-flags/`) but not in a maintainer-facing doc
- [ ] Flag lifecycle SOP (rollout → 100% → cleanup PR) — 🟢 IMPORTANT  → evidence: no SOP doc
- [ ] Stale-flag scanner (CI fails on flags >90 days at 100%) — ⚪ NICE-TO-HAVE  → evidence: no scanner script in `scripts/lint-*`

## 11. i18n

- [x] EN / PL / DE / AR catalogs — `apps/web/messages/`, `apps/landing/src/i18n/locales/`
- [x] CI parity gate — `scripts/i18n-parity.mjs`
- [x] `next-intl/plugin` integration — `next.config.ts:8`
- [x] DE register sweep (informal "Du" → formal "Sie") — commit `a7e4050f`
- [ ] Translation workflow doc (vendor, review SLA, glossary, brand terms) — 🟢 IMPORTANT  → evidence: no `docs/I18N.md` or vendor SLA doc
- [ ] Per-locale completion % report (one-shot script + readme update) — 🟢 IMPORTANT  → evidence: `scripts/i18n-parity.mjs` enforces parity but no completion-% reporter; `.i18n-parity-baseline.json` is a freeze-snapshot, not a coverage report
- [ ] Documented register policy per locale (DE = Sie; FR = vous; etc.) — ⚪ NICE-TO-HAVE  → evidence: DE Sie sweep landed (commit `a7e4050f`) but policy doc absent

## 12. Compliance & Legal

- [x] Privacy policy + ToS (full EN/PL i18n) — `/privacy`, `/terms`
- [x] Cookie consent banner
- [x] Data retention policy (subscription + 30 days) documented in privacy policy
- [x] AES-256-GCM encryption for bank accounts
- [x] Tax ID masking for non-finance roles
- [x] Immutable audit log
- [x] GDPR Art. 17 erasure endpoint — `packages/api/src/routers/compliance/gdpr.ts`
- [x] GDPR Art. 20 data portability endpoint — same router
- [x] Daily data-purge cron — `render.yaml` (03:00 UTC)
- [ ] DSAR end-to-end SOP (request intake → fulfilment → audit trail) — 🔴 BLOCKER  → evidence: `packages/api/src/routers/compliance/gdpr.ts` exposes the endpoints but no operator-facing SOP doc
- [ ] DPA template ready for B2B customers — 🟠 CRITICAL  → evidence: no `docs/legal/DPA.md` or PDF template in `docs/`
- [ ] Subprocessor list page (Neon, Render, Sentry, Axiom, Cronitor, Upstash, Cloudflare, etc.) — 🟠 CRITICAL  → evidence: no subprocessors page in `apps/web/src/app/[locale]/(marketing)/` or `apps/landing/`
- [ ] ME-jurisdiction legal copy (PDPL, e-invoice attestation) — 🟢 IMPORTANT (deferred per project memo)  → evidence: explicit project-memo deferral — local-only legal sign-off; not blocking per MEMORY note

## 13. Backup & Disaster Recovery

- [x] Neon automated backups (provider-managed)
- [x] Cloudflare R2 object storage (provider-managed durability)
- [ ] RPO / RTO targets defined and signed off — 🔴 BLOCKER  → evidence: no targets in `docs/`; recommendation captured in `docs/INFRA-RECOMMENDATIONS.md` (commit dc6776c3); `docs/BACKUP-POLICY.md` still missing
- [ ] Tested restore drill — date, restorer, outcome captured in writing — 🔴 BLOCKER  → evidence: no drill log in `docs/` or `.planning/`
- [ ] DR runbook (Neon region failover, R2 bucket failover, DNS cutover) — 🟠 CRITICAL  → evidence: no `docs/DR-RUNBOOK.md`; recommendation captured in `docs/INFRA-RECOMMENDATIONS.md` (commit dc6776c3)
- [ ] Quarterly backup-test schedule on the calendar — 🟠 CRITICAL  → evidence: no calendar artifact; Cronitor schedule list does not include a `backup-test` job
- [ ] Point-in-time recovery procedure with example timestamps — 🟠 CRITICAL  → evidence: no documented PITR walkthrough; Neon provider-managed but not exercised

## 14. Code Quality Gates

- [x] Biome lint + format with CI config — `biome.json`, `biome.ci.json`
- [x] TypeScript strict mode — `tsconfig.base.json`
- [x] Husky pre-commit + pre-push hooks — `.husky/`
- [x] lint-staged (Biome + Prisma format) — `package.json`
- [x] Custom guards: no raw `process.env`, tenant-scope schema lint, logger redaction, i18n parity
- [x] CODEOWNERS for legal sign-off registry — `.github/CODEOWNERS`
- [x] CI typecheck pinned to `tsc` (never `tsgo`) per project policy
- [x] Lint guard: direct `auditLog.create` forbidden outside `writeAuditLog` helper — 🟢 IMPORTANT  → evidence: commit 3f741fbe — `scripts/lint-audit-log.mjs`; helper applied in commits 377980eb (`packages/api/src/routers/equipment/*`) and 36832508 (`packages/api/src/routers/compliance/gdpr.ts`, `finance/invoice.ts`)
- [x] Lint guard: raw `fetch` forbidden in adapter/service paths without annotation — 🟢 IMPORTANT  → evidence: commit e8e05475 — `scripts/lint-raw-fetch.mjs`
- [x] Lint guard: hand-rolled idempotency keys forbidden outside `deriveIdempotencyKey` — 🟢 IMPORTANT  → evidence: commit d4dbaaa2 — `scripts/lint-idempotency.mjs`
- [x] Lint guard: silent catch blocks forbidden in adapter/service/route paths — 🟢 IMPORTANT  → evidence: commit 0eba770a — `scripts/lint-silent-catch.mjs`
- [ ] Expand CODEOWNERS to `packages/db/`, `packages/auth/`, `infra/`, `render.yaml` — 🟠 CRITICAL  → evidence: `.github/CODEOWNERS` exists but does not cover `packages/db/`, `packages/auth/`, `infra/`, or `render.yaml`
- [ ] PR template (`.github/pull_request_template.md`) with risk / rollback / test checklist — 🟢 IMPORTANT  → evidence: no `.github/pull_request_template.md`
- [ ] Explicit commitlint config (currently only an enforced pre-push hook) — 🟢 IMPORTANT  → evidence: no `commitlint.config.{js,cjs,ts}` at repo root; enforcement remains in `.husky/`
- [ ] Documented branch protection (required checks list, no force-push to main) — 🟢 IMPORTANT  → evidence: no `docs/BRANCH-PROTECTION.md` (also called out in §1)

---

## Working through this list

1. **Knock out blockers in parallel.** They cluster in three areas: e2e in CI (testing), DB pooling + restore drill (db), runbook + alerting + restore drill (ops). Different owners can move at the same time.
2. **Re-verify status icons before each launch milestone.** The audit that seeded this file (2026-05-03) had several stale negatives that surfaced during verification. Re-read source files when an item changes status; do not trust this checklist for code claims older than two weeks.
3. **Cross-link new docs back here.** When `RUNBOOK.md` or `ARCHITECTURE.md` lands, add the link in the Documentation section row so this file remains the single index.
4. **Don't merge launch checklist and this file.** They overlap intentionally on a few items (rate limiting, GDPR) — duplicate confirmation across two reviewers is a feature, not redundancy.

---

## Sources consulted (May 2026)

- [Next.js 15 production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [Better Auth security guide](https://better-auth.com/docs/reference/security)
- [Neon + Prisma connection guide](https://neon.com/docs/guides/prisma)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Vercel production checklist](https://vercel.com/docs/production-checklist)
- [SaaS pre-launch security checklist](https://peiko.space/blog/article/saas-security-checklist-before-launch)
- [SaaS Security Checklist 2026 — SOC 2, GDPR, Zero Trust](https://www.xoance.com/saas-security-checklist-2026/)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
