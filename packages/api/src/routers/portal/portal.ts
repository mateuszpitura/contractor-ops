import { mergeRouters } from '../../init';
import { portalAuthRouter } from './portal-auth-router';
import { portalContractsRouter } from './portal-contracts-router';
import { portalEquipmentRouter } from './portal-equipment-router';
import { portalInvoicesRouter } from './portal-invoices-router';
import { portalProfileRouter } from './portal-profile-router';
import { portalTaxFormRouter } from './portal-tax-form-router';

// ---------------------------------------------------------------------------
// Merged portal router — auth, invoices, contracts/documents, profile/compliance,
// equipment returns, US W-form intake. mergeRouters keeps the FLAT `portal.*`
// namespace the SPA and portal session tests rely on; shared helpers live in
// `./portal-shared`. The US tax-form procedures self-gate on `module.us-expansion`
// per request (the flat merge cannot conditionally spread them).
// ---------------------------------------------------------------------------

export const portalRouter = mergeRouters(
  portalAuthRouter,
  portalInvoicesRouter,
  portalContractsRouter,
  portalProfileRouter,
  portalEquipmentRouter,
  portalTaxFormRouter,
);
