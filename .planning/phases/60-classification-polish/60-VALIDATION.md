---
phase: 60
slug: classification-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (matches packages/api + packages/classification + apps/web) |
| **Config file** | `packages/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `packages/db/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- classification-polish` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/web test -- classification && pnpm --filter @contractor-ops/db test` |
| **Estimated runtime** | ~90 seconds (api) + ~45 seconds (web) + ~15 seconds (db) |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the touched package
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 150 seconds

---

## Per-Task Verification Map

> 32-row Per-Requirement Test Map derived from 60-RESEARCH.md §Validation Architecture.
> Filled with placeholder task IDs; planner will finalize Task IDs when PLAN.md files land.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 60-01-W0 | 01 | 0 | CLASS-07 | T-60-01 / — | Test scaffolds exist for cron + state machine | wave-0 stubs | `test -f packages/api/src/services/__tests__/economic-dependency-scan.test.ts` | ❌ W0 | ⬜ pending |
| 60-01-01 | 01 | 1 | CLASS-07 | T-60-01 / CSRF | Cron requires Bearer CRON_SECRET | unit | `pnpm --filter @contractor-ops/api test -- economic-dependency-scan.auth` | ❌ W0 | ⬜ pending |
| 60-01-02 | 01 | 1 | CLASS-07 | — / data accuracy | Billing share computed from 12-month rolling window | unit | `pnpm --filter @contractor-ops/api test -- economic-dependency-scan.window` | ❌ W0 | ⬜ pending |
| 60-01-03 | 01 | 1 | CLASS-07 | — / data integrity | Cross-org aggregate bypasses tenant filter via raw client | unit | `pnpm --filter @contractor-ops/api test -- economic-dependency-scan.cross-org` | ❌ W0 | ⬜ pending |
| 60-01-04 | 01 | 1 | CLASS-07 | — / state machine | safe→warning→critical band transitions fire notifications | unit | `pnpm --filter @contractor-ops/api test -- economic-dependency-band-state` | ❌ W0 | ⬜ pending |
| 60-01-05 | 01 | 1 | CLASS-07 | — / dedup | Same-band day repeats produce no notification | unit | `pnpm --filter @contractor-ops/api test -- economic-dependency-dedup` | ❌ W0 | ⬜ pending |
| 60-01-06 | 01 | 1 | CLASS-07 | — / re-fire | Monthly reminder fires after 30d in same band | unit | `pnpm --filter @contractor-ops/api test -- economic-dependency-reminder-cadence` | ❌ W0 | ⬜ pending |
| 60-01-07 | 01 | 1 | CLASS-07 | T-60-05 / RBAC | Recipient resolution gates on contractor:read | unit | `pnpm --filter @contractor-ops/api test -- recipient-resolution` | ❌ W0 | ⬜ pending |
| 60-01-08 | 01 | 1 | CLASS-07 | — / idempotency | Cron replay-safe (same day re-run = zero new notifications) | unit | `pnpm --filter @contractor-ops/api test -- economic-dependency-replay` | ❌ W0 | ⬜ pending |
| 60-02-W0 | 02 | 0 | CLASS-08 | T-60-02 / — | Test scaffolds exist for audit-log scan cron | wave-0 stubs | `test -f packages/api/src/services/__tests__/reassessment-trigger-scan.test.ts` | ❌ W0 | ⬜ pending |
| 60-02-01 | 02 | 1 | CLASS-08 | — / data scope | Audit-scan filters by resourceType + GB engagements + since-last-run | unit | `pnpm --filter @contractor-ops/api test -- reassessment-trigger-scan.filter` | ❌ W0 | ⬜ pending |
| 60-02-02 | 02 | 1 | CLASS-08 | — / allowlist | Material fields allowlist matches ContractorAssignment + Contract per D-07 | unit | `pnpm --filter @contractor-ops/api test -- reassessment-trigger-scan.material-fields` | ❌ W0 | ⬜ pending |
| 60-02-03 | 02 | 1 | CLASS-08 | — / dedup | Multiple changes in one user action append to existing OPEN trigger | unit | `pnpm --filter @contractor-ops/api test -- reassessment-trigger-scan.dedup` | ❌ W0 | ⬜ pending |
| 60-02-04 | 02 | 1 | CLASS-08 | — / gating | No trigger for engagements without a prior IR35 assessment | unit | `pnpm --filter @contractor-ops/api test -- reassessment-trigger-scan.no-prior-assessment` | ❌ W0 | ⬜ pending |
| 60-02-05 | 02 | 1 | CLASS-08 | — / auto-resolve | Submitting new IR35 assessment resolves matching OPEN trigger | integration | `pnpm --filter @contractor-ops/api test -- reassessment-trigger.auto-resolve` | ❌ W0 | ⬜ pending |
| 60-02-06 | 02 | 1 | CLASS-08 | — / status machine | Status transitions: OPEN → ACKNOWLEDGED → RESOLVED / DISMISSED | unit | `pnpm --filter @contractor-ops/api test -- reassessment-trigger.status-transitions` | ❌ W0 | ⬜ pending |
| 60-02-07 | 02 | 1 | CLASS-08 | T-60-08 / RBAC | Dismiss mutation gated on contractor:update | integration | `pnpm --filter @contractor-ops/api test -- reassessment-trigger-router.rbac` | ❌ W0 | ⬜ pending |
| 60-03-W0 | 03 | 0 | CLASS-09 | T-60-09 / — | Test scaffolds for Statusfeststellungsverfahren router + expiry cron | wave-0 stubs | `test -f packages/api/src/routers/__tests__/statusfeststellungsverfahren.test.ts` | ❌ W0 | ⬜ pending |
| 60-03-01 | 03 | 1 | CLASS-09 | — / CRUD | list / listByEngagement / create / update / delete tenant-scoped | integration | `pnpm --filter @contractor-ops/api test -- statusfeststellungsverfahren.crud` | ❌ W0 | ⬜ pending |
| 60-03-02 | 03 | 1 | CLASS-09 | T-60-09 / tenant isolation | Cross-org access rejected | integration | `pnpm --filter @contractor-ops/api test -- statusfeststellungsverfahren.cross-org` | ❌ W0 | ⬜ pending |
| 60-03-03 | 03 | 1 | CLASS-09 | — / reminder cadence | 90/30/7-day reminders fire once each, skip WITHDRAWN + PENDING | unit | `pnpm --filter @contractor-ops/api test -- statusfeststellungsverfahren-expiry-reminder` | ❌ W0 | ⬜ pending |
| 60-03-04 | 03 | 1 | CLASS-09 | — / dedup | Dedup keyed on (id, notificationType) prevents re-fire | unit | `pnpm --filter @contractor-ops/api test -- statusfeststellungsverfahren-reminder-dedup` | ❌ W0 | ⬜ pending |
| 60-03-05 | 03 | 2 | CLASS-09 | — / UI | Per-engagement panel renders filedAt/drvReference/outcome/validity | component | `pnpm --filter @contractor-ops/web test -- drv-clearance-panel` | ❌ W0 | ⬜ pending |
| 60-04-W0 | 04 | 0 | CLASS-10 | T-60-12 / — | Test scaffolds for dashboard router + page | wave-0 stubs | `test -f packages/api/src/routers/__tests__/classification-dashboard.test.ts` | ❌ W0 | ⬜ pending |
| 60-04-01 | 04 | 1 | CLASS-10 | — / data aggregation | Per-market assessment coverage % computed from latest completed assessments | unit | `pnpm --filter @contractor-ops/api test -- classification-dashboard.coverage` | ❌ W0 | ⬜ pending |
| 60-04-02 | 04 | 1 | CLASS-10 | — / data aggregation | Risk distribution buckets latest assessment per engagement per market | unit | `pnpm --filter @contractor-ops/api test -- classification-dashboard.risk-distribution` | ❌ W0 | ⬜ pending |
| 60-04-03 | 04 | 1 | CLASS-10 | — / data aggregation | Overdue reassessments lists triggers + DE 12mo-old assessments | unit | `pnpm --filter @contractor-ops/api test -- classification-dashboard.overdue` | ❌ W0 | ⬜ pending |
| 60-04-04 | 04 | 1 | CLASS-10 | — / data aggregation | Active alerts counts warning/critical bands + DRV expiring ≤90d | unit | `pnpm --filter @contractor-ops/api test -- classification-dashboard.active-alerts` | ❌ W0 | ⬜ pending |
| 60-04-05 | 04 | 1 | CLASS-10 | T-60-15 / XSS-CSV | CSV export neutralizes formula-prefix chars (=, +, -, @) | unit | `pnpm --filter @contractor-ops/api test -- classification-dashboard.csv-sanitization` | ❌ W0 | ⬜ pending |
| 60-04-06 | 04 | 1 | CLASS-10 | — / CSV format | CSV contains all required columns + one row per engagement | integration | `pnpm --filter @contractor-ops/api test -- classification-dashboard.csv-format` | ❌ W0 | ⬜ pending |
| 60-04-07 | 04 | 2 | CLASS-10 | — / UI | Dashboard page renders two market cards with 4 tiles each | component | `pnpm --filter @contractor-ops/web test -- classification-dashboard` | ❌ W0 | ⬜ pending |
| 60-04-08 | 04 | 2 | CLASS-10 | — / a11y | Stacked bar has role+label; overdue list keyboard-navigable | component | `pnpm --filter @contractor-ops/web test -- classification-dashboard.a11y` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/economic-dependency-scan.test.ts` — stubs for CLASS-07 (cron auth, window, cross-org, state machine, dedup, cadence, RBAC, replay)
- [ ] `packages/api/src/services/__tests__/reassessment-trigger-scan.test.ts` — stubs for CLASS-08 (filter, material fields, dedup, gating, auto-resolve, status, RBAC)
- [ ] `packages/api/src/routers/__tests__/statusfeststellungsverfahren.test.ts` — stubs for CLASS-09 (CRUD, cross-org, reminder cadence, dedup)
- [ ] `packages/api/src/routers/__tests__/classification-dashboard.test.ts` — stubs for CLASS-10 (coverage, risk distribution, overdue, active alerts, CSV sanitization, CSV format)
- [ ] `apps/web/src/app/[locale]/(dashboard)/classification/__tests__/page.test.tsx` — component scaffold for dashboard page
- [ ] `apps/web/src/components/contractors/classification/drv-clearance/__tests__/drv-clearance-panel.test.tsx` — component scaffold for engagement panel
- [ ] `packages/api/src/lib/csv.ts` — extend `escapeCsvField` with formula-prefix neutralization (drop leading `=`/`+`/`-`/`@` by prefixing with a tab) + unit test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email/Slack/Teams delivery reaches real inbox with correct formatting | CLASS-07, CLASS-08, CLASS-09 | External channel wiring depends on Postmark/Slack/Teams transports provisioned at runtime; local-only app defers | 1. Seed a DE contractor assignment with one historical invoice >70% share. 2. Run cron locally via Bearer. 3. Confirm `Notification` row created with `status='SENT'` and dispatcher logs outbound call |
| Visual design check against Phase 58 outcome pill palette | CLASS-10 | Color perception cannot be asserted in automated tests | Open `/{locale}/(dashboard)/classification/`, confirm stacked bar segment colors match outcome banner pills on Phase 58 pages |
| Cron schedule slot coordination | CLASS-07, CLASS-08 | Render/Railway deployment config lives outside the repo; needs ops handoff | Verify cron schedule not colliding with `/api/cron/reminders` run window; document in SUMMARY.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 150s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
