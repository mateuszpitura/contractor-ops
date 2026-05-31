---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
plan: 04
subsystem: integrations
tags: [idp, deprovisioning, okta, okta-sdk-nodejs, lifecycle, msw]

requires:
  - phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope
    provides: Deprovisionable interface, saga-canonicalize helpers
  - phase: 77-f2-idp-gws-slack-adapters-the-wedge
    provides: ImpactPreview union, classifyError, GWS/Slack adapter pattern
  - phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
    provides: OKTA scopes + ImpactPreview member + okta MSW handlers (78-01), classifier (78-02)
provides:
  - "OktaAdapter implements Deprovisionable via @okta/okta-sdk-nodejs v8 namespaced client"
affects: [78-06, 78-07]

tech-stack:
  added: []
  patterns: ["@okta/okta-sdk-nodejs v8 namespaced userApi client (API-token model)", "verify-first LIKELY_GONE short-circuit"]

key-files:
  created:
    - packages/integrations/src/adapters/okta-adapter.ts
  modified:
    - packages/integrations/src/adapters/__tests__/okta-deprovision.test.ts

key-decisions:
  - "API-token connection model (withCredentials orgUrl+token), includeTokenExpiry:false (KSeF/Clockify precedent)"
  - "SDK errors surface .status / .errorCode → classifyError({provider:'OKTA', httpStatus}); no-status errors treated as TRANSIENT_NETWORK"
  - "Best-effort describeImpact counts via SDK async-iterables (listUserGroups/listAppLinks/listUserIdentityProviders/userFactorApi.listFactors/roleAssignmentApi.listAssignedRolesForUser); unreachable → 0/[]"

patterns-established:
  - "Vendor-SDK Deprovisionable adapter whose HTTP is MSW-intercepted via the Node http module"

requirements-completed: [IDP-06]

duration: 12min
completed: 2026-05-31
---

# Phase 78 Plan 04: Okta Deprovisionable Adapter Summary

**OktaAdapter via the @okta/okta-sdk-nodejs v8 namespaced client — the straightforward IdP: deactivateUser (verify-first LIKELY_GONE short-circuit), revokeUserSessions, getUser-based verify, and best-effort app/factor/group/role/idp impact counts.**

## Performance
- **Duration:** ~12 min
- **Tasks:** 2
- **Files:** 2

## Accomplishments
- suspendAccount → `userApi.deactivateUser({ sendEmail:false })` with a verify-first short-circuit (already-DEPROVISIONED → LIKELY_GONE, no deactivate call)
- revokeAllSessions → `userApi.revokeUserSessions`; verifyDeprovisioned → `getUser` status DEPROVISIONED / 404 → true
- describeImpact populates assignedAppCount/enrolledFactorTypes/groupMembershipCount/adminRoles/linkedIdpCount via SDK async-iterables (best-effort)
- 10/10 tests GREEN (SDK→Node-http→MSW); token never logged; includeTokenExpiry:false

## Task Commits
1. **78-04-01: OktaAdapter** - `9ad26bb8` (feat)
2. **78-04-02: tests GREEN** - `c416a685` (test)

## Decisions Made
See key-decisions frontmatter. SDK method names verified against the installed 8.0.0 package surface before use.

## Deviations from Plan
None of substance — implemented per spec. The `describeImpact` list methods were verified against the real v8 SDK surface (`userApi.listUserGroups/listAppLinks/listUserIdentityProviders`, `userFactorApi.listFactors`, `roleAssignmentApi.listAssignedRolesForUser`) and used as-is.

**Total deviations:** 0 of substance.

## Issues Encountered
None.

## User Setup Required
None for the test suite (Okta org URL + API token are deploy-time connection credentials).

## Next Phase Readiness
- 78-06 can register OktaAdapter under provider key `OKTA` and wire its connection tRPC router (orgUrl + apiToken credential storage).

---
*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Completed: 2026-05-31*
