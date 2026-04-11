---
phase: 51
slug: pdpl-compliance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | PDPL-01 | T-51-01 | Privacy notice matches org jurisdiction | unit | `pnpm --filter @contractor-ops/api test -- --run -t "privacy-notice"` | ❌ W0 | ⬜ pending |
| 51-01-02 | 01 | 1 | PDPL-02 | T-51-02 | ConsentRecord created on grant, append-only on revoke | unit | `pnpm --filter @contractor-ops/api test -- --run -t "consent-record"` | ❌ W0 | ⬜ pending |
| 51-02-01 | 02 | 1 | PDPL-02 | T-51-03 | Only authorized users can manage consent | integration | `pnpm --filter @contractor-ops/api test -- --run -t "consent-router"` | ❌ W0 | ⬜ pending |
| 51-03-01 | 03 | 2 | PDPL-03 | T-51-04 | DPA PDF contains correct org data | unit | `pnpm --filter @contractor-ops/api test -- --run -t "dpa-generation"` | ❌ W0 | ⬜ pending |
| 51-03-02 | 03 | 2 | PDPL-04 | T-51-05 | SCC generated only for cross-border orgs | unit | `pnpm --filter @contractor-ops/api test -- --run -t "scc-generation"` | ❌ W0 | ⬜ pending |
| 51-04-01 | 04 | 2 | PDPL-01 | — | Blocking consent step prevents org setup | component | `pnpm --filter web test -- --run -t "consent-step"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/privacy-notice.test.ts` — stubs for PDPL-01
- [ ] `packages/api/src/services/__tests__/consent-record.test.ts` — stubs for PDPL-02
- [ ] `packages/api/src/routers/__tests__/consent-router.test.ts` — stubs for PDPL-02 API
- [ ] `packages/api/src/services/__tests__/legal-document-generation.test.ts` — stubs for PDPL-03, PDPL-04

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Privacy notice content is legally accurate | PDPL-01 | Legal review required | Review generated notice text against UAE/Saudi PDPL articles |
| DPA template matches jurisdiction requirements | PDPL-03 | Legal review required | Compare DPA content with standard DPA clauses |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
