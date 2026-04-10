---
phase: 28
slug: stripe-billing-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
audited: 2026-04-08
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts` |
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
| 28-01-01 | 01 | 1 | BILL-01 | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "createCheckoutSession"` | ✅ | ✅ green |
| 28-01-02 | 01 | 1 | BILL-02 | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "getProrationPreview"` | ✅ | ✅ green |
| 28-01-03 | 01 | 1 | BILL-03 | unit | `vitest run packages/api/src/services/__tests__/billing-webhook.test.ts -t "trial"` | ✅ | ✅ green |
| 28-01-04 | 01 | 1 | BILL-07 | unit | `vitest run packages/api/src/services/__tests__/billing-webhook.test.ts -t "routeStripeEvent"` | ✅ | ✅ green |
| 28-01-05 | 01 | 1 | BILL-08 | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "createPortalSession"` | ✅ | ✅ green |
| 28-02-01 | 02 | 1 | BILL-04 | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "side effects"` | ✅ | ✅ green |
| 28-02-02 | 02 | 1 | BILL-05 | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "getCreditBalance"` | ✅ | ✅ green |
| 28-02-03 | 02 | 1 | BILL-06 | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "credits are exhausted"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/api/vitest.config.ts` — vitest configuration for API package
- [x] `packages/api/src/services/__tests__/billing-service.test.ts` — covers BILL-01, BILL-02, BILL-03, BILL-08 (40+ real assertions)
- [x] `packages/api/src/services/__tests__/credit-service.test.ts` — covers BILL-04, BILL-05, BILL-06 (35+ real assertions)
- [x] `packages/api/src/services/__tests__/billing-webhook.test.ts` — covers BILL-07 (30+ real assertions)
- [x] `packages/api/src/services/__tests__/test-helpers.ts` — Stripe mock/stub utilities
- [x] Framework install: vitest already present in API package

### Additional Test Coverage (beyond original Wave 0)

- [x] `apps/web/src/app/api/webhooks/stripe/__tests__/route.test.ts` — webhook endpoint sig verification, idempotency (4 tests)
- [x] `apps/web/src/app/api/cron/trial-notifications/__tests__/route.test.ts` — trial notification cron auth and execution (2 tests)
- [x] `apps/web/src/components/billing/__tests__/trial-banner.test.tsx` — trial banner visibility, messages, interactions, a11y (8 tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout redirect works end-to-end | BILL-01 | Requires browser + Stripe test mode | 1. Click "Choose a plan" 2. Select Pro 3. Verify Stripe Checkout loads 4. Complete with test card 5. Verify subscription reflected in app |
| Webhook delivery from Stripe | BILL-07 | Requires Stripe CLI or live webhook | 1. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` 2. Trigger test event 3. Verify idempotent processing |
| Billing portal access | BILL-08 | Requires Stripe-hosted portal redirect | 1. Click "Manage billing" 2. Verify redirect to Stripe portal 3. Verify return URL works |
| OCR credit race condition | BILL-06 | Requires concurrent DB transactions | 1. Set org to 1 credit remaining 2. Trigger 2 concurrent OCR extractions 3. Verify exactly 1 succeeds |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-08

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

### Audit Notes

The original VALIDATION.md was created pre-execution with all statuses as "pending" and files marked as not existing (Wave 0). During phase execution, all four plans were completed successfully:

- **billing-service.test.ts**: Evolved from scaffold to 40+ real assertions covering checkout sessions, proration preview, portal sessions, customer management, seat sync, and input validation.
- **billing-webhook.test.ts**: Evolved from scaffold to 30+ real assertions covering event routing, subscription upsert/delete, trial credits with dedup, invoice credit allocation, trial-will-end notifications, and payment failure handling.
- **credit-service.test.ts**: Evolved from scaffold to 35+ real assertions covering getCreditBalance calculation logic, checkAndDeductCredit decision tree (no sub, exhausted, available), side effects (ledger, meter, cache), and allocateTopUpCredits validation.
- **trial-banner.test.tsx**: 8 component tests covering visibility rules, day-specific messages, interactions, and accessibility attributes.
- **Webhook route tests**: 4 integration tests for signature verification, idempotent processing.
- **Trial notification cron tests**: 2 tests for auth and execution.

All 8 BILL requirements have automated test coverage. No auditor subagent needed.
