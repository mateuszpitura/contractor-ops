---
phase: 3
slug: contracts-documents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

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
| 03-01-01 | 01 | 1 | CNTR-01 | unit | `pnpm test --filter=@contractor-ops/validators -- --run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | CNTR-01, CNTR-03 | integration | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | CNTR-05 | unit | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | DOCS-01, DOCS-02 | integration | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | DOCS-03 | unit | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | DOCS-04 | unit | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | CNTR-04 | unit | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | CNTR-02, DOCS-04 | unit | `pnpm test --filter=@contractor-ops/api -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework configuration verified (vitest in monorepo)
- [ ] `packages/api/src/routers/__tests__/contract.test.ts` — stubs for CNTR-01 through CNTR-05
- [ ] `packages/api/src/routers/__tests__/document.test.ts` — stubs for DOCS-01 through DOCS-04
- [ ] `packages/validators/src/__tests__/contract.test.ts` — stubs for contract validation schemas
- [ ] Test fixtures for Prisma mock or test database context

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag & drop upload UX | DOCS-01 | Browser interaction | Open document upload, drag PDF onto drop zone, verify progress indicator and success state |
| Inline PDF preview | DOCS-02 | Visual rendering | Upload PDF, navigate to document detail, verify PDF renders inline with page navigation |
| Virus scan integration | DOCS-03 | External service dependency | Upload test EICAR file, verify scan status transitions PENDING → INFECTED |
| Contract wizard pre-fill | CNTR-01 | Multi-step UI flow | Create contract from contractor profile, verify billing fields pre-filled from contractor |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
