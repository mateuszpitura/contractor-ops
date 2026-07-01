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
| 91-01-T1 | 01 | 0 | AKTA-02 | T-91-01-01 | RED scaffold: retention resolver math (4 jurisdictions + US I-9 max() + active→indefinite) | unit | `pnpm --filter @contractor-ops/db test personnel-retention.test.ts` | ❌ → creates | ⬜ pending |
| 91-01-T1 | 01 | 0 | AKTA-01/02 | T-91-01-01 | RED scaffold: registry register-on-import + duplicate-id throw + recordType ⊆ RETENTION_YEARS | unit | `pnpm --filter @contractor-ops/compliance-policy test personnel-registry.test.ts` | ❌ → creates | ⬜ pending |
| 91-01-T2 | 01 | 0 | AKTA-01 | T-91-01-01 | RED scaffold: employeeFileA..D structural + owner BFLA fence + 4 HR roles matrix | unit | `pnpm --filter @contractor-ops/auth test personnel-file-rbac.test.ts` | ❌ → creates | ⬜ pending |
| 91-01-T2 | 01 | 0 | AKTA-01..04 | T-91-01-01 | RED scaffold: PersonnelFile absent from globalModels + ORG_A never sees ORG_B file | unit | `pnpm --filter @contractor-ops/api test personnel-file-tenant-isolation.test.ts` | ❌ → creates | ⬜ pending |
| 91-01-T2 | 01 | 0 | AKTA-01 | T-91-01-01 | RED scaffold: payroll_officer gets section B locked over the wire | unit | `pnpm --filter @contractor-ops/api test personnel-file-rbac-router.test.ts` | ❌ → creates | ⬜ pending |
| 91-01-T3 | 01 | 0 | AKTA-03 | T-91-01-01 | RED scaffold: per-section disposition + fullErasureClaimed===false under any hold | unit | `pnpm --filter @contractor-ops/api test personnel-erasure.test.ts` | ❌ → creates | ⬜ pending |
| 91-01-T3 | 01 | 0 | AKTA-04 | T-91-01-01 | RED scaffold: taxonomy-hit / AI-fallback / killswitch-off→admin / low-confidence→admin | unit | `pnpm --filter @contractor-ops/api test personnel-classifier.test.ts` | ❌ → creates | ⬜ pending |
| 91-05-T1 | 05 | 2 | AKTA-02 | T-91-05-01 | GREEN: akta years on shared RETENTION_YEARS + event-anchor resolver (max()+indefinite) | unit | `pnpm --filter @contractor-ops/db test personnel-retention.test.ts` | ❌ W0 → GREEN | ⬜ pending |
| 91-03-T2 | 03 | 1 | AKTA-01/02 | T-91-03-02 | GREEN: section + retention-rule registries register on import (PL/DE/UK/US) | unit | `pnpm --filter @contractor-ops/compliance-policy test personnel-registry.test.ts` | ❌ W0 → GREEN | ⬜ pending |
| 91-04-T2 | 04 | 1 | AKTA-01 | T-91-04-01 | GREEN: section matrix wired to 4 HR roles; owner allPermissions fence intact | unit | `pnpm --filter @contractor-ops/auth test personnel-file-rbac.test.ts` | ❌ W0 → GREEN | ⬜ pending |
| 91-07-T2 | 07 | 3 | AKTA-01..04 | T-91-07-02 | GREEN: cross-org getFile → NOT_FOUND (ctx.db tenant scope) | unit | `pnpm --filter @contractor-ops/api test personnel-file-tenant-isolation.test.ts` | ❌ W0 → GREEN | ⬜ pending |
| 91-07-T2 | 07 | 3 | AKTA-01 | T-91-07-01 | GREEN: per-section read gated at permission layer (payroll→B locked, no payload) | unit | `pnpm --filter @contractor-ops/api test personnel-file-rbac-router.test.ts` | ❌ W0 → GREEN | ⬜ pending |
| 91-09-T1 | 09 | 4 | AKTA-03 | T-91-09-01 | GREEN: per-section erasure dispositions + never-over-claim audit | unit | `pnpm --filter @contractor-ops/api test personnel-erasure.test.ts` | ❌ W0 → GREEN | ⬜ pending |
| 91-06-T2 | 06 | 2 | AKTA-04 | T-91-06-02 | GREEN: classifier taxonomy→AI→admin routing; killswitch fail-safe to PENDING | unit | `pnpm --filter @contractor-ops/api test personnel-classifier.test.ts` | ❌ W0 → GREEN | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists: `❌ → creates` = 91-01 authors the RED scaffold in wave 0 · `❌ W0 → GREEN` = file lands RED in wave 0, turned GREEN by the listed consumer task/plan.*
*Rows above the first GREEN row are the seven Wave-0 RED scaffolds (all authored in plan 91-01, wave 0); each is turned GREEN by exactly one downstream consumer task.*

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
