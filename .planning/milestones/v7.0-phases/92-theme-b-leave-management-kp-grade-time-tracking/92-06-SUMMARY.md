# 92-06 SUMMARY — schema apply + client regen (+ 92-04 migration completion)

**Status:** complete (client + migration authored); live per-region apply HELD at human gate
**Plan:** 92-06 (wave 2)

## What shipped

- **Completed 92-04's missing pieces** (the merged 92-04 shipped only
  `ewidencja.prisma` — the trigger migration + retention edit were absent):
  - `migrations/20260701000000_ewidencja_append_only/migration.sql` — mirrors the
    AuditLog append-only hardening: `enable/force row level security`,
    `reject_ewidencja_update()` + `ewidencja_no_update` BEFORE UPDATE trigger
    (raises `restrict_violation`), `ewidencja_select` (org member),
    `ewidencja_insert` (org ops-writer), and a break-glass `ewidencja_delete`
    gated on a never-set `app.allow_ewidencja_purge` flag. No UPDATE policy
    (deny-by-default) + the trigger = immutable even to a BYPASSRLS/owner role.
  - paired `down.sql`.
  - `retention-policy.ts`: `RETENTION_YEARS['KP-ewidencja'] = 3` +
    `MODEL_RETENTION_TYPE.EwidencjaSnapshot = 'KP-ewidencja'`, with an
    adviser-verify comment recording the 3yr immutability floor (KP art. 291 §1
    claim-limitation) vs the 10yr KP §94⁴ dokumentacja-pracownicza window,
    satisfied by NON-DELETION (append-only, no `deletedAt`, no soft-delete purge).
- **Regenerated the Prisma client** — `pnpm --filter @contractor-ops/db db:generate`
  (dummy `DATABASE_URL`; `generate` does not connect). The client now exposes
  `leaveType`, `leaveRequest`, `leaveLedgerEntry`, `leaveBalance`,
  `blackoutPeriod`, `employeeTimeRecord`, `ewidencjaSnapshot`, `publicHoliday`
  delegates + the `LEAVE_REQUEST` / `EMPLOYEE_TIME_RECORD` enum members. Rebuilt
  the db `dist` so downstream packages typecheck against the new client. The
  generated client is **gitignored** in this repo (each consumer regenerates via
  `db:generate`) — nothing generated is committed.

## Verification

- `prisma generate` (7.8.0) succeeds → schema valid.
- `pnpm --filter @contractor-ops/db typecheck` passes against the regenerated client.
- `pnpm --filter @contractor-ops/db test ewidencja-immutable retention-policy` GREEN
  (9 passed). The ewidencja-immutable test asserts the migration SQL text (trigger
  + insert-only + gated delete), mirroring `auditlog-append-only.test.ts` — a
  deterministic contract that needs no live DB.

## HUMAN GATE — deferred (LOCAL-ONLY posture)

- **Dev-DB apply + live per-region (EU/ME) apply are NOT executed** — no local
  Postgres in this worktree, and the regional apply mutates production DBs. Per
  the P82–91 LOCAL-ONLY posture this is recorded as a **deferred post-merge
  migration_apply item**, not a hard block on local exec/CI:
  - Apply the additive models via `prisma db push` (or `migrate deploy`), then the
    `20260701000000_ewidencja_append_only` trigger migration, per region (EU then
    ME), only after P90's EmployeeProfile schema is confirmed applied there.
  - Run the live smoke after each apply: a raw `UPDATE "EwidencjaSnapshot"` must
    raise `restrict_violation`.
- **Post-deploy legal checkpoint:** the KP-ewidencja retention values
  (3yr floor / 10yr KP §94⁴) are adviser-verify — flag for doradca podatkowy,
  do NOT hard-block.
