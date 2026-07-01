# Phase 88: Theme A — US Payment Rail - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 14 (8 new, 6 modified)
**Analogs found:** 14 / 14 (every surface has a strong in-tree analog — this phase is a factory extension + a generalization + two mock-behind-seam adapters, NOT greenfield)

> **Two load-bearing risk flags for the planner (carried from RESEARCH):**
> 1. **SA-WHT regression.** D-01 generalizes `_applyWhtIfSaudi`. The existing SA branch (`payment-shared.ts:282-325`) MUST keep byte-identical behavior — same `calculateWht` call, same `whtServiceType:'technical_services'`, same `invoice.withholdingMinor` write. Add the US branches *around* the SA path; do not rewrite it. Regression-test the SA path (RESEARCH Test Map D-01).
> 2. **`[ASSUMED]` packages → human-verify gate.** `modern-treasury@4.18.0` and `plaid@42.2.0` were NOT slopcheck-verified (no network at research time). The GA floor (NACHA/Fedwire files + deterministic mock adapters) needs **zero** external packages. Any SDK install MUST be gated behind a `checkpoint:human-verify` task (7-day-release-age + typosquat). `@midlandsbank/node-nacha` is **not recommended** (no exposed source repo) — hand-roll NACHA.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/api/src/services/payment-export.ts` (MODIFY: `+generateNachaFile`, `+generateFedwirePacs008`) | service / generator | transform (pure fn) | `generateBacsStandard18` (NACHA) + `generateSwiftXml` (Fedwire), same file | exact |
| `packages/api/src/services/payment-format-detection.ts` (MODIFY: `+ACH_NACHA`/`+FEDWIRE` union, `+detect rule`) | service | transform | `detectFormat` / `detectFormatForDestination` same file | exact |
| `packages/api/src/routers/finance/payment-shared.ts` (MODIFY: generalize `_applyWhtIfSaudi`→`applyWithholding`; `+NACHA/FEDWIRE` dispatch) | router-helper / service | DB-mutation in tx | `_applyWhtIfSaudi` + `_generateExportFileForFormat`, same file | exact |
| `packages/api/src/services/withholding.service.ts` (NEW — *optional*, if extracted from payment-shared) | service | transform + DB read | `tax-rate.service.ts` `calculateWht` + `treaty-rate.service.ts` `applyTreaty` | role-match |
| `packages/api/src/services/exchange-rate.ts` (MODIFY: USD guard test only — F-1) | service | request-response (rate lookup) | `convertAmount` / `getRate` same file (already handles USD) | exact |
| `packages/api/src/services/tin-match.service.ts` (MODIFY: wire `setBackupWithholdingFlag` to new column) | service | DB-mutation | `createDbTinMatchPersistence` writers, same file | exact |
| `packages/integrations/src/adapters/modern-treasury-adapter.ts` (NEW) | adapter / client-seam | request-response (mock) + event (webhook) | `tin-match/{tin-match-client,mock-tin-match-client}.ts` seam | role-match (mock-behind-seam) |
| `packages/integrations/src/adapters/stripe-treasury-adapter.ts` (NEW — stub) | adapter | request-response (stub) | Modern Treasury adapter (this phase) | role-match |
| `packages/integrations/src/adapters/plaid-adapter.ts` (NEW) | adapter / client-seam | request-response (mock) | `tin-match` seam + `credential-service.ts` | role-match (mock-behind-seam) |
| `packages/db/prisma/schema/payment.prisma` (MODIFY: `+ACH_NACHA`/`+FEDWIRE` enum) | model / migration | n/a | `enum PaymentExportFormat` same file | exact |
| `packages/db/prisma/schema/contractor.prisma` (MODIFY: `+Contractor.backupWithholdingFlagged`; `+US routing/account`; `+Plaid fields`) | model / migration | n/a | `Contractor.uspsVerified` (bool flag) + `ContractorBillingProfile.uk*Encrypted/Masked` | exact |
| `packages/feature-flags/src/flags-core.ts` (REUSE `payments.ach-payouts`; maybe `+1-2 PENDING`) | config | n/a | `payments.ach-payouts` (already registered) + `module.us-expansion` | exact |
| `apps/api` payout-init tRPC procedure (MODIFY/NEW in finance router) | controller | request-response (mutation) | `paymentExportRouter.lockAndExport` + `runExportTransaction` | exact |
| `packages/api/src/services/__tests__/payment-export-{nacha,fedwire}.test.ts` + `*-adapter.test.ts` (NEW) | test | n/a | `payment-export-swift.test.ts` / `payment-export.test.ts` | exact |
| `packages/api/src/services/ach-return.service.ts` (NEW — Gap C) | service / parser + status-transition | untrusted-file parse → DB-mutation in tx | `_initiatePayoutForRun` (`payment-shared.ts:702` — tenant-scoped load + per-item update + masked audit) + `generateNachaFile` layout (parser mirror) + `audit-writer.ts` `writeAuditLog` | role-match |
| `packages/api/src/routers/finance/payment-core.ts` (MODIFY: `+ingestAchReturnFile` — Gap C; `+verifyBillingProfilePlaid` — Plaid onboarding) | controller / tRPC mutation | request-response (mutation) | `initiatePayout` gating + audit shape (same file, `:364-406`) + `bacs.ts:230-231` decrypt precedent (Plaid masked-field read) | exact |
| `packages/api/src/routers/finance/__tests__/{payment-ach-return,payment-plaid-onboarding}.test.ts` (NEW) | test | n/a | `payment-payout-init.test.ts` (fake-db + tRPC caller harness) | exact |

---

## Pattern Assignments

### `payment-export.ts` → `generateNachaFile()` (service, transform — mirror BACS)

**Analog:** `generateBacsStandard18` (`payment-export.ts:513-679`) — the fixed-width, control-total, hand-set-ODFI template. **Do NOT mirror the XML generators for NACHA; NACHA is fixed-width like BACS.**

**Fixed-width helpers to reuse verbatim** (`payment-export.ts:471-488`):
```typescript
function padField(value: string, len: number): string { return value.padEnd(len, ' ').slice(0, len); }
function padZero(value: string, len: number): string { return value.padStart(len, '0'); }
// bacsField() transliterates to safe ASCII + pads — reuse the shape for NACHA name fields.
```

**Control-total + hard-length-guard pattern to copy** (`payment-export.ts:545-608`):
```typescript
let totalAmount = 0;
const detailLines: string[] = [];
for (const item of items) {
  if (item.amountMinor < 0 || item.amountMinor >= MAX) throw new Error(`...amount overflow...`);
  totalAmount += item.amountMinor;
  const detail = buildDetailRecord({ ... });
  if (detail.length !== BACS_DETAIL_RECORD_LEN) {        // ← the hard guard to copy for NACHA's 94-char check
    throw new Error(`detail record length mismatch — got ${detail.length}, expected ${...}`);
  }
  detailLines.push(detail);
}
const allLines = [vol1, hdr1, hdr2, uhl1, ...detailLines, eof1, eof2, utl1];
const fileBuffer = Buffer.from(allLines.join('\r\n'), 'ascii');
```

**What to copy:** the `BACS_*_RECORD_LEN` constants pattern (→ `NACHA_RECORD_LEN = 94`), per-record `padField`/`padZero` builders, the `detail.length !== N` hard-throw, the `totalAmount` accumulator, the ASCII `Buffer.from(...join('\r\n'))` assembly, and the warnings-aggregation return shape (`BacsGenerateResult`).
**What differs (NACHA-specific, RESEARCH Pattern 2):** record-type prefix codes `1/5/6/7/8/9`; **entry hash** = Σ(first 8 digits of each RDFI routing) mod 10^10 (NEW — no BACS analog); **block padding** to a multiple of 10 lines with all-`9` records (NEW — BACS has no blocking factor); SEC code (PPD/CCD/CTX), transaction code (22/32), effective-entry-date (YYMMDD). Default **unbalanced credit-only, service class 220, SEC=PPD** (RESEARCH A2/A3 — adviser/ODFI-verify). Add a known-good fixture test for hash/total/blocking (RESEARCH Wave 0).
**Real domain IDs allowed in comments:** PPD, CCD, CTX, R01, service class 220, txn code 22/32. **No** `Phase 88` / `US-PAY-01` / `D-10` breadcrumbs.

---

### `payment-export.ts` → `generateFedwirePacs008()` (service, transform — mirror SWIFT)

**Analog:** `generateSwiftXml` (`payment-export.ts:305-366`) — already an ISO 20022 `pain.001.001.09` XML builder.

**Imports / helper pattern** (`payment-export.ts:105-112` `escapeXml`, `:98-100` `minorToDecimal`): reuse `escapeXml`, `minorToDecimal(amount, currency)`, the `items.reduce((s,i)=>s+i.amountMinor,0)` control sum, and the per-tx `endToEndId` build.
**Core XML template to copy** (`payment-export.ts:339-365`): the `<?xml ...?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:...">` envelope, `<GrpHdr>` (MsgId/CreDtTm/NbOfTxs/CtrlSum), `<PmtInf>`, `<Dbtr>/<DbtrAcct>/<DbtrAgt>` and per-item `<CdtTrfTxInf>`.
**What differs (RESEARCH Pattern 3 / F-2):** message type is `pacs.008.001.xx` (customer credit transfer) NOT `pain.001.001.09`; add the ISO 20022 Business Application Header envelope; **mark adviser-verify** (live FedLine transmission is a bank channel, deferred — the export is the pacs.008 the operator hands to their bank). FAIM file retired 2025-07-14 — do not produce a legacy flat file.

---

### `payment-format-detection.ts` → `ACH_NACHA` / `FEDWIRE` routing (service, transform)

**Analog:** `detectFormatForDestination` (`payment-format-detection.ts:125-144`) — the destination-aware router that checks a more-specific rail (BACS) *before* the IBAN fallback.

**Union extension point** (`payment-format-detection.ts:66`):
```typescript
export type ExportFormat = 'SEPA_XML' | 'SWIFT_XML' | 'BANK_FILE' | 'CSV' | 'BACS_STD18';
// → add 'ACH_NACHA' | 'FEDWIRE'
```
> **Critical (RESEARCH Standard Stack):** this string union is **separate** from the Prisma `PaymentExportFormat` enum (`payment.prisma:159`). BOTH must gain `ACH_NACHA` + `FEDWIRE`.

**Routing rule to add (RESEARCH Code Examples — threshold is CONFIG not constant):**
```typescript
// USD + US bank + US region → ACH_NACHA; above the Same-Day-ACH ceiling → FEDWIRE.
// Ceiling: 1_000_000_00 cents now; 10_000_000_00 from 2027-09-17 — a config value, NOT a constant.
if (currency !== 'USD' || !isUsBank) return null;
return amountMinor > sameDayCeilingMinor ? 'FEDWIRE' : 'ACH_NACHA';
```
**What differs:** the existing `detectFormat(currency, iban)` keys on IBAN country; US ACH keys on routing+account (no IBAN) + amount threshold + region gate (`module.us-expansion`). Follow `detectFormatForDestination`'s "check the specific rail first" ordering.

---

### `payment-shared.ts` → generalize `_applyWhtIfSaudi` → `applyWithholding` (service, DB-mutation in tx) — **HIGHEST REGRESSION RISK**

**Analog:** `_applyWhtIfSaudi` (`payment-shared.ts:282-325`) — the function to widen. **Keep the SA branch behavior identical.**

**Existing SA path (preserve exactly)** (`payment-shared.ts:294-324`):
```typescript
const items = await tx.paymentRunItem.findMany({
  where: { paymentRunId },
  include: { contractor: { select: { countryCode: true } } },
});
for (const item of items) {
  const whtResult = await calculateWht(org.countryCode, item.contractor.countryCode, 'technical_services', item.amountMinor);
  if (!whtResult) continue;
  await tx.paymentRunItem.update({ where: { id: item.id }, data: {
    grossAmountMinor: item.amountMinor,
    amountMinor: whtResult.netAmountMinor,
    whtAmountMinor: whtResult.whtAmountMinor,
    whtRate: whtResult.whtRate,
    whtTreatyApplied: whtResult.treatyApplied,
    whtTreatyReference: whtResult.treatyReference,
    whtServiceType: 'technical_services',
  }});
  await tx.invoice.update({ where: { id: item.invoiceId }, data: { withholdingMinor: whtResult.whtAmountMinor } });
}
```

**Generalization shape (RESEARCH Pattern 1 — add branches AROUND the SA path, single HALF-UP round):**
```typescript
// per item, resolve rate by jurisdiction:
//   SA org → calculateWht (UNCHANGED — the existing branch)
//   US + contractor.backupWithholdingFlagged → 24% flat (IRC §3406; verify rate at execution — A1)
//   US + foreign recipient (1042-S) → applyTreaty({ contractorResidency }).rate  (30% statutory fallback)
const whtAmountMinor = Math.round((grossAmountMinor * rate) / 100); // ONE HALF-UP round — never chain (Pitfall 2)
```
**Rate sources to wire (already in tree):**
- `calculateWht` (`tax-rate.service.ts:104-146`) — SA path, returns `{whtAmountMinor, netAmountMinor, whtRate, treatyApplied, treatyReference, rateSource}`, already `Math.round((gross*rate)/100)`.
- `applyTreaty` (`treaty-rate.service.ts:144-175`) — returns `TreatyDecision.rate` (percent) + `.article`, NOT an amount. Bridge `rate→amount` with the same `Math.round` (RESEARCH Code Example).
- `Contractor.backupWithholdingFlagged` (NEW column) — read in the seeding `include`.

**Call site (unchanged)** (`payment-shared.ts:154-155`): still invoked from `seedRunItems` after `createMany`, before the invoice `IN_RUN` flip.
**What differs:** add `backupWithholdingFlagged` to the contractor `select`; branch on org/region + flag/foreign-recipient; the SA `if (org.countryCode !== 'SA') return;` early-return (`:292`) becomes a jurisdiction dispatch. **D-02 invariant:** the written `whtAmountMinor` is the single source of truth — `computeBox4Minor` (`form-1099-nec.service.ts:221-225`) already takes `recordedBackupWithholdingMinor` as an **input** (`Math.max(0, Math.trunc(...))`), so do NOT recompute in the forms.

---

### `payment-shared.ts` → `_generateExportFileForFormat` dispatch (service)

**Analog:** `_generateExportFileForFormat` (`payment-shared.ts:187-203`):
```typescript
if (format === 'CSV')       return { fileBuffer: await generateCsv(exportItems), ext: 'csv' };
if (format === 'BANK_FILE') return { fileBuffer: generateElixir(exportItems, orgBank), ext: 'txt' };
if (format === 'SWIFT_XML') return { fileBuffer: generateSwiftXml(exportItems, orgBank, runRef), ext: 'xml' };
return { fileBuffer: generateSepaXml(exportItems, orgBank, runRef), ext: 'xml' };
```
**What to add:** `if (format === 'ACH_NACHA') return { fileBuffer: generateNachaFile(...), ext: 'txt' }` and `if (format === 'FEDWIRE') return { fileBuffer: generateFedwirePacs008(...), ext: 'xml' }`. Note BACS routes through a separate path (returns a richer `BacsGenerateResult` with warnings) — NACHA may need the same warning-aggregation treatment; check the caller in `payment-export-router.ts`.

---

### `exchange-rate.ts` → USD settlement (service, request-response) — **F-1 correction**

**Analog:** `convertAmount` (`exchange-rate.ts:268-321`) — already cross-rates through EUR and short-circuits same-currency:
```typescript
if (fromCurrency === toCurrency) return { amountMinor, rate: 1, rateDate: date ?? new Date() };
// ... EUR cross-rate ... single HALF-UP: const convertedAmount = Math.round(amountMinor * combinedRate);
```
**What to do (RESEARCH F-1 / Pitfall 3):** USD is **already** in the ECB feed (`EUR→USD` stored) and `convertAmount` already handles it. Do **NOT** add a "USD=1.0 short-circuit because USD is absent from ECB" — the premise is wrong and could mask a real missing-rate-on-holiday null. **Add a USD guard test only** (RESEARCH Test Map US-PAY-02): assert `convertAmount(usd→usd)=rate 1`, `usd↔eur` uses the real stored rate, and a missing rate returns `null` (not 1.0). Per-payout settlement currency (D-07) = `Contractor.currency` default, FX at payment-date ECB rate — reuse `convertAmount` exactly as the P86 box-1 path does.

---

### `tin-match.service.ts` → wire `setBackupWithholdingFlag` (service, DB-mutation) — closes the P86 loose end

**Analog:** `createDbTinMatchPersistence` (`tin-match.service.ts:290-309`) — the production persistence builder. The `setBackupWithholdingFlag` port (`:79-86`, `:268-282`) is currently caller-supplied and **unwired to a column** (the flag lives only in `TaxFormSubmission.snapshotJson`).
**What to do (D-03):** implement `setBackupWithholdingFlag` to `tx.contractor.update({ where:{id:recipientId}, data:{ backupWithholdingFlagged: true }})` (idempotent set). Keep the **advisory, never-block** posture (`:194-220`) and the **last-4-only PII discipline** (`:38-39`, `:305` `metadata:{responseIndicator, tinLast4}`) — never log a full TIN/SSN.
**Backfill decision (RESEARCH Open Q1 / Runtime State):** existing snapshot-flagged contractors read `false` from the new column until backfilled. Planner decides forward-only vs a one-time migration reading the latest snapshot per contractor (low row counts → backfill is cheap).

---

### `modern-treasury-adapter.ts` + `stripe-treasury-adapter.ts` + `plaid-adapter.ts` (adapter, mock-behind-seam)

**Primary analog:** the **`tin-match` client seam** (`tin-match/tin-match-client.ts:43-45` interface + `mock-tin-match-client.ts:29-43` deterministic mock + `eservices-tin-match-client.ts` live-dark) — NOT `BaseAdapter`. RESEARCH explicitly notes `BaseAdapter` (`base-adapter.ts:42`) is OAuth/sync-shaped (`IntegrationConnection`, `getHealthStatus`); payout-init + Plaid verification are a different lifecycle. **Define a focused `PayoutInitiationAdapter` interface (`initiatePayout`, `getPayoutStatus`, optional `handleWebhook`) and a `PlaidIdentityClient` interface, then a deterministic mock + a flag-dark live concrete — mirroring tin-match.**

**Seam interface pattern to copy** (`tin-match/tin-match-client.ts:43-45`):
```typescript
export interface TinMatchClient { match(input: TinMatchInput): Promise<TinMatchResult>; }
// → export interface PayoutInitiationAdapter { initiatePayout(...): Promise<PayoutResult>; getPayoutStatus(...): ...; }
```
**Deterministic mock pattern to copy** (`mock-tin-match-client.ts:29-42`): pure function of input, fixed fixture map, no network, no randomness, same input → same output. Shape the mock to the **documented live object** (RESEARCH Pitfall 4): Modern Treasury `payment_order` + webhook status enum `pending→…→reconciled`; Plaid `/auth/get` + `/identity/match` score.
**Credential encryption (reuse, do not hand-roll)** (`credential-service.ts:42-83`): AES-256-GCM `iv:authTag:ciphertext`, per-provider key `${SLUG_UPPER}_ENCRYPTION_KEY`. New env vars `MODERN_TREASURY_ENCRYPTION_KEY`, `PLAID_ENCRYPTION_KEY` → `.env.example` + package `env.ts` (CLAUDE.md). Live SDK call goes *inside* the live concrete only, behind the flag.
**Live-client auth (live path only, re-verify when activating — A5/A6):** Modern Treasury HTTP Basic (Org-ID user / API-key pass), `POST /payment_orders {type:'ach', direction:'credit', ...}`; Plaid Link-token → `public_token` exchange. Both `[ASSUMED]` SDKs — install only behind `checkpoint:human-verify`.
**Registration:** if registered like other adapters, follow `adapters/register-all.ts` (the existing aggregator). Stripe Treasury = a stub concrete implementing the same interface.

---

### `payment.prisma` + `contractor.prisma` (model / migration)

**`payment.prisma` enum** (`:159-168`):
```prisma
enum PaymentExportFormat { CSV BANK_FILE SEPA_XML SWIFT_XML MT940 XML API_PUSH BACS_STD18 }
// → add ACH_NACHA, FEDWIRE
```
`PaymentRunItem` WHT fields already exist (`payment.prisma:49-54`: `whtAmountMinor`, `whtRate @db.Decimal(5,2)`, `whtTreatyApplied`, `whtTreatyReference @db.VarChar(100)`, `whtServiceType @db.VarChar(50)`, `grossAmountMinor`) — **no migration for the deduction substrate.**

**`contractor.prisma` — boolean flag analog** (`Contractor.uspsVerified Boolean?` `:46`, `isPublicSectorBuyer Boolean @default(false)` `:52`): add `backupWithholdingFlagged Boolean?` (additive-nullable, zero data migration; D-03 stores against `Contractor`, not `Worker` — re-point after Phase 89).

**`contractor.prisma` — encrypted+masked bank-field analog** (`ContractorBillingProfile.uk*` `:161-164`):
```prisma
ukSortCodeEncrypted      String?
ukSortCodeMasked         String?
ukAccountNumberEncrypted String?
ukAccountNumberMasked    String?
// → add usRoutingNumberEncrypted/Masked + usAccountNumberEncrypted/Masked (same AES-256-GCM pattern, D-12)
```
**Plaid status fields (D-08)** on `ContractorBillingProfile`: `plaidVerificationStatus` (VERIFIED/PENDING/FAILED — enum or String), `plaidVerifiedAt DateTime?`, `plaidAccountId String?`. Mirror the `uspsVerified`/`uspsValidatedAt` advisory pattern (`Contractor:46-47`).
**No breadcrumb IDs in schema comments** beyond what's there — keep real domain IDs (AES-256-GCM, §3406) only.

---

### Payout-init tRPC procedure (controller, request-response mutation)

**Analog:** `paymentExportRouter.lockAndExport` (`payment-export-router.ts:192-351`) + `runExportTransaction` (`:105-149`).

**Atomic-transition guard to copy** (`payment-export-router.ts:115-140`) — prevents double-pay across pods:
```typescript
const transition = await tx.paymentRun.updateMany({
  where: { id: params.run.id, organizationId: params.organizationId, status: { in: ['DRAFT', 'LOCKED'] } },
  data: { status: 'EXPORTED', ... },
});
if (transition.count !== 1) { /* idempotent — another caller advanced it; skip row creation */ }
```
**Audit pattern to copy** (`payment-export-router.ts:68-84`): `writeAuditLog({ tx, organizationId, actorType:'USER', actorId, action:'payment_run.lock_and_export', resourceType:'PAYMENT_RUN', resourceId, oldValues, newValues })`.
**Permission + tenant guard** (`:193-195`): `tenantProcedure.use(requirePermission({ payment: ['export'] })).input(zodSchema)`.
**What differs:** the programmatic-ACH init swaps the file tail for the `PayoutInitiationAdapter` (D-04/D-05) and additionally wraps with `lib/idempotency.ts` `reserve/complete/clear` (see Shared Patterns) + `assertUsExpansionEnabled` + the `payments.ach-payouts` flag. Live init is dark.

---

### `ach-return.service.ts` + `payment-core.ts` return/verify procedures (Gap C + Plaid onboarding)

**`ach-return.service.ts` (NEW — service, parser + idempotent status-transition):** hand-rolled NACHA return-file parser (mirrors the fixed-width column offsets of `generateNachaFile`, `payment-export.ts`, so the parser reads a file the generator could emit) + `mapReturnCodeToStatus` (R01/R02/R03 → FAILED, NOC/COR → advisory) + `applyAchReturns`. The apply layer mirrors `_initiatePayoutForRun` (`payment-shared.ts:702`) — tenant-scoped `findMany`, per-item `update`, one masked `writeAuditLog` per transition, all inside a single `db.$transaction`. Idempotent (an already-FAILED-with-this-code item is skipped) and returns `{ failed, advisory, skipped, unmatched }` where `unmatched` distinguishes a mis-uploaded/wrong-run file from a clean no-bounce run (operator-safety signal; a high unmatched proportion logs a warn via `@contractor-ops/logger`, counts only). No external NACHA parser dependency.

**`payment-core.ts` `ingestAchReturnFile` (MODIFY — controller, tRPC mutation):** the reachable return-file entry point — mirrors `initiatePayout`'s gate (`:364-406`: `tenantProcedure` → `requirePermission({payment:['export']})` → `assertUsExpansionEnabled` → `.strict()` Zod) then delegates to `parseNachaReturnFile` → `applyAchReturns`, returning the `{failed, advisory, skipped, unmatched}` summary verbatim. Test harness: `payment-payout-init.test.ts` (fake-db + tRPC caller). The live Modern-Treasury return-webhook (`PayoutInitiationAdapter.handleWebhook`) is a documented deferred seam, not built.

**`payment-core.ts` `verifyBillingProfilePlaid` (MODIFY — controller, tRPC mutation):** the onboarding verification trigger that persists `plaidVerificationStatus`. Same `initiatePayout` gate; loads the tenant-scoped `ContractorBillingProfile` (masked US routing/account — the `bacs.ts:230-231` masked-read precedent), calls `MockPlaidIdentityClient.verify` (the GA default; live client flag-dark per 88-06), writes status + `writeAuditLog`. **Fail-open advisory** (D-08, mirrors USPS `uspsVerified`) — never throws on a non-VERIFIED status.

---

## Shared Patterns

### Idempotency on payout init (D-13 — no double-pay)
**Source:** `lib/idempotency.ts` `reserve`/`complete`/`clear` (`:90-160`) — Upstash Redis NX reservation + in-memory fallback, 24h TTL.
**Apply to:** the programmatic-ACH `initiatePayout` procedure (the file export already has the atomic `updateMany` guard).
```typescript
const hit = await reserve<PayoutResult>(idempotencyKey, IDEMPOTENCY_TTL_SECONDS);
if (hit.kind === 'HIT') return hit.result;
if (hit.kind === 'PENDING') throw new TRPCError({ code: 'CONFLICT', ... });
try { const result = await initiatePayout(...); await complete(idempotencyKey, result, TTL); return result; }
catch (e) { await clear(idempotencyKey); throw e; }
```
`IDEMPOTENCY_TTL_SECONDS = 24*60*60` is already exported from `payment-shared.ts:32`.

### US-expansion gating (D-11)
**Source:** `middleware/require-us-expansion-flag.ts` `assertUsExpansionEnabled(organizationId, region)` (`:29-47`) + `isUsExpansionRegistered()` (`:55-58`).
**Apply to:** every US payout/format/verification procedure. Throws `FORBIDDEN` / `US_EXPANSION_DISABLED`. The whole US payout surface is gated on `module.us-expansion` + US region; programmatic-ACH/Plaid live paths additionally behind PENDING flags.

### Feature flags (reuse — do NOT mint new for ACH)
**Source:** `flags-core.ts:304-312` — `payments.ach-payouts` is **already registered** (PENDING, default false, category `payments`, jurisdiction `ANY`). Reuse it for programmatic ACH. `module.us-expansion` (`:211-214`) gates the surface. Mint a new PENDING entry **only** for a distinct Plaid live path if needed — never re-add `payments.ach-payouts`. All via `@contractor-ops/feature-flags` `evaluate`.

### Audit on sensitive mutations (D-13)
**Source:** `writeAuditLog` (used at `payment-export-router.ts:68`) — pass `tx` to commit atomically. **Apply to:** payout init, withholding application, ACH return-code application, Plaid verification-status change. Metadata carries **masked** bank data only (last-4); full routing/account never logged (D-12, `tin-match.service.ts:305` precedent).

### AES-256-GCM for secrets + bank data (D-12)
**Source:** `credential-service.ts` (provider creds) + the `ContractorBillingProfile.uk*Encrypted` field pattern. Never hand-roll crypto. `iv:authTag:ciphertext`, per-provider/per-field key.

### Mock-behind-seam + flag-dark for live providers
**Source:** `tin-match/` seam (interface + deterministic mock default + live-dark concrete) — the canonical precedent (P86 IRIS, P87 1042-S transmit). **Apply to:** Modern Treasury, Stripe Treasury, Plaid. Plaid is additionally **fail-open advisory** (D-08, mirrors P84 USPS `uspsVerified`): surface a warning, never `PRECONDITION_FAILED` (RESEARCH Pitfall 5).

### Money rounding (single HALF-UP)
**Source:** `tax-rate.service.ts:135` + `exchange-rate.ts:314` — `Math.round((gross*rate)/100)` / `Math.round(amountMinor*combinedRate)`. **Apply to:** withholding amount + settlement FX. One round at rate application; never chain (Pitfall 2). Integer minor units throughout. Update `wiki/patterns/money-rounding.md`.

### Test mirror
**Source:** `payment-export-swift.test.ts` (`__tests__/`) + `payment-export.test.ts` + `exchange-rate.test.ts` + `form-1099-nec.service.test.ts` (all exist). Pure-function generator tests: `import { generateX } from '../payment-export'`, assert exact field positions / lengths / control totals against fixtures. Run scoped: `pnpm --filter @contractor-ops/api test <path>` (never the full web-vite suite — RAM).

---

## No Analog Found

None. Every surface has a strong in-tree analog. The only genuinely **new domain knowledge** (not a code analog) is:

| Surface | Role | Data Flow | Note |
|---------|------|-----------|------|
| NACHA entry hash + 10-block padding | service | transform | No BACS analog for the hash/blocking mechanics — new domain logic, but the *generator scaffold* (fixed-width, control totals, hard-length guard) mirrors `generateBacsStandard18` exactly. RESEARCH Pattern 2 supplies the field layout. |
| Fedwire pacs.008 BAH envelope | service | transform | `generateSwiftXml` covers the ISO 20022 body; the Business Application Header wrapper is new (RESEARCH Pattern 3). Adviser-verify. |

---

## Metadata

**Analog search scope:** `packages/api/src/services/`, `packages/api/src/routers/finance/`, `packages/api/src/middleware/`, `packages/api/src/lib/`, `packages/integrations/src/{adapters,services,types}/`, `packages/db/prisma/schema/`, `packages/feature-flags/src/`, `packages/api/src/services/__tests__/`.
**Files read (analogs):** payment-export.ts, payment-format-detection.ts, payment-shared.ts, payment-export-router.ts, tax-rate.service.ts, treaty-rate.service.ts, tin-match.service.ts, exchange-rate.ts, base-adapter.ts, credential-service.ts, github-adapter.ts (partial), tin-match/{tin-match-client,mock-tin-match-client}.ts, require-us-expansion-flag.ts, idempotency.ts, form-1099-nec.service.ts (grep), flags-core.ts (sections), payment.prisma + contractor.prisma (sections), provider.ts (grep), payment-export-swift.test.ts (partial).
**Pattern extraction date:** 2026-06-18 (Gap C classification rows added 2026-07-01)
**Documentation-follows-code touch points (planner must schedule in-change-set):** `wiki/domains/` (US payout rail), `wiki/structure/{api-routers-catalog,prisma-schema-areas}.md`, `wiki/integrations/` (Modern Treasury / Stripe Treasury / Plaid), `wiki/patterns/{money-rounding,feature-flags}.md`, `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` ("payment run is the withholding source of truth" invariant).
</content>
