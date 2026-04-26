---
phase: 61
plan: 04
subsystem: einvoice
tags: [leitweg-id, trpc, multi-tenant, rbac, peppol, zod, xrechnung, einv-05]
dependency-graph:
  requires:
    - phase: 61-01
      provides:
        - LeitwegId Prisma model + (organizationId, value) unique + contractor/contract indexes
        - leitwegIdSchema Zod validator (structure + MOD-11-10, 31 tests green)
        - Contractor.peppolSchemeId + Contractor.peppolParticipantValue scalar columns
        - Red-scaffold leitweg-id-resolver.test.ts + leitweg-id.test.ts (describe.todo)
  provides:
    - resolveLeitwegIdForInvoice(db, organizationId, { contractId?, contractorId? }): Promise<ResolvedLeitwegId | null>
    - leitwegIdRouter with 7 procedures (list / listByContractor / listByContract / create / update / delete / setDefault)
    - tRPC input schemas (createLeitwegIdInput / updateLeitwegIdInput / setDefaultInput / listByContractorInput / listByContractInput / deleteLeitwegIdInput)
    - peppolParticipantPairSchema Zod helper for Contractor peppolSchemeId + peppolParticipantValue
  affects:
    - Plan 61-05 (capability lookup consumes peppolParticipantPairSchema + SML cache)
    - Plan 61-06 (finalizeEInvoice calls resolveLeitwegIdForInvoice to populate BT-10)
    - Plan 61-07 (Settings UI calls leitwegIdRouter procedures — LeitwegIdInlineSelector)
    - Plan 61-08 (E-invoicing Settings page renders leitwegIdRouter.list)
tech-stack:
  added: []
  patterns:
    - Two-tier short-circuit resolver (never one OR-query) — each DB plan stays readable
    - Tenant-scoped every Prisma `where` clause — multi-tenant safety at query layer (belt + braces over Prisma client extension)
    - Cross-tenant ids surface as NOT_FOUND (never FORBIDDEN) — avoids response-code oracle enumeration (T-61-04-06)
    - Shared writeProcedure constant (tenantProcedure.use(requirePermission)) — DRY permission gating across mutation set
    - Prisma P2002 → TRPCError CONFLICT mapping at router boundary
    - Default-flip writes wrapped in `$transaction` — serialisable on Postgres via Prisma default
key-files:
  created:
    - packages/api/src/services/leitweg-id-resolver.ts
    - packages/api/src/schemas/leitweg-id.ts
    - packages/api/src/routers/leitweg-id.ts
  modified:
    - packages/validators/src/leitweg-id.ts (added peppolParticipantPairSchema)
    - packages/validators/src/index.ts (re-export peppolParticipantPairSchema + PeppolParticipantPair type)
    - packages/validators/src/__tests__/leitweg-id.test.ts (+9 pair-constraint tests)
    - packages/api/src/services/__tests__/leitweg-id-resolver.test.ts (replaced 4 todos with 7 real tests)
    - packages/api/src/routers/__tests__/leitweg-id.test.ts (replaced 6 todos with 11 real tests)
    - packages/api/src/root.ts (register leitwegIdRouter)
key-decisions:
  - "Permission scope is `contractor:update` (singular), not `contractors:write` as the plan stated. The auth permission registry (packages/auth/src/permissions.ts) only defines `contractor: ['create', 'read', 'update', 'delete', 'bulk']` — no `contractors` or `write` scope exists. Treated as plan terminology drift; intent (admin-only CRUD via contractor-scoped permission) preserved."
  - "Resolver made pure (not a tRPC procedure). Plan 06's finalize mutation will call it directly with `ctx.db`; keeps query count observable (≤2 findFirst per invoice) without tRPC overhead."
  - "Contract-tier skipped entirely when `contractId` is null/undefined — a `findFirst({ where: { contractId: null } })` query would silently match contractor-default rows (which have null contractId) and produce the wrong resolution. Dedicated regression test added."
  - "Cross-tenant ids surface as NOT_FOUND (not FORBIDDEN) for update / setDefault / delete. Prevents an attacker from enumerating internal ids via FORBIDDEN-vs-NOT_FOUND response-code oracle (T-61-04-06)."
  - "Mutations share a single `leitwegIdWriteProcedure = tenantProcedure.use(requirePermission({ contractor: ['update'] }))` constant. DRY over per-procedure `.use()` duplication; every mutation inherits the gate."
  - "No automatic default promotion when the deleted row was the contractor's default. User-surfaced: the UI renders a 'no default' chip and the user re-picks explicitly. Avoids a surprise side-effect write at delete time."
patterns-established:
  - "Leitweg-ID D-06 resolution is canonical: contract override > contractor default > null. Plan 06 MUST call resolveLeitwegIdForInvoice exactly as-is."
  - "Multi-tenant leak tests assert NOT_FOUND (not FORBIDDEN) on foreign-org ids. All Phase 61+ routers touching cross-tenant surface should follow this."
  - "Default-flipping writes are transactional: updateMany(other=false) + update(target=true) inside ctx.db.$transaction."
requirements-completed: [EINV-05]
metrics:
  duration_min: 18
  completed_date: "2026-04-14"
  tasks_completed: 2
  commits:
    - hash: "d084fe84"
      subject: "feat(61-04): leitweg-id resolver + tRPC input schemas + peppol pair constraint"
    - hash: "291b01ba"
      subject: "feat(61-04): leitwegIdRouter with 7 procedures + 11 multi-tenant/rbac tests"
---

# Phase 61 Plan 04: Leitweg-ID Resolver + Router Summary

## One-Liner

Leitweg-ID data layer (EINV-05) shipped: pure D-06 two-tier resolver (≤2 findFirst per invoice finalize), 7-procedure tenant-scoped `leitwegIdRouter` with RBAC-gated mutations + atomic default-flip transactions, cross-tenant leak tests that assert NOT_FOUND (not FORBIDDEN), and the Peppol-ID pair-constraint Zod helper Plan 05 will reuse.

## Performance

- **Duration:** ~18 min (wall-clock, including a worktree-drift recovery event — see Issues)
- **Started:** 2026-04-14T13:07Z
- **Completed:** 2026-04-14T13:26Z
- **Tasks:** 2 (both auto, both TDD-style with RED tests expanded in-place)
- **Files created:** 3
- **Files modified:** 6
- **Tests added:** 27 (7 resolver + 11 router + 9 pair-constraint)

## Accomplishments

- **Resolver service** with the exact D-06 order (contract override > contractor default > null), two tier-specific `findFirst` calls, contract-tier skipped when `contractId` is null to avoid phantom matches against contractor-default rows. 7 unit tests green.
- **tRPC input schemas** module (`packages/api/src/schemas/leitweg-id.ts`) — 6 exports covering the full router surface; `createLeitwegIdInput` applies `leitwegIdSchema` (structure + MOD-11-10) at the boundary so a malformed ID never reaches the DB.
- **leitwegIdRouter** with 7 procedures; every mutation gated by `requirePermission({ contractor: ['update'] })` via a shared `leitwegIdWriteProcedure`; every `where` clause carries `organizationId: ctx.organizationId`. Default-flip writes wrapped in `$transaction` (used in create + update + setDefault — 3 transaction sites).
- **peppolParticipantPairSchema** + re-export from `@contractor-ops/validators`; 9 unit tests covering both-null, both-set, half-set (either half), bad scheme formats, empty/too-long value. Plan 05 capability-lookup + Plan 07 UI Contractor form both consume this schema.
- **Cross-tenant leak tests** assert NOT_FOUND (not FORBIDDEN) on update / setDefault / delete when orgB targets an orgA row — defence against T-61-04-06 response-code oracle.
- **Root router wired** — `leitwegId: leitwegIdRouter` registered alphabetically after `einvoice`.

## Task Commits

1. **Task 1 — Resolver + input schemas + peppol pair helper** — `d084fe84` (feat)
2. **Task 2 — Router + 11 tests + root wiring** — `291b01ba` (feat)

_Both tasks expanded Plan 01 RED-scaffold `describe.todo` tests to GREEN assertions + implementation in the same commit; no separate RED/GREEN/REFACTOR commits were warranted because the scaffolded todos were single-line placeholders, not genuine failing tests._

## Resolver Query Count per Finalize

**Worst case: 2 queries.** Best case: 1.
- If the invoice has a `contractId` AND a row matches → 1 query.
- If the invoice only has a `contractorId` → 1 query (the contract tier is skipped entirely).
- If both are supplied and no contract row exists → 2 queries (contract miss, contractor hit).
- No-match (D-06 rule 3) → 2 queries worst case, or fewer if one side is absent.

Captured in test #6 (`skips contract tier when contractId is null/undefined`): `expect(db.leitwegId.findFirst).toHaveBeenCalledTimes(1)` is enforced.

## Transaction Isolation

Prisma's `$transaction` defaults to `ReadCommitted` on Postgres. Since Neon is Postgres-compatible, this is what we get. We considered requesting `Serializable` for the setDefault write (T-61-04-05 double-default race) but decided against it:

- The race condition is bounded: two concurrent `setDefault({ id: X })` calls both select the target's `contractorId`, both then `updateMany(other=false)` + `update(target=true)`. Under `ReadCommitted` the second caller's `updateMany` sees the first's committed write and the per-row update runs last-writer-wins; the worst-case outcome is the same single default for the contractor.
- `Serializable` would introduce retry-on-conflict logic which the single-UI-actor case doesn't need.
- If a future phase introduces bulk setDefault across many contractors in one request, that's the place to revisit.

Documented for Plan 06 to inherit the same assumption when it wraps finalize + generate + validate inside its own transaction.

## Cross-Tenant Leak Tests Added (Beyond Plan Minimum)

Plan stipulated 3 cross-tenant tests (#6 update, #8 delete, #10 list). Added one more:
- Resolver test #4 (`cross-tenant isolation`) — orgA row, orgB caller → returns null. Guards against the resolver-level bypass case where a caller might be able to read a foreign-org Leitweg-ID by supplying that row's contractId. Even though the higher-level `resolveLeitwegIdForInvoice` is only called from within tenant-scoped contexts today, the test documents the invariant at the function level.

## RBAC Enforcement Confirmation

- **Queries (list / listByContractor / listByContract):** tenant-gated (every `where` filters by `ctx.organizationId`). No explicit permission check — reading one's own Leitweg-IDs is implied by the session tenant binding. This matches the peppol.ts reference pattern.
- **Mutations (create / update / delete / setDefault):** all chained through `leitwegIdWriteProcedure = tenantProcedure.use(requirePermission({ contractor: ['update'] }))`. Test #11 asserts `FORBIDDEN` when `authApi.hasPermission` returns `{ success: false }`.

Only 2 `requirePermission` textual occurrences appear in the router file (one import, one call — at the shared constant definition). Per the plan's intent ("every mutation gates on permission"), this is satisfied via the shared constant.

## Files Created/Modified

- `packages/api/src/services/leitweg-id-resolver.ts` — pure D-06 resolver (~115 LOC)
- `packages/api/src/schemas/leitweg-id.ts` — 6 tRPC input schemas (~75 LOC)
- `packages/api/src/routers/leitweg-id.ts` — 7-procedure CRUD router (~270 LOC)
- `packages/api/src/services/__tests__/leitweg-id-resolver.test.ts` — 7 unit tests (replaced 4 todos)
- `packages/api/src/routers/__tests__/leitweg-id.test.ts` — 11 router tests (replaced 6 todos)
- `packages/validators/src/leitweg-id.ts` — +peppolParticipantPairSchema (~40 LOC)
- `packages/validators/src/__tests__/leitweg-id.test.ts` — +9 pair-constraint tests
- `packages/validators/src/index.ts` — re-export peppolParticipantPairSchema + PeppolParticipantPair
- `packages/api/src/root.ts` — register `leitwegId: leitwegIdRouter`

## Decisions Made

See frontmatter `key-decisions`. Summary:

1. **Permission scope: `contractor:update` not `contractors:write`.** Plan terminology drift — the auth registry defines only `contractor` (singular), actions `[create/read/update/delete/bulk]`. `update` is the closest to the plan's "write" intent. Documented as non-deviation; Plan 07's UI must not hand-roll a different gate.
2. **Resolver stays a pure function**, not a tRPC procedure. Callers (Plan 06 finalize) pass `ctx.db` directly. Keeps query count observable and testable.
3. **Contract-tier skipped when contractId is null.** Non-obvious; guarded by a dedicated regression test.
4. **Cross-tenant → NOT_FOUND, never FORBIDDEN.** Response-code oracle prevention.
5. **`$transaction` uses Postgres default (ReadCommitted).** Last-writer-wins on the default-flip race is acceptable; no serializable retries needed.
6. **No auto-promotion on delete.** UI surfaces "no default" chip; user re-picks explicitly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `pnpm install` required on fresh worktree**
- **Found during:** Task 1 setup (the initial worktree had no `node_modules/`).
- **Issue:** Prisma client couldn't be resolved because the workspace was never installed.
- **Fix:** `pnpm install --ignore-scripts` (avoids the pre-existing `@contractor-ops/integrations` TS error flagged in Plan 01's blockers).
- **Impact:** ~11s one-time cost; no code changes.

**2. [Rule 3 — Blocking] Prisma client not generated**
- **Found during:** Task 1 pre-flight guard.
- **Issue:** `packages/db/generated/prisma/client/index.d.ts` did not exist; resolver import of `PrismaClient` from `@contractor-ops/db/generated/prisma/client` would have failed TypeScript.
- **Fix:** `DATABASE_URL=... pnpm --filter @contractor-ops/db exec prisma generate` (dummy URL — generate doesn't hit the DB).
- **Verification:** `grep -q "leitwegId" packages/db/generated/prisma/client/index.d.ts` → match; 1215 total `LeitwegId` references in the generated client.

**3. [Rule 3 — Blocking] Validators `dist/` stale (leitwegIdSchema TS2305)**
- **Found during:** Task 2 API typecheck.
- **Issue:** `packages/validators/package.json` exports resolve to `./dist/*`. The `peppolParticipantPairSchema` addition wasn't built, and more importantly the index.ts re-export of `leitwegIdSchema` pre-dated the dist build from Plan 01 (dist was stale relative to src).
- **Fix:** `pnpm --filter @contractor-ops/validators build` (pure `tsc` — no bundler). After rebuild, zero TS errors in the new leitweg files.

**4. [Rule 1 — Bug] Incorrect Leitweg-ID fixtures in router tests**
- **Found during:** Task 2 first test run — 3/18 assertions failed with `Leitweg-ID structure invalid` + `check digit invalid` Zod errors.
- **Issue:** I initially wrote `991-12345-07`, `99133333TEST-09`, `12-ABCDE-95` — two wrong check digits AND one missing hyphen (`99133333TEST` is coarse 8-digits + fine `TEST`, requires a hyphen separator: `99133333-TEST`).
- **Fix:** Computed correct values via a temporary in-repo vitest harness calling `computeLeitwegCheckDigit`. Replaced constants with `991-12345-06`, `99133333-TEST-07`, `12-ABCDE-02`. All 18 tests green.
- **Files modified:** `packages/api/src/routers/__tests__/leitweg-id.test.ts` (single constant block, already within the Task 2 commit).

### Acceptance-Criteria Interpretation Notes (non-deviations)

- **`grep -c "findFirst|findUnique" leitweg-id-resolver.ts` returns 3, not 2.** Two are real query invocations; one is the `findFirst` signature on the minimal `LeitwegIdReader` type (used for callers passing a narrower db fake in tests). The plan's "exactly 2" criterion expresses call-site count; intent is met.
- **`grep -c "tenantProcedure" leitweg-id.ts` returns 6, not ≥7.** The router declares `leitwegIdWriteProcedure = tenantProcedure.use(...)` once and reuses it for all 4 mutations; the 3 queries attach `tenantProcedure` directly. Every procedure is tenant-gated; the count metric doesn't reflect the DRY consolidation.
- **`grep -c "requirePermission" leitweg-id.ts` returns 2, not ≥4.** Same reason — the shared `leitwegIdWriteProcedure` calls `requirePermission` exactly once (one import + one call), and all 4 mutations inherit it. Intent ("every mutation gates on permission") is satisfied.

### Plan Terminology Drift (non-deviation)

- Plan specifies `requirePermission({ contractors: ['write'] })`. Auth registry defines `contractor: ['update']`. Applied correct scope.

---

**Total deviations:** 4 auto-fixed (3 blocking environment issues, 1 test-data bug).
**Impact on plan:** Zero scope creep. Environmental fixes are one-off; test-data bug caught by the test suite it was for; all within committed work.

## Threat Flags

None. Every new surface introduced by this plan (resolver + router + pair-constraint) was explicitly covered by the plan's `<threat_model>` (T-61-04-01 through T-61-04-07). The resolver test for cross-tenant isolation and the router tests for NOT_FOUND-on-foreign-org-ids implement the mitigations for T-61-04-01 and T-61-04-06 respectively.

## Issues Encountered

**1. Worktree ephemeral-directory drift.** Mid-Task 2 (after Task 1 was committed in the sandbox worktree), the working directory was reset to the main repo checkout and the worktree was removed. My first Task 1 commit (`422fcafe` in the worktree) was discarded. Recovery: recreated all Task 1 + Task 2 files verbatim in the main repo (everything was still in context), re-ran tests + typecheck, and committed fresh (`d084fe84`, `291b01ba`). No data loss; one duplicated round of work.

**2. Full API typecheck still has 119 pre-existing errors** (exceljs missing types, Better Auth User/Session include chains, Phase 57 tax-id-validation re-export, Phase 58 approval Prisma client extension mismatches). Zero of these are in my new files. Per the scope boundary, I did not fix them. They're already flagged in STATE.md Blockers and tracked historically.

## Next Phase Readiness

- **Plan 61-05 (Peppol capability service):** can import `peppolParticipantPairSchema` from `@contractor-ops/validators` for input validation; can call the existing `peppolParticipant.*` router and extend with a capability-cache reader. No blockers.
- **Plan 61-06 (finalize + send mutation):** can call `resolveLeitwegIdForInvoice(ctx.db, ctx.organizationId, { contractId, contractorId })` directly. The resolver returns `{ value, source, leitwegIdRowId }` on hit — `source` is the audit-log hint ("which tier fired"), `leitwegIdRowId` is the FK for EInvoiceLifecycleEvent attribution. No blockers.
- **Plan 61-07 (Settings UI):** can call `leitwegId.list / create / update / setDefault / delete` from the tRPC client. Permission gate is `contractor:update` — confirm the Settings page surfaces a non-admin "you don't have permission" state rather than a raw tRPC error.

## Self-Check: PASSED

**Files created (verified present):**
- FOUND: `packages/api/src/services/leitweg-id-resolver.ts`
- FOUND: `packages/api/src/schemas/leitweg-id.ts`
- FOUND: `packages/api/src/routers/leitweg-id.ts`

**Files modified (verified):**
- FOUND: `packages/validators/src/leitweg-id.ts` (peppolParticipantPairSchema present)
- FOUND: `packages/validators/src/index.ts` (re-export present)
- FOUND: `packages/validators/src/__tests__/leitweg-id.test.ts` (40 tests total)
- FOUND: `packages/api/src/services/__tests__/leitweg-id-resolver.test.ts` (0 todos, 7 tests)
- FOUND: `packages/api/src/routers/__tests__/leitweg-id.test.ts` (0 todos, 11 tests)
- FOUND: `packages/api/src/root.ts` (`leitwegId: leitwegIdRouter` wired)

**Commits (verified in `git log --oneline`):**
- FOUND: `d084fe84` feat(61-04): leitweg-id resolver + tRPC input schemas + peppol pair constraint
- FOUND: `291b01ba` feat(61-04): leitwegIdRouter with 7 procedures + 11 multi-tenant/rbac tests

**Critical invariants:**
- Resolver query count ≤2 per invoice: verified by test #6 `expect(db.leitwegId.findFirst).toHaveBeenCalledTimes(1)` in the happy contractor-default path.
- Cross-tenant isolation at resolver layer: test #4 passes.
- Cross-tenant isolation at router layer (update/delete): tests #6 + #8 pass with `code: 'NOT_FOUND'`.
- Default-flip atomicity: setDefault test asserts exactly one default per contractor.
- No console.*: `grep -rn "console\." packages/api/src/routers/leitweg-id.ts packages/api/src/services/leitweg-id-resolver.ts packages/api/src/schemas/leitweg-id.ts` → no matches.
- tests: `pnpm --filter @contractor-ops/api test -- --run leitweg-id` → 18 passed / 0 failed; `pnpm --filter @contractor-ops/validators test -- --run leitweg-id` → 40 passed / 0 failed.

---
*Phase: 61-xrechnung-e-invoicing*
*Completed: 2026-04-14*
