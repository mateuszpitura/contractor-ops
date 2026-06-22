---
phase: 89-theme-b-worker-model-abstraction-serial-gate
plan: 04
subsystem: api
tags: [trpc, feature-flags, worker-model, flag-off, i18n, web-vite, vitest]

# Dependency graph
requires:
  - phase: 89-01
    provides: the contractor.* route-shape snapshot that proves the split preserves contractor shapes
  - phase: 89-02
    provides: the withWorkerTypeDefault extension (explicit-where-wins) that worker/employee reads rely on
provides:
  - shared cross-type workerRouter (worker.list / worker.getById) with explicit workerType
  - skeleton employeeRouter (employee.list, workerType=EMPLOYEE, read-only)
  - require-workforce-flag middleware (assertWorkforceEnabled + isWorkforceRegistered)
  - WORKFORCE_DISABLED error + workforceDisabled i18n key (en/de/pl/ar)
  - root.ts conditional-spread of worker/employee behind module.workforce-employees (METHOD_NOT_FOUND when off)
  - web-vite flag-gated /employees route + dashboard quick-link (useFlag render-removal)
  - workforce-flag integration test (load-time presence/absence + per-request guard)
affects: [89-05 (RBAC employee resource + roles), phase-90 (employee profile surface), worker-model-abstraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-layer flag-off (v5.0 classification / us-expansion idiom): root.ts conditional-spread → METHOD_NOT_FOUND + per-request assertWorkforceEnabled → FORBIDDEN + web-vite useFlag render-removal"
    - "Cross-type reads pass an explicit workerType so the withWorkerTypeDefault extension leaves the where untouched (explicit-where-wins)"
    - "Zod .strict() DTOs reject organizationId/workerType so neither can be mass-assigned from the client (set server-side)"
    - "Load-time router registration tested by resetting modules + re-importing ../root with QA_DEFAULT_ORG_ID toggled (the deterministic force-register lever)"

key-files:
  created:
    - packages/api/src/middleware/require-workforce-flag.ts
    - packages/api/src/routers/core/worker.ts
    - packages/api/src/routers/core/employee.ts
    - packages/api/src/__tests__/workforce-flag.test.ts
    - apps/web-vite/src/pages/dashboard/employees.tsx
  modified:
    - packages/api/src/errors.ts
    - packages/api/src/routers/core/index.ts
    - packages/api/src/root.ts
    - apps/web-vite/src/components/dashboard/dashboard-home.tsx
    - apps/web-vite/src/router/dashboard-routes.tsx
    - apps/web-vite/messages/en.json
    - apps/web-vite/messages/de.json
    - apps/web-vite/messages/pl.json
    - apps/web-vite/messages/ar.json
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/brain/wiki/structure/web-vite-domains.md
    - .planning/brain/wiki/log.md

key-decisions:
  - "Worker/employee skeleton routers are read-only (worker.list/getById, employee.list), so no mutation exists this phase → no writeAuditLog and no new AuditEntityType/employee RBAC resource needed (those land in 89-05). Reused the always-present contractor:read permission, mirroring how taxFormRouter gates on contractor:read."
  - "The web-vite flag-dark surface is a real /employees route + page (coming-soon empty state) rather than a link to a non-existent route, so the flag-on (QA) path never resolves to a 404 — production-grade WCAG empty state instead of a broken link."
  - "en-US.json gets no workforceDisabled override: the i18n:parity script treats en-US as fallback-aware (a key is covered if present in en-US OR en), and en-US is intentionally a thin-override locale, so the en fallback covers it without seeding spurious baseline drift."

patterns-established:
  - "conditionalWorkforceRouters const mirrors conditionalUsExpansionRouters / conditionalClassificationRouters — empty branch cast to the same type so client typing stays stable across the flag branch"

requirements-completed: [WORKER-02, WORKER-05]

# Metrics
duration: ~16min
completed: 2026-06-22
---

# Phase 89 Plan 04: Worker-Model Router Split + Workforce Flag-Off Summary

**A shared cross-type `workerRouter` + a skeleton `employeeRouter`, both gated behind `module.workforce-employees` via the proven three-layer flag-off (root.ts conditional-spread → METHOD_NOT_FOUND, per-request `assertWorkforceEnabled` → FORBIDDEN, web-vite `useFlag` render-removal), with the `contractor.*` route shape left untouched (snapshot stays GREEN).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-22T10:13Z
- **Tasks:** 2
- **Files:** 5 created + 12 modified

## Accomplishments

- **Router split (WORKER-02):** `workerRouter` (`worker.list` / `worker.getById`) reads cross-type Worker rows and passes an **explicit `workerType`** so the `withWorkerTypeDefault` extension does not force-filter to CONTRACTOR (explicit-where-wins). `employeeRouter` (`employee.list`) is a read-only skeleton pinned to `workerType: 'EMPLOYEE'` with **no profile fields** (Phase 90 scope fence). Both use Zod `.strict()` inputs that reject `organizationId`/`workerType` (set server-side). The existing `contractorRouter` composition and its `contractor:` mount in `root.ts` are unchanged — `contractor-contract-snapshot.test.ts` stays GREEN.
- **Three-layer flag-off (WORKER-05):** `require-workforce-flag.ts` exports `assertWorkforceEnabled` (FORBIDDEN / `WORKFORCE_DISABLED`) and `isWorkforceRegistered` (boot-time, `QA_DEFAULT_ORG_ID` force-register), an exact rename-mirror of `require-us-expansion-flag.ts`. `root.ts` spreads `...conditionalWorkforceRouters` next to the us-expansion spread, so `worker.*`/`employee.*` are absent from `appRouter` when the flag is OFF (METHOD_NOT_FOUND). The flag was **not** re-registered (already PENDING in `flags-core.ts`).
- **web-vite render-removal:** `dashboard-home.tsx` reads `useFlag('module.workforce-employees')` and conditionally renders a `/employees` quick-link; a flag-dark `/employees` route + page (`pages/dashboard/employees.tsx`) renders a WCAG coming-soon empty state so the gated link is never broken.
- **i18n:** `WORKFORCE_DISABLED` error + `workforceDisabled` key (en/de/pl/ar) and an `Employees` namespace + `Dashboard.workforce.cta` — `pnpm i18n:parity` GREEN.
- **Test:** `workforce-flag.test.ts` proves flag-off → `worker`/`employee` absent + `assertWorkforceEnabled` throws FORBIDDEN; flag-on → both present; `contractor.*` present in BOTH branches.

## Task Commits

1. **Task 1: guard + WORKFORCE_DISABLED + worker/employee routers** — `4a8c2ee3d` (feat)
2. **Task 2: root.ts conditional-spread + web-vite render-removal + flag-gate test** — `a19dfcc93` (feat)

## Verification

- `pnpm --filter @contractor-ops/api typecheck` → GREEN
- `pnpm --filter @contractor-ops/web-vite typecheck` → GREEN
- `pnpm --filter @contractor-ops/api exec vitest run workforce-flag contractor-contract-snapshot` → **8 passed** (flag-gate + contract snapshot both GREEN)
- `pnpm i18n:parity` → OK (baseline 494 tolerated; new keys covered en/de/pl/ar)
- `pnpm check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-presentational` → OK
- `pnpm lint:no-breadcrumbs` → OK
- `pnpm check:wiki-brain` → 0 errors (api-routers-catalog + web-vite-domains refreshed; BM25 rebuilt)
- `pnpm biome check` on touched files → clean

## Decisions Made

- **Read-only skeletons → no mutation surface this phase.** Since the gate only needs cross-type list/read, the routers carry no mutation, so no `writeAuditLog`, no new `AuditEntityType`, and no `employee` RBAC resource were introduced here (89-05 owns RBAC). The routers gate on the always-present `contractor:read` permission, the same reuse taxFormRouter applies.
- **Real /employees route, not a dangling link.** A flag-on (QA) link to a non-existent route would 404, so the flag-dark surface is a genuine route + page rendering a coming-soon empty state — production-grade and WCAG-compliant, repointed when the employee surface lands.
- **en-US parity via fallback.** `i18n-parity.mjs` runs en-US fallback-aware, so `workforceDisabled` / `Employees` are covered by the en fallback without a thin-override duplicate that would otherwise seed baseline drift.

## Deviations from Plan

None of the Rule 1–4 deviations were triggered. Two plan-permitted choices were exercised:

- **Plan-permitted scope choice — web-vite surface.** The plan allowed "if a skeleton surface renders, follow web-vite Page→Container→Hook→Component + WCAG." A small flag-dark `/employees` page + route was added (over a bare comment-only gate) so the flag-gated quick-link resolves to a real WCAG empty state rather than a 404. No tRPC is wired yet, so the page is presentational-only (no container/hook needed) and `check:web-vite-data-layer` stays GREEN.

## Known Stubs

- **`apps/web-vite/src/pages/dashboard/employees.tsx`** — intentional flag-dark skeleton: renders a coming-soon empty state with no data source wired. It is reachable only when `module.workforce-employees` is enabled (QA via `QA_DEFAULT_ORG_ID`), is documented in the wiki, and the employee registry/data wiring is explicitly Phase 90 scope. Not a stub blocking this plan's goal — the plan's goal is the flag-dark gate, which is fully delivered.

## In-Flight File Handling

`apps/web-vite/messages/{en,de,pl,ar}.json` carried unrelated in-flight edits (a `needsAction` key at ~line 1455). Only the plan's own hunks (`workforceDisabled`, `Dashboard.workforce.cta`, the `Employees` namespace) were staged via `git apply --cached` hunk-filtering; the `needsAction` in-flight hunk was left unstaged and uncommitted (verified after each commit). The untracked `contractors/insights/proportion-bar.tsx` (in-flight, not part of this plan) was left untouched.

## Self-Check: PASSED

(see appended verification below)
