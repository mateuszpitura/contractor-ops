---
title: US payment rail
type: domain
tags: [payments, ach, nacha, fedwire, pacs008, withholding, usd, plaid, modern-treasury, ach-return]
source_commit: 730cc8e69
source_commit: 1c38ab9d0
verify_with:
  - packages/db/prisma/schema/payment.prisma
  - packages/api/src/services/payment-export.ts
  - packages/api/src/services/payment-format-detection.ts
  - packages/api/src/services/payment-settlement.ts
  - packages/api/src/routers/finance/payment-shared.ts
  - packages/api/src/routers/finance/payment-core.ts
  - packages/api/src/services/ach-return.service.ts
  - packages/api/src/services/tin-match.service.ts
updated: 2026-07-05
---

# US payment rail

> **Do not cite NACHA/Fedwire record layout or withholding rates from wiki alone.** Read the generators + `applyWithholding`.

## Purpose

The US payout rail: how US and cross-border payments settle, and where the withholding that the tax-form surface only *reports* is actually *deducted* from the payout. Adds two US export formats to the existing payment-export factory (hand-rolled NACHA ACH credit file + Fedwire ISO 20022 `pacs.008` XML), makes USD first-class with a per-payout settlement-currency choice, deducts withholding at payment-run item seeding through one jurisdiction-agnostic path, and slots the opt-in programmatic-ACH (Modern Treasury) + Plaid Identity verification behind mock-default, flag-dark seams. The whole surface is gated on `module.us-expansion` + US region.

## Flow

```mermaid
flowchart TD
  seed[seedRunItems] --> wht[applyWithholdingToRun]
  wht -->|per item| decide[applyWithholding: SA WHT / US 24% §3406 / 1042-S treaty]
  decide -->|records whtAmountMinor| item[PaymentRunItem = source of truth]
  item --> export[lockAndExport]
  export --> settle[_buildExportItems: resolveSettlementCurrency + convertForSettlement]
  settle --> detect[detectUsFormat]
  detect -->|USD + US bank| nacha[generateNachaFile ACH_NACHA]
  detect -->|above Same-Day ACH ceiling| fedwire[generateFedwirePacs008 FEDWIRE]
  item -.opt-in.-> payout[payment.initiatePayout]
  payout --> adapter[PayoutInitiationAdapter mock default / live dark]
```

## Withholding: the payment run is the single source of truth

- **One jurisdiction-agnostic deduction.** `applyWithholding` (pure, per item, in `payment-shared.ts`) resolves the deduction by jurisdiction: Saudi cross-border via the unchanged `calculateWht`; US source + `Contractor.backupWithholdingFlagged` → 24% backup withholding (IRC §3406); US source + foreign recipient → the `applyTreaty` rate (30% statutory fallback). One HALF-UP round at the rate; `amountMinor = grossAmountMinor − whtAmountMinor`. Returns `null` (item untouched) for a US domestic recipient, a 0% treaty outcome, or a non-withholding jurisdiction. The SA branch is byte-preserved and regression-guarded.
- **The recorded figure is authoritative.** `applyWithholdingToRun` writes `grossAmountMinor / amountMinor / whtAmountMinor / whtRate / whtTreatyApplied / whtTreatyReference / whtServiceType` per applied item and one `payment_run.withholding_applied` audit row per applied item. The withheld figure recorded on `PaymentRunItem` **is the single source of truth**: the 1099-NEC box-4 and 1042-S box-2 aggregate the year's actual payment-run withholding — the forms never recompute the deduction. The export file carries the net.
- **The flag is a real column, now fed by wired producers.** `createBackupWithholdingFlagWriter` (`tin-match.service.ts`) persists `Contractor.backupWithholdingFlagged` via a tenant-scoped idempotent `updateMany({ id, organizationId })` — the TIN never reaches the write (boolean only). The IRS TIN-match trigger that SETS it is wired at `tax1099.generateBatch` (year-end, via `revalidateYearEndTins`) and `contractor.updateUsProfile` (intake SSN/EIN capture); before that this payout read side was live-but-unfed. The flag is monotonic (set-true only) — clearing a corrected recipient is a separate admin concern, not the writer's remit.

## US export formats

- **`ACH_NACHA`** — `generateNachaFile` (`payment-export.ts`) is hand-rolled on the fixed-width BACS scaffold (zero new dependency): 94-char 1/5/6/8/9 records, entry hash = Σ(first-8-digit RDFI routing) mod 10^10, balanced batch/file control totals, all-9 block padding to a multiple of 10 lines, service class 220 + SEC PPD + transaction code 22 defaults (SEC — PPD/CCD/CTX — and transaction code are parameters), per-record hard-length guard.
- **`FEDWIRE`** — `generateFedwirePacs008` emits an ISO 20022 `pacs.008.001.08` FI-to-FI customer-credit-transfer XML (Fedwire `CLRG`/`FDW` settlement block), mirroring `generateSwiftXml`. It is the message the operator hands to their bank; live FedLine transmission is a deferred bank channel (adviser-verify).
- **Routing.** `detectUsFormat(currency, isUsBank, amountMinor, ceilingMinor)` routes USD + a US bank account → `ACH_NACHA`, and above the Same-Day ACH ceiling → `FEDWIRE`. The ceiling is a dated **config** (`sameDayAchCeilingMinor(asOf)`: $1M before 2027-09-17, $10M on/after), not a baked-in constant; the routing flips at ceiling + 1.
- Both formats are additive `PaymentExportFormat` enum members + `ExportFormat` union members + a `_generateExportFileForFormat` dispatch branch (ext `txt` / `xml`).

## USD + settlement currency

- USD is a normal ECB currency (`EUR→USD` in the feed); `convertAmount` already cross-rates and short-circuits same-currency — there is **no `USD=1.0` short-circuit** (adding one would mask a genuinely missing rate on a holiday).
- `resolveSettlementCurrency({ contractorCurrency, perRunOverride? })` — the per-run override wins, else `Contractor.currency`; a blank override is treated as unset. `convertForSettlement` delegates verbatim to `convertAmount` at the payment-date ECB rate (rate 1 same-currency; `null` on a missing rate — never a silently zeroed payout) and applies a **max-age floor** (`FX_CONVERSION_MAX_AGE_DAYS = 7`): a rate whose observation is older than the floor throws `StaleExchangeRateError` rather than settling at a stale rate. `_buildExportItems` / `_initiatePayoutForRun` settle each item through one `settleItemAmount` helper; both a missing rate and a stale rate surface `UNPROCESSABLE_CONTENT` (`E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE`) — real money never leaves on a zeroed or silently-stale rate.
- **FX provenance columns** (`payment.prisma`): `PaymentRunItem.settlementRate Decimal? @db.Decimal(18,8)` + `settlementRateDate DateTime? @db.Date` — the rate and its source date actually applied to a converted payout, so a settled payout's audit can reconstruct the FX used (`round(amountMinor × settlementRate)`). Nullable/backfill-safe. `_buildExportItems` / `_initiatePayoutForRun` now **stamp** these columns from `settled.rate`/`rateDate` via `persistSettlementProvenance`, gated to a real cross-currency conversion (same-currency rate-1 settlements are skipped — nothing to reconstruct).

## Programmatic ACH + Plaid seams

- **`PayoutInitiationAdapter`** (`packages/integrations/src/adapters/payout/`) — interface + deterministic `MockModernTreasuryAdapter` (GA default, `payment_order` shape, `pending → approved → processing → sent → completed → reconciled` lifecycle) + dark `LiveModernTreasuryAdapter` + `StripeTreasuryAdapter` stub. The live SDK is referenced only in comments (lazy import inside the dark branch); the package builds with **zero external deps**.
- **`PlaidIdentityClient`** (`packages/integrations/src/adapters/plaid/`) — interface (`verify` → VERIFIED/PENDING/FAILED) + deterministic `MockPlaidIdentityClient` (GA default, advisory fail-open — an unverified status carries `advisoryWarning`, never throws/blocks) + dark `LivePlaidIdentityClient`.
- **`payment.verifyBillingProfilePlaid`** (`payment-core.ts`) — the reachable, mock-triggerable **onboarding write path** that makes `ContractorBillingProfile.plaidVerificationStatus` real (so the payout advisory read stops always taking the unverified branch). Same gate as `initiatePayout` (`payment:export` + `assertUsExpansionEnabled`) + tenant-scoped `.strict()` Zod (`billingProfileId`); loads the profile scoped by `{ id, organizationId }` (foreign-org → NOT_FOUND), runs `MockPlaidIdentityClient.verify` against the **masked** US routing/account + `contractor.legalName`, and persists `plaidVerificationStatus` + `plaidVerifiedAt` + `plaidAccountId`. Advisory fail-open — a non-VERIFIED result is written and returned as `{ status, advisoryWarning }`, never throws/blocks; masked audit `contractor_billing_profile.plaid_verified` (billingProfileId + status only). No SDK installed; the live Plaid Link flow stays flag-dark. See [[integrations/plaid]].
- **`payment.initiatePayout`** (opt-in) — `tenantProcedure` + `requirePermission({ payment: ['export'] })` + `assertUsExpansionEnabled` + the `payments.ach-payouts` flag (dark default); `.strict()` Zod (`runId`, `idempotencyKey`, `provider`, optional `settlementCurrency`). The `_initiatePayoutForRun` helper is idempotent (Upstash reserve/complete/clear — no double-pay), reads the per-item Plaid advisory via the exact tenant-scoped `PaymentRunItem.billingProfile.plaidVerificationStatus` include (never `contractor.billingProfiles[]`), settles per item, and writes a masked-only `payment_run.payout_initiated` audit row. The NACHA/Fedwire **file** export remains the always-available GA default; programmatic init is the opt-in automation layer.

## ACH return-code handling

When an RDFI cannot post a credit it returns the entry with an R-code. The file-first GA path: the operator downloads the NACHA return file their bank produced and uploads it.

- **Reachable entry point** — `payment.ingestAchReturnFile` (`payment-core.ts`): same gate as `initiatePayout` (`tenantProcedure` + `requirePermission({ payment: ['export'] })` + `assertUsExpansionEnabled`, applied **before** any parse/apply), `.strict()` Zod (`runId` cuid, `returnFileText` bounded `min(1).max(5_000_000)`). It calls `parseNachaReturnFile` → `applyAchReturns` and returns the `{ failed, advisory, skipped, unmatched }` summary **verbatim**.
- **Disposition** — `mapReturnCodeToStatus` (`ach-return.service.ts`): R01 (insufficient funds), R02 (account closed), R03 (no account) and the rest of the R-family → **FAILED** with a human reason; NOC / C-code corrections → **advisory** (the payout settled; the bank is asking for corrected account details next time) and never fail a payout. An unrecognised non-correction code defaults to FAILED (fail-safe — an unposted credit is never silently treated as settled).
- **Apply** — `applyAchReturns` loads run items tenant-scoped (`where { paymentRunId, organizationId }`), matches each entry `individualId → invoice.invoiceNumber` (fallback `paymentReference`), flips a transitionable matched item (`PENDING/EXPORTED/PAID`) to `status='FAILED' + failureReason`, and writes one masked `payment_run.ach_return_applied` audit row per transition — all inside a single `$transaction`.
- **Idempotent + never-un-fail** — an already-`FAILED` item is skipped, so a re-uploaded / re-delivered file is a no-op and a return can never revert a failure. Today idempotency is **terminal-status-skip only**, which misses a corrected-then-re-run item (FAILED→DRAFT→re-run) being re-flipped by a stale file and re-writes advisory (NOC) audit rows on every upload. The schema backstop is the new **`AchReturnLedgerEntry`** table (`payment.prisma`): a processed entry is keyed `@@unique([paymentRunId, traceNumber, returnCode])` (`ach_return_entry_run_trace_code_uniq`, or `fileSha256` for file-level dedup) so a redelivery short-circuits at entry level and advisory audits dedup. `entryType` distinguishes `RETURN` (addenda-99 R-codes) from `NOTIFICATION_OF_CHANGE` (addenda-98 C-codes). The service that writes/short-circuits on the ledger is a later change set — this migration adds the table + unique.
- **`unmatched` is the operator-safety signal** — a FAILED-disposition entry that matches no live item is counted `unmatched` (never silently dropped). `unmatched:0` = the file applied cleanly to this run; `unmatched > 0` = a wrong-`runId` / mis-uploaded file (a foreign-org run flips nothing — every entry surfaces as unmatched), distinguishable from an indistinguishable all-zeros no-op. A high unmatched proportion logs a warn inside `applyAchReturns`.
- **Malformed vs. benign** — a benign empty / non-return upload parses to zero entries and returns all-zeros without throwing; a file that carries return addenda-99 records yet parses to nothing is structurally broken and rejected `BAD_REQUEST` (`E.PAYMENT_ACH_RETURN_FILE_INVALID`). The procedure also writes a masked ingestion-summary audit (`payment_run.ach_return_ingested`) carrying only sizes + the disposition tallies — no bank data, no raw file text.
- **Deferred seam** — the live Modern Treasury return-webhook (`PayoutInitiationAdapter.handleWebhook`) would feed the same `applyAchReturns` once the programmatic-ACH live path is enabled; it is referenced, not built (programmatic ACH stays dark/opt-in), so file upload is the only reachable return path today.

## Entry points

| Piece | Path |
|-------|------|
| Withholding deduction | `routers/finance/payment-shared.ts` — `applyWithholding`, `applyWithholdingToRun` |
| Backup-withholding flag writer | `services/tin-match.service.ts` — `createBackupWithholdingFlagWriter` |
| NACHA / Fedwire generators | `services/payment-export.ts` — `generateNachaFile`, `generateFedwirePacs008` |
| US format routing | `services/payment-format-detection.ts` — `detectUsFormat`, `sameDayAchCeilingMinor` |
| Settlement currency + FX | `services/payment-settlement.ts` — `resolveSettlementCurrency`, `convertForSettlement` |
| Export-item settlement wiring | `routers/finance/payment-shared.ts` — `_buildExportItems` |
| Opt-in payout | `routers/finance/payment-core.ts` — `payment.initiatePayout` → `_initiatePayoutForRun` |
| Plaid onboarding verify (write) | `routers/finance/payment-core.ts` — `payment.verifyBillingProfilePlaid` → `MockPlaidIdentityClient.verify` → persists `ContractorBillingProfile.plaidVerificationStatus` |
| ACH return-file ingestion | `routers/finance/payment-core.ts` — `payment.ingestAchReturnFile` → `parseNachaReturnFile` + `applyAchReturns` (`services/ach-return.service.ts`) |
| Payout / Plaid seams | `packages/integrations/src/adapters/payout/`, `packages/integrations/src/adapters/plaid/` |

## UI surface

No dedicated new staff screen in this rail — the payout run + lock/export flow lives under `apps/web-vite/src/components/payments/`. Any US payout/verification strings honour i18n parity (en/de/pl/ar). The Plaid advisory surfaces as a warning, not a blocking gate.

## Invariants

- **`PaymentRunItem.whtAmountMinor` is the single source of truth** for the withheld amount — forms aggregate it, never recompute.
- One withholding path for all jurisdictions (SA WHT + US §3406 24% + 1042-S treaty); SA branch preserved verbatim.
- NACHA is hand-rolled, zero-dependency; Fedwire is `pacs.008` XML, not the retired FAIM flat file.
- Same-Day ACH ceiling is dated config, not a constant.
- Settlement FX is a single HALF-UP round via `convertAmount`; a missing **or** stale rate (older than the `FX_CONVERSION_MAX_AGE_DAYS = 7` floor) throws, never zeroes; the applied rate + as-of date are persisted onto `PaymentRunItem` for provenance. See [[patterns/money-rounding]].
- Programmatic ACH + live Plaid are mock-behind-seam, flag-dark; Plaid is advisory fail-open. Bank routing/account are AES-256-GCM encrypted + masked-only; never logged full.
- Whole surface gated on `module.us-expansion` + US region; programmatic ACH additionally behind `payments.ach-payouts`.
- ACH returns are ingested through the reachable `payment.ingestAchReturnFile` (R01/R02/R03 → FAILED + reason; NOC/COR → advisory), idempotent + masked-audited; the returned `unmatched` count distinguishes a mis-uploaded / wrong-run file from a clean no-bounce run. The live return-webhook is a documented deferred seam.

## Related

- [[domains/payments-and-bank-files]]
- [[domains/tax-and-wht]]
- [[domains/us-tax-forms]]
- [[integrations/modern-treasury]]
- [[integrations/plaid]]
- [[patterns/money-rounding]]
- [[patterns/feature-flags]]

## Verify live

```bash
semble search "generateNachaFile"
semble search "applyWithholding"
semble search "detectUsFormat"
grep -n "initiatePayout" packages/api/src/routers/finance/payment-core.ts
grep -n "ingestAchReturnFile" packages/api/src/routers/finance/payment-core.ts
semble search "applyAchReturns"
```

## Agent mistakes

- Recomputing withholding in the 1099/1042-S forms instead of aggregating the recorded `PaymentRunItem.whtAmountMinor`.
- Adding a `USD=1.0` short-circuit — USD is already a normal ECB currency; a short-circuit would mask a missing rate.
- Baking the Same-Day ACH ceiling in as a constant instead of reading `sameDayAchCeilingMinor(asOf)`.
- Importing a third-party NACHA package — the generator is hand-rolled on purpose (supply-chain floor).
- Reading Plaid status via `contractor.billingProfiles[]` instead of the tenant-scoped `PaymentRunItem.billingProfile.plaidVerificationStatus` include.
- Treating Plaid as a hard gate — it is advisory fail-open while mocked.
- Treating `ingestAchReturnFile`'s all-zeros result and its `unmatched > 0` result as the same "nothing happened" — `unmatched > 0` means the file did not match this run (wrong-run / mis-upload), not a clean no-bounce run.
- Building the live Modern Treasury return-webhook — it is a deferred seam; the reachable path is the operator's NACHA return-file upload.
- Dropping the `unmatched` field when surfacing the result — it is the operator's "did this file apply to the right run?" signal.
