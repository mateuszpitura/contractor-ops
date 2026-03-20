"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TRPCProvider } from "@/trpc/client";

/**
 * Root providers component.
 * Wraps the application with TRPCProvider (which includes QueryClientProvider)
 * and NuqsAdapter for URL state management.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <TRPCProvider>{children}</TRPCProvider>
    </NuqsAdapter>
  );
}
