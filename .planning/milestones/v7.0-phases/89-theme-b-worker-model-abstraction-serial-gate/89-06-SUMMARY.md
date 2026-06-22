---
phase: 89-theme-b-worker-model-abstraction-serial-gate
plan: 06
subsystem: docs / knowledge-base
tags: [wiki, documentation-follows-code, worker-model, memory, knowledge-base]

# Dependency graph
requires:
  - phase: 89-02
    provides: Worker base table + withWorkerTypeDefault extension + check:contractor-rawsql-workertype guard — the schema/extension facts to document
  - phase: 89-03
    provides: backfill-worker.ts + two-step Migration A→B ordering + the applied live-DB state — the backfill facts to document
  - phase: 89-04
    provides: worker/employee router split + three-layer workforce flag-off — the router/flag facts to document
  - phase: 89-05
    provides: per-type employee RBAC resource + 4 HR roles + Worker tenant-isolation — the RBAC/isolation facts to document
provides:
  - worker-foundation domain wiki page (Purpose / Flow / Entry points / Invariants / Live state / Agent mistakes)
  - prisma-schema-areas + key-services + api-routers-catalog + patterns/_index + feature-flags pages reflecting the landed Worker model
  - two MEMORY.md invariants (Worker base + one-time backfill; workerType-scoped reads + raw-SQL guard)
affects: [phase-90 (employee registry inherits an accurate Worker compass), worker-model-abstraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "documentation-follows-code closure: the wiki/MEMORY synthesis lands in the SAME phase as the code so the next agent inherits an accurate compass (CLAUDE.md gated rule)"
    - "in-flight wiki overwrite via git apply --cached hunk-filtering: hot.md carried an unrelated in-flight contractor-band edit — only the Worker-section + source_commit hunks were staged, the in-flight band edit left unstaged"

key-files:
  created:
    - .planning/brain/wiki/domains/worker-foundation.md
  modified:
    - .planning/brain/wiki/index.md
    - .planning/brain/wiki/structure/prisma-schema-areas.md
    - .planning/brain/wiki/structure/key-services.md
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/brain/wiki/patterns/_index.md
    - .planning/brain/wiki/patterns/feature-flags.md
    - .planning/brain/wiki/log.md
    - .planning/brain/wiki/hot.md
    - .planning/MEMORY.md

key-decisions:
  - "Registered the worker-model idioms (withWorkerTypeDefault extension / per-type RBAC + BFLA fence / three-layer flag-off / two-step additive migration) as a table in patterns/_index pointing at the domain + existing rbac/feature-flags pattern pages, rather than minting a thin new dedicated pattern page — the idiom is fully covered by the domain page + the two existing pattern pages; a duplicate page would be drift-prone"
  - "Left .planning/brain/wiki/domains/contractors-engagements.md untouched — it carries an unrelated in-flight edit on main and is NOT in this plan's files_modified; the worker-foundation page links TO it and the structure pages cross-link both ways, so the cross-reference holds without editing the in-flight page"
  - "Skipped graphify graph rebuild — this plan is docs-only with no call-graph/import wiring change (the per-commit .husky/post-commit hook also only fires on apps/packages commits, not .planning/ docs)"

patterns-established:
  - "Worker-model abstraction patterns table in patterns/_index (reusable in Phases 90–97)"

requirements-completed: []

# Metrics
duration: ~14min
completed: 2026-06-22
---

# Phase 89 Plan 06: Worker Foundation Wiki Synthesis Summary

**Documentation-follows-code closure for the Theme B Worker gate: a new `worker-foundation` domain page plus refreshed structure/patterns/feature-flags pages and two MEMORY invariants now track the landed Worker abstraction (Worker base table + sidecar `Contractor.workerId` FK + `withWorkerTypeDefault` explicit-where-wins extension + the 4 raw-SQL blind-spot guard + the idempotent two-step backfill + the worker/employee router split + three-layer flag-off + per-type `employee` RBAC/HR roles + Worker tenant isolation) — so Phases 90–97 inherit an accurate compass; `check:wiki-brain` GREEN (0 errors).**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2
- **Files:** 1 created + 9 modified (all under `.planning/` — no source code touched)

## Accomplishments

### Task 1 — worker-foundation domain page + structure/patterns updates (commit `7e54a4a23`)

- **New `domains/worker-foundation.md`** — the whole abstraction in one compass with `verify_with` pointing at `worker.prisma`, `contractor.prisma`, `worker-type.ts`, `backfill-worker.ts`, the `worker`/`employee` routers, `require-workforce-flag.ts`, `permissions.ts`, and the raw-SQL guard. Sections: Purpose, Flow (mermaid: Worker identity root → sidecar FK → contractor / employee-Phase-90 + the extension default-vs-explicit branch), Entry points, RBAC, Invariants, Live state, Agent mistakes.
- **`structure/prisma-schema-areas.md`** — added a Worker-model area row (Worker identity root + `WorkerType` enum + `Contractor.workerId` sidecar FK + two-step additive ordering) and the `withWorkerTypeDefault` raw-SQL-blind-spot invariant; `source_commit` bumped + `worker.prisma`/`worker-type.ts` added to `verify_with`.
- **`structure/key-services.md`** — added `backfill-worker.ts` (idempotent/reversible/per-region/audited) and `worker-type.ts` (extension chained outermost, explicit-where-wins) rows; `source_commit` bumped + both added to `verify_with`.
- **`structure/api-routers-catalog.md`** — the existing "Conditional workforce" section (from 89-04) cross-linked to the new domain page + the extension/RBAC note; `worker.ts`/`employee.ts` added to `verify_with`; `source_commit` bumped.
- **`patterns/_index.md`** — new "Worker-model abstraction (reusable in Phases 90–97)" table: the `withWorkerTypeDefault` extension idiom, per-type RBAC + BFLA fence, three-layer flag-off, and two-step additive migration — each pointing at the domain / rbac-permissions / feature-flags pages.
- **`patterns/feature-flags.md`** — added the `module.workforce-employees` gate entry-point row (mirrors `module.us-expansion`); `source_commit` bumped + `require-workforce-flag.ts` added to `verify_with`.
- **`index.md`** — registered `[[domains/worker-foundation]]` in the Domains list.

### Task 2 — MEMORY invariants + log/hot + refresh pipeline (commit `7e54a4a23`)

- **`.planning/MEMORY.md`** — two new invariants under a "Worker model abstraction (Phase 89)" heading: (1) Worker base table + one-time backfill (sidecar `workerId` FK, `Contractor.id` stable, idempotent/reversible/audited backfill, two-step migration with B last, create-path wiring); (2) `workerType`-scoped reads via the central `withWorkerTypeDefault` extension (explicit-where-wins) + the 4 raw-SQL blind-spot sites guarded by `check:contractor-rawsql-workertype`. Also refreshed the "Stack anchors" router-count line to list the conditional workforce namespaces alongside classification + us-expansion.
- **`log.md`** — a new dated entry enumerating every page touched in this synthesis (append-only, newest after the header).
- **`hot.md`** — a new "Worker-model abstraction (Theme B gate)" discovery shortcut + `source_commit` bump; staged via `git apply --cached` hunk-filtering so the unrelated in-flight contractor-band edit stayed unstaged.
- **Refresh pipeline:** `pnpm check:wiki-brain` → **0 errors** (1 pre-existing multi-prefix WARN, expected); contextual-prefix re-run across the vault (worker-foundation chunked); BM25 rebuilt (195 docs). Graphify skipped (docs-only, no call-graph change). The `.vault-meta` BM25/prefix artifacts are gitignored (`.gitignore:33`) — never committed.

## Verification

- `test -f .planning/brain/wiki/domains/worker-foundation.md && grep -q "worker-type" …` → PASS
- `grep -q "withWorkerTypeDefault\|workerType-scoped\|Worker base table" .planning/MEMORY.md` → PASS (all three present)
- `pnpm check:wiki-brain` → **0 error(s), 1 warning(s)** (the warning is the pre-existing multi-`source_commit`-prefix notice — informational, not a failure)
- BM25: `grep -c worker-foundation .vault-meta/bm25/index.json` → 1 (page indexed); `docs=195`
- `git diff --stat` confirms all touched files are under `.planning/` — no `apps/`/`packages/` source touched.

## Decisions Made

- **No thin dedicated pattern page.** The worker-model idioms are registered as a table in `patterns/_index` linking to the domain page + the existing `rbac-permissions` / `feature-flags` pattern pages. A standalone page would duplicate content already covered there and become drift-prone.
- **`contractors-engagements.md` left untouched.** It carries an unrelated in-flight edit on `main` and is not in this plan's `files_modified`. The cross-reference holds via the worker-foundation → contractors-engagements link and the bidirectional structure-page links.
- **Graphify skipped.** Docs-only change with no call-graph/import wiring delta; the auto-rebuild hook also only fires on `apps/`/`packages/` commits.

## Deviations from Plan

- **[In-flight handling] `hot.md` staged via hunk-filtering.** `hot.md` carried an unrelated in-flight contractor-band line edit on `main`. The plan lists `hot.md` as a target; rather than committing the in-flight band edit, a crafted patch (`git apply --cached` against the index using the HEAD band line as context) staged only the new Worker section + the `source_commit` bump, leaving the in-flight band edit unstaged in the working tree. Verified after commit.

No Rule 1–4 auto-fix deviations were triggered (docs-only plan).

## In-Flight File Handling

The working tree carried unrelated in-flight edits on `main`: `.planning/brain/wiki/domains/contractors-engagements.md` + `.planning/brain/wiki/hot.md` (a contractor-band line), `apps/web-vite/src/components/contractors/*`, `apps/web-vite/messages/*.json`, and an untracked `contractors/insights/proportion-bar.tsx`. None were committed by this plan: `contractors-engagements.md` and all the web-vite/messages files were left entirely untouched and unstaged; `hot.md` had only this plan's two hunks staged via hunk-filtering (the in-flight band edit stayed unstaged). Each commit staged only this plan's own files individually (no `git add -A`/`.`).

## Known Stubs

None. Every wiki page reflects the landed code; no placeholder or empty-value stub was introduced.

## Requirements

No requirement marked complete. WORKER-01..05 were already completed by 89-02/03/04/05; this is the documentation-follows-code closure plan and maps to no separate requirement item. WORKER-* checkboxes left as already set by the prior plans.

## Self-Check: PASSED

(see appended verification below)
