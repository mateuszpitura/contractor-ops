import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@contractor-ops/api";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

/**
 * tRPC client initialized with httpBatchLink and superjson transformer.
 * Uses createTRPCOptionsProxy (tRPC v11 pattern) for TanStack Query integration.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`,
        transformer: superjson,
      }),
    ],
  }),
  queryClient: makeQueryClient(),
});
