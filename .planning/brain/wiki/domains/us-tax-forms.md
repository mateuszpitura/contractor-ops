---
title: US tax forms (W-9 / W-8BEN / W-8BEN-E) and treaty engine
type: domain
tags: [us, tax, w-form, treaty, portal, esign, immutable-record]
source_commit: 1f89de3934e82783bb2ef4d10dace4859cce21d3
verify_with:
  - apps/web-vite/src/components/portal/tax-forms/
  - apps/web-vite/src/components/contractors/tax-forms/
  - packages/api/src/routers/portal/portal-tax-form-router.ts
  - packages/api/src/routers/core/tax-form-router.ts
  - packages/api/src/services/tax-form.service.ts
  - packages/api/src/services/treaty-rate.service.ts
  - packages/api/src/services/tax-form-routing.ts
  - packages/api/src/services/tin-match.service.ts
  - packages/integrations/src/adapters/tin-match/
  - packages/validators/src/w-form-validators.ts
updated: 2026-06-17
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

## Entry points

| Piece | Path |
|-------|------|
| Portal procedures | `portal.getTaxFormDetermination` / `saveTaxFormDraft` / `submitTaxForm` / `getMyTaxForms` — `packages/api/src/routers/portal/portal-tax-form-router.ts` |
| Staff read/track | `taxForm.listFormSubmissions` / `requestTaxForm` — `packages/api/src/routers/core/tax-form-router.ts` |
| Record service | `packages/api/src/services/tax-form.service.ts` (`buildFormSnapshot` / `supersedeAndInsert` / `computeExpiry`) |
| Treaty engine | `packages/api/src/services/treaty-rate.service.ts` (`resolveTreatyDecision` / `applyTreaty`) |
| TIN-match service | `packages/api/src/services/tin-match.service.ts` (`matchRecipientTin` / `revalidateBatchTins` / `createDbTinMatchPersistence`) |
| TIN-match seam | `packages/integrations/src/adapters/tin-match/` (`TinMatchClient` / `MockTinMatchClient` default / `EServicesTinMatchClient` dark) |
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

## Agent mistakes

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

## Related

- [[domains/tax-and-wht]]
- [[domains/portal-external]]
- [[domains/contractors-engagements]]
- [[structure/key-services]]
- [[structure/api-routers-catalog]]
