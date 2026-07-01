---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 12
subsystem: documentation
tags: [wiki, documentation-follows-code, personnel-file, akta-osobowe, memory, phase-seal, verification]

# Dependency graph
requires:
  - phase: 91-02
    provides: PersonnelFile / PersonnelFileDocument models + enums (the schema facts to document)
  - phase: 91-03
    provides: section + retention registry (compliance-policy) + 8 akta tokens on RETENTION_YEARS
  - phase: 91-04
    provides: resource-per-section employeeFileA..D RBAC grain + 4 HR roles + owner BFLA fence
  - phase: 91-05
    provides: getPersonnelRetentionCutoff event-anchored resolver + both deletion chokepoints
  - phase: 91-06
    provides: killswitch.ai-personnel-classifier + classifyPersonnelDocument hybrid classifier
  - phase: 91-07
    provides: personnelFile router foundation + hasSectionPermission per-section gate
  - phase: 91-08
    provides: classify sub-router (attachDocument / approve / reject / pendingReviewQueue)
  - phase: 91-09
    provides: erasure sub-router (requestErasure + never-over-claim invariant)
  - phase: 91-10
    provides: staff 4-section shell + retention display + PersonnelFile i18n
  - phase: 91-11
    provides: admin classify-review queue + RODO erasure flow (criterion-#3 banner)
provides:
  - New wiki domain page domains/personnel-file.md (the akta compass) + refreshed structure/pattern pages
  - Three Phase-91 invariants in MEMORY.md (per-section RBAC grain; shared-retention-map + event-anchor resolver; per-section statutory-hold erasure never over-claims)
  - Phase-91 verification seal recorded in wiki/log.md (seven Wave-0 tests + typecheck + guards + wiki-brain GREEN)
affects: [next-agent discovery of the personnel-file domain; wiki-brain CI gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation-follows-code in the SAME milestone change set: a new domain page + structure/pattern refresh + MEMORY invariants for a landed feature, then the brain refresh pipeline + check:wiki-brain gate"
    - "verify_with points at the real shipped source (models, registry, resolver, router files, permissions, flags-core, the sole-boundary hook)"

key-files:
  created:
    - .planning/brain/wiki/domains/personnel-file.md
  modified:
    - .planning/brain/wiki/structure/prisma-schema-areas.md
    - .planning/brain/wiki/structure/key-services.md
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/brain/wiki/patterns/rbac-permissions.md
    - .planning/brain/wiki/patterns/audit-log.md
    - .planning/brain/wiki/patterns/feature-flags.md
    - .planning/brain/wiki/domains/_index.md
    - .planning/brain/wiki/index.md
    - .planning/brain/wiki/hot.md
    - .planning/brain/wiki/log.md
    - .planning/MEMORY.md

key-decisions:
  - "Added navigation links (domains/_index.md + index.md) beyond the plan's file list so the new domain page is discoverable, mirroring the employee-registry synthesis precedent (Rule 2 — completeness)"
  - "graph.json is a gitignored local build artifact (absent in a fresh worktree); the committed check-wiki-brain.mjs errors on its absence, so the current genuine artifact was placed into the worktree (gitignored → never committed) to make the gate literally GREEN, per the phase note that graph/BM25 are WARN-only local artifacts"
  - "Task 2 verification ran the scoped backend suites in full + the path-scoped web-vite personnel tests (NEVER the full unscoped web-vite suite — RAM); the full-monorepo pnpm typecheck was scoped to the touched packages (build = tsc for most; explicit typecheck for auth/api/web-vite)"

patterns-established:
  - "Phase-seal wiki-synthesis plan: one domain page + verify_with-anchored structure/pattern refresh + MEMORY invariants + a log.md gate record, closing the doc loop in the same milestone change set"

requirements-completed: [AKTA-01, AKTA-02, AKTA-03, AKTA-04]

# Metrics
duration: ~70min
completed: 2026-07-01
---

# Phase 91 Plan 12: Personnel-File Wiki Synthesis + Phase Seal Summary

**Closed the documentation-follows-code loop for the akta osobowe / Personalakte feature in the same milestone change set — a new `domains/personnel-file.md` compass plus refreshed `prisma-schema-areas` / `key-services` / `api-routers-catalog` / `rbac-permissions` / `audit-log` / `feature-flags` pages, three Phase-91 invariants in MEMORY.md, and a hot/log refresh — then sealed the phase with all seven Wave-0 tests GREEN, api typecheck 0 errors, the guards + `check:wiki-brain` green.**

## Performance

- **Duration:** ~70 min (most wall-clock in fresh-worktree `pnpm install` + dependency dist builds + the scoped test/typecheck runs)
- **Completed:** 2026-07-01
- **Tasks:** 2 (2 atomic commits)
- **Files:** 12 (1 created, 11 modified)

## Accomplishments

- **New domain page `domains/personnel-file.md`** — the whole jurisdiction-correct personnel file in one compass: Purpose / Flow (mermaid) / Entry points / Storage shape / Retention / RBAC / Erasure / Classifier / UI surface / Live state / Agent mistakes, with `verify_with` pointing at the real shipped source (`personnel.prisma`, `personnel-registry.ts`, `retention-policy.ts`, the four `personnel-file/*` router files, `permissions.ts`/`roles.ts`, `flags-core.ts`, `use-personnel-file.ts`).
- **Structure refresh:** `prisma-schema-areas` gained a PersonnelFile area row (enum-on-link 4-section view + retention seams + tenant-owning + additive migration deferred); `key-services` gained the retention-resolver row (event-anchored on the shared map, no parallel engine) + the classifier row (taxonomy → kill-switch AI → admin, never blocks the upload); `api-routers-catalog` refreshed the workforce section 2 → 3 namespaces (adds `personnelFile` read/classify/erasure).
- **Pattern refresh:** `rbac-permissions` gained a "Per-section personnel-file grain" section (resource-per-section `employeeFileA..D`, HR-role matrix, owner BFLA fence, permission-layer `hasSectionPermission` before query); `audit-log` gained the personnel erasure/classify audit facts (`allowAuditPurge` stays GDPR-only); `feature-flags` gained the `killswitch.ai-personnel-classifier` row.
- **MEMORY.md** — three durable Phase-91 invariants: (1) per-section RBAC grain = resource-per-section `employeeFileA..D`, never granted to `owner`; (2) akta retention registers on the shared `RETENTION_YEARS` map + a new event-anchor resolver (`HIRE/TERMINATION/DOCUMENT` + `max()` US I-9 + indefinite-while-active), no parallel engine; (3) per-employee/per-section/per-jurisdiction statutory-hold erasure returns dispositions and never claims full erasure while any hold is active (`fullErasureClaimed = retained.length === 0`).
- **Navigation + cache:** `domains/_index.md` + `index.md` link the new page; `hot.md` gained a personnel-file section; `log.md` records the synthesis + the phase seal; `source_commit` bumped to `105a8ccf` on every touched page.
- **Refresh pipeline:** `contextual-prefix.py --no-llm` over the touched pages + `bm25-index.py build` (docs=64); `pnpm check:wiki-brain` GREEN (0 errors).

## Task Commits

Each task committed atomically (hooks on, no `--no-verify`):

1. **Task 1 — personnel-file wiki domain + structure/pattern refresh + MEMORY invariants** — `aa0b2374a` (docs)
2. **Task 2 — record Phase-91 verification gate in wiki log** — `52beb68da` (docs)

**Plan metadata:** this SUMMARY committed separately at the real `.planning/milestones/...` path.

## Verification (phase seal)

All seven Wave-0 tests GREEN; no AKTA-01..04 test red:

| Suite | Result |
|-------|--------|
| `@contractor-ops/db` (incl. `personnel-retention`) | 190 passed / 6 skipped / 4 todo |
| `@contractor-ops/compliance-policy` (incl. `personnel-registry`) | 46 passed |
| `@contractor-ops/auth` (incl. `personnel-file-rbac`) | 278 passed |
| `@contractor-ops/api` — `personnel-file-rbac-router` + `personnel-file-tenant-isolation` + `personnel-erasure` + `personnel-classifier` | 4 files, 13 passed |
| `@contractor-ops/web-vite` — `src/components/employees/personnel-file` (path-scoped) | 2 files, 6 passed |

- **Typecheck (tsc):** `@contractor-ops/api` **0 errors**; `auth` clean; `db`/`validators`/`feature-flags`/`compliance-policy`/`integrations`/`classification`/`einvoice`/`gov-api` tsc-built clean (build = `tsc`, exit 0). `web-vite` had exactly **1 error** — the pre-existing `classification-tile.tsx` `TS2366` (documented out-of-scope in 91-10/11); **zero personnel-file errors**.
- **Guards:** `i18n:parity`, `check:web-vite-data-layer`, `check:web-vite-dialog-pattern`, `check:rtl-logical-props`, `lint:no-breadcrumbs`, `lint:audit-log` — all OK. `db:audit-enum-casing` reports 5 pre-existing `idp-deprovisioning.prisma` (Phase-76) offenders — out of scope; the AKTA enums (`SECTION_A..D`, `DETERMINISTIC/AI/MANUAL/PENDING`) are correct UPPER_SNAKE and not among them.
- **`pnpm check:wiki-brain`** — GREEN (0 errors; the lone warning is the pre-existing multi-`source_commit`-prefix, expected as pages bump independently).

## Decisions Made

- **Navigation links added beyond the plan's file list.** `domains/_index.md` + `index.md` now link `domains/personnel-file` so the new page is discoverable, mirroring the employee-registry synthesis (log 2026-07-01). A domain page unlinked from navigation is a discoverability gap (Rule 2 — completeness), not scope creep.
- **graph.json placed into the worktree.** `.planning/graphs/graph.json` is a gitignored local build artifact absent in a fresh worktree; the committed `check-wiki-brain.mjs` errors on its absence (stricter than the documented WARN-only policy). The current genuine artifact (rebuilt today from the same code) was copied in so the gate is literally GREEN — it is gitignored, so it never enters a commit.
- **Verification scoping respected the RAM constraints.** The web-vite personnel tests ran **path-scoped** (never the full unscoped suite — MEMORY: kills Mac RAM); the full-monorepo `pnpm typecheck` was covered by the per-package `tsc` builds + explicit `typecheck` for `auth`/`api`/`web-vite`.

## Deviations from Plan

### Auto-fixed / environment prep (Rule 3 — blocking; no source impact)

**1. [Rule 3 - Blocking] Corrected a cwd drift into the main repo (#3097).** Early `cd` commands targeted the main-repo path instead of the worktree; caught via the branch-drift assertion (`git rev-parse --abbrev-ref HEAD` returned `main`). Re-established all work in the worktree (`worktree-agent-aab5090376f258934`), re-`Read` the worktree copies before every `Edit`, and re-ran the pipeline/commits inside the worktree. No wrong-tree writes were committed.

**2. [Rule 3 - Blocking] Fresh worktree had no toolchain.** Ran `pnpm install --frozen-lockfile --prefer-offline --ignore-scripts` (routine workspace hydration; no new deps), then built the api + web-vite dependency closures (`tsc` per package). Fast-forwarded the worktree branch to `main` (strict-ancestor, non-destructive) before starting.

**3. [Rule 3 - Blocking] Copied the `libxmljs2` native binding.** `--ignore-scripts` skipped `libxmljs2`'s gyp build, so the api test's transitive import chain failed to load `xmljs.node` (a collection error, not an assertion failure). Copied the prebuilt `build/Release/xmljs.node` (same version `0.37.0`, darwin-arm64) from the main checkout — the exact fix 91-01 documented. Re-run: api personnel tests 13/13 GREEN.

**4. [Rule 3 - Blocking] Built `@contractor-ops/ui` + generated web-vite i18n types.** The path-scoped web-vite tests first failed to resolve `@contractor-ops/ui/i18n` (ui dist unbuilt) and web-vite typecheck failed on the gitignored `generated/i18n/keys` codegen artifact. Built the web-vite dependency closure and ran `i18n:types` — both are fresh-worktree codegen/build artifacts, not source issues. Re-run: web-vite personnel tests 6/6 GREEN; typecheck down to the single pre-existing offender.

**Total deviations:** 4 (all Rule 3 blocking; environment/tooling only). **No source-logic deviation** — this plan changed zero `apps/`/`packages/` source; every edit is under `.planning/`.

## Deferred / Out of Scope

- **Live per-region migration apply** (`__personnel_file_additive`, EU/ME) — LOCAL-ONLY posture, no local Postgres (carried from 91-02).
- **Concrete Claude-Vision section adapter** — the injected `classifyWithClaude` seam degrades the AI tail to the admin queue until wired (91-06/08).
- **Classify-queue admin route + erasure-dialog shell mount** — the containers are delivered fully wired to their hooks (91-11); mounting is a follow-up.
- **web-vite RBAC mirror** granting `employeeFileA..D` to the HR roles (`use-permissions.ts`) — parallels the employee-registry deferral; controls fail closed until wired.
- **Pre-existing out-of-scope offenders (NOT this phase):** `classification-tile.tsx` `TS2366`; `idp-deprovisioning.prisma` enum-casing (Phase 76). `packages/validators/src/legal/de.{js,d.ts}` build-artifact drift from the validators `tsc` build was left unstaged (discarded with the worktree), matching the 91-01/03/05 precedent.

## Known Stubs

None — this is a documentation plan; no source stubs introduced. The doc-flagged deferrals above (Claude adapter, route mount) are documented feature-follow-ups from the implementation plans, not value-faking stubs.

## Threat Flags

None — no source or security surface changed; the only edits are wiki `.md` + `MEMORY.md`. The `<threat_model>` mitigations (T-91-12-01 undocumented invariants → three MEMORY invariants + a domain Agent-mistakes section + the wiki-brain gate; T-91-12-02 false verification → all seven Wave-0 tests run, no red) are satisfied.

## User Setup Required

None — no external service configuration.

## Self-Check: PASSED

- `FOUND`: `.planning/brain/wiki/domains/personnel-file.md` (new domain page, contains "personnel")
- `FOUND`: `.planning/MEMORY.md` (three Phase-91 invariants, contains "per-section")
- `FOUND` commit `aa0b2374a` (Task 1 — wiki + MEMORY, 12 files)
- `FOUND` commit `52beb68da` (Task 2 — log gate record)
- `api-routers-catalog.md` → `personnelFile` catalog entry present (key-link satisfied)
- `pnpm check:wiki-brain` GREEN (0 errors); seven Wave-0 tests GREEN; no AKTA-01..04 test red
- No STATE.md / ROADMAP.md edits

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
