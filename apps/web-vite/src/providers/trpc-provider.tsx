/**
 * TanStack Query + tRPC client wiring for the SPA.
 *
 * Uses tRPC v11's `@trpc/tanstack-react-query` integration:
 *
 *   - `createTRPCContext<TRouter>()` returns a `{ TRPCProvider, useTRPC }`
 *     pair. The provider takes the typed tRPC client + queryClient; the
 *     hook returns a typed proxy whose call shape is
 *     `useTRPC().contractor.list.queryOptions({ ... })` — feed that to
 *     `useQuery` / `useMutation` from `@tanstack/react-query`.
 *   - Two separate contexts are created (staff + portal) so the type
 *     surface stays narrow per consumer page.
 *
 * Type-only imports from `@contractor-ops/api` are erased at build time
 * (verbatimModuleSyntax is on in tsconfig.base.json) — no server-only
 * router/service code lands in the browser bundle.
 *
 * `credentials: 'include'` on the fetch shim is mandatory for the
 * cross-subdomain Better Auth cookie posture (Domain=.contractor-ops.com,
 * SameSite=None, Secure).
 */

import type { AppRouter, PortalAppRouter } from '@contractor-ops/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import superjson from 'superjson';
import { getClientEnv } from '../env.js';

const staff = createTRPCContext<AppRouter>();
const portal = createTRPCContext<PortalAppRouter>();

/** Typed staff tRPC proxy hook — call as `useTRPC().contractor.list.queryOptions(...)`. */
export const useTRPC = staff.useTRPC;
/** Typed portal tRPC proxy hook. */
export const usePortalTRPC = portal.useTRPC;

export interface TRPCProviderProps {
  children: ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const env = getClientEnv();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const [staffClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${env.VITE_API_URL}/api/trpc`,
          fetch: (url, init) => fetch(url, { ...init, credentials: 'include' }),
          transformer: superjson,
        }),
      ],
    }),
  );

  const [portalClient] = useState(() =>
    createTRPCClient<PortalAppRouter>({
      links: [
        httpBatchLink({
          url: `${env.VITE_API_URL}/api/trpc/portal`,
          fetch: (url, init) => fetch(url, { ...init, credentials: 'include' }),
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <staff.TRPCProvider trpcClient={staffClient} queryClient={queryClient}>
        <portal.TRPCProvider trpcClient={portalClient} queryClient={queryClient}>
          {children}
        </portal.TRPCProvider>
      </staff.TRPCProvider>
    </QueryClientProvider>
  );
}
