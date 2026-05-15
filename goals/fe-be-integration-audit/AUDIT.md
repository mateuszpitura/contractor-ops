# FE↔BE Integration Audit Report

Generated: 2026-05-16

## Coverage

This audit was generated, gated, and partially auto-fixed in a single `/goal` run.

| Phase             | Result                                                              |
|-------------------|---------------------------------------------------------------------|
| Initial findings  | **366** (HIGH 92, MED 219, LOW 49 + 4 intentional, 4 noise dropped) |
| Auto-fixed        | **233** (handlers, toasts, query invalidation)                      |
| Remaining         | **133** — listed below                                              |
| Procedures audited | **424** across appRouter + portalAppRouter + publicApiRouter        |
| Mutation call sites audited | **225**                                                    |

### Remaining categories — what & why

| Category | Count | Severity | Why not auto-fixed |
|----------|-------|----------|--------------------|
| `missing-confirmation` | 10 | HIGH | Requires JSX surgery — adding `AlertDialog` state + wrapper. Spec mandates AlertDialog (facts.md), not `window.confirm`. Apply manually per fix template below. |
| `orphan` | 67 | HIGH(5) + MED(62) | Per spec, report-only: do not auto-wire to UI and do not auto-delete. Decide per item: (a) wire to UI, (b) delete procedure, (c) document non-UI caller. |
| `orphan-intentional-non-ui` | 4 | LOW | Confirmed cron / public-api / admin-REST consumers. No action needed. |
| `missing-loading-state` | 49 | LOW | Requires JSX attribute edits + skeleton/spinner choice per UX context. Use `disabled={mutation.isPending}` on trigger and render appropriate loading affordance. Per gate feedback, mix: skeleton for query loads, disabled+spinner for mutation triggers. |
| `missing-error-toast` residuals | 3 | MED | False positives — `onError` handler references an externalized callback (e.g. `onError: onMutationError`) which calls `toast.error` indirectly. Detector flags only literal `toast.error` calls inside the handler body. |

### Confirmation dialog — fix template (apply per HIGH `missing-confirmation` finding)

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);

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
      <AlertDialogAction
        onClick={() => deleteMutation.mutate({ id })}
        disabled={deleteMutation.isPending}>
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Loading state — fix template (apply per LOW `missing-loading-state` finding)

```tsx
<Button onClick={() => mutation.mutate(args)} disabled={mutation.isPending}>
  {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
  {label}
</Button>
```

For list/data loading from queries, prefer a `<Skeleton />` row over a spinner.

### Tools

- `goals/fe-be-integration-audit/tools/extract-procedures.ts` — walks the tRPC AST, emits `data/procedures.json`.
- `goals/fe-be-integration-audit/tools/extract-fe-callers.ts` — walks FE source, emits `data/fe-callers.json`.
- `goals/fe-be-integration-audit/tools/generate-findings.ts` — cross-joins, emits `data/findings.json` + this report.
- `goals/fe-be-integration-audit/tools/triage-orphans.ts` — tags intentional non-UI orphans (cron / public-api / admin REST).
- `goals/fe-be-integration-audit/tools/apply-fixes.ts` — mechanical fixer for handler/toast/invalidation additions.
- `goals/fe-be-integration-audit/tools/repair-imports.ts` — repairs malformed multi-line imports after toast/queryClient injection.

Re-run the pipeline anytime:

```bash
pnpm tsx goals/fe-be-integration-audit/tools/extract-procedures.ts
pnpm tsx goals/fe-be-integration-audit/tools/extract-fe-callers.ts
pnpm tsx goals/fe-be-integration-audit/tools/generate-findings.ts
pnpm tsx goals/fe-be-integration-audit/tools/triage-orphans.ts
```

### Commits applied as part of this audit

| Commit | Scope |
|--------|-------|
| `69c94ed2` | Audit infrastructure: AUDIT.md, AST extractors, fix applier, repair scripts |
| `6650170c` | Add missing `onError`, `onSuccess`, `toast.success`, `toast.error` handlers across 59 files |
| `9b35b0b5` | Add `queryClient.invalidateQueries(trpc.<router>.pathFilter())` to onSuccess + introduce `useQueryClient` hook where missing across 57 files |

## Summary

- Total remaining findings: **133** (HIGH 15 / MED 65 / LOW 53)
- Procedures audited: **424** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **225**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 8 | 22 | 29 | 59 |
| compliance | 0 | 14 | 5 | 19 |
| equipment | 0 | 6 | 0 | 6 |
| finance | 2 | 10 | 10 | 22 |
| integrations | 3 | 7 | 1 | 11 |
| portal | 0 | 1 | 6 | 7 |
| workflow | 2 | 5 | 2 | 9 |

## HIGH (15)

### missing-confirmation (10)

- **F-HIGH-006** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-007** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:70` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-008** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:120` — Destructive mutation time.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-009** `apps/web/src/components/contractors/billing-profile/default-skonto-section.tsx:72` — Destructive mutation skonto.deleteForBillingProfile fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-010** `apps/web/src/components/contractors/contractor-profile/profile-header.tsx:95` — Destructive mutation contractor.archive fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-011** `apps/web/src/components/integrations/doc-links-section.tsx:54` — Destructive mutation docs.detach fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-012** `apps/web/src/components/invoices/skonto/skonto-form-section.tsx:105` — Destructive mutation skonto.deleteForInvoice fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-013** `apps/web/src/components/settings/slack-user-mapping.tsx:150` — Destructive mutation integration.unlinkUser fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-014** `apps/web/src/hooks/use-approval-actions.ts:43` — Destructive mutation approval.reject fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.
- **F-HIGH-015** `apps/web/src/hooks/use-template-mutations.ts:36` — Destructive mutation workflow.deleteTemplate fires without a confirmation dialog in this file. _Fix:_ Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.

### orphan (5)

- **F-HIGH-001** `packages/api/src/routers/core/contract.ts:625` — Procedure contract.delete (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-002** `packages/api/src/routers/core/document.ts:597` — Procedure document.delete (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-003** `packages/api/src/routers/workflow/workflow-roles.ts:169` — Procedure workflowRoles.delete (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-004** `packages/api/src/routers/integrations/ksef.ts:213` — Procedure ksef.disconnect (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-HIGH-005** `packages/api/src/routers/integrations/jira.ts:480` — Procedure jira.disconnect (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.

## MED (65)

### missing-error-toast (3)

- **F-MED-067** `apps/web/src/components/equipment/carrier-shipment-form.tsx:163` — Mutation equipment.createInPostShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-068** `apps/web/src/components/equipment/carrier-shipment-form.tsx:174` — Mutation equipment.createDpdShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).
- **F-MED-069** `apps/web/src/components/equipment/carrier-shipment-form.tsx:185` — Mutation equipment.createUpsShipment has onError but does not call toast.error — user sees no error feedback. _Fix:_ Inside the existing onError handler, call toast.error(err.message) (or a translated message).

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
- **F-LOW-022** `apps/web/src/components/integrations/doc-links-section.tsx:54` — Mutation docs.detach trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-023** `apps/web/src/components/invoices/invoice-upload-area.tsx:90` — Mutation document.requestUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-024** `apps/web/src/components/invoices/invoice-upload-area.tsx:101` — Mutation document.confirmUpload trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-025** `apps/web/src/components/invoices/invoice-upload-area.tsx:111` — Mutation invoice.create trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-026** `apps/web/src/components/invoices/invoice-upload-area.tsx:121` — Mutation ocr.trigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-027** `apps/web/src/components/invoices/invoice-upload-area.tsx:131` — Mutation ocr.retrigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-028** `apps/web/src/components/invoices/reverse-charge-banner.tsx:31` — Mutation invoice.toggleReverseCharge trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-029** `apps/web/src/components/notifications/notification-center.tsx:101` — Mutation notification.markRead trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-030** `apps/web/src/components/notifications/notification-popover.tsx:66` — Mutation notification.markRead trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-031** `apps/web/src/components/onboarding/onboarding-checklist.tsx:229` — Mutation settings.update trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-032** `apps/web/src/components/payments/bank-statement-dialog.tsx:64` — Mutation payment.importStatement trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-033** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:102` — Mutation payment.create trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-034** `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx:114` — Mutation payment.lockAndExport trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-035** `apps/web/src/components/payments/payment-run-side-panel.tsx:115` — Mutation payment.updateItemStatus trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-036** `apps/web/src/components/payments/payment-run-side-panel.tsx:127` — Mutation payment.removeFromRun trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-037** `apps/web/src/components/portal/invoice-submit-form.tsx:405` — Mutation portal.getUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-038** `apps/web/src/components/portal/invoice-submit-form.tsx:414` — Mutation ocr.portalTrigger trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-039** `apps/web/src/components/portal/notification-preferences-section.tsx:118` — Mutation portal.updateNotificationPreference trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-040** `apps/web/src/components/portal/portal-settings-page.tsx:73` — Mutation portal.updateContactInfo trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-041** `apps/web/src/components/portal/portal-settings-page.tsx:83` — Mutation portal.submitFinancialChangeRequest trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-042** `apps/web/src/components/settings/admin-branding-section.tsx:70` — Mutation settings.getLogoUploadUrl trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-043** `apps/web/src/components/settings/approval-chains-tab.tsx:67` — Mutation approval.updateChain trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-044** `apps/web/src/components/settings/e-invoicing/leitweg-id-row.tsx:69` — Mutation leitwegId.setDefault trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-045** `apps/web/src/components/settings/reminder-rules-section.tsx:96` — Mutation reminder.toggleActive trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-046** `apps/web/src/components/settings/slack-user-mapping.tsx:82` — Mutation integration.linkUser trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-047** `apps/web/src/components/workflow/calendar-task-config.tsx:52` — Mutation calendar.saveTaskConfig trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-048** `apps/web/src/components/workflows/template-builder/template-form.tsx:138` — Mutation workflow.deleteTemplate trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.
- **F-LOW-049** `apps/web/src/components/workflows/templates-table.tsx:124` — Mutation workflow.seedStarterTemplates trigger has no isPending reference — button not disabled while pending, double-submit possible. _Fix:_ Add disabled={mutation.isPending} to the trigger element and render a loading indicator.

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
