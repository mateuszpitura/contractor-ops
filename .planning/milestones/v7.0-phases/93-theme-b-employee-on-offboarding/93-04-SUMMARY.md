# Plan 93-04 Summary — Worker-key the F2 IdP DeprovisioningRun trigger

**Wave:** 2 · **Status:** complete

## What shipped (`deprovisioning.ts` only)

- **`COUNTRY_TZ` exported + `US: 'America/New_York'`** added (Pitfall 7 — US had no jurisdiction TZ).
- **`startDeprovisioningRun` input → discriminated union**: `{subjectType:'CONTRACTOR', assignmentId, idempotencyKey}` OR `.strict()` `{subjectType:'EMPLOYEE', workerId, idempotencyKey}`.
- **Worker branch**: reads `EmployeeProfile.findFirst` (org-scoped) for `countryCode` + `terminatedAt` + `worker.email`; feeds the reused pure `canStartDeprovisioning({ endedAt: terminatedAt, status: terminatedAt ? 'ENDED' : 'ACTIVE', jurisdictionTz })` (synthesizes ENDED from the dated signal since employees have no assignment row); `externalUserId = emp.worker.email`; writes `DeprovisioningRun{ workerId, contractorId:null, assignmentId:null }`. Blocks pre-cooldown with `FORBIDDEN`/`DEPROVISIONING_COOLDOWN_ACTIVE`.
- **Contractor path unchanged** (byte-identical resolution + cooldown). Step fan-out (`deriveProvidersForRun`, QStash body with `externalUserId` only), P2002 idempotency, and the `auditLog.info` run-start entry are all untouched and subject-agnostic. No new resolver — the worker path supplies `workerId` directly (`assignmentId` stays null).
- **web-vite caller** (`use-start-deprovisioning.ts`): the existing contractor `start()` now passes `subjectType:'CONTRACTOR'` (required by the union). The worker-keyed variant lands in Plan 09.

## Verification

- `pnpm -F @contractor-ops/api test worker-deprovisioning` → **GREEN** (3/3: US TZ, blocks pre-cooldown, allows post-cooldown writing null contractor FKs).
- `git diff --exit-code` clean on the four unchanged execution-half files (`apps/api/.../idp-deprovisioning.ts` step runner, `idp-deprovisioning-step-runner.ts`, `packages/idp-saga/src/cooldown.ts`).
- `pnpm typecheck --filter=@contractor-ops/api` + `pnpm lint:audit-log` → green; `pnpm --filter @contractor-ops/web-vite exec tsc --noEmit` → green.

## Composition note

The saga's execution half was already worker-agnostic; contractor coupling lived entirely in the trigger. Extends the v6.0 F2 saga — never duplicates it.
