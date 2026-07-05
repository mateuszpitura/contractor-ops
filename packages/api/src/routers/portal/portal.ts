import { mergeRouters } from '../../init';
import { portalAuthRouter } from './portal-auth-router';
import { portalContractsRouter } from './portal-contracts-router';
import { portalEquipmentRouter } from './portal-equipment-router';
import { portalInvoicesRouter } from './portal-invoices-router';
import { portalProfileRouter } from './portal-profile-router';
import { portalTax1099Router } from './portal-tax-1099-router';
import { portalTaxFormRouter } from './portal-tax-form-router';

// ---------------------------------------------------------------------------
// Merged portal router — auth, invoices, contracts/documents, profile/compliance,
// equipment returns, US W-form intake, US 1099-NEC e-delivery consent + Copy-B.
// mergeRouters keeps the FLAT `portal.*` namespace the SPA and portal session
// tests rely on; shared helpers live in `./portal-shared`. The US tax procedures
// self-gate on `module.us-expansion` per request (the flat merge cannot
// conditionally spread them).
// ---------------------------------------------------------------------------

export const portalRouter = mergeRouters(
  portalAuthRouter,
  portalInvoicesRouter,
  portalContractsRouter,
  portalProfileRouter,
  portalEquipmentRouter,
  portalTaxFormRouter,
  portalTax1099Router,
);
