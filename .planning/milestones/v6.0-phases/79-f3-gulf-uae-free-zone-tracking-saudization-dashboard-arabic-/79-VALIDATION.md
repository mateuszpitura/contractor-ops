---
phase: 79
slug: f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-03
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo → per-package) |
| **Config file** | per-package `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- <path>` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test` (NEVER run full unscoped web-vite suite — kills RAM; always scope with a path arg) |
| **Estimated runtime** | ~30–90 seconds (scoped) |

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched package.
- **After every plan wave:** Run the scoped full suite for the touched package(s).
- **Before `/gsd:verify-work`:** Scoped suites green for packages/api + packages/compliance-policy + packages/validators + packages/db.
- **Max feedback latency:** 90 seconds.

---

## Critical Behaviors (Nyquist — MUST be test-covered)

These are the behaviors whose failure is high-recovery-cost. Each must map to an automated test task in a plan.

| # | Critical behavior | Requirement | Why it matters | Test type |
|---|-------------------|-------------|----------------|-----------|
| C1 | Expired free-zone license (BLOCKING item, status EXPIRED) hard-blocks payment | GULF-02 | Money gate — false-negative pays a non-compliant contractor | integration (payment gate) |
| C2 | Mainland contractor gets NO free-zone BLOCKING item / no payment-block | GULF-01/02, D-04 | False-positive blocks a legitimately-payable contractor | integration |
| C3 | Free-zone license expiry flows into the reminder cascade for **ME-region** orgs | GULF-02 | LANDMINE: cron is EU-only today; ME orgs invisible without region fan-out | integration (region fan-out) |
| C4 | Free-zone compliance row survives policy supersession (not orphaned/WAIVED) | GULF-01/02 | LANDMINE: supersedeAndMaterialise WAIVES non-re-emitted rows | integration (supersession isolation) |
| C5 | ISIC-code scope-mismatch fires advisory + auto-creates NOC item; uncoded contract → no false alarm | GULF-03, D-05..D-08 | Advisory correctness / false-positive rate | unit + integration |
| C6 | Saudization band is NEVER auto-computed — manual entry only; last-updated timestamp + quarterly re-prompt | GULF-05, D-10 | Locked legal-liability anti-feature | unit |
| C7 | Offboarding band-trajectory is live, advisory-only, non-gating, non-authoritative | GULF-07, D-12 | Must not assert/set a band | unit |
| C8 | New gulf models route ME data to ME DB — no cross-region leakage | GULF-11, D-09 | Multi-region integrity (Pitfall 19) | schema-lint / region test |
| C9 | Drift override (Nitaqat thresholds / permitted-activity) is audit-logged + badged | GULF-10 | Audit fidelity | integration |
| C10 | RTL logical-property guard + locked-phrase (ae/sa) guard green; 4-locale parity | GULF-08/09, D-13..D-16 | i18n integrity | lint / parity |

---

## Per-Task Verification Map

> Filled during planning/execution. Every plan task touching a C# behavior above must declare an `<automated>` verify command. Seed rows below; planner expands per plan.

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 79-03-01 | 79-03 | 2 | GULF-02 | C1 payment hard-block on expired FZ license | integration | `pnpm --filter @contractor-ops/api test -- free-zone-payment-block` | ⬜ pending |
| 79-03-01 | 79-03 | 2 | GULF-02/D-04 | C2 Mainland gets no item / not blocked | integration | `pnpm --filter @contractor-ops/api test -- free-zone-mainland-exclusion` | ⬜ pending |
| 79-03-02 | 79-03 | 2 | GULF-02 | C3 ME-region cascade fan-out | integration | `pnpm --filter @contractor-ops/api test -- reminder-region-fanout` | ⬜ pending |
| 79-03-01 | 79-03 | 2 | GULF-01/02 | C4 supersession does not orphan FZ row | integration | `pnpm --filter @contractor-ops/api test -- free-zone-supersession-isolation` | ⬜ pending |
| 79-04-01 | 79-04 | 2 | GULF-03/D-05..08 | C5 ISIC scope-mismatch + auto-NOC; uncoded skip | unit+integration | `pnpm --filter @contractor-ops/api test -- permitted-activity-noc` | ⬜ pending |
| 79-04-02 | 79-04 | 2 | GULF-05/06 | C6 rate from manual headcount; band never auto-computed | unit | `pnpm --filter @contractor-ops/api test -- saudization-derivation` | ⬜ pending |
| 79-04-02 | 79-04 | 2 | GULF-07/D-12 | C7 trajectory ephemeral, advisory, non-gating | unit | `pnpm --filter @contractor-ops/api test -- saudization-derivation` | ⬜ pending |
| 79-03-03 | 79-03 | 2 | GULF-11 | C8 no cross-region leakage | schema-lint | `pnpm --filter @contractor-ops/db db:lint:region-leakage` | ⬜ pending |
| 79-05-01 | 79-05 | 3 | GULF-10 | C9 drift override audit-logged + custom badge | integration | `pnpm --filter @contractor-ops/api test -- gulf-override-audit` | ⬜ pending |
| 79-08-02 | 79-08 | 5 | GULF-08/09/D-13..16 | C10 RTL guard + locked-phrase + 4-locale parity | lint | `pnpm check:rtl-logical-props && pnpm i18n:parity && pnpm --filter @contractor-ops/validators test -- locked-phrases-guard` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Region-aware test fixtures (EU + ME org) in the existing seed/test harness — required for C3/C8.
- [ ] Confirm or build the `ml-`/`mr-` logical-property guard (RESEARCH: not locatable; web-vite uses Biome) before C10 can be asserted.

*Otherwise existing vitest + seed-dev infrastructure covers phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arabic statutory copy correctness (authority names, Nitaqat labels, Qiwa status) | GULF-09 | PENDING legal-entity review (UAE/KSA legal) — DEFERRED per Standing Constraints | Record in 80-LEGAL-SIGNOFF.md; do not hard-block |
| Real de/pl translation quality of Gulf keys | GULF-08, D-16 | i18n:parity checks key existence only, not translation quality | Native-speaker review post-deploy |
| Nitaqat band thresholds vs live Qiwa portal | GULF-05/10 | External regulatory data; band is manual-entry | Adviser verification post-deploy |

---

## Validation Sign-Off

- [ ] All tasks touching C1–C10 have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers region fixtures + ml-/mr- guard confirmation
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner maps every C# to a test task)

**Approval:** pending
