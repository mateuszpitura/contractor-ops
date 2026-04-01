---
phase: 28
slug: stripe-billing-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (not yet configured in API package) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pnpm exec vitest run --reporter=verbose` |
| **Full suite command** | `pnpm exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run --reporter=verbose` (billing tests only)
- **After every plan wave:** Run `pnpm exec vitest run` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + manual Stripe CLI webhook test
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | BILL-01 | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "tier management"` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 1 | BILL-02 | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "proration"` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 1 | BILL-03 | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "trial"` | ❌ W0 | ⬜ pending |
| 28-01-04 | 01 | 1 | BILL-07 | unit | `vitest run packages/api/src/services/__tests__/billing-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-05 | 01 | 1 | BILL-08 | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "portal"` | ❌ W0 | ⬜ pending |
| 28-02-01 | 02 | 1 | BILL-04 | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "meter event"` | ❌ W0 | ⬜ pending |
| 28-02-02 | 02 | 1 | BILL-05 | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "allowance"` | ❌ W0 | ⬜ pending |
| 28-02-03 | 02 | 1 | BILL-06 | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "exhausted"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/vitest.config.ts` — vitest configuration for API package
- [ ] `packages/api/src/services/__tests__/billing-service.test.ts` — covers BILL-01, BILL-02, BILL-03, BILL-08
- [ ] `packages/api/src/services/__tests__/credit-service.test.ts` — covers BILL-04, BILL-05, BILL-06
- [ ] `packages/api/src/services/__tests__/billing-webhook.test.ts` — covers BILL-07
- [ ] `packages/api/src/services/__tests__/test-helpers.ts` — Stripe mock/stub utilities
- [ ] Framework install: `pnpm add -D vitest --filter @contractor-ops/api`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout redirect works end-to-end | BILL-01 | Requires browser + Stripe test mode | 1. Click "Choose a plan" 2. Select Pro 3. Verify Stripe Checkout loads 4. Complete with test card 5. Verify subscription reflected in app |
| Webhook delivery from Stripe | BILL-07 | Requires Stripe CLI or live webhook | 1. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` 2. Trigger test event 3. Verify idempotent processing |
| Billing portal access | BILL-08 | Requires Stripe-hosted portal redirect | 1. Click "Manage billing" 2. Verify redirect to Stripe portal 3. Verify return URL works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
