---
phase: 90-theme-b-employee-registry-per-market-6
plan: 07
subsystem: docs
tags: [wiki, documentation-follows-code, memory, knowledge-graph, bm25, employee-registry, pii, reference-data]

# Dependency graph
requires:
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 02)
    provides: the 8 greenfield statutory validators + reference enums + versioned seed tables to document
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 03)
    provides: employee country-fields registry + dedicated PII crypto + EMPLOYEE_PII_ENCRYPTION_KEY to document
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 04)
    provides: EmployeeProfile model (workerId FK) + employeePii permission + cross-org leak test to document
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 05)
    provides: employeeRegistryRouter (register/revealPii/listReferenceLists) + ELStAM stub to document
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 06)
    provides: per-market registration UI (page → wired section → hook → presentational) to document
provides:
  - wiki/domains/employee-registry.md — the per-market employee onboarding compass (Purpose/Flow/Entry points/Storage/UI surface/Invariants/Agent mistakes)
  - Updated structure pages (prisma-schema-areas, packages, web-vite-domains, api-routers-catalog) + patterns/_index idioms + navigation
  - Two MEMORY invariants (national-ID PII-encryption boundary; seeded-reference-list + tenant-owning EmployeeProfile)
  - Rebuilt local knowledge graph (graph.json) + BM25 index; check:wiki-brain green (0 errors)
affects: [94-payroll-adapters, 97-hr-dashboard, future-employee-detail-offboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation follows code: the employee-registry domain + PII-boundary + seeded-reference-list patterns land in the wiki in the same milestone as the code"
    - "Wiki documents the ACTUAL shipped impl (Worker(EMPLOYEE)+EmployeeProfile workerId FK, mergeRouters, resourceType ORGANIZATION audit, Employees i18n namespace) — not the plan's stale Employee-table assumptions"

key-files:
  created:
    - .planning/brain/wiki/domains/employee-registry.md
  modified:
    - .planning/brain/wiki/structure/prisma-schema-areas.md
    - .planning/brain/wiki/structure/packages.md
    - .planning/brain/wiki/structure/web-vite-domains.md
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/brain/wiki/patterns/_index.md
    - .planning/brain/wiki/domains/_index.md
    - .planning/brain/wiki/index.md
    - .planning/brain/wiki/log.md
    - .planning/brain/wiki/hot.md
    - .planning/MEMORY.md

key-decisions:
  - "Documented the ACTUAL impl over the plan's stale assumptions: no standalone Employee table (an employee is a Worker(workerType=EMPLOYEE)); EmployeeProfile attaches 1:1 via workerId @unique; register composed by mergeRouters; audit resourceType is ORGANIZATION; i18n lives in messages/{locale}.json under the Employees namespace"
  - "Added the three reusable idioms to the existing patterns/_index worker-model table (parallel-not-fork country-fields registry, national-ID PII-encryption boundary, seeded reference lists) rather than creating a new pattern page — they are extensions of the Phase-89 worker-model family, reusable across 90–97"
  - "Refreshed the api-routers-catalog employee namespace row from stale skeleton-read-only to the composed registry surface (documentation-follows-code trigger: employee.ts gained new procedures)"
  - "hot.md handled ADD-only (new section, no frontmatter reorder) to keep the orchestrator's merge clean given the main checkout's concurrent uncommitted hot.md edit"

requirements-completed: []  # doc-closure plan — the EMP-REG-* requirements were satisfied by 90-04/05/06; this plan does not re-satisfy them

# Metrics
duration: ~40min
completed: 2026-07-01
---

# Phase 90 Plan 07: Employee-registry Wiki + MEMORY + Knowledge-graph Synthesis Summary

**Closed the documentation-follows-code gate for the Phase 90 employee registry: a new `wiki/domains/employee-registry.md` compass documenting the ACTUAL shipped implementation (Worker(EMPLOYEE)+EmployeeProfile via `workerId` FK, `mergeRouters` registry, encrypted national-ID columns with omit-on-return, advisory Emirates-ID checksum, `resourceType: 'ORGANIZATION'` audit, staff-only `revealPii`, seeded LOCAL-ONLY reference lists, `Employees` i18n namespace), the four touched structure pages + three reusable pattern idioms, two MEMORY invariants (PII boundary + seeded-not-live-gov), and a rebuilt graph + BM25 index with `check:wiki-brain` green.**

## Performance

- **Tasks:** 2 (both autonomous)
- **Files:** 1 created, 10 modified (9 wiki + MEMORY)
- **Local artifacts rebuilt:** `.planning/graphs/graph.json` (26468 nodes / 62626 edges) + `.planning/brain/.vault-meta/bm25/index.json` (210 docs) — both gitignored

## Accomplishments

- **New domain page** `wiki/domains/employee-registry.md` with `verify_with` → `employee-registry-router.ts`, `employee.prisma`, `employee-validators.ts`, `employee-country-fields.ts`, `employee-pii-crypto.ts`, `employee-compliance-section.tsx`, `core/employee.ts` + `source_commit`. Sections: Purpose, Flow (register → validate → encrypt/split → transaction → omit-on-return; revealPii → gated field-routed decrypt + audit), Entry points, Storage shape, UI surface, Invariants, Live state, Agent mistakes.
- **Structure pages** — `prisma-schema-areas.md` gains the `EmployeeProfile` hybrid-storage area row; `packages.md` extends the `validators` + `api` rows with the new employee modules; `web-vite-domains.md` replaces the flag-dark skeleton row with the wired `employees/` + `employees/compliance/` domain (no container); `api-routers-catalog.md` refreshes the `employee` namespace from skeleton to the composed registry surface. Each touched page's `source_commit` bumped to `65cdee081`.
- **Patterns** — `patterns/_index.md` worker-model table gains three reusable idioms: parallel-not-fork country-fields registry, national-ID PII-encryption boundary, seeded reference lists (no live gov).
- **Navigation** — `index.md` + `domains/_index.md` link the new page (added the missing `worker-foundation` row too).
- **Log/hot** — `log.md` appended (new dated synthesis entry, additive above existing entries); `hot.md` gained an "Employee registry (Theme B gate)" discovery section (ADD-only, no frontmatter reorder — safe for the concurrent main-checkout merge).
- **MEMORY** — two invariants appended: (1) national-ID PII-encryption boundary (dedicated `EMPLOYEE_PII_ENCRYPTION_KEY` for 3 non-SSN IDs, SSN reuses `SSN_ENCRYPTION_KEY`, encrypted columns never in `countryFields`, `employeePii:read` reveal + audit, tax/social IDs plain-RBAC-gated); (2) seeded reference lists + ELStAM stub are LOCAL-ONLY (no live gov API) and `EmployeeProfile` is tenant-owning (never `globalModels`).
- **Knowledge graph + BM25** — rebuilt `graph.json` via `graphify update` and the BM25 index via `contextual-prefix` + `bm25-index build`; `pnpm check:wiki-brain` exits 0 (only the pre-existing multiple-source_commit-prefix WARN remains).

## Task Commits

1. **Task 1: employee-registry domain page + structure/pattern wiki sync** — `3b4c0ff42` (docs)
2. **Task 2: MEMORY invariants + graph/BM25 rebuild + wiki-brain gate** — `cdaf077a4` (docs)

**Plan metadata:** committed with this SUMMARY (docs).

## Decisions Made

- **Documented reality, not the plan's stale text.** The plan's `doc_targets` said "FK → P89 Employee"; the shipped code has no `Employee` table — an employee is a `Worker(workerType='EMPLOYEE')` and `EmployeeProfile` attaches 1:1 via `workerId @unique`. The wiki documents the actual shape (verified in `employee.prisma` + `employee-registry-router.ts`), including `mergeRouters` composition, `resourceType: 'ORGANIZATION'` audit, and the `Employees` i18n namespace in `messages/{locale}.json`.
- **Extended the existing worker-model pattern table** rather than adding a new pattern page — the three idioms are members of the Phase-89 worker-model family and reusable across Phases 90–97.
- **hot.md handled ADD-only** to respect the concurrent uncommitted `hot.md` edit in the main checkout (per the executor's parallel-execution guidance) — a new section inserted before "Reading order", no existing entry reordered or removed, no frontmatter change.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Fresh worktree lacked node_modules for the pre-commit hook

- **Found during:** Task 1 commit
- **Issue:** The husky `pre-commit` runs `lint-staged`, which is not installed in this fresh worktree fork (no `node_modules`); the commit failed with `Command "lint-staged" not found`.
- **Fix:** Symlinked the main checkout's `node_modules` into the worktree (gitignored, no source impact — the same approach used by 90-04/90-06). `lint-staged` then ran and found no staged files matching its source globs (all my changes are `.md`). Did NOT use `--no-verify`.
- **Files modified:** none (env-only symlink).

### 2. [Environmental, not drift] check:wiki-brain missing-artifact errors in the fresh worktree

- **Found during:** Task 2 verification
- **Issue:** `check:wiki-brain` initially reported two ERRORs — missing `.planning/graphs/graph.json` and missing `.planning/brain/.vault-meta/bm25/index.json`. Both are gitignored LOCAL artifacts absent from a fresh worktree fork; they are NOT drift caused by this change set (my diff has zero source changes).
- **Fix:** Rebuilt both per the CLAUDE.md commands — BM25 via `contextual-prefix.py --no-llm` over all wiki pages + `bm25-index.py build` (210 docs, includes the new page); graph via `graphify update . --no-cluster --force` (26468 nodes / 62626 edges) copied to `.planning/graphs/graph.json`. `check:wiki-brain` then exits 0.
- **Files modified:** none tracked (both artifacts gitignored).

---

**Total deviations:** 2 (1 blocking env fix, 1 environmental artifact rebuild). No scope creep; no source-code changes.

## Deferred Items (documented in the wiki, not fixed here)

Reflected factually in the domain page's "Live state" + "Agent mistakes" and MEMORY, per the phase `deferred-items.md`:

- Live per-region (EU/ME/US) `EmployeeProfile` migration apply is deferred (LOCAL-ONLY posture; schema + generated client landed; migration authored un-applied).
- The web-vite RBAC mirror (`use-permissions.ts` / `memberRoles`) does not yet grant `employee`/`employeePii` to the HR roles, so the Register/reveal controls fail closed (absent) — correct fail-safe until the HR-role frontend surface is wired.
- Human-verify visual UAT of the registration UI is a deferred manual-UAT item.

## Known Stubs

None introduced by this plan (documentation-only). The wiki documents the `elstam-stub.ts` no-network seam and the seeded reference lists as intentional LOCAL-ONLY design, not unfinished work.

## Threat Flags

None — this is a documentation change set with no new security surface. The wiki + MEMORY document the env-var NAME (`EMPLOYEE_PII_ENCRYPTION_KEY`) only, never a key value or a real national ID (mitigates the plan's doc-leak threat).

## Self-Check: PASSED

- Created file exists: `.planning/brain/wiki/domains/employee-registry.md` — FOUND.
- Commits exist: `3b4c0ff42` (Task 1), `cdaf077a4` (Task 2) — both FOUND in git log.
- `.planning/MEMORY.md` contains `EMPLOYEE_PII_ENCRYPTION_KEY` (grep count 1) + the seeded-reference-list invariant.
- `pnpm check:wiki-brain` exit 0 (only the pre-existing multiple-source_commit WARN).
- No breadcrumb planning IDs in any touched wiki page or MEMORY.

---
*Phase: 90-theme-b-employee-registry-per-market-6*
*Completed: 2026-07-01*
