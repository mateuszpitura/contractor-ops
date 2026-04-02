import { createTRPCClient, httpBatchLink, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@contractor-ops/api";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

const isDev = process.env.NODE_ENV === "development";

const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`;

/**
 * tRPC client with TanStack Query integration (tRPC v11 pattern).
 *
 * - **Development**: `httpLink` — one request per procedure, readable logs.
 * - **Production**: `httpBatchLink` — batches parallel calls into one HTTP request.
 */
export const trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>> =
  createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({
    links: [
      isDev
        ? httpLink({ url, transformer: superjson })
        : httpBatchLink({ url, transformer: superjson }),
    ],
  }),
  queryClient: makeQueryClient(),
});
