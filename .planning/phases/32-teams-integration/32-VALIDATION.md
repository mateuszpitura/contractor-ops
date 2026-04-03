---
phase: 32
slug: teams-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/api/vitest.config.ts |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **After every plan wave:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | TEAM-01 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 32-02-01 | 02 | 1 | TEAM-02 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 32-03-01 | 03 | 2 | TEAM-03, TEAM-04 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/teams-client.test.ts` — stubs for TEAM-01, TEAM-02
- [ ] `packages/api/src/services/__tests__/teams-notification.test.ts` — stubs for TEAM-03, TEAM-04
- [ ] `packages/api/src/routers/__tests__/teams.test.ts` — stubs for TEAM-05, TEAM-06

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Azure AD OAuth flow completes | TEAM-01 | Requires Azure AD tenant | Create test app registration, run OAuth flow in browser |
| Adaptive Card renders in Teams | TEAM-03 | Requires Teams client | Send test card via Bot Framework Emulator or test tenant |
| Approve/Reject from Teams card | TEAM-04 | Requires Teams interaction | Click approve button on adaptive card in Teams |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
