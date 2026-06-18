# Phase 88: Theme A — US Payment Rail - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md; this preserves the alternatives.

**Date:** 2026-06-18
**Phase:** 88-theme-a-us-payment-rail
**Areas discussed:** Withholding deduction integration, Programmatic ACH provider, USD first-class + settlement currency, Plaid verification gating

---

## Withholding Deduction Integration (deferred from 86/87)

### Where gross→net computes
| Option | Selected |
|--------|----------|
| At payment-run item seeding (generalize the Saudi WHT path) | ✓ |
| At export-file generation time | |
| Separate withholding ledger | |

### Source of truth for amount withheld
| Option | Selected |
|--------|----------|
| Payment run authoritative; forms report it | ✓ |
| Forms compute independently; payment must match | |

### Backup-withholding flag persistence
| Option | Selected |
|--------|----------|
| Add Contractor.backupWithholdingFlagged column + wire P86 writer | ✓ |
| Keep reading from TaxFormSubmission.snapshotJson | |

**Choice:** Deduct at item seeding (one withholding path, reuse existing PaymentRunItem fields); payment run is the authoritative withheld figure the 1099 box-4 / 1042-S box-2 report; add the dedicated Contractor column + wire the P86 tin-match writer.
**Notes:** Closes the P86 unwired writer port. Implies a small P86/P87 follow-up so forms read aggregated payment withholding (D-02).

---

## Programmatic ACH Provider (US-PAY-03)

| Option | Selected |
|--------|----------|
| Modern Treasury (seam + mock, Stripe stub) | ✓ |
| Stripe Treasury (seam + mock, MT stub) | |
| Seam only, no concrete this phase | |

**Choice:** PayoutInitiationAdapter seam; Modern Treasury first concrete (mock-behind-seam, flag-dark), Stripe stub. NACHA file export is the always-available default; programmatic is opt-in per-org.
**Notes:** Modern Treasury is the purpose-built ACH-origination fit. Mirrors the 86 IRIS manual-default / dark-A2A posture.

---

## USD First-Class + Settlement Currency (US-PAY-02)

| Option | Selected |
|--------|----------|
| Per-payout settlement choice, default contractor currency, USD=1.0 short-circuit | ✓ |
| USD-only payouts | |
| Always convert to contractor local currency | |

**Choice:** USD first-class (per-org default); per-payout settle-in-USD-vs-convert choice defaulting to contractor.currency; payment-date ECB rate + USD=1.0 short-circuit (USD isn't in the ECB table).
**Notes:** Reuses exchange-rate.ts + convertAmount (consistent with P86 box-1 conversion).

---

## Plaid Verification Gating (US-PAY-05)

| Option | Selected |
|--------|----------|
| Advisory (record status, warn, allow) — fail-open | ✓ |
| Hard-block unverified payouts | |

**Choice:** Advisory fail-open — record VERIFIED/PENDING/FAILED on the billing profile, warn on unverified US payouts, don't block. Plaid adapter mock-behind-seam until live creds.
**Notes:** Mirrors P84 USPS fail-open; a mocked verification must not brick GA payouts. Hard-gating deferred to live Plaid creds.

---

## Claude's Discretion

- NACHA entry types (PPD/CCD/CTX) + balanced-file + effective-entry-date + return-code (R01/R02/R03) handling/retry.
- Fedwire format + high-value routing threshold (Same-Day ACH $1M until 2027-09-17).
- US bank fields (routing/account) on ContractorBillingProfile vs dedicated model (extend encrypted-field pattern).
- Withholding rounding (single HALF-UP; reuse money-rounding pattern) + the reconciliation aggregation shape forms read.
- Settlement-currency surfaced per-run vs per-org-default-with-override.
- Modern Treasury / Stripe / Plaid adapter interface signatures + credential blobs.

## Deferred Ideas

- Live programmatic ACH (Modern Treasury / Stripe) — mock-behind-seam, flag-dark until creds.
- Live Plaid + hard-gating — advisory/mock now.
- P86/P87 form↔payment reconciliation wiring (D-02 follow-up).
- Non-US programmatic rails / additional providers.
- Worker-type FK — store against Contractor now; re-point after Theme B (P89).
