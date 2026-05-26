# Goal — seed-dev batch INSERT optimization

Optimize the entire `packages/db/scripts/seed-dev.ts` script (~7640 lines, all profiles: `empty | solo | small | medium | huge | showcase | all | qa`) by converting every per-row `prisma.X.create()` call inside a loop to a chunked `prisma.X.createMany({ data, skipDuplicates: true })`, so the Neon HTTP round-trip count drops from O(rows) to O(rows / 1000). The CLI surface, schema, profile shape, omit-section gating, deterministic Faker semantics (`--seed`), and showcase enum coverage are all preserved exactly. Ships as one atomic local commit per schema-domain folder, no PR.

## Shared understanding

See [`facts.md`](./facts.md) for the testable facts that define done.

## Execution plan

See [`plan.md`](./plan.md) for the ordered commit sequence, per-commit verification commands, and risks.

## Done when

- `pnpm seed:qa` runs end-to-end against Neon in under 5 minutes wall-clock.
- `pnpm -F @contractor-ops/db run typecheck` passes after every commit.
- Row counts for `Invoice`, `ApprovalStep`, `PaymentRunItem`, `AuditLog` produced by `--profile=showcase --confirm --seed=4242 --no-progress` match the counts the loop-based version produced (formula-derived from `VOLUME_TEMPLATES`).
- Two consecutive `--seed=4242 --profile=showcase` runs against fresh databases yield identical first `Contractor.legalName` and identical first `Invoice.invoiceNumber`.
- Showcase org still contains at least one row of every `InvoiceStatus`, `ApprovalStatus`, `PaymentStatus` enum value.
- Neon slow-query log shows no single statement holding longer than 5 seconds during a `--profile=qa` stress run.
- All commits land on the current branch; no pull request opened; nothing outside `packages/db/scripts/seed-dev.ts` is modified.
