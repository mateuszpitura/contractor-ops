import { mergeRouters } from '../../init';
import { portalAuthRouter } from './portal-auth-router';
import { portalContractsRouter } from './portal-contracts-router';
import { portalEquipmentRouter } from './portal-equipment-router';
import { portalInvoicesRouter } from './portal-invoices-router';
import { portalProfileRouter } from './portal-profile-router';

// ---------------------------------------------------------------------------
// Merged portal router — auth, invoices, contracts/documents, profile/compliance,
// equipment returns. mergeRouters keeps the FLAT `portal.*` namespace the SPA and
// portal session tests rely on; shared helpers live in `./portal-shared`.
// ---------------------------------------------------------------------------

export const portalRouter = mergeRouters(
  portalAuthRouter,
  portalInvoicesRouter,
  portalContractsRouter,
  portalProfileRouter,
  portalEquipmentRouter,
);
