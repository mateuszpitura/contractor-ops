---
phase: 84
slug: theme-a-us-contractor-profile-fields-en-us-locale
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 84 — Validation Strategy

> Per-phase validation contract. Derived from `84-RESEARCH.md` § Validation Architecture.
> Role matrix corrected per **D-09**: `CONTRACTOR_PII:READ` = owner + admin + finance_admin ONLY.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.5 (validators / api / gov-api / auth / logger / lint-guards / web-vite) |
| **Config file** | per-package (`"test": "vitest run"`) |
| **Quick run command** | `pnpm --filter <pkg> test <path>` — scoped |
| **Full suite command** | scoped per package. **NEVER** the unscoped web-vite suite (RAM constraint) |
| **web-vite rule** | path-scoped only: `pnpm --filter @contractor-ops/web-vite test src/components/contractors/` |
| **Estimated runtime** | ~30s scoped per package |

---

## Sampling Rate

- **After every task commit:** the single scoped file command for the task's package
- **After every plan wave:** scoped per-package suites for each touched package; web-vite path-scoped only
- **Before `/gsd:verify-work`:** scoped suites green + `pnpm i18n:parity` + `pnpm check:web-vite-data-layer` + `pnpm lint:audit-log` + `pnpm lint:logs`
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command (scoped) | File Exists | Status |
|-----|----------|-----------|----------------------------|-------------|--------|
| US-FIELD-01 | EIN format + IRS-prefix accept/reject | unit | `pnpm --filter @contractor-ops/validators test src/__tests__/us-validators.test.ts` | ❌ W0 | ⬜ |
| US-FIELD-01 | `usCountryFieldsSchema` parse | unit | `pnpm --filter @contractor-ops/validators test src/__tests__/country-fields.test.ts` | ⚠️ extend | ⬜ |
| US-FIELD-02 | SSN format + invalid-range (000/666/900–999, group 00, serial 0000) | unit | `pnpm --filter @contractor-ops/validators test src/__tests__/us-validators.test.ts` | ❌ W0 | ⬜ |
| US-FIELD-02 | `encryptSsn`/`decryptSsn` round-trip + `ssnLast4` | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/ssn-crypto.test.ts` | ❌ W0 | ⬜ |
| US-FIELD-02 | `revealSsn` requires `contractorPii:read` → FORBIDDEN otherwise; writes audit row; staff-router only | unit | `pnpm --filter @contractor-ops/api test src/routers/core/__tests__/contractor-reveal-ssn.test.ts` | ❌ W0 | ⬜ |
| US-FIELD-02 | role → `contractorPii:read` matrix: **owner/admin/finance_admin grant; external_accountant + the other 6 DENY** (D-09) | unit | `pnpm --filter @contractor-ops/auth test` | ⚠️ extend | ⬜ |
| US-FIELD-02 | `*.ssn`/`*.ein` redacted by pino | unit | `pnpm --filter @contractor-ops/logger test` | ⚠️ extend | ⬜ |
| US-FIELD-03 | USPS adapter: token cache; 60/hr GLOBAL self-throttle → unverified; Redis-down → fail-open; address-cache hit; schema `safeParse` | unit (mocked fetch+Redis) | `pnpm --filter @contractor-ops/gov-api test src/clients/__tests__/usps-client.test.ts` | ❌ W0 | ⬜ |
| US-FIELD-04 | dispatch renders `UsComplianceFields` for `countryCode==='US'` | component (jsdom) | `pnpm --filter @contractor-ops/web-vite test src/components/contractors/__tests__/country-compliance-us.test.tsx` | ❌ W0 (scoped) | ⬜ |
| US-FIELD-04 | SSN masked-reveal: reveal-absent w/o perm; revealed after click; loading/error | component | `pnpm --filter @contractor-ops/web-vite test src/components/contractors/compliance/__tests__/ssn-masked-reveal.test.tsx` | ❌ W0 (scoped) | ⬜ |
| US-LOC-01 | en-US fallback-parity: divergent key OK; en-only key covered for en-US; missing peer key still fails | unit | `pnpm --filter @contractor-ops/lint-guards test src/i18n-parity/__tests__/run-guard.test.ts` | ⚠️ extend | ⬜ |
| US-LOC-01 | `en-US` registered (SUPPORTED_LOCALES/localeMeta/loader); `Intl` en-US MM/DD/YYYY + `$` | unit | `pnpm --filter @contractor-ops/web-vite test src/i18n/__tests__/messages.test.ts` | ⚠️ extend | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/validators/src/__tests__/us-validators.test.ts` — US-FIELD-01/02 (EIN/SSN vectors)
- [ ] `packages/api/src/services/__tests__/ssn-crypto.test.ts` — US-FIELD-02 crypto round-trip
- [ ] `packages/api/src/routers/core/__tests__/contractor-reveal-ssn.test.ts` — US-FIELD-02 RBAC + audit + staff-router-only
- [ ] `packages/gov-api/src/clients/__tests__/usps-client.test.ts` + `schemas/usps-address.schema.ts` — US-FIELD-03
- [ ] `apps/web-vite/src/components/contractors/__tests__/country-compliance-us.test.tsx` + `compliance/__tests__/ssn-masked-reveal.test.tsx` — US-FIELD-04
- [ ] Extend: `packages/auth` access-control test (10-role matrix, D-09), `packages/logger` pii-mask test, `packages/lint-guards` run-guard test (fallback mode), `packages/validators` country-fields test, web-vite i18n messages test
- [ ] Framework install: none — Vitest present in every target package

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real USPS round-trip against live creds | US-FIELD-03 | LOCAL-ONLY has no USPS creds; adapter is unit-tested with mocked fetch + fail-open | Post-deploy: set USPS OAuth creds, validate a known CASS address |
| Visual polish + WCAG contrast (US section, SSN reveal, USPS pill) | US-FIELD-04 | Visual review, not unit-assertable | frontend-design checker / manual a11y pass |
| Locale-switcher visual + ar RTL non-regression | US-LOC-01 | Visual smoke | Switch to en-US; confirm MM/DD/YYYY + `$`; confirm ar still RTL |
| Cross-pod Redis throttle under real load | US-FIELD-03 | Concurrency, not unit-assertable | Load test post-deploy |
| IRS-prefix / SSN-range table accuracy | US-FIELD-01/02 | Legal/tax-adviser verification (deferred posture) | Adviser sign-off pre-production |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags; web-vite path-scoped only
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
