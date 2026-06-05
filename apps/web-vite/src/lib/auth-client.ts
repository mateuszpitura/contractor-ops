/**
 * Auth client thin re-export.
 *
 * The client is owned by `providers/auth-provider.tsx` (with plugins
 * wired through `getAuthClient()` so the type carries `signIn.magicLink`
 * + `organization.*`). This file exposes the same `authClient` named
 * export.
 */

export { getAuthClient as authClient } from '../providers/auth-provider.js';
