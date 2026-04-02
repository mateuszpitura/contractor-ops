---
phase: 30
slug: equipment-tracking-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project standard) |
| **Config file** | `packages/api/vitest.config.ts` |
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
| 30-01-01 | 01 | 1 | EQUIP-01 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | EQUIP-02 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-03 | 01 | 1 | EQUIP-03 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-04 | 01 | 1 | EQUIP-04 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-05 | 01 | 1 | EQUIP-08 | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | ❌ W0 | ⬜ pending |
| 30-02-01 | 02 | 2 | EQUIP-09 | unit | `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/equipment-workflow.test.ts` | ❌ W0 | ⬜ pending |
| 30-02-02 | 02 | 2 | EQUIP-10 | unit | `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/equipment-workflow.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/routers/__tests__/equipment.test.ts` — stubs for EQUIP-01 through EQUIP-08
- [ ] `packages/api/src/services/__tests__/equipment-workflow.test.ts` — stubs for EQUIP-09, EQUIP-10
- [ ] `packages/validators/src/__tests__/equipment.test.ts` — Zod schema validation

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
