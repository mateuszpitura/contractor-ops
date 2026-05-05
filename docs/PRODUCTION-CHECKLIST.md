# Production Readiness Checklist

**Last reviewed:** 2026-05-05
**Stack:** pnpm + Turborepo · Next.js 15 (SSR) · tRPC v11 · Prisma 7 + Neon (EU + ME) · Better Auth · Render · Pino · Sentry · Upstash Redis · Unleash OSS

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
| 1. CI/CD & Deployment | 4 | 4 | 0 |
| 2. Testing | 5 | 5 | 1 |
| 3. Environment & Secrets | 5 | 3 | 0 |
| 4. Observability | 6 | 6 | 1 |
| 5. Security | 14 | 6 | 1 |
| 6. Database & Migrations | 4 | 7 | 2 |
| 7. Performance | 5 | 6 | 0 |
| 8. Accessibility & UX | 4 | 6 | 0 |
| 9. Documentation | 5 | 5 | 1 |
| 10. Feature Flags | 4 | 3 | 0 |
| 11. i18n | 4 | 3 | 0 |
| 12. Compliance & Legal | 9 | 4 | 1 |
| 13. Backup & Disaster Recovery | 2 | 5 | 2 |
| 14. Code Quality Gates | 7 | 4 | 0 |
| **Total** | **78** | **67** | **9** |

**Realistic effort to clear all blockers + criticals:** 3–4 weeks of focused work alongside the items still open in the launch checklist.

---

## 1. CI/CD & Deployment

- [x] Lint / typecheck / test / audit gates — `.github/workflows/ci.yml`
- [x] Custom CI linters (Prisma tenant-scope, logger redaction, i18n parity, no raw `process.env`) — `scripts/lint-*.mjs`
- [x] Render Blueprint covers web, landing, public-api, worker, ClamAV, Unleash EU + ME, cloudflared, 2 cron jobs — `render.yaml`
- [x] Multi-target Docker image (`runner-web`, `runner-worker`, `.next/standalone`) — `apps/web/Dockerfile`
- [ ] Post-deploy health verification (curl `/api/health`, fail the deploy on non-200) — 🟠 CRITICAL
- [ ] Documented rollback procedure (Render redeploy from previous commit + DB rollback decision tree) — 🟠 CRITICAL
- [ ] Branch protection rules captured in repo (`docs/BRANCH-PROTECTION.md` mirroring GitHub settings) — 🟢 IMPORTANT
- [ ] Canary / blue-green strategy doc (or explicit decision: full-cut deploys are fine) — ⚪ NICE-TO-HAVE

## 2. Testing

- [x] Vitest with coverage support (`@vitest/coverage-v8`) — `vitest.config.ts`
- [x] Four Playwright configs: functional, integration, perf, RTL — `e2e/playwright.*.config.ts`
- [x] 57 multi-tenancy + security automated tests — `e2e/tenant-isolation.test.ts`, `background-job-isolation.test.ts`, `session-security.test.ts`
- [x] k6 load profiles (smoke, API read/write, stress) — `package.json` `load:*` scripts
- [x] Manual k6 stress runbook documented — verified pre-launch in launch checklist
- [ ] Playwright e2e gated in CI (currently only unit tests gate) — 🔴 BLOCKER
- [ ] Coverage % thresholds enforced in CI (e.g., 70% statements on `packages/api`, `packages/auth`) — 🟠 CRITICAL
- [ ] Lighthouse / Core Web Vitals CI gate — 🟢 IMPORTANT
- [ ] Scheduled k6 smoke against staging (nightly) — 🟢 IMPORTANT
- [ ] 🟡 API router test coverage uneven — search and gov-api routers have gaps; per-file analysis in `.planning/handoffs/test-cleanup-2026-04-27.md` — 🟠 CRITICAL

## 3. Environment & Secrets

- [x] Comprehensive `.env.example` (~100 vars) — root
- [x] `.env*` properly gitignored, only `.env.example` tracked — `.gitignore:20-22`
- [x] Runtime env validation at boot via `getServerEnv()` — `apps/web/src/instrumentation.ts:6-7` + `@contractor-ops/validators`
- [x] Secrets injected via Render dashboard (`sync: false` for all secrets) — `render.yaml`
- [x] gitleaks secret scan in CI — `.github/workflows/security-scan.yml`
- [ ] Secret rotation SOP (which keys, cadence, owner, last-rotated date) — `docs/SECRET-ROTATION.md` — 🟠 CRITICAL
- [ ] Build-time hardcoded-secret guard (extend gitleaks config to flag `sk_live_*`, raw JWTs in source) — 🟢 IMPORTANT
- [ ] CI env validation re-enabled where safe (`SKIP_ENV_VALIDATION` should not be a permanent default) — 🟢 IMPORTANT

## 4. Observability

- [x] Sentry (`@sentry/nextjs` v10.50.0) with source maps + tunnel route — `apps/web/next.config.ts:137-156`
- [x] Sentry instrumentation hook (`register()` + `onRequestError`) — `apps/web/src/instrumentation.ts`
- [x] Pino structured logging via `@contractor-ops/logger` — never `console.*` in source
- [x] Axiom log shipping configured — `render.yaml` `AXIOM_TOKEN`, `AXIOM_DATASET`
- [x] Cronitor uptime + cron monitoring — `render.yaml`
- [x] Immutable audit log (actor / action / resource / before-after / IP / UA) with CSV export
- [ ] Alerting thresholds + on-call escalation runbook (Cronitor → who pages?) — 🔴 BLOCKER
- [ ] OpenTelemetry traces across web → tRPC → workers → DB — currently no distributed tracing — 🟠 CRITICAL
- [ ] SLO / SLI document (latency targets, error budget, availability target per service) — 🟠 CRITICAL
- [ ] Dashboards committed as code (Axiom queries / Grafana JSON) — 🟢 IMPORTANT
- [ ] Audit log archival beyond the 10k-row CSV cap (cold storage in R2) — 🟢 IMPORTANT
- [ ] Synthetic checks beyond `/api/health` (login flow, tRPC ping, signed-URL fetch) — 🟢 IMPORTANT

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
- [x] Permissions-Policy (camera/mic/geo denied) — `apps/web/next.config.ts:123-126`
- [x] HSTS `max-age=63072000; includeSubDomains; preload` — `apps/web/next.config.ts:127-130`
- [x] AES-256-GCM bank account encryption — `bank-account-crypto.ts`
- [x] XSS sanitization on create/update mutations
- [ ] CSP hardening — replace `'unsafe-inline'` in script-src/style-src with nonces — 🟠 CRITICAL
- [ ] Production `trustedOrigins` audit — confirm no `localhost` in deployed env — 🔴 BLOCKER (verify before launch; trivial)
- [ ] Dependabot or Renovate config (`.github/dependabot.yml` / `renovate.json`) — 🟠 CRITICAL
- [ ] RLS audit on Neon (Prisma extension covers most paths; raw SQL paths in search router need explicit enumeration) — 🟠 CRITICAL
- [ ] Public-API key revocation drill (HMAC keys via `API_KEY_HMAC_SECRET`) — 🟢 IMPORTANT
- [ ] [`/.well-known/security.txt`](https://securitytxt.org/) for vulnerability disclosure — 🟢 IMPORTANT

## 6. Database & Migrations

- [x] Prisma 7 modular schema (`esign`, `approval`, `api-key`, `financial`, `peppol`, base) — `packages/db/prisma/schema/`
- [x] Multi-region Neon (`DATABASE_URL_EU`, `DATABASE_URL_ME`) — `render.yaml`
- [x] CI gate: committed Prisma client matches schema (`db:check-drift`) — `turbo.json`
- [x] Tenant-scope schema lint (FOUND6-01) blocks new models without `organizationId`
- [ ] Pooled vs direct URL split documented (`DATABASE_URL` via PgBouncer/pooler + `DIRECT_URL` for migrations) — 🔴 BLOCKER (per Neon + Prisma official guidance)
- [ ] `connection_limit` tuned per service (workers, web, public-api) — start with `connection_limit=1` for serverless and benchmark up — 🟠 CRITICAL
- [ ] Tested restore drill — Neon PITR works in theory; never exercised end-to-end with sign-off — 🔴 BLOCKER
- [ ] Documented backup retention + RPO / RTO targets — `docs/BACKUP-POLICY.md` — 🟠 CRITICAL
- [ ] Migration rollback / down-migration policy (when reversible, when forward-only) — 🟠 CRITICAL
- [ ] Seed script for ephemeral preview environments — 🟢 IMPORTANT
- [ ] 🟡 RLS or app-level tenant scoping coverage report — Prisma extension covers ORM paths; explicit enumeration of raw SQL exits is missing — 🟠 CRITICAL

## 7. Performance

- [x] Upstash Redis caching (auth, rate limits, hot reads) — `UPSTASH_REDIS_REST_URL`
- [x] Next.js standalone output for thin Docker image — `next.config.ts:26`
- [x] Turbo build cache (local + remote on CI)
- [x] Server Components by default; explicit `'use client'` boundaries
- [x] k6 load profiles (smoke, API read/write, stress) for capacity planning
- [ ] `@next/bundle-analyzer` integrated, with size budget (e.g., main bundle < 250 KB gz) — 🟢 IMPORTANT
- [ ] `useReportWebVitals` → analytics for LCP / INP / CLS field data — 🟢 IMPORTANT
- [ ] Explicit cache-control headers on routes that should be CDN-cached — 🟠 CRITICAL
- [ ] Image `remotePatterns` reviewed for required external hosts only — 🟢 IMPORTANT
- [ ] N+1 query review for hot paths (Prisma query logging in dev + spot-checks) — 🟠 CRITICAL
- [ ] `next/font` audit (no rogue `<link href="fonts.googleapis...">` outside CSP) — 🟢 IMPORTANT

## 8. Accessibility & UX

- [x] Playwright RTL config — `playwright.rtl.config.ts`, `e2e/rtl/`
- [x] MDX `rehype-autolink-headings` with `behavior: 'wrap'` — `next.config.ts:14-19`
- [x] `next-intl` for EN / PL / DE / AR — `apps/web/src/i18n/`
- [x] CSP `frame-src` allows DocuSign embeds (signing flow accessibility)
- [ ] axe-core / `@axe-core/playwright` CI gate on key flows — 🟢 IMPORTANT
- [ ] Lighthouse CI on staging — 🟢 IMPORTANT
- [ ] `app/global-error.tsx` audit and documented error boundary pattern — 🟠 CRITICAL
- [ ] `loading.tsx` / `not-found.tsx` / `error.tsx` audit on top 10 routes — 🟠 CRITICAL
- [ ] WCAG 2.2 AA self-attestation (or VPAT for enterprise customers) — 🟢 IMPORTANT
- [ ] Keyboard-only smoke test on critical user journeys (login, create invoice, sign document) — 🟢 IMPORTANT

## 9. Documentation

- [x] [`docs/DEPLOYMENT-RENDER.md`](DEPLOYMENT-RENDER.md) — Render setup
- [x] [`docs/TECH-DEBT.md`](TECH-DEBT.md) — tracked debt
- [x] [`/contractor-ops-launch-checklist.md`](../contractor-ops-launch-checklist.md) — multi-tenancy / auth / GDPR / payments launch gate
- [x] [`.audit-2026-05-03/`](../.audit-2026-05-03/) — nine deep audits
- [x] [`.planning/`](../.planning/) — REQUIREMENTS, ROADMAP, STATE
- [ ] Root `README.md` — 5-minute developer onboarding (clone → install → seed → `dev`) — 🟠 CRITICAL
- [ ] `docs/RUNBOOK.md` — incident response, common ops (rotate secret, drain worker, replay outbox), on-call rotation — 🔴 BLOCKER
- [ ] `docs/ARCHITECTURE.md` — system diagram, request lifecycle, data flow EU↔ME — 🟠 CRITICAL
- [ ] `docs/adr/` — ADRs for Prisma 7 generator, Unleash dual-instance, multi-region Neon, Better Auth choice — 🟢 IMPORTANT
- [ ] Public-API OpenAPI spec export (`apps/public-api/openapi.json` published with the service) — 🟠 CRITICAL

## 10. Feature Flags

- [x] Unleash OSS dual instance (EU + ME) on Render — `render.yaml`
- [x] `@contractor-ops/feature-flags` evaluator with jurisdiction short-circuit — `packages/feature-flags/src/evaluator.ts`
- [x] Tests for evaluator behaviour — `packages/feature-flags/src/__tests__/`
- [x] Mirror requirement documented (each flag must exist in both regions)
- [ ] Flag registry (`docs/FEATURE-FLAGS.md`: name, default, owner, target removal date) — 🟠 CRITICAL
- [ ] Flag lifecycle SOP (rollout → 100% → cleanup PR) — 🟢 IMPORTANT
- [ ] Stale-flag scanner (CI fails on flags >90 days at 100%) — ⚪ NICE-TO-HAVE

## 11. i18n

- [x] EN / PL / DE / AR catalogs — `apps/web/messages/`, `apps/landing/src/i18n/locales/`
- [x] CI parity gate — `scripts/i18n-parity.mjs`
- [x] `next-intl/plugin` integration — `next.config.ts:8`
- [x] DE register sweep (informal "Du" → formal "Sie") — commit `a7e4050f`
- [ ] Translation workflow doc (vendor, review SLA, glossary, brand terms) — 🟢 IMPORTANT
- [ ] Per-locale completion % report (one-shot script + readme update) — 🟢 IMPORTANT
- [ ] Documented register policy per locale (DE = Sie; FR = vous; etc.) — ⚪ NICE-TO-HAVE

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
- [ ] DSAR end-to-end SOP (request intake → fulfilment → audit trail) — 🔴 BLOCKER
- [ ] DPA template ready for B2B customers — 🟠 CRITICAL
- [ ] Subprocessor list page (Neon, Render, Sentry, Axiom, Cronitor, Upstash, Cloudflare, etc.) — 🟠 CRITICAL
- [ ] ME-jurisdiction legal copy (PDPL, e-invoice attestation) — 🟢 IMPORTANT (deferred per project memo)

## 13. Backup & Disaster Recovery

- [x] Neon automated backups (provider-managed)
- [x] Cloudflare R2 object storage (provider-managed durability)
- [ ] RPO / RTO targets defined and signed off — 🔴 BLOCKER
- [ ] Tested restore drill — date, restorer, outcome captured in writing — 🔴 BLOCKER
- [ ] DR runbook (Neon region failover, R2 bucket failover, DNS cutover) — 🟠 CRITICAL
- [ ] Quarterly backup-test schedule on the calendar — 🟠 CRITICAL
- [ ] Point-in-time recovery procedure with example timestamps — 🟠 CRITICAL

## 14. Code Quality Gates

- [x] Biome lint + format with CI config — `biome.json`, `biome.ci.json`
- [x] TypeScript strict mode — `tsconfig.base.json`
- [x] Husky pre-commit + pre-push hooks — `.husky/`
- [x] lint-staged (Biome + Prisma format) — `package.json`
- [x] Custom guards: no raw `process.env`, tenant-scope schema lint, logger redaction, i18n parity
- [x] CODEOWNERS for legal sign-off registry — `.github/CODEOWNERS`
- [x] CI typecheck pinned to `tsc` (never `tsgo`) per project policy
- [ ] Expand CODEOWNERS to `packages/db/`, `packages/auth/`, `infra/`, `render.yaml` — 🟠 CRITICAL
- [ ] PR template (`.github/pull_request_template.md`) with risk / rollback / test checklist — 🟢 IMPORTANT
- [ ] Explicit commitlint config (currently only an enforced pre-push hook) — 🟢 IMPORTANT
- [ ] Documented branch protection (required checks list, no force-push to main) — 🟢 IMPORTANT

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
