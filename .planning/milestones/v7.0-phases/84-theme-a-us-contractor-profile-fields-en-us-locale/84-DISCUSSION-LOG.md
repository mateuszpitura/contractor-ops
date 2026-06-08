# Phase 84: Theme A — US Contractor Profile Fields + en-US Locale - Discussion Log

> **Audit trail only.** Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 84-theme-a-us-contractor-profile-fields-en-us-locale
**Areas discussed:** SSN storage + display masking + RBAC, USPS address validation behavior, en-US locale strategy, EIN/SSN validation strictness

---

## SSN storage + display masking + RBAC

| Option | Description | Selected |
|--------|-------------|----------|
| Encrypt-at-rest + last4 + gated reveal | SSN encrypted (AES-256-GCM) + plain ssnLast4; full only via audit-logged reveal gated by CONTRACTOR_PII:READ (owner+admin+finance). EIN plain + log-masked. | ✓ |
| Plain column + RBAC-gated reveal | SSN plain like UTR/Steuernummer, last4-default + RBAC reveal, no at-rest encryption. | |

**User's choice:** Encrypt-at-rest + last4 + gated reveal (recommended).
**Notes:** SSN gets stronger handling than UTR/Steuernummer due to identity-theft sensitivity. CONTRACTOR_PII:READ default = owner+admin+finance (1099 generation needs it).

---

## USPS address validation behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Advisory + unverified-flag, non-blocking | Normalize on save, verified/unverified flag, never block; USPS down/throttle → accept unverified, re-validate later. | ✓ |
| Hard-reject non-CASS | Block save until CASS-validated — brittle on a 60/hr-throttled external API. | |

**User's choice:** Advisory + unverified-flag, non-blocking (recommended).
**Notes:** Throttle/cache mechanics (OAuth2, 60/hr, no-batch) deferred to plan-phase per research flag.

---

## en-US locale strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Thin override + en-US→en fallback | en-US.json only divergent keys + i18next fallbackLng map en-US→en→pl; teach i18n:parity gate fallback-parity. | ✓ |
| Full duplicate en-US.json | Complete duplicate at literal parity — doubles maintenance + drifts. | |

**User's choice:** Thin override + en-US→en fallback (recommended).
**Notes:** Effective full parity via fallback; new en keys auto-inherit. Add en-US to SUPPORTED_LOCALES + localeMeta.

---

## EIN/SSN validation strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Format + IRS prefix / invalid-range tables | EIN format + IRS prefix table; SSN format + invalid-range rejection. Matches v5.0 validator rigor. | ✓ |
| Format-only | Just the shape, no tables — weaker than UK/DE validators. | |

**User's choice:** Format + IRS prefix / invalid-range tables (recommended).
**Notes:** In packages/validators/us-validators.ts + usCountryFieldsSchema. Prefix-table accuracy legal-adviser-deferred.

---

## Claude's Discretion

- Field-encryption util + key management for the SSN column (reuse existing AES-256-GCM helper).
- Initial divergent-key set in en-US.json (planner derives from en).
- USPS throttle/cache implementation (token bucket / Redis) — plan-phase.

## Deferred Ideas

- US tax-treaty table + W-8BEN auto-populate (US-LOC-02/03) — Phase 85.
- USPS batch validation — API is no-batch.
- IRS-prefix-table / SSN-range legal verification — deferred.
- Full 50-state address rules — CASS normalize only.
