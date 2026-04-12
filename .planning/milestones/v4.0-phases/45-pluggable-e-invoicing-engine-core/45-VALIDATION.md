---
phase: 45
slug: pluggable-e-invoicing-engine-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/einvoice/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `pnpm --filter @contractor-ops/einvoice test` |
| **Full suite command** | `pnpm --filter @contractor-ops/einvoice test && pnpm --filter @contractor-ops/api test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/einvoice test`
- **After every plan wave:** Run `pnpm --filter @contractor-ops/einvoice test && pnpm --filter @contractor-ops/api test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 1 | EINV-01 | — | N/A | unit | `pnpm --filter @contractor-ops/einvoice test` | ❌ W0 | ⬜ pending |
| 45-01-02 | 01 | 1 | EINV-01 | — | N/A | unit | `pnpm --filter @contractor-ops/einvoice test` | ❌ W0 | ⬜ pending |
| 45-02-01 | 02 | 1 | EINV-02, EINV-05 | — | N/A | unit | `pnpm --filter @contractor-ops/einvoice test` | ❌ W0 | ⬜ pending |
| 45-02-02 | 02 | 1 | EINV-05 | — | N/A | integration | `pnpm --filter @contractor-ops/einvoice test` | ❌ W0 | ⬜ pending |
| 45-03-01 | 03 | 2 | EINV-03, EINV-04 | — | N/A | unit | `pnpm --filter @contractor-ops/einvoice test` | ❌ W0 | ⬜ pending |
| 45-04-01 | 04 | 2 | EINV-06 | — | N/A | unit | `pnpm --filter @contractor-ops/einvoice test` | ❌ W0 | ⬜ pending |
| 45-05-01 | 05 | 3 | EINV-05 | — | N/A | integration | `pnpm --filter @contractor-ops/api test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/einvoice/vitest.config.ts` — vitest configuration for new package
- [ ] `packages/einvoice/src/profiles/ksef/__tests__/parser.test.ts` — migrated from integrations
- [ ] `packages/einvoice/src/profiles/ksef/__tests__/api-client.test.ts` — migrated from integrations
- [ ] `packages/einvoice/src/__tests__/registry.test.ts` — profile registry tests
- [ ] `packages/einvoice/src/__tests__/engine.test.ts` — engine pipeline tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard compliance widget renders correctly | EINV-06 | Visual UI check | Navigate to dashboard, verify compliance widget shows KSeF status |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
