"use client";

import { TRPCProvider } from "@/trpc/client";

/**
 * Root providers component.
 * Wraps the application with TRPCProvider (which includes QueryClientProvider).
 * Add additional providers here as needed (theme, i18n, etc.).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
