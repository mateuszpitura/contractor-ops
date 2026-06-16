---
phase: 85-theme-a-w-form-intake-tax-treaty-engine
plan: 01
subsystem: tax / treaty-engine
status: complete
tags: [prisma, schema, seed, withholding-tax, w-form, treaty-rate, us-expansion]
requires:
  - "Phase 83 — DataRegion enum widened to {EU, ME, US}"
  - "Phase 84 — US contractor profile fields (ssnEncrypted, ssnLast4, countryCode='US')"
provides:
  - "WithholdingTaxRate.treatyArticle — structured treaty-article column for W-8BEN auto-populate"
  - "TaxFormSubmission model — immutable, supersede-able W-9/W-8BEN/W-8BEN-E record FK'd to Contractor"
  - "TaxFormType + TaxFormStatus enums"
  - "8 US-source business_profits treaty seed rows (PL/DE/GB/IE/NL reduced; AE/SA/XX statutory)"
  - "Regenerated Prisma client carrying TaxFormSubmission + treatyArticle"
affects:
  - "packages/db (schema + seed + generated client)"
  - "Phase 85 plans 02-04 (treaty-rate service, portal/staff routers, wizard UI) typecheck against this client"
  - "Phase 87 (1042-S) reuses the same WithholdingTaxRate row + TaxFormSubmission.treatyRate"
tech-stack:
  added: []
  patterns:
    - "Additive schema extension preserving the existing @@unique key (no breaking migration)"
    - "Immutable record + supersede chain (mirrors WhtCertificate immutability discipline)"
    - "WHT seed rows in whole-number percent units (calculateWht divide-by-100 contract)"
key-files:
  created:
    - "packages/db/src/generated/prisma/client/models/TaxFormSubmission.ts (generated)"
  modified:
    - "packages/db/prisma/schema/tax.prisma"
    - "packages/db/prisma/schema/contractor.prisma"
    - "packages/db/prisma/schema/organization.prisma"
    - "packages/db/prisma/seed/wht-rates.ts"
    - "packages/db/src/generated/prisma/client/* (regenerated)"
decisions:
  - "D-01/D-02: extended WithholdingTaxRate with a single nullable treatyArticle column rather than a new US table; reused serviceType as the income-type axis ('business_profits') — unique key untouched"
  - "D-03/A6: AE and SA seeded as 30% statutory (treatyRate null) — no US income-tax treaty; only PL/DE/GB/IE/NL reduce to 0% under Article 7"
  - "D-04: US treaty rates/articles annotated as adviser-deferred provisional placeholders"
  - "D-05/D-12: TaxFormSubmission is append-only with a supersede chain, FK'd to Contractor (not Worker — Theme B not built)"
  - "Generated Prisma client is tracked in-repo, so the regeneration is committed alongside the schema/seed"
metrics:
  duration: "~6m"
  completed: "2026-06-16"
  tasks_completed: 3
  tasks_total: 3
  checkpoint_pending: false
---

# Phase 85 Plan 01: W-Form Data Foundation + Treaty-Rate Substrate Summary

Extended `WithholdingTaxRate` with a structured `treatyArticle` column, added the immutable supersede-able `TaxFormSubmission` model (W-9/W-8BEN/W-8BEN-E) FK'd to `Contractor`, and seeded the US-source business-profits treaty rows (PL/DE/GB/IE/NL reduced to 0% under Article 7; AE/SA/XX at the 30% statutory rate). The multi-region Neon migration + DB seed are **held at a human-verify checkpoint** — only `db:generate` + `typecheck` ran.

## What Was Built

### Task 1 — Schema extension + TaxFormSubmission model (commit `93d694699`)
- `WithholdingTaxRate`: added one nullable `treatyArticle String? @db.VarChar(40)` column. The 4-field `@@unique([sourceCountry, contractorResidency, serviceType, effectiveFrom])` key is **unchanged** (Pitfall 1 / T-85-01-01) — verified by grep gate (count = 1). `serviceType` reused as the income-type axis; `treatyReference` free-text retained.
- `TaxFormSubmission` model: immutable record-of-record with `formType` (TaxFormType), `status` (TaxFormStatus, default DRAFT), `snapshotJson`, mirrored treaty claim (`treatyArticle`/`treatyRate`/`contractorResidency`), `signerName`/`signedAt`/`expiresAt`, and a `supersededById @unique` self-relation pair named `"Supersede"`. FK'd to both `Organization` and `Contractor` (D-12 — Contractor, not Worker). Indexes: `[organizationId, contractorId, formType, status]` and `[organizationId, status, expiresAt]`.
- `TaxFormType { W9 W8BEN W8BENE }` + `TaxFormStatus { DRAFT ACTIVE SUPERSEDED }` enums (UPPER_SNAKE).
- Inverse `taxFormSubmissions TaxFormSubmission[]` back-relations on `Contractor` and `Organization`.
- `prisma validate` green.

### Task 2 — US treaty seed rows + client regeneration (commit `98110cae3`)
- 8 `sourceCountry='US'`, `serviceType='business_profits'` rows added to `wht-rates.ts`:
  - **Treaty (treatyRate 0.0, Article 7):** PL, DE, GB, IE, NL.
  - **Statutory (treatyRate null, no US treaty — A6):** AE, SA.
  - **Fallback (treatyRate null → 30% statutory):** XX.
- All rates in whole-number percent (`30.0`/`0.0`/`null`) per the `calculateWht` divide-by-100 contract (Pitfall 3 / T-85-01-04) — grep gate confirmed no fractional rates.
- US block annotated as adviser-deferred provisional rates (D-04) with a domain-meaningful comment, no planning-ID breadcrumbs.
- `seedWhtRates` was already wired in `seed/index.ts:32` — extended in-place, no `index.ts` change.
- Regenerated the typed Prisma client (`TaxFormSubmission` + `treatyArticle` now present); `typecheck --filter @contractor-ops/db` green.

### Task 3 — Migration checkpoint (HELD)
Ran ONLY the non-DB-touching proof commands per the orchestrator constraint:
- `pnpm --filter @contractor-ops/db db:generate` — client regenerated, no DB connection.
- `pnpm typecheck --filter @contractor-ops/db` — green against the regenerated client.

The multi-region migration (EU/ME/US) and DB seed are **NOT run** — held for explicit human approval (see Checkpoint section).

## Deviations from Plan

None — plan executed as written for Tasks 1-2. Task 3 was intentionally held at the migration checkpoint per the orchestrator constraint (human operator approves the live multi-region Neon migration out-of-band).

## Acceptance Criteria

| Criterion | Result |
|-----------|--------|
| `prisma validate` exits 0 | PASS |
| `treatyArticle` on WithholdingTaxRate AND TaxFormSubmission | PASS (tax.prisma L34 + L96) |
| `model TaxFormSubmission` + `enum TaxFormType` + `enum TaxFormStatus` present | PASS |
| `@@unique([sourceCountry, contractorResidency, serviceType, effectiveFrom])` count = 1 | PASS (key unchanged) |
| `taxFormSubmissions` back-relation on Contractor + Organization | PASS |
| New enums pass UPPER_SNAKE casing | PASS (TaxFormType/TaxFormStatus compliant) |
| ≥ 8 US seed rows | PASS (8: PL/DE/GB/IE/NL/AE/SA/XX) |
| ≥ 5 `Article 7` treaty rows | PASS (5) |
| No fractional treaty rates | PASS |
| AE + SA `treatyRate: null` | PASS |
| `typecheck --filter @contractor-ops/db` green | PASS |

## Deferred Issues

- **Pre-existing enum-casing offenders** (out of scope): `db:audit-enum-casing` flags 5 lower_snake values on `enum ManualOverrideCategory` in `idp-deprovisioning.prisma` (Phase 76, file unmodified by this plan). The two new enums added here are compliant. Logged to `deferred-items.md`.

## Checkpoint — RESOLVED (human-approved, applied 2026-06-16)

`prisma migrate dev` was **drift-blocked** as anticipated: the live Neon DB (single `contractor-ops` DB, EU region, seed-data only) was ~6 phases behind local history (Phases 72–77 migrations recorded but never applied), and replaying them through the shadow DB fails (`relation "ContractorComplianceItem" does not exist`) because earlier phases created objects via direct DDL rather than migration files. `migrate dev` and `migrate reset` both hit this wall.

**Path taken (operator-approved):** additive direct-DDL **full-sync** — `prisma migrate diff --from-config-datasource --to-schema ./prisma/schema --script` to generate the live-DB→HEAD delta, then `prisma db execute --file` to apply it. The squashed diff needed two manual corrections before it applied cleanly:
1. **Reorder:** moved `ContractorComplianceItem ADD COLUMN waivedReasonCategory/waivedReasonNote` ahead of the `WaivedReasonCategory` enum-rewrite that alters those columns (Prisma emitted them out of order).
2. **Stripped 3 artifacts:** `ALTER COLUMN "…searchVector…" DROP DEFAULT` on the generated `tsvector` FTS columns (`Contract.searchVector`, `Contractor.search_vector`, `Invoice.search_vector`) — Postgres rejects DROP DEFAULT on generated columns; these are no-op Prisma/generated-column diff artifacts, not real changes.

Applied in two passes (db execute is not fully transactional across a multi-statement file): first pass committed the 5 new enums + the `WaivedReasonCategory` rewrite; second pass applied the additive remainder (12 new tables incl. `TaxFormSubmission`, `WithholdingTaxRate.treatyArticle`, 39 indexes, FK constraints). Post-apply `migrate diff` is empty except the 3 permanent `search_vector DROP DEFAULT` artifacts (un-applicable cosmetic drift). Reference-data seed run via `tsx prisma/seed/index.ts` (`seedTaxRates`+`seedWhtRates`+`seedBoeRates`, idempotent upserts) — US treaty rows present. **NB:** `db:seed:dev` was deliberately NOT used (it `--confirm`-wipes tenant data).

**Outstanding infra debt (NOT phase 85):** the DB schema now matches HEAD, but `_prisma_migrations` still shows Phases 72–77 + this change as un-recorded — the migration history remains out of sync with the actual schema and needs a deliberate reconciliation (`migrate resolve --applied`, or a controlled baseline rebuild) as a separate task. The full-sync applied other phases' schema as a side effect of bringing the single shared DB current, at the operator's explicit direction.

## Self-Check: PASSED

- Schema files modified + committed (`93d694699`).
- Seed code + regenerated client committed (`98110cae3`).
- `prisma validate` green; `typecheck --filter @contractor-ops/db` green.
- Schema applied to the live DB (full-sync direct-DDL); post-apply diff empty (modulo permanent FTS artifacts); reference seed run.
