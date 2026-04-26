# Phase 57: Government API Clients - Discussion Log

> **Audit trail only.** Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 57-government-api-clients
**Areas discussed:** Credential & environment model, Validation storage + freshness, UK/DE VAT rate seeding + default application, Reverse-charge auto-detection rules

---

## Credential & Environment Model

### Q1: HMRC VAT API credential location

| Option | Description | Selected |
|--------|-------------|----------|
| Platform-wide via SecretStore | Single Contractor Ops HMRC app; shared client creds; fraud-prevention headers carry tenant info | ✓ |
| Per-org credentials | Each UK org registers its own HMRC app | |
| Hybrid | Platform default + per-org override | |

**User's choice:** Platform-wide credentials (Recommended)
**Notes:** Avoids forcing every customer through HMRC developer onboarding.

### Q2: VIES endpoint choice

| Option | Description | Selected |
|--------|-------------|----------|
| REST API (unauthenticated) | ec.europa.eu/taxation_customs/vies/rest-api; supports simple + qualified | ✓ |
| SOAP API | Classic VIES SOAP; more tooling surface | |
| Both (SOAP fallback) | REST primary; SOAP backup | |

**User's choice:** REST API (Recommended)
**Notes:** 2026 REST covers qualified confirmations; no SOAP fallback planned.

### Q3: Environment switching

| Option | Description | Selected |
|--------|-------------|----------|
| Env var HMRC_ENV + VIES_ENV | Drives base URL; matches GovApiClient.environment | ✓ |
| Per-org toggle | Each org picks sandbox/prod | |
| Always production | Single env; no sandbox | |

**User's choice:** Env var switching (Recommended)

---

## Validation Storage + Freshness

### Q4: Where validation results live

| Option | Description | Selected |
|--------|-------------|----------|
| TaxIdValidation audit table + profile summary cache | Append-only; denormalized latestVat* on Contractor | ✓ |
| Contractor row only | Simple; loses audit history | |
| Audit log service only | Slow reads; ties to general log | |

**User's choice:** Audit table + summary cache (Recommended)
**Notes:** HMRC/BfDI require proof of validation at point in time.

### Q5: Freshness window

| Option | Description | Selected |
|--------|-------------|----------|
| 90 days + auto-revalidate on invoice gen if stale | Balanced | ✓ |
| 30 days + nightly background refresh | Tight; high API cost | |
| Manual only | Lowest cost; compliance drift risk | |

**User's choice:** 90 days + on-invoice auto-revalidate (Recommended)

### Q6: Re-validation triggers

| Option | Description | Selected |
|--------|-------------|----------|
| On first save + on stale-at-invoice + manual refresh | Three paths cover onboarding/compliance/recovery | ✓ |
| On every save | Wasteful | |
| On demand + nightly only | Delays feedback | |

**User's choice:** Three-trigger model (Recommended)

### Q7: Graceful degradation

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-fail with stale flag | Latest successful result returned with warning | ✓ |
| Hard-block invoice when stale+unavailable | Max safety; breaks on outages | |
| Silent fall-back to local checksum | No signal to user | |

**User's choice:** Soft-fail with stale flag (Recommended)

---

## UK/DE VAT Rate Seeding + Default Application

### Q8: Seeding strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single Prisma seed migration now | GB 20/5/0/RC + DE 19/7/RC/KU in one migration | ✓ |
| Staged (UK first, DE second) | Lower risk; double migration | |
| Admin UI runtime config | Violates Phase 47 D-01 | |

**User's choice:** Single seed migration (Recommended)

### Q9: Default rate lookup

| Option | Description | Selected |
|--------|-------------|----------|
| Country default + per-line override | Pre-fill isDefault; dropdown to override | ✓ |
| No default — user picks every time | Safer; friction | |
| Latest-used per contractor | Smart; error propagation risk | |

**User's choice:** Country default + override (Recommended)

### Q10: Kleinunternehmerregelung handling

| Option | Description | Selected |
|--------|-------------|----------|
| isKleinunternehmer flag → rate='KU' + § 19 UStG footer | Full legal notice; new locked phrase | ✓ |
| Block VAT rate application | No notice | |
| Zod validation only | Error only on submit | |

**User's choice:** Flag + KU rate + § 19 UStG notice (Recommended)
**Notes:** New locked phrase `TAX_KLEINUNTERNEHMER_NOTICE` added to legal/de.ts.

---

## Reverse-Charge Auto-Detection Rules

### Q11: Auto-detect rule set

| Option | Description | Selected |
|--------|-------------|----------|
| Post-Brexit UK + EU B2B + DE §13b | Three rule paths covering cross-border + domestic | ✓ |
| Cross-border only | Skips DE §13b domestic | |
| Manual flag only | Highest user burden | |

**User's choice:** All three rule paths (Recommended)

### Q12: User override behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-flag + toggle with reason prompt | Override logged to audit trail | ✓ |
| Auto-flag, non-negotiable | Blocks legitimate exceptions | |
| Auto-flag, silent toggle | No audit trail | |

**User's choice:** Toggle + reason prompt (Recommended)

### Q13: Reverse-charge label placement

| Option | Description | Selected |
|--------|-------------|----------|
| Both line + footer | Line RC marker + full phrase in footer | ✓ |
| Footer only | Lower visibility | |
| Line only | Fails German legal requirement | |

**User's choice:** Line + footer (Recommended)
**Notes:** DE uses `TAX_STEUERSCHULDNERSCHAFT` (Phase 56 D-05); UK adds new locked phrase `TAX_UK_REVERSE_CHARGE_NOTICE` in `legal/en.ts`.

---

## Claude's Discretion

- HMRC OAuth 2.0 client registration (one-time dev/ops setup)
- Exact HMRC fraud-prevention header composition
- VIES requesterNumber source
- Rate-limit tuning per endpoint
- TaxIdValidation index strategy
- Stale summary TTL
- §13b serviceType enum encoding
- Override reason prompt copy
- Background retry strategy

## Deferred Ideas

- Periodic background revalidation — future phase
- HMRC MTD submission — post-v5.0
- VIES SOAP fallback — only if REST proves unstable
- Automatic Kleinunternehmer detection from turnover — out of scope
- Per-org HMRC credentials — enterprise need, revisit later
- §13b serviceType expansion — add as customers request
- Storage of HMRC "registered company name" — Phase 61 consideration
