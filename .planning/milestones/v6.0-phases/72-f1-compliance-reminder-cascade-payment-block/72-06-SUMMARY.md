---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 06
subsystem: api
tags: [payments, compliance, audit, transaction, toctou, jsonb, snapshot]

requires:
  - phase: 72-02
    provides: PaymentRunComplianceCheck table + EligibilityVerdict enum
  - phase: 72-04
    provides: assertContractorPaymentEligibility (re-asserted at export)
  - phase: 72-05
    provides: operator registry context (shared compliance surface)
provides:
  - buildSnapshotForContractor (D-17 replay-ready snapshot)
  - payment.lockAndExport atomic compliance audit rows + TOCTOU re-assertion (D-09/D-16/D-18)
  - FAIL-verdict separate-tx forensic recording (D-19)
affects: []

tech-stack:
  added: []
  patterns:
    - "Compliance audit rows written atomically with the PaymentExport row in the export tx"
    - "TOCTOU re-assertion inside the export transaction; FAIL verdicts recorded in a separate tx after rollback"
    - "Minimal structural client interface for tx typing (tenant-extended client compat)"

key-files:
  created:
    - packages/api/src/services/payment-export-compliance-snapshot.ts
  modified:
    - packages/api/src/routers/finance/payment.ts
    - packages/api/src/services/__tests__/payment-run-compliance-check.test.ts

key-decisions:
  - "Wired into the EXISTING 3-phase lockAndExport split (tx-1 validate/load, no-tx file generation, tx-2 transition+export) rather than the plan's single-transaction pseudocode. The TOCTOU re-assertion + PASS check-row writes land in tx-2 atomic with the PaymentExport row — that is the real D-18 boundary. File bytes are generated before tx-2 but only returned after tx-2 commits, so an aborted export discards them."
  - "FAIL-verdict separate-tx (D-19) runs in the catch after the parent tx rolls back; best-effort (logged on failure, never masks the original PRECONDITION_FAILED)."
  - "Snapshot tx typed via a minimal structural SnapshotClient (contractorComplianceItem.findMany returning Promise<unknown>, result cast) — the tenant-extended ctx.db tx passes without the concrete-client deep-instantiation errors."
  - "Dropped waivedAt/satisfiedAt from the snapshot — those columns do not exist on ContractorComplianceItem (Phase 71 schema). snapshotJson keeps the other D-17 fields."
  - "lockAndExport permission is payment:['export'] (the plan said create); used the real permission unchanged."

patterns-established:
  - "Every payment-write entry point (create + lockAndExport) is helper-gated; the CI payment-gate-guard now reports zero offences"

requirements-completed: [COMPL-07, COMPL-05]

duration: ~40 min
completed: 2026-05-31
---

# Phase 72 Plan 06: Atomic PaymentRunComplianceCheck on lockAndExport Summary

**`payment.lockAndExport` now re-asserts contractor eligibility inside the export transaction (TOCTOU defence) and writes one frozen-snapshot PaymentRunComplianceCheck PASS row per contractor atomic with the PaymentExport row; on a newly-blocked contractor the export aborts with PRECONDITION_FAILED and a separate transaction records FAIL-verdict rows (paymentExportId=null) so every export attempt leaves a forensic trail.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-05-31
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments
- `buildSnapshotForContractor` — full BLOCKING-set snapshot (D-17), PASS/FAIL verdict + failureReasons, POLICY_RULE_SET_VERSION stamp
- `lockAndExport` tx-2: TOCTOU re-assertion + atomic PASS audit rows linked to the export
- Catch path: FAIL-verdict rows in a separate tx (paymentExportId=null), best-effort
- payment-gate-guard reports ZERO offences (both payment-write entry points gated); no addItems/updateItems
- 5 GREEN tests (PASS rows, full-set snapshot, TOCTOU abort, FAIL separate-tx, MISSING classification); api typecheck + biome clean

## Task Commits
1. **Snapshot builder + lockAndExport atomicity/TOCTOU/FAIL-tx + guard verification + GREEN tests (Tasks 72-06-01..04)** - `329fc7a1` (feat)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Structure] 3-phase lockAndExport instead of single-tx pseudocode**
- The real lockAndExport uses an F-DB-16 split (file generation outside the tx to avoid long-held row locks). Integrated the eligibility re-assert + PASS check rows into tx-2 (atomic with the PaymentExport row) and the FAIL recording into the catch — preserving the existing performance structure while meeting D-09/D-16/D-18/D-19.

**2. [Rule 1 - Bug] Snapshot/tx types**
- Used a minimal structural SnapshotClient (Promise<unknown> findMany) + result cast, mirroring the gate/recovery pattern, so the tenant-extended tx compiles. Dropped non-existent waivedAt/satisfiedAt columns.

---

**Total deviations:** 2 (1 structural-integration, 1 bug). Audit/atomicity semantics are exactly as the plan specified. No scope creep.

## Issues Encountered
- The plan's optional `pnpm test --testNamePattern='payment'` full-router run still cannot collect because of the pre-existing Phase 76 `getIdpAuditLogger` mock gap in root.ts-importing tests (documented in 72-04/72-05 SUMMARYs). The new service-level test file passes in isolation (5/5). Not introduced here.

## User Setup Required
None.

## Next Phase Readiness
- COMPL-07 complete. Wave 5: Plan 72-08 (cron wiring + feature-flag registry entry) — the final plan.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
