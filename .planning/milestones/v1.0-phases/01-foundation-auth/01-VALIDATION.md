---
phase: 1
slug: foundation-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/integration) + Playwright (e2e) |
| **Config file** | packages/config/vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test:all` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test:all`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ORG-01 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | ORG-03,04 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | ORG-06,07 | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | ORG-01,02 | e2e | `pnpm test:e2e` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | ORG-05 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | I18N-01,02 | unit | `pnpm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/config/vitest.config.ts` — shared vitest config
- [ ] `apps/web/vitest.config.ts` — web app test config
- [ ] `apps/web/tests/setup.ts` — test setup with mocks
- [ ] vitest + @testing-library/react + playwright installed

*Framework must be installed in Plan 01-01 (monorepo scaffolding).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Org creation during sign-up flow | ORG-01 | Full auth flow requires browser interaction | Sign up with email → verify org created → land on dashboard |
| Invite acceptance with auto-join | ORG-03,04 | Email delivery + link click | Send invite → check email → click link → verify role assignment |
| Dark/light mode toggle | ORG-02 | Visual verification | Toggle theme → verify CSS variables update → check persistence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
