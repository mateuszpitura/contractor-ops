# Phase 88 — US Payment Rail: Gap-Closure Scope

**Drafted:** 2026-07-01 (main-session diagnosis, post verification `gaps_found`)
**Feeds:** `/gsd:plan-phase 88 --gaps` → `/gsd:execute-phase 88 --gaps-only`
**Source of truth for the failure:** `88-VERIFICATION.md` (SC#1 + SC#4 FAIL). This doc adds precise file:line scope + a correction to the verifier's framing.

## Correction to the verification framing

The verifier called NACHA/Fedwire "structurally unreachable" — TRUE at the entry level, but the downstream stack is **already complete**, so the fix is much narrower than "build the US export path":

- ✅ **Generators done + unit-tested:** `generateNachaFile` (`packages/api/src/services/payment-export.ts:911`, hand-rolled zero-dep NACHA), `generateFedwirePacs008` (`payment-export.ts:393`, pacs.008.001.08). Tests: `payment-export-nacha.test.ts`, `payment-export-fedwire.test.ts`.
- ✅ **Serializer dispatch already branches on both:** `_generateExportFileForFormat` (`packages/api/src/routers/finance/payment-shared.ts:248-262`) has `ACH_NACHA` → `generateNachaFile(...toNachaItem/toNachaOrgBank)` and `FEDWIRE` → `generateFedwirePacs008`.
- ✅ **Prisma enum has the members:** `PaymentExportFormat { … ACH_NACHA, FEDWIRE }` (`packages/db/prisma/schema/payment.prisma:168-169`).
- ✅ **`detectUsFormat` exists + unit-tested:** `payment-format-detection.ts:193` (USD + US bank → amount ≤ Same-Day ACH ceiling ⇒ `ACH_NACHA`, else `FEDWIRE`).
- ✅ **`ExportItem` already carries US fields:** `usRoutingNumber?` / `usAccountNumber?` (`payment-export.ts:36-37`).

So the reachability failure = exactly **two missing wires**, plus one genuinely net-new feature.

## GAP A — enum mirror blocks the input (SMALL, ~1 line + test)

**Defect:** `paymentExportFormatEnum` (`packages/validators/src/payment.ts:50`) = `z.enum(['CSV','BANK_FILE','SEPA_XML','SWIFT_XML'])` — never mirrored the Prisma enum's `ACH_NACHA`/`FEDWIRE`. It feeds `lockAndExport`'s input (`exportFormat: paymentExportFormatEnum`, `payment.ts:77`), so any caller requesting a US format is rejected at Zod validation.

**Fix:** add `'ACH_NACHA', 'FEDWIRE'` to the enum. Update the comment (line 5 "Prisma enum mirrors"). Add a validator test asserting parity with the Prisma `PaymentExportFormat` enum so this can't drift again.

**Files:** `packages/validators/src/payment.ts:50` (+ test).

## GAP B — US format never assigned by the detection path (MEDIUM)

**Defect:** `detectUsFormat` has zero production callers. The routing entry points — `detectFormat` (`payment-format-detection.ts:132`), `detectFormatForDestination` (`:159`), and `groupItemsByFormat` (`:210`, which calls `detectFormat`) — only ever return `BANK_FILE|SEPA_XML|SWIFT_XML|BACS_STD18`. A USD payout to a US bank falls through to `SWIFT_XML`, so ACH_NACHA/FEDWIRE are never selected even though the serializer + generators handle them.

**Fix:**
1. Thread `detectUsFormat` into `detectFormatForDestination` (`:159`) **before** the IBAN fallback — needs an `isUsBank` signal + `amountMinor` + the Same-Day ACH ceiling (`sameDayAchCeilingMinor` — already referenced by `detectUsFormat`'s doc) on the `Destination`/call. Precedence: BACS (GBP) → **US (USD + US bank)** → Elixir/SEPA/SWIFT.
2. `groupItemsByFormat` (`:210`) must group US items by the US format too — today it calls the currency+IBAN `detectFormat` which can't see US bank fields or amount; switch it to the destination-aware path (or add the US branch) so a mixed run splits ACH_NACHA vs FEDWIRE vs SEPA/SWIFT batches correctly.
3. Verify `lockAndExport` (`packages/api/src/routers/finance/payment-export-router.ts`) passes the selected format through to `_generateExportFileForFormat` unchanged once Gap A lands (it already dispatches by string).

**Files:** `packages/api/src/services/payment-format-detection.ts` (`detectFormatForDestination` :159, `groupItemsByFormat` :210), `packages/api/src/routers/finance/payment-export-router.ts`, `payment-shared.ts` (confirm the item mapping surfaces US routing/account decryption into `ExportItem.usRoutingNumber/usAccountNumber`).

**Test:** an end-to-end lock+export test proving a USD-to-US-bank run produces a NACHA file (≤ ceiling) and a Fedwire pacs.008 (> ceiling), mirroring the existing BACS export test.

## GAP C — ACH return-code (R01/R02/R03) handling (LARGE, net-new)

**Defect:** zero implementation anywhere (grep for `R01|R02|R03|returnCode|achReturn` finds only unrelated UAE-NOC hits). Named in SC#1 + `88-CONTEXT`. Without it, a bounced ACH credit never flips its `PaymentRunItem` back to FAILED/retry.

**Scope (needs its own research/design — do NOT one-shot):**
- Ingestion entry point: manual NACHA return-file upload vs Modern Treasury return webhook (the adapter seam from 88-06 is the natural home; today `initiatePayout` is fire-only).
- R-code taxonomy → status mapping: R01 (insufficient funds) / R02 (account closed) / R03 (no account) → `PaymentRunItem.status = FAILED` + reason; NOC (C-codes) → correction advisory, not a failure.
- Idempotent apply + `writeAuditLog` on each status transition; addenda parsing.
- Decision: implement in v7.0 gap-closure, or **explicitly defer to v7.5** (like e-ZLA/eAU) with a documented seam. Given solo-founder scope + local-only posture, deferring C with a seam is defensible — but that must be a recorded decision, not a silent drop.

## Secondary (verifier WARNINGs — human decision, not auto-fix)
- Plaid onboarding-time verification has no prod caller (only payout-time advisory read). Decide: wire at onboarding or keep advisory-only.
- tin-match backup-withholding writers have zero callers → `Contractor.backupWithholdingFlagged` can't become `true`. Decide: wire the writer or defer.

## NOT gaps (deferred-by-design — see `deferred-items.md`)
- Live Modern Treasury / Plaid / Stripe SDK installs (dark-live seams present).
- Multi-region prod migration apply (additive migration staged; local-only posture).

## Suggested plan shape for `--gaps`
- **Wave 0:** RED tests — enum-parity + US-detection routing + end-to-end lock/export (NACHA + Fedwire).
- **Wave 1:** Gap A (enum mirror) + Gap B (thread `detectUsFormat` + group-by-format + item US-field mapping) → SC#1/SC#4 reachable + green.
- **Wave 2:** Gap C decision — either implement return-code ingestion (own plan) OR record the v7.5 defer with the seam. Then re-verify.
