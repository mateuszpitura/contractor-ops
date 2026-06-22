---
phase: 89-theme-b-worker-model-abstraction-serial-gate
verified: 2026-06-22T13:10:00Z
status: passed
score: 4/4 success criteria verified (WORKER-01..05 all satisfied)
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
deferred:
  - truth: "Employee data surface (registry/profile fields, employeeRouter wired to employee:read)"
    addressed_in: "Phase 90 (EMP-REG)"
    evidence: "ROADMAP Phase 90 goal; 89-04/89-05 SUMMARYs scope-fence the employee profile to Phase 90; employeeRouter is a deliberate read-only skeleton; employees.tsx is a flag-dark coming-soon empty state"
---

# Phase 89: Theme B — Worker Model Abstraction (serial gate) Verification Report

**Phase Goal:** The platform models employees as a discriminated `Worker` type with zero data migration for existing orgs and no regression to contractor read paths — the gate every other Theme B phase waits on.
**Verified:** 2026-06-22T13:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

I started from the adversarial hypothesis that tasks were checked off but the goal was missed, and tried to falsify each claim against the actual codebase + the live EU Neon DB + the actual gates. Every load-bearing claim survived. The Worker identity root is real and DB-enforced (verified by direct read-only SELECT on the live DB), contractor route shapes are snapshot-locked and GREEN, the flag-off is genuinely three-layered, and the RBAC fence + tenant isolation are proven by substantive tests — not stubs.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Worker identity root exists + is DB-enforced (Contractor.workerId NOT NULL + FK; 1:1; Contractor.id stable) | ✓ VERIFIED | Live EU Neon DB: `contractors=1040, workers=1040, nullworker=0, orphan=0, dupes=0, is_nullable="NO", fk_present=true (Contractor_workerId_fkey), non_contractor_workers=0`. Schema `contractor.prisma:64` `workerId String @unique` (required) + `:72` `worker Worker` relation; `:10` `id String @id @default(cuid())` unchanged (no relink). Migration B SQL `__worker_id_required/migration.sql`: `SET NOT NULL` + `ADD CONSTRAINT ... REFERENCES "Worker"`. |
| 2 | Contractor regression = ZERO (contract snapshot + parity baselines GREEN; contractor.* shapes unchanged) | ✓ VERIFIED | `contractor-contract-snapshot.test.ts` (812-line snapshot, 40 contractor procedures, committed 89-01 `850fc7468`, NOT regenerated since) + `worker-regression.test.ts` GREEN. 4 api test files = 26 tests passed. Snapshot uses `z.toJSONSchema` on real `appRouter` input/output. |
| 3 | Extension correctness (`withWorkerTypeDefault` explicit-where-wins; 4 raw blind-spot sites guarded) | ✓ VERIFIED | `worker-type.ts`: defaults `workerType='CONTRACTOR'` on `Worker` reads only, opt-out when `where.workerType` present; chained outermost `withWorkerTypeDefault(withSoftDelete(withTenantScope(...)))` in `index.ts:76`. 4 `// contractor-only-raw-sql:` annotations (search.ts, dashboard.ts, contractor-shared.ts ×2). `pnpm check:contractor-rawsql-workertype` → OK (1326 files). db worker-type/backfill tests = 24 passed. |
| 4 | Flag-off is real (3-layer: METHOD_NOT_FOUND + FORBIDDEN + render-removal; contractor.* present both states) | ✓ VERIFIED | `workforce-flag.test.ts` proves load-time absence (METHOD_NOT_FOUND), per-request FORBIDDEN/WORKFORCE_DISABLED, contractor.* present in BOTH branches. `root.ts:180` conditional-spread; `require-workforce-flag.ts` per-request guard; `dashboard-home.tsx:166` `workforceEnabled &&` render-removal. Flag `default: false` (`flags-core.ts:220`, ships dark). |
| 5 | RBAC + isolation (employee resource + 4 HR roles, BFLA fence; Worker cross-org leak proven; not in globalModels) | ✓ VERIFIED | `permissions.ts:49` `employee:['create','read','update','delete','approve_leave']`; `roles.ts:189-213` 4 HR roles, each only `contractor:['read']` or none. `roles.test.ts:239` BFLA fence + `:268` 10-roles-byte-identical. `worker-tenant-isolation.test.ts:295` globalModels structural guard + behavioral cross-org leak. `tenant.ts:42-68` globalModels — Worker ABSENT. auth tests = 188 passed. |

**Score:** 4/4 ROADMAP success criteria verified; WORKER-01..05 all satisfied.

### ROADMAP Success Criteria mapping

- **SC#1** (additive `workerType` default CONTRACTOR + `@@index([organizationId, workerType])`, zero data migration): ✓ — `worker.prisma` carries the enum + both indexes; backfill was additive + idempotent (`WHERE workerId IS NULL`, re-run = no-op) + reversible (`--rollback`). Note: the original "zero data migration / extend Contractor in place" wording was formally amended at Phase-89 discuss (REQUIREMENTS.md:85) to a one-time additive backfill — the live result is 1040→1040 with 0 contractor rows destroyed.
- **SC#2** (contractor.* shapes preserved snapshot-locked; shared workerRouter + employeeRouter; contractor reads scoped): ✓ — snapshot GREEN; workerRouter + employeeRouter exist and gate on flag. The literal "all contractor findMany/findFirst call sites filtered to workerType:'CONTRACTOR'" was satisfied by an architecturally-superior approach: the discriminator lives ONLY on the `Worker` table, so Contractor-table reads are inherently contractor-only (documented in `worker-type.ts` + the guard header). The 4 raw `FROM "Contractor"` blind spots are annotated + CI-guarded. See Note 1.
- **SC#3** (organizationId invariant on Worker; HR-only RBAC + 4 new roles; existing 8 roles unchanged): ✓ — Worker absent from globalModels (org scope injected); 4 HR roles added; existing roles byte-identical. Role keys are snake_case (`hr_admin` etc.) not UPPER_SNAKE — deliberate convention match (Note 2). "Existing 8 roles" — the codebase actually has 10 pre-existing roles, all frozen byte-identical (a stronger guarantee than the SC).
- **SC#4** (flag off → employee routes removed from render tree + tRPC FORBIDDEN/NOT_FOUND): ✓ — fully proven by `workforce-flag.test.ts` (both NOT_FOUND/METHOD_NOT_FOUND and FORBIDDEN paths) + web-vite render-removal.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Employee data surface (registry, profile fields, employeeRouter→employee:read wiring, /employees data) | Phase 90 (EMP-REG) | employeeRouter is a deliberate read-only skeleton; `employees.tsx` is a flag-dark coming-soon empty state; 89-04/89-05 SUMMARYs scope-fence to Phase 90. The phase goal is the GATE (model + split + RBAC + flag), not the employee feature. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/db/prisma/schema/worker.prisma` | Worker base table + WorkerType enum + 2 indexes | ✓ VERIFIED | enum + `@@index([organizationId])` + `@@index([organizationId, workerType])`; tenant-owning |
| `packages/db/prisma/schema/contractor.prisma` | workerId @unique required + worker relation; id stable | ✓ VERIFIED | `:64` required @unique, `:72` relation, `:10` id unchanged |
| `migrations/__worker_base_additive/{migration,down}.sql` | Migration A additive + reversible | ✓ VERIFIED | nullable column + table + indexes; paired down.sql |
| `migrations/__worker_id_required/{migration,down}.sql` | Migration B NOT NULL + FK, LAST | ✓ VERIFIED | SET NOT NULL + FK; APPLIED on live EU DB (confirmed) |
| `packages/db/scripts/backfill-worker.ts` | idempotent/reversible/audited backfill | ✓ VERIFIED | pure planWorkerBackfill + atomic batched create-and-link; live result 1040 1:1 |
| `packages/db/src/worker-type.ts` | withWorkerTypeDefault extension | ✓ VERIFIED | explicit-where-wins; chained outermost; exported |
| `scripts/check-contractor-rawsql-workertype.ts` | CI guard for raw FROM Contractor | ✓ VERIFIED | wired into lint:ci; passes (1326 files) |
| `packages/api/src/routers/core/worker.ts` | shared cross-type workerRouter | ✓ VERIFIED | list/getById, explicit workerType, flag-gated |
| `packages/api/src/routers/core/employee.ts` | skeleton employeeRouter | ✓ VERIFIED | list, workerType=EMPLOYEE, read-only |
| `packages/api/src/middleware/require-workforce-flag.ts` | per-request + boot guards | ✓ VERIFIED | assertWorkforceEnabled FORBIDDEN + isWorkforceRegistered |
| `packages/auth/src/{permissions,roles}.ts` | employee resource + 4 HR roles | ✓ VERIFIED | resource + 4 roles, BFLA fence |
| `.planning/brain/wiki/domains/worker-foundation.md` | 89-06 wiki synthesis | ✓ VERIFIED | exists; MEMORY.md worker invariants present |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| contractor.create (contractor-core.ts:502) | Worker | atomic $transaction worker.create→workerId | ✓ WIRED | worker + contractor created in ONE tx; new rows never orphaned |
| import.ts createContractorFromRow:70 | Worker | tx.worker.create + workerId:81 | ✓ WIRED | same atomic pattern |
| seed-dev.ts:1949/2127 | Worker | Worker roots seeded before Contractor | ✓ WIRED | Wave 0 identity roots |
| createTenantClient | withWorkerTypeDefault | index.ts:76 outermost chain | ✓ WIRED | rides on tenant-scope + soft-delete |
| root.ts:248 | worker/employee routers | conditionalWorkforceRouters spread | ✓ WIRED | absent when isWorkforceRegistered()=false |
| dashboard-home.tsx:166 | /employees quick-link | useFlag('module.workforce-employees') | ✓ WIRED | render-removed when off |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| workerRouter.list | ctx.db.worker.findMany | live Worker table (1040 rows) | Yes | ✓ FLOWING |
| Contractor reads | ctx.db.contractor (snapshot-locked) | live Contractor table | Yes | ✓ FLOWING |
| employees.tsx | (none — flag-dark empty state) | n/a (Phase 90) | No (by design) | ⚠️ deferred to Phase 90 (not a gap — intentional scope fence) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Live Worker DB state | read-only SELECT on EU Neon (URL masked) | 1040/1040, 0 null/orphan/dupe, NOT NULL, FK present, 0 non-CONTRACTOR | ✓ PASS |
| rawsql guard | `pnpm check:contractor-rawsql-workertype` | OK (1326 files) | ✓ PASS |
| no-breadcrumbs | `pnpm lint:no-breadcrumbs` | OK | ✓ PASS |
| api typecheck | `pnpm typecheck --filter=@contractor-ops/api` | GREEN (14/14 tasks) | ✓ PASS |
| api worker/flag/snapshot tests | `vitest run worker-tenant-isolation workforce-flag contractor-contract-snapshot worker-regression` | 4 files / 26 tests passed | ✓ PASS |
| auth RBAC tests | `vitest run role-permission-matrix roles permissions` | 4 files / 188 tests passed | ✓ PASS |
| db worker tests | `vitest run worker-type backfill-worker` | 2 files / 24 tests passed | ✓ PASS |
| wiki-brain | `pnpm check:wiki-brain` | 0 errors, 1 warn (multi source_commit, non-blocking) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| WORKER-01 | 89-02/03 | Worker base table + Contractor link, workerType default CONTRACTOR | ✓ SATISFIED | live DB 1040 1:1 + NOT NULL/FK; schema + migrations |
| WORKER-02 | 89-04 | tRPC split: workerRouter + contractorRouter (shapes preserved) + employeeRouter | ✓ SATISFIED | routers present; contract snapshot GREEN |
| WORKER-03 | 89-05 | tenant-isolation on Worker; HR-only fields per-type RBAC | ✓ SATISFIED | Worker not in globalModels; cross-org leak test |
| WORKER-04 | 89-05 | 4 HR roles, existing roles unchanged | ✓ SATISFIED | roles.ts + byte-identical guard (188 auth tests) |
| WORKER-05 | 89-04 | workforce-employees flag gates Theme B; off = render-removal + FORBIDDEN | ✓ SATISFIED | workforce-flag.test.ts (3-layer) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none in phase-touched source) | — | — | — | No TBD/FIXME/XXX/HACK/PLACEHOLDER in any worker/employee/RBAC/backfill/guard source file |
| apps/web-vite/.../employees.tsx | 30/32 | `comingSoon` i18n keys | ℹ️ Info | Legitimate flag-dark WCAG empty state; documented Phase-90 scope fence, not a stub |

### Notes / Adversarial Findings (non-blocking)

**Note 1 — SC#2 literal wording vs implementation (architecturally superior, accepted):** SC#2 says "all contractor findMany/findFirst call sites are filtered to workerType:'CONTRACTOR'". The implementation instead places the discriminator ONLY on the `Worker` table — Contractor-table reads carry no discriminator because a Contractor row is inherently a contractor (the `withWorkerTypeDefault` extension defaults on `Worker`, not `Contractor`). This is *more* robust than per-call-site filtering (no call site can forget it) and the 4 raw `FROM "Contractor"` blind spots are annotated + CI-guarded + pinned by `worker-regression.test.ts`. Not a gap — the SC intent (contractor reads never leak cross-type, contractors stay contractor-scoped) is fully met and verified on the live DB (0 non-CONTRACTOR workers; contractor reads unchanged).

**Note 2 — Role casing deviation (documented, accepted):** Roles are `hr_admin`/`hr_manager`/`payroll_officer`/`leave_approver` (snake_case) vs the REQUIREMENTS/ROADMAP UPPER_SNAKE (`HR_ADMIN` etc.). The codebase keys every role snake_case and `RoleName` derives from the keys; snake_case is the correct convention match, documented in 89-05 SUMMARY + roles.ts comment. Not a gap.

**Note 3 — REQUIREMENTS.md tracking-table inconsistency (documentation drift, not a goal failure):** REQUIREMENTS.md line 286 still shows `| WORKER-01 | Phase 89 | Pending |` in the status table, while line 85 marks WORKER-01 `[x] DONE` and the 89-03 SUMMARY declares it COMPLETE. The live DB proves WORKER-01 is actually achieved (NOT NULL + FK applied, 1040 1:1). This is a stale tracking-table row that should be flipped to Complete for auditability — it does NOT affect goal achievement. Recommend updating line 286 to `Complete`.

**Note 4 — Migrations applied out-of-band via psql (recorded, accepted):** Migrations A + B were applied to the EU Neon DB via direct `psql` (not `prisma migrate`), so they are NOT in `_prisma_migrations`. This was a deliberate choice (89-03 SUMMARY) to avoid sweeping unrelated pending v7.0 migrations. The live schema matches the schema source (verified: NOT NULL + FK present), so `db:check-drift` sees the delta as already-present. ME/US regions: `_ME` points at the same EU instance; `_US` is unset — so only the EU dev DB carries the live state, which matches the local-only deploy posture. Future production per-region apply remains a recorded operational item, consistent with the LOCAL-ONLY posture.

### Human Verification Required

None. All four success criteria were verified programmatically: schema/migration inspection, a live read-only DB count confirming the NOT NULL + FK + 1:1 backfill, and execution of every gate (typecheck, the four+ test suites, the rawsql guard, no-breadcrumbs, wiki-brain). No visual/UX/real-time/external-service behavior is load-bearing for this gate phase (the only UI surface is an intentional flag-dark empty state deferred to Phase 90).

### Gaps Summary

No gaps. The phase goal — a DB-enforced discriminated `Worker` identity root with zero contractor regression, the serial gate for Theme B — is genuinely achieved, not merely task-checked. The strongest evidence is the live EU Neon DB: 1040 contractors each linked 1:1 to a Worker, `workerId` NOT NULL with an enforced FK, zero orphans/dupes/nulls — exactly matching the schema source and Migration B. Contractor route shapes are snapshot-locked (812-line snapshot, committed in 89-01, never regenerated) and GREEN. The flag-off is a real three-layer gate proven by `workforce-flag.test.ts`. RBAC is fenced (BFLA) and tenant isolation proven (cross-org leak test). Three documentation/convention deviations (Notes 1-3) are documented and non-blocking; the only actionable follow-up is flipping the stale REQUIREMENTS.md tracking row for WORKER-01 to Complete.

---

_Verified: 2026-06-22T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
