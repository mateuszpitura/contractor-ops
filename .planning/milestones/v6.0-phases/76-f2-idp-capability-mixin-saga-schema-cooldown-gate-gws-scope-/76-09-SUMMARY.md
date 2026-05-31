---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 09
subsystem: api
tags: [google-workspace, deprovisionable, adapter, webhook, provenance, saga-canonicalize]

requires:
  - phase: 76
    provides: "76-03 Deprovisionable interface + registry; 76-04 provenanceLookup; 76-08 GWS write scope"
provides:
  - "GoogleWorkspaceAdapter implements Deprovisionable (suspend/revoke/verify)"
  - "saga-canonicalize (SHA-256 + PII/auth denylist) in packages/integrations/src/services"
  - "handleWebhook self-trigger provenance filter"
  - "registerDeprovisionableAdapter('GOOGLE_WORKSPACE', ...) wiring"
affects: [76-06, 76-10, 77, 78]

tech-stack:
  added: ["@contractor-ops/idp-saga as @contractor-ops/integrations dependency"]
  patterns: ["HTTP status → DeprovisionResult mapping", "canonicalize+sha256 audit hashing", "withAccessToken instance config (interface signature has only externalUserId)"]

key-files:
  created:
    - packages/integrations/src/services/saga-canonicalize.ts
  modified:
    - packages/integrations/src/adapters/google-workspace-adapter.ts
    - packages/integrations/src/adapters/register-all.ts
    - packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts
    - packages/integrations/src/adapters/__tests__/google-workspace-webhook-provenance.test.ts
    - packages/integrations/package.json
    - packages/idp-saga/src/{index,cooldown,gc,provenance,run-status}.ts (.js import extensions)

key-decisions:
  - "Created saga-canonicalize in packages/integrations/src/services (the adapter consumes it) — the plan offered this as the package-boundary-safe location vs the stale packages/api path; Plan 76-06 step-runner will import it from here"
  - "Token carried via withAccessToken() instance config — the Deprovisionable signatures take only externalUserId; the saga step-runner resolves the credential and configures it before calling (Phase 77 wires real threading)"
  - "idp-saga internal imports converted to .js extensions so the package is consumable under both Bundler (own) and NodeNext (integrations) — fixed TS2835 when integrations imports idp-saga src"
  - "USER_NOT_FOUND (404) → SUCCEEDED (goal state met); 429→RATE_LIMITED, 401/403→AUTH_REVOKED, 5xx→PROVIDER_ERROR, network→NETWORK"
  - "MSW handlers use URL predicate functions (not regex/string paths) — MSW v2 + path-to-regexp v8 crashes on regex path literals (test-utils CLAUDE.md qstash note)"

patterns-established:
  - "First concrete Deprovisionable adapter — Phase 78 Entra/Okta/GitHub will not compile without all three methods"

requirements-completed: [IDP-08, IDP-13]

duration: 12 min
completed: 2026-05-31
---

# Phase 76 Plan 09: GoogleWorkspaceAdapter implements Deprovisionable Summary

**GoogleWorkspaceAdapter is the first concrete `Deprovisionable` — suspend/revoke/verify against the Admin SDK with SHA-256 audit hashing, plus a `handleWebhook` self-trigger provenance filter that suppresses our own deprovision events.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-31T17:19:00Z
- **Completed:** 2026-05-31T17:28:00Z
- **Tasks:** 4
- **Files:** 1 created + 6 modified

## Accomplishments
- `GoogleWorkspaceAdapter extends BaseAdapter implements Deprovisionable` — compiles only because all three methods exist (compile-time SC#5 enforcement).
- `suspendAccount` (PATCH suspended=true), `revokeAllSessions` (POST signOut), `verifyDeprovisioned` (GET suspended) with full HTTP-status → DeprovisionResult mapping + canonicalised SHA-256 hashes.
- `saga-canonicalize.ts` — key-sorted JSON with auth-header/token/PII denylist, sha256Hex.
- `handleWebhook` — provenanceLookup on `user.suspended` → `{ suppressed: true }` on match (D-09/11), else falls through.
- `register-all` registers the same GWS instance as both a provider adapter and a Deprovisionable adapter.
- 11 new tests GREEN (7 deprovision MSW + 4 webhook); full GWS suite 49 GREEN; lint:scopes clean; integrations typecheck clean.

## Task Commits

1. **76-09-01..04: adapter methods + canonicalize + register + 2 tests** — `a4130d93` (feat)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] idp-saga cross-resolution import incompatibility**
- **Found during:** Task 76-09-01 (integrations typecheck)
- **Issue:** idp-saga used extensionless imports (Bundler); integrations is NodeNext → TS2835 when integrations imports idp-saga src.
- **Fix:** Converted idp-saga internal imports to `.js` extensions (valid under both resolutions). Added idp-saga to integrations deps.
- **Verification:** idp-saga 25 tests + own typecheck GREEN; integrations typecheck 0.
- **Committed in:** `a4130d93`

**2. [Rule 1 - Bug] MSW regex path literals crash path-to-regexp v8**
- **Found during:** Task 76-09-03
- **Issue:** `http.patch(/regex/)` crashed in path-to-regexp v8 (`Cannot read properties of undefined (reading 'length')`).
- **Fix:** Switched to URL predicate functions (`http.patch(({request}) => isUserPath(request.url), ...)`) per the repo's qstash-handler pattern; imported `http`/`HttpResponse` from `@contractor-ops/test-utils` (msw is not a direct integrations dep).
- **Verification:** 11 tests GREEN.
- **Committed in:** `a4130d93`

**3. [Rule 4-adjacent - design] Token threading via instance config**
- **Found during:** Task 76-09-01
- **Issue:** The Deprovisionable signatures take only externalUserId, but the GWS API needs a per-connection access token; the repo's adapters pass the token as a method param (incompatible with the interface).
- **Fix:** Added `withAccessToken(token)` returning `this` — the saga step-runner configures it before calling. Non-architectural (interface unchanged); Phase 77 wires real credential resolution.
- **Verification:** MSW tests pass with a fake token (MSW does not check auth).
- **Committed in:** `a4130d93`

---

**Total deviations:** 3 auto-fixed (cross-resolution, MSW path, token-threading)
**Impact on plan:** No scope creep. The adapter satisfies the interface and the saga step-runner (76-06) can resolve + invoke it.

## Issues Encountered
None beyond the deviations.

## User Setup Required
None - no external service configuration required.

## Manual-Only Verifications
- Real GWS sandbox traffic verification is deferred to Phase 77 (LOCAL-ONLY; MSW-mocked here per D-16).

## Next Phase Readiness
- Plan 76-06 (step-runner) resolves the adapter via getDeprovisionableAdapter, calls withAccessToken + suspend/revoke, imports saga-canonicalize from integrations/services.
- Plan 76-10 (D-16 template + GC cron) references google-workspace-deprovision.test as the template.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
