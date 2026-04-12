---
phase: 4
slug: workflow-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (root) |
| **Quick run command** | `pnpm test --filter=@contractor-ops/api -- --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --filter=@contractor-ops/api -- --run`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | WKFL-01, WKFL-02 | unit | `pnpm test --filter=@contractor-ops/validators -- --run` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | WKFL-01, WKFL-02, WKFL-03, ORG-09 | integration | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | WKFL-04 | unit | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | WKFL-05, WKFL-06 | integration | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | WKFL-07, WKFL-08 | unit | `pnpm test --filter=@contractor-ops/web -- --run` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | WKFL-09, WKFL-10 | integration | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework configuration verified (vitest in monorepo)
- [ ] `packages/api/src/routers/__tests__/workflow.test.ts` — stubs for WKFL-01 through WKFL-10
- [ ] `packages/validators/src/__tests__/workflow.test.ts` — stubs for workflow validation schemas
- [ ] `packages/api/src/services/__tests__/condition-evaluator.test.ts` — stubs for condition logic engine
- [ ] Test fixtures for workflow template and run mock data

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-to-reorder tasks | WKFL-02 | Browser DnD interaction | Open template builder, drag task card, verify sort order updates |
| AND/OR condition builder | WKFL-04 | Complex form interaction | Add multiple conditions with AND/OR, verify JSON output |
| Workflow progress checklist | WKFL-10 | Visual rendering | Start workflow, complete tasks, verify progress bar and status icons |
| Task inline actions | WKFL-07 | Browser interaction | Complete, skip, reassign tasks via inline buttons |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
