---
phase: 31
slug: google-workspace-directory-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (workspace root) |
| **Quick run command** | `pnpm test --filter=@contractor-ops/api --filter=@contractor-ops/integrations` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --filter=@contractor-ops/api --filter=@contractor-ops/integrations`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | GOOG-01 | unit | `pnpm test --filter=@contractor-ops/integrations` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | GOOG-01 | unit | `pnpm test --filter=@contractor-ops/integrations` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 1 | GOOG-02 | unit | `pnpm test --filter=@contractor-ops/api` | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 2 | GOOG-03 | unit | `pnpm test --filter=@contractor-ops/api` | ❌ W0 | ⬜ pending |
| 31-04-01 | 04 | 2 | GOOG-04 | unit | `pnpm test --filter=@contractor-ops/api` | ❌ W0 | ⬜ pending |
| 31-05-01 | 05 | 3 | GOOG-05 | unit | `pnpm test --filter=@contractor-ops/api` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for GoogleWorkspaceAdapter (OAuth, directory listing, group listing)
- [ ] Test stubs for directory import tRPC procedures
- [ ] Test stubs for sync service (new hire detection, departure flagging)
- [ ] Shared fixtures for mock Google API responses

*Existing infrastructure covers test framework — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth consent screen | GOOG-01 | Requires real Google admin account | Connect Google Workspace in settings, verify Admin SDK scopes requested |
| Import wizard UX flow | GOOG-02, GOOG-03 | Visual/interaction testing | Preview directory, select users, assign roles, confirm import |
| Sync notifications | GOOG-05 | Requires time-based trigger | Trigger manual sync, verify new hire/departure notifications appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
