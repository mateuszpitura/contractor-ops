---
phase: 96-theme-b-employee-self-service-portal
plan: 09
subsystem: web-vite + planning/wiki
tags: [portal, employee-portal, i18n, wiki, docs, closeout]
requirements: [EMP-PORTAL-04, EMP-PORTAL-01]
dependency_graph:
  requires:
    - phase: 96-07
      provides: "employee portal UI + Portal.employee.* en source keys"
    - phase: 96-08
      provides: "manager portal UI + Portal.employee.team.* en source keys"
  provides:
    - "5-locale i18n parity for the new portal surfaces (en/en-US/de/pl/ar)"
    - "the employee-portal wiki domain page + web-vite-domains + MEMORY invariants + EXTERNAL-ENABLEMENT rows"
    - "the pre-existing 96-02 portal.test.ts debt fixed"
tech_stack:
  patterns:
    - "en-US is a thin-override locale (fallback en-US -> en) — the new keys need only en/de/pl/ar; parity treats en-US as covered by en"
    - "de uses the formal Sie register; ar is RTL-safe; native-quality review is deferred + registered in EXTERNAL-ENABLEMENT"
key_files:
  created:
    - ".planning/brain/wiki/domains/employee-portal.md"
  modified:
    - "apps/web-vite/messages/de.json"
    - "apps/web-vite/messages/pl.json"
    - "apps/web-vite/messages/ar.json"
    - ".planning/brain/wiki/structure/web-vite-domains.md"
    - ".planning/brain/wiki/log.md"
    - ".planning/brain/wiki/hot.md"
    - ".planning/MEMORY.md"
    - ".planning/EXTERNAL-ENABLEMENT.md"
    - "packages/api/src/routers/__tests__/portal.test.ts"
decisions:
  - "i18n keys live in apps/web-vite/messages/{en,en-US,de,pl,ar}.json (what pnpm i18n:parity + i18n:types read), NOT the plan's stale apps/web-vite/src/i18n/locales/*/portal.json (that directory does not exist). en was seeded in 96-07/08; de/pl/ar added here; en-US inherits from en."
  - "Portal top-bar nav (Task 2) NOT wired — a foundational gap surfaced: the web-vite portal shell bootstrap `portal.auth.getSession` is `portalProcedure` (CONTRACTOR-only middleware) and returns no `subjectType`, and the top-bar receives only contractor props. An EMPLOYEE subject therefore cannot enter the shell today, so there is no subject signal to drive employee/manager nav from. Wiring it correctly needs a subject-agnostic session bootstrap + shell branch (backend + shared shell), which is larger than the plan's single-file nav scope. Flagged in MEMORY + EXTERNAL-ENABLEMENT row 25 + the domain page rather than shipping a broken/fake nav."
  - "portal.test.ts 96-02 debt fixed with a one-line mock stub: the portal-magic-link mock lacked findEmployeesByEmail (called by portal-auth-router). Added `findEmployeesByEmail: () => Promise.resolve([])` (no employee match -> the existing contractor-path assertions stay green). 31 -> 36 passing."
requirements_completed: [EMP-PORTAL-01, EMP-PORTAL-02, EMP-PORTAL-03, EMP-PORTAL-04]
completed: 2026-07-05
---

# Phase 96 Plan 09: Closeout — i18n parity, wiki, and test-debt fix

**Closed the phase: 5-locale i18n parity for the new employee + manager surfaces, the documentation-follows-code set (employee-portal domain page + indexes + MEMORY invariants + EXTERNAL-ENABLEMENT rows), the BM25/wiki refresh (`check:wiki-brain` green), and the pre-existing 96-02 `portal.test.ts` debt fixed. The portal top-bar nav is deferred behind a newly-surfaced foundational shell-bootstrap gap.**

## Accomplishments

- **5-locale i18n parity** — added the `Portal.employee.*` + `Portal.employee.team.*` key trees to de (formal Sie), pl, and ar (RTL); en/en-US covered (en canonical, en-US inherits). `pnpm i18n:parity` passes (only the 494 pre-existing cross-theme sites tolerated).
- **portal.test.ts fixed** — the 96-02 magic-link mock lacked `findEmployeesByEmail`; added the stub. Suite is 36/36 (was 31/36).
- **Documentation-follows-code** — new `wiki/domains/employee-portal.md` (Purpose, Flow, Entry points, Security invariants, UI surface, Agent mistakes; `verify_with` binds `portal-employee-router.ts` / `portal-employee-akta.ts` / `portal-manager-router.ts` / `portal-reports.ts` / `portal-auth.ts` / `portal-session.ts` / `portal-root.ts` / the validators / a UI hook). Added the `portal/employee` + `portal/employee/team` rows to `structure/web-vite-domains.md`; appended the phase invariants to `MEMORY.md`; added EXTERNAL-ENABLEMENT rows 23–25 (the two deferred migrations + the shell-bootstrap follow-up). `api-routers-catalog.md` was already extended in 96-05/06.
- **Refresh pipeline** — `wiki/log.md` entry + `wiki/hot.md` employee-portal discovery section + rebuilt the BM25 index (282 docs). `pnpm check:wiki-brain` — 0 errors (the multi-`source_commit` warning is inherent/tolerated).

## Verification

- `pnpm i18n:parity` — OK (de/pl/ar carry every new key).
- `pnpm --filter @contractor-ops/api test portal.test` — 36/36 GREEN.
- `pnpm check:wiki-brain` — exit 0 (0 errors, 1 tolerated warn). BM25 index rebuilt (gitignored local artifact).
- `pnpm lint:no-breadcrumbs` — the new files are clean.
- Full portal RED net remains 24/24 GREEN (05–08).

## Notes / deviations

- **Top-bar nav deferred (foundational gap)** — see the decision above; the employee-portal shell bootstrap + subject-aware nav is EXTERNAL-ENABLEMENT row 25. The routes, routers, validators, RED-net, and UI are complete and compile; only the shell entry for the employee subject is unwired.
- **i18n path** — `messages/*.json` is canonical (the plan's `src/i18n/locales/*/portal.json` does not exist).
- **Native-quality de/pl/ar review** is deferred (EXTERNAL-ENABLEMENT row 9 — machine-assisted copy; en/en-US canonical; local-only posture).
