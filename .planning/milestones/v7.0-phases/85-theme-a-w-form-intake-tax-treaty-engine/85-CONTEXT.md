# Phase 85: Theme A — W-Form Intake + Tax-Treaty Engine - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

US tax-status form **intake + a US treaty-rate engine** — capture (not yet file) a
US contractor's tax classification, and resolve the correct treaty article + rate:

1. **W-9 wizard** (US-FORM-01) — US-resident contractors: TIN + entity type +
   backup-withholding flag, stored + audited.
2. **W-8BEN / W-8BEN-E wizard** (US-FORM-02) — foreign contractors: treaty country +
   treaty-article picker, FTIN, certifications under penalties of perjury.
3. **US tax-treaty rate table** (US-LOC-02) — PL/DE/UK/UAE/KSA/IE/NL; auto-applied when
   contractor residency + US source + income type match a treaty row.
4. **W-8BEN treaty-article auto-populate** (US-LOC-03) — article + rate auto-filled from
   the contractor's home jurisdiction + treaty table.

**UI phase** (`frontend-design` skill applies; UI-SPEC gate fires in plan-phase).

**NOT this phase:** TIN-Matching, 1099-NEC generation, IRIS e-file (Phase 86); 1042-S,
US worker classification, determination letter (Phase 87). Official pixel-accurate IRS
form PDFs are **deferred** to the filing phases that build the PDF infra.
</domain>

<decisions>
## Implementation Decisions

### Treaty-Rate Table Model (US-LOC-02 / US-LOC-03)
- **D-01:** **Extend the existing `WithholdingTaxRate` model** (`packages/db/prisma/schema/tax.prisma:23`) — add `sourceCountry='US'` rows rather than a new dedicated US table. One lookup engine; Phase 87's 1042-S withholding reuses the same table. The model already carries `sourceCountry` / `contractorResidency` / `serviceType` / `standardRate` / `treatyRate` / `treatyReference` / `effectiveFrom`/`To`.
- **D-02:** Today `treatyReference` is **free-text** ("Saudi-Germany DTA Article 12") — insufficient for US-LOC-03 auto-populate. Add a **structured `treatyArticle` column** (e.g. `"Article 7"` / `"Article 14"`) plus an **`incomeType` discriminator** (reuse/repurpose `serviceType` as the income-type axis: independent-personal-services / business-profits). The W-8BEN line-10 auto-populate reads article + rate + income type from this row.
- **D-03:** **Seed the services / business-profits row per country** (PL, DE, UK, UAE/AE, KSA/SA, IE, NL) with its treaty article + rate — typically **0% when the contractor has no US fixed base/PE**. Royalties and other income types are **out of scope** this phase (most rows are dead weight for contractor payouts). Default when no treaty row / no valid form = **30%** statutory.
- **D-04:** **Adviser-verify posture** (carry-forward from Phase 84's IRS-prefix-table stance): seeded treaty rates/articles are real but **annotated for legal/tax-adviser verification** per the local-only / legal-deferred posture. No determination is presented as final legal advice.

### W-Form Storage + PDF Scope (US-FORM-01 / US-FORM-02)
- **D-05:** **Dedicated immutable record** — a new `UsTaxForm` / `TaxFormSubmission` table (NOT columns on `Contractor`). Fields: `formType` (W9 / W8BEN / W8BENE), `status` (draft / active / superseded), captured-field **snapshot**, treaty claim (article + rate + residency), signer identity, `signedAt`, `expiresAt` (W-8BEN ~3-yr validity), supersede chain, audit. FK to **`Contractor`** (see D-12). Re-certification **inserts a new row and supersedes** the prior one — never mutate a signed record.
- **D-06:** **Official IRS-form PDF generation is DEFERRED.** This phase captures structured fields + an **immutable signed JSON snapshot** + audit (the legal record retained by the payer). An **optional lightweight human-readable summary/receipt** is acceptable, but the pixel-accurate W-9 / W-8BEN / W-8BEN-E PDF lands with the filing-PDF infra (Phase 86/87). No duplicated PDF stack; matches the bootstrapped / no-product-theater posture.

### Wizard Surface + Form Routing (US-FORM-01 / US-FORM-02)
- **D-07:** **Portal self-service primary.** The contractor completes + self-certifies the wizard in the existing **portal** (`portalAppRouter`), because the beneficial owner is the legally-correct signer (W-8BEN signed under penalties of perjury; W-9 by the US person). Strongest legal posture; mirrors v2.0 portal self-service. Mutation procedures live on `portalAppRouter`.
- **D-08:** **Staff get a read/track surface** (status, request/remind a form, PII-gated summary) — NOT a co-equal on-behalf entry path. Staff-side PII follows the Phase-84 gating (`CONTRACTOR_PII:READ`, staff-router only). Full staff "enter on behalf" is **deferred** (weaker certification posture).
- **D-09:** **Auto-route the form from the existing profile + confirm/override.** `countryCode='US'` → W-9; foreign **individual / sole-trader** → W-8BEN; foreign **company** → W-8BEN-E (driven by `Contractor.countryCode` + `type`). Show the determination with a **confirm/override** step to cover edge cases (US person abroad, dual-status). Single source of truth, fewest wrong-form errors.

### Treaty Application + Certification Depth (US-LOC-02/03 / US-FORM-02)
- **D-10:** **Auto-detect + override + reason** — mirror `packages/api/src/services/reverse-charge.service.ts` (`detectReverseCharge` / `resolveReverseChargeDecision`): resolve the treaty rate from (residency, US-source, income type), **auto-populate** the W-8BEN article + rate, default to **30%** when no treaty / no valid form, allow a **manual override with a required reason + `writeAuditLog`**. Justified as a mechanical published-table lookup (like reverse-charge VAT), not a subjective classification verdict — and the **actual withholding is deferred to Phase 87** (1042-S), so this phase only captures the claim + rate.
- **D-11:** **Lightweight ESIGN-Act e-attestation.** Reproduce the IRS "under penalties of perjury" certification language as **required checkboxes** + **typed full legal name** + date, capturing **timestamp / IP / userId** into the immutable snapshot + audit (a valid electronic signature; IRS permits e-sign on W-8/W-9 with intent + identity + timestamp). W-8BEN-E also captures the **LOB category field** (line 14). **No external e-sign ceremony** (DocuSign/Autenti) — deferred; the self-cert the contractor already attests to does not warrant the integration dependency.

### Cross-Cutting
- **D-12:** ROADMAP says "stored against the **worker**", but the `Worker` abstraction is **Theme B (Phase 89)** — not built yet. **Store against `Contractor`** now (forward-compatible). Do NOT introduce a Theme-B dependency into Theme A.
- **D-13:** Wizard UI is fully i18n'd across **en / en-US / de / pl / ar (RTL)** per the standing parity rule; portal surface follows the web-vite page → container → hook → component architecture with mandatory loading / empty / error + WCAG states.

### Claude's Discretion
- Exact new column names/types on `WithholdingTaxRate` (`treatyArticle`, income-type representation) and whether `incomeType` is a Prisma enum vs reuse of `serviceType` — planner decides, preserving the existing `@@unique` key shape.
- The `UsTaxForm` snapshot serialization (JSON shape) + expiry/re-cert reminder mechanics — planner; a reminder/expiry surface may itself be a later concern.
- W-9 TIN handling: reuse the Phase-84 encrypted SSN / plain EIN already on the contractor vs re-collect in the wizard — planner derives from the P84 profile (prefer reuse; never re-expose full SSN).
- FTIN + foreign-address capture shape for W-8BEN — planner, mirroring existing country-fields validation.
- Whether to render the optional summary receipt (D-06) and its format.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — US-FORM-01, US-FORM-02, US-LOC-02, US-LOC-03 verbatim.
- `.planning/ROADMAP.md` (Phase 85 entry) — goal + 4 success criteria + research flag + UI hint; Phase 86/87 entries for the downstream filing scope this feeds.
- `.planning/phases/84-theme-a-us-contractor-profile-fields-en-us-locale/84-CONTEXT.md` — US profile, SSN/EIN handling, `CONTRACTOR_PII:READ` RBAC, en-US locale, country-fields dispatch (do not duplicate; build on it).
- `.planning/phases/82-...` & `83-...` CONTEXT.md — add-on billing / flag-registry + US region primitives gating this surface.

### Treaty-rate engine
- `packages/db/prisma/schema/tax.prisma` (`WithholdingTaxRate` model, line 23; `WhtCertificate` line 41 for the P87 cert analog) — the model to extend (D-01/D-02).
- `packages/db/prisma/seed/wht-rates.ts` — existing Saudi WHT seed shape to mirror for US rows (`upsert` via `prisma.withholdingTaxRate`).
- `packages/api/src/services/reverse-charge.service.ts` — `detectReverseCharge` / `resolveReverseChargeDecision` auto-detect + override + reason pattern to mirror (D-10).

### Wizard surface + forms
- `apps/web-vite/src/components/contractors/contractor-wizard/` (`wizard-dialog.tsx`, `step-*.tsx`, `hooks/use-contractor-wizard.ts`) — react-hook-form multi-step wizard pattern.
- `apps/web-vite/src/components/zatca/onboarding-wizard.tsx` + `stepper.tsx` + `tax-details-form.tsx` — closest analog: a multi-step compliance/tax intake wizard.
- `apps/web-vite/src/components/onboarding/organization-onboarding.tsx` — current Stepper (`reui/stepper`) + react-hook-form idiom.
- `packages/api/src/portal-root.ts` (`portalAppRouter`) — portal procedure surface for contractor self-service (D-07).
- `packages/validators/src/country-fields.ts`, `us-validators.ts` (added in P84) — TIN/FTIN/entity validation to extend for W-form inputs.

### PII / RBAC / audit
- `packages/auth/src/permissions.ts` + `roles.ts` — `CONTRACTOR_PII:READ` (note the duplicated `allPermissions` const on `owner`); staff PII-gated summary (D-08).
- `packages/api/src/services/audit-writer.ts` (`writeAuditLog`) — sign/override/reveal audit trail (D-05/D-10/D-11).

### UI
- `frontend-design` skill `SKILL.md` — MANDATORY before web-vite UI edits; then `impeccable` + `PRODUCT.md` register per the UI-skills routing.

### Documentation-follows-code (update in the same change set)
- `.planning/brain/wiki/domains/` (a US-tax / W-form domain page), `wiki/structure/api-routers-catalog.md` (new procedures), `wiki/structure/prisma-schema-areas.md` (`WithholdingTaxRate` extension + `UsTaxForm`), `wiki/structure/web-vite-domains.md` (wizard surface), `wiki/log.md` + `hot.md`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`WithholdingTaxRate` model + `wht-rates.ts` seed** — US treaty rows slot in as `sourceCountry='US'`; the lookup/upsert idiom already exists.
- **`reverse-charge.service.ts`** — auto-detect-from-jurisdictions + manual-override-with-reason is the exact engine shape for treaty resolution (D-10).
- **Multi-step wizard stack** — `contractor-wizard/`, `zatca/onboarding-wizard`, `organization-onboarding` all use `reui` `Stepper` + react-hook-form; the W-form wizard reuses this.
- **`portalAppRouter`** — contractor self-service procedure surface for the portal-primary wizard.
- **Phase-84 US profile** — `countryCode='US'`, encrypted SSN (+ last4 + gated reveal), plain EIN, entity `type`, `us-validators.ts` — the W-9 TIN + form-routing inputs already exist.
- **`writeAuditLog`** — sensitive-action audit for sign / override / staff reveal.

### Established Patterns
- **Auto-detect + manual override + required reason + audit** (reverse-charge) — treaty engine mirrors it exactly.
- **Sensitive data: encrypt + last4 + RBAC-gated reveal, staff-router only** (P84 SSN) — the W-form summary surface inherits this; never re-expose full SSN.
- **Immutable, supersede-able compliance records** (`WhtCertificate`, classification docs) — `UsTaxForm` follows (snapshot + status + supersede chain).
- **No hardcoded user-facing strings; i18n parity en/en-US/de/pl/ar(RTL)** — every wizard label/state string is i18n'd.
- **External integrations are opt-in dependencies** — formal e-sign deliberately deferred (D-11); lightweight ESIGN attestation instead.

### Integration Points
- Treaty rate resolution plugs into the same place reverse-charge does (jurisdiction pair → rate), and the resolved article/rate is what P87's 1042-S withholding will read.
- W-form records FK to `Contractor`; surfaced in the portal (contractor) + a staff read/track view.
- The W-8BEN treaty claim reads residency from the existing contractor profile (`countryCode`) and the new structured treaty row.

</code_context>

<specifics>
## Specific Ideas

- **One treaty engine, not two** — US rates live in the same `WithholdingTaxRate` table as Gulf WHT so there's a single resolution path feeding both Gulf WHT certificates and US 1042-S (P87).
- **Capture, don't file** — Phase 85 stops at an immutable signed self-certification + resolved treaty claim. Filing (1099/1042-S) and official IRS PDFs are P86/P87.
- **Beneficial owner signs** — portal self-service is a deliberate compliance choice, not just a UX one; the foreign person must self-certify.
- **Mechanical lookup ≠ verdict** — auto-applying a published treaty rate is consistent with the existing reverse-charge auto-apply; distinct from the classification-as-verdict liability the product deliberately avoids.
- Continue the "no product theater" posture — treaty rates are real (adviser-verify-flagged), the e-signature is a real ESIGN-valid attestation with an auditable trail.

</specifics>

<deferred>
## Deferred Ideas

- **Official pixel-accurate IRS W-9 / W-8BEN / W-8BEN-E PDF rendering** — defer to the filing phases that build PDF infra (Phase 86/87).
- **Royalties + other income-type treaty rows** — services/business-profits only this phase; other income types when a product needs them.
- **Formal e-sign ceremony (DocuSign/Autenti) + richer structured LOB** — lightweight ESIGN attestation suffices now; revisit if a counterparty demands a formal signature artifact.
- **Staff "enter on behalf" as a first-class path** — portal self-service is primary; on-behalf entry (with contractor-attestation caveat) deferred.
- **Form expiry / re-certification reminder surface** — `expiresAt` is captured now; the proactive reminder/notification flow can be a later concern.
- **`Worker`-type FK** — store against `Contractor` now; re-point to `Worker` only after Theme B (Phase 89) lands the abstraction.
- **Seeded treaty-rate / article legal verification** — annotated; legal/tax-adviser-deferred per posture.

None of these expand the phase scope — discussion stayed within the W-form intake + treaty-engine boundary.

</deferred>

---

*Phase: 85-theme-a-w-form-intake-tax-treaty-engine*
*Context gathered: 2026-06-16*
