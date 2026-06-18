/**
 * Auth client thin re-export.
 *
 * The client is owned by `providers/auth-provider.tsx` (with plugins
 * wired through `getAuthClient()` so the type carries `signIn.magicLink`
 * + `organization.*`). This file exposes the same `authClient` named
 * export.
 */

// biome-ignore lint/performance/noBarrelFile: intentional public aggregator — stable authClient alias for the provider-owned client
export { getAuthClient as authClient } from '../providers/auth-provider.js';
