# Plan 93-02 Summary — Worker-lifecycle schema + un-applied migration

**Wave:** 1 · **Status:** complete (client regenerated; per-region apply deferred to human gate)

## What shipped

All Phase 93 schema changes land in ONE additive, drift-safe, un-applied migration:

| Change | File |
|--------|------|
| `EntityType += WORKER, EMPLOYEE` (UPPER_SNAKE) | `contract.prisma` |
| `WorkflowRun.workerId?` + `worker Worker?` relation + `@@index([organizationId, workerId])` | `workflow.prisma` |
| `WorkflowTemplate.jurisdiction?` + `seedKey?` + `@@unique([organizationId, jurisdiction, type, seedKey])` | `workflow.prisma` |
| `DeprovisioningRun`: `contractorId`/`assignmentId` → nullable, `contractor`/`assignment` relations optional, `workerId?` + `worker Worker?` + `@@index([organizationId, workerId])` | `idp-deprovisioning.prisma` |
| `EmployeeProfile.terminatedAt?` (dated termination signal, mirrors `ContractorAssignment.endedAt`) | `employee.prisma` |
| new tenant-owning `StatutoryCertificate` model (org-scoped, `snapshotJson` + `pdfArchiveKey` CAS shape) + `StatutoryCertificateStatus` enum | `employee.prisma` |
| reciprocal `workflowRuns` / `deprovisioningRuns` on `Worker`; `statutoryCertificates` on `Organization` | `worker.prisma`, `organization.prisma` |
| `AuditEntityType += WORKER, EMPLOYEE` (mirror kept in sync; enables `resourceType:'EMPLOYEE'` audit — fixes the P89 ORGANIZATION workaround) | `api/src/services/audit-writer.ts` |
| un-applied `__phase93_worker_lifecycle/{migration.sql,down.sql}` — additive ALTERs + `CREATE TABLE` + 2 defence-in-depth CHECK constraints (contractor XOR worker on WorkflowRun + DeprovisioningRun) | migrations dir |

## Verification

- `pnpm --filter @contractor-ops/db db:generate` → client regenerated (Prisma 7.8.0); committed.
- `pnpm --filter @contractor-ops/db db:check-drift` → **green** ("Committed Prisma client is in sync with schema").
- `pnpm --filter @contractor-ops/db exec prisma validate` → **valid**.
- `pnpm --filter @contractor-ops/db build` + `typecheck` → green; `pnpm typecheck --filter=@contractor-ops/api` → **green** (after the AuditEntityType sync).

## Pre-existing gate failures (NOT Phase 93; out of scope)

This worktree is off an older `main`, so two mirror gates flag pre-existing offenders unrelated to Phase 93. My additions are compliant and add **zero** new offenders:

- `db:audit-enum-casing` → fails only on `ManualOverrideCategory` (Phase 77 lowercase stored-string values; not in my diff). My new members `WORKER`/`EMPLOYEE`/`DRAFT`/`ISSUED`/`VOID` are all UPPER_SNAKE.
- `lint:schema` → fails only on `Tax1099KThreshold` (missing `organizationId` / allowlist; not in my diff). My `StatutoryCertificate` carries `organizationId`.

## Deferred (human gate — non-blocking)

**Per-region migration apply** (`db:migrate:all` EU → ME → US) is a deploy-time HUMAN GATE. The `__`-prefixed migration is authored + reversible but NOT applied to any live DB (drift-blocked local posture). All Wave 2 code compiles + typechecks against the regenerated client, so the apply is recorded as a post-merge item and does not block execution.
