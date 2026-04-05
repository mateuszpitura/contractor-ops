---
phase: 36
slug: wiring-fixes-webhook-ui-featuregate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
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
| 36-01-01 | 01 | 1 | LIN-04 | integration | `pnpm vitest run packages/api/src/routes/__tests__/webhook-linear-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| 36-01-02 | 01 | 1 | LIN-05 | integration | `pnpm vitest run packages/api/src/services/__tests__/linear-outbound-sync.test.ts` | ❌ W0 | ⬜ pending |
| 36-02-01 | 02 | 1 | EQUIP-06 | unit | `pnpm vitest run apps/web/src/components/equipment/__tests__/shipment-form-mount.test.tsx` | ❌ W0 | ⬜ pending |
| 36-02-02 | 02 | 1 | EQUIP-07 | unit | `pnpm vitest run apps/web/src/components/settings/__tests__/carrier-credentials-mount.test.tsx` | ❌ W0 | ⬜ pending |
| 36-03-01 | 03 | 1 | BILL-09 | unit | `pnpm vitest run apps/web/src/components/__tests__/feature-gate-mount.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for Linear webhook dispatch (LIN-04)
- [ ] Test stubs for Linear outbound sync on cancel (LIN-05)
- [ ] Test stubs for CarrierShipmentForm mounting (EQUIP-06)
- [ ] Test stubs for CarrierCredentialForm settings mount (EQUIP-07)
- [ ] Test stubs for FeatureGate UI activation (BILL-09)

*Existing test infrastructure (vitest) covers framework needs — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shipment form reachable from equipment detail | EQUIP-06 | UI navigation flow | Navigate to equipment detail → click "Ship" → verify CarrierShipmentForm renders |
| Carrier credentials accessible in Settings | EQUIP-07 | Navigation integration | Settings > Integrations → verify DPD/UPS credential forms render |
| Feature gate upgrade prompt UX | BILL-09 | Visual verification | Log in as STARTER user → navigate to PRO feature → verify upgrade prompt instead of error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
