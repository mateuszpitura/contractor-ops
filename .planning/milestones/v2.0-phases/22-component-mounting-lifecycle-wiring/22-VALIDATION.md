---
phase: 22
slug: component-mounting-lifecycle-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/api/vitest.config.ts |
| **Quick run command** | `cd packages/api && npx vitest run --reporter=verbose` |
| **Full suite command** | `npx turbo run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx turbo run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | DOCS-01 | manual-only | Visual check — component mount is import+JSX | N/A | ⬜ pending |
| 22-01-02 | 01 | 1 | CAL-02 | manual-only | Visual check — component mount is import+JSX | N/A | ⬜ pending |
| 22-02-01 | 02 | 1 | CAL-01 | unit | `cd packages/api && npx vitest run src/services/__tests__/calendar-lifecycle.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | CAL-01 | unit | `cd packages/api && npx vitest run src/services/__tests__/calendar-lifecycle.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-02-03 | 02 | 1 | CAL-01 | unit | `cd packages/api && npx vitest run src/services/__tests__/calendar-lifecycle.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/calendar-lifecycle.test.ts` — stubs for CAL-01 lifecycle wiring tests

*Existing infrastructure covers DOCS-01 and CAL-02 (manual visual verification only).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DocLinksSection renders in task-card-run expanded view | DOCS-01 | Component mount is import+JSX, visual check | Expand a workflow task run card → Documents section visible after Attachments |
| CalendarTaskConfig renders in template-builder task card | CAL-02 | Component mount is import+JSX, visual check | Open template builder → saved task card shows Calendar toggle below Jira |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
