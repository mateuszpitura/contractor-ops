import "server-only";

import { cache } from "react";
import { createCallerFactory, appRouter } from "@contractor-ops/api";
import { createContext } from "@contractor-ops/api";
import { headers } from "next/headers";

/**
 * Server-side tRPC caller for use in Server Components.
 * Creates a caller with the current request's headers for auth.
 *
 * Usage in Server Components:
 *   const api = await getServerApi();
 *   const data = await api.settings.get();
 */
const createCaller = createCallerFactory(appRouter);

export const getServerApi = cache(async () => {
  const h = await headers();
  return createCaller(await createContext({ headers: h }));
});
