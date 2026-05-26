# Facts — seed-dev batch INSERT optimization

## Scope

- The entire `packages/db/scripts/seed-dev.ts` file is in scope; every per-row `prisma.X.create()` inside a loop is converted to chunked `prisma.X.createMany({ data, skipDuplicates: true })`.
- All ~101 current `.create()` call sites are reviewed; calls inside loops are batched, calls that are intentionally one-shot (e.g. `prisma.organization.create({ data: { ..., members: { create: [...] } } })`) stay as nested `create` because the nested-create is already a single round-trip.
- The 15 existing `createMany` call sites are preserved; only their chunk size is normalized to 1000 if currently different and the wider table makes that safe.
- Sibling script `packages/db/scripts/seed-qa-fixtures.ts` is untouched; nothing outside `packages/db/scripts/` is touched.

## Non-goals

- The Prisma schema is not modified. No migrations are added.
- The CLI surface is preserved exactly: `--profile`, `--seed`, `--omit`, `--confirm`, `--no-progress`, `--help` all behave identically.
- The set of seed sections that fire for each profile is unchanged; no section is added, removed, renamed, or silently skipped.
- The new `qa` profile branch in `buildOrgs` is left as-is.
- `seed-qa-fixtures.ts`, `apps/landing/`, and `goals/qa-walk-and-fix/` are not touched.

## Performance target

- Wall-clock time of `pnpm seed:qa` against Neon drops from the documented ~60 minute baseline to under 5 minutes.
- Wall-clock time of `pnpm -F @contractor-ops/db exec tsx scripts/seed-dev.ts --profile=showcase --confirm --seed=4242 --no-progress` improves materially (single-digit minutes or less); the showcase profile is the gate profile in the verification checklist.
- The improvement comes from reducing Neon HTTP round-trip count, not from skipping work; CPU usage during the seed may rise correspondingly.

## Chunking strategy

- Each batched insert site uses an inline `for (let i = 0; i < rows.length; i += 1000) { await prisma.X.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true }); }` pattern; no shared helper is introduced.
- The default chunk size is 1000 rows per `createMany`; sites with very wide rows (more than ~50 columns) drop to 500 to stay comfortably under the Postgres 65535 bind-parameter ceiling.
- Each `createMany` call runs in its own implicit transaction; no batch is held longer than ~5 seconds wall time on Neon under stress profiles.
- Existing `createMany` chunks of 5000 (e.g. `seedNotifications`, `seedOutbox`, `seedReminders`) are left at 5000 unless review shows they exceed the bind-parameter ceiling.

## ID strategy

- Child rows that need their parent's primary key reference cuids generated in-process before the `createMany` call rather than being recovered with a follow-up `findMany`.
- The cuid generator used is whatever Prisma's `@default(cuid())` calls today via `import { createId } from '@paralleldrive/cuid2'` if already in deps, otherwise via the cuid module Prisma client already pulls in; no new dependency is added.
- For the two models defaulted to `@default(uuid())`, ids are generated with `crypto.randomUUID()`.
- For the small number of models without an id default (composite keys / explicit ids), the existing explicit id construction is preserved.
- Generated ids are non-deterministic across runs; this matches today's behavior because `.create()` also generates cuids server-side.

## Determinism

- The existing `--seed=<n>` flag continues to produce byte-identical Faker output for natural fields: running `--seed=4242 --profile=showcase` twice yields the same first `Contractor.legalName` and the same first `Invoice.invoiceNumber` across both runs.
- Faker draws are not reordered relative to today's loop unless strictly required by batching; any forced reorder is documented inline with a one-line comment near the affected section.
- Primary key cuids are explicitly excluded from determinism guarantees, matching current behavior.

## Idempotency

- Every batched `createMany` passes `skipDuplicates: true` so reruns of the same `--seed` against a populated database do not error on unique-key collisions.
- Sections that today rely on `prisma.X.upsert(...)` keep using `upsert`; they are not converted to `createMany` because upsert semantics do not translate.

## Section logging

- Each seeder function still emits its existing per-section log line (`X seeded`, status banners, tick events) at the same point in the run; log order is preserved.
- Progress-bar ticks (`tracker.tick(orgKey, phase)`) still fire once per section, not once per chunk, so the bar advances at the same granularity as today.
- The `--omit=<sections>` flag continues to skip the same set of sections; nothing fires that today would be omitted, and nothing is omitted that today would fire.

## Showcase coverage

- The showcase profile still forces at least one row of every `InvoiceStatus`, `ApprovalStatus`, and `PaymentStatus` enum value into the seeded data.
- Showcase-specific seed paths that today live alongside loop-based `.create()` calls are preserved when those loops convert to `createMany`.

## Idempotency of multi-batch sections

- When a section's data is built in multiple chunks, every chunk targets the same `tenantId` / parent ids that the loop-based version produced, so cross-batch foreign-key references stay valid.
- Insert order across dependent models is preserved: a child model's `createMany` always runs after its parent model's `createMany` for the same row set (e.g. `ApprovalFlow` → `ApprovalStep` → `ApprovalDecision`).

## Commit shape

- The change ships as multiple atomic local git commits, one per schema-domain folder under `packages/db/prisma/schema/` (invoice, approval, contractor, payment, audit, equipment, notification, compliance, contract, classification, esign, einvoice, exchange-rate, integration, api-key, consent, auth, billing, financial, gov-api, export, and any others touched).
- One preliminary commit normalizes the file's top banner doc-comment to describe the batching behavior.
- No pull request is opened; commits land on the current branch directly.

## Verification gates

- `pnpm -F @contractor-ops/db run typecheck` passes after every commit.
- `pnpm seed:qa` runs end-to-end on Neon in under 5 minutes.
- Row counts after `--profile=showcase --confirm --seed=4242 --no-progress` for `Invoice`, `ApprovalStep`, `PaymentRunItem`, `AuditLog` match the counts the loop-based version would have produced (verified by re-running the unchanged showcase profile on a scratch database before/after, or by row-count formula derived from `VOLUME_TEMPLATES`).
- Two consecutive `--seed=4242 --profile=showcase` runs against fresh databases produce identical first `Contractor.legalName` and first `Invoice.invoiceNumber`.
- Neon slow-query log shows no single statement holding longer than 5 seconds during a `--profile=qa` stress run.
