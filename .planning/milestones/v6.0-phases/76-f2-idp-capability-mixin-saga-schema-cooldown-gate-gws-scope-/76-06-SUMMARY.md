---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 06
subsystem: api
tags: [trpc, qstash, saga, deprovisioning, step-runner, fastify]

requires:
  - phase: 76
    provides: "76-02 schema; 76-03 registry+interface; 76-04 cooldown+recompute+provenance; 76-05 eligibility router; 76-09 GWS adapter+saga-canonicalize"
provides:
  - "startDeprovisioningRun + retryDeprovisioningStep mutations"
  - "idp-deprovisioning step-runner service + apps/api Fastify QStash route"
affects: [77, 78]

tech-stack:
  added: []
  patterns: ["QStash fan-out (independent jobs, no Promise.allSettled)", "idempotent precondition + optimistic-concurrency updateMany", "service-holds-logic / thin-Fastify-route"]

key-files:
  created:
    - packages/api/src/services/idp-deprovisioning-step-runner.ts
    - apps/api/src/routes/idp-deprovisioning.ts
  modified:
    - packages/api/src/routers/integrations/deprovisioning.ts
    - packages/api/src/errors.ts
    - packages/api/package.json
    - apps/api/src/routes/webhooks/index.ts
    - packages/api/src/__tests__/deprovisioning-{start,retry,step-runner}.test.ts
    - packages/idp-saga/src/index.ts (export recomputeRunStatus)
    - packages/integrations/src/index.ts (export get/registerDeprovisionableAdapter)

key-decisions:
  - "_step-runner is an apps/api Fastify route (apps/web App Router deleted) registered in the webhook plugin with guardQStashRequest; the saga logic lives in a testable service (packages/api/src/services/idp-deprovisioning-step-runner.ts)"
  - "Reused saga-canonicalize from packages/integrations/src/services (76-09) — NOT re-created in packages/api as the stale plan said"
  - "QStash callback URL = getServerEnv().API_URL/idp-deprovisioning/_step-runner (mirrors late-interest); dynamic-import keeps Upstash env out of module-load for tooling/tests"
  - "TRPCError messages use new i18n error-key constants (errors.ts DEPROVISIONING_*) — the i18n-system-messages biome guard rejects hardcoded TRPCError messages; the structured cooldown detail (reason + earliestDate) stays in the audit log + the eligibility query"
  - "Region-aware db in the route: prisma.organization.dataRegion → createTenantClientFrom(getRegionalClient(region)); service param typed TenantDb, cast to PrismaClient for idp-saga helpers (trusted internal client, structural superset)"
  - "tenantProcedure + ctx.user.id; PROVIDERS_FOR_RUN = [GOOGLE_WORKSPACE] (only registered Deprovisionable adapter); 2 steps per provider"

patterns-established:
  - "Saga step contract: provenance BEFORE adapter; recomputeRunStatus after every transition; USER_NOT_FOUND→SUCCEEDED"

requirements-completed: [IDP-09, IDP-10]

duration: 22 min
completed: 2026-05-31
---

# Phase 76 Plan 06: Saga Orchestration Summary

**`startDeprovisioningRun` (transactional run+steps + independent QStash fan-out) + idempotent `retryDeprovisioningStep` mutations + a Fastify `_step-runner` QStash callback that executes one saga step (provenance-before-adapter, SHA-256 audit hashes, recomputeRunStatus aggregation).**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-31T17:28:00Z
- **Completed:** 2026-05-31T17:50:00Z
- **Tasks:** 6
- **Files:** 2 created + 9 modified

## Accomplishments
- `startDeprovisioningRun`: server-side cooldown gate (FORBIDDEN), single transaction (run + 2 steps + IN_PROGRESS), N independent QStash jobs (deduplicationId `runId:stepId:0`), P2002 idempotency.
- `retryDeprovisioningStep`: FAILED-only precondition (noop otherwise), optimistic-concurrency `updateMany` (noop on count=0), fresh job with `runId:stepId:nextAttempt`.
- `idp-deprovisioning-step-runner.ts` service: MAX_ATTEMPTS short-circuit → IN_PROGRESS+attempts++ → insertProvenance → adapter → USER_NOT_FOUND→SUCCEEDED → persist hashes → audit → recomputeRunStatus.
- `apps/api/src/routes/idp-deprovisioning.ts`: QStash-signature-guarded Fastify route, region-aware tenant db, delegates to the service.
- 16 tests GREEN (start 5 + retry 5 + step-runner 6); api + apps/api typecheck clean.

## Task Commits

1. **76-06-01..06: mutations + step-runner service + Fastify route + 3 tests + error keys** — `646c17ba` (feat)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Path/API drift] step-runner is Fastify, saga-canonicalize reused**
- **Found during:** Tasks 76-06-01 / 76-06-03
- **Issue:** Plan put `_step-runner` at `apps/web/src/app/api/.../route.ts` (Next App Router, deleted) and re-created `saga-canonicalize` in packages/api.
- **Fix:** Fastify route in apps/api under the webhook plugin (guardQStashRequest); logic in a testable service; reused saga-canonicalize from integrations/services (76-09).
- **Verification:** api + apps/api typecheck 0; 16 tests GREEN.
- **Committed in:** `646c17ba`

**2. [Rule 1 - Bug] hardcoded TRPCError messages rejected by the i18n guard**
- **Found during:** pre-commit (biome no-untranslated / i18n-system-messages)
- **Issue:** `throw new TRPCError({ message: 'Cooldown active' })` etc. violate the project rule that TRPCError messages be error-key constants.
- **Fix:** Added DEPROVISIONING_* constants to errors.ts and used them. Structured cooldown detail stays in the audit log + the eligibility query return.
- **Verification:** biome check clean; tests assert `code` (unaffected).
- **Committed in:** `646c17ba`

**3. [Rule 3 - Type] tenant-client vs PrismaClient param mismatch**
- **Found during:** apps/api typecheck (TS2345 — `$on` missing)
- **Issue:** `createTenantClientFrom(...)` returns an extended client not assignable to the idp-saga helpers' `PrismaClient` param.
- **Fix:** Typed the service `db` param as `TenantDb` (ReturnType<typeof createTenantClientFrom>) and cast to PrismaClient at the idp-saga call boundary (trusted internal client; structural superset).
- **Verification:** typecheck 0.
- **Committed in:** `646c17ba`

---

**Total deviations:** 3 auto-fixed (path/API drift, i18n error keys, type widening)
**Impact on plan:** No scope creep. The saga is the architectural law SC#8 honoured (no Promise.allSettled; recomputeRunStatus is the single derivation).

## Issues Encountered
- First commit attempt was rejected by the pre-commit biome hook on the hardcoded TRPCError messages (deviation 2). Fixed and re-committed cleanly. A concurrent process on the branch landed an unrelated commit (`6cfb9441`) during the failed attempt — my changes were preserved (staged) and committed on the retry.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full saga is live: eligibility query (76-05) → startDeprovisioningRun → QStash fan-out → step-runner → recomputeRunStatus → retryDeprovisioningStep. Phases 77/78 add more Deprovisionable adapters to PROVIDERS_FOR_RUN.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
