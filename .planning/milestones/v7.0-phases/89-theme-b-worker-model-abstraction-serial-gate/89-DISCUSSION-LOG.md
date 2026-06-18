# Phase 89: Theme B — Worker Model Abstraction (serial gate) - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md; this preserves the alternatives + the notable requirement amendment.

**Date:** 2026-06-18
**Phase:** 89-theme-b-worker-model-abstraction-serial-gate
**Areas discussed:** Worker model + table naming, Query-site filtering strategy, Route-shape preservation, Thin-gate scope fence

---

## Worker Model Shape (WORKER-01) — with a requirement amendment

### First pass
| Option | Selected (round 1) |
|--------|--------------------|
| Keep `Contractor` table + add `workerType` (Worker base = Contractor table) | |
| Rename table to `Worker` | |
| Separate Employee table linked to a Worker base | ✓ (round 1) |

**Conflict surfaced:** the round-1 pick ("separate Employee table / new Worker base") collides with WORKER-01's locked *"zero data migration / extends the existing Contractor model"* — a new Worker base requires backfilling a Worker row per existing contractor (a data migration over all v1–v6 contractor data). Re-asked with the conflict made explicit.

### Resolution (round 2)
| Option | Selected |
|--------|----------|
| Contractor = Worker base + separate EmployeeProfile (zero migration) | |
| **True Worker base table + backfill existing contractors (AMENDS WORKER-01)** | ✓ |
| workerType on Contractor, employee data deferred to P90 | |

**Choice:** True `Worker` base table; Contractor + Employee link to it; one-time additive, idempotent, per-region, reversible backfill of a Worker row per existing contractor. **Deliberately amends WORKER-01's zero-migration constraint** (REQUIREMENTS.md updated). Highest-risk operation in the milestone; mitigated by idempotent+reversible migration + largest-org staging-snapshot parity verification.

---

## Query-Site Filtering Strategy (the regression crux — 67 files / ~252 reads)

### First pass
| Option | Selected (round 1) |
|--------|--------------------|
| Central Prisma extension + explicit-override opt-out | |
| Per-site explicit filters | ✓ (round 1) |
| List-builder only | |

### Resolution (round 2)
| Option | Selected |
|--------|----------|
| Per-site explicit primary; shared list-builder defaults w/ explicit-where-wins | |
| **Reconsider — central extension after all** | ✓ |

**Choice:** Central `withWorkerTypeDefault` Prisma extension (chained after tenant/soft-delete), auto-injecting `workerType='CONTRACTOR'` on contractor reads; **explicit-where-wins opt-out** (inject default only when `workerType` absent) so worker/employee queries aren't force-filtered. Can't-forget across all 67 sites; mirrors the proven soft-delete/tenant extension.

---

## Route-Shape Preservation (WORKER-02)

| Option | Selected |
|--------|----------|
| Wave-0 RED contract/snapshot test locking contractor.* shapes | ✓ |
| Typecheck + manual review only | |

**Choice:** Greenfield Vitest contract/snapshot test capturing contractor.* procedure shapes before the router split; CI fails on drift. (No tRPC snapshot tests exist today.)

---

## Thin-Gate Scope Fence

**Choice (not re-asked — confirmed in the ready-for-context step):** Phase 89 = Worker base + backfill + `workerType` + central filter extension + router split (skeleton employeeRouter) + 4 RBAC roles + flag gating + route-shape snapshot + zero-regression suite. **No employee profile fields** — Phase 90.

---

## Claude's Discretion

- Worker base columns vs what stays on Contractor; the Contractor→Worker FK/relation shape (no contractor-row loss).
- Backfill mechanics (raw SQL vs Prisma script), batching, per-region ordering, down/rollback.
- `withWorkerTypeDefault` model-targeting + explicit-where-wins detection.
- Route-shape snapshot format.
- `employee` permission action set + per-role grants.
- Regression suite: seeded fixture vs documented largest-org staging-snapshot procedure.

## Deferred Ideas

- Employee profile fields / per-market identifiers → P90.
- Populating employeeRouter → P90–97.
- Re-pointing Theme A Contractor FKs to Worker → out of scope.
- Fixing the pre-existing duplicated `allPermissions` on `owner` → noted, not in scope.
- Live `module.workforce-employees` enablement → stays dark until Theme B is built.

## Requirement Amendment Recorded

- **WORKER-01** (REQUIREMENTS.md) amended 2026-06-18: the "zero data migration / extend Contractor in place" phrasing is superseded by "dedicated Worker base table + one-time additive, idempotent, per-region, reversible backfill." Contractor-path parity must be verified on a largest-org staging snapshot before the backfill is accepted.
