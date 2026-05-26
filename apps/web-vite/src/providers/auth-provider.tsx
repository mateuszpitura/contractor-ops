/**
 * Better Auth client + React context.
 *
 * The framework-agnostic `createAuthClient` from `better-auth/react`
 * connects to the Fastify API mount (Step 3) at `${VITE_API_URL}/api/auth`.
 * `credentials: 'include'` is mandatory for the cross-subdomain cookie
 * posture (`SameSite=None; Secure; Domain=.contractor-ops.com`).
 *
 * Exposes `useAuth()` + `useSession()` so route loaders and components
 * can guard / display per-user state without reaching for the client
 * singleton directly.
 */

import { magicLinkClient, organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { getClientEnv } from '../env.js';

// Build the client at module scope so its precise plugin-augmented type
// (incl. signIn.magicLink + organization.* call sites) flows through
// `AuthClient` and the React context unchanged. Building inside a
// function would erase the plugin shape via the function's return type.
function buildClient() {
  const env = getClientEnv();
  return createAuthClient({
    baseURL: `${env.VITE_API_URL}/api/auth`,
    fetchOptions: { credentials: 'include' },
    plugins: [organizationClient(), magicLinkClient()],
  });
}

export type AuthClient = ReturnType<typeof buildClient>;

let cachedClient: AuthClient | undefined;

/**
 * Lazily build the singleton on first access. Plugin set mirrors
 * `packages/auth/src/client.ts` so the legacy `authClient.signIn.magicLink`
 * + `authClient.organization.*` call sites work unchanged after the
 * Step 11 codemod swap.
 */
export function getAuthClient(): AuthClient {
  if (cachedClient) return cachedClient;
  cachedClient = buildClient();
  return cachedClient;
}

const AuthContext = createContext<AuthClient | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
  client?: AuthClient;
}

export function AuthProvider({ children, client }: AuthProviderProps) {
  return <AuthContext.Provider value={client ?? getAuthClient()}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthClient {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

export function useSession() {
  return useAuth().useSession();
}
