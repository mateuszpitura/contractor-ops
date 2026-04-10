---
phase: 30
slug: equipment-tracking-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-02
audited: 2026-04-08
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project standard) |
| **Config files** | `packages/api/vitest.config.ts`, `packages/validators/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | EQUIP-01 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ✅ | ✅ green |
| 30-01-02 | 01 | 1 | EQUIP-02 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ✅ | ✅ green |
| 30-01-03 | 01 | 1 | EQUIP-03 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ✅ | ✅ green |
| 30-01-04 | 01 | 1 | EQUIP-04 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ✅ | ✅ green |
| 30-01-05 | 01 | 1 | EQUIP-08 | unit | `pnpm --filter web test -- --run src/components/equipment/__tests__/shipment-timeline.test.tsx` | ✅ | ✅ green |
| 30-02-01 | 02 | 2 | EQUIP-09 | unit | `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/equipment-workflow.test.ts` | ✅ | ✅ green |
| 30-02-02 | 02 | 2 | EQUIP-10 | unit | `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/equipment-workflow.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Additional Test Coverage (discovered during audit)

| Package | Test File | Tests | Status |
|---------|-----------|-------|--------|
| validators | `packages/validators/src/__tests__/equipment.test.ts` | 10 | ✅ green |
| validators | `packages/validators/src/__tests__/dpd-ups-equipment.test.ts` | — | ✅ green |
| api | `packages/api/src/routers/__tests__/equipment.test.ts` | 19 | ✅ green |
| api | `packages/api/src/services/__tests__/equipment-workflow.test.ts` | 21 | ✅ green |
| api | `packages/api/src/routers/__tests__/portal-equipment.test.ts` | — | ✅ green |
| api | `packages/api/src/routers/__tests__/equipment-return.test.ts` | — | ✅ green |
| api | `packages/api/src/routers/__tests__/equipment-test-connection.test.ts` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/equipment-status-badge.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/shipment-status-badge.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/equipment-type-icon.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/equipment-form.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/assignment-dialog.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/shipment-form.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/shipment-timeline.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/__tests__/shipment-condensed.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-table/__tests__/equipment-columns.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-table/__tests__/equipment-table.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-table/__tests__/equipment-toolbar.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-detail/__tests__/equipment-detail-header.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-detail/__tests__/equipment-detail-tabs.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-detail/__tests__/tab-info.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-detail/__tests__/tab-assignments.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/equipment/equipment-detail/__tests__/tab-shipments.test.tsx` | — | ✅ green |
| web | `apps/web/src/components/contractors/contractor-profile/__tests__/tab-equipment.test.tsx` | 2 | ✅ green |

**Total: 33 test files, 279+ tests passing across 3 packages**

---

## Wave 0 Requirements

- [x] `packages/api/src/routers/__tests__/equipment.test.ts` — covers EQUIP-01 through EQUIP-04 (CRUD, assign, unassign, shipment, status transitions)
- [x] `packages/api/src/services/__tests__/equipment-workflow.test.ts` — covers EQUIP-09, EQUIP-10 (workflow start, auto-completion)
- [x] `packages/validators/src/__tests__/equipment.test.ts` — Zod schema validation (all 7 schemas)

*Existing test infrastructure (Vitest) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Equipment nav item visible in sidebar | EQUIP-01 | UI rendering | Navigate to dashboard, verify Equipment nav item with icon |
| Shipment timeline renders vertically | EQUIP-08 | Visual layout | Create shipment, add events, verify timeline displays chronologically |
| Contractor Equipment tab shows assigned items | EQUIP-03 | UI integration | Assign equipment to contractor, navigate to profile, verify Equipment tab |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Total test files | 33 |
| Total tests passing | 279+ |
| Packages covered | 3 (api, validators, web) |

**Audit result:** All 7 requirement mappings (EQUIP-01 through EQUIP-04, EQUIP-08 through EQUIP-10) have automated tests that run green. No gaps detected. Phase 30 is Nyquist-compliant.
