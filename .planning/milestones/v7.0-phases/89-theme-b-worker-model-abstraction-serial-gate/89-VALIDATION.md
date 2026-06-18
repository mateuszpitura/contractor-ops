---
phase: 89
slug: theme-b-worker-model-abstraction-serial-gate
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-18
---

# Phase 89 — Validation Strategy

> Per-phase validation contract. This is the milestone's highest-risk migration — the regression suite + staging-snapshot parity are the gate's pass condition, not optional.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo-orchestrated) |
| **Config file** | per-package `vitest.config.ts` (`packages/db`, `packages/api`, `packages/auth`, `packages/feature-flags`) |
| **Quick run command** | `pnpm --filter @contractor-ops/<pkg> test -- <path>` (scoped) |
| **Full suite command** | `pnpm test --filter @contractor-ops/db --filter @contractor-ops/api --filter @contractor-ops/auth` |
| **Estimated runtime** | ~30–120s scoped; contractor-parity regression suite is the long pole |

> The contractor-path **regression suite** (list/dashboard/payment-run/classification-scan/export/portal reads) must be GREEN both BEFORE the model change (baseline lock) and AFTER the backfill (parity). The largest-org **staging-snapshot parity** is an operational verify step (documented procedure), not a unit test.

---

## Sampling Rate

- **After every task commit:** scoped quick command for the touched package.
- **After the migration task:** the full contractor-parity regression suite + the cross-org leak test on `Worker`.
- **Before `/gsd:verify-work`:** db + api + auth suites green; route-shape snapshot green; raw-SQL-site grep guard green; staging-snapshot parity signed off.
- **Max feedback latency:** ~120 seconds (scoped); regression suite minutes.

---

## Per-Task Verification Map

> Planner fills from PLAN.md task IDs. Anchor rows (from RESEARCH Validation Architecture):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------|--------|
| 89-0X-XX | 0X | 0 | WORKER-01..05 | — | Wave-0 RED scaffolds + contractor-parity BASELINE lock | unit | scoped | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-01 | — | Worker base table + Contractor.workerId @unique nullable FK; additive (no contractor row loss) | unit | `pnpm --filter @contractor-ops/db test -- worker-schema` | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-01 | — | backfill idempotent (re-run `WHERE workerId IS NULL` = no-op) + reversible (down script) + per-region | integration | scoped | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-01/02 | — | contractor-parity regression GREEN after backfill (list/dashboard/payment-run/classification-scan/export/portal) | integration | `pnpm --filter @contractor-ops/api test -- contractor-parity` | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-02 | — | withWorkerTypeDefault extension injects workerType='CONTRACTOR' on find*/count/aggregate; explicit-where-wins | unit | `pnpm --filter @contractor-ops/db test -- worker-type-extension` | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-02 | — | the 4 `$queryRaw FROM Contractor` sites carry an inline workerType predicate (extension can't see raw SQL) + grep guard | unit | `pnpm check:contractor-rawsql-workertype` (new guard) | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-02 | — | contractor.* route shapes snapshot-locked (no drift after split) | unit | `pnpm --filter @contractor-ops/api test -- contractor-route-shape` | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-03 | — | Worker tenant-owning (organizationId); cross-org leak test on Worker; per-type RBAC | unit | `pnpm --filter @contractor-ops/db test -- worker-cross-org-leak` | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-04 | — | 4 new roles added; existing roles byte-identical (regression) | unit | `pnpm --filter @contractor-ops/auth test -- roles` | ❌ W0 | ⬜ pending |
| 89-0X-XX | 0X | N | WORKER-05 | — | module.workforce-employees OFF → Theme B routers METHOD_NOT_FOUND/FORBIDDEN + web-vite render-removal | unit | `pnpm --filter @contractor-ops/api test -- workforce-flag-gate` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Contractor-parity BASELINE lock** — the regression suite captured GREEN against the current (pre-Worker) schema, so post-backfill parity is provable.
- [ ] RED scaffolds for: the Worker schema + FK, the idempotent/reversible backfill, the withWorkerTypeDefault extension (find*/count/aggregate + explicit-where-wins), the 4 raw-SQL inline predicates + grep guard, the route-shape snapshot, the Worker cross-org leak test, the 4 roles, the flag-off gate.
- [ ] The `check:contractor-rawsql-workertype` grep guard (new CI check) — fails if a `$queryRaw … FROM "Contractor"` lacks a workerType predicate.
- [ ] Existing vitest infrastructure covers the rest; no new framework.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Largest-org staging-snapshot contractor parity | WORKER-01 | Requires a real prod-shaped snapshot; the gate's pass condition | Restore largest-org snapshot to staging, run the backfill, run the contractor-parity suite + spot-check lists/exports; sign off before enforcing NOT NULL |
| Multi-region backfill apply (EU/ME/US) | WORKER-01 | Mutates live regional DBs | [BLOCKING] human gate; idempotent + reversible; confirm per region (P83–88 convention) |
| Backfill reversibility | WORKER-01 | Down-migration on real data | Verify the down script restores pre-backfill state on staging before prod |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (parity baseline, extension, raw-SQL guard, route-shape, cross-org leak)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s (scoped)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
