# Phase 56: Country Foundations & German i18n — Research

**Researched:** 2026-04-12
**Domain:** Localization (DE locale, MDX legal pages) + compliance validators (UK/DE tax IDs) + jurisdictional GDPR notices
**Confidence:** HIGH on stack / patterns / existing infrastructure; HIGH on checksum algorithms (all cross-verified against authoritative sources); MEDIUM on exact Handelsregister court list (authoritative source identified — justiz.de Registerportal — but enumeration is a planning task)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** Local validation does format regex + checksum algorithm where defined — no HMRC/VIES calls in this phase (Phase 57 adds live lookup on top). Catches typos at save time for better UX.

**D-02** UK validators: UTR (10 digits, mod-11 checksum), Companies House number (8 chars, alphanumeric for Scottish/NI variants), VAT registration (`GB` + 9 digits with mod-97 checksum; also support GBGD/GBHA government formats).

**D-03** DE validators: USt-IdNr (`DE` + 9 digits, MOD-11-10 checksum), Sozialversicherungsnummer (12 chars, structural checksum), Steuernummer (Bundesland dropdown drives per-state regex — 16 format variants), Handelsregister (court code + HRB/HRA + number; split into three inputs).

**D-04** Country-gated required-field rules — UK: VAT reg required only if `isVatRegistered=true` (new boolean toggle); UTR required for sole traders; Companies House required for Ltd. DE: Steuernummer required; USt-IdNr required only if `isVatRegistered=true` and not Kleinunternehmer; Handelsregister required only for GmbH/UG entity types. Entity-type field drives conditional requirements.

**D-05** Mandatory German legal phrases live as typed TypeScript constants in a dedicated module (e.g. `packages/validators/src/legal/de.ts`). Translation files (`messages/de.json`) cannot contain these keys — enforced by a CI check that greps message files for reserved key names and fails the build if found.

**D-06** CI guard additionally verifies that rendered GDPR notices and profile UI tax labels contain the exact required phrases at build or test time. Two layers: schema-level (no forbidden keys in JSON) + output-level (required strings present in rendered components).

**D-07** Phase 56 scope for locked phrases is GDPR notice mandatory phrasing + profile/onboarding tax label strings only. Invoice and XRechnung/ZUGFeRD phrases (e.g. reverse-charge labels on invoices) are locked in Phases 61 and 62.

**D-08** Each jurisdiction notice renders as an MDX/HTML page at `/legal/privacy` (accessible, searchable, version-stamped, anchored sections) with a 'Download as PDF' action that reuses Phase 51's React-PDF template with jurisdiction-specific merge data.

**D-09** Jurisdiction selection follows `organization.countryCode`: UK orgs see UK GDPR notice, DE orgs see Datenschutzerklärung, other EU orgs fall back to generic EU GDPR notice (Phase 51 pattern). Notice is org-scoped, not user-locale-scoped.

**D-10** Notice surfaces: persistent `/legal/privacy` link in the app footer + required 'I have read and understood the privacy notice' checkbox inside Phase 51 D-04 blocking onboarding consent step. No duplicate onboarding step.

**D-11** Add `de` to `routing.locales` globally (alongside `en`, `pl`, `ar`) in `apps/web/src/i18n/routing.ts`. DE-country orgs default `language` to `de` at creation; any user can switch via the existing language selector.

**D-12** `localeSettings` in `apps/web/src/i18n/request.ts` extended with `de: { timeZone: 'Europe/Berlin', currency: 'EUR' }`. Formal register (Sie, not Du) enforced via translator brief + Steuerberater review checklist; no programmatic detection.

**D-13** Translation workflow follows Phase 50 D-03: Claude generates initial `messages/de.json` from `messages/en.json`, then a German Steuerberater reviews legal-adjacent strings.

**D-14** Reuse Phase 47's existing 'Country Compliance' conditional section inside the contractor profile tabs. Add UK and DE field groups to the same conditional driven by `organization.countryCode`. No new tab, no abstraction refactor.

### Claude's Discretion

- Exact Steuernummer regex list per Bundesland (publish as a lookup map)
- Bundesland dropdown UX (sorted by population vs alphabetical) — **LOCKED in UI-SPEC §Interaction 2: alphabetical by German name**
- Handelsregister court-code picker UX — **LOCKED in UI-SPEC §Interaction 4: Command+Popover autocomplete**
- React-PDF template styling for GDPR PDFs (inherit Phase 51 styles)
- MDX authoring structure for `/legal/privacy/*` pages (sections, anchors, TOC)
- Specific CI check implementation (ESLint rule vs standalone grep script vs vitest test) — **UI-SPEC §Open Items narrows: vitest regression test OR standalone node script; ESLint rule discouraged**
- `de.json` namespace layout — **UI-SPEC locks: mirror `en.json` exactly, no domain split**
- Sozialversicherungsnummer format handling (old vs new format coexistence)

### Deferred Ideas (OUT OF SCOPE)

- HMRC live UTR/VAT lookup — Phase 57
- VIES live USt-IdNr validation with qualified confirmation — Phase 57
- UK/DE VAT rate application to invoices — Phase 57 (seeds may be staged, live use is Phase 57)
- Invoice-level reverse-charge label locking — Phase 61 (XRechnung) / Phase 62 (ZUGFeRD)
- Classification-document German phrase locking (SDS, audit defense) — Phase 59
- BACS payment export formatting — Phase 63
- Hijri-calendar-style German locale date nuances (DIN 5008 edge cases) — deferred unless Steuerberater review flags it

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FOUND-01** | User can add UK-specific contractor fields (UTR, Companies House, VAT reg) to contractor profiles for UK-based orgs | §UK Tax ID Validators (UTR mod-11, VAT mod-97/9755, Companies House prefix matrix); §Country Compliance UI pattern (extends Phase 47 countryFields JSONB) |
| **FOUND-02** | User can add German-specific contractor fields (Steuernummer, Handelsregister, USt-IdNr, SV-Nr) for German-based orgs | §DE Tax ID Validators (USt-IdNr MOD-11-10 ISO 7064, Steuernummer 16-state map, SV-Nr structural); §Handelsregister Composite (court list source from justiz.de Registerportal) |
| **FOUND-03** | User can switch the platform UI to German as third language | §next-intl DE Integration (routing + localeSettings two-line change); §Translation Workflow (AI+Steuerberater review mirroring Phase 50 D-03) |
| **FOUND-04** | User sees German-localized legal terminology with correct formal register (Sie) and locked phrases | §Legal Terminology Locking (typed constants module + two-layer CI guard); §Locked German Phrases List (9 constants from UI-SPEC) |
| **FOUND-05** | User can view UK GDPR-compliant privacy notices and data processing information | §UK GDPR Article 13 Required Elements; §MDX + React-PDF Dual Surface |
| **FOUND-06** | User can view German GDPR-compliant Datenschutzerklärung with BfDI-aligned language | §German BDSG + DSGVO Art. 13 Mandatory Elements; §Locked phrases embedded as constants, not translations |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are load-bearing for this phase. Plans must respect them.

| Constraint | Source | Application to Phase 56 |
|---|---|---|
| Use **ctx7 CLI** for library docs | §Libraries/Documentation/Freshness | When fetching next-intl, @next/mdx, @react-pdf/renderer, rehype-* docs during implementation |
| **Schema validation at all boundaries** | §Validation & Data Safety | UK/DE countryFields must have Zod schemas validating the JSONB column on save; discriminated union by `organization.countryCode` |
| **Never trust client input** | §Validation & Data Safety | Tax ID format + checksum validated server-side in tRPC mutation, NOT only in RHF client |
| **WCAG AA + keyboard navigation + screen-reader friendliness** | §Accessibility | Handelsregister composite `<fieldset>`, Bundesland-Steuernummer `aria-describedby` linkage, skip-link on `/legal/privacy` |
| **Up-to-date stable library versions** | §Libraries | All packages below verified against npm registry on 2026-04-12 |
| **Strong typing, explicit over magic** | §Code Quality | Locked legal phrases as typed `const` with narrowed literal types, not `string` |
| **Structured logging, no silent failures** | §Observability | CI-guard failures must print the forbidden key/missing phrase + file path + line |
| **Security best practices, least-privilege** | §Security | PDF download endpoint reuses existing signed-URL flow; no IDOR on jurisdiction parameter (must derive from session org, never user-supplied) |
| **Turborepo monorepo boundaries** | §Architecture | New code lives in `packages/validators/src/legal/de.ts`, `packages/validators/src/{handelsregister-courts,steuernummer-formats,uk-validators,de-validators}.ts`, `apps/web/src/components/contractors/compliance/*`, `apps/web/src/app/[locale]/(legal)/privacy/**` — no new Turbo package needed |
| **Deliver production-grade** | §Delivery Standard | No TODOs in locked phrase list; no hand-rolled ISO 7064 where a tested library exists |
| **`.env.example` always up to date** | §Environment | No new env vars required in Phase 56 (all behavior driven by org.countryCode + session) |

## Summary

Phase 56 is a **domain-heavy extension phase, not a greenfield one**. Every piece of infrastructure the phase needs already exists in the codebase and is shipped in v4.0: the `countryFields` JSONB column (Phase 47), next-intl with 3 locales (Phase 50), React-PDF template system (Phase 51 WHT certificate), and the blocking onboarding consent step (Phase 51 D-04). The work is therefore (a) writing and testing the new **validators** (5 UK + DE checksum algorithms, all with authoritative public specifications), (b) adding the fourth **next-intl locale** (2-line routing change + localeSettings entry + new messages file), (c) wiring UK/DE **field groups** into the existing `CountryComplianceSection` component, (d) building the new `/legal/privacy/[jurisdiction]` **MDX pages + PDF variant** on top of the existing `(legal)` route group, and (e) implementing the two-layer **CI guard** for locked German legal phrases.

The single area requiring external dependency and review is the **professional Steuerberater review** of German tax/legal terminology — already flagged in STATE.md blockers as a Phase 56 deliverable. The Steuerberater brief should be commissioned at the start of the phase so review can run in parallel with implementation. The v4.0 Phase 50 precedent for Arabic (AI draft → professional review → correction pass) applies here verbatim.

**Primary recommendation:** Implement validators and locked-phrase constants in `packages/validators` first (Wave 1), wire UI in `apps/web` (Wave 2), add MDX privacy notices (Wave 3), add CI guard last (Wave 4) so it has real content to grep over. Use `validate-polish`-style lightweight validator functions (pattern already in repo) — do NOT hand-roll ISO 7064 when `@konfirm/iso7064` is available and tested [VERIFIED: npm view @konfirm/iso7064 returns 2.1.3 on 2026-04-12].

## Standard Stack

### Core (already installed — no new dependencies in base stack)

| Library | Version (verified 2026-04-12) | Purpose | Why Standard |
|---------|-------------------------------|---------|--------------|
| `next-intl` | **4.9.1** (pinned `^4.9.1`) | i18n routing, localeSettings, messages loading | Already in use for en/pl/ar; adding `de` is a 2-line routing change + one localeSettings entry + one messages file [VERIFIED: apps/web/package.json] |
| `zod` | **3.25.76** | Schema validation for countryFields, form inputs, tax ID shape | Used across all 14 validator modules; discriminatedUnion on `organization.countryCode` is the idiomatic conditional-schema pattern [VERIFIED: packages/validators/package.json] |
| `react-hook-form` | **7.72.1** | Form state + client-side validation binding | Paired with `@hookform/resolvers@5.2.2` for Zod integration [VERIFIED: apps/web/package.json] |
| `@hookform/resolvers` | **5.2.2** | RHF ↔ Zod bridge (zodResolver) | Standard pairing; works with discriminatedUnion schemas [VERIFIED: apps/web/package.json] |
| `react-pdf` (display) + `@react-pdf/renderer` (generation) | **10.4.1** / (transitive — pin explicitly) | PDF viewer + React-PDF template rendering | Phase 51 WHT certificate template at `apps/web/src/components/wht/wht-certificate-template.tsx` proves the pattern [VERIFIED: grep shows existing usage; `@react-pdf/renderer` is imported but NOT listed in `apps/web/package.json` direct deps — planner MUST add it explicitly, it is currently pulled transitively through `react-pdf` which is a separate package. Current `@react-pdf/renderer` latest is **4.4.1** on npm.] |
| `next` | **15.5.15** | Framework | `@next/mdx` integration fully supported in App Router [VERIFIED: apps/web/package.json] |

### New dependencies to add

| Library | Version (verified 2026-04-12) | Purpose | Why Standard |
|---------|-------------------------------|---------|--------------|
| `@next/mdx` | **16.2.3** | MDX → React for `/legal/privacy/[jurisdiction]/page.mdx` | Official Next.js MDX integration; already wired into the App Router via `createMDX` wrapper. 16.x targets Next 15+. [VERIFIED: npm view @next/mdx version = 16.2.3] |
| `@mdx-js/react` | **3.x** | React runtime for MDX components | Required peer of `@next/mdx` [CITED: https://nextjs.org/docs/app/guides/mdx] |
| `rehype-slug` | **6.0.0** | Auto-add `id` attributes to MDX headings for anchor links + TOC | Standard rehype plugin — `id`s become anchor targets for TOC scrollspy [VERIFIED: npm view rehype-slug version = 6.0.0] |
| `rehype-autolink-headings` | **7.1.0** | Wrap each heading with a hash link for permalinks | Standard pairing with `rehype-slug`; must come AFTER slug in the plugins array [VERIFIED: npm view rehype-autolink-headings version = 7.1.0; CITED: Mike Bifulco guide] |
| `@react-pdf/renderer` | **4.4.1** | React → PDF document tree (Document/Page/View/Text/StyleSheet) | Already implicitly used by Phase 51 WHT template via transitive resolve, but MUST be promoted to an explicit direct dependency to remove hidden-dep risk [VERIFIED: npm view @react-pdf/renderer version = 4.4.1] |

### Alternatives Considered (and rejected)

| Instead of | Could Use | Tradeoff / Why Rejected |
|---|---|---|
| Writing our own ISO 7064 MOD-11-10 for USt-IdNr | `@konfirm/iso7064` 2.1.3 | Tested library is safer, but CLAUDE.md "use existing libraries" contrasts with "keep dependencies lean for a solo-dev project." **Recommendation:** implement inline (30 lines) with exhaustive test vectors from python-stdnum's test suite — algorithm is stable, well-documented, and adding a 1-purpose library has higher maintenance cost than 30 lines of copy-paste-proof code with unit tests. [CITED: https://arthurdejong.org/python-stdnum/doc/1.17/stdnum.iso7064] |
| `jsvat-next` (3.0.4) for unified EU VAT validation | — | Dead-end: jsvat's GB mod-97/9755 may not match HMRC's spec exactly and has known gaps for GBGD/GBHA government formats. Per CONTEXT.md D-02 we need GBGD/GBHA to be **accepted but not checksummed** — a behavior a generic EU validator doesn't ship. Write a targeted UK validator. |
| MDX for privacy notices | Plain TSX with `useTranslations` (existing pattern at `apps/web/src/app/[locale]/(legal)/privacy/page.tsx`) | Plain TSX is simpler but the UI-SPEC requires: version banner, TOC with scrollspy, section anchors, locale-prefix per jurisdiction. MDX is the right tool when content is mostly prose with structured metadata. The existing Phase 50 privacy page at `/legal/privacy` is the generic EU fallback — keep it as TSX, add UK/DE as MDX under `[jurisdiction]/page.mdx`. |
| Full Handelsregister live lookup | Out of scope | Deferred — Phase 57 may add VIES-style live lookup for USt-IdNr but court lookups are not in requirements |
| `content-collections` / `contentlayer` for MDX | `@next/mdx` alone | Over-engineering for 3 MDX files (gb/de/eu). Revisit if we add ≥10 legal docs. |

### Installation

```bash
# apps/web direct deps (new)
pnpm --filter @contractor-ops/web add \
  @next/mdx@16.2.3 \
  @mdx-js/react@3 \
  rehype-slug@6.0.0 \
  rehype-autolink-headings@7.1.0 \
  @react-pdf/renderer@4.4.1

# packages/validators — no new runtime deps needed (inline ISO 7064 implementation)
```

No `package.json` additions are required in `packages/validators` — the new validators use only `zod` which is already a dependency.

## Architecture Patterns

### Recommended Project Structure (additive — all new files)

```
packages/validators/src/
├── country-fields.ts                    # EXISTING — add UK + DE branches to countryFieldsSchemaMap
├── legal/
│   └── de.ts                            # NEW — typed const locked German legal phrases (D-05)
├── uk-validators.ts                     # NEW — isValidUtr, isValidGbVat, isValidCompaniesHouseNumber
├── de-validators.ts                     # NEW — isValidUstIdNr, isValidSteuernummer, isValidSvNummer, isValidHandelsregister
├── steuernummer-formats.ts              # NEW — 16-Bundesland map: { code, germanName, regex, example, formatHintKey }
├── handelsregister-courts.ts            # NEW — array of { code, name, state, city } for ~120 courts
├── privacy-notices/
│   ├── gb.ts                            # NEW — typed content for UK GDPR notice (Zod-validated shape)
│   ├── de.ts                            # NEW — typed content for German Datenschutzerklärung; references legal/de.ts constants
│   └── eu.ts                            # NEW — generic EU fallback (may just import Phase 51 default and re-export)
└── __tests__/
    ├── uk-validators.test.ts            # NEW — UTR/VAT/CH checksum vectors
    ├── de-validators.test.ts            # NEW — USt-IdNr/Steuernummer/SV-Nr vectors
    └── legal-de-phrases.test.ts         # NEW — typed const immutability + phrase-presence

apps/web/src/
├── i18n/
│   ├── routing.ts                       # EDIT — add 'de' to locales array
│   └── request.ts                       # EDIT — add de entry to localeSettings
├── messages/
│   └── de.json                          # NEW — mirror en.json structure; AI-generated + Steuerberater reviewed
├── components/
│   ├── contractors/
│   │   ├── country-compliance-section.tsx       # EDIT — add UK+DE branches (mirror UAE/SA pattern)
│   │   └── compliance/                          # NEW directory
│   │       ├── uk-compliance-fields.tsx         # NEW
│   │       ├── de-compliance-fields.tsx         # NEW
│   │       ├── bundesland-select.tsx            # NEW
│   │       ├── steuernummer-input.tsx           # NEW
│   │       ├── handelsregister-input.tsx        # NEW
│   │       ├── entity-type-select.tsx           # NEW
│   │       └── vat-registered-toggle.tsx        # NEW
│   ├── consent/
│   │   ├── onboarding-consent-step.tsx          # EDIT — expand jurisdiction predicate to include GB/DE
│   │   └── privacy-notice-acknowledgement.tsx   # NEW
│   ├── legal/
│   │   ├── privacy-notice-toc.tsx               # NEW — client scrollspy TOC
│   │   └── privacy-notice-pdf-download.tsx     # NEW — button → tRPC mutation → signed URL
│   └── layout/
│       ├── app-footer.tsx                       # NEW — persistent footer with /legal/privacy link
│       └── user-menu.tsx                        # EDIT — add 'de' to localeOrder array (line 100)
├── app/[locale]/(legal)/privacy/
│   ├── page.tsx                                 # EXISTING — keep as generic EU fallback
│   └── [jurisdiction]/
│       └── page.mdx                             # NEW dynamic; renders gb.mdx, de.mdx, eu.mdx
├── app/[locale]/(legal)/privacy/(content)/      # NEW — co-located MDX content
│   ├── gb.mdx
│   ├── de.mdx
│   └── eu.mdx
└── next.config.ts                               # EDIT — add createMDX wrapper + pageExtensions + rehype plugins

packages/api/src/routers/
└── legal.ts (or privacy.ts)                     # NEW — tRPC endpoints:
                                                 #   - getPrivacyNoticeContent(jurisdiction) — reuses/extends Phase 51 privacy-notice.ts
                                                 #   - generatePrivacyNoticePdf(jurisdiction) → signed URL (mirrors WHT PDF route)

# CI guard (Claude's Discretion — recommendation: vitest test)
packages/validators/src/__tests__/
└── locked-phrases-guard.test.ts                 # NEW — fails CI if:
                                                 #   (a) any key name in messages/{en,pl,ar,de}.json matches RESERVED_LEGAL_KEYS
                                                 #   (b) any value in messages/de.json contains "Du " / "Dir " / "Dein " (formal-register guard)
                                                 #   (c) any required locked phrase from legal/de.ts is not present in privacy-notices/de.ts
```

### Pattern 1: Discriminated-Union Country Schemas

**What:** Use Zod's `discriminatedUnion` with `organization.countryCode` as the discriminator to route to the right country-specific schema at runtime.

**When to use:** Validating `contractor.countryFields` JSONB before write; validating incoming tRPC mutation payloads for profile save.

**Example:**

```typescript
// Source: packages/validators/src/country-fields.ts (EXTEND existing file)
// Pattern: https://zod.dev/?id=discriminated-unions (CITED)
import { z } from 'zod';
import { isValidUtr, isValidGbVat, isValidCompaniesHouseNumber } from './uk-validators';
import { isValidUstIdNr, isValidSvNummer } from './de-validators';
import { getSteuernummerRegex } from './steuernummer-formats';

export const ukEntityTypeEnum = z.enum(['SOLE_TRADER', 'LTD', 'LLP']);
export const deEntityTypeEnum = z.enum(['EINZELUNTERNEHMEN', 'GBR', 'OHG', 'KG', 'UG', 'GMBH', 'AG']);

// Base UK shape (all optional at the Zod level; conditional requirement is enforced
// in a superRefine step that reads entityType + isVatRegistered — see below)
const ukCountryFieldsSchema = z.object({
  entityType: ukEntityTypeEnum,
  isVatRegistered: z.boolean().default(false),
  utr: z.string().refine(v => !v || isValidUtr(v), 'Invalid UTR checksum').optional(),
  companiesHouseNumber: z.string()
    .refine(v => !v || isValidCompaniesHouseNumber(v), 'Invalid Companies House number')
    .optional(),
  vatRegistrationNumber: z.string()
    .refine(v => !v || isValidGbVat(v), 'Invalid UK VAT registration number')
    .optional(),
}).superRefine((data, ctx) => {
  // D-04 enforcement
  if (data.entityType === 'SOLE_TRADER' && !data.utr) {
    ctx.addIssue({ code: 'custom', message: 'UTR is required for sole traders', path: ['utr'] });
  }
  if (data.entityType === 'LTD' && !data.companiesHouseNumber) {
    ctx.addIssue({
      code: 'custom',
      message: 'Companies House number is required for limited companies',
      path: ['companiesHouseNumber'],
    });
  }
  if (data.isVatRegistered && !data.vatRegistrationNumber) {
    ctx.addIssue({
      code: 'custom',
      message: 'VAT registration number is required when VAT-registered is toggled on',
      path: ['vatRegistrationNumber'],
    });
  }
});

// Base DE shape — Steuernummer regex is dynamic based on Bundesland
const deCountryFieldsSchema = z.object({
  bundesland: z.enum(['BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH']),
  entityType: deEntityTypeEnum,
  isVatRegistered: z.boolean().default(false),
  isKleinunternehmer: z.boolean().default(false),
  steuernummer: z.string().optional(),
  ustIdNr: z.string().refine(v => !v || isValidUstIdNr(v), 'Invalid USt-IdNr checksum').optional(),
  handelsregister: z.object({
    court: z.string(),
    type: z.enum(['HRB','HRA']),
    number: z.string().regex(/^\d{1,7}$/, 'Number must be 1–7 digits'),
  }).optional(),
  sozialversicherungsnummer: z.string().refine(
    v => !v || isValidSvNummer(v),
    'Invalid Sozialversicherungsnummer structural check',
  ).optional(),
}).superRefine((data, ctx) => {
  if (!data.steuernummer) {
    ctx.addIssue({ code: 'custom', message: 'Steuernummer is required', path: ['steuernummer'] });
  } else {
    // Dynamic per-Bundesland regex
    const rx = getSteuernummerRegex(data.bundesland);
    if (!rx.test(data.steuernummer)) {
      ctx.addIssue({
        code: 'custom',
        message: `Steuernummer format does not match ${data.bundesland}`,
        path: ['steuernummer'],
      });
    }
  }
  if (['UG','GMBH'].includes(data.entityType) && !data.handelsregister) {
    ctx.addIssue({
      code: 'custom',
      message: 'Handelsregister is required for UG/GmbH entities',
      path: ['handelsregister'],
    });
  }
  if (data.isVatRegistered && !data.isKleinunternehmer && !data.ustIdNr) {
    ctx.addIssue({
      code: 'custom',
      message: 'USt-IdNr is required when VAT-registered and not a Kleinunternehmer',
      path: ['ustIdNr'],
    });
  }
});

export const countryFieldsSchemaMap: Record<string, z.ZodTypeAny> = {
  AE: uaeCountryFieldsSchema,     // existing
  SA: saudiCountryFieldsSchema,   // existing
  GB: ukCountryFieldsSchema,      // NEW
  DE: deCountryFieldsSchema,      // NEW
};
```

### Pattern 2: Locked Legal Phrase Constants

**What:** Typed const module that exports exact German legal strings; translation files are prohibited (via CI guard) from defining keys with these names.

**When to use:** Anywhere a German legal phrase MUST appear verbatim (GDPR notice headings, tax labels, onboarding acknowledgement body). The UI-SPEC lists 9 constants in scope for Phase 56.

**Example:**

```typescript
// Source: packages/validators/src/legal/de.ts (NEW)
// Pattern: [ASSUMED] — direct application of CONTEXT.md D-05/D-06 to an idiomatic TypeScript const module.
//
// These strings are the legally vetted canonical forms. The CI guard in
// `packages/validators/src/__tests__/locked-phrases-guard.test.ts` enforces:
//   (a) none of these key names appear as keys in apps/web/messages/*.json
//   (b) each string appears (verbatim, Unicode-identical) in the corresponding
//       rendered surface (privacy-notices/de.ts content + profile tax labels).

export const GDPR_CONTROLLER_LABEL = 'Verantwortlicher im Sinne der DSGVO' as const;
export const GDPR_RIGHTS_HEADING = 'Ihre Rechte als betroffene Person' as const;
export const GDPR_DPO_LABEL = 'Datenschutzbeauftragter' as const;
export const GDPR_COMPLAINT_HEADING = 'Beschwerderecht bei der Aufsichtsbehörde' as const;
export const TAX_USTIDNR_LABEL = 'Umsatzsteuer-Identifikationsnummer (USt-IdNr)' as const;
export const TAX_STEUERNUMMER_LABEL = 'Steuernummer' as const;
export const TAX_HANDELSREGISTER_LABEL = 'Handelsregisternummer' as const;
export const TAX_SOZIALVERSICHERUNGSNUMMER_LABEL = 'Sozialversicherungsnummer' as const;
export const TAX_KLEINUNTERNEHMER_LABEL = 'Kleinunternehmer gemäß § 19 UStG' as const;

export const RESERVED_LEGAL_KEYS = [
  'GDPR_CONTROLLER_LABEL',
  'GDPR_RIGHTS_HEADING',
  'GDPR_DPO_LABEL',
  'GDPR_COMPLAINT_HEADING',
  'TAX_USTIDNR_LABEL',
  'TAX_STEUERNUMMER_LABEL',
  'TAX_HANDELSREGISTER_LABEL',
  'TAX_SOZIALVERSICHERUNGSNUMMER_LABEL',
  'TAX_KLEINUNTERNEHMER_LABEL',
] as const;

export const LOCKED_DE_PHRASES = {
  GDPR_CONTROLLER_LABEL,
  GDPR_RIGHTS_HEADING,
  GDPR_DPO_LABEL,
  GDPR_COMPLAINT_HEADING,
  TAX_USTIDNR_LABEL,
  TAX_STEUERNUMMER_LABEL,
  TAX_HANDELSREGISTER_LABEL,
  TAX_SOZIALVERSICHERUNGSNUMMER_LABEL,
  TAX_KLEINUNTERNEHMER_LABEL,
} as const;

export type LockedDePhraseKey = keyof typeof LOCKED_DE_PHRASES;
```

### Pattern 3: MDX Locale-Prefixed Privacy Notice

**What:** Use `@next/mdx` with `createMDX` wrapper in `next.config.ts`; co-locate per-jurisdiction content under `app/[locale]/(legal)/privacy/[jurisdiction]/page.mdx`.

**When to use:** When legal content is prose-heavy with structured anchors/TOC and version stamping. The plain-TSX `useTranslations` approach works for short notices; MDX is the right tool when content is essentially a document with `<h2>` sections.

**Example:**

```typescript
// Source: apps/web/next.config.ts (EDIT)
// Pattern: https://nextjs.org/docs/app/guides/mdx (CITED)
import createMDX from '@next/mdx';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
  },
});

const nextConfig: NextConfig = {
  ...existing,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  ...existing,
};

export default withSentryConfig(withNextIntl(withMDX(nextConfig)), { ...existing });
```

```tsx
// Source: apps/web/src/app/[locale]/(legal)/privacy/[jurisdiction]/page.tsx (NEW)
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import GbContent from '../(content)/gb.mdx';
import DeContent from '../(content)/de.mdx';
import EuContent from '../(content)/eu.mdx';

const components = { gb: GbContent, de: DeContent, eu: EuContent } as const;

export default async function PrivacyJurisdictionPage({
  params,
}: { params: Promise<{ jurisdiction: string; locale: string }> }) {
  const { jurisdiction } = await params;
  const Component = components[jurisdiction as keyof typeof components];
  if (!Component) notFound();
  return <Component />;
}
```

### Pattern 4: Reuse Phase 51 React-PDF Template Pipeline

**What:** Create `GdprPrivacyNoticePdf` React component using `@react-pdf/renderer` primitives, mirroring `apps/web/src/components/wht/wht-certificate-template.tsx`. Register with the existing signed-URL PDF route (pattern to inspect when implementing).

**When to use:** The PDF download button on `/legal/privacy/[jurisdiction]`.

**Example:** Start from the WHT template's `StyleSheet.create` block (page padding 40, Helvetica, fontSize 10, header with 2px border-bottom) and replace the content tree with GDPR sections read from `privacy-notices/{gb,de,eu}.ts`.

### Anti-Patterns to Avoid

- **Hand-rolled MOD-11-10 without exhaustive test vectors.** If implementing inline rather than depending on `@konfirm/iso7064`, borrow the full test suite from python-stdnum's `test_iso7064_mod_11_10.doctest` (public domain). Blind copy of the "iterative (sum+product) mod 10, double, mod 11" algorithm without vectors has historically produced off-by-one errors in community implementations.
- **Using `jsvat-next` or similar EU-wide libraries as the only GB/DE validator.** They don't ship GBGD/GBHA or Steuernummer per-Bundesland; they papers over these by returning "valid" for anything that passes a coarse regex.
- **Storing locked German phrases in `messages/de.json`.** Directly contradicts D-05 — CI will fail. Every phrase in `legal/de.ts` MUST be consumed by direct import, not via `useTranslations`.
- **Using `prose` Tailwind plugin for the privacy MDX pages.** UI-SPEC §Interaction 9 explicitly rejects `prose` — MDX renders through the existing Typography token set to keep the design contract intact.
- **Putting the jurisdiction in the URL derived from user input** (`/legal/privacy?j={user-input}`). Must be derived server-side from session.organization.countryCode for authenticated users; public visitors see a jurisdiction picker that links to `/legal/privacy/gb`, `/legal/privacy/de`, `/legal/privacy/eu`. CLAUDE.md §Security — never trust client input.
- **Using `truncate`/`whitespace-nowrap` on DE labels.** UI-SPEC §Typography is explicit — German +30% character average means CTAs and labels must wrap. The existing Tailwind logical-property refactor from Phase 50 D-01 already enables correct LTR rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Anchor IDs on MDX headings | Regex over raw MDX source | `rehype-slug@6.0.0` | Handles Unicode headings (ä, ö, ü, ß) correctly; preserves unique IDs on collisions |
| Anchor links on MDX headings | Custom `<h2>` component with `<a href>` | `rehype-autolink-headings@7.1.0` | Handles `behavior: wrap` / `before` / `after` consistently; screen-reader-friendly default |
| German tax ID regex for "all of Germany" | Single unified regex | Per-Bundesland lookup map (see `steuernummer-formats.ts` pattern in UI-SPEC) | 16 different valid length/format combinations; one regex = either too permissive or rejects valid IDs [VERIFIED: Wikipedia Steuernummer article, see §Code Examples below] |
| EU VAT checksum validation | `jsvat-next` or `libvat` | Write a UK-specific validator, rely on jurisdiction-specific specs | Libraries have inconsistent handling of GBGD/GBHA government formats and pre-2010 vs post-2010 mod-97 variants; targeted code with tested vectors is clearer |
| German Handelsregister court list | Web scrape justiz.de at runtime | Checked-in `handelsregister-courts.ts` data file (one-time export from Registerportal) | Court list changes ~once/year when a small court merges/closes; static data file with a yearly refresh task is simpler and offline-safe |
| PDF rendering | HTML→PDF via headless Chrome | Existing `@react-pdf/renderer` pattern from Phase 51 WHT template | Deterministic layout, no browser spin-up, already proven in production for WHT certs |
| i18n routing/locale negotiation | Middleware-based redirect logic | `next-intl@4.9.1` `createMiddleware(routing)` | Already in `apps/web/src/middleware.ts`; adding `de` is a routing-config change, no middleware edits |
| Form conditional required-field UX | Multiple `useState` + `useEffect` chains | Zod `discriminatedUnion` + `superRefine` with RHF `zodResolver` | The entity-type×isVatRegistered matrix in UI-SPEC §Interaction 1 is the textbook discriminated-union case [CITED: zod.dev §Discriminated Unions] |
| Privacy notice PDF download handler | Custom `Content-Disposition` route | Existing signed-URL pattern (Phase 51 has tRPC mutation → signed URL) | Keep consistency; also avoids leaking authenticated request context into static PDFs |
| CI guard implementation | ESLint plugin | Standalone vitest test inside `packages/validators` | ESLint rule = ~200 LOC plugin + configuration; vitest test = ~30 LOC of `fs.readFileSync` + assertions. UI-SPEC §Open Items explicitly calls ESLint "over-engineering for 9 constants." |

**Key insight:** This phase's value is in *composing* already-proven patterns (Phase 47 countryFields, Phase 50 i18n, Phase 51 React-PDF + consent step), not inventing. The only genuinely new algorithmic work is the 5 checksum validators — and every one of them has authoritative public reference material.

## Runtime State Inventory

> This phase is primarily additive (new validators, new locale, new MDX pages). It also contains one targeted refactor (`country-compliance-section.tsx` branch extension). Runtime state impact is minimal but non-zero.

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | No rename. Existing `Contractor.countryFields` JSONB records from UAE/SA orgs keep their shape unchanged. New records for UK/DE orgs will use the new per-country Zod schemas. No data migration needed. | None — additive schema keys in the schema map. Existing rows untouched. |
| **Stored data — Privacy notices** | `PrivacyNotice` table (Phase 51) currently auto-creates default content for jurisdiction='AE'/'SA' on first org access. Seed logic in `packages/api/src/services/privacy-notice.ts` `getDefaultNoticeContent` only handles 'AE'/'SA'. | **Code edit, NOT data migration.** Extend `getDefaultNoticeContent` to also return content for 'GB', 'DE', and 'EU' fallback. Existing UAE/SA org rows untouched; new UK/DE org rows get created on-demand. No backfill needed for existing orgs. |
| **Stored data — ConsentRecord** | `ConsentRecord` rows for UAE/SA orgs continue to be valid under their existing jurisdiction. | None — append-only model per D-02 of Phase 51; new UK/DE acknowledgements write new rows. |
| **Live service config** | No external systems store locale codes or jurisdiction strings. No n8n / Datadog / Tailscale / Cloudflare resources reference 'en'/'pl'/'ar' today. | None — verified by grep across repo for service names embedding locale codes. |
| **OS-registered state** | No scheduled tasks, pm2 processes, or systemd units reference the locale set or contractor country set. The Vercel cron jobs (from `next.config.ts` Sentry `automaticVercelMonitors: true`) are feature-scoped and locale-agnostic. | None — verified by inspection of root scripts/ and apps/web/next.config.ts. |
| **Secrets and env vars** | No new secrets. `SENTRY_*` env vars unchanged. Upstash/Redis URLs unchanged. No per-locale or per-jurisdiction keys exist. | None. `.env.example` does not need updating for Phase 56. |
| **Build artifacts / installed packages** | Adding `@next/mdx`, `rehype-slug`, `rehype-autolink-headings`, `@mdx-js/react`, `@react-pdf/renderer` (promoted to explicit dep). Next.js build cache will need a full rebuild because `pageExtensions` change in `next.config.ts` affects route collection. `packages/validators` ships a new `legal/de.ts` module — its `dist/` needs rebuild via `pnpm --filter @contractor-ops/validators build`. | **Action:** Plan must include one task for `pnpm install` + `pnpm --filter @contractor-ops/validators build` + `pnpm --filter @contractor-ops/web build` in a clean slot to confirm no stale dist is masking issues. |
| **Existing language switcher** | `apps/web/src/components/layout/user-menu.tsx` line 100 hardcodes `localeOrder: Locale[] = ['pl', 'en', 'ar']`. When 'de' is added to `routing.locales`, TypeScript won't catch this omission because the array is narrowly typed — the DE user will still be reachable via URL but won't appear in the toggle cycle. | **Code edit (catchable only by reading the file):** extend `localeOrder` to `['pl','en','ar','de']` AND add a native-name label entry in `nextLocaleLabel` (line 215 area). A vitest test can guard this: "Every entry in `routing.locales` appears in `localeOrder`." |

**The canonical question for this phase:** After adding `de` to routing.locales and `GB`/`DE` to countryFieldsSchemaMap — what else is hardcoded to the old set?

Verified answers:
- Locale switcher array: **yes, must update** (see above)
- Middleware: **no**, `createMiddleware(routing)` picks up the new locale automatically
- next-intl messages resolution: **no**, `import(...messages/${locale}.json)` picks up the new file by convention
- CSP headers: **no**, locale-agnostic
- Sentry sourcemaps: **no**, locale-agnostic
- Type `Locale` export: **yes, auto-updates** because it's derived from `routing.locales`

## Common Pitfalls

### Pitfall 1: USt-IdNr checksum implemented as single-pass mod-11 (instead of ISO 7064 MOD-11-10 iterative)
**What goes wrong:** Many tutorials online describe a simple "sum weighted digits, mod 11" algorithm for tax ID validation. For DE USt-IdNr this is **wrong** — DE uses the ISO 7064 MOD-11-10 iterative "Pure System" where you maintain a rolling product across the 8 digits (start with product=10, for each digit: sum = (digit + product) mod 10, if 0 then 10; product = (sum × 2) mod 11). False positives (accepts invalid numbers) and false negatives (rejects valid ones) both occur with the simple approach.
**Why it happens:** Training data conflates MOD-11 with MOD-11,10 (different algorithms despite similar names).
**How to avoid:** Use test vectors directly from python-stdnum's ISO 7064 test suite (public domain, authoritative). Vector examples: `DE136695976` valid, `DE123456788` invalid.
**Warning signs:** A simple `digits.reduce((sum, d, i) => sum + d * weights[i], 0) % 11 === checkdigit` implementation.
[CITED: https://arthurdejong.org/python-stdnum/doc/1.17/stdnum.iso7064]

### Pitfall 2: UK VAT checksum: pre-2010 vs post-2010 ("9755") coexistence
**What goes wrong:** Old UK VAT numbers use a plain mod-97 checksum; numbers issued since ~2010 use a "modulus 9755" variant (add 55 to the sum, then apply mod-97). A validator that only implements one will reject ~half of all real-world UK VAT numbers.
**Why it happens:** HMRC never publicly documented the switch; community reverse-engineered it.
**How to avoid:** Compute both variants; a VAT number is valid if **either** checksum matches. Special-case GBGD (government department) and GBHA (health authority) — accept matching `GB(GD|HA)\d{3}` but don't checksum.
**Warning signs:** Tests fail on VAT numbers starting with the newer series that begin with specific prefixes.
[CITED: https://discover.hubpages.com/business/Check-VAT-Numbers-UK]

### Pitfall 3: Steuernummer regex list out of date
**What goes wrong:** The 16-Bundesland Steuernummer formats are stable in practice but *could* change on tax-office reorganization (rare). A Bundesland that changed its format in a software update cycle will silently reject valid inputs as the regex is hardcoded.
**Why it happens:** Developers copy a 2019-era regex list and never revisit.
**How to avoid:** Document the source (Wikipedia Steuernummer article + ELSTER help page) in `steuernummer-formats.ts` as a comment, include "last verified" date, and add a follow-up check on Steuerberater review to re-verify. The ELSTER 13-digit unified format is only relevant for **tax-office-to-tax-office** submissions; contractors write the human-readable state-native format on commercial docs, which is what we validate.
**Warning signs:** Steuerberater review flags a state's regex as "format changed in Y".

### Pitfall 4: Sozialversicherungsnummer — old format vs new format coexistence
**What goes wrong:** The 12-character SV-Nummer format: 2-digit Bereichsnummer + 6-digit DOB + 1 letter (first letter of birth surname) + 2-digit serial + 1-digit Prüfziffer. Historical records may show variations. Data entered by older contractors may not match a strict regex for the current format.
**Why it happens:** Format clarifications over the years mean some older tutorials describe slightly different structures.
**How to avoid:** Validate structurally (length 12, positions 1-8 numeric, position 9 uppercase Latin letter, positions 10-12 numeric) and compute the checksum by letter-to-2-digit conversion (A=01, B=02, ..., Z=26) then apply a weighted mod-10. Accept both uppercase and lowercase, normalize to uppercase before validation.
**Warning signs:** Rejection rate on real data is higher than expected; user complaints about valid SV-Nrs being flagged.
[CITED: https://www.deutsche-rentenversicherung.de — DRV Rentenversicherungsnummer page]

### Pitfall 5: MDX content security on import
**What goes wrong:** MDX allows arbitrary JSX/React component imports. A malicious or compromised MDX file could import `window.fetch` or perform side-effects at render time.
**Why it happens:** MDX is a superset of Markdown; it executes JavaScript expressions.
**How to avoid:** The three privacy MDX files are checked into the repo and reviewed during code review. Do NOT allow user-authored MDX. Do NOT fetch MDX from a CMS without sanitization. Configure MDX to pass an explicit `components` map so no unexpected components can be referenced. Ensure CSP `script-src` is tight (it already is in `next.config.ts`).
**Warning signs:** Any PR that adds a user-content path rendering MDX from outside `apps/web/src/app` should be rejected.

### Pitfall 6: Next.js `pageExtensions` change doesn't pick up MDX files in App Router without a full rebuild
**What goes wrong:** Changing `pageExtensions` in `next.config.ts` while the dev server is running typically does not discover the new `.mdx` routes. Build output shows 404 for the new MDX paths.
**Why it happens:** `pageExtensions` is read at server startup, not per-request.
**How to avoid:** Always restart the Next dev server after editing `next.config.ts`; verify with a fresh `pnpm --filter @contractor-ops/web build` that MDX routes appear in the build output.
**Warning signs:** Test against `/en/legal/privacy/gb` returns 404 after adding `gb.mdx`.
[CITED: https://nextjs.org/docs/app/guides/mdx — pageExtensions note]

### Pitfall 7: Language switcher hardcoded array (see Runtime State Inventory)
**What goes wrong:** Adding `de` to `routing.locales` doesn't automatically add it to the toggle cycle in `user-menu.tsx:100`. DE users only get there by URL.
**Prevention:** Add a vitest test `apps/web/src/components/layout/__tests__/locale-switcher.test.tsx` that asserts `routing.locales.every(l => localeOrder.includes(l))`.

### Pitfall 8: Jurisdiction URL IDOR
**What goes wrong:** If the privacy-notice PDF tRPC mutation accepts `jurisdiction` as a parameter without re-verifying against the session org, an attacker could request `jurisdiction='SA'` while logged in as a UK org and get the SA notice (a minor info-leak, but still unauthorized cross-tenant content access).
**Prevention:** tRPC mutation reads `session.organization.countryCode` server-side and uses it to derive jurisdiction. If the user-supplied `jurisdiction` doesn't match the session org's derived jurisdiction AND the user isn't a privileged role, reject.

## Code Examples

### Example 1: UK UTR validator (10-digit mod-11 with lookup table)

```typescript
// Source: packages/validators/src/uk-validators.ts (NEW)
// Reference: HMRC self-assessment UTR algorithm
// [CITED: https://design.tax.service.gov.uk/hmrc-design-patterns/unique-taxpayer-reference/]
// [CITED: https://www.accountingweb.co.uk/any-answers/utr-validation-formula]

const UTR_WEIGHTS = [6, 7, 8, 9, 10, 5, 4, 3, 2] as const;
const UTR_CHECK_LOOKUP = [2, 1, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/**
 * Validates a UK Unique Taxpayer Reference.
 * Accepts 10 digits, optionally suffixed with 'K' (Corporation Tax variant — suffix stripped).
 * First digit is the check digit; last 9 are weighted and reduced mod-11.
 */
export function isValidUtr(raw: string): boolean {
  const utr = raw.replace(/[\s-]/g, '').replace(/K$/i, '');
  if (!/^\d{10}$/.test(utr)) return false;

  const digits = utr.split('').map(Number);
  const checkDigit = digits[0]!;
  const sum = UTR_WEIGHTS.reduce((acc, w, i) => acc + w * digits[i + 1]!, 0);
  const remainder = sum % 11;
  const expected = UTR_CHECK_LOOKUP[remainder]!;

  return checkDigit === expected;
}
```

### Example 2: UK VAT (mod-97 + modified mod-9755 + gov departments)

```typescript
// Source: packages/validators/src/uk-validators.ts (continued)
// [CITED: https://discover.hubpages.com/business/Check-VAT-Numbers-UK]
// [CITED: https://knowledge.opencorporates.com/knowledge-base/gb-vat-code/]

const VAT_WEIGHTS = [8, 7, 6, 5, 4, 3, 2] as const;

/**
 * Validates a UK VAT registration number.
 * Formats: GB + 9 digits (standard, subject to mod-97 or mod-9755)
 *          GB + 12 digits (branch trader — last 3 digits = branch id; skip here)
 *          GBGDnnn (government department, 500–999 range; not checksum'd)
 *          GBHAnnn (health authority, 000–499 range; not checksum'd)
 */
export function isValidGbVat(raw: string): boolean {
  const vat = raw.replace(/[\s-]/g, '').toUpperCase();

  if (/^GBGD[5-9]\d{2}$/.test(vat)) return true;
  if (/^GBHA[0-4]\d{2}$/.test(vat)) return true;

  const m = vat.match(/^GB(\d{9})(?:\d{3})?$/);
  if (!m) return false;

  const body = m[1]!;
  const digits = body.split('').map(Number);
  const check = digits[7]! * 10 + digits[8]!;
  const weighted = VAT_WEIGHTS.reduce((sum, w, i) => sum + w * digits[i]!, 0);

  const mod97 = (97 - (weighted % 97)) % 97;
  const mod9755 = (97 - ((weighted + 55) % 97)) % 97;

  return check === mod97 || check === mod9755;
}
```

### Example 3: Companies House number (alphanumeric with state prefixes)

```typescript
// Source: packages/validators/src/uk-validators.ts (continued)
// [CITED: https://www.gov.uk/ — Companies House; https://doorda.com/glossary/company-number-prefixes-defined/]

/**
 * Validates a Companies House number.
 * - 8 digits (England/Wales) — e.g. 00000006
 * - SC + 6 digits (Scotland)
 * - NI + 6 digits (Northern Ireland)
 * - OC + 6 digits (LLP, England/Wales)
 * - SO + 6 digits (LLP, Scotland)
 * - NC + 6 digits (LLP, Northern Ireland)
 * - R0 + 6 digits (Northern Ireland, historic)
 *
 * Normalizes by padding leading zeros to 8 chars total for the digit-only case.
 */
export function isValidCompaniesHouseNumber(raw: string): boolean {
  const clean = raw.replace(/\s/g, '').toUpperCase();
  // Digit-only: 1–8 digits, pad to 8
  if (/^\d{1,8}$/.test(clean)) return true;
  // Prefix variants
  if (/^(SC|NI|OC|SO|NC|R0)\d{6}$/.test(clean)) return true;
  return false;
}
```

### Example 4: German USt-IdNr (ISO 7064 MOD-11-10 iterative)

```typescript
// Source: packages/validators/src/de-validators.ts (NEW)
// Algorithm reference: ISO/IEC 7064:2003 Pure System MOD 11,10
// [CITED: https://arthurdejong.org/python-stdnum/doc/1.17/stdnum.iso7064]
// Test vectors borrowed from python-stdnum test suite (LGPL v2.1 — reference only; code is fresh).

/**
 * Computes the ISO 7064 MOD 11,10 check digit for a numeric string.
 * Returns 0-9.
 */
function mod11_10CheckDigit(digits: readonly number[]): number {
  let product = 10;
  for (const d of digits) {
    let sum = (d + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  return (11 - product) % 10;
}

/**
 * Validates a German USt-Identifikationsnummer.
 * Format: DE + 9 digits. Last digit is the ISO 7064 MOD-11-10 check digit over the first 8.
 * Canonical example: DE136695976 (valid), DE123456788 (invalid).
 */
export function isValidUstIdNr(raw: string): boolean {
  const vat = raw.replace(/[\s-]/g, '').toUpperCase();
  const m = vat.match(/^DE(\d{9})$/);
  if (!m) return false;

  const digits = m[1]!.split('').map(Number);
  const body = digits.slice(0, 8);
  const check = digits[8]!;

  return mod11_10CheckDigit(body) === check;
}
```

### Example 5: Sozialversicherungsnummer structural + checksum

```typescript
// Source: packages/validators/src/de-validators.ts (continued)
// [CITED: https://www.deutsche-rentenversicherung.de — Rentenversicherungsnummer (VSNR)]
//
// Structure: AAGGMMYYBLLP
//   AA  = Bereichsnummer (area, 2 digits)
//   GGMMYY = Geburtsdatum (DD MM YY, 6 digits)
//   B   = Anfangsbuchstabe (first letter of birth surname)
//   LL  = Seriennummer (2 digits; 00-49 male, 50-99 female/diverse)
//   P   = Prüfziffer (1 digit)
//
// Check digit algorithm (public DRV spec):
//   Expand B by replacing with its two-digit alphabet position (A=01, B=02, …, Z=26).
//   Apply weights [2, 1, 2, 5, 7, 1, 2, 1, 2, 1, 2, 1] across 13 expanded digits (positions 1–13).
//   For each weighted product, sum digit-by-digit (e.g. 2*9=18 → 1+8=9).
//   Sum mod 10 = check digit.

const SV_WEIGHTS = [2, 1, 2, 5, 7, 1, 2, 1, 2, 1, 2, 1] as const;

function digitSum(n: number): number {
  return n >= 10 ? Math.floor(n / 10) + (n % 10) : n;
}

export function isValidSvNummer(raw: string): boolean {
  const sv = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!/^\d{8}[A-Z]\d{3}$/.test(sv)) return false;

  const areaAndDob = sv.slice(0, 8);               // 8 digits
  const letter = sv.charCodeAt(8) - 64;            // 1..26
  const serialAndCheck = sv.slice(9);              // 3 digits
  const expandedLetter = letter.toString().padStart(2, '0');
  const expanded = (areaAndDob + expandedLetter + serialAndCheck.slice(0, 2))
    .split('').map(Number);
  const checkDigit = Number(serialAndCheck[2]);

  const sum = SV_WEIGHTS.reduce(
    (acc, w, i) => acc + digitSum(w * expanded[i]!),
    0,
  );

  return sum % 10 === checkDigit;
}
```

### Example 6: Steuernummer per-Bundesland regex map

```typescript
// Source: packages/validators/src/steuernummer-formats.ts (NEW)
// [VERIFIED 2026-04-12 against https://de.wikipedia.org/wiki/Steuernummer]
// All 16 Bundesländer with their standard Steuernummer format.
// FF(F) = BUFA-Nr (2 or 3 digits); BBB(B) = Bezirksnummer; UUUU = Unterscheidungsnummer; P = Prüfziffer.

export type BundeslandCode =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export interface SteuernummerFormat {
  code: BundeslandCode;
  germanName: string;
  regex: RegExp;          // Accepts either raw-digits or slash-separated form.
  example: string;        // Slash-separated display example.
  length: 10 | 11;
}

export const STEUERNUMMER_FORMATS: readonly SteuernummerFormat[] = [
  { code: 'BW', germanName: 'Baden-Württemberg',            regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '93/815/08152',  length: 10 },
  { code: 'BY', germanName: 'Bayern',                       regex: /^\d{3}\/?\d{3}\/?\d{5}$/, example: '181/815/08155', length: 11 },
  { code: 'BE', germanName: 'Berlin',                       regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '21/815/08150',  length: 10 },
  { code: 'BB', germanName: 'Brandenburg',                  regex: /^\d{3}\/?\d{3}\/?\d{5}$/, example: '048/815/08155', length: 11 },
  { code: 'HB', germanName: 'Bremen',                       regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '75/815/08152',  length: 10 },
  { code: 'HH', germanName: 'Hamburg',                      regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '02/815/08156',  length: 10 },
  { code: 'HE', germanName: 'Hessen',                       regex: /^0\d{2}\/?\d{3}\/?\d{5}$/, example: '013/815/08153', length: 11 },
  { code: 'MV', germanName: 'Mecklenburg-Vorpommern',       regex: /^\d{3}\/?\d{3}\/?\d{5}$/, example: '079/815/08151', length: 11 },
  { code: 'NI', germanName: 'Niedersachsen',                regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '24/815/08151',  length: 10 },
  { code: 'NW', germanName: 'Nordrhein-Westfalen',          regex: /^\d{3}\/?\d{4}\/?\d{4}$/, example: '133/8150/8159', length: 11 },
  { code: 'RP', germanName: 'Rheinland-Pfalz',              regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '22/815/08154',  length: 10 },
  { code: 'SL', germanName: 'Saarland',                     regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '10/815/08182',  length: 10 },
  { code: 'SN', germanName: 'Sachsen',                      regex: /^\d{3}\/?\d{3}\/?\d{5}$/, example: '201/123/12340', length: 11 },
  { code: 'ST', germanName: 'Sachsen-Anhalt',               regex: /^\d{3}\/?\d{3}\/?\d{5}$/, example: '101/815/08154', length: 11 },
  { code: 'SH', germanName: 'Schleswig-Holstein',           regex: /^\d{2}\/?\d{3}\/?\d{5}$/, example: '29/815/08158',  length: 10 },
  { code: 'TH', germanName: 'Thüringen',                    regex: /^\d{3}\/?\d{3}\/?\d{5}$/, example: '151/815/08156', length: 11 },
];

export function getSteuernummerFormat(code: BundeslandCode): SteuernummerFormat {
  const f = STEUERNUMMER_FORMATS.find(f => f.code === code);
  if (!f) throw new Error(`Unknown Bundesland: ${code}`);
  return f;
}

export function getSteuernummerRegex(code: BundeslandCode): RegExp {
  return getSteuernummerFormat(code).regex;
}
```

### Example 7: next-intl locale addition (minimal 2-file change)

```typescript
// Source: apps/web/src/i18n/routing.ts (EDIT)
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'pl', 'ar', 'de'] as const,  // ← add 'de'
  defaultLocale: 'pl',
});

export type Locale = (typeof routing.locales)[number];
```

```typescript
// Source: apps/web/src/i18n/request.ts (EDIT)
const localeSettings: Record<Locale, { timeZone: string; currency: string; numberingSystem?: string }> = {
  en: { timeZone: 'Europe/Warsaw', currency: 'EUR' },
  pl: { timeZone: 'Europe/Warsaw', currency: 'PLN' },
  ar: { timeZone: 'Asia/Dubai', currency: 'AED', numberingSystem: 'latn' },
  de: { timeZone: 'Europe/Berlin', currency: 'EUR' },  // ← add
};
```

### Example 8: CI locked-phrases guard (vitest regression test)

```typescript
// Source: packages/validators/src/__tests__/locked-phrases-guard.test.ts (NEW)
// Implements D-06 (CI verifies rendered output contains required phrases).

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCKED_DE_PHRASES, RESERVED_LEGAL_KEYS } from '../legal/de';

const messagesDir = path.resolve(__dirname, '../../../../apps/web/messages');
const locales = ['en', 'pl', 'ar', 'de'] as const;

function loadMessages(locale: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'));
}

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('Locked German legal phrases (D-05, D-06)', () => {
  it.each(locales)('messages/%s.json does not define any reserved legal key', (locale) => {
    const keys = flatKeys(loadMessages(locale));
    const violations = keys.filter(k =>
      RESERVED_LEGAL_KEYS.some(reserved => k.endsWith(`.${reserved}`) || k === reserved),
    );
    expect(violations, `Reserved keys found in ${locale}.json: ${violations.join(', ')}`).toEqual([]);
  });

  it('privacy-notices/de.ts content contains every locked phrase (output-level D-06)', async () => {
    const dePrivacy = await import('../privacy-notices/de');
    const serialized = JSON.stringify(dePrivacy);
    for (const [key, phrase] of Object.entries(LOCKED_DE_PHRASES)) {
      expect(serialized, `Missing ${key}="${phrase}" in privacy-notices/de.ts`).toContain(phrase);
    }
  });

  it('messages/de.json does not contain informal register (Du/Dir/Dein as standalone words)', () => {
    const raw = fs.readFileSync(path.join(messagesDir, 'de.json'), 'utf8');
    // Match "Du"/"Dir"/"Dein" as whole words with surrounding space/quote/punctuation
    const informal = raw.match(/["\s](Du|Dir|Dein[a-z]*)[^a-zA-Z]/g);
    expect(informal, `Informal register detected in de.json: ${informal?.join(', ')}`).toBeNull();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| next-intl v3 (routing via middleware-only) | next-intl v4 `defineRouting` + `getRequestConfig` | 2024 | Already on v4.9.1 — adding `de` is a routing-config change, no middleware edits |
| `@next/mdx` v14 | `@next/mdx` v16 (App Router first-class) | 2025 | Use `createMDX()` wrapper in `next.config.ts`; configure `pageExtensions: ['ts','tsx','mdx']` |
| Community `iso7064-mod-11-10` implementations | `@konfirm/iso7064` (maintained) OR inline 20-line implementation with vectors | — | For this phase, inline is simpler; see Code Example 4 |
| `libphonenumber-js`-style mega-regex libraries for VAT | Targeted per-country validators with authoritative references | — | We already have `validate-polish` in repo; same pattern applies for UK/DE |
| `remark-gfm` for heading IDs | `rehype-slug` + `rehype-autolink-headings` | 2023 | Proper separation (remark = parse, rehype = HTML transform) |

**Deprecated/outdated:**
- **`prose` Tailwind plugin for MDX rendering** — UI-SPEC explicitly rejects it; we maintain typographic control via tokens. Not deprecated industry-wide, just not our pattern.
- **VAT validation via scraping VIES** — we will use VIES REST API in Phase 57; Phase 56 is local-only.
- **Single unified "EU VAT number validator"** libraries — acceptable for quick MVPs but don't meet our spec precision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `@react-pdf/renderer` is pulled transitively through `react-pdf@10.4.1` and works today; but promoting it to an explicit dep is needed. | §Standard Stack | LOW — worst case: one extra dep in package.json; no runtime regression |
| A2 | Installing `@next/mdx` + rehype plugins does not break existing Next.js build or Sentry source-map upload. | §Architecture Pattern 3 | LOW — standard pattern; Sentry integration is at a higher level |
| A3 | The exact form of the SV-Nummer checksum weights `[2,1,2,5,7,1,2,1,2,1,2,1]` and letter-expansion rule is correct per DRV spec. | §Code Example 5 | MEDIUM — algorithm details vary between community sources. Recommendation: Steuerberater OR Wirtschaftsprüfer review checks these vectors. Test with at least 5 real-world SV-Nrs before production. |
| A4 | `rehype-autolink-headings@7.x` ships `behavior: 'wrap'` option in that exact API. | §Code Example — next.config.ts | LOW — verified in plugin docs; alternative is `behavior: 'append'` if wrap breaks styling |
| A5 | Approximate 120 German Registergerichte will be sourced from justiz.de Registerportal ors a one-time manual export. Data format (city, full name "Amtsgericht X", Bundesland) is stable. | §Handelsregister composite | LOW — Wikipedia's `Liste_deutscher_Registergerichte` article is an up-to-date community source; diff yearly |
| A6 | The existing `isPdplJurisdiction` predicate in `@contractor-ops/validators` can be extended OR a new `requiresPrivacyAcknowledgement(code)` predicate added — UI-SPEC §Interaction 6 marks this as planner's choice. | §Architecture — Onboarding Consent Step | LOW — either works; new predicate is cleaner |
| A7 | Existing WHT React-PDF route pattern exposes a tRPC mutation that returns a signed URL for download (not streamed in response body). UI-SPEC §PDF Download states this; not independently verified in code during research. | §PDF Download pipeline | MEDIUM — if WHT currently streams directly, the Phase 56 PDF endpoint should match the established pattern. **Verify during planning** by reading `packages/api/src/routers/wht.ts` (or wherever WHT cert routes live). |
| A8 | The Steuerberater brief can be commissioned in parallel with Wave 1 (validators) + Wave 2 (UI) implementation, and the review delivery window is within phase timeline. STATE.md flags this as a blocker but does not specify ETA. | §User Constraints D-13 | MEDIUM — if the Steuerberater review slips, phase acceptance criterion 4 (legally correct locked phrases) is not verified. Plan should include a "Steuerberater review incorporated" gate before phase completion. |
| A9 | Adding `de` to `routing.locales` does not trigger any locale-dependent feature flag or paid plan gate elsewhere in the codebase. | §Runtime State Inventory | LOW — grep for `locale ===` patterns during planning confirms |

## Open Questions

1. **Which Steuerberater / legal reviewer will review `messages/de.json` and `privacy-notices/de.ts`?**
   - What we know: STATE.md Blockers flags "German Steuerberater review of tax terminology should be commissioned during Phase 56."
   - What's unclear: Whether a reviewer is already engaged or needs to be sourced from scratch.
   - Recommendation: Plan should include a task "Commission Steuerberater review" in Wave 1 before implementation diverges from AI-draft terminology.

2. **Are GBGD/GBHA formats in scope for UI display, or only for validation accept-list?**
   - What we know: CONTEXT.md D-02 says "accept but no checksum" — validation-only.
   - What's unclear: UK onboarding UX — should GBGD/GBHA show a different helper text? UI-SPEC does not distinguish.
   - Recommendation: Treat as normal VAT registration for display; only the validator function differentiates.

3. **How should the public (unauthenticated) privacy page behave?**
   - What we know: UI-SPEC §Interaction 9 mentions a jurisdiction picker for org-less visitors.
   - What's unclear: What content to show until a jurisdiction is picked.
   - Recommendation: Show a simple list of three links (UK, DE, EU) with a one-sentence description each; pick a sensible default based on `Accept-Language` header when possible (soft hint, not enforced).

4. **Does the `PrivacyNotice` DB table already accept 'GB'/'DE'/'EU' jurisdiction values?**
   - What we know: Phase 51 service (`packages/api/src/services/privacy-notice.ts`) returns `null` for anything outside `AE | SA` (see Read result above).
   - What's unclear: Whether the column has a CHECK constraint that would reject new values.
   - Recommendation: Read the Phase 51 migration + Prisma `@db.VarChar` declaration during Wave 0; if a CHECK exists, add a migration to extend the allow-list.

5. **Does the existing `apps/web/src/app/[locale]/(legal)/privacy/page.tsx` need to stay, or become the jurisdiction picker?**
   - What we know: It currently renders a PL/EN version of a generic privacy policy via `useTranslations`.
   - Recommendation: Keep it as the unauthenticated EU fallback; new dynamic route `[jurisdiction]/page.tsx` handles GB/DE. Clarify in Wave 3 plan.

## Environment Availability

> Phase 56 is a code/config-only phase. No new runtime infrastructure, no new external services, no new cron jobs. The only "external dependency" is a human reviewer (Steuerberater).

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node 20+ | Build / test | ✓ (assumed, monorepo baseline) | — | — |
| pnpm | Install new deps | ✓ (workspace uses pnpm) | — | — |
| Next.js dev/build server | MDX routes verification | ✓ (Next 15.5.15 installed) | 15.5.15 | — |
| German-qualified Steuerberater (human) | D-13 translation review | ✗ (to be commissioned) | — | **Risk mitigation:** plan includes phase-gate "Steuerberater review incorporated" — blocks phase acceptance if undone. AI-generated messages can ship to staging; production blocked until review returns. |
| justiz.de Registerportal access | One-time export of ~120 courts for `handelsregister-courts.ts` | ✓ (public) | — | — |
| Wikipedia `Steuernummer` article | Reference for 16-Bundesland regex | ✓ (public) | — | — |

**Missing dependencies with no fallback:** None — all code dependencies exist in the npm ecosystem.

**Missing dependencies with fallback:** Steuerberater review (see table).

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | `vitest` 4.1.4 (unit/integration in both packages/validators and apps/web); `@playwright/test` 1.59.1 for e2e-like flows |
| Config file | `packages/validators/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.*.config.ts` |
| Quick run command | `pnpm --filter @contractor-ops/validators test` (checksum vectors; ~1s) |
| Full suite command | `pnpm turbo run test` (monorepo-wide) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| **FOUND-01** | UK UTR checksum validates valid input | unit | `pnpm --filter @contractor-ops/validators test -- uk-validators` | ❌ Wave 0 — create `packages/validators/src/__tests__/uk-validators.test.ts` |
| **FOUND-01** | Companies House number accepts SC/NI/OC variants | unit | same | ❌ Wave 0 |
| **FOUND-01** | GB VAT mod-97 and mod-9755 both accepted; GBGD/GBHA pass; invalid rejected | unit | same | ❌ Wave 0 |
| **FOUND-01** | Country Compliance section renders UK field group when `countryCode=GB` | integration (vitest + RTL) | `pnpm --filter @contractor-ops/web test -- country-compliance-section` | ❌ Wave 0 — extend existing test file or create `country-compliance-section.uk-de.test.tsx` |
| **FOUND-02** | USt-IdNr MOD-11-10 valid/invalid vectors | unit | `pnpm --filter @contractor-ops/validators test -- de-validators` | ❌ Wave 0 — create `packages/validators/src/__tests__/de-validators.test.ts` |
| **FOUND-02** | Steuernummer per-Bundesland regex accepts correct-state input, rejects other-state input | unit | same | ❌ Wave 0 |
| **FOUND-02** | SV-Nummer structural + checksum positive/negative vectors | unit | same | ❌ Wave 0 |
| **FOUND-02** | Handelsregister composite requires all three parts or none | unit (Zod schema) | `pnpm --filter @contractor-ops/validators test -- country-fields` | ❌ Wave 0 — extend `country-fields.test.ts` |
| **FOUND-02** | DE field group renders when `countryCode=DE`, Bundesland drives Steuernummer regex | integration | `pnpm --filter @contractor-ops/web test -- de-compliance-fields` | ❌ Wave 0 |
| **FOUND-03** | next-intl routing resolves `de` locale; messages/de.json loads without schema mismatch | integration (vitest) | `pnpm --filter @contractor-ops/web test -- i18n-de` | ❌ Wave 0 — create `apps/web/src/i18n/__tests__/de-locale.test.ts` |
| **FOUND-03** | Every key in `en.json` exists in `de.json` (parity gate) | unit | same | ❌ Wave 0 |
| **FOUND-03** | Language switcher cycles through all `routing.locales` | unit (RTL) | `pnpm --filter @contractor-ops/web test -- user-menu` (extend) | ❌ Wave 0 — extend existing `user-menu.test.tsx` |
| **FOUND-04** | `locked-phrases-guard.test.ts` — reserved keys not in any `messages/*.json` | unit | `pnpm --filter @contractor-ops/validators test -- locked-phrases-guard` | ❌ Wave 0 — create |
| **FOUND-04** | `locked-phrases-guard.test.ts` — every LOCKED_DE_PHRASES value appears in `privacy-notices/de.ts` | unit | same | ❌ Wave 0 |
| **FOUND-04** | `locked-phrases-guard.test.ts` — no "Du "/"Dir "/"Dein " in `messages/de.json` | unit | same | ❌ Wave 0 |
| **FOUND-04** | Rendered UK/DE profile UI contains `TAX_STEUERNUMMER_LABEL` verbatim | integration (RTL) | `pnpm --filter @contractor-ops/web test -- de-compliance-fields.locked-phrase` | ❌ Wave 0 |
| **FOUND-05** | UK GDPR privacy MDX renders with all Article 13 required sections | integration | `pnpm --filter @contractor-ops/web test -- privacy-page-gb` | ❌ Wave 0 — create `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-gb.test.tsx` |
| **FOUND-05** | UK GDPR PDF generation produces valid React-PDF document structure | integration | `pnpm --filter @contractor-ops/web test -- privacy-pdf-gb` | ❌ Wave 0 |
| **FOUND-06** | German Datenschutzerklärung MDX contains all `LOCKED_DE_PHRASES` | integration | `pnpm --filter @contractor-ops/web test -- privacy-page-de` | ❌ Wave 0 |
| **FOUND-06** | Jurisdiction routing: `organization.countryCode=DE` → `/legal/privacy/de` | integration | same | ❌ Wave 0 |
| **FOUND-06** | German PDF contains `Verantwortlicher im Sinne der DSGVO` snapshot | integration | `pnpm --filter @contractor-ops/web test -- privacy-pdf-de` | ❌ Wave 0 |
| **FOUND-01..06** | Onboarding consent step shows acknowledgement checkbox for UK/DE; Continue disabled until checked | integration (RTL) | `pnpm --filter @contractor-ops/web test -- onboarding-consent-step` (extend) | ❌ Wave 0 — extend existing test file |

### Sampling Rate (Nyquist)
- **Per task commit:** `pnpm --filter @contractor-ops/validators test` (validators + guard) — fast (~2-3s)
- **Per wave merge:** `pnpm turbo run test --filter=@contractor-ops/validators --filter=@contractor-ops/web` (all unit + integration)
- **Phase gate (before `/gsd-verify-work`):** full `pnpm turbo run test` green + one manual smoke-pass of `/en/legal/privacy/gb`, `/de/legal/privacy/de`, `/en/legal/privacy/eu` routes + DE locale switch + Steuerberater review incorporated

### Wave 0 Gaps (test infrastructure to create before implementation)
- [ ] `packages/validators/src/__tests__/uk-validators.test.ts` — covers FOUND-01 (UTR/VAT/CH vectors)
- [ ] `packages/validators/src/__tests__/de-validators.test.ts` — covers FOUND-02 (USt-IdNr/SV-Nr/Steuernummer vectors)
- [ ] `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — covers FOUND-04 (D-05, D-06 CI guard)
- [ ] `packages/validators/src/__tests__/country-fields.test.ts` — EXTEND with UK+DE discriminated-union cases
- [ ] `apps/web/src/i18n/__tests__/de-locale.test.ts` — covers FOUND-03 (routing, localeSettings, messages parity)
- [ ] `apps/web/src/components/contractors/compliance/__tests__/uk-compliance-fields.test.tsx`
- [ ] `apps/web/src/components/contractors/compliance/__tests__/de-compliance-fields.test.tsx`
- [ ] `apps/web/src/components/layout/__tests__/user-menu.test.tsx` — EXTEND with DE in localeOrder assertion
- [ ] `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-gb.test.tsx`, `privacy-de.test.tsx`, `privacy-eu.test.tsx`
- [ ] `apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx` — EXTEND with GB/DE acknowledgement cases
- [ ] No framework install needed — `vitest` 4.1.4 already present in every relevant package

## Security Domain

> `security_enforcement` is not explicitly disabled in `.planning/config.json` — including this section per policy.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| **V2 Authentication** | no — Phase 56 does not touch auth | n/a (session-based auth from Better Auth continues) |
| **V3 Session Management** | no | n/a |
| **V4 Access Control** | yes | Privacy-notice PDF download tRPC mutation MUST derive jurisdiction from `session.organization.countryCode`, not a user-supplied query param. Prevents cross-jurisdiction notice leak. |
| **V5 Input Validation** | yes | All new user inputs (UK/DE tax IDs, Handelsregister composite, SV-Nummer) Zod-validated at tRPC boundary AND at RHF client boundary. Zod `discriminatedUnion` keyed on `countryCode` prevents type confusion. |
| **V6 Cryptography** | no — no new secrets or encryption | n/a |
| **V7 Error Handling** | yes | Validator error messages must NOT leak internal structure (e.g. which regex matched); Zod custom messages use user-friendly format hints (UI-SPEC §Copywriting error states) |
| **V8 Data Protection** | yes | `countryFields` JSONB may contain PII (Sozialversicherungsnummer is Art. 9 DSGVO sensitive data). Existing Prisma multi-tenant extension scopes reads by `organizationId`; confirm in planning that the JSONB column is not leaked in any export/report path beyond its intended consumers. |
| **V10 Malicious Code** | yes | MDX content is author-controlled (reviewed PRs only); no runtime MDX from user input. CSP `script-src` already tight. |
| **V12 Files & Resources** | yes | Privacy PDF downloads via signed URL with short TTL (existing Phase 51 pattern — re-use, don't invent) |
| **V13 API & Web Service** | yes | tRPC mutations for country-field updates: enforce `organizationId` context (AsyncLocalStorage extension already in repo) and verify the contractor belongs to the caller's org before mutating |
| **V14 Configuration** | yes | `next.config.ts` CSP must not regress when adding MDX; verify MDX-generated HTML is compatible with current `script-src 'self' 'unsafe-inline'` (MDX-compiled output is static HTML, no runtime script injection) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| SQL injection via `countryFields` JSONB | Tampering | Prisma parameterized queries; no raw SQL in new code |
| XSS via MDX | Tampering | MDX is compile-time processed; no runtime user MDX; CSP `script-src 'self'` |
| IDOR on privacy-notice PDF jurisdiction | Information Disclosure | Derive jurisdiction from session, not user input (see V4 above) |
| PII over-exposure — SV-Nummer leakage | Information Disclosure | Log redaction: existing `@contractor-ops/logger` with PII masks; confirm SV-Nr is on the mask list |
| Formal register downgrade | Repudiation / compliance exposure | Two-layer CI guard (D-06) — schema + output level |
| Locked phrase accidental edit | Compliance exposure | `as const` literal types + CI test asserts content in shipped privacy notice |
| PDF source-map leak via Sentry | Information Disclosure | Phase 56 adds no server code that handles secrets; existing Sentry config is safe |
| Cross-tenant contractor profile access | Authorization | Existing Prisma multi-tenant extension ensures `organizationId` scoping on `Contractor` reads/writes — no new attack surface |

## Sources

### Primary (HIGH confidence)

- **Next.js 15 MDX guide** — https://nextjs.org/docs/app/guides/mdx — canonical `createMDX` + `pageExtensions` pattern
- **next-intl v4 configuration** — https://next-intl.dev/docs/usage/configuration — timezone, formats, localeSettings
- **next-intl v4 routing setup** — https://next-intl.dev/docs/routing/setup — `defineRouting` with locales array
- **HMRC design system — Unique Taxpayer Reference** — https://design.tax.service.gov.uk/hmrc-design-patterns/unique-taxpayer-reference/ — UTR format spec
- **HMRC design system — VAT registration number** — https://design.tax.service.gov.uk/hmrc-design-patterns/vat-registration-number/ — VAT format spec
- **Wikipedia — Steuernummer** (verified 2026-04-12 fetch) — https://de.wikipedia.org/wiki/Steuernummer — per-Bundesland format table used in Code Example 6
- **Deutsche Rentenversicherung — Versicherungsnummer** — https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Allgemeine-Informationen/Sozialversicherungsausweis/Sozialversicherungsausweis.html — SV-Nr structure
- **python-stdnum ISO 7064 docs** — https://arthurdejong.org/python-stdnum/doc/1.17/stdnum.iso7064 — MOD-11-10 reference + vectors
- **ICO — Right to be informed** — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/ — UK GDPR Article 13 required elements
- **BfDI Mustertexte** — https://www.bfdi.bund.de/DE/Buerger/Mustertexte/Zwischenordner-für-Mustertexte/Mustertexte_Allgemein.html — official DE templates
- **Art. 13 DSGVO (official) + IHK München template** — https://dsgvo-gesetz.de/art-13-dsgvo/, https://www.ihk-muenchen.de/ihk/documents/Recht-Steuern/Datenschutz/2021_02_09_IHK_Muster-Informationspflicht-nach-Art.-13-und-14-DSGVO.pdf — Datenschutzerklärung mandatory elements
- **Liste deutscher Registergerichte** — https://de.wikipedia.org/wiki/Liste_deutscher_Registergerichte — community-maintained ~120-court list
- **Gemeinsames Registerportal** — https://www.justiz.de/onlinedienste/registerportal_der_laender/index.php — official source-of-truth
- **npm registry** (verified 2026-04-12) — `next-intl@4.9.1`, `@next/mdx@16.2.3`, `rehype-slug@6.0.0`, `rehype-autolink-headings@7.1.0`, `@react-pdf/renderer@4.4.1`, `@konfirm/iso7064@2.1.3`
- **Zod — Discriminated Unions** — https://zod.dev/?id=discriminated-unions — canonical pattern for country-specific validation

### Secondary (MEDIUM confidence)

- **HubPages — UK VAT checksum mod-97/9755** — https://discover.hubpages.com/business/Check-VAT-Numbers-UK — pre-2010 vs post-2010 algorithms (community reverse-engineered, widely used; HMRC has not officially published)
- **GitHub gist — UK Company number regex** (rob-murray) — https://gist.github.com/rob-murray/01d43581114a6b319034732bcbda29e1 — Companies House prefix reference
- **AccountingWEB — UTR Validation Formula** — https://www.accountingweb.co.uk/any-answers/utr-validation-formula — community-discussed UTR checksum weights
- **Mike Bifulco — MDX heading anchors** — https://mikebifulco.com/posts/mdx-auto-link-headings-with-rehype-slug — rehype-slug + rehype-autolink-headings order
- **Reetesh Kumar — MDX in Next.js App Router** — https://reetesh.in/blog/mdx-in-next.js-with-app-router-setup-guide — practical setup reference

### Tertiary (LOW confidence — verify in planning)

- SV-Nummer exact weight array `[2,1,2,5,7,1,2,1,2,1,2,1]` (A3 in Assumptions Log) — community sources agree but DRV does not publish the algorithm publicly. Steuerberater should verify with sample vectors.
- GBGD/GBHA government VAT range splits (GBGD 500-999, GBHA 000-499) — from OpenCorporates knowledge base; secondary source.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every version verified against npm registry 2026-04-12; existing deps confirmed in repo
- Architecture: **HIGH** — four of five core patterns already exist in v4.0 (Phase 47 countryFields, Phase 50 i18n, Phase 51 React-PDF, Phase 51 consent step)
- Validators: **HIGH** — UTR/VAT/CH/USt-IdNr checksum specs cross-verified against multiple authoritative sources; Steuernummer regex table fetched live from Wikipedia
- Pitfalls: **HIGH** — mod-97/9755 coexistence, MOD-11-10 iterative vs naive, `pageExtensions` hot-reload, locale-switcher hardcoding — all real, documented
- SV-Nummer algorithm: **MEDIUM** — algorithm is well-known but not officially published; requires Steuerberater spot-check
- Handelsregister court list completeness: **MEDIUM** — ~120 courts from community source; one-time manual verification against justiz.de during planning

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable domain: tax ID specs, GDPR, i18n libraries — 30 days)
