import { QueryClient } from "@tanstack/react-query";

/**
 * Determines whether a failed query/mutation should be retried.
 * Retries network errors and 5xx responses up to 2 times.
 * Does not retry 4xx errors (auth, validation, not found).
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  // tRPC errors carry a `data?.httpStatus` or `data?.code`
  const trpcError = error as { data?: { httpStatus?: number; code?: string } } | undefined;
  const httpStatus = trpcError?.data?.httpStatus;

  // Don't retry client errors (4xx)
  if (httpStatus && httpStatus >= 400 && httpStatus < 500) return false;

  // Don't retry auth/permission errors by tRPC code
  const code = trpcError?.data?.code;
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "NOT_FOUND") return false;

  // Retry everything else (network errors, 5xx, timeouts)
  return true;
}

/**
 * Creates a QueryClient with default options optimized for SSR.
 *
 * - staleTime of 30s prevents refetching on the client immediately after SSR prefetch.
 * - retry: retries network/5xx errors up to 2 times with exponential backoff.
 * - retryDelay: 1s, 3s (exponential with 1s base, capped at 30s).
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: shouldRetry,
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 3 ** attemptIndex, 30_000),
      },
      mutations: {
        retry: shouldRetry,
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 3 ** attemptIndex, 30_000),
      },
    },
  });
}
