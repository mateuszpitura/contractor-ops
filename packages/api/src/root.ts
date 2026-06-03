import { buildFlagBag } from '@contractor-ops/feature-flags';
import { router } from './init';
import {
  classificationDashboardRouter,
  classificationDocumentRouter,
  classificationRouter,
  complianceAdminRouter,
  consentRouter,
  economicDependencyAlertRouter,
  gdprRouter,
  ir35AttestationRouter,
  ir35ChainRouter,
  reassessmentTriggerRouter,
  statusfeststellungsverfahrenRouter,
  zatcaRouter,
} from './routers/compliance/index';
import {
  adminBoeRateRouter,
  apiKeyRouter,
  approvalRouter,
  auditRouter,
  authPermissionsRouter,
  calendarRouter,
  contractorRouter,
  contractRouter,
  costCenterRouter,
  dashboardRouter,
  docsRouter,
  documentRouter,
  einvoiceRouter,
  esignRouter,
  featureFlagsRouter,
  importRouter,
  integrationRouter,
  legalRouter,
  leitwegIdRouter,
  notificationRouter,
  ocrRouter,
  onboardingImportRouter,
  organizationRouter,
  projectRouter,
  reminderRouter,
  reportRouter,
  searchRouter,
  settingsRouter,
  taxRouter,
  teamRouter,
  timeRouter,
  userRouter,
} from './routers/core/index';
import { equipmentRouter } from './routers/equipment/index';
import {
  bacsRouter,
  billingRouter,
  exchangeRateRouter,
  invoiceIntakeRouter,
  invoiceRouter,
  latePaymentInterestRouter,
  paymentRouter,
  skontoRouter,
} from './routers/finance/index';
import { gulfRouter } from './routers/gulf/index';
import {
  deprovisioningRouter,
  googleWorkspaceRouter,
  jiraRouter,
  ksefRouter,
  linearRouter,
  peppolRouter,
  teamsRouter,
} from './routers/integrations/index';
// portalRouter and portalTimeRouter are exposed via `portalAppRouter` (see ./portal-root.ts)
// at the /api/trpc/portal endpoint — kept out of `appRouter` to reduce TS inference cost.
import { workflowRolesRouter, workflowRouter } from './routers/workflow/index';

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

// Phase 64 D-05 — Module-level evaluation of the classification kill-switch.
// This represents the global platform baseline. Per-org / per-request enforcement
// is handled by classificationProcedure middleware (D-06, Plan 64-01).
// Default is false (ship dark) — classification routers are absent from appRouter
// until the flag is enabled in Unleash.
//
// NOTE: This evaluation happens at module load. Changes to Unleash state require
// a server restart to take effect at the appRouter level. The classificationProcedure
// middleware handles hot-path per-request evaluation.
const ClassificationFlagBag = buildFlagBag({
  organizationId: 'ROOT',
  region: 'EU', // jurisdiction='ANY' — region value doesn't affect evaluation
});
// QA walk bypass — when QA_DEFAULT_ORG_ID is set we force-register the
// classification routers so the seeded QA org can exercise the gated UI.
// Production never sets QA_DEFAULT_ORG_ID.
const CLASSIFICATION_ENABLED =
  ClassificationFlagBag.isEnabled('module.classification-engine') ||
  Boolean(process.env.QA_DEFAULT_ORG_ID);

// Phase 64 D-05 — Classification routers conditionally registered based on flag.
// When OFF: procedures are absent from appRouter at runtime — clients receive
// METHOD_NOT_FOUND.
// Defense-in-depth: classificationProcedure middleware (D-06) also blocks
// per-request.
// Lifted into a named const so the TYPE of the spread is constant regardless
// of the runtime branch — client typing always sees these namespaces as
// present (avoids `T | undefined` on every `trpc.classification?.foo` site).
// The false branch returns an empty object cast to the same shape, preserving
// the runtime behaviour exactly.
const classificationRouters = {
  classification: classificationRouter, // classification: IR35 + Scheinselbständigkeit engagement classification — draft/autosave/submit/outcome (Phase 58)
  classificationDashboard: classificationDashboardRouter, // classificationDashboard: per-market compliance health dashboard aggregating Phase-58 assessments + Phase-60 alerts/triggers/DRV clearances (Phase 60 CLASS-10)
  classificationDocument: classificationDocumentRouter, // classificationDocument: IR35 SDS + DRV defense bundle PDFs — append-only, content-addressed R2 (Phase 59)
  ir35Chain: ir35ChainRouter, // ir35Chain: IR35 chain participant tracking + SDS delivery / acknowledgement (Phase 59 CLASS-04)
  ir35Attestation: ir35AttestationRouter, // ir35Attestation: contractor other-client attestation + same-tenant cross-reference for DRV defense bundle (Phase 59 CLASS-06)
  economicDependencyAlert: economicDependencyAlertRouter, // economicDependencyAlert: per-assignment billing-share band (safe/warning/critical) written by the daily §2 SGB VI scan (Phase 60 CLASS-07)
  reassessmentTrigger: reassessmentTriggerRouter, // reassessmentTrigger: IR35 SDS reassessment triggers — AuditLog-driven material-change detection + acknowledge/dismiss (Phase 60 CLASS-08)
  statusfeststellungsverfahren: statusfeststellungsverfahrenRouter, // statusfeststellungsverfahren: DRV § 7a SGB IV clearance procedure CRUD + 90/30/7-day expiry reminders (Phase 60 CLASS-09)
} as const;

const conditionalClassificationRouters = CLASSIFICATION_ENABLED
  ? classificationRouters
  : ({} as typeof classificationRouters);

export const appRouter = router({
  adminBoeRate: adminBoeRateRouter, // adminBoeRate: Super-admin BoE base rate CRUD — list, insert, update, delete (Phase 63 D-10)
  apiKey: apiKeyRouter, // apiKey: Enterprise API key management — create, list, update, revoke
  bacs: bacsRouter, // bacs: BACS Std 18 file generation — getSubmitterMasks, previewExport, generateExport, validateSortCode, saveSubmitterConfig (Phase 63 D-27)
  organization: organizationRouter,
  // Organization Definitions Management — Teams / Projects / Cost Centers
  // exposed under one group so the web client imports a single namespace.
  organizationDefinitions: router({
    team: teamRouter,
    project: projectRouter,
    costCenter: costCenterRouter,
  }),
  user: userRouter,
  settings: settingsRouter,
  contractor: contractorRouter,
  contract: contractRouter,
  document: documentRouter,
  workflow: workflowRouter,
  workflowRoles: workflowRolesRouter, // Phase 74 — KT role-template CRUD + auto-selection
  authPermissions: authPermissionsRouter, // Phase 74 — current-user permission introspection (UI gating)
  invoice: invoiceRouter,
  invoiceIntake: invoiceIntakeRouter, // invoiceIntake: inbound XRechnung/ZUGFeRD intake pipeline — upload, parse, match, convert (Phase 62 EINV-03)
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
  skonto: skontoRouter, // skonto: German early payment discount CRUD + eligibility evaluation (Phase 63 D-21/D-24)
  // portal: moved to portalAppRouter (/api/trpc/portal endpoint)
  esign: esignRouter,
  ocr: ocrRouter,
  ksef: ksefRouter,
  latePaymentInterest: latePaymentInterestRouter, // latePaymentInterest: LPCDA statutory interest — getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim (Phase 63 D-27)
  legal: legalRouter, // legal: GDPR privacy notice PDF downloads (IDOR-safe, session-derived jurisdiction)
  // portalTime: moved to portalAppRouter (/api/trpc/portal endpoint)
  time: timeRouter,
  jira: jiraRouter,
  linear: linearRouter, // linear: Linear integration -- connection, teams, status mapping, task config, linked issues
  docs: docsRouter,
  calendar: calendarRouter,
  billing: billingRouter,
  deprovisioning: deprovisioningRouter, // Phase 76 F2 IdP — deprovisioning eligibility + provider toggle (all 5 providers)
  equipment: equipmentRouter,
  googleWorkspace: googleWorkspaceRouter, // Google Workspace directory import, group resolution, bulk import, sync
  gdpr: gdprRouter, // GDPR: right to erasure (Art. 17), data portability/export (Art. 20)
  teams: teamsRouter, // Microsoft Teams integration -- channel discovery, channel mapping, connection status
  onboardingImport: onboardingImportRouter, // onboardingImport: Cross-tool import wizard -- source discovery, user merge, project import, async progress
  complianceAdmin: complianceAdminRouter, // complianceAdmin: Admin compliance dashboard (KPIs, at-risk, renewals, blocked payments), manual override, upload approve/reject, item audit trail — always mounted (Phase 73)
  einvoice: einvoiceRouter, // einvoice: E-invoicing compliance statuses per country profile
  leitwegId: leitwegIdRouter, // leitwegId: German public-sector Leitweg-ID CRUD + contractor/contract default resolution (Phase 61 EINV-05)
  exchangeRate: exchangeRateRouter, // exchangeRate: Daily ECB exchange rates — query, convert, cron fetch
  featureFlags: featureFlagsRouter, // featureFlags: Self-hosted Unleash-backed flag introspection for the web dashboard
  consent: consentRouter, // consent: PDPL consent management — privacy notices, per-purpose consent, admin audit
  peppol: peppolRouter, // peppol: Peppol network integration — participant registration, transmission tracking, ASP management
  tax: taxRouter, // tax: Tax rate lookup, VAT validation, WHT calculation, WHT certificates, tax summary dashboard
  zatca: zatcaRouter, // zatca: ZATCA device onboarding — tax details, CSR generation, compliance CSID, compliance checks, production cert
  gulf: gulfRouter, // gulf: Phase 79 F3 — UAE free-zone assignment CRUD + Saudization config/headcount/dashboard + GULF-10 drift overrides (region-aware ME)
  ...conditionalClassificationRouters,
});

/** Type-safe router type for client consumption */
export type AppRouter = typeof appRouter;
