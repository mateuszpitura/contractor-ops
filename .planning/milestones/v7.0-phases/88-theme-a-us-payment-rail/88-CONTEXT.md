# Phase 88: Theme A — US Payment Rail - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

The US payout rail — how US and cross-border payments actually settle, and where the
withholding that Phases 86/87 only *reported* is actually *applied*:

1. **ACH NACHA file** (US-PAY-01) — a new `ACH_NACHA` format (PPD/CCD/CTX) in the existing payment-export factory, balanced, with effective-entry-date + return-code handling.
2. **USD first-class** (US-PAY-02) — per-org default currency, exchange-rate sourcing, settlement-currency choice on cross-border payouts.
3. **Programmatic ACH** (US-PAY-03) — opt-in Modern Treasury / Stripe Treasury adapter on the v2.0 integration framework.
4. **Fedwire** (US-PAY-04) — wire-transfer file for high-value payouts above the Same-Day ACH ceiling ($1M until 2027-09-17).
5. **Plaid Identity** (US-PAY-05) — US contractor bank-account verification at onboarding (anti-fraud).
6. **Withholding deduction** (deferred from 86/87, mandated by the ROADMAP research flag) — the backup-withholding 24% (P86) and the 1042-S treaty rate (P87) actually reduce the payout here; this is where reporting becomes a real money movement.

**NOT this phase:**
- Generating the 1099-NEC / 1042-S forms themselves → P86 / P87 (this phase produces the *withheld figures* those forms report — see D-02).
- Non-US payment rails (BACS/SWIFT/SEPA/Elixir already exist) — only the US additions.
- Live programmatic-ACH / live Plaid calls — adapters are mock-behind-seam + flag-dark until live provider credentials land (D-05/D-09), mirroring the 86/87 posture.
</domain>

<decisions>
## Implementation Decisions

### Withholding Deduction Integration (deferred from 86/87)
- **D-01:** **Deduct at payment-run item seeding — generalize the existing Saudi WHT path.** When `PaymentRunItem`s are created, set `grossAmountMinor` (from the invoice), compute `whtAmountMinor` (24% when `backupWithholdingFlagged`, or the 1042-S treaty rate from `applyTreaty`), set `whtRate`/`whtTreatyApplied`, and `amountMinor = grossAmountMinor − whtAmountMinor`. The schema fields already exist (`PaymentRunItem.whtAmountMinor/whtRate/whtTreatyApplied/grossAmountMinor`, today populated only for Saudi via `calculateWht`) — generalize to **one withholding path for all jurisdictions** (SA WHT, US backup-withholding, 1042-S treaty). The export file carries the net.
- **D-02:** **The payment run is the single source of truth for the amount actually withheld.** The withheld figure recorded on `PaymentRunItem` at payout is authoritative; the P86 1099 box-4 and P87 1042-S box-2 **report the year's actual payment-run withholding** (withholding is a payment event — the form reflects what really moved). Implies a small P86/P87 follow-up so the forms read aggregated payment data rather than recomputing — note this as a downstream wiring item, do not recompute in two places.
- **D-03:** **Add `Contractor.backupWithholdingFlagged` (boolean) + wire the P86 tin-match writer.** The P86 `tin-match.service` `setBackupWithholdingFlag` port is currently unwired (the flag lives only in `TaxFormSubmission.snapshotJson`). Add a dedicated queryable column the payment-run seeding reads at payout time, and wire the P86 writer to set it — closing that P86 loose end. (Forward-compatible: store against `Contractor` now, like P85/P86, not `Worker`.)

### Programmatic ACH (US-PAY-03)
- **D-04:** **`PayoutInitiationAdapter` seam with Modern Treasury as the first concrete; Stripe Treasury a stub.** Modern Treasury is the purpose-built ACH-origination/payment-ops API (bank-agnostic, NACHA origination + reconciliation) — the v7.0 floor. Build the adapter on the v2.0 integration framework (`BaseAdapter` + AES-256-GCM credential store); ship Modern Treasury as a **deterministic mock behind the seam**, flag-dark until live credentials, with Stripe Treasury as a stub concrete.
- **D-05:** **File export is the always-available default; programmatic is opt-in per-org.** The `ACH_NACHA` file (US-PAY-01) ships and works with no provider creds. Programmatic ACH initiation (US-PAY-03) is opt-in per-org behind the integration framework + a PENDING flag, dark until live creds — never blocks GA. (Mirrors the 86 IRIS manual-default / A2A-dark posture.)

### USD First-Class + Settlement Currency (US-PAY-02)
- **D-06:** **USD is first-class with a per-org default.** Uses the existing `Organization.defaultCurrency`; USD is treated as a first-class currency (not just a 3-char string). Since USD is not in the ECB rate table, add a **USD=1.0 short-circuit** in the exchange-rate service.
- **D-07:** **Per-payout settlement-currency choice; default the contractor's currency.** On a cross-border payout, choose to settle in **USD** (contractor receives USD) or **convert to the contractor's local currency** — default to `Contractor.currency`, overridable per run. FX uses the **payment-date ECB rate** (reuse the `exchange-rate.ts` service + `convertAmount`, consistent with the P86 1099 box-1 conversion).

### Plaid Identity Verification (US-PAY-05)
- **D-08:** **Advisory, fail-open.** Add verification status fields to `ContractorBillingProfile` (`plaidVerificationStatus` VERIFIED/PENDING/FAILED, `plaidVerifiedAt`, `plaidAccountId`); surface a **warning** on unverified US payouts but **do not hard-block**. Mirrors P84's USPS fail-open advisory posture and is consistent with Plaid being mock-behind-seam + flag-dark (a mocked verification must not brick the GA payout path). Hard-gating can land when live Plaid creds arrive.
- **D-09:** **Plaid Identity adapter on the integration framework, mock-behind-seam.** Reuse `BaseAdapter` + the AES-256-GCM credential store (OAuth/API-key pattern, mirror an existing adapter); ship a deterministic mock, live client flag-dark.

### ACH NACHA + Fedwire Formats (US-PAY-01 / US-PAY-04)
- **D-10:** **New `ACH_NACHA` + `FEDWIRE` formats in the payment-export factory**, slotting in like BACS/SWIFT/Elixir/SEPA (`PaymentExportFormat` enum + `detectFormat` dispatch + a generator mirroring `generateSwiftXml`). `detectFormat` routes USD + a US bank account → `ACH_NACHA`; high-value above the Same-Day ACH ceiling → `FEDWIRE`. US format selection is gated on `module.us-expansion` + US region.

### Cross-Cutting (carried forward — not re-asked)
- **D-11:** Whole US payout surface gated on **`module.us-expansion`** + US region (P82/83); programmatic-ACH and Plaid live paths additionally behind PENDING flags.
- **D-12:** **Encrypted bank data** stays AES-256-GCM (`ContractorBillingProfile.bankAccountEncrypted` + masked); never log full account/routing numbers; US bank fields (routing/account) extend the existing encrypted-field pattern.
- **D-13:** **Audit + idempotency** — `writeAuditLog` on payout initiation / withholding application / verification status changes; idempotency on programmatic-ACH initiation (no double-pay).
- **D-14:** **Adviser-verify** annotations on withholding figures (local-only / legal-deferred); **i18n** parity en/en-US/de/pl/ar on any payout/verification UI strings.

### Claude's Discretion
- NACHA entry-type selection (PPD individual / CCD business / CTX with addenda), balanced-file mechanics, effective-entry-date computation, and ACH return-code (R01/R02/R03…) handling + retry — planner, mirroring the existing format generators.
- Fedwire file format + the exact high-value routing threshold (Same-Day ACH $1M until 2027-09-17) — planner.
- US bank-account fields (routing + account number) on `ContractorBillingProfile` vs a dedicated US bank model — planner, extending the encrypted-field pattern.
- The withholding rounding rule (single HALF-UP round; reuse the P86/money-rounding pattern) and the reconciliation aggregation shape the forms will read (D-02).
- Whether the settlement-currency choice surfaces per-run or per-org-default-with-override.
- Modern Treasury / Stripe Treasury / Plaid adapter interface signatures + which env-keyed credential blobs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — US-PAY-01..05 verbatim; line 21 Same-Day ACH $1M ceiling → Fedwire.
- `.planning/ROADMAP.md` (Phase 88 entry) — goal + 5 success criteria + research flag ("the W-9 backup-withholding flag must actually reduce payout by 24%, not just be stored").
- `.planning/phases/86-...86-CONTEXT.md` + `87-...87-CONTEXT.md` — the reported withholding (1099 box-4 / 1042-S box-2) this phase makes real; the backup-withholding flag set in P86 tin-match.
- `.planning/phases/83-...83-CONTEXT.md` — US region/USD enablement this builds on.

### Payment export + run
- `packages/api/src/services/payment-export.ts` (`ExportItem`, `OrgBankInfo`) + `payment-format-detection.ts` (`ExportFormat` enum, `detectFormat`) + `routers/finance/payment-export-router.ts` (`_generateExportFileForFormat` dispatch, `writeExportAndComplianceRows`) — the factory to extend for `ACH_NACHA`/`FEDWIRE` (D-10).
- `packages/db/prisma/schema/payment.prisma` — `PaymentRunItem` (`amountMinor`, `whtAmountMinor`, `whtRate`, `whtTreatyApplied`, `grossAmountMinor` — the deduction substrate, D-01), `PaymentExportFormat` enum.
- `packages/api/src/routers/finance/payment-shared.ts` (`loadEligibleInvoices`, `calculateWht`) + `payment-run-ops.ts` — the seeding/ops path to generalize for US withholding (D-01).

### Withholding source + currency
- `packages/api/src/services/tin-match.service.ts` (`setBackupWithholdingFlag` port — wire it, D-03) + `form-1099-nec.service.ts` (`computeBox4Minor`, `convertAmount`) + `treaty-rate.service.ts` (`applyTreaty` — 1042-S rate) + `tax-rate.service.ts` (`calculateWht` — SA path to generalize).
- `packages/api/src/services/exchange-rate.ts` (`parseEcbXml`, `fetchAndStoreRates`, peg derivations) — add USD=1.0 short-circuit (D-06).
- `packages/db/prisma/schema/organization.prisma` (`defaultCurrency`, `dataRegion`) + `contractor.prisma` (`Contractor.currency`; `ContractorBillingProfile.bankAccountEncrypted/bankAccountMasked/swiftBic` — D-12; add `backupWithholdingFlagged` D-03 + Plaid fields D-08).

### Integration framework (greenfield adapters)
- `packages/integrations/src/adapters/base-adapter.ts` (`BaseAdapter`) + `services/credential-service.ts` (`encryptCredentials`/`decryptCredentials` AES-256-GCM) + `types/provider.ts` — the seam for Modern Treasury / Stripe Treasury / Plaid (D-04/D-09).
- `packages/integrations/src/adapters/google-workspace-adapter.ts` (or `github-adapter.ts`) — existing OAuth/API adapter to mirror.

### Gating / audit
- `packages/api/src/middleware/require-us-expansion-flag.ts` + `packages/feature-flags/src/registry.ts` (PENDING flags for programmatic-ACH + Plaid live paths) + `packages/api/src/services/audit-writer.ts` + `packages/api/src/lib/idempotency.ts`.

### Documentation-follows-code (update in the same change set)
- `.planning/brain/wiki/domains/` (US payments / payout rail), `wiki/structure/api-routers-catalog.md`, `wiki/structure/prisma-schema-areas.md` (PaymentRunItem withholding, Contractor flag + Plaid fields), `wiki/integrations/` (Modern Treasury / Stripe Treasury / Plaid), `wiki/patterns/money-rounding.md` (withholding rounding) + `feature-flags.md`, `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for the "payment run is the withholding source of truth" invariant.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PaymentRunItem` withholding fields** (`whtAmountMinor`/`whtRate`/`whtTreatyApplied`/`grossAmountMinor`) — the deduction substrate already exists (Saudi-only today); generalize, don't rebuild (D-01).
- **Payment-export factory** (`payment-export.ts`, `payment-format-detection.ts`, `payment-export-router.ts`) — `ACH_NACHA`/`FEDWIRE` slot in like BACS/SWIFT/SEPA (D-10).
- **`exchange-rate.ts`** (ECB + peg derivations) — add USD=1.0 short-circuit for the settlement FX (D-06/D-07).
- **`ContractorBillingProfile`** (AES-256-GCM encrypted bank account + masked) — extend with US bank fields + Plaid status (D-08/D-12).
- **Integration `BaseAdapter` + AES-256-GCM credential store** + the GoogleWorkspace/GitHub OAuth adapters — the seam + mirror for Modern Treasury / Stripe / Plaid (D-04/D-09).
- **P86 `tin-match.service` `setBackupWithholdingFlag` port** — wire it to the new `Contractor.backupWithholdingFlagged` column (D-03).
- **`applyTreaty` (P85/P87) + `calculateWht` (SA)** — the withholding rates the deduction applies (D-01).
- **`require-us-expansion-flag`, `audit-writer`, `idempotency`** — gating/audit/dedupe.

### Established Patterns
- **Mock-behind-seam + flag-dark for live external providers** (86 IRIS, 87 1042-S transmit) — programmatic ACH (Modern Treasury) + Plaid follow it (D-04/D-05/D-09).
- **Fail-open advisory verification** (P84 USPS) — Plaid gating mirrors it (D-08).
- **Payment-export-factory format pattern** — new formats are additive generators + enum + detect rule (D-10).
- **Generalize a single jurisdiction's path** — the Saudi WHT path becomes the all-jurisdiction withholding path (D-01).
- **No hardcoded user-facing strings; i18n parity; adviser-verify on tax figures; AES-256-GCM for bank data.**

### Integration Points
- Payment-run seeding reads `Contractor.backupWithholdingFlagged` (D-03) + `applyTreaty` (1042-S) to compute `whtAmountMinor`; the recorded figure is what P86/P87 forms aggregate and report (D-02).
- `detectFormat` routes USD + US bank + US region → `ACH_NACHA` / `FEDWIRE` (D-10); programmatic path swaps the file tail for the Modern Treasury adapter when opted-in (D-04/D-05).
- Plaid status on `ContractorBillingProfile` surfaces as a payout-time advisory warning (D-08).
- Settlement currency drives whether the export carries USD or a converted local-currency amount (D-07).

</code_context>

<specifics>
## Specific Ideas

- **Reporting becomes real money here** — 86/87 record what *should* be withheld; 88 is where the payout is actually reduced, and the recorded payout figure becomes the truth the forms report (D-01/D-02). One withholding path, one source of truth.
- **File-first, programmatic-optional** — the NACHA/Fedwire file works with zero provider creds (GA-safe); Modern Treasury is the opt-in automation layer, dark until creds (D-04/D-05). Consistent with the milestone's "no GA blockers on external enrollment" posture.
- **Generalize, don't fork** — the Saudi WHT fields + path already model gross/net withholding; US backup-withholding and 1042-S treaty plug into the same fields rather than a parallel system (D-01).
- **Advisory anti-fraud** — Plaid verification is a signal that warns, not a gate that blocks, while mocked (D-08), matching the USPS precedent.

</specifics>

<deferred>
## Deferred Ideas

- **Live programmatic ACH (Modern Treasury / Stripe Treasury)** — built mock-behind-seam, flag-dark; activated when live provider credentials land.
- **Live Plaid Identity verification + hard-gating** — advisory/mock now; hard-block + live verification when Plaid creds land.
- **P86/P87 form ↔ payment reconciliation wiring** — D-02 sets the payment run as authoritative; the small follow-up so the 1099 box-4 / 1042-S box-2 read aggregated payment withholding is noted for P86/P87 touch-up (not a new capability).
- **Non-US programmatic rails / additional providers** — Modern Treasury is the US floor; other providers/rails when a market needs them.
- **`Worker`-type FK** — store the flag/fields against `Contractor` now; re-point after Theme B (Phase 89).

None of these expand the phase scope — discussion stayed within the US payout-rail + withholding-application boundary.

</deferred>

---

*Phase: 88-theme-a-us-payment-rail*
*Context gathered: 2026-06-18*
