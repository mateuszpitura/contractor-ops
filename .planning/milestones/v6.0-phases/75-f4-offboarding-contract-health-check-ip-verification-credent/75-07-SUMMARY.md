---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 07
subsystem: api
tags: [trpc, credential-vault, workflow, audit, secret-detection, i18n-errors]

requires:
  - phase: 75-02
    provides: CredentialReference table + WorkflowRun.overrideMetadata
  - phase: 75-05
    provides: looksLikeSecretRefinement (server-side secret-shape gate)
  - phase: 74-f4-offboarding-workflow-foundation
    provides: completeTask/skipTask + overrideBlockingTask + overrideMetadata
provides:
  - workflow.credentialReference tRPC namespace (create/update/markRotated/remove/listByWorkflowRun)
  - IP_VERIFICATION completion hard-block + PENDING-credentials soft-warning (assertRunCompletable)
  - forceCompleteRunWithPendingCredentials mutation
affects: [75-08]

tech-stack:
  added: []
  patterns:
    - "Run-completion gate centralized in assertRunCompletable (workflow-shared) — completeTask + skipTask both enforce it"
    - "TRPCError messages are i18n constants from errors.ts (project goals/i18n-system-messages lint rule)"

key-files:
  created:
    - packages/api/src/routers/workflow/credential-reference.ts
    - packages/api/src/routers/__tests__/credential-reference.test.ts
  modified:
    - packages/api/src/routers/workflow/workflow.ts (mergeRouters + credentialReference namespace)
    - packages/api/src/routers/workflow/workflow-shared.ts (assertRunCompletable gate)
    - packages/api/src/routers/workflow/workflow-execution.ts (gate wiring + forceComplete mutation)
    - packages/api/src/errors.ts (4 Phase 75 error constants)
    - packages/api/src/routers/__tests__/workflow-execution-ip-block.test.ts
    - packages/api/src/routers/__tests__/workflow-execution-credential-warning.test.ts

key-decisions:
  - "credentialReference is a nested namespace via mergeRouters(..., router({ credentialReference })) — the workflow/index.ts the plan named is a re-export barrel, and workflowRouter is composed in workflow.ts via mergeRouters"
  - "completion gate lives in assertRunCompletable in workflow-shared (the single run-completion site, shared by completeTask + skipTask) — NOT inline in completeTask as the plan assumed"
  - "audit resourceType = WORKFLOW_RUN (the AuditEntityType union / DB EntityType enum has no CREDENTIAL_REFERENCE); credential id goes in resourceId"
  - "TRPCError messages converted to errors.ts i18n constants to satisfy the goals/i18n-system-messages Biome rule (pre-commit blocker)"

patterns-established:
  - "Soft-warning payload returns only id/label/vaultProvider (no vaultUrl/notes) — infra-pointer privacy"

requirements-completed: [OFFB-06, OFFB-08]

duration: 48 min
completed: 2026-05-31
---

# Phase 75 Plan 07: Credential-vault tRPC + IP-verification Gate Summary

**Shipped the `workflow.credentialReference` CRUD namespace (server-side secret-shape rejection + per-mutation audit) and the offboarding-run completion gate — IP_VERIFICATION hard-block (override-aware) + PENDING-credentials soft-warning + force-complete-with-reason.**

## Performance
- **Duration:** ~48 min
- **Tasks:** 6/6
- **Files:** 8 (2 created + 6 modified)

## Accomplishments
- 5-procedure credential router; every free-text field (label/vaultUrl/notes) runs `looksLikeSecretRefinement`; OFFBOARDING-only; create/update/rotated/removed audit rows.
- `assertRunCompletable` gate enforced by both completeTask and skipTask; IP block bypassed by Phase 74 override; credential soft-warning carries id/label/vaultProvider only.
- `forceCompleteRunWithPendingCredentials` (reason >=20, re-asserts IP block) + audit.
- 14 unit tests + 12 todo GREEN; existing workflow-execution suite 46 pass (no regression); typecheck 42/42; Biome clean.

## Task Commits
1. **75-07-01..06** - `51cdbabf` (feat)

## Deviations from Plan

**[Path drift — 75-DRIFT-MAP] trpc/middleware imports** — Plan imported `router`/`tenantProcedure` from `../../trpc.js` + `requirePermission` from `middleware/require-permission.js`. Real paths: `../../init`, `../../middleware/tenant`, `../../middleware/rbac`.

**[Rule 1 — correctness] router composition site** — `workflow/index.ts` is a re-export barrel; `workflowRouter` is composed in `workflow.ts` via `mergeRouters(...)`. Added `credentialReference` as a nested namespace: `mergeRouters(templates, execution, router({ credentialReference }))` (merging the router directly would flatten + collide `create`).

**[Rule 1 — correctness] completion gate location** — `completeTask` delegates run-completion to `unblockDependentsAndRecomputeRun` (workflow-shared), not an inline `isComplete` branch. Added an exported `assertRunCompletable` invoked there (gated by an optional `gate` arg) so both completeTask and skipTask enforce it.

**[Rule 1 — correctness] audit resourceType** — `AuditEntityType` (and the DB `EntityType` enum) has no `CREDENTIAL_REFERENCE`; used `WORKFLOW_RUN` with the credential id in `resourceId` (avoids a schema change).

**[Project rule] i18n TRPCError messages** — The `goals/i18n-system-messages` Biome rule blocks hardcoded TRPCError messages (pre-commit). Added 4 constants to errors.ts (CREDENTIAL_REFERENCE_NOT_FOUND, CREDENTIAL_REFERENCE_OFFBOARDING_ONLY, WORKFLOW_IP_VERIFICATION_OPEN, WORKFLOW_CREDENTIALS_PENDING) and referenced them.

**[Rule 3 — test infra] no vitest-mock-extended** — Tests unit-exercise the exported `assertRunCompletable` with in-memory mock clients + the secret-shape Zod schema; full tRPC-harness integration (permissions, audit, tenant scoping) is `it.todo`.

**Total deviations:** 4 correctness/path + 1 project-rule + 1 test-infra. **Impact:** behavior matches D-08/D-10/D-11/D-12; gate now also covers skip-to-complete (stronger than the plan).

## Self-Check: PASSED
- credentialReference router (5 procedures) + namespace wired; gate enforced in both completion paths; forceComplete mutation present.
- 4 audit actions + force-complete audit; secret-shape rejection verified.
- 52 tests pass; no workflow-execution regression; typecheck 42/42; Biome clean (errors.ts constants).

## Next
Wave 2 complete. Final wave (3): 75-08 — UI surfaces (web-vite) + e-sign webhook IP-ratification loop.
