---
phase: 88-theme-a-us-payment-rail
plan: 10
subsystem: payments
tags: [nacha, ach, ach-return, payments, idempotency, audit, tenant-scoping, tdd, vitest]

# Dependency graph
requires:
  - phase: 88-theme-a-us-payment-rail
    provides: "ach-return.service throwing contract stub (locked types + parse/map RED) (88-08); NACHA generator fixed-width record layout in payment-export.ts (88-04)"
provides:
  - "parseNachaReturnFile — hand-rolled defensive reader of NACHA entry-detail (type 6) + addenda-99 (type 7) return records"
  - "mapReturnCodeToStatus — R01/R02/R03 (+ R-family) → FAILED with human reason; C-codes / NOC → ADVISORY"
  - "applyAchReturns — idempotent, tenant-scoped status transition (matched live item → FAILED + failureReason) with one masked audit row per transition, returning {failed, advisory, skipped, unmatched}"
affects: [88-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Untrusted fixed-width file parsed defensively (length-guarded slice/trim, skip malformed, never throw) with zero external dependency, mirroring the hand-rolled generator's column offsets"
    - "Idempotent money-movement status transition: already-FAILED item is skipped (re-delivery no-op, never un-fail); unmatched signal distinguishes a mis-uploaded file from a clean run"

key-files:
  created: []
  modified:
    - packages/api/src/services/ach-return.service.ts
    - packages/api/src/services/__tests__/ach-return.service.test.ts

key-decisions:
  - "Idempotency + never-un-fail collapse to one status guard: only PENDING/EXPORTED/PAID items transition to FAILED, so any already-FAILED item (same code or different) is skipped — a re-delivered file is a no-op and a return can never revert a failure."
  - "An unrecognised, non-correction return code defaults to FAILED (fail-safe): an unposted credit is never silently treated as settled; ADVISORY is reserved for the C-code / NOC correction family."
  - "unmatched counts only FAILED-disposition entries with no live-item match; ADVISORY entries are always tallied as advisory (a NOC references the run, not a specific bounce), so a correction never inflates the wrong-run signal."
  - "A local in-loop status flip (match.status = 'FAILED') guards against two entries in the same file targeting one item — the second is skipped, not double-transitioned."

patterns-established:
  - "RED→GREEN for the DB-apply: idempotency / unmatched / tenant-isolation assertions authored against the throwing stub, then implemented to green (the parse/map RED came pre-authored in 88-08)."

requirements-completed: []  # US-PAY-01 return-code clause is implemented at the logic level here; the reachable entry point (ingestAchReturnFile) that closes it end-to-end is 88-11.

# Metrics
duration: ~25min
completed: 2026-07-01
---

# Phase 88 Plan 10: ACH Return-Code Service (Gap C) Summary

**A bounced ACH credit now reliably flips its live `PaymentRunItem` back to `FAILED`: `ach-return.service.ts` parses a NACHA return file into structured entries, maps R01/R02/R03 (and the R-family) to a FAILED disposition with a human reason while C-codes / NOC stay ADVISORY, and applies the returns idempotently and tenant-scoped with one masked audit row per transition — returning `{failed, advisory, skipped, unmatched}` so a mis-uploaded / wrong-run file is distinguishable from a clean no-bounce run.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-01
- **Tasks:** 2 (TDD; the DB-apply gate ran RED→GREEN as its own commit pair)
- **Files modified:** 2 (0 created — both files pre-existed from the 88-08 stub/RED)

## Accomplishments

- **`mapReturnCodeToStatus` (Task 1):** explicit reasons for R01 (insufficient funds), R02 (account closed), R03 (no account / unable to locate); the rest of the R-family → FAILED with a generic returned-by-the-bank reason; the C-code / NOC correction family → ADVISORY. Input code is uppercase-normalised. An unrecognised non-correction code defaults to FAILED (fail-safe money posture).
- **`parseNachaReturnFile` (Task 1):** a hand-rolled, zero-dependency reader of the fixed-width NACHA return layout. It pairs each entry-detail (type 6) record with its immediately-following addenda-99 (type 7) return record at the exact column offsets `generateNachaFile` writes, extracting `traceNumber` / `individualId` (= the invoice number the export wrote) / `amountMinor` / `returnCode` / `addendaInfo`. Parsing is defensive across the untrusted-file boundary: length-guarded slices, trim, and stray / malformed records skipped rather than thrown on.
- **`applyAchReturns` (Task 2):** the money-movement status-transition layer. Loads run items tenant-scoped (`where { paymentRunId, organizationId }`, `include invoice.invoiceNumber`), matches each entry by `individualId → invoiceNumber` (fallback `paymentReference`), flips a transitionable matched item to `FAILED` + `failureReason`, and writes one masked `writeAuditLog` per transition. The whole apply runs in a single `db.$transaction`. Returns `{ failed, advisory, skipped, unmatched }`.

## Money-movement invariants proven (tests)

- **Failure transition:** an R01 entry flips a matched `EXPORTED` item to `FAILED` with a reason naming R01 + "insufficient", and writes exactly one `payment_run.ach_return_applied` audit row whose metadata carries `itemId/returnCode/reason/amountMinor` only (no `routingNumber`/`accountNumber`).
- **Advisory:** a C01 / NOC entry leaves the item `PAID` and writes a `payment_run.ach_correction_advised` row — never a status change.
- **Idempotency:** a second identical apply returns `{failed:0, skipped:1}` — no second `update`, no second audit (already-FAILED item skipped).
- **Unmatched signal:** a FAILED-disposition entry with a wrong `individualId` returns `{unmatched:1, failed:0}` with no `update` / audit — not silently dropped, not counted as skipped.
- **Tenant isolation:** a foreign-org item is never in the tenant-scoped load, so its entry surfaces as `unmatched` (never flipped); `findMany` asserted scoped to the caller org.
- **Defensive parse:** a file with stray / short records still parses to exactly the one well-formed entry (never throws).

## Task Commits

1. **Task 1 — NACHA return parser + return-code mapping** (`feat`) — `b9c1329d2`
2. **Task 2 (RED) — failing applyAchReturns idempotency / unmatched / tenant assertions** (`test`) — `8083553de`
3. **Task 2 (GREEN) — idempotent tenant-scoped applyAchReturns + masked audit + unmatched signal** (`feat`) — `792402bac`

## Verification

- `pnpm --filter @contractor-ops/api exec vitest run ach-return.service` → **11 passed** (3 map + 2 parse + 1 malformed-guard + 5 apply).
- `pnpm typecheck --filter=@contractor-ops/api` → clean (14 tasks successful).
- `pnpm lint:audit-log` → OK (the transition audits via `writeAuditLog`, no direct `auditLog.create`).
- `pnpm lint:logs` → OK (warn via `@contractor-ops/logger`, no `console.*`).
- `lint:no-migration-breadcrumbs` → clean on `ach-return.service.ts` (real domain IDs R01/R02/R03/NOC/addenda 99 retained; no phase/plan IDs). See Deferred Issues for the two pre-existing sibling-file violations.
- Grep: `status: 'FAILED'`, `writeAuditLog`, and `unmatched` all present in the service.

## TDD Gate Compliance

The DB-apply followed the RED→GREEN gate: `test(88-10)` (`8083553de`) authored the failing idempotency / unmatched / tenant assertions against the throwing stub (5 fail, 6 pass), then `feat(88-10)` (`792402bac`) implemented to green. The parse/map RED was pre-authored in 88-08 (`b3e5d3bfb`); Task 1's `feat` (`b9c1329d2`) turned it green. No unexpected pre-implementation pass occurred.

## Deviations from Plan

**None affecting scope.** The plan was executed as written. Two clarifying implementation notes:

- **Idempotency guard is status-based, not failureReason-substring-based.** The plan action suggested "skip if already FAILED-with-this-code (idempotency guard on failureReason containing the code)". Because the plan also mandates "never un-fail" (an already-FAILED item with a *different* code is also skipped), both cases collapse to a single, stronger guard: only `PENDING/EXPORTED/PAID` items transition, so any `FAILED` item is skipped regardless of code. This satisfies the idempotent re-delivery no-op and the never-un-fail rule with one predicate. Proven by the idempotency test (second apply → skipped:1, no dup update/audit).
- **Masked-audit assertion targets the field keys, not the word "account".** The R0x reasons legitimately contain the word "account" (e.g. "Receiving account is closed"), so the test asserts the audit metadata omits the `routingNumber` / `accountNumber` *keys* (mirroring the `payment-payout-init` audit test) rather than the substring "account".

## Deferred Issues (out of scope — pre-existing, not caused by 88-10)

- `pnpm lint:no-breadcrumbs` fails repo-wide on two sibling-phase test files that carry decision-ID comments: `packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx:5` and `packages/api/src/services/__tests__/form-1099k-tracker.service.test.ts:5`. Neither is touched by this plan; logged to `deferred-items.md`. This plan's files are breadcrumb-clean.

## Known Stubs

None. The 88-08 throwing contract stub (`applyAchReturns`, `parseNachaReturnFile`, `mapReturnCodeToStatus`) is fully implemented here. The reachable tRPC entry point (`ingestAchReturnFile`) that feeds live return files into `parseNachaReturnFile → applyAchReturns` is owned by 88-11 (documented, intentional; not a stub in this plan's scope).

## Threat Flags

None new. All threat-register dispositions for this surface (T-88-10-01…06) are mitigated in code: defensive parsing (T-01), audit on every transition (T-02), idempotency guard (T-03), masked audit/log metadata (T-04), tenant-scoped load so a foreign-org item is never flipped (T-05), and the `unmatched` counter + high-proportion warn (T-06). No package installs (T-88-10-SC).

## Doc-follows-code

`ach-return.service.ts` adds real behavior to a `packages/` service. Per the plan's strict worktree scope (touch only the two `files_modified`; sibling phases 87/91 run concurrently and the wiki is shared state), the US-payout return-code domain wiki synthesis is intentionally deferred to the phase-level wiki plan — the same posture 88-08 recorded ("domain documentation lands with the real implementation… which owns the wiki updates") and consistent with how prior phases used a dedicated wiki-synthesis plan. The test file is `__tests__` (wiki-exempt).

## Self-Check: PASSED

- Files exist: `packages/api/src/services/ach-return.service.ts`, `packages/api/src/services/__tests__/ach-return.service.test.ts` — both present.
- Commits present in git log: `b9c1329d2`, `8083553de`, `792402bac`.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
