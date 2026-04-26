---
phase: 36
slug: wiring-fixes-webhook-ui-featuregate
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
audited: 2026-04-08
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm turbo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm turbo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | LIN-04 | integration | `pnpm vitest run apps/web/src/app/api/webhooks/_process/__tests__/route.test.ts` | ✅ | ✅ green |
| 36-01-02 | 01 | 1 | LIN-05 | unit | `pnpm vitest run packages/api/src/services/__tests__/linear-issue-sync.test.ts` | ✅ | ✅ green |
| 36-02-01 | 02 | 1 | EQUIP-06 | unit | `pnpm vitest run apps/web/src/components/settings/__tests__/integrations-tab.test.tsx` | ✅ | ✅ green |
| 36-02-02 | 02 | 1 | EQUIP-07 | unit | `pnpm vitest run apps/web/src/components/settings/__tests__/integrations-tab.test.tsx` | ✅ | ✅ green |
| 36-03-01a | 03 | 1 | BILL-09 | unit | `pnpm vitest run packages/api/src/routers/__tests__/linear.test.ts` | ✅ | ✅ green |
| 36-03-01b | 03 | 1 | BILL-09 | unit | `pnpm vitest run packages/api/src/routers/__tests__/jira.test.ts` | ✅ | ✅ green |
| 36-03-01c | 03 | 1 | BILL-09 | unit | `pnpm vitest run packages/api/src/routers/__tests__/calendar.test.ts` | ✅ | ✅ green |
| 36-03-01d | 03 | 1 | BILL-09 | unit | `pnpm vitest run packages/api/src/routers/__tests__/ocr.test.ts` | ✅ | ✅ green |
| 36-03-01e | 03 | 1 | BILL-09 | unit | `pnpm vitest run packages/api/src/routers/__tests__/audit.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Test for Linear webhook dispatch (LIN-04) — added to route.test.ts
- [x] Test for Linear outbound sync on cancel (LIN-05) — covered by linear-issue-sync.test.ts
- [x] Test for CarrierShipmentForm mounting (EQUIP-06) — added DPD/UPS assertions to integrations-tab.test.tsx
- [x] Test for CarrierCredentialForm settings mount (EQUIP-07) — added DPD/UPS assertions to integrations-tab.test.tsx
- [x] Test for FeatureGate tier gating (BILL-09) — added tier gating tests to linear, jira, calendar, ocr, audit router tests

*All gaps resolved via retroactive validation audit.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shipment form reachable from equipment detail | EQUIP-06 | UI navigation flow | Navigate to equipment detail → click "Ship" → verify CarrierShipmentForm renders |
| Carrier credentials accessible in Settings | EQUIP-07 | Navigation integration | Settings > Integrations → verify DPD/UPS credential forms render |
| Feature gate upgrade prompt UX | BILL-09 | Visual verification | Log in as STARTER user → navigate to PRO feature → verify upgrade prompt instead of error |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-08

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 5 |
| Resolved | 5 |
| Escalated | 0 |

### Tests Added

1. `apps/web/src/app/api/webhooks/_process/__tests__/route.test.ts` — added "dispatches to processLinearWebhook for linear provider" test (LIN-04)
2. `apps/web/src/components/settings/__tests__/integrations-tab.test.tsx` — added "renders DPD and UPS carrier provider sections" test (EQUIP-06, EQUIP-07)
3. `packages/api/src/routers/__tests__/linear.test.ts` — added tier gating describe block verifying requireTier(PRO) on mutations and absence on read-only queries (BILL-09)
4. `packages/api/src/routers/__tests__/jira.test.ts` — added tier gating describe block verifying requireTier(PRO) on 3 mutations (BILL-09)
5. `packages/api/src/routers/__tests__/calendar.test.ts` — added tier gating describe block verifying requireTier(PRO) on 2 mutations (BILL-09)
6. `packages/api/src/routers/__tests__/ocr.test.ts` — added tier gating describe block verifying requireTier(PRO) on trigger/retrigger (BILL-09)
7. `packages/api/src/routers/__tests__/audit.test.ts` — added tier gating describe block verifying requireTier(ENTERPRISE) on export (BILL-09)
