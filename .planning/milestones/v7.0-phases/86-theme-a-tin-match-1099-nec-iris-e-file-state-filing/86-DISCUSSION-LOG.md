# Phase 86: Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
**Areas discussed:** IRIS transmission posture, 1099-NEC generation, TIN-Matching posture, Per-state filing (CFSF)

---

## IRIS Transmission Posture

### Default transmit path (given TCC ~45-day enrollment + local-only)
| Option | Description | Selected |
|--------|-------------|----------|
| Manual-upload default, A2A dark behind flag | Download XSD-validated XML for manual portal upload; A2A built but flag-gated dark until TCC approved | ✓ |
| A2A live as primary | Build SOAP/MTOM A2A as main path, manual as fallback | |
| Manual-upload only this phase | Generate + validate + parse manual ack; defer ALL A2A code | |

### Acknowledgement handling (manual path)
| Option | Description | Selected |
|--------|-------------|----------|
| Upload IRS ack file → reuse the same parser | One parser exercised in both paths; structured rejection details | ✓ |
| Manual status toggle + audit | Admin sets status manually; ack parser only on dark A2A path | |

**User's choice:** Manual-upload default with A2A dark behind `iris-a2a-transmit` flag; upload-ack-file → same parser.
**Notes:** Transmitter seam `ManualDownload | IrisA2A | Vendor(stub)`; FIRE doc-only. Keeps GA off the IRS-enrollment critical path while still building the deterministic core (XML gen, XSD-in-CI, ack parser).

---

## 1099-NEC Generation

### Batch trigger
| Option | Description | Selected |
|--------|-------------|----------|
| On-demand admin batch + year-end reminder cron | Admin generates/reviews/files; cron only notifies, never auto-files | ✓ |
| Fully automated year-end cron | Cron auto-generates (+ optionally auto-transmits) | |
| On-demand only | No scheduled reminder | |

### Threshold aggregation basis ($2,000 TY2026, box-1)
| Option | Description | Selected |
|--------|-------------|----------|
| Payments settled in tax year, USD at payment date | Cash-basis, FX-converted at payment date, per recipient/payer-org | ✓ |
| Invoices paid (by invoice date) | Aggregate by invoice issue date | |
| USD-only payments | Skip foreign-currency conversion | |

### Recipient Copy-B PDF delivery
| Option | Description | Selected |
|--------|-------------|----------|
| Portal download gated on IRS e-delivery consent | Affirmative consent before e-furnish; no consent → paper/manual; archive either way | ✓ |
| Portal download, no consent gate | Skip the IRS affirmative-consent rule | |
| Staff-download only | No contractor-facing surface this phase | |

### PDF scope (deferred W-9/W-8BEN PDFs from P85 D-06)
| Option | Description | Selected |
|--------|-------------|----------|
| No — keep 86 to the 1099-NEC PDF only | W-9/W-8BEN official PDFs land in Phase 87 | ✓ |
| Yes — build W-9/W-8BEN PDFs here too | Knock out intake-form PDFs now | |

**User's choice:** Admin-triggered batch + notify-only cron; aggregate by payment date USD-converted; Copy-B gated on e-delivery consent; W-form PDFs stay deferred to P87.
**Notes:** Threshold from a tax-year-keyed config table (not a constant). CORRECTED = supersede. Box-4 populated on W-9 flag / C-notice; actual withholding is P88.

---

## TIN-Matching Posture

### Timing
| Option | Description | Selected |
|--------|-------------|----------|
| At W-9 intake + revalidate at year-end batch | Earliest signal + pre-filing re-check; 24h cache makes re-checks cheap | ✓ |
| Year-end pre-generation only | Match only at batch build | |
| At payment time | Match before each payout | |

### No-live-credentials handling (e-Services PAF, separate from IRIS TCC)
| Option | Description | Selected |
|--------|-------------|----------|
| Mock client behind adapter seam, logic shipped, live flag-gated | Cache/retry/escalation built against `TinMatchClient`; live behind flag until PAF clears | ✓ |
| Build live e-Services client as primary | Real client now; can't exercise without PAF creds | |

### Mismatch consequence (SC#1: escalate, never hard-block)
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-set backup-withholding flag + escalate | Flag recorded now (24% enforced P88) + admin escalation; 1099 still generates | ✓ |
| Escalate only | Backup-withholding left as a manual admin decision | |

**User's choice:** Intake + year-end revalidation; mock `TinMatchClient` behind seam, live flag-gated; mismatch auto-flags backup-withholding + escalates.
**Notes:** Consistent adapter-seam + mock + flag-gated-live posture with IRIS transmit. B-notice logic closes the loop end-to-end into P88.

---

## Per-State Filing (CFSF)

### Depth
| Option | Description | Selected |
|--------|-------------|----------|
| CFSF indicator + config table + downloadable file for non-CFSF states | IRS auto-forward for participating states; per-state config + direct file for non-CFSF | ✓ |
| CFSF indicator only, flag the rest for manual | Half-meets US-FORM-07 | |
| Full per-state direct e-filing for all states | 50 portals + per-state credentials | |

### Non-CFSF output format
| Option | Description | Selected |
|--------|-------------|----------|
| Per-state data file (CSV/summary) + manual-portal guidance | State-scoped file + manual steps; no per-state e-file credentials | ✓ |
| Bespoke per-state e-file format builders | Per-state spec work + credentials | |

**User's choice:** CFSF auto-forward code in IRIS B-records + per-state config table; non-CFSF → downloadable per-state data file + manual-portal guidance.
**Notes:** CFSF carries participating states; only ~7 non-CFSF states need a separate (manual) output. Proportionate for local-only GA.

---

## Claude's Discretion

- Exact Prisma model/column shapes (`Form1099Nec` + supersede, IRIS submission/ack record, tax-year threshold table, per-state CFSF table).
- `TaxFilingTransmitter` / `TinMatchClient` interface signatures + seam location.
- IRIS XML builder mechanics + which IRS XSDs to bundle + CI XSD-validation wiring (mirror `packages/einvoice`).
- FX-rate source for payment-date USD conversion.
- 1099-NEC Copy-B PDF layout + e-delivery-consent storage shape.
- Specific non-CFSF state set + CFSF participation seed data.
- TIN-match interactive (≤25) vs bulk (≤100k) modeling now vs at live-client phase.

## Deferred Ideas

- Live IRIS A2A transmit (built, dark behind `iris-a2a-transmit` until TCC approved).
- Live IRS e-Services TIN-Matching client (mock now; live behind flag once PAF clears).
- Vendor transmitter (Sovos / 1099Pro) — stub seam only.
- Actual 24% backup-withholding payout reduction → Phase 88.
- Official W-9 / W-8BEN / W-8BEN-E intake PDFs → Phase 87.
- Bespoke per-state direct e-file integrations → per-state, when a customer needs it.
- FIRE system code → documentation-only legacy fallback.
- 1042-S, US classification, Determination Letter, 1099-K tracker → Phase 87.
