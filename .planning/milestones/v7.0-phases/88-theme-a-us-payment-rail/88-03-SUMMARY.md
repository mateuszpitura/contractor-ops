---
phase: 88-theme-a-us-payment-rail
plan: 03
subsystem: payments
tags: [withholding, payment-run, irc-3406, 1042-s, tin-match, audit, tdd]

# Dependency graph
requires:
  - phase: 88-02
    provides: Contractor.backupWithholdingFlagged column + regenerated Prisma client
  - phase: 86-tin-match
    provides: tin-match.service setBackupWithholdingFlag port (previously unwired)
  - phase: 87-1042-s
    provides: treaty-rate.service applyTreaty (resolved 1042-S rate + 30% statutory fallback)
provides:
  - "applyWithholding — jurisdiction-agnostic per-item withholding decision (SA WHT + US backup 24% + 1042-S treaty), single HALF-UP round, gross/net integer invariant"
  - "applyWithholdingToRun — writes the withheld figure on each PaymentRunItem (the single source of truth the 1099 box-4 / 1042-S box-2 aggregate) + a payment_run.withholding_applied audit row per applied item"
  - "createBackupWithholdingFlagWriter — concrete tin-match writer persisting Contractor.backupWithholdingFlagged via a tenant-scoped, idempotent updateMany (closes the P86 loose end)"
affects: [88-04, 88-06, 86-tin-match, 87-1042-s]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generalize a single-jurisdiction path by adding branches AROUND the unchanged original (SA WHT path byte-identical)"
    - "Pure per-item decision function + thin tx orchestrator that persists + audits"
    - "Recorded withholding figure on PaymentRunItem is the single source of truth (no recompute in the forms)"
    - "Tenant-scoped idempotent flag write via updateMany(id + organizationId)"

key-files:
  created: []
  modified:
    - packages/api/src/routers/finance/payment-shared.ts
    - packages/api/src/services/tin-match.service.ts
    - packages/api/src/services/__tests__/payment-withholding.test.ts
    - packages/api/src/services/__tests__/tin-match.service.test.ts

key-decisions:
  - "applyWithholding is the PURE per-item decision the 88-01 scaffold pinned; the tx orchestrator took the name applyWithholdingToRun (the plan's literal rename of _applyWhtIfSaudi could not be the pure function the test imports)"
  - "Audit resourceType is PAYMENT_RUN (the valid AuditEntityType) with the item id in metadata.paymentRunItemId — PAYMENT_RUN_ITEM is not a member of the audit entity enum"
  - "Flag writer uses updateMany({ id, organizationId }) for tenant scoping + idempotency instead of the plan's update({ id })"
  - "Backfill is forward-only: snapshot-flagged contractors read false until re-run through TIN matching (adviser-verify; legal-deferred)"

patterns-established:
  - "One withholding deduction covers SA + US-backup + 1042-S; the SA branch is preserved verbatim and regression-guarded"
  - "writeAuditLog on withholding application, committed atomically in the seeding tx (D-13)"

requirements-completed: [US-PAY-01]

# Metrics
duration: ~22min
completed: 2026-07-01
---

# Phase 88 Plan 03: US Withholding Deduction + tin-match Flag Wiring Summary

**Generalized the single-jurisdiction Saudi WHT path into one jurisdiction-agnostic withholding deduction (SA WHT, US 24% backup withholding per IRC §3406, and 1042-S treaty withholding) applied at payment-run item seeding, recorded the withheld figure as the single source of truth on PaymentRunItem with an audit row per applied item, and wired the previously-unwired P86 tin-match writer to persist Contractor.backupWithholdingFlagged.**

## Performance
- **Duration:** ~22 min (includes a fresh-worktree `pnpm install`)
- **Completed:** 2026-07-01
- **Tasks:** 2 (Task 1 TDD: RED → GREEN; Task 2)
- **Files modified:** 4 (2 source + 2 test)

## Accomplishments
- **`applyWithholding` (pure, per item):** resolves the deduction by jurisdiction — Saudi cross-border via the unchanged `calculateWht` path; US source + `backupWithholdingFlagged` → 24% (IRC §3406); US source + foreign recipient → `applyTreaty` rate (30% statutory fallback). One HALF-UP round at the rate; `amountMinor = grossAmountMinor − whtAmountMinor`; returns `null` (item untouched) for a US domestic recipient, a 0% treaty outcome, or a non-withholding jurisdiction.
- **`applyWithholdingToRun` (tx orchestrator):** short-circuits before any item read for non-withholding orgs (preserving the original SA-only early return), then writes `grossAmountMinor / amountMinor / whtAmountMinor / whtRate / whtTreatyApplied / whtTreatyReference / whtServiceType` per applied item, keeps the SA-only `invoice.withholdingMinor` write, and writes a `payment_run.withholding_applied` audit row per applied item (D-13). `seedRunItems` now calls it.
- **Single source of truth (D-02):** the recorded `whtAmountMinor` is authoritative; the forms aggregate it rather than recomputing (`form-1099-nec.computeBox4Minor` already takes the recorded figure as input).
- **`createBackupWithholdingFlagWriter` (D-03):** the concrete tin-match writer that persists `Contractor.backupWithholdingFlagged = true` via a tenant-scoped, idempotent `updateMany({ id, organizationId })` — closing the P86 port that previously lived only in `TaxFormSubmission.snapshotJson`. The TIN never reaches the write (boolean only).
- **SA regression green:** the Saudi WHT path is byte-identical (same `calculateWht` call, `whtServiceType: 'technical_services'`, and `invoice.withholdingMinor` write); the regression guard stays green.

## Task Commits
1. **Task 1 — RED (un-skip + DB-boundary mock + treaty fixture):** `4688b6361` (test)
2. **Task 1 — GREEN (applyWithholding + applyWithholdingToRun):** `d239265b3` (feat)
3. **Task 2 — tin-match flag column writer + tests:** `aa66bb369` (feat)

Plan metadata (this SUMMARY + deferred-items): committed with this doc.

## Verification
- `payment-withholding` + `tax-rate.service` + `tin-match.service` + `treaty-rate.service` test files: **36 passed (4 files)**, including the SA regression guard.
- `pnpm typecheck --filter=@contractor-ops/api` — passes.
- `pnpm lint:no-breadcrumbs` — OK (no planning-ID comments).
- `pnpm lint:audit-log` — OK (no direct `auditLog.create`; withholding audit routes through `writeAuditLog`).

## TDD Gate Compliance
- RED commit `4688b6361` (test) precedes GREEN commit `d239265b3` (feat); RED failed for the right reason (`applyWithholding is not a function`, 5 cases) with the 2 SA regression guards already green. No unexpected pass during RED.

## Deviations from Plan

### Auto-fixed / reconciled

**1. [Rule 3 — Contract] `applyWithholding` is the pure decision function; tx orchestrator is `applyWithholdingToRun`**
- **Found during:** Task 1 (turning the 88-01 RED scaffold green).
- **Issue:** The plan said "rename `_applyWhtIfSaudi` to `applyWithholding`", but the scaffold imports `applyWithholding` and calls it as a **pure** `({ org, item }) => decision` — incompatible with the tx-mutating `(tx, orgId, runId) => void` shape. The test (acceptance criteria) is authoritative.
- **Fix:** `applyWithholding` is the pure per-item decision; the tx-mutating orchestrator took the name `applyWithholdingToRun`. The single `seedRunItems` call site was updated; grep confirmed no external importers of `_applyWhtIfSaudi`, so no alias was needed.
- **Files:** `payment-shared.ts`. **Commit:** `d239265b3`.

**2. [Rule 3 — Type] Audit `resourceType: 'PAYMENT_RUN'` (not `PAYMENT_RUN_ITEM`)**
- **Issue:** `PAYMENT_RUN_ITEM` is not a member of `AuditEntityType` (audit-writer) — typecheck would fail.
- **Fix:** Used `resourceType: 'PAYMENT_RUN'` with `resourceId: paymentRunId` and the item id carried in `metadata.paymentRunItemId`. Still one audit row per applied item (T-88-03-04).
- **Files:** `payment-shared.ts`. **Commit:** `d239265b3`.

**3. [Rule 2 — Tenant safety] Flag writer uses `updateMany({ id, organizationId })`**
- **Issue:** The plan's `update({ where: { id: recipientId } })` is not tenant-scoped and throws on a missing row.
- **Fix:** `updateMany({ where: { id: recipientId, organizationId }, data: { backupWithholdingFlagged: true } })` — tenant-scoped and idempotent (a missing/cross-tenant row is a no-op).
- **Files:** `tin-match.service.ts`. **Commit:** `aa66bb369`.

**4. [Test infra] DB-boundary mock + extra cases in the scaffold**
- Added `vi.mock('@contractor-ops/db')` (mirroring `treaty-rate.service.test.ts`) + a DE treaty fixture so the 1042-S branch runs with no live DB, and added two cases beyond the original three (30% statutory fallback; US-domestic → null). The pinned behavioral contract (24% backup, treaty rate, gross/net invariant) is unchanged.
- **Files:** `payment-withholding.test.ts`. **Commit:** `4688b6361`.

## Known Stubs
None. `createBackupWithholdingFlagWriter` is fully implemented and unit-tested; it currently has no production caller because the P86 year-end batch / staff router that consumes it is a documented downstream follow-up (D-02/D-03 wiring), not a stub in this plan's code.

## Threat Flags
None beyond the plan's `<threat_model>`. The withholding amount is derived server-side from org region + `Contractor.backupWithholdingFlagged` + `applyTreaty` (never client input), written in the seeding tx with `writeAuditLog`; audit metadata carries last-4 / no full TIN.

## Deferred Issues
- **Documentation-follows-code (wiki) → plan 88-07.** `payment-shared.ts` / `tin-match.service.ts` appear in `wiki/structure/key-services.md` + `wiki/domains/us-tax-forms.md`; the phase-88 wiki synthesis (incl. the "payment run is the withholding source of truth" invariant for `MEMORY.md` and `patterns/money-rounding.md`) is owned by the dedicated plan **88-07**, mirroring Phase 89's 89-06. The phase-level `check:wiki-brain` gate is satisfied once 88-07 lands in the merged phase diff.
- **Pre-existing `rbac-recipients.test.ts` failure (out of scope).** 1 failing case (`payroll_officer` resolves to `[]`) present on base commit `42f4412f5`; no RBAC source touched here. Logged to `deferred-items.md` (SCOPE BOUNDARY).
- **P86/P87 form ↔ payment reconciliation wiring.** D-02 makes the payment run authoritative; the small follow-up so the 1099 box-4 / 1042-S box-2 read aggregated payment withholding is the consumer of `createBackupWithholdingFlagWriter` + the recorded `whtAmountMinor`.

## Self-Check: PASSED
- Files verified present: `payment-shared.ts`, `tin-match.service.ts`, `payment-withholding.test.ts`, `tin-match.service.test.ts`.
- Commits verified present: `4688b6361`, `d239265b3`, `aa66bb369`.
- Tests confirmed green: 36 passed across the 4 affected files; typecheck + lint guards pass.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
