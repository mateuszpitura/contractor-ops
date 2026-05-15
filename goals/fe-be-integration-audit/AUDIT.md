# FE↔BE Integration Audit Report

Generated: 2026-05-16

## Coverage

This audit was generated, gated, and partially auto-fixed in a single `/goal` run.

| Phase             | Result                                                              |
|-------------------|---------------------------------------------------------------------|
| Initial findings  | **366** (HIGH 92, MED 219, LOW 49 + 4 intentional, 4 noise dropped) |
| Auto-fixed        | **147** (added `onError`, `onSuccess`, `toast.success`, `toast.error`) |
| Remaining         | **219** — listed below                                              |
| Procedures audited | **424** across appRouter + portalAppRouter + publicApiRouter        |
| Mutation call sites audited | **225**                                                    |

### Remaining categories — what & why

| Category | Count | Why not auto-fixed |
|----------|-------|--------------------|
| `missing-confirmation` (HIGH) | 10 | Requires JSX surgery — adding `AlertDialog` state + `<AlertDialog>` wrapper around the trigger. Apply manually, see fix template below. |
| `orphan` (HIGH+MED) | 67 | Per spec: report-only, never auto-wire or auto-delete. Decide per item: (a) wire to UI, (b) delete procedure, (c) document non-UI caller. |
| `orphan-intentional-non-ui` (LOW) | 4 | Confirmed cron / public-api / admin-REST consumers. No action needed. |
| `missing-invalidation` (MED) | 78 | Requires picking which query key to invalidate per mutation — context-specific judgment. Use `queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey })`. |
| `missing-loading-state` (LOW) | 49 | Requires JSX attribute edits + skeleton / spinner choice per UX context. Use `disabled={mutation.isPending}` on trigger and render appropriate loading affordance. |
| Residual handlers (MED) | 17 | Multiple mutations on adjacent lines in same file — line-tolerance heuristic in apply-fixes.ts could not disambiguate. Fix by hand. |

### Confirmation dialog — fix template

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
// In JSX, replace the destructive trigger:
<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => deleteMutation.mutate({ id })}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Tools

- `goals/fe-be-integration-audit/tools/extract-procedures.ts` — walks the tRPC AST, emits `data/procedures.json`.
- `goals/fe-be-integration-audit/tools/extract-fe-callers.ts` — walks FE source, emits `data/fe-callers.json`.
- `goals/fe-be-integration-audit/tools/generate-findings.ts` — cross-joins, emits `data/findings.json` + this report.
- `goals/fe-be-integration-audit/tools/triage-orphans.ts` — tags intentional non-UI orphans (cron / public-api / admin REST).
- `goals/fe-be-integration-audit/tools/apply-fixes.ts` — mechanical fixer for handler/toast additions.
- `goals/fe-be-integration-audit/tools/repair-imports.ts` — repairs malformed multi-line imports after toast injection.

Re-run the whole pipeline:

```bash
pnpm tsx goals/fe-be-integration-audit/tools/extract-procedures.ts
pnpm tsx goals/fe-be-integration-audit/tools/extract-fe-callers.ts
pnpm tsx goals/fe-be-integration-audit/tools/generate-findings.ts
pnpm tsx goals/fe-be-integration-audit/tools/triage-orphans.ts
```

## Summary

- Total remaining findings: **219** (HIGH 15 / MED 155 / LOW 53)
- Procedures audited: **424** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **225**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 8 | 60 | 29 | 97 |
| compliance | 0 | 24 | 5 | 29 |
| equipment | 0 | 10 | 0 | 10 |
| finance | 2 | 30 | 10 | 42 |
| integrations | 3 | 8 | 1 | 12 |
| portal | 0 | 9 | 6 | 15 |
| workflow | 2 | 10 | 2 | 14 |

## HIGH (15)

### missing-confirmation (10)

- **F-HIGH-006** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-007** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:70` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-008** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:120` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-009** `apps/web/src/components/contractors/billing-profile/default-skonto-section.tsx:72` — Destructive mutation skonto.deleteForBillingProfile fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-010** `apps/web/src/components/contractors/contractor-profile/profile-header.tsx:88` — Destructive mutation contractor.archive fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-011** `apps/web/src/components/integrations/doc-links-section.tsx:54` — Destructive mutation docs.detach fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-012** `apps/web/src/components/invoices/skonto/skonto-form-section.tsx:105` — Destructive mutation skonto.deleteForInvoice fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-013** `apps/web/src/components/settings/slack-user-mapping.tsx:150` — Destructive mutation integration.unlinkUser fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-014** `apps/web/src/hooks/use-approval-actions.ts:43` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-015** `apps/web/src/hooks/use-template-mutations.ts:29` — Destructive mutation workflow.deleteTemplate fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.

### orphan (5)

- **F-HIGH-001** `packages/api/src/routers/core/contract.ts:625` — Procedure contract.delete (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-002** `packages/api/src/routers/core/document.ts:597` — Procedure document.delete (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-003** `packages/api/src/routers/workflow/workflow-roles.ts:169` — Procedure workflowRoles.delete (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-004** `packages/api/src/routers/integrations/ksef.ts:213` — Procedure ksef.disconnect (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-005** `packages/api/src/routers/integrations/jira.ts:480` — Procedure jira.disconnect (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.

## MED (151)

### missing-error-toast (3)

- **F-MED-099** `apps/web/src/components/equipment/carrier-shipment-form.tsx:163` — Mutation equipment.createInPostShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-101** `apps/web/src/components/equipment/carrier-shipment-form.tsx:170` — Mutation equipment.createDpdShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-103** `apps/web/src/components/equipment/carrier-shipment-form.tsx:177` — Mutation equipment.createUpsShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).

### missing-invalidation (86)

- **F-MED-067** `apps/web/src/app/[locale]/(portal)/portal/login/page.tsx:63` — Mutation portal.requestMagicLink succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-068** `apps/web/src/app/[locale]/(portal)/portal/login/verify/page.tsx:89` — Mutation portal.verifyMagicLink succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-069** `apps/web/src/app/[locale]/(portal)/portal/login/verify/page.tsx:93` — Mutation portal.selectOrg succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-070** `apps/web/src/components/billing/billing-overlay.tsx:39` — Mutation billing.createCheckoutSession succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-071** `apps/web/src/components/billing/billing-tab.tsx:29` — Mutation billing.createCheckoutSession succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-072** `apps/web/src/components/billing/billing-tab.tsx:43` — Mutation billing.createPortalSession succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-073** `apps/web/src/components/billing/top-up-dialog.tsx:55` — Mutation billing.createTopUpCheckout succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-074** `apps/web/src/components/consent/consent-management-section.tsx:55` — Mutation consent.downloadDPA succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-075** `apps/web/src/components/consent/consent-management-section.tsx:67` — Mutation consent.downloadSCC succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-076** `apps/web/src/components/consent/onboarding-consent-step.tsx:80` — Mutation consent.bulkGrant succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-077** `apps/web/src/components/contractors/classification/classification-disclaimer-dialog.tsx:89` — Mutation classification.acknowledgeDisclaimer succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-078** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx:26` — Mutation classificationDashboard.exportMarketCsv succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-079** `apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx:62` — Mutation classificationDocument.uploadDrvDecisionLetter succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-080** `apps/web/src/components/contractors/classification/wizard/classification-wizard-shell.tsx:91` — Mutation classification.saveAnswer succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-081** `apps/web/src/components/contractors/classification-documents/generate-sds-button.tsx:40` — Mutation classification.approveSds succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-082** `apps/web/src/components/contractors/compliance/recompute-compliance-dialog.tsx:68` — Mutation classification.recreateComplianceAssessment succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-083** `apps/web/src/components/contractors/contractor-profile/profile-header.tsx:76` — Mutation contractor.updateLifecycleStage succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-084** `apps/web/src/components/contractors/contractor-profile/profile-header.tsx:88` — Mutation contractor.archive succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-085** `apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx:84` — Mutation contractor.bulkArchive succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-086** `apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx:97` — Mutation contractor.bulkAssignOwner succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-087** `apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx:112` — Mutation contractor.export succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-088** `apps/web/src/components/contractors/country-compliance-section.tsx:45` — Mutation contractor.updateCountryFields succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-089** `apps/web/src/components/contracts/contract-detail/detail-header.tsx:80` — Mutation contract.transitionStatus succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-090** `apps/web/src/components/contracts/contract-detail/detail-header.tsx:89` — Mutation contract.transitionStatus succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-091** `apps/web/src/components/contracts/contract-detail/signing-progress-bar.tsx:118` — Mutation esign.resendToRecipient succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-092** `apps/web/src/components/contracts/contract-detail/void-envelope-dialog.tsx:53` — Mutation esign.voidEnvelope succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-093** `apps/web/src/components/contracts/contract-table/data-table-bulk-actions.tsx:75` — Mutation contract.bulkTransition succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-094** `apps/web/src/components/contracts/contract-wizard/step-documents.tsx:125` — Mutation document.requestUpload succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-095** `apps/web/src/components/contracts/contract-wizard/step-documents.tsx:131` — Mutation document.confirmUpload succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-096** `apps/web/src/components/contracts/contract-wizard/wizard-dialog.tsx:253` — Mutation document.linkToEntity succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-097** `apps/web/src/components/documents/drop-zone.tsx:56` — Mutation document.requestUpload succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-098** `apps/web/src/components/documents/drop-zone.tsx:62` — Mutation document.confirmUpload succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-100** `apps/web/src/components/equipment/carrier-shipment-form.tsx:163` — Mutation equipment.createInPostShipment succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-102** `apps/web/src/components/equipment/carrier-shipment-form.tsx:170` — Mutation equipment.createDpdShipment succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-104** `apps/web/src/components/equipment/carrier-shipment-form.tsx:177` — Mutation equipment.createUpsShipment succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-105** `apps/web/src/components/import/import-wizard-dialog.tsx:170` — Mutation import.parse succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-106** `apps/web/src/components/import/import-wizard-dialog.tsx:185` — Mutation import.validate succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-107** `apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx:115` — Mutation googleWorkspace.listUserGroups succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-108** `apps/web/src/components/invoices/einvoice-tab/einvoice-tab.tsx:102` — Mutation einvoice.finalize succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-109** `apps/web/src/components/invoices/einvoice-tab/einvoice-tab.tsx:125` — Mutation einvoice.revalidate succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-110** `apps/web/src/components/invoices/einvoice-tab/einvoice-tab.tsx:136` — Mutation einvoice.send succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-111** `apps/web/src/components/invoices/intake/intake-detail-actions-bar.tsx:80` — Mutation invoiceIntake.convertToInvoice succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-112** `apps/web/src/components/invoices/intake/intake-detail-actions-bar.tsx:94` — Mutation invoiceIntake.confirmMatch succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-113** `apps/web/src/components/invoices/intake/intake-detail-actions-bar.tsx:101` — Mutation invoiceIntake.acknowledgeValidation succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-114** `apps/web/src/components/invoices/intake/intake-detail-actions-bar.tsx:108` — Mutation invoiceIntake.reject succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-115** `apps/web/src/components/invoices/intake/intake-upload-dialog.tsx:81` — Mutation invoiceIntake.upload succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-116** `apps/web/src/components/invoices/invoice-detail/duplicate-warning.tsx:41` — Mutation invoice.dismissDuplicate succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-117** `apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx:240` — Mutation invoice.update succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-118** `apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx:250` — Mutation invoice.submitForMatching succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-119** `apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx:266` — Mutation invoice.voidInvoice succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-120** `apps/web/src/components/invoices/invoice-detail/match-card.tsx:312` — Mutation invoice.manualMatch succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-121** `apps/web/src/components/invoices/invoice-upload-area.tsx:89` — Mutation document.requestUpload succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-122** `apps/web/src/components/invoices/invoice-upload-area.tsx:95` — Mutation document.confirmUpload succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-123** `apps/web/src/components/invoices/invoice-upload-area.tsx:100` — Mutation invoice.create succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-124** `apps/web/src/components/invoices/invoice-upload-area.tsx:105` — Mutation ocr.trigger succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-125** `apps/web/src/components/invoices/invoice-upload-area.tsx:110` — Mutation ocr.retrigger succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-126** `apps/web/src/components/invoices/reverse-charge-banner.tsx:30` — Mutation invoice.toggleReverseCharge succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-127** `apps/web/src/components/legal/privacy-notice-pdf-download.tsx:33` — Mutation legal.generatePrivacyNoticePdf succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-128** `apps/web/src/components/onboarding/confirm-import-step.tsx:86` — Mutation onboardingImport.startImport succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-129** `apps/web/src/components/payments/bacs/bacs-preview-card.tsx:59` — Mutation bacs.generateExport succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-130** `apps/web/src/components/payments/bank-statement-dialog.tsx:64` — Mutation payment.importStatement succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-131** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:100` — Mutation payment.create succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-132** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:107` — Mutation payment.lockAndExport succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-133** `apps/web/src/components/payments/wht-summary-card.tsx:32` — Mutation tax.generateWhtCertificate succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-134** `apps/web/src/components/portal/invoice-submit-form.tsx:403` — Mutation portal.getUploadUrl succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-135** `apps/web/src/components/portal/invoice-submit-form.tsx:406` — Mutation ocr.portalTrigger succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-136** `apps/web/src/components/portal/invoice-submit-form.tsx:604` — Mutation portal.submitInvoice succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-137** `apps/web/src/components/portal/notification-preferences-section.tsx:118` — Mutation portal.updateNotificationPreference succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-138** `apps/web/src/components/portal/portal-settings-page.tsx:72` — Mutation portal.updateContactInfo succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-139** `apps/web/src/components/portal/portal-settings-page.tsx:77` — Mutation portal.submitFinancialChangeRequest succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-140** `apps/web/src/components/reports/compliance-gaps-report.tsx:64` — Mutation report.exportComplianceGaps succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-141** `apps/web/src/components/reports/expiring-contracts-report.tsx:59` — Mutation report.exportExpiringContracts succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-142** `apps/web/src/components/reports/overdue-invoices-report.tsx:64` — Mutation report.exportOverdueInvoices succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-143** `apps/web/src/components/reports/spend-contractor-report.tsx:67` — Mutation report.exportSpendByContractor succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-144** `apps/web/src/components/reports/spend-team-report.tsx:60` — Mutation report.exportSpendByTeam succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-145** `apps/web/src/components/settings/admin-branding-section.tsx:69` — Mutation settings.getLogoUploadUrl succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-146** `apps/web/src/components/settings/audit-log-tab.tsx:153` — Mutation audit.export succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-147** `apps/web/src/components/settings/carrier-credential-form.tsx:133` — Mutation equipment.testCourierConnection succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-148** `apps/web/src/components/settings/change-request-diff-card.tsx:89` — Mutation settings.reviewChangeRequest succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-149** `apps/web/src/components/settings/change-request-diff-card.tsx:101` — Mutation settings.reviewChangeRequest succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-150** `apps/web/src/components/tos-reacceptance-modal.tsx:48` — Mutation consent.recordToS succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-151** `apps/web/src/components/workflows/template-picker-dialog.tsx:110` — Mutation workflow.startRun succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-152** `apps/web/src/components/workflows/templates-table.tsx:123` — Mutation workflow.seedStarterTemplates succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-153** `apps/web/src/hooks/use-template-mutations.ts:25` — Mutation workflow.updateTemplate succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-154** `apps/web/src/hooks/use-template-mutations.ts:29` — Mutation workflow.deleteTemplate succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.
- **F-MED-155** `apps/web/src/hooks/use-template-mutations.ts:33` — Mutation workflow.duplicateTemplate succeeds without invalidating queries — stale UI until reload. _Fix:_ Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.

### orphan (62)

- **F-MED-002** `packages/api/src/routers/core/organization.ts:35` — Procedure organization.create (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-003** `packages/api/src/routers/core/organization.ts:98` — Procedure organization.update (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-004** `packages/api/src/routers/core/user.ts:394` — Procedure user.setOutOfOffice (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-005** `packages/api/src/routers/core/user.ts:420` — Procedure user.clearOutOfOffice (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-006** `packages/api/src/routers/core/contractor.ts:1375` — Procedure contractor.validateTin (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-007** `packages/api/src/routers/core/contractor.ts:1400` — Procedure contractor.validateVat (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-008** `packages/api/src/routers/core/contract.ts:334` — Procedure contract.update (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-009** `packages/api/src/routers/core/document.ts:435` — Procedure document.uploadNewVersion (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-010** `packages/api/src/routers/workflow/workflow-execution.ts:1177` — Procedure workflow.overrideBlockingTask (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-011** `packages/api/src/routers/workflow/workflow-roles.ts:59` — Procedure workflowRoles.list (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-012** `packages/api/src/routers/workflow/workflow-roles.ts:70` — Procedure workflowRoles.create (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-013** `packages/api/src/routers/workflow/workflow-roles.ts:112` — Procedure workflowRoles.update (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-014** `packages/api/src/routers/workflow/workflow-roles.ts:196` — Procedure workflowRoles.selectForContractor (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-015** `packages/api/src/routers/core/auth-permissions.ts:26` — Procedure authPermissions.getCurrentUserPermissions (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-016** `packages/api/src/routers/finance/invoice-intake.ts:438` — Procedure invoiceIntake.downloadExtractedXml (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-017** `packages/api/src/routers/finance/invoice-intake.ts:458` — Procedure invoiceIntake.downloadValidationReport (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-018** `packages/api/src/routers/core/approval.ts:441` — Procedure approval.getChain (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-019** `packages/api/src/routers/core/integration.ts:226` — Procedure integration.syncUsers (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-020** `packages/api/src/routers/finance/payment.ts:1458` — Procedure payment.getFormatDetection (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-021** `packages/api/src/routers/core/dashboard.ts:381` — Procedure dashboard.bootstrap (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-022** `packages/api/src/routers/core/ocr.ts:96` — Procedure ocr.getByDocument (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-023** `packages/api/src/routers/core/ocr.ts:210` — Procedure ocr.portalGetByDocument (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-024** `packages/api/src/routers/finance/late-payment-interest.ts:564` — Procedure latePaymentInterest.downloadClaim (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-025** `packages/api/src/routers/core/time.ts:163` — Procedure time.listContractors (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-026** `packages/api/src/routers/core/time.ts:320` — Procedure time.getReconciliation (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-027** `packages/api/src/routers/integrations/linear.ts:290` — Procedure linear.getLinkedIssue (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-028** `packages/api/src/routers/integrations/linear.ts:320` — Procedure linear.getLinkedIssues (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-029** `packages/api/src/routers/core/docs.ts:121` — Procedure docs.refreshMetadata (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-030** `packages/api/src/routers/finance/billing.ts:313` — Procedure billing.syncSeatCount (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-031** `packages/api/src/routers/finance/billing.ts:352` — Procedure billing.getCreditBalance (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-032** `packages/api/src/routers/finance/billing.ts:360` — Procedure billing.getPlanConfig (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-033** `packages/api/src/routers/equipment/equipment-shipments.ts:216` — Procedure equipment.getShipment (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-034** `packages/api/src/routers/equipment/equipment-shipments.ts:252` — Procedure equipment.listShipments (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-035** `packages/api/src/routers/equipment/equipment-couriers.ts:672` — Procedure equipment.getShipmentLabel (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-036** `packages/api/src/routers/compliance/gdpr.ts:68` — Procedure gdpr.requestErasure (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-037** `packages/api/src/routers/compliance/gdpr.ts:283` — Procedure gdpr.exportData (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-038** `packages/api/src/routers/integrations/teams.ts:76` — Procedure teams.connectionStatus (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-039** `packages/api/src/routers/integrations/teams.ts:168` — Procedure teams.setFallbackApprover (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-040** `packages/api/src/routers/core/einvoice.ts:880` — Procedure einvoice.listByOrg (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-041** `packages/api/src/routers/finance/exchange-rate.ts:16` — Procedure exchangeRate.query (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-042** `packages/api/src/routers/finance/exchange-rate.ts:40` — Procedure exchangeRate.latest (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-043** `packages/api/src/routers/finance/exchange-rate.ts:55` — Procedure exchangeRate.convert (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-046** `packages/api/src/routers/compliance/consent.ts:129` — Procedure consent.adminGetUserConsent (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-047** `packages/api/src/routers/compliance/consent.ts:141` — Procedure consent.adminGetUserConsentHistory (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-048** `packages/api/src/routers/integrations/peppol.ts:349` — Procedure peppol.getTransmissionByInvoiceId (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-049** `packages/api/src/routers/integrations/peppol.ts:458` — Procedure peppol.lookupCapabilities (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-050** `packages/api/src/routers/core/tax.ts:25` — Procedure tax.getRatesByCountry (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-051** `packages/api/src/routers/core/tax.ts:32` — Procedure tax.validateRate (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-052** `packages/api/src/routers/core/tax.ts:45` — Procedure tax.calculateWht (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-053** `packages/api/src/routers/core/tax.ts:79` — Procedure tax.listWhtCertificates (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-054** `packages/api/src/routers/core/tax.ts:84` — Procedure tax.getWhtCertificate (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-055** `packages/api/src/routers/compliance/zatca.ts:33` — Procedure zatca.saveTaxDetails (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-056** `packages/api/src/routers/compliance/zatca.ts:46` — Procedure zatca.generateCsr (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-057** `packages/api/src/routers/compliance/zatca.ts:56` — Procedure zatca.requestComplianceCsid (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-058** `packages/api/src/routers/compliance/zatca.ts:66` — Procedure zatca.runComplianceChecks (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-059** `packages/api/src/routers/compliance/zatca.ts:76` — Procedure zatca.exchangeProductionCert (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-060** `packages/api/src/routers/compliance/zatca.ts:87` — Procedure zatca.getOnboardingState (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-061** `packages/api/src/routers/compliance/zatca.ts:101` — Procedure zatca.getStatus (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-062** `packages/api/src/routers/compliance/zatca.ts:133` — Procedure zatca.getInvoiceChain (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-063** `packages/api/src/routers/compliance/zatca.ts:171` — Procedure zatca.resubmit (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-064** `packages/api/src/routers/compliance/zatca.ts:198` — Procedure zatca.getComplianceStats (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-065** `packages/api/src/routers/portal/portal.ts:339` — Procedure portal.logout (mutation, surface=portalAppRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.

## LOW (49)

### missing-loading-state (49)

- **F-LOW-001** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:137` — Mutation approval.approve trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-002** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — Mutation approval.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-003** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:70` — Mutation time.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-004** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:110` — Mutation time.approve trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-005** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:120` — Mutation time.reject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-006** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:130` — Mutation time.bulkApprove trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-007** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:141` — Mutation time.bulkReject trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-008** `apps/web/src/app/[locale]/(portal)/portal/login/verify/page.tsx:89` — Mutation portal.verifyMagicLink trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-009** `apps/web/src/app/[locale]/(portal)/portal/time/page.tsx:113` — Mutation portalTime.saveDraftEntries trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-010** `apps/web/src/components/billing/billing-overlay.tsx:39` — Mutation billing.createCheckoutSession trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-011** `apps/web/src/components/billing/billing-tab.tsx:29` — Mutation billing.createCheckoutSession trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-012** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx:26` — Mutation classificationDashboard.exportMarketCsv trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-013** `apps/web/src/components/contractors/classification/wizard/classification-wizard-shell.tsx:91` — Mutation classification.saveAnswer trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-014** `apps/web/src/components/contractors/ir35-chain/ir35-chain-panel.tsx:31` — Mutation ir35Chain.markDelivered trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-015** `apps/web/src/components/contractors/ir35-chain/ir35-chain-panel.tsx:42` — Mutation ir35Chain.markAcknowledged trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-016** `apps/web/src/components/contractors/ir35-chain/ir35-chain-panel.tsx:53` — Mutation ir35Chain.removeParticipant trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-017** `apps/web/src/components/contracts/contract-wizard/step-documents.tsx:125` — Mutation document.requestUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-018** `apps/web/src/components/contracts/contract-wizard/step-documents.tsx:131` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-019** `apps/web/src/components/contracts/contract-wizard/wizard-dialog.tsx:253` — Mutation document.linkToEntity trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-020** `apps/web/src/components/documents/drop-zone.tsx:56` — Mutation document.requestUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-021** `apps/web/src/components/documents/drop-zone.tsx:62` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-022** `apps/web/src/components/integrations/doc-links-section.tsx:54` — Mutation docs.detach trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-023** `apps/web/src/components/invoices/invoice-upload-area.tsx:89` — Mutation document.requestUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-024** `apps/web/src/components/invoices/invoice-upload-area.tsx:95` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-025** `apps/web/src/components/invoices/invoice-upload-area.tsx:100` — Mutation invoice.create trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-026** `apps/web/src/components/invoices/invoice-upload-area.tsx:105` — Mutation ocr.trigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-027** `apps/web/src/components/invoices/invoice-upload-area.tsx:110` — Mutation ocr.retrigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-028** `apps/web/src/components/invoices/reverse-charge-banner.tsx:30` — Mutation invoice.toggleReverseCharge trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-029** `apps/web/src/components/notifications/notification-center.tsx:101` — Mutation notification.markRead trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-030** `apps/web/src/components/notifications/notification-popover.tsx:66` — Mutation notification.markRead trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-031** `apps/web/src/components/onboarding/onboarding-checklist.tsx:229` — Mutation settings.update trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-032** `apps/web/src/components/payments/bank-statement-dialog.tsx:64` — Mutation payment.importStatement trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-033** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:100` — Mutation payment.create trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-034** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:107` — Mutation payment.lockAndExport trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-035** `apps/web/src/components/payments/payment-run-side-panel.tsx:115` — Mutation payment.updateItemStatus trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-036** `apps/web/src/components/payments/payment-run-side-panel.tsx:127` — Mutation payment.removeFromRun trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-037** `apps/web/src/components/portal/invoice-submit-form.tsx:403` — Mutation portal.getUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-038** `apps/web/src/components/portal/invoice-submit-form.tsx:406` — Mutation ocr.portalTrigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-039** `apps/web/src/components/portal/notification-preferences-section.tsx:118` — Mutation portal.updateNotificationPreference trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-040** `apps/web/src/components/portal/portal-settings-page.tsx:72` — Mutation portal.updateContactInfo trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-041** `apps/web/src/components/portal/portal-settings-page.tsx:77` — Mutation portal.submitFinancialChangeRequest trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-042** `apps/web/src/components/settings/admin-branding-section.tsx:69` — Mutation settings.getLogoUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-043** `apps/web/src/components/settings/approval-chains-tab.tsx:67` — Mutation approval.updateChain trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-044** `apps/web/src/components/settings/e-invoicing/leitweg-id-row.tsx:69` — Mutation leitwegId.setDefault trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-045** `apps/web/src/components/settings/reminder-rules-section.tsx:96` — Mutation reminder.toggleActive trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-046** `apps/web/src/components/settings/slack-user-mapping.tsx:82` — Mutation integration.linkUser trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-047** `apps/web/src/components/workflow/calendar-task-config.tsx:52` — Mutation calendar.saveTaskConfig trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-048** `apps/web/src/components/workflows/template-builder/template-form.tsx:138` — Mutation workflow.deleteTemplate trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-049** `apps/web/src/components/workflows/templates-table.tsx:123` — Mutation workflow.seedStarterTemplates trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.

## Appendix — Intentional non-UI consumers

These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **4**.

- **F-MED-001** `apiKey.update` — caller(s):
  - `(middleware=apiKeyAdminProcedure on packages/api/src/routers/core/api-key.ts:133)`
- **F-MED-044** `exchangeRate.fetchDaily` — caller(s):
  - `(middleware=cronProcedure on packages/api/src/routers/finance/exchange-rate.ts:67)`
- **F-MED-045** `featureFlags.list` — caller(s):
  - `(middleware=apiKeyTenantFlaggedProcedure on packages/api/src/routers/public-api/feature-flags.ts:13)`
- **F-MED-066** `featureFlags.list` — caller(s):
  - `(middleware=apiKeyTenantFlaggedProcedure on packages/api/src/routers/public-api/feature-flags.ts:13)`
