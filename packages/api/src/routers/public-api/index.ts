import { router } from '../../init';
import { publicContractRouter } from './contract';
import { publicContractorRouter } from './contractor';
import { publicDocumentRouter } from './document';
import { publicFeatureFlagsRouter } from './feature-flags';
import { publicInvoiceRouter } from './invoice';

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
