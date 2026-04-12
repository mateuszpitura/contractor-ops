---
phase: 46
slug: multi-currency-foundation-swift-payment-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts` / `packages/shared/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --reporter=verbose` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --reporter=verbose`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | CURR-01, CURR-03 | — | N/A | unit | `pnpm --filter @contractor-ops/shared test` | ❌ W0 | ⬜ pending |
| 46-01-02 | 01 | 1 | CURR-01 | — | N/A | unit | `pnpm --filter @contractor-ops/shared test` | ❌ W0 | ⬜ pending |
| 46-02-01 | 02 | 1 | CURR-02, CURR-03 | — | N/A | unit | `pnpm --filter @contractor-ops/db test` | ❌ W0 | ⬜ pending |
| 46-03-01 | 03 | 2 | CURR-04, CURR-05 | — | Rate source validation | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 46-04-01 | 04 | 2 | PAY-01, PAY-02 | — | XML injection prevention | unit+snapshot | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 46-05-01 | 05 | 3 | PAY-03 | — | Format auto-detect correctness | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/__tests__/money.test.ts` — stubs for CURR-01, CURR-03 (Dinero.js wrapper tests)
- [ ] `packages/api/src/services/__tests__/exchange-rate.test.ts` — stubs for CURR-04, CURR-05
- [ ] `packages/api/src/services/__tests__/payment-export-swift.test.ts` — stubs for PAY-01, PAY-02
- [ ] `packages/api/src/services/__tests__/payment-format-detection.test.ts` — stubs for PAY-03

*Existing infrastructure covers test framework — vitest is already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Organization currency selector in settings UI | CURR-02 | Frontend rendering requires browser | Open settings page, verify currency dropdown shows AED/SAR/GBP/PLN/EUR |
| SWIFT XML bank acceptance | PAY-01 | Requires actual bank gateway | Validate generated XML against ISO 20022 XSD schema manually |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
