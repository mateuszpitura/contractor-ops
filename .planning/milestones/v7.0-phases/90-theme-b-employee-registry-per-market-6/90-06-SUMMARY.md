---
phase: 90-theme-b-employee-registry-per-market-6
plan: 06
subsystem: ui
tags: [react, vite, i18next, trpc, tanstack-query, rbac, pii, employee-registry, rtl]

# Dependency graph
requires:
  - phase: 89
    provides: employeeRouter mount, module.workforce-employees flag, employeePii:read + employee grants, EmployeeProfile/Worker model
  - phase: 90-04
    provides: employee validators + reference lists + per-market country-fields schemas
  - phase: 90-05
    provides: trpc.employee.register / revealPii / listReferenceLists procedures
provides:
  - Per-market employee registration UI (page -> wired section -> hooks -> presentational)
  - EmployeeFieldsDispatch (PL/DE/GB/US/AE/SA, default null) mirroring the contractor CountryFieldsDispatch
  - EmployeePiiMaskedReveal + use-reveal-employee-pii (gated, uncached, audited reveal)
  - Six presentational market field components + shared field primitives + reference-list picker
  - Employees.registry + Employees.compliance i18n keys across en/de/pl/ar
affects: [employee-detail, employee-offboarding, workforce-dashboard, hr-roles-frontend-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "page (flag gate) -> wired section (loading/empty/error) -> hook (sole tRPC boundary) -> presentational market components; no *-container.tsx"
    - "three-class field feedback: hard red FieldError (blocks save) / amber non-blocking AdvisoryPill / muted dashed AdviserVerifyNote"
    - "save gate delegates to the server zod schema via employeeCountryFieldsSchemaMap[cc].safeParse + per-field PII format checks; Emirates-ID checksum stays advisory"

key-files:
  created:
    - apps/web-vite/src/components/employees/compliance/hooks/use-employee-compliance.ts
    - apps/web-vite/src/components/employees/compliance/hooks/use-reveal-employee-pii.ts
    - apps/web-vite/src/components/employees/compliance/employee-compliance-section.tsx
    - apps/web-vite/src/components/employees/compliance/employee-pii-masked-reveal.tsx
    - apps/web-vite/src/components/employees/compliance/reference-list-picker.tsx
    - apps/web-vite/src/components/employees/compliance/field-primitives.tsx
    - apps/web-vite/src/components/employees/compliance/{pl,de,uk,us,ae,sa}-employee-fields.tsx
    - apps/web-vite/src/components/employees/employee-registration-page.tsx
  modified:
    - apps/web-vite/src/pages/dashboard/employees.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json

key-decisions:
  - "i18n keys added under a new Employees.compliance + Employees.registry namespace INSIDE apps/web-vite/messages/{locale}.json (the plan's locales/{locale}/employees.json path does not exist in this app)"
  - "PII capture during registration uses plaintext inputs; EmployeePiiMaskedReveal renders in edit/post-register mode when a stored last-4 + workerId is present"
  - "Register control gated on can('employee',['create']) and reveal on can('employeePii',['read']); when absent, the control is omitted (never a disabled stub)"

patterns-established:
  - "EmployeeFieldsDispatch switch mirrors the contractor CountryFieldsDispatch, default: return null"
  - "Reveal value held in local useState, never the query cache (mirrors use-reveal-ssn)"

requirements-completed: [EMP-REG-PL-01, EMP-REG-DE-01, EMP-REG-UK-01, EMP-REG-US-01, EMP-REG-AE-01, EMP-REG-SA-01]

# Metrics
duration: ~70min
completed: 2026-07-01
---

# Phase 90 Plan 06: Per-market Employee Registration UI Summary

**A flag-gated employee registration surface that dispatches PL/DE/UK/US/AE/SA statutory field sets through a single wired section, with masked-PII reveal, reference-list pickers, three-class validation feedback, and full en/de/pl/ar parity.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-07-01T01:10:18Z
- **Tasks:** 2 auto tasks executed; Task 3 (human-verify) recorded as deferred manual-UAT
- **Files modified:** 18 (12 created components/hooks, 1 page created, 1 route modified, 4 locale files modified)

## Accomplishments
- Data layer as the sole tRPC boundary: `use-employee-compliance` (listReferenceLists + register) and `use-reveal-employee-pii` (revealPii, local-state only); `pnpm check:web-vite-data-layer` passes with no `*-container.tsx`.
- Wired `EmployeeComplianceSection` with loading / error / empty states, market selector, and `EmployeeFieldsDispatch` (PL/DE/GB/US/AE/SA → six presentational components, `default: return null`).
- `EmployeePiiMaskedReveal`: reveal control ABSENT without `employeePii:read`, `aria-pressed`, mono last-4 `role="img"`, value never cached; wired for PESEL/SSN/Iqama/Emirates-ID.
- Three-class feedback: hard red `FieldError` (bad PESEL/NI/Steuer-IdNr/SSN/Iqama, blocks save) / amber `AdvisoryPill` (Emirates-ID checksum, GOSI, WPS — never blocks) / muted dashed `AdviserVerifyNote` (NFZ seed list, ELStAM, statutory notes).
- Save gate delegates to the server zod schema (`employeeCountryFieldsSchemaMap[cc].safeParse`) plus per-field PII format; the Emirates-ID checksum is intentionally excluded from blocking.
- Flag-gated thin page with render-tree removal when `module.workforce-employees` is OFF; `/employees` route now renders the registration surface.
- Employee i18n keys added under `Employees.registry` + `Employees.compliance` across en/de/pl/ar (119 keys each); `pnpm i18n:parity` passes; RTL uses logical properties only.

## Task Commits

1. **Task 1: Data hooks + wired dispatch section + masked-reveal + reference picker + six market field components** - `85cc6bd52` (feat)
2. **Task 2: Flag-gated registration page + route wiring + i18n parity (en/de/pl/ar)** - `ce8ec1eb6` (feat)
3. **Task 3: human-verify checkpoint** - DEFERRED manual-UAT (see below); automated gates are the acceptance evidence.

## Files Created/Modified
- `.../employees/compliance/hooks/use-employee-compliance.ts` - Sole tRPC boundary: reference lists query + register mutation.
- `.../employees/compliance/hooks/use-reveal-employee-pii.ts` - Field-parameterised reveal; value in local state, never cached.
- `.../employees/compliance/employee-compliance-section.tsx` - Wired section, form state, `EmployeeFieldsDispatch`, save gate.
- `.../employees/compliance/employee-pii-masked-reveal.tsx` - Gated masked reveal (absent without permission).
- `.../employees/compliance/reference-list-picker.tsx` - Combobox wrapper for seeded lists + adviser-verify note.
- `.../employees/compliance/field-primitives.tsx` - Shared `RequiredLabel` / `FieldError` / `AdvisoryPill` / `AdviserVerifyNote` + `PiiRevealContext`.
- `.../employees/compliance/{pl,de,uk,us,ae,sa}-employee-fields.tsx` - Presentational per-market field sets.
- `.../employees/employee-registration-page.tsx` - Thin flag-gated composer (Suspense + AnimateIn, no tRPC).
- `apps/web-vite/src/pages/dashboard/employees.tsx` - Route now renders `EmployeeRegistrationPage` (replaced the flag-dark skeleton).
- `apps/web-vite/messages/{en,de,pl,ar}.json` - `Employees.registry` + `Employees.compliance` key additions (pure inserts).

## Decisions Made
- **i18n location** — added keys inside the existing `messages/{locale}.json` under a new `Employees.compliance` / `Employees.registry` namespace; the plan's `src/i18n/locales/{locale}/employees.json` path does not exist in this app.
- **PII capture vs reveal** — registration captures national IDs as plaintext inputs (encrypted server-side by `register`); the masked-reveal renders in edit/post-register mode when a stored last-4 + workerId is present (mirrors the contractor SSN pattern).
- **Save gate** — a single `safeParse` against the shared employee country-fields schema is the source of truth for blocking, so the client blocking rules can never drift from the server's `.strict()` validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Frontend RBAC mirror out of sync with server for `employeePii`**
- **Found during:** Task 1 (masked-reveal permission gating)
- **Issue:** The server `roles.ts`/`permissions.ts` grant `employeePii: ['read']` to owner + admin, but the web-vite `usePermissions` mirror omitted `employeePii` entirely, so `can('employeePii',['read'])` was always false and the reveal control would never appear for any role. CLAUDE.md mandates the mirror stay in sync with the server grant map.
- **Fix:** NOT auto-applied here — the plan's `files_modified` did not include `apps/web-vite/src/hooks/use-permissions.ts`, and the HR roles that hold `employee`/`employeePii` (`hr_admin`/`hr_manager`/`payroll_officer`/`leave_approver`) are not yet in the frontend `memberRoles` union. The reveal + register controls correctly fail closed (absent) until that union is wired. Logged to `deferred-items.md`.
- **Files modified:** none (documented, not changed — see Known Stubs / deferred).
- **Verification:** `can('employeePii',['read'])` returns false for current member roles → reveal control absent (fail-safe, matches threat T-90-06-01).

**2. [Rule 3 - Blocking] Shared field primitives module**
- **Found during:** Task 1 (six field components)
- **Issue:** `RequiredLabel` / `FieldError` and the three-class feedback helpers are needed by all six market components; inlining per file would duplicate them six times.
- **Fix:** Added `field-primitives.tsx` (one shared module) exporting `RequiredLabel`, `FieldError`, `AdvisoryPill`, `AdviserVerifyNote`, `PiiRevealContext`.
- **Files modified:** apps/web-vite/src/components/employees/compliance/field-primitives.tsx
- **Verification:** typecheck + biome clean; not a `*-container.tsx`, presentational only.

**3. [Rule 3 - Blocking] Route wiring so the page is reachable**
- **Found during:** Task 2 (page)
- **Issue:** The plan scopes `employee-registration-page.tsx` but not a route; without wiring it the page is dead code.
- **Fix:** Repointed the existing `/employees` route (`pages/dashboard/employees.tsx`) from the flag-dark "coming soon" skeleton to `<EmployeeRegistrationPage />`.
- **Files modified:** apps/web-vite/src/pages/dashboard/employees.tsx
- **Verification:** typecheck clean; page renders null when the flag is OFF (render-tree removal preserved).

**4. [Tooling, non-source] i18n merge + worktree verification**
- The `Employees` i18n additions were merged via a one-off Node JSON-merge script in the scratchpad (round-trip byte-stable → additions-only diff, 143 insertions / 0 deletions per locale). The script lives outside the repo and was not committed.
- The worktree ships without `node_modules`; symlinked them from the main checkout (gitignored) purely to run `tsc` / `tsx` / `biome`. No source impact.

---

**Total deviations:** 3 documented (1 missing-critical surfaced as deferred, 2 blocking-support) + 1 tooling note.
**Impact on plan:** No scope creep. The RBAC-mirror item is the only behavioural gap and is a fail-safe (controls absent), pending the HR-roles frontend-union wiring in a follow-up.

## Known Stubs
- **Register + reveal controls are permission-gated to roles not yet in the frontend union.** `can('employee',['create'])` and `can('employeePii',['read'])` are false for all current `memberRoles`, so the Register button shows a muted "ask an HR administrator" note and the reveal control is absent. This is correct RBAC (server grants `employee`/`employeePii` only to HR roles + owner/admin for reveal), NOT a data stub — the surface, validation, dispatch, and i18n are fully wired. It activates automatically when the HR roles (`hr_admin` et al.) and the owner/admin `employeePii` grant are added to `apps/web-vite/src/hooks/use-permissions.ts` (tracked in `deferred-items.md`).

## Deferred manual-UAT (Task 3 human-verify)
Per the project LOCAL-ONLY posture (manual-UI verification deferred to post-deploy, never hard-blocking), the Task 3 human-verify checklist is recorded here for a human to run when the flag is enabled locally:
1. Switch market PL/DE/UK/US/AE/SA — field set changes per market and matches the research table.
2. Bad PESEL/NI/Steuer-IdNr → red inline error appears only after a complete-looking value and blocks save.
3. Format-valid Emirates ID with a wrong check digit → amber advisory pill, Save STILL allowed.
4. With `employeePii:read`, reveal a masked PESEL/SSN → full value only after click, not in cache, audit row written; without the permission the reveal control is ABSENT.
5. Toggle `module.workforce-employees` OFF → the entire `/employees` surface is render-tree removed (no skeleton, no disabled stub).
6. Locale ar (RTL) → layout mirrors correctly (logical properties) and all strings are translated (no raw keys).

## Issues Encountered
- Worktree lacked `node_modules` (fresh fork) so `tsx`/`tsc`/`biome` could not run initially; resolved by symlinking the main checkout's `node_modules` (gitignored). The `generated/i18n/keys` codegen artifact was absent (gitignored) causing 6 unrelated pre-existing tsc errors; ran `i18n:types` codegen → full web-vite typecheck exits 0 with zero errors, none in employee files.

## Automated acceptance evidence (gates)
- `pnpm check:web-vite-data-layer` — OK (hook-only tRPC boundary, no container)
- `pnpm check:web-vite-presentational` / `check:web-vite-page-shells` — OK
- `pnpm i18n:parity` — OK (en covered in de/pl/ar; en-US fallback-aware)
- `pnpm lint:no-breadcrumbs` — OK
- `tsc --noEmit` (web-vite) — exit 0, 0 errors
- `biome check` (fast + biome.ci.json) — clean on all new files
- RTL: no physical `ml/mr/pl/pr` classes in employee files (logical-only)

## Threat Flags
None new — the surface matches the plan's threat register (masked default + gated uncached reveal, flag-off removal, hook-only boundary). No new network endpoints or trust boundaries introduced by the UI.

## Next Phase Readiness
- UI surface complete and reachable behind `module.workforce-employees`.
- Follow-up needed before the surface is usable by real users: add `employee`/`employeePii` grants + the HR roles to the frontend `usePermissions` matrix + `memberRoles` union (mirror `packages/auth/src/roles.ts`).
- A wiki-synthesis pass (employees domain page + `structure/web-vite-domains.md`) is recommended per CLAUDE.md "documentation follows code" — deferred to the phase's wiki-synthesis plan.

## Self-Check: PASSED
- All 13 created source files present on disk; SUMMARY present.
- Both task commits found in git log: `85cc6bd52` (Task 1), `ce8ec1eb6` (Task 2).

---
*Phase: 90-theme-b-employee-registry-per-market-6*
*Completed: 2026-07-01*
