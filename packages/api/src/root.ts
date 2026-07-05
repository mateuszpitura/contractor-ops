import { buildFlagBag } from '@contractor-ops/feature-flags';
import { router } from './init';
import { isUsExpansionRegistered } from './middleware/require-us-expansion-flag';
import { isWorkforceRegistered } from './middleware/require-workforce-flag';
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
  employeeRouter,
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
  taxFormRouter,
  taxRouter,
  teamRouter,
  timeRouter,
  userRouter,
  workerRouter,
} from './routers/core/index';
import { personnelFileRouter } from './routers/core/personnel-file/index';
import { employeeLifecycleRouter } from './routers/employee/employee-lifecycle-router';
import { equipmentRouter } from './routers/equipment/index';
import {
  bacsRouter,
  billingRouter,
  exchangeRateRouter,
  form1042sRouter,
  form1099kTrackerRouter,
  invoiceIntakeRouter,
  invoiceRouter,
  latePaymentInterestRouter,
  paymentRouter,
  skontoRouter,
  tax1099Router,
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
import { employeeTimeRouter } from './routers/workforce/employee-time';
import { ewidencjaRouter } from './routers/workforce/ewidencja';
import { leaveRouter } from './routers/workforce/leave';
import { payrollExportRouter } from './routers/workforce/payroll-export-router';

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

// Module-level evaluation of the classification kill-switch.
// This represents the global platform baseline. Per-org / per-request enforcement
// is handled by classificationProcedure middleware.
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

// Classification routers conditionally registered based on flag.
// When OFF: procedures are absent from appRouter at runtime — clients receive
// METHOD_NOT_FOUND.
// Defense-in-depth: classificationProcedure middleware also blocks per-request.
// Lifted into a named const so the TYPE of the spread is constant regardless
// of the runtime branch — client typing always sees these namespaces as
// present (avoids `T | undefined` on every `trpc.classification?.foo` site).
// The false branch returns an empty object cast to the same shape, preserving
// the runtime behaviour exactly.
const classificationRouters = {
  classification: classificationRouter, // classification: IR35 + Scheinselbständigkeit engagement classification — draft/autosave/submit/outcome
  classificationDashboard: classificationDashboardRouter, // classificationDashboard: per-market compliance health dashboard aggregating assessments + alerts/triggers/DRV clearances
  classificationDocument: classificationDocumentRouter, // classificationDocument: IR35 SDS + DRV defense bundle PDFs — append-only, content-addressed R2
  ir35Chain: ir35ChainRouter, // ir35Chain: IR35 chain participant tracking + SDS delivery / acknowledgement
  ir35Attestation: ir35AttestationRouter, // ir35Attestation: contractor other-client attestation + same-tenant cross-reference for DRV defense bundle
  economicDependencyAlert: economicDependencyAlertRouter, // economicDependencyAlert: per-assignment billing-share band (safe/warning/critical) written by the daily §2 SGB VI scan
  reassessmentTrigger: reassessmentTriggerRouter, // reassessmentTrigger: IR35 SDS reassessment triggers — AuditLog-driven material-change detection + acknowledge/dismiss
  statusfeststellungsverfahren: statusfeststellungsverfahrenRouter, // statusfeststellungsverfahren: DRV § 7a SGB IV clearance procedure CRUD + 90/30/7-day expiry reminders
} as const;

const conditionalClassificationRouters = CLASSIFICATION_ENABLED
  ? classificationRouters
  : ({} as typeof classificationRouters);

// US cross-border surface (Theme A) ships dark behind `module.us-expansion`.
// Mirror the classification gate: the staff US tax-form procedures are absent
// from appRouter at runtime when the flag is OFF (clients get METHOD_NOT_FOUND).
// Defense-in-depth: each procedure re-evaluates the flag per request via
// assertUsExpansionEnabled. The const keeps the spread TYPE constant across
// branches so client typing always sees the namespace.
const usExpansionRouters = {
  taxForm: taxFormRouter, // taxForm: staff read/track of US W-form submissions + request/remind (no on-behalf signing)
  form1042s: form1042sRouter, // form1042s: staff Form 1042-S generate/correct/recipient-copy + gated full-FTIN reveal
  form1099kTracker: form1099kTrackerRouter, // form1099kTracker: read-only informational 1099-K band for the contractor profile (cron-written, never files)
  tax1099: tax1099Router, // tax1099: staff 1099-NEC year-end filing — batch generate, build/validate/download IRIS XML, upload ack, TIN-mismatch advisory, correction, per-state output
} as const;

const conditionalUsExpansionRouters = isUsExpansionRegistered()
  ? usExpansionRouters
  : ({} as typeof usExpansionRouters);

// Worker-model surface (Theme B) ships dark behind `module.workforce-employees`.
// Mirror the classification / us-expansion gate: the cross-type worker and the
// skeleton employee procedures are absent from appRouter at runtime when the
// flag is OFF (clients get METHOD_NOT_FOUND). Defense-in-depth: each procedure
// re-evaluates the flag per request via assertWorkforceEnabled. The const keeps
// the spread TYPE constant across branches so client typing always sees the
// namespaces. contractor.* is NOT gated — it is the always-on existing surface.
const workforceRouters = {
  worker: workerRouter, // worker: shared cross-type worker reads (explicit workerType — contractors + employees)
  employee: employeeRouter, // employee: skeleton employee-type reads (workerType=EMPLOYEE; profile surface lands in a later phase)
  employeeLifecycle: employeeLifecycleRouter, // employeeLifecycle: on/offboarding runs, statutory cert generation, dated termination
  personnelFile: personnelFileRouter, // personnelFile: gated akta-osobowe personnel file (read/section-access/classify/erasure)
  leave: leaveRouter, // leave: leave requests (approval chain), direct sick, leave-type/blackout config, team calendar
  employeeTime: employeeTimeRouter, // employeeTime: day-grain statutory time records + synchronous WT-limit check
  ewidencja: ewidencjaRouter, // ewidencja: PL KP §149 working-time register generate + read (INSERT-only versions)
  payrollExport: payrollExportRouter, // payrollExport: per-market payroll export adapters (file-export + Gusto/QuickBooks native), each dark behind its payroll.* flag
} as const;

const conditionalWorkforceRouters = isWorkforceRegistered()
  ? workforceRouters
  : ({} as typeof workforceRouters);

export const appRouter = router({
  adminBoeRate: adminBoeRateRouter, // adminBoeRate: Super-admin BoE base rate CRUD — list, insert, update, delete
  apiKey: apiKeyRouter, // apiKey: Enterprise API key management — create, list, update, revoke
  bacs: bacsRouter, // bacs: BACS Std 18 file generation — getSubmitterMasks, previewExport, generateExport, validateSortCode, saveSubmitterConfig
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
  workflowRoles: workflowRolesRouter, // workflowRoles: KT role-template CRUD + auto-selection
  authPermissions: authPermissionsRouter, // authPermissions: current-user permission introspection (UI gating)
  invoice: invoiceRouter,
  invoiceIntake: invoiceIntakeRouter, // invoiceIntake: inbound XRechnung/ZUGFeRD intake pipeline — upload, parse, match, convert
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
  skonto: skontoRouter, // skonto: German early payment discount CRUD + eligibility evaluation
  // portal: moved to portalAppRouter (/api/trpc/portal endpoint)
  esign: esignRouter,
  ocr: ocrRouter,
  ksef: ksefRouter,
  latePaymentInterest: latePaymentInterestRouter, // latePaymentInterest: LPCDA statutory interest — getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim
  legal: legalRouter, // legal: GDPR privacy notice PDF downloads (IDOR-safe, session-derived jurisdiction)
  // portalTime: moved to portalAppRouter (/api/trpc/portal endpoint)
  time: timeRouter,
  jira: jiraRouter,
  linear: linearRouter, // linear: Linear integration -- connection, teams, status mapping, task config, linked issues
  docs: docsRouter,
  calendar: calendarRouter,
  billing: billingRouter,
  deprovisioning: deprovisioningRouter, // deprovisioning: IdP deprovisioning eligibility + provider toggle (all 5 providers)
  equipment: equipmentRouter,
  googleWorkspace: googleWorkspaceRouter, // Google Workspace directory import, group resolution, bulk import, sync
  gdpr: gdprRouter, // GDPR: right to erasure (Art. 17), data portability/export (Art. 20)
  teams: teamsRouter, // Microsoft Teams integration -- channel discovery, channel mapping, connection status
  onboardingImport: onboardingImportRouter, // onboardingImport: Cross-tool import wizard -- source discovery, user merge, project import, async progress
  complianceAdmin: complianceAdminRouter, // complianceAdmin: Admin compliance dashboard (KPIs, at-risk, renewals, blocked payments), manual override, upload approve/reject, item audit trail — always mounted
  einvoice: einvoiceRouter, // einvoice: E-invoicing compliance statuses per country profile
  leitwegId: leitwegIdRouter, // leitwegId: German public-sector Leitweg-ID CRUD + contractor/contract default resolution
  exchangeRate: exchangeRateRouter, // exchangeRate: Daily ECB exchange rates — query, convert, cron fetch
  featureFlags: featureFlagsRouter, // featureFlags: Self-hosted Unleash-backed flag introspection for the web dashboard
  consent: consentRouter, // consent: PDPL consent management — privacy notices, per-purpose consent, admin audit
  peppol: peppolRouter, // peppol: Peppol network integration — participant registration, transmission tracking, ASP management
  tax: taxRouter, // tax: Tax rate lookup, VAT validation, WHT calculation, WHT certificates, tax summary dashboard
  zatca: zatcaRouter, // zatca: ZATCA device onboarding — tax details, CSR generation, compliance CSID, compliance checks, production cert
  gulf: gulfRouter, // gulf: UAE free-zone assignment CRUD + Saudization config/headcount/dashboard + drift overrides (region-aware ME)
  ...conditionalClassificationRouters,
  ...conditionalUsExpansionRouters,
  ...conditionalWorkforceRouters,
});

/** Type-safe router type for client consumption */
export type AppRouter = typeof appRouter;
