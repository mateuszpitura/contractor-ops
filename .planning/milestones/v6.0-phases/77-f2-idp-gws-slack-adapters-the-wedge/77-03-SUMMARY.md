---
phase: 77-f2-idp-gws-slack-adapters-the-wedge
plan: 03
subsystem: integrations
tags: [idp, deprovisioning, slack, scim, enterprise-grid, msw]

requires:
  - phase: 77-01
    provides: SLACK_DEPROVISION_SCOPES, ImpactPreview SLACK member, classifyError/ErrorClass
provides:
  - SlackAdapter Deprovisionable impl (SCIM deactivate + admin.users.session.invalidate + verify + describeImpact)
  - ConnectionSubKind 'SLACK_ORG_GRID' + SlackAdapter.getOrgGridOAuthConfig()
  - SlackAdapter.withOrgGridToken(); SLACK registered in the Deprovisionable registry
  - Slack MSW deprovision handlers (SCIM + admin.session + users.*)
affects: [77-04, 77-05]

tech-stack:
  added: []
  patterns:
    - "Org-grid token isolation: SCIM + admin.session use #orgGridToken exclusively, never the workspace bot token (D-14)"
    - "Layered, non-fatal Enterprise-Grid detection: cannot_perform_operation → PERMANENT_FORBIDDEN on writes / NOT_ON_ENTERPRISE_GRID on preview"

key-files:
  created:
    - packages/integrations/src/adapters/__tests__/slack-deprovision.test.ts
    - packages/integrations/src/adapters/__tests__/slack-describe-impact.test.ts
    - packages/integrations/src/adapters/__tests__/slack-enterprise-grid-detection.test.ts
  modified:
    - packages/integrations/src/adapters/slack-adapter.ts
    - packages/integrations/src/types/provider.ts
    - packages/integrations/src/adapters/register-all.ts
    - packages/test-utils/src/msw/handlers/slack.ts
    - packages/integrations/src/__tests__/deprovisionable-contract.test.ts

key-decisions:
  - "SLACK_ORG_GRID expressed as OAuthConfig.connectionSubKind (additive on the shared interface) + a dedicated getOrgGridOAuthConfig() — workspace getOAuthConfig() untouched (D-14)."
  - "Slack deprovision errors classified through a Slack-error-code→ErrorClass mapper feeding the shared classifyError taxonomy (ratelimited→TRANSIENT, user_not_found→NOT_FOUND, missing_scope/cannot_perform_operation→FORBIDDEN, not_authed→AUTH_EXPIRED)."
  - "Slack registered in the ESSENTIAL register-all tier (same instance for provider + Deprovisionable registries)."

patterns-established:
  - "describeImpact best-effort: users.conversations / apps.permissions.users.list failures degrade to null, never fail the preview."

requirements-completed: [IDP-04]

duration: 22min
completed: 2026-05-31
---

# Phase 77 Plan 03: SlackAdapter Deprovisionable implementation Summary

**Real Slack deprovisioning via the Enterprise-Grid SCIM API (PATCH active=false) + admin.users.session.invalidate, using the org-grid token exclusively — plus the SLACK_ORG_GRID connection sub-kind, layered non-fatal Grid detection, and a best-effort describeImpact.**

## Performance
- **Duration:** 22 min
- **Tasks:** 5
- **Files modified/created:** 8

## Accomplishments
- `SlackAdapter` implements the full four-method `Deprovisionable` contract: SCIM deactivate (resolves SCIM id from email when needed), session invalidate, verify (users.info deleted / user_not_found), and a best-effort `describeImpact`.
- All deprovision calls use the org-grid token exclusively (test asserts `Bearer THE-ORG-GRID-TOKEN`, never the workspace token).
- Enterprise-Grid detection: `cannot_perform_operation` → `PERMANENT_FORBIDDEN` on writes; `describeImpact` surfaces non-fatal `error: 'NOT_ON_ENTERPRISE_GRID'`.
- Added `ConnectionSubKind 'SLACK_ORG_GRID'` + `getOrgGridOAuthConfig()` (org scopes from the typed-const); workspace OAuth unchanged. Slack registered as Deprovisionable. 21 new tests green.

## Task Commits
1. **77-03-01..04 adapter impl + org-grid + registration** - `4ad0d8e4` (feat)
2. **77-03-05 MSW + three test suites** - `2f2ec01e` (test)

## Decisions Made
See `key-decisions` frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the Phase 76 GWS scope-const contract assertion**
- **Found during:** full integrations suite run (after 77-02's scope addition)
- **Issue:** `deprovisionable-contract.test.ts` asserted `GOOGLE_WORKSPACE_DEPROVISION_SCOPES` equalled exactly `['admin.directory.user']`; 77-02 added `.user.security`.
- **Fix:** Added the new scope to the expected array.
- **Committed in:** `2f2ec01e`

---

**Total deviations:** 1 (Rule-1 cross-plan scope-assertion fix). **Impact:** Test correctness only.

## Issues Encountered
- None. The registry "slug already registered — overwriting" WARN during the full suite is expected test-isolation behavior (multiple files construct adapters).

## Next Phase Readiness
- 77-04's step-runner can resolve `getDeprovisionableAdapter('SLACK')`, configure the org-grid token via `withOrgGridToken`, and call all four methods. The SLACK_ORG_GRID OAuth-start endpoint + token resolution is 77-04; the connection-card UI is 77-05.

---
*Phase: 77-f2-idp-gws-slack-adapters-the-wedge*
*Completed: 2026-05-31*
