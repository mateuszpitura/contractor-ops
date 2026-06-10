#!/usr/bin/env node
/**
 * One-shot codemod: point vitest mocks/imports at wired modules after
 * *-container.tsx removal. Run from repo root:
 *   node scripts/fix-web-vite-test-container-mocks.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'tinyglobby';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;

const PATH_REPLACEMENTS = [
  ['billing-overlay-container', 'billing-overlay'],
  ['billing-tab-container', 'billing-tab'],
  ['dashboard-home-container', 'dashboard-home'],
  ['kleinunternehmer-toggle-container', 'kleinunternehmer-toggle'],
  ['wizard-dialog-container', 'wizard-dialog'],
  ['template-picker-container', 'template-picker-dialog'],
  ['top-up-dialog-container', 'top-up-dialog'],
  ['proration-preview-container', 'proration-preview'],
  ['usage-dashboard-container', 'usage-dashboard'],
  ['drop-zone-container', 'drop-zone'],
  ['document-card-container', 'document-card'],
  ['send-for-signature-dialog-container', 'send-for-signature-dialog'],
  ['privacy-notice-pdf-download-container', 'privacy-notice-pdf-download'],
  ['peppol-wizard-container', 'peppol-wizard'],
  ['embedded-signing-modal-container', 'embedded-signing-modal'],
  ['carrier-credential-form-container', 'carrier-credential-form'],
  ['peppol-status-card-container', 'peppol-status-card'],
  ['zatca-status-card-container', 'zatca-status-card'],
  ['leitweg-id-create-dialog-container', 'leitweg-id-create-dialog'],
  ['intake-upload-dialog-container', 'intake-upload-dialog'],
  ['notification-popover-container', 'notification-popover'],
  ['command-palette-container', 'command-palette'],
  ['doc-links-section-container', 'doc-links-section'],
  ['linear-task-issue-chip-container', 'linear-task-issue-chip'],
  ['jira-task-config-container', 'jira-task-config'],
  ['linear-task-config-container', 'linear-task-config'],
  ['calendar-task-config-container', 'calendar-task-config'],
];

const EXPORT_REPLACEMENTS = [
  ['BillingOverlayContainer', 'BillingOverlay'],
  ['BillingTabContainer', 'BillingTab'],
  ['DashboardHomeContainer', 'DashboardHome'],
  ['KleinunternehmerToggleContainer', 'KleinunternehmerToggle'],
  ['ContractWizardDialogContainer', 'ContractWizardDialog'],
  ['TemplatePickerContainer', 'TemplatePickerDialog'],
  ['TopUpDialogContainer', 'TopUpDialog'],
  ['ProrationPreviewContainer', 'ProrationPreview'],
  ['UsageDashboardContainer', 'UsageDashboard'],
  ['DropZoneContainer', 'DropZone'],
  ['DocumentCardContainer', 'DocumentCard'],
  ['SendForSignatureDialogContainer', 'SendForSignatureDialog'],
  ['PrivacyNoticePdfDownloadContainer', 'PrivacyNoticePdfDownloadWired'],
  ['PeppolWizardContainer', 'PeppolWizard'],
  ['EmbeddedSigningModalContainer', 'EmbeddedSigningModalWired'],
  ['CarrierCredentialFormContainer', 'CarrierCredentialForm'],
  ['PeppolStatusCardContainer', 'PeppolStatusCard'],
  ['ZatcaStatusCardContainer', 'ZatcaStatusCard'],
  ['LeitwegIdCreateDialogContainer', 'LeitwegIdCreateDialog'],
  ['IntakeUploadDialogContainer', 'IntakeUploadDialog'],
  ['NotificationPopoverContainer', 'NotificationPopover'],
  ['CommandPaletteContainer', 'CommandPalette'],
  ['DocLinksSectionContainer', 'DocLinksSection'],
  ['LinearTaskIssueChipContainer', 'LinearTaskIssueChip'],
  ['JiraTaskConfigContainer', 'JiraTaskConfig'],
  ['LinearTaskConfigContainer', 'LinearTaskConfig'],
  ['CalendarTaskConfigContainer', 'CalendarTaskConfig'],
];

const files = globSync('**/*.{test,spec}.{ts,tsx}', { cwd: ROOT, absolute: true });

let touched = 0;
for (const abs of files) {
  let text = readFileSync(abs, 'utf8');
  const before = text;
  for (const [from, to] of PATH_REPLACEMENTS) {
    text = text.replaceAll(from, to);
  }
  for (const [from, to] of EXPORT_REPLACEMENTS) {
    text = text.replaceAll(from, to);
  }
  if (text !== before) {
    writeFileSync(abs, text);
    touched++;
  }
}

console.log(`fix-web-vite-test-container-mocks — updated ${touched} file(s)`);
