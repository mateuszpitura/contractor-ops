---
phase: 33
slug: inpost-courier-integration
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
validated: 2026-04-08
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
| 33-01-01 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-client.test.ts -x` | ✅ | ✅ green (6 tests) |
| 33-01-02 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-status-mapper.test.ts -x` | ✅ | ✅ green (23 tests) |
| 33-01-03 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-webhook-handler.test.ts -x` | ✅ | ✅ green (10 tests) |
| 33-01-04 | 01 | 1 | EQUIP-05 | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-polling-service.test.ts -x` | ✅ | ✅ green (7 tests) |
| 33-02-01 | 02 | 2 | EQUIP-11 | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal-equipment.test.ts -x` | ✅ | ✅ green (3 tests) |
| 33-02-02 | 02 | 2 | EQUIP-11 | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/equipment-return.test.ts -x` | ✅ | ✅ green (8 tests) |
| 33-xx-01 | 01+ | 1+ | EQUIP-05 | integration | `cd packages/api && pnpm vitest run src/services/courier/__tests__/shipment-task-completion-integration.test.ts -x` | ✅ | ✅ green (4 tests) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/api/src/services/courier/__tests__/inpost-client.test.ts` — EQUIP-05a (createShipment payload) — 6 tests
- [x] `packages/api/src/services/courier/__tests__/inpost-status-mapper.test.ts` — EQUIP-05b (status mapping) — 23 tests
- [x] `packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts` — EQUIP-05c, EQUIP-05e (webhook + dedup) — 10 tests
- [x] `packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` — EQUIP-05d (polling fallback) — 7 tests
- [x] `packages/api/src/routers/__tests__/portal-equipment.test.ts` — EQUIP-11a, EQUIP-11b (portal list + return request) — 3 tests
- [x] `packages/api/src/routers/__tests__/equipment-return.test.ts` — EQUIP-11c, EQUIP-11d (approval + offboarding) — 8 tests
- [x] `packages/api/src/services/courier/__tests__/shipment-task-completion-integration.test.ts` — EQUIP-05 (webhook/polling task completion integration) — 4 tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| InPost Geowidget renders and allows Paczkomat selection | EQUIP-05 | External CDN widget, browser-only | Load shipment form, click "Select Paczkomat", verify map loads, select a locker, confirm form populates |
| ShipX webhook signature verification | EQUIP-05 | Requires live sandbox callback | Create shipment in sandbox, wait for webhook, verify signature header processing |

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
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Total test files | 7 |
| Total tests | 61 |
| Requirements covered | EQUIP-05, EQUIP-11 |

**Audit notes:**
- All 6 originally planned test files exist and pass (48 unit tests + 11 router tests)
- 1 bonus integration test file (`shipment-task-completion-integration.test.ts`) adds 4 tests covering webhook/polling task completion paths
- VERIFICATION.md confirms 15/15 must-haves verified, score PASSED
- Two warning-level anti-patterns noted in VERIFICATION.md (NOTIFICATION_STATUSES unused in webhook handler, missing checkShipmentTaskCompletion in original plan) were resolved in later commits — integration test confirms both paths now work
- Manual-only verifications (Geowidget rendering, ShipX webhook signature in sandbox) remain appropriately manual
