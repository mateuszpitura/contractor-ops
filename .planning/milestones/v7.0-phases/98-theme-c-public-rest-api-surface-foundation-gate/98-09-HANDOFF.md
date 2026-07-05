# 98-09 / 98-10 HANDOFF — write half blocked on an actor-model decision

**Status:** NOT STARTED. Stream 3 stopped after 98-08 (all 9 reads live + in the 3.1 spec). The write
half hit a genuine design blocker that 98-09's premise underestimated.

## The blocker (verified in the Prisma schema + internal mutations)
98-09's premise was: "the ONLY session-coupling swapped is the audit actor (`ctx.user.id`/'USER' →
`ctx.apiKeyId`/'API_KEY')." That holds for writes that mutate an EXISTING row, but NOT for the
**creation pipelines**, which write a **non-null user foreign key** that the API-key context cannot
supply (there is no `ctx.user` on `apiKeyTenantProcedure` — only `ctx.apiKeyId`):

| Write | Required user FK / reason | Source |
|---|---|---|
| `paymentRun.create` | `PaymentRun.createdByUserId String` (non-null) set to `ctx.user.id` | `finance/payment-core.ts:175` |
| `payment.create` | payments (PaymentRunItem) are seeded BY run creation, not standalone | `payment-shared.ts` `seedRunItems` |
| `workflow.create` / `execute` | `WorkflowRun.startedByUserId String` (non-null) | `db/prisma/schema/workflow.prisma` |
| `complianceDocument.create` | `ClassificationDocument` requires `sha256Hash`/`byteSize` — a **system-generated** artifact from the classification engine, not an external-consumer create; `doc-link-service.attachDocLink` links WORKFLOW_TASK_RUN docs, not compliance docs | `classification.prisma`, `services/doc-link-service.ts:87` |

A real `User` FK cannot be faked (FK constraint), and inventing a synthetic per-org "API user" is a
cross-cutting decision that affects audit/attribution across the product — it belongs to **Phase 99**
(which owns key management + the API-key actor model), mirroring RESEARCH A7 (payout-init deferred for
the same `userId` coupling). Rushing a synthetic-user hack for money-affecting payment-run creation
violates the binding money-code / quality-over-time standards, so it was NOT done.

## What IS cleanly implementable now (recommended first slice — the "on-existing-row" writes)
These need only the audit-actor swap (API_KEY) and reuse the invariant helpers the plan highlights.
Each carries a mandatory `requirePermission`, a `.strict()` DTO (no organizationId/workerType/money),
org-from-key, and `writeAuditLog({actorType:'API_KEY', actorId: ctx.apiKeyId})` in a transaction:

- `contractor.create` / `contractor.update` — Contractor has no required user FK (`ownerUserId` is
  optional); direct Prisma with an explicit writable-field allowlist.
- `invoice.void` (`invoice:update`) — mirror `finance/invoice-actions.ts:19` (status→VOID + cancel
  approvalStep/approvalFlow); no user FK.
- `paymentRun.transition` (`payment:update`) — `VALID_TRANSITIONS` guard + status update +
  `autoCompleteRunIfTerminal` (mirror `payment-run-ops.ts` cancel/markAllPaid).
- `payment.update` (`payment:update`) — PaymentRunItem status update (mirror `payment-run-ops.ts`
  markItemPaid) + `autoCompleteRunIfTerminal`.
- `workflowTask.transition` (`workflow:update`) — `validateTransition` +
  `unblockDependentsAndRecomputeRun` (`completedByUserId` is optional → null for API_KEY).

## Test wiring already in place (needs adjustment when writes land)
- `packages/api/src/__tests__/security/public-api-write-scope.security.test.ts` — `WRITE_SCOPE_MATRIX`
  (14 entries) + a `describe.skip('HOLD-until-98-09')` live-403 block. When implementing, split the
  matrix into DELIVERED vs DEFERRED (mark the four creates deferred) and un-skip the delivered rows.
- `apps/public-api/src/__tests__/strict-dto.test.ts` — asserts `publicApiContractorCreateInputSchema`
  + `publicApiInvoiceCreateInputSchema` reject org/workerType/money. Note: an invoice's amounts are
  legitimate content, so the money-rejection assertion belongs on the **payment_run** create DTO (money
  server-derived), not invoice. Repoint the money assertion to contractor (org/workerType) +
  paymentRun (server-derived money) when authoring the DTOs.
- `packages/api/src/__tests__/security/public-api-flag.security.test.ts` — write-half `describe.skip`
  HOLD to un-skip.

## 98-10 (hidden write routes)
Depends on 98-09. Add `hide:true` POST/PATCH `createRoute`s only for the DELIVERED writes; they
inherit the flag gate (double-dark). `write-routes-dark.test.ts` still applies.
