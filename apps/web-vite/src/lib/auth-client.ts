/**
 * Auth client thin re-export — mirrors apps/web/src/lib/auth-client.ts.
 *
 * In the new tree the client is owned by `providers/auth-provider.tsx`
 * (with plugins wired through `getAuthClient()` so the type carries
 * `signIn.magicLink` + `organization.*`). This file exposes the same
 * `authClient` named export so the Step 11 codemod can mechanically
 * swap `from '@/lib/auth-client'` → `from '../lib/auth-client.js'`
 * without rewriting call shape.
 */

export { getAuthClient as authClient } from '../providers/auth-provider.js';
