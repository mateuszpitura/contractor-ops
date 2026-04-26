---
phase: 14
slug: portal-self-service-branding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PORT-06a | unit | `pnpm --filter @contractor-ops/api test -- --grep "updateContactInfo"` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | PORT-06b | unit | `pnpm --filter @contractor-ops/api test -- --grep "createChangeRequest"` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | PORT-06c | unit | `pnpm --filter @contractor-ops/api test -- --grep "approveChangeRequest"` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | PORT-06d | unit | `pnpm --filter @contractor-ops/api test -- --grep "duplicatePending"` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | PORT-07a | unit | `pnpm --filter @contractor-ops/api test -- --grep "getNotificationPreferences"` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | PORT-07b | unit | `pnpm --filter @contractor-ops/api test -- --grep "updateNotificationPreference"` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | PORT-07c | unit | `pnpm --filter @contractor-ops/api test -- --grep "securityAlertImmutable"` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 1 | PORT-08a | unit | `pnpm --filter @contractor-ops/api test -- --grep "updateBranding"` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 1 | PORT-08b | manual-only | Manual: browser render verification | N/A | ⬜ pending |
| 14-03-03 | 03 | 1 | PORT-08c | manual-only | Manual: browser render verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/__tests__/portal-profile.test.ts` — stubs for PORT-06a through PORT-06d
- [ ] `packages/api/src/__tests__/portal-notification-prefs.test.ts` — stubs for PORT-07a through PORT-07c
- [ ] `packages/api/src/__tests__/portal-branding.test.ts` — stubs for PORT-08a

*Existing Vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Portal layout injects CSS custom property when brandColor set | PORT-08b | Requires browser render verification | Navigate to portal as contractor of org with brand color set. Inspect `--brand-accent` CSS custom property on portal root. Verify buttons/links use accent color. |
| No CSS injection when brandColor not set | PORT-08c | Requires browser render verification | Navigate to portal as contractor of org with no brand color. Verify default Indigo-600 accent used. No `--brand-accent` custom property injected. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
