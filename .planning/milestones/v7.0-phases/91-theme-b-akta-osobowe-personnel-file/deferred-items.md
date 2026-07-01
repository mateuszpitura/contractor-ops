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
