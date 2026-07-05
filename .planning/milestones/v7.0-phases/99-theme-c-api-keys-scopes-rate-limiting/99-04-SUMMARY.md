# 99-04 SUMMARY — the 6 public WRITE entities (double-dark)

**Wave:** 2 · **Status:** done

## What landed
The write half Phase 98 deferred — 11 mutation procedures across 6 entities under
`apiKeyTenantProcedure`, each carrying a **mandatory `requirePermission` scope** (BFLA), a `.strict()`
DTO, org-from-key, an actor-attributed FK where required, and a uniform `API_KEY` audit with
`sourceIp`/`userAgent`/`metadata.actingUserId`. Business rules are reused, never reimplemented.

| Entity | Verbs | Scope(s) | Reuse |
|--------|-------|----------|-------|
| contractors | create, update | contractor:create/update | mirrors the internal worker+contractor+billing-profile invariant; ownerUserId = actingUserId |
| invoices | create, void | invoice:create/update | `computeDuplicateCheckHash`; void mirrors invoice-actions (status VOID + cancel approval steps/flows) |
| payments | update | payment:update | PaymentRunItem status + invoice sync + `autoCompleteRunIfTerminal` |
| payment_runs | create, transition, export | payment:create/update/export | payment-shared: loadEligibleInvoices/validateInvoicesForRun/groupInvoicesByCurrency/allocateRunNumber/seedRunItems/VALID_TRANSITIONS/_buildExportItems/_resolveOrgBankInfo/_generateExportFileForFormat; **createdByUserId = actingUserId** |
| workflows | create, execute | workflow:create/execute | workflow-execution-shared instantiateTaskRuns/computeMaxDueDate + calculateProgress; **startedByUserId = actingUserId** |
| workflow_tasks | transition | workflow:update | workflow-shared validateTransition + unblockDependentsAndRecomputeRun (DONE/SKIPPED) |

- **`write-shared.ts`** — single `writePublicApiAudit` path: `actorType:'API_KEY'` + `actorId`(apiKeyId)
  + `ipAddress`(sourceIp) + `userAgent` + `metadata.actingUserId`. Uses `writeAuditLog` (no direct
  `auditLog.create`).
- **`.strict()` write DTOs** in `@contractor-ops/validators/public-api` omit `organizationId`/`workerType`;
  paymentRun money is server-derived (DTO omits it). Money on invoices is legitimate client content.
- Double-dark by construction: writes inherit the per-org flag gate + tier quota; NO Hono route yet
  (99-06); the flag flip is Phase 100. `_initiatePayoutForRun` NOT exposed. `compliance_document.create`
  DEFERRED (no procedure).

## Correction to research
- `Invoice` has **no** `createdByUserId` column (99-RESEARCH A1 was inaccurate) — invoice.create needs no
  actor FK. `Invoice.status` has no `DRAFT` value; a fresh public invoice uses `source: 'API'` and the
  default status. `description` maps to `Invoice.notes`.

## Tests (all GREEN)
- `public-api-write-scope` live BFLA 403 matrix (11 delivered rows: 403 without scope, not-403 with) +
  DEFERRED rows skipped.
- `strict-dto` (mass-assignment), `public-api-mutation-audit` (apiKeyId+sourceIp+userAgent per entity),
  `api-key-actor` FK-on-create (startedByUserId/createdByUserId = actingUserId + audit metadata),
  `public-api-flag` write-half (dark 404). Actor/mutation-audit mocks enriched to drive the real
  procedures to their audit call.
- No regression: public-api app (103), validators (1007), api-key router (9), audit-log lint OK.

## Verification
- `pnpm typecheck --filter @contractor-ops/api --filter @contractor-ops/validators --filter @contractor-ops/public-api --filter @contractor-ops/db` clean (db rebuilt).
