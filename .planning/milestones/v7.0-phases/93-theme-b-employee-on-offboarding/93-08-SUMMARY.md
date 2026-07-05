# Plan 93-08 Summary — employee-lifecycle-router (composition seam)

**Wave:** 3 · **Status:** complete

## What shipped

- **`employee-lifecycle-router.ts`** — the composition seam mounting the Wave 2 pieces, four procedures each `assertWorkforceEnabled` first, HR-RBAC-gated (`employee:['update']`), `.strict()` Zod input, tenant-scoped, audited (`resourceType:'EMPLOYEE'`):
  - `startOnboarding` / `startOffboarding({ workerId })` — derive jurisdiction from `EmployeeProfile.countryCode` via the shared `mapCountryCodeToJurisdiction` (no ad-hoc map), resolve the org's ACTIVE `WorkflowTemplate` for that jurisdiction + type (typed NOT_FOUND if unseeded/DRAFT), then start a worker run through the single shared `startWorkflowRun` helper (Plan 03) inside `ctx.db.$transaction` — **never a duplicate `workflowRun.create`**.
  - `recordTermination({ workerId, terminatedAt })` — writes `EmployeeProfile.terminatedAt` + transitions `employmentStatus` to TERMINATED (the dated signal that arms the Plan 04 IdP cooldown), audited.
  - `generateCert({ workflowRunId, workerId, certType })` — org+worker IDOR fence on the run, builds a PII-stripped snapshot, creates a DRAFT `StatutoryCertificate`, renders + archives via Plan 06, returns a re-signed download URL.
- **Mount** (`root.ts`): `employeeLifecycle: employeeLifecycleRouter` added to the existing `workforceRouters` const — no new flag, no new conditional block (flag-off → METHOD_NOT_FOUND via `conditionalWorkforceRouters`).
- **Error keys**: `EMPLOYEE_LIFECYCLE_TEMPLATE_NOT_FOUND`, `EMPLOYEE_UNSUPPORTED_JURISDICTION`.

## Verification

- `pnpm -F @contractor-ops/api test employee-lifecycle-router` → **GREEN** (6/6): jurisdiction→PL ONBOARDING resolution, unseeded→NOT_FOUND, flag-off rejection (assertWorkforceEnabled), HR-RBAC rejection, recordTermination audit (resourceType EMPLOYEE), generateCert DRAFT + audit. The harness drives the real `startWorkflowRun` through a mock prisma (statutory-cert-pdf + r2 stubbed — no react-pdf/R2).
- Single-create invariant: `grep -rl "workflowRun.create"` (non-test) → **only** `workflow-execution-runs.ts`.
- `pnpm typecheck --filter=@contractor-ops/api` + `pnpm lint:audit-log` → green.
