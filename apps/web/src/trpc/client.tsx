"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "./query-client.js";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new QueryClient
    return makeQueryClient();
  }
  // Browser: reuse the same QueryClient across renders
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

/**
 * TRPCProvider wraps the app with QueryClientProvider.
 * On the server, a fresh QueryClient is created per request.
 * On the client, a singleton QueryClient is reused.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
