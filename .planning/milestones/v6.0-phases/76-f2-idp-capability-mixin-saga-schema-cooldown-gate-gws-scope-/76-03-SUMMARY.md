---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 03
subsystem: api
tags: [integrations, deprovisionable, oauth-scopes, audit-logger, typescript]

requires:
  - phase: 76
    provides: "Plan 76-01 deprovisionable-contract + idp-audit-logger-fields RED scaffolds"
  - phase: 70
    provides: "IDP_AUDIT_ALLOWED_FIELDS (D-15), ScopeCapabilities CapabilityEnum (D-13)"
provides:
  - "Deprovisionable interface + DeprovisionResult/FailureKind types (D-13)"
  - "GWS deprovision scope + capability typed-consts (D-14)"
  - "registerDeprovisionableAdapter/getDeprovisionableAdapter compile-time registry (SC#5)"
  - "8 new IDP_AUDIT_ALLOWED_FIELDS (D-15)"
affects: [76-07, 76-08, 76-09]

tech-stack:
  added: []
  patterns: ["compile-time adapter conformance via BaseAdapter & Deprovisionable registry signature", "scope/capability typed-const with satisfies readonly CapabilityEnum[]"]

key-files:
  created:
    - packages/integrations/src/types/deprovisionable.ts
    - packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts
    - packages/integrations/src/scopes/index.ts
  modified:
    - packages/integrations/src/types/index.ts
    - packages/integrations/src/registry.ts
    - packages/integrations/src/__tests__/deprovisionable-contract.test.ts
    - packages/logger/src/idp-audit-logger.ts

key-decisions:
  - "GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES uses 'directory.write' not the plan's 'directory.user.write' — the latter is NOT a member of the db CapabilityEnum union (directory.read|directory.write|user.deprovision|user.suspend|group.read|group.write|audit.read). Enforced via `satisfies readonly CapabilityEnum[]`."
  - "DeprovisioningProviderId duplicated as a type-level union in registry.ts (no circular dep on idp-saga; literals stable) — matches the Prisma enum"
  - "integrations package uses NodeNext .js import extensions (vs idp-saga Bundler/extensionless) — matched the package convention"

patterns-established:
  - "Registry signature `BaseAdapter & Deprovisionable` rejects non-conforming adapters at the register call site — Phase 78 Entra missing revokeAllSessions will not compile"

requirements-completed: [IDP-08, IDP-10, IDP-14]

duration: 8 min
completed: 2026-05-31
---

# Phase 76 Plan 03: Deprovisionable Interface + Scope Registry Summary

**`Deprovisionable` compile-time contract + GWS minimum-privilege scope/capability typed-consts + a `BaseAdapter & Deprovisionable` registry that rejects non-conforming adapters at the call site, plus 8 saga audit fields on the IdP audit allow-list.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-31T16:48:00Z
- **Completed:** 2026-05-31T16:53:00Z
- **Tasks:** 6
- **Files:** 3 created + 4 modified

## Accomplishments
- `Deprovisionable` interface (suspendAccount / revokeAllSessions / verifyDeprovisioned) + `DeprovisionResult`, `DeprovisionResultStatus`, `DeprovisionFailureKind` — re-exported from the types barrel.
- GWS deprovision scope const (`admin.directory.user`) + capability const (`user.deprovision`, `directory.write`) validated against `CapabilityEnum`.
- `registerDeprovisionableAdapter` / `getDeprovisionableAdapter` / `_resetDeprovisionableAdapters` with compile-time `BaseAdapter & Deprovisionable` enforcement + double-registration throw.
- `IDP_AUDIT_ALLOWED_FIELDS` extended with runId, stepId, stepKind, requestSha256, responseSha256, attempts, failureKind, matchedProvenanceId (all non-PII).
- deprovisionable-contract test flipped RED → 6 GREEN; logger idp-audit-logger-fields flipped 8 RED → 8 GREEN.

## Task Commits

1. **76-03-01..06: interface + scopes + registry + audit fields + test flip** — `555a5a01` (feat)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`. Material: capability enum spelling (`directory.write`, not `directory.user.write`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's capability literal `directory.user.write` is invalid**
- **Found during:** Task 76-03-03 (plan flagged this in read_first)
- **Issue:** `directory.user.write` is not a member of the db `CapabilityEnum` union; using it would either fail typecheck (with `satisfies`) or silently drift from the typed capability system.
- **Fix:** Used `directory.write` (the real enum value granting write access) and added `satisfies readonly CapabilityEnum[]` so the const is compile-time-validated. Updated the test assertion accordingly.
- **Verification:** integrations typecheck 0; deprovisionable-contract 6 GREEN.
- **Committed in:** `555a5a01`
- **Downstream note:** Plans 76-08 (banner) + 76-01 OAuth-callback scaffold reference `directory.user.write` in copy/text — those will be reconciled to `directory.write` when 76-08 lands.

---

**Total deviations:** 1 auto-fixed (1 bug — plan-flagged)
**Impact on plan:** No scope creep. Interface + registry shapes match RESEARCH §"DeprovisionResult type shape" exactly.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 76-08 (GWS getOAuthConfig + banner + OAuth callback) imports the scope/capability consts — must use `directory.write`.
- Plan 76-09 (GWS adapter `implements Deprovisionable`) has its interface + registry helper.
- Plan 76-07 (lint:scopes guard) has the typed-const to enforce against.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
