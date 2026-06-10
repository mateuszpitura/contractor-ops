/**
 * Contractor router — merges core CRUD, country fields, tax/PII, engagements, and bulk ops.
 */

import { mergeRouters } from '../../init';
import { contractorBulkRouter } from './contractor-bulk.js';
import { contractorCoreRouter } from './contractor-core.js';
import { contractorCountryRouter } from './contractor-country.js';
import { contractorEngagementsRouter } from './contractor-engagements.js';
import { contractorTaxRouter } from './contractor-tax.js';

export const contractorRouter = mergeRouters(
  contractorCoreRouter,
  contractorCountryRouter,
  contractorTaxRouter,
  contractorEngagementsRouter,
  contractorBulkRouter,
);
