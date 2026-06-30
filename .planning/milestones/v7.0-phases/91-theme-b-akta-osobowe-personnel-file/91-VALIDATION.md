---
phase: 91
slug: theme-b-akta-osobowe-personnel-file
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 91 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo → vitest per package) |
| **Config file** | per-package `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test <path>` |
| **Full suite command** | `pnpm test` (turbo → vitest) |
| **Estimated runtime** | ~varies per package |

> NOTE: Never run the full unscoped `web-vite` suite — scope with a path arg (RAM constraint, MEMORY).

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}` scoped to the touched package
- **After every plan wave:** Run the scoped suite for the touched packages
- **Before `/gsd:verify-work`:** Scoped suites for all touched packages must be green
- **Max feedback latency:** keep scoped (path-arg) runs under a minute

---

## Per-Task Verification Map

> Filled by the planner from the RESEARCH.md "Validation Architecture" (RESEARCH.md §Validation Architecture) Wave-0 test map. Each of the 4 success criteria maps to at least one automated test.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 91-XX-XX | XX | 1 | AKTA-01 | — | per-section RBAC enforced at permission layer (positive + negative/BFLA: owner never granted, contractor never mutates) | unit | `pnpm --filter @contractor-ops/auth test` | ❌ W0 | ⬜ pending |
| 91-XX-XX | XX | 1 | AKTA-02 | — | per-jurisdiction retention cutoff math incl. US I-9 max(HIRE+3y, TERM+1y) + active-employee indefinite-retain | unit | `pnpm --filter @contractor-ops/db test` | ❌ W0 | ⬜ pending |
| 91-XX-XX | XX | 1 | AKTA-03 | — | per-section erasure disposition; never claims full erasure while any hold active (fullErasureClaimed:false) | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 91-XX-XX | XX | 1 | AKTA-04 | — | taxonomy-hit + AI-fallback + killswitch-off→admin + low-confidence→admin | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 91-XX-XX | XX | 1 | AKTA-01..04 | — | PersonnelFile cross-org tenant-leak regression (clone worker-tenant-isolation.test.ts) | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Per-section RBAC test (positive grant + negative/BFLA fence) for `employeeFileA..D`
- [ ] Retention cutoff math test incl. US I-9 `max()` combinator + active-employee indefinite-retain (null termination anchor)
- [ ] Per-section erasure disposition test asserting the never-claim-full-erasure-during-hold invariant
- [ ] Classifier routing test: taxonomy-hit, AI-fallback, killswitch-off→admin, low-confidence→admin
- [ ] PersonnelFile cross-org tenant-leak regression (cloned from `worker-tenant-isolation.test.ts`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Jurisdiction retention-window + section-taxonomy copy is legally correct | AKTA-02 | Legal/tax adviser sign-off deferred (Standing Constraint, REQUIREMENTS line 26); all statutory strings ship adviser-verify-annotated | Flag every retention/section statutory string for adviser review; code ships local-only with annotations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency kept low via scoped path-arg runs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
