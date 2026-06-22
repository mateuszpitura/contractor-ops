---
phase: 89-theme-b-worker-model-abstraction-serial-gate
plan: 03
subsystem: db / worker-model-abstraction
tags: [backfill, migration, worker, idempotent, reversible, audit, gated]
status: partial
completed_tasks: 2
total_tasks: 3
pending_gate: "Task 3 — [BLOCKING] per-region backfill apply + staging-snapshot parity + Migration B enforcement (human-action)"
requires:
  - "89-02 — Worker base table + nullable Contractor.workerId @unique FK + Migration A (authored un-applied)"
  - "89-01 — backfill-worker.test.ts RED scaffold + contractor-parity baseline"
provides:
  - "scripts/backfill-worker.ts — idempotent reversible per-region Worker backfill + pure planWorkerBackfill export"
  - "migrations/__worker_id_required — Migration B (workerId NOT NULL + FK) authored un-applied + paired down.sql"
affects:
  - "Task 3 human gate (per-region apply A → backfill → B); future contractor-create-path wiring (flip schema to required in lockstep with Migration B)"
tech-stack:
  added: []
  patterns:
    - "Backfill script mirrors backfill-free-zone-assignment.ts (pure transform export + --dry-run + masked-URL pino + lazy createPrismaClientForUrl + $transaction + $disconnect)"
    - "Two-step migration ordering: additive nullable column (A) → backfill → NOT NULL + FK (B), B never in the same migration that added the column"
    - "System-actor AuditLog row written directly via Prisma in a db-package script (db sits below api in the dep graph — cannot import writeAuditLog without a cycle)"
key-files:
  created:
    - "packages/db/scripts/backfill-worker.ts"
    - "packages/db/prisma/schema/migrations/__worker_id_required/migration.sql"
    - "packages/db/prisma/schema/migrations/__worker_id_required/down.sql"
  modified:
    - "packages/db/prisma/schema/contractor.prisma (comment only — workerId kept nullable; see Deviations)"
    - "packages/db/src/generated/prisma/client/internal/class.ts (codegen — embedded inlineSchema comment refresh)"
decisions:
  - "planWorkerBackfill is the pure WHERE-workerId-IS-NULL idempotency guard; the script does create-Worker + set-workerId atomically in one $transaction step, batched ~1k contractors/tx"
  - "Audit row is written directly through Prisma (auditLog.create) in the db script, not via api's writeAuditLog, to avoid a db→api dependency cycle; EntityType has no WORKER member so the org-scoped backfill is recorded against ORGANIZATION with resourceId = organizationId"
  - "Contractor.workerId kept NULLABLE in the schema source: promoting it to required ahead of the migration + create-path wiring breaks the db:check-drift CI gate and the two contractor.create typecheck sites; the flip-to-required happens in lockstep with applying Migration B at the human gate (Deviation, Rule 4-adjacent)"
metrics:
  duration_min: 10
  completed: "2026-06-22"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 89 Plan 03: Worker Backfill + Migration B (Tasks 1-2 of 3) Summary

Idempotent, reversible, per-region Worker backfill script (pure `planWorkerBackfill` + batched atomic create-and-link with a system-actor audit row, `--dry-run` and `--rollback`) plus Migration B (`workerId` NOT NULL + FK) authored as un-applied SQL — turning the Plan-01 backfill RED scaffold GREEN. Task 3, the [BLOCKING] live per-region apply, remains the pending human gate; nothing was run against any database.

## What Was Built

### Task 1 — `backfill-worker.ts` (commit `1b32c161f`)

`packages/db/scripts/backfill-worker.ts` mirrors `backfill-free-zone-assignment.ts` structurally and adds the four DIFFERS the plan called for:

- **Pure `planWorkerBackfill(rows)`** — emits one `Worker` insert per contractor `WHERE workerId IS NULL`, skips already-linked rows, never mutates the source. This turned the Plan-01 `backfill-worker.test.ts` RED scaffold GREEN (the suite was failing at module resolution; it now passes all five assertions: one insert per unlinked contractor, idempotency-guard skip, re-run no-op, no source mutation, mixed-batch filter).
- **Atomic create-and-link, batched** — the apply path selects `contractor.findMany({ where: { workerId: null }, select: {...} })`, computes the plan, then for each step creates a `Worker` and `contractor.update`s `workerId` to it inside the SAME `$transaction` step, so a contractor is never left half-linked. Creates are chunked `BATCH_SIZE = 1000` contractors per transaction so the largest org does not hold a single mega-transaction (lock/timeout avoidance, RESEARCH Open-Q #3).
- **One system-actor `AuditLog` row per org** — recorded directly via `prisma.auditLog.create` (see Deviation 2), `actorType: 'SYSTEM'`, `action: 'worker.backfill.apply'`, `resourceType: 'ORGANIZATION'`, `resourceId = organizationId`, `metadataJson: { workersCreated }`.
- **`--rollback` down path** — nulls `Contractor.workerId` for every linked row then deletes the now-orphaned `Worker` rows (links nulled first so no FK protects the Workers), batched; `Contractor` rows are NEVER deleted or relinked. Writes a `worker.backfill.rollback` audit row per org. `--dry-run` (apply or rollback) performs zero writes.
- **Lazy `createPrismaClientForUrl`** from `../src/client.js` (modern prisma-client generator, never the legacy `@prisma/client` default entry), masked-DB-URL pino logging, `$disconnect` in `finally`, and a per-region `DATABASE_URL=$DATABASE_URL_{EU,ME,US}` usage block.

### Task 2 — Migration B authored un-applied (commit `83307e33a`)

- `migrations/__worker_id_required/migration.sql`: `ALTER TABLE "Contractor" ALTER COLUMN "workerId" SET NOT NULL;` + `ADD CONSTRAINT "Contractor_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;` (the `RESTRICT`/`CASCADE` pair matches Prisma's default for a required relation, so the SQL stays consistent with what `prisma migrate` would emit from a promoted schema).
- Paired `down.sql`: `DROP CONSTRAINT "Contractor_workerId_fkey"` then `ALTER COLUMN "workerId" DROP NOT NULL`, returning to the post-Migration-A nullable state.
- The `__`-prefixed directory keeps both out of Prisma's timestamped applied-migration namespace (mirroring `__worker_base_additive`). **Neither file was applied to any DB** — both are gated behind the Task 3 [BLOCKING] human checkpoint and must run only after the backfill + largest-org staging-snapshot parity sign-off (running B before the backfill rejects every existing null row — Pitfall 4).

## Verification

- `pnpm --filter @contractor-ops/db test -- backfill-worker` — GREEN (25 test files / 174 tests; previously 169 with `backfill-worker.test.ts` RED).
- Greps: `createPrismaClientForUrl` present, `dry-run` present, `rollback` present, `$transaction` present, exactly the audit writes present, NO `@prisma/client` default import, NO `console.*`.
- `pnpm lint:logs` — OK (2339 files clean). `pnpm lint:no-breadcrumbs` — OK.
- Migration B: `SET NOT NULL` ✓ and `REFERENCES "Worker"` ✓ in `migration.sql`; `DROP CONSTRAINT` + `DROP NOT NULL` ✓ in `down.sql`.
- `pnpm --filter @contractor-ops/db db:check-drift` — committed client in sync with schema.
- `pnpm typecheck --filter=@contractor-ops/db --filter=@contractor-ops/api` — GREEN.
- **No live DB mutation:** the backfill script and both Migration B files are un-run; no `migrate`/`push`/`seed`/`db:migrate:all` was invoked.

## Deviations from Plan

### 1. [Rule 4-adjacent — Architectural] Contractor.workerId kept NULLABLE in the schema source (promotion deferred to the human gate)

- **Found during:** Task 2.
- **Issue:** The plan Task 2 instructed promoting `contractor.prisma` to `workerId String @unique` (required) + `worker Worker` (required relation). The generated Prisma client is tracked in-repo and gated by `db:check-drift` (a CI step at `.github/workflows/ci.yml:44`); Plan-02 established the convention that the schema source + committed client track the *current additive DB reality* (nullable), with NOT-NULL/FK enforcement deferred. Promoting the schema to required and regenerating the client flips `ContractorCreateInput` to require `workerId` (or a nested `worker` write), which broke the API typecheck at the two existing `contractor.create` sites (`contractor-core.ts:503`, `import.ts:68`). No Phase-89 plan (89-04 worker router, 89-05 HR RBAC, 89-06 wiki) wires those create sites to also create a Worker — that create-path wiring does not yet exist and is out of this plan's scope.
- **Decision:** Per the NO_LIVE_APPLY boundary ("if db:generate/typecheck after promoting workerId-to-required somehow needs the DB migrated, do NOT migrate — note it and leave the schema consistent"), `Contractor.workerId` is left `String?` (nullable) so the schema source, generated client, and un-migrated live DB stay mutually consistent and CI stays green. Migration B's SQL is authored (the enforcement is captured as the un-applied artifact the plan asked for); the schema-source flip to required + the create-path wiring happen in lockstep with applying Migration B at the Task 3 human gate, so the generated client never diverges from the live DB.
- **Files modified:** `packages/db/prisma/schema/contractor.prisma` (comment refresh documenting the deferred promotion; `workerId String?` / `worker Worker?` unchanged in nullability), `packages/db/src/generated/prisma/client/internal/class.ts` (regenerated; only the embedded `inlineSchema` comment changed).
- **Commit:** `83307e33a`.

### 2. [Rule 3 — Blocking issue] Audit row written directly via Prisma instead of importing `writeAuditLog`

- **Found during:** Task 1.
- **Issue:** The plan's `key_links` pointed the backfill's system-actor audit row at `packages/api/src/services/audit-writer.ts` (`writeAuditLog`). But `@contractor-ops/api` depends on `@contractor-ops/db`; importing `writeAuditLog` from a `db`-package script would create a circular dependency.
- **Fix:** The script writes the audit row directly through `prisma.auditLog.create`, mirroring the audit-writer's canonical row shape. `EntityType` has no `WORKER` member, so the org-scoped backfill is recorded against `ORGANIZATION` with `resourceId = organizationId`. Documented inline as a self-contained WHY comment.
- **Files modified:** `packages/db/scripts/backfill-worker.ts`.
- **Commit:** `1b32c161f`.

## Pending Gate — Task 3 [BLOCKING] human-action

The live per-region application is the milestone's highest-risk operation and was NOT executed. It remains the pending human gate:

1. Provision the largest-org staging snapshot.
2. `DATABASE_URL=$STAGING_URL tsx packages/db/scripts/backfill-worker.ts --dry-run` (confirm plan count = unlinked-contractor count, zero writes).
3. Apply on staging, verify one Worker per contractor + exactly one system-actor audit row per org.
4. Parity: `pnpm --filter @contractor-ops/api test -- contractor-parity` against staging + spot-check lists / dashboard KPIs / payment-run / classification-scan / export / portal.
5. Re-run safety (idempotent: zero new inserts).
6. Reversibility (`--rollback` restores pre-backfill state; contractors intact), then re-apply.
7. Only after parity sign-off: per region apply Migration A → backfill → Migration B (B LAST), flipping the schema source to required + wiring the create paths in lockstep. Per LOCAL-ONLY posture this may be deferred as a recorded post-merge item rather than hard-blocking.

## Known Stubs

None. `planWorkerBackfill` is a complete pure transform; the apply/rollback paths are fully implemented (un-run by design, gated at Task 3).

## Requirements

WORKER-01 left `[ ]` (not marked complete) — Task 3's per-region apply + parity sign-off is its acceptance, and that is the pending human gate.

## Commits

- `1b32c161f` — feat(89-03): idempotent reversible per-region Worker backfill script
- `83307e33a` — feat(89-03): author Migration B (workerId NOT NULL + FK) as un-applied SQL

## Self-Check: PASSED

All created files present on disk (`backfill-worker.ts`, `__worker_id_required/migration.sql` + `down.sql`, `89-03-SUMMARY.md`); both task commits (`1b32c161f`, `83307e33a`) present in git history.

## Task 3 — Live Apply (operator-approved, 2026-06-22)

The [BLOCKING] human gate was run with explicit operator approval against the **EU Neon DB** (`DATABASE_URL`=`_EU`=`_ME` → same `ep-spring-meadow-…eu-central-1` instance; `_US` unset). **dry-run-first.**

**Applied:**
- **Migration A** — via direct `psql` on the migration SQL file ONLY (not `prisma migrate`/`db push`), to avoid sweeping the other pending v7.0 migrations (86 tax models etc.). Additive: `Worker` table + `WorkerType` enum + 2 indexes + nullable `Contractor.workerId` + unique index. `Contractor` count unchanged (1040).
- **Backfill** — `backfill-worker.ts` (after the `BATCH_SIZE 1000→100` + 60s-tx-timeout fix; the 1000/tx first attempt hit the Neon 5s interactive-tx limit and **rolled back atomically — no partial state**). Result: **1040 Workers created, 1:1 linked, 0 unlinked, 0 orphans, 0 double-links, 0 contractor rows lost.** Idempotent (re-run plans 0). Audited (2 `worker.backfill.apply` rows: 1000 + 40).
- **Parity GREEN** post-backfill: `worker-regression.test.ts` + `contractor-contract-snapshot.test.ts` (14 tests) pass; full db suite GREEN (174). The 12 api-suite failures are unrelated 88-01 RED scaffolds (NACHA/Fedwire/withholding), not a regression.

**DEFERRED (NOT applied) — Migration B (`workerId` SET NOT NULL + FK):**
**UPDATE — Migration B APPLIED 2026-06-22** (after the create-path wiring landed). The three `contractor.create` sites (`contractor-core.ts` tRPC create, `import.ts` `createContractorFromRow`, `seed-dev.ts` bulk) were wired to create+link a `Worker` atomically (commit `19bd83537`; two-step `worker.create`→scalar `workerId` inside the existing tx; schema flipped to `workerId String @unique` required; 63 tests GREEN incl. dedup + the Worker regression baselines; typecheck GREEN proving all create sites found). Pre-flight then confirmed 0 null workerIds + 0 orphan links, and Migration B (`SET NOT NULL` + `ADD CONSTRAINT ... FOREIGN KEY REFERENCES "Worker"`) was applied via direct `psql` on the EU Neon DB.

**WORKER-01 COMPLETE** (Contractor side, `[x]`) — model + backfill + create-path wiring + NOT-NULL/FK enforcement, contractor-path parity GREEN, zero regression. The Employee side of the union lands with Phase 90. WORKER-02..05 (router split / RBAC / flag = 89-04/05/06) remain.

**Live DB state for future agents:** `Worker` exists + holds 1040 rows (all `CONTRACTOR`); `Contractor.workerId` is **NOT NULL** + carries the `Contractor_workerId_fkey` FK → `Worker(id)`; every contractor (existing + newly-created) has a linked Worker. Migrations A + B were applied out-of-band via `psql` (not recorded in `_prisma_migrations`) — `db:check-drift` will reflect the additive delta as already-present.
