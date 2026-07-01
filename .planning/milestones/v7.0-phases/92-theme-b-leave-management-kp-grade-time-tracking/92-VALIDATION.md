---
phase: 92
slug: theme-b-leave-management-kp-grade-time-tracking
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-01
---

# Phase 92 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 92-RESEARCH.md § Validation Architecture. Nyquist validation is enabled.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via Turborepo) |
| **Config file** | per-package `vitest.config.ts`; db excludes `src/**/__tests__/**` from typecheck (RED scaffolds don't brick tsc) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test <path>` (scoped — NEVER unscoped web-vite: kills RAM per MEMORY) |
| **Full suite command** | `pnpm test` (turbo → vitest) — run tests, never cite counts from memory |
| **i18n parity** | root `pnpm i18n:parity` (`scripts/i18n-parity.mjs`) — NOT a `--filter` script; `check:i18n` does not exist |
| **Estimated runtime** | scoped ~10-40s per package; full suite minutes (do not run unscoped web-vite) |

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched package (`pnpm --filter @contractor-ops/<pkg> test <path>`).
- **After every plan wave:** `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/compliance-policy test && pnpm --filter @contractor-ops/db test` (avoid unscoped web-vite full run).
- **Before `/gsd:verify-work`:** Full suite green + `pnpm typecheck` + `pnpm i18n:parity` + `pnpm check:web-vite-data-layer` + `pnpm check:wiki-brain`.
- **Max feedback latency:** < 60 seconds (scoped package run).

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| LEAVE-01 | PL 20/26 by tenure; part-time `etat` pro-rata rounds up; carryover cap; balance = Σ ledger | unit | `pnpm --filter @contractor-ops/api test leave-balance` | ❌ W0 |
| LEAVE-01 | Per-market entitlement resolves for PL/DE/UK/US/UAE/KSA via registry | unit | `pnpm --filter @contractor-ops/compliance-policy test leave-registry` | ❌ W0 |
| LEAVE-02 | Leave request routes through approval-chain (Flow/Step created, `resourceType='LEAVE_REQUEST'`); approve → ledger deduction + balance decrement | integration | `pnpm --filter @contractor-ops/api test leave-approval` | ❌ W0 |
| LEAVE-02 | **RBAC: a `leave_approver`-only session approves a LEAVE_REQUEST (succeeds); an invoice-only approver is FORBIDDEN on leave; a `leave_approver` is FORBIDDEN on an INVOICE (no over-grant)** | integration | `pnpm --filter @contractor-ops/api test leave-approval-rbac` | ❌ W0 |
| LEAVE-02 | Manual sick entry writes a DIRECT ledger row + notification, creates NO ApprovalFlow | integration | `pnpm --filter @contractor-ops/api test leave-sick-direct` | ❌ W0 |
| LEAVE-02 | Blackout period rejects overlapping vacation request | unit | `pnpm --filter @contractor-ops/api test leave-blackout` | ❌ W0 |
| LEAVE-03 | Overlapping same-team approved leave raises a conflict warning; capacity heatmap aggregates | unit | `pnpm --filter @contractor-ops/web-vite test team-calendar` | ❌ W0 |
| TIME-EMP-01 | `EmployeeTimeRecord` distinct from `TimeEntry`; captures OT split / night / weekend-holiday on `workerId` | unit | `pnpm --filter @contractor-ops/api test employee-time-record` | ❌ W0 |
| TIME-EMP-02 | On-save sync check flags PL daily >8h; UK 48h opt-out suppresses breach; DE 10h ceiling | unit | `pnpm --filter @contractor-ops/api test wt-limit-check` | ❌ W0 |
| TIME-EMP-02 | Daily scan detects rolling weekly-avg 48h breach, region fan-out (EU+ME), one digest/recipient/day | integration | `pnpm --filter @contractor-ops/api test wt-limit-scan` | ❌ W0 |
| TIME-EMP-03 | Ewidencja snapshot contains KP §149 fields; regenerate supersedes prior (append-only) | integration | `pnpm --filter @contractor-ops/api test ewidencja-builder` | ❌ W0 |
| TIME-EMP-03 | **UPDATE on `EwidencjaSnapshot` raises DB trigger violation** | integration (DB) | `pnpm --filter @contractor-ops/db test ewidencja-immutable` | ❌ W0 |
| X-cut | Cross-org leak: ORG_A never reads ORG_B leave/time/ewidencja rows | integration | `pnpm --filter @contractor-ops/api test leave-time-cross-org-leak` (mirror `employee-cross-org-leak.test.ts`) | ❌ W0 |
| X-cut | Flag-off (`module.workforce-employees`) → METHOD_NOT_FOUND / WORKFORCE_DISABLED | integration | `pnpm --filter @contractor-ops/api test workforce-flag` (extend existing) | partial ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/leave-balance.test.ts` — LEAVE-01 (Σ ledger + pro-rata + carryover)
- [ ] `packages/compliance-policy/src/__tests__/leave-registry.test.ts` + `wt-registry.test.ts` — per-market rule resolution
- [ ] `packages/api/src/__tests__/leave-approval.test.ts` + `leave-sick-direct.test.ts` — LEAVE-02
- [ ] `packages/api/src/__tests__/leave-approval-rbac.test.ts` — LEAVE-02 RBAC gate (leave_approver approves LEAVE_REQUEST; invoice-only forbidden; no over-grant) → Plan 07 turns GREEN
- [ ] `packages/api/src/services/__tests__/wt-limit-check.test.ts` + `wt-limit-scan.test.ts` — TIME-EMP-02
- [ ] `packages/api/src/services/__tests__/ewidencja-builder.test.ts` — TIME-EMP-03 field coverage + supersede
- [ ] `packages/db/src/__tests__/ewidencja-immutable.test.ts` — DB trigger rejects UPDATE
- [ ] `packages/api/src/__tests__/leave-time-cross-org-leak.test.ts` — mirror `employee-cross-org-leak.test.ts`
- [ ] `apps/web-vite/src/components/leave/__tests__/team-calendar.test.tsx` — LEAVE-03 conflict/capacity
- [ ] Shared fixtures: seeded `PublicHoliday` rows + a `Worker(EMPLOYEE)`+`EmployeeProfile{etat}` factory (depends on P90 landing)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Statutory rule VALUES correct per market | LEAVE-01, TIME-EMP-02 | Legal interpretation — adviser-verify per local-only / legal-deferred posture | Values encoded from cited primary sources (KP arts. 154/129/151, BUrlG/ArbZG, WTR 1998, FLSA, UAE FDL 33/2021, KSA Labor Law art. 109); flag for Steuerberater/doradca review post-deploy, do NOT hard-block |
| Team-calendar visual capacity heatmap reads correctly | LEAVE-03 | Visual/UX judgment | Manual UAT: month + quarter views render capacity bands + conflict markers on overlapping same-team requests |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (incl. the leave-approval-rbac Blocker-1 contract)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-01 (post-revision — Blocker 1 RBAC gate + Blocker 2 i18n script fixed; leave-approval-rbac Wave-0 contract added).
