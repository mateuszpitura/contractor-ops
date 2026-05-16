# N+1 Audit — Top-10 tRPC procedures

**Goal:** awareness baseline before any remediation pass. Static-analysis
sweep of the procedures the dashboard hot path hits hardest, looking for
classic N+1 shapes (per-row `findUnique`/`findFirst` in `.map(async ...)`,
missing `include`/`select` for accessed relations, duplicate reads of the
same row).

**Method:** read each procedure end-to-end; classify as `ok` /
`to-fix` / `fixed`. `ok` = single fan-out query or batched lookup;
`to-fix` = confirmed N+1 or unnecessary serial round-trip; `fixed` = was
N+1 in an earlier audit, now batched. No Prisma query-log capture in
this pass; that is the next iteration's job.

**Phase:** C.7.c (production-hardening). **Last reviewed:** 2026-05-16.

| # | Procedure | File:line | Status | Notes |
|---|---|---|---|---|
| 1 | `dashboard.kpis` | `packages/api/src/routers/core/dashboard.ts:313` | **fixed** | F-SCALE-06 — single `fetchKpis` aggregate, served from `cachedSingleflight` with a 5 s burst-collapse + `readReplica(region, ...)`. No relation fan-out; consolidated FILTER aggregate. |
| 2 | `contractor.list` | `packages/api/src/routers/core/contractor.ts:386` | **ok** | Single `findMany` + `count` in parallel. Relations (`owner`, `primaryTeam`, default `billingProfile`) all batched via `include`. Compliance pending counts come from one `groupBy({ by: ['contractorId'], ... in: contractorIds })` after the page — no per-row query. |
| 3 | `contract.list` | `packages/api/src/routers/core/contract.ts:406` | **ok** | Single `findMany` + `count` in parallel. `contractor` and `internalOwner` batched via `include`. FTS pre-filter uses one `$queryRaw` against the `searchVector`. |
| 4 | `invoice.list` | `packages/api/src/routers/finance/invoice.ts:642` | **ok** | Single `findMany` + `count`. `contractor` + `eInvoiceLifecycle` via `include`. Search uses Prisma `OR` (one query) instead of a per-row `findFirst`. |
| 5 | `payment.list` | `packages/api/src/routers/finance/payment.ts:638` | **ok** | Cursor-paged `findMany` with `_count.items` via `include`. No relation fan-out; activityDates is a separate single `$queryRaw`. |
| 6 | `approval.listPending` | `packages/api/src/routers/core/approval.ts:652` | **ok** | Steps fetched in one query with `approvalStepQueueInclude`. Invoice enrichment batched via `invoice.findMany({ where: { id: { in: invoiceIds } } })`; chain configs batched via `approvalChainConfig.findMany({ where: { id: { in: chainConfigIds } } })`. The "sort by amount" branch uses a single raw SQL pre-filter to get IDs, then one `findMany({ id: { in: ids } })` — no N+1. |
| 7 | `equipment.list` | `packages/api/src/routers/equipment/equipment.ts:45` | **ok** | Single `findMany` + `count`. `assignments` (take 1, current only) + nested `contractor` batched via `include`. |
| 8 | `workflow.listRuns` | `packages/api/src/routers/workflow/workflow-execution.ts:763` | **ok** | Single `findMany` + `count`. `workflowTemplate`, `contractor`, `tasks` (status + resultJson only) batched via `include`. Progress is computed in JS over the embedded tasks — no extra round-trip. |
| 9 | `settings.get` | `packages/api/src/routers/core/settings.ts:25` | **ok** | Read-through `cached(...)` envelope wraps a single `authApi.getFullOrganization(...)` call. Better Auth handles the join internally. |
| 10 | `notification.list` | `packages/api/src/routers/core/notification.ts:34` | **ok** | Single `findMany` + capped `count` (`take: 10_000`) in parallel. No relations included — list rendering uses only fields on `Notification`. |

## Aggregate findings

- **0 confirmed N+1 patterns** in the top-10 dashboard-hot-path procedures
  as of 2026-05-16. Earlier audits (`dashboard.kpis` per F-SCALE-06,
  `approval.listPending` per the per-step invoice/chain-config batching)
  have already remediated the obvious cases.
- The remaining latency cost on these procedures lives in
  - **Postgres-side query planning** for FTS + multi-filter `where`
    clauses on `Contractor`/`Contract`/`Invoice` — index review is the
    follow-up, not query restructuring.
  - **Cross-region replica lag** for `dashboard.kpis` only (1 of 10
    procedures uses `readReplica`). Rollout criteria for routing more
    procedures through the replica lives in `docs/INFRA-RECOMMENDATIONS.md`.

## Out of scope

- Per-procedure latency measurement with a Prisma query log against a
  realistic dataset. The plan in `goals/production-hardening/plan.md`
  C.7.c calls this out as the follow-up iteration; this baseline is a
  static-analysis read.
- Mutation procedures (e.g. invoice approval bulk paths, payment-run
  lock-and-export). Those run far less often per request than the list
  procedures and have their own performance characteristics (transaction
  scoping, advisory locks); a separate audit will cover them.
- Background jobs (`packages/api/src/services/*-sync.ts`,
  `reminders`/`reaper` cron paths). Per-tick query counts matter for
  cost, not for tail latency; covered under a future cron-cost audit.

## How to extend

When adding a new high-traffic procedure (anything that runs on dashboard
nav or on table pagination), add a row to the table above with one of
`ok` / `to-fix` / `fixed` and a one-line rationale citing the file and
the line of the procedure's `findMany`/`groupBy`/`$queryRaw` call. The
goal of this doc is fast triage for the next reviewer, not exhaustive
profiling.
