# Phase 56 — Steuerberater Review Deliverable

**Status:** commissioned — awaiting sign-off
**Commissioned:** 2026-04-12
**Target completion:** before Phase 56 ships to production
**Reviewer:** _{name + qualification — to be filled by project owner when reviewer is engaged}_

---

## Scope Summary

Per Phase 56 CONTEXT.md decision D-13, German legal and tax terminology shipped by the automated pipeline must be independently reviewed by a licensed Steuerberater (German tax adviser) with DSGVO competence before Phase 56 is released to production. The pipeline output (AI-drafted + locked constants + vetted MDX) is allowed to ship to **staging** without this sign-off; a production release is gated on the sign-off captured below.

This document enumerates every artefact the reviewer must inspect, the exact file paths to read, the review questions to answer, and the sign-off slots to fill.

---

## Review Scope

### 1. Locked German legal phrases (9 constants)

The following phrases are source-locked in `packages/validators/src/legal/de.ts`. They are imported verbatim by all consuming surfaces (privacy notice MDX, PDF generator, profile labels). A CI guard (`packages/validators/src/__tests__/locked-phrases-guard.test.ts`) forbids these identifiers from appearing in `messages/*.json` and asserts each phrase is used inside `packages/validators/src/privacy-notices/de.ts`.

| # | Constant | Canonical text |
|---|----------|----------------|
| 1 | `GDPR_CONTROLLER_LABEL` | Verantwortlicher im Sinne der DSGVO |
| 2 | `GDPR_RIGHTS_HEADING` | Ihre Rechte als betroffene Person |
| 3 | `GDPR_DPO_LABEL` | Datenschutzbeauftragter |
| 4 | `GDPR_COMPLAINT_HEADING` | Beschwerderecht bei der Aufsichtsbehörde |
| 5 | `TAX_USTIDNR_LABEL` | Umsatzsteuer-Identifikationsnummer (USt-IdNr) |
| 6 | `TAX_STEUERNUMMER_LABEL` | Steuernummer |
| 7 | `TAX_HANDELSREGISTER_LABEL` | Handelsregisternummer |
| 8 | `TAX_SOZIALVERSICHERUNGSNUMMER_LABEL` | Sozialversicherungsnummer |
| 9 | `TAX_KLEINUNTERNEHMER_LABEL` | Kleinunternehmer gemäß § 19 UStG |

Review question: is each phrase the canonical German form used in current-practice DSGVO notices and profile/compliance UIs? Flag deviations in the sign-off table below.

### 2. German Datenschutzerklärung text

Full review of:

- `packages/validators/src/privacy-notices/de.ts` — structured privacy-notice data module (consumed by tRPC + PDF)
- `apps/web/src/app/[locale]/(legal)/privacy/(content)/de.mdx` — MDX render surface

Evaluate against:

- DSGVO Art. 13 / 14 required disclosure elements
- BfDI Muster (sample) text alignment
- BDSG-specific clauses (§ 26, § 38, etc., where applicable)
- Precise identification of data categories, recipients, retention periods, legal bases
- Required data-subject rights enumeration (access, rectification, erasure, portability, objection, automated decision-making)
- Supervisory-authority complaint right (Art. 77) with correct wording

### 3. Formal Sie register across `apps/web/messages/de.json`

The CI guard already scans for Du/Dir/Dein-form slips; human review catches borderline cases (e.g. Duzen embedded in nouns, idiomatic phrases, or new strings added after the guard last ran).

Additionally review tone: B2B SaaS in Germany uses formal Sie throughout, consistent with banking/accounting software.

### 4. SV-Nummer (Sozialversicherungsnummer) checksum algorithm

Validator path: `packages/validators/src/de-validators.ts` (function `isValidSvNummer` with the `mod11_10CheckDigit` helper).

Assumption flagged in 56-VALIDATION.md (**A3**): the weight array `[2, 1, 2, 5, 7, 1, 2, 1, 2, 1, 2, 1]` applied to the 12-digit SV-Nummer layout reproduces the DRV (Deutsche Rentenversicherung) internal check digit.

Review task: validate 5 real-world SV-Nummern (with owner consent) OR synthetic DRV test vectors against the implementation. Record results below.

### 5. Steuernummer per-Bundesland regex table

File: `packages/validators/src/steuernummer-formats.ts`.

Contains 16 Bundesland entries mapping to ELSTER-compatible regex + placeholder examples. Verify format stability against current (2026-04) Finanzamt practice. Flag any states where format changed since research date.

### 6. Handelsregister court list completeness

File: `packages/validators/src/handelsregister-courts.ts`.

~120 Amtsgericht entries with registry jurisdiction. Cross-reference against <https://www.justiz.de/onlinedienste/registerportal_der_laender/index.php>. Flag missing, renamed, or consolidated courts.

### 7. UI copy sanity (DE-locale profile surfaces)

Render the authenticated app in DE locale and review:

- Country Compliance card for a DE-country contractor (USt-IdNr, Steuernummer, Handelsregister fieldset, Sozialversicherungsnummer, Kleinunternehmer toggle)
- Onboarding privacy-acknowledgement checkbox + link label ("Ich habe die Datenschutzerklärung gelesen und verstanden.")
- `/de/legal/privacy/de` Datenschutzerklärung page (MDX + TOC + PDF download)
- Footer legal link (`Datenschutz · Impressum · © 2026 Contractor Ops`)

Review question: does the copy feel natural to a German-speaking B2B user? Are idioms correct? Are tax labels unambiguous?

---

## Deliverable Format

Reviewer returns this document with each item classified as **approved** or **changes required**, with concrete corrections or annotations in the Notes column.

| Item | Status | Corrections required | Notes |
|------|--------|----------------------|-------|
| 1. Locked phrases | ☐ approved ☐ changes | ... | ... |
| 2. Datenschutzerklärung text | ☐ approved ☐ changes | ... | ... |
| 3. Formal Sie register | ☐ approved ☐ changes | ... | ... |
| 4. SV-Nummer vectors | ☐ approved ☐ changes | ... | ... |
| 5. Steuernummer regex (16 states) | ☐ approved ☐ changes | ... | ... |
| 6. Handelsregister courts | ☐ approved ☐ changes | ... | ... |
| 7. UI copy sanity | ☐ approved ☐ changes | ... | ... |

---

## Materials Delivered to Reviewer

The following files/snapshots are attached to the reviewer engagement:

- `packages/validators/src/legal/de.ts`
- `packages/validators/src/privacy-notices/de.ts`
- `apps/web/src/app/[locale]/(legal)/privacy/(content)/de.mdx`
- `apps/web/messages/de.json`
- `packages/validators/src/de-validators.ts` (SV-Nummer algorithm + USt-IdNr + Steuernummer validators)
- `packages/validators/src/steuernummer-formats.ts` (16-state regex table)
- `packages/validators/src/handelsregister-courts.ts` (~120 courts)
- Screenshots of DE-locale profile UI, onboarding consent step, privacy-notice page, and footer
- Staging URL with DE-locale demo organization pre-seeded

---

## Integration Plan After Sign-Off

Once every item in the sign-off table is marked ☐ **approved**:

1. Apply all reviewer corrections to the source files in the order prescribed below so the CI guard remains GREEN throughout:
   a. Locked-phrase corrections → edit `packages/validators/src/legal/de.ts` first (single source of truth).
   b. Downstream consumers regenerate naturally: `privacy-notices/de.ts`, `de.mdx`, PDF template.
   c. `messages/de.json` translation corrections → edit and re-run `pnpm --filter @contractor-ops/validators test --run locked-phrases`.
   d. SV-Nummer algorithm corrections → edit `packages/validators/src/de-validators.ts` + append reviewer-supplied test vectors to the validators test suite.
   e. Steuernummer regex / Handelsregister court corrections → edit respective data modules.
2. Re-run `pnpm turbo run test` — all test suites must remain GREEN (locked-phrase guard, consent validator, onboarding consent step).
3. Update this document header:
   - `Status: approved YYYY-MM-DD`
   - `Reviewer: {name + qualification}`
   - Fill the sign-off block below.
4. Update `.planning/STATE.md`: move the "German Steuerberater review" blocker from the pending list to resolved.
5. Unblock Phase 56 production release.

---

## Sign-Off

**Reviewer signature:** ______________________
**Qualification:** ______________________ (e.g. Steuerberater, Hamburg; Datenschutzbeauftragte/r)
**Date:** ______________________
**Decision:** ☐ approved ☐ changes required

---

_This document is tracked as part of Phase 56 deliverables and is committed to the repository alongside the pipeline outputs. A production release of Phase 56 without this document in `Status: approved` state is an explicit opt-in by the project owner (see Plan 08 Task 3 checkpoint resume-signals `approved` vs `defer`)._
