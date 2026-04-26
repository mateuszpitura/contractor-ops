---
phase: 5
slug: invoice-intake-matching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 5 — Validation Strategy

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
| 05-01-01 | 01 | 1 | INV-01, INV-03 | unit | `pnpm test --filter=@contractor-ops/validators -- --run` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | INV-04, INV-05, INV-06, INV-07, INV-08 | integration | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | INV-02 | integration | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | INV-01, INV-03 | unit | `pnpm test --filter=@contractor-ops/web -- --run` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 3 | INV-09, INV-10 | unit | `pnpm test --filter=@contractor-ops/web -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework configuration verified (vitest in monorepo)
- [ ] `packages/api/src/routers/__tests__/invoice.test.ts` — stubs for INV-01 through INV-10
- [ ] `packages/api/src/services/__tests__/matching-engine.test.ts` — stubs for matching logic
- [ ] `packages/validators/src/__tests__/invoice.test.ts` — stubs for invoice validation schemas

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-file drag & drop upload | INV-01 | Browser DnD interaction | Drag 3 PDFs onto DropZone, verify 3 drafts created |
| Side-by-side PDF + metadata layout | INV-10 | Visual rendering | Open invoice detail, verify PDF on left (60%), form on right (40%) |
| Email intake end-to-end | INV-02 | External service (Resend) | Send email to test inbox, verify draft created |
| Status chip filtering | INV-08 | Browser interaction | Click status chips, verify table filters correctly |
| Manual matching search pickers | INV-09 | Complex form interaction | Search contractor by NIP, select contract, confirm match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
