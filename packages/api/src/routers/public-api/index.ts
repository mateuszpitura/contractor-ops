import { router } from '../../init.js';
import { publicContractRouter } from './contract.js';
import { publicContractorRouter } from './contractor.js';
import { publicDocumentRouter } from './document.js';
import { publicFeatureFlagsRouter } from './feature-flags.js';
import { publicInvoiceRouter } from './invoice.js';

/**
 * Public API router — subset of procedures exposed via the Enterprise REST API.
 * All procedures use `apiKeyTenantProcedure` (API key auth + Enterprise tier).
 */
export const publicApiRouter = router({
  contractor: publicContractorRouter,
  invoice: publicInvoiceRouter,
  contract: publicContractRouter,
  document: publicDocumentRouter,
  featureFlags: publicFeatureFlagsRouter,
});

export type PublicApiRouter = typeof publicApiRouter;
