---
phase: 88-theme-a-us-payment-rail
plan: 11
subsystem: payments
tags: [ach, ach-return, nacha, trpc, us-payment-rail, idempotency, audit, tenant-scoping, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 88-theme-a-us-payment-rail
    provides: "ach-return.service (parseNachaReturnFile + applyAchReturns returning {failed, advisory, skipped, unmatched}) (88-10); assertUsExpansionEnabled US-surface gate (88-07); initiatePayout gate/audit shape (88-05)"
provides:
  - "payment.ingestAchReturnFile — the reachable, gated tRPC entry point that feeds an operator-uploaded NACHA return file into parseNachaReturnFile → applyAchReturns, returning {failed, advisory, skipped, unmatched} verbatim"
  - "PAYMENT_ACH_RETURN_FILE_INVALID error key for a structurally-broken return file (addenda present, nothing parseable)"
  - "us-payment-rail wiki 'ACH return-code handling' section + api-routers-catalog contract + MEMORY invariant (documentation-follows-code)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reachable money-movement entry point mirrors the initiatePayout gate: assertUsExpansionEnabled + requirePermission(payment:export) run BEFORE any parse/apply, so a non-US / unpermissioned caller is rejected before payment state is touched"
    - "Ingestion delegates the transition + per-item audit to the tested service (applyAchReturns) and adds only a masked ingestion-summary audit — the reachable layer is a thin, gated, tenant-scoping wrapper that never re-derives the flip"

key-files:
  created:
    - packages/api/src/routers/finance/__tests__/payment-ach-return.test.ts
  modified:
    - packages/api/src/routers/finance/payment-core.ts
    - packages/api/src/errors.ts
    - .planning/brain/wiki/domains/us-payment-rail.md
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/MEMORY.md

key-decisions:
  - "The reachability test drives the real tRPC caller (createCallerFactory over router({ payment: paymentCoreRouter })), not the applyAchReturns helper directly — proving payment.ingestAchReturnFile is wired + gated, which 88-10's service-level test could not. The db is a stateful in-memory stub whose update mutates the seeded item in place so the second (idempotent) call observes the persisted FAILED status."
  - "A structurally-broken return file (carries a type-7 addenda-99 return marker yet parses to zero entries) is rejected BAD_REQUEST / PAYMENT_ACH_RETURN_FILE_INVALID, giving the new error key a real, non-spurious trigger; a benign empty / non-return upload stays a clean all-zeros no-op (parser never throws). This resolves the plan's 'add one E key if a hard-parse-failure path is needed' with a narrow, real condition."
  - "An ingestion-level masked audit (payment_run.ach_return_ingested) was added in addition to the per-item transition audit, per the orchestrator's money-movement discipline (writeAuditLog on the ingestion action). tx=ctx.db routes it through the tenant-scoped client; metadata carries only sizes + disposition tallies (no bank data, no raw file text)."

requirements-completed: []  # US-PAY-01 return-code clause is now reachable end-to-end; final requirement/ROADMAP/STATE bookkeeping is the orchestrator's (parallel-worktree scope forbids touching STATE.md / ROADMAP.md).

# Metrics
duration: ~30min
completed: 2026-07-01
---

# Phase 88 Plan 11: Reachable ACH Return-Code Ingestion (Gap C entry point) Summary

**An operator can now upload a NACHA return file through a reachable, US-expansion-gated, `payment:export`-permissioned tRPC mutation (`payment.ingestAchReturnFile`) that parses it (`parseNachaReturnFile`) and idempotently applies the returns (`applyAchReturns`) to the run's live `PaymentRunItem`s — a bounced R01/R02/R03 credit flips to `FAILED` with an audited reason, a re-upload is a no-op, and the returned `{failed, advisory, skipped, unmatched}` surfaces a mis-uploaded / wrong-run file as `unmatched > 0` rather than a silent zeros-everywhere no-op — closing the ROADMAP SC#1 return-code clause end-to-end.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-01
- **Tasks:** 2 (Task 1 TDD RED→GREEN; Task 2 documentation-follows-code) + one prerequisite blocking fix
- **Files:** 1 created (test), 5 modified

## Accomplishments

- **`payment.ingestAchReturnFile` (Task 1):** a `tenantProcedure` on `paymentCoreRouter` — reachable as `payment.ingestAchReturnFile` since `paymentCoreRouter` merges into `paymentRouter` (mounted at `payment` in `root.ts`) with no sub-namespace. Mirrors `initiatePayout`'s shape: `requirePermission({ payment: ['export'] })` + `.strict()` Zod (`runId` cuid, `returnFileText` `min(1).max(5_000_000)`), then `assertUsExpansionEnabled(ctx.organizationId, ctx.region)` **before** any parse/apply. Calls `parseNachaReturnFile(input.returnFileText)` then `applyAchReturns(ctx.db, { organizationId, paymentRunId: runId, actorId: user.id, entries })` and returns the `{failed, advisory, skipped, unmatched}` summary **verbatim** (the `unmatched` field is never dropped).
- **Gating order + tenant scope:** the US-expansion gate throws `FORBIDDEN` / `US_EXPANSION_DISABLED` before `findMany` is called (proven by the gating test — `findMany` is asserted un-called). `organizationId` + `actorId` come from the session, never the client; a foreign-org run flips nothing (every entry surfaces as `unmatched`).
- **Malformed vs. benign + new E key:** a benign empty / non-return upload returns all-zeros without throwing; a file carrying a return addenda-99 marker (`/^799/m`) yet parsing to nothing is rejected `BAD_REQUEST` with the new `E.PAYMENT_ACH_RETURN_FILE_INVALID`.
- **Ingestion-summary audit:** a masked `payment_run.ach_return_ingested` audit row (tenant-scoped via `tx=ctx.db`) records who ingested a file against which run + the disposition counts — no bank data, no raw file text — alongside the per-item `payment_run.ach_return_applied` rows `applyAchReturns` writes.
- **Reachability test (Task 1):** `payment-ach-return.test.ts` drives the real tRPC caller and proves the R01 flip to `FAILED`, the idempotent re-upload no-op (`{failed:0, skipped:1}`), the `unmatched > 0` operator-safety signal (wrong invoice number **and** foreign-org run), the US-expansion gate rejecting before payment state is touched, the masked-audit discipline, and the benign-vs-malformed split — 8 tests.
- **Documentation-follows-code (Task 2):** `us-payment-rail.md` gained an "ACH return-code handling" section (flow, disposition, apply, idempotency, the `unmatched` signal, malformed-vs-benign, deferred live-webhook seam) + an entry-point row + an invariant + three agent-mistake notes + verify-live greps, with `ach-return.service.ts` added to `verify_with`; `api-routers-catalog.md` gained the `payment.ingestAchReturnFile` contract; `MEMORY.md` gained the invariant. `check:wiki-brain` reports 0 errors.

## Money-movement invariants proven (tests, through the reachable procedure)

- **Reachable flip:** an R01 entry matching a live `EXPORTED` item flips it to `FAILED` with an R01 reason; result `{failed:1, advisory:0, skipped:0, unmatched:0}`; both the per-item `ach_return_applied` and the summary `ach_return_ingested` audit actions are written.
- **Idempotent re-upload:** a second identical upload returns `{failed:0, skipped:1}` — the persisted `FAILED` status is re-observed and never re-transitioned.
- **Operator safety:** a wrong-`invoiceNumber` upload → `{failed:0, unmatched:1}`, item untouched; a foreign-org run → `{failed:0, unmatched:1}` (tenant-scoped load never sees the item).
- **Gating precedence:** with the US surface off, the call rejects `US_EXPANSION_DISABLED` and `paymentRunItem.findMany` is never called.
- **Masked audit:** the ingestion-summary metadata contains no `routingNumber` / `accountNumber` and no raw file text.

## Task Commits

1. **Prerequisite blocking fix — remove duplicate `PERSONNEL_FILE_NOT_FOUND` export** (`fix`) — `9659545fb`
2. **Task 1 (RED) — failing reachability test for `ingestAchReturnFile`** (`test`) — `8e4748cb6`
3. **Task 1 (GREEN) — `ingestAchReturnFile` procedure + `PAYMENT_ACH_RETURN_FILE_INVALID`** (`feat`) — `d7198de9f`
4. **Task 2 — documentation-follows-code (wiki + MEMORY)** (`docs`) — `d10250f4c`

## Verification

- `pnpm --filter @contractor-ops/api exec vitest run payment-ach-return` → **8 passed**.
- `pnpm --filter @contractor-ops/api exec vitest run payment-ach-return payment-payout-init payment-us-export ach-return.service` → **31 passed** (no payment regression).
- `pnpm typecheck --filter=@contractor-ops/api` → clean (14 tasks successful).
- `pnpm lint:audit-log` → OK (no direct `auditLog.create`; the summary audit routes through `writeAuditLog`).
- `pnpm lint:no-breadcrumbs` → this plan's files are breadcrumb-clean (real domain IDs R01/R02/R03/NACHA retained); the 2 failing entries are pre-existing sibling-phase test files, see Deferred Issues.
- `pnpm check:wiki-brain` → **0 errors** (1 pre-existing WARN: mixed `source_commit` prefixes across the wiki — informational).
- Grep: `ingestAchReturnFile` present on `paymentCoreRouter`; returns `{failed, advisory, skipped, unmatched}`.

## TDD Gate Compliance

Task 1 followed RED→GREEN: `test(88-11)` (`8e4748cb6`) authored the 8 failing caller tests (all 8 failed with `No procedure found on path "payment,ingestAchReturnFile"` — the correct RED, not a false pass), then `feat(88-11)` (`d7198de9f`) implemented the procedure + error key to green. No unexpected pre-implementation pass occurred. (The prerequisite `fix` commit `9659545fb` was required first so `errors.ts` could transform at all — see Deviations.)

## Deviations from Plan

### Prerequisite fixes

**1. [Rule 3 - Blocking] Removed duplicate `PERSONNEL_FILE_NOT_FOUND` export in `errors.ts`**
- **Found during:** Task 1 RED (the test could not even load).
- **Issue:** `errors.ts` at the base commit (7dd9c87) declared `export const PERSONNEL_FILE_NOT_FOUND` twice (lines 354 + 457) — a duplicate block-scoped `const` that fails the oxc/vite transform and TS compilation, breaking every module that imports `errors.ts` (i.e. the whole api package) and the base `typecheck`.
- **Fix:** dropped the orphaned first occurrence; the canonical one in the personnel-file section remains (identical value). This also un-breaks the base api typecheck.
- **File:** `packages/api/src/errors.ts`
- **Commit:** `9659545fb`

### Auto-added (money discipline)

**2. [Rule 2 - Audit] Ingestion-level masked audit `payment_run.ach_return_ingested`**
- **Rationale:** the orchestrator's money-movement discipline mandates `writeAuditLog` on the ingestion action (in addition to the per-item audit inside `applyAchReturns`). The PLAN text said "no audit is added here beyond what the service writes"; the spawn instructions take precedence for this money-movement surface (CLAUDE.md: audit on sensitive mutations). The row is masked (sizes + tallies only) and tenant-scoped via `tx=ctx.db`. Strengthens T-88-11-04 (repudiation) at the ingestion level.
- **File:** `packages/api/src/routers/finance/payment-core.ts`
- **Commit:** `d7198de9f`

### Clarifying implementation notes

- **The new E key has a real trigger.** `parseNachaReturnFile` is defensive and never throws, so there is no unconditional "hard-parse-failure". The plan's "add one E key if needed" is satisfied by a narrow condition: a file that carries a `^799` return-addenda marker yet parses to zero entries is structurally broken → `BAD_REQUEST` / `PAYMENT_ACH_RETURN_FILE_INVALID`; anything without that marker (empty / non-return) stays a benign all-zeros no-op.
- **`log.md` / `hot.md` deliberately not touched.** The CLAUDE.md wiki pipeline mentions appending to `log.md` and overwriting `hot.md`, but both are outside this plan's `files_modified` and the parallel-worktree scope is explicit ("touch ONLY files_modified"). They are high-churn shared files that concurrent siblings 87/91 may append to at the same top anchor — the exact merge hazard the scope rule guards against — and `check:wiki-brain` does not require them (it gates on `verify_with` drift only). The BM25 index (`.vault-meta/bm25/index.json`, gitignored) was rebuilt in-worktree so the gate reports 0 errors; no tracked file changed from that rebuild.

## Deferred Issues (out of scope — pre-existing, not caused by 88-11)

- `pnpm lint:no-breadcrumbs` fails repo-wide on two sibling-phase test files carrying decision-ID comments: `packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx:5` and `packages/api/src/services/__tests__/form-1099k-tracker.service.test.ts:5`. Neither is touched by this plan (already logged by 88-10). This plan's files are breadcrumb-clean.

## Known Stubs

None. `payment.ingestAchReturnFile` is a fully-wired reachable entry point feeding live return files into the 88-10 service. The live Modern Treasury return-webhook (`PayoutInitiationAdapter.handleWebhook`) is a documented deferred seam (programmatic ACH stays dark/opt-in per 88-06), intentionally referenced not built — not a stub in this plan's scope.

## Threat Flags

None new. All threat-register dispositions for this surface are mitigated: `.strict()` bounded Zod input (T-88-11-01/03), `assertUsExpansionEnabled` + `requirePermission(payment:export)` + tenant scope before any apply (T-88-11-02), per-item + ingestion-summary masked audit (T-88-11-04), the deferred live-webhook is not enabled (T-88-11-05), and the `unmatched` count surfaces a mis-uploaded / wrong-run file (T-88-11-06). No package installs (T-88-11-SC).

## Doc-follows-code

`payment-core.ts` gained a new reachable tRPC procedure → `us-payment-rail.md` (domain, `verify_with` extended) + `api-routers-catalog.md` (procedure contract) + `MEMORY.md` (invariant) were updated in the same change set; `check:wiki-brain` is green. The test file is `__tests__` (wiki-exempt). `log.md`/`hot.md` deferral rationale under Deviations.

## Self-Check: PASSED

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
