---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
plan: 02
subsystem: integrations
tags: [idp, deprovisioning, error-classifier, github, entra, okta, rate-limit, vitest]

requires:
  - phase: 77-f2-idp-gws-slack-adapters-the-wedge
    provides: classifyError / ErrorClass closed-enum classifier (D-07)
  - phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
    provides: ImpactPreview members + scope consts (78-01)
provides:
  - "classifyError extended for Entra/Okta/GitHub without widening the ErrorClass enum"
  - "GitHub 403 rate-limit vs 403 forbidden disambiguation (the headline fix)"
  - "ClassifyErrorInput gains optional provider/responseHeaders/responseBody (backward-compatible)"
affects: [78-03, 78-04, 78-05]

tech-stack:
  added: []
  patterns: ["signal-driven error classification (status + headers + body + code), not provider-keyed"]

key-files:
  created: []
  modified:
    - packages/integrations/src/idp/error-classifier.ts
    - packages/integrations/src/__tests__/error-classifier.test.ts

key-decisions:
  - "classifyError stays signal-driven (the shipped 77 shape) rather than gaining a required `provider` switch (the plan's assumption); per-provider behavior emerges from status/headers/body/code"
  - "GitHub 403 rate-limit detection (x-ratelimit-remaining:0 / retry-after / 'secondary rate limit' body) checked BEFORE the generic 403→FORBIDDEN branch — the genuinely-new behavior"
  - "ErrorClass closed enum NOT widened; Authorization_RequestDenied + require_two_factor_authentication added to the forbidden-code set; descriptive hints deferred to the adapters (classifyError returns a bare ErrorClass, changing the return type would break all 77 callers)"
  - "Test extended at the real path src/__tests__/error-classifier.test.ts (plan's src/idp/__tests__/ was stale; that dir does not exist)"

patterns-established:
  - "403-overload disambiguation: rate-limit signals beat the forbidden branch for providers that reuse 403 for throttling"

requirements-completed: [IDP-05, IDP-06, IDP-07]

duration: 8min
completed: 2026-05-31
---

# Phase 78 Plan 02: Per-Provider Error Classifier Summary

**Extended the closed-enum classifyError so the saga's per-class retry budgeting works for Entra/Okta/GitHub — the headline being GitHub's 403-overload split (secondary rate limit → TRANSIENT vs auth-forbidden → PERMANENT) — without widening the ErrorClass enum.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-31T22:28:00Z
- **Completed:** 2026-05-31T22:30:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GitHub 403 rate-limit vs forbidden disambiguation via `x-ratelimit-remaining:0` / `retry-after` header / `secondary rate limit` body, checked before the generic 403 branch
- Entra `Authorization_RequestDenied` + GitHub `require_two_factor_authentication` recognized as non-retryable forbidden codes
- `ClassifyErrorInput` extended with optional `provider`, `responseHeaders`, `responseBody` — fully backward-compatible with the 77 GWS/Slack callers
- 36/36 classifier tests green (18 new per-provider parametrized + 7 provider-specific + 11 existing); no regression
- `ErrorClass` closed enum unchanged (6 members)

## Task Commits

1. **Task 78-02-01: classifier extension** - `bedf2bec` (feat)
2. **Task 78-02-02: per-provider tests** - `dca4a613` (test)

## Decisions Made
See key-decisions frontmatter. The crux: the plan assumed `classifyError(provider, ...)`; the shipped function is `classifyError(input)` keyed by signal shape. Bound to reality — added the genuinely-new GitHub 403 rate-limit branch and the two forbidden codes; the optional `provider` hint is documentation-only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Classifier is signal-driven, not provider-keyed**
- **Found during:** Task 78-02-01
- **Issue:** Plan specified `classifyError` "keyed by provider + HTTP status" with a `provider` param and a per-provider switch. The shipped 77 `classifyError` takes `ClassifyErrorInput = {httpStatus, providerErrorCode, cause}` with NO provider param — it is provider-agnostic.
- **Fix:** Kept the signal-driven shape. Added the genuinely-new GitHub 403-rate-limit-vs-forbidden split (the one provider-specific behavior the generic logic didn't already cover) + the two forbidden codes. Added optional `provider`/`responseHeaders`/`responseBody` fields (additive). No required-param switch.
- **Files modified:** packages/integrations/src/idp/error-classifier.ts
- **Verification:** `pnpm --filter @contractor-ops/integrations test error-classifier` → 36 passed; typecheck clean
- **Committed in:** bedf2bec

**2. [Rule 1 - Bug] Stale test path src/idp/__tests__ → src/__tests__**
- **Found during:** Task 78-02-02
- **Issue:** Plan's `files_modified` listed `packages/integrations/src/idp/__tests__/error-classifier.test.ts`; that directory does not exist. The existing classifier test lives at `packages/integrations/src/__tests__/error-classifier.test.ts`.
- **Fix:** Extended the real existing test file.
- **Files modified:** packages/integrations/src/__tests__/error-classifier.test.ts
- **Verification:** 36/36 green
- **Committed in:** dca4a613

**3. [Rule 4-adjacent - Scope] Descriptive errorClass detail deferred to adapters**
- **Found during:** Task 78-02-01
- **Issue:** Plan asked for a descriptive detail/message on the classifier result. `classifyError` returns a bare `ErrorClass` string; adding a detail field would change the return type and break every 77 caller (GWS/Slack adapters + step-runner).
- **Fix:** Kept the return type as `ErrorClass`. The descriptive hints (e.g. "scope config missing" for Entra, "2FA required" for GitHub) are set by the adapters on the step's `lastErrorMessage`, which is where 77 already does this. Documented in the classifier doc comment.
- **Files modified:** packages/integrations/src/idp/error-classifier.ts (doc only)
- **Verification:** typecheck clean; 77 callers unaffected
- **Committed in:** bedf2bec

---

**Total deviations:** 3 (2 Rule-1 path/shape corrections, 1 scope-preserving deferral). No enum widening, no return-type change, no scope creep.
**Impact on plan:** The genuinely-new behavior (GitHub 403 split) is delivered and tested; generic mappings for Entra/Okta come for free from the existing logic.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- Wave 2 (78-03/04/05 adapters) ready: the three adapters consume `classifyError` and set descriptive `lastErrorMessage` themselves. GitHub adapter (78-05) should pass `responseHeaders`/`responseBody` to `classifyError` for the secondary-rate-limit case.

---
*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Completed: 2026-05-31*
