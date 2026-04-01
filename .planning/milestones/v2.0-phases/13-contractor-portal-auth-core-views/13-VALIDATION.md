---
phase: 13
slug: contractor-portal-auth-core-views
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (workspace root) |
| **Quick run command** | `pnpm test --filter @contractor-ops/api` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --filter @contractor-ops/api`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | PORT-01 | unit | `pnpm test --filter @contractor-ops/api` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | PORT-01 | unit | `pnpm test --filter @contractor-ops/api` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | PORT-02 | unit | `pnpm test --filter @contractor-ops/api` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | PORT-03 | unit | `pnpm test --filter @contractor-ops/api` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | PORT-04 | unit | `pnpm test --filter @contractor-ops/api` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 2 | PORT-05 | unit | `pnpm test --filter @contractor-ops/api` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test infrastructure setup for portal tRPC procedures
- [ ] Test fixtures for PortalSession and contractor data
- [ ] Mock helpers for portal auth middleware

*Exact file paths and stubs determined during planning.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Magic link email delivery | PORT-01 | Requires email service integration | Send magic link, verify email received with valid link |
| PDF upload via portal | PORT-03 | Requires R2 storage + browser file API | Upload PDF, verify it appears in org's invoice pipeline |
| Portal mobile responsive layout | PORT-01 | Visual layout verification | Open portal on 375px viewport, verify hamburger menu and content layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
