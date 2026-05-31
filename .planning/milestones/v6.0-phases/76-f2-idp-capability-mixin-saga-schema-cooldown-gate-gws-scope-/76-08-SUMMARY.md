---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 08
subsystem: api
tags: [oauth, google-workspace, scope-capabilities, i18n, banner, web-vite]

requires:
  - phase: 76
    provides: "76-03 GWS scope/capability typed-consts + Deprovisionable; 76-07 lint:scopes guard"
  - phase: 70
    provides: "scopeCapabilities JSONB (D-13) + reconnect banner (D-16)"
provides:
  - "GWS getOAuthConfig additive write scope + prompt=consent"
  - "3-state reconnect banner (hidden / reconnect / write-access)"
  - "i18n writeAccess* keys en/de/pl/ar"
  - "OAuth callback scopeCapabilities derivation (apps/api Fastify route)"
affects: [76-09]

tech-stack:
  added: []
  patterns: ["additive OAuth scope via typed-const spread", "capability-aware 3-state banner", "callback derives scopeCapabilities JSONB from granted scopes"]

key-files:
  created:
    - apps/api/src/__tests__/google-workspace-oauth-callback.test.ts
  modified:
    - packages/integrations/src/adapters/google-workspace-adapter.ts
    - packages/integrations/src/index.ts
    - packages/integrations/src/adapters/__tests__/google-workspace-adapter.test.ts
    - apps/web-vite/src/components/integrations/google-workspace-reconnect-banner.tsx
    - apps/web-vite/src/components/integrations/__tests__/google-workspace-reconnect-banner.test.tsx
    - apps/web-vite/src/components/integrations/__tests__/google-workspace-reconnect-banner-write-access.test.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json
    - apps/api/src/routes/oauth.ts
    - packages/api/src/__tests__/google-workspace-oauth-callback.test.ts

key-decisions:
  - "OAuth callback is the apps/api Fastify route (apps/api/src/routes/oauth.ts), NOT a tRPC router — scopeCapabilities derivation added there as exported buildGoogleWorkspaceScopeCapabilities helper"
  - "Used valid CapabilityEnum directory.write throughout (banner WRITE_CAPABILITY, callback caps, consts) — the plan's directory.user.write is not a CapabilityEnum member"
  - "web-vite banner uses custom useTranslations('Integrations.GoogleWorkspaceReconnect') + flat messages — added writeAccessTitle/Body/Button keys (not the plan's next-intl integrations.gws.banner.* path)"
  - "Re-exported the GWS scope/capability consts from the integrations barrel so apps/api can import them; rebuilt integrations dist for the new export"
  - "prompt=consent was already present in GOOGLE_WORKSPACE_OAUTH_CONFIG — only the additive scope import was needed"
  - "Updated the Phase 70 banner 'hides' test + the GWS adapter getOAuthConfig scope assertion to reflect the deliberate 3-state / additive-scope behaviour change"

patterns-established:
  - "Hidden banner requires BOTH user.deprovision AND directory.write; write-access state when deprovision present but write absent"

requirements-completed: [IDP-11]

duration: 14 min
completed: 2026-05-31
---

# Phase 76 Plan 08: GWS Scope-Upgrade Flow Summary

**Additive `admin.directory.user` write scope (prompt=consent) on the GWS adapter, a 3-state reconnect banner (write-access variant) with 4-locale i18n, and an OAuth callback that derives the scopeCapabilities JSONB — read-only v3.0 directory-import unbroken.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-31T17:01:00Z
- **Completed:** 2026-05-31T17:13:00Z
- **Tasks:** 7
- **Files:** 1 created + ~11 modified

## Accomplishments
- GWS `getOAuthConfig().scopes` spreads `GOOGLE_WORKSPACE_DEPROVISION_SCOPES` additively; `prompt=consent` confirmed present; lint:scopes passes (scope traced to const).
- Reconnect banner: 3 states — reconnect-required (Phase 70, unchanged), write-access-required (new, `user.deprovision` present but `directory.write` absent), hidden (both present).
- i18n `writeAccessTitle/Body/Button` in en/de/pl/ar (AR flagged for native-speaker review post-deploy); i18n:parity GREEN.
- OAuth callback (Fastify) derives `scopeCapabilities` JSONB — appends write caps only when the write scope was granted (additive); preserves read baseline.
- Tests: web-vite banner 8 GREEN (4 updated Phase 70 + 4 new write-access); apps/api oauth-callback 3 GREEN; packages/api contract 3 GREEN; GWS adapter regression 38 GREEN.

## Task Commits

1. **76-08-01..07: adapter + banner + i18n + callback + tests** — `444a7799` (feat)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Path/API drift] Callback is a Fastify route; web-vite i18n differs; capability spelling**
- **Found during:** Tasks 76-08-02 / 76-08-04
- **Issue:** Plan referenced a tRPC `integration.ts` callback, `apps/web` + next-intl `integrations.gws.banner.*` keys, and `directory.user.write` capability.
- **Fix:** Added the scopeCapabilities derivation to `apps/api/src/routes/oauth.ts` (the real Fastify callback); used `apps/web-vite` + `useTranslations('Integrations.GoogleWorkspaceReconnect')` flat keys; used valid `directory.write` CapabilityEnum.
- **Verification:** api/apps-api/web-vite typecheck 0; all listed tests GREEN; i18n:parity + lint:scopes GREEN.
- **Committed in:** `444a7799`

**2. [Rule 1 - Bug] Existing Phase 70 assertions broke on the deliberate behaviour change**
- **Found during:** Task 76-08-07 (regression)
- **Issue:** The Phase 70 banner "hides when user.deprovision present" test and the GWS adapter exact-scope `toEqual` assertion both broke — by design (3-state banner + additive scope).
- **Fix:** Updated the banner "hides" case to require BOTH caps; added the new write scope to the adapter scope assertion.
- **Verification:** banner 8 GREEN; GWS adapter 38 GREEN.
- **Committed in:** `444a7799`

---

**Total deviations:** 2 auto-fixed (path/API drift + intended-behaviour test updates)
**Impact on plan:** No scope creep. SC#3 delivered with additive-only scope change.

## Issues Encountered
- **Concurrent process on the branch (observation, not a blocker):** foreign commits (`286c3109`, `87db2852`, `71296d63`, etc.) are interleaving with the Phase 76 commits on `audit/post-migration-parity`, despite the serialized-executor expectation. One of them captured the Phase 76 `messages/*.json` edits into HEAD before my own commit staged them (the `writeAccess*` keys are present + correct in HEAD with no diff). My Phase 76 production commits remain correctly scoped to explicitly-`git add`ed paths. No destructive recovery attempted (shared-tree safety).

## Manual-Only Verifications
- AR (Arabic) banner copy is best-effort; flag for native-speaker / legal review before APPROVED post-deploy (Standing Constraint — legal review DEFERRED).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 76-09 (GWS adapter implements Deprovisionable) can rely on the write scope being requested + the capability written on re-OAuth.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
