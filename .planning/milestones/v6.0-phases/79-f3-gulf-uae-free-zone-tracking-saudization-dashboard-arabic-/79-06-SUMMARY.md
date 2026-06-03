---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
plan: 06
subsystem: web-vite
tags: [gulf, free-zone, uae, ui, container-hook, rtl, scope-mismatch, noc, d-02, i18n-keys]

# Dependency graph
requires:
  - phase: 79-05
    provides: "gulf.freeZone tRPC namespace (getAssignment / upsertAssignment); contract.create surfaces permittedActivityScope; D-02 server-side AE field-list trim"
  - phase: 79-02
    provides: "UaeFreeZoneCode enum (10 zones + MAINLAND), FreeZoneAssignment model (client types; DB apply deferred)"
  - phase: 79-01
    provides: "check-rtl-logical-props.mjs guard (scans contractors/free-zone + saudization)"
provides:
  - "Free-zone assignment UI surface: Page-ready FreeZoneAssignmentContainer + presentational FreeZoneAssignmentForm + useFreeZoneAssignment hook (the only tRPC boundary) — GULF-01 UI"
  - "ScopeMismatchBanner — non-blocking --warning advisory with link to the engagement compliance list (GULF-03 / D-07)"
  - "D-02 UI removal: country-compliance-section AE branch no longer renders freeform tradeLicenseNumber / freeZone switch / tradeLicenseExpiry; mounts the structured free-zone form instead"
  - "26 new Contractors.freeZone.* i18n keys + 11 zone-label keys referenced (values populated in 79-08 / D-16)"
affects: [79-07 offboarding trajectory banner reuses the free-zone surface conventions, 79-08 populates the i18n keys + ar/RTL parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container/Hook/Component layering for the free-zone surface (ARCHITECTURE.md); hook is the sole useTRPC/useQuery/useMutation boundary (check:web-vite-data-layer green)"
    - "Router input/output types derived via inferRouterInputs/Outputs<AppRouter>['gulf']['freeZone'] — no hand-rolled DTOs, stays in sync with Plan 05"
    - "--warning advisory alert via Alert variant=default + border-warning/50 bg-warning/10 (mirrors leitweg-id-inline-selector) — no new alert variant invented"
    - "Locale-aware Link from i18n/navigation (href, auto-prefixes /:locale) for the compliance-list deep link"
    - "Child tRPC-bound container stubbed in the dispatch unit test (mirrors classification-tile / revalidate-vat mocks) when D-02 pulled a boundary into the view"

key-files:
  created:
    - apps/web-vite/src/components/contractors/free-zone/hooks/use-free-zone-assignment.ts
    - apps/web-vite/src/components/contractors/free-zone/free-zone-assignment-form.tsx
    - apps/web-vite/src/components/contractors/free-zone/free-zone-assignment-container.tsx
    - apps/web-vite/src/components/contractors/free-zone/scope-mismatch-banner.tsx
  modified:
    - apps/web-vite/src/components/contractors/country-compliance-section.tsx
    - apps/web-vite/src/components/contractors/__tests__/country-compliance-section.test.tsx

key-decisions:
  - "Native <Input type=\"date\"> for license expiry (not a calendar+popover) — matches the superseded freeform field, avoids physical-positioning utilities the RTL guard bans, satisfies the UI-SPEC 'calendar + date input' allowance with the simpler primitive."
  - "ISIC codes captured via a draft Input + Enter/comma/Add-button -> de-duplicated Badge tag list with a per-tag keyboard-accessible remove (44px-safe hit area, aria-label per code)."
  - "Free-zone form doubles as the create surface: an unrecorded assignment renders the form with empty fields (the focal zone Select invites the first selection — UI-SPEC 'Select a zone to begin'); a standalone FreeZoneAssignmentEmptyState is exported for callers that want a distinct empty panel."
  - "ScopeMismatchBanner takes { mismatch, complianceHref } props only — it is presentational and lives under free-zone/ so the RTL guard covers it; the contract-create flow (79-07 wiring) passes the Plan 05 permittedActivityScope.mismatch flag down."

requirements-completed: [GULF-01, GULF-03]

# Metrics
duration: 8min
completed: 2026-06-03
---

# Phase 79 Plan 06: UAE Free-Zone Assignment UI + Scope-Mismatch Advisory + D-02 Removal Summary

**Shipped the UAE free-zone assignment surface in web-vite as a Page-ready Container -> Hook -> presentational Form (zone Select focal point over 10 zones + Mainland, license number/category/expiry, permitted-activities text + ISIC code tags, single teal Save CTA), a non-blocking --warning scope-mismatch advisory banner linking to the engagement compliance list, and the D-02 removal of the old freeform UAE inputs from country-compliance-section — all copy via useTranslations (keys land in 79-08), RTL logical-properties only, full loading/empty/error states.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (both `type="auto"`)
- **Files:** 6 (4 created, 2 modified)
- **Commits:** 2 task commits + this metadata commit

## Accomplishments

### Task 1 — Free-zone form hook + container + presentational form (GULF-01) — `cf7ac922`
- **`use-free-zone-assignment.ts`** (the only tRPC boundary): `useQuery(gulf.freeZone.getAssignment)` for read, `useMutation(gulf.freeZone.upsertAssignment)` with `onSuccess` -> success toast + `invalidateQueries(getAssignment.queryKey)`, `onError` -> error toast. Returns `{ isLoading, isError, onRetry, data, save, isSaving }`. Input/output types derived from `inferRouterInputs/Outputs<AppRouter>['gulf']['freeZone']` so the form stays in lockstep with the Plan 05 contract.
- **`free-zone-assignment-form.tsx`** (presentational, props-in/JSX-out): zone `Select` as the first interactive element / focal point (11 `UaeFreeZoneCode` values: DIFC, DMCC, IFZA, DUBAI_INTERNET_CITY, DUBAI_MEDIA_CITY, MEYDAN_FZ, JAFZA, SHAMS, RAKEZ, ADGM, MAINLAND), license number/category inputs, `type="date"` expiry, permitted-activities `Textarea`, ISIC-code badge-tag input (Enter/comma/Add -> de-duped removable `Badge` list), single teal `Save` CTA (the only accent). `useId` for a11y, `tabular-nums` on numeric fields, logical props only.
- **`free-zone-assignment-container.tsx`** (decisive): branches loading -> field-shaped `Skeleton`, error -> `--warning` retry card, success -> spreads into the form (an empty assignment renders the form ready to create). Exports `FreeZoneAssignmentEmptyState` for the UI-SPEC standalone empty panel.

### Task 2 — Scope-mismatch banner + D-02 freeform hide (GULF-03 / D-02) — `eabb0039`
- **`scope-mismatch-banner.tsx`**: `Alert variant="default"` styled `border-warning/50 bg-warning/10` (the established non-blocking advisory pattern — NOT `--destructive`), `AlertTriangle` icon, advisory heading + body, and a locale-aware `Link` to the engagement compliance list. Renders only when `mismatch` is true; never gates creation (D-07). Advisory tone, no determination asserted (T-79-06-03).
- **`country-compliance-section.tsx`** (D-02): the AE branch `UaeFields` no longer renders the freeform `tradeLicenseNumber` / `freeZone` switch / `tradeLicenseExpiry` inputs (superseded by the structured `FreeZoneAssignment`). Kept `freelancePermitNumber` (the only field the Plan 05 server config still lists for AE) and mounted `FreeZoneAssignmentContainer`. Dropped the now-unused `Switch` import. The Saudi branch and unrelated fields are untouched (D-17).
- **`country-compliance-section.test.tsx`**: stubbed `free-zone-assignment-container` like the other tRPC-bound child containers and tightened the AE test to assert the free-zone surface mounts and the old `Trade License Number` input is gone.

## Verification

- `pnpm check:web-vite-data-layer` — OK (no tRPC outside the hook)
- `pnpm check:web-vite-presentational` — OK
- `pnpm check:web-vite-page-shells` — OK
- `pnpm check:rtl-logical-props` — OK (4 Gulf surface files scanned; zero physical-direction utilities)
- `pnpm --filter @contractor-ops/web-vite exec tsc --noEmit` — **zero errors in the touched files** (the 4 remaining errors are pre-existing in `use-dashboard-shell.ts`, logged in `deferred-items.md`, out of scope per D-17).
- Scoped tests green: `country-compliance-section.test.tsx` 207/207, `tab-compliance.test.tsx` 198/198 (memory-safe path-scoped runs).

### Acceptance criteria (plan greps)
- tRPC calls in form + container: **0** (boundary respected).
- `gulf.freeZone` references in hook: **4** (>= 1).
- physical-direction `ml-/mr-/pl-/pr-` in `free-zone/*.tsx`: **0**.
- `useTranslations` in form: **3** (>= 1); no hardcoded user-facing string literals.
- `warning` in banner: **3**; `--destructive` styling: **0** (the one "destructive" token is the doc comment "NOT --destructive").

## New i18n keys referenced (NOT populated — 79-08 / D-16)

All under the **`Contractors.freeZone`** namespace. `i18n:parity` was intentionally NOT run (keys are added now, values land in 79-08 with real en/de/pl/ar).

| Sub-namespace | Keys |
|---------------|------|
| `.form` | `title`, `description`, `zoneLabel`, `zonePlaceholder`, `licenseNumberLabel`, `licenseNumberPlaceholder`, `licenseCategoryLabel`, `licenseCategoryPlaceholder`, `licenseExpiresAtLabel`, `licenseExpiresAtHelp`, `permittedActivitiesLabel`, `permittedActivitiesPlaceholder`, `isicCodesLabel`, `isicCodesPlaceholder`, `isicCodesHelp`, `isicAddButton`, `isicRemoveLabel` (takes `{ code }`), `saveButton` ("Save free-zone assignment") |
| `.zones` | one key per `UaeFreeZoneCode`: `DIFC`, `DMCC`, `IFZA`, `DUBAI_INTERNET_CITY`, `DUBAI_MEDIA_CITY`, `MEYDAN_FZ`, `JAFZA`, `SHAMS`, `RAKEZ`, `ADGM`, `MAINLAND` (zone authority legal names where shown come from LOCKED_AE_PHRASES — D-14, not these keys) |
| `.empty` | `heading` ("No free-zone assignment recorded"), `body` ("...Select a zone to begin.") |
| `.error` | `loadHeading`, `loadBody`, `retry` |
| `.toast` | `saved`, `saveFailed` |
| `.scopeMismatch` | `heading`, `body` (the UI-SPEC advisory copy), `viewComplianceLink` |

**79-08 owners:** populate all of the above with genuine de/pl/ar values (D-16). The `.zones` labels are user-facing display names; the legal authority names (if surfaced) stay in `LOCKED_AE_PHRASES`.

## Decisions Made

- **Date input over calendar popover** for license expiry — RTL-safe (no physical positioning the guard bans), consistent with the superseded freeform field, and within the UI-SPEC "calendar + date input" allowance.
- **Form-as-create** — no separate "add" mode; an empty assignment renders the form with the focal zone Select empty, matching the UI-SPEC empty-state intent ("Select a zone to begin"). A distinct `FreeZoneAssignmentEmptyState` is exported for callers that prefer a separate panel.
- **Types from the router**, not hand-rolled — `inferRouterInputs/Outputs<AppRouter>` keeps the form aligned to Plan 05 and erases at build time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong Link import + non-existent token in the scope-mismatch banner**
- **Found during:** Task 2 (writing the banner)
- **Issue:** First draft imported `Link` from `react-router` with a `to` prop and used a `text-warning-foreground` class. This codebase uses a locale-aware `Link` from `apps/web-vite/src/i18n/navigation.ts` (prop `href`, auto-prefixes `/:locale`), and `--warning-foreground` is not a defined token.
- **Fix:** Imported `Link` from `../../../i18n/navigation.js` with `href`; dropped the non-existent class (kept `text-warning` on the icon + `text-primary` on the link, matching the leitweg-id advisory precedent).
- **Files modified:** `apps/web-vite/src/components/contractors/free-zone/scope-mismatch-banner.tsx`
- **Committed in:** `eabb0039`

**2. [Rule 1 - Bug] D-02 mount broke 2 dispatch tests (tRPC boundary pulled into a unit-scoped view)**
- **Found during:** Task 2 (scoped test run after the D-02 edit)
- **Issue:** Mounting `FreeZoneAssignmentContainer` in the AE branch made the presentational `country-compliance-section` dispatch test render a real `useTRPC()` call with no stub — 2 AE tests failed at `useTRPC()`.
- **Fix:** `vi.mock`-stubbed `free-zone-assignment-container.js` (same pattern the test already uses for `classification-tile-container` and `revalidate-vat-button-container`) and strengthened the AE test to assert the free-zone surface mounts and the removed `Trade License Number` input is absent.
- **Files modified:** `apps/web-vite/src/components/contractors/__tests__/country-compliance-section.test.tsx`
- **Verification:** 207/207 green.
- **Committed in:** `eabb0039`

**Total deviations:** 2 auto-fixed (both Rule 1, both directly caused by this plan's changes). No scope creep beyond the plan's listed files plus the one test mock the D-02 mount made necessary.

## Issues Encountered

- **Pre-existing web-vite tsc errors (NOT 79-06):** 4 × `TS2339` in `apps/web-vite/src/components/layout/hooks/use-dashboard-shell.ts:42` on the `audit/post-migration-parity` baseline (active-org member shape narrows to `{ isDemo: boolean }`). Unrelated to the Gulf surface; the free-zone files produce zero tsc errors. Logged in `deferred-items.md`; not fixed (D-17 scope boundary).
- **Unrelated in-flight tree changes:** the working tree carries an unrelated `demo-readonly-mode` effort (many `M`/`??` files in `packages/api`, `.env.example`, etc.). Only the 6 free-zone/country-compliance files were staged per-task; nothing else was touched or committed.

## Known Stubs

None. The form, container, hook, and banner are fully wired to the live `gulf.freeZone` router. The only intentionally-deferred work is the i18n *values* (79-08 / D-16) — the keys are referenced and listed above; the surface renders the key paths until 79-08 populates them, which is the planned wave order.

## Threat Flags

None. No new security surface beyond the plan's `<threat_model>`. All writes go through the Plan 05 tenant-scoped, Zod-validated `gulf.freeZone.upsertAssignment` (the form is presentational — T-79-06-01); the advisory banner is non-blocking and informational (D-07); RTL logical-props-only is guard-enforced (T-79-06-02); advisory copy is i18n-keyed with adviser-deferring tone (T-79-06-03); no package installs (T-79-06-SC — in-tree shadcn primitives only).

## Self-Check: PASSED

*(verified below)*
