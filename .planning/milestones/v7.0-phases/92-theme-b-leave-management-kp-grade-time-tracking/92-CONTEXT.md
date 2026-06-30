# Phase 92: Theme B — Leave Management + KP-Grade Time Tracking - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Two coupled workforce capabilities for the Phase-89/90 `Worker(EMPLOYEE)`, delivering six locked
requirements (LEAVE-01..03, TIME-EMP-01..03):

**Leave** — a per-market leave-balance engine (PL 20/26-day, DE BUrlG + overrides, UK 5.6-week,
US per-state, UAE/SA per-MOL/MHRSD); a leave-request workflow on the **v1.0 approval-chain** with
per-org leave types, blackout periods, and manual sick-leave entry; a team calendar (month/quarter
capacity + conflict warnings on overlapping same-team requests).

**Time** — employee statutory time tracking **distinct from v2.0 B2B time** (overtime, night-shift,
weekend/holiday); per-jurisdiction working-time-limit alerts (PL 8h/48h, DE ArbZG, UK 48h WTR
opt-out, US FLSA >40h non-exempt); a PL "ewidencja czasu pracy" report (KP §149) with a 3-year
audit-immutable archive.

**HARD DEPENDENCY:** Phase 90 (`EmployeeProfile` on `Worker(EMPLOYEE)`) must land first — leave +
time attach to the employee identity (`workerId`). At context time Phase 90 is mid-execution; this
context can be planned, execution waits on 90.

**NOT this phase:** on/offboarding (P93), payroll export (P94 — consumes time/leave), HRIS sync
(P95), employee portal leave/time self-service surfaces (P96 — staff/manager side here), HR
dashboard vacation-utilization widget (P97). **e-ZLA (PL) / eAU (DE) auto-pull DEFERRED to v7.5**
(LEAVE-04/05) — v7.0 ships manual sick-leave entry only.
</domain>

<decisions>
## Implementation Decisions

### Leave-Balance Engine (LEAVE-01)
- **D-01 (Claude's discretion — lean recorded):** Balance representation is planner's discretion.
  **Lean: an append-only event ledger** (accrual + deduction + carryover + adjustment rows; balance
  = Σ ledger, optionally cached) — fully auditable for KP/RODO evidentiary needs, correction-safe,
  preserves point-in-time history, and supports carryover + etat pro-rata cleanly. **Constraint
  (locked): per-market balances compute correctly (criterion-1), with carryover + pro-rata for the
  employment fraction (`etat` from P90).**
- **D-02 (locked):** **Per-market accrual/entitlement rules register via the compliance-policy
  register-on-import registry** (one `policies/<cc>` module per market, keyed on the existing
  `Jurisdiction` type + `mapIsoToJurisdiction`) — mirror the P90/P91 idiom. No parallel rules engine.
  Statutory rule values carry adviser-verify annotations (local-only / legal-deferred).

### Leave-Request Workflow (LEAVE-02)
- **D-03 (Claude's discretion — lean recorded):** Routing is planner's discretion. **Lean: extend
  the v1.0 approval-chain** — add a `LEAVE_REQUEST` value to `EntityType` + `ApprovalResourceType`,
  a new submit procedure, and a `resourceType === 'LEAVE_REQUEST'` finalize branch alongside the
  invoice branch (the Flow/Step/Decision core is already generic; invoice coupling is isolated to
  submit + finalize). Vacation/parental/study/bereavement route the chain; **manual sick-leave is a
  DIRECT absence record (no approval)** — sick leave is a notification, not a request (e-ZLA/eAU
  auto-pull deferred to v7.5). **Constraint (locked): leave requests run on the v1.0 approval-chain
  (LEAVE-02 mandate) + manual sick-leave entry supported.** Per-org leave types
  (vacation/sick/parental/bereavement/study/…) + blackout periods are org config.

### Employee Time Model + Working-Time Alerts (TIME-EMP-01, TIME-EMP-02)
- **D-04 (locked — collision-forced):** **A NEW employee statutory time model** (e.g.
  `EmployeeTimeEntry` / `WorkRecord` on `workerId`), distinct from the v2.0 B2B `TimeEntry` (which
  is hard-coupled to `Contractor`/`Contract` with a taken `[org,contractorId,source,externalId]`
  unique — no shared TimeEntry primitive). Captures overtime (PL 50/100%, DE §3 ArbZG ceiling, UK
  WTR opt-out flag), night-shift premium, weekend/holiday work. Names `TimeEntry`/`Timesheet`/
  `TimeEntrySource` are taken — pick distinct ones.
- **D-05 (locked):** **Working-time-limit alerts = on-entry synchronous check + daily batch scan.**
  A synchronous per-jurisdiction limit check at time-entry save (immediate warning to employee/
  manager) PLUS a daily batch scan built on the `compliance-reminder-scan` / `economic-dependency-
  scan` twin (region fan-out + per-recipient digest throttle + `claimCronNotificationDedup`),
  emitting via the shared `notification-service` `dispatch()` (in-app + email + Slack/Teams). Covers
  both real-time and rolling-window (weekly 48h) breaches. Per-jurisdiction limits register via the
  same registry as D-02.

### ewidencja czasu pracy + Immutable Archive (TIME-EMP-03)
- **D-06 (locked):** **Dedicated immutable report-snapshot table** for the PL KP §149 ewidencja —
  mirror the tax-form `buildFormSnapshot` pattern (frozen-JSON snapshot-of-record + supersede chain;
  regenerate = a new row, never mutate) with its **own append-only trigger** (AuditLog is the only
  existing trigger-enforced append-only table but is a generic event log, not a queryable report
  archive). Register `'KP-ewidencja': 3` in `packages/db/src/retention-policy.ts` `RETENTION_YEARS`
  + (if a dedicated model) `MODEL_RETENTION_TYPE`. The 3-year immutability is DB-enforced, not by
  convention.

### Claude's Discretion
- Leave-balance representation (D-01) — lean event ledger.
- Leave-request routing detail (D-03) — lean extend-chain + sick-direct.
- Team calendar (LEAVE-03) capacity/conflict model + component composition — **new build** (no
  reusable team-calendar today; existing "calendar" code is Google/Outlook integration only).
- Public-holiday source per market (for weekend/holiday premium + working-day math) — seeded
  reference data (local-only), shape is planner's.
- Overtime-premium calculation shape (PL 50/100%, DE ceiling, UK opt-out) + night-shift window.
- Exact distinct model names for the employee time model.
- The cached-balance materialization strategy if the ledger is chosen.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — LEAVE-01..03 (lines 109-111), TIME-EMP-01..03 (115-117) verbatim;
  line 25 + 215-216 (e-ZLA/eAU DEFERRED to v7.5, manual entry only); line 26 (legal sign-off
  posture — statutory text adviser-verify annotated).
- `.planning/ROADMAP.md` (Phase 92 entry) — goal + 4 success criteria + research flag (e-ZLA/eAU
  deferred) + UI hint = yes.
- `.planning/phases/90-theme-b-employee-registry-per-market-6/90-CONTEXT.md` — `EmployeeProfile` +
  `etat` employment fraction (pro-rata input) + per-market registry idiom + `module.workforce-
  employees` flag.
- `.planning/phases/89-theme-b-worker-model-abstraction-serial-gate/89-CONTEXT.md` — `Worker(EMPLOYEE)`
  attach point + workforce flag gate.

### Approval-chain (extend for LEAVE_REQUEST)
- `packages/db/prisma/schema/approval.prisma` (`ChainConfig` :3, `ApprovalFlow` :21, `ApprovalStep`
  :47 `slaDeadline`, `ApprovalDecision` :78, `ApprovalResourceType` :106 [INVOICE/DOCUMENT/CONTRACT
  — add LEAVE_REQUEST], `ApprovalDecisionType` :112) + `packages/db/prisma/schema/contract.prisma`
  `EntityType` :280 (add LEAVE_REQUEST).
- `packages/api/src/routers/core/approval.ts:1` (barrel), `approval-queue.ts` (queue + approve/
  reject/delegate :427/clarify), `approval-submit.ts:20`/:238 (invoice coupling — add leave submit),
  `approval-shared.ts:143` (`isSlaBreach`), `:255` (`finalizeApprovedInvoice` — add leave finalize
  branch). Validators `packages/validators/src/approval.ts`.

### v2.0 B2B time (DISTINCT from — do not reuse model)
- `packages/db/prisma/schema/time-tracking.prisma` (`Timesheet` :3, `TimeEntry` :29 — contractor/
  contract FK, `TimeEntrySource` :63 MANUAL/CLOCKIFY/JIRA) + `routers/core/time.ts:23`,
  `routers/portal/portal-time.ts`, `services/time-reconciliation.ts`, `services/clockify-sync.ts`
  — the contractor time stack the employee model must NOT collide with (D-04).

### Per-jurisdiction registry (leave-accrual + WT-limit rules register here)
- `packages/compliance-policy/src/registry.ts:1`, `doc-registry.ts:1` (`registerComplianceDoc`),
  `index.ts:7` (per-country side-effect imports `./policies/{uk,pl,de,us,ksa,uae}`),
  `types.ts:6` (`Jurisdiction` type `'UK'|'DE'|'PL'|'US'|'KSA'|'UAE'`), `jurisdiction-resolver.ts:28`
  (`mapIsoToJurisdiction`, `mapCountryCodeToJurisdiction` :36). Classification analog
  `packages/classification/src/registry.ts:1` (`registerProfile`).

### Immutable archive (ewidencja)
- `packages/api/src/services/tax-form.service.ts:14` (`buildFormSnapshot` — frozen-JSON snapshot +
  supersede chain; the archive pattern to mirror, D-06).
- `packages/db/prisma/schema/audit.prisma:9` (`AuditLog` append-only) +
  `migrations/20260617000000_auditlog_append_only/migration.sql:33` (`reject_auditlog_update` trigger)
  + `packages/db/src/rls.ts:32` (`allowAuditPurge`) + `services/audit-writer.ts:79` (`writeAuditLog`)
  — the only existing trigger-enforced append-only store (pattern reference for the new snapshot
  table's trigger).
- `packages/db/src/retention-policy.ts:13` (`RETENTION_YEARS`; comment :16 invites new record types)
  + `MODEL_RETENTION_TYPE` :29 — add `'KP-ewidencja':3`.

### Alert/scan + notifications (WT-limit alerts)
- `packages/api/src/services/compliance-reminder-scan.ts:48` (`bandFor`), `:167`
  (`runComplianceReminderScan` — region fan-out + per-recipient digest) +
  `services/economic-dependency-scan.ts` (threshold-scan twin) + `services/notification-service.ts:270`
  (`dispatch` — in-app/email/Slack/Teams) + `apps/cron-worker/src/jobs/handlers/reminders/` — the
  scan + dispatch scaffold to extend (D-05).

### Worker attach + flag + mount
- `packages/db/prisma/schema/worker.prisma:12` (`Worker`/`WorkerType`) +
  `packages/api/src/middleware/require-workforce-flag.ts:25` (`assertWorkforceEnabled`, `:51`
  `isWorkforceRegistered`) + `packages/api/src/root.ts:175` (`workforceRouters` — mount new leave/
  time routers here for the `module.workforce-employees` gate).

### Web-vite UI (reuse + new)
- Reuse: `apps/web-vite/src/components/approvals/approval-queue/` (data-table/side-panel/columns/
  bulk-actions), `approvals/{sla-badge,chain-tracker,audit-timeline}.tsx`, `hooks/use-approval-
  actions.ts` — for the leave-request queue. `components/time/{timesheet-grid,single-entry-form,
  time-summary-stats}.tsx` — for employee time entry.
- NEW build: **team calendar** (LEAVE-03) — every existing "calendar" asset
  (`settings/my-calendar-section.tsx`, `org-calendar-section.tsx`,
  `workflow/calendar-event-config-dialog.tsx`, `calendarRouter`) is Google/Outlook integration
  config, NOT a team availability grid.

### Documentation-follows-code (update in the SAME change set)
- `.planning/brain/wiki/domains/` (worker/leave+time domain),
  `wiki/structure/{prisma-schema-areas.md (leave ledger + EmployeeTimeEntry + EwidencjaSnapshot),
  key-services.md (leave-balance + WT-limit scan + ewidencja builder), api-routers-catalog.md
  (leave/time routers), cron-jobs.md (WT-limit scan)}`, `wiki/patterns/{approval-chain reuse,
  feature-flags, audit-log}`, `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` (leave-ledger +
  employee-time-distinct-from-B2B + ewidencja-immutable-snapshot invariants); `pnpm check:wiki-brain`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v1.0 approval-chain** (`approval.prisma` Flow/Step/Decision generic; coupling isolated to
  submit+finalize) — extend for `LEAVE_REQUEST` (D-03).
- **compliance-policy register-on-import registry** (`policies/<cc>` + `Jurisdiction` +
  `mapIsoToJurisdiction`) — leave-accrual + WT-limit rules register here (D-02/D-05).
- **`buildFormSnapshot` immutable pattern** (`tax-form.service.ts`) — mirror for ewidencja snapshot
  (D-06).
- **`compliance-reminder-scan`/`economic-dependency-scan` twin + `dispatch()`** — WT-limit batch
  alerts (D-05).
- **retention-policy.ts map** — add `'KP-ewidencja':3` (D-06).
- **approval-queue + time-entry UI components** — reuse for leave queue + employee time entry.

### Established Patterns
- **Extend the generic engine, branch on resourceType** (approval-chain) — not a parallel engine.
- **Register-on-import per-jurisdiction rules** keyed on `Jurisdiction`.
- **DB-enforced immutability** (append-only trigger) for evidentiary records — not by convention.
- **Scan-cascade + shared dispatch()** for threshold/limit alerts.
- **New tenant-owning model never in `globalModels` + cross-org leak test; writeAuditLog on
  sensitive mutations; module.workforce-employees gate; i18n parity; adviser-verify on statutory
  rules; web-vite layering (hook = sole tRPC boundary).**

### Integration Points
- Leave + employee time attach to `Worker(EMPLOYEE)` (`workerId`); routers mount in
  `workforceRouters` (root.ts:175) behind `module.workforce-employees`.
- Leave-balance pro-rata reads `etat` from P90 EmployeeProfile.
- Time + leave data feed P94 payroll export + P97 HR dashboard (vacation utilization) later.
- WT-limit rules + leave-accrual rules register in compliance-policy alongside P91 retention rules.

</code_context>

<specifics>
## Specific Ideas

- **Compose, don't rebuild** — approval-chain, the per-jurisdiction registry, the immutable-snapshot
  pattern, the scan+dispatch scaffold, and the approval-queue/time-entry UI are all reuse targets.
- **Three genuine new builds** (scout-confirmed, no primitive): the **per-market leave-balance
  engine** (no leave/absence model exists), the **employee statutory time model** (`TimeEntry` is
  contractor-coupled), and the **ewidencja immutable archive table** (only a snapshot *pattern*
  exists). Plus the **team-calendar UI** and the P90 `EmployeeProfile` (placeholder).
- **Sick leave ≠ request** — manual sick entry is a direct absence record, not an approval (e-ZLA/eAU
  auto-pull is v7.5).
- **Evidentiary immutability** — KP §149 ewidencja must be DB-trigger-immutable for 3 years, not
  soft-convention; the leave ledger is append-only for the same evidentiary reason.

</specifics>

<deferred>
## Deferred Ideas

- **e-ZLA (PL) / eAU (DE) digital sick-note auto-pull** → v7.5 (LEAVE-04/05); v7.0 = manual entry.
- **Employee leave/time self-service portal surfaces** → P96 (EMP-PORTAL-02); P92 is staff/manager
  side.
- **Payroll export of overtime/leave** → P94 consumes these models.
- **Vacation-utilization dashboard widget** → P97.
- **Live public-holiday API** → seeded reference holiday calendars (local-only).

None expand the phase scope — discussion stayed within the leave + KP-time boundary
(LEAVE-01..03, TIME-EMP-01..03).

</deferred>

---

*Phase: 92-theme-b-leave-management-kp-grade-time-tracking*
*Context gathered: 2026-07-01*
