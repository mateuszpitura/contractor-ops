# Phase 97: Theme B — HR Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 97-theme-b-hr-dashboard
**Areas discussed:** Aggregation strategy, Compose vs rebuild (F1/F3), Probation watchlist + under-utilization, Access + degradation

---

## Aggregation Strategy (HR-DASH-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand groupBy procedures + report-rate-limit | Prisma groupBy over P90 promoted columns; report-rate-limit cap; React Query cache; no materialized store. | ✓ |
| Materialized read model / cache table | Precomputed headcount/utilization refreshed on cron. | |
| Planner decides | Lock server-side aggregation + rate-limit + reuse promoted columns; leave on-demand-vs-materialized to planner. | |

**User's choice:** On-demand groupBy procedures + report-rate-limit.
**Notes:** P90 promoted dept/jurisdiction/employment-type/status/Saudization columns for exactly this. No materialized store in v7.0.

---

## Composition vs Rebuild (HR-DASH-03 + HR-DASH-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Compose existing engines + employee-doc adapter | HR-DASH-03 reads compliance-policy + reminder-scan; thin adapter feeds employee akta docs (P91); HR-DASH-05 extends saudization-dashboard for Emiratisation. | ✓ |
| New employee-specific expiry + Gulf calc | Standalone computation in the dashboard. | |
| Planner decides seam | Lock compose-no-rebuild; leave adapter shape + Emiratisation extension to planner. | |

**User's choice:** Compose existing engines + thin employee-doc adapter.
**Notes:** F1 was contractor-oriented — adapter lets employee akta docs feed the same expiry engine. Extend saudization-dashboard.ts for Emiratisation. No reimplementation of expiry/digest/rate logic.

---

## Probation Watchlist (HR-DASH-04) + Under-Utilization (HR-DASH-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only widgets in v7.0 | Date-window widgets only; notification cron deferred. | |
| Widgets + reuse reminder-digest cron | Also emit proactive notifications via digest-throttled reminder-scan. | |
| Planner decides | Lock widgets read-only; leave whether to wire a reminder cron to planner. | ✓ |

**User's choice:** Planner decides.
**Notes:** Widgets are read-only (date-window queries, "auto-surface"); whether to also wire a proactive reminder cron is the planner's call — if wired, MUST reuse the existing digest throttle (v1.0 spam lesson), never per-item.

---

## Access + Degradation

| Option | Description | Selected |
|--------|-------------|----------|
| HR roles + per-widget empty states | Gate on module.workforce-employees + HR_ADMIN/HR_MANAGER; tenant-scoped; per-widget empty state when source surface dark. | ✓ |
| Broad org-admin visibility | Any org admin/owner, no HR-role gate. | |
| Planner decides role set | Lock module + RBAC + empty states; leave exact role grant to planner. | |

**User's choice:** HR roles (HR_ADMIN / HR_MANAGER) + per-widget empty states.
**Notes:** Tenant-scoped aggregation; dashboard ships independent of sibling completion (e.g. P92 leave partial → empty leave widget).

## Claude's Discretion

- Namespace (`hrDashboard.*` vs `report.*`/`dashboard.*` extension) + which procedures carry report-rate-limit.
- Employee-akta-doc → compliance-policy adapter shape.
- Whether to wire the probation/under-utilization reminder cron (D-03) + its digest shape.
- Widget → source-surface flag mapping for empty states.
- Emiratisation extension shape in saudization-dashboard.ts.
- Staff dashboard nav placement + UI-SPEC via /gsd:ui-phase.

## Deferred Ideas

- Proactive probation/under-utilization notification cron → planner's call; must reuse digest throttle if built.
- Materialized dashboard read-model → only if aggregate volume warrants.
- Employee/manager self-service portal → Phase 96 (this is the org-wide HR view).
