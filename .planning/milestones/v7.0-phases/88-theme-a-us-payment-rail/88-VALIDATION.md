---
phase: 88
slug: theme-a-us-payment-rail
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 88 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo-orchestrated) |
| **Config file** | per-package `vitest.config.ts` (`packages/api`, `packages/integrations`, `packages/db`) |
| **Quick run command** | `pnpm --filter @contractor-ops/<pkg> test -- <path>` (scoped to changed file) |
| **Full suite command** | `pnpm test --filter @contractor-ops/api --filter @contractor-ops/integrations --filter @contractor-ops/db` |
| **Estimated runtime** | ~30–90s scoped |

> The NACHA generator is validated by golden-file fixed-width assertions (mirror the BACS generator tests); the Saudi WHT path MUST stay regression-green when the withholding path is generalized.

---

## Sampling Rate

- **After every task commit:** scoped quick command for the touched package/file.
- **After every plan wave:** full suite for the packages the wave touched + the existing Saudi WHT regression test.
- **Before `/gsd:verify-work`:** api + integrations + db suites green; NACHA golden-file + Fedwire pacs.008 + SA-WHT-regression green.
- **Max feedback latency:** ~90 seconds (scoped).

---

## Per-Task Verification Map

> Planner fills from PLAN.md task IDs. Anchor rows (from RESEARCH Validation Architecture):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------|--------|
| 88-0X-XX | 0X | 0 | US-PAY-01..05 | — | Wave-0 RED scaffolds | unit | scoped | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | (deferred 86/87) | — | gross→net deduction at item seeding: amountMinor = gross − wht (24% backup-WH OR treaty rate) | unit | `pnpm --filter @contractor-ops/api test -- payment-wht` | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | (regression) | — | Saudi WHT path unchanged after generalization (regression-green) | unit | scoped | ✅ existing | ⬜ pending |
| 88-0X-XX | 0X | N | US-PAY-01 | — | NACHA file: balanced, control totals, entry hash, 94-char records (golden-file) | unit | `pnpm --filter @contractor-ops/api test -- ach-nacha` | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | US-PAY-04 | — | Fedwire pacs.008 XML validates (mirror SWIFT generator); routing threshold from config not constant | unit | scoped | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | US-PAY-02 | — | USD first-class + cross-border settlement choice; FX path handles USD source/target | unit | `pnpm --filter @contractor-ops/api test -- payment-currency` | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | US-PAY-03 | — | Modern Treasury PayoutInitiationAdapter mock: create/status; live client refuses while flag-dark | unit | `pnpm --filter @contractor-ops/integrations test -- modern-treasury` | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | US-PAY-05 | — | Plaid Identity mock: advisory status (VERIFIED/PENDING/FAILED); unverified payout WARNS, never blocks | unit | `pnpm --filter @contractor-ops/integrations test -- plaid-identity` | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | (D-03) | — | Contractor.backupWithholdingFlagged set by the wired P86 tin-match writer | unit | scoped | ❌ W0 | ⬜ pending |
| 88-0X-XX | 0X | N | US-PAY-01/04 | — | detectFormat routes USD + US bank + US region → ACH_NACHA; high-value → FEDWIRE | unit | scoped | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] RED scaffolds for: the generalized withholding deduction (+ a SA-WHT regression guard), the NACHA generator (golden-file), the Fedwire pacs.008 generator, USD/settlement FX, the Modern Treasury + Plaid mock adapters, the `Contractor.backupWithholdingFlagged` writer wiring, and the `detectFormat` US routing.
- [ ] No external NACHA dependency installed (hand-rolled per RESEARCH); GA floor needs zero new deps. Any [ASSUMED] external package gated behind a `checkpoint:human-verify` (slopcheck was offline).
- [ ] Existing vitest infrastructure covers the rest.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live ACH origination (Modern Treasury) | US-PAY-03 | Requires live provider creds | Mock exercises adapter logic; live behind `payments.ach-payouts` flag, verified post-creds |
| Live Plaid Identity verification | US-PAY-05 | Requires live Plaid creds | Mock exercises advisory flow; live behind flag |
| Fedwire bank-channel submission | US-PAY-04 | Fedwire is a FedLine/bank message, not self-serve | pacs.008 XML generated + validated; operator hands to bank (adviser-verify) |
| Any [ASSUMED] external package install | US-PAY-03/05 | slopcheck offline at research time | Human-verify checkpoint per package (name, source repo, release age, typosquat) before install |
| Withholding figures | deferred 86/87 | local-only / legal-deferred | Adviser-verify annotation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (NACHA golden-file, mock adapters, SA-WHT regression guard)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
