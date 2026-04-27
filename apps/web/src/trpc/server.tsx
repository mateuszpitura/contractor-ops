import 'server-only';

import {
  appRouter,
  createCallerFactory,
  createContext,
  portalAppRouter,
} from '@contractor-ops/api';
import { headers } from 'next/headers';
import { cache } from 'react';

/**
 * Server-side tRPC caller for use in Server Components (internal staff routes).
 * Creates a caller with the current request's headers for auth.
 *
 * Usage in Server Components:
 *   const api = await getServerApi();
 *   const data = await api.settings.get();
 */
const createCaller: ReturnType<typeof createCallerFactory> = createCallerFactory(appRouter);

type ServerApi = ReturnType<typeof createCaller>;

export const getServerApi: () => Promise<ServerApi> = cache(async () => {
  const h = await headers();
  return createCaller(await createContext({ headers: h }));
});

/**
 * Server-side tRPC caller for the contractor portal.
 *
 * Usage in portal Server Components:
 *   const api = await getPortalServerApi();
 *   const data = await api.portal.getSession();
 */
const createPortalCaller: ReturnType<typeof createCallerFactory> =
  createCallerFactory(portalAppRouter);

type PortalServerApi = ReturnType<typeof createPortalCaller>;

export const getPortalServerApi: () => Promise<PortalServerApi> = cache(async () => {
  const h = await headers();
  return createPortalCaller(await createContext({ headers: h }));
});
