# Phase 92: Theme B — Leave Management + KP-Grade Time Tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 92-theme-b-leave-management-kp-grade-time-tracking
**Areas discussed:** Leave-balance engine, Leave-request workflow, Employee time model + WT alerts, ewidencja + immutable archive

---

## Leave-Balance Model

| Option | Description | Selected |
|--------|-------------|----------|
| Event ledger | Append-only accrual/deduction/carryover/adjustment rows; balance = Σ; auditable, correction-safe | |
| Computed-on-read | Derive from entitlement rule − approved leave; no ledger; simpler, weaker history | |
| You decide | Planner picks; constraint = criterion-1 + carryover + etat pro-rata | ✓ |

**User's choice:** You decide (planner discretion).
**Notes:** Claude's lean = event ledger (CONTEXT D-01) for KP/RODO auditability. Per-market accrual rules register in compliance-policy registry either way (D-02).

---

## Leave-Request Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Extend chain; sick = direct record | Add LEAVE_REQUEST to approval-chain; vacation/parental route chain; manual sick = direct record no approval | |
| Extend chain; sick also approved | All types incl. sick route the chain (sick = ack step); uniform but friction | |
| You decide | Planner picks; constraint = LEAVE-02 chain reuse + manual sick entry | ✓ |

**User's choice:** You decide (planner discretion).
**Notes:** Claude's lean = extend chain + sick-direct (CONTEXT D-03). Scout confirmed v1.0 approval-chain is generically reusable (Flow/Step/Decision generic; coupling isolated to submit+finalize). e-ZLA/eAU auto-pull deferred to v7.5.

---

## Working-Time-Limit Alerts (TIME-EMP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| On-entry check + batch scan | Sync limit-check at entry save (immediate) + daily scan (reminder-scan twin) → dispatch() digest | ✓ |
| Batch scan only | Daily cron scan only; simplest, delayed signal | |
| You decide | Planner picks; constraint = criterion-3 limits alerted | |

**User's choice:** On-entry check + batch scan.
**Notes:** Covers real-time + rolling-window (weekly 48h). Reuses compliance-reminder-scan/economic-dependency-scan twin + shared dispatch(). Employee time model is a NEW table (D-04) — TimeEntry is contractor-coupled.

---

## ewidencja + Immutable Archive (TIME-EMP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated snapshot table | New immutable report-snapshot table (mirror buildFormSnapshot frozen-JSON + supersede + own append-only trigger); 'KP-ewidencja':3 in retention map | ✓ |
| AuditLog-backed | Persist report into existing AuditLog append-only store; no new table but poor report-archive fit | |
| You decide | Planner picks; constraint = criterion-4 KP §149 + 3yr immutable | |

**User's choice:** Dedicated snapshot table.
**Notes:** AuditLog is the only existing trigger-enforced append-only store but is a generic event log, not a queryable report archive. buildFormSnapshot (tax-forms) is the reusable archive pattern. 3-yr immutability DB-enforced.

---

## Claude's Discretion

- Leave-balance representation (D-01) — lean event ledger.
- Leave-request routing detail (D-03) — lean extend-chain + sick-direct.
- Team calendar (LEAVE-03) capacity/conflict model + components — NEW build.
- Public-holiday source per market — seeded reference data.
- Overtime-premium calc shape + night-shift window.
- Distinct employee-time model names; cached-balance materialization if ledger chosen.

## Deferred Ideas

- e-ZLA / eAU sick-note auto-pull → v7.5 (LEAVE-04/05).
- Employee leave/time self-service portal → P96 (EMP-PORTAL-02).
- Payroll export of overtime/leave → P94.
- Vacation-utilization widget → P97.
- Live public-holiday API → seeded reference calendars.
