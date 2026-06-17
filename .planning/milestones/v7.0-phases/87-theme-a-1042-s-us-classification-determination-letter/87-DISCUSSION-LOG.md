# Phase 87: Theme A — 1042-S + US Classification + Determination Letter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 87-theme-a-1042-s-us-classification-determination-letter
**Areas discussed:** Determination Letter (template vs AI), US classification rule set, 1042-S filing + withholding, 1099-K tracker

---

## Determination Letter (US-CLASS-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic React-PDF template (mirror UK SDS) | Render from frozen snapshot; no LLM; advisory footer; no ai-integration-phase | ✓ |
| AI-generated narrative | LLM-drafted rationale prose; first LLM-gen surface; verdict-liability; needs ai-integration-phase | |
| Hybrid: deterministic + flag-gated AI summary | Deterministic record + optional AI summary behind a flag | |

**User's choice:** Deterministic React-PDF template mirroring the UK SDS.
**Notes:** Keeps Phase 87 off the AI-integration path (resolves the ROADMAP research flag) and preserves the no-LLM-generation, advisory-not-verdict posture. An LLM asserting a classification is exactly the liability the product avoids.

---

## US Classification Rule Set (US-CLASS-01 / US-CLASS-02)

### Test composition
| Option | Description | Selected |
|--------|-------------|----------|
| Federal base + CA AB5 stricter overlay + §530 flagger | One US profile combining all three in a scored assessment | ✓ |
| Three separate selectable assessments | Federal / CA-ABC / §530 as distinct types | |
| Federal only now, CA/§530 later | Defers AB5 + §530 | |

### AB5 watchlist trigger
| Option | Description | Selected |
|--------|-------------|----------|
| Engagement work-state (CA) + contractor-state fallback | Work-state primary (work performed in CA), residence fallback | ✓ |
| Contractor US state only (P84) | Residence-based; misses CA-performed work by out-of-state contractor | |
| Manual flag only | Doesn't meet "auto-flag" | |

**User's choice:** Single US `ClassificationProfile` (federal base + CA AB5 overlay + §530 flagger); AB5 auto-flags on engagement work-state with contractor-state fallback.
**Notes:** Plugs into the existing `registerProfile` registry (no engine fork). Advisory posture inherited from `SOFTWARE_NOT_LEGAL_ADVICE_EN`; override audit-logged.

---

## 1042-S Filing + Withholding (US-FORM-06)

### Withholding posture
| Option | Description | Selected |
|--------|-------------|----------|
| Reported-only (rate from P85 table; deduction = P88) | Snapshot treaty article+rate (§875(d) gating, else 30%) in box 2; no payout mutation | ✓ |
| Apply withholding to payouts now | Pulls P88 deduction scope forward | |

### Recipient PDF e-furnishing
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse P86 consent gate, paper/manual fallback | Same e-delivery consent; no-consent → paper for foreign recipients | ✓ |
| Staff-download only for 1042-S | No recipient self-serve | |

**User's choice:** Reported-only (treaty rate from P85 table, §875(d) gating, deduction in P88); recipient PDF reuses the P86 consent gate with paper/manual fallback.
**Notes:** New `Form1042S` model (immutable+supersede); reuses the P86 IRIS transmitter seam + ack parser + manual-upload default. Consistent with the 1099-NEC box-4 reported-only precedent; no payout-deduction logic exists yet.

---

## 1099-K Tracker (US-CLASS-03)

### Implementation
| Option | Description | Selected |
|--------|-------------|----------|
| Cron-tracked band state (mirror EconomicDependencyAlertState) | New Form1099KTrackerState; cron band transitions + proactive notification | ✓ |
| Compute-on-read profile badge | On-load aggregation; no model/cron | |

### Threshold source
| Option | Description | Selected |
|--------|-------------|----------|
| Tax-year-keyed config (house pattern) | $20,000 + 200 as data, mirror Tax1099Threshold | ✓ |
| Constant for now | Hardcoded; repeats stale-threshold trap | |

**User's choice:** Cron-tracked band state mirroring `EconomicDependencyAlertState`; tax-year-keyed `$20,000 + 200` config.
**Notes:** Informational only — the platform never files 1099-K. OBBBA-reverted threshold ($20k+200, not the stale $5K/$600).

---

## Claude's Discretion

- `Form1042S` / `US_DETERMINATION_LETTER` / `Form1099KTrackerState` model shapes (tenant-owning, not in globalModels; cross-org leak test).
- US `ClassificationProfile` question set + scoring weights (federal economic-realities, CA ABC prongs, §530 criteria); rule-set version frozen on submit.
- Whether 1042-S parameterizes the P86 IRIS XML builder vs a sibling builder.
- 1099-K band thresholds/cadence + the profile badge component.
- Determination-Letter layout (mirror ir35-sds.tsx).
- 1042-S vs 1099-NEC routing from the contractor's W-8/W-9 on file.

## Deferred Ideas

- AI-generated Determination-Letter narrative (deterministic ships now; flag-gated AI summary later via ai-integration-phase if needed).
- Actual 1042-S/treaty/backup-withholding payout deduction → Phase 88.
- Live IRIS A2A transmit for 1042-S → reuses P86 dark `module.iris-efile`.
- 1099-K filing → out of scope permanently (settlor's return).
- US state classification tests beyond CA AB5 → when a customer needs them.
