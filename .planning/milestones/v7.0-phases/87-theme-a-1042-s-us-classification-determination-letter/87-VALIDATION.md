---
phase: 87
slug: theme-a-1042-s-us-classification-determination-letter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 87 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo-orchestrated) |
| **Config file** | per-package `vitest.config.ts` (`packages/classification`, `packages/api`, `packages/iris`, `packages/db`) |
| **Quick run command** | `pnpm --filter @contractor-ops/<pkg> test -- <path>` (scope to changed file — never the full web-vite suite) |
| **Full suite command** | `pnpm test --filter @contractor-ops/classification --filter @contractor-ops/api --filter @contractor-ops/db` |
| **Estimated runtime** | ~30–90s scoped |

> 1042-S IRIS XSD validation runs in CI (mirrors the P86 `packages/iris` validator-bundle) once the Pub 1187 XSD is bundled (human checkpoint).

---

## Sampling Rate

- **After every task commit:** scoped quick command for the touched package/file.
- **After every plan wave:** full suite for the packages the wave touched.
- **Before `/gsd:verify-work`:** classification + api + db suites green; 1042-S IRIS golden-file XSD validation green in CI (after the XSD bundle lands).
- **Max feedback latency:** ~90 seconds (scoped).

---

## Per-Task Verification Map

> Planner fills this from PLAN.md task IDs. Anchor rows (derived from RESEARCH.md Validation Architecture):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 87-0X-XX | 0X | 0 | US-FORM-06/CLASS-01..04 | — | Wave-0 RED scaffolds | unit | scoped | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-CLASS-01 | — | US ClassificationProfile registered; federal base + CA AB5 overlay + §530 flag scored | unit | `pnpm --filter @contractor-ops/classification test -- profiles/us` | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-CLASS-02 | — | AB5 auto-flag on engagement work-state=CA (contractor-state fallback); audit-logged override | unit | scoped | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-CLASS-04 | — | Determination Letter PDF renders deterministically from frozen snapshot (mirror SDS); advisory footer present | unit | `pnpm --filter @contractor-ops/api test -- us-determination-letter` | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-FORM-06 | — | Form1042S box-2 withholding snapshot from applyTreaty (§875(d): treaty rate if W-8 chain complete, else 30%) | unit | `pnpm --filter @contractor-ops/api test -- form-1042-s.service` | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-FORM-06 | — | 1042-S recipient PDF render/archive (mirror Copy-B); FTIN/TIN last-4 only | unit | scoped | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-FORM-06 | — | 1042-S routes through P86 TaxFilingTransmitter + ack parser (CROSS-PHASE: requires P86 seam GREEN) | unit | scoped | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-CLASS-03 | — | 1099-K tracker band transition at $20,000 + 200 (tax-year-keyed config); informational, never files | unit | scoped | ❌ W0 | ⬜ pending |
| 87-0X-XX | 0X | N | US-FORM-06 | — | Form1042S immutable + CORRECTED supersede in $transaction (filed row never mutated) | integration | scoped | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] RED scaffolds for the US ClassificationProfile (federal/CA-ABC/§530 scoring), AB5 work-state trigger, Determination-Letter render, Form1042S service (treaty-rate snapshot), 1042-S recipient PDF, 1099-K tracker band logic, and the CORRECTED-supersede transaction.
- [ ] 1042-S IRIS XSD bundle fixture (Pub 1187) — **human IRS-SOR download checkpoint** + checksum pin (mirror the P86 packages/iris bundle pattern).
- [ ] Cross-phase note: 1042-S transmit reuse asserts against the P86 `TaxFilingTransmitter`/ack-parser/`buildIrisXml` — those must be GREEN (P86 Wave 2+) before the 1042-S transmit task can pass.
- [ ] Existing vitest infrastructure covers the rest — no new framework install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 1042-S IRIS XSD bundle (Pub 1187) | US-FORM-06 | Separate IRS-SOR schema package, login-gated | Human downloads Pub 1187 1042-S XSD, places in packages/iris bundle, pins checksums (mirror P86) |
| US classification legal criteria correctness | US-CLASS-01/02 | Jurisdiction-sensitive; DOL economic-reality rule in flux | Adviser-verify annotation on the rule-set criteria; not a code gate |
| 1042-S treaty-rate figures | US-FORM-06 | Local-only / legal-deferred | Adviser-verify annotation |
| Live 1042-S IRIS A2A transmit | US-FORM-06 | Reuses P86 dark `module.iris-efile` + TCC | Verified post-enrollment alongside P86 A2A |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (1042-S XSD fixture, classification rule-set scaffolds, cross-phase P86 seam note)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
