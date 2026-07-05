# 98-08 SUMMARY — 7 net-new reads (all 9 entities readable)

**Wave:** 4 · **Status:** done

## Model mapping (verified against Prisma schema)
| Public entity | Prisma model | Scope | Notes |
|---|---|---|---|
| payments | `PaymentRunItem` | payment:read | one contractor payout line |
| payment_runs | `PaymentRun` | payment:read | |
| workflows | `WorkflowRun` | workflow:read | |
| workflow_tasks | `WorkflowTaskRun` | workflow:read | |
| classifications | `ClassificationAssessment` | classification:read | READ-ONLY; raw answers/outcome NOT exposed |
| compliance_documents | `ClassificationDocument` | document:read | metadata only |
| audit_log | `AuditLog` | auditLog:read | list-only; PII-aware select (no actorId/name/ip/UA/metadata) |

None of these models have `deletedAt` (append-only) — the `where` is `{organizationId}` only.

## What landed
- **7 tRPC read sub-routers** copying the 98-07 cursor template (`cursorClause` +
  `paginateByLastKeptUndefined` + `publicOrderBy`), each with its read scope + org-scoped `where` +
  conservative `select`. `getById` on the 6 entity routers; `audit` is list-only.
- **validators**: 7 cursor+filter/sort `.strict()` DTOs (filter VALUES are `z.string()` for the 0.x
  surface — field set still allowlisted; enum-tighten before SDK 1.0).
- **publicApiRouter** composes all 7; **app.ts** mounts the 7 new Hono `createRoute` routes.
- **7 Hono routes** with typed, named response item schemas (`PublicPayment`, `PublicWorkflow`,
  `PublicAuditLogEntry`, …) — all 9 entities now appear in the derived 3.1 spec.
- **tenant-isolation.security.test** turned GREEN: 15 tests regression-lock that every net-new list
  `findMany` and getById `findFirst` carries `organizationId: ORG_A`, cross-org getById → NOT_FOUND,
  and classification/audit expose only read procedures (`_def.procedures` = list/getById).

## Verify
- `pnpm --filter @contractor-ops/api test public-api` — 80 passed / 15 skipped (tenant-isolation green;
  write-scope live matrix + flag write-half remain HOLD-until-98-09).
- `pnpm --filter @contractor-ops/public-api test` — 100 passed; `openapi-doc` now GREEN (all 9 read
  paths present, ZERO write ops, 3.1). Only `strict-dto` remains RED → 98-09 write DTOs.
- `pnpm typecheck` api+validators+public-api — clean (16 tasks).
