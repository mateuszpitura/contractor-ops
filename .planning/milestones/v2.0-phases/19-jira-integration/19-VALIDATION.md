---
phase: 19
slug: jira-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/api/vitest.config.ts |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test -- --run && pnpm --filter @contractor-ops/integrations test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | JIRA-01 | unit | `pnpm --filter @contractor-ops/integrations test -- --run` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | JIRA-01 | unit | `pnpm --filter @contractor-ops/integrations test -- --run` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | JIRA-02 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 1 | JIRA-02 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 2 | JIRA-03 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 2 | JIRA-03 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 2 | JIRA-04 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 19-04-02 | 04 | 2 | JIRA-04 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/jira-issue-sync.test.ts` — stubs for JIRA-02, JIRA-03
- [ ] `packages/api/src/services/__tests__/jira-webhook-handler.test.ts` — stubs for JIRA-03
- [ ] `packages/integrations/src/__tests__/jira-adapter-webhooks.test.ts` — stubs for JIRA-01, webhook registration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Jira OAuth consent screen flow | JIRA-01 | Requires real Jira Cloud instance and browser interaction | Connect Jira from Settings > Integrations, verify OAuth redirect and token storage |
| Jira issue chip click opens Jira | JIRA-04 | Browser navigation behavior | Click a Jira issue chip on workflow view, verify new tab opens to correct Jira URL |
| Status mapping UI saves correctly | JIRA-03 | Full form interaction | Open status mapping dialog, select Jira project, map statuses, save, verify configJson |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
