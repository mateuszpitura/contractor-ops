# Plan 93-03 Summary — Worker subject path in the WorkflowRun start flow

**Wave:** 2 · **Status:** complete

## What shipped

- **`startRunSchema` → discriminated union** (`packages/validators/src/workflow.ts`): a `CONTRACTOR` variant (`contractorId` + optional `contractId`) and a `.strict()` `EMPLOYEE` variant (`workerId`), keyed on `subjectType`. Enforces exactly-one subject at the type layer; `StartRunInput` stays exported.
- **Single `startWorkflowRun(tx, input, { organizationId, actorUserId })` helper** (`workflow-execution-runs.ts`): owns the ONE `tx.workflowRun.create` for both subjects. Branches on `input.subjectType` — EMPLOYEE reads `tx.worker.findFirst({ workerType: 'EMPLOYEE' })` and writes `entityType:'EMPLOYEE'`, `workerId`, `contractorId:null`; CONTRACTOR path is byte-identical. The engine (`instantiateTaskRuns`), progress calc, and completion gate are reused unchanged. The tRPC `startRun` is now a thin delegate. Employee starts emit `writeAuditLog` (`resourceType:'EMPLOYEE'`); the contractor path emits no start audit (as before).
- **Subject-agnostic notification/display name**: the return carries `subjectDisplayName` (worker full name or contractor legal name); dispatch body + calendar sync + metadata use it (`contractorName` → `subjectName`).
- **`resolveAssignee`** (`workflow-shared.ts`): already employee-safe — `ROLE_BASED`/`FIXED_USER` resolve for any subject and the owner modes return null (no throw) for a worker bag. Documented the invariant (no behavior change).
- **`WORKER_NOT_FOUND` error key** added (`errors.ts`).
- **web-vite caller** (`use-template-picker.ts`): the two contractor `startRun` calls now pass `subjectType:'CONTRACTOR'` (required by the union).

## Verification

- `pnpm -F @contractor-ops/api test worker-start-run` → **GREEN** (3/3: employee create payload, worker lookup, contractor regression). Test double gained a `tx.auditLog.create` mock for the new employee audit.
- `pnpm typecheck --filter=@contractor-ops/validators` + `--filter=@contractor-ops/api` → **green**.
- `pnpm --filter @contractor-ops/web-vite exec tsc --noEmit` → **green** (after building `ui` + generating i18n key types — worktree build artifacts).
- `pnpm lint:audit-log` → OK.

## Single-create invariant

`tx.workflowRun.create` lives solely in `workflow-execution-runs.ts` (`startWorkflowRun`). Plan 08's lifecycle router will import and call this helper — never replicate the create.
