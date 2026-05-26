# Plan — seed-dev batch INSERT optimization

## Approach

Walk every seeder function in `packages/db/scripts/seed-dev.ts` and, wherever a `for`-loop wraps a `prisma.X.create()` call, replace the loop body with array building plus a chunked `prisma.X.createMany({ data, skipDuplicates: true })`. Where the parent's primary key is needed by a child seeder, pre-compute the cuid (or uuid) in code with the same generator Prisma uses today, so child rows can reference the parent id without a follow-up `findMany`. Keep field values, ordering of Faker draws, and section-level logging identical. Ship as one atomic commit per schema-domain folder against the current branch.

## Pre-work

- Stage one preliminary commit that:
  - Imports `createId` from `@paralleldrive/cuid2` (the package Prisma 7 already depends on transitively; verify via `pnpm why @paralleldrive/cuid2 --filter @contractor-ops/db`) and `randomUUID` from `node:crypto`.
  - Updates the file's top banner doc-comment to note the batching policy: `--profile=qa` now completes in single-digit minutes against Neon because every per-row `.create()` inside a loop has been converted to chunked `createMany` (default chunk = 1000 rows; wide tables use 500).
  - Verification: `pnpm -F @contractor-ops/db run typecheck` passes.

## Commit order

The seed graph has hard FK dependencies (User → Organization → Contractor → Contract → Invoice → ApprovalFlow/Step/Decision → PaymentRun → AuditLog, plus parallel trees for Equipment, Workflow, Esign, Classification, Tax, etc.). Commits land in topological order so any single commit's `pnpm seed:solo --confirm --seed=4242` run is green before the next commit is touched. Each commit references one schema-domain folder under `packages/db/prisma/schema/` and updates only the seeder functions that write to that folder's models.

### Commit 1 — `chore(seed-dev): batch helper conventions + banner update`

- File: `packages/db/scripts/seed-dev.ts`
- Touches: imports + top doc-comment only.
- Verification: `pnpm -F @contractor-ops/db run typecheck`; the script still parses and `--help` still prints.

### Commit 2 — `perf(seed-dev): batch auth-surface seeders`

- Sections: `seedUsersForOrg` (1545), `seedAuthSurface` (6216), `seedPortalSessions` (4131).
- Touches per-loop `prisma.user.create`, `prisma.session.create`, `prisma.account.create`, `prisma.verification.create`, `prisma.oAuthChallenge.create`, `prisma.portalMagicToken.create`. User ids are pre-computed because downstream seeders (`seedOrganizationCore`, `seedContractors`, `seedInvoices`) need them.
- Leaves `Organization.create({ ..., members: { create: [...] } })` alone in `seedOrganizationCore` because the nested-create is already a single round-trip.
- Verification: `pnpm seed:solo --confirm --seed=4242` finishes green; user row count for `solo` matches the unchanged count derived from `VOLUME_TEMPLATES`.

### Commit 3 — `perf(seed-dev): batch organization-core children`

- Section: `seedOrganizationCore` (1587).
- Loop-bodies converted: `prisma.team.create`, `prisma.project.create`, `prisma.costCenter.create`, `prisma.invitation.create`. The wrapping `prisma.organization.create({ ..., members: { create: [...] } })` stays nested.
- Verification: `pnpm seed:small --confirm --seed=4242`; `Team`, `Project`, `CostCenter`, `Invitation` counts match the loop-derived counts.

### Commit 4 — `perf(seed-dev): batch contractor + compliance child rows`

- Section: `seedContractors` (1780), parts of `seedConsentAndPrivacy` (6030 contractorNotificationPreference, 6051 contractorChangeRequest).
- Targets: `prisma.contractorTag.create`, `prisma.complianceRequirementTemplate.create`, `prisma.contractor.create`, `prisma.contractorContact.create`, `prisma.contractorBillingProfile.create`, `prisma.contractorAssignment.create`, `prisma.contractorTagLink.create`, `prisma.contractorComplianceItem.create`.
- Pre-compute contractor ids so `ContractorContact`, `ContractorBillingProfile`, `ContractorAssignment`, `ContractorTagLink`, `ContractorComplianceItem` insert in their own `createMany` waves.
- Showcase coverage: contractor classification-status forcing logic preserved.
- Verification: `pnpm seed:huge --confirm --seed=4242 --omit=invoices,approvals,payments,audit-logs,equipment,notifications,workflow-runs,esign,tax,classification,ocr,einvoice,timesheets,subscription,api-keys,pinned-views,integration,courier,reminders,cron,consent`; row counts for `Contractor`, `ContractorContact`, `ContractorBillingProfile`, `ContractorAssignment`, `ContractorComplianceItem` match.

### Commit 5 — `perf(seed-dev): batch contract + rate-period + amendment rows`

- Section: `seedContracts` (2073).
- Targets: `prisma.contract.create`, both `prisma.contractRatePeriod.create` call sites, `prisma.contractAmendment.create`.
- Verification: `pnpm seed:medium --confirm --seed=4242 --omit=invoices,approvals,payments,audit-logs,equipment,notifications,workflow-runs,esign,tax,classification,ocr,einvoice,timesheets,subscription,api-keys,pinned-views,integration,courier,reminders,cron,consent`; `Contract`, `ContractRatePeriod`, `ContractAmendment` counts match.

### Commit 6 — `perf(seed-dev): batch invoice creation + invoice-document rows`

- Sections: `seedInvoices` (2384) — Invoice + InvoiceLine path only; `seedInvoiceDocuments` (4215).
- Targets: `prisma.invoice.create` (~8000 rows for qa-stress-org), `prisma.document.create` in `seedInvoiceDocuments`, `prisma.invoiceFile.create`.
- Pre-compute invoice ids. `prisma.invoiceLine.createMany` is already batched; leave chunk size at its current value.
- Approval-chain `ApprovalFlow/Step/Decision` calls that today sit inside `seedInvoices` are deferred to commit 7 so this diff stays narrowly invoice-domain.
- Verification: `pnpm seed:medium --confirm --seed=4242 --omit=approvals,payments,audit-logs,equipment,notifications,workflow-runs,esign,tax,classification,ocr,einvoice,timesheets,subscription,api-keys,pinned-views,integration,courier,reminders,cron,consent`; `Invoice`, `InvoiceLine`, `Document`, `InvoiceFile` counts match. Determinism check: first `Invoice.invoiceNumber` for `--seed=4242 --profile=showcase` matches two consecutive runs.

### Commit 7 — `perf(seed-dev): batch approval chain (flow/step/decision)`

- Sections: `seedApprovalChainConfig` (2217) + the inline `ApprovalFlow/Step/Decision` block inside `seedInvoices` (2565, 2662, 2682).
- Pre-compute `ApprovalFlow.id` then `ApprovalStep.id` so `ApprovalDecision` (which references step id) can batch independently.
- Insert waves: ApprovalFlow → ApprovalStep → ApprovalDecision; one `createMany` per wave per chunk, no nested creates.
- Verification: `pnpm seed:huge --confirm --seed=4242 --omit=payments,audit-logs,equipment,notifications,workflow-runs,esign,tax,classification,ocr,einvoice,timesheets,subscription,api-keys,pinned-views,integration,courier,reminders,cron,consent`; `ApprovalFlow`, `ApprovalStep`, `ApprovalDecision` counts match.

### Commit 8 — `perf(seed-dev): batch payment-run + payment-export + invoice-payment rows`

- Sections: `seedPaymentRuns` (2728).
- Targets: `prisma.invoicePayment.create` (twice), `prisma.paymentRun.create`, `prisma.paymentRunItem.create`, `prisma.paymentExport.create`.
- Pre-compute `PaymentRun.id` and `PaymentRunItem.id` so the downstream `InvoicePayment.create` and `PaymentExport.create` calls in the same loop batch cleanly.
- Verification: `pnpm seed:huge --confirm --seed=4242 --omit=audit-logs,equipment,notifications,workflow-runs,esign,tax,classification,ocr,einvoice,timesheets,subscription,api-keys,pinned-views,integration,courier,reminders,cron,consent`; `PaymentRun`, `PaymentRunItem`, `InvoicePayment`, `PaymentExport` counts match. Confirm Neon slow-query log has no statement over 5s.

### Commit 9 — `perf(seed-dev): batch reminder rules + instances`

- Section: `seedReminders` (2978).
- Target: `prisma.reminderRule.create`; `ReminderInstance.createMany` already chunked at 5000, leave as-is.
- Verification: `pnpm seed:medium --confirm --seed=4242`; `ReminderRule`, `ReminderInstance` counts match.

### Commit 10 — `perf(seed-dev): batch equipment + assignment + shipment + return rows`

- Section: `seedEquipment` (3725).
- Targets: `prisma.equipment.create`, `prisma.equipmentAssignment.create`, `prisma.shipment.create`, `prisma.shipmentEvent.create`, `prisma.returnRequest.create`.
- Pre-compute equipment + shipment ids so child rows batch independently.
- Verification: `pnpm seed:huge --confirm --seed=4242`; `Equipment`, `EquipmentAssignment`, `Shipment`, `ShipmentEvent`, `ReturnRequest` counts match.

### Commit 11 — `perf(seed-dev): batch notification + outbox + webhook (audit chunk tuning)`

- Sections: `seedNotifications` (3189), `seedOutbox` (3503), `seedWebhookDeliveries` (3675), and the existing `prisma.auditLog.createMany` (3974) chunk-size review.
- These are already `createMany`; this commit re-checks that 5000-row chunks stay under the 65535 bind-parameter ceiling given the schema's column counts (Notification has ~12 cols → 60k params, OK; AuditLog has ~14 cols → 70k params, drop to 4000).
- No semantic change beyond chunk-size sanity. Verification: `pnpm seed:huge --confirm --seed=4242`; `Notification`, `OutboxEvent`, `WebhookDelivery`, `AuditLog` counts match; the script does not raise `bind message has X parameter formats but 0 parameters`.

### Commit 12 — `perf(seed-dev): batch einvoice lifecycle + peppol + zatca`

- Sections: `seedEInvoiceLifecycle` (4018), `seedPeppol` (5667), `seedZatca` (5803).
- Targets: `prisma.eInvoiceLifecycle.create`, four `prisma.eInvoiceLifecycleEvent.create`, `prisma.peppolParticipant.create` (org + ~per-contractor), `prisma.peppolTransmission.create`, `prisma.leitwegId.create`, `prisma.zatcaInvoiceChain.create`.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match for the eight involved models.

### Commit 13 — `perf(seed-dev): batch invoice add-ons (skonto + interest + match/intake)`

- Sections: `seedSkonto` (5392), `seedInvoiceInterest` (5468), `seedInvoiceMatchAndIntake` (5555).
- Targets: `prisma.skontoTerm.create`, `prisma.skontoSnapshot.create`, `prisma.skontoApplication.create`, `prisma.invoiceInterestClaim.create`, `prisma.invoiceInterestCompensation.create`, `prisma.invoiceInterestWaiver.create`, `prisma.invoiceMatchResult.create`, `prisma.invoiceIntakeRequest.create`.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match for those eight models.

### Commit 14 — `perf(seed-dev): batch classification assessment + docs + escalation + sds-approval`

- Section: `seedClassification` (5253).
- Targets: `prisma.classificationAssessment.create`, `prisma.classificationDocument.create`, `prisma.classificationEscalationEvent.create`, `prisma.sdsApproval.create`.
- Showcase coverage: every `ClassificationStatus` enum value still appears at least once.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match.

### Commit 15 — `perf(seed-dev): batch esign envelopes + recipients + events`

- Section: `seedEsign` (6402).
- Targets: `prisma.signingEnvelope.create`, both `prisma.signingRecipient.create` call sites; `prisma.signingEvent.createMany` is already batched.
- Note: `integrationConnection.create` for DocuSign is a single one-shot — leave alone.
- Verification: `pnpm seed:medium --confirm --seed=4242`; counts match.

### Commit 16 — `perf(seed-dev): batch tax compliance (statusfeststellung + ir35 + tax-id + economic-dep + reassessment + wht)`

- Section: `seedTaxCompliance` (6591).
- Targets: `prisma.statusfeststellungsverfahren.create`, `prisma.ir35ChainParticipant.create`, `prisma.ir35OtherClientAttestation.create`, `prisma.taxIdValidation.create`, `prisma.economicDependencyAlertState.create`, `prisma.reassessmentTrigger.create`, `prisma.whtCertificate.create`.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match.

### Commit 17 — `perf(seed-dev): batch workflow templates + roles + runs + tasks + comments + attachments`

- Sections: `seedWorkflowTemplates` (4791), `seedWorkflowRuns` (5015), `seedComments` (4982).
- Targets: `prisma.workflowRoleTemplate.create`, `prisma.workflowTemplate.create`, `prisma.workflowTaskTemplate.create`, `prisma.workflowRun.create`, `prisma.workflowComment.create`, `prisma.workflowAttachment.create`, `prisma.comment.create`, second `prisma.document.create` in `seedWorkflowRuns`. `WorkflowRoleTaskTemplate.createMany` and `WorkflowTaskRun.createMany` are already batched.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match.

### Commit 18 — `perf(seed-dev): batch ocr extractions + pending uploads`

- Section: `seedOcr` (6315).
- Targets: `prisma.ocrExtraction.create`, `prisma.pendingUpload.create`.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match.

### Commit 19 — `perf(seed-dev): batch timesheets + time-entries`

- Section: `seedTimesheets` (6853).
- Target: `prisma.timesheet.create`; `prisma.timeEntry.createMany` already batched.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match.

### Commit 20 — `perf(seed-dev): batch integration + courier + sync-log`

- Sections: `seedIntegrationConnections` (4166), `seedCourierConfigs` (4955), `integrationSyncLog` inside `seedCronAndObservability` (6176), and `prisma.govApiAuditLog.create` (6155).
- Targets: `prisma.integrationConnection.create` (non-DocuSign loops only), `prisma.courierConfig.create`, `prisma.integrationSyncLog.create`, `prisma.govApiAuditLog.create`.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match.

### Commit 21 — `perf(seed-dev): batch consent records + events + api-keys + pinned-views + subscription side-effects`

- Sections: `seedConsentAndPrivacy` (5930) remaining call sites, `seedApiKeys` (6071), `seedPinnedViews` (6106), `seedSubscription` (4889).
- Targets: `prisma.consentRecord.create` (two sites), `prisma.consentEvent.create`, `prisma.organizationApiKey.create` (two sites), `prisma.userPinnedView.create`, `prisma.ocrCreditLedger.create` (inside `seedSubscription`).
- `Subscription.create` stays one-shot. `StripeEvent.createMany` and `NotificationCronDedup.createMany` already batched.
- Verification: `pnpm seed:huge --confirm --seed=4242`; counts match.

### Final verification commit (no code change)

After all section commits land, run the full gate:

- `pnpm -F @contractor-ops/db run typecheck` passes.
- `pnpm seed:qa` finishes in under 5 minutes wall-clock against Neon.
- `pnpm -F @contractor-ops/db exec tsx scripts/seed-dev.ts --profile=showcase --confirm --seed=4242 --no-progress` runs, then `psql $DATABASE_URL_EU -c "SELECT (SELECT COUNT(*) FROM \"Invoice\"), (SELECT COUNT(*) FROM \"ApprovalStep\"), (SELECT COUNT(*) FROM \"PaymentRunItem\"), (SELECT COUNT(*) FROM \"AuditLog\");"` matches the formula derived from `VOLUME_TEMPLATES` for the showcase profile.
- Two consecutive `--seed=4242 --profile=showcase` runs against fresh databases produce identical first `Contractor.legalName` and first `Invoice.invoiceNumber`.
- Showcase org contains at least one row of every `InvoiceStatus`, `ApprovalStatus`, `PaymentStatus` enum value (`psql -c "SELECT DISTINCT status FROM \"Invoice\""` etc.).
- Neon slow-query log shows no single statement holding longer than 5 seconds during a `--profile=qa` run.

## Risks + open questions

- `@paralleldrive/cuid2` may not be a direct dep of `@contractor-ops/db`. If `pnpm why` shows it only as a transitive of `@prisma/client`, the pre-work commit must either (a) add it explicitly to `packages/db/package.json` or (b) fall back to the cuid algorithm Prisma exports. Inspect first, decide before committing.
- The brief constrains "no new dependencies". If `@paralleldrive/cuid2` is not already a direct dep, the fallback path is `prisma.$queryRaw` to call `gen_random_uuid()` once per chunk — slower than in-process generation. Cuid is preferred so an `pnpm why` check happens in the pre-work commit.
- Faker draw order: today the loop draws field values, calls `.create()`, then loops again. Batching collects draws first then calls `createMany`. For seeders that fan out (one contractor → its own RNG sub-state used by child seeders), the draw order across siblings does not change because the outer loop is still serial; only the database call is hoisted. If a section's RNG threading depends on the create() completion (e.g. uses the created row's server-generated value), the ordering must be preserved by pre-computing that value too — flag those at commit time and document the choice inline.
- `--omit` matrix: every commit's verification uses `--omit` to isolate the touched sections. If `--omit` propagation has hidden cross-section coupling not captured in the section registry, a section that should have fired may not fire. Confirm by re-reading the registry comment around line 217 before commit 4.
- The `qa` profile depends on `seed-qa-fixtures.ts` as a post-step. Since `seed-qa-fixtures.ts` is out of scope, the qa-wall-time gate is the combined timing of `seed-dev.ts --profile=qa` + the qa-fixtures step; if the fixtures step itself dominates, the <5 min target may not be met by batching alone. Measure the fixtures step's contribution before claiming the qa gate is hit.
- Neon's HTTP driver has a per-request payload size limit. A 1000-row chunk for a wide table (50+ columns) approaches this limit. The commit-11 chunk-size sanity sweep is the place to catch this; if a `createMany` fails with payload-size errors, drop the chunk for that model to 250.
