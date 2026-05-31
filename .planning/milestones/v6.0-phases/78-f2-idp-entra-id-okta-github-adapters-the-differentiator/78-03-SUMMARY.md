---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
plan: 03
subsystem: integrations
tags: [idp, deprovisioning, entra, microsoft-graph, conditional-access, hybrid-ad, msw]

requires:
  - phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope
    provides: Deprovisionable interface, DeprovisionResult, saga-canonicalize helpers
  - phase: 77-f2-idp-gws-slack-adapters-the-wedge
    provides: ImpactPreview union, classifyError, GWS/Outlook adapter pattern
  - phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
    provides: ENTRA scopes + ImpactPreview member + entra MSW handlers (78-01), classifier (78-02)
provides:
  - "EntraIdAdapter implements Deprovisionable (raw Graph, no SDK dep)"
  - "Hybrid-AD HARD BLOCK pre-flight (onPremisesSyncEnabled) — zero write calls when on-prem authoritative"
  - "Conditional Access NON-BLOCKING warning via describeImpact"
  - "Single delayed signInActivity forensic poll (never fails the step)"
affects: [78-06, 78-07]

tech-stack:
  added: []
  patterns: ["raw Microsoft Graph fetch (OutlookCalendarAdapter pattern) + local encodeMicrosoftClientRequestId", "pre-flight hard-block gate before mutation"]

key-files:
  created:
    - packages/integrations/src/adapters/entra-id-adapter.ts
  modified:
    - packages/integrations/src/adapters/__tests__/entra-deprovision.test.ts

key-decisions:
  - "Provider discriminant ENTRA (matches Prisma DeprovisioningProvider + saga key); cacheKey label uses ENTRA_ID per D-11"
  - "Hybrid-AD block uses failureKind PROVIDER_ERROR + errorMessage 'On-prem AD authoritative — revoke at source' (DeprovisionFailureKind is a closed Phase-76 enum without HYBRID_AD_AUTHORITATIVE; plan permitted reusing the closest kind + descriptive message)"
  - "Token carried via withAccessToken (GWS/Slack instance pattern); raw fetch (not the @okta/@octokit SDK route) per the OutlookCalendarAdapter Graph precedent; no @microsoft/microsoft-graph-client dependency"
  - "signInActivity poll uses a single setTimeout(2s) delay; tests drive it with vi.useFakeTimers + advanceTimersByTimeAsync"

patterns-established:
  - "Pre-flight read → hard-block-on-condition → mutate, with the block recording request/response hashes for audit"

requirements-completed: [IDP-05]

duration: 22min
completed: 2026-05-31
---

# Phase 78 Plan 03: Entra ID Deprovisionable Adapter Summary

**EntraIdAdapter via raw Microsoft Graph — the differentiator's hardest adapter: a hybrid-AD HARD BLOCK that refuses to disable an on-prem-authoritative account (zero writes), a non-blocking Conditional Access warning, and a single forensic signInActivity poll, all atop the standard suspend/revoke/verify.**

## Performance
- **Duration:** ~22 min
- **Tasks:** 2
- **Files:** 2 (1 adapter + 1 test flipped GREEN)

## Accomplishments
- Hybrid-AD pre-flight: reads `onPremisesSyncEnabled` BEFORE any mutation; `true` → FAILED with "On-prem AD authoritative — revoke at source" and zero PATCH/POST (SC#4, unit-asserted)
- Conditional Access enumeration as a non-blocking describeImpact warning (only enabled + applicable policies surfaced; `hasSessionControls` flagged — Pitfall 14)
- suspend → PATCH accountEnabled:false; revoke → POST revokeSignInSessions + single delayed signInActivity poll (forensic, never fails the step); verify → accountEnabled false / 404
- 11/11 tests GREEN against Graph MSW; no `@microsoft/microsoft-graph-client` dep; no console.*

## Task Commits
1. **78-03-01: EntraIdAdapter** - `b61875d2` (feat)
2. **78-03-02: tests GREEN** - `3a1e85ab` (test)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] failureKind HYBRID_AD_AUTHORITATIVE not in the closed enum**
- **Found during:** Task 78-03-01
- **Issue:** Plan suggested `failureKind: 'HYBRID_AD_AUTHORITATIVE'`, but `DeprovisionFailureKind` (Phase 76) is a closed union without it; the plan explicitly permitted reusing the closest kind.
- **Fix:** `failureKind: 'PROVIDER_ERROR'` + `errorClass: 'PERMANENT_FORBIDDEN'` + the descriptive `errorMessage`/`reason: 'hybrid_ad_authoritative'`. Tests assert on the message + reason.
- **Committed in:** b61875d2

**2. [Rule 1 - Bug] Provider discriminant ENTRA (not ENTRA_ID)**
- **Found during:** Task 78-03-01
- **Issue:** The ImpactPreview member uses `provider: 'ENTRA'` (78-01 reconciliation to the Prisma/saga key). The cacheKey retains the `ENTRA_ID` label per the plan's D-11 spec.
- **Fix:** `provider: 'ENTRA'`, `cacheKey: co:idp:preview:ENTRA_ID:{id}`.
- **Committed in:** b61875d2

---

**Total deviations:** 2 (both binding the plan to the shipped 76/77 reality). No scope creep.
**Impact on plan:** All gates delivered and tested; the closed-enum constraint respected.

## Issues Encountered
None.

## User Setup Required
Entra app registration env vars (`ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`) are referenced by the OAuth config but are a deploy-time concern; not required for the LOCAL-ONLY test suite.

## Next Phase Readiness
- 78-06 can register EntraIdAdapter under the saga provider key `ENTRA` and wire its connection tRPC router.

---
*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Completed: 2026-05-31*
