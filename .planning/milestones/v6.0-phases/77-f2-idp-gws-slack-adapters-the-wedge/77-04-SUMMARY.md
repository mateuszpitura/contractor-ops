---
phase: 77-f2-idp-gws-slack-adapters-the-wedge
plan: 04
subsystem: api
tags: [idp, deprovisioning, qstash, trpc, cache, audit]

requires:
  - phase: 77-02
    provides: GoogleWorkspaceAdapter Deprovisionable + describeImpact + subActions
  - phase: 77-03
    provides: SlackAdapter Deprovisionable + getOrgGridOAuthConfig
  - phase: 76
    provides: step-runner route + runDeprovisioningStep service + deprovisioning router + recomputeRunStatus/insertProvenance/MAX_ATTEMPTS
provides:
  - upgraded step-runner (errorClass persist, LIKELY_GONE->SUCCEEDED, GWS 3-audit-row sub-actions, token resolution)
  - idp-impact-preview cached service + failure classifier
  - deprovisioning.describeImpact / overrideStepFailure / enableProviderForOrg / connectSlackOrgGrid
  - idp-token-resolver (GWS connection token / SLACK_ORG_GRID token)
affects: [77-05]

tech-stack:
  added: []
  patterns:
    - "tRPC requirePermission BEFORE cache read (F-SCALE-09); preview cache key is org-scoped"
    - "override mirrors Phase 74 overrideBlockingTask: $transaction(columns+status+AuditLog+recompute)"

key-files:
  created:
    - packages/api/src/services/idp-impact-preview.ts
    - packages/api/src/services/idp-token-resolver.ts
    - packages/api/src/__tests__/idp-impact-preview.test.ts
    - packages/api/src/__tests__/idp-override-step-failure.test.ts
    - packages/api/src/__tests__/idp-provider-enable.test.ts
    - packages/api/src/__tests__/idp-step-runner.test.ts
  modified:
    - packages/api/src/services/idp-deprovisioning-step-runner.ts
    - packages/api/src/services/cache.ts
    - packages/api/src/routers/integrations/deprovisioning.ts
    - packages/api/src/errors.ts
    - packages/integrations/src/index.ts
    - packages/integrations/package.json
    - scripts/check-webhook-routes.mjs

key-decisions:
  - "The Phase 76 step-runner route (apps/api/src/routes/idp-deprovisioning.ts) + runDeprovisioningStep service ALREADY existed at the correct apps/api path — 77-04 UPGRADED the existing service rather than creating a new route (the plan's dead Next.js path was already superseded)."
  - "SLACK_ORG_GRID connection is marked via IntegrationConnection.configJson.connectionSubKind (no schema column exists; avoids a migration). Enterprise-Grid availability stored in scopeCapabilities.unavailableReason."
  - "Override + run audit use resourceType WORKFLOW_TASK_RUN / WORKFLOW_RUN (existing EntityType enum values) — no schema change; the action string carries the precise semantics."
  - "deprovisioning router is mounted top-level as `deprovisioning` (not integrations.deprovisioning); the router file lives at packages/api/src/routers/integrations/deprovisioning.ts."

patterns-established:
  - "Provider deprovision token resolution centralized in idp-token-resolver (shared by step-runner + preview service)."

requirements-completed: [IDP-01, IDP-03, IDP-04, IDP-12]

duration: 70min
completed: 2026-05-31
---

# Phase 77 Plan 04: IdP deprovisioning backend wiring Summary

**Backend that runs the adapters: upgraded QStash step-runner (errorClass + LIKELY_GONE + GWS 3-audit-row sub-actions + connection-token resolution), cached describeImpact preview service with the admin-choice failure flow, the Phase-74-mirror overrideStepFailure mutation, the per-provider enable toggle gated on signoff, and the Slack org-grid OAuth-start entry point.**

## Performance
- **Duration:** ~70 min
- **Tasks:** 6
- **Files modified/created:** 13

## Accomplishments
- Upgraded `runDeprovisioningStep`: resolves + configures the provider connection token, persists `errorClass`, maps `LIKELY_GONE`→SUCCEEDED step status (D-06), and emits the two GWS revoke sub-action audit rows (3-row mapping, D-05).
- `idp-impact-preview.getImpactPreview`: 5-min cached `describeImpact`; forceRefresh invalidates; classifies failures into reconnect_required / admin_choice (D-02/D-03). `CacheKeys.idpPreview` + `CacheTTL.IDP_PREVIEW`.
- `deprovisioning` router: `describeImpact` (preview + proceed-without-preview audit), `overrideStepFailure` (D-12 owner/admin-only, FAILED-at-MAX precondition, atomic $transaction, parent run completed_via_override audit, note never logged raw), `enableProviderForOrg` (D-15 per-provider toggle gated on APPROVED signoff), `connectSlackOrgGrid` (D-14 OAuth-start URL).
- Registered `POST /idp-deprovisioning/_step-runner` in `check-webhook-routes.mjs` (28 routes match). 20 tests across 4 files green.

## Task Commits
1. **integrations export surface** - `277e28c4` (feat)
2. **step-runner + token resolver + preview service + cache** - `712d087a` (feat)
3. **router procedures + error constants + route registry** - `e920e749` (feat)
4. **4 test suites** - (test commit)

## Decisions Made
See `key-decisions` frontmatter — notably the Phase 76 step-runner route already existed (upgraded, not recreated), and SLACK_ORG_GRID is marked via `configJson` (no schema change).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Upgraded the existing step-runner service instead of creating a route**
- **Issue:** The plan assumed the step-runner had to be created at apps/api; Phase 76 already shipped both the route and `runDeprovisioningStep`. Recreating would duplicate.
- **Fix:** Upgraded the existing service to the 77-04 contract; superseded the Phase 76 step-runner test with `idp-step-runner.test.ts`.

**2. [Rule 3 - Blocking] Integrations export surface for the API package**
- **Issue:** `classifyError`/`ImpactPreview` weren't exported from the integrations index, and `./adapters/slack-adapter` wasn't an exported subpath.
- **Fix:** Re-exported the idp surface from the index; added the slack-adapter package export (mirrors GWS).

**3. [Rule 2 - Missing critical] Error constants for TRPCError messages**
- **Issue:** The project lint rule forbids hardcoded TRPCError messages.
- **Fix:** Added 3 constants to errors.ts and referenced them.

---

**Total deviations:** 3 (all blocking/critical). **Impact:** Necessary for correct integration; no scope creep.

## Issues Encountered
- `AuditLog.resourceType` is a closed DB `EntityType` enum with no deprovisioning value; used `WORKFLOW_TASK_RUN`/`WORKFLOW_RUN` (semantically apt, no migration). The `action` string carries the precise event.

## Deferred Items
- **77-04-06 partial:** `connectSlackOrgGrid` returns the org-grid OAuth-start URL, but the `/api/oauth/slack-org-grid/start` route + callback handler (creating the SLACK_ORG_GRID connection + Enterprise-Grid probe into `scopeCapabilities.unavailableReason`) is NOT yet wired — it needs the OAuth-challenge/cookie route machinery. Flagged as a follow-up; the connect entry point + token-resolver (reading `configJson.connectionSubKind`) are in place so the callback can be added without contract changes.
- **Saga-start eligibility filter (77-04-05 second half):** `PROVIDERS_FOR_RUN` in `startDeprovisioningRun` still hardcodes `['GOOGLE_WORKSPACE']` (Phase 76). The enable-toggle + signoff helpers exist; wiring them into `startDeprovisioningRun`'s provider enumeration (+ the `idp.slack.org_grid_unavailable` skip audit) is a follow-up alongside the org-grid callback.

## Next Phase Readiness
- 77-05 (UI) can call `deprovisioning.describeImpact`, `overrideStepFailure`, `enableProviderForOrg`, `connectSlackOrgGrid`.

---
*Phase: 77-f2-idp-gws-slack-adapters-the-wedge*
*Completed: 2026-05-31*
