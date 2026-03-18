import "server-only";

import { createHydrationHelpers } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { createCallerFactory, appRouter } from "@contractor-ops/api";
import { createContext } from "@contractor-ops/api";
import { headers } from "next/headers";
import { makeQueryClient } from "./query-client.js";

/**
 * Server-side tRPC caller for use in Server Components.
 * Creates a caller with the current request's headers for auth.
 */
const createCaller = createCallerFactory(appRouter);

const getQueryClient = cache(makeQueryClient);

const caller = createCaller(async () => {
  const h = await headers();
  return createContext({ headers: h });
});

/**
 * HydrateClient component and prefetch helpers for tRPC v11.
 * Use HydrateClient in layouts to pass prefetched data to client components.
 * Use prefetch in Server Components to preload queries.
 */
export const { HydrateClient, prefetch } = createHydrationHelpers(
  caller,
  getQueryClient,
);
