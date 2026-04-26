# `pnpm lint:schema` — remediation guide

Phase 70 D-03 — multi-tenant Prisma schema guard. Fails the PR when a Prisma
model is added without an `organizationId String` field, and the model name
is not present in the typed allowlist `GLOBAL_LOOKUP_MODELS_ALLOWLIST`.

## <a name="missing-organization-id"></a>FAIL: model X missing organizationId

The CI guard `pnpm lint:schema` failed because a model declares scalar fields
but has no `organizationId String` field, and is not in
`packages/lint-guards/src/schema-guard/global-lookup-allowlist.ts`.

### Symptom

```
[lint:schema] FAIL: 1 multi-tenant model(s) missing organizationId

  offending:   model SecretLeak
  file:        packages/db/prisma/schema/billing.prisma:42
  expected:    field "organizationId String" OR add "SecretLeak" to GLOBAL_LOOKUP_MODELS_ALLOWLIST
  remediation: docs/lint-remediation/lint-schema.md#missing-organization-id
```

### Root cause (PITFALLS P27)

A new model was added without per-tenant scoping. Without `organizationId`
every Prisma query returns rows from every customer organization — a direct
cross-tenant data leak. The recovery cost is CRITICAL: the offending data
must be re-keyed offline, every customer must be notified, and depending on
jurisdiction (UK GDPR, DSGVO, FADP) regulator notification windows are 72 h.

### Fix (option A — most common)

Add `organizationId` and an FK to `Organization`:

```prisma
model SecretLeak {
  id              String       @id @default(cuid())
  organizationId  String
  // ... other fields
  organization    Organization @relation(fields: [organizationId], references: [id])
  @@index([organizationId])
}
```

Re-run `pnpm lint:schema` — clean.

### Fix (option B — global lookup table)

If the model is genuinely tenant-agnostic (country codes, FX rates,
cron-dedup keys, etc.), add it to the allowlist with a one-line
`reason:` comment.

See [`#allowlisting-a-global-lookup-model`](#allowlisting-a-global-lookup-model).

## <a name="allowlisting-a-global-lookup-model"></a>Allowlisting a global-lookup model

Open `packages/lint-guards/src/schema-guard/global-lookup-allowlist.ts`. Add
an entry:

```ts
export const GLOBAL_LOOKUP_MODELS_ALLOWLIST = [
  // ...
  'YourNewLookupTable',  // reason: <one-sentence justification — what makes this tenant-agnostic>
] as const satisfies readonly string[];
```

Code review on the constant change is the human gate. Allowlist edits
should be rare — most models genuinely belong to a tenant.

### Allowlist categories that already exist

The current allowlist groups entries by category:
- **Global reference data** — `ExchangeRate`, `BoEBaseRateHistory`, `TaxRate`, `WithholdingTaxRate`
- **Tenant root** — `Organization` (the row that other rows point to)
- **Auth identity** — `User`, `Session`, `Account`, `Verification` (Better Auth)
- **System / cron / dedup** — `StripeEvent`, `CronScanState`, `NotificationCronDedup`, `PortalMagicToken`
- **Junction / relation tables** — `ContractorTagLink`, `SigningRecipient` (scoped via parent FK)

If your new model fits one of these categories, add it next to its peers and
follow the same `reason:` comment style.
