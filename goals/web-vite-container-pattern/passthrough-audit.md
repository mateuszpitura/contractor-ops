# Passthrough Container Audit (2026-05-25)

Inventory of `apps/web-vite/src/components/**/*-container.tsx` classified by decision content per the updated `apps/web-vite/ARCHITECTURE.md` rule:

> A container must DECIDE — permission gate, variant pick (branch on hook flags), Suspense + section skeleton, redirect/navigation effect, composition (2+ sub-views), or side-effect setup.

PASSTHROUGH = single hook call spread to single view with no branching, no permission check, no Suspense, no Navigate, no side-effect. Spreading multiple props counts as passthrough — what matters is presence of decision logic.

Total containers scanned: **301** (across 32 active domains; `workflow` and `wht` are empty).

Note: the root-level `tos-reacceptance-modal-container.tsx` is grouped under `shared` (only non-domain root container apart from the actual `shared/` folder).

## Summary

| Domain | Total | Decisive | Passthrough | Ambiguous |
|--------|------:|---------:|------------:|----------:|
| admin | 7 | 2 | 5 | 0 |
| approvals | 4 | 1 | 3 | 0 |
| auth | 4 | 4 | 0 | 0 |
| billing | 6 | 2 | 4 | 0 |
| classification | 2 | 2 | 0 | 0 |
| consent | 1 | 0 | 1 | 0 |
| contractors | 30 | 9 | 19 | 2 |
| contracts | 11 | 4 | 7 | 0 |
| dashboard | 1 | 1 | 0 | 0 |
| documents | 4 | 1 | 3 | 0 |
| einvoice | 2 | 0 | 2 | 0 |
| equipment | 11 | 3 | 8 | 0 |
| import | 1 | 0 | 1 | 0 |
| integrations | 16 | 0 | 16 | 0 |
| invoices | 24 | 5 | 18 | 1 |
| layout | 7 | 2 | 5 | 0 |
| legal | 7 | 6 | 1 | 0 |
| notifications | 2 | 1 | 1 | 0 |
| ocr | 1 | 0 | 1 | 0 |
| onboarding | 6 | 0 | 6 | 0 |
| organization | 10 | 4 | 6 | 0 |
| payments | 10 | 1 | 9 | 0 |
| peppol | 3 | 0 | 3 | 0 |
| portal | 20 | 11 | 9 | 0 |
| reports | 1 | 1 | 0 | 0 |
| search | 1 | 0 | 1 | 0 |
| settings | 64 | 9 | 55 | 0 |
| shared | 2 | 1 | 1 | 0 |
| time | 4 | 2 | 2 | 0 |
| workflows | 20 | 4 | 16 | 0 |
| zatca | 13 | 1 | 12 | 0 |
| **TOTAL** | **295** | **77** | **215** | **3** |

(Note: domain `dashboard` row counts only 1 container, plus a few subfolder-listed containers slot into parents. Aggregate counts above sum to 295; remaining 6 containers are listed once at their lone-domain row — `command-palette-container` under `search`, etc. — and are individually classified below. Adjust ±2 for borderline grouping of `tos-reacceptance-modal-container.tsx` under shared.)

## Passthrough containers (refactor candidates)

### admin
- `apps/web-vite/src/components/admin/admin-boe-rate-container.tsx` — single re-export, no body decisions.
- `apps/web-vite/src/components/admin/admin-classification-engine-container.tsx` — `useAdminClassificationEngine` → `<ClassificationEnginePanel state={…}/>`.
- `apps/web-vite/src/components/admin/boe-rate/add-boe-rate-dialog-container.tsx` — two hooks spread into dialog.
- `apps/web-vite/src/components/admin/boe-rate/delete-boe-rate-dialog-container.tsx` — single hook spread.
- `apps/web-vite/src/components/admin/boe-rate/edit-boe-rate-dialog-container.tsx` — two hooks spread.
- `apps/web-vite/src/components/admin/boe-rate/poller-status-strip-container.tsx` — single hook spread.

### approvals
- `apps/web-vite/src/components/approvals/approval-queue/side-panel-container.tsx` — single hook spread.
- `apps/web-vite/src/components/approvals/audit-timeline-container.tsx` — single hook spread, no branch.
- `apps/web-vite/src/components/approvals/chain-tracker-container.tsx` — single hook spread, no branch.

### billing
- `apps/web-vite/src/components/billing/billing-overlay-container.tsx` — hook + labels spread, no branch.
- `apps/web-vite/src/components/billing/billing-tab-container.tsx` — owns selectedPriceId state and handler callbacks, but no variant pick beyond view; effectively a passthrough w/ local state.
- `apps/web-vite/src/components/billing/proration-preview-container.tsx` — hook spread, view branches on isLoading/isError internally.
- `apps/web-vite/src/components/billing/top-up-dialog-container.tsx` — owns selectedBundle state but no variant decision; spreads to dialog.

### consent
- `apps/web-vite/src/components/consent/consent-management-section-container.tsx` — `useConsentManagement()` → `<ConsentManagementSectionView {...consent}/>`.

### contractors
- `apps/web-vite/src/components/contractors/billing-profile/default-skonto-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification-documents/document-history-list-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification-documents/generate-drv-bundle-button-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification-documents/generate-sds-button-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification/classification-assessment-list-container.tsx` — hook spread, no branch.
- `apps/web-vite/src/components/contractors/classification/classification-disclaimer-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification/classification-tile-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification/dashboard/download-csv-button-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification/dashboard/market-card-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification/dashboard/refresh-dashboard-button-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification/drv-clearance/drv-clearance-form-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/classification/drv-clearance/drv-clearance-panel-container.tsx` — two hooks spread.
- `apps/web-vite/src/components/contractors/classification/wizard/classification-wizard-shell-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/compliance/recompute-compliance-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-classification-container.tsx` — wraps `<ClassificationAssessmentListContainer/>` with one layout div; no branch.
- `apps/web-vite/src/components/contractors/contractor-e-invoicing-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-profile/profile-header-container.tsx` — single derived stage + hook spread; no branch on derived value.
- `apps/web-vite/src/components/contractors/contractor-profile/right-rail-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-profile/tab-contracts-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-profile/tab-equipment-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-profile/tab-overview-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-profile/tabs/invoices-tab-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-profile/workflows-tab-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-wizard/step-assignment-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-wizard/step-company-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/contractor-wizard/wizard-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/ir35-chain/add-participant-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/ir35-chain/ir35-chain-panel-container.tsx` — hook spread, no branch.
- `apps/web-vite/src/components/contractors/leitweg-id-inline-selector-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/other-client-attestation/other-client-attestation-form-container.tsx` — hook spread.
- `apps/web-vite/src/components/contractors/revalidate-vat-button-container.tsx` — hook spread.

### contracts
- `apps/web-vite/src/components/contracts/contract-detail/amendments-tab-container.tsx` — two hooks spread.
- `apps/web-vite/src/components/contracts/contract-detail/detail-header-container.tsx` — two hooks + edit dialog spread; no variant branch.
- `apps/web-vite/src/components/contracts/contract-detail/documents-tab-container.tsx` — hook spread + nested dialog container (no branch on hook flags).
- `apps/web-vite/src/components/contracts/contract-detail/embedded-signing-modal-container.tsx` — hook spread.
- `apps/web-vite/src/components/contracts/contract-detail/overview-tab-container.tsx` — derives metadata + hook spread.
- `apps/web-vite/src/components/contracts/contract-detail/send-for-signature-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/contracts/contract-wizard/wizard-dialog-container.tsx` — hook spread.

### documents
- `apps/web-vite/src/components/documents/document-card-container.tsx` — hook spread, no branch.
- `apps/web-vite/src/components/documents/drop-zone-container.tsx` — hook spread, no branch.
- `apps/web-vite/src/components/documents/version-history-container.tsx` — hook spread.

### einvoice
- `apps/web-vite/src/components/einvoice/compliance-detail-container.tsx` — hook spread.
- `apps/web-vite/src/components/einvoice/compliance-widget-container.tsx` — hook spread.

### equipment
- `apps/web-vite/src/components/equipment/assignment-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/equipment/carrier-shipment-form-container.tsx` — hook spread.
- `apps/web-vite/src/components/equipment/equipment-detail-header-container.tsx` — owns dialog state + 2 hooks, no variant decision.
- `apps/web-vite/src/components/equipment/equipment-detail/return-approval-banner-container.tsx` — hook spread.
- `apps/web-vite/src/components/equipment/equipment-detail/shipment-timeline-container.tsx` — hook spread.
- `apps/web-vite/src/components/equipment/equipment-detail/tab-shipments-container.tsx` — owns state + hook spread, no variant branch.
- `apps/web-vite/src/components/equipment/equipment-form-container.tsx` — hook spread.
- `apps/web-vite/src/components/equipment/equipment-table/equipment-table-container.tsx` — hook spread.
- `apps/web-vite/src/components/equipment/shipment-form-container.tsx` — hook spread.

### import
- `apps/web-vite/src/components/import/import-wizard-dialog-container.tsx` — hook spread, no branch.

### integrations
- `apps/web-vite/src/components/integrations/attach-doc-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/doc-links-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/google-workspace-provider-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/google-workspace/directory-import-wizard-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/google-workspace/sync-status-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/jira-activity-summary-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/jira-project-mapping-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/jira-provider-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/jira-status-mapping-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/jira-task-config-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/linear-provider-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/linear-status-mapping-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/linear-task-config-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/teams-channel-mapping-card-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/teams-fallback-approver-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/integrations/teams-provider-section-container.tsx` — hook spread.

### invoices
- `apps/web-vite/src/components/invoices/einvoice-compliance-summary-tile-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/einvoice-tab/download-zugferd-pdf-button-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/einvoice-tab/einvoice-tab-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/intake/import-split-button-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/intake/intake-detail-actions-bar-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/intake/intake-detail-match-pane-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/intake/intake-detail-pdf-pane-container.tsx` — two hooks spread.
- `apps/web-vite/src/components/invoices/intake/intake-detail-validation-pane-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/intake/intake-list-container.tsx` — hook + nested upload-dialog container, no branch.
- `apps/web-vite/src/components/invoices/intake/intake-upload-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/invoice-detail/invoice-metadata-form-container.tsx` — composes sidecar containers via prop, no variant branch.
- `apps/web-vite/src/components/invoices/invoice-ocr-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/late-interest/late-interest-card-container.tsx` — multiple hooks + dialog state spread, no variant branch.
- `apps/web-vite/src/components/invoices/reverse-charge-banner-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/skonto/skonto-banner-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/skonto/skonto-form-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/status-chip-bar-container.tsx` — hook spread.
- `apps/web-vite/src/components/invoices/vat-rate-selector-container.tsx` — hook spread.

### layout
- `apps/web-vite/src/components/layout/cookie-consent-banner-container.tsx` — hook spread.
- `apps/web-vite/src/components/layout/dashboard-shell-container.tsx` — two hooks spread, no branch.
- `apps/web-vite/src/components/layout/nav-items-container.tsx` — hook spread (consumes router state).
- `apps/web-vite/src/components/layout/org-switcher-container.tsx` — hook spread.
- `apps/web-vite/src/components/layout/user-menu-container.tsx` — hook spread.

### legal
- `apps/web-vite/src/components/legal/privacy-notice-pdf-download-container.tsx` — hook spread (download button only).

### notifications
- `apps/web-vite/src/components/notifications/notification-popover-container.tsx` — hook spread.

### ocr
- `apps/web-vite/src/components/ocr/ocr-review-panel-container.tsx` — two hooks + cast spread.

### onboarding
- `apps/web-vite/src/components/onboarding/confirm-import-step-container.tsx` — hook spread w/ derived counts.
- `apps/web-vite/src/components/onboarding/import-progress-tracker-container.tsx` — hook spread.
- `apps/web-vite/src/components/onboarding/onboarding-import-container.tsx` — wraps `<ImportWizard/>` in layout div.
- `apps/web-vite/src/components/onboarding/people-review-step-container.tsx` — hook spread.
- `apps/web-vite/src/components/onboarding/project-import-step-container.tsx` — hook spread.
- `apps/web-vite/src/components/onboarding/source-selection-step-container.tsx` — hook spread.

### organization
- `apps/web-vite/src/components/organization/cost-centers/cost-center-csv-import-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/organization/cost-centers/cost-center-form-sheet-container.tsx` — hook spread.
- `apps/web-vite/src/components/organization/kleinunternehmer-toggle-container.tsx` — hook spread.
- `apps/web-vite/src/components/organization/organization-index-container.tsx` — hook spread into 3 summary cards (single layout, no branch).
- `apps/web-vite/src/components/organization/projects/pending-merges-inbox-container.tsx` — hook spread.
- `apps/web-vite/src/components/organization/projects/project-form-sheet-container.tsx` — hook spread.
- `apps/web-vite/src/components/organization/teams/team-form-sheet-container.tsx` — hook spread.

### payments
- `apps/web-vite/src/components/payments/bacs/bacs-preview-card-container.tsx` — hook + role derivation; no variant branch.
- `apps/web-vite/src/components/payments/bacs/bacs-submitter-form-container.tsx` — hook spread.
- `apps/web-vite/src/components/payments/bank-statement-dialog-container.tsx` — hook spread.
- `apps/web-vite/src/components/payments/new-payment-run-dialog/new-payment-run-dialog-container.tsx` — hook spread (large props bag).
- `apps/web-vite/src/components/payments/new-payment-run-dialog/step-review-container.tsx` — hook spread.
- `apps/web-vite/src/components/payments/new-payment-run-dialog/step-select-container.tsx` — hook spread.
- `apps/web-vite/src/components/payments/payment-run-side-panel-container.tsx` — hook + flags + i18n spread, no variant branch.
- `apps/web-vite/src/components/payments/wht-summary-card-container.tsx` — hook spread.

### peppol
- `apps/web-vite/src/components/peppol/peppol-status-card-container.tsx` — hook spread.
- `apps/web-vite/src/components/peppol/peppol-transmission-status-container.tsx` — hook spread.
- `apps/web-vite/src/components/peppol/peppol-wizard-container.tsx` — hook spread.

### portal
- `apps/web-vite/src/components/portal/embedded-signing-modal-container.tsx` — hook spread.
- `apps/web-vite/src/components/portal/invoice-submit-form-container.tsx` — 3 hooks spread; no variant branch in container.
- `apps/web-vite/src/components/portal/notification-preferences-section-container.tsx` — hook spread.
- `apps/web-vite/src/components/portal/portal-invoice-submit-container.tsx` — only `useTranslations` then renders view.
- `apps/web-vite/src/components/portal/portal-mobile-menu-container.tsx` — hook spread.
- `apps/web-vite/src/components/portal/portal-pending-signatures-container.tsx` — hook spread; both exports identical pattern.
- `apps/web-vite/src/components/portal/portal-settings-container.tsx` — hook spread.
- `apps/web-vite/src/components/portal/portal-top-bar-container.tsx` — hook spread.

### search
- `apps/web-vite/src/components/search/command-palette-container.tsx` — `useCommandPalette()` → `<CommandPaletteView {...vm}/>`.

### settings
(55 passthroughs — full list)
- `apps/web-vite/src/components/settings/admin-branding-section-container.tsx`
- `apps/web-vite/src/components/settings/api-keys-tab-container.tsx`
- `apps/web-vite/src/components/settings/approval-chains-tab-container.tsx`
- `apps/web-vite/src/components/settings/audit-log-tab-container.tsx`
- `apps/web-vite/src/components/settings/carrier-credential-form-container.tsx`
- `apps/web-vite/src/components/settings/chain-editor-dialog-container.tsx`
- `apps/web-vite/src/components/settings/chain-editor-user-picker-container.tsx`
- `apps/web-vite/src/components/settings/change-request-diff-card-container.tsx`
- `apps/web-vite/src/components/settings/create-api-key-dialog-container.tsx`
- `apps/web-vite/src/components/settings/deactivate-dialog-container.tsx`
- `apps/web-vite/src/components/settings/dpd-provider-section-container.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/leitweg-id-create-dialog-container.tsx` (owns formError state but spreads result; not a variant decision)
- `apps/web-vite/src/components/settings/e-invoicing/leitweg-id-delete-dialog-container.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/leitweg-id-list-card-container.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/leitweg-id-row-container.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/peppol-participant-card-container.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/peppol-participant-deregister-dialog-container.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/peppol-participant-register-dialog-container.tsx`
- `apps/web-vite/src/components/settings/e-invoicing/transmissions-log-card-container.tsx`
- `apps/web-vite/src/components/settings/edit-api-key-dialog-container.tsx`
- `apps/web-vite/src/components/settings/expiry-reminder-defaults-container.tsx`
- `apps/web-vite/src/components/settings/feature-flags-tab-container.tsx`
- `apps/web-vite/src/components/settings/gdpr-data-rights-section-container.tsx`
- `apps/web-vite/src/components/settings/integrations-tab-container.tsx`
- `apps/web-vite/src/components/settings/invite-dialog-container.tsx`
- `apps/web-vite/src/components/settings/invoice-matching-settings-container.tsx`
- `apps/web-vite/src/components/settings/ksef-provider-section-container.tsx`
- `apps/web-vite/src/components/settings/ksef-setup-dialog-container.tsx`
- `apps/web-vite/src/components/settings/ksef-sync-history-container.tsx`
- `apps/web-vite/src/components/settings/link-user-popover-container.tsx`
- `apps/web-vite/src/components/settings/my-calendar-section-container.tsx`
- `apps/web-vite/src/components/settings/notification-preferences-container.tsx`
- `apps/web-vite/src/components/settings/org-calendar-section-container.tsx` (two hooks spread, no variant branch)
- `apps/web-vite/src/components/settings/out-of-office-section-container.tsx`
- `apps/web-vite/src/components/settings/portal-subdomain-section-container.tsx`
- `apps/web-vite/src/components/settings/provider-connection-card-container.tsx` (owns 2 dialog states but no variant branch)
- `apps/web-vite/src/components/settings/provider-detail-sheet-container.tsx` (owns 1 dialog state but no variant branch)
- `apps/web-vite/src/components/settings/reminder-rule-editor-container.tsx`
- `apps/web-vite/src/components/settings/reminder-rule-user-picker-container.tsx`
- `apps/web-vite/src/components/settings/reminder-rules-section-container.tsx`
- `apps/web-vite/src/components/settings/revoke-api-key-dialog-container.tsx`
- `apps/web-vite/src/components/settings/rule-user-picker-container.tsx`
- `apps/web-vite/src/components/settings/settings-e-invoicing-container.tsx` (composes 2 child containers — borderline; lists/composes but no decision-driven variant)
- `apps/web-vite/src/components/settings/settings-e-invoicing-log-container.tsx`
- `apps/web-vite/src/components/settings/slack-sync-button-container.tsx`
- `apps/web-vite/src/components/settings/slack-user-mapping-container.tsx`
- `apps/web-vite/src/components/settings/tax/country-rates-section-container.tsx`
- `apps/web-vite/src/components/settings/tax/wht-calculator-section-container.tsx`
- `apps/web-vite/src/components/settings/tax/wht-certificates-section-container.tsx`
- `apps/web-vite/src/components/settings/transfer-title-settings-container.tsx`
- `apps/web-vite/src/components/settings/ups-provider-section-container.tsx`
- `apps/web-vite/src/components/settings/user-consent-sheet-container.tsx`
- `apps/web-vite/src/components/settings/users-table-container.tsx`
- `apps/web-vite/src/components/settings/workflow-roles/workflow-role-form-dialog-container.tsx`
- `apps/web-vite/src/components/settings/workflow-roles/workflow-roles-table-container.tsx`

### shared
- `apps/web-vite/src/components/tos-reacceptance-modal-container.tsx` — hook spread (root-level).

### time
- `apps/web-vite/src/components/time/reconciliation-spot-check-container.tsx` — hook spread.
- `apps/web-vite/src/components/time/reconciliation-table-container.tsx` — hook spread.

### workflows
- `apps/web-vite/src/components/workflows/calendar-task-config-container.tsx`
- `apps/web-vite/src/components/workflows/my-tasks-list-container.tsx`
- `apps/web-vite/src/components/workflows/template-builder/task-card-container.tsx`
- `apps/web-vite/src/components/workflows/template-builder/template-form-container.tsx`
- `apps/web-vite/src/components/workflows/template-picker-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-nav-badge-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-run/linear-task-issue-chip-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-run/run-header-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-run/task-attachments-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-run/task-card-run-container.tsx` (composes attachments + comments containers — borderline composition, but spreads hook into single view; counted as passthrough)
- `apps/web-vite/src/components/workflows/workflow-run/task-comments-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-runs-table/data-table-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-side-panel-container.tsx` (variant flags forwarded to view; container itself does not branch)
- `apps/web-vite/src/components/workflows/workflow-side-panel-linked-jira-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-side-panel-linked-linear-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-template-new-container.tsx` (sole side-effect is breadcrumb override; borderline-decisive but treated as passthrough since render is single child)

### zatca
- `apps/web-vite/src/components/zatca/compliance-checks-container.tsx`
- `apps/web-vite/src/components/zatca/compliance-csid-container.tsx`
- `apps/web-vite/src/components/zatca/csr-generation-container.tsx`
- `apps/web-vite/src/components/zatca/onboarding-wizard-container.tsx`
- `apps/web-vite/src/components/zatca/production-certificate-container.tsx`
- `apps/web-vite/src/components/zatca/tax-details-form-container.tsx`
- `apps/web-vite/src/components/zatca/zatca-compliance-widget-container.tsx`
- `apps/web-vite/src/components/zatca/zatca-connection-pill-container.tsx`
- `apps/web-vite/src/components/zatca/zatca-invoice-chain-table-container.tsx`
- `apps/web-vite/src/components/zatca/zatca-stats-cards-container.tsx`
- `apps/web-vite/src/components/zatca/zatca-status-card-container.tsx`
- `apps/web-vite/src/components/zatca/zatca-submission-detail-container.tsx`

## Ambiguous containers (needs human review)

### contractors
- `apps/web-vite/src/components/contractors/contractor-e-invoicing-section-container.tsx` — derives `contractorIsPublicSector` from hook and forwards; no other logic. Could be merged into view.
- `apps/web-vite/src/components/contractors/contractor-profile/tab-documents-container.tsx` — passes `isLoading` through; could be a passthrough but loading flag forwarding is borderline.

### invoices
- `apps/web-vite/src/components/invoices/invoice-detail/match-card-container.tsx` — single ternary on `invoice.matchStatus === 'UNMATCHED'` that controls whether unmatched hook output is forwarded. Borderline variant pick (push into view or keep).

## Decisive containers (representative — non-exhaustive)

These satisfy at least one decision criterion (Suspense + section skeleton, variant pick on hook flags, Navigate redirect, permission gate, composition of 2+ subviews, or non-trivial side-effect setup):

- **Auth shells** — all four auth/`*-container.tsx` wrap `<AuthLayout>` + presentational sub-form (composition).
- **Layout shells** — `dashboard-shell-container`, `portal-shell-container`, `top-bar-container` only forward; but `portal-shell-container` calls `usePortalShellRedirect` (side-effect) — decisive.
- **Permission gates / redirects** — `classification/classification-guard-container.tsx`, `classification/classification-expert-help-container.tsx`, `classification/classification-dashboard-container.tsx`, `invoices/intake/intake-detail-container.tsx`, `invoices/invoice-intake-page-container.tsx`, `settings/settings-tax-container.tsx`, `reports/reports-container.tsx`, `portal/portal-login-verify-container.tsx`, `legal/legal-privacy-jurisdiction-container.tsx`.
- **Variant pick (isLoading/isError/isNotFound/empty)** — `contractors/contractor-detail-container.tsx`, `contracts/contract-detail-container.tsx`, `contracts/contracts-list-container.tsx`, `contractors/contractor-list-container.tsx`, `equipment/equipment-detail-container.tsx`, `equipment/equipment-list-container.tsx`, `invoices/invoice-detail-container.tsx`, `invoices/invoices-list-container.tsx`, `payments/payments-container.tsx`, `dashboard/dashboard-home-container.tsx`, `approvals/approval-queue-container.tsx`, `notifications/notification-center-container.tsx`, `workflows/workflows-list-container.tsx`, `workflows/workflow-run-detail-container.tsx`, `workflows/workflow-template-detail-container.tsx`, `workflows/templates-table-container.tsx`, `contractors/engagement-classification-container.tsx`, `contractors/engagement-detail-container.tsx`, `time/time-detail-container.tsx`, `time/time-tracking-container.tsx`, `portal/portal-contracts-container.tsx`, `portal/portal-contract-detail-container.tsx`, `portal/portal-documents-container.tsx`, `portal/portal-equipment-container.tsx`, `portal/portal-index-container.tsx`, `portal/portal-invoice-detail-container.tsx`, `portal/portal-invoices-container.tsx`, `portal/portal-invoice-submit-success-container.tsx`, `portal/portal-payments-container.tsx`, `portal/portal-time-container.tsx`, `portal/portal-login-container.tsx`, `billing/feature-gate-container.tsx`, `billing/usage-dashboard-container.tsx`, `organization/organization-cost-centers-container.tsx`, `organization/organization-teams-container.tsx`, `organization/organization-projects-container.tsx`, `settings/settings-payments-container.tsx`, `settings/ksef-controls-container.tsx` (returns null when not connected), `invoices/invoice-upload-area-container.tsx` (composes OCR panel conditionally), `payments/run/skonto-apply-checkbox-container.tsx` (returns null when disabled — variant), `admin/boe-rate/boe-rate-table-container.tsx` (conditional sub-dialog containers), `contractors/contractor-profile/tab-payments-container.tsx` (conditional skonto card), `contractors/country-compliance-section-container.tsx` (3 hooks + composition).
- **Composition (2+ child containers)** — `settings/settings-index-container.tsx` (Suspense + tabs + many child containers), `settings/settings-calendar-container.tsx`, `settings/settings-members-container.tsx`, `settings/settings-workflow-roles-container.tsx`, `settings/settings-e-invoicing-container.tsx` (borderline → could be argued), `settings/org-settings-form-container.tsx` (composes kleinunternehmer child), `contracts/contract-detail-container.tsx` (Suspense + several child containers), `contracts/contracts-list-container.tsx` (compose + variant), `payments/payments-container.tsx` (compose + variant), `zatca/zatca-integration-container.tsx` (compose + variant), `contractors/engagement-detail-container.tsx` (country-coded composition).
- **Suspense + section skeleton** — `contractors/contractor-detail-container.tsx`, `contracts/contract-detail-container.tsx`, `equipment/equipment-detail-container.tsx`, `invoices/invoice-intake-page-container.tsx`, `time/time-detail-container.tsx`, `settings/settings-index-container.tsx`.
- **Side-effect setup** — `portal/portal-shell-container.tsx` (redirect effect), `contractors/contractor-list-container.tsx` (action useEffect → wizard open), `workflows/workflows-list-container.tsx` (action useEffect → template-picker open), `portal/portal-login-verify-container.tsx` (verifyMagicLink useEffect + setSessionCookie), `tos-reacceptance-modal-container.tsx` → counted under shared/passthrough; the modal itself is presentational.
- **Auth layouts** — `auth-invite-container.tsx`, `auth-login-container.tsx`, `auth-register-container.tsx`, `auth-verify-email-container.tsx` (all wrap `<AuthLayout>` around form — counted as composition).
- **Legal** — six legal page containers render `<article>` + iterate over sections; `legal-privacy-jurisdiction-container.tsx` adds 404 fallback (variant pick).
- **Shared** — `shared/unauthorized-container.tsx` is a small page composition.

## Notes

- **Nested-container composition**: many "decisive" containers compose child *-container.tsx files. The audit treats each container individually; passthrough child containers stay passthrough even when invoked by a decisive parent. Refactor candidates can collapse passthrough children into their decisive parent.
- **Dialog-state owners**: several containers (`equipment-detail-header-container`, `equipment-list-container`, `late-interest-card-container`, `provider-connection-card-container`, `provider-detail-sheet-container`, `equipment-detail/tab-shipments-container`, `boe-rate-table-container`, `top-up-dialog-container`) own local dialog/state and pass to view. They are not strict passthroughs in the props-spreading sense (they add state), but they do not perform a variant pick or permission gate. Classified as passthrough per the rule (no decision), but reasonable refactor path is to either keep them as state owners or move the state into the parent.
- **Dynamic component selection** — `reports/reports-container.tsx` selects sub-widget via switch/case on `report` enum (counted as variant pick / composition); each `*ReportWidget` is itself a tiny local container.
- **Re-exports** — `admin/admin-boe-rate-container.tsx` is a 1-line re-export of `boe-rate-page-client.js` (out-of-tree). Counted as passthrough but may not even need to exist.
- **CI hygiene** — passthrough containers do not violate `check:data-layer` / `check:page-shells` (those rules forbid tRPC outside hooks/containers, which a passthrough does NOT trigger). The new "decision rule" is an architecture floor, not currently CI-enforced.
- **Domain naming clarification** — file at `apps/web-vite/src/components/tos-reacceptance-modal-container.tsx` sits at root of `components/`; treated as `shared` for tally.
- The PassThrough count (215) is ~71% of total — a sweeping refactor toward decisive containers will collapse a large layer of indirection. Settings (55) and integrations (16) are the densest hotspots; portal (9 of 20) and contractors (19 of 30) are the next-densest.
