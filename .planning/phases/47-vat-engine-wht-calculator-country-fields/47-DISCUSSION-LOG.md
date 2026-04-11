# Phase 47: VAT Engine, WHT Calculator & Country Fields - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 47-VAT Engine, WHT Calculator & Country Fields
**Areas discussed:** VAT rate engine, WHT calculator & certificates, Country-specific profile fields, Compliance dashboard

---

## VAT Rate Engine

| Option | Description | Selected |
|--------|-------------|----------|
| DB-driven rate table | TaxRate Prisma table with country, rate, code, effective dates. Seeded. | ✓ |
| Config file per country | JSON/TS config files. Requires deploy to update. | |
| You decide | Claude picks | |

**User's choice:** DB-driven rate table
**Notes:** Aligns with success criteria: "database configuration, not code branches"

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect from parties | Engine checks seller/buyer country + VAT status. Auto-flags. Overridable. | ✓ |
| Manual toggle per invoice | User explicitly marks reverse charge. | |
| You decide | Claude picks | |

**User's choice:** Auto-detect from parties

---

## WHT Calculator & Certificates

| Option | Description | Selected |
|--------|-------------|----------|
| DB table seeded with treaty data | WithholdingTaxRate table with country pairs, service types, rates. | ✓ |
| Hardcoded rate lookup | TypeScript map of rates. | |
| You decide | Claude picks | |

**User's choice:** DB table seeded with treaty data

| Option | Description | Selected |
|--------|-------------|----------|
| Standard fields + org branding | Full details + logo/colors from branding system. React-PDF. | ✓ |
| Minimal regulatory fields only | Just required fields, plain format. | |
| You decide | Claude picks | |

**User's choice:** Standard fields + org branding

---

## Country-Specific Profile Fields

| Option | Description | Selected |
|--------|-------------|----------|
| JSON column with typed schema | countryFields JSONB column. Zod schema per country. Flexible. | ✓ |
| Separate columns per field | Nullable columns per field on Contractor. Type-safe but migrations. | |
| You decide | Claude picks | |

**User's choice:** JSON column with typed schema

| Option | Description | Selected |
|--------|-------------|----------|
| Conditional section in existing profile | Country Compliance section in existing tabs. Shows/hides by country. | ✓ |
| Separate compliance tab | New 9th tab for country fields. | |
| You decide | Claude picks | |

**User's choice:** Conditional section in existing profile

---

## Compliance Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Phase 45 compliance widget | Add VAT/WHT to existing widget. Single compliance surface. | ✓ |
| Separate tax dashboard page | New /tax-compliance page. More space. | |
| You decide | Claude picks | |

**User's choice:** Extend Phase 45 compliance widget

---

## Claude's Discretion

- TaxRate seed data structure
- WHT certificate PDF layout
- Reverse charge detection rules
- countryFields Zod schema details
- Compliance widget combined layout

## Deferred Ideas

None — discussion stayed within phase scope.
