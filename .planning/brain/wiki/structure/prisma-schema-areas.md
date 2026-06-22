---
title: Prisma schema areas
type: structure
tags: [structure, database, prisma]
source_commit: cbe299a91a59179244c0085ea8c65dbf40ab654c
verify_with:
  - packages/db/prisma/schema/
  - packages/db/src/region.ts
  - packages/db/prisma/schema/worker.prisma
  - packages/db/src/worker-type.ts
updated: 2026-06-22
---

# Prisma schema areas

## Purpose

PostgreSQL 17 schema split across files in `packages/db/prisma/schema/`. Multi-region routing via `DATABASE_URL_EU` / `_ME`.

## Entry points

| Area | Typical files | Domain |
|------|---------------|--------|
| Core org/users | `schema.prisma` + org models | [[domains/settings-and-org-admin]] |
| Financial | `financial.prisma` | [[domains/invoice-to-payment]] |
| Compliance | compliance-related models | [[domains/compliance-dashboard]] |
| Time tracking | `time-tracking.prisma` | [[domains/time-and-reconciliation]] |
| E-invoice | `einvoice.prisma` | [[integrations/einvoice-profiles]] |
| Equipment | equipment models | [[domains/equipment-logistics]] |
| Tax / WHT / treaty | `tax.prisma` — `WithholdingTaxRate` (shared rate table; `treatyArticle` column drives US treaty auto-populate), `WhtCertificate`, `TaxFormSubmission` (append-only, supersede-chained W-9/W-8BEN/W-8BEN-E record FK'd to `Contractor`) | [[domains/tax-and-wht]], [[domains/us-tax-forms]] |
| Worker model | `worker.prisma` — `Worker` identity root (`organizationId`, `workerType WorkerType @default(CONTRACTOR)`, shared `displayName`/`email`/`status`, soft-delete; tenant-owning, NOT in `globalModels`) + `WorkerType` enum; `Contractor.workerId String @unique` 1:1 sidecar FK (`Contractor.id` unchanged). Two-step additive ordering: nullable column + table → backfill → NOT NULL + FK | [[domains/worker-foundation]] |

## Flow

```mermaid
flowchart LR
  session[Better Auth session] --> region[org dataHostingRegion]
  region --> eu[DATABASE_URL_EU]
  region --> me[DATABASE_URL_ME]
  eu --> prisma[tenant-scoped Prisma client]
  me --> prisma
```

## Invariants

- Migrations: `packages/db/prisma/schema/migrations/`
- RLS: `packages/db/src/rls.ts` — `withRlsReads`, `withRlsTransactions`
- Tenant client: `createTenantClientFrom` via db tenant extension
- Sensitive mutations: pass `tx` to `writeAuditLog`
- DB-enforced integrity backstops (migration `20260616000000_security_hardening_constraints`): `Contractor` `@@unique([organizationId, taxId])` (taxId nullable → NULLs distinct, un-registered contractors unaffected); `PaymentExport` `@@unique([paymentRunId])` (one export per run); `Invoice` `@@index([organizationId, paymentStatus, paidAt])` for PAID-by-window spend reports
- **AuditLog append-only** (migration `20260617000000_auditlog_append_only`): replaces the over-broad `auditlog_write FOR ALL` policy with INSERT-only (`auditlog_insert`) + a gated DELETE (`auditlog_delete`, permitted only when `app.audit_purge_allowed()` is set via `allowAuditPurge(tx)`) + a `BEFORE UPDATE` trigger (`app.reject_auditlog_update`) that rejects every update. See [[patterns/audit-log]]
- **Worker reads are `workerType`-scoped centrally** — `withWorkerTypeDefault` (`packages/db/src/worker-type.ts`) is chained outermost in the tenant client and injects `workerType='CONTRACTOR'` unless the caller sets it (explicit-where-wins). Its blind spot is raw `FROM "Contractor"` SQL — the 4 known sites are contractor-only-by-table and annotated `// contractor-only-raw-sql:`; `check:contractor-rawsql-workertype` (in `lint:ci`) fails any new unannotated one. See [[domains/worker-foundation]]

## Related

- [[patterns/multi-region-db]]
- [[patterns/tenant-and-audit]]
- [[integrations/neon-r2]]

## Verify live

```bash
ls packages/db/prisma/schema/
semble search "withRlsTransactions"
pnpm typecheck --filter=@contractor-ops/db
```

## Agent mistakes

- Trusting client `organizationId` without session middleware
- Raw SQL without tenant scope — `pnpm lint:raw-sql`
