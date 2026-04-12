# Phase 56: Country Foundations & German i18n - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing v4.0 country-aware foundation (Phase 47 `countryFields`, Phase 50 next-intl i18n, Phase 51 privacy notices) to UK and Germany: add UK/DE contractor profile fields with local checksum validation, ship German as the third platform locale with protected legal terminology, and deliver jurisdiction-appropriate GDPR privacy notices. Phase 56 is onboarding-and-profile-layer compliance only — government API validation (HMRC/VIES) is Phase 57, classification engines are Phase 58+, e-invoicing is Phase 61+.

</domain>

<decisions>
## Implementation Decisions

### Tax ID Validation (UK & DE)
- **D-01:** Local validation does format regex + checksum algorithm where defined — no HMRC/VIES calls in this phase (Phase 57 adds live lookup on top). Catches typos at save time for better UX.
- **D-02:** UK validators: UTR (10 digits, mod-11 checksum), Companies House number (8 chars, alphanumeric for Scottish/NI variants), VAT registration (`GB` + 9 digits with mod-97 checksum; also support GBGD/GBHA government formats).
- **D-03:** DE validators: USt-IdNr (`DE` + 9 digits, MOD-11-10 checksum), Sozialversicherungsnummer (12 chars, structural checksum), Steuernummer (Bundesland dropdown drives per-state regex — 16 format variants), Handelsregister (court code + HRB/HRA + number; split into three inputs).
- **D-04:** Country-gated required-field rules — UK: VAT reg required only if `isVatRegistered=true` (new boolean toggle); UTR required for sole traders; Companies House required for Ltd. DE: Steuernummer required; USt-IdNr required only if `isVatRegistered=true` and not Kleinunternehmer; Handelsregister required only for GmbH/UG entity types. Entity-type field drives conditional requirements.

### Legal Terminology Locking
- **D-05:** Mandatory German legal phrases live as typed TypeScript constants in a dedicated module (e.g. `packages/validators/src/legal/de.ts`). Translation files (`messages/de.json`) cannot contain these keys — enforced by a CI check that greps message files for reserved key names and fails the build if found.
- **D-06:** CI guard additionally verifies that rendered GDPR notices and profile UI tax labels contain the exact required phrases at build or test time. Two layers of protection: schema-level (no forbidden keys in JSON) + output-level (required strings present in rendered components).
- **D-07:** Phase 56 scope for locked phrases is GDPR notice mandatory phrasing + profile/onboarding tax label strings only. Invoice and XRechnung/ZUGFeRD phrases (e.g. reverse-charge labels on invoices) are locked in Phases 61 and 62 where those documents are actually generated.

### GDPR Notice Delivery
- **D-08:** Each jurisdiction notice renders as an MDX/HTML page at `/legal/privacy` (accessible, searchable, version-stamped, anchored sections) with a 'Download as PDF' action that reuses Phase 51's React-PDF template with jurisdiction-specific merge data. Dual surface: web-native reading + legal-grade PDF artifact on demand.
- **D-09:** Jurisdiction selection follows `organization.countryCode`: UK orgs see UK GDPR notice, DE orgs see Datenschutzerklärung, other EU orgs fall back to the existing generic EU GDPR notice (Phase 51 pattern). Notice is org-scoped, not user-locale-scoped — a German-speaking user at a UK org sees the UK notice (legally correct).
- **D-10:** Notice surfaces: persistent `/legal/privacy` link in the app footer for always-on access + required 'I have read and understood the privacy notice' checkbox inside the existing Phase 51 D-04 blocking onboarding consent step. No duplicate onboarding step — extend the existing one with the new jurisdictions.

### German Locale Rollout
- **D-11:** Add `de` to `routing.locales` globally (alongside `en`, `pl`, `ar`) in `apps/web/src/i18n/routing.ts`. DE-country organizations default `language` to `de` at creation; any user can switch via the existing language selector. Follows the Arabic precedent — Arabic is already a global locale, not gated to Gulf orgs.
- **D-12:** `localeSettings` in `apps/web/src/i18n/request.ts` extended with `de: { timeZone: 'Europe/Berlin', currency: 'EUR' }`. Formal register (Sie, not Du) enforced via translator brief + Steuerberater review checklist; no programmatic detection.
- **D-13:** Translation workflow follows Phase 50 D-03 precedent: Claude generates initial `messages/de.json` from `messages/en.json`, then a German tax/legal professional (Steuerberater) reviews legal-adjacent strings and corrects terminology. STATE.md already flags this review as a Phase 56 deliverable.

### Country Field Form UX
- **D-14:** Reuse Phase 47's existing 'Country Compliance' conditional section inside the contractor profile tabs (Phase 47 D-07). Add UK and DE field groups to the same conditional driven by `organization.countryCode`. Fields defined by per-country Zod schema validating the `countryFields` JSONB column (Phase 47 D-06). No new tab, no abstraction refactor — consistent with UAE/SA pattern already in production.

### Claude's Discretion
- Exact Steuernummer regex list per Bundesland (publish as a lookup map)
- Bundesland dropdown UX (sorted by population vs alphabetical)
- Handelsregister court-code picker UX (autocomplete vs static dropdown)
- React-PDF template styling for GDPR PDFs (inherit Phase 51 styles)
- MDX authoring structure for `/legal/privacy/*` pages (sections, anchors, TOC)
- Specific CI check implementation (ESLint rule vs standalone grep script vs vitest test)
- `de.json` namespace layout (one file vs split by domain — match existing pattern)
- Sozialversicherungsnummer format handling (old vs new format coexistence)

### Folded Todos
No todos folded — no pending backlog items matched Phase 56 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — FOUND-01 through FOUND-06 (UK/DE contractor fields, DE locale, GDPR notices)
- `.planning/ROADMAP.md` §Phase 56 — Goal, success criteria, dependencies
- `.planning/STATE.md` — v5.0 roadmap decisions; flags Steuerberater review as Phase 56 work

### Prior phase context (foundations this phase extends)
- `.planning/milestones/v4.0-phases/47-vat-engine-wht-calculator-country-fields/47-CONTEXT.md` — D-06 `countryFields` JSONB on Contractor, D-07 Country Compliance conditional section (no new tab), per-country Zod schemas
- `.planning/milestones/v4.0-phases/50-arabic-localization-rtl-layout/50-CONTEXT.md` — D-01 Tailwind logical properties, D-03 AI + professional review translation workflow (precedent for DE)
- `.planning/milestones/v4.0-phases/51-pdpl-compliance/51-CONTEXT.md` — D-03 Template-based React-PDF with jurisdiction merge data, D-04 blocking onboarding consent step pattern

### Existing infrastructure (must read to integrate correctly)
- `apps/web/src/i18n/routing.ts` — next-intl locales config; add `de`
- `apps/web/src/i18n/request.ts` — `localeSettings` map; add DE timeZone/currency
- `apps/web/messages/{en,pl,ar}.json` — existing translation file structure to mirror for `de.json`
- `packages/db/prisma/schema/organization.prisma` — `countryCode @db.Char(2)`, `language` fields that drive activation
- `packages/db/prisma/schema/contractor.prisma` — `countryFields Json?` column (line 36); location for UK/DE Zod schemas
- `packages/db/prisma/seed/tax-rates.ts` — VAT rate seed pattern; UK 20%/5%/0% and DE 19%/7% seeds belong here (Phase 57 requirement — Phase 56 may stage schema but live invoice use is Phase 57)
- `packages/validators/src/contractor.ts` — Existing Zod contractor schemas; extend with UK/DE countryFields variants
- `apps/web/src/app/` — Locale-prefixed routes; `/legal/privacy` page lives here

### Legal & regulatory references
- UK GDPR (Data Protection Act 2018) — privacy notice required elements
- German BDSG (Bundesdatenschutzgesetz) + GDPR Art. 13/14 — Datenschutzerklärung requirements; BfDI-aligned phrasing
- HMRC UTR/VAT number specifications — checksum algorithms (mod-11, mod-97)
- BMF USt-IdNr — MOD-11-10 checksum algorithm
- DSRV Sozialversicherungsnummer — structural format spec

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `countryFields Json?` on Contractor (Phase 47) — UK/DE schemas plug in directly, no column migration needed
- Per-country Zod schema pattern (Phase 47 D-06) — UAE/SA variants establish the shape for UK/DE
- next-intl setup (`routing.ts` + `request.ts`) — adding `de` locale is a 2-line change + translation file
- React-PDF template system from Phase 51 — GDPR PDF reuses the jurisdiction-merge pipeline
- Blocking onboarding consent step (Phase 51 D-04) — extend with UK/DE privacy notice acknowledgement
- Organization `countryCode`, `language` fields — drive all conditional behavior
- Phase 50's `<Bdi>` component + Tailwind logical properties — DE locale inherits all RTL/LTR flexibility
- `localeSettings` map (Phase 50) — append DE entry with Europe/Berlin timezone and EUR currency

### Established Patterns
- Zod schema validation at all boundaries (profile save, API, invoice)
- DB-driven configuration (TaxRate table from Phase 47) — UK/DE VAT seeds follow this
- Org-country-driven feature activation (Phases 47, 50, 51) — consistent activation model
- Translation file per locale (`messages/{locale}.json`); AI-first + professional review for non-English locales (Phase 50)
- Template-based legal PDF generation with React-PDF (Phase 51)
- Audit-log and append-only record patterns for compliance-sensitive data (Phase 51 ConsentRecord)

### Integration Points
- Contractor profile form — Country Compliance conditional section gains UK/DE field groups
- Organization onboarding wizard — extends Phase 51's blocking consent step with UK/DE notice acknowledgement
- App footer — persistent `/legal/privacy` link (new surface)
- Locale switcher — gains German option alongside existing en/pl/ar
- `messages/de.json` — new file mirroring `en.json` structure
- `packages/validators/src/legal/de.ts` — new module holding locked German legal constants
- CI pipeline — new check step for locked-phrase enforcement

</code_context>

<specifics>
## Specific Ideas

- Steuernummer input pattern: Bundesland dropdown first, then masked format input matching that state's regex — avoids confusing users with the wrong validator
- Handelsregister pattern: three-field composite (court code autocomplete, HRB/HRA radio, number) rather than a single free-text field — closer to how it's actually written on German commercial docs
- Invoice reverse-charge label: "Steuerschuldnerschaft des Leistungsempfängers" must render exactly (unicode-precise) — CI check verifies the string on any invoice template that uses the reverse-charge flag
- Formal register: translator brief mandates Sie, not Du, across all `de.json` strings; Steuerberater review explicitly checklists register consistency

</specifics>

<deferred>
## Deferred Ideas

- HMRC live UTR/VAT lookup — Phase 57 (Government API Clients)
- VIES live USt-IdNr validation with qualified confirmation — Phase 57
- UK/DE VAT rate application to invoices — Phase 57 (seeds may be staged here but live use is Phase 57)
- Invoice-level reverse-charge label locking — Phase 61 (XRechnung) / Phase 62 (ZUGFeRD)
- Classification-document German phrase locking (SDS, audit defense) — Phase 59
- BACS payment export formatting — Phase 63
- Hijri-calendar-style German locale date nuances (DIN 5008 number formatting edge cases) — deferred unless Steuerberater review flags it

### Reviewed Todos (not folded)
None — no pending todos matched Phase 56 scope.

</deferred>

---

*Phase: 56-country-foundations-german-i18n*
*Context gathered: 2026-04-12*
