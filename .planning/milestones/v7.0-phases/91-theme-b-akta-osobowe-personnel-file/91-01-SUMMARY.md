---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 01
subsystem: testing
tags: [vitest, tdd, red-scaffold, rbac, retention, gdpr, personnel-file, tenant-isolation, classifier]

# Dependency graph
requires:
  - phase: 89-theme-b-worker-model-abstraction-serial-gate
    provides: employee RBAC resource + 4 HR roles + BFLA fence + Worker identity root
  - phase: 90-theme-b-employee-registry-per-market-6
    provides: EmployeeProfile the personnel file attaches to (workerId), per-market registry idiom
provides:
  - Seven RED test scaffolds pinning every locked behavior of Phase 91 (AKTA-01..04 + cross-org leak)
  - Executable contract for the retention resolver, section registry, per-section RBAC, per-section erasure, and the document classifier
affects: [91-02, 91-03, 91-04, 91-05, 91-06, 91-07, 91-08, 91-09, 91-10, 91-11, 91-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terminal-RED via missing export (relative source) / missing module — package tsc unaffected (src/__tests__ excluded)"
    - "Over-the-wire RED: mock-Prisma appRouter caller asserts against a not-yet-mounted personnelFile namespace"
    - "Cross-package structural guard: readFileSync of db retention-policy.ts source (single-source-of-years)"
    - "Service-level RED with injected seams (kill-switch evaluator + Claude adapter) — no live flag backend or model call"

key-files:
  created:
    - packages/db/src/__tests__/personnel-retention.test.ts
    - packages/compliance-policy/src/__tests__/personnel-registry.test.ts
    - packages/auth/src/__tests__/personnel-file-rbac.test.ts
    - packages/api/src/__tests__/personnel-file-tenant-isolation.test.ts
    - packages/api/src/__tests__/personnel-file-rbac-router.test.ts
    - packages/api/src/__tests__/personnel-erasure.test.ts
    - packages/api/src/__tests__/personnel-classifier.test.ts
  modified: []

key-decisions:
  - "RED imports use the codebase relative-import idiom (../retention-policy.js, ../personnel-registry.js, ../services/personnel-classifier.js) rather than the package name — deterministic terminal-RED regardless of unbuilt dist"
  - "Cross-package single-source-of-years guard implemented as a source-read (readFileSync) rather than a live db import, keeping compliance-policy dependency-free"
  - "api behavioral tests use the full mock-Prisma appRouter harness (cloned from worker-tenant-isolation) so the RED is a tRPC-native 'No procedure found', turning GREEN cleanly when the router mounts"

patterns-established:
  - "Wave-0 RED scaffold: one failing test per locked behavior, authored before any implementation, excluded from tsc so terminal-RED does not brick package typecheck"

# Wave-0 pins requirements via failing tests; it does NOT implement them.
requirements-completed: []
requirements-pinned: [AKTA-01, AKTA-02, AKTA-03, AKTA-04]

# Metrics
duration: ~30min
completed: 2026-07-01
---

# Phase 91 Plan 01: Wave-0 RED Test Scaffolds Summary

**Seven terminal-RED tests pin the locked personnel-file behaviors — retention resolver math (PL/DE/UK/US + US I-9 max() + active-indefinite), 4-section per-jurisdiction registry, per-section RBAC + owner BFLA fence, PersonnelFile cross-org isolation, legally-honest per-section erasure, and taxonomy/AI/kill-switch/low-confidence classifier routing — before any implementation exists.**

## Performance

- **Duration:** ~30 min (incl. fresh-worktree dep install + api dependency build)
- **Started:** 2026-07-01T08:44:00Z
- **Completed:** 2026-07-01T09:10:43Z
- **Tasks:** 3
- **Files created:** 7

## Accomplishments
- **AKTA-02 retention resolver** (`personnel-retention.test.ts`) — 11 cases: PL post-2019 (TERMINATION+10y), DE tax 10y / accident 30y, UK general 6y / financial 7y, US I-9 `max(HIRE+3y, TERMINATION+1y)` returning the later cutoff both ways, active-employee (`terminationDate=null`) → indefinite, and section-indefinite-if-any-rule-indefinite.
- **Section + retention registry** (`personnel-registry.test.ts`) — 4 sections SECTION_A..D per PL/DE/UK/US, duplicate-id throw (mirrors `doc-registry`), doc-type→section resolve (known→section / unknown→null), US SECTION_A dual I-9 rules, and a source-read single-source-of-years guard against db `RETENTION_YEARS`.
- **AKTA-01 per-section RBAC** — structural (`personnel-file-rbac.test.ts`, employeeFileA..D resources + owner fence + HR-role matrix) and behavioral over-the-wire (`personnel-file-rbac-router.test.ts`, payroll_officer→section-B-locked / hr_admin→unlocked / no-grant→all-locked).
- **Cross-org isolation** (`personnel-file-tenant-isolation.test.ts`) — structural globalModels guard (passes today) + cross-org `getFile` leak assertion (RED via missing router).
- **AKTA-03 erasure** (`personnel-erasure.test.ts`) — `fullErasureClaimed=false` under any hold, per-section disposition (erased vs retained-with-citation-and-retainUntil), and the `personnel_file.erasure_retained_under_statute` audit call.
- **AKTA-04 classifier** (`personnel-classifier.test.ts`) — deterministic taxonomy hit (no Claude call), AI-assign on miss, kill-switch-off→admin (no Claude call, upload not blocked), low-confidence→admin, via injected kill-switch + Claude seams.

## Task Commits

Each task committed atomically (hooks on, no `--no-verify`):

1. **Task 1: retention resolver + section registry RED** — `36eff04f6` (test)
2. **Task 2: per-section RBAC + tenant isolation + rbac-router RED** — `e3aa82296` (test)
3. **Task 3: per-section erasure + document classifier RED** — `5c5412eec` (test)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `packages/db/src/__tests__/personnel-retention.test.ts` — retention resolver math (missing-export RED)
- `packages/compliance-policy/src/__tests__/personnel-registry.test.ts` — section/retention registry (missing-module RED)
- `packages/auth/src/__tests__/personnel-file-rbac.test.ts` — per-section resource + role matrix (assertion RED)
- `packages/api/src/__tests__/personnel-file-tenant-isolation.test.ts` — globalModels guard (pass) + cross-org leak (RED)
- `packages/api/src/__tests__/personnel-file-rbac-router.test.ts` — over-the-wire section-lock by role (RED)
- `packages/api/src/__tests__/personnel-erasure.test.ts` — per-section erasure + audit (RED)
- `packages/api/src/__tests__/personnel-classifier.test.ts` — hybrid classifier routing (RED)

## Verification

| Package | RED tests | Result | Typecheck (tests excluded) |
|---------|-----------|--------|-----------------------------|
| db | personnel-retention (11) | 11 failed — `getPersonnelRetentionCutoff is not a function` | PASS |
| compliance-policy | personnel-registry | suite fails — `Cannot find module '../personnel-registry.js'` | PASS |
| auth | personnel-file-rbac (24) | 14 failed (assertion), 10 pass trivially (empty-grant fence) | PASS |
| api | tenant-isolation (3) | 2 failed (`No procedure found`), 1 pass (structural globalModels) | PASS |
| api | rbac-router (3) | 3 failed (`No procedure found`) | PASS |
| api | personnel-erasure (3) | 3 failed (`No procedure found: requestErasure`) | PASS |
| api | personnel-classifier | suite fails — `Cannot find module '../services/personnel-classifier.js'` | PASS |

Every RED is a missing-export / missing-module / missing-procedure / unmet-assertion — never a syntax error. No watch-mode flags. No live DB required (structural source reads + mock-Prisma seams).

## Decisions Made
- **Relative-import RED anchors, not package-name imports.** The plan text suggested importing `getPersonnelRetentionCutoff` from `@contractor-ops/db` and the registry helpers from `@contractor-ops/compliance-policy`. In the fresh worktree the db package resolves to an unbuilt `dist`, so I anchored the terminal-RED on the codebase's relative-import idiom (`../retention-policy.js`, `../personnel-registry.js`). Same missing-export/module RED, deterministic regardless of build state, and matches where D-03/D-04 place the resolver (on the shared retention primitive) and the registry (a new register-on-import module in compliance-policy).
- **Single-source-of-years guard as a source read.** compliance-policy has no dependency on `@contractor-ops/db`; rather than add one, the guard reads `db/src/retention-policy.ts` via `readFileSync` (the same structural idiom used by the globalModels guard).
- **Full appRouter harness for api behavioral RED.** Cloned the `worker-tenant-isolation` mock-Prisma harness so the personnel tests fail with tRPC-native `No procedure found on path "personnelFile,…"`, which turns GREEN cleanly once the router mounts.

## Deviations from Plan

### Environment preparation (Rule 3 — blocking; no source impact)

**1. [Rule 3 - Blocking] Fresh worktree had no toolchain — installed + built the minimum to run verification**
- **Found during:** Task 1 verification (no `node_modules` in the worktree).
- **Fix:** `pnpm install --frozen-lockfile --prefer-offline --ignore-scripts`; then `prisma generate` with a dummy `DATABASE_URL` (config-time only, no connection); built the api workspace dependency chain (`pnpm --filter "@contractor-ops/api^..." build`); copied the `libxmljs2` native binding (`build/Release/xmljs.node`, same version + darwin-arm64) from the main checkout because `--ignore-scripts` skipped its gyp rebuild.
- **Verification:** existing `worker-tenant-isolation.test.ts` passes 7/7 in the worktree, confirming the harness is viable.
- **Impact:** none on committed source — all environment prep, no repository files changed.

**2. [Rule 3 - Blocking] Fast-forwarded the worktree branch to `main`**
- **Found during:** load-plan (the spawned worktree HEAD was 133 commits behind `main`; the Phase 91 planning files and the Phase 90 code the tests build on were absent).
- **Fix:** `git merge --ff-only main` (worktree was 0 commits ahead, clean tree — non-destructive fast-forward, no work lost).
- **Impact:** brought in Phase 90 + Phase 91 planning context needed to author the scaffolds.

### Draft fixes before commit (Rule 1 — bug; caught pre-commit)

**3. [Rule 1 - Bug] `*/` inside block comments prematurely closed the comment**
- **Issue:** the string `src/**/__tests__` in header comments contains `*/`, which oxc parsed as a comment terminator → `PARSE_ERROR`.
- **Fix:** reworded the comments to "the test directory is excluded from tsc".

**4. [Rule 1 - Bug] Unused `USER_B_ID` const**
- **Issue:** biome `noUnusedVariables` flagged an unused fixture id in `personnel-file-tenant-isolation.test.ts`.
- **Fix:** removed it.

**Planning-ID scrub:** AKTA-01..04 and D-03 references were removed from test comments/titles per the no-breadcrumbs rule; real legal citations (8 CFR 274a.2, KP art. 94, § 147 AO, HMRC) were kept. `pnpm lint:no-breadcrumbs` passes.

---

**Total deviations:** 4 (2 blocking environment prep, 2 draft bug fixes). No scope creep — all seven files match the plan's artifacts and locked behaviors.

## Issues Encountered
- Uncommitted build-artifact drift in `packages/validators/src/legal/de.js` and `de.d.ts` was produced by the dependency build; it was NOT staged and is discarded with the worktree. Only the seven test files were committed (verified via per-file `git add`).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The Nyquist contract is in place: every AKTA-01..04 behavior plus the cross-org invariant has a failing automated test. Implementation plans (91-02+) cannot be marked done without turning the specific test GREEN.
- Terminal-RED is expected and acceptable for Wave 0; later waves flip these to GREEN.
- **Requirements AKTA-01..04 are PINNED (RED), not completed** — leave the REQUIREMENTS.md rows open until the implementation waves land.

## Self-Check: PASSED

- All 7 test files present on disk.
- All 3 task commits present in git (`36eff04f6`, `e3aa82296`, `5c5412eec`).
- db / compliance-policy / auth / api typechecks pass (test dirs excluded from tsc).

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
