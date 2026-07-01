# Phase 92: Theme B — Leave Management + KP-Grade Time Tracking - Research

**Researched:** 2026-07-01
**Domain:** Statutory workforce management (leave-balance engine + employee working-time tracking) on the existing approval-chain / compliance-policy / immutable-snapshot / scan-cascade primitives
**Confidence:** HIGH (code composition), HIGH (statutory values — cited to primary sources), MEDIUM (legal interpretation — adviser-verify per local-only posture)

> Graph context note: `.planning/graphs/graph.json` is 205h stale (built 2026-06-22, current commit 5b1456d) — treat any semantic relationships below as approximate; all code facts here were verified by direct Read/grep, not the graph.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Claude's discretion — lean recorded):** Balance representation is planner's discretion. **Lean: an append-only event ledger** (accrual + deduction + carryover + adjustment rows; balance = Σ ledger, optionally cached). **Constraint (locked): per-market balances compute correctly (criterion-1), with carryover + pro-rata for the employment fraction (`etat` from P90).**
- **D-02 (locked):** Per-market accrual/entitlement rules register via the **compliance-policy register-on-import registry** (one `policies/<cc>` module per market, keyed on the existing `Jurisdiction` type + `mapIsoToJurisdiction`) — mirror the P90/P91 idiom. **No parallel rules engine.** Statutory rule values carry adviser-verify annotations (local-only / legal-deferred).
- **D-03 (Claude's discretion — lean recorded):** Routing is planner's discretion. **Lean: extend the v1.0 approval-chain** — add a `LEAVE_REQUEST` value to `EntityType` + `ApprovalResourceType`, a new submit procedure, and a `resourceType === 'LEAVE_REQUEST'` finalize branch alongside the invoice branch. Vacation/parental/study/bereavement route the chain; **manual sick-leave is a DIRECT absence record (no approval).** **Constraint (locked): leave requests run on the v1.0 approval-chain (LEAVE-02 mandate) + manual sick-leave entry supported.** Per-org leave types + blackout periods are org config.
- **D-04 (locked — collision-forced):** **A NEW employee statutory time model** (e.g. `EmployeeTimeEntry` / `WorkRecord` on `workerId`), distinct from the v2.0 B2B `TimeEntry`. Captures overtime (PL 50/100%, DE §3 ArbZG ceiling, UK WTR opt-out flag), night-shift premium, weekend/holiday work. Names `TimeEntry`/`Timesheet`/`TimeEntrySource` are taken — pick distinct ones.
- **D-05 (locked):** Working-time-limit alerts = **on-entry synchronous check + daily batch scan** built on the `compliance-reminder-scan` / `economic-dependency-scan` twin (region fan-out + per-recipient digest throttle + `claimCronNotificationDedup`), emitting via the shared `notification-service` `dispatch()`. Covers real-time and rolling-window (weekly 48h). Per-jurisdiction limits register via the same registry as D-02.
- **D-06 (locked):** **Dedicated immutable report-snapshot table** for the PL KP §149 ewidencja — mirror the tax-form `buildFormSnapshot` pattern (frozen-JSON snapshot-of-record + supersede chain) with its **own append-only trigger**. Register `'KP-ewidencja': 3` in `packages/db/src/retention-policy.ts` `RETENTION_YEARS` + `MODEL_RETENTION_TYPE`. The 3-year immutability is DB-enforced, not by convention.

### Claude's Discretion
- Leave-balance representation (D-01) — lean event ledger.
- Leave-request routing detail (D-03) — lean extend-chain + sick-direct.
- Team calendar (LEAVE-03) capacity/conflict model + component composition — **new build**.
- Public-holiday source per market — seeded reference data (local-only), shape is planner's.
- Overtime-premium calculation shape (PL 50/100%, DE ceiling, UK opt-out) + night-shift window.
- Exact distinct model names for the employee time model.
- The cached-balance materialization strategy if the ledger is chosen.

### Deferred Ideas (OUT OF SCOPE)
- **e-ZLA (PL) / eAU (DE)** digital sick-note auto-pull → v7.5 (LEAVE-04/05); v7.0 = manual entry.
- **Employee leave/time self-service portal** surfaces → P96 (EMP-PORTAL-02); P92 is staff/manager side.
- **Payroll export** of overtime/leave → P94 consumes these models.
- **Vacation-utilization dashboard widget** → P97.
- **Live public-holiday API** → seeded reference calendars (local-only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEAVE-01 | Leave-balance engine per market (PL 20/26, DE BUrlG min + overrides, UK 5.6-week, US per-state, UAE/SA per-MOL/MHRSD) | Statutory Rule Values §; D-01 ledger pattern (§ Architecture Pattern 4); compliance-policy new-registry idiom (§ Pattern 2) |
| LEAVE-02 | Leave-request workflow on v1.0 approval-chain — per-org leave types, blackout, manual sick entry | Approval-chain extension mechanics (§ Pattern 1); sick=direct record (§ Pattern 1c) |
| LEAVE-03 | Team calendar — month/quarter capacity heatmap + conflict warnings on overlapping same-team requests | New-build calendar (§ Pattern 6); seeded public-holiday ref (§ Pattern 7) |
| TIME-EMP-01 | Employee time distinct from B2B — overtime (PL 50/100, DE ceiling, UK opt-out), night-shift, weekend/holiday | New `EmployeeTimeRecord` model (§ Pattern 3); premium math (Statutory §) |
| TIME-EMP-02 | Per-jurisdiction WT-limit alerts (PL 8h/48h, DE ArbZG, UK 48h opt-out, US FLSA >40h non-exempt) | On-entry check + scan twin (§ Pattern 5); WT-limit registry (§ Pattern 2) |
| TIME-EMP-03 | PL ewidencja czasu pracy per KP §149 + 3-year audit-immutable archive | Immutable snapshot table + own trigger (§ Pattern 8); ewidencja field list (Statutory § PL) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives the planner MUST honor (same authority as locked decisions):

1. **New tenant-owning model → NOT in `globalModels` + cross-org leak test.** Every new leave/time model carries `organizationId` and must be absent from `packages/db/src/tenant.ts` `globalModels` (so it inherits `withTenantScope`). Mirror `packages/api/src/__tests__/employee-cross-org-leak.test.ts`. [VERIFIED: grep]
2. **`writeAuditLog` on sensitive mutations** — leave approval/rejection, manual sick entry, ledger adjustments, ewidencja generation. Use `packages/api/src/services/audit-writer.ts` (`resourceType` is `EntityType`). [VERIFIED: read]
3. **Feature flags via `@contractor-ops/feature-flags` wrapper only.** Whole surface gated behind `module.workforce-employees` (mount in `workforceRouters`, root.ts:175; per-request `assertWorkforceEnabled`). No direct Unleash SDK. [VERIFIED: read]
4. **No `console.*`** — use `@contractor-ops/logger` (`createCronLogger` for the scan, `createLogger` elsewhere).
5. **tRPC Zod inputs on every procedure**; validators live in `packages/validators` (no Prisma dep — string-union enum mirrors).
6. **web-vite layering:** Page (thin composer) → Container (`*-container.tsx`, calls hooks) → Hook (`use-*.ts`, sole tRPC/React-Query boundary) → Component (presentational). Run `pnpm check:web-vite-data-layer`. Dialogs use `DialogBody`/`DialogFooter` (`check:web-vite-dialog-pattern`). [VERIFIED: CLAUDE.md]
7. **i18n parity en/de/pl/ar** (+ en-US exists) — new `Leave` + extended `Time` namespaces in `apps/web-vite/messages/*.json`; notification title/body are dotted i18n keys resolved by `resolveEventCopy`. No hardcoded strings (`check:i18n`). [VERIFIED: grep — 5 message files]
8. **adviser-verify annotations** on all statutory rule values (local-only, legal sign-off deferred) — mirror the `PENDING legal review` convention in `compliance-policy/policies/*`. [VERIFIED: read]
9. **7-day dep release age** — but this phase needs **zero new external packages** (see Standard Stack).
10. **Documentation follows code (GATED):** update `wiki/structure/{prisma-schema-areas,key-services,api-routers-catalog,cron-jobs}.md`, `wiki/patterns/`, `wiki/domains/`, `hot.md`+`log.md`, `.planning/MEMORY.md` in the SAME change set; `pnpm check:wiki-brain` must pass. `.husky/post-commit` auto-rebuilds the graph. [VERIFIED: CLAUDE.md]
11. **Git safety:** never `git stash`/`reset --hard`/`restore` without explicit approval.
12. **`.planning/phases` is a symlink** — commit GSD docs through `.planning/milestones/v7.0-phases/…`; nested agents can't spawn subagents (plan/execute run inline). [VERIFIED: MEMORY.md]

## Summary

This phase is **~85% composition of proven primitives, ~15% genuine new build**. Scout confirmed (and this research re-verified by reading source) that **no** leave/absence/vacation/holiday/ewidencja/work-record model exists in `packages/db/prisma/schema/` — the three genuine new builds are (1) the leave-balance ledger + engine, (2) the distinct employee statutory time model, and (3) the ewidencja immutable-snapshot table, plus (4) the team-calendar UI. Everything else is extension of code that already ships: the generic approval-chain (Flow/Step/Decision core is resource-agnostic — invoice coupling is isolated to exactly two seams, `submitForApproval` and `finalizeApprovedInvoice`), the compliance-policy register-on-import registry, the `buildFormSnapshot` frozen-JSON + supersede discipline, the `compliance-reminder-scan`/`economic-dependency-scan` cron twin with `dispatch()`, and the approval-queue + employee-time-entry web-vite components.

The **two hardest correctness surfaces** are statutory: (a) per-market leave entitlement + carryover + `etat` pro-rata, and (b) per-jurisdiction working-time limits + overtime/night premiums. All concrete statutory numbers the compliance-policy modules must encode are enumerated and cited in **§ Statutory Rule Values** below, each flagged adviser-verify per the local-only / legal-deferred posture. One genuine legal discrepancy surfaced and is escalated: PL dokumentacja pracownicza retention is **10 years** (KP §94⁴, post-2019 hires), while the phase's ewidencja archive window is **3 years** (likely tracking the KP §291 3-year claim-limitation period, not the document-retention statute) — see Open Question 1.

**Primary recommendation:** Add ~7 tenant-owning models (`LeaveType`, `LeaveRequest`, `LeaveLedgerEntry`, `LeaveBalance` cache, `BlackoutPeriod`, `EmployeeTimeRecord`, `EwidencjaSnapshot`) + 1 global reference table (`PublicHoliday`); add two new register-on-import registries to `compliance-policy` (`LeaveAccrualRule`, `WorkingTimeLimitRule`) alongside the existing `PolicyRule` registry (NOT crammed into it); extend the approval-chain at exactly the two invoice-coupled seams with a `LEAVE_REQUEST` branch; mirror `buildFormSnapshot` + `reject_auditlog_update` for the ewidencja; and reuse the reminder-scan twin verbatim for the WT-limit daily digest.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Leave-balance computation (Σ ledger + pro-rata) | API / Backend (domain service) | Database (append-only ledger + cache row) | Statutory math + auditability belong in the domain layer over the DB record-of-record; never client-computed |
| Per-market accrual + WT-limit rule values | API / compliance-policy package (register-on-import) | — | Pure jurisdiction rules, DB-free, keyed on `Jurisdiction` — mirrors D-02 |
| Leave-request routing + approval | API / Backend (approval-chain extension) | — | Reuses existing generic Flow/Step/Decision engine; org-scoped |
| Leave-request queue + calendar UI | Frontend (web-vite hook→container→component) | API (tRPC read) | Presentational; sole data boundary is the hook |
| Employee time entry + on-save WT check | API / Backend (synchronous procedure) | Database (`EmployeeTimeRecord`) | Immediate warning must be transactional with the save |
| Daily WT-limit batch scan + digest | Cron worker (`apps/cron-worker`) | API service (scan + `dispatch()`) | Tenant-frame-less region fan-out — matches the reminder-scan twin |
| Ewidencja snapshot generation + immutability | API (builder) | Database (dedicated table + BEFORE UPDATE trigger + RLS) | Evidentiary record-of-record; immutability MUST be DB-enforced (D-06) |
| Public-holiday reference (weekend/holiday premium, working-day math) | Database (global seeded ref table) | compliance-policy (per-market holiday-set optional) | Local-only, no live API; global reference data like `ExchangeRate` |

## Standard Stack

This phase installs **NO new external packages**. It composes existing internal workspace packages plus `date-fns` (already a dependency of `compliance-policy`).

### Core (internal packages — all already in the monorepo)
| Package | Purpose | Why Standard |
|---------|---------|--------------|
| `@contractor-ops/db` (Prisma 7, `prisma-client`) | New leave/time/ewidencja models; migrations incl. trigger SQL | Canonical DB layer; `withTenantScope` auto-injects org scope for non-`globalModels` [VERIFIED: read] |
| `@contractor-ops/compliance-policy` | New `LeaveAccrualRule` + `WorkingTimeLimitRule` registries, per-market `policies/<cc>` modules, `mapIsoToJurisdiction`, `date-fns`/`@date-fns/tz` for TZ + rolling-window math | Register-on-import idiom locked by D-02; already owns date-fns [VERIFIED: package.json] |
| `@contractor-ops/api` | Leave + employee-time routers, balance service, WT-scan service, ewidencja builder | Hosts tRPC; `writeAuditLog`, `dispatch`, approval-engine live here |
| `@contractor-ops/validators` | Zod input schemas (string-union enum mirrors; extend `approvalResourceTypeEnum`) | No-Prisma-dep validator surface [VERIFIED: read] |
| `@contractor-ops/feature-flags` | `module.workforce-employees` gate (wrapper only) | Mandatory flag boundary [VERIFIED: read] |
| `@contractor-ops/logger` | `createCronLogger` (scan) / `createLogger` — Pino, no console.* | Binding standard |
| `@contractor-ops/ui` + `apps/web-vite` | Reuse approval-queue + time components; new team-calendar | Existing design system |

### Supporting (already present)
| Dependency | Purpose | When to Use |
|------------|---------|-------------|
| `date-fns` ^4.1.0 + `@date-fns/tz` ^1.2.0 | Working-day math, rolling 17-week/6-month/settlement-period windows, TZ boundary (reuse `daysUntilExpiryInTz`, `jurisdictionDate`) | Balance accrual pro-rata; 48h rolling-window breach detection [VERIFIED: package.json] |
| `apps/cron-worker` reminders handler + `tryAcquireXactLock` | Daily WT scan sub-job (advisory-lock guarded) | D-05 batch scan [VERIFIED: read] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `LeaveAccrualRule`/`WorkingTimeLimitRule` registry types | Cram leave/WT into existing `PolicyRule` | REJECTED — `PolicyRule` is document-centric (`documentType`, `expirySemantic`, `expiresAt`); leave accrual + WT limits have no document. New typed registries in the same package = same idiom, clean shape. D-02 "no parallel rules **engine**" = reuse register-on-import, not reuse the doc row shape. |
| DB `BEFORE UPDATE` trigger on the leave ledger | `APPEND_ONLY_MODELS` Prisma-extension set (`tenant.ts:34`, currently `ClassificationDocument`) | Ledger corrections are reversing INSERTs (never UPDATE), so the lighter extension (blocks update/updateMany/upsert at the app layer) may suffice for the ledger. Ewidencja (D-06) REQUIRES the DB trigger regardless. Recommend: ledger → `APPEND_ONLY_MODELS`; ewidencja → DB trigger. |
| Daily-grain `EmployeeTimeRecord` (one row/worker/day) | Per-punch `EmployeeTimeEntry` child rows | Ewidencja (KP §149) is day-granular (hours worked, start/end, night hours, OT hours **per day**). Daily grain maps 1:1 to the statutory report; add optional child punch rows only if clock-in/out granularity is later needed. |

**Installation:** none — no `npm install`. New Prisma models + migrations only.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All dependencies are internal workspace packages (`@contractor-ops/*`) already present, plus `date-fns`/`@date-fns/tz` already declared in `compliance-policy/package.json` [VERIFIED: package.json read]. No slopcheck / registry-verification gate is triggered. If the planner later decides a helper library is warranted, the 7-day-release-age + typosquat + `pnpm audit`/`security:scan` gates from CLAUDE.md apply.

## Architecture Patterns

### System Architecture Diagram

```
LEAVE FLOW
  Manager/Employee (web-vite)
    │ tRPC (use-leave-*.ts hook = sole boundary)
    ▼
  leaveRouter.submitLeaveRequest ──► routeToLeaveChain(org, {leaveType, days})
    │                                  │ (parallel to routeToChain — resourceType='LEAVE_REQUEST')
    │                                  ▼
    │                                createApprovalFlow(resourceType='LEAVE_REQUEST', resourceId=leaveRequest.id)
    │                                  │  (generic engine — Flow/Step/Decision unchanged)
    ▼                                  ▼
  LeaveRequest(PENDING) ──────────►  ApprovalFlow + Steps ──► dispatch(APPROVAL_REQUEST → approver)
                                          │ approver acts (approval-queue.ts — REUSED verbatim)
                                          ▼ advanceFlow() completes
                                     finalize branch on resourceType:
                                       'INVOICE'       → finalizeApprovedInvoice (existing)
                                       'LEAVE_REQUEST' → finalizeApprovedLeave  (NEW)
                                          │
                                          ▼
                                     LeaveLedgerEntry(deduction) + LeaveBalance cache update
                                       + writeAuditLog + EmployeeProfile.employmentStatus?=ON_LEAVE

  Manual sick leave: leaveRouter.recordSickAbsence ──► LeaveLedgerEntry(direct, no flow) + notification (NOT a request)

BALANCE ENGINE (D-01)
  accrual rule (compliance-policy LeaveAccrualRule[jurisdiction]) × etat(P90) × carryover
    │  (cron annual accrual + on-hire pro-rata + carryover rollover)
    ▼
  LeaveLedgerEntry(accrual|carryover|adjustment|deduction)  ──Σ──►  balance
    │                                                                  │
    └──────────────► LeaveBalance cache (recomputed in same tx) ◄──────┘  (reconcile test: cache == Σ ledger)

TIME + WT LIMITS (D-04/D-05)
  Employee time save ──► EmployeeTimeRecord(day) ──► SYNC: checkWtLimits(jurisdiction, record + rolling window)
    │                                                   │ WorkingTimeLimitRule[jurisdiction]
    │                                                   ▼ breach? → immediate dispatch(warning)
    ▼
  [daily cron, region fan-out] wtLimitScan ──► rolling 48h/weekly-avg breach ──► per-recipient digest
     (mirrors compliance-reminder-scan: claimCronNotificationDedup + 2-pass digest + dispatch())

EWIDENCJA (D-06)
  ewidencjaRouter.generate(worker, period) ──► buildEwidencjaSnapshot(Σ EmployeeTimeRecord + leave) [frozen JSON]
    ▼  supersede prior ACTIVE row → insert new ACTIVE (never mutate)
  EwidencjaSnapshot table  ──DB BEFORE UPDATE trigger reject──►  immutable
    └── retention 'KP-ewidencja':3 (retention-policy.ts) ; RLS delete gated
```

### Recommended Project Structure
```
packages/db/prisma/schema/
├── leave.prisma                     # LeaveType, LeaveRequest, LeaveLedgerEntry, LeaveBalance, BlackoutPeriod (+ enums)
├── employee-time.prisma             # EmployeeTimeRecord (+ EmployeeTimeSource, AbsenceKind enums)
├── ewidencja.prisma                 # EwidencjaSnapshot (+ EwidencjaStatus enum ACTIVE/SUPERSEDED)
├── reference.prisma (or extend)     # PublicHoliday (global ref, no organizationId)
└── migrations/…_ewidencja_append_only/migration.sql   # BEFORE UPDATE trigger + RLS (mirror auditlog)

packages/compliance-policy/src/
├── leave-registry.ts                # registerLeaveAccrualRule + resolveLeaveAccrual (NEW, mirrors registry.ts)
├── wt-registry.ts                   # registerWorkingTimeLimit + resolveWtLimits (NEW)
├── types.ts                         # + LeaveAccrualRule, WorkingTimeLimitRule interfaces
└── policies/{pl,de,uk,us,uae,ksa}.ts  # extend each with registerLeaveAccrualRule(...) + registerWorkingTimeLimit(...)

packages/api/src/
├── routers/workforce/leave.ts       # submit / recordSickAbsence / listRequests / balance / leaveType CRUD / blackout CRUD
├── routers/workforce/employee-time.ts
├── routers/workforce/ewidencja.ts
├── services/leave-balance.ts        # computeBalance = Σ ledger, accrue, carryover, proRata(etat)
├── services/wt-limit-check.ts       # synchronous per-jurisdiction check
├── services/wt-limit-scan.ts        # daily batch (twin of compliance-reminder-scan)
├── services/ewidencja-builder.ts    # buildEwidencjaSnapshot (mirror tax-form.service buildFormSnapshot)
└── routers/core/approval-*.ts       # EXTEND: submit leave, finalizeApprovedLeave branch

apps/cron-worker/src/jobs/handlers/reminders/  # add wt-limit-scan sub-job (or new handler)

apps/web-vite/src/components/leave/            # NEW: request-queue (reuse approval-queue), balance, team-calendar
apps/web-vite/src/components/employee-time/    # NEW: entry grid (reuse time components), ewidencja report
```

### Pattern 1: Extend the generic approval-chain for LEAVE_REQUEST (D-03)

**What:** The Flow/Step/Decision core is resource-agnostic. Invoice coupling is isolated to exactly TWO seams. Add `LEAVE_REQUEST` and branch only at those seams.

**Verified enum surface to extend:**
- `ApprovalResourceType` enum (`approval.prisma:106`) — currently `INVOICE | DOCUMENT | CONTRACT`; `ApprovalChainConfig.resourceType` uses it. **Add `LEAVE_REQUEST`.** [VERIFIED: read]
- `EntityType` enum (`contract.prisma:280`) — `ApprovalFlow.resourceType` AND `AuditLog.resourceType` AND `NotificationEvent.entityType` all use it. **Add `LEAVE_REQUEST`** (and consider `EMPLOYEE_TIME_RECORD` for time-alert audit/notification `entityId`). [VERIFIED: read]
- `approvalResourceTypeEnum` (`validators/src/approval.ts:22`) — `z.enum(['INVOICE','DOCUMENT','CONTRACT'])`. **Add `'LEAVE_REQUEST'`.** [VERIFIED: read]
- `NotificationEvent.entityType` is typed `EntityType` and `ENTITY_ROUTES` (`notification-service.ts:52`) maps type→web route — **add `LEAVE_REQUEST: '/leave'`** (+ `EMPLOYEE_TIME_RECORD` if used) so `buildEntityUrl` produces a CTA. [VERIFIED: read]

**What is generic vs invoice-specific:**
- **GENERIC (reuse as-is):** `createApprovalFlow` (only the `resourceType: 'INVOICE'` param literal + the approverRole cast need widening — logic is generic), `advanceFlow`, `computeSlaStatus`, `isSlaBreach`, `buildAuditEvents`, `validateStepForAction`, `processBulkApprovalSteps`, the whole approval-queue approve/reject/delegate/clarify surface. [VERIFIED: read approval-engine.ts, approval-shared.ts]
- **`advanceFlow` compliance gate is already safe:** `checkComplianceHoldAtFinalStep` returns `null` immediately when `resourceType !== 'INVOICE'` (`approval-engine.ts:336`) — leave flows will never hit the contractor-compliance hold. No change needed. [VERIFIED: read]
- **INVOICE-SPECIFIC (must branch):**
  1. **`submitForApproval`** (`approval-submit.ts:19`) — fetches invoice, checks `matchStatus`, calls `routeToChain(...{totalMinor})`, `createApprovalFlow({resourceType:'INVOICE'})`, updates `invoice.status='APPROVAL_PENDING'`. → **NEW `submitLeaveRequest`** procedure: validate `LeaveRequest`, check blackout + sufficient balance, `routeToLeaveChain`, `createApprovalFlow({resourceType:'LEAVE_REQUEST'})`, set `LeaveRequest.status='PENDING'`.
  2. **`routeToChain`** (`approval-engine.ts:123`) — hardcodes `resourceType:'INVOICE'` + evaluates amount/contractorType conditions. → **NEW `routeToLeaveChain`** querying `ApprovalChainConfig where resourceType='LEAVE_REQUEST'` (leave chains likely default-only or condition on leave-duration/type — reuse `evaluateConditions` shape or a leave-specific one). Isolated; do not overload the invoice router.
  3. **`finalizeApprovedInvoice`** (`approval-shared.ts:255`) — updates `invoice.status='APPROVED'`, `paymentStatus='READY'`, `syncPaymentDueDeadline`. → **NEW `finalizeApprovedLeave`**: set `LeaveRequest.status='APPROVED'`, insert `LeaveLedgerEntry(deduction)`, update `LeaveBalance` cache, optionally set `EmployeeProfile.employmentStatus`, `writeAuditLog`. Called from the SAME two `advanceResult.completed` sites: single-approve (`approval-queue.ts:528`) and `bulkApprove` (`approval-queue.ts:528`) — branch on `step.approvalFlow.resourceType === 'LEAVE_REQUEST'`. [VERIFIED: read approval-queue.ts 500-540]

**1c — Manual sick leave = DIRECT record (no chain):** `recordSickAbsence` procedure writes a `LeaveLedgerEntry` (or dedicated absence row) directly, `writeAuditLog`, dispatches a **notification** (not an `APPROVAL_REQUEST`). No `ApprovalFlow` is created. e-ZLA/eAU auto-pull is v7.5 — v7.0 is manual entry only.

**Anti-pattern:** Building a parallel leave approval engine. The chain is generic — a second engine duplicates SLA/delegate/audit-trail logic and diverges.

### Pattern 2: New register-on-import registries in compliance-policy (D-02/D-05)

**What:** Mirror `registry.ts` (`registerPolicyRule`) and `classification/src/registry.ts` (`registerProfile`) — a module-level `Map`/array + a `register*` function called as an import side-effect from `policies/<cc>.ts`, resolved by a pure `resolve*(jurisdiction)` function. Keyed on the existing `Jurisdiction` type (`'UK'|'DE'|'PL'|'US'|'KSA'|'UAE'`) and `mapIsoToJurisdiction`. [VERIFIED: read registry.ts, classification/registry.ts, jurisdiction-resolver.ts]

**Two NEW registries (do not extend `PolicyRule`):**
```typescript
// leave-registry.ts
export interface LeaveAccrualRule {
  jurisdiction: Jurisdiction;
  leaveKind: 'ANNUAL' | 'PARENTAL' | 'BEREAVEMENT' | 'STUDY' | 'SICK';
  // entitlement resolver — returns statutory base days for the worker's tenure
  baseEntitlementDays: (ctx: { tenureYears: number }) => number;
  proRataByEtat: boolean;          // true for PL/DE/UK/UAE/KSA part-time
  carryoverPolicy: { maxDays: number | null; expiresMonthsIntoNextYear: number | null };
  draftLegalText: string;          // PENDING adviser-verify (mirror policies/* convention)
}
// wt-registry.ts
export interface WorkingTimeLimitRule {
  jurisdiction: Jurisdiction;
  maxDailyMinutes: number | null;          // PL 480, DE 480 (extend 600), UK null (weekly only)
  maxDailyHardCeilingMinutes: number | null; // DE 600
  weeklyAvgMaxMinutes: number;             // PL 2880 (48h), DE via 6-mo avg, UK 2880 (opt-outable)
  weeklyWindowWeeks: number;               // PL settlement period, DE 24wk, UK 17wk
  weeklyOptOutAllowed: boolean;            // UK true, others false
  nightWindow: { startHour: number; endHour: number } | null; // PL 21-07, DE 23-06, UK 23-06
  overtimePremium?: { standardPct: number; premiumPct: number }; // PL 50/100
  draftLegalText: string;
}
```
Register both in each `policies/<cc>.ts` (side-effect import already wired via `index.ts:7`). Rule VALUES → **§ Statutory Rule Values**.

### Pattern 3: Distinct employee statutory time model (D-04)

**What:** New model on `workerId` (NOT `contractorId`). Names `TimeEntry`/`Timesheet`/`TimeEntrySource` are taken by `time-tracking.prisma` (contractor/contract-coupled, unique `[org,contractorId,source,externalId]`) — no shared primitive. [VERIFIED: read time-tracking.prisma] Recommend **daily grain** to map 1:1 onto the ewidencja (KP §149 is per-day).

```prisma
model EmployeeTimeRecord {           // one row per worker per calendar day
  id                 String   @id @default(cuid())
  organizationId     String   // tenant-owning — NOT in globalModels
  workerId           String   // → Worker (workerType=EMPLOYEE)
  workDate           DateTime @db.Date
  startTime          DateTime?
  endTime            DateTime?
  workedMinutes      Int      @default(0)
  nightMinutes       Int      @default(0)   // within jurisdiction night window
  overtimeMinutes50  Int      @default(0)   // PL 50% band / generic OT
  overtimeMinutes100 Int      @default(0)   // PL 100% band (night/Sun/holiday/day-off/weekly-norm)
  weekendHolidayMinutes Int   @default(0)
  onCallMinutes      Int      @default(0)   // PL dyżur (ewidencja requires place + start/end)
  onCallLocation     String?
  absenceKind        AbsenceKind?           // VACATION/SICK/PARENTAL/… feeds ewidencja "days off with type"
  wtOptOut           Boolean  @default(false) // UK WTR 48h individual opt-out flag
  source             EmployeeTimeSource @default(MANUAL)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  worker       Worker       @relation(fields: [workerId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])
  @@unique([organizationId, workerId, workDate])
  @@index([organizationId, workerId, workDate])
}
enum EmployeeTimeSource { MANUAL IMPORTED }  // NOT TimeEntrySource
enum AbsenceKind { VACATION SICK PARENTAL BEREAVEMENT STUDY UNPAID OTHER_JUSTIFIED UNJUSTIFIED }
```
(Overtime split 50/100 is PL-specific; DE/UK/US store total OT + jurisdiction rule decides premium in payroll P94. Keep the columns but let the WT rule interpret.)

### Pattern 4: Leave-balance ledger + cache (D-01)

**What:** Append-only ledger is the source of truth; balance = Σ ledger. Optional `LeaveBalance` cache row per `(worker, leaveKind, year)` updated in the SAME transaction as each ledger insert; a `recomputeBalance()` (pure Σ) is the reconciliation oracle.

```prisma
model LeaveLedgerEntry {
  id             String @id @default(cuid())
  organizationId String            // tenant-owning
  workerId       String
  leaveTypeId    String            // → org LeaveType
  entryType      LeaveLedgerType   // ACCRUAL | DEDUCTION | CARRYOVER | ADJUSTMENT
  minutes        Int               // signed: accrual/carryover +, deduction −  (minutes for part-day precision)
  effectiveDate  DateTime @db.Date
  sourceRef      String?           // approvedLeaveRequestId / accrual-run id
  reason         String?           // required for ADJUSTMENT (audit)
  createdByUserId String?
  createdAt      DateTime @default(now())
  @@index([organizationId, workerId, leaveTypeId, effectiveDate])
}
enum LeaveLedgerType { ACCRUAL DEDUCTION CARRYOVER ADJUSTMENT }
```
- **Append-only enforcement:** add `LeaveLedgerEntry` to `APPEND_ONLY_MODELS` (`tenant.ts:34`) — blocks update/updateMany/upsert; corrections are reversing `ADJUSTMENT` inserts. (Ewidencja gets the stronger DB trigger; the ledger's app-layer block matches the `ClassificationDocument` precedent.) [VERIFIED: read tenant.ts]
- **Pro-rata:** `entitlementDays = round_up(baseEntitlement(tenure) × etat)` where `etat` is `EmployeeProfile.etat Decimal(3,2)` (0.10–1.00) [VERIFIED: read employee.prisma]. PL rounds partial days UP (KP art. 154 §2 — cited below).
- **Carryover:** annual rollover inserts a `CARRYOVER` row capped per `LeaveAccrualRule.carryoverPolicy` (PL unused leave must be granted by Sept 30 next year — adviser-verify).

### Anti-Patterns to Avoid
- **Computing balance only from a mutable counter column** — loses point-in-time history + audit trail; fails KP/RODO evidentiary need. Ledger is source of truth.
- **Putting new tenant models in `globalModels`** — would disable `withTenantScope` → cross-org leak. Only `PublicHoliday` (no `organizationId`) is global.
- **Reusing the contractor `TimeEntry`** — hard-coupled to Contractor/Contract; collision-forced new model (D-04).
- **Enforcing ewidencja immutability by app convention** — D-06 mandates DB trigger. A future BYPASSRLS/owner role must still be blocked.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leave approval routing/SLA/delegate/audit | A leave-specific approval engine | Extend generic approval-chain (Pattern 1) | Flow/Step/Decision + SLA + audit-trail + bulk actions already exist; only 2 invoice seams differ |
| Per-recipient alert throttle / region fan-out | Custom cron + per-alert email | `compliance-reminder-scan`/`economic-dependency-scan` twin + `claimCronNotificationDedup` + `dispatch()` | The digest layer is an explicit fatigue fix — "simplicity was already tried and failed" (source comment) [VERIFIED: read] |
| Immutable report archive + supersede | Custom versioning table | `buildFormSnapshot` frozen-JSON + `supersedeAndInsert` (tax-form.service.ts) | Proven append-only supersede discipline (D-06) [VERIFIED: read] |
| DB-enforced append-only | App-layer checks only | `reject_auditlog_update` trigger + RLS pattern (migration 20260617000000) | Blocks even BYPASSRLS/owner UPDATE [VERIFIED: read] |
| TZ / working-day / rolling-window math | Manual date arithmetic | `date-fns` + `@date-fns/tz`; reuse `daysUntilExpiryInTz`, `jurisdictionDate` | Already a dep; DST + jurisdiction boundaries are error-prone |
| Cross-org isolation | Manual `where organizationId` everywhere | `withTenantScope` (auto for non-`globalModels`) + a cross-org leak test | Isolation is a Prisma-extension invariant, not per-query discipline |
| Notification fan-out + i18n copy | Bespoke email/Slack | `dispatch()` (in-app + email + Slack/Teams, `resolveEventCopy` localises dotted keys) | Central dispatcher with DB dedup [VERIFIED: read] |
| Cron double-fire safety | Ad-hoc locks | `tryAcquireXactLock('reminders')` advisory lock | Existing reminders handler guard [VERIFIED: read] |

**Key insight:** The three genuine new builds (leave ledger/engine, employee time model, ewidencja table) are new **data models**, not new **infrastructure**. Every cross-cutting mechanism they need (routing, alerts, immutability, TZ math, tenancy, notifications) already exists and must be composed.

## Statutory Rule Values

> **All values below are adviser-verify / legal-deferred per the Standing Project Constraint (local-only deploy; jurisdiction legal/tax-adviser sign-off deferred post-deploy).** Encode each with a `draftLegalText` carrying a `PENDING legal review` note, mirroring `compliance-policy/policies/*`. Citations are to primary statute or an authoritative summary; regional variations (DE Bundesland holidays, US per-state) are explicitly flagged.

### PL — Poland (Kodeks pracy)
| Rule | Value | Source | Provenance |
|------|-------|--------|-----------|
| Annual leave | **20 days** if employed <10 yrs; **26 days** if ≥10 yrs (tenure includes education credits) | KP art. 154 §1 | [CITED: lexlege.pl/kp/art-154] |
| Part-time pro-rata | Proportional to `etat`; partial day rounds **UP** to full day | KP art. 154 §2 | [CITED: przepisy.gofin.pl art-154] |
| Daily/weekly norm | **8h/day**, avg **40h** in a 5-day week, settlement period ≤4 months | KP art. 129 §1 | [CITED: przepisy.gofin.pl art-129] |
| Weekly cap incl. overtime | avg **48h/week** in settlement period | KP art. 131 §1 | [CITED: lexlege.pl/kp/art-131] |
| Overtime premium | **100%** (night, Sundays/holidays not scheduled as workdays, day-off-in-lieu, and weekly-norm exceedance); **50%** other days | KP art. 151¹ §1 | [CITED: lexlege.pl/kp/art-151-1] |
| Night-time window | **8 hours between 21:00 and 07:00** (employer picks the 8h band) | KP art. 151⁷ | [CITED: lexlege.pl/kp/art-151-7] |
| Night premium | **20% of the hourly rate derived from statutory minimum wage**, per night hour | KP art. 151⁸ §1 | [CITED: sip.lex.pl art-151-8] |
| **Ewidencja czasu pracy (KP §149) required fields** | Per Rozporządzenie MRPiPS 10.12.2018 §6 pkt 1: (a) hours worked + start/end time; (b) night-shift hours; (c) overtime hours; (d) days off with **type** indicated; (e) on-call (dyżur) hours + start/end + **place**; (f) type & amount of work exemptions (zwolnienia); (g) type & amount of other justified absences; (h) unjustified absences; (i) for minors — prohibited-work hours allowed for training | KP art. 149 + Rozp. 10.12.2018 §6 | [CITED: isap.sejm.gov.pl WDU20180002369; lexlege.pl/dokum-pracownicza/paragraf-6] |
| Ewidencja retention | See **Open Question 1** — dokumentacja pracownicza is **10 years** (KP §94⁴, post-2019); phase archive window is **3 years** (likely KP §291 claim-limitation) | KP §94⁴ / §291 | [ASSUMED — reconcile with adviser] |
| Exemptions from ewidencja hours | Task-based system, senior management, lump-sum OT/night workers — hours not recorded | KP art. 149 §2 | [CITED: lexlege.pl/kp/art-149] |

### DE — Germany
| Rule | Value | Source | Provenance |
|------|-------|--------|-----------|
| Annual leave (statutory min) | **24 Werktage** (6-day week) = **min 20 Arbeitstage** (5-day week); CBAs/contracts commonly 25–30 (override) | BUrlG §3 | [CITED: teamed.global / aivy.app BUrlG] |
| Daily working time | **8h/day**, extendable to **10h** if 6-month / 24-week average ≤ 8h | ArbZG §3 | [CITED: fmcgroup.com Germany working time] |
| Night-time | Nachtzeit **23:00–06:00** (bakeries/confectionery 22:00–05:00); night work = >2h in Nachtzeit; §6(5) "angemessener" premium OR time-off — **no fixed statutory %** (CBA-driven, often ~25%) | ArbZG §6 | [CITED: teamed.global] — % is [ASSUMED, adviser-verify] |
| Overtime premium | **No statutory daily OT premium** in ArbZG — contract/CBA governed | ArbZG (absence) | [ASSUMED, adviser-verify] |

### UK — United Kingdom (Working Time Regulations 1998)
| Rule | Value | Source | Provenance |
|------|-------|--------|-----------|
| Annual leave | **5.6 weeks = 28 days** cap for a 5-day-week worker (reg 13 + 13A) | WTR 1998 reg 13/13A | [CITED: acas.org.uk; visitbritain.org] |
| Weekly limit | avg **48h/week** over a **17-week** reference period; **individual written opt-out** allowed (store the flag) | WTR 1998 reg 4 | [CITED: acas.org.uk] |
| Night limit | night workers avg **≤8h per 24h**; **no opt-out** from the night limit; night worker = normally works ≥3h between **23:00–06:00** | WTR 1998 reg 6 | [CITED: acas.org.uk] |
| Overtime premium | **No statutory OT premium** — contract-governed | WTR (absence) | [ASSUMED, adviser-verify] |

### US — United States (FLSA)
| Rule | Value | Source | Provenance |
|------|-------|--------|-----------|
| Overtime | Non-exempt: **1.5× regular rate for hours >40 in a workweek**; no federal daily OT | FLSA 29 USC §207 | [CITED: dol.gov/agencies/whd/overtime] |
| Paid annual leave | **No federal statutory paid annual/vacation leave** — per-state/employer policy | FLSA (absence) | [CITED: dol.gov] |
| State variation | Some states add daily OT / higher thresholds / double-time (e.g., CA: 1.5× >8h/day, 2× >12h/day) + per-state paid-sick-leave patchwork | State law | [CITED: workforce.com overtime-laws-by-state] — **per-state, adviser-verify** |
| Exempt classification | White-collar exempt employees not owed OT | FLSA | [CITED: dol.gov] |

### UAE — United Arab Emirates
| Rule | Value | Source | Provenance |
|------|-------|--------|-----------|
| Annual leave | **30 calendar days/yr** after 1 completed year; **2 days/month** for 6mo–1yr service | Federal Decree-Law 33/2021 art. 29 | [CITED: mohre.gov.ae; uaelegislation.gov.ae] |
| Working time | **8h/day or 48h/week** (art. 17); Ramadan reduced by 2h | FDL 33/2021 art. 17 | [ASSUMED, adviser-verify] |

### KSA — Saudi Arabia
| Rule | Value | Source | Provenance |
|------|-------|--------|-----------|
| Annual leave | **21 days/yr**; **30 days** after 5 continuous years with same employer | Labor Law (RD M/51) art. 109 | [CITED: hrsd.gov.sa Labor.pdf; etqanlawfirm-sa.com] |
| Working time | **8h/day or 48h/week**; **6h/day** in Ramadan for Muslim workers (art. 98) | Labor Law art. 98 | [ASSUMED, adviser-verify] |

## Common Pitfalls

### Pitfall 1: `ApprovalResourceType` vs `EntityType` — two enums, both need LEAVE_REQUEST
**What goes wrong:** Adding `LEAVE_REQUEST` to only one enum. `ApprovalChainConfig.resourceType` uses `ApprovalResourceType`; `ApprovalFlow.resourceType`, `AuditLog.resourceType`, and `NotificationEvent.entityType` use `EntityType`. Miss one → runtime enum error or the notification CTA 404s.
**How to avoid:** Add to `ApprovalResourceType` (approval.prisma), `EntityType` (contract.prisma), `approvalResourceTypeEnum` (validators), and `ENTITY_ROUTES` (notification-service). [VERIFIED: read]
**Warning sign:** `createApprovalFlow` `resourceType: 'INVOICE'` literal type won't accept `'LEAVE_REQUEST'` until widened — TS will flag it.

### Pitfall 2: `dispatch()` requires a valid `EntityType` for time alerts
**What goes wrong:** WT-limit alerts reference an employee time record, but `EntityType` has **no** WORKER/EMPLOYEE member (P89 backfill had to use `ORGANIZATION` because "EntityType has no WORKER member" [VERIFIED: STATE.md]). `dispatch({entityType})` is typed to `EntityType`.
**How to avoid:** Add `EMPLOYEE_TIME_RECORD` (and/or `LEAVE_REQUEST`) to `EntityType` + `ENTITY_ROUTES` so the alert's `entityId`/CTA resolves. Don't shoehorn into `USER`.

### Pitfall 3: Cron scan runs WITHOUT a tenant frame — region fan-out required
**What goes wrong:** Copying the reminder scan but closing over the EU-only `prisma` client → ME-region (UAE/KSA) employees silently excluded; `withTenantScope` under-filters a tenant-frame-less scan.
**How to avoid:** Fan out over `SUPPORTED_REGIONS` with `getRegionalClient(region)`; region-prefix every dedup key (`wt:...:${region}:...`). Mirror `runComplianceReminderScan` exactly. [VERIFIED: read]

### Pitfall 4: Ewidencja immutability by convention instead of DB trigger
**What goes wrong:** Marking the model append-only only in the Prisma extension → a raw SQL path or owner role can still UPDATE the record-of-record.
**How to avoid:** Ship a migration mirroring `reject_auditlog_update`: `BEFORE UPDATE` trigger that always raises + RLS `insert`-only policy + delete gated behind a transaction-local purge flag. Add `EwidencjaSnapshot` to `MODEL_RETENTION_TYPE → 'KP-ewidencja'` and `RETENTION_YEARS['KP-ewidencja']=3`. [VERIFIED: read migration + retention-policy.ts]

### Pitfall 5: Rolling-window WT breach uses the wrong period boundary
**What goes wrong:** Computing "48h/week" against a fixed Mon–Sun week when the statute is an **average over a reference period** (PL settlement period, UK 17 weeks, DE 24 weeks / 6 months). A single 50h week is not automatically a breach.
**How to avoid:** Store the window per jurisdiction in `WorkingTimeLimitRule.weeklyWindowWeeks`; the scan sums minutes across the rolling window and divides. Use `date-fns` for window boundaries. The synchronous on-save check is a fast daily-ceiling + current-week heuristic; the batch scan does the true rolling average.

### Pitfall 6: PL leave rounding + carryover deadline
**What goes wrong:** Pro-rata for part-time (`etat`) rounded down, or unused leave silently dropped at year end. PL rounds partial days UP (art. 154 §2) and unused annual leave must be granted by **Sept 30 of the following year** (adviser-verify), not simply forfeited on Dec 31.
**How to avoid:** `carryoverPolicy` carries an `expiresMonthsIntoNextYear` (PL ≈ 9). Round-up in `proRata()`.

### Pitfall 7: `etat` is `Decimal?` and P90 EmployeeProfile may be empty at plan time
**What goes wrong:** Pro-rata math on a null/absent `etat`; P90 is still executing (hard dependency).
**How to avoid:** Treat `etat` null as 1.00 (full-time) with a warning; the balance service must not throw. Execution of P92 waits on P90 landing `EmployeeProfile` rows. [VERIFIED: read employee.prisma — `etat Decimal(3,2)` nullable]

## Code Examples

### Extending the finalize seam (approval-queue.ts single-approve + bulkApprove)
```typescript
// Source: packages/api/src/routers/core/approval-queue.ts:525-535 (VERIFIED pattern)
const advanceResult = await advanceFlow(tx, step.approvalFlowId);
if (advanceResult.completed) {
  if (step.approvalFlow.resourceType === 'LEAVE_REQUEST') {
    await finalizeApprovedLeave(tx, {                 // NEW branch
      resourceId: step.approvalFlow.resourceId,
      organizationId: ctx.organizationId,
      db: ctx.db,
      userId: ctx.user?.id,
    });
  } else {
    await finalizeApprovedInvoice(tx, { /* existing */ });
  }
}
```

### Register-on-import (mirror registry.ts / policies/pl.ts)
```typescript
// Source: packages/compliance-policy/src/policies/pl.ts:9 (VERIFIED pattern)
// In policies/pl.ts — add alongside the existing registerPolicyRule(...) calls:
registerLeaveAccrualRule({
  jurisdiction: 'PL',
  leaveKind: 'ANNUAL',
  baseEntitlementDays: ({ tenureYears }) => (tenureYears >= 10 ? 26 : 20), // KP art. 154 §1
  proRataByEtat: true,
  carryoverPolicy: { maxDays: null, expiresMonthsIntoNextYear: 9 }, // grant by Sep 30 — adviser-verify
  draftLegalText: 'KP art. 154 §1: 20 dni (<10 lat) / 26 dni (≥10 lat). Part-time pro-rata, round up (art. 154 §2). (PENDING legal review by doradca)',
});
registerWorkingTimeLimit({
  jurisdiction: 'PL',
  maxDailyMinutes: 480, maxDailyHardCeilingMinutes: null,
  weeklyAvgMaxMinutes: 2880, weeklyWindowWeeks: 16 /* ≤4mo settlement */,
  weeklyOptOutAllowed: false,
  nightWindow: { startHour: 21, endHour: 7 },        // KP art. 151⁷
  overtimePremium: { standardPct: 50, premiumPct: 100 }, // KP art. 151¹
  draftLegalText: 'KP art. 129/131/151. (PENDING legal review)',
});
```

### Immutable snapshot builder (mirror tax-form.service.ts)
```typescript
// Source: packages/api/src/services/tax-form.service.ts:181 supersedeAndInsert (VERIFIED pattern)
export async function supersedeAndInsertEwidencja(tx, input) {
  await tx.ewidencjaSnapshot.updateMany({           // flip prior ACTIVE → SUPERSEDED
    where: { organizationId: input.organizationId, workerId: input.workerId,
             periodKey: input.periodKey, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  });
  return tx.ewidencjaSnapshot.create({              // append new ACTIVE — never mutate
    data: { ...input, status: 'ACTIVE', snapshotJson: input.frozen },
  });
}
```

### Ewidencja append-only trigger (mirror migration 20260617000000)
```sql
-- Source: packages/db/prisma/schema/migrations/20260617000000_auditlog_append_only/migration.sql:33 (VERIFIED)
create or replace function app.reject_ewidencja_update() returns trigger language plpgsql as $$
begin raise exception 'EwidencjaSnapshot is append-only: UPDATE is not permitted'
  using errcode = 'restrict_violation'; end; $$;
create trigger ewidencja_no_update before update on "EwidencjaSnapshot"
  for each row execute function app.reject_ewidencja_update();
-- Plus: RLS insert-only policy + delete gated on a transaction-local purge flag (mirror auditlog_insert/auditlog_delete).
```
Note: `updateMany` in `supersedeAndInsertEwidencja` flips a **prior** row's status — with a strict BEFORE-UPDATE trigger that also blocks the supersede. Resolve by making the supersede an INSERT of a new row + a status column read as "latest ACTIVE wins" (never UPDATE the old row), OR scope the trigger to reject only content columns. **Open Question 2.**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PL ewidencja handwritten fields | Rozp. MRPiPS 10.12.2018 §6 expanded scope (dyżur place, absence-type detail) | 2019-01-01 | Encode the 2018-regulation field list, not older summaries |
| US 1099-K / gig thresholds context | (unrelated to leave) | — | — |
| UAE labour under Federal Law 8/1980 | Federal Decree-Law 33/2021 (30-day annual leave codified) | 2022-02-02 | Cite 33/2021 art. 29, not the repealed 8/1980 |

**Deprecated/outdated:** UAE Federal Law 8/1980 (repealed by 33/2021); pre-2019 PL dokumentacja rules (superseded by the 10.12.2018 regulation).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ewidencja archive = **3 years** (phase spec) while dokumentacja pracownicza statutory retention is **10 years** (KP §94⁴) | Statutory PL / Open Q1 | Under-retention of a statutory record — compliance exposure. MUST reconcile with adviser before locking. |
| A2 | DE night premium ~25% (CBA-typical) — no fixed statutory % | Statutory DE | Wrong premium; but DE OT/night pay is P94-payroll concern, low P92 risk |
| A3 | DE/UK/US have no statutory daily OT premium (contract-governed) | Statutory DE/UK/US | Overtime columns stored but premium % deferred to payroll — acceptable |
| A4 | PL unused-leave carryover deadline ≈ Sept 30 next year | Pattern 4 / carryover | Wrong expiry → balance drift; adviser-verify |
| A5 | UAE/KSA working-time hours (8h/48h, Ramadan reductions) | Statutory UAE/KSA | Time-limit alerts mis-fire for Gulf; adviser-verify |
| A6 | US per-state OT + paid-sick-leave patchwork not fully enumerated (v7.0 = FLSA federal floor + free-text) | Statutory US | Per-state expansion is a known later slice (mirror EMP-REG-US-01 10-state approach) |
| A7 | Daily-grain `EmployeeTimeRecord` (vs per-punch) is the right grain | Pattern 3 | If sub-day punch tracking is later required, add child rows (additive) |
| A8 | `LeaveLedgerEntry` in `APPEND_ONLY_MODELS` (app-layer) is sufficient for the ledger; only ewidencja needs the DB trigger | Alternatives / Pattern 4 | If auditors require DB-level immutability for the ledger too, add a trigger (cheap follow-on) |

**All PL/UK/US annual-leave + FLSA + UAE/KSA annual-leave headline numbers are [CITED] to primary/authoritative sources above — they are not assumptions. The assumptions are the interpretive edges (retention window, premium %, carryover deadline, Gulf working-hours).**

## Open Questions

1. **Ewidencja retention: 3 years vs 10 years.**
   - What we know: Phase D-06 + criterion-4 say "3-year immutable archive"; `RETENTION_YEARS['KP-ewidencja']=3`. PL dokumentacja pracownicza (which includes karta ewidencji) is **10 years** for post-2019 hires (KP §94⁴). The KP §291 employment-claim limitation is **3 years**.
   - What's unclear: Whether the phase intends 3 years as the *immutability guarantee window* (aligned to claim-limitation) while the underlying record still lives 10 years, OR a genuine 3-year purge (which would under-retain a statutory document).
   - Recommendation: Keep `'KP-ewidencja':3` as the **immutability/claim window** but do NOT purge at 3 years — treat 3 as a floor, escalate the 10-year statutory retention to the adviser, and consider adding a separate `'PL-dokumentacja':10` record type. Surface to discuss-phase before locking the purge semantics.

2. **Supersede vs strict BEFORE-UPDATE trigger conflict (ewidencja).**
   - What we know: `buildFormSnapshot` supersede flips the prior row's `status` via `updateMany`. A strict "reject all UPDATE" trigger (like auditlog) would block that flip.
   - Recommendation: Either (a) never UPDATE — model "latest ACTIVE wins" purely by INSERT + `createdAt` ordering (no status flip), or (b) scope the trigger to reject UPDATEs to content columns (`snapshotJson`, `periodKey`) while allowing a one-way `status: ACTIVE→SUPERSEDED`. Planner picks; document the choice.

3. **Leave-chain routing conditions.** Invoice chains route on amount/contractorType. Do leave chains need conditions (e.g., duration >X days → extra approver) or is a single default `LEAVE_REQUEST` chain sufficient for v7.0? Recommendation: default chain + optional duration condition reusing `evaluateConditions` shape; keep minimal.

4. **Team-calendar "same-team" definition.** Conflict warnings fire on overlapping same-team requests — team membership source is `Member`/`Team`/`Project` (org definitions). Confirm which grouping (Team vs cost-center vs manager) defines "same team" for the capacity heatmap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL 17 + Prisma 7 | All new models + trigger migration | ✓ (canonical stack) | PG17 / Prisma 7 | — |
| `date-fns` + `@date-fns/tz` | Accrual/window/TZ math | ✓ (compliance-policy dep) | ^4.1.0 / ^1.2.0 | — |
| `apps/cron-worker` reminders infra | WT-limit daily scan | ✓ | — | — |
| Live public-holiday API | Weekend/holiday premium + working-day math | ✗ (by design) | — | **Seeded `PublicHoliday` reference table (local-only)** — explicitly chosen |
| Unleash (`module.workforce-employees`) | Surface gate | ✓ (flag registered PENDING) | — | Flag-off → METHOD_NOT_FOUND (intended) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** live holiday API → seeded reference calendars (local-only, per CONTEXT + REQUIREMENTS deferred-ideas). Seed PL/DE/UK/US/UAE/KSA public holidays as reference rows; flag DE Bundesland-specific + regional holidays adviser-verify.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via Turborepo) |
| Config file | per-package `vitest.config.ts`; db excludes `src/**/__tests__/**` from typecheck (RED scaffolds don't brick tsc) [VERIFIED: STATE.md] |
| Quick run command | `pnpm --filter @contractor-ops/api test <path>` (scoped — never unscoped web-vite: kills RAM per MEMORY) |
| Full suite command | `pnpm test` (turbo → vitest) — run tests, never cite counts from memory |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEAVE-01 | PL 20/26 by tenure; part-time `etat` pro-rata rounds up; carryover cap; balance = Σ ledger | unit | `pnpm --filter @contractor-ops/api test leave-balance` | ❌ Wave 0 |
| LEAVE-01 | Per-market entitlement resolves for PL/DE/UK/US/UAE/KSA via registry | unit | `pnpm --filter @contractor-ops/compliance-policy test leave-registry` | ❌ Wave 0 |
| LEAVE-02 | Leave request routes through approval-chain (Flow/Step created, `resourceType='LEAVE_REQUEST'`); approve → ledger deduction + balance decrement | integration | `pnpm --filter @contractor-ops/api test leave-approval` | ❌ Wave 0 |
| LEAVE-02 | Manual sick entry writes a DIRECT ledger row + notification, creates NO ApprovalFlow | integration | `…test leave-sick-direct` | ❌ Wave 0 |
| LEAVE-02 | Blackout period rejects overlapping vacation request | unit | `…test leave-blackout` | ❌ Wave 0 |
| LEAVE-03 | Overlapping same-team approved leave raises a conflict warning; capacity heatmap aggregates | unit | `pnpm --filter @contractor-ops/web-vite test team-calendar` | ❌ Wave 0 |
| TIME-EMP-01 | `EmployeeTimeRecord` distinct from `TimeEntry`; captures OT split / night / weekend-holiday on `workerId` | unit | `…test employee-time-record` | ❌ Wave 0 |
| TIME-EMP-02 | On-save sync check flags PL daily >8h; UK 48h opt-out suppresses breach; DE 10h ceiling | unit | `…test wt-limit-check` | ❌ Wave 0 |
| TIME-EMP-02 | Daily scan detects rolling weekly-avg 48h breach, region fan-out (EU+ME), one digest/recipient/day | integration | `…test wt-limit-scan` | ❌ Wave 0 |
| TIME-EMP-03 | Ewidencja snapshot contains KP §149 fields; regenerate supersedes prior (append-only) | integration | `…test ewidencja-builder` | ❌ Wave 0 |
| TIME-EMP-03 | **UPDATE on `EwidencjaSnapshot` raises `restrict_violation`** (DB trigger) | integration (DB) | `pnpm --filter @contractor-ops/db test ewidencja-immutable` | ❌ Wave 0 |
| X-cut | Cross-org leak: ORG_A never reads ORG_B leave/time/ewidencja rows | integration | `…test leave-time-cross-org-leak` (mirror `employee-cross-org-leak.test.ts`) | ❌ Wave 0 |
| X-cut | Flag-off (`module.workforce-employees`) → METHOD_NOT_FOUND / WORKFORCE_DISABLED | integration | `…test workforce-flag` (extend existing) | partial ✅ |

### Sampling Rate
- **Per task commit:** the scoped quick command for the touched package.
- **Per wave merge:** `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/compliance-policy test && pnpm --filter @contractor-ops/db test` (avoid unscoped web-vite full run).
- **Phase gate:** full suite green + `pnpm typecheck` + `pnpm check:web-vite-data-layer` + `pnpm check:wiki-brain` before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/leave-balance.test.ts` — LEAVE-01 (Σ ledger + pro-rata + carryover)
- [ ] `packages/compliance-policy/src/__tests__/leave-registry.test.ts` + `wt-registry.test.ts` — per-market rule resolution
- [ ] `packages/api/src/__tests__/leave-approval.test.ts` + `leave-sick-direct.test.ts` — LEAVE-02
- [ ] `packages/api/src/services/__tests__/wt-limit-check.test.ts` + `wt-limit-scan.test.ts` — TIME-EMP-02
- [ ] `packages/api/src/services/__tests__/ewidencja-builder.test.ts` — TIME-EMP-03 field coverage + supersede
- [ ] `packages/db/src/__tests__/ewidencja-immutable.test.ts` — DB trigger rejects UPDATE
- [ ] `packages/api/src/__tests__/leave-time-cross-org-leak.test.ts` — mirror `employee-cross-org-leak.test.ts`
- [ ] `apps/web-vite/src/components/leave/__tests__/team-calendar.test.tsx` — LEAVE-03 conflict/capacity
- [ ] Shared fixtures: seeded `PublicHoliday` rows + a `Worker(EMPLOYEE)`+`EmployeeProfile{etat}` factory (depends on P90 landing)

## Security Domain

> `security_enforcement` not disabled in config → enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Tenant-owning models + `withTenantScope`; flag gate `module.workforce-employees` |
| V4 Access Control (IDOR/BOLA) | **yes** | Org scope auto-injected; cross-org leak test mandatory; leave-approver RBAC role (P89 HR roles: `hr_admin`/`hr_manager`/`leave_approver`) — approver never a contractor mutation (BFLA fence) [VERIFIED: STATE.md 89-05] |
| V5 Input Validation | yes | Zod on every tRPC procedure (`packages/validators`); leave dates/duration/`etat` bounds |
| V7 Error/Logging (audit) | **yes** | `writeAuditLog` on approve/reject/sick-entry/ledger-adjust/ewidencja-generate; append-only AuditLog |
| V8 Data Protection / retention | **yes** | Ewidencja DB-immutable + `RETENTION_YEARS['KP-ewidencja']`; RODO/GDPR erasure interplay (retention exemption — see AKTA-03 pattern P91) |
| V6 Cryptography | no (this phase) | PII national IDs already encrypted on `EmployeeProfile` (P90) — leave/time don't add PII columns |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org read of another tenant's leave/time/ewidencja | Information Disclosure | Non-`globalModels` + `withTenantScope` + leak test |
| Tampering with an evidentiary ewidencja record | Tampering | DB `BEFORE UPDATE` trigger + RLS insert-only (mirror auditlog) |
| Leave-approver escalating to contractor/invoice mutation | Elevation of Privilege | RBAC HR roles grant only `employee` (+ narrow `contractor:read`); BFLA fence [VERIFIED: STATE.md] |
| Ledger manipulation to inflate balance | Tampering/Repudiation | Append-only ledger (`APPEND_ONLY_MODELS`) + `writeAuditLog` on ADJUSTMENT with mandatory reason |
| Flag bypass to reach dark surface | EoP | Two-layer: conditional router spread + per-request `assertWorkforceEnabled` |
| Notification/alert used to enumerate employees cross-org | Info Disclosure | `dispatch` recipients resolved via org-scoped RBAC recipients; region-prefixed dedup |

## Sources

### Primary (HIGH confidence)
- Codebase (direct Read/grep, VERIFIED): `packages/db/prisma/schema/{approval,time-tracking,worker,employee,audit,contract}.prisma`; `packages/db/prisma/schema/migrations/20260617000000_auditlog_append_only/migration.sql`; `packages/db/src/{tenant,retention-policy,soft-delete,rls}.ts`; `packages/api/src/routers/core/{approval-submit,approval-shared,approval-queue}.ts`; `packages/api/src/services/{approval-engine,tax-form.service,compliance-reminder-scan,notification-service,audit-writer}.ts`; `packages/compliance-policy/src/{registry,types,index,doc-registry,jurisdiction-resolver,policies/pl}.ts`; `packages/classification/src/registry.ts`; `packages/validators/src/approval.ts`; `packages/api/src/middleware/require-workforce-flag.ts`; `packages/api/src/root.ts`.
- PL statute: [KP art. 154](https://sip.lex.pl/akty-prawne/dzu-dziennik-ustaw/kodeks-pracy-16789274/art-154), [art. 129](https://przepisy.gofin.pl/przepisy,6,9,9,212,136518,20170901,art-129-ustawa-z-dnia-26061974-r-kodeks-pracy1.html), [art. 131](https://lexlege.pl/kp/art-131/), [art. 151¹](https://lexlege.pl/kp/art-151-1/), [art. 151⁷](https://lexlege.pl/kp/art-151-7/), [art. 151⁸](https://sip.lex.pl/akty-prawne/dzu-dziennik-ustaw/kodeks-pracy-16789274/art-151-8), [art. 149](https://lexlege.pl/kp/art-149/), [Rozp. 10.12.2018](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20180002369) / [§6](https://lexlege.pl/dokum-pracownicza/paragraf-6/).
- DE: [BUrlG/ArbZG summary — teamed.global](https://www.teamed.global/country-hiring-guides/germany/working-time-and-leave), [fmcgroup.com Germany working time](https://fmcgroup.com/germany-working-time-guide/).
- UK: [Acas working time rules](https://www.acas.org.uk/working-time-rules), [VisitBritain working hours](https://www.visitbritain.org/business-advice/pink-book/working-hours).
- US: [DOL WHD overtime](https://www.dol.gov/agencies/whd/overtime), [Workforce.com overtime by state](https://www.workforce.com/news/overtime-laws-by-state).
- UAE: [MOHRE FDL 33/2021 PDF](https://mohre.gov.ae/assets/download/8cd7cf08/Federal%20Decree-Law%20No.%2033%20of%202021%20Regarding%20the%20Regulation%20of%20Employment%20Relationship%20and%20its%20amendments.pdf.aspx), [uaelegislation.gov.ae](https://uaelegislation.gov.ae/en/legislations/1541/download).
- KSA: [HRSD Labor Law PDF](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf), [Article 109 summary](https://etqanlawfirm-sa.com/en/article-109-saudi-labor-law/).

### Secondary (MEDIUM confidence)
- PL ewidencja field summaries: [Infor.pl art. 149](https://kadry.infor.pl/kodeks-pracy/czas-pracy/684301,Ewidencja-czasu-pracy-art-149.html), [poradnikprzedsiebiorcy.pl](https://poradnikprzedsiebiorcy.pl/-ewidencja-czasu-pracy-obowiazek-pracodawcy).
- DE leave: [aivy.app BUrlG](https://www.aivy.app/en/lexicon/bundesurlaubsgesetz-en), [vacationtracker.io Germany](https://vacationtracker.io/leave-laws/europe/germany/).

### Tertiary (LOW confidence — adviser-verify)
- DE night-premium %, carryover deadlines, UAE/KSA daily-hours specifics — interpretive; flagged in Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack / composition targets: HIGH — every seam read directly from source.
- Architecture patterns: HIGH — approval-chain seams, scan twin, snapshot, trigger all verified in code.
- Statutory headline values (PL/UK/US leave+OT, UAE/KSA annual leave): HIGH — cited to primary/authoritative sources.
- Statutory interpretive edges (DE premium %, retention window, carryover deadline, Gulf hours): MEDIUM — cited but adviser-verify per local-only posture.
- Ewidencja retention (3 vs 10 yr): flagged as the single genuine legal discrepancy (Open Q1).

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (code composition — stable; statute — verify against current consolidated texts if legal review proceeds)
