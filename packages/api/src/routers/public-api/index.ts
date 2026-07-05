import { router } from '../../init';
import { publicAuditRouter } from './audit';
import { publicClassificationRouter } from './classification';
import { publicComplianceDocumentRouter } from './compliance-document';
import { publicContractRouter } from './contract';
import { publicContractorRouter } from './contractor';
import { publicDocumentRouter } from './document';
import { publicFeatureFlagsRouter } from './feature-flags';
import { publicInvoiceRouter } from './invoice';
import { publicPaymentRouter } from './payment';
import { publicPaymentRunRouter } from './payment-run';
import { publicWorkflowRouter } from './workflow';
import { publicWorkflowTaskRouter } from './workflow-task';

/**
 * Public API router — subset of procedures exposed via the Enterprise REST API.
 * All procedures use `apiKeyTenantProcedure` (API key auth + Enterprise tier +
 * the per-org module.public-api dark gate). classification + audit are read-only.
 */
export const publicApiRouter = router({
  contractor: publicContractorRouter,
  invoice: publicInvoiceRouter,
  contract: publicContractRouter,
  document: publicDocumentRouter,
  featureFlags: publicFeatureFlagsRouter,
  payment: publicPaymentRouter,
  paymentRun: publicPaymentRunRouter,
  workflow: publicWorkflowRouter,
  workflowTask: publicWorkflowTaskRouter,
  classification: publicClassificationRouter,
  complianceDocument: publicComplianceDocumentRouter,
  audit: publicAuditRouter,
});

export type PublicApiRouter = typeof publicApiRouter;
