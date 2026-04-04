---
phase: 33
slug: inpost-courier-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `cd packages/api && pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm -r --filter api --filter validators --filter integrations run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm -r --filter api --filter validators --filter integrations run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-client.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-status-mapper.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-01-03 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-webhook-handler.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-01-04 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-polling-service.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-02-01 | 02 | 2 | EQUIP-11 | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal-equipment.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-02-02 | 02 | 2 | EQUIP-11 | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/equipment-return.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/courier/__tests__/inpost-client.test.ts` — stubs for EQUIP-05a (createShipment payload)
- [ ] `packages/api/src/services/courier/__tests__/inpost-status-mapper.test.ts` — stubs for EQUIP-05b (status mapping)
- [ ] `packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts` — stubs for EQUIP-05c, EQUIP-05e (webhook + dedup)
- [ ] `packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` — stubs for EQUIP-05d (polling fallback)
- [ ] `packages/api/src/routers/__tests__/portal-equipment.test.ts` — stubs for EQUIP-11a, EQUIP-11b (portal list + return request)
- [ ] `packages/api/src/routers/__tests__/equipment-return.test.ts` — stubs for EQUIP-11c, EQUIP-11d (approval + offboarding)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| InPost Geowidget renders and allows Paczkomat selection | EQUIP-05 | External CDN widget, browser-only | Load shipment form, click "Select Paczkomat", verify map loads, select a locker, confirm form populates |
| ShipX webhook signature verification | EQUIP-05 | Requires live sandbox callback | Create shipment in sandbox, wait for webhook, verify signature header processing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
