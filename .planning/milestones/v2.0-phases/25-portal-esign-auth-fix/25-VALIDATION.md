---
phase: 25
slug: portal-esign-auth-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `npx vitest run packages/api/src/routers/__tests__/esign.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/api/src/routers/__tests__/esign.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 0 | SIGN-02 | unit | `npx vitest run packages/api/src/routers/__tests__/esign.test.ts` | Partial | ⬜ pending |
| 25-01-02 | 01 | 1 | SIGN-02 | unit | `npx vitest run packages/api/src/routers/__tests__/esign.test.ts` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/routers/__tests__/esign.test.ts` — add `getPortalSigningUrl` test stubs (recipient verified, non-recipient rejected)

*Existing test file exists, needs new test cases for portal signing procedure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EmbeddedSigningModal loads signing iframe in portal context | SIGN-02 | Requires browser + DocuSign sandbox iframe | 1. Log in as portal contractor 2. Navigate to pending signatures 3. Click Sign → modal opens with signing iframe |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
