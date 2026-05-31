---
phase: 77-f2-idp-gws-slack-adapters-the-wedge
plan: 02
subsystem: integrations
tags: [idp, deprovisioning, google-workspace, msw, adapter]

requires:
  - phase: 77-01
    provides: Deprovisionable.describeImpact, ImpactPreview union, classifyError/ErrorClass, DeprovisionResult.subActions
provides:
  - GoogleWorkspaceAdapter real Deprovisionable impl (suspend, two-sub-action revoke, verify, describeImpact)
  - GWS admin.directory.user.security scope
  - GWS MSW deprovision handlers (suspend/get/tokens/signOut/drives)
affects: [77-04, 77-05]

tech-stack:
  added: []
  patterns:
    - "Closed-enum error mapping at the adapter boundary: TRANSIENT_* re-throws for QStash retry; PERMANENT_NOT_FOUND → LIKELY_GONE"
    - "Two-sub-action deprovision step emitting per-sub-action SHA-256 pairs for the 3-audit-row mapping"

key-files:
  created:
    - packages/integrations/src/adapters/__tests__/google-workspace-describe-impact.test.ts
  modified:
    - packages/integrations/src/adapters/google-workspace-adapter.ts
    - packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts
    - packages/integrations/src/types/deprovisionable.ts
    - packages/test-utils/src/msw/handlers/google-workspace.ts
    - packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts
    - packages/integrations/src/adapters/__tests__/google-workspace-adapter.test.ts

key-decisions:
  - "GWS adapter was already registered as Deprovisionable in register-all.ts (Phase 76) — 77-02-05 verified idempotent; no register-all.ts change needed."
  - "Added DeprovisionResult.subActions (additive contract field) so revokeAllSessions can surface the OAuth-grant-revoke + sign-out SHA pairs for 77-04's 3-audit-row persistence."
  - "Tests use the established createMockServer/MSW pattern (URL predicates, not glob path literals — MSW v2 + path-to-regexp v8 constraint)."

patterns-established:
  - "describeImpact reads are best-effort: tokens.list / drives.list failures degrade to [] / null, never fail the preview."

requirements-completed: [IDP-03]

duration: 23min
completed: 2026-05-31
---

# Phase 77 Plan 02: GoogleWorkspaceAdapter Deprovisionable implementation Summary

**Real GWS deprovisioning against the Admin SDK: suspend (PATCH suspended=true), revokeAllSessions as OAuth-grant-revoke (tokens list+delete at pLimit(5)) + sign-out (both required), verify, and a live cache-fronted describeImpact — all errors mapped through the 77-01 closed-enum classifier.**

## Performance
- **Duration:** 23 min
- **Tasks:** 6
- **Files modified/created:** 6

## Accomplishments
- `GoogleWorkspaceAdapter` implements the full four-method `Deprovisionable` contract with closed-enum error classification: 404→LIKELY_GONE, 429/503→throw (QStash retry), 401→PERMANENT_AUTH_EXPIRED, 403→PERMANENT_FORBIDDEN.
- `revokeAllSessions` runs two sub-actions (token revoke + sign-out), both required for SUCCEEDED, emitting two PII-free SHA-256 pairs via `DeprovisionResult.subActions` (D-05 three-audit-row seam for 77-04).
- `describeImpact` returns the GWS `ImpactPreview` from live `users.get` + `tokens.list` + best-effort `drives.list`, `sessionCount: null` (no live endpoint).
- Added the `admin.directory.user.security` scope; extended the shared GWS MSW handler; full GWS test suite (57 tests) green.

## Task Commits
1. **77-02-01..04 adapter impl + scope + subActions contract** - `d7c99915` (feat)
2. **77-02-06 MSW deprovision handlers** - `20f4c08e` (test)
3. **77-02-06 + Rule 1 test suites** - `d074391a` (test)

## Decisions Made
See `key-decisions` frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote the Phase 76 D-16 stub-template deprovision test**
- **Found during:** Task 77-02-06
- **Issue:** The Phase 76 stub test asserted 404→SUCCEEDED / 429→RATE_LIMITED-FAILED, which the 77-02 contract intentionally changes (404→LIKELY_GONE, 429→throw).
- **Fix:** Rewrote it to the 77-02 behavior using the same MSW server pattern.
- **Committed in:** `d074391a`

**2. [Rule 1 - Bug] Updated the exact-scope OAuthConfig assertion**
- **Found during:** Task 77-02-01
- **Issue:** Adding `admin.directory.user.security` broke `adapters/__tests__/google-workspace-adapter.test.ts`'s `.toEqual([...])` scope list.
- **Fix:** Added the new scope to the expected array.
- **Committed in:** `d074391a`

**3. [Rule 3 - Blocking] Added DeprovisionResult.subActions contract field**
- **Found during:** Task 77-02-03
- **Issue:** The two-sub-action revoke needs to surface two SHA pairs for the 3-audit-row mapping, but the 77-01 contract had no field for it.
- **Fix:** Added optional `subActions` to `DeprovisionResult` (additive).
- **Committed in:** `d7c99915`

---

**Total deviations:** 3 (2 Rule-1 test fixes, 1 additive contract field). **Impact:** Necessary for the 77-02 behavior contract; no scope creep.

## Issues Encountered
- The dead `mapStatus` helper (Phase 76 failureKind-based mapping) was superseded by the classifier mapping and removed to avoid an unused-symbol lint error.

## Next Phase Readiness
- 77-04's step-runner can resolve the GWS adapter (`getDeprovisionableAdapter('GOOGLE_WORKSPACE')`), call the four methods, and persist `subActions` as extra audit rows.

---
*Phase: 77-f2-idp-gws-slack-adapters-the-wedge*
*Completed: 2026-05-31*
