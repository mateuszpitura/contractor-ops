---
status: partial
phase: 63-uk-payments-financial-features
source: [63-VERIFICATION.md]
started: 2026-04-26T00:15:00Z
updated: 2026-04-26T00:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Plan 07 Task 3 manual UI checklist (9 sub-steps)

expected: Sequentially exercise — (1) /settings/payments/ BACS submitter admin gate; (2) PaymentRun GBP BACS preview + warnings + .txt download; (3) GB B2B invoice late-interest card ACCRUING state, claim dialog, waive dialog (10-char min reason), claim letter PDF; (4) dashboard "Overdue receivables (UK)" tile for GB org; (5) DE invoice Skonto section with cascade preview + German locked phrase; (6) DE invoice Skonto banner eligibility state; (7) PaymentRun DE Skonto checkboxes within discount window; (8) /admin/boe-rate/ table + dialogs + poller status strip + non-super-admin 403; (9) toggle all 3 payments.* feature flags off and verify clean disappearance of all surfaces.
why_human: Visual rendering, dialog flows, PDF inspection, multi-tenant role gating, R2 signed-URL behaviour, and feature-flag-toggle UX cannot be reliably grep-verified. By design per Plan 07 Task 3 — Nyquist-compliant since this is the only manual checkpoint in the phase.
result: [pending]

### 2. BACS export end-to-end byte-level inspection on a GBP PaymentRun

expected: After enabling `payments.bacs-enabled`: configure BACS submitter (SUN, sort code, account number, name); open a LOCKED PaymentRun with GBP items; preview BACS Std 18 file and verify VOL/HDR/UHL/detail/EOF/UTL records, 106-character detail records, transliteration warnings appear for European names, modulus check warnings appear for known-flagged sort codes, download produces a .txt file with CR/LF endings; download blocked when unmappable Unicode chars present (CR-01: `replaced.length > 0` check at server `bacs.ts:366` + client `bacs-preview-card.tsx:118`); EUR runs rejected at router boundary with PRECONDITION_FAILED (CR-02 currency precondition).
why_human: File-format byte-level inspection + UI interaction flow + R2 signed-URL behaviour can only be exercised against a running server with seeded data.
result: [pending]

### 3. Sort-code modulus validation on the contractor billing profile UK section (WR-07 race-condition probe)

expected: Open a GB contractor's billing profile, scroll to UK Bank Fields, enter `089999` / `66374958` (a known building-society edge case from VocaLink V8.40); validate sort code; verify pill is correctly tinted (VALID/WARN/INVALID) and shows the right reason; rapid-click the validate button 5+ times and verify only the most recent response wins (WR-07 request-id ratchet).
why_human: Visual pill tinting + rapid-click race exposure cannot be reliably grep-verified.
result: [pending]

### 4. BoE rate poller cron route handshake (auth gate + flag short-circuit + manual-edit preservation)

expected: Send `GET /api/cron/boe-rate-poll` without Authorization → 401; with bogus bearer → 401; with `CRON_SECRET` bearer and `payments.late-interest-enabled` flag OFF → `200 { skipped: true }`; with flag ON → invokes `pollBoeBaseRate()`; verify a fresh `BoEBaseRateHistory` row is created only when the BoE-published `effectiveFrom` is new (WR-02 fix); verify a manual admin-entered row for the same `effectiveFrom` is preserved (WR-03 fix — poller line 359 uses `findUnique`-then-`create`-only pattern).
why_human: Cron secret + flag toggle + DB inspection sequence requires runtime.
result: [pending]

### 5. Late payment interest card on a GB B2B GBP overdue invoice (claim PDF + waiver flow)

expected: Navigate to a GB B2B overdue GBP invoice detail page; verify the card shows the ACCRUING state with — principal outstanding, days overdue, BoE rate from the statutory reference date + 8%, daily accrual, fixed compensation tier (£40 / £70 / £100), total claim. Test "Claim statutory interest" → opens dialog → confirm creates `InvoiceInterestClaim` row + claim PDF in R2 (PDF includes `LPCDA_CLAIM_FOOTER` + `LPCDA_SECTION_REF` locked phrases). Test "Waive interest" → AlertDialog → reason min 10 chars → creates `InvoiceInterestWaiver`.
why_human: Card render + dialog interaction + R2 PDF byte-level inspection requires seeded data + running server.
result: [pending]

### 6. Skonto banner + XRechnung BG-20 round-trip on a DE invoice (canonical-schema runtime check)

expected: Configure a DE invoice with Skonto term (3% / 7 days / net 30); verify the eligibility banner shows ELIGIBLE within the discount window with `discountAmountMinor = floor(totalMinor × 0.03)`; generate XRechnung via the existing einvoice flow; inspect the CII XML and confirm BG-20 `ram:Description` contains `#SKONTO#TAGE=7#PROZENT=3.00#BASISBETRAG={total}#`.
why_human: Visual banner state + KoSIT-validator pass against generated XML can only be exercised against the running einvoice generator with seeded DE invoice data. Canonical schema relations (`skontoTerms[0]`, `billingProfiles[0]`) now compile and pass tests, but the runtime round-trip needs human confirmation.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
