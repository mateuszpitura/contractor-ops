/**
 * Authenticated portal routes — rendered inside {@link PortalShellContainer}.
 * Loader gating lives on the shell parent in router.tsx.
 */

import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';

const PortalIndexPage = lazy(() => import('../pages/portal/index.js'));
const PortalSettingsPage = lazy(() => import('../pages/portal/settings.js'));
const PortalEquipmentPage = lazy(() => import('../pages/portal/equipment.js'));
const PortalContractsPage = lazy(() => import('../pages/portal/contracts.js'));
const PortalInvoicesPage = lazy(() => import('../pages/portal/invoices.js'));
const PortalPaymentsPage = lazy(() => import('../pages/portal/payments.js'));
const PortalDocumentsPage = lazy(() => import('../pages/portal/documents.js'));
const PortalInvoiceSubmitPage = lazy(() => import('../pages/portal/invoice-submit.js'));
const PortalTimePage = lazy(() => import('../pages/portal/time.js'));
const PortalInvoiceDetailPage = lazy(() => import('../pages/portal/invoice-detail.js'));
const PortalContractDetailPage = lazy(() => import('../pages/portal/contract-detail.js'));
const PortalSignaturesPage = lazy(() => import('../pages/portal/signatures.js'));
const PortalCompliancePage = lazy(() => import('../pages/portal/compliance.js'));
const PortalComplianceUploadReplacementPage = lazy(
  () => import('../pages/portal/compliance-upload-replacement.js'),
);
const PortalTaxFormPage = lazy(() => import('../pages/portal/tax-form-page.js'));
const EmployeePortalPage = lazy(() => import('../pages/portal/employee/index.js'));
const EmployeeLeavePage = lazy(() => import('../pages/portal/employee/leave.js'));
const EmployeeTimePage = lazy(() => import('../pages/portal/employee/time.js'));
const EmployeeDocumentsPage = lazy(() => import('../pages/portal/employee/documents.js'));
const EmployeePayPage = lazy(() => import('../pages/portal/employee/pay.js'));
const ManagerTeamPage = lazy(() => import('../pages/portal/employee/team/index.js'));
const ManagerApprovalsPage = lazy(() => import('../pages/portal/employee/team/approvals.js'));

function page(element: ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

export const portalRoutes = [
  { path: 'portal', element: page(<PortalIndexPage />) },
  { path: 'portal/settings', element: page(<PortalSettingsPage />) },
  { path: 'portal/equipment', element: page(<PortalEquipmentPage />) },
  { path: 'portal/contracts', element: page(<PortalContractsPage />) },
  { path: 'portal/invoices', element: page(<PortalInvoicesPage />) },
  { path: 'portal/payments', element: page(<PortalPaymentsPage />) },
  { path: 'portal/documents', element: page(<PortalDocumentsPage />) },
  { path: 'portal/invoices/submit', element: page(<PortalInvoiceSubmitPage />) },
  { path: 'portal/time', element: page(<PortalTimePage />) },
  { path: 'portal/invoices/:id', element: page(<PortalInvoiceDetailPage />) },
  { path: 'portal/contracts/:id', element: page(<PortalContractDetailPage />) },
  { path: 'portal/signatures', element: page(<PortalSignaturesPage />) },
  { path: 'portal/compliance', element: page(<PortalCompliancePage />) },
  {
    path: 'portal/compliance/upload-replacement',
    element: page(<PortalComplianceUploadReplacementPage />),
  },
  { path: 'portal/tax-form', element: page(<PortalTaxFormPage />) },
  { path: 'portal/employee', element: page(<EmployeePortalPage />) },
  { path: 'portal/employee/leave', element: page(<EmployeeLeavePage />) },
  { path: 'portal/employee/time', element: page(<EmployeeTimePage />) },
  { path: 'portal/employee/documents', element: page(<EmployeeDocumentsPage />) },
  { path: 'portal/employee/pay', element: page(<EmployeePayPage />) },
  { path: 'portal/employee/team', element: page(<ManagerTeamPage />) },
  { path: 'portal/employee/team/approvals', element: page(<ManagerApprovalsPage />) },
];
