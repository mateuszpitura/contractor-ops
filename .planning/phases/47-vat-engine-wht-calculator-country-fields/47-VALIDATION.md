---
phase: 47
slug: vat-engine-wht-calculator-country-fields
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts`, `packages/validators/vitest.config.ts` |
| **Quick run command** | `pnpm -F @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm turbo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm turbo test --filter=...{changed packages}`
- **After every plan wave:** Run `pnpm turbo test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | TAX-01 | T-47-01 | TaxRate seed data only writable via migration, not API | unit | `pnpm -F @contractor-ops/api test -- --run -t "TaxRate"` | ❌ W0 | ⬜ pending |
| 47-01-02 | 01 | 1 | TAX-01 | — | N/A | unit | `pnpm -F @contractor-ops/validators test -- --run -t "vatRate"` | ❌ W0 | ⬜ pending |
| 47-02-01 | 02 | 1 | TAX-02 | — | N/A | unit | `pnpm -F @contractor-ops/api test -- --run -t "reverseCharge"` | ❌ W0 | ⬜ pending |
| 47-03-01 | 03 | 2 | TAX-03 | T-47-02 | WHT rate lookup bound to org scope, no cross-org rate access | unit | `pnpm -F @contractor-ops/api test -- --run -t "wht"` | ❌ W0 | ⬜ pending |
| 47-03-02 | 03 | 2 | TAX-04 | T-47-03 | PDF generation endpoint requires auth + org membership | unit | `pnpm -F @contractor-ops/api test -- --run -t "whtCertificate"` | ❌ W0 | ⬜ pending |
| 47-04-01 | 04 | 2 | PROF-01, PROF-02 | — | N/A | unit | `pnpm -F @contractor-ops/validators test -- --run -t "countryFields"` | ❌ W0 | ⬜ pending |
| 47-04-02 | 04 | 2 | PROF-03 | — | N/A | unit | `pnpm -F @contractor-ops/api test -- --run -t "countryFields"` | ❌ W0 | ⬜ pending |
| 47-04-03 | 04 | 2 | PROF-04 | — | N/A | unit | `pnpm -F @contractor-ops/validators test -- --run -t "tin"` | ❌ W0 | ⬜ pending |
| 47-05-01 | 05 | 3 | TAX-05 | — | N/A | unit | `pnpm -F @contractor-ops/api test -- --run -t "taxSummary"` | ❌ W0 | ⬜ pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for TaxRate service lookup
- [ ] Test stubs for reverse charge detection
- [ ] Test stubs for WHT calculation
- [ ] Test stubs for country fields Zod validation
- [ ] Test stubs for TIN format validation

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WHT certificate PDF renders correctly with org branding | TAX-04 | Visual PDF verification | Generate certificate, open PDF, verify layout/branding |
| Country fields show/hide based on org country in UI | PROF-03 | Frontend conditional rendering | Switch org country, verify correct fields appear |
| Compliance dashboard shows combined e-invoicing + tax view | TAX-05 | Visual dashboard integration | View dashboard with both e-invoicing and tax data |

---

## Coverage Goals

| Domain | Target | Notes |
|--------|--------|-------|
| TaxRate lookup service | 90% | Core tax logic must be well-tested |
| WHT calculator | 90% | Financial calculation correctness |
| Reverse charge detection | 85% | Country-pair matrix coverage |
| Country fields Zod schemas | 95% | Validation boundary tests |
| TIN format validators | 95% | Per-country format correctness |
| tRPC endpoints | 80% | Auth + basic CRUD paths |
