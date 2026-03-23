---
phase: 15
slug: e-sign-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test --run` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test --run && pnpm --filter @contractor-ops/integrations test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test --run`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | SIGN-01 | unit | `pnpm --filter @contractor-ops/integrations test --run` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | SIGN-01 | unit | `pnpm --filter @contractor-ops/api test --run` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | SIGN-02 | type-check | `npx tsc --noEmit --project apps/web/tsconfig.json` | N/A | ⬜ pending |
| 15-02-02 | 02 | 2 | SIGN-03 | type-check | `npx tsc --noEmit --project apps/web/tsconfig.json` | N/A | ⬜ pending |
| 15-03-01 | 03 | 2 | SIGN-04 | unit | `pnpm --filter @contractor-ops/integrations test --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/integrations/src/adapters/__tests__/docusign-adapter.test.ts` — stubs for SIGN-01 (DocuSign envelope lifecycle)
- [ ] `packages/integrations/src/adapters/__tests__/autenti-adapter.test.ts` — stubs for SIGN-01 (Autenti document lifecycle)
- [ ] `packages/api/src/routers/__tests__/esign.test.ts` — stubs for SIGN-01/SIGN-03 (tRPC endpoints)
- [ ] `packages/integrations/src/services/__tests__/signing-webhook.test.ts` — stubs for SIGN-04 (webhook processing, signed PDF save)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Embedded DocuSign signing view loads in modal | SIGN-02 | Requires DocuSign sandbox with OAuth + real browser rendering | Navigate to contract detail → Send for Signature → Sign → Verify iframe loads |
| Autenti redirect flow completes | SIGN-02 | Requires Autenti sandbox credentials and browser redirect | Send for signature via Autenti → Follow redirect → Complete signing → Verify return |
| Signed PDF appears in document management | SIGN-04 | End-to-end with real provider webhook delivery | Complete full signing flow → Check Documents tab for signed PDF with audit trail |
| Portal pending signatures with Sign Now | SIGN-02 | Requires portal auth session + provider sandbox | Login to portal → See pending signature → Click Sign Now → Complete signing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
