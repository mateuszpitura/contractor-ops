---
phase: 41
slug: teams-channel-ref-onboarding-oauth
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-08
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `npx vitest run packages/api/src/services/teams/__tests__/conversation-ref.test.ts packages/api/src/services/messaging/__tests__/messaging-provider.test.ts` |
| **Full suite command** | `npx vitest run --project api` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | TEAM-03 | unit | `npx vitest run packages/api/src/services/teams/__tests__/conversation-ref.test.ts` | yes | green |
| 41-01-02 | 01 | 1 | TEAM-03 | unit | `npx vitest run packages/api/src/services/messaging/__tests__/messaging-provider.test.ts` | yes | green |
| 41-02-01 | 02 | 1 | ONBD-01 | manual | — | — | manual-only |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or config needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Onboarding wizard Connect button opens OAuth popup via tRPC | ONBD-01 | React component requiring browser/JSDOM environment; no web vitest config in main tree; tRPC mocking infrastructure not established | 1. Start dev server. 2. Navigate to onboarding wizard. 3. Click Connect on a disconnected provider. 4. Verify popup opens to provider OAuth page (not 404). 5. After auth, verify source list refreshes. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual-only designation
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 1s
- [ ] `nyquist_compliant: true` set in frontmatter — blocked by ONBD-01 manual-only

**Approval:** partial 2026-04-08

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 1 |
| Escalated | 1 |

### Resolved Gaps

- **TEAM-03 sendChannelAlert lookup**: Added 3 tests to `messaging-provider.test.ts` verifying channel ref resolution by `params.channelId`, missing ref warning, and no-connection early return.

### Escalated to Manual-Only

- **ONBD-01 OAuth popup flow**: React component test requires JSDOM/happy-dom environment, React Testing Library, and tRPC mock infrastructure not present in the project. Verified via grep-based acceptance criteria and human verification instructions in `41-VERIFICATION.md`.

---

_Validated: 2026-04-08_
_Validator: Claude (gsd-validate-phase)_
