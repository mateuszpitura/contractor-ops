# Plan 95-01 Summary — HRIS sync pure foundation (field partition + loop-prevention)

**Wave:** 1 · **Status:** complete (GREEN foundation gate)

## What shipped

The I/O-free foundation every downstream HRIS-sync plan imports:

| File | Provides |
|------|----------|
| `packages/api/src/services/hris-sync/types.ts` | `HrisEmployeeRecord`, `HrisFieldMapping`, `HrisSyncState`, `HrisPushPayload`, `HRIS_PROVIDERS` — pure wire/DTO contracts (no Prisma import) |
| `packages/api/src/services/hris-sync/field-partition.ts` | `FieldOwner` + `FIELD_OWNER` map, the `HrisWritableEmployeePatch` allowlist type, `projectToWritablePatch()`, `assertNotHrisOwnedField()` |
| `packages/api/src/services/hris-sync/sync-hash.ts` | deterministic key-order-independent `syncHash()` (SHA-256) + `ChangeOrigin` tag |

## The crux (SYNC-05 + loop-break)

- `HrisWritableEmployeePatch` has EXACTLY `displayName`, `email`, `employmentStatus`, `etat`, `hireDate`, `terminatedAt`, `countryFieldsPatch`. No `invoice`/`payment`/`classification`/`compliance` key; no `*Encrypted`/`*Last4` national-ID key; no `organizationId`/`workerId`. Protected fields are **physically absent from the type**, so a pull's Prisma update payload cannot carry them.
- `projectToWritablePatch` drops (never throws on) any HRIS attribute a mapping points at a protected/unknown target. `countryFieldsPatch` keys are filtered against a token denylist (`pesel`/`ssn`/`iqama`/`emirates`/`encrypted`/`last4`/`invoice`/`payment`/`classification`/`compliance`/`salary`/`rate`) — a hostile mapping of an HRIS attr to `peselLast4`/`invoiceAmount` is dropped.
- `syncHash` uses a recursive stable-key-order serialization so a reordered snapshot hashes equal → the pull skips the write (idempotency primitive).
- `assertNotHrisOwnedField` throws if a push payload ever carries an HRIS-owned key (defense-in-depth change-origin guard against a future co-owned field re-introducing a loop).

## Verification

- `pnpm -F @contractor-ops/api test field-partition sync-hash` → 13 passed (2 files). Pure modules, no DB.
- `pnpm --filter @contractor-ops/db build` + `pnpm typecheck --filter=@contractor-ops/api` → green.
- `pnpm standards:check` green. `lint:no-breadcrumbs`: zero breadcrumbs in the new files (pre-existing repo breadcrumbs in webhooks/validators are unrelated to this change set).

## Notes

- `HrisPushPayload` is a discriminated union (`kind: invoice-paid | payment-status | classification-outcome`), each carrying `workerId` + business ids — never an HRIS-owned key by construction. This is what makes `assertNotHrisOwnedField` pass for legitimate payloads.
