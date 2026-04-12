---
phase: 9
slug: dashboard-reports
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/api/vitest.config.ts |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --reporter=verbose` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test -- --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --reporter=verbose`
- **After every plan wave:** Run `pnpm --filter @contractor-ops/api test -- --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | DASH-01, DASH-02, DASH-03, DASH-04, DASH-05 | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06 | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | ORG-10 | unit | `pnpm --filter @contractor-ops/api test` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | DASH-01 through DASH-05 | manual | browser verification | N/A | ⬜ pending |
| 09-03-01 | 03 | 2 | RPT-01 through RPT-06 | manual | browser verification | N/A | ⬜ pending |
| 09-04-01 | 04 | 2 | ORG-10 | manual | browser verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/routers/__tests__/dashboard.test.ts` — stubs for dashboard KPI queries
- [ ] `packages/api/src/routers/__tests__/report.test.ts` — stubs for report aggregation queries
- [ ] `packages/api/src/routers/__tests__/audit.test.ts` — stubs for audit log queries

*If existing test infrastructure covers: adapt to existing patterns.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard KPI cards with live data | DASH-01 | Visual layout with clickable navigation | Open dashboard, verify 5 KPI cards render with correct data, click each to verify navigation |
| Spend area chart with time toggle | DASH-02 | Recharts rendering, interactive tooltips | Open dashboard, verify area chart renders, toggle 6m/12m/YTD, hover for tooltips |
| Reports drill-down and breadcrumb | RPT-01, RPT-02 | Chart-to-table interaction | Open reports, click chart segment, verify table filters, verify breadcrumb |
| CSV export (page + all) | RPT-06 | File download verification | Filter a report, export page, export all, verify CSV content |
| Audit log search + expand | ORG-10 | Full-text search + expandable rows | Open Settings > Audit Log, search, filter, expand row, verify diff |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
