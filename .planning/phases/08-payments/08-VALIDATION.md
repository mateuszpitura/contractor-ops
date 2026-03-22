---
phase: 8
slug: payments
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/api/vitest.config.ts (if exists, else Wave 0 installs) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --reporter=verbose` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test -- --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --reporter=verbose`
- **After every plan wave:** Run `pnpm --filter @contractor-ops/api test -- --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | PAY-01, PAY-02 | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | PAY-05 | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | PAY-03 | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | PAY-04 | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | PAY-06 | manual | browser verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework setup in api package (vitest config if missing)
- [ ] `packages/api/src/routers/__tests__/payment.test.ts` — stubs for payment router
- [ ] `packages/api/src/services/__tests__/payment-export.test.ts` — stubs for export generators

*If existing test infrastructure covers: adapt to existing patterns.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payment run creation dialog UX flow | PAY-02 | Multi-step dialog with invoice selection requires browser interaction | Open /payments, click New Payment Run, select invoices, lock & export |
| Bank file download and content | PAY-03 | File download and content inspection | Export a run, open CSV/Elixir/SEPA file, verify fields |
| Contractor payments tab | PAY-06 | Visual integration on contractor profile | Open contractor profile, click Payments tab, verify run history |
| Payment run history with currency totals | PAY-06 | Visual layout verification | Open /payments, verify history table with currency summaries |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
