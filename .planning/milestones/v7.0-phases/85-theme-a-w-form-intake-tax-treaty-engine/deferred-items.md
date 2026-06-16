# Phase 85 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are outside the current task's scope.
Per the executor scope boundary, only issues DIRECTLY caused by this plan's changes
are auto-fixed; pre-existing offenders in untouched files are recorded here, not fixed.

## Plan 85-01

- **Pre-existing enum-casing offenders** — `db:audit-enum-casing` flags 5 values on
  `enum ManualOverrideCategory` in `packages/db/prisma/schema/idp-deprovisioning.prisma`
  (lines 117-121: `verified_via_vendor_console`, `user_already_inactive`,
  `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`).
  These are lower_snake, not UPPER_SNAKE. The file is UNMODIFIED by this plan
  (introduced in Phase 76). The two new enums added here (`TaxFormType`,
  `TaxFormStatus`) are correct UPPER_SNAKE and are NOT in the offender list.
  Fixing `ManualOverrideCategory` would be a value rename + data migration on an
  unrelated domain — out of scope for 85-01.

## Plan 85-02

- **Pre-existing `locked-phrases-guard` failure** — the full `@contractor-ops/validators`
  suite has one failing test: `messages/de.json uses formal "Sie" register (no Du/Dir/Dein…)`
  in `packages/validators/src/__tests__/locked-phrases-guard.test.ts`. Plan 85-02 touches
  only `packages/api/src/services/*` (treaty-rate, tax-form-routing) and
  `packages/validators/src/w-form-validators.ts` — NO `de.json` is modified by any 85-02
  commit. The failure is in a German translation file outside this plan's change set and
  is therefore out of scope per the executor scope boundary (only issues directly caused
  by this plan's changes are auto-fixed). All 85-02 scoped test files pass.

## Plan 85-03

- **Pre-existing branch-level doc-drift (NOT caused by 85-03)** — `check:wiki-brain`
  flags three pages for source files that earlier `audit/post-migration-parity`
  commits (e.g. `bf742ca95`, `9cde858b0`) changed without updating the owning page,
  PLUS unstaged working-tree edits left by a prior session:
    - `apps/web-vite/messages/ar.json` → `patterns/i18n-and-locales.md`
    - `packages/feature-flags/src/evaluator.ts` → `structure/packages.md`
    - `packages/validators/src/legal/de.d.ts.map` (generated `.d.ts.map` artifact)
      → `patterns/validators-boundaries.md`
  None of these files is in any 85-03 commit — the plan only touches
  `packages/api/src/{services,routers,middleware,errors}` plus the W-form wiki pages.
  All 8 drift errors that 85-03 *did* cause (`tax-form.service.ts`,
  `portal-tax-form-router.ts`, `root.ts`) were fixed in the same change set
  (portal-external, api-routers-catalog, api-router-groups, key-services, packages,
  classification-ir35). The remaining three are pre-existing branch/working-tree
  drift, out of scope per the executor scope boundary (CLAUDE.md: only NEW drift vs
  the branch base retro-bricks; these predate the plan).
