---
phase: 29
slug: linear-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `packages/integrations/vitest.config.ts` |
| **Quick run command** | `cd packages/integrations && pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm turbo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/integrations && pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm turbo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | LIN-01 | unit | `cd packages/integrations && pnpm vitest run src/adapters/__tests__/linear-adapter.test.ts -x` | W0 | pending |
| 29-01-02 | 01 | 1 | LIN-04 | unit | `cd packages/integrations && pnpm vitest run src/adapters/__tests__/linear-adapter.test.ts -x` | W0 | pending |
| 29-02-01 | 02 | 1 | LIN-02 | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-status-mapping.test.ts -x` | W0 | pending |
| 29-02-02 | 02 | 1 | LIN-03 | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-issue-sync.test.ts -x` | W0 | pending |
| 29-02-03 | 02 | 1 | LIN-05 | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-issue-sync.test.ts -x` | W0 | pending |
| 29-03-01 | 03 | 2 | LIN-06 | manual-only | Visual verification in browser | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `packages/integrations/src/adapters/__tests__/linear-adapter.test.ts` — stubs for LIN-01, LIN-04
- [ ] `packages/api/src/__tests__/linear-status-mapping.test.ts` — stubs for LIN-02
- [ ] `packages/api/src/__tests__/linear-issue-sync.test.ts` — stubs for LIN-03, LIN-05
- [ ] `packages/validators/src/__tests__/linear.test.ts` — covers webhook payload validation

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Linear issue chip renders with purple brand accent and status dot | LIN-06 | Visual/styling verification requires browser render | 1. Navigate to workflow task with linked Linear issue 2. Verify chip shows issue ID + colored status dot 3. Verify purple accent distinct from Jira blue chips 4. Click chip to verify opens Linear in new tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
