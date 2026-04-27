---
phase: 74
plan: 03
subsystem: auth
tags: [rbac, permission, owner-only, table-test]
requires: [74-01]
provides:
  - "workflow:override_blocking_task action registered in accessControlStatement"
  - "owner-only grant of override_blocking_task in roles.ts"
  - "GREEN table-test for OWNER-only invariant (Pitfall 2 regression guard)"
affects:
  - packages/auth/src/permissions.ts
  - packages/auth/src/roles.ts
  - packages/auth/src/__tests__/permissions-override-blocking-task.test.ts
  - packages/auth/src/__tests__/roles.test.ts (Phase 74 awareness fix)
tech-stack:
  added: []
  patterns:
    - "table-driven RBAC test via vitest it.each — single source of truth role list"
    - "Per-role role.statements.workflow.includes() introspection (Option A from Plan 74-03)"
key-files:
  created: []
  modified:
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/auth/src/__tests__/permissions-override-blocking-task.test.ts
    - packages/auth/src/__tests__/roles.test.ts
key-decisions:
  - "Used Option A (direct role.statements.workflow.includes) per Plan 74-03 — Better Auth v1.5.5 exposes role statements directly; no need for the auth.api.hasPermission integration fallback."
  - "Roles.test.ts 'admin matches owner' invariant updated to honour the new owner-vs-admin asymmetry — admin and owner remain identical on every resource EXCEPT the new override_blocking_task action."
  - "roleNames list in roles.test.ts extended from 9 to 10 to include platform_operator (closing a pre-existing test fixture mismatch)."
requirements-completed: [OFFB-07, OFFB-10]
duration: "5 min"
completed: 2026-04-27
---

# Phase 74 Plan 03: OWNER-only Override Permission + Pitfall 2 Regression Test Summary

Registered `workflow:override_blocking_task` in Better Auth's `accessControlStatement` (single addition to the existing `workflow` actions list), granted it to the `owner` role only via the shared `allPermissions` object in `roles.ts`, and replaced the Wave 0 RED test scaffold with a table-driven Vitest test that iterates all 10 lowercase role names and asserts the OWNER-only invariant — failing CI immediately if any future role-table edit accidentally widens the grant.

## Run Stats

- Duration: 5 min (start `2026-04-27T10:45:00Z` → end `2026-04-27T10:50:00Z`)
- Tasks: 3 (`feat(74-03)` x2 + `test(74-03)` x1 — 3 atomic commits)
- Files modified: 4

## Tasks Executed

| # | Name | Commit |
|---|------|--------|
| 1 | Extend accessControlStatement.workflow with override_blocking_task | `d3d668c1` |
| 2 | Grant override_blocking_task to owner role only (D-09) | `269c5ce4` |
| 3 | GREEN OWNER-only override permission table-test | `5fd85ad1` |

## Test Strategy

**Option chosen: A (direct role.statements introspection)** — Researcher Assumption A1 was verified true: Better Auth v1.5.5's `ac.newRole({...})` returns an object whose `statements` property is the literal-as-passed permission map. The test reads `role.statements.workflow` and asserts `.includes('override_blocking_task')` against the expected boolean per role. No need for the auth.api.hasPermission integration fallback (Option B).

## Occurrence Counts

| File | `override_blocking_task` count | Why |
|------|--------------------------------|-----|
| packages/auth/src/permissions.ts | 1 | Single addition to `accessControlStatement.workflow` array |
| packages/auth/src/roles.ts | 1 | Single addition to `allPermissions.workflow` (consumed only by the `owner` role) |
| packages/auth/src/__tests__/permissions-override-blocking-task.test.ts | 8 | Test file itself: comments + assertions + the Pitfall 2 invariant test |

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @contractor-ops/auth typecheck` | exit 0 |
| `pnpm vitest run src/__tests__/permissions-override-blocking-task.test.ts` | 11/11 pass (10 it.each + 1 invariant) |
| `grep -c "override_blocking_task" packages/auth/src/permissions.ts` | 1 |
| `grep -c "override_blocking_task" packages/auth/src/roles.ts` | 1 |
| `pnpm lint:logs` | exit 0 |

## Roles Test Update (Scope-Adjacent Fix)

The existing `packages/auth/src/__tests__/roles.test.ts > admin matches owner` test asserted `roles.admin.statements === roles.owner.statements` — an invariant that Phase 74 intentionally breaks by introducing an OWNER-only action. Updated the test to honour the new asymmetry:

- For every resource EXCEPT `workflow`: admin still matches owner exactly.
- For `workflow`: admin's set is owner's set MINUS `override_blocking_task`.

Also extended the test's `roleNames` constant from 9 to 10 entries (added `platform_operator`) — this closes a pre-existing test fixture mismatch (`Object.keys(roles).length === 10` but the constant only listed 9). Per Rule 1 (auto-fix when current task forces the issue), this update lands as part of Plan 74-03.

## Deviations from Plan

**[Rule 1 — Test fixture sync] roles.test.ts updated to honour the new owner-vs-admin asymmetry.**
Found during: Task 2 verification.
Issue: Plan called out only `permissions-override-blocking-task.test.ts`; the existing `roles.test.ts` had two assertions that the new owner-only grant intentionally breaks (`admin matches owner` deep-equal, and a 9-vs-10 `roleNames` list mismatch).
Fix: Updated both — admin/owner test now distinguishes the workflow asymmetry, and `roleNames` gained `platform_operator`. The other two pre-existing failures in `permissions.test.ts` and `roles.test.ts` (both `admin:boe-rate`-related) are NOT addressed — they're outside Phase 74's scope per the scope-boundary rule.
Files: `packages/auth/src/__tests__/roles.test.ts`.
Verification: `auth` test suite went from 3 pre-existing failures to 2 (the admin/owner mismatch is resolved; the 9-vs-10 list mismatch is resolved; the two `admin:boe-rate` failures remain pre-existing).
Commit: `269c5ce4`.

**Total deviations:** 1 auto-fixed (Rule 1 — Test fixture sync). **Impact:** None on downstream plans — the override permission contract is intact and the Pitfall 2 regression guard fires correctly.

## Issues Encountered

Two pre-existing test failures in `packages/auth` remain after Plan 74-03 — both unrelated to the override permission and both pre-dating Phase 74:

1. `packages/auth/src/__tests__/permissions.test.ts > defines all expected resources with non-empty action lists` — the `expectedResources` array in the test fixture omits `'admin:boe-rate'` (which IS defined in `accessControlStatement`), so `keys.length` (15) ≠ `expectedResources.length` (14).
2. `packages/auth/src/__tests__/roles.test.ts > owner matches the full access control statement` — `accessControlStatement['admin:boe-rate']` is `['read', 'write']` but `allPermissions['admin:boe-rate']` is `['write']` only (deliberate, per the `roles.ts` file comment: "owner intentionally NOT granted read on admin:boe-rate"). The test does not honour this carve-out.

Both are tracked here for future cleanup (likely a small Phase 70.x or 79.x test-fixture-sync plan).

## Next Phase Readiness

Ready for Plan 74-04 (Prisma schema migration). Plan 74-04 is `autonomous: false` — it requires a HUMAN CHECKPOINT for visual review of the generated `migration.sql` against the T-74-04 risk (unexpected DROP/RENAME columns).

Plan 74-08's `overrideBlockingTask` mutation can now safely call:
```ts
await ctx.requirePermission({ workflow: ['override_blocking_task'] });
```
and trust that only owner-role members will pass the gate. The Pitfall 2 regression test will fail CI if the grant ever leaks.
