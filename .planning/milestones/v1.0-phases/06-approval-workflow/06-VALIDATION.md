---
phase: 06
slug: approval-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (if exists) or "none — Wave 0 installs" |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | APPR-01, ORG-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | APPR-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | APPR-01, APPR-02, APPR-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | APPR-02, APPR-03, APPR-04, APPR-07 | manual | N/A — UI interaction | ❌ | ⬜ pending |
| 06-04-01 | 04 | 3 | APPR-05, APPR-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 4 | APPR-09 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework setup (vitest if not already configured)
- [ ] Shared fixtures for approval test data (chain configs, flows, steps)
- [ ] Mock approval chain config factory
- [ ] Mock approval flow/step state machine transitions

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chain editor drag-to-reorder levels | ORG-08 | Drag interaction requires browser | Open Settings > Approvals, create chain, drag level cards |
| Approval queue inline hover actions | APPR-02 | Mouse hover state requires browser | Hover queue row, verify Approve/Reject buttons appear |
| SLA countdown badge color transitions | APPR-05 | Visual color verification | Create approval with short SLA, observe green→yellow→red transition |
| Bulk approve/reject floating toolbar | APPR-04 | Multi-select interaction requires browser | Select 3+ items, verify toolbar, approve all |
| Chain tracker stepper on invoice detail | APPR-08 | Visual layout verification | Submit invoice for approval, verify stepper shows chain progress |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
