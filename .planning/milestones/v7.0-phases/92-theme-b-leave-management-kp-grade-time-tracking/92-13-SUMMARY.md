---
phase: 92-theme-b-leave-management-kp-grade-time-tracking
plan: 13
type: execute
status: complete
requirements: [LEAVE-03]
---

# Plan 92-13 Summary — Team calendar (capacity + conflict)

## What shipped

- **`use-team-calendar.ts`** — sole tRPC boundary: `trpc.leave.listTeamCalendar({from,to,teamId?})` keyed on a month/quarter range; `nuqs` URL state for `view` (month|quarter), `from` (anchor month), and `team`. Aggregates the per-team-bucket days into one entry per date (sums out-count, ORs conflict) for the "all teams" case, or filters server-side when a team is selected. Holidays mapped by date. `teamOptions` derived from the payload.
- **Presentational tree (props-in → JSX-out):**
  - `team-calendar/team-calendar-view.tsx` — `TeamCalendarView({viewMode, days, anchorDate})`; month = one grid, quarter = three stacked month grids; always renders the `CapacityLegend`.
  - `calendar-month-grid.tsx` — Monday-start 7-column grid, `role="grid"`, RTL-aware arrow-key navigation (ArrowLeft/Right swap under `dir="rtl"`; Up/Down = ±7), roving `tabIndex`.
  - `capacity-cell.tsx` — ≥44px pointer target, capacity band tint via the `color-mix(in oklch, var(--status-*) …)` proportion-bar idiom (success→warning→danger), date numeral + `{percent}% out`, holiday muted + dot + name, `aria-label` carrying date + capacity + count.
  - `conflict-marker.tsx` — `TriangleAlert` shape (visible non-colour cue) + `sr-only` "Conflict" + tooltip with the overlap detail; meaning never conveyed by colour alone.
  - `capacity-legend.tsx` — always-visible band → meaning key.
- **`team-calendar-section.tsx`** — wired `TeamCalendar`: owns loading (grid `Skeleton`), empty (`AtelierEmptyState variant="page"`, icon `CalendarRange`), error (`QueryErrorPanel`); toolbar with team `Select`, Month/Quarter `Tabs`, and prev/next nav (reusing `Common.pagination.previous/next`).
- **`/leave/calendar` route** — thin flag-gated page (`module.workforce-employees`), registered in `dashboard-routes.tsx`.

## Capacity model note (backend-honest)

`listTeamCalendar` reports a per-team-per-day **out-count** + **conflict** flag — not a team headcount (no headcount query exists). Capacity is therefore a three-tier signal (nobody out / someone out / conflict) rendered as available → busy → over, never a fabricated precise percentage. The presentational `TeamCalendarView` still accepts a `capacityPct`/`headcount`/`requests` shape (matching the Wave-0 test contract) so a future headcount source can supply true percentages without a view change.

## Verification

- `pnpm --filter @contractor-ops/web-vite test team-calendar` — **GREEN** (2/2: conflict marker icon+text; capacity figure).
- `pnpm --filter @contractor-ops/web-vite typecheck` — clean (full suite; the previously-inherited RED test import is now resolved).
- `check:web-vite-data-layer` / `page-shells` / `presentational` / `dialog-pattern` — all OK. No new deps; no third-party calendar block (local primitives + div grid).

## Deferred

- Per-person avatar chips: the calendar payload returns `requestIds` only (no worker names), so cells show the capacity/out-count signal rather than initials — reinstated automatically if the payload later carries names.
- de/pl/ar calendar strings (added in Plan 12) remain best-effort, flagged for native review.
