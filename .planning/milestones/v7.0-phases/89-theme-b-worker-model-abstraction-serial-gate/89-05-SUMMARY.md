---
phase: 89-theme-b-worker-model-abstraction-serial-gate
plan: 05
subsystem: auth
tags: [rbac, permissions, better-auth, worker-model, tenant-isolation, vitest]

# Dependency graph
requires:
  - phase: 89-01
    provides: the contractor.* route-shape + parity baselines that prove the abstraction adds no regression
  - phase: 89-02
    provides: the tenant-owning Worker base model (organizationId, absent from globalModels) that the cross-org leak test scopes against
provides:
  - employee RBAC resource (create/read/update/delete/approve_leave) in accessControlStatement
  - four HR roles (hr_admin, hr_manager, payroll_officer, leave_approver) granting only employee + narrow contractor:read, never a contractor mutation
  - role-permission-matrix freeze covering all 14 roles + a roles.test guard proving the 10 pre-existing roles are unchanged
  - Worker cross-org leak regression test (behavioral + structural globalModels guard)
affects: [phase-90 (employee profile surface consumes the employee resource), worker-model-abstraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-type RBAC: a distinct `employee` resource gates HR-only fields independently of `contractor`, so HR roles cannot widen contractor access (BFLA fence)"
    - "owner is sourced from a hand-maintained allPermissions duplicate that intentionally omits new HR-only resources — a new accessControlStatement resource is NOT auto-granted to owner; the owner-coverage test skips employee like it already skips admin:boe-rate"
    - "Worker cross-org leak test clones the tenant-isolation two-org caller idiom but force-registers worker.* via QA_DEFAULT_ORG_ID and stubs evaluate() enabled via importOriginal (preserves buildFlagBag that root.ts needs at load)"
    - "Structural tenant-invariant guard: read tenant.ts as text and assert 'Worker' is absent from the globalModels block (no private export needed)"

key-files:
  created:
    - packages/api/src/__tests__/worker-tenant-isolation.test.ts
  modified:
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/auth/src/__tests__/roles.test.ts
    - packages/auth/src/__tests__/role-permission-matrix.test.ts
    - packages/auth/src/__tests__/permissions.test.ts
    - .planning/brain/wiki/patterns/rbac-permissions.md
    - .planning/brain/wiki/log.md

key-decisions:
  - "HR role names reconciled to snake_case (hr_admin/hr_manager/payroll_officer/leave_approver). CONTEXT/REQUIREMENTS list them UPPER_SNAKE (HR_ADMIN etc.); the codebase keys every role snake_case (finance_admin, it_admin) and the RoleName union derives from those keys, so snake_case is the deliberate convention match."
  - "employee resource carries an `approve_leave` action so leave_approver holds a meaningful HR-only action distinct from plain read; hr_admin gets full employee CRUD + approve_leave."
  - "owner allPermissions const left byte-identical (D-08): employee is HR-only and intentionally not granted to owner. The owner-coverage test now skips employee the same way it already skips the platform-only admin:boe-rate."
  - "Routers NOT modified this plan. The worker/employee routers already enforce requirePermission(contractor:read) + assertWorkforceEnabled + tenant scope (89-04). The employee resource is the per-type surface for HR-only FIELDS that the Phase-90 employee profile will consume; wiring employeeRouter to employee:read would expand beyond the plan's files_modified allowlist and risk the contractor-shape / workforce-flag snapshots. Kept additive."

patterns-established:
  - "Pattern: a new RBAC resource that should NOT reach owner is added to accessControlStatement only (not to the owner allPermissions duplicate), and the owner-coverage test skips it explicitly."
  - "Pattern: cross-org leak test for a flag-gated namespace = set QA_DEFAULT_ORG_ID before importing ../root + importOriginal-mock feature-flags with evaluate() enabled."

requirements-completed: [WORKER-03, WORKER-04]

# Metrics
duration: ~12min
completed: 2026-06-22
---

# Phase 89 Plan 05: Worker per-type RBAC + HR roles + tenant leak test Summary

**A new HR-only `employee` RBAC resource and four narrow HR roles (`hr_admin`, `hr_manager`, `payroll_officer`, `leave_approver`) — each granting only `employee` (+ a narrow `contractor:read`) and never a contractor mutation (BFLA fence) — with the 10 pre-existing roles proven byte-identical and a Worker cross-org leak regression that proves an ORG_A caller never sees an ORG_B Worker row (the tenant-owning invariant on the new Worker base table).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files:** 1 created + 7 modified

## Accomplishments

- **Per-type RBAC resource (WORKER-04):** added `employee: ['create','read','update','delete','approve_leave']` to `accessControlStatement` in `permissions.ts`, after `contractorPii`. It is a distinct resource from `contractor` so HR-only fields gate independently and HR roles cannot widen contractor access. The `Resource` / `ActionsFor` / `Permission` types derive from the statement, so `requirePermission({ employee: [...] })` is now type-valid for the Phase-90 employee surface.
- **Four HR roles (WORKER-04):** `hr_admin` (full employee CRUD + `approve_leave`, + `contractor:read` and team/project/costCenter read for shared worker context), `hr_manager` (`employee:read`/`update` + the same read context), `payroll_officer` (`employee:read` + `payment:read` + `report:read,export`), `leave_approver` (`employee:read` + `approve_leave`). None hold any contractor mutation, `contractorPii`, `idp`, `member`, or `organization`, and any `payment` grant is read-only.
- **Existing-roles-byte-identical regression (WORKER-04):** `role-permission-matrix.test.ts` now freezes the exact grant for all 14 roles; `roles.test.ts` proves the 10 pre-existing role names are unchanged (none removed/renamed), that the HR roles exist with the documented grants, the contractor-mutation fence holds, and `permissions.test.ts` lists `employee` in the expected-resource set. The duplicated `owner` `allPermissions` const (roles.ts:18-42) is byte-identical (verified by diff).
- **Worker cross-org leak test (WORKER-03):** `worker-tenant-isolation.test.ts` clones the tenant-isolation two-org caller idiom (ORG_A / ORG_B callers via `createCallerFactory`). It proves `worker.list` for ORG_A returns only ORG_A workers (never an ORG_B row), `worker.getById` for a foreign id returns `null`, the `where` always carries the caller `organizationId`, and concurrent callers keep independent scoping. A structural guard reads `tenant.ts` and asserts `Worker` is absent from `globalModels` (so `withTenantScope` injects org scope on every Worker read).

## Task Commits

1. **Task 1: employee resource + 4 HR roles + existing-roles-byte-identical regression** — `a1f9eebf6` (feat)
2. **Task 2: Worker cross-org leak test** — `635cc77e7` (test)

## Verification

- `pnpm --filter @contractor-ops/auth test` → **241 passed** (11 files) — up from 218; includes the 4-HR-role assertions, BFLA fence, employee-resource presence, and the role-set freeze.
- `pnpm --filter @contractor-ops/auth typecheck` → GREEN (RoleName union extended; Permission type derives `employee`).
- `pnpm --filter @contractor-ops/api typecheck` → GREEN.
- `pnpm --filter @contractor-ops/api exec vitest run worker-tenant-isolation` → **7 passed**.
- `pnpm --filter @contractor-ops/api exec vitest run worker-tenant-isolation workforce-flag contractor-contract-snapshot tenant-isolation` → **85 passed | 1 skipped** — the contractor route-shape snapshot and the flag-off proof stay GREEN alongside the new test.
- `grep -q "employee:" permissions.ts` / `grep -Eq "hr_admin|hr_manager|payroll_officer|leave_approver" roles.ts` → OK.
- `pnpm lint:no-breadcrumbs` → OK (touched files clean).
- `pnpm check:wiki-brain` → 0 errors (rbac-permissions page documents the resource + 14 roles + HR fence; auth files added to its verify_with; BM25 rebuilt).

## Decisions Made

- **snake_case reconciliation.** CONTEXT/REQUIREMENTS name the roles UPPER_SNAKE; the codebase keys every role snake_case and the `RoleName` union derives from those keys. The roles were added as `hr_admin` / `hr_manager` / `payroll_officer` / `leave_approver` to match the convention — the documented deviation from the requirement's casing.
- **owner does not gain `employee`.** The `owner` grant is sourced from the duplicated `allPermissions` const, which D-08 says to leave untouched. `employee` is HR-only and deliberately not granted to owner; the owner-coverage test now skips `employee` exactly as it already skips the platform-only `admin:boe-rate`.
- **Robust regression over a brittle inline snapshot.** The first draft froze all existing grants in an inline snapshot; that depends on Vitest's exact key serialization order. Replaced with the explicit per-role matrix freeze (`role-permission-matrix.test.ts`, order-independent) plus a role-set-unchanged guard in `roles.test.ts`.
- **Routers left additive.** The worker/employee routers already gate on `contractor:read` + `assertWorkforceEnabled` + tenant scope (89-04). The `employee` resource is the per-type surface for HR-only fields the Phase-90 employee profile consumes; rewiring the routers now would exceed the plan's `files_modified` allowlist and risk the contractor-shape snapshot. The HR roles are real, assignable platform roles via the RBAC layer; wiring them into the member-invitation dropdown (`packages/validators/src/roles.ts`) is a later workforce-phase concern while the surface is dark.

## Deviations from Plan

- **[Plan-permitted — naming]** Role keys reconciled UPPER_SNAKE → snake_case, as the plan's interface note explicitly directed ("match the existing convention unless a deliberate deviation is recorded").
- **[Plan-permitted — Claude's discretion]** The `employee` action set includes `approve_leave` (the plan left the action set to discretion) so `leave_approver` carries a real HR-only action.
- **[Out-of-scope, deferred]** `invitableMemberRoleValues` (`packages/validators/src/roles.ts`) was NOT extended with the HR roles — the member-invitation dropdown surface is out of this plan's scope and the workforce surface is dark behind `module.workforce-employees`. No `deferred-items.md` entry needed (intentional scope fence, documented above).

No Rule 1-4 auto-fix deviations were triggered.

## Known Stubs

None. The `employee` resource + roles are fully wired into the RBAC statement and asserted; the leak test is GREEN. The resource is intentionally consumed by the future employee profile surface (Phase 90) — that is a forward dependency, not a stub.

## In-Flight File Handling

The working tree carried unrelated in-flight edits on `main` (`apps/web-vite/src/components/contractors/*`, `apps/web-vite/messages/*.json` with a `needsAction` key, an untracked `contractors/insights/proportion-bar.tsx`, and several `.planning/brain/wiki` pages). None were touched: each commit staged only this plan's own files individually (no `git add -A`/`.`), and the in-flight set was verified present and unstaged after both commits (the `needsAction` hunk in `messages/en.json` is intact). The two wiki pages this plan edited (`rbac-permissions.md`, `log.md`) were clean before the session, so their changes are entirely this plan's.

## Self-Check: PASSED

- Created files exist: `worker-tenant-isolation.test.ts`, `89-05-SUMMARY.md`, plus modified `permissions.ts` / `roles.ts` — all FOUND.
- Commits exist: `a1f9eebf6` (Task 1 feat), `635cc77e7` (Task 2 test) — both FOUND in git log.
- SUMMARY reachable via both the real `milestones/v7.0-phases/...` path and the `.planning/phases/...` symlink.
