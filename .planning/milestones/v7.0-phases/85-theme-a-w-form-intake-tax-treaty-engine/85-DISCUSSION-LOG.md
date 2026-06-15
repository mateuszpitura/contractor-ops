# Phase 85: Theme A — W-Form Intake + Tax-Treaty Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 85-theme-a-w-form-intake-tax-treaty-engine
**Areas discussed:** Treaty-rate table model, W-form storage + PDF scope, Wizard surface (who signs), Treaty apply + cert depth

---

## Treaty-rate table model

| Option | Description | Selected |
|--------|-------------|----------|
| Extend WithholdingTaxRate | Add `sourceCountry='US'` rows + structured treatyArticle column; one engine, P87 1042-S reuses it | ✓ |
| New dedicated UsTreatyRate table | US-specific shape decoupled from Gulf WHT; second engine to maintain | |
| You decide | Defer to Claude | |

**User's choice:** Extend WithholdingTaxRate.
**Notes:** Follow-up on article shape — selected **Services-focused + article col**: add structured `treatyArticle` + `incomeType` discriminator; seed the services/business-profits row per country (PL/DE/UK/UAE/KSA/IE/NL) with article + rate (typically 0% no-PE); royalties/other income types out of scope. (Alternatives offered: full income-type matrix; you decide.)

---

## W-form storage + PDF scope

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated immutable record | New UsTaxForm table: formType + status + snapshot + treaty claim + signer + expiresAt + supersede chain + audit, FK Contractor | ✓ |
| Columns on Contractor | Simplest; no version history, no expiry/supersede, loses immutable signed snapshot | |
| You decide | Defer to Claude | |

**User's choice:** Dedicated immutable record.
**Notes:** Follow-up on PDF — selected **Defer official PDF**: capture structured fields + immutable signed JSON snapshot + audit this phase; optional lightweight summary receipt; pixel-accurate IRS PDF deferred to filing-PDF infra (P86/87). (Alternative offered: render official PDF now.)

---

## Wizard surface (who signs)

| Option | Description | Selected |
|--------|-------------|----------|
| Portal self-service primary | Contractor self-certifies in portal; staff read/track + request; strongest legal posture (beneficial owner signs) | ✓ |
| Staff-entered on behalf | Staff fill from contractor info; faster but weaker certification posture | |
| Both, co-equal | Portal + staff entry as first-class paths; most surface/cost | |
| You decide | Defer to Claude | |

**User's choice:** Portal self-service primary.
**Notes:** Follow-up on form routing — selected **Auto-route + confirm**: derive W-9/W-8BEN/W-8BEN-E from existing profile (countryCode + entity type) with a confirm/override step for edge cases (US person abroad, dual-status). (Alternative offered: contractor self-selects.)

---

## Treaty apply + cert depth

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect + override + reason | Mirror reverse-charge.service.ts: resolve rate from (residency, US-source, income type), auto-populate article+rate, default 30% no-treaty, override+reason+audit | ✓ |
| Advisory only | Surface suggested article/rate, never auto-apply | |
| You decide | Defer to Claude | |

**User's choice:** Auto-detect + override + reason.
**Notes:** Follow-up on certification depth — selected **Lightweight e-attestation**: IRS "under penalties of perjury" language as required checkboxes + typed full legal name + date, capturing timestamp/IP/userId into the immutable snapshot + audit (ESIGN-valid); W-8BEN-E captures the LOB category field; no external e-sign ceremony. (Alternative offered: formal e-sign + full LOB via DocuSign/Autenti.)

---

## Claude's Discretion

- Exact new column names/types on `WithholdingTaxRate` (`treatyArticle`, income-type as enum vs reuse of `serviceType`) — preserve the `@@unique` key shape.
- `UsTaxForm` snapshot JSON shape + expiry/re-cert reminder mechanics.
- W-9 TIN: reuse P84 encrypted SSN / plain EIN vs re-collect (prefer reuse; never re-expose full SSN).
- FTIN + foreign-address capture shape for W-8BEN (mirror existing country-fields validation).
- Whether to render the optional summary receipt and its format.

## Deferred Ideas

- Official pixel-accurate IRS W-9/W-8BEN/W-8BEN-E PDF rendering — Phase 86/87.
- Royalties + other income-type treaty rows — services/business-profits only this phase.
- Formal e-sign ceremony (DocuSign/Autenti) + richer structured LOB.
- Staff "enter on behalf" as a first-class path.
- Form expiry / re-certification reminder surface (`expiresAt` captured now).
- `Worker`-type FK — store against `Contractor` until Theme B (Phase 89) lands.
- Seeded treaty-rate / article legal verification — adviser-deferred per posture.
