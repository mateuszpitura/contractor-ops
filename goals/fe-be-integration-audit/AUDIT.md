# FE↔BE Integration Audit Report

Generated: 2026-05-16T15:56:18.496Z

## Summary

- Active findings: **4** (HIGH 0 / MED 2 / LOW 2)
- Triaged as false positive: **25** (see Appendix B)
- Procedures audited: **416** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **251**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 0 | 2 | 1 | 3 |
| compliance | 0 | 0 | 0 | 0 |
| equipment | 0 | 0 | 0 | 0 |
| finance | 0 | 0 | 1 | 1 |
| integrations | 0 | 0 | 0 | 0 |
| portal | 0 | 0 | 0 | 0 |
| workflow | 0 | 0 | 0 | 0 |

## HIGH (0)

## MED (2)

### orphan (2)

- **F-MED-001** `packages/api/src/routers/core/api-key.ts:133` — Procedure apiKey.update (mutation, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.
- **F-MED-003** `packages/api/src/routers/core/feature-flags.ts:19` — Procedure featureFlags.list (query, surface=appRouter) has no FE caller. _Fix:_ Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.

## LOW (0)

## Appendix A — Intentional non-UI consumers

These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **2**.

- **F-MED-002** `exchangeRate.fetchDaily` — caller(s):
  - `(middleware=cronProcedure on packages/api/src/routers/finance/exchange-rate.ts:16)`
- **F-MED-004** `featureFlags.list` — caller(s):
  - `(middleware=apiKeyTenantFlaggedProcedure on packages/api/src/routers/public-api/feature-flags.ts:13)`

## Appendix B — Triaged false positives

Findings the detector raised that were manually reviewed and confirmed intentional. Annotations live in `data/false-positives.json` and survive pipeline regeneration.

### autosave-status-machine (1)

- **F-LOW-003** `apps/web/src/components/contractors/classification/wizard/classification-wizard-shell.tsx:91` — classification.saveAnswer (missing-loading-state). _Why benign:_ Autosave pattern — `onMutate` flips a separate `autosaveStatus` state to 'saving' so the UI can render saving/saved/error indicators around the wizard. No discrete Button to disable; commitAnswer fires on every input change.

### cell-blur-autosave (1)

- **F-LOW-001** `apps/web/src/app/[locale]/(portal)/portal/time/page.tsx:118` — portalTime.saveDraftEntries (missing-loading-state). _Why benign:_ Mutation fires from TimesheetGrid's cell-blur handler, not a discrete Button. The grid's `disabled` prop is already wired (set by submitted/approved timesheet state), and saves are batched on blur — there is no static trigger to disable mid-flight.

### consumer-wraps-hook (2)

- **F-HIGH-004** `apps/web/src/hooks/use-approval-actions.ts:43` — approval.reject (missing-confirmation). _Why benign:_ Hook file cannot host an AlertDialog itself; confirmation lives in the consuming components (approvals/page.tsx, approval-queue/side-panel.tsx) which open the comment-collecting Popover before calling the hook.
- **F-HIGH-005** `apps/web/src/hooks/use-template-mutations.ts:37` — workflow.deleteTemplate (missing-confirmation). _Why benign:_ Hook cannot host the dialog. Consumer templates-table.tsx wraps the delete trigger in <AlertDialog> at lines 354-372 — confirmation is enforced at the call site.

### effect-driven-mutation (1)

- **F-LOW-009** `apps/web/src/components/workflows/templates-table.tsx:126` — workflow.seedStarterTemplates (missing-loading-state). _Why benign:_ Mutation auto-fires from a `useEffect` (line 144) on first visit when `templates.length === 0` and `seedAttempted.current` is false. There is no user-triggered Button to disable; the `seedAttempted` ref prevents double-fire.

### intentional-silent-handler (1)

- **F-MED-005** `apps/web/src/components/portal/portal-top-bar.tsx:120` — portal.logout (missing-error-toast). _Why benign:_ Logout failures are intentionally swallowed — an explicit no-op onError exists so the client clears local state regardless. Server-side errors are non-actionable for an already-logged-out user.

### mutateAsync-pipeline (2)

- **F-MED-014** `apps/web/src/hooks/use-upload-new-version.ts:52` — document.uploadNewVersion (missing-on-success). _Why benign:_ Consumed via mutateAsync() inside an async pipeline. The caller awaits the result, runs a subsequent mutate (confirmUpload), and handles toast/invalidation at the end of the pipeline — not inside this mutation's options.
- **F-MED-015** `apps/web/src/hooks/use-upload-new-version.ts:58` — document.confirmUpload (missing-on-success). _Why benign:_ Same as document.uploadNewVersion — terminal step of an async pipeline. The caller's awaited handler does the post-success work (toast + invalidation), not the mutation's onSuccess.

### optimistic-update (2)

- **F-LOW-005** `apps/web/src/components/portal/notification-preferences-section.tsx:119` — portal.updateNotificationPreference (missing-loading-state). _Why benign:_ Mutation uses optimistic-update (`onMutate` writes new value to query cache + `onSettled` refetches). Disabling the Switch while pending would defeat the optimistic UX — toggle feedback is instant by design.
- **F-MED-013** `apps/web/src/hooks/use-settings-tab-pins.ts:40` — user.pins.toggle (missing-on-success). _Why benign:_ Uses optimistic-update pattern: onMutate writes the new pin state to the query cache, onSettled refetches. No onSuccess needed because the cache is mutated before the round-trip.

### redirect-on-mutate (1)

- **F-MED-006** `apps/web/src/components/portal/portal-top-bar.tsx:120` — portal.logout (missing-on-success). _Why benign:_ onSuccess is intentionally absent — logout always redirects via router.replace immediately after mutateAsync resolves. There is no UI to update because the page unmounts.

### rejection-with-reason (3)

- **F-HIGH-001** `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` — approval.reject (missing-confirmation). _Why benign:_ Handler input requires a non-empty `comment: string`. The trigger opens a Popover with a textarea + 10-char-minimum validation; mutate only fires after the user types and confirms. The required-input gate is functionally equivalent to an AlertDialog confirmation.
- **F-HIGH-002** `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:71` — time.reject (missing-confirmation). _Why benign:_ Handler input requires a `reason: string`. Trigger opens a dialog collecting the reason; mutate only fires after the user types and confirms. Required-input gate substitutes for AlertDialog.
- **F-HIGH-003** `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:128` — time.reject (missing-confirmation). _Why benign:_ Same pattern as time/[contractorId]/page.tsx — reason-collecting dialog gates the mutate call.

### routed-mutation (3)

- **F-LOW-006** `apps/web/src/components/settings/provider-connection-card.tsx:143` — integration.disconnectGeneric (missing-loading-state). _Why benign:_ Three useMutation hooks (genericDisconnect / jiraDisconnect / ksefDisconnect) feed a single `disconnectMutation` alias picked by provider. The single AlertDialogAction trigger uses `disabled={disconnectMutation.isPending}`, so the active route's `isPending` IS bound — the detector just doesn't follow the conditional-alias pattern.
- **F-LOW-007** `apps/web/src/components/settings/provider-connection-card.tsx:153` — jira.disconnect (missing-loading-state). _Why benign:_ Three useMutation hooks (genericDisconnect / jiraDisconnect / ksefDisconnect) feed a single `disconnectMutation` alias picked by provider. The single AlertDialogAction trigger uses `disabled={disconnectMutation.isPending}`, so the active route's `isPending` IS bound — the detector just doesn't follow the conditional-alias pattern.
- **F-LOW-008** `apps/web/src/components/settings/provider-connection-card.tsx:159` — ksef.disconnect (missing-loading-state). _Why benign:_ Three useMutation hooks (genericDisconnect / jiraDisconnect / ksefDisconnect) feed a single `disconnectMutation` alias picked by provider. The single AlertDialogAction trigger uses `disabled={disconnectMutation.isPending}`, so the active route's `isPending` IS bound — the detector just doesn't follow the conditional-alias pattern.

### soft-delete-self (1)

- **F-MED-007** `apps/web/src/components/settings/gdpr-data-rights-section.tsx:63` — gdpr.requestErasure (missing-invalidation). _Why benign:_ Erasure soft-deletes the entire org — there are no queries left to invalidate because the user session ends and the next request hits the deleted-org branch. Intentional no-op.

### state-machine-progress (1)

- **F-LOW-004** `apps/web/src/components/payments/bank-statement-dialog.tsx:64` — payment.importStatement (missing-loading-state). _Why benign:_ Trigger is a `<input type="file">` whose onChange flips a state machine to `step = 'parsing'` before calling `mutate`. UI conditionally renders parsing/results/error views from `step`; there is no static Button to disable because the file input itself cannot be disabled mid-upload.

### status-based-isPending (1)

- **F-LOW-002** `apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx:27` — classificationDashboard.exportMarketCsv (missing-loading-state). _Why benign:_ Button has `disabled={isPending}` where `isPending = mutation.status === 'pending'` (line 48). The detector only matches the literal `<var>.isPending` property; the status-comparison alias is functionally identical.

### wizard-step-progression (5)

- **F-MED-008** `apps/web/src/components/zatca/compliance-checks.tsx:54` — zatca.runComplianceChecks (missing-invalidation). _Why benign:_ ZATCA wizard advances by re-querying getOnboardingState between steps, not by invalidating. UI is conditional on step state held in the parent form, so cache invalidation would be redundant.
- **F-MED-009** `apps/web/src/components/zatca/compliance-csid.tsx:70` — zatca.requestComplianceCsid (missing-invalidation). _Why benign:_ Same as zatca.runComplianceChecks — wizard step transitions drive the UI, not query invalidation.
- **F-MED-010** `apps/web/src/components/zatca/csr-generation.tsx:37` — zatca.generateCsr (missing-invalidation). _Why benign:_ Same as zatca.runComplianceChecks — wizard step transitions drive the UI, not query invalidation.
- **F-MED-011** `apps/web/src/components/zatca/production-certificate.tsx:38` — zatca.exchangeProductionCert (missing-invalidation). _Why benign:_ Same as zatca.runComplianceChecks — wizard step transitions drive the UI, not query invalidation.
- **F-MED-012** `apps/web/src/components/zatca/tax-details-form.tsx:61` — zatca.saveTaxDetails (missing-invalidation). _Why benign:_ Same as zatca.runComplianceChecks — wizard step transitions drive the UI, not query invalidation.

## Appendix C — Feature gaps

Procedures whose backend is production-ready but the matching FE / scheduler entry is still missing. These remain counted in the active HIGH/MED totals above; this appendix collects the proposed actions so they can be triaged into a follow-up backlog. Annotations live in `data/feature-gaps.json`.

### apiKey.update (missing-ui)

- **F-MED-001** `packages/api/src/routers/core/api-key.ts:133`
- _Summary:_ API-key admin UI exposes create / list / revoke but not update. The procedure validates input, scopes the lookup by organizationId, refuses to touch revoked keys, and writes an audit log on success — production-ready BE waiting for a settings tab affordance.
- _Proposed actions:_
  - Add a rename / scope-edit action to the apiKey row in apps/web/src/components/settings/api-keys-tab.tsx.
  - Invalidate trpc.apiKey.list on success (and keep the existing audit-log side-effect).

### featureFlags.list (missing-ui)

- **F-MED-003** `packages/api/src/routers/core/feature-flags.ts:19`
- _Summary:_ Self-hosted Unleash-backed flag introspection for the web dashboard. The appRouter procedure is wired (tenantFlaggedProcedure middleware) and the comment in root.ts marks it for the web dashboard, but no FE caller exists. The publicApiRouter sibling at packages/api/src/routers/public-api/feature-flags.ts is consumed by the REST route in apps/public-api/src/routes/feature-flags.ts; the two share the same dotted path but are wired into different routers.
- _Proposed actions:_
  - Expose under Settings → Admin (or a Flags tab) as a read-only matrix of the resolved Unleash state for the org.
  - Optional: surface in the AdminPanel debug drawer for support.
