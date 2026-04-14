import { router } from './init.js';
import { apiKeyRouter } from './routers/api-key.js';
import { approvalRouter } from './routers/approval.js';
import { auditRouter } from './routers/audit.js';
import { billingRouter } from './routers/billing.js';
import { calendarRouter } from './routers/calendar.js';
import { classificationRouter } from './routers/classification.js';
import { classificationDocumentRouter } from './routers/classification-document.js';
import { consentRouter } from './routers/consent.js';
import { contractRouter } from './routers/contract.js';
import { contractorRouter } from './routers/contractor.js';
import { dashboardRouter } from './routers/dashboard.js';
import { docsRouter } from './routers/docs.js';
import { economicDependencyAlertRouter } from './routers/economic-dependency-alert.js';
import { documentRouter } from './routers/document.js';
import { einvoiceRouter } from './routers/einvoice.js';
import { equipmentRouter } from './routers/equipment.js';
import { esignRouter } from './routers/esign.js';
import { exchangeRateRouter } from './routers/exchange-rate.js';
import { featureFlagsRouter } from './routers/feature-flags.js';
import { gdprRouter } from './routers/gdpr.js';
import { googleWorkspaceRouter } from './routers/google-workspace.js';
import { importRouter } from './routers/import.js';
import { integrationRouter } from './routers/integration.js';
import { invoiceRouter } from './routers/invoice.js';
import { ir35ChainRouter } from './routers/ir35-chain.js';
import { ir35AttestationRouter } from './routers/ir35-other-client-attestation.js';
import { jiraRouter } from './routers/jira.js';
import { ksefRouter } from './routers/ksef.js';
import { legalRouter } from './routers/legal.js';
import { leitwegIdRouter } from './routers/leitweg-id.js';
import { linearRouter } from './routers/linear.js';
import { notificationRouter } from './routers/notification.js';
import { ocrRouter } from './routers/ocr.js';
import { onboardingImportRouter } from './routers/onboarding-import.js';
import { organizationRouter } from './routers/organization.js';
import { paymentRouter } from './routers/payment.js';
import { peppolRouter } from './routers/peppol.js';
import { portalRouter } from './routers/portal.js';
import { portalTimeRouter } from './routers/portal-time.js';
import { reassessmentTriggerRouter } from './routers/reassessment-trigger.js';
import { reminderRouter } from './routers/reminder.js';
import { reportRouter } from './routers/report.js';
import { searchRouter } from './routers/search.js';
import { settingsRouter } from './routers/settings.js';
import { taxRouter } from './routers/tax.js';
import { teamsRouter } from './routers/teams.js';
import { timeRouter } from './routers/time.js';
import { userRouter } from './routers/user.js';
import { workflowRouter } from './routers/workflow.js';
import { zatcaRouter } from './routers/zatca.js';

/**
 * Root tRPC router merging all sub-routers.
 * All procedures are organized by domain:
 * - organization: create, getCurrent, update
 * - user: list, invite, updateRole, deactivate, reactivate
 * - settings: get, update
 * - contractor: CRUD, list, lifecycle, compliance health, GUS lookup, bulk ops, export
 * - contract: CRUD, list with FTS, status transitions, amendments, expiry config
 * - document: upload/download with presigned URLs, versioning, entity linking, virus scanning
 * - workflow: template CRUD, run lifecycle, task actions, comments, overdue detection
 * - invoice: CRUD, list, auto/manual matching, status transitions, duplicate handling
 * - approval: chain config CRUD, approval queue, approve/reject/delegate/clarify, bulk ops, submit-for-approval, audit trail
 * - notification: list, unread count, mark read, preferences CRUD
 * - reminder: reminder rule CRUD, toggle active, cascade delete instances
 * - integration: Slack OAuth, connection status, user mappings, link/unlink, sync
 * - payment: run CRUD, lock+export (CSV/Elixir/SEPA), status tracking, bank statement import, contractor payment history
 * - dashboard: KPIs, spend trend, deadlines, activity feed
 * - report: spend by contractor/team, expiring contracts, overdue invoices, compliance gaps + chart variants + export mutations
 * - audit: audit log list with search/filter/pagination, actors dropdown, CSV export
 * - import: CSV/XLSX import with parse, validate, commit endpoints for contractors and contracts
 * - search: unified cross-entity global search via tsvector (contractors, contracts, invoices)
 * - portalTime: time entry CRUD, submit, external sync for portal contractors
 * - time: manager timesheet review, approve/reject, bulk operations
 * - jira: Jira Cloud integration — connection, projects, issue types, status mapping, task config, linked issues
 * - calendar: Google/Outlook calendar connections, deadline sync, task config CRUD
 * - billing: Stripe subscription management, checkout, portal, plan config
 * - equipment: CRUD, assignment, shipment tracking, status management, contractor equipment view
 */
export const appRouter = router({
  apiKey: apiKeyRouter, // apiKey: Enterprise API key management — create, list, update, revoke
  organization: organizationRouter,
  user: userRouter,
  settings: settingsRouter,
  contractor: contractorRouter,
  contract: contractRouter,
  document: documentRouter,
  workflow: workflowRouter,
  invoice: invoiceRouter,
  approval: approvalRouter,
  notification: notificationRouter,
  reminder: reminderRouter,
  integration: integrationRouter,
  payment: paymentRouter,
  dashboard: dashboardRouter,
  report: reportRouter,
  audit: auditRouter,
  import: importRouter,
  search: searchRouter,
  portal: portalRouter,
  esign: esignRouter,
  ocr: ocrRouter,
  ksef: ksefRouter,
  legal: legalRouter, // legal: GDPR privacy notice PDF downloads (IDOR-safe, session-derived jurisdiction)
  portalTime: portalTimeRouter,
  time: timeRouter,
  jira: jiraRouter,
  linear: linearRouter, // linear: Linear integration -- connection, teams, status mapping, task config, linked issues
  docs: docsRouter,
  calendar: calendarRouter,
  billing: billingRouter,
  equipment: equipmentRouter,
  googleWorkspace: googleWorkspaceRouter, // Google Workspace directory import, group resolution, bulk import, sync
  gdpr: gdprRouter, // GDPR: right to erasure (Art. 17), data portability/export (Art. 20)
  teams: teamsRouter, // Microsoft Teams integration -- channel discovery, channel mapping, connection status
  onboardingImport: onboardingImportRouter, // onboardingImport: Cross-tool import wizard -- source discovery, user merge, project import, async progress
  einvoice: einvoiceRouter, // einvoice: E-invoicing compliance statuses per country profile
  leitwegId: leitwegIdRouter, // leitwegId: German public-sector Leitweg-ID CRUD + contractor/contract default resolution (Phase 61 EINV-05)
  exchangeRate: exchangeRateRouter, // exchangeRate: Daily ECB exchange rates — query, convert, cron fetch
  featureFlags: featureFlagsRouter, // featureFlags: Self-hosted Unleash-backed flag introspection for the web dashboard
  consent: consentRouter, // consent: PDPL consent management — privacy notices, per-purpose consent, admin audit
  peppol: peppolRouter, // peppol: Peppol network integration — participant registration, transmission tracking, ASP management
  tax: taxRouter, // tax: Tax rate lookup, VAT validation, WHT calculation, WHT certificates, tax summary dashboard
  zatca: zatcaRouter, // zatca: ZATCA device onboarding — tax details, CSR generation, compliance CSID, compliance checks, production cert
  classification: classificationRouter, // classification: IR35 + Scheinselbständigkeit engagement classification — draft/autosave/submit/outcome (Phase 58)
  classificationDocument: classificationDocumentRouter, // classificationDocument: IR35 SDS + DRV defense bundle PDFs — append-only, content-addressed R2 (Phase 59)
  ir35Chain: ir35ChainRouter, // ir35Chain: IR35 chain participant tracking + SDS delivery / acknowledgement (Phase 59 CLASS-04)
  ir35Attestation: ir35AttestationRouter, // ir35Attestation: contractor other-client attestation + same-tenant cross-reference for DRV defense bundle (Phase 59 CLASS-06)
  economicDependencyAlert: economicDependencyAlertRouter, // economicDependencyAlert: per-assignment billing-share band (safe/warning/critical) written by the daily §2 SGB VI scan (Phase 60 CLASS-07)
  reassessmentTrigger: reassessmentTriggerRouter, // reassessmentTrigger: IR35 SDS reassessment triggers — AuditLog-driven material-change detection + acknowledge/dismiss (Phase 60 CLASS-08)
});

/** Type-safe router type for client consumption */
export type AppRouter = typeof appRouter;
