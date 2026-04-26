---
phase: 2
slug: contractor-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/integration) |
| **Config file** | packages/config/vitest.config.ts (from Phase 1 if exists, else Wave 0) |
| **Quick run command** | `pnpm build` |
| **Full suite command** | `pnpm build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm build`
- **After every plan wave:** Run `pnpm build`
- **Before `/gsd:verify-work`:** Full build must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CONT-01,02,03 | build | `pnpm turbo build --filter=@contractor-ops/api` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | CONT-01,09 | build | `pnpm --filter @contractor-ops/web build` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | CONT-04,05 | build | `pnpm turbo build --filter=@contractor-ops/api` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CONT-06 | build | `pnpm --filter @contractor-ops/web build` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | CONT-07,08 | build | `pnpm --filter @contractor-ops/web build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — build verification from Phase 1 applies.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GUS autofill from NIP | CONT-01 | External API call | Enter valid NIP → verify company name auto-populated |
| Side panel on row click | CONT-07 | UI interaction | Click contractor row → verify slide-out panel |
| Compliance health badges | CONT-08 | Visual verification | Add contractor missing docs → verify yellow/red badge |
| Bulk export to CSV | CONT-06 | File download | Select contractors → Export → verify CSV file |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
