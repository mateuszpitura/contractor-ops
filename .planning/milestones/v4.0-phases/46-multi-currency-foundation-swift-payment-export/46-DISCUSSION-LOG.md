# Phase 46: Multi-Currency Foundation & SWIFT Payment Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 46-Multi-Currency Foundation & SWIFT Payment Export
**Areas discussed:** Money utility, SWIFT payment generation, Exchange rate handling, Currency migration

---

## Money Utility

| Option | Description | Selected |
|--------|-------------|----------|
| Custom Money utility | Thin wrapper with ISO 4217 lookup. Zero deps. | |
| Dinero.js v2 with fallback | Dinero as primary, custom fallback if it breaks. | |
| You decide | Claude picks | |

**User's choice:** Other — "Dinero.js ma wersje 2.0.2... jesli juz nie ma alpha (a raczej nie ma) to zrobmy to normalnie a nie roboczo! moze byc dependency"
**Notes:** User confirmed Dinero.js v2 is at 2.0.2 (stable). Use as normal dependency, no fallback needed. STATE.md risk flag about alpha is outdated.

| Option | Description | Selected |
|--------|-------------|----------|
| Gradual via shared helpers | Money helpers wrapping Dinero. Replace *100 incrementally. | |
| Full Dinero adoption | Refactor all monetary ops to Dinero objects. Integers only at boundaries. | ✓ |
| You decide | Claude picks migration strategy | |

**User's choice:** Full Dinero adoption
**Notes:** Clean break — Dinero objects everywhere, integers only at DB/API serialization.

---

## SWIFT Payment Generation

| Option | Description | Selected |
|--------|-------------|----------|
| New generator alongside SEPA | Separate generateSwiftXml(). SEPA stays for EU, SWIFT for international. | ✓ |
| Unified generator | Refactor into generic pain.001 with schema version switch. | |
| You decide | Claude picks | |

**User's choice:** New generator alongside SEPA
**Notes:** SEPA and SWIFT have different schemas, charge bearers, and required fields.

| Option | Description | Selected |
|--------|-------------|----------|
| Service category mapping | Contract service categories map to purpose codes. Auto-assign + override. | ✓ |
| Organization-level default + override | Org sets default purpose code. Less granular. | |
| You decide | Claude picks | |

**User's choice:** Service category mapping
**Notes:** Configurable lookup table, auto-assigned, manual override per payment item.

---

## Exchange Rate Handling

| Option | Description | Selected |
|--------|-------------|----------|
| ECB + supplementary for Gulf | ECB primary. AED/SAR via USD cross-rates (pegged currencies). | ✓ |
| Single commercial provider | One paid API for all currencies. | |
| You decide | Claude picks | |

**User's choice:** ECB + supplementary for Gulf
**Notes:** AED and SAR are pegged to USD, making cross-rate derivation reliable.

| Option | Description | Selected |
|--------|-------------|----------|
| DB table + daily cron | ExchangeRate Prisma table. QStash daily fetch. Auditable. | ✓ |
| Cache-only (Redis) | Redis with TTL. Lighter but no historical rates. | |
| You decide | Claude picks | |

**User's choice:** DB table + daily cron

---

## Currency Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Default PLN, configurable | Migration sets existing orgs to PLN. New field configurable. | |
| Require explicit selection | Force admins to confirm on next login. | |
| You decide | Claude picks | |

**User's choice:** Other — "There are no orgs in the DB currently, dont worry about migration, but add homeCurrency so admin can change the currency in settings/during the setup"
**Notes:** No data migration needed. Just add homeCurrency field to Organization model.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-record currency field | Each invoice/contract/payment stores own currency. Overridable. | ✓ |
| Inherit from org only | All financials in org's home currency. | |
| You decide | Claude picks | |

**User's choice:** Per-record currency field
**Notes:** Real-world orgs deal in multiple currencies. Default to homeCurrency but overridable.

---

## Claude's Discretion

- Payment format auto-detection (SEPA vs SWIFT)
- ExchangeRate table schema details
- Dinero.js integration patterns and utility location
- Purpose code lookup table structure
- paymentExportFormatEnum extension

## Deferred Ideas

None — discussion stayed within phase scope.
