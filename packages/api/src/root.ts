import { router } from "./init.js";
import { organizationRouter } from "./routers/organization.js";
import { userRouter } from "./routers/user.js";
import { settingsRouter } from "./routers/settings.js";

/**
 * Root tRPC router merging all sub-routers.
 * All procedures are organized by domain:
 * - organization: create, getCurrent, update
 * - user: list, invite, updateRole, deactivate, reactivate
 * - settings: get, update
 */
export const appRouter = router({
  organization: organizationRouter,
  user: userRouter,
  settings: settingsRouter,
});

/** Type-safe router type for client consumption */
export type AppRouter = typeof appRouter;
