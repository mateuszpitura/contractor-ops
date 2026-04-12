import type { AppRouter } from "@contractor-ops/api";
import { createTRPCClient, httpBatchLink, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

const isDev = process.env.NODE_ENV === "development";

const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`;

/** Default request timeout in milliseconds (30 seconds). */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Wraps the global fetch with a per-request timeout via AbortController.
 * If the caller already provides a signal, both the caller signal and the
 * timeout signal are raced so either can abort the request.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // If caller provided a signal (e.g. React Query cancellation), listen to it
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason), {
        once: true,
      });
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
};

/**
 * tRPC client with TanStack Query integration (tRPC v11 pattern).
 *
 * - **Development**: `httpLink` — one request per procedure, readable logs.
 * - **Production**: `httpBatchLink` — batches parallel calls into one HTTP request.
 * - **Timeout**: 30s per request via AbortController wrapper.
 */
export const trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>> =
  createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({
      links: [
        isDev
          ? httpLink({ url, transformer: superjson, fetch: fetchWithTimeout })
          : httpBatchLink({ url, transformer: superjson, fetch: fetchWithTimeout }),
      ],
    }),
    queryClient: makeQueryClient(),
  });
