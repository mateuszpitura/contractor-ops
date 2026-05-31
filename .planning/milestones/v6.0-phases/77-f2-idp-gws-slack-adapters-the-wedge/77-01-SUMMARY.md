---
phase: 77-f2-idp-gws-slack-adapters-the-wedge
plan: 01
subsystem: api
tags: [idp, deprovisioning, prisma, feature-flags, permissions, typescript]

requires:
  - phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope
    provides: Deprovisionable interface, idp-deprovisioning.prisma schema, scopes barrel, IDP_AUDIT_ALLOWED_FIELDS, idp-saga deriveRunStatus
provides:
  - DeprovisionResultStatus extended with LIKELY_GONE + optional skipped/reason/errorClass on DeprovisionResult
  - Deprovisionable.describeImpact (4th required interface method)
  - ImpactPreview discriminated union (GOOGLE_WORKSPACE | SLACK) + custom-metrics types
  - ErrorClass closed-enum + pure classifyError fn
  - SLACK_DEPROVISION_SCOPES typed-const
  - additive Prisma schema (MANUAL_COMPLETED + ErrorClass + ManualOverrideCategory + 5 columns) + create-only migration SQL
  - idp:override_step_failure permission (owner + admin)
  - module.idp-deprovisioning-gws / -slack feature flags (ship dark, PENDING signoff)
  - IDP_AUDIT_ALLOWED_FIELDS extended with errorClass/manualOverrideCategory/manualOverriddenByUserId
  - idp-saga deriveRunStatus treats MANUAL_COMPLETED as terminal-success
affects: [77-02, 77-03, 77-04, 77-05, 78]

tech-stack:
  added: []
  patterns:
    - "Additive contract extension — interface methods + enum values appended, never rewritten"
    - "Dot-namespaced feature-flag keys (module.idp-deprovisioning-*) to satisfy FlagKey regex + gated-prefix"

key-files:
  created:
    - packages/integrations/src/idp/error-classifier.ts
    - packages/integrations/src/idp/impact-preview.ts
    - packages/integrations/src/idp/index.ts
    - packages/integrations/src/scopes/slack-deprovision-scopes.ts
    - packages/integrations/src/__tests__/error-classifier.test.ts
    - packages/integrations/src/__tests__/impact-preview-union.test.ts
    - packages/db/prisma/schema/migrations/20260531184805_phase77_idp_manual_override_errorclass/migration.sql
    - packages/db/src/__tests__/idp-deprovisioning-phase77-schema.test.ts
    - packages/feature-flags/src/__tests__/idp-deprovisioning-flags.test.ts
  modified:
    - packages/integrations/src/types/deprovisionable.ts
    - packages/integrations/src/types/index.ts
    - packages/integrations/src/adapters/google-workspace-adapter.ts
    - packages/integrations/src/__tests__/deprovisionable-contract.test.ts
    - packages/integrations/src/scopes/index.ts
    - packages/db/prisma/schema/idp-deprovisioning.prisma
    - packages/db/scripts/README.md
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/feature-flags/src/flags-core.ts
    - packages/feature-flags/src/signoff-registry-flags.json
    - packages/feature-flags/src/signoff-registry-flags.ts
    - packages/logger/src/idp-audit-logger.ts
    - packages/idp-saga/src/types.ts
    - packages/idp-saga/src/run-status.ts

key-decisions:
  - "Feature-flag keys are module.idp-deprovisioning-gws / -slack (dot-namespaced) — the plan's bare idp-deprovisioning-gws fails the FlagKey regex; added a module.idp-deprovisioning gated prefix so the boot signoff-gate still covers them."
  - "describeImpact shipped as a REQUIRED interface method (not optional) per D-01; GWS adapter + test adapter got placeholder impls so the package compiles until 77-02/77-03 implement them."
  - "MANUAL_COMPLETED terminal-success wiring (D-11) implemented in idp-saga run-status.ts this plan — the additive Prisma enum value broke recomputeRunStatus' StepRow typing; threat T-77-01-01 authorizes this."
  - "Multi-region migration runner is migrate-all-regions.ts (plan referenced a non-existent push-all-regions.ts); README adapted to the real script."

patterns-established:
  - "ErrorClass (integrations literal union) and ErrorClass (Prisma enum) are kept value-identical, mirrored by hand — no shared source."

requirements-completed: [IDP-03, IDP-04, IDP-12]

duration: 16min
completed: 2026-05-31
---

# Phase 77 Plan 01: IdP additive contract + schema + permission + flag foundation Summary

**Additive type/schema/permission/flag plumbing for the GWS+Slack deprovisioning wedge: `describeImpact` + `LIKELY_GONE` + `ImpactPreview` union + `ErrorClass` classifier + Slack scopes + `MANUAL_COMPLETED`/errorClass Prisma columns + `idp:override_step_failure` + two ship-dark per-provider flags — with the run-status D-11 reconciliation.**

## Performance
- **Duration:** 16 min
- **Started:** 2026-05-31T18:42:20Z
- **Completed:** 2026-05-31T18:58:31Z
- **Tasks:** 10 (+1 cross-phase reconciliation)
- **Files modified/created:** 24

## Accomplishments
- Extended the Phase 76 `Deprovisionable` contract additively: `DeprovisionResultStatus` gains `LIKELY_GONE`; `DeprovisionResult` gains optional `skipped`/`reason`/`errorClass`; the interface gains the required `describeImpact` method.
- New `idp/` module: `ImpactPreview` discriminated union (D-01) + the pure `classifyError`/`ErrorClass` closed-enum classifier (D-07/D-08).
- Slack deprovision scope typed-const (D-14); additive Prisma schema (`MANUAL_COMPLETED` + `ErrorClass` + `ManualOverrideCategory` enums + 5 nullable `DeprovisioningStep` columns) with a create-only, fully-additive migration.
- `idp:override_step_failure` permission granted to owner + admin only (D-12); two ship-dark, PENDING-signoff per-provider feature flags (D-15); audit-logger allow-list extended with three non-PII fields.
- Reconciled `deriveRunStatus` to treat `MANUAL_COMPLETED` as terminal-success (D-11).

## Task Commits
1. **77-01-03 error classifier** - `8f571ed8` (feat)
2. **77-01-02 ImpactPreview union + idp barrel** - `16f7f605` (feat)
3. **77-01-01 Deprovisionable contract extension** - `594c783b` (feat)
4. **77-01-04 Slack deprovision scopes** - `d8d684cf` (feat)
5. **77-01-10 impact-preview-union test** - `6adca448` (test)
6. **77-01-05 additive Prisma schema + migration** - `96f1ca2d` (feat)
7. **77-01-06 phase77 schema test + phase76 fix** - `4930fa36` (test)
8. **77-01-07 idp override permission** - `9ae5ab7c` (feat)
9. **77-01-08 per-provider flags** - `14cc395b` (feat)
10. **77-01-09 audit-logger fields** - `019c8fcb` (feat)
11. **run-status MANUAL_COMPLETED reconciliation** - `3954caed` (fix)

## Decisions Made
See `key-decisions` frontmatter. The two substantive ones: dot-namespaced flag keys (regex constraint) and shipping `describeImpact` as a required method with placeholder adapter impls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `describeImpact` placeholder impls on existing adapters**
- **Found during:** Task 77-01-01 (contract extension)
- **Issue:** Adding a required `describeImpact` to `Deprovisionable` broke compilation of the existing `GoogleWorkspaceAdapter` (Phase 76) and the contract test adapter.
- **Fix:** Added a throwing placeholder on `GoogleWorkspaceAdapter` (real impl lands in 77-02) and a valid stub on `TestDeprovisionableAdapter`.
- **Files modified:** google-workspace-adapter.ts, deprovisionable-contract.test.ts
- **Committed in:** `594c783b`

**2. [Rule 3 - Blocking] Feature-flag keys dot-namespaced**
- **Found during:** Task 77-01-08 (flags)
- **Issue:** The plan's `idp-deprovisioning-gws` key fails the `flagDefinitionSchema` FlagKey regex (`evaluator.test.ts` parses every def).
- **Fix:** Keys are `module.idp-deprovisioning-gws` / `-slack`; added a `module.idp-deprovisioning` gated prefix so the boot signoff-gate still requires their PENDING entries.
- **Files modified:** flags-core.ts, signoff-registry-flags.ts, signoff-registry-flags.json
- **Committed in:** `14cc395b`

**3. [Rule 1 - Bug] Stale test assertions updated for additive changes**
- **Found during:** Tasks 77-01-06, 77-01-09
- **Issue:** Phase 76's `idp-deprovisioning-schema.test.ts` asserted the step-status enum had exactly 4 values; `idp-audit-logger.test.ts` asserted the allow-list deeply-equalled the Phase-70 9-field array (already stale vs Phase 76's 17 fields). Both broke under additive extension.
- **Fix:** Relaxed the enum-count assertion to a contains-check; updated the allow-list `.toEqual` to the full 70+76+77 field set.
- **Files modified:** idp-deprovisioning-schema.test.ts, idp-audit-logger.test.ts
- **Committed in:** `4930fa36`, `019c8fcb`

**4. [Rule 3 - Blocking] idp-saga run-status MANUAL_COMPLETED reconciliation**
- **Found during:** monorepo `pnpm typecheck`
- **Issue:** The additive Prisma `MANUAL_COMPLETED` enum value made `recomputeRunStatus`' `findMany({ select: { status } })` no longer assignable to `StepRow.status` (hand-typed `StepStatus`), failing `@contractor-ops/idp-saga` typecheck.
- **Fix:** Added `MANUAL_COMPLETED` to `StepStatus` and updated `deriveRunStatus` to treat it as terminal-success (D-11), with new tests. This is the key_link the plan declared (Phase 76 D-02/D-11).
- **Files modified:** idp-saga/src/types.ts, idp-saga/src/run-status.ts, idp-saga/src/__tests__/run-status.test.ts
- **Committed in:** `3954caed`

---

**Total deviations:** 4 (3 blocking auto-fixes, 1 stale-test fix). **Impact:** All necessary for correctness/compilation; the run-status change realizes a plan-declared key_link. No scope creep.

## Issues Encountered
- `lint:schema` reports ONE pre-existing offence (`UserPinnedView` in auth.prisma) unrelated to this plan — documented since Phase 75, out of scope. My `DeprovisioningStep` additions declare `organizationId` and are not flagged.

## Authentication Gates
None.

## User Setup Required
**POST-DEPLOY MANUAL STEP (deferred — autonomous:false reason):** the additive migration `20260531184805_phase77_idp_manual_override_errorclass` is generated and committed but NOT applied to the live databases. An operator must apply it to EU + ME per the LOCAL-ONLY Standing Constraint:
```sh
npx tsx packages/db/scripts/migrate-all-regions.ts   # or: cd packages/db && pnpm run db:migrate:all
```
Documented in `packages/db/scripts/README.md` (Phase 77 section).

## Next Phase Readiness
- The full contract surface for 77-02 (GWS `describeImpact`), 77-03 (Slack adapter), 77-04 (backend + step-runner), 77-05 (UI) is in place.
- 77-02 MUST replace `GoogleWorkspaceAdapter.describeImpact`'s throwing placeholder with the real cached Admin-SDK implementation.

---
*Phase: 77-f2-idp-gws-slack-adapters-the-wedge*
*Completed: 2026-05-31*
