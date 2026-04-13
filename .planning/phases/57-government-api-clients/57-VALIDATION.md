---
phase: 57
slug: government-api-clients
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-12
approved_at: 2026-04-13
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `57-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 4.1.4 (unit + integration across `@contractor-ops/gov-api`, `@contractor-ops/api`, `@contractor-ops/db`, `@contractor-ops/validators`); MSW 2.x already in `@contractor-ops/test-utils` |
| **Config file** | Per-package `vitest.config.ts` / `package.json` scripts (workspace standard) |
| **Quick run command** | `pnpm --filter @contractor-ops/gov-api test --run hmrc-vat-client` (under 30s) |
| **Full suite command** | `pnpm turbo run test` |
| **Estimated runtime** | ~5s quick (single package); ~60–90s full monorepo |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <changed-package> test --run` (single-package quick check).
- **After every plan wave:** Run `pnpm turbo run test --filter=...[HEAD^1]` — all packages touched by the wave.
- **Before `/gsd-verify-work`:** Full `pnpm turbo run test` must be green.
- **Max feedback latency:** under 30 seconds per task commit.

---

## Per-Requirement Test Map

| Req ID | Behavior | Test Type | Automated Command | Task ID | Status |
|--------|----------|-----------|-------------------|---------|--------|
| PAY-02 | Seed loads GB rates (20/5/0/RC) with isDefault on 20 | unit | `pnpm --filter @contractor-ops/db test --run tax-rates.seed` | 57-01 T1 | ✅ green |
| PAY-02 | `getTaxRatesForCountry('GB')` returns rates sorted with 20 first | unit | `pnpm --filter @contractor-ops/api test --run tax-rate.service` | 57-04 T4 | ✅ green |
| PAY-02 | Invoice line creation with `org.countryCode='GB'` preselects code '20' | integration | `pnpm --filter @contractor-ops/api test --run invoice.test` | 57-04 T1 | ✅ green |
| PAY-03 | `HmrcVatClient.checkVatNumber` issues GET with Bearer token to `/organisations/vat/check-vat-number/lookup:vrn/:requesterVrn` | unit | `pnpm --filter @contractor-ops/gov-api test --run hmrc-vat-client` | 57-02 T1 | ✅ green |
| PAY-03 | `HmrcVatClient` refreshes token after 401 once then retries | unit | same | 57-02 T1 | ✅ green |
| PAY-03 | Local `isValidGbVat` short-circuits invalid-format before network call | unit | same (asserts no fetch made) | 57-03 T1 | ✅ green |
| PAY-03 | tRPC `contractor.validateVat` writes `TaxIdValidation` row + updates `Contractor.latestVatValidatedAt` atomically | integration | `pnpm --filter @contractor-ops/api test --run contractor.test` | 57-04 T1 | ✅ green |
| PAY-03 | D-08: HMRC 503 returns `responseStatus='stale'` using last valid row | integration | same | 57-03 T1 | ✅ green |
| PAY-04 | Seed loads DE rates (19/7/RC/KU) | unit | `pnpm --filter @contractor-ops/db test --run tax-rates.seed` | 57-01 T1 | ✅ green |
| PAY-04 | `org.isKleinunternehmer=true` + DE → invoice lines forced to 'KU' | integration | `pnpm --filter @contractor-ops/api test --run invoice.test` | 57-04 T1 | ✅ green |
| PAY-04 | `detectReverseCharge` rule 'gb_eu_post_brexit_b2b' triggers both directions | unit | `pnpm --filter @contractor-ops/api test --run reverse-charge.service` | 57-03 T2 | ✅ green |
| PAY-04 | `detectReverseCharge` rule 'de_domestic_13b_ustg' triggers for DE→DE + serviceType='CONSTRUCTION' | unit | `pnpm --filter @contractor-ops/api test --run reverse-charge.service` | 57-03 T2 | ✅ green |
| PAY-04 | Locked phrase CI guard rejects `TAX_KLEINUNTERNEHMER_NOTICE` key in any messages/*.json | unit | `pnpm --filter @contractor-ops/validators test --run locked-phrases-guard` | 57-01 T3 | ✅ green |
| PAY-04 | Locked phrase CI guard rejects `TAX_UK_REVERSE_CHARGE_NOTICE` key in any messages/*.json | unit | same | 57-01 T3 | ✅ green |
| PAY-05 | `ViesClient.checkVatNumber` issues GET to `/rest-api/ms/DE/vat:vrn?requesterMemberStateCode=&requesterNumber=` | unit | `pnpm --filter @contractor-ops/gov-api test --run vies-client` | 57-02 T2 | ✅ green |
| PAY-05 | `ViesClient` parses qualified response + returns `consultationNumber` in `confirmationRef` | unit | same | 57-02 T2 | ✅ green |
| PAY-05 | `userError='MS_UNAVAILABLE'` → `responseStatus='unavailable'` + triggers stale-fallback | unit + integration | same + `contractor.test` | 57-02 T2 + 57-03 T1 | ✅ green |
| PAY-05 | Zod schema rejects unexpected VIES shape (malformed body) | unit | `pnpm --filter @contractor-ops/gov-api test --run vies-client` | 57-02 T2 | ✅ green |
| PAY-05 | Local `isValidUstIdNr` short-circuits format-invalid DE VAT | unit | same | 57-03 T1 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs assigned during planning — now filled in post-execution.*

---

## Wave 0 Requirements

Test infrastructure created before implementation waves began — all now complete:

- [x] `packages/gov-api/src/clients/hmrc-vat-client.test.ts` — PAY-03 HMRC client behavior (Plan 57-02 T1, GREEN)
- [x] `packages/gov-api/src/clients/vies-client.test.ts` — PAY-05 VIES client behavior (Plan 57-02 T2, GREEN)
- [x] `packages/gov-api/src/schemas/hmrc-vat.schema.ts` + `vies.schema.ts` — Zod response schemas (+ colocated schema tests) (Plan 57-01 T2, GREEN)
- [x] `packages/test-utils/src/msw/handlers/hmrc.ts` — HMRC OAuth token + VAT lookup endpoints (Plan 57-01 T2, GREEN)
- [x] `packages/test-utils/src/msw/handlers/vies.ts` — VIES simple + qualified + userError scenarios (Plan 57-01 T2, GREEN)
- [x] `packages/test-utils/src/msw/fixtures/hmrc.ts` + `vies.ts` — canonical 200/404/500 bodies (Plan 57-01 T2, GREEN)
- [x] `packages/db/prisma/schema/tax.prisma` — `TaxIdValidation` model (Plan 57-01 T1, pushed to dev DB)
- [x] `packages/db/__tests__/tax-rates.seed.test.ts` — assert GB + DE seed entries + isDefault flags (Plan 57-01 T1, GREEN)
- [x] `packages/api/src/services/__tests__/reverse-charge.service.test.ts` — post-Brexit + §13b tests (Plan 57-03 T2, GREEN; 16 tests)
- [x] `packages/api/src/services/__tests__/tax-rate.service.test.ts` — `getTaxRatesForCountry` + `getDefaultRateCode` (Plan 57-04 T4, GREEN; 7 tests)
- [x] `packages/api/src/services/__tests__/tax-id-validation.service.test.ts` — orchestrator (Plan 57-03 T1, GREEN; 15 tests)
- [x] `packages/api/src/routers/__tests__/contractor.test.ts` — `validateVat` / `revalidateVat` / `update` D-07 trigger 1 (Plan 57-04 T1, GREEN; 10 phase-57 tests)
- [x] `packages/api/src/routers/__tests__/invoice.test.ts` — Kleinunternehmer + default-rate + staleness (Plan 57-04 T1, GREEN; 8 phase-57 tests)
- [x] `packages/validators/src/legal/en.ts` — `TAX_UK_REVERSE_CHARGE_NOTICE` (Plan 57-01 T3)
- [x] `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — reserved-key list with all 3 new phrases (Plan 57-01 T3, GREEN; 15 tests)

**Framework install:** None — `vitest` + `msw` were already present in every relevant workspace.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HMRC sandbox test VRN setup | PAY-03 | One-time HMRC developer-hub onboarding and sandbox app registration; cannot automate | Dev/ops registers HMRC app, stores client_id + client_secret in SecretStore, captures sandbox test VRN list, documents in `.planning/ops/hmrc-setup.md` |
| Fraud-prevention header legal applicability | PAY-03 | HMRC documentation ambiguous whether Check-a-VAT endpoint requires these headers; best-effort send but legal/compliance review warranted | Compliance review of Gov-Client-* header composition vs HMRC fraud-prevention policy; document decision in RESEARCH.md assumption A1 |
| §13b service-type list completeness | PAY-04 | German tax law defines additional §13b categories beyond the initial 5 (e.g. electricity, gas, telecoms) — Steuerberater confirms initial scope | Steuerberater reviews proposed serviceType enum against current §13b (1)-(11) list and confirms scope |
| Platform VRN for requesterVrn | PAY-03 | Whether to register a dedicated Contractor Ops VRN vs use the primary business VRN is a business/tax decision | Ops/finance confirms which VRN to use; document in env var `HMRC_PLATFORM_VRN` |
| Production rate-limit calibration | PAY-03, PAY-05 | Real-world traffic patterns unknown until launch; HMRC 3 req/s production limit may need per-org quota tuning | Monitor rate-limit hits in staging; tune Upstash sliding-window thresholds before production cutover |
| Phase 57-04 Task 3 human-verify checkpoint | PAY-02..05 | Requires a running dev environment + HMRC sandbox credentials + interactive operator review of 9 scenarios | Operator follows `57-04-PLAN.md §Task 3` scenarios 1-9; records outcome in SUMMARY. Pending operator execution (sandbox credentials not yet provisioned per STATE.md HMRC blocker). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ W0 references — all converted to GREEN
- [x] No watch-mode flags in any command
- [x] Feedback latency under 30s for quick command (single package)
- [x] Every requirement PAY-02..PAY-05 has at least one automated test row
- [x] `nyquist_compliant: true` set in frontmatter once planner assigns task IDs and all rows resolve

**Approval:** approved 2026-04-13 — all 19 test rows GREEN; task IDs filled in; `nyquist_compliant: true`. Phase 57-04 Task 3 human-verify checkpoint remains as a pending manual sign-off (tracked above) contingent on HMRC sandbox provisioning.
