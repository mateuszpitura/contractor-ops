---
title: US tax year-end filing (TIN-match → 1099-NEC → IRIS e-file → state filing)
type: domain
tags: [us, tax, 1099-nec, iris, tin-match, e-file, state-filing, immutable-record, flag-dark]
source_commit: 18d6df46b
verify_with:
  - packages/iris/src/generator.ts
  - packages/iris/src/validator.ts
  - packages/api/src/services/iris-ack-parser.ts
  - packages/api/src/services/tax-filing-transmitter.ts
  - packages/api/src/services/state-filing-output.ts
  - packages/api/src/services/form-1099-nec.service.ts
  - packages/api/src/services/form-1099-nec-pdf.ts
  - packages/api/src/services/tin-match.service.ts
  - packages/api/src/services/year-end-1099-reminder.service.ts
  - packages/api/src/routers/finance/tax-1099-router.ts
  - packages/api/src/routers/portal/portal-tax-1099-router.ts
  - apps/cron-worker/src/jobs/handlers/year-end-1099-reminder.ts
  - apps/web-vite/src/components/contractors/tax-filing/
  - apps/web-vite/src/components/portal/tax-forms/copy-b-download.tsx
  - apps/web-vite/src/components/portal/tax-forms/step-edelivery-consent.tsx
---

# US tax year-end filing

## Purpose

The year-end US information-return loop that turns the [[domains/us-tax-forms]]
W-form data into filed 1099-NEC returns. It covers IRS name/TIN matching, box-1
aggregation + threshold gating, the immutable `Form1099Nec` record + Copy-B PDF,
IRIS XML generation + XSD validation, the manual-upload / dark-A2A transmit tail,
and per-state (CFSF / direct-filing) output. **Ships entirely dark** behind
`module.us-expansion` (+ `module.iris-efile` for automated A2A transmit).
Adviser-verify: every tax figure needs jurisdiction-specific tax-adviser sign-off
before production filing (local-only / legal-deferred posture).

## Flow

1. **TIN match** (`tin-match.service.ts`) — at W-9 intake + a year-end
   revalidation, the recipient name/TIN is matched via the IRS e-Services
   adapter seam (deterministic mock default; dark SSRF-safe live client). A
   mismatch sets the backup-withholding flag + raises an admin escalation +
   writes an audit row — **advisory only, never a hard block**; the 1099 still
   generates. 24h cache keyed on TIN-last4 (a full TIN never enters a cache key,
   log, or audit row).
2. **Aggregate + gate** (`form-1099-nec.service.ts`) — box-1 nonemployee comp is
   summed by payment (settlement) date per recipient per payer-org, FX-converted
   to USD at the payment-date rate, and gated by the **tax-year-keyed
   `Tax1099Threshold` table** ($600 TY2025 / $2,000 TY2026 OBBBA — never a
   constant). Box-4 records backup withholding. Idempotent batch + audit.
3. **Immutable record + Copy-B** — a `Form1099Nec` row is the record-of-record
   (last-4 TIN only in `snapshotJson`); the recipient Copy-B substitute PDF
   (Pub 1179 §4.6) renders from the snapshot and archives to R2 with a CAS guard.
   A CORRECTED 1099 **supersedes** (prior ACTIVE → SUPERSEDED, new ACTIVE
   inserted in one tx) — a filed row is never mutated.
4. **IRIS XML + validate** (`packages/iris`) — `buildIrisXml` (fast-xml-parser
   `XMLBuilder`, Transmission Manifest + payee B-record + CFSF state code) →
   `xsdValidate` (libxmljs2, `nonet:true` SSRF, default `noent:false` XXE, lazy
   bundle dir). The IRS IRIS XSD bundle is a human-only SOR download; until it
   lands, `xsdValidate` returns a non-throwing `BUNDLE_UNAVAILABLE` (validity
   unproven — nothing files).
5. **Transmit tail** (`tax-filing-transmitter.ts`) — factory: `ManualDownload`
   (default, no TCC — download the validated XML, upload to IRIS, upload the ack)
   | `IrisA2A` (dark behind `module.iris-efile`; SOAP/MTOM send is a documented
   seam) | `Vendor` (stub). One `iris-ack-parser.ts` maps all six IRIS statuses +
   the Error Information Group + OriginalReceiptId for **both** the manual-upload
   ack file and the A2A poll result.
6. **State filing** (`state-filing-output.ts`) — a CFSF-participating state rides
   the CFSF code in the B-record (IRS auto-forwards, no file); a non-CFSF /
   direct-filing state (e.g. Maryland) gets a per-state CSV + manual-portal
   guidance. No bespoke per-state e-file integration.

## Entry points

- **Staff:** `tax1099` router ([[structure/api-routers-catalog]]) — batch /
  build-validate / download / upload-ack / TIN-mismatch / correction / per-state.
- **Portal:** `portal-tax-1099-router.ts` — e-delivery consent + Copy-B download,
  scoped to `ctx.contractorId`.
- **Cron:** `year-end-1099-reminder` ([[structure/cron-jobs]]) — notify-only.
- **Integrations:** [[integrations/irs-iris]], [[integrations/irs-eservices-tin-matching]].

## UI surface

Staff `contractors/tax-filing/`: 1099-NEC batch panel (review-before-file), IRIS
filing card (6-status pill, ManualDownload, ack upload, correction dialog, state
output), TIN-mismatch list (**amber advisory, never red / never blocking**).
Portal `tax-forms/`: affirmative e-delivery consent step (real native checkbox,
affirm disabled until checked) gating the Copy-B download; no consent → paper-copy
message; TIN last-4 only. All dark behind `module.us-expansion`.

## Agent mistakes

- The 1099 threshold is a **tax-year-keyed `Tax1099Threshold` table**, not a
  constant ($600 vs $2,000 differ by year under OBBBA).
- A **TIN mismatch never hard-blocks** — it flags backup withholding + escalates;
  the 1099 still generates.
- The **year-end cron is notify-only** — it never generates a batch or transmits.
- CORRECTED = **supersede**, never mutate a filed `Form1099Nec` row.
- Render **Copy B only** — Copy A goes via the IRIS XML e-file, never a PDF.
- **Reuse `module.iris-efile`** for the dark A2A path — do not mint a new flag.
- A **missing IRS XSD bundle is the expected pre-enablement state** —
  `xsdValidate` returns `BUNDLE_UNAVAILABLE` (never throws); nothing files on it.
- Full TIN **never** in the DOM / PDF / IRIS payload / cache / audit — last-4 only.
