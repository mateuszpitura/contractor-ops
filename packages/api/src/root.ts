import { router } from "./init.js";
import { organizationRouter } from "./routers/organization.js";
import { userRouter } from "./routers/user.js";
import { settingsRouter } from "./routers/settings.js";
import { contractorRouter } from "./routers/contractor.js";
import { contractRouter } from "./routers/contract.js";
import { documentRouter } from "./routers/document.js";
import { workflowRouter } from "./routers/workflow.js";
import { invoiceRouter } from "./routers/invoice.js";

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
 */
export const appRouter = router({
  organization: organizationRouter,
  user: userRouter,
  settings: settingsRouter,
  contractor: contractorRouter,
  contract: contractRouter,
  document: documentRouter,
  workflow: workflowRouter,
  invoice: invoiceRouter,
});

/** Type-safe router type for client consumption */
export type AppRouter = typeof appRouter;
