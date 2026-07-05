---
phase: 97
slug: theme-b-hr-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 97 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `97-RESEARCH.md` § Validation Architecture. The load-bearing proof is the **HR-role RBAC fence** (only `employee:read` — owner + the four HR roles — reaches the dashboard; finance/ops roles get `FORBIDDEN`) plus the **cross-org aggregation fence** (no org-A row leaks into an org-B total/groupBy/window) and the **per-section doc-expiry grain** (a `payroll_officer` sees only section-C expiry rows, never section B). Because the widgets are aggregates, **aggregation correctness is a security property** — a wrong `where` is simultaneously a bug and a cross-tenant leak.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) — `packages/api/package.json`; React Testing Library for the UI waves — `apps/web-vite` |
| **Config file** | `packages/api/vitest.config.ts`; `apps/web-vite/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test <path>` (scoped) / `pnpm --filter @contractor-ops/web-vite test <path>` (scoped — path arg MANDATORY) |
| **Full suite command** | `pnpm --filter @contractor-ops/api test` (scope by path — the `hr-dashboard` tree) |
| **Estimated runtime** | ~5s unit (pure aggregation/expiry/utilization helpers); ~30s scoped API integration (RBAC fence, org-scoping, section grain, dark-flag gating); web-vite scoped ~15–30s |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` (kills Mac RAM).

---

## Sampling Rate

- **After every task commit:** scoped `pnpm --filter @contractor-ops/<pkg> test <changed-path>` (< 30s).
- **After every plan wave:** `pnpm -F @contractor-ops/api test` (scoped to the `hr-dashboard` tree) + `pnpm typecheck --filter=@contractor-ops/api` + touched guards (`lint:schema`, `lint:raw-sql`, `lint:logs`, `lint:silent-catch`, `pnpm standards:check`, `pnpm lint:no-breadcrumbs`; the DB wave adds `pnpm -F @contractor-ops/db test` + `pnpm db:generate`; the flag wave adds `pnpm -F @contractor-ops/feature-flags test`; UI waves add `check:web-vite-data-layer`, `check:web-vite-page-shells`, `check:web-vite-presentational`, `i18n:parity`).
- **Before `/gsd:verify-work`:** full scoped api suite green + web-vite scoped green + `pnpm check:wiki-brain` green.
- **Max feedback latency:** 30 seconds (scoped).

---

## Per-Task Verification Map

> The RBAC fence + cross-org fence + section grain are the primary security regressions; aggregation correctness is co-load-bearing. Each requirement maps to an automated proof.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| HR-DASH-01 | additive migration: `EmployeeProfile.department`/`employmentType`/`contractEndDate`/`probationEndsAt` + `EmploymentType` enum exist, nullable + indexed; `pnpm db:generate` clean | integration | `pnpm -F @contractor-ops/db test hr-dashboard-schema` | ❌ W1 (GREEN foundation) |
| HR-DASH-03 | additive migration: `PersonnelFileDocument.expiresAt`/`docCategory` + `EmployeeDocCategory` enum exist, nullable + indexed | integration | `pnpm -F @contractor-ops/db test hr-dashboard-schema` | ❌ W1 (GREEN foundation) |
| HR-DASH-01..05 | dark-flag: `module.hr-dashboard` registered (module, default false, signoff PENDING) | unit | `pnpm -F @contractor-ops/feature-flags test` | ❌ W1 (GREEN) |
| HR-DASH-01..05 | **RBAC fence**: a `finance_admin`/`ops_manager` caller gets `FORBIDDEN` on every `hrDashboard.*`; `hr_admin`/`hr_manager`/`payroll_officer`/`leave_approver`/`owner` pass the gate | integration | `pnpm -F @contractor-ops/api test hr-dashboard-rbac` | ❌ W2 (RED — the load-bearing fence) |
| HR-DASH-01..05 | **cross-org fence**: an org-B session's headcount/utilization/expiry/probation aggregates never include an org-A row; every `where` spells out `organizationId`; no client-supplied org id trusted | integration | `pnpm -F @contractor-ops/api test hr-dashboard-org-scope` | ❌ W2 (RED) |
| HR-DASH-03 | **per-section grain**: a `payroll_officer` caller's `getDocumentExpiry` returns only section-C rows (never B); `leave_approver` only section A; `hr_admin` all four | integration | `pnpm -F @contractor-ops/api test hr-dashboard-section-grain` | ❌ W2 (RED → W3 GREEN) |
| HR-DASH-01..05 | **dark-flag gating**: `hrDashboard` absent from the router + per-procedure `METHOD_NOT_FOUND` when `module.hr-dashboard` OFF (and when `module.workforce-employees` OFF) | unit (regression) | `pnpm -F @contractor-ops/api test hr-dashboard-gating` | ❌ W2 (RED → W3 GREEN) |
| HR-DASH-01 | **aggregation correctness**: `getHeadcount` buckets (by department / jurisdiction / employment-type) each sum to the total active count; a null column falls into an "unspecified" bucket, not dropped | integration | `pnpm -F @contractor-ops/api test hr-dashboard-headcount` | ❌ W2 (RED) → W3 GREEN |
| HR-DASH-02 | **utilization correctness**: `getVacationUtilization` `taken`/`entitled` equals the `LeaveBalance` cache (`usedMinutes` / `entitledMinutes+carryoverMinutes`); the >10-unused flag fires only inside the year-end window | integration | `pnpm -F @contractor-ops/api test hr-dashboard-utilization` | ❌ W2 (RED) → W3 GREEN |
| HR-DASH-04 | **probation window**: `getProbationWatchlist` partitions 14/7/0-day buckets at the TZ start-of-day boundary; a worker with `probationEndsAt` exactly today lands in the 0 bucket; TERMINATED workers excluded | integration | `pnpm -F @contractor-ops/api test hr-dashboard-probation` | ❌ W2 (RED) → W3 GREEN |
| HR-DASH-03 | **doc-expiry adapter**: `deriveEmployeeDocExpiry` buckets 90/60/30/expired via `daysUntilExpiryInTz` (TZ from `countryCode`); a null `expiresAt` row is excluded; matches the F1 boundary semantics | unit | `pnpm -F @contractor-ops/api test hr-dashboard-doc-expiry` | ❌ W2 (RED) → W3 GREEN |
| HR-DASH-05 | **Emiratisation rollup**: the per-country rollup derives the UAE rate from the **manual** headcount only (no `EmployeeProfile`-derived rate), reads the band read-through, and returns the KSA + UAE shapes side-by-side | unit | `pnpm -F @contractor-ops/api test saudization-dashboard` | ✅ extend (W3) |
| HR-DASH-01..05 | web-vite data-layer: `useTRPC`/`useQuery`/`useMutation` only under `components/hr-dashboard/hooks/**`; pages thin; views presentational | lint (regression) | `pnpm check:web-vite-data-layer && pnpm check:web-vite-page-shells && pnpm check:web-vite-presentational` | ✅ extend (W4) |
| HR-DASH-01..05 | i18n parity: en/en-US/pl/de/ar keys present for every new `HrDashboard.*` string; no hardcoded strings; RTL renders | lint (regression) | `pnpm i18n:parity` | ✅ extend (W5) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 2 Requirements (the RED net — seeded before any hrDashboard impl)

- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-rbac.test.ts` — the HR-role fence: `finance_admin`/`ops_manager`/`readonly` → `FORBIDDEN`; `hr_admin`/`hr_manager`/`payroll_officer`/`leave_approver`/`owner` pass (the load-bearing test)
- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-org-scope.test.ts` — cross-org fence: org-B aggregates exclude org-A rows across headcount/utilization/expiry/probation; no client org id trusted
- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-section-grain.test.ts` — `getDocumentExpiry` filtered by the caller's `employeeFile{A..D}:read` (payroll_officer → C only; leave_approver → A only)
- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-gating.test.ts` — namespace absent + per-procedure `METHOD_NOT_FOUND` when `module.hr-dashboard` (or `module.workforce-employees`) OFF
- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-headcount.test.ts` — buckets sum to total; null → "unspecified" bucket
- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-utilization.test.ts` — taken/entitled equals the `LeaveBalance` cache; >10-day flag inside the year-end window only
- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-probation.test.ts` — 14/7/0 buckets partition at the TZ boundary; today → 0 bucket; TERMINATED excluded
- [ ] `packages/api/src/services/__tests__/hr-dashboard-doc-expiry.test.ts` — `deriveEmployeeDocExpiry` band boundaries via `daysUntilExpiryInTz`; null `expiresAt` excluded
- [ ] `packages/api/src/routers/workforce/__tests__/hr-dashboard-fixtures.ts` — two-org, multi-role, multi-department, mixed-section-document, probation-window, leave-balance fixture

**tsconfig guard:** `packages/api` excludes `src/**/__tests__/**` from `tsc --noEmit`, so RED scaffolds importing the not-yet-built `hrDashboard` procedures do not brick the package typecheck — confirm before seeding; do NOT re-add a broad include.

**Migration guard:** the RBAC/org-scope/aggregation tests need the promoted columns (97-01) + the doc-expiry columns (97-01). Author the tests against the intended schema; they stay RED until 97-01 lands the migration + `pnpm db:generate`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arabic RTL + de formal-Sie visual pass on the HR dashboard | HR-DASH-01..05 | Machine-translated copy + eyeball RTL (EXTERNAL-ENABLEMENT #9/#10) | Render `dashboard/hr` at `ar` and `de`; confirm RTL mirroring of the KPI cards + charts, no clipped/overflowing numbers, Sie register; native-speaker review before EU GA |
| Migration apply to regional `DATABASE_URL_*` | HR-DASH-01/03/04 | Deploy-time human step (drift-blocked posture) | The `__`-prefixed additive migrations (EmployeeProfile promoted columns + PersonnelFileDocument expiry columns + two enums) are generated + committed; apply at deploy; Prisma client compiles without a live DB |
| Real-org visual sanity of the aggregates | HR-DASH-01/02/05 | Aggregate numbers need eyeballing against a populated org | Flip `module.hr-dashboard` + `module.workforce-employees` APPROVED for a test org with employees, leave balances, and manual KSA/UAE headcount; confirm headcount buckets, utilization, and the nationalisation rate render sensibly and the empty states show when a surface is dark |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 2 RED dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 2 covers all MISSING references (RBAC fence, org-scope, section grain, dark-flag gating, headcount/utilization/probation/doc-expiry correctness)
- [ ] The RBAC fence + the cross-org fence + the per-section grain are all present and green before `/gsd:verify-work`
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
