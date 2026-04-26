# Phase 63: UK Payments & Financial Features - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Three deliverables on top of the existing `PaymentRun` / `Invoice` / `ContractorBillingProfile` infrastructure:

1. **BACS Standard 18 Direct Credit export (PAY-01):** Users can export a UK GBP payment run as a BACS Std 18 fixed-width file with correct formatting, modulus-check sort-code validation, deterministic ASCII transliteration for non-ASCII names, and org-level submitter configuration (SUN + originating account).
2. **Statutory late payment interest (PAY-06):** Users see automatically calculated statutory interest on overdue UK **B2B** invoices per the Late Payment of Commercial Debts (Interest) Act 1998 — BoE base rate + 8% statutory rate, plus fixed compensation (£40 / £70 / £100 tier) once per overdue debt. Live computation on read, immutable snapshot when user "claims" interest.
3. **Skonto early-payment discount (PAY-07):** Users configure Skonto terms on German invoices (per-invoice with per-ContractorBillingProfile default cascade); the discount is surfaced in the XRechnung BG-20 Payment Terms block as structured Skonto data (extends the Phase 61 generator); eligibility tracks live vs `paidAt`; applied discounts are persisted as snapshots when payment completes.

**Explicitly out of scope:** multi-tier Skonto, BACS submission via BACSTEL-IP / VocaLink (export only, user submits the file themselves), receivables payment tracking in the PaymentRun domain, consumer-debt late interest (B2C), Contract-level Skonto templates, automated BoE rate commentary pages, per-country generalisation of statutory interest beyond the UK LPCDA scope.

</domain>

<decisions>
## Implementation Decisions

### BACS Standard 18 export (PAY-01)
- **D-01:** **Contractor bank fields — new encrypted columns on `ContractorBillingProfile`:**
  - `ukSortCodeEncrypted` (String?) + `ukSortCodeMasked` (String? — last 2 digits, e.g. `XX-XX-34`)
  - `ukAccountNumberEncrypted` (String?) + `ukAccountNumberMasked` (String? — last 4 digits, e.g. `XXXX-5678`)
  - Crypto via existing `packages/api/src/services/bank-account-crypto.ts` (AEAD, same pattern as `bankAccountEncrypted`). Canonical storage: hyphen-free 6-digit sort code + 8-digit account number.
  - Zod validation at tRPC boundary in `packages/validators/src/bacs.ts` (new): exact regex `/^\d{6}$/` and `/^\d{8}$/` + optional BACS modulus check (Standard 38 VocaLink modulus-check rules, shipped as a data table in `packages/validators/src/bacs-modulus-tables.ts` with the published VocaLink "Modulus Weights" bundle — accepts the list as a lookup of `{ sortCodeRangeStart, sortCodeRangeEnd, weights, exceptions }`). Modulus-invalid entries warn but do not hard-block (some exception-category sort codes are known-invalid per the spec).
  - Existing `bankAccountEncrypted` + `swiftBic` fields stay for SEPA/SWIFT flows — no data migration required.
- **D-02:** **Organization-level BACS submitter fields — new encrypted columns on `Organization`:**
  - `bacsServiceUserNumberEncrypted` (String?) + `bacsServiceUserNumberMasked` (String? — masked last 2 chars)
  - `bacsSubmitterSortCodeEncrypted` + `bacsSubmitterSortCodeMasked`
  - `bacsSubmitterAccountNumberEncrypted` + `bacsSubmitterAccountNumberMasked`
  - `bacsSubmitterName` (plain String, max 18 ASCII chars per BACS Std 18 field 2)
  - New settings UI at `/[locale]/(dashboard)/settings/payments/` (new page) with admin-only access via `requirePermission('org:settings:write')`. Page shows UK & EU payment export config — BACS fields + existing SEPA/SWIFT submitter fields (if any).
  - BACS export refuses (`throw TRPCError('FAILED_PRECONDITION', 'BACS submitter not configured')`) unless all three encrypted fields + name are set.
- **D-03:** **BACS Std 18 generator lands in `packages/api/src/services/payment-export.ts`:**
  - New exported function: `generateBacsStandard18(items: ExportItem[], orgBank: OrgBankInfo, runRef: string, processingDate: Date): { fileBuffer: Buffer; ext: 'txt' }`.
  - Produces a fixed-width ASCII file per BACS Std 18 (Direct Credit): Volume Header Label (80 chars) + File Header Label (80 chars) + User Header Label (80 chars) + one Detail Record (106 chars) per payment + User Trailer Label (80 chars) + File Trailer Label (80 chars). CR/LF line endings, no BOM.
  - Sort-code modulus check runs per item (warnings aggregated and returned alongside the buffer for UI display). Hard failure only when sort-code format invalid (regex-level).
  - Transaction code hardcoded to `99` (Standard Direct Credit). Processing date formatted as `YYDDD` Julian. Reference field populated from `PaymentRunItem.paymentReference` (fallback to `runRef + '/' + invoice.invoiceNumber`) truncated to 18 ASCII chars via the transliteration util.
  - Register the new format in `PaymentExportFormat` Prisma enum: extend from `'CSV' | 'BANK_FILE' | 'SEPA_XML' | 'SWIFT_XML'` to add `'BACS_STD18'`. Migration.
- **D-04:** **Format auto-detection extended in `packages/api/src/services/payment-format-detection.ts`:**
  - Add GBP + UK detection: currency === `'GBP'` AND (destination has `ukSortCodeEncrypted` + `ukAccountNumberEncrypted`) → `BACS_STD18`.
  - Precedence: existing IBAN rules unchanged; UK-account detection is checked BEFORE IBAN rules for GBP payments (since a UK payee might have no IBAN).
  - Unit tests: GBP+UK account → `BACS_STD18`, GBP+IBAN → `SWIFT_XML`, EUR+DE IBAN → `SEPA_XML` (unchanged).
- **D-05:** **ASCII transliteration util at `packages/shared/src/ascii-transliterate.ts` (new):**
  - Pure function `transliterateToBacs(input: string): { output: string, replaced: string[] }`.
  - Deterministic mapping covers the BACS Std 18 character set: `A-Z 0-9` plus 14 allowed punctuation (`- . ' / & ( ) + , : ; ? = " @`).
  - Maps common European accents: ä→a, ö→o, ü→u, ß→ss, é→e, è→e, ê→e, ë→e, á→a, à→a, â→a, í→i, ì→i, î→i, ï→i, ó→o, ò→o, ô→o, ø→o, ú→u, ù→u, û→u, ñ→n, ç→c, ł→l, ś→s, ź→z, ż→z, ą→a, ę→e, etc.
  - Anything unmappable becomes `?` and is added to `replaced[]` for the UI warning.
  - Upper-cases the output (BACS Std 18 character set is uppercase + digits).
  - Unit test: the transliteration table lives in `ascii-transliterate-table.ts` as a `Map<string, string>`, tested exhaustively.
- **D-06:** **UI surfaces for BACS export:**
  - Payment-run detail page gains a "Preview BACS file" action (visible when format = `BACS_STD18`). Preview renders the file as a monospace block with a warning list (transliteration replacements + modulus-check warnings per item).
  - Download button produces `{org.name}-BACS-{runNumber}-{ISODate}.txt`.
  - A new `PaymentExport` row records the format + `r2Key` + `sha256` + `downloadCount`. R2 key layout: `payment-exports/{organizationId}/{paymentRunId}/BACS-{runNumber}-{sha256[0:16]}.txt`. Signed URL TTL 300s.
- **D-07:** **Feature flag:** `PAY_BACS_ENABLED` via the Unleash wrapper. When off, `BACS_STD18` is hidden from format selection and the settings page surfaces an "Enable in settings → feature flags" note for admins (self-hosted Unleash; org admins can flip).

### Statutory late payment interest (PAY-06)
- **D-08:** **New Prisma model `BoEBaseRateHistory`:**
  - Fields: `id`, `effectiveFrom` (DateTime @db.Date @unique), `ratePercent` (Decimal @db.Decimal(5,2)), `source` (enum `'BOE_API' | 'MANUAL'`), `recordedAt` (DateTime), `recordedByUserId` (nullable FK — null for cron-sourced rows), `notes` (nullable Text), `createdAt`, `updatedAt`.
  - NOT multi-tenant — global reference data. Reads have no `organizationId` scope.
  - Initial seed via a migration covering the BoE base rate history from 2021-01-01 through the migration date. Values sourced from Bank of England "Official Bank Rate history" (public domain). Seed file committed at `packages/db/prisma/seed-data/boe-base-rate-history.json`.
- **D-09:** **BoE API polling job:**
  - New service `packages/integrations/src/boe-base-rate-poller.ts` (new subpackage if `integrations` doesn't exist yet; otherwise extend) that fetches the current Bank Rate from the BoE database (`https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&Datefrom=...&Dateto=...&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&Filter=N`).
  - Cron schedule: daily at 06:00 UTC via Render Cron (or the existing scheduled-job infra if any — check during planning). Polls the most recent rate; if it differs from the latest `BoEBaseRateHistory.ratePercent`, inserts a new row with today's date as `effectiveFrom`.
  - On fetch failure: logs a warning via `@contractor-ops/logger`, does not throw. Uses existing `GovApiRateLimiter` + audit logging from `@contractor-ops/gov-api`.
- **D-10:** **Admin manual-edit endpoint:**
  - New internal tRPC router `packages/api/src/routers/admin-boe-rate.ts` with `list`, `insert({ effectiveFrom, ratePercent, notes })`, `update({ id, ratePercent, notes })`, `delete({ id })` procedures.
  - Gated on a new permission `admin:boe-rate:write` granted only to super-admin role (not org admins). Surfaced at `/admin/boe-rate/` (new admin-only page, only visible to super-admin accounts — the only super-admin surface so far; if no admin area exists, this creates one).
- **D-11:** **Scope — B2B only:**
  - New `isBusinessCustomer` boolean on `Contractor` (default `true` — matches our tenancy reality where the overwhelming majority of users bill corporate contractors). Flippable per-contractor via the contractor edit page.
  - Late interest calculation returns `{ applicable: false, reason: 'B2C_TRANSACTION' }` when `contractor.isBusinessCustomer === false` OR `contractor.countryCode !== 'GB'`.
  - Invoice detail page shows "Statutory interest not applicable (B2C transaction)" banner in the interest section when scope gates fail.
- **D-12:** **Accrual model — live computation on read:**
  - Pure function `calculateLateInterest({ invoice, contractorBillingProfile, rateHistory, asOf })` in `packages/api/src/services/late-payment-interest.ts` (new).
  - No persistence of running interest — recomputed on every invoice read.
  - Payment term cascade: `Contract.paymentTermsDays` → `ContractorBillingProfile.paymentTermsDays` → hard fallback `30` (LPCDA statutory default when no contract term — §6 of the Act).
  - Reference period: from the day after the due date (31st day if default) through `paidAt` (or `now` for unpaid). Interest accrues daily simple (not compound) per LPCDA §3(3): `dailyInterest = principalOutstanding * ((boeRate + 8) / 100) / 365`.
  - Rate used: the Bank of England base rate **in effect on the last day of the preceding 6-month statutory period** per LPCDA §4(1) — 30 June or 31 December. Helper `resolveStatutoryRate(rateHistory, debtPeriodStart): ratePercent` encapsulates the lookup.
  - Returns `{ applicable, dailyInterestMinor, accruedInterestMinor, daysOverdue, rateUsed, compensationTierMinor, principalOutstandingMinor, waiverApplied: boolean }`.
- **D-13:** **Fixed compensation tier — snapshot at first overdue:**
  - New Prisma model `InvoiceInterestCompensation`: `id`, `organizationId`, `invoiceId` (unique FK), `tierMinor` (Int — 4000 / 7000 / 10000 representing £40 / £70 / £100), `invoiceTotalAtOverdueMinor` (Int — frozen at calc time), `firstOverdueDate` (Date), `createdAt`.
  - A nightly cron job (or a write on first read — choose during planning, likely the read-triggered write, using idempotent upsert to avoid duplicates) records the compensation row the first time an invoice is read after its due date passes. Tier derived from `invoiceTotalAtOverdueMinor`: `<100000` → 4000 (£40), `100000..999999` → 7000 (£70), `>=1000000` → 10000 (£100) — values in minor (pence).
  - Once recorded, tier is immutable even if the invoice amount is later edited (LPCDA §5A(1) compensation is per-debt at the point it became overdue).
- **D-14:** **Partial-payment handling — new Prisma model `InvoicePayment`:**
  - Fields: `id`, `organizationId`, `invoiceId`, `amountMinor`, `paidAt`, `sourceKind` enum (`'MANUAL' | 'PAYMENT_RUN' | 'BANK_STATEMENT'`), `sourcePaymentRunItemId` (nullable FK), `notes`, `createdByUserId`, `createdAt`.
  - Invoice's `paidAt` + `paymentStatus` become derived: the max `InvoicePayment.paidAt` when sum(amount) >= invoice.totalMinor, `PARTIALLY_PAID` when sum > 0, else `UNPAID`.
  - Migration for existing invoices: for each `Invoice` with `paidAt != null`, create one `InvoicePayment` row with `amountMinor = invoice.totalMinor`, `paidAt = invoice.paidAt`, `sourceKind = 'MANUAL'`, `createdByUserId` = a system sentinel user ID.
  - `calculateLateInterest` consumes `InvoicePayment` rows — interest accrues on the outstanding balance at each reference date.
- **D-15:** **Waiver — new Prisma model `InvoiceInterestWaiver`:**
  - Fields: `id`, `organizationId`, `invoiceId`, `waiveType` enum (`'STATUTORY_INTEREST' | 'COMPENSATION' | 'BOTH'`), `reason` (Text — required, min 10 chars), `waivedByUserId`, `waivedAt`, `revokedAt` (nullable — soft revoke), `revokedByUserId` (nullable), `revokeReason` (Text, nullable), `createdAt`.
  - UI: "Waive interest" button on invoice detail page opens a dialog requiring a reason. One active waiver per invoice per type; a revoked waiver can be re-created if circumstances change.
  - `calculateLateInterest` zeros out the waived component when a non-revoked waiver exists.
- **D-16:** **UI surfaces:**
  - **Invoice detail page** — new "Statutory late payment interest" section (only visible for qualifying UK B2B invoices) showing: principal outstanding, days overdue, rate used (with tooltip explaining the 6-month statutory period rule), daily accrual, total interest accrued, compensation tier, total statutory claim (interest + compensation). CTAs: "Claim statutory interest" (triggers claim snapshot D-17), "Waive interest" (triggers D-15).
  - **Invoices list** — new "Overdue interest" column (sortable; hidden for non-GB orgs by default via column preferences). New filter chip "Overdue" (filters to `status != PAID && dueDate < now()`).
  - **Dashboard** — new tile "Overdue receivables (UK)" showing `£principal + £interest accrued` (sum across unwaived, overdue UK B2B invoices). Click-through to the overdue filter on the invoices list.
- **D-17:** **Claim generation — `InvoiceInterestClaim` + PDF letter + optional secondary invoice:**
  - New Prisma model `InvoiceInterestClaim`: `id`, `organizationId`, `invoiceId`, `claimedByUserId`, `claimedAt`, `snapshotInterestMinor`, `snapshotCompensationMinor`, `snapshotRateUsed` (Decimal 5,2), `snapshotDaysOverdue` (Int), `pdfKey` (R2), `secondaryInvoiceId` (nullable FK — if user chose to issue a secondary invoice).
  - PDF template `packages/api/src/pdf-templates/late-payment-claim.tsx` (new): React-PDF bilingual (EN primary for UK B2B; DE fallback not applicable). Shares design tokens with existing ir35-sds / drv / gdpr templates. Includes LPCDA reference footer with locked statutory phrases from `packages/validators/src/legal/gb.ts` (new — this phase introduces the GB-locked-phrase module mirroring the existing DE one for Phase 56 compliance).
  - "Issue as secondary invoice" CTA optionally creates a new `Invoice` with `source = 'LATE_INTEREST_CLAIM'` (new enum value), linked to the original via `sourceReference`, with a single InvoiceLine for the claimed amount. User can then send this invoice normally (including via existing e-invoice path for DE buyers with GB counterparties — rare but possible).
- **D-18:** **Exclude late interest from PaymentRun:**
  - PaymentRun is **payables** (invoices WE pay to contractors). Late interest applies to **receivables** (invoices our customers owe us). Different domains. No integration in v5.0.
  - Scope note committed to `.planning/STATE.md` for future reference: if receivables payment tracking is added later, revisit whether a PaymentRun-equivalent on the AR side should carry outgoing interest claims.
- **D-19:** **Feature flag:** `PAY_LATE_INTEREST_ENABLED` gates the late-interest UI surface, calculation service calls, and the BoE rate polling cron job.

### Skonto early-payment discount (PAY-07)
- **D-20:** **New Prisma model `SkontoTerm`:**
  - Fields: `id`, `organizationId`, `invoiceId` (nullable, unique), `billingProfileId` (nullable, unique), `discountPercent` (Decimal @db.Decimal(5,2), e.g. `3.00`), `discountPeriodDays` (Int, e.g. `7`), `netPeriodDays` (Int, e.g. `30`), `createdAt`, `updatedAt`.
  - XOR constraint via `CHECK ((invoiceId IS NOT NULL AND billingProfileId IS NULL) OR (invoiceId IS NULL AND billingProfileId IS NOT NULL))` — either an invoice-specific term or a profile default; not both.
  - Unique on `(organizationId, invoiceId)` and `(organizationId, billingProfileId)` — one SkontoTerm per invoice/profile max.
  - Multi-tenant via Prisma extension.
  - Validation: `0 < discountPercent <= 50`, `1 <= discountPeriodDays < netPeriodDays <= 180`. Zod schema at tRPC boundary.
- **D-21:** **Default cascade on invoice create/edit:**
  - When creating or editing a DE invoice, server-side `resolveSkontoTerm({ invoiceId, billingProfileId })` returns the invoice-level term if set, else the billing-profile default if set, else `null`.
  - UI on invoice create/edit form: Skonto section shows a "Use contractor default" pill when profile default exists + a "Customize" toggle that creates an invoice-specific term. Deleting the invoice-specific term falls back to the profile default (if any).
  - Contract-level templates explicitly NOT in scope for v5.0 (deferred).
- **D-22:** **Single-tier for v5.0:**
  - One discount percent + one discount window + one net period. Matches the overwhelming majority of German SME invoicing.
  - Human string format (German locale, locked phrase) stored as a constant in `packages/validators/src/legal/de.ts`: `SKONTO_DESCRIPTION_TEMPLATE_DE = "{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage"` with CI-guard coverage (mirrors the existing Phase 56 locked-phrase pattern).
  - English locale uses: `"{percent}% discount if paid within {discountDays} days, otherwise net {netDays} days"` — not a locked legal phrase (informational only; the German version carries the statutory weight).
- **D-23:** **XRechnung BG-20 Payment Terms integration (extends Phase 61):**
  - Modify `packages/einvoice/src/profiles/xrechnung-de/generator.ts` to emit `ram:SpecifiedTradePaymentTerms` when a SkontoTerm is set on the invoice:
    - `ram:Description` = the locked German phrase (D-22) interpolated.
    - `ram:DueDateDateTime/udt:DateTimeString format="102"` = `issueDate + netPeriodDays`.
    - Structured Skonto via XRechnung extension syntax appended to Description: `#SKONTO#TAGE={discountPeriodDays}#PROZENT={discountPercent.toFixed(2)}#BASISBETRAG={totalMinor/100}#` (XRechnung 3.0.2 §Anhang E format).
  - When no SkontoTerm exists, BG-20 block omitted entirely (same as today — no behavior change for non-Skonto invoices).
  - New test fixtures in `packages/einvoice/src/profiles/xrechnung-de/__fixtures__/` — one Skonto invoice, one non-Skonto invoice. KoSIT 3-layer validation passes for both.
  - Update `61-CONTEXT.md` canonical_refs inbound (Phase 61 is already complete, but this phase touches its generator — add a note to 63-RESEARCH.md referencing the modification).
- **D-24:** **Eligibility evaluation + snapshot on payment complete:**
  - Pure function `evaluateSkontoEligibility({ invoice, skontoTerm, paidAt })` returns `{ eligible: boolean, eligibilityReason: 'ELIGIBLE' | 'PAST_DISCOUNT_WINDOW' | 'NO_SKONTO_CONFIGURED' | 'UNPAID', discountedAmountMinor, discountAmountMinor, netAmountMinor }`.
  - UI display: recompute live on every invoice read. Invoice detail shows "If paid by {date}: save €X,XX (discounted total €Y,YY)" for unpaid invoices within the window. Red "Discount window expired" banner after.
  - Snapshot on payment complete: when the last `InvoicePayment` row brings `sum(InvoicePayment.amountMinor) >= invoice.totalMinor`, a new `SkontoSnapshot` row is written if a SkontoTerm was set:
    - New Prisma model `SkontoSnapshot`: `id`, `organizationId`, `invoiceId` (unique FK), `skontoTermId` (FK — term at time of snapshot), `eligibilityAtPayment` enum (`'ELIGIBLE' | 'NOT_ELIGIBLE'`), `discountAppliedMinor` (Int — 0 when not eligible or user did not take discount), `effectivePaymentDate` (Date — the date of the final payment), `createdAt`.
  - `PaymentRun` preview UI for DE invoices shows "Eligible for Skonto: €X,XX discount — use discounted amount?" checkbox when within discount window. Checking it sets `PaymentRunItem.amountMinor = discountedAmountMinor` and attaches a `SkontoApplication` row (new: `id`, `organizationId`, `paymentRunItemId` (unique FK), `skontoTermId`, `discountPercentApplied`, `discountAmountMinor`, `createdAt`).
- **D-25:** **UI surfaces:**
  - **Invoice create/edit form** (DE invoices only): Skonto section with percent + discount-days + net-days inputs, validation inline, "Use contractor default" affordance.
  - **ContractorBillingProfile edit form** (DE profiles only): default Skonto term editor.
  - **Invoice detail page**: "Skonto" banner with eligibility state + save-if-paid-by copy + German locked phrase preview.
  - **PaymentRun preview** (DE invoices in the run): per-line Skonto checkbox when within discount window.
  - **Invoice list**: new sortable column "Skonto" showing either the term (e.g. `3% 7/30`) or `—`.
- **D-26:** **Feature flag:** `PAY_SKONTO_ENABLED` gates the SkontoTerm CRUD UI, XRechnung BG-20 emission, and PaymentRun preview checkbox. Off by default for existing orgs; on by default for new DE orgs.

### tRPC router layout
- **D-27:** **New routers + extensions:**
  - `packages/api/src/routers/bacs.ts` (new) — `previewExport({ paymentRunId })`, `generateExport({ paymentRunId })`, `validateSortCode({ sortCode, accountNumber })`, `saveSubmitterConfig({ serviceUserNumber, submitterSortCode, submitterAccountNumber, submitterName })`.
  - `packages/api/src/routers/late-payment-interest.ts` (new) — `getForInvoice({ invoiceId })`, `getForOrg({ status?, cursor? })`, `waive({ invoiceId, waiveType, reason })`, `revokeWaiver({ waiverId, revokeReason })`, `claim({ invoiceId, issueAsSecondaryInvoice: boolean })`, `downloadClaim({ claimId })`.
  - `packages/api/src/routers/skonto.ts` (new) — `upsertForInvoice({ invoiceId, percent, discountDays, netDays })`, `deleteForInvoice({ invoiceId })`, `upsertForBillingProfile({ billingProfileId, percent, discountDays, netDays })`, `deleteForBillingProfile({ billingProfileId })`, `evaluateForInvoice({ invoiceId, asOf? })`.
  - `packages/api/src/routers/admin-boe-rate.ts` (new, super-admin) — per D-10.
  - `packages/api/src/routers/payment.ts` (extended) — `getFormatDetection({ paymentRunId })` exposes the auto-detected format; `applySkontoToItem({ paymentRunItemId })` sets `amountMinor` to the discounted amount and writes `SkontoApplication`.

### Claude's Discretion
- Whether `GovApiRateLimiter` already wraps non-HMRC gov calls (BoE) or needs a new generic wrapper — decide during planning.
- Exact VocaLink modulus weights table version to ship — use the most recent published version as of planning, committed with source URL.
- Whether to implement a Render scheduled job or piggyback on an existing cron mechanism — decide based on what `packages/integrations` already provides.
- Exact layout of the bilingual LPCDA claim-letter PDF (header, tone, signature block) — first pass during implementation, polish via `frontend-design` if needed.
- Whether the admin BoE rate UI needs its own nav section or can piggyback on existing admin pages (if any) — probably a new `/admin/` shell is warranted.
- The precise i18n strings for `InvoiceInterestWaiver` revoke reasons (e.g., enumerate common reasons or free text) — start with free text.
- Whether `InvoicePayment` migration for existing invoices runs in the same deploy as Phase 63 or is fenced behind a maintenance window — likely same deploy; small data volume.
- Whether `isBusinessCustomer` default of `true` forces a review step for existing contractors or silently takes effect — silent is fine; affected users are a tiny minority.

### Folded Todos
No todos folded — `gsd-tools todo match-phase 63` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` line 30 — PAY-01: BACS Standard 18 Direct Credit files
- `.planning/REQUIREMENTS.md` line 38 — PAY-06: statutory late payment interest per LPCDA (BoE base + 8% + £40/£70/£100 compensation)
- `.planning/REQUIREMENTS.md` line 39 — PAY-07: Skonto early-payment discount on German invoices
- `.planning/ROADMAP.md` §Phase 63 — Goal, 3 success criteria, `Depends on Phase 56 + Phase 57`

### Standing project constraints
- `.planning/STATE.md` §"Standing Project Constraints" — app is local-only; legal sign-off deferred

### Prior phase context (foundations this phase extends)
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — GBP currency support, UK country fields, DE locked legal phrase pattern, CI guard for locked phrases (REUSED for GB locked phrases in D-17 + DE Skonto phrase in D-22)
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — `GovApiRateLimiter`, `GovApiAuditLogger`, Kleinunternehmer flag, VAT rate logic (REFERENCED for BoE polling rate-limit pattern and for Kleinunternehmer-aware Skonto display)
- `.planning/phases/61-xrechnung-e-invoicing/61-CONTEXT.md` — XRechnung 3.0.2 CII generator (MODIFIED in D-23 to emit BG-20 Payment Terms); KoSIT validator (REUSED for Skonto-invoice fixture tests)
- `.planning/phases/62-zugferd-e-invoicing/62-CONTEXT.md` — in flight; no direct dependency but Skonto XRechnung changes must remain compatible with the embedded-CII path
- `.planning/phases/60-classification-polish/60-CONTEXT.md` — compliance-pill palette (REUSED for overdue interest chips in the invoices list + dashboard tile)

### Existing code (reusable infrastructure)
- `packages/db/prisma/schema/payment.prisma` — `PaymentRun`, `PaymentRunItem`, `PaymentExport`, `PaymentExportFormat` enum (EXTEND with `BACS_STD18`)
- `packages/db/prisma/schema/invoice.prisma` — `Invoice` model with `dueDate`, `paidAt`, `totalMinor`, `amountToPayMinor`, `paymentStatus` (REUSED for late interest)
- `packages/db/prisma/schema/contractor.prisma` — `Contractor` model (ADD `isBusinessCustomer` per D-11); `ContractorBillingProfile` model (ADD `ukSortCodeEncrypted` + `ukAccountNumberEncrypted` per D-01)
- `packages/db/prisma/schema/organization.prisma` — `Organization` model (ADD BACS submitter fields per D-02)
- `packages/api/src/routers/payment.ts` — existing payment router (EXTEND with BACS helpers + Skonto in payment-run preview per D-04 + D-24 + D-27)
- `packages/api/src/services/payment-export.ts` — has `generateCsv`, `generateElixir`, `generateSepaXml`, `generateSwiftXml` (ADD `generateBacsStandard18` per D-03)
- `packages/api/src/services/payment-format-detection.ts` — auto-routing logic (EXTEND with GBP+UK → `BACS_STD18` per D-04)
- `packages/api/src/services/bank-account-crypto.ts` — AEAD helpers for encrypted bank fields (REUSED for UK account + submitter fields)
- `packages/validators/src/payment.ts` — existing payment Zod schemas (EXTEND with BACS + SkontoTerm + InvoicePayment schemas)
- `packages/validators/src/legal/de.ts` — DE locked legal phrases (ADD `SKONTO_DESCRIPTION_TEMPLATE_DE`)
- `packages/validators/src/legal/gb.ts` — NEW file for GB locked statutory phrases (LPCDA claim-letter footer text)
- `packages/einvoice/src/profiles/xrechnung-de/generator.ts` — XRechnung CII generator (MODIFIED to emit BG-20 Payment Terms per D-23)
- `packages/einvoice/src/profiles/xrechnung-de/__fixtures__/` — test fixtures (ADD Skonto + non-Skonto invoices)
- `packages/api/src/pdf-templates/` — React-PDF templates (ADD `late-payment-claim.tsx`)
- `packages/shared/src/` — cross-cutting utilities (ADD `ascii-transliterate.ts` per D-05)
- `packages/api/src/services/r2.ts` — `putObjectAndSignDownload`, `signExistingDownload` (REUSED for BACS exports + claim PDFs)
- `packages/feature-flags/` — Unleash wrapper (ADD `PAY_BACS_ENABLED`, `PAY_LATE_INTEREST_ENABLED`, `PAY_SKONTO_ENABLED`)
- `apps/web/src/app/[locale]/(dashboard)/invoices/` — invoice list + detail (EXTEND per D-16 + D-25)
- `apps/web/src/app/[locale]/(dashboard)/payments/` — payment-run list + detail (EXTEND per D-06 + D-24)
- `apps/web/src/app/[locale]/(dashboard)/settings/payments/` — NEW page for BACS submitter config + feature-flag visibility
- `apps/web/src/app/admin/boe-rate/` — NEW super-admin page for BoE rate history
- `apps/web/messages/*.json` — add `Payments` namespace (BACS chrome, late-interest copy, Skonto labels — DE + EN + GB)
- `packages/integrations/` (if exists) OR new subpackage — BoE rate poller service

### External regulatory & technical references
- BACS Standard 18 Direct Credit specification — https://www.bacs.co.uk/documentlibrary (proprietary; format reference also in "Payments UK Specification for Bulk Lodgement Files")
- VocaLink Modulus Checking — https://www.vocalink.com/customer-support/modulus-checking/ (modulus weights table source)
- Late Payment of Commercial Debts (Interest) Act 1998 — https://www.legislation.gov.uk/ukpga/1998/20 (§3, §4, §5A define interest + compensation)
- Late Payment of Commercial Debts Regulations 2002 + 2013 amendments — https://www.legislation.gov.uk/uksi/2013/395 (updates compensation tiers to £40/£70/£100)
- Bank of England Official Bank Rate history — https://www.bankofengland.co.uk/boeapps/iadb/Repo.asp (IUDBEDR series)
- XRechnung 3.0.2 §Anhang E — Skonto extension syntax in BG-20 Payment Terms Description (from Phase 61 canonical refs)
- Skonto conventions (German §11 UStG + commercial practice) — no single spec; behaviour documented in KoSIT validator-configuration-xrechnung test cases
- EN 16931 BG-20 Payment Terms — inherited from Phase 61

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Complete PaymentRun infrastructure** (Prisma schema + router + services): adding a new export format is a natural extension via the existing `PaymentExportFormat` enum + `payment-export.ts` generator dispatch.
- **`bank-account-crypto` service**: AEAD helpers already handle encrypted-at-rest bank details. UK sort code + account number + BACS submitter fields all use the same pattern.
- **`payment-format-detection.ts`**: already auto-routes by currency + IBAN country. GBP+UK-account path is a single additional branch.
- **React-PDF templates** (Phase 56/59/61): `late-payment-claim.tsx` follows the same pattern + shares design tokens with `ir35-sds.tsx`, `drv-defense-bundle.tsx`.
- **XRechnung CII generator** (Phase 61): extended with BG-20 Payment Terms; KoSIT 3-layer validator reused for fixture tests.
- **Content-addressed R2 storage** (Phase 56/59/61): BACS file exports + claim PDFs follow the same key layout.
- **`GovApiRateLimiter` + `GovApiAuditLogger`** (Phase 57): wraps the BoE API poller.
- **Feature-flag wrapper** (project memory): jurisdiction-aware flag short-circuit.
- **Locked DE legal phrases + CI guard** (Phase 56): extended with `SKONTO_DESCRIPTION_TEMPLATE_DE`; new `gb.ts` module for GB statutory phrases mirrors the pattern.
- **Compliance-pill palette** (Phase 60): reused for overdue-interest chips + eligibility badges.
- **Multi-tenant Prisma client extension**: all new models inherit org-scoping.
- **`requirePermission` RBAC middleware**: new `admin:boe-rate:write` permission; existing `org:settings:write` gates BACS config.

### Established Patterns
- **Encrypted-plus-masked bank fields** (Phase 56 existing): paired columns, never expose encrypted value via API, always return masked to the client.
- **Pure-function calculation services** (Phase 57 VAT, Phase 58 classification): `calculateLateInterest` + `evaluateSkontoEligibility` follow the same shape — pure, testable, no side effects.
- **Dual-tier audit model** (Phase 60/61/62): mutable parent + append-only events. For Phase 63:
  - `BoEBaseRateHistory` — append-only (unique on `effectiveFrom`), manual edits create new rows.
  - `InvoicePayment` — append-only payment events.
  - `InvoiceInterestClaim` / `SkontoSnapshot` / `SkontoApplication` — append-only audit.
  - `InvoiceInterestWaiver` — mutable only via revocation (sets `revokedAt`; original row preserved).
- **Content-addressed R2 keys with SHA-256**: BACS files, claim letters.
- **Signed URL TTL 300s** across the codebase.
- **Zod at tRPC boundary**: all new router inputs validate.
- **Feature flag gate** via `PAY_*_ENABLED`: BACS UI, late-interest calculations + cron, Skonto UI + XRechnung emission.
- **No `console.*` — Pino (`@contractor-ops/logger`)**.
- **Migration commits separate from code commits** (project convention if visible in git history — confirm during planning).

### Integration Points
- **`PaymentExportFormat` enum extension** — requires a Prisma migration + type regen.
- **`Organization` + `Contractor` + `ContractorBillingProfile`** all grow new encrypted/masked paired columns.
- **`Invoice` model gets derived `paymentStatus`** — existing writes that set `paidAt` must be updated to create an `InvoicePayment` row instead (migration + service-layer refactor).
- **Phase 61 XRechnung generator gets a new BG-20 branch** — Phase 61 is complete; Phase 63's planner MUST coordinate with anyone touching Phase 61 code to avoid merge conflicts. (Currently no other phase in flight that touches xrechnung-de/generator.ts.)
- **`next-intl` messages** — new `Payments` namespace in `apps/web/messages/{de,en-GB,en}.json`.
- **Admin surface** — this phase may introduce the first `/admin/` route area; if so, design a minimal admin shell.
- **Scheduled job infra** — either extend an existing mechanism or propose a new Render cron (decide during research based on what's in place).

</code_context>

<specifics>
## Specific Ideas

- BACS Std 18 is a fixed-width ASCII format — easy to generate but unforgiving about character set and field widths. Modulus check + transliteration run BEFORE fixed-width assembly; if either fails, the user sees the issue in the preview instead of a cryptic bank rejection 2 days later.
- UK sort codes have a modulus-check regime (VocaLink Modulus Checking) with weights that vary by sort-code range. The weights table ships with software; bank validators consume it locally. We don't call a validation API.
- LPCDA is strict about B2B scope — applying statutory interest to consumer debts is a substantive legal error. The `isBusinessCustomer` gate on `Contractor` is the architectural control.
- LPCDA also fixes the applicable BoE rate as "the base rate in effect on the last day of the preceding 6-month period" (§4(1)). For a debt that first fell overdue in March 2026, the rate is whatever BoE had set on 31 Dec 2025. This is non-obvious and the helper function is the right place to encapsulate it.
- Fixed compensation is per-debt, snapshotted at first overdue. If a user later amends an invoice's `totalMinor`, the compensation tier stays frozen — matches statutory intent (you're being compensated for THIS late debt, not some other version of it).
- Partial-payment handling (`InvoicePayment` rows) is a bigger architectural change than it looks — the existing `Invoice.paidAt` single-timestamp model is inadequate for accurate interest accrual on real-world partial payments. Migration is required.
- Skonto's German-language description is load-bearing — it appears on the invoice PDF, in the XRechnung XML, and in customer-facing UI. Treating it as a locked legal phrase (like Phase 56's KleinunternehmerRegelung text) prevents i18n drift.
- XRechnung 3.0.2's structured Skonto extension (`#SKONTO#...#`) is parseable by buyer systems that support it (many do); non-supporting systems fall back to the human German sentence in the same Description field. One generator output serves both.
- SkontoSnapshot persists at payment complete (not at PaymentRun creation) — captures the actual eligibility outcome based on real payment dates, not a speculation based on when the run was queued.
- BoE rate polling cron is daily (MPC meets ~8x/year; rate changes rarely) — cheap to poll; overkill to use a webhook (BoE doesn't provide one).
- The late-interest claim letter is bilingual-ready (German buyers of UK businesses exist), but LPCDA is UK law so the letter is English-primary. GB locked phrases module (`packages/validators/src/legal/gb.ts`) introduced here creates the pattern for future UK-statutory phrase lock-ins.
- PaymentRun stays on the **payables** side in v5.0. Late interest on **receivables** is a separate domain; not integrated into PaymentRun. Future phase may introduce ReceivablesRun.

</specifics>

<deferred>
## Deferred Ideas

- **BACS submission via BACSTEL-IP / Bankline / VocaLink APIs** — v5.0 is file export only; direct submission is a future phase (needs BACS bureau certification).
- **Standard 18 multi-day processing date** — v5.0 uses single processing date per file.
- **CHAPS + Faster Payments formats** — UK alternatives to BACS; deferred.
- **Multi-tier Skonto** (e.g., `3% 7 / 1% 14 / net 30`) — v5.0 is single-tier.
- **Contract-level Skonto templates** — per-invoice + per-billing-profile covers v5.0.
- **Consumer (B2C) debt late interest** — not LPCDA; different statutory regime; out of scope.
- **Automatic BoE rate webhook / push** — BoE doesn't provide; polling is the only path.
- **ReceivablesRun / AR payment tracking** — v5.0 keeps PaymentRun as payables-only.
- **Statutory late-payment interest for non-UK jurisdictions** — DE has BGB §288 (broadly similar), FR has its own regime. Out of scope; per-country later.
- **Interest compounded (monthly / quarterly)** — LPCDA uses simple interest; no compounding.
- **Automated late-payment interest posted to the counterparty via e-invoice** — claim letters + optional secondary invoice cover the need; auto-posting across Peppol is a future phase.
- **UI for editing historical `InvoicePayment` rows** — v5.0 makes them append-only; corrections handled via compensating entries.
- **Admin dashboard for tracking BoE rate poller health** — log-based monitoring for v5.0; dashboard later.
- **FX handling for GBP invoices paid in another currency** — v5.0 assumes invoice currency == payment currency.
- **Partial Skonto (prorated discount on partial payment)** — German commercial practice varies; v5.0 treats Skonto as all-or-nothing at final payment date.
- **i18n of the LPCDA claim letter into DE** — LPCDA is UK law; letter stays in English (GB).

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 63` returned 0 matches.

</deferred>

---

*Phase: 63-uk-payments-financial-features*
*Context gathered: 2026-04-15*
