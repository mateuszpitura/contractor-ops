---
phase: 92-theme-b-leave-management-kp-grade-time-tracking
plan: 15
type: execute
status: complete
requirements: [TIME-EMP-03]
---

# Plan 92-15 Summary — Ewidencja czasu pracy (KP §149 immutable register)

## What shipped

- **`use-ewidencja.ts`** — sole tRPC boundary: `trpc.ewidencja.list` (all snapshots for the selected worker) + `trpc.ewidencja.generate` via `useResourceMutation` (generate + regenerate paths, distinct success toasts). Groups snapshots by `periodKey` and ranks by `version` — the highest version is the **active** register, the rest form the **superseded chain** (active/superseded derived from version, not the `status` column, per the schema's "no status flip is written" note).
- **`ewidencja-report-section.tsx`** — wired `EwidencjaReport`: worker `Select`, loading (`Skeleton`), error (`QueryErrorPanel`), and no-employees empty. 
- **`ewidencja-report-view.tsx`** — presentational: the generate form (period start/end + `Generate report`) plus the snapshot table, or a subview empty state ("No record generated for this period" with the worker + period interpolated).
- **`ewidencja-snapshot-table.tsx`** — `DataTable` of the current snapshot per period; the active row carries the `ImmutableBadge` (active-vs-historical anchor) and a `Regenerate` action gated behind an `AlertDialog` confirm stating the append-only supersede semantics ("the old record stays in the archive"). Rows with history expand (`renderSubRow`) into the version chain.
- **`immutable-badge.tsx`** — Archived + `Lock` shape + text, tooltip "Immutable KP §149 record — cannot be edited (retained 3 years)."
- **`supersede-chain-row.tsx`** — dimmed historical version with a "Superseded {date}" chip (the date the next version replaced it).
- **`/employee-time/ewidencja` route** — thin flag-gated page.

## Deviations (backend-honest)

- **No PDF/CSV export.** The `ewidencja` router exposes only `generate`/`list`/`get` — there is no export endpoint. Export is deferred (needs a server-side PDF/CSV render); the reserved i18n keys stay. No fabricated client-side download of the register content.
- **Regenerate is the supersede trigger.** Each active period row's `Regenerate` re-runs `generate` for that period, which the backend versions (`version + 1` + `previousSnapshotId`) via the append-only INSERT — there is no edit/hard-delete affordance for archived snapshots (immutability enforced by the DB trigger).
- Confirm uses `AlertDialog` (short confirmation, correctly outside the `DialogBody` scrollable-dialog contract).

## Verification

- `pnpm --filter @contractor-ops/web-vite typecheck` — clean.
- `check:web-vite-data-layer` / `page-shells` / `presentational` / `dialog-pattern` — all OK.
- `pnpm i18n:parity` — OK. Biome: only nursery `noJsxPropsBind` warnings (consistent with the rest of the app; non-blocking).

## Deferred

- Ewidencja PDF/CSV export (needs a backend endpoint).
- de/pl/ar strings best-effort, flagged for native review.
