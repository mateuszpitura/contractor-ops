---
phase: 21
slug: api-build-fixes-permission-registration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) + vitest |
| **Config file** | `packages/api/tsconfig.json`, `vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api exec tsc --noEmit` |
| **Full suite command** | `pnpm --filter @contractor-ops/api exec tsc --noEmit && pnpm --filter @contractor-ops/api test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api exec tsc --noEmit`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | DOCS-01, DOCS-02, CAL-01, CAL-02 | build | `pnpm --filter @contractor-ops/integrations exec tsc --noEmit` | N/A | ⬜ pending |
| 21-01-02 | 01 | 1 | ALL | build | `pnpm --filter @contractor-ops/validators build` | N/A | ⬜ pending |
| 21-01-03 | 01 | 1 | TIME-02 | build | `pnpm --filter @contractor-ops/api exec tsc --noEmit 2>&1 \| grep -c "time"` | N/A | ⬜ pending |
| 21-01-04 | 01 | 2 | ALL | build | `pnpm --filter @contractor-ops/api exec tsc --noEmit` | N/A | ⬜ pending |
| 21-01-05 | 01 | 2 | CAL-01, CAL-02 | build | `pnpm --filter @contractor-ops/api exec tsc --noEmit 2>&1 \| grep calendar` | N/A | ⬜ pending |
| 21-01-06 | 01 | 2 | DOCS-01, DOCS-02 | build | `pnpm --filter @contractor-ops/api exec tsc --noEmit 2>&1 \| grep doc-link` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase fixes build errors — the TypeScript compiler is the primary validation tool.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calendar events created on Google/Outlook | CAL-01, CAL-02 | Requires live OAuth credentials | human_needed — deferred to integration testing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
