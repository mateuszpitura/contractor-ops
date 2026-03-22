---
phase: 07
slug: notifications-slack
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (if exists) or "none — Wave 0 installs" |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | NOTF-01 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | NOTF-01, NOTF-03 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | NOTF-02 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | SLCK-01, SLCK-02, SLCK-03 | manual | N/A — Slack OAuth + interactivity | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] TypeScript compilation passes across all packages
- [ ] Resend SDK already installed (verify)
- [ ] @slack/web-api package installation

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell popover opens with notifications | NOTF-01 | Browser interaction | Click bell icon, verify popover drops down with notification list |
| Click notification navigates to entity | NOTF-01 | Browser navigation | Click notification item, verify redirect to correct entity page |
| Email arrives via Resend | NOTF-02 | External service | Trigger notification event, check email inbox |
| Slack OAuth flow completes | SLCK-01 | External service | Click Connect Slack, complete OAuth, verify connection status |
| Slack approve/reject buttons work | SLCK-02 | External service | Receive Slack DM, click approve, verify invoice status updates |
| Preference matrix toggles persist | NOTF-02 | Full stack | Toggle email off for approval request, trigger event, verify no email sent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
