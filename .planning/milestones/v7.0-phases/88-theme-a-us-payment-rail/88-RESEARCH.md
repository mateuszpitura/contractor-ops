# Phase 88: Theme A — US Payment Rail - Research

**Researched:** 2026-06-18
**Domain:** US payment rails (NACHA ACH, Fedwire/ISO 20022), withholding deduction at payout, USD/FX settlement, programmatic-ACH + bank-verification adapter seams
**Confidence:** HIGH on in-tree assets and NACHA/Fedwire format facts; MEDIUM on provider API surfaces (Modern Treasury / Plaid — execution-time re-verify); MEDIUM on exact ODFI/SEC field rules (Nacha Operating Rules are paywalled — verify against the org's ODFI spec before live use)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-14 — research WITHIN these, do not propose alternatives)

**Withholding deduction (deferred from 86/87):**
- **D-01:** Deduct at payment-run item seeding — generalize the existing Saudi WHT path. On `PaymentRunItem` creation set `grossAmountMinor` (from invoice), compute `whtAmountMinor` (24% when `backupWithholdingFlagged`, or the 1042-S treaty rate from `applyTreaty`), set `whtRate`/`whtTreatyApplied`, and `amountMinor = grossAmountMinor − whtAmountMinor`. One withholding path for SA WHT + US backup-withholding + 1042-S treaty. Export file carries the net.
- **D-02:** Payment run is the single source of truth for the amount actually withheld. P86 1099 box-4 and P87 1042-S box-2 **report** the year's actual payment-run withholding (do not recompute in two places). Small P86/P87 follow-up wiring item — not a new capability.
- **D-03:** Add `Contractor.backupWithholdingFlagged` (boolean) + wire the P86 `tin-match.service` `setBackupWithholdingFlag` port. Store against `Contractor` now (not `Worker`).

**Programmatic ACH (US-PAY-03):**
- **D-04:** `PayoutInitiationAdapter` seam; Modern Treasury first concrete; Stripe Treasury a stub. Build on the v2.0 integration framework (`BaseAdapter` + AES-256-GCM credential store). Modern Treasury ships as a deterministic mock behind the seam, flag-dark until live creds.
- **D-05:** File export is the always-available default; programmatic is opt-in per-org. `ACH_NACHA` file ships and works with no provider creds. Programmatic init is opt-in per-org behind the integration framework + a PENDING flag.

**USD first-class + settlement currency (US-PAY-02):**
- **D-06:** USD first-class with a per-org default; uses `Organization.defaultCurrency`. Add a **USD=1.0 short-circuit** in the exchange-rate service. *(SEE FINDING F-1: the premise "USD is not in the ECB table" is factually wrong — USD IS in the ECB feed; planner must reconcile.)*
- **D-07:** Per-payout settlement-currency choice; default the contractor's currency (`Contractor.currency`), overridable per run. FX uses the payment-date ECB rate via `exchange-rate.ts` + `convertAmount`, consistent with the P86 1099 box-1 conversion.

**Plaid Identity (US-PAY-05):**
- **D-08:** Advisory, fail-open. Add `ContractorBillingProfile.plaidVerificationStatus` (VERIFIED/PENDING/FAILED), `plaidVerifiedAt`, `plaidAccountId`. Warn on unverified US payout; do NOT hard-block. Mirrors P84 USPS fail-open.
- **D-09:** Plaid Identity adapter on the integration framework, mock-behind-seam, live client flag-dark.

**Formats (US-PAY-01 / US-PAY-04):**
- **D-10:** New `ACH_NACHA` + `FEDWIRE` formats in the payment-export factory (`PaymentExportFormat` enum + `detectFormat` dispatch + generator mirroring `generateSwiftXml`). `detectFormat` routes USD + US bank → `ACH_NACHA`; high-value above Same-Day ACH ceiling → `FEDWIRE`. Gated on `module.us-expansion` + US region.

**Cross-cutting:**
- **D-11:** Whole US payout surface gated on `module.us-expansion` + US region; programmatic-ACH and Plaid live paths additionally behind PENDING flags.
- **D-12:** Encrypted bank data stays AES-256-GCM (`bankAccountEncrypted` + masked); never log full account/routing; US routing/account extend the existing encrypted-field pattern.
- **D-13:** `writeAuditLog` on payout init / withholding application / verification status change; idempotency on programmatic-ACH init (no double-pay).
- **D-14:** Adviser-verify annotations on withholding figures; i18n parity en/en-US/de/pl/ar on payout/verification UI strings.

### Claude's Discretion (research options, recommend — planner decides)
- NACHA entry-type selection (PPD / CCD / CTX), balanced-file mechanics, effective-entry-date computation, return-code (R01/R02/R03…) handling + retry.
- Fedwire file format + exact high-value routing threshold.
- US bank-account fields on `ContractorBillingProfile` vs a dedicated US bank model.
- Withholding rounding rule (single HALF-UP; reuse money-rounding pattern) + reconciliation aggregation shape (D-02).
- Settlement-currency choice surfaces per-run or per-org-default-with-override.
- Modern Treasury / Stripe Treasury / Plaid adapter interface signatures + which env-keyed credential blobs.

### Deferred Ideas (OUT OF SCOPE — ignore)
- Live programmatic ACH (Modern Treasury / Stripe Treasury) — built mock-behind-seam, flag-dark.
- Live Plaid Identity verification + hard-gating — advisory/mock now.
- P86/P87 form ↔ payment reconciliation wiring — noted as a small downstream touch-up (D-02), not a new capability here.
- Non-US programmatic rails / additional providers.
- `Worker`-type FK — store against `Contractor` now; re-point after Theme B (Phase 89).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| US-PAY-01 | ACH NACHA file (PPD/CCD/CTX) as a new payment-export-factory format | NACHA structure fully documented below; existing `generateBacsStandard18` is the closest in-tree mirror (fixed-width, control totals, hand-rolled fields, zero deps). `payment-format-detection.ts` + `payment-shared.ts` `_generateExportFileForFormat` dispatch + `PaymentExportFormat` enum are the three extension points. |
| US-PAY-02 | USD first-class, per-org default, exchange-rate sourcing, settlement-currency choice | `exchange-rate.ts` `convertAmount` already cross-rates via EUR and short-circuits same-currency. `Organization.defaultCurrency` exists. **F-1: USD already present in ECB feed + stored — D-06 premise needs reconciliation.** |
| US-PAY-03 | Programmatic ACH via Modern Treasury / Stripe Treasury adapter (opt-in) | Modern Treasury `POST /payment_orders` (type `ach`, direction `credit`), HTTP Basic auth (OrgID/API-key), webhook lifecycle to `reconciled`. New `PayoutInitiationAdapter` seam mirroring `BaseAdapter` + `credential-service.ts`. Mock-behind-seam, flag-dark. |
| US-PAY-04 | Fedwire wire format for high-value payouts above Same-Day ACH ceiling | **F-2: Fedwire is now ISO 20022 pacs.008 only (FAIM decommissioned 2025-07-14).** Practical deliverable = a pacs.008 XML message, mirroring the existing SWIFT `pain.001.001.09` generator. Threshold = Same-Day ACH ceiling ($1M now → $10M on 2027-09-17) as a **config value, not a constant**. |
| US-PAY-05 | Plaid Identity bank-account verification at onboarding (anti-fraud) | Plaid Link token → `public_token` exchange → `/auth/get` (routing/account) + `/identity/match` (name-match score). Advisory fail-open per D-08. Adapter mock-behind-seam, flag-dark. |
</phase_requirements>

## Summary

This phase is a **factory extension + a generalization + two flag-dark adapter seams**, not greenfield. Four of five requirements slot onto existing, well-tested in-tree patterns: the payment-export factory (BACS/SWIFT/SEPA/Elixir), the WHT-deduction substrate already on `PaymentRunItem`, the EUR-based FX service, and the v2.0 integration framework (`BaseAdapter` + AES-256-GCM credential store). The single piece of genuinely new domain knowledge is the NACHA ACH file format and the Fedwire ISO 20022 migration.

The highest-value finding is that the **withholding-deduction money movement (D-01/D-02) is the real deliverable** — P86/P87 only *recorded* a flag and a rate; this phase makes the payout actually shrink. The generalization target is `payment-shared.ts` `_applyWhtIfSaudi` (rename + widen). Critically, `form-1099-nec.service.ts` `computeBox4Minor` **already takes `recordedBackupWithholdingMinor` as an INPUT** (not a recompute) — so the D-02 reconciliation contract is already shaped; P88 just feeds it the aggregated payment-run figure.

Two CONTEXT premises need planner reconciliation: **(F-1)** USD is already in the ECB daily feed and is already stored as `EUR→USD`, and `convertAmount` already short-circuits same-currency — so the D-06 "USD=1.0 short-circuit because USD is absent from ECB" rationale is factually wrong (the short-circuit is harmless but the *reason* is not). **(F-2)** Fedwire's legacy FAIM file format was decommissioned 2025-07-14 in favor of ISO 20022 pacs.008, and Fedwire is fundamentally a bank-channel (FedLine) message, not a self-serve uploadable file — so the GA "FEDWIRE export" deliverable is best framed as a pacs.008 XML the org's bank transmits (mirroring the SWIFT generator), with adviser-verify.

**Primary recommendation:** Hand-roll the NACHA generator (94-char fixed-width, mirror `generateBacsStandard18`) — zero new deps respects the 7-day-release-age / supply-chain posture, and ODFI-specific fields must be hand-set anyway (CONTEXT confirms). Treat external NACHA helpers as `[ASSUMED]` reference-only. Generalize `_applyWhtIfSaudi` into one jurisdiction-agnostic withholding path. Build Modern Treasury + Plaid as official-SDK-shaped mock adapters, flag-dark.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| NACHA / Fedwire file generation | API / Backend (pure service) | — | Pure-function generators in `packages/api/src/services/payment-export.ts`, exactly like BACS/SWIFT — no I/O, deterministic, unit-testable. |
| Format detection / routing | API / Backend | — | `payment-format-detection.ts` `detectFormat` — currency + bank-country + amount → format enum. |
| Withholding deduction | API / Backend (DB mutation) | Database | Mutates `PaymentRunItem` rows inside the seeding transaction (`payment-shared.ts`). DB is the source of truth (D-02). |
| Backup-withholding flag storage | Database (`Contractor` column) | API (tin-match writer) | New queryable column read at seeding; written by the P86 tin-match port (D-03). |
| FX / settlement currency | API / Backend | Database (`ExchangeRate`) | `exchange-rate.ts` already EUR-based; rates persisted by daily cron. |
| Programmatic ACH initiation | API / Backend (adapter) | External (Modern Treasury) | New `PayoutInitiationAdapter` seam on the integration framework; live calls flag-dark. |
| Bank-account verification | API / Backend (adapter) | External (Plaid) | Plaid adapter on the integration framework; advisory result on `ContractorBillingProfile`. |
| Credential encryption | API / Backend (`credential-service`) | — | AES-256-GCM per-provider keys; never client-side. |
| Payout/verification UI | Frontend (web-vite container+hooks) | API (tRPC) | Advisory warnings, format selection, withholding display — i18n + WCAG states. |

## Standard Stack

### Core (in-tree — reuse, do not add)
| Asset | Location | Purpose | Why Standard |
|-------|----------|---------|--------------|
| Payment-export generators | `packages/api/src/services/payment-export.ts` | CSV/Elixir/SEPA/SWIFT/BACS file builders | `generateBacsStandard18` is the proven fixed-width template for NACHA (94-char records, control totals, transliteration warnings, zero deps). [VERIFIED: codebase] |
| Format detection | `packages/api/src/services/payment-format-detection.ts` | `detectFormat` + `ExportFormat` union | Extension point for `ACH_NACHA`/`FEDWIRE`. Note: the `ExportFormat` **string union here is separate** from the Prisma `PaymentExportFormat` enum — both must be updated. [VERIFIED: codebase] |
| Generator dispatch | `packages/api/src/routers/finance/payment-shared.ts` `_generateExportFileForFormat` | format string → buffer+ext | Add `ACH_NACHA`/`FEDWIRE` branches. [VERIFIED: codebase] |
| WHT substrate | `PaymentRunItem.{grossAmountMinor,whtAmountMinor,whtRate,whtTreatyApplied,whtTreatyReference,whtServiceType}` | per-item gross/net/withholding | Fields already exist (Saudi-only today). [VERIFIED: codebase — `payment.prisma`] |
| WHT seeding path | `payment-shared.ts` `_applyWhtIfSaudi` + `seedRunItems` | computes + writes withholding in-place | The function to **generalize** (D-01). Currently hard-gated `org.countryCode !== 'SA'`. [VERIFIED: codebase] |
| SA WHT calc | `tax-rate.service.ts` `calculateWht` | rate lookup + `Math.round(gross*rate/100)` net | Already uses HALF-UP `Math.round`; returns `{whtAmountMinor, netAmountMinor, whtRate, treatyApplied,…}`. [VERIFIED: codebase] |
| US treaty rate | `treaty-rate.service.ts` `applyTreaty` | resolves treaty **rate + article** (not an amount) | Returns `TreatyDecision.rate` (percent). D-01 must bridge rate→amount (`Math.round(gross*rate/100)`). 30% statutory fallback. [VERIFIED: codebase] |
| Box-4 reporter | `form-1099-nec.service.ts` `computeBox4Minor` | reports `recordedBackupWithholdingMinor` (INPUT, not recompute) | Confirms the D-02 contract is already shaped — feed it the aggregated payment-run withholding. [VERIFIED: codebase] |
| FX service | `exchange-rate.ts` `convertAmount` / `getRate` | EUR-based cross-rate conversion, payment-date | Already cross-rates through EUR; same-currency short-circuits (rate 1); HALF-UP `Math.round` on minor units. **USD already supported via EUR→USD.** [VERIFIED: codebase + live ECB feed] |
| Tin-match port | `tin-match.service.ts` `setBackupWithholdingFlag` (in `TinMatchPersistence`) | sets the backup-withholding flag on mismatch | Currently caller-supplied + unwired to a column. Wire to new `Contractor.backupWithholdingFlagged` (D-03). [VERIFIED: codebase] |
| Integration base | `packages/integrations/src/adapters/base-adapter.ts` `BaseAdapter` + `types/provider.ts` `IntegrationProviderAdapter` | adapter superclass (slug/displayName/OAuth/webhooks/health) | Mirror for Modern Treasury / Plaid. NOTE: `BaseAdapter` is OAuth/sync-shaped (`IntegrationConnection`). Payout-init is a *different* seam — reuse the credential-store + flag-dark pattern, not necessarily `BaseAdapter` verbatim. [VERIFIED: codebase] |
| Credential store | `packages/integrations/src/services/credential-service.ts` | AES-256-GCM `iv:authTag:ciphertext`, per-provider `${SLUG}_ENCRYPTION_KEY` | The encryption seam for provider creds (D-04/D-09). [VERIFIED: codebase] |
| US-expansion gate | `packages/api/src/middleware/require-us-expansion-flag.ts` | tRPC middleware | Gate the US payout surface (D-11). [VERIFIED: codebase] |
| Feature flag (exists!) | `payments.ach-payouts` in `flags-core.ts` (PENDING, default false) | the ACH-payout flag | **Already registered** in V7_FLAG_KEYS — do not re-add. Programmatic-ACH/Plaid live paths may need additional PENDING flags. [VERIFIED: codebase] |
| Audit + idempotency | `services/audit-writer.ts` `writeAuditLog`, `lib/idempotency.ts` (Upstash Redis, 24h TTL) | audit + dedupe | D-13. [VERIFIED: codebase] |
| Bank-field pattern | `ContractorBillingProfile.{ukSortCodeEncrypted,ukSortCodeMasked,ukAccountNumberEncrypted,ukAccountNumberMasked}` | UK BACS encrypted+masked pairs | The exact template for US `routing`/`account` encrypted+masked pairs. [VERIFIED: codebase] |

### Supporting (external — only if hand-roll is rejected; all `[ASSUMED]` — see Package Legitimacy Audit)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `modern-treasury` (official SDK) | 4.18.0 | ACH payment-order origination | Only inside the flag-dark live path of the Modern Treasury adapter; the GA mock needs no SDK. [ASSUMED] |
| `plaid` (official SDK) | 42.2.0 | Auth/Identity bank verification | Only inside the flag-dark live Plaid path; the GA mock needs no SDK. [ASSUMED] |
| `@midlandsbank/node-nacha` | 2.1.1 | NACHA file formatter | **Not recommended** — hand-roll preferred (see Don't Hand-Roll). Reference-only. [ASSUMED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled NACHA generator | `@midlandsbank/node-nacha` / `nacha-cheese` | Helper saves field-layout boilerplate but adds a supply-chain dependency (7-day-age gate, no exposed repo on midlandsbank, ODFI fields still hand-set). Existing BACS generator proves hand-roll is clean here. **Recommend hand-roll.** |
| pacs.008 XML for Fedwire | Wait for bank-channel integration | Pure file export is GA-shippable now (mirrors SWIFT); true Fedwire submission needs a bank/treasury channel (deferred, like programmatic ACH). |
| `BaseAdapter` for payout-init | A dedicated `PayoutInitiationAdapter` interface | `BaseAdapter` is sync/OAuth-shaped (`IntegrationConnection`, sync logs). Payout origination is a different lifecycle — define a focused interface, reuse only the credential-store + flag-dark conventions. |

**Installation:** None required for the GA floor (file export + mock adapters). The official SDKs (`modern-treasury`, `plaid`) install ONLY when the live paths are activated post-GA — gate each behind a `checkpoint:human-verify` task (slopcheck was unavailable at research time).

**Version verification (done):** `modern-treasury@4.18.0` (official repo, 12.9k dl/wk), `plaid@42.2.0` (772k dl/wk), `@midlandsbank/node-nacha@2.1.1` (created 2024-02, 2.2k dl/wk, **no repository.url exposed**), `nacha-cheese@1.0.5` (203 dl/wk), `nach`/nACH2 (stale, 2015). All verified via `npm view` from `/tmp` (repo-root npm is broken by `.npmrc` min-release-age unit bug — MEMORY note).

## Package Legitimacy Audit

> slopcheck **could not be installed** at research time (no network for `pip install slopcheck`). Per protocol, **every external package below is tagged `[ASSUMED]`** and the planner MUST gate each install behind a `checkpoint:human-verify` task. The GA floor (file export + mock adapters) needs **zero** external packages — supply-chain risk is opt-in with the live paths only.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `modern-treasury` | npm | created 2022-08 | 12,972/wk | github.com/Modern-Treasury/modern-treasury-node | unavailable | `[ASSUMED]` — live path only, checkpoint before install |
| `plaid` | npm | created 2013-03 (v42.2.0) | 772,803/wk | (official Plaid) | unavailable | `[ASSUMED]` — live path only, checkpoint before install |
| `@midlandsbank/node-nacha` | npm | created 2024-02 (v2.1.1) | 2,247/wk | **none exposed in npm metadata** | unavailable | `[ASSUMED]` — **not recommended**; hand-roll instead. Missing repo URL is a flag. |
| `nacha-cheese` | npm | created 2024-08 (v1.0.5) | 203/wk | github.com/lunchpayments/nacha-cheese | unavailable | `[ASSUMED]` — low downloads; reference-only |
| `nach` (nACH2) | npm | v0.3.5, 2015 | low | github.com/zipline/nACH | unavailable | `[ASSUMED]` — stale (2015); do not use |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck unavailable).
**Packages flagged suspicious [SUS]:** `@midlandsbank/node-nacha` (no exposed source repo); all NACHA helpers carry inline `[WARNING: verify on the correct registry + run slopcheck before any install; 7-day-release-age gate applies; prefer hand-roll]`.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
  Invoice (READY)        │              PAYMENT RUN SEEDING             │
        │                │  payment-shared.ts seedRunItems()            │
        ▼                │                                              │
  loadEligibleInvoices ─►│  createMany PaymentRunItem                   │
                         │     amountMinor = inv.amountToPayMinor       │
                         │           │                                  │
                         │           ▼                                  │
                         │  ┌────────────────────────────────────────┐ │
                         │  │ applyWithholding()  (GENERALIZED D-01)   │ │  reads:
                         │  │  per item, resolve rate by jurisdiction: │ │◄─ Contractor.backupWithholdingFlagged (D-03)
                         │  │   SA org      → calculateWht (existing)  │ │◄─ applyTreaty (1042-S rate, P87)
                         │  │   US backup   → 24% flat (§3406)         │ │◄─ Organization.countryCode / region
                         │  │   1042-S treaty → applyTreaty.rate       │ │
                         │  │  amt = HALF-UP round(gross*rate/100)     │ │
                         │  │  grossAmountMinor=gross; amountMinor=net │ │
                         │  └────────────────────────────────────────┘ │
                         └───────────────────────┬──────────────────────┘
                                                 │  PaymentRunItem = SOURCE OF TRUTH (D-02)
              ┌──────────────────────────────────┼───────────────────────────────────┐
              ▼                                   ▼                                   ▼
   ┌────────────────────┐        ┌──────────────────────────────┐      ┌──────────────────────────┐
   │ lockAndExport       │        │  Settlement currency (D-07)   │      │ Year-end aggregation      │
   │ (payment-export-    │        │  exchange-rate.convertAmount  │      │ Σ whtAmountMinor per       │
   │  router.ts)         │        │  USD | contractor.currency    │      │ contractor/year →          │
   │   │                 │        │  payment-date ECB rate        │      │ computeBox4Minor INPUT     │
   │   ▼                 │        └──────────────────────────────┘      │ (1099 box-4 / 1042-S box-2)│
   │ detectFormat ───────┼──► USD + US bank + US region → ACH_NACHA      └──────────────────────────┘
   │  (format-detection) │     amount > Same-Day-ACH ceiling → FEDWIRE (config threshold)
   │   │                 │
   │   ▼                 │
   │ _generateExportFile │
   │  ForFormat ─────────┼──► generateNachaFile()  (NEW, mirror generateBacsStandard18)
   │  (payment-shared)   │     generateFedwirePacs008() (NEW, mirror generateSwiftXml)
   │   │                 │
   │   ▼ (opt-in, dark)  │
   │ PayoutInitiation    │──► Modern Treasury adapter (mock | live POST /payment_orders)
   │  Adapter (D-04/05)  │     idempotency + writeAuditLog (D-13)
   └────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ ONBOARDING: Plaid adapter (D-08/09, advisory fail-open)           │
   │  Link token → public_token exchange → /auth/get + /identity/match │
   │  → ContractorBillingProfile.plaidVerificationStatus               │
   │  payout-time: warn if not VERIFIED, never block                   │
   └─────────────────────────────────────────────────────────────────┘
```

### Recommended Structure (additive — no new top-level layout)
```
packages/api/src/services/
├── payment-export.ts          # ADD generateNachaFile(), generateFedwirePacs008()
├── payment-format-detection.ts# ADD 'ACH_NACHA'|'FEDWIRE' to ExportFormat union + detect rule
├── withholding.service.ts     # NEW (or generalize in payment-shared) — jurisdiction-agnostic rate resolution
└── (reuse) exchange-rate.ts, tax-rate.service.ts, treaty-rate.service.ts
packages/api/src/routers/finance/
└── payment-shared.ts          # GENERALIZE _applyWhtIfSaudi → applyWithholding; ADD format dispatch branches
packages/integrations/src/adapters/
├── modern-treasury-adapter.ts # NEW — payout-init seam, mock + flag-dark live
├── stripe-treasury-adapter.ts # NEW — stub concrete
└── plaid-adapter.ts           # NEW — verification seam, mock + flag-dark live
packages/db/prisma/schema/
├── payment.prisma             # ADD ACH_NACHA, FEDWIRE to PaymentExportFormat enum
└── contractor.prisma          # ADD Contractor.backupWithholdingFlagged; ContractorBillingProfile US routing/account + Plaid fields
```

### Pattern 1: Generalize the single-jurisdiction WHT path (D-01)
**What:** Widen `_applyWhtIfSaudi` from `org.countryCode === 'SA'` to a jurisdiction dispatch.
**When:** During `seedRunItems`, after items are created (it mutates in place — keep that).
**Example (shape, not final):**
```typescript
// Source: derived from packages/api/src/routers/finance/payment-shared.ts + tax-rate.service.ts
// One path; rate resolution branches by jurisdiction. amount = HALF-UP round of gross*rate/100.
for (const item of items) {
  let rate: number | null = null;        // percent
  let treatyApplied = false;
  let reference: string | null = null;
  if (org.countryCode === 'SA' && item.contractor.countryCode !== 'SA') {
    const w = await calculateWht('SA', item.contractor.countryCode, 'technical_services', item.amountMinor);
    if (w) { rate = w.whtRate; treatyApplied = w.treatyApplied; reference = w.treatyReference; }
  } else if (isUsRegion(org) /* + US source */) {
    if (item.contractor.backupWithholdingFlagged) {
      rate = 24;                          // IRC §3406 backup withholding (verify rate at execution)
    } else if (/* foreign recipient, 1042-S */) {
      const t = await applyTreaty({ contractorResidency: item.contractor.countryCode });
      rate = t.rate; treatyApplied = t.source === 'treaty'; reference = t.article;
    }
  }
  if (rate === null) continue;
  const whtAmountMinor = Math.round((item.amountMinor * rate) / 100); // single HALF-UP, money-rounding pattern
  await tx.paymentRunItem.update({ where: { id: item.id }, data: {
    grossAmountMinor: item.amountMinor,
    amountMinor: item.amountMinor - whtAmountMinor,
    whtAmountMinor, whtRate: rate, whtTreatyApplied: treatyApplied, whtTreatyReference: reference,
  }});
}
```
**Guardrail:** must NOT change the SA branch's existing behavior (regression-test the SA path).

### Pattern 2: NACHA generator mirroring BACS Std 18
**What:** Fixed-width 94-char records, control totals, file-balancing, hand-set ODFI fields.
**Records (type code = position 1):** `1` File Header → `5` Batch Header → `6` Entry Detail (→ optional `7` Addenda) → `8` Batch Control → `9` File Control. Pad with all-`9` records so total line count is a multiple of 10 (blocking factor 10).
**Key fields:**
- File Header (1): immediate destination (ODFI routing, hand-set), immediate origin (company ID, hand-set), file creation date/time, file ID modifier.
- Batch Header (5): service class code (220 credits-only), company name, company ID, **SEC code** (PPD individual / CCD business / CTX), company entry description, **effective entry date** (YYMMDD, pos 70-75), ODFI identification.
- Entry Detail (6): **transaction code** (22 checking-credit / 32 savings-credit for payouts), RDFI routing (8 + check digit), DFI account number, amount (cents, no decimal, zero-filled), individual ID + name, trace number.
- Batch Control (8): entry/addenda count, **entry hash** (sum of RDFI 8-digit routing numbers, rightmost 10 digits), total debit + total credit (cents).
- File Control (9): batch count, block count, entry/addenda count, entry hash, total debit + total credit.
**Balancing:** standard files must balance; ACH operators reject unbalanced files. A *balanced* file adds an **offset entry** (debit to the originator's funding account = total credits). For an org-side export uploaded to its bank, the bank typically funds — confirm balanced vs unbalanced with the ODFI (Claude's-discretion item; default unbalanced credit-only batch, SEC=PPD for individuals).
```typescript
// Source: moov-io/ach docs/file-structure.md + Nacha ACH Guide for Developers
// All numeric fields right-justified zero-filled; alphanumeric left-justified space-filled; every record exactly 94 chars.
// Entry hash = Σ(first 8 digits of each RDFI routing) mod 10^10. Amounts in cents, no decimal point.
```

### Pattern 3: Fedwire as ISO 20022 pacs.008 (mirror SWIFT generator)
**What:** Generate a `pacs.008.001.xx` customer-credit-transfer XML (the FAIM `CTR` successor) for high-value payouts; org's bank transmits via FedLine. NOT a self-serve uploadable batch file like NACHA.
**When:** `detectFormat` returns `FEDWIRE` when amount > Same-Day-ACH ceiling (config: $1M now, $10M from 2027-09-17).
**Note:** Reuse `generateSwiftXml`'s structure (it's already pain.001.001.09 ISO 20022). Fedwire pacs.008 differs in message type + Business Application Header envelope. Mark adviser-verify; live transmission is bank-channel (deferred, like programmatic ACH).

### Pattern 4: PayoutInitiationAdapter seam (D-04/D-05)
**What:** A focused interface (`initiatePayout`, `getPayoutStatus`, optional `handleWebhook`), Modern Treasury first concrete (mock default), Stripe Treasury stub.
**Modern Treasury surface (live path only):** `POST /payment_orders` with `{ type: 'ach', direction: 'credit', amount, currency, originating_account_id, receiving_account_id }`; counterparty needs `account_number` + `routing_number`; HTTP Basic auth (Org-ID = username, API-key = password); webhooks advance status through to `reconciled` (fully settled). [CITED: docs.moderntreasury.com]
**Idempotency (D-13):** wrap `initiatePayout` with the existing `lib/idempotency.ts` reservation (no double-pay).

### Anti-Patterns to Avoid
- **Recomputing withholding in the forms.** P88 records it once on `PaymentRunItem`; P86/P87 read the aggregate (D-02). `computeBox4Minor` already takes the figure as input — honor that.
- **Floating-point money.** All money is integer minor units; single HALF-UP round at the rate application; never chain rounds.
- **Forking a parallel US withholding system.** Generalize the existing path (D-01) — do not duplicate `PaymentRunItem` fields.
- **Treating Fedwire as a downloadable batch file like NACHA.** It is a bank-channel ISO 20022 message.
- **Adding the `payments.ach-payouts` flag.** It already exists in `flags-core.ts` / `V7_FLAG_KEYS`.
- **Logging full routing/account numbers.** AES-256-GCM at rest, masked for display (D-12).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM credential encryption | Custom crypto | `credential-service.ts` (existing) | Audited, per-provider keys, GCM auth-tag verified. |
| FX conversion | New rate math | `exchange-rate.ts` `convertAmount` | EUR-based cross-rate, payment-date lookup, HALF-UP, USD already supported. |
| Idempotency / dedupe | In-memory map | `lib/idempotency.ts` (Upstash Redis, 24h) | Process-local maps double-pay across Render pods (documented in payment-shared comment). |
| Treaty rate resolution | New table/logic | `applyTreaty` (existing) | Override-precedence + audit + 30% statutory fallback already done. |
| TIN-mismatch → flag pipeline | New flow | `tin-match.service` port (wire it) | Port exists; just needs the column + writer (D-03). |
| Fixed-width record builder | Ad-hoc string concat | `payment-export.ts` `padField`/`padZero`/`bacsField` helpers | Existing tested padding/transliteration helpers transfer directly to NACHA. |

**The NACHA helper exception:** unlike most domains, hand-rolling the NACHA *formatter* is the recommended choice here — the existing BACS Std-18 generator proves the pattern is clean and dependency-free, ODFI-specific fields must be hand-set regardless, and the 7-day-release-age + typosquat posture penalizes adding a low-trust formatter dep (the leading candidate has no exposed source repo).

## Runtime State Inventory

> This is primarily an additive-feature phase, but it adds a Prisma column read at payout time + provider credentials + new flags. Inventory below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `Contractor.backupWithholdingFlagged` does NOT yet exist (D-03 adds it). The P86 flag currently lives only in `TaxFormSubmission.snapshotJson` — NOT migrated to a column. | Additive-nullable migration + a one-time backfill decision: should existing flagged-in-snapshot contractors get the new column set? **Planner: decide backfill vs forward-only.** `PaymentRunItem` WHT fields already exist (no migration). |
| Live service config | Modern Treasury / Plaid live creds live in env (`${SLUG}_ENCRYPTION_KEY` + provider API keys) — flag-dark, none required for GA. `payments.ach-payouts` flag already registered (Unleash PENDING). | None for GA. Live activation = Unleash flip + env keys (post-GA). |
| OS-registered state | None. | None — verified: no cron/task registration in this phase. |
| Secrets / env vars | New: `MODERN_TREASURY_ENCRYPTION_KEY`, `PLAID_ENCRYPTION_KEY` (+ provider API keys for live paths). Must be added to `.env.example` + the relevant package `env.ts` schema per CLAUDE.md. | Add to `.env.example` + env schema; live keys optional (flag-dark). |
| Build artifacts | None — no package rename. | None. |

**The canonical question — after every file is updated, what runtime state carries old/missing values?** The only stateful gap is the **backup-withholding backfill**: P86 stored the flag in JSON; P88 introduces the column. Existing flagged recipients will read `false` from the new column until backfilled. Planner MUST address (backfill task or documented forward-only with adviser note).

## Common Pitfalls

### Pitfall 1: NACHA file fails the operator's balance/hash/blocking checks
**What goes wrong:** File rejected wholesale for wrong entry hash, unbalanced totals, or line count not a multiple of 10.
**Why:** Entry hash is the sum of the *first 8 digits* of each RDFI routing number, truncated to the rightmost 10 digits; amounts are cents with no decimal; the file must be padded with `9`-records to a 10-line block.
**Avoid:** Unit-test hash/total/blocking against a known-good fixture; mirror the BACS control-total guard (`detail.length !== 94` hard-throw).
**Warning signs:** Operator returns a file-level reject; totals off by rounding.

### Pitfall 2: Withholding rounding drift breaks the form reconciliation (D-02)
**What goes wrong:** Box-4 / box-2 totals don't reconcile to the sum of payment-run withholdings.
**Why:** Multiple rounds (per-item then per-aggregate) compound.
**Avoid:** Single HALF-UP round at rate application (`Math.round(gross*rate/100)`), store the exact integer minor amount, aggregate by simple integer sum for the forms.
**Warning signs:** Penny discrepancies in year-end reports.

### Pitfall 3: USD/settlement premise mismatch (F-1)
**What goes wrong:** Planner adds a "USD=1.0 short-circuit because USD is absent from ECB" — but USD is present and already stored; the short-circuit's stated rationale is wrong and may mask a real bug (e.g., a genuinely missing rate on a holiday returns null, not 1.0).
**Why:** D-06's premise is factually incorrect (verified against the live ECB feed).
**Avoid:** Treat USD like any ECB currency. `convertAmount(usd→usd)` already returns rate 1. Only add an explicit short-circuit if a defensive guard is wanted; do NOT bypass the real `getRate` lookup for USD↔other-currency conversions.
**Warning signs:** USD↔EUR conversions returning 1.0 incorrectly.

### Pitfall 4: Modern Treasury mock diverges from the live contract
**What goes wrong:** GA mock returns shapes the live SDK never produces; live activation breaks.
**Why:** Mock authored without the real object shape.
**Avoid:** Shape the mock to the documented `payment_order` object + webhook status enum (`pending`→…→`reconciled`); keep the live SDK call behind the same interface.
**Warning signs:** Type drift when the live path is wired.

### Pitfall 5: Plaid advisory result accidentally hard-blocks (violates D-08)
**What goes wrong:** Unverified status blocks the payout.
**Why:** Treating `plaidVerificationStatus !== 'VERIFIED'` as a gate.
**Avoid:** Mirror P84 USPS fail-open — surface a warning in the UI + compliance snapshot, never a `PRECONDITION_FAILED`.

## Code Examples

### Detect format for US payout (extends detectFormat)
```typescript
// Source: derived from packages/api/src/services/payment-format-detection.ts
// USD + US bank account + US region → ACH_NACHA; above the Same-Day-ACH ceiling → FEDWIRE.
// Ceiling is a CONFIG value (1_000_000_00 cents now; 10_000_000_00 from 2027-09-17), NOT a constant.
export function detectUsFormat(currency: string, isUsBank: boolean, amountMinor: number, sameDayCeilingMinor: number): ExportFormat | null {
  if (currency !== 'USD' || !isUsBank) return null;
  return amountMinor > sameDayCeilingMinor ? 'FEDWIRE' : 'ACH_NACHA';
}
```

### Bridge applyTreaty rate → withholding amount (1042-S)
```typescript
// Source: derived from treaty-rate.service.ts applyTreaty + tax-rate.service.ts rounding
const decision = await applyTreaty({ contractorResidency: contractor.countryCode });
const whtAmountMinor = Math.round((grossAmountMinor * decision.rate) / 100); // 30% statutory if no treaty
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fedwire FAIM proprietary format | ISO 20022 pacs.008 | 2025-07-14 (single-day cutover) | A "Fedwire export" today = pacs.008 XML, not the legacy FAIM file. [CITED: frbservices.org] |
| Same-Day ACH $1M per-payment | $10M per-payment | effective 2027-09-17 | The Fedwire-routing threshold is moving — make it config, not a constant. [CITED: nacha.org] |
| Backup-withholding flag in `TaxFormSubmission.snapshotJson` (P86) | Dedicated `Contractor.backupWithholdingFlagged` column (P88, D-03) | this phase | Queryable at seeding time; backfill decision required. |

**Deprecated/outdated:**
- Fedwire FAIM message format — fully retired 2025-07-14.
- `nach`/nACH2 npm package — last published 2015; do not use.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | US backup-withholding rate is 24% flat (IRC §3406) | Pattern 1 / D-01 | If the statutory rate changed, every US payout under-/over-withholds. **Verify at execution** (adviser-verify, local-only posture). |
| A2 | NACHA payout batch = credit-only (service class 220), SEC=PPD for individuals / CCD for businesses, transaction code 22/32 | Pattern 2 | Wrong SEC/txn code → RDFI returns. ODFI-specific; verify against the org's bank ACH spec. |
| A3 | Default NACHA file is unbalanced credit-only (bank funds) vs balanced-with-offset | Pattern 2 | Balanced vs unbalanced is ODFI-dependent; wrong choice → operator reject. Claude's-discretion + ODFI confirmation. |
| A4 | Fedwire GA deliverable is a pacs.008 XML the org's bank transmits (not self-serve upload) | Pattern 3 / F-2 | If a customer expects a directly-submittable file, scope is misframed; true submission is bank-channel (deferred). |
| A5 | Modern Treasury `POST /payment_orders` shape + HTTP Basic auth + `reconciled` terminal status | Pattern 4 / D-04 | Provider API drift; live path only — re-verify when activating. [CITED but unversioned docs] |
| A6 | Plaid `/auth/get` + `/identity/match` + Link-token flow | US-PAY-05 / D-09 | Provider API drift; live path only — re-verify when activating. |
| A7 | All external packages are legitimate (slopcheck unavailable) | Package Legitimacy Audit | Each install gated behind checkpoint:human-verify; GA floor needs none. |
| A8 | Same-Day ACH ceiling is $1M now, $10M from 2027-09-17 | State of the Art | If dates/amounts differ, Fedwire-routing threshold is wrong — config value mitigates. |

## Open Questions

1. **Backup-withholding backfill (D-03).**
   - Known: P86 stored the flag in `TaxFormSubmission.snapshotJson`; P88 adds `Contractor.backupWithholdingFlagged`.
   - Unclear: backfill existing flagged contractors, or forward-only?
   - Recommendation: forward-only + a one-time migration that reads the latest snapshot per contractor (planner decides; low row counts make backfill cheap).

2. **F-1: USD=1.0 short-circuit rationale (D-06).**
   - Known: USD is in the ECB feed and stored as `EUR→USD`; `convertAmount` already handles USD.
   - Unclear: whether D-06 intends a defensive guard or rests on the (wrong) "USD absent" premise.
   - Recommendation: keep USD as a normal ECB currency; do not special-case conversions. Surface F-1 in discuss/plan-check.

3. **F-2 / A3-A4: NACHA balanced-vs-unbalanced + Fedwire submission channel.**
   - Known: both are ODFI/bank-channel dependent; local-only posture defers live transmission.
   - Recommendation: default to unbalanced credit-only NACHA + pacs.008 Fedwire file; adviser-verify; live submission deferred behind the same flag-dark posture as programmatic ACH.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/pnpm/Turborepo | all | ✓ | pnpm 10 | — |
| vitest | tests | ✓ | 4.1.5 | — |
| ECB daily feed | FX rates | ✓ (reachable; USD present) | live | previous-day copy (existing) |
| `modern-treasury` SDK | programmatic-ACH **live** path | ✗ (not installed; not needed for GA) | 4.18.0 (registry) | mock-behind-seam (GA default) |
| `plaid` SDK | Plaid **live** path | ✗ (not installed; not needed for GA) | 42.2.0 (registry) | mock-behind-seam (GA default) |
| slopcheck | package vetting | ✗ (pip install failed — no network) | — | all packages `[ASSUMED]` + checkpoint:human-verify |

**Missing dependencies with no fallback:** none — the GA floor (NACHA/Fedwire file export + mock adapters) needs no external dependency.
**Missing dependencies with fallback:** Modern Treasury / Plaid SDKs → deterministic mocks behind the seam; slopcheck → `[ASSUMED]` tagging + per-install checkpoint.

## Validation Architecture

> nyquist_validation is enabled (`config.json` workflow.nyquist_validation = true).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @contractor-ops/api test <path>` |
| Full suite command | `pnpm --filter @contractor-ops/api test` |

> NOTE (MEMORY): NEVER run the full unscoped web-vite suite (RAM). Scope API tests; UI tests with a path arg.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| US-PAY-01 | NACHA file structure: 94-char records, control totals, entry hash, 10-block padding, SEC/txn codes | unit | `pnpm --filter @contractor-ops/api test payment-export-nacha` | ❌ Wave 0 (mirror `payment-export-swift.test.ts`) |
| US-PAY-01 | detectFormat routes USD+US bank → ACH_NACHA | unit | `pnpm --filter @contractor-ops/api test payment-format-detection` | ✅ extend |
| US-PAY-02 | USD conversion + settlement-currency choice (payment-date ECB rate) | unit | `pnpm --filter @contractor-ops/api test exchange-rate` | ✅ extend |
| US-PAY-03 | Modern Treasury mock initiatePayout + idempotency (no double-pay) + audit | unit | `pnpm --filter @contractor-ops/api test modern-treasury-adapter` | ❌ Wave 0 |
| US-PAY-04 | Fedwire pacs.008 above-ceiling routing + XML shape | unit | `pnpm --filter @contractor-ops/api test payment-export-fedwire` | ❌ Wave 0 |
| US-PAY-05 | Plaid mock verification → status fields; advisory fail-open (no block) | unit | `pnpm --filter @contractor-ops/api test plaid-adapter` | ❌ Wave 0 |
| D-01 | Generalized withholding: US 24% backup + 1042-S treaty + **SA path unchanged (regression)** | unit | `pnpm --filter @contractor-ops/api test tax-rate.service` / new withholding test | ✅ extend + ❌ Wave 0 |
| D-02 | Aggregated payment-run withholding feeds `computeBox4Minor` (reconciliation) | unit | `pnpm --filter @contractor-ops/api test form-1099-nec.service` | ✅ extend |
| D-13 | Idempotency on payout init; audit on withholding/init/verify | integration | `pnpm --filter @contractor-ops/api test payment` | ✅ extend |

### Sampling Rate
- **Per task commit:** scoped `pnpm --filter @contractor-ops/api test <changed-area>`.
- **Per wave merge:** `pnpm --filter @contractor-ops/api test` (full API package).
- **Phase gate:** API suite green + `pnpm typecheck --filter=@contractor-ops/api` before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `payment-export.ts` NACHA unit tests — covers US-PAY-01 (mirror `payment-export-swift.test.ts` / `payment-export.test.ts`).
- [ ] `payment-export.ts` Fedwire pacs.008 unit tests — covers US-PAY-04.
- [ ] `modern-treasury-adapter` + `plaid-adapter` mock unit tests — covers US-PAY-03 / US-PAY-05.
- [ ] Generalized-withholding unit test incl. **SA regression** — covers D-01 (the highest-risk regression).
- [ ] Known-good NACHA fixture for hash/total/blocking assertions.
- [ ] Framework install: none — vitest already configured.

## Security Domain

> security_enforcement is enabled (absent in config = enabled). This phase moves real money and handles bank PII — security is load-bearing.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication (provider) | yes | Modern Treasury HTTP Basic (Org-ID/API-key) + Plaid Link tokens — creds AES-256-GCM at rest via `credential-service.ts`; live paths flag-dark. |
| V3 Session Management | no | tRPC tenant session (existing `tenantProcedure`) — no new session surface. |
| V4 Access Control | yes | `requirePermission({ payment: [...] })` on payout procedures; `require-us-expansion-flag` gate (D-11); tenant scoping on every query. |
| V5 Input Validation | yes | Zod on all tRPC inputs; routing/account format validation; `safeParse` on provider webhooks (no unsafe `as`). |
| V6 Cryptography | yes | AES-256-GCM (existing `credential-service.ts` + the SSN/bank-field pattern) — never hand-roll. GCM auth-tag verified on decrypt. |
| V7 Error/Logging | yes | `@contractor-ops/logger` (no `console.*`); **never log full routing/account/TIN** — masked-only (mirror tin-match last-4 discipline). |
| V8 Data Protection | yes | Bank routing/account encrypted-at-rest + masked display (D-12); US R2 residency for US tax records (from P83). |
| V11 Business Logic | yes | Idempotency on payout init (no double-pay, D-13); atomic payment-run state transitions (existing `runExportTransaction` pattern). |

### Known Threat Patterns for {US payout rail}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Double-pay on retry / multi-pod | Tampering / Repudiation | `lib/idempotency.ts` Upstash reservation + atomic `updateMany` status guard (existing `payment-export-race.security.test.ts` pattern). |
| Bank PII leak in logs/exports | Information Disclosure | Mask in logs (last-4); AES-256-GCM at rest; NACHA file is the only place full account appears — gate download, audit it. |
| Cross-tenant payout / verification read | Information Disclosure / Elevation | `organizationId` on every query; add a `*.security.test.ts` tenant-isolation case for new payout/verification procedures (mirror `tax-filing-tenant-isolation.security.test.ts`). |
| Withholding tamper (reduce/zero out) | Tampering | Withholding written in the seeding transaction + `writeAuditLog`; figure is the form's source of truth (D-02) — auditable. |
| Forged provider webhook (live path) | Spoofing | Verify webhook signature (Modern Treasury) before acting; `safeParse` payload; flag-dark until live. |
| Unverified-account payout (fraud) | Spoofing | Plaid advisory warning (D-08) — surfaced, audited; hard-gate deferred to live Plaid. |

**New security regression test required:** a `*.security.test.ts` asserting (1) cross-tenant payout/verification isolation, (2) idempotent payout init, (3) full routing/account never appears in logs or audit metadata.

## Project Constraints (from CLAUDE.md)
- pnpm 10 + Turborepo; `packages/*` change → check `apps/*` + filtered typecheck.
- **7-day release age** (`min-release-age=7`) + typosquat check on any new dep — reinforces hand-rolling NACHA and gating provider SDKs behind checkpoints.
- No `console.*` in app source — `@contractor-ops/logger` (Pino) only.
- Feature flags via `@contractor-ops/feature-flags` only (`payments.ach-payouts` already registered).
- tRPC v11; Zod on every procedure; `safeParse` on webhooks/cron; no unsafe `as` on external payloads.
- Tenant from session; `writeAuditLog` on sensitive mutations (pass `tx`).
- `semble search` before grep; **MUST Read before Edit**; Edit > Write; no sed/script bulk replace; minimal diff.
- **Documentation-follows-code (gated):** any product change → matching wiki + indexes/graph in the same change set; `pnpm check:wiki-brain` before done. Touch points: `wiki/domains/` (US payout rail), `wiki/structure/{api-routers-catalog,prisma-schema-areas}.md`, `wiki/integrations/` (Modern Treasury / Stripe Treasury / Plaid), `wiki/patterns/money-rounding.md`, `wiki/patterns/feature-flags.md`, `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for the "payment run is the withholding source of truth" invariant.
- No breadcrumb IDs in source comments (Phase/D-/REQ-). Real domain IDs (NACHA, PPD/CCD/CTX, R01, pacs.008, §3406, Fedwire) are fine.
- New env vars → `.env.example` + package env schema; `pnpm check:no-process-env` when touching env access.
- After dep work → `pnpm audit` + `pnpm security:scan`.
- UI: `frontend-design` + impeccable for web-vite; container+hooks layering; WCAG loading/empty/error states; i18n en/en-US/de/pl/ar (D-14).
- `.planning/phases` is a symlink — commit via the real `.planning/milestones/v7.0-phases/` path (orchestrator handles).

## Sources

### Primary (HIGH confidence)
- Codebase (verified via Read): `payment-export.ts`, `payment-format-detection.ts`, `payment-export-router.ts`, `payment-shared.ts`, `tax-rate.service.ts`, `treaty-rate.service.ts`, `tin-match.service.ts`, `form-1099-nec.service.ts`, `exchange-rate.ts`, `base-adapter.ts`, `credential-service.ts`, `payment.prisma`, `contractor.prisma`, `flags-core.ts`.
- Live ECB feed (`curl` eurofxref-daily.xml) — confirmed USD present (F-1).
- npm registry (`npm view`) — verified versions/dates/downloads/repo for modern-treasury, plaid, @midlandsbank/node-nacha, nacha-cheese, nach.
- moov-io/ach `docs/file-structure.md` — NACHA record layout, 94-char, blocking, entry hash, balancing, transaction/SEC codes.
- Nacha ACH Guide for Developers (achdevguide.nacha.org/ach-file-overview) — record-type roles, PPD/CCD/CTX.

### Secondary (MEDIUM confidence)
- frbservices.org / federalregister.gov — Fedwire ISO 20022 pacs.008 cutover 2025-07-14 (FAIM retired).
- nacha.org/million + paymentsdive — Same-Day ACH $1M → $10M effective 2027-09-17.
- docs.moderntreasury.com — `POST /payment_orders`, HTTP Basic auth, webhook `reconciled`.
- plaid.com/docs — Auth `/auth/get`, Identity `/identity/match`, Link-token flow.
- ramp.com / vericheck — ACH return codes R01-R29 + 2-banking-day / 60-day return windows.

### Tertiary (LOW confidence — re-verify at execution)
- NACHA helper packages (@midlandsbank/node-nacha, nacha-cheese) — recommended reference-only; not for install.
- Exact ODFI field rules, balanced-vs-unbalanced default, SEC/txn-code selection — Nacha Operating Rules are paywalled; confirm against the org's bank ACH spec.

## Metadata

**Confidence breakdown:**
- Standard stack (in-tree reuse): HIGH — every cited asset Read-verified.
- NACHA/Fedwire format facts: HIGH on structure (moov-io + Nacha dev guide + live ECB); MEDIUM on exact ODFI/SEC/balancing rules (paywalled Operating Rules).
- Provider APIs (Modern Treasury / Plaid): MEDIUM — official docs, but unversioned and live-path-only; re-verify when activating.
- Withholding generalization: HIGH — the substrate, the SA path, and the box-4 input contract are all confirmed in source.
- Two CONTEXT premise corrections (F-1 USD-in-ECB, F-2 Fedwire-ISO20022): HIGH — verified against live ECB feed and Federal Reserve docs.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 for in-tree facts (stable); 2026-06-25 for provider API surfaces (fast-moving, re-verify before live activation).
