---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 07
subsystem: personnel-file
tags: [personnel-file, akta-osobowe, trpc, rbac, bfla, tenant-isolation, retention, feature-flags]

# Dependency graph
requires:
  - phase: 91-01
    provides: personnel-file-rbac-router.test.ts + personnel-file-tenant-isolation.test.ts RED scaffolds (response shape + BFLA/leak contracts)
  - phase: 91-02
    provides: PersonnelFile / PersonnelFileDocument Prisma models + PersonnelFileSection enum
  - phase: 91-04
    provides: employeeFileA..D per-section access-control resources wired into the 4 HR roles (the matrix this router enforces)
  - phase: 91-05
    provides: getPersonnelRetentionCutoff event-anchored resolver (@contractor-ops/db)
provides:
  - Flag-gated personnelFile router mounted in workforceRouters (module.workforce-employees) with getFile + getRetentionSummary
  - hasSectionPermission(ctx, section) — permission-layer per-section gate (apiKey scopes + session role statements), decided BEFORE querying
  - Empty classifyRouter / erasureRouter stubs so 91-08 / 91-09 fill their own files without touching index.ts
affects: [91-08 classify sub-router, 91-09 erasure sub-router, web-vite personnel-file surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-section BFLA gate at the permission layer: hasSectionPermission decides lock BEFORE the document store is touched; a locked section returns retention posture with NO document payload/count — never fetch-all-then-filter"
    - "Section role evaluation mirrors auth-permissions.ts: server-side session role (activeRole ?? user.role) -> roles[role].statements[employeeFileX].includes('read'); client cannot override the role used for the lookup"
    - "Cross-org read resolves to null (no existence oracle, no throw) via tenant-scoped findFirst { workerId, organizationId: ctx.organizationId }"
    - "Representative documentDate resolved from a section's own rows (latest of documentDate ?? Document.createdAt) so DOCUMENT_DATE-anchored retention matches the per-document erasure math — never a hardcoded null"

key-files:
  created:
    - packages/api/src/routers/core/personnel-file/section-access.ts
    - packages/api/src/routers/core/personnel-file/classify.ts
    - packages/api/src/routers/core/personnel-file/erasure.ts
    - packages/api/src/routers/core/personnel-file/read.ts
    - packages/api/src/routers/core/personnel-file/index.ts
  modified:
    - packages/api/src/root.ts
    - packages/api/src/__tests__/personnel-file-rbac-router.test.ts
    - packages/api/src/__tests__/personnel-file-tenant-isolation.test.ts

key-decisions:
  - "Per-section gate evaluates the REAL access-control role statements locally (mirroring the shipped auth-permissions.ts) rather than authApi.hasPermission — the RED scaffold mocks authApi.hasPermission always-true, so role differentiation cannot come from it; the role-statements read is the SAME permission layer requirePermission enforces, decided before any document query"
  - "getFile returns null (not a thrown NOT_FOUND) for a missing/cross-org file — the authoritative tenant-isolation scaffold asserts result === null (a thrown NOT_FOUND would reject the caller, never yield null); null also avoids an existence oracle"
  - "Response section identifier is the short code A..D (the RBAC scaffold reads s.id), not the SECTION_A enum"
  - "Commit grouping: index.ts + root.ts landed with read.ts (commit 2) rather than the section-access commit (commit 1), so each commit is independently buildable (index imports read)"

patterns-established:
  - "A new gated worker-model namespace is added by one property in the workforceRouters const + one core import in root.ts; it inherits the isWorkforceRegistered() spread and per-request assertWorkforceEnabled without touching the appRouter body"
  - "Personnel-file section sub-routers live in routers/core/personnel-file/{read,classify,erasure}.ts merged via mergeRouters in index.ts"

requirements-completed: [AKTA-01, AKTA-02]

# Metrics
duration: ~45min
completed: 2026-07-01
---

# Phase 91 Plan 07: Personnel-File Router Foundation Summary

**A flag-gated `personnelFile` router mounted in `workforceRouters` with a per-section `getFile` that decides each section's lock at the permission layer (real employeeFileA..D role statements) BEFORE querying — a locked section returns its retention posture with no document payload, cross-org reads resolve to null — plus a `getRetentionSummary` panel and empty classify/erasure stubs; turns the 91-01 rbac-router (3/3) + tenant-isolation (3/3) scaffolds GREEN.**

## Performance
- **Duration:** ~45 min (incl. fresh-worktree `pnpm install` + turbo build)
- **Completed:** 2026-07-01
- **Tasks:** 2 (2 atomic commits)
- **Files:** 8 (5 created, 3 modified)

## Accomplishments
- `hasSectionPermission(ctx, section)` (section-access.ts): a boolean permission-layer gate that maps `SECTION_A..D → employeeFileA..D`. The API-key branch checks the section's `read` scope against the key scopes; the session branch resolves the server-side role (`activeRole ?? user.role`) and reads `roles[role].statements[resource]` — the SAME access-control statements `requirePermission` enforces, evaluated as a boolean so the read decides which sections to query. Never throws.
- `getFile` (read.ts): loads the `PersonnelFile` via a tenant-scoped `findFirst { workerId, organizationId: ctx.organizationId, deletedAt: null }` (client `organizationId` never trusted; cross-org / missing → `null`). For each of the 4 server-fixed sections it decides lock via `hasSectionPermission` BEFORE touching the document store — a locked section returns `{ id, status:'locked', retention }` with no `documents`/count; an unlocked section also returns its `documents`. This realizes "only query the sections the caller may read" rather than "return all then hide some".
- Retention posture per section from `getPersonnelRetentionCutoff`, with a representative `documentDate` resolved from the section's own rows (latest of `documentDate ?? Document.createdAt`; `null` only when the section is empty) so a DOCUMENT_DATE-anchored window (e.g. DE accident records) shows a real cutoff consistent with 91-09's erasure math — never a hardcoded null.
- `getRetentionSummary`: a page-level panel returning every section's retention posture WITHOUT documents (locked sections resolve their representative date server-side, so the summary stays accurate without leaking document presence).
- `classifyRouter` + `erasureRouter` empty routers; `index.ts` merges read+classify+erasure into `personnelFileRouter` so 91-08 / 91-09 fill their files without touching the index.
- `root.ts`: exactly one import + one `workforceRouters` property (`personnelFile: personnelFileRouter`) — inherits the `isWorkforceRegistered()` conditional spread + per-request `assertWorkforceEnabled`; router is absent when the flag is off.

## Task Commits
1. **Task 1 — section-access helper + classify/erasure stubs** — `4dd0ba2c3` (feat)
2. **Task 2 — getFile per-section read + index + root mount + RED→GREEN test wiring** — `90db205bc` (feat)

**Plan metadata:** this SUMMARY committed separately at the real milestones path.

## Files Created/Modified
- `packages/api/src/routers/core/personnel-file/section-access.ts` (new) — `hasSectionPermission`, `sectionToResource`, `sectionToShortCode`, `PERSONNEL_FILE_SECTIONS`.
- `packages/api/src/routers/core/personnel-file/read.ts` (new) — `readRouter` with `getFile` + `getRetentionSummary`, retention + representative-date helpers.
- `packages/api/src/routers/core/personnel-file/classify.ts` / `erasure.ts` (new) — empty routers for 91-08 / 91-09.
- `packages/api/src/routers/core/personnel-file/index.ts` (new) — `personnelFileRouter = mergeRouters(read, classify, erasure)`.
- `packages/api/src/root.ts` — one import + one `workforceRouters` property (additive, no reorder of the usExpansion block or appRouter body).
- `packages/api/src/__tests__/personnel-file-rbac-router.test.ts` / `personnel-file-tenant-isolation.test.ts` — mock extensions (see Deviations).

## Decisions Made
- **Local role-statements evaluation over `authApi.hasPermission` for the section gate.** The authoritative RED scaffold mocks `authApi.hasPermission` to always-`{ success: true }`, so per-role section differentiation (payroll→C not B, owner→none) cannot come from it. The gate therefore reads the server-side session role and evaluates `roles[role].statements` — the exact pattern the shipped `auth-permissions.ts` already uses ("server-side derivation only — client cannot override the role"). This is still a permission-layer decision made before any document query (satisfies D-02 / T-91-07-01), and the getFile procedure itself remains gated by `requirePermission({ employee:['read'] })`.
- **`getFile` returns `null`, not a thrown `NOT_FOUND`.** `personnel-file-tenant-isolation.test.ts` asserts `expect(result).toBeNull()`; a thrown `NOT_FOUND` would reject the caller and never yield a null value. Returning null also avoids an existence oracle across orgs.
- **Section id = short code `A..D`.** The RBAC scaffold looks sections up by `s.id ∈ {A,B,C,D}`; the response uses the short code, with `sectionToResource`/`sectionToShortCode` keeping the enum↔code↔resource mapping in one place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended the two RED scaffolds' mocks so the router's real dependencies resolve**
- **Found during:** Task 2 (running the scaffolds).
- **Issue:** Both scaffolds mock `@contractor-ops/auth` down to `{ auth, authApi }` (stripping the real `roles` matrix) and mock `@contractor-ops/db` without `getPersonnelRetentionCutoff`. The section gate needs the real `roles` statements to differentiate roles (the always-true `hasPermission` mock cannot), and getFile calls the retention resolver on every section.
- **Fix:** Changed each `@contractor-ops/auth` mock to `async importOriginal` and spread `...actual` (exposing the real `roles`/`ac`) while keeping `auth`/`authApi` stubbed; added a `getPersonnelRetentionCutoff` stub to each `@contractor-ops/db` mock. No assertions were changed — the RBAC test now enforces the REAL 91-04 matrix. Loading real auth in the test is safe (auth env only throws in `production`; vitest runs `test`, and `@contractor-ops/db` stays mocked so no real prisma).
- **Files:** `personnel-file-rbac-router.test.ts`, `personnel-file-tenant-isolation.test.ts`
- **Commit:** `90db205bc`

**2. [Rule 1 - Contract] `getFile` returns null instead of the plan's "NOT_FOUND throw"**
- **Found during:** Task 2 (tenant-isolation assertion `result === null`).
- **Fix:** Return `null` for a missing/cross-org file (authoritative scaffold contract; also avoids an existence oracle). Documented under Decisions.
- **Commit:** `90db205bc`

**3. [Rule 3 - Blocking] Commit grouping — index.ts + root.ts landed with read.ts**
- **Issue:** The plan lists index.ts + root.ts under Task 1, but `index.ts` imports `readRouter` from Task 2's `read.ts`; committing them in Task 1 would produce a non-buildable commit.
- **Fix:** Committed index.ts + root.ts alongside read.ts (commit 2) so each commit is independently buildable. All planned files delivered.

**Total:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 1 contract). No architectural (Rule 4) decisions.

## Deferred / Out of Scope
- **Pre-existing `@contractor-ops/api` typecheck cascade (NOT this plan):** the unbuilt-`classification` cascade hits untouched files (`ocr-extraction.ts`, `pdf-templates/*`, `classification-document-keys.ts`) — the documented `deferred-items.md` offenders. My 5 new router files + `root.ts` add ZERO typecheck errors (verified: no error references `personnel-file/`, `section-access`, or `root.ts`).
- **Pre-existing `lint:no-breadcrumbs` failures (NOT this plan):** 3 decision-ID comments in `pdf-templates/__tests__` + `services/__tests__` (form-1042s, form-1099k-tracker) — files this plan never touched. My files are breadcrumb-clean; `lint:logs` + `lint:audit-log` PASS.
- **Wiki synthesis:** the new personnel-file router surface is batched into the phase's dedicated wiki plan (mirrors 89-06 / 91-03..06). New files are not referenced by any wiki `verify_with`, so `check:wiki-brain` is not tripped.

## Known Stubs
- `classifyRouter` / `erasureRouter` are intentionally empty routers, documented for 91-08 (classify) and 91-09 (erasure) to fill. They are named in this plan's scope as stubs; `personnelFile.getFile` + `getRetentionSummary` are fully wired.

## Threat Flags
None — all new surface (per-section read, cross-org scope, section gate) is in the plan's `<threat_model>` (T-91-07-01 BFLA, T-91-07-02 IDOR, T-91-07-03 tampering) and is mitigated (permission-layer gate before query; tenant-scoped findFirst; Zod `.strict()` input + server-fixed section list + per-request `assertWorkforceEnabled`).

## Verification
- `pnpm --filter @contractor-ops/api test personnel-file-rbac-router.test.ts personnel-file-tenant-isolation.test.ts` — GREEN, 6/6 (payroll→B locked no docs; hr_admin→B unlocked with docs; owner→all four locked; ORG_A→ORG_B workerId returns null; ORG_A→own returns the ORG_A file; globalModels structural guard).
- `pnpm --filter @contractor-ops/api typecheck` — zero errors in my new files or `root.ts` (only the pre-existing classification cascade remains).
- `lint:no-breadcrumbs` clean for my files; `lint:logs` PASS; `lint:audit-log` PASS.

## Next Phase Readiness
- **91-08 (classify):** fill `classify.ts` (classifyRouter) — `classifyPersonnelDocument` seam from 91-06 is ready; index.ts already merges it.
- **91-09 (erasure):** fill `erasure.ts` (erasureRouter) — `getPersonnelRetentionCutoff` resolves per-section holds; `personnel-erasure.test.ts` (requestErasure) stays terminal-RED until then.
- **web-vite:** `personnelFile.getFile` returns per-section `{ id, status, documents?, retention }` + `employmentActive`/`terminatedAt`; `getRetentionSummary` feeds the page-level retention panel.

## Self-Check: PASSED
- All 5 created router files present on disk; `root.ts` + 2 test files modified.
- Both task commits present (`4dd0ba2c3`, `90db205bc`).
- Target tests GREEN 6/6; my files typecheck clean; breadcrumb/logs/audit-log gates clean for my files.
- `root.ts` mounts `personnelFile` in `workforceRouters` (line 179) + import (line 56); no STATE.md / ROADMAP.md edits.

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
