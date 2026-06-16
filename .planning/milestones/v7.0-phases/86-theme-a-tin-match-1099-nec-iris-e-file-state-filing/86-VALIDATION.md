---
phase: 86
slug: theme-a-tin-match-1099-nec-iris-e-file-state-filing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 86 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo-orchestrated) |
| **Config file** | per-package `vitest.config.ts` (e.g. `packages/api`, `packages/einvoice`, `packages/db`) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- <path>` (scope to changed file — never the full web-vite suite, see CLAUDE.md) |
| **Full suite command** | `pnpm test --filter @contractor-ops/api --filter @contractor-ops/einvoice --filter @contractor-ops/db` |
| **Estimated runtime** | ~30–90s scoped; full API suite minutes |

> XSD validation runs in CI (mirrors `packages/einvoice` validator-bundle) — the IRIS XML builder's golden-file + XSD-validate test is part of the quick run.

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched package/file.
- **After every plan wave:** Run the full suite for the packages the wave touched.
- **Before `/gsd:verify-work`:** Full API + einvoice + db suites green; IRIS golden-file XSD validation green in CI.
- **Max feedback latency:** ~90 seconds (scoped).

---

## Per-Task Verification Map

> Planner fills this from PLAN.md task IDs. Anchor rows (derived from RESEARCH.md Validation Architecture):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 86-0X-XX | 0X | 0 | US-FORM-03/04/05/07 | — | Wave-0 RED scaffolds | unit | `pnpm --filter @contractor-ops/api test -- <stub>` | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-04 | — | threshold table: TY2025 $600 / TY2026 $2,000 keyed lookup | unit | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-04 | — | aggregation by payment date, USD-converted, per recipient/payer-org | unit | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-05 | — | IRIS XML builds + XSD-validates against bundled schema (golden file) | unit | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-05 | — | ack parser maps all statuses (Accepted/Rejected/Processing/Partially Accepted/Accepted with Errors/Not Found) + error group | unit | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-03 | — | TIN mismatch → backup-withholding flag set + escalation, never hard-block | unit | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-03 | — | TinMatchClient mock: 24h cache hit + retry on transient | unit | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-07 | — | CFSF state code emitted in IRIS record for participating states; non-CFSF → per-state file | unit | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-FORM-04 | — | CORRECTED = new immutable row supersedes; original never mutated | integration | scoped | ❌ W0 | ⬜ pending |
| 86-0X-XX | 0X | N | US-INFRA-03 | — | Form1099Nec registered in MODEL_RETENTION_TYPE → 4yr cutoff blocks early hard-delete | unit | scoped | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] RED test scaffolds for the threshold table, aggregation engine, IRIS XML builder + XSD validation, ack parser, TinMatchClient mock, CFSF/state routing, CORRECTED supersede, and retention registration (per the anchor rows above).
- [ ] IRIS XSD bundle fixture + a golden-file 1099-NEC payload (mirrors `packages/einvoice` validator-bundle test setup).
- [ ] Existing vitest infrastructure covers the rest — no new framework install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IRIS portal manual upload of the validated XML (default transmit path) | US-FORM-05 | No live TCC on the GA path; the portal is an external IRS surface | Build a batch, download the XSD-valid XML, confirm it conforms to the IRIS schema package; live upload is an operator step, documented in the ops doc |
| Live A2A SOAP/MTOM transmit + ack-poll (`module.iris-efile` dark) | US-FORM-05 | Requires live IRS TCC + ATS communication test | Re-verify against Pub 5718 + downloaded XSD at the execution-time enrollment milestone (off GA critical path) |
| Live IRS e-Services TIN-Matching | US-FORM-03 | Requires PAF + e-Services registration | Mock exercises all logic; live client behind flag, verified post-enrollment |
| Treaty/threshold/withholding figure correctness | US-FORM-04/05 | Local-only / legal-deferred posture | Adviser-verify annotation; not a code gate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (IRIS XSD fixture, ack-status corpus, TIN-match mock)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
