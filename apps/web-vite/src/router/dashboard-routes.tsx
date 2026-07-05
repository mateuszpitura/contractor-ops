/**
 * Staff dashboard routes — rendered inside {@link DashboardShell}.
 * Auth gating lives on the shell parent in router.tsx.
 */

import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';

import { PageLoadingSpinner } from '../components/shared/page-loading-spinner.js';
import { requirePlatformOperator } from '../lib/require-platform-operator.js';

const DashboardPage = lazy(() => import('../pages/dashboard/index.js'));
const NotificationsPage = lazy(() => import('../pages/dashboard/notifications.js'));
const ContractorsPage = lazy(() => import('../pages/dashboard/contractors.js'));
const InvoicesPage = lazy(() => import('../pages/dashboard/invoices.js'));
const PaymentsPage = lazy(() => import('../pages/dashboard/payments.js'));
const ContractsPage = lazy(() => import('../pages/dashboard/contracts.js'));
const EquipmentPage = lazy(() => import('../pages/dashboard/equipment.js'));
const EmployeesPage = lazy(() => import('../pages/dashboard/employees.js'));
const EmployeeLifecyclePage = lazy(() => import('../pages/dashboard/employees/lifecycle.js'));
const PersonnelFilePage = lazy(() => import('../pages/dashboard/employees/personnel-file.js'));
const PersonnelClassifyQueuePage = lazy(
  () => import('../pages/dashboard/employees/personnel-classify-queue.js'),
);
const ApprovalsPage = lazy(() => import('../pages/dashboard/approvals.js'));
const LeavePage = lazy(() => import('../pages/dashboard/leave.js'));
const TeamCalendarPage = lazy(() => import('../pages/dashboard/leave/team-calendar.js'));
const EmployeeTimePage = lazy(() => import('../pages/dashboard/employee-time.js'));
const EwidencjaPage = lazy(() => import('../pages/dashboard/employee-time/ewidencja.js'));
const PayrollExportPage = lazy(() => import('../pages/dashboard/payroll-export.js'));
const SettingsIndexPage = lazy(() => import('../pages/dashboard/settings/index.js'));
const CalendarSettingsPage = lazy(() => import('../pages/dashboard/settings/calendar.js'));
const EInvoicingSettingsPage = lazy(() => import('../pages/dashboard/settings/e-invoicing.js'));
const MembersSettingsPage = lazy(() => import('../pages/dashboard/settings/members.js'));
const PaymentsSettingsPage = lazy(() => import('../pages/dashboard/settings/payments.js'));
const TaxSettingsPage = lazy(() => import('../pages/dashboard/settings/tax.js'));
const WorkflowRolesSettingsPage = lazy(
  () => import('../pages/dashboard/settings/workflow-roles.js'),
);
const OrganizationPage = lazy(() => import('../pages/dashboard/organization/index.js'));
const CostCentersPage = lazy(() => import('../pages/dashboard/organization/cost-centers.js'));
const ProjectsPage = lazy(() => import('../pages/dashboard/organization/projects.js'));
const TeamsPage = lazy(() => import('../pages/dashboard/organization/teams.js'));
const WorkflowsPage = lazy(() => import('../pages/dashboard/workflows.js'));
const TimePage = lazy(() => import('../pages/dashboard/time.js'));
const ReportsPage = lazy(() => import('../pages/dashboard/reports.js'));
const HrDashboardPage = lazy(() => import('../pages/dashboard/hr.js'));
const TaxFilingPage = lazy(() => import('../pages/dashboard/tax-filing.js'));
const ClassificationPage = lazy(() => import('../pages/dashboard/classification.js'));
const ComplianceDashboardPage = lazy(() => import('../pages/dashboard/compliance-dashboard.js'));
const OnboardingImportPage = lazy(() => import('../pages/dashboard/onboarding-import.js'));
const ContractorDetailPage = lazy(() => import('../pages/dashboard/contractor-detail.js'));
const InvoiceDetailPage = lazy(() => import('../pages/dashboard/invoice-detail.js'));
const ContractDetailPage = lazy(() => import('../pages/dashboard/contract-detail.js'));
const EquipmentDetailPage = lazy(() => import('../pages/dashboard/equipment-detail.js'));
const InvoiceIntakePage = lazy(() => import('../pages/dashboard/invoices/intake.js'));
const InvoiceIntakeDetailPage = lazy(() => import('../pages/dashboard/invoices/intake-detail.js'));
const WorkflowDetailPage = lazy(() => import('../pages/dashboard/workflows/detail.js'));
const WorkflowTemplateNewPage = lazy(() => import('../pages/dashboard/workflows/template-new.js'));
const WorkflowTemplateDetailPage = lazy(
  () => import('../pages/dashboard/workflows/template-detail.js'),
);
const TimeDetailPage = lazy(() => import('../pages/dashboard/time-detail.js'));
const AdminBoeRatePage = lazy(() => import('../pages/admin/boe-rate.js'));
const AdminClassificationEnginePage = lazy(() => import('../pages/admin/classification-engine.js'));
const EInvoicingLogPage = lazy(() => import('../pages/dashboard/settings/e-invoicing-log.js'));
const ZatcaIntegrationPage = lazy(
  () => import('../pages/dashboard/settings/integrations-zatca.js'),
);
const ContractorClassificationPage = lazy(
  () => import('../pages/dashboard/contractors/classification.js'),
);
const EngagementPage = lazy(() => import('../pages/dashboard/contractors/engagement.js'));
const EngagementClassificationPage = lazy(
  () => import('../pages/dashboard/contractors/engagement-classification.js'),
);
const ClassificationExpertHelpPage = lazy(
  () => import('../pages/dashboard/classification-expert-help.js'),
);
const UnauthorizedPage = lazy(() => import('../pages/dashboard/unauthorized.js'));

function page(element: ReactNode) {
  return <Suspense fallback={<PageLoadingSpinner />}>{element}</Suspense>;
}

function platformOperatorLoader({ params }: { params: { locale?: string } }) {
  return requirePlatformOperator(params.locale);
}

export const dashboardRoutes = [
  { index: true, element: page(<DashboardPage />) },
  { path: 'unauthorized', element: page(<UnauthorizedPage />) },
  { path: 'notifications', element: page(<NotificationsPage />) },
  { path: 'contractors', element: page(<ContractorsPage />) },
  { path: 'invoices', element: page(<InvoicesPage />) },
  { path: 'payments', element: page(<PaymentsPage />) },
  { path: 'contracts', element: page(<ContractsPage />) },
  { path: 'equipment', element: page(<EquipmentPage />) },
  { path: 'employees', element: page(<EmployeesPage />) },
  { path: 'employees/:workerId/lifecycle', element: page(<EmployeeLifecyclePage />) },
  { path: 'employees/:workerId/personnel-file', element: page(<PersonnelFilePage />) },
  {
    path: 'employees/personnel-classify-queue',
    element: page(<PersonnelClassifyQueuePage />),
  },
  { path: 'approvals', element: page(<ApprovalsPage />) },
  { path: 'leave', element: page(<LeavePage />) },
  { path: 'leave/calendar', element: page(<TeamCalendarPage />) },
  { path: 'employee-time', element: page(<EmployeeTimePage />) },
  { path: 'employee-time/ewidencja', element: page(<EwidencjaPage />) },
  { path: 'payroll-export', element: page(<PayrollExportPage />) },
  { path: 'settings', element: page(<SettingsIndexPage />) },
  { path: 'settings/calendar', element: page(<CalendarSettingsPage />) },
  { path: 'settings/e-invoicing', element: page(<EInvoicingSettingsPage />) },
  { path: 'settings/members', element: page(<MembersSettingsPage />) },
  { path: 'settings/payments', element: page(<PaymentsSettingsPage />) },
  { path: 'settings/tax', element: page(<TaxSettingsPage />) },
  { path: 'settings/workflow-roles', element: page(<WorkflowRolesSettingsPage />) },
  { path: 'organization', element: page(<OrganizationPage />) },
  { path: 'organization/cost-centers', element: page(<CostCentersPage />) },
  { path: 'organization/projects', element: page(<ProjectsPage />) },
  { path: 'organization/teams', element: page(<TeamsPage />) },
  { path: 'workflows', element: page(<WorkflowsPage />) },
  { path: 'time', element: page(<TimePage />) },
  { path: 'reports', element: page(<ReportsPage />) },
  { path: 'dashboard/hr', element: page(<HrDashboardPage />) },
  { path: 'tax-filing', element: page(<TaxFilingPage />) },
  { path: 'classification', element: page(<ClassificationPage />) },
  { path: 'compliance/dashboard', element: page(<ComplianceDashboardPage />) },
  { path: 'onboarding/import', element: page(<OnboardingImportPage />) },
  { path: 'contractors/:id', element: page(<ContractorDetailPage />) },
  { path: 'invoices/:id', element: page(<InvoiceDetailPage />) },
  { path: 'invoices/intake', element: page(<InvoiceIntakePage />) },
  { path: 'invoices/intake/:id', element: page(<InvoiceIntakeDetailPage />) },
  { path: 'contracts/:id', element: page(<ContractDetailPage />) },
  { path: 'equipment/:id', element: page(<EquipmentDetailPage />) },
  { path: 'workflows/:id', element: page(<WorkflowDetailPage />) },
  { path: 'workflows/templates/new', element: page(<WorkflowTemplateNewPage />) },
  { path: 'workflows/templates/:id', element: page(<WorkflowTemplateDetailPage />) },
  { path: 'time/:contractorId', element: page(<TimeDetailPage />) },
  {
    path: 'admin/boe-rate',
    loader: platformOperatorLoader,
    element: page(<AdminBoeRatePage />),
  },
  {
    path: 'admin/classification-engine',
    loader: platformOperatorLoader,
    element: page(<AdminClassificationEnginePage />),
  },
  { path: 'settings/e-invoicing/log', element: page(<EInvoicingLogPage />) },
  { path: 'settings/integrations/zatca', element: page(<ZatcaIntegrationPage />) },
  { path: 'contractors/:id/classification', element: page(<ContractorClassificationPage />) },
  {
    path: 'contractors/:id/engagements/:engagementId',
    element: page(<EngagementPage />),
  },
  {
    path: 'contractors/:id/engagements/:engagementId/classification',
    element: page(<EngagementClassificationPage />),
  },
  {
    path: 'contractors/:id/engagements/:engagementId/classification/:assessmentId',
    element: page(<EngagementClassificationPage />),
  },
  { path: 'classification/expert-help', element: page(<ClassificationExpertHelpPage />) },
];
