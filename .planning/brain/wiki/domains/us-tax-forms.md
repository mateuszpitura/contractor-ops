---
title: US tax forms (W-9 / W-8BEN / W-8BEN-E) and treaty engine
type: domain
tags: [us, tax, w-form, treaty, portal, esign, immutable-record]
source_commit: 5d6e26a17
source_commit: f9de62452
source_commit: 28061f01e
verify_with:
  - packages/db/prisma/schema/tax.prisma
  - packages/db/prisma/schema/migrations/20260705000000_us_tax_form_tables_plus_additive_integrity/
  - apps/web-vite/src/components/portal/tax-forms/
  - apps/web-vite/src/components/contractors/tax-forms/
  - apps/web-vite/src/components/contractors/tax-filing/
  - apps/web-vite/src/pages/dashboard/tax-filing.tsx
  - packages/api/src/services/form-1042s.service.ts
  - packages/api/src/services/form-1042s-transmit.service.ts
  - packages/api/src/services/form-1042s-pdf.ts
  - packages/api/src/pdf-templates/form-1042s-recipient-copy.tsx
  - packages/api/src/routers/finance/form-1042s-router.ts
  - packages/api/src/routers/portal/portal-tax-1099-router.ts
  - apps/web-vite/src/components/contractors/form-1099k-band.tsx
  - apps/web-vite/src/components/contractors/hooks/use-1099k-tracker.ts
  - apps/web-vite/src/components/contractors/classification/us-classification-result.tsx
  - apps/web-vite/src/components/contractors/classification/ab5-watchlist-flag.tsx
  - apps/web-vite/src/components/contractors/classification/classification-override-dialog.tsx
  - apps/web-vite/src/components/contractors/tax-filing/tax-1042s-filing-card.tsx
  - apps/web-vite/src/components/contractors/tax-filing/hooks/use-1042s-filing.ts
  - apps/web-vite/src/components/portal/tax-forms/copy-1042s-download.tsx
  - apps/web-vite/src/components/portal/tax-forms/hooks/use-edelivery-consent.ts
  - apps/web-vite/src/components/contractors/classification/hooks/use-us-classification.ts
  - apps/web-vite/src/components/contractors/classification-documents/generate-determination-letter-button.tsx
  - packages/api/src/routers/portal/portal-tax-form-router.ts
  - packages/api/src/routers/core/tax-form-router.ts
  - packages/api/src/services/form-1099k-tracker.service.ts
  - packages/api/src/routers/finance/form-1099k-tracker-router.ts
  - packages/api/src/routers/compliance/classification-override.ts
  - apps/cron-worker/src/jobs/handlers/form-1099k-tracker.ts
  - packages/api/src/services/tax-form.service.ts
  - packages/api/src/services/treaty-rate.service.ts
  - packages/api/src/services/tax-form-routing.ts
  - packages/api/src/services/tin-match.service.ts
  - packages/api/src/services/form-1099-nec.service.ts
  - packages/api/src/services/form-1099-nec-pdf.ts
  - packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx
  - packages/integrations/src/adapters/tin-match/
  - packages/validators/src/w-form-validators.ts
  - packages/iris/src/generator.ts
  - packages/iris/src/validator.ts
updated: 2026-07-05
---

# US tax forms (W-9 / W-8BEN / W-8BEN-E) and treaty engine

## Purpose

Capture (not yet file) a US contractor's tax classification and resolve the correct
treaty article + rate. The contractor self-certifies a W-9 (US persons), W-8BEN
(foreign individuals), or W-8BEN-E (foreign entities) in the portal; staff get a
read/track-only mirror. The actual 1099/1042-S filing + pixel-accurate IRS PDFs are
deferred to later phases — this domain stops at an immutable signed self-certification
plus a resolved treaty claim.

The whole surface is dark behind `module.us-expansion` (default false; dev bypass
`FLAG_SIGNOFF_BYPASS=local` / `QA_DEFAULT_ORG_ID`).

## Flow

```
profile (countryCode + type)
  → getTaxFormDetermination  (routes W-9 / W-8BEN / W-8BEN-E + auto-populates treaty)
  → portal wizard: determination (confirm/override) → form step → attestation → receipt
  → submitTaxForm  (resolve treaty → build signed snapshot → supersede prior ACTIVE → audit)
  → staff status card reads taxForm.listFormSubmissions (status/treaty/expiry only)
```

Form routing (`determineFormType`): `countryCode === 'US'` → W-9; foreign COMPANY →
W-8BEN-E; foreign individual / sole-trader → W-8BEN. The determination is advisory;
the contractor can override on the first step.

Treaty resolution (`applyTreaty` / `resolveTreatyDecision`, mirrors reverse-charge):
auto-detect from (residency, US source, business-profits) against the shared
`WithholdingTaxRate` table, default 30% statutory when no treaty row, manual override
needs a reason + `writeAuditLog`. PL/DE/GB/IE/NL reduce to 0% under Article 7; AE/SA
have no US treaty (30%).

## IRS TIN-Matching

A recipient's name/TIN is validated against IRS records at W-9 intake and re-validated for the
whole batch at year-end, before 1099 generation. The check runs through a `TinMatchClient`
adapter seam: a deterministic `MockTinMatchClient` is the shipped default; the live
`EServicesTinMatchClient` sits behind the seam, dark, until PAF (Payer Account File) enrollment
+ e-Services registration clears — a separate operational prerequisite from the IRIS A2A TCC.
The live client pins its base URL to one of two compile-time literals selected by the
credential `environment` (SSRF-safe, mirroring `peppol-adapter-factory`) and refuses to
transmit while ungated.

`tin-match.service` owns the policy: a 24h result cache (keyed on org+recipient+name+TIN-last4,
never a full TIN), a bounded retry on transient client failures, and the mismatch handler. A
non-zero IRS numerical response indicator is **advisory, never a hard block** — it sets the
recipient backup-withholding flag, raises an admin escalation, and writes an audit row, then
returns a result; the 1099 still generates with the TIN as captured. The flag-set + escalation
writers are caller-supplied (the year-end batch / staff router against the applied schema); the
audit row is written here through `writeAuditLog`. The actual 24% payout reduction is a later
phase — this surface only records the flag.

## 1099-NEC generation

`form-1099-nec.service` is the deterministic year-end generation engine (published-threshold
arithmetic, not a classification verdict). `aggregateBox1` sums box-1 nonemployee compensation
by payment (settlement) date within the calendar tax year, **per recipient per payer-org**;
`aggregateBox1Async` FX-converts any non-USD payout to USD at the **payment-date rate** through
the in-tree `exchange-rate` service (one HALF-UP round on the integer minor-unit product — no
float drift). A non-USD payout that reaches the synchronous reducer without a pre-converted USD
amount throws rather than silently understating the box.

Generation is gated by the **tax-year-keyed `Tax1099Threshold` table** (`getBox1ThresholdMinor`),
never a constant: $600 TY2025, $2,000 TY2026 (OBBBA), inflation-indexed thereafter. `computeBox4Minor`
records federal backup withholding when the recipient's W-9 backup-withholding flag is set or a
TIN mismatch exists (the amount withheld; the 24% reduction is a later phase). `buildForm1099NecSnapshot`
builds the immutable record-of-record with the recipient TIN **last-4 only** (a sanitizer mirroring
`tax-form.service` strips any forged full-SSN/TIN key) plus an adviser-verify note.

A CORRECTED filing **supersedes, never mutates**: `supersedeCorrected` / `fileCorrection` flip the
prior ACTIVE row for `(organizationId, payerOrgId, recipientId, taxYear)` to SUPERSEDED then insert
a new ACTIVE row with `corrected: true` inside one `$transaction`; the filed row is never updated.
`generateBatch` is wrapped in `idempotency.reserve/complete/clear` so a retried batch returns the
prior result instead of re-filing, and writes an audit row on generation. The persistence sink is an
injected port — the deterministic core is unit-tested with no live database; the schema-applied
router/wiring caller supplies the real writer.

The recipient **Copy-B PDF** (`form-1099-nec-pdf` → `Form1099NecCopyBDocument`) is a substitute
black-ink form per Pub 1179 §4.6, rendered via a lazy `import('@react-pdf/renderer')` `renderToBuffer`
from the **stored immutable snapshot** (values as filed, never a live recompute), showing the recipient
TIN masked to last-4 only and carrying the adviser-verify footnote. It is archived to the US R2 tax
bucket under `1099-nec/<orgId>/<id>.pdf`; a `pdfArchiveKey` compare-and-swap prevents a double render.
Copy B ONLY — the IRS Copy A goes via the IRIS XML e-file, never a rendered PDF.

## IRIS XML e-file

The IRS Copy A is transmitted as IRIS (Information Returns Intake System) XML, not a
PDF, by the dedicated [[structure/packages|`@contractor-ops/iris`]] package.
`buildIrisXml` assembles the 1099-NEC submission with a fast-xml-parser `XMLBuilder`
(never string-concatenated XML, mirroring `packages/einvoice`): the Transmission
Manifest carries the schema `VersionNum`/`VersionDt` the payload was built against
(payload-manifest, re-verified per tax year — not message metadata), each payee
B-record carries its Combined Federal/State Filing (CFSF) state code, and amounts emit
as IRIS USAmountType whole dollars. The recipient TIN is emitted **masked (last-4 only**,
e.g. `XXX-XX-1120`) — the full recipient SSN/TIN is never reconstructed or passed in,
mirroring the snapshot sanitizer. `xsdValidate` round-trips the XML against the bundled
IRS IRIS XSD with `libxmljs2` and returns `{ status: 'VALID' | 'INVALID', errors }`
(the einvoice KoSIT layer-1 report shape); it is SSRF/XXE-safe (`parseXml({ nonet: true })`
blocks an external `<xs:import schemaLocation="http://…">`, default `noent: false` keeps
external-entity expansion off).

The IRS IRIS XSDs are a **human-action checkpoint**: a human-only download (IRS SOR
login — not public, not on npm), placed under `packages/iris/src/schema-bundle/` with the
SHA-256 of each file pinned in `checksums.txt` (guarded by
`pnpm --filter @contractor-ops/iris verify:schema-checksums`). The generator works fully
today; until the XSDs are placed, `xsdValidate` reports `XSD-BUNDLE-MISSING` (INVALID)
rather than throwing, so the validator's VALID path stays blocked on the human download.

## Form 1042-S (chapter-3 foreign withholding)

`form-1042s.service` is the deterministic non-transmit core for US-source income paid to foreign
recipients — the chapter-3 sibling of the 1099-NEC engine (no de-minimis threshold, a treaty
§875(d) gate, FTIN in place of TIN). Box figures are ALWAYS server-derived: box-2 gross income sums
settled (PAID) USD payouts (`PaymentRunItem` `completedAt` in the calendar tax year, per recipient
per payer-org — the same settled source the 1099-K tracker uses); box-7 = box-2 × the resolved
chapter-3 rate. The client input carries only `taxYear`/`formId` (mass-assignment guard).

`resolveBox2Rate` implements the **§875(d) gate**: an incomplete W-8 chain short-circuits to the
**30% statutory rate BEFORE any treaty lookup** and flags the recipient for escalation (never a silent
skip); a complete chain resolves the treaty rate + article via the injected `applyTreaty` (the same
`WithholdingTaxRate` table the W-form treaty engine reads). `routeFormType` routes from the W-form on
file (W-8 → 1042-S, W-9 → 1099-NEC), never nationality.

Immutability mirrors 1099-NEC: `buildForm1042SSnapshot` keeps `recipientFtinLast4` only (its sanitizer
strips forged `ftin`/`tin`/`ssn` keys); a CORRECTED filing supersedes — `fileCorrection1042S` flips the
prior ACTIVE row to SUPERSEDED then inserts a new ACTIVE row with `corrected: true` in one `$transaction`
(audited `form1042s.correction`); the filed row is never mutated. `generateBatch1042S` inserts the
whole batch inside ONE interactive `persist.$transaction`, so a mid-batch throw rolls back every row
(never a partial year-end filing); it is idempotent (reserve/complete/clear, audited
`form1042s.generate`) and **REPORTED-only** — the core has zero payment-write call paths. A re-run that
collides with an already-filed batch surfaces P2002 on the `Form1042S_active_key` partial index; the
service treats that as an idempotent skip (`isActive1042SKeyViolation` → returns `idempotent: true`, no
duplicate rows, no error) rather than propagating the constraint error. The recipient-copy PDF (`form-1042s-pdf` → `form-1042s-recipient-copy.tsx`)
renders a substitute black-ink form from the immutable snapshot (FTIN last-4 only), CAS-guarded, archived
to the US R2 tax bucket under `1042-s/<orgId>/<id>.pdf`.

**IRIS 1042-S e-file:** `buildIris1042SXml` (a **sibling** builder, not a parameterized 1099 builder —
the Pub 1187 record layout differs materially) assembles the Transmission Manifest + WithholdingAgent +
a 1042-S recipient record (income code, box-2 gross, ch3/ch4 exemption + rate, box-7 withheld, 13j/13k
status, 13n LOB, treaty article) with a real XML builder (never string concat) and the masked last-4
FTIN only. `xsdValidate1042S` is form-parameterized (`ENTRY_MATCHERS` per-form loader, so a missing
1042-S XSD reports missing rather than validating against the 1099 schema), SSRF/XXE-safe, and stays
`XSD-BUNDLE-MISSING` until the human-only IRS Pub 1187 XSDs land under `packages/iris/src/schema-bundle/`.
The **transmit tail** reuses the shared IRIS seam for the Pub 1187 form: `form-1042s-transmit.service`
(`buildAndValidate1042S`) runs the same build+validate pipeline over `buildIris1042SXml`/`xsdValidate1042S`,
and `form1042s.buildAndValidateXml` / `downloadValidatedXml` / `uploadAck` mirror the 1099 tail — the
ManualDownload path returns the validated XML only on VALID (BUNDLE_UNAVAILABLE until the Pub 1187 XSD
lands, never throwing), records an `IrisSubmission` once per (org, tax year) via idempotency stamped with
the **Pub 1187 schema version**, and the ack upload runs through the single shared XXE-safe
`iris-ack-parser`. That schema version is the discriminator that keeps a 1042-S acknowledgement off a 1099
submission on the shared `IrisSubmission`/`IrisAck` ledger (no form-type column needed); the download also
threads the created submission id to the ack for an exact match.

See [[integrations/irs-1042s]] for the IRIS transmit/XSD integration surface.

## 1099-K informational threshold tracker

`form-1099k-tracker.service` is a **purely informational** band tracker — NOT a filing. A
daily cron (`apps/cron-worker/src/jobs/handlers/form-1099k-tracker.ts`, dark behind
`module.us-expansion`) sums each contractor's cumulative **settled USD payouts** (`PaymentRunItem`
`status=PAID`, `currency=USD`, run `completedAt` in the calendar tax year — the same settled-payment
source the 1042-S box figures use) plus the transaction count, then `bandFor1099K` transitions an
informational band SAFE → APPROACHING → OVER against the **tax-year-keyed `Tax1099KThreshold`**
($20,000 + 200 — OBBBA restored the pre-ARPA figures; never the stale $600, never a constant).

`OVER` requires **both** the gross-amount **and** the transaction-count thresholds crossed (the
federal 1099-K rule); `APPROACHING` is a proximity heads-up when either dimension reaches 80% of its
threshold. `updateTrackerBandState` fires a proactive heads-up notification on an up-crossing and
re-fires a sustained non-safe band only once the reminder cadence (30d) elapses (`lastReminderAt`
dedup); a down-crossing resolves silently. The scan is bounded (`pLimit(10)`), logs via
`createCronLogger` (no `console.*`), and writes `Form1099KTrackerState` (one row per
`(contractorId, taxYear)`) as the **sole writer**. The platform is not the settlement entity (TPSO)
for these payouts — the scan has **no filing/generate/transmit call path**. The read-only
`form1099kTracker.getTrackerState` procedure surfaces the band + totals + threshold for the
contractor profile; it never mutates band state.

## Entry points

| Piece | Path |
|-------|------|
| Portal procedures | `portal.getTaxFormDetermination` / `saveTaxFormDraft` / `submitTaxForm` / `getMyTaxForms` — `packages/api/src/routers/portal/portal-tax-form-router.ts` |
| 1099-K tracker | `packages/api/src/services/form-1099k-tracker.service.ts` (`bandFor1099K` / `updateTrackerBandState` / `runForm1099KTrackerScan`) + cron `apps/cron-worker/src/jobs/handlers/form-1099k-tracker.ts` + read router `packages/api/src/routers/finance/form-1099k-tracker-router.ts` (`getTrackerState`) |
| Staff read/track | `taxForm.listFormSubmissions` / `requestTaxForm` — `packages/api/src/routers/core/tax-form-router.ts` |
| Record service | `packages/api/src/services/tax-form.service.ts` (`buildFormSnapshot` / `supersedeAndInsert` / `computeExpiry`) |
| Treaty engine | `packages/api/src/services/treaty-rate.service.ts` (`resolveTreatyDecision` / `applyTreaty`) |
| TIN-match service | `packages/api/src/services/tin-match.service.ts` (`matchRecipientTin` / `revalidateBatchTins` / `createDbTinMatchPersistence`) |
| TIN-match seam | `packages/integrations/src/adapters/tin-match/` (`TinMatchClient` / `MockTinMatchClient` default / `EServicesTinMatchClient` dark) |
| 1099-NEC engine | `packages/api/src/services/form-1099-nec.service.ts` (`generateBatch` / `aggregateBox1[Async]` / `getBox1ThresholdMinor` / `computeBox4Minor` / `buildForm1099NecSnapshot` / `supersedeCorrected` / `fileCorrection`) |
| 1099-NEC Copy-B PDF | `packages/api/src/services/form-1099-nec-pdf.ts` (`renderAndArchiveCopyB` / `renderForm1099NecCopyB`) + `packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx` (`Form1099NecCopyBDocument`) |
| IRIS XML e-file | `packages/iris` (`buildIrisXml` / `xsdValidate`) — Copy A submission XML + bundled-XSD validation; XSD bundle under `src/schema-bundle/` is a human-action checkpoint |
| 1042-S core | `packages/api/src/services/form-1042s.service.ts` (`resolveBox2Rate` §875(d) gate / `routeFormType` / `buildForm1042SSnapshot` / `generateBatch1042S` / `supersedeCorrected1042S` / `fileCorrection1042S`) |
| 1042-S recipient PDF | `packages/api/src/services/form-1042s-pdf.ts` (`renderAndArchiveRecipientCopy`) + `packages/api/src/pdf-templates/form-1042s-recipient-copy.tsx` |
| 1042-S staff router | `form1042s.generateBatch` / `buildAndValidateXml` / `downloadValidatedXml` / `uploadAck` / `fileCorrection` / `getRecipientCopyUrl` / `list` / `revealRecipientFtin` (contractorPii:read) — `packages/api/src/routers/finance/form-1042s-router.ts` (us-expansion gated) |
| 1042-S transmit tail | `packages/api/src/services/form-1042s-transmit.service.ts` (`buildAndValidate1042S`) — Pub 1187 build+validate over the shared IRIS seam |
| 1042-S portal download | `portal.downloadForm1042S` (consent-gated recipient Copy B) — `packages/api/src/routers/portal/portal-tax-1099-router.ts` |
| 1042-S filing UI | `apps/web-vite/src/components/contractors/tax-filing/tax-1042s-filing-card.tsx` + `hooks/use-1042s-filing.ts`; portal `components/portal/tax-forms/copy-1042s-download.tsx` (reuses `hooks/use-edelivery-consent.ts`) |
| 1042-S IRIS | `packages/iris` (`buildIris1042SXml` / `xsdValidate1042S`) — Pub 1187 sibling builder + form-parameterized XSD |
| Form routing | `packages/api/src/services/tax-form-routing.ts` (`determineFormType`) |
| Validators | `packages/validators/src/w-form-validators.ts` (`taxFormSubmissionSchema` discriminated union) |
| Flag gate | `packages/api/src/middleware/require-us-expansion-flag.ts` (`assertUsExpansionEnabled`) |

## UI surface

- Portal wizard: `apps/web-vite/src/components/portal/tax-forms/` — `tax-form-wizard.tsx`
  (container: reui Stepper + AnimateIn + loading/empty/error), `hooks/use-tax-form-wizard.ts`
  (sole tRPC/RHF boundary), `step-determination` / `step-w9` / `step-w8ben` / `step-w8ben-e`
  / `step-attest` / `step-receipt`, route `portal/tax-form`.
- Staff status card: `apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx`
  + `hooks/use-tax-form-status.ts` — status pill (ACTIVE/DRAFT/SUPERSEDED/expiring) reusing the
  `UspsAddressStatusPill` idiom; full SSN behind `SsnMaskedReveal` (`contractorPii:read`).
- Staff 1042-S batch review (workspace): `apps/web-vite/src/components/contractors/tax-filing/tax-1042s-batch-panel.tsx`
  (wired 4-state) + `tax-1042s-batch-summary.tsx` + `treaty-rate-caption.tsx` + `hooks/use-1042s-batch.ts`
  (sole tRPC boundary → `form1042s.list` / `generateBatch`). Mounted at the `/tax-filing` page
  (`pages/dashboard/tax-filing.tsx` — thin Suspense + `module.us-expansion` flag gate + `contractor:read`),
  reachable via the flag-gated Finance nav entry (`Landmark`). FTIN last-4 only via the gated
  `SsnMaskedReveal`; a recipient without a complete W-8 renders the amber 30% statutory caption
  (`treaty-rate-caption.tsx`, `data-basis="statutory"`) — never a filing block. Review-before-file
  (Generate produces a reviewable summary; filing is a separate action).
- Staff 1042-S filing card: `apps/web-vite/src/components/contractors/tax-filing/tax-1042s-filing-card.tsx`
  + `hooks/use-1042s-filing.ts` (sole tRPC boundary → `form1042s.buildAndValidateXml` / `downloadValidatedXml`
  / `uploadAck` / `fileCorrection`). Reuses the shared `IrisStatusPill` + `AckUploadField` + `CorrectionDialog`
  (the last two gain a `namespace` prop so the shared components read as 1042-S); 4-state, download validated
  XML / upload ack / supersede correction, Rejected announced via `aria-live="assertive"`. Mounted on the
  `/tax-filing` page below the batch panel; BUNDLE_UNAVAILABLE renders as a muted pending state until the Pub
  1187 XSD lands.
- Portal 1042-S recipient PDF: `apps/web-vite/src/components/portal/tax-forms/copy-1042s-download.tsx` reuses
  the SAME `useEdeliveryConsent` hook + `StepEdeliveryConsent` step (namespace `Tax1042SConsent`) to gate the
  recipient's 1042-S Copy B download on stored e-delivery consent → `portal.downloadForm1042S`; without consent
  the affirmative step + paper-copy messaging show, the download is not offered. FTIN last-4 only; IDOR-scoped
  to `ctx.contractorId` server-side.
- 1099-K informational band (profile): `apps/web-vite/src/components/contractors/form-1099k-band.tsx`
  + `hooks/use-1099k-tracker.ts` (read-only sole tRPC boundary → `form1099kTracker.getTrackerState`).
  SAFE (secondary) / APPROACHING / OVER render amber `warning` at most — never `destructive`, never a
  `role="alert"`; mono cumulative-payout + txn-count vs the tax-year threshold; **no filing affordance**.
- Staff US classification result: `apps/web-vite/src/components/contractors/classification/us-classification-result.tsx`
  (wired 4-state section) + `hooks/use-us-classification.ts` (sole boundary → `classification.getLatest`
  + reason-required `classification.override`). Sticky `ClassificationAdvisoryBanner` + a blocking
  disclaimer gate (reuses `classification.acknowledgeDisclaimer`) precede the verdict pill; the
  `ab5-watchlist-flag.tsx` is amber `warning` (never `destructive`) and the §530 chip is `info`;
  `classification-override-dialog.tsx` uses DialogBody/DialogFooter with a required reason + acknowledgement.
- Determination letter (staff): `apps/web-vite/src/components/contractors/classification-documents/generate-determination-letter-button.tsx`
  + `hooks/use-generate-determination-letter.ts` — an SDS-mirror approval gate (typed client name +
  checkbox) unlocking `classificationDocument.generateUsDeterminationLetter`; the archived letter surfaces
  as the `US_DETERMINATION_LETTER` row in `document-history-list.tsx`. Wired for `countryCode === 'US'`
  in `classification-documents-panel.tsx`.

## Invariants

- Append-only: `submitTaxForm` supersedes the prior ACTIVE row then inserts the new ACTIVE
  row in one `$transaction`; signed rows are never mutated, only DRAFT rows are.
- ESIGN attestation (ip / actorId / signedAt) is 100% server-derived from the portal
  session + headers — the client schema omits all three; identity cannot be forged.
- The W-9 payload never carries a full SSN — only the last-4 reference (the SSN lives in
  its encrypted column with the `contractorPii:read` reveal gate). `buildFormSnapshot`
  recursively strips full-SSN/TIN keys as a second guard.
- IDOR: every portal read/write is scoped to `ctx.contractorId` + `ctx.organizationId`,
  never a client-supplied id.
- Staff cannot sign on behalf — `requestTaxForm` only writes an audit event.
- Treaty rows live in the shared `WithholdingTaxRate` table (`sourceCountry='US'`,
  `treatyArticle` column); the same table feeds Phase 87's 1042-S withholding.
- A TIN mismatch is advisory only — it sets the backup-withholding flag + escalates, and the
  1099 still generates. The TIN-match service never throws on a mismatch and never blocks the
  year-end loop. A full TIN/SSN never reaches a log line, the cache key, or the audit metadata.
- The 1099-NEC threshold is read from the tax-year-keyed `Tax1099Threshold` table, never a
  constant ($600 TY2025 / $2,000 TY2026 OBBBA). Box-1 is aggregated by payment-date and
  FX-converted to USD at the payment-date rate, per recipient per payer-org.
- A CORRECTED 1099 supersedes (prior ACTIVE → SUPERSEDED, new ACTIVE with `corrected: true`,
  one `$transaction`); a filed `Form1099Nec` row is never updated. `generateBatch` is idempotent
  so a retried batch never double-files. The Copy-B PDF renders from the immutable snapshot
  (last-4 TIN only) — Copy B only, never IRS Copy A.
- IRIS Copy A is XML, never a PDF: `buildIrisXml` builds it with a real XML builder (never
  string concatenation), emits the recipient TIN masked to last-4 only, and stamps the schema
  `VersionNum`/`VersionDt` from the payload manifest. `xsdValidate` is SSRF/XXE-safe and returns
  `XSD-BUNDLE-MISSING` (INVALID, never throws) until the human-only IRS IRIS XSDs are placed and
  checksum-verified under `packages/iris/src/schema-bundle/`.
- The 1099-K tracker is informational only: no code path in the scan or the read router files,
  generates, or transmits a 1099-K. `Form1099KTrackerState` is written **exclusively** by the cron
  (the read router never mutates it); `OVER` needs **both** the amount and count thresholds crossed;
  the threshold is read per tax year from `Tax1099KThreshold` ($20,000 + 200 OBBBA), never a constant.
- 1042-S box figures are server-derived (box-2 = settled USD payouts; box-7 = box-2 × the §875(d)-gated
  rate); the client asserts only `taxYear`/`formId`. An incomplete W-8 chain is 30% statutory +
  escalation — never a treaty benefit and never a hard block on filing (the 30%-vs-treaty distinction is
  an amber advisory caption). FTIN is last-4 only everywhere (snapshot, PDF, IRIS XML, DOM); the full
  reveal is a separate `contractorPii:read` audited procedure. A CORRECTED 1042-S supersedes (never
  mutates); `generateBatch1042S` is idempotent + REPORTED-only (zero payment writes). The 1042-S
  transmit tail reuses the shared IRIS seam (build/validate + `iris-ack-parser`); its download is
  idempotent and the ack lookup is scoped to the Pub 1187 schema version so a 1042-S ack never lands on
  a 1099 submission (no IrisSubmission form-type column). The portal recipient PDF reuses the SAME
  e-delivery consent gate (IDOR-scoped, FTIN last-4).
  transmit tail + portal consent step reuse the P86 seam verbatim once it lands — never rebuilt.
  mutates); `generateBatch1042S` is transactional (one `$transaction`, full rollback on a mid-batch
  throw) + idempotent (P2002 on `Form1042S_active_key` = skip) + REPORTED-only (zero payment writes).
  The 1042-S transmit tail + portal consent step reuse the P86 seam verbatim once it lands — never rebuilt.
- **Schema↔migration:** the nine US tax-form tables (previously in `tax.prisma` with NO CREATE TABLE
  migration → a fresh regional DB errored `relation does not exist`) now have a hand-authored additive
  migration (`20260705000000_us_tax_form_tables_plus_additive_integrity`), guarded going forward by
  `pnpm --filter @contractor-ops/db db:check-migration-drift`. `Form1042S` gains a partial UNIQUE
  `Form1042S_active_key` on `(org, payerOrgId, recipientId, taxYear) WHERE status='ACTIVE'` — the DB
  backstop making batch generation idempotent even under concurrency (only ACTIVE constrained; DRAFT +
  SUPERSEDED unbounded). `generateBatch1042S` now inserts the whole batch inside one
  `persist.$transaction` (mid-batch throw rolls back every row) and catches the `Form1042S_active_key`
  P2002 as an idempotent skip (`isActive1042SKeyViolation` → `idempotent: true`, no duplicates) — the
  index is the DB backstop, the transaction + P2002-skip is the service half.

## Agent mistakes

- The 1099-K profile band is read-only + informational: do NOT add a file / generate / fix CTA, a
  `destructive` band, or a `role="alert"` — amber `warning` is the ceiling (OVER included). The band
  reads state; the cron is the only writer.
- The US classification UI is advisory, never a verdict: keep the sticky advisory banner + the blocking
  disclaimer before the outcome, keep the AB5 flag amber `warning` (never `destructive`) and the §530
  chip `info`. The override is reason-required and audit-logged server-side — never let the client assert
  the verdict.
- Do NOT add a full-SSN field to the wizard or snapshot — reuse the encrypted column.
- Do NOT extend the always-mounted `taxRouter` for the staff surface — the dedicated
  `taxForm` router is what `root.ts` conditionally spreads behind `module.us-expansion`.
- Do NOT add tRPC outside `hooks/use-*.ts` (web-vite layering, `check:web-vite-data-layer`).
- Do NOT add a 5th field to the `WithholdingTaxRate` `@@unique` key — it breaks the seed
  upsert + `calculateWht` lookup.
- The treaty claim is advisory display; the authoritative resolution + persistence happen
  server-side.
- Do NOT call `EServicesTinMatchClient` on the default path — it is dark behind a PAF/flag gate;
  the shipped default is `MockTinMatchClient`. Do NOT hard-block on a TIN mismatch.
- Do NOT embed the 1099 threshold as a constant — read `Tax1099Threshold` by tax year. Do NOT
  render IRS Copy A as a PDF (Copy B only; Copy A goes via IRIS XML). Do NOT recompute figures in
  the PDF — render from the immutable snapshot. Do NOT mutate a filed `Form1099Nec` — correct by
  superseding.
- Do NOT pass a full SSN/TIN into `buildIrisXml` — the payee TIN is the masked last-4 value. Do
  NOT string-concatenate IRIS XML — use the `@contractor-ops/iris` builder. Do NOT treat an
  `XSD-BUNDLE-MISSING` report as a code bug — the IRS IRIS XSDs are a human-only download placed at
  the `src/schema-bundle/` checkpoint.
- Do NOT add a filing/generate/transmit path to the 1099-K tracker — it is informational only. Do
  NOT let the read router write `Form1099KTrackerState` (the cron is the sole writer). Do NOT band on
  a single dimension for `OVER` (both amount AND count) or hard-code the threshold (read
  `Tax1099KThreshold` by tax year).
- Do NOT grant a treaty rate on an incomplete W-8 chain — the §875(d) gate short-circuits to 30%
  statutory before any treaty lookup, and never blocks filing (the 30%-vs-treaty distinction is an amber
  advisory caption, not a gate). Do NOT pass a full FTIN into the snapshot, the recipient PDF, or
  `buildIris1042SXml` (last-4 only). Do NOT string-concatenate the 1042-S IRIS XML (sibling
  `buildIris1042SXml`), and treat `XSD-BUNDLE-MISSING` as the human Pub 1187 XSD checkpoint, not a bug.
  Do NOT rebuild the 1042-S transmit tail or the portal consent step — the transmit procedures reuse the
  shared IRIS seam + `iris-ack-parser`, and the portal 1042-S download reuses the SAME `useEdeliveryConsent`
  gate + `StepEdeliveryConsent` step (namespace prop). Do NOT add an `IrisSubmission` form-type column — the
  Pub 1187 schema version already discriminates a 1042-S submission from a 1099 one.

## Related

- [[domains/us-classification]]
- [[integrations/irs-1042s]]
- [[domains/tax-and-wht]]
- [[domains/portal-external]]
- [[domains/contractors-engagements]]
- [[structure/key-services]]
- [[structure/api-routers-catalog]]
- [[structure/packages]]
