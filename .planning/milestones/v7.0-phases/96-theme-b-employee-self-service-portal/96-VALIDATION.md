---
phase: 96
slug: theme-b-employee-self-service-portal
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 96 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `96-RESEARCH.md` § Validation Architecture. The load-bearing proof is the **two-employee IDOR fence** (an employee portal session sees ONLY its own records) plus the **manager-non-report + cross-org** fence and the **contractor-path regression** (the extended session must not change the existing contractor login).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) — `packages/api/package.json`; React Testing Library / Playwright for the UI waves — `apps/web-vite` |
| **Config file** | `packages/api/vitest.config.ts`; `apps/web-vite/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test <path>` (scoped) / `pnpm --filter @contractor-ops/web-vite test <path>` (scoped — path arg MANDATORY) |
| **Full suite command** | `pnpm --filter @contractor-ops/api test` (scope by path — the portal tree) |
| **Estimated runtime** | ~5s unit (session discrimination, self-view allowlist); ~30s scoped API integration (IDOR, portal routers, gating); web-vite scoped ~15–30s |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` (kills Mac RAM).

---

## Sampling Rate

- **After every task commit:** scoped `pnpm --filter @contractor-ops/<pkg> test <changed-path>` (< 30s).
- **After every plan wave:** `pnpm -F @contractor-ops/api test` (scoped to the portal tree) + `pnpm typecheck --filter=@contractor-ops/api` + touched guards (`lint:audit-log`, `lint:schema`, `lint:raw-sql`, `lint:logs`, `lint:silent-catch`, `pnpm standards:check`, `pnpm lint:no-breadcrumbs`; UI waves add `check:web-vite-data-layer`, `check:web-vite-page-shells`, `check:web-vite-presentational`, `i18n:parity`; env-touch adds `pnpm check:no-process-env`).
- **Before `/gsd:verify-work`:** full scoped api suite green + web-vite scoped green + `pnpm check:wiki-brain` green.
- **Max feedback latency:** 30 seconds (scoped).

---

## Per-Task Verification Map

> The IDOR + gating + contractor-regression proofs are the primary security regressions. Each requirement maps to an automated proof.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| EMP-PORTAL-01 | `PortalSession` subject CHECK holds: a row must be exactly one of contractor-subject or employee-subject (a both/neither insert is rejected by the DB) | integration | `pnpm -F @contractor-ops/api test portal-session-subject` | ❌ W1 (RED via missing migration) |
| EMP-PORTAL-01 | contractor-path regression: an existing contractor magic-link → validate → `ctx.contractorId` is byte-for-byte unchanged (no `workerId` leaks into a contractor ctx) | integration | `pnpm -F @contractor-ops/api test portal-contractor-regression` | ✅ extend (must stay green through W2) |
| EMP-PORTAL-01 | `findEmployeesByEmail` resolves an ACTIVE `Worker(EMPLOYEE)` by email; `verifyMagicLink` returns the union of contractor + employee subjects for the org-picker | unit | `pnpm -F @contractor-ops/api test portal-employee-resolution` | ❌ W2 (RED via missing resolver) |
| EMP-PORTAL-02/03 | **two-employee IDOR**: employee A's session cannot read B's leave balance / akta / time; a client-supplied `workerId` is rejected by `.strict()`; cross-org token reads nothing | integration | `pnpm -F @contractor-ops/api test portal-employee-idor` | ❌ W3 (RED — the load-bearing fence) |
| EMP-PORTAL-03 | **manager IDOR**: a manager cannot read or approve for a worker who is not their report (`managerWorkerId !== ctx.workerId`); a non-manager gets no `/team` surface; cross-org blocked | integration | `pnpm -F @contractor-ops/api test portal-manager-idor` | ❌ W3 (RED) |
| EMP-PORTAL-02 | leave-from-portal: `submitTimeOffRequest` derives `workerId` from the session, computes balance via `computeLeaveBalance`, creates the approval flow, and `writeAuditLog`s in-tx; the input has NO `workerId` field | integration | `pnpm -F @contractor-ops/api test portal-timeoff-request` | ❌ W3 (RED via missing router) → W4 GREEN |
| EMP-PORTAL-02 | entitlement-scoped akta: the self-view returns ONLY the caller's own file, filtered to `PERSONNEL_FILE_SELF_VIEW_SECTIONS`; a section outside the allowlist (e.g. section C) never enters the response; no client `workerId`/`section` trusted | integration | `pnpm -F @contractor-ops/api test portal-akta-selfview` | ❌ W3 (RED) → W4 GREEN |
| EMP-PORTAL-02 | pay-stub availability: `getPayStubAvailability` returns `{ available:false, reason:'EXTERNAL_PAYROLL' }` in v7.0 — never a fabricated stub | unit | `pnpm -F @contractor-ops/api test portal-paystub-unavailable` | ❌ W3 (RED) → W4 GREEN |
| EMP-PORTAL-03 | manager approve/reject flips the report's leave request through the shared approval transition (ledger DEDUCTION on approve) and audit-logs; only a report can be actioned | integration | `pnpm -F @contractor-ops/api test portal-manager-approve` | ❌ W4 (RED via missing router) |
| EMP-PORTAL-01/02/03 | dark-flag gating: `portalEmployee`/`portalManager` are absent from `portalAppRouter` when `module.employee-portal` OFF; each procedure `METHOD_NOT_FOUND`/re-asserts the flag per request | unit (regression) | `pnpm -F @contractor-ops/api test portal-root-gating` | ❌ W3 (RED) → W4 GREEN |
| EMP-PORTAL-02/03 | web-vite data-layer: `useTRPC`/`useQuery`/`useMutation` only under `components/portal/employee/hooks/**`; pages are thin; views are presentational | lint (regression) | `pnpm check:web-vite-data-layer && pnpm check:web-vite-page-shells && pnpm check:web-vite-presentational` | ✅ extend (W5) |
| EMP-PORTAL-04 | i18n parity: en/pl/de/ar/en-US keys present for every new `Portal.employee.*` string; no hardcoded strings; RTL renders | lint (regression) | `pnpm i18n:parity` | ✅ extend (W6) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 3 Requirements (the RED net — seeded before any portal impl)

- [ ] `packages/api/src/routers/portal/__tests__/portal-employee-idor.test.ts` — two-employee fence: A cannot read B's balance/akta/time; client `workerId` rejected; cross-org blocked (the load-bearing test)
- [ ] `packages/api/src/routers/portal/__tests__/portal-manager-idor.test.ts` — manager cannot read/approve a non-report; non-manager has no `/team`; cross-org blocked
- [ ] `packages/api/src/routers/portal/__tests__/portal-timeoff-request.test.ts` — session-scoped workerId + service reuse + audit-in-tx; input has no `workerId`
- [ ] `packages/api/src/routers/portal/__tests__/portal-akta-selfview.test.ts` — own-file-only + section-allowlist filtering (section C excluded)
- [ ] `packages/api/src/routers/portal/__tests__/portal-paystub-unavailable.test.ts` — `{ available:false }` (no stub read in v7.0)
- [ ] `packages/api/src/routers/portal/__tests__/portal-root-gating.test.ts` — namespaces absent + per-procedure `METHOD_NOT_FOUND` when `module.employee-portal` OFF
- [ ] `packages/api/src/services/__tests__/portal-employee-resolution.test.ts` — `findEmployeesByEmail` + verify union (may seed in W2)
- [ ] `packages/api/src/services/__tests__/portal-session-subject.test.ts` + `portal-contractor-regression.test.ts` — CHECK invariant + contractor-path unchanged

**tsconfig guard:** `packages/api` excludes `src/**/__tests__/**` from `tsc --noEmit`, so RED scaffolds importing the not-yet-built `portalEmployee`/`portalManager` procedures do not brick the package typecheck — confirm before seeding; do NOT re-add a broad include.

**Migration guard:** `portal-session-subject` + `portal-manager-idor` need the `PortalSession` subject columns + CHECK (96-01) and the `EmployeeProfile.managerWorkerId` FK (96-01). Author the tests against the intended constraint; they stay RED until 96-01 lands the migration + `pnpm db:generate`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live magic-link email round-trip for an employee | EMP-PORTAL-01 | Needs a real inbox + subdomain | Flip `module.employee-portal` + `module.workforce-employees` APPROVED for a test org, request a link as an employee email, confirm the org-picker shows the employee subject and the session lands on `/portal/employee` |
| Arabic RTL + formal-Sie visual pass on the new routes | EMP-PORTAL-04 | Machine-translated copy + eyeball RTL (EXTERNAL-ENABLEMENT #9/#10) | Render `/portal/employee/*` at `ar` and `de`; confirm RTL mirroring, Sie register, no clipped/overflowing strings; native-speaker review before EU GA |
| Pay-stub surface when a future payslip model lands | EMP-PORTAL-02 | No payslip surface in v7.0 (C3) | The read model returns `available:false`; when a payslip surface ships, extend `getPayStubAvailability` + the UI empty state flips to a real list |
| Migration apply to regional `DATABASE_URL_*` | EMP-PORTAL-01/03 | Deploy-time human step (drift-blocked posture) | The `__`-prefixed migrations (PortalSession subject + CHECK; managerWorkerId FK) are generated + committed; apply at deploy; Prisma client compiles without a live DB |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 3 RED dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 3 covers all MISSING references (subject CHECK, contractor regression, employee resolution, employee IDOR, manager IDOR, time-off scoping, akta self-view, pay-stub, gating)
- [ ] The two-employee IDOR test + the contractor-path regression are both present and green before `/gsd:verify-work`
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
