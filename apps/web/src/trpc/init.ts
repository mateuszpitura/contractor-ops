import type { AppRouter, PortalAppRouter } from '@contractor-ops/api';

import { createTRPCClient, httpBatchLink, httpLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import { makeQueryClient } from './query-client';

const isDev = process.env.NODE_ENV === 'development';

const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`;
const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc/portal`;

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
      callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), {
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
const trpcBase = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({
    links: [
      isDev
        ? httpLink({ url, transformer: superjson, fetch: fetchWithTimeout })
        : httpBatchLink({
            url,
            transformer: superjson,
            fetch: fetchWithTimeout,
          }),
    ],
  }),
  queryClient: makeQueryClient(),
});

type TrpcBase = typeof trpcBase;

/**
 * Typed tRPC options proxy (tRPC v11 + TanStack Query).
 *
 * Canonical usage:
 * - `useQuery(trpc.foo.bar.queryOptions(input, opts))`
 * - `useMutation(trpc.foo.bar.mutationOptions(opts))`
 */
/**
 * Sub-router keys gated by the classification kill-switch (`AppRouter` makes
 * these optional). The web app only ships classification UI when the module
 * is enabled, so we assert them as required.
 *
 * Keep this list type-safe: if a router is renamed/removed, TypeScript should
 * fail here (not "silently" at runtime).
 */
const classificationKeys = [
  'classification',
  'classificationDashboard',
  'classificationDocument',
  'ir35Chain',
  'ir35Attestation',
  'economicDependencyAlert',
  'reassessmentTrigger',
  'statusfeststellungsverfahren',
] as const satisfies ReadonlyArray<keyof TrpcBase>;

type ClassificationKeys = (typeof classificationKeys)[number];

type RequireNonNullableKeys<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};

// Compile-time guard: if a router key is renamed/removed, this becomes `never`.
type _AssertClassificationKeysExist =
  Exclude<ClassificationKeys, keyof TrpcBase> extends never ? true : never;
const assertClassificationKeysExist: _AssertClassificationKeysExist = true;
void assertClassificationKeysExist;

export const trpc = trpcBase as RequireNonNullableKeys<TrpcBase, ClassificationKeys>;

/**
 * Portal tRPC client — separate endpoint at `/api/trpc/portal` for contractor
 * portal procedures only. Authenticates via the cookie-based portal session
 * (`portalProcedure` middleware on the server).
 *
 * Used by UI under `app/[locale]/(portal)/` and `components/portal/`.
 * Internal staff UI must use the regular `trpc` client.
 */
export const portalTrpc = createTRPCOptionsProxy<PortalAppRouter>({
  client: createTRPCClient<PortalAppRouter>({
    links: [
      isDev
        ? httpLink({ url: portalUrl, transformer: superjson, fetch: fetchWithTimeout })
        : httpBatchLink({
            url: portalUrl,
            transformer: superjson,
            fetch: fetchWithTimeout,
          }),
    ],
  }),
  queryClient: makeQueryClient(),
});
