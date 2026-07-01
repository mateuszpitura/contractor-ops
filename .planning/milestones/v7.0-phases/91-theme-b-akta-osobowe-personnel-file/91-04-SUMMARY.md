---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 04
subsystem: auth
tags: [rbac, better-auth, access-control, personnel-file, bfla, permissions]

# Dependency graph
requires:
  - phase: 91-01
    provides: personnel-file-rbac RED structural test pinning the section→role matrix
  - phase: 89
    provides: the 4 worker-model HR roles (hr_admin, hr_manager, payroll_officer, leave_approver) + employee/employeePii resources + owner allPermissions BFLA fence
provides:
  - Resource-per-section RBAC grain: employeeFileA..D each grant [read, write] on the Better-Auth access control statement
  - Per-section role matrix wired into the 4 HR roles (payroll reaches pay/C without discipline/B)
  - Owner BFLA fence preserved — employeeFileA..D kept out of allPermissions so owner holds no section
affects: [91-07 personnel-file router (requirePermission + per-section check), 91-12 wiki synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resource-per-section RBAC: one Better-Auth resource per personnel-file section (A..D) rather than attribute-layer filtering — Permission/Resource/requirePermission/permissionToScopes all adapt for free since they derive from the statement"
    - "BFLA fence via deliberate absence: HR-only resources (employee, employeeFileA..D) are omitted from the owner allPermissions duplicate; the absence IS the control"

key-files:
  created: []
  modified:
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/auth/src/__tests__/permissions.test.ts
    - packages/auth/src/__tests__/roles.test.ts
    - packages/auth/src/__tests__/role-permission-matrix.test.ts

key-decisions:
  - "Resource-per-section (employeeFileA..D) over an attribute layer — drops into the existing Permission/requirePermission/scope flow without touching those types"
  - "employeeFileA..D deliberately excluded from allPermissions so owner is never auto-granted a section (BFLA fence), mirroring the existing employee carve-out"
  - "Least-privilege matrix: payroll_officer C-read only, leave_approver A-read only; no contractor role gains any section"

patterns-established:
  - "Per-section personnel-file access is decided at the permission layer, section-by-section, not by app-level row filtering"
  - "New HR-only resources are added to accessControlStatement + the specific HR roles, and MUST NOT be synced into the owner allPermissions duplicate"

requirements-completed: [AKTA-01]

# Metrics
duration: 13min
completed: 2026-07-01
---

# Phase 91 Plan 04: Per-Section Personnel-File RBAC Grain Summary

**Resource-per-section RBAC (employeeFileA..D, each read+write) wired into the 4 HR roles — payroll sees pay (C) without discipline (B), and the owner BFLA fence holds — turning the 91-01 personnel-file-rbac RED scaffold GREEN.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-01T09:19Z
- **Completed:** 2026-07-01T09:32Z
- **Tasks:** 2
- **Files modified:** 5 (2 source + 3 mirror tests)

## Accomplishments
- Added `employeeFileA`, `employeeFileB`, `employeeFileC`, `employeeFileD` (each `[read, write]`) to the Better-Auth `accessControlStatement` — access is now decided per personnel-file section at the permission layer.
- Wired the reviewer-verified matrix into the 4 HR roles: `hr_admin` A/B/C/D read+write; `hr_manager` A/B/D read+write + C read-only; `payroll_officer` C read-only; `leave_approver` A read-only.
- Preserved the P89 BFLA fence: `employeeFileA..D` were intentionally kept out of the `allPermissions` owner duplicate, so `owner` holds no section (mirrors the existing `employee` carve-out). No contractor role gained any section or any contractor mutation.
- Turned the 91-01 `personnel-file-rbac.test.ts` RED scaffold fully GREEN; the whole `@contractor-ops/auth` suite passes (278 tests) and the package typechecks clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: add employeeFileA..D resources to the access control statement** - `5b88e8f00` (feat)
2. **Task 2: wire the section matrix into the 4 HR roles; preserve the owner BFLA fence** - `d33bb1027` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `packages/auth/src/permissions.ts` - +4 section resources (`employeeFileA..D`, each `[read, write]`) on `accessControlStatement`; `Permission`/`Resource` derived types pick them up automatically.
- `packages/auth/src/roles.ts` - section→role matrix on the 4 HR roles; `allPermissions` comment clarified to name the deliberate HR-only exclusion (employee + employeeFileA..D) as the fence, not drift.
- `packages/auth/src/__tests__/permissions.test.ts` - synced the resource-mirror list (added the 4 sections + the previously-omitted `employeePii`) to keep the exact-key/length assertion green.
- `packages/auth/src/__tests__/roles.test.ts` - excluded `employeeFile*` from the owner-mirrors-statement guard, matching the existing HR-only `employee` carve-out.
- `packages/auth/src/__tests__/role-permission-matrix.test.ts` - added the 4 HR-role section grants to the EXPECTED matrix + the coupled `employeePii` on owner/admin/hr_admin.

## Decisions Made
- **Resource-per-section over attribute layer.** The RED scaffold and RESEARCH both point to one resource per section. Verified it drops into the existing `Permission` type, `requirePermission`, the AC statement, and `permissionToScopes` for free (all derive from the statement / iterate dynamically), whereas an attribute layer would force changes to all four.
- **Owner never auto-granted a section.** `employeeFileA..D` stay out of `allPermissions`; the absence is the BFLA control, asserted structurally by both `personnel-file-rbac.test.ts` and the matrix test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Synced two mirror tests broken by the statement/role edits (incl. pre-existing employeePii drift)**
- **Found during:** Task 1 and Task 2
- **Issue:** `permissions.test.ts` (exact resource-key list + length) and `role-permission-matrix.test.ts` ("no extra resource" per role) are hand-maintained mirrors of the exact files this plan edits. Adding the 4 resources/grants breaks them. Both mirrors were also already RED on main because `employeePii` (added in P89) was never added to them — a pre-existing drift that is unavoidably coupled to the same length/"no-extra-resource" assertions I had to make green.
- **Fix:** Added `employeeFileA..D` (and `employeePii`) to `permissions.test.ts`; added the 4 HR-role section grants (and the coupled `employeePii` on owner/admin/hr_admin) to the matrix EXPECTED map; excluded `employeeFile*` from the owner-mirror guard in `roles.test.ts`.
- **Files modified:** `permissions.test.ts`, `roles.test.ts`, `role-permission-matrix.test.ts`
- **Verification:** Full auth suite green — baseline 18 failed → 0 failed (278 passed); auth `typecheck` clean.
- **Committed in:** `5b88e8f00` (Task 1: permissions.test.ts, roles.test.ts) and `d33bb1027` (Task 2: role-permission-matrix.test.ts)

---

**Total deviations:** 1 auto-fixed (Rule 1 — keep the statement/role mirror tests green; includes coupled pre-existing employeePii drift in the same assertions).
**Impact on plan:** Necessary to satisfy the plan's own acceptance criteria ("personnel-file-rbac GREEN" + "existing matrix test still passes"). No scope creep — all edits are within the two source files named in the plan and their dedicated mirror tests.

## Issues Encountered
- **Fresh worktree had no `node_modules`.** Ran `pnpm install --frozen-lockfile` (materializes from the existing lockfile — no new downloads, no release-age concern). Its postinstall `turbo build` failed on a pre-existing broken test-file compile in `@contractor-ops/classification` (`../rule-set.js` / `../scoring.js` not found), which cascaded to skip `@contractor-ops/integrations`; dependency linking itself completed. Built `integrations` directly to run a clean downstream check.
- **`@contractor-ops/api` typecheck fails — pre-existing, NOT from this change.** With `integrations` built, every remaining api error is in `classification` / `pdf-templates` land (unbuilt classification `dist`; `possibly undefined` pills in `drv-defense-bundle.tsx`/`ir35-sds.tsx`; missing `US_DETERMINATION_LETTER` in `classification-document-keys.ts`). **Zero** errors reference `Permission`, `Resource`, `employeeFile`, `accessControlStatement`, or `roles` — confirming the additive RBAC change is type-safe for consumers (`permissionToScopes` iterates dynamically; `Permission` is a partial record; no exhaustive `Record<Resource,…>` exists). Logged to `deferred-items.md` (91-04). Out of scope for this auth-only plan.
- **`lint:no-breadcrumbs`** flags 4 pre-existing decision-ID comments in files this plan never touched (pdf-template + service tests + classification scoring test). The comments this plan added are clean. Logged to `deferred-items.md`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Permission-layer grain is ready for **91-07** (personnel-file router) to consume via `requirePermission` + a per-section programmatic check.
- **91-12** (wiki synthesis) must document the per-section RBAC grain + BFLA fence on `.planning/brain/wiki/patterns/rbac-permissions.md` (it lists `permissions.ts` + `roles.ts` under `verify_with`); deferred here per the phase-89 (89-06) pattern.

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*

## Self-Check: PASSED
- All 5 modified source/test files present on disk.
- Both task commits present in git history (`5b88e8f00`, `d33bb1027`).
- `personnel-file-rbac.test.ts` GREEN; full `@contractor-ops/auth` suite: 278 passed, 0 failed; auth typecheck clean.
- `allPermissions` (owner) holds no `employeeFile*` key — BFLA fence intact.
