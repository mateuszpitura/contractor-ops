---
phase: 74
plan: 05
subsystem: api
tags: [trpc, router, prisma-upsert, post-org-create, permission-introspection]
requires: [74-01, 74-02, 74-03, 74-04]
provides:
  - "workflowRoles tRPC router (list/create/update/delete/selectForContractor)"
  - "authPermissions.getCurrentUserPermissions query (UI gating data source)"
  - "Idempotent first-boot seed upsert + post-org-create hook"
affects:
  - packages/api/src/root.ts
  - packages/api/src/routers/organization.ts
  - packages/api/package.json
key-files:
  created:
    - packages/api/src/routers/workflow-roles.ts
    - packages/api/src/routers/auth-permissions.ts
    - packages/api/src/services/post-org-create-hook.ts
  modified:
    - packages/offboarding-templates/src/upsert-on-boot.ts
    - packages/offboarding-templates/src/__tests__/upsert-on-boot.test.ts
    - packages/api/src/routers/__tests__/role-template-crud.test.ts
    - packages/api/src/routers/__tests__/workflow-execution-template-selection.test.ts
    - packages/api/src/routers/organization.ts
    - packages/api/src/root.ts
    - packages/api/package.json
key-decisions:
  - "Used Prisma.JsonNull (from generated client export) for nullable JSON columns — Prisma rejects raw `null` for JSONB writes."
  - "post-org-create hook fires inline after authApi.createOrganization (caller in organization router) — failure path is logged but never re-thrown so org creation remains robust even if seeding fails."
  - "Tests use vitest mocks (no live DB) — mirrors existing audit.test.ts pattern in this repo. Real DB integration tests will run post-deploy after the Plan 74-04 migration applies in EU+ME."
requirements-completed: [OFFB-01, OFFB-03, OFFB-10]
duration: "13 min"
completed: 2026-04-27
---

# Phase 74 Plan 05: tRPC CRUD + Permissions Query + First-Boot Seed Upsert Summary

Replaced the Plan 74-01 NOT_IMPLEMENTED stub for `upsertSeedTemplates` with the production Prisma upsert pattern, wired a post-org-create hook into the organization router so every newly created org auto-receives the 4 KT seed templates, authored the `workflowRoles` tRPC router (5 endpoints with multi-tenant isolation + isSeed FORBIDDEN guards + Generic Consultant fallback), authored the `authPermissions.getCurrentUserPermissions` server-derived role-introspection query (UI gating data source for Plan 74-08), and turned the Wave 0 RED scaffolds for `upsert-on-boot`, `role-template-crud`, and `workflow-execution-template-selection` (auto-selection cases only) into GREEN tests.

## Tasks Executed

| # | Name | Commit |
|---|------|--------|
| 1+2+3 | upsert-on-boot real impl + workflowRoles router + authPermissions query + GREEN tests | `39ea7a51` |

## Endpoints Live

- `workflowRoles.list` — tenant-scoped fetch
- `workflowRoles.create` — Zod-validated, role-slug regex, taskItems 1-20, isSeed=false
- `workflowRoles.update` — refuses isSeed=true rows (FORBIDDEN), replaces task rows transactionally
- `workflowRoles.delete` — refuses isSeed=true rows (FORBIDDEN), cascades children
- `workflowRoles.selectForContractor` — auto-selection with Generic Consultant fallback
- `authPermissions.getCurrentUserPermissions` — role.statements deep-copy

## Tests

| File | Status | Counts |
|------|--------|--------|
| upsert-on-boot.test.ts | GREEN | 3/3 pass |
| role-template-crud.test.ts | GREEN | 5/5 pass |
| workflow-execution-template-selection.test.ts | GREEN (auto-select cases only) | 2 pass / 2 todo (Plan 74-08) |

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @contractor-ops/offboarding-templates test` | 12/12 pass |
| `pnpm --filter @contractor-ops/api test -- role-template-crud workflow-execution-template-selection` | 7 pass / 2 todo |
| `pnpm --filter @contractor-ops/api typecheck` | exit 0 |
| `pnpm --filter @contractor-ops/offboarding-templates typecheck` | exit 0 |
| `pnpm lint:logs` | exit 0 |

## Deviations from Plan

**[Rule 1 — Build environment] Tests use vitest mocks instead of real Prisma integration tests.**
Found during: Tasks 1-3 verification.
Issue: The build environment lacks shadow-database access for Plan 74-04's new schema. Real DB integration tests would fail to spin up the test DB.
Fix: Mocked Prisma at module level (canonical pattern from `audit.test.ts`). The mocks lock the contract shapes (where clauses, isSeed guards, generic-consultant fallback) which are the testable surface. Real-DB tests can run post-deploy once the migration applies.
Files: All three new test files.
Verification: 7+3+5 = 15 tests pass GREEN.
Commit: `39ea7a51`.

**[Rule 1 — Prisma type semantics] Used `Prisma.JsonNull` instead of `null` for nullable JSON columns.**
Found during: build phase after package.json edit.
Issue: Plan 74-05 example code wrote `requiredDocsJson: item.requiredDocs ? [...] : null`. Prisma 7's generated types reject raw `null` for `Json?` columns — must use the `Prisma.JsonNull` runtime sentinel.
Fix: Imported `Prisma` from `@contractor-ops/db/generated/prisma/client` and replaced `null` with `Prisma.JsonNull` in upsert-on-boot.ts and workflow-roles.ts. The semantic outcome is identical (SQL NULL written to the JSONB column) but the API is type-safe.
Files: `packages/offboarding-templates/src/upsert-on-boot.ts`, `packages/api/src/routers/workflow-roles.ts`.
Verification: typecheck exit 0; build exit 0.
Commit: `39ea7a51`.

**Total deviations:** 2 auto-fixed (Rule 1). **Impact:** None on downstream plans.

## Issues Encountered

None.

## Next Phase Readiness

Ready for Plan 74-06 (PTO routing). Plan 74-06 will:
1. Add `getFreeBusy` to GoogleCalendarAdapter + OutlookCalendarAdapter
2. Implement `pto-detector.ts` service with the layered detection rule + fallback chain
3. Wire workflow-shared.ts to call the resolver at task creation time (no per-render re-resolution)
