# Security audit report — contractor-ops

> **Status (as of 2026-05-16):** This file is preserved as a **2026-04-11 snapshot** of the launch security audit. For the canonical post-launch tracker, see [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) and the 2026-05-11 closure at [`.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md`](.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md).

**Original audit date:** 2026-04-11  
**Last progress update:** 2026-04-11 (xlsx → exceljs + CSV helpers)  
**Scope:** Canonical source under `apps/` (excluding large generated `out/`, `.next`), `packages/`, `docker/`. `.claude/worktrees` excluded from scans.

---

## Progress tracker (remediation status)

| # | Item (from audit) | Status | Notes |
|---|---------------------|--------|--------|
| 1 | Gitleaks allowlist / false positive `generic-api-key` | **Done** | Renamed counter in [`data-purge/route.ts`](apps/web/src/app/api/cron/data-purge/route.ts) (`purgeSkippedR2KeyMissing`); [`.gitleaks.toml`](.gitleaks.toml) keeps path allowlist for `^\.claude/`. |
| 2 | `pnpm audit` in CI | **Done** | Informational step in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`continue-on-error: true`); strict gate remains [`security-scan.yml`](.github/workflows/security-scan.yml) / `pnpm run security:scan`. |
| 3 | Transitive **axios** (critical advisories) | **Mitigated** | Root [`package.json`](package.json) `pnpm.overrides` pins `axios@^1.15.0`; lockfile resolves to 1.15.0. Re-run `pnpm install` after clone. |
| 4 | **xlsx** (SheetJS) prototype pollution / ReDoS | **Done** | Removed `xlsx` from [`packages/api`](packages/api/package.json). CSV via [`lib/csv.ts`](packages/api/src/lib/csv.ts); XLSX read via [`lib/excel-parse.ts`](packages/api/src/lib/excel-parse.ts); XLSX write + contractor export via **exceljs**. |
| 5 | `exchangeRate.fetchDaily` unauthenticated | **Done** (earlier) | [`cron-trpc.ts`](packages/api/src/middleware/cron-trpc.ts) + Bearer `CRON_SECRET`. |
| 6 | Document schedulers for `fetchDaily` | **Done** | [`.env.example`](.env.example) under `CRON_SECRET`; JSDoc on procedure in [`exchange-rate.ts`](packages/api/src/routers/exchange-rate.ts). |
| 7 | Tenant isolation tests | **Done** | [`vitest.config.ts`](packages/api/vitest.config.ts) alias for `@contractor-ops/einvoice`. [`tenant-isolation.test.ts`](packages/api/src/__tests__/tenant-isolation.test.ts) mocks `organization` + `getRegionalClient` / `preWarmRegionalClients` for [`tenant middleware`](packages/api/src/middleware/tenant.ts) (`prisma.organization.findUnique`, regional client). **36/36 passing.** |
| 8 | CSP `unsafe-inline` / `unsafe-eval` | **Open** | Next/Sentry trade-off; nonce hardening deferred. |
| 9 | Docker port exposure | **Done** | Comment in [`docker-compose.yml`](docker-compose.yml) (bind to `127.0.0.1` on shared hosts). |
| 10 | Process: security scripts & workflow | **Done** | [`scripts/security-scan.sh`](scripts/security-scan.sh), `pnpm run security:scan`, [`security-scan.yml`](.github/workflows/security-scan.yml). |

---

## Executive summary

| Severity | Count | Examples |
|----------|-------|----------|
| Critical | 0 in app code | Transitive deps monitored via overrides + audit |
| High | Addressed | `fetchDaily` secured; SheetJS **`xlsx`** removed from API |
| Medium | Several | CSP looseness; dependency noise in audit output |
| Low | Few | InPost dev-only unsigned webhook path |

---

## 1. Secret scanning (gitleaks)

| Target | Result |
|--------|--------|
| `packages/` (full tree) | **No leaks found** |
| `apps/web/src` + `apps/landing/src` | Former false positive removed by **renaming** the local counter variable in data-purge (no longer matches `generic-api-key` heuristics). |

**Recommendation:** Keep running `pnpm run security-scan` locally; CI uses `gitleaks-action` in [`security-scan.yml`](.github/workflows/security-scan.yml).

---

## 2. Dependency audit (`pnpm audit`)

Last documented run: **41** issues in older snapshot — severity mix includes transitive dev tooling (e.g. Prisma → hono).

- **axios:** Pinned via `pnpm.overrides` to `^1.15.0` at repo root.
- **xlsx (SheetJS):** removed from `@contractor-ops/api`; imports use **exceljs** + RFC 4180 CSV encoder.
- **next-intl**, **hono** (via Prisma): follow lockfile updates.

**CI:** Main pipeline runs `pnpm audit --audit-level moderate` as **informational** (does not fail the job). Tighten when dependency debt is reduced.

---

## 3. HTTP route handlers (apps/web)

| Route pattern | Auth / verification |
|---------------|---------------------|
| `/api/cron/*` (GET) | `CRON_SECRET` via `Authorization: Bearer` — timing-safe compare where implemented |
| `/api/cron/inpost-status-poll` (POST) | **QStash** `verifySignatureAppRouter` |
| `/api/webhooks/stripe` | **Stripe** `constructEvent` signature |
| `/api/webhooks/[provider]` | Adapter `verifyWebhookSignature` — 401 if invalid |
| `/api/webhooks/inpost` | HMAC per-org `webhookSecret`; production rejects unsigned |
| `/api/webhooks/_process` | **QStash** signature |
| `/api/peppol/inbound`, `/api/peppol/poll` | **QStash** signature |
| `/api/ocr/_process`, `/api/ksef/_sync`, `/api/google-workspace/_sync` | **QStash** signature |
| `/api/teams/messages` | **Bot Framework** / CloudAdapter |
| `/api/health` | Public (expected) |
| `/api/auth/[...all]` | Better Auth |
| `/api/portal/set-session`, `/api/portal/clear-session` | Session bootstrap; cookie **httpOnly**, **secure** in production |

**InPost (non-production):** Unsigned webhooks can fall back to payload-based shipment matching — **dev-only**; production requires signature.

---

## 4. tRPC procedures

- **Tenant data:** Dominated by `tenantProcedure` / `adminProcedure` / `portalProcedure`.
- **Public signup:** [`organization.create`](packages/api/src/routers/organization.ts) is `publicProcedure` by design; rely on rate limits.

### `exchangeRate.fetchDaily`

**Fix:** [`cronTrpcMiddleware`](packages/api/src/middleware/cron-trpc.ts) requires `Authorization: Bearer <CRON_SECRET>`.

---

## 5. Tenant isolation / IDOR

- **Search / raw SQL:** [`packages/api/src/routers/search.ts`](packages/api/src/routers/search.ts) — parameterized queries + `organizationId` from context.
- **RLS:** [`packages/db/src/rls.ts`](packages/db/src/rls.ts).
- **Tests:** [`packages/api/src/__tests__/tenant-isolation.test.ts`](packages/api/src/__tests__/tenant-isolation.test.ts) — `pnpm exec vitest run --project api src/__tests__/tenant-isolation.test.ts` (36 tests). Mocks include `organization` rows and `getRegionalClient` so [`tenant middleware`](packages/api/src/middleware/tenant.ts) matches production behavior.

---

## 6. Client XSS, CSP, `NEXT_PUBLIC_*`

- **`dangerouslySetInnerHTML`:** [`apps/web/src/app/layout.tsx`](apps/web/src/app/layout.tsx) — static bootstrap script; landing JSON-LD uses `JSON.stringify`.
- **CSP** ([`apps/web/next.config.ts`](apps/web/next.config.ts)):** `script-src` includes `'unsafe-inline'` and `'unsafe-eval'`.
- **HSTS / X-Frame-Options / nosniff:** Present globally.
- **`NEXT_PUBLIC_*`:** No secrets — public config only.

---

## 7. Docker / network exposure

[`docker-compose.yml`](docker-compose.yml): ClamAV `3310`, Infisical profile — see header comment for binding to localhost on untrusted LANs.

---

## 8. Process recommendations (updated)

1. **Scans:** `pnpm run security:scan` + manual [`security-scan.yml`](.github/workflows/security-scan.yml).
2. **`fetchDaily`:** Documented in [`.env.example`](.env.example) (same secret as HTTP cron).
3. **axios / xlsx:** axios pinned; xlsx migration TBD.
4. **Staging:** `NODE_ENV=production` for InPost signature tests when relevant.

---

## References

- Stripe webhook: [`apps/web/src/app/api/webhooks/stripe/route.ts`](apps/web/src/app/api/webhooks/stripe/route.ts)
- Generic webhooks: [`apps/web/src/app/api/webhooks/[provider]/route.ts`](apps/web/src/app/api/webhooks/[provider]/route.ts)
- Portal session hashing: [`packages/api/src/services/portal-session.ts`](packages/api/src/services/portal-session.ts)
- Rate limits / load-test bypass: [`apps/web/src/middleware.ts`](apps/web/src/middleware.ts)
