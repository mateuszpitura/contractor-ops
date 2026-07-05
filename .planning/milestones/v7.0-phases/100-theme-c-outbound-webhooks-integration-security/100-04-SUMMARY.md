# 100-04 SUMMARY — PII redactor (redact-before-persist)

**Wave:** 1 · **Status:** complete · `webhook-redact.security.test.ts` GREEN (6/6); api typecheck clean.

## What shipped

- `packages/api/src/services/webhooks/redact.ts`:
  - `redactPii(payload, { includePii })` — pure, deep, returns a CLONE (never mutates). When `includePii`
    is false (default) every value under a PII key becomes `'[redacted]'`, recursing objects + arrays;
    when true the clone is unchanged.
  - `WEBHOOK_PII_KEYS` — the derived key-set, exported for the OWASP-gate assertions.

## Key-set derivation (not a hardcoded guess)

Anchored to the real field inventory: a curated set of national-person identifiers that live in dedicated
ENCRYPTED columns and so appear in no schema (pesel/ssn/iqama/emiratesId/nationalId per us-validators,
legal/compliance-ksa, legal/compliance-uae), unioned with the RBAC-gated identifier keys **reflected out of
`employeeCountryFieldsSchemaMap`** (steuerIdNr/svNummer/niNumber/gosiNumber — so a rename there is
auto-picked-up), plus bank + contact PII (iban/bankAccount/email/phone) and suffix patterns (`*IdNr`, `*ssn`,
`*iqama`, `*emirates`, `*passport`). Applied by the fan-out handler (100-06) BEFORE the snapshot persists, so
no PII sits in a deliverable or dead-letter row.

## Verify

`pnpm --filter @contractor-ops/api test webhook-redact` → 6/6 GREEN. `pnpm --filter @contractor-ops/api typecheck` → clean.
