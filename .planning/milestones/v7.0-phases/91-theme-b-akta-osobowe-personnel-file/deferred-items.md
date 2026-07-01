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
