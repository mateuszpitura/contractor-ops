# Security audit report — contractor-ops

> **Refreshed snapshot — 2026-06-03.** The original 2026-04-11 launch audit targeted the now-deleted `apps/web` (Next.js) security surface. That surface was retired in the web-vite migration; the controls it described **survived** into the Fastify API (`apps/api`), the Render static-site headers (`render.yaml`), and the Vite SPA (`apps/web-vite`). This snapshot re-points every control table and file path at the **live** surfaces, verified against the tree on 2026-06-03. For the canonical post-launch tracker, see [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) and the 2026-05-11 closure at [`.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md`](.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md).

**Original audit date:** 2026-04-11
**Last refresh:** 2026-06-03 (post-`apps/web` removal — paths re-pointed to `apps/api`, `render.yaml`, `apps/web-vite`)
**Scope:** Canonical source under `apps/` (`api`, `cms`, `cron-worker`, `landing`, `public-api`, `web-vite`), `packages/`, `docker/`. `.claude/worktrees` excluded from scans.

---

## Migration note (web-vite cutover)

The `apps/web` Next.js app no longer exists in the tree. The HTTP security surface it owned now lives in three places:

| Old (`apps/web`) | Live surface | Where |
|------------------|--------------|-------|
| `next.config.ts` security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | Fastify `@fastify/helmet` (API responses) **and** Render static-site `headers:` block (SPA responses) | [`apps/api/src/plugins/helmet.ts`](apps/api/src/plugins/helmet.ts), [`render.yaml`](render.yaml) `web-vite` block |
| `next.config.ts` / `middleware.ts` Content-Security-Policy | API CSP builder + SPA wire CSP + SPA local-preview `<meta>` fallback | [`apps/api/src/lib/csp.ts`](apps/api/src/lib/csp.ts), [`render.yaml`](render.yaml) (SPA), [`apps/web-vite/index.html`](apps/web-vite/index.html) |
| Better Auth CSRF + Origin checks | Defense-in-depth Origin guard for `/api/**` | [`apps/api/src/plugins/csrf-origin.ts`](apps/api/src/plugins/csrf-origin.ts) |
| `apps/web/src/app/api/**/route.ts` (cron, webhooks, portal, csp-report) | Fastify route plugins | [`apps/api/src/routes/`](apps/api/src/routes/) |
| `apps/web/src/middleware.ts` rate limit | Fastify rate-limit plugin | [`apps/api/src/plugins/rate-limit.ts`](apps/api/src/plugins/rate-limit.ts) |

Plugin registration order is in [`apps/api/src/server.ts`](apps/api/src/server.ts) (`registerHelmet` → `registerCors` → cookie/sensible → `registerRateLimit` → `registerCsrfOriginGuard` → webhook/auth/tRPC plugins).

---

## Progress tracker (remediation status)

| # | Item (from audit) | Status | Notes |
|---|---------------------|--------|--------|
| 1 | Gitleaks allowlist / false positive `generic-api-key` | **Done** | [`.gitleaks.toml`](.gitleaks.toml) keeps the path allowlist for `^\.claude/`. The original `data-purge/route.ts` counter rename lived in `apps/web` (now removed). |
| 2 | `pnpm audit` in CI | **Done** | Informational step in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`continue-on-error: true`); strict gate remains [`security-scan.yml`](.github/workflows/security-scan.yml) / `pnpm run security:scan`. |
| 3 | Transitive **axios** (critical advisories) | **Mitigated** | Root [`package.json`](package.json) `pnpm.overrides`; verify the live pin with `pnpm why axios` after clone. |
| 4 | **xlsx** (SheetJS) prototype pollution / ReDoS | **Done** | Removed `xlsx` from [`packages/api`](packages/api/package.json). CSV via [`lib/csv.ts`](packages/api/src/lib/csv.ts); XLSX read via [`lib/excel-parse.ts`](packages/api/src/lib/excel-parse.ts); XLSX write + contractor export via **exceljs**. |
| 5 | `exchangeRate.fetchDaily` unauthenticated | **Done** | [`cron-trpc.ts`](packages/api/src/middleware/cron-trpc.ts) + Bearer `CRON_SECRET`; procedure in [`routers/finance/exchange-rate.ts`](packages/api/src/routers/finance/exchange-rate.ts). |
| 6 | Document schedulers for `fetchDaily` | **Done** | [`.env.example`](.env.example) under `CRON_SECRET`; JSDoc on the procedure. |
| 7 | Tenant isolation tests | **Done** | [`tenant-isolation.test.ts`](packages/api/src/__tests__/tenant-isolation.test.ts) mocks `organization` + regional client for [`tenant middleware`](packages/api/src/middleware/tenant.ts). Re-run to confirm the live count — `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/tenant-isolation.test.ts`. |
| 8 | CSP `unsafe-inline` / `unsafe-eval` | **Improved** | API CSP is `script-src 'none'` (JSON surface). SPA wire CSP drops `'unsafe-eval'` (keeps `'wasm-unsafe-eval'` only) and retains `style-src 'unsafe-inline'` (Tailwind runtime injection — documented residual). See [`render.yaml`](render.yaml) `web-vite` CSP + [`apps/api/src/lib/csp.ts`](apps/api/src/lib/csp.ts). |
| 9 | Docker port exposure | **Done** | Comment in [`docker-compose.yml`](docker-compose.yml) (bind to `127.0.0.1` on shared hosts). |
| 10 | Process: security scripts & workflow | **Done** | [`scripts/security-scan.sh`](scripts/security-scan.sh), `pnpm run security:scan`, [`security-scan.yml`](.github/workflows/security-scan.yml). |

---

## Executive summary

| Severity | Count | Examples |
|----------|-------|----------|
| Critical | 0 in app code | Transitive deps monitored via overrides + audit |
| High | Addressed | `fetchDaily` secured; SheetJS **`xlsx`** removed from API |
| Medium | Several | SPA `style-src 'unsafe-inline'`; dependency noise in audit output |
| Low | Few | InPost non-production unsigned-webhook fallback path |

---

## 1. Secret scanning (gitleaks)

| Target | Result |
|--------|--------|
| `packages/` (full tree) | **No leaks found** at last documented run |
| `apps/` (all live apps) | Re-run `pnpm run security:scan` post-migration to refresh the result against `apps/api` + `apps/web-vite` |

**Recommendation:** Keep running `pnpm run security:scan` locally; CI uses `gitleaks-action` in [`security-scan.yml`](.github/workflows/security-scan.yml).

---

## 2. Dependency audit (`pnpm audit`)

Severity mix in older snapshots included transitive dev tooling. Re-run `pnpm audit --audit-level moderate` for the current count.

- **axios:** Pinned via `pnpm.overrides` at repo root — confirm the live version with `pnpm why axios`.
- **xlsx (SheetJS):** removed from `@contractor-ops/api`; imports use **exceljs** + RFC 4180 CSV encoder.

**CI:** Main pipeline runs `pnpm audit --audit-level moderate` as **informational** (does not fail the job). Tighten when dependency debt is reduced.

---

## 3. HTTP route handlers (`apps/api/src/routes/`)

All cron / webhook / portal / report endpoints are Fastify route plugins under [`apps/api/src/routes/`](apps/api/src/routes/). The CSRF-origin guard exempts webhook + worker prefixes because each owns its own authenticity check (see [`apps/api/src/plugins/csrf-origin.ts`](apps/api/src/plugins/csrf-origin.ts) `EXEMPT_PREFIXES`).

| Route | Auth / verification | File |
|-------|---------------------|------|
| `/health`, `/ready` | Public probes (expected) | [`routes/health.ts`](apps/api/src/routes/health.ts) |
| `/webhooks/stripe` | **Stripe** `webhooks.constructEvent` signature (raw-body) | [`routes/webhooks/stripe.ts`](apps/api/src/routes/webhooks/stripe.ts) |
| `/webhooks/<provider>` (multi-provider) | Adapter `verifyWebhookSignature` — 401 if invalid | [`routes/webhooks/multi-provider.ts`](apps/api/src/routes/webhooks/multi-provider.ts) |
| `/webhooks/inpost` | HMAC per-org `webhookSecret`; production rejects unsigned (F-SEC-06; `STRICT_INPOST_SIGNATURE` forces signature-only everywhere) | [`routes/webhooks/inpost.ts`](apps/api/src/routes/webhooks/inpost.ts) |
| `/webhooks/storecove`, `/webhooks/_process` | Provider / QStash signature | [`routes/webhooks/storecove.ts`](apps/api/src/routes/webhooks/storecove.ts), [`routes/webhooks/process.ts`](apps/api/src/routes/webhooks/process.ts) |
| `/peppol/*`, `/ksef/*`, `/ocr/*`, `/zatca/*`, `/google-workspace/*` | **QStash** `Receiver` signature | [`routes/peppol.ts`](apps/api/src/routes/peppol.ts), [`routes/ksef.ts`](apps/api/src/routes/ksef.ts), [`routes/ocr.ts`](apps/api/src/routes/ocr.ts), [`routes/zatca.ts`](apps/api/src/routes/zatca.ts), [`routes/google-workspace.ts`](apps/api/src/routes/google-workspace.ts) |
| `/teams/*` | **Bot Framework** `CloudAdapter` — validates inbound JWT | [`routes/teams.ts`](apps/api/src/routes/teams.ts) |
| `/csp-report`, `/web-vitals` | Browser-emitted; CSRF-origin exempt | [`routes/csp-report.ts`](apps/api/src/routes/csp-report.ts), [`routes/web-vitals.ts`](apps/api/src/routes/web-vitals.ts) |
| `/portal/set-session`, `/portal/clear-session` | F-SEC-09 HMAC signature; cookie **httpOnly** + **secure** | [`routes/portal-session.ts`](apps/api/src/routes/portal-session.ts) |

**InPost (non-production):** Unsigned webhooks can fall back to payload-based shipment matching — **dev-only**; production rejects unsigned (`STRICT_INPOST_SIGNATURE` enforces signature-only in every environment).

---

## 4. tRPC procedures

- **Tenant data:** Dominated by `tenantProcedure` / `adminProcedure` / `portalProcedure`.
- **Public signup:** [`organization.create`](packages/api/src/routers/core/organization.ts) is `publicProcedure` by design; rely on rate limits.

### `exchangeRate.fetchDaily`

**Fix:** [`cronTrpcMiddleware`](packages/api/src/middleware/cron-trpc.ts) requires `Authorization: Bearer <CRON_SECRET>`; procedure lives in [`routers/finance/exchange-rate.ts`](packages/api/src/routers/finance/exchange-rate.ts).

---

## 5. Tenant isolation / IDOR

- **Search / raw SQL:** [`packages/api/src/routers/core/search.ts`](packages/api/src/routers/core/search.ts) — parameterized queries + `organizationId` from context.
- **RLS:** [`packages/db/src/rls.ts`](packages/db/src/rls.ts); session wired via [`tenant middleware`](packages/api/src/middleware/tenant.ts).
- **Tests:** [`packages/api/src/__tests__/tenant-isolation.test.ts`](packages/api/src/__tests__/tenant-isolation.test.ts) — `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/tenant-isolation.test.ts`. Mocks include `organization` rows and the regional client so the tenant middleware matches production behavior.

---

## 6. Client XSS, CSP, browser security headers

**API surface** ([`apps/api/src/plugins/helmet.ts`](apps/api/src/plugins/helmet.ts) + [`apps/api/src/lib/csp.ts`](apps/api/src/lib/csp.ts)):

- **CSP:** `default-src 'none'`, `script-src 'none'` (the API returns JSON; HTML error pages never execute scripts), `frame-ancestors 'none'`, `report-uri /csp-report`. `CSP_MODE` env toggles report-only vs enforce.
- **HSTS:** `max-age=63072000; includeSubDomains; preload`.
- **X-Frame-Options:** `DENY`. **Referrer-Policy:** `strict-origin-when-cross-origin`. **Permissions-Policy:** camera/mic/geolocation/payment denied, `fullscreen=(self)`. **COOP:** `same-origin`. **CORP:** `same-site`. **Cross-Domain-Policies:** `none`.

**SPA surface** — wire headers ([`render.yaml`](render.yaml) `web-vite` block) with a byte-identical local-preview `<meta>` fallback ([`apps/web-vite/index.html`](apps/web-vite/index.html)):

- **CSP:** `script-src 'self' 'wasm-unsafe-eval' https://*.sentry-cdn.com https://challenges.cloudflare.com` (no `'unsafe-eval'`, no `'unsafe-inline'` on scripts); `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` (Tailwind runtime injection — documented residual); `frame-src` allows DocuSign / Autenti / R2 / Cloudflare Turnstile; `connect-src 'self' https://*.contractor-ops.com` (+ Sentry/PostHog/R2); `frame-ancestors 'none'`; `object-src 'none'`; `report-uri https://api.contractor-ops.com/csp-report`.
- **Report-To:** `csp-endpoint` group → `https://api.contractor-ops.com/csp-report` (HTTP-header-only; the `<meta>` fallback omits it per spec).
- **X-Frame-Options** `DENY`, **X-Content-Type-Options** `nosniff`, **Referrer-Policy** `strict-origin-when-cross-origin`, **HSTS** `max-age=63072000; includeSubDomains; preload`, **COEP** `credentialless` (lenient mode so DocuSign/Autenti/R2/Turnstile embeds load), **Permissions-Policy** (geolocation/payment/sensors denied; camera+microphone deliberately on browser default for embedded signing iframes).

The theme bootstrap script is served from `/public/theme-init.js` (satisfies `script-src 'self'`, no inline script on the SPA shell — see [`apps/web-vite/index.html`](apps/web-vite/index.html)).

**Landing (`apps/landing`):** Static export with its own header block in [`render.yaml`](render.yaml) (landing static-site) and [`apps/landing/next.config.ts`](apps/landing/next.config.ts); CSP there uses `script-src 'self' 'unsafe-inline'` (static-export trade-off — documented).

---

## 7. Docker / network exposure

[`docker-compose.yml`](docker-compose.yml): ClamAV `3310`, Infisical profile — see header comment for binding to localhost on untrusted LANs.

---

## 8. Process recommendations (refreshed 2026-06-03)

1. **Scans:** `pnpm run security:scan` + CI [`security-scan.yml`](.github/workflows/security-scan.yml).
2. **`fetchDaily`:** Documented in [`.env.example`](.env.example) (same secret as the HTTP cron callbacks).
3. **CSP enforce:** Confirm `CSP_MODE` on the live API (report-only → enforce) and that the SPA wire CSP stays byte-identical to the `<meta>` fallback — equality is asserted in [`apps/api/src/__tests__/utility-routes.test.ts`](apps/api/src/__tests__/utility-routes.test.ts).
4. **Staging:** `STRICT_INPOST_SIGNATURE` / `NODE_ENV=production` for InPost signature tests when relevant.

---

## References

- Plugin registration order: [`apps/api/src/server.ts`](apps/api/src/server.ts)
- Stripe webhook: [`apps/api/src/routes/webhooks/stripe.ts`](apps/api/src/routes/webhooks/stripe.ts)
- Multi-provider webhooks: [`apps/api/src/routes/webhooks/multi-provider.ts`](apps/api/src/routes/webhooks/multi-provider.ts)
- Portal session hashing: [`packages/api/src/services/portal-session.ts`](packages/api/src/services/portal-session.ts)
- Rate limiting: [`apps/api/src/plugins/rate-limit.ts`](apps/api/src/plugins/rate-limit.ts)
- CSRF-origin guard: [`apps/api/src/plugins/csrf-origin.ts`](apps/api/src/plugins/csrf-origin.ts)
- CORS: [`apps/api/src/plugins/cors.ts`](apps/api/src/plugins/cors.ts)
- security.txt (vulnerability disclosure): [`apps/landing/public/.well-known/security.txt`](apps/landing/public/.well-known/security.txt)
