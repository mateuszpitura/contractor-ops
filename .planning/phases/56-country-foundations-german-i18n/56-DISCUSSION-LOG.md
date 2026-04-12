# Phase 56: Country Foundations & German i18n - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 56-country-foundations-german-i18n
**Areas discussed:** Tax ID validation depth, Legal terminology locking, GDPR notice delivery, German locale rollout + form UX

---

## Tax ID Validation Depth

### Q1: UK tax ID validation depth (UTR, Companies House, VAT)

| Option | Description | Selected |
|--------|-------------|----------|
| Format + checksum | Regex + mod-11 / mod-97 checksums; catches typos at save; Phase 57 adds HMRC live | ✓ |
| Format regex only | Structural validation only; typos slip through until Phase 57 | |
| Structural shape only | Accept any reasonable string; defer everything to Phase 57 | |

**User's choice:** Format + checksum (Recommended)
**Notes:** Best UX — catches typos at save time without a network call.

### Q2: DE tax ID validation depth

| Option | Description | Selected |
|--------|-------------|----------|
| Format + checksum where defined | USt-IdNr MOD-11-10, SV-Nr structural, Steuernummer per-Bundesland, Handelsregister court split | ✓ |
| Format regex only | Shape-only, no Bundesland awareness, no MOD-11-10 | |
| Optional with loose validation | Only USt-IdNr strict; rest free-text length-capped | |

**User's choice:** Format + checksum where defined (Recommended)
**Notes:** 16 Bundesland regex variants required for Steuernummer; SV-Nr checksum layer included.

### Q3: Required vs optional fields

| Option | Description | Selected |
|--------|-------------|----------|
| Country-gated requirements | VAT reg required if VAT-registered; UTR for sole traders; Handelsregister for GmbH | ✓ |
| All fields required | Everything mandatory — blocks onboarding mid-registration | |
| All fields optional | Collect what you have, validate at invoice time | |

**User's choice:** Country-gated requirements (Recommended)
**Notes:** Entity-type field drives conditional requirements. Kleinunternehmer exemption respected for USt-IdNr.

---

## Legal Terminology Locking

### Q4: Storage/enforcement mechanism for locked German phrases

| Option | Description | Selected |
|--------|-------------|----------|
| Code constants + CI guard | Typed TS constants; translation files can't contain keys; CI grep guard | ✓ |
| Separate locked JSON + schema guard | `messages/de.legal.json` with Zod schema enforcing exact values | |
| Code constants only | TS constants used directly in generators; no CI check | |

**User's choice:** Code constants + CI guard (Recommended)
**Notes:** Two layers — schema-level (no forbidden keys) + output-level (required strings in rendered components).

### Q5: Scope of first locking pass in Phase 56

| Option | Description | Selected |
|--------|-------------|----------|
| GDPR notices + UI labels only | Privacy notice required phrases + profile/onboarding tax labels; invoice phrases in Phases 61/62 | ✓ |
| All DE legal phrases project-wide | Inventory every phrase across all domains now | |
| GDPR notices only | Just privacy notice phrases; tax label UI stays in de.json | |

**User's choice:** GDPR notices + UI labels only (Recommended)
**Notes:** Invoice/XRechnung/ZUGFeRD phrasing belongs in the phases that generate those documents.

---

## GDPR Notice Delivery

### Q6: Delivery channel

| Option | Description | Selected |
|--------|-------------|----------|
| HTML page + downloadable PDF | MDX page at `/legal/privacy` + PDF via Phase 51 React-PDF template | ✓ |
| HTML/MDX only | Web-only, print from browser if needed | |
| React-PDF only | Reuse Phase 51 verbatim; no web page | |

**User's choice:** HTML page + downloadable PDF (Recommended)
**Notes:** Best UX: web-native reading + legal-grade artifact on demand. Maximum reuse of Phase 51 PDF template.

### Q7: Jurisdiction detection

| Option | Description | Selected |
|--------|-------------|----------|
| Org countryCode drives notice | UK org → UK notice; DE org → Datenschutzerklärung; other EU → existing generic | ✓ |
| User locale drives notice | Notice language follows UI — legally incorrect for multinational users | |
| Explicit selector | Org admin picks during onboarding | |

**User's choice:** Org countryCode drives notice (Recommended)
**Notes:** Consistent with Phase 47's countryCode activation; legally correct (org jurisdiction, not user locale).

### Q8: Where users reach the notice

| Option | Description | Selected |
|--------|-------------|----------|
| Footer link + onboarding consent step | Persistent footer + required checkbox in Phase 51 blocking step | ✓ |
| Onboarding only | Shown once; settings link after | |
| Settings page only | Under Settings → Legal & Compliance | |

**User's choice:** Footer link + onboarding consent step (Recommended)
**Notes:** Extend Phase 51 D-04 onboarding step with UK/DE notice acknowledgement — no duplicate step.

---

## German Locale Rollout + Form UX

### Q9: German locale availability

| Option | Description | Selected |
|--------|-------------|----------|
| Global + auto-default for DE orgs | `de` in routing.locales globally; DE-country orgs default language=de | ✓ |
| Global, manual opt-in only | Add `de` but never auto-default | |
| DE orgs only (gated) | German only appears for DE-country orgs | |

**User's choice:** Global + auto-default for DE orgs (Recommended)
**Notes:** Matches Arabic precedent from Phase 50 — global locale, not country-gated.

### Q10: Translation workflow

| Option | Description | Selected |
|--------|-------------|----------|
| AI first-pass + Steuerberater review | Claude generates de.json; German tax/legal pro reviews legal strings | ✓ |
| AI-only for Phase 56 | Ship Claude output; review later | |
| Lokalise/Crowdin service | Professional translators via TMS | |

**User's choice:** AI first-pass + Steuerberater review (Recommended)
**Notes:** Follows Phase 50 D-03 precedent. STATE.md already flags Steuerberater review as Phase 56 deliverable.

### Q11: Country-specific form fields UX

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Phase 47 conditional section | Reuse Country Compliance section inside existing profile tabs | ✓ |
| Jurisdiction-schema renderer | Generic driver reading country schema registry | |
| Dedicated tab per country | New Compliance tab — violates Phase 47 D-07 | |

**User's choice:** Extend Phase 47 conditional section (Recommended)
**Notes:** Consistent with UAE/SA pattern in production; no refactor risk.

---

## Claude's Discretion

- Exact per-Bundesland Steuernummer regex lookup map
- Bundesland dropdown ordering and Handelsregister court picker UX
- React-PDF template styling inheritance from Phase 51
- MDX structure for `/legal/privacy/*` pages
- CI check implementation form (ESLint rule vs script vs vitest)
- `de.json` namespace layout
- Sozialversicherungsnummer old/new format coexistence

## Deferred Ideas

- HMRC live UTR/VAT lookup — Phase 57
- VIES live USt-IdNr validation — Phase 57
- UK/DE VAT rate invoice application — Phase 57
- Invoice/XRechnung/ZUGFeRD phrase locking — Phases 61–62
- SDS and audit defense German phrases — Phase 59
- BACS export formatting — Phase 63
