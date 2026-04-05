---
phase: 39
slug: final-wiring-channel-alerts-credit-ui-oauth-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `packages/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter verbose` (from package dir) |
| **Full suite command** | `npx turbo run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run src/services/__tests__/notification-service.test.ts -x` (for backend tasks) or `cd apps/web && npx vitest run` (for frontend tasks)
- **After every plan wave:** Run `npx turbo run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | TEAM-02, TEAM-03 | unit | `cd packages/api && npx vitest run src/services/__tests__/notification-service.test.ts -x` | ✅ (needs new cases) | ⬜ pending |
| 39-02-01 | 02 | 1 | BILL-06 | unit | `cd apps/web && npx vitest run src/components/invoices/__tests__/invoice-upload-area.test.ts -x` | ✅ (needs new cases) | ⬜ pending |
| 39-03-01 | 03 | 1 | BILL-09 | unit | `cd apps/web && npx vitest run src/components/integrations/__tests__/linear-provider-section.test.tsx -x` | ✅ (needs new cases) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. New test cases need to be added to existing test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CreditExhaustedInline renders upgrade prompt visually | BILL-06 | Visual rendering verification | Trigger OCR with exhausted credits, verify inline prompt shows upgrade/top-up buttons |
| FeatureGate shows upgrade prompt for STARTER tier | BILL-09 | Visual rendering verification | Log in as STARTER user, navigate to integrations, verify OAuth connect buttons show gate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
