# Phase 91 — Deferred / Out-of-Scope Items

## 91-02 execution

- **Pre-existing `db:audit-enum-casing` offenders (NOT introduced by 91-02):**
  `prisma/schema/idp-deprovisioning.prisma` enum `ManualOverrideCategory` has 5
  lowercase values (`verified_via_vendor_console`, `user_already_inactive`,
  `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`).
  These pre-date this plan (Phase 76 idp-deprovisioning) and cause the whole
  `db:audit-enum-casing` script to exit non-zero. Out of scope for 91-02 (SCOPE
  BOUNDARY: only auto-fix issues directly caused by this task). The 91-02 enums
  (`PersonnelFileSection` SECTION_A..D, `PersonnelDocClassificationMethod`
  DETERMINISTIC/AI/MANUAL/PENDING) are correct UPPER_SNAKE and are absent from the
  offender list.

## 91-04 execution

- **Pre-existing `@contractor-ops/api` typecheck failures (NOT introduced by 91-04):**
  With the RBAC change in place, `pnpm --filter @contractor-ops/api typecheck` still
  fails — but every error is in `classification` / `pdf-templates` land and none
  reference `Permission`, `Resource`, `employeeFile`, `accessControlStatement`, or
  `roles`. Two root causes, both pre-existing: (1) `@contractor-ops/classification`
  does not build in a fresh worktree because its test files import missing sibling
  modules (`src/profiles/us/__tests__/rule-set.test.ts` → `../rule-set.js`,
  `scoring.test.ts` → `../scoring.js`), leaving no `dist` so `ir35-sds.tsx` and
  `classification-shared.ts` cannot resolve `@contractor-ops/classification`; and
  (2) strictness errors that stand alone — `drv-defense-bundle.tsx` / `ir35-sds.tsx`
  `possibly undefined` pills, and `classification-document-keys.ts` missing
  `US_DETERMINATION_LETTER` in `Record<ClassificationDocumentKind, string>`.
  Out of scope for 91-04 (auth-only; SCOPE BOUNDARY). The auth package itself is
  fully green: `typecheck` clean and all 278 tests pass.

- **Pre-existing `lint:no-breadcrumbs` offenders (NOT introduced by 91-04):**
  Four decision-ID comments flagged, all in files this plan never touched
  (`packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx:5`,
  `packages/api/src/services/__tests__/form-1042s.service.test.ts:5`,
  `.../form-1099k-tracker.service.test.ts:5`,
  `packages/classification/src/profiles/us/__tests__/scoring.test.ts:5`).
  The comments added by 91-04 (permissions.ts / roles.ts / auth tests) are clean.

- **Wiki `rbac-permissions.md` per-section grain:** the new `employeeFileA..D`
  resource-per-section RBAC is code-complete but the wiki page
  (`.planning/brain/wiki/patterns/rbac-permissions.md`, which lists
  `packages/auth/src/permissions.ts` + `roles.ts` under `verify_with`) is not
  updated here — phase 91 batches wiki synthesis into plan 91-12, matching the
  phase-89 pattern (89-06). 91-12 must document the per-section grain + BFLA fence.

## 91-03 execution

- **Pre-existing `@contractor-ops/classification` build failure (NOT introduced by
  91-03):** `packages/classification` fails `tsc` build because
  `src/profiles/us/__tests__/rule-set.test.ts` and `scoring.test.ts` import
  `../rule-set.js` / `../scoring.js`, but `src/profiles/us/rule-set.ts` and
  `scoring.ts` do not exist on the branch base. This cascades: classification dist
  is never produced, so `@contractor-ops/api` typecheck reports 27 pre-existing
  errors in classification-consuming files (`pdf-templates/ir35-sds.tsx`,
  `drv-defense-bundle.tsx`, `routers/compliance/classification-shared.ts`,
  `services/classification-document-keys.ts`, `routers/compliance/classification-draft.ts`,
  and the sds/drv fixtures). None touch 91-03's files. Out of scope (SCOPE BOUNDARY).
- **`packages/validators/src/legal/de.js` + `de.d.ts` build-artifact drift:** the
  committed compiled outputs of `de.ts` were reformatted (line-wrapping only) when
  `pnpm install` ran the `validators:build` postinstall in this fresh worktree.
  Pure environmental noise, unrelated to personnel files — left unstaged.
- **`personnel-retention.test.ts` (db) + `personnel-erasure.test.ts` (api) remain
  RED — by design, NOT this plan:** both are 91-01 RED scaffolds owned by later
  plans. `personnel-retention.test.ts`'s terminal-RED anchor is the missing
  `getPersonnelRetentionCutoff` resolver, which **91-05** builds
  (`packages/db/src/personnel-retention.ts`). 91-03 only owns the registry
  scaffold (`personnel-registry.test.ts`, now GREEN).

## 91-10 execution

- **Pre-existing `@contractor-ops/web-vite` typecheck offender (NOT introduced by
  91-10):** `src/components/contractors/classification/classification-tile.tsx:55`
  — `toneForOutcome` reports `TS2366: Function lacks ending return statement`. The
  file is not in this plan's diff (`git diff --name-only HEAD` excludes it). Out of
  scope (SCOPE BOUNDARY: only auto-fix issues directly caused by this task). All
  five new personnel-file files + the route registration add ZERO typecheck errors
  (verified: no error references `personnel-file/`, `personnel-file.tsx`, or the
  `employees/:workerId/personnel-file` route entry).
