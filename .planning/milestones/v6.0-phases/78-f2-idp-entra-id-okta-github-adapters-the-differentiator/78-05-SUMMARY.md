---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
plan: 05
subsystem: integrations
tags: [idp, deprovisioning, github, octokit, saml-sso, outside-collaborator, msw]

requires:
  - phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope
    provides: Deprovisionable interface, saga-canonicalize helpers
  - phase: 77-f2-idp-gws-slack-adapters-the-wedge
    provides: ImpactPreview union, classifyError, GWS/Slack adapter pattern
  - phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
    provides: GITHUB scopes + ImpactPreview member + github MSW handlers (78-01), 403-split classifier (78-02)
provides:
  - "GitHubAdapter implements Deprovisionable via @octokit/rest"
  - "SAML-SSO per-PAT credential-authorization revocation (graceful non-SAML degrade)"
  - "Outside-collaborator back-door flagging via describeImpact.outsideCollaboratorRepoCount"
affects: [78-06, 78-07]

tech-stack:
  added: []
  patterns: ["@octokit/rest org operations + octokit.paginate + octokit.request for untyped routes", "403 rate-limit vs forbidden disambiguation via classifier headers"]

key-files:
  created:
    - packages/integrations/src/adapters/github-adapter.ts
  modified:
    - packages/integrations/src/adapters/__tests__/github-deprovision.test.ts

key-decisions:
  - "GitHub-App/classic-token model (withCredentials org+token); externalUserId = GitHub login"
  - "Non-SAML org (credential-authorizations 403/404) → SUCCEEDED-with-warning, never FAILED (D-04); authorizedPatCount null signals 'unavailable' (distinct from 0)"
  - "Outside-collaborator repos are FLAGGED (not auto-removed) — describeImpact.outsideCollaboratorRepoCount counts repos via per-repo checkCollaborator; the back-door is surfaced, never silently treated as full deprovision (Pitfall 7)"
  - "credential-authorizations is an untyped Octokit route → octokit.paginate(route)/octokit.request(route) with explicit result casts"

patterns-established:
  - "Graceful capability degradation: a provider feature unavailable on this tenant returns SUCCEEDED-with-warning rather than failing the saga"

requirements-completed: [IDP-07]

duration: 14min
completed: 2026-05-31
---

# Phase 78 Plan 05: GitHub Deprovisionable Adapter Summary

**GitHubAdapter via @octokit/rest — the differently-shaped provider: org-member removal, SAML-SSO per-PAT credential-authorization revocation that degrades gracefully on non-SAML orgs, and the headline outside-collaborator back-door flag (repos that survive org removal).**

## Performance
- **Duration:** ~14 min
- **Tasks:** 2
- **Files:** 2

## Accomplishments
- suspendAccount → `orgs.removeMember` (404 → LIKELY_GONE)
- revokeAllSessions → enumerate + DELETE matching per-PAT credential-authorizations on SAML orgs; non-SAML (403/404) → SUCCEEDED with "not on SAML SSO" warning, run NOT failed
- describeImpact → repo/team/outside-collab/invitation/PAT/owner metrics; `outsideCollaboratorRepoCount` counts repos the user collaborates on (per-repo `checkCollaborator`), the Pitfall-7 back-door warning; `authorizedPatCount` null on non-SAML
- verifyDeprovisioned → `checkMembershipForUser` 404 / membership !== active → true
- Octokit errors classified via `classifyError({provider:'GITHUB', httpStatus, responseHeaders})` — 403 secondary-rate-limit → TRANSIENT (retryable) vs 403 forbidden → PERMANENT
- 12/12 tests GREEN (Octokit→MSW); token never logged (only masked token_last_eight in audit)

## Task Commits
1. **78-05-01: GitHubAdapter** - `8e178bb1` (feat)
2. **78-05-02: tests GREEN** - `5e48afd6` (test)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Untyped Octokit credential-authorizations route**
- **Found during:** Task 78-05-01 (typecheck)
- **Issue:** `octokit.paginate('GET /orgs/{org}/credential-authorizations')` returns `unknown[]` (route not in the typed Octokit map), so `.filter((a:{login?})=>...)` failed typecheck.
- **Fix:** Cast the paginate result to the expected shape (`as Array<{ login?: string }>`) at the call sites. Behavior unchanged.
- **Files modified:** packages/integrations/src/adapters/github-adapter.ts
- **Verification:** typecheck clean; 12/12 tests pass
- **Committed in:** 8e178bb1

---

**Total deviations:** 1 (a typecheck-driven cast for an untyped Octokit route). No scope creep.
**Impact on plan:** None — purely a typing accommodation for an REST route absent from Octokit's typed map.

## Issues Encountered
None.

## User Setup Required
None for the test suite (GitHub App installation token / classic admin:org token + org login are deploy-time connection credentials).

## Next Phase Readiness
- 78-06 can register GitHubAdapter under provider key `GITHUB` and wire its connection tRPC router (org + installation/PAT token credential storage). The outside-collaborator manual flag is surfaced via describeImpact for the saga consumer to materialise as a MANUAL_REVIEW / offboarding task.

---
*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Completed: 2026-05-31*
