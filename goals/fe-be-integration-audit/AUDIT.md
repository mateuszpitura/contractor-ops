# FE↔BE Integration Audit Report

Generated: 2026-05-16T01:38:57.636Z

## Summary

- Total findings: **78** (HIGH 5 / MED 15 / LOW 58)
- Procedures audited: **416** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **251**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 4 | 5 | 30 | 39 |
| compliance | 0 | 7 | 5 | 12 |
| equipment | 0 | 0 | 0 | 0 |
| finance | 0 | 0 | 10 | 10 |
| integrations | 0 | 1 | 4 | 5 |
| portal | 0 | 2 | 7 | 9 |
| workflow | 1 | 0 | 2 | 3 |

## HIGH (5)

### missing-confirmation (5)

- **F-HIGH-001** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-002** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:71` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-003** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:127` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-004** `apps/web/src/hooks/use-approval-actions.ts:43` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-005** `apps/web/src/hooks/use-template-mutations.ts:36` — Destructive mutation workflow.deleteTemplate fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.

## MED (15)

### missing-error-toast (1)

- **F-MED-009** `apps/web/src/components/portal/portal-top-bar.tsx:120` — Mutation portal.logout has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).

### missing-invalidation (6)

- **F-MED-011** `apps/web/src/components/settings/gdpr-data-rights-section.tsx:63` — Mutation gdpr.requestErasure succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-012** `apps/web/src/components/zatca/compliance-checks.tsx:54` — Mutation zatca.runComplianceChecks succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-013** `apps/web/src/components/zatca/compliance-csid.tsx:70` — Mutation zatca.requestComplianceCsid succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-014** `apps/web/src/components/zatca/csr-generation.tsx:37` — Mutation zatca.generateCsr succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-015** `apps/web/src/components/zatca/production-certificate.tsx:38` — Mutation zatca.exchangeProductionCert succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-016** `apps/web/src/components/zatca/tax-details-form.tsx:61` — Mutation zatca.saveTaxDetails succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.

### missing-on-success (4)

- **F-MED-010** `apps/web/src/components/portal/portal-top-bar.tsx:120` — Mutation portal.logout has no onSuccess handler — UI never updates or confirms. _Fix:_ Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }
- **F-MED-017** `apps/web/src/hooks/use-settings-tab-pins.ts:40` — Mutation user.pins.toggle has no onSuccess handler — UI never updates or confirms. _Fix:_ Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }
- **F-MED-018** `apps/web/src/hooks/use-upload-new-version.ts:52` — Mutation document.uploadNewVersion has no onSuccess handler — UI never updates or confirms. _Fix:_ Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }
- **F-MED-019** `apps/web/src/hooks/use-upload-new-version.ts:58` — Mutation document.confirmUpload has no onSuccess handler — UI never updates or confirms. _Fix:_ Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }

### orphan (4)

- **F-MED-002** `packages/api/src/routers/core/time.ts:163` — Procedure time.listContractors (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-003** `packages/api/src/routers/core/time.ts:320` — Procedure time.getReconciliation (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-004** `packages/api/src/routers/compliance/gdpr.ts:283` — Procedure gdpr.exportData (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-007** `packages/api/src/routers/integrations/peppol.ts:349` — Procedure peppol.getTransmissionByInvoiceId (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.

## LOW (54)

### missing-loading-state (54)

- **F-LOW-001** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:137` — Mutation approval.approve trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-002** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — Mutation approval.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-003** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:71` — Mutation time.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-004** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:117` — Mutation time.approve trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-005** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:127` — Mutation time.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-006** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:137` — Mutation time.bulkApprove trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-007** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:148` — Mutation time.bulkReject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-008** `apps/web/src/app/[locale]/(portal)/portal/login/verify/page.tsx:91` — Mutation portal.verifyMagicLink trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-009** `apps/web/src/app/[locale]/(portal)/portal/time/page.tsx:118` — Mutation portalTime.saveDraftEntries trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
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
- **F-LOW-034** `apps/web/src/components/payments/payment-run-side-panel.tsx:176` — Mutation payment.updateItemStatus trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-035** `apps/web/src/components/payments/payment-run-side-panel.tsx:188` — Mutation payment.removeFromRun trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-036** `apps/web/src/components/portal/invoice-submit-form.tsx:405` — Mutation portal.getUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-037** `apps/web/src/components/portal/invoice-submit-form.tsx:414` — Mutation ocr.portalTrigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-038** `apps/web/src/components/portal/notification-preferences-section.tsx:118` — Mutation portal.updateNotificationPreference trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-039** `apps/web/src/components/portal/portal-settings-page.tsx:73` — Mutation portal.updateContactInfo trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-040** `apps/web/src/components/portal/portal-settings-page.tsx:83` — Mutation portal.submitFinancialChangeRequest trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-041** `apps/web/src/components/portal/portal-top-bar.tsx:120` — Mutation portal.logout trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-042** `apps/web/src/components/settings/admin-branding-section.tsx:70` — Mutation settings.getLogoUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-043** `apps/web/src/components/settings/approval-chains-tab.tsx:67` — Mutation approval.updateChain trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-044** `apps/web/src/components/settings/e-invoicing/leitweg-id-row.tsx:69` — Mutation leitwegId.setDefault trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-045** `apps/web/src/components/settings/provider-connection-card.tsx:142` — Mutation integration.disconnectGeneric trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-046** `apps/web/src/components/settings/provider-connection-card.tsx:152` — Mutation jira.disconnect trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-047** `apps/web/src/components/settings/provider-connection-card.tsx:158` — Mutation ksef.disconnect trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-048** `apps/web/src/components/settings/reminder-rules-section.tsx:96` — Mutation reminder.toggleActive trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-049** `apps/web/src/components/settings/slack-user-mapping.tsx:82` — Mutation integration.linkUser trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-050** `apps/web/src/components/workflow/calendar-task-config.tsx:52` — Mutation calendar.saveTaskConfig trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-051** `apps/web/src/components/workflows/template-builder/template-form.tsx:138` — Mutation workflow.deleteTemplate trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-052** `apps/web/src/components/workflows/templates-table.tsx:125` — Mutation workflow.seedStarterTemplates trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-053** `apps/web/src/hooks/use-upload-new-version.ts:52` — Mutation document.uploadNewVersion trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-054** `apps/web/src/hooks/use-upload-new-version.ts:58` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.

## Appendix — Intentional non-UI consumers

These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **4**.

- **F-MED-001** `apiKey.update` — caller(s):
  - `(middleware=apiKeyAdminProcedure on packages/api/src/routers/core/api-key.ts:133)`
- **F-MED-005** `exchangeRate.fetchDaily` — caller(s):
  - `(middleware=cronProcedure on packages/api/src/routers/finance/exchange-rate.ts:16)`
- **F-MED-006** `featureFlags.list` — caller(s):
  - `(middleware=apiKeyTenantFlaggedProcedure on packages/api/src/routers/public-api/feature-flags.ts:13)`
- **F-MED-008** `featureFlags.list` — caller(s):
  - `(middleware=apiKeyTenantFlaggedProcedure on packages/api/src/routers/public-api/feature-flags.ts:13)`
