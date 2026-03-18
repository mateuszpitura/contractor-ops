import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a QueryClient with default options optimized for SSR.
 * staleTime of 30 seconds prevents refetching on the client
 * immediately after server-side prefetch.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
    },
  });
}
