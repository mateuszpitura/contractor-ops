# Stack Research: v4.0 International Foundation & Gulf Expansion

**Domain:** Pluggable e-invoicing, multi-currency, Arabic RTL, SWIFT payments, multi-region deployment, government API integrations
**Researched:** 2026-04-11
**Confidence:** MEDIUM-HIGH (libraries verified via npm/GitHub; ZATCA and Peppol specs confirmed via official sources; Neon region availability verified via docs)

## Scope

This document covers ONLY the stack additions needed for v4.0 features:
- Pluggable e-invoicing engine (EN 16931 / UBL 2.1 / ZATCA / Peppol PINT-AE)
- Multi-currency support (AED, SAR, GBP + exchange rates)
- Arabic RTL localization
- SWIFT payment file generation
- Multi-region deployment (Middle East)
- Government API integrations (ZATCA Fatoorah, Peppol ASP)
- WHT calculator, PDPL compliance, country-specific contractor fields

The existing stack is validated and unchanged: Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, tRPC 11, Prisma 7, Neon Postgres, Better Auth, QStash, Upstash Redis, R2, Vercel, next-intl 4, Zod, date-fns, Sentry.

## What We Already Have (DO NOT Add)

| Capability | Existing | Notes |
|------------|----------|-------|
| XML parsing | KSeF integration in `packages/api` | Will refactor into pluggable engine |
| Currency field in schema | `String @db.Char(3)` on invoices, orgs, contracts | Already supports arbitrary ISO 4217 codes |
| Integer minor units for money | `subtotalMinor`, `vatAmountMinor` as `Int` | Correct approach -- keeps precision |
| i18n framework | next-intl 4.8.3 | Already supports locale routing, pluralization |
| Provider adapter pattern | BaseAdapter, credential store, webhook pipeline | Reuse for ZATCA + Peppol providers |
| QStash async processing | Fire-and-forget for integrations | Reuse for government API calls |
| AES-256-GCM credential encryption | Per-provider key isolation | Reuse for ZATCA/Peppol API credentials |
| Zod schema validation | All external inputs validated | Extend for new invoice schemas |
| date-fns | Date formatting, locale-aware | Already supports Arabic locale |

## Recommended Stack Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| xmlbuilder2 | ^4.0.0 | XML document construction (UBL 2.1 invoices) | Type-safe chainable API, namespace support, DOM-conformant. Used for generating ZATCA UBL XML, Peppol PINT-AE XML, and EN 16931 compliant invoices. Replaces ad-hoc XML string building in KSeF. |
| xml-crypto | ^6.0.0 | XML digital signature (XMLDSig) | The standard Node.js library for XML digital signatures. Required for ZATCA invoice signing (X.509 certificates, ECDSA). Maintained by node-saml org, 3M+ weekly downloads, battle-tested in SAML/security contexts. |
| @xmldom/xmldom | ^0.9.0 | XML DOM parsing/serialization | Required peer dependency for xml-crypto. W3C DOM Level 2 compliant XML parser for Node.js. Needed for parsing ZATCA responses and validating XML structure. |
| qrcode | ^1.5.4 | QR code generation (ZATCA + Peppol) | Most popular QR library (5M+ weekly downloads). Generates QR codes as Buffer/DataURL/SVG for ZATCA TLV-encoded invoice QR codes and Peppol invoice identifiers. |

### Multi-Currency & Exchange Rates

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @dinero.js/dinero.js | ^2.0.0-alpha.14 | Money object model with currency safety | Type-safe money operations with compile-time currency mismatch detection. Immutable, tree-shakeable. Works with our existing integer minor units pattern (grosze/fils/halalah). Prevents floating-point bugs in multi-currency arithmetic. |
| @dinero.js/currencies | ^2.0.0-alpha.14 | ISO 4217 currency definitions | Pre-built currency objects (AED, SAR, GBP, PLN, EUR, USD) with correct exponents. AED has exponent 2, SAR has exponent 2 -- matches our `Int` minor units. |
| frankfurter (API) | N/A (external) | Exchange rate data source | Free, open-source API backed by ECB daily reference rates. Covers EUR/AED/SAR/GBP/PLN/USD. No API key needed. Self-hostable if needed. Use as primary rate source with fallback caching in Redis. |

**Architecture note:** Do NOT replace the existing `Int` minor-unit pattern in Prisma. Dinero.js wraps these values at the application layer for safe arithmetic and conversion. Store amounts as integers, compute with Dinero, convert back to integers for persistence.

### RTL & Arabic Localization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shadcn CLI `--rtl` | Built-in (shadcn ^4.0.8) | Convert physical CSS to logical properties | shadcn/ui has first-class RTL support since January 2026. The CLI converts `ml-4` to `ms-4`, `left-*` to `start-*`, `text-left` to `text-start` automatically. Run `shadcn migrate rtl` on existing components -- no plugin needed. |
| @radix-ui/react-direction | Already installed (via shadcn) | DirectionProvider for RTL context | Provides `<DirectionProvider dir="rtl">` wrapper. Already a dependency of Radix primitives used by shadcn/ui. |
| rtl-detect | ^2.0.0 | Detect RTL locales programmatically | Tiny utility (1KB) to detect if a locale code is RTL. Use with next-intl to set `dir` attribute on `<html>` based on active locale. |

**What NOT to add for RTL:**
- `tailwindcss-rtl` plugin -- unnecessary. Tailwind CSS 4 supports CSS logical properties natively (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`). The shadcn `migrate rtl` command handles the conversion.
- `tailwindcss-flip` -- unnecessary for same reason. shadcn's approach is more granular and doesn't flip everything blindly.

**Implementation approach:** Use CSS logical properties throughout (already the direction Tailwind 4 pushes). Set `dir="rtl"` on `<html>` when locale is `ar`. next-intl's middleware already routes by locale -- add Arabic locale to the config. Arabic has 6 plural forms -- next-intl handles this via ICU MessageFormat.

### SWIFT Payment Files

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom implementation | N/A | SWIFT MT101 / pain.001 generation | No production-quality JavaScript library exists for SWIFT MT101 generation. The format is well-documented (fixed-width fields with specific tag structure). Build a custom generator in `packages/api` following the MT101 spec. Reuse the existing payment run CSV export pattern -- add MT101 as an output format. |

**Format choice:** Generate ISO 20022 `pain.001.001.09` (XML-based) rather than legacy MT101 (text-based). SWIFT is migrating all MT messages to ISO 20022 by November 2025. pain.001 is XML -- use xmlbuilder2 (already added above) for generation. This future-proofs the implementation.

**Purpose codes:** UAE Central Bank requires purpose codes on all transfers. Store purpose code mapping as a configuration table (e.g., `SCVE` for services, `SUPP` for supplier payments). Apply per-payment based on contractor service type.

### Cryptographic Infrastructure (ZATCA)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `crypto` module | Built-in | ECDSA key generation, hashing, certificate handling | ZATCA requires ECDSA with secp256k1 curve for invoice signing. Node.js crypto module handles this natively -- no external dependency needed. Generate key pairs, create CSRs for ZATCA onboarding, compute SHA-256 invoice hashes for hash chain. |
| @peculiar/x509 | ^1.12.0 | X.509 certificate parsing and creation | Parse ZATCA-issued compliance and production certificates (CSIDs). Create Certificate Signing Requests (CSRs) for ZATCA onboarding flow. Pure JavaScript, works in Node.js and browser. More ergonomic than raw OpenSSL commands. |
| @peculiar/asn1-schema | ^2.3.0 | ASN.1 encoding/decoding | Peer dependency of @peculiar/x509. Handles DER/PEM encoding for certificate operations. Required for ZATCA's TLV (Tag-Length-Value) QR code encoding. |

**Why NOT zatca-xml-js:** The `zatca-xml-js` package (v0.1.9, last updated 3 years ago) and `zatca-xml-ts` (v0.1.5, more recent) are reference implementations but have limitations: dependency on system OpenSSL, no support for standard tax invoices (only simplified), and tight coupling that doesn't fit our pluggable engine architecture. Better to build our own ZATCA adapter using the underlying primitives (xml-crypto, xmlbuilder2, @peculiar/x509) within our existing provider adapter pattern.

### Peppol Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ASP REST API integration | N/A (external service) | Peppol network access for UAE PINT-AE | Peppol uses a 5-corner model. We do NOT become a Peppol Access Point -- we integrate with an Accredited Service Provider (ASP) via their REST API. The ASP handles network delivery, SMP lookup, and AS4 transport. We generate the PINT-AE XML and submit via API. Build as a provider adapter (like DocuSign/Autenti pattern). |

**ASP selection criteria:** Look for ASPs with REST API (not just SFTP), webhook support for delivery status, sandbox/test environment, and UAE FTA accreditation. Candidates include Storecove, Pagero (Thomson Reuters), and EDICOM. Selection is a deployment decision, not a code dependency.

### Multi-Region Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Neon logical replication | Built-in | Data residency for UAE/Saudi (PDPL compliance) | Neon does NOT have a Middle East region (verified: only US, EU Frankfurt/London, APAC Singapore/Sydney, South America). For PDPL compliance, use Neon's logical replication to replicate to a separate Neon project in `aws-eu-central-1` (Frankfurt) as the nearest supported region. Alternatively, evaluate Supabase (has Middle East regions) for the ME-specific database if strict data residency is required. |
| Vercel Edge Config | Already available | Region-aware routing configuration | Store per-org region preferences. Route API calls to appropriate database connection based on org's data residency setting. |

**CRITICAL finding:** Neon has no Middle East region. This is a blocker for strict PDPL data residency requirements if UAE/Saudi regulators require data to physically reside in-country. Options:

1. **Frankfurt (recommended for MVP):** `aws-eu-central-1` is the nearest Neon region. PDPL allows cross-border transfer with contractual safeguards (similar to GDPR SCCs). Most Gulf SaaS companies use EU or Singapore regions.
2. **Separate provider for ME data:** If a customer requires in-region hosting, deploy a Supabase instance in `me-south-1` (Bahrain) for that org's data. This adds operational complexity.
3. **Read replicas (future):** Neon's cross-region read replica feature (in development, tracked in GitHub issue #4178) would solve latency without full data residency.

**Recommendation:** Start with Frankfurt. Add contractual safeguards for PDPL compliance. Revisit if a customer explicitly requires in-country hosting.

### VAT & Tax Engine

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom implementation | N/A | Multi-tier VAT calculation | The VAT rules are simple enough that a library adds more complexity than value. UAE: flat 5%, Saudi: flat 15%, Poland: 23%/8%/5%/0%, UK: 20%/5%/0%. Build a `TaxEngine` service with country-specific rate tables stored in the database. Supports reverse charge flags, zero-rating, and exemptions. Use Dinero.js for the arithmetic. |

**WHT (Withholding Tax) calculator:** Saudi WHT applies only to cross-border payments to non-resident contractors (5-20% depending on service type). Build as a rule engine with treaty rate lookups. Store treaty rates in a configuration table. Generate WHT certificates as PDFs using the existing PDF generation infrastructure (react-pdf already installed).

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.23.0 (existing) | Schema validation for new invoice/tax types | Extend existing schemas for UBL fields, ZATCA-specific fields, PINT-AE fields |
| date-fns | ^4.1.0 (existing) | Hijri calendar awareness, Arabic date formatting | date-fns supports `ar-SA` locale out of the box. For Hijri dates on ZATCA invoices, use `date-fns-jalali` or format via `Intl.DateTimeFormat` with `calendar: 'islamic'` |
| uuid | (existing via Prisma) | ZATCA invoice UUIDs | ZATCA requires UUIDv4 per invoice. Already available in the codebase. |

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ZATCA Sandbox | Test ZATCA integration | `https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal` -- free sandbox with test certificates |
| Peppol Test Network | Test Peppol PINT-AE | ASP providers offer sandbox environments for testing XML submission and delivery |
| shadcn migrate rtl | Convert existing components to logical properties | Run once: `npx shadcn@latest migrate rtl` -- converts all existing shadcn components |

## Installation

```bash
# E-invoicing engine (XML generation + signing)
pnpm add xmlbuilder2 xml-crypto @xmldom/xmldom qrcode

# Cryptographic infrastructure (ZATCA certificates)
pnpm add @peculiar/x509 @peculiar/asn1-schema

# Multi-currency
pnpm add @dinero.js/dinero.js @dinero.js/currencies

# RTL detection
pnpm add rtl-detect

# Type definitions
pnpm add -D @types/qrcode @types/rtl-detect
```

**Where to install:**
- `xmlbuilder2`, `xml-crypto`, `@xmldom/xmldom`, `@peculiar/x509`, `@peculiar/asn1-schema` --> `packages/api` (server-side only, handles XML generation and crypto)
- `qrcode` --> `packages/api` (generates QR as base64 for PDF/HTML rendering)
- `@dinero.js/dinero.js`, `@dinero.js/currencies` --> `packages/validators` or new `packages/currency` (shared between frontend display and backend calculation)
- `rtl-detect` --> `apps/web` (frontend layout direction detection)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| xmlbuilder2 | fast-xml-parser | If you only need parsing, not building. fast-xml-parser is faster for read-only XML but lacks the chainable builder API needed for constructing complex UBL documents with namespaces. |
| xml-crypto | xmldsigjs | If you need W3C Web Crypto API compatibility (browser-side signing). xmldsigjs uses WebCrypto, xml-crypto uses Node.js crypto. We only sign server-side, so xml-crypto is simpler. |
| @peculiar/x509 | node-forge | If you need broader crypto features (TLS, PKCS#7, etc.). node-forge is larger and slower. @peculiar/x509 is focused, modern, and uses native crypto under the hood. |
| @dinero.js | currency.js | If you don't need type-safe multi-currency. currency.js is simpler but only handles single-currency arithmetic. Dinero.js enforces currency matching at the type level -- critical when mixing AED/SAR/PLN/EUR. |
| Frankfurter API | Open Exchange Rates / Fixer.io | If you need real-time (sub-daily) rates or 170+ currencies. Frankfurter is ECB-backed (free, reliable) but updates once daily. For financial-grade real-time FX, use Open Exchange Rates ($12/mo) or Fixer.io. ECB daily rates are sufficient for our invoice matching and display use case. |
| Custom SWIFT generator | zatca-xml-js | Never use zatca-xml-js for SWIFT. No JS library exists for MT101. Custom pain.001 XML generation via xmlbuilder2 is the correct approach. |
| Frankfurt (Neon) | Supabase ME region | If a customer has a hard legal requirement for in-country data storage in UAE/Saudi. Adds operational complexity of managing a second database provider. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| zatca-xml-js / zatca-xml-ts | Unmaintained (3 years), only supports simplified invoices, requires system OpenSSL, tight coupling | Build custom ZATCA adapter using xml-crypto + xmlbuilder2 + @peculiar/x509 within provider adapter pattern |
| ubl-builder (npm) | Built for UBL 2.0 (not 2.1), limited maintenance, doesn't support ZATCA/Peppol customizations | Use xmlbuilder2 directly with UBL 2.1 schema definitions as TypeScript types |
| tailwindcss-rtl plugin | Unnecessary with Tailwind CSS 4 logical properties + shadcn RTL migration | Use native Tailwind 4 logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) |
| tailwindcss-flip | Blindly flips all directional classes -- breaks intentional LTR elements in RTL layouts (e.g., code blocks, numbers) | Use shadcn `migrate rtl` for surgical conversion to logical properties |
| moment.js / moment-hijri | Deprecated, massive bundle size | Use `Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'` for Hijri dates (built into Node.js / browsers) |
| Full Peppol Access Point SDK | Massive overhead to become an Access Point. Requires SMP registration, AS4 transport, PKI infrastructure | Integrate with an ASP via REST API. They handle the Peppol network complexity. |
| Separate currency microservice | Over-engineering for our scale (5-50 contractors per org) | Dinero.js in-process with cached exchange rates from Redis |

## Stack Patterns by Capability

**E-invoicing engine (pluggable):**
- Abstract `EInvoiceProvider` interface extending existing `BaseAdapter` pattern
- Concrete implementations: `KSeFProvider` (refactored), `ZATCAProvider`, `PeppolPINTAEProvider`
- Each provider: XML generation (xmlbuilder2) + signing (xml-crypto) + submission (provider API) + status tracking
- Schema validation with Zod for each format's required fields

**Multi-currency conversions:**
- Fetch ECB rates daily via QStash cron -> store in Redis with 24h TTL
- `CurrencyService` wraps Dinero.js: `convert(amount: MoneyValue, targetCurrency: Currency): MoneyValue`
- All display formatting via `Intl.NumberFormat` with locale from next-intl (already handles AED/SAR/GBP formatting)
- Invoice matching: compare amounts in org's base currency using stored exchange rate at invoice date

**Arabic RTL:**
- `middleware.ts`: next-intl already handles locale detection -> add `ar` to supported locales
- `layout.tsx`: read locale, use `rtl-detect` to set `dir` attribute on `<html>`
- `DirectionProvider` from Radix wraps app for component-level direction awareness
- Run `shadcn migrate rtl` once to convert all existing components to logical properties

**SWIFT payments:**
- Extend existing payment run export. Currently generates CSV -> add `pain.001` XML output format
- xmlbuilder2 generates ISO 20022 pain.001.001.09 with SWIFT BIC, IBAN, purpose codes
- Purpose code stored per-contractor or per-payment based on service type

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| xml-crypto@^6.0.0 | @xmldom/xmldom@^0.9.0 | xml-crypto requires xmldom as peer dependency for DOM parsing |
| @dinero.js/dinero.js@2.0.0-alpha.14 | @dinero.js/currencies@2.0.0-alpha.14 | Must use matching alpha versions. v2 is the current release (alpha is stable, used in production). |
| shadcn@^4.0.8 | tailwindcss@^4.2.1 | RTL migration command requires shadcn 4+ and Tailwind CSS 4+ (both already installed) |
| @peculiar/x509@^1.12.0 | @peculiar/asn1-schema@^2.3.0 | x509 depends on asn1-schema for DER/PEM encoding |
| next-intl@^4.8.3 | next@^15.3.0 | Arabic locale support works with current versions. ICU MessageFormat handles 6 Arabic plural forms. |

## Sources

- [ZATCA E-Invoicing Technical Guidelines (PDF)](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-invoicing-Detailed-Technical-Guideline.pdf) -- official ZATCA XML schema, signing requirements, QR encoding spec (HIGH confidence)
- [zatca-xml-js GitHub](https://github.com/wes4m/zatca-xml-js) -- reference implementation reviewed for architecture patterns, NOT recommended as dependency (MEDIUM confidence)
- [UAE Electronic Invoicing Guidelines V1.0](https://mof.gov.ae/wp-content/uploads/2026/02/UAE-Electronic-Invoicing-Guidelines_V-1.0-23Feb2026.pdf) -- official UAE PINT-AE spec (HIGH confidence)
- [Neon Regions Documentation](https://neon.com/docs/introduction/regions) -- confirmed no Middle East region available (HIGH confidence)
- [shadcn/ui RTL Documentation](https://ui.shadcn.com/docs/rtl) -- RTL migration command, logical property conversion (HIGH confidence)
- [xml-crypto npm](https://www.npmjs.com/package/xml-crypto) -- XML digital signature library, actively maintained (HIGH confidence)
- [xmlbuilder2 npm](https://www.npmjs.com/package/xmlbuilder2) -- XML builder v4.0.0, TypeScript definitions included (HIGH confidence)
- [Dinero.js v2 Documentation](https://v2.dinerojs.com/) -- multi-currency money library, alpha but stable (MEDIUM confidence -- alpha version)
- [Frankfurter API](https://frankfurter.dev/) -- free ECB exchange rate API (HIGH confidence)
- [Avalara UAE E-Invoicing Guide](https://www.avalara.com/blog/en/europe/2026/03/uae-e-invoicing-mandate-2026-readiness-asp-pint-ae.html) -- Peppol PINT-AE architecture overview (MEDIUM confidence)
- [SWIFT MT101 Specifications](https://www.paiementor.com/swift-mt101-format-specifications/) -- MT101 format reference, used to confirm pain.001 is the better choice (MEDIUM confidence)
- [@peculiar/x509 GitHub](https://github.com/nicolo-ribaudo/nicolo-ribaudo) -- X.509 certificate handling for Node.js (HIGH confidence)

---
*Stack research for: v4.0 International Foundation & Gulf Expansion*
*Researched: 2026-04-11*
