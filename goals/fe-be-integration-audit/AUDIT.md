# FE↔BE Integration Audit Report

Generated: 2026-05-15T23:48:28.801Z

## Summary

- Total findings: **131** (HIGH 5 / MED 71 / LOW 55)
- Procedures audited: **423** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **233**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 4 | 23 | 28 | 55 |
| compliance | 0 | 14 | 5 | 19 |
| equipment | 0 | 6 | 0 | 6 |
| finance | 0 | 7 | 10 | 17 |
| integrations | 0 | 16 | 4 | 20 |
| portal | 0 | 1 | 6 | 7 |
| workflow | 1 | 4 | 2 | 7 |

## HIGH (5)

### missing-confirmation (5)

- **F-HIGH-001** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-002** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:70` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-003** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:122` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-004** `apps/web/src/hooks/use-approval-actions.ts:43` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-005** `apps/web/src/hooks/use-template-mutations.ts:36` — Destructive mutation workflow.deleteTemplate fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.

## MED (71)

### missing-error-toast (6)

- **F-MED-062** `apps/web/src/components/equipment/carrier-shipment-form.tsx:163` — Mutation equipment.createInPostShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-063** `apps/web/src/components/equipment/carrier-shipment-form.tsx:174` — Mutation equipment.createDpdShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-064** `apps/web/src/components/equipment/carrier-shipment-form.tsx:185` — Mutation equipment.createUpsShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-065** `apps/web/src/components/settings/provider-connection-card.tsx:142` — Mutation integration.disconnectGeneric has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-068** `apps/web/src/components/settings/provider-connection-card.tsx:152` — Mutation jira.disconnect has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-071** `apps/web/src/components/settings/provider-connection-card.tsx:158` — Mutation ksef.disconnect has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).

### missing-invalidation (3)

- **F-MED-067** `apps/web/src/components/settings/provider-connection-card.tsx:142` — Mutation integration.disconnectGeneric succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-070** `apps/web/src/components/settings/provider-connection-card.tsx:152` — Mutation jira.disconnect succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-073** `apps/web/src/components/settings/provider-connection-card.tsx:158` — Mutation ksef.disconnect succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.

### missing-on-success (3)

- **F-MED-061** `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx:86` — Mutation user.pins.toggle has no onSuccess handler — UI never updates or confirms. _Fix:_ Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }
- **F-MED-074** `apps/web/src/components/settings/workflow-roles/workflow-role-form-dialog.tsx:84` — Mutation workflowRoles.create has no onSuccess handler — UI never updates or confirms. _Fix:_ Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }
- **F-MED-075** `apps/web/src/components/settings/workflow-roles/workflow-role-form-dialog.tsx:90` — Mutation workflowRoles.update has no onSuccess handler — UI never updates or confirms. _Fix:_ Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }

### missing-success-toast (3)

- **F-MED-066** `apps/web/src/components/settings/provider-connection-card.tsx:142` — Mutation integration.disconnectGeneric succeeds with no toast.success — user gets no confirmation. _Fix:_ Call toast.success("...") inside the existing onSuccess handler.
- **F-MED-069** `apps/web/src/components/settings/provider-connection-card.tsx:152` — Mutation jira.disconnect succeeds with no toast.success — user gets no confirmation. _Fix:_ Call toast.success("...") inside the existing onSuccess handler.
- **F-MED-072** `apps/web/src/components/settings/provider-connection-card.tsx:158` — Mutation ksef.disconnect succeeds with no toast.success — user gets no confirmation. _Fix:_ Call toast.success("...") inside the existing onSuccess handler.

### orphan (56)

- **F-MED-002** `packages/api/src/routers/core/organization.ts:35` — Procedure organization.create (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-003** `packages/api/src/routers/core/organization.ts:98` — Procedure organization.update (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-004** `packages/api/src/routers/core/user.ts:395` — Procedure user.setOutOfOffice (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-005** `packages/api/src/routers/core/user.ts:421` — Procedure user.clearOutOfOffice (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-006** `packages/api/src/routers/core/contractor.ts:1323` — Procedure contractor.validateTin (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-007** `packages/api/src/routers/core/contractor.ts:1348` — Procedure contractor.validateVat (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-008** `packages/api/src/routers/core/contract.ts:334` — Procedure contract.update (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-009** `packages/api/src/routers/core/document.ts:435` — Procedure document.uploadNewVersion (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-010** `packages/api/src/routers/workflow/workflow-execution.ts:1177` — Procedure workflow.overrideBlockingTask (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-011** `packages/api/src/routers/workflow/workflow-roles.ts:196` — Procedure workflowRoles.selectForContractor (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-012** `packages/api/src/routers/core/auth-permissions.ts:26` — Procedure authPermissions.getCurrentUserPermissions (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-013** `packages/api/src/routers/finance/invoice-intake.ts:438` — Procedure invoiceIntake.downloadExtractedXml (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-014** `packages/api/src/routers/finance/invoice-intake.ts:458` — Procedure invoiceIntake.downloadValidationReport (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-015** `packages/api/src/routers/core/approval.ts:441` — Procedure approval.getChain (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-016** `packages/api/src/routers/core/integration.ts:226` — Procedure integration.syncUsers (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-017** `packages/api/src/routers/finance/payment.ts:1458` — Procedure payment.getFormatDetection (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-018** `packages/api/src/routers/core/dashboard.ts:381` — Procedure dashboard.bootstrap (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-019** `packages/api/src/routers/core/ocr.ts:96` — Procedure ocr.getByDocument (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-020** `packages/api/src/routers/core/ocr.ts:210` — Procedure ocr.portalGetByDocument (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-021** `packages/api/src/routers/finance/late-payment-interest.ts:564` — Procedure latePaymentInterest.downloadClaim (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-022** `packages/api/src/routers/core/time.ts:163` — Procedure time.listContractors (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-023** `packages/api/src/routers/core/time.ts:320` — Procedure time.getReconciliation (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-024** `packages/api/src/routers/integrations/linear.ts:290` — Procedure linear.getLinkedIssue (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-025** `packages/api/src/routers/integrations/linear.ts:320` — Procedure linear.getLinkedIssues (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-026** `packages/api/src/routers/core/docs.ts:121` — Procedure docs.refreshMetadata (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-027** `packages/api/src/routers/equipment/equipment-shipments.ts:216` — Procedure equipment.getShipment (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-028** `packages/api/src/routers/equipment/equipment-shipments.ts:252` — Procedure equipment.listShipments (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-029** `packages/api/src/routers/equipment/equipment-couriers.ts:672` — Procedure equipment.getShipmentLabel (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-030** `packages/api/src/routers/compliance/gdpr.ts:68` — Procedure gdpr.requestErasure (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-031** `packages/api/src/routers/compliance/gdpr.ts:283` — Procedure gdpr.exportData (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-032** `packages/api/src/routers/integrations/teams.ts:76` — Procedure teams.connectionStatus (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-033** `packages/api/src/routers/integrations/teams.ts:168` — Procedure teams.setFallbackApprover (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-034** `packages/api/src/routers/core/einvoice.ts:880` — Procedure einvoice.listByOrg (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-035** `packages/api/src/routers/finance/exchange-rate.ts:16` — Procedure exchangeRate.query (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-036** `packages/api/src/routers/finance/exchange-rate.ts:40` — Procedure exchangeRate.latest (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-037** `packages/api/src/routers/finance/exchange-rate.ts:55` — Procedure exchangeRate.convert (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-040** `packages/api/src/routers/compliance/consent.ts:129` — Procedure consent.adminGetUserConsent (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-041** `packages/api/src/routers/compliance/consent.ts:141` — Procedure consent.adminGetUserConsentHistory (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-042** `packages/api/src/routers/integrations/peppol.ts:349` — Procedure peppol.getTransmissionByInvoiceId (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-043** `packages/api/src/routers/integrations/peppol.ts:458` — Procedure peppol.lookupCapabilities (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-044** `packages/api/src/routers/core/tax.ts:25` — Procedure tax.getRatesByCountry (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-045** `packages/api/src/routers/core/tax.ts:32` — Procedure tax.validateRate (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-046** `packages/api/src/routers/core/tax.ts:45` — Procedure tax.calculateWht (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-047** `packages/api/src/routers/core/tax.ts:79` — Procedure tax.listWhtCertificates (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-048** `packages/api/src/routers/core/tax.ts:84` — Procedure tax.getWhtCertificate (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-049** `packages/api/src/routers/compliance/zatca.ts:33` — Procedure zatca.saveTaxDetails (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-050** `packages/api/src/routers/compliance/zatca.ts:46` — Procedure zatca.generateCsr (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-051** `packages/api/src/routers/compliance/zatca.ts:56` — Procedure zatca.requestComplianceCsid (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-052** `packages/api/src/routers/compliance/zatca.ts:66` — Procedure zatca.runComplianceChecks (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-053** `packages/api/src/routers/compliance/zatca.ts:76` — Procedure zatca.exchangeProductionCert (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-054** `packages/api/src/routers/compliance/zatca.ts:87` — Procedure zatca.getOnboardingState (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-055** `packages/api/src/routers/compliance/zatca.ts:101` — Procedure zatca.getStatus (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-056** `packages/api/src/routers/compliance/zatca.ts:133` — Procedure zatca.getInvoiceChain (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-057** `packages/api/src/routers/compliance/zatca.ts:171` — Procedure zatca.resubmit (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-058** `packages/api/src/routers/compliance/zatca.ts:198` — Procedure zatca.getComplianceStats (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-059** `packages/api/src/routers/portal/portal.ts:339` — Procedure portal.logout (mutation, surface=portalAppRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.

## LOW (51)

### missing-loading-state (51)

- **F-LOW-001** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:137` — Mutation approval.approve trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-002** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — Mutation approval.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-003** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:70` — Mutation time.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-004** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:112` — Mutation time.approve trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-005** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:122` — Mutation time.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-006** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:132` — Mutation time.bulkApprove trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-007** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:143` — Mutation time.bulkReject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-008** `apps/web/src/app/[locale]/(portal)/portal/login/verify/page.tsx:91` — Mutation portal.verifyMagicLink trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-009** `apps/web/src/app/[locale]/(portal)/portal/time/page.tsx:113` — Mutation portalTime.saveDraftEntries trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-010** `apps/web/src/components/billing/billing-overlay.tsx:40` — Mutation billing.createCheckoutSession trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-011** `apps/web/src/components/billing/billing-tab.tsx:30` — Mutation billing.createCheckoutSession trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-012** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx:27` — Mutation classificationDashboard.exportMarketCsv trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-013** `apps/web/src/components/contractors/classification/wizard/classification-wizard-shell.tsx:91` — Mutation classification.saveAnswer trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-014** `apps/web/src/components/contractors/ir35-chain/ir35-chain-panel.tsx:31` — Mutation ir35Chain.markDelivered trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-015** `apps/web/src/components/contractors/ir35-chain/ir35-chain-panel.tsx:42` — Mutation ir35Chain.markAcknowledged trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-016** `apps/web/src/components/contractors/ir35-chain/ir35-chain-panel.tsx:53` — Mutation ir35Chain.removeParticipant trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-017** `apps/web/src/components/contracts/contract-wizard/step-documents.tsx:127` — Mutation document.requestUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-018** `apps/web/src/components/contracts/contract-wizard/step-documents.tsx:138` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-019** `apps/web/src/components/contracts/contract-wizard/wizard-dialog.tsx:254` — Mutation document.linkToEntity trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-020** `apps/web/src/components/documents/drop-zone.tsx:57` — Mutation document.requestUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-021** `apps/web/src/components/documents/drop-zone.tsx:68` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-022** `apps/web/src/components/invoices/invoice-upload-area.tsx:90` — Mutation document.requestUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-023** `apps/web/src/components/invoices/invoice-upload-area.tsx:101` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-024** `apps/web/src/components/invoices/invoice-upload-area.tsx:111` — Mutation invoice.create trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-025** `apps/web/src/components/invoices/invoice-upload-area.tsx:121` — Mutation ocr.trigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-026** `apps/web/src/components/invoices/invoice-upload-area.tsx:131` — Mutation ocr.retrigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-027** `apps/web/src/components/invoices/reverse-charge-banner.tsx:31` — Mutation invoice.toggleReverseCharge trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-028** `apps/web/src/components/notifications/notification-center.tsx:101` — Mutation notification.markRead trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-029** `apps/web/src/components/notifications/notification-popover.tsx:66` — Mutation notification.markRead trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-030** `apps/web/src/components/onboarding/onboarding-checklist.tsx:230` — Mutation settings.update trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-031** `apps/web/src/components/payments/bank-statement-dialog.tsx:64` — Mutation payment.importStatement trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-032** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:102` — Mutation payment.create trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-033** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:114` — Mutation payment.lockAndExport trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-034** `apps/web/src/components/payments/payment-run-side-panel.tsx:115` — Mutation payment.updateItemStatus trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-035** `apps/web/src/components/payments/payment-run-side-panel.tsx:127` — Mutation payment.removeFromRun trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-036** `apps/web/src/components/portal/invoice-submit-form.tsx:405` — Mutation portal.getUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-037** `apps/web/src/components/portal/invoice-submit-form.tsx:414` — Mutation ocr.portalTrigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-038** `apps/web/src/components/portal/notification-preferences-section.tsx:118` — Mutation portal.updateNotificationPreference trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-039** `apps/web/src/components/portal/portal-settings-page.tsx:73` — Mutation portal.updateContactInfo trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-040** `apps/web/src/components/portal/portal-settings-page.tsx:83` — Mutation portal.submitFinancialChangeRequest trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-041** `apps/web/src/components/settings/admin-branding-section.tsx:70` — Mutation settings.getLogoUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-042** `apps/web/src/components/settings/approval-chains-tab.tsx:67` — Mutation approval.updateChain trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-043** `apps/web/src/components/settings/e-invoicing/leitweg-id-row.tsx:69` — Mutation leitwegId.setDefault trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-044** `apps/web/src/components/settings/provider-connection-card.tsx:142` — Mutation integration.disconnectGeneric trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-045** `apps/web/src/components/settings/provider-connection-card.tsx:152` — Mutation jira.disconnect trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-046** `apps/web/src/components/settings/provider-connection-card.tsx:158` — Mutation ksef.disconnect trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-047** `apps/web/src/components/settings/reminder-rules-section.tsx:96` — Mutation reminder.toggleActive trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-048** `apps/web/src/components/settings/slack-user-mapping.tsx:79` — Mutation integration.linkUser trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-049** `apps/web/src/components/workflow/calendar-task-config.tsx:52` — Mutation calendar.saveTaskConfig trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-050** `apps/web/src/components/workflows/template-builder/template-form.tsx:138` — Mutation workflow.deleteTemplate trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-051** `apps/web/src/components/workflows/templates-table.tsx:125` — Mutation workflow.seedStarterTemplates trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.

## Appendix — Intentional non-UI consumers

These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **4**.

- **F-MED-001** `apiKey.update` — caller(s):
  - `(middleware=apiKeyAdminProcedure on packages/api/src/routers/core/api-key.ts:133)`
- **F-MED-038** `exchangeRate.fetchDaily` — caller(s):
  - `(middleware=cronProcedure on packages/api/src/routers/finance/exchange-rate.ts:67)`
- **F-MED-039** `featureFlags.list` — caller(s):
  - `(middleware=apiKeyTenantFlaggedProcedure on packages/api/src/routers/public-api/feature-flags.ts:13)`
- **F-MED-060** `featureFlags.list` — caller(s):
  - `(middleware=apiKeyTenantFlaggedProcedure on packages/api/src/routers/public-api/feature-flags.ts:13)`
