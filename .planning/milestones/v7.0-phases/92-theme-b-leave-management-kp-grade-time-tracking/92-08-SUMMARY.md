# 92-08 SUMMARY — synchronous WT check + ewidencja snapshot builder

**Status:** complete
**Plan:** 92-08 (wave 3)

## What shipped

**`services/wt-limit-check.ts`** (TIME-EMP-02 on-save half): pure
`checkWtLimits({jurisdiction, record, recentWeekMinutes})` resolving
`resolveWtLimits` and returning structured findings (`level`,`dimension`,`limit`,
`actual`,`copyKey`). Daily line = the hard ceiling where one exists (DE 600),
otherwise the statutory norm (PL 480); over-norm-under-ceiling is an "approaching"
nudge. The current-week heuristic flags a weekly breach vs the average cap, unless
the worker holds an opt-out AND the market permits one (UK WTR). No DB access; the
true rolling average is the daily scan's job (Plan 10). Findings carry dotted i18n
copy-keys, never rendered strings.

**`services/ewidencja-builder.ts`** (TIME-EMP-03): `buildEwidencjaSnapshot` reads
Σ `EmployeeTimeRecord` + the leave ledger for the period and freezes the KP §149
field set (per-day hours + start/end, night, OT bands, on-call dyżur minutes +
place, absences-by-type with sick/justified/unjustified breakdown) into a
deterministic (stable key order, dates as ISO strings) snapshot document.
`supersedeAndInsertEwidencja` is INSERT-only: it reads the highest existing
`version` for the (org, worker, periodKey) and INSERTs a new row with `version+1`
+ a `previousSnapshotId` back-pointer — never `update`/`updateMany`, so the
append-only trigger never conflicts. The audit write for a generation lives in the
ewidencja router (Plan 11), keeping the builder pure and unit-testable.

## Verification

- `pnpm --filter @contractor-ops/api test wt-limit-check ewidencja-builder` GREEN
  (6 passed): PL daily / DE ceiling / UK opt-out suppression; KP §149 field set +
  INSERT-only supersede (create called once, no update/updateMany, version+1 +
  previousSnapshotId).
- `pnpm --filter @contractor-ops/api typecheck` — clean (verified with Plan 07).

## Notes

- The `ewidencja-immutable` DB test (Plan 01) is already GREEN against the trigger
  migration authored in the Plan-06 commit — the runtime UPDATE-reject smoke on a
  live DB is part of the Plan-06 human gate.
- Statutory WT values (PL 480, DE 600 ceiling, UK 2880 opt-outable) are
  adviser-verify per the LOCAL-ONLY posture — post-deploy legal checkpoint.
